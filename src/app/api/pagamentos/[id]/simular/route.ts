import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { PAGAMENTO_SIMULADO } from "@/lib/pagamentos";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Faz o papel do webhook do provedor Pix no modo simulado.
 * Com um gateway real, esta rota deixa de existir e o webhook assinado
 * do provedor chama `confirmar_pagamento`.
 */
export const POST = rota(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  if (!PAGAMENTO_SIMULADO) throw new ErroApi(404, "Indisponível.");
  const perfil = await exigirPapelApi(["cliente"]);
  const { id } = await ctx.params;
  const admin = supabaseAdmin();

  const { data: pagamento } = await admin.from("pagamentos").select("*").eq("id", id).maybeSingle();
  if (!pagamento || pagamento.cliente_id !== perfil.id) throw new ErroApi(404, "Pagamento não encontrado.");
  if (pagamento.metodo !== "pix") throw new ErroApi(400, "Só cobranças Pix são aprovadas por aqui.");

  const { data: conf, error } = await admin.rpc("confirmar_pagamento", {
    p_pagamento: id,
    p_referencia: pagamento.referencia_externa,
  });
  if (error) throw new ErroApi(500, "Falha ao confirmar o pagamento.");
  if (!conf?.ok) throw new ErroApi(409, conf?.motivo ?? "Pagamento não confirmado.");
  return NextResponse.json({ ok: true, pagamentoId: id });
});
