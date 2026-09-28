import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { formatarDataHora, hojeSP, inicioDoDiaSP, somarDias } from "@/lib/formato";
import { calcularIndicadores, METAS } from "@/lib/indicadores";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ROTULO_STATUS, type StatusComanda } from "@/lib/tipos";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function celula(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toFixed(2).replace(".", ","));

/** CSV (separador ";", padrão do Excel em pt-BR) com indicadores e comandas do período. */
export const GET = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const params = new URL(req.url).searchParams;
  const ate = params.get("ate") ?? hojeSP();
  const de = params.get("de") ?? somarDias(ate, -6);
  if (!DATA.test(de) || !DATA.test(ate) || de > ate) throw new ErroApi(400, "Período inválido.");

  const restauranteId = perfil.restaurante_id!;
  const admin = supabaseAdmin();
  const ind = await calcularIndicadores(restauranteId, de, ate);
  const { data: comandas } = await admin
    .from("comandas")
    .select("codigo_curto,status,total,total_pago,criada_em,paga_em,saida_em,cancelada_motivo,usuarios!comandas_cliente_id_fkey(nome)")
    .eq("restaurante_id", restauranteId)
    .gte("criada_em", inicioDoDiaSP(de))
    .lt("criada_em", inicioDoDiaSP(somarDias(ate, 1)))
    .order("criada_em");

  const pct = (v: number | null) => (v === null ? "sem dados" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
  const linhas: string[] = [
    `Relatório Pague pelo App;${de} a ${ate}`,
    "",
    "Indicador;Valor;Meta",
    `Taxa de adoção;${pct(ind.adocao)};>= ${METAS.adocao * 100}%`,
    `Tempo médio de saída (s);${ind.tempoMedioSaidaMs === null ? "sem dados" : num(ind.tempoMedioSaidaMs / 1000)};< ${METAS.tempoSaidaMs / 1000}`,
    `Inadimplência;${pct(ind.inadimplencia)};< ${String(METAS.inadimplencia * 100).replace(".", ",")}%`,
    `NPS;${ind.nps ?? "sem dados"};>= ${METAS.nps}`,
    `Faturamento pelo app (R$);${num(ind.faturamento)};`,
    `Comandas;${ind.comandas};`,
    "",
    "Código;Cliente;Status;Total (R$);Pago (R$);Aberta em;Paga em;Saída em;Motivo cancelamento",
  ];
  for (const c of comandas ?? []) {
    const cliente = (c.usuarios as unknown as { nome: string } | null)?.nome;
    linhas.push(
      [
        c.codigo_curto,
        cliente,
        ROTULO_STATUS[c.status as StatusComanda],
        num(Number(c.total)),
        num(Number(c.total_pago)),
        formatarDataHora(c.criada_em),
        c.paga_em ? formatarDataHora(c.paga_em) : "",
        c.saida_em ? formatarDataHora(c.saida_em) : "",
        c.cancelada_motivo,
      ]
        .map(celula)
        .join(";"),
    );
  }

  // BOM para o Excel reconhecer UTF-8 (acentos).
  return new Response("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${de}-a-${ate}.csv"`,
    },
  });
});
