import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar } from "@/lib/contas";
import { formatarBRL } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Comanda } from "@/lib/tipos";
import { situacaoCodigo, verificarToken } from "@/lib/tokens";

interface Corpo {
  texto?: string;
  metodo?: "qr" | "codigo";
  /** Tempo decorrido no aparelho do porteiro desde a leitura/digitação. */
  duracaoClienteMs?: number;
}

export const POST = rota(async (req) => {
  const inicio = Date.now();
  const perfil = await exigirPapelApi(["porteiro"]);
  const corpo = (await req.json()) as Corpo;
  const metodo = corpo.metodo === "codigo" ? "codigo" : "qr";
  const texto = (corpo.texto ?? "").trim();
  if (!texto) throw new ErroApi(400, "Escaneie o passe ou digite o código.");

  const admin = supabaseAdmin();
  const restauranteId = perfil.restaurante_id!;
  let comanda: Comanda | null = null;
  let motivo: string | null = null;

  if (metodo === "qr") {
    const r = await verificarToken(texto, "saida", inicio);
    if (!r.ok && r.motivo === "invalido") {
      const ehComanda = (await verificarToken(texto, "comanda")).ok;
      motivo = ehComanda
        ? "Este é o QR da comanda, não o Passe de Saída"
        : "Passe inválido";
    } else if (r.restauranteId !== restauranteId) {
      motivo = "Passe de outro restaurante";
    } else if (!r.ok) {
      motivo = "Passe expirado";
      // Mesmo expirado, registra a qual comanda pertencia.
      const { data } = await admin.from("comandas").select("*").eq("id", r.comandaId!).maybeSingle();
      comanda = data as Comanda | null;
    } else {
      const { data } = await admin.from("comandas").select("*").eq("id", r.comandaId).maybeSingle();
      comanda = data as Comanda | null;
      if (!comanda) motivo = "Comanda não encontrada";
    }
  } else {
    const codigo = texto.replace(/\D/g, "");
    if (codigo.length !== 6) throw new ErroApi(400, "O código tem 6 dígitos.");
    const dezMinAtras = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: candidatas } = await admin
      .from("comandas")
      .select("*")
      .eq("restaurante_id", restauranteId)
      .or(`status.in.(PAGA,PENDENTE_PAGAMENTO),and(status.eq.FINALIZADA,saida_em.gte.${dezMinAtras})`);
    const lista = (candidatas ?? []) as Comanda[];
    comanda = lista.find((c) => situacaoCodigo(c.id, codigo, inicio) === "valido") ?? null;
    if (!comanda) {
      const vencida = lista.find((c) => situacaoCodigo(c.id, codigo, inicio) === "expirado");
      if (vencida) {
        comanda = vencida;
        motivo = "Passe expirado";
      } else {
        motivo = "Código inválido";
      }
    }
  }

  // Regras de status (só se o passe em si foi aceito).
  if (comanda && !motivo) {
    const saldo = Number(comanda.total) - Number(comanda.total_pago);
    if (comanda.status === "FINALIZADA") motivo = "Passe já utilizado";
    else if (comanda.status === "PENDENTE_PAGAMENTO") motivo = `Comanda com saldo pendente de ${formatarBRL(saldo)}`;
    else if (comanda.status === "ABERTA") motivo = "Comanda ainda não foi paga";
    else if (comanda.status === "CANCELADA" || comanda.status === "EXPIRADA") motivo = "Comanda cancelada";
    else {
      // Uso único: só finaliza se ainda estiver PAGA (atômico).
      const { data: finalizada } = await admin
        .from("comandas")
        .update({ status: "FINALIZADA", saida_em: new Date().toISOString() })
        .eq("id", comanda.id)
        .eq("status", "PAGA")
        .select()
        .maybeSingle();
      if (finalizada) comanda = finalizada as Comanda;
      else motivo = "Passe já utilizado";
    }
  }

  const liberada = !motivo;
  const duracao = Math.max(0, Math.round(Number(corpo.duracaoClienteMs) || 0)) + (Date.now() - inicio);
  const { data: validacao } = await admin
    .from("validacoes_saida")
    .insert({
      comanda_id: comanda?.id ?? null,
      restaurante_id: restauranteId,
      porteiro_id: perfil.id,
      resultado: liberada ? "liberada" : "bloqueada",
      motivo,
      metodo,
      duracao_ms: Math.min(duracao, 600_000),
    })
    .select("id")
    .single();

  if (liberada && comanda) {
    await auditar(admin, {
      usuario_id: perfil.id,
      restaurante_id: restauranteId,
      acao: "saida_validada",
      entidade: "comandas",
      entidade_id: comanda.id,
      depois: { status: "FINALIZADA", saida_em: comanda.saida_em, validacao_id: validacao?.id },
    });
  }

  let cliente: string | null = null;
  if (comanda) {
    const { data } = await admin.from("usuarios").select("nome").eq("id", comanda.cliente_id).single();
    cliente = data?.nome ?? null;
  }

  return NextResponse.json({
    liberada,
    motivo,
    cliente,
    valorPago: comanda ? Number(comanda.total_pago) : null,
    pagaEm: comanda?.paga_em ?? null,
    codigo: comanda?.codigo_curto ?? null,
  });
});
