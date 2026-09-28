import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { comandaAtivaDoCliente } from "@/lib/comandas";
import { gateway, type DadosCartao } from "@/lib/pagamentos";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Inicia o pagamento do SALDO da comanda ativa.
 * O valor é sempre calculado aqui (total - total_pago), nunca vem do front.
 */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["cliente"]);
  const corpo = (await req.json()) as { metodo: "pix" | "cartao"; cartao?: DadosCartao };
  if (corpo.metodo !== "pix" && corpo.metodo !== "cartao") throw new ErroApi(400, "Método inválido.");

  const comanda = await comandaAtivaDoCliente(perfil.id);
  const saldo = Math.round((Number(comanda.total) - Number(comanda.total_pago)) * 100) / 100;
  if (comanda.status !== "PENDENTE_PAGAMENTO" || saldo <= 0) {
    throw new ErroApi(409, "Não há saldo a pagar nesta comanda.");
  }

  const admin = supabaseAdmin();
  // Só uma cobrança pendente por vez.
  await admin
    .from("pagamentos")
    .update({ status: "cancelado", motivo: "Substituído por nova cobrança" })
    .eq("comanda_id", comanda.id)
    .eq("status", "pendente");

  const { data: pagamento, error } = await admin
    .from("pagamentos")
    .insert({
      comanda_id: comanda.id,
      restaurante_id: comanda.restaurante_id,
      cliente_id: perfil.id,
      metodo: corpo.metodo,
      valor: saldo,
    })
    .select()
    .single();
  if (error || !pagamento) throw new ErroApi(500, "Não foi possível iniciar o pagamento.");

  if (corpo.metodo === "pix") {
    const cobranca = await gateway.criarCobrancaPix({
      valor: saldo,
      pagamentoId: pagamento.id,
      descricao: `COMANDA ${comanda.codigo_curto}`,
    });
    const { data: atualizado } = await admin
      .from("pagamentos")
      .update({ referencia_externa: cobranca.referencia, pix_copia_e_cola: cobranca.copiaECola })
      .eq("id", pagamento.id)
      .select()
      .single();
    return NextResponse.json({ pagamento: atualizado, expiraEm: cobranca.expiraEm });
  }

  if (!corpo.cartao) throw new ErroApi(400, "Informe os dados do cartão.");
  const resultado = await gateway.cobrarCartao({ valor: saldo, pagamentoId: pagamento.id, cartao: corpo.cartao });

  if (!resultado.aprovado) {
    await admin
      .from("pagamentos")
      .update({ status: "recusado", motivo: resultado.motivo, cartao_final: resultado.final })
      .eq("id", pagamento.id);
    throw new ErroApi(402, resultado.motivo);
  }

  await admin.from("pagamentos").update({ cartao_final: resultado.final }).eq("id", pagamento.id);
  const { data: conf, error: e2 } = await admin.rpc("confirmar_pagamento", {
    p_pagamento: pagamento.id,
    p_referencia: resultado.referencia,
  });
  if (e2) throw new ErroApi(500, "Falha ao confirmar o pagamento.");
  if (!conf?.ok) throw new ErroApi(409, conf?.motivo ?? "Pagamento não confirmado.");
  return NextResponse.json({ pagamentoId: pagamento.id, aprovado: true });
});
