import "server-only";
import { hojeSP, inicioDoDiaSP, somarDias } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Comanda } from "@/lib/tipos";

export const METAS = {
  adocao: 0.6, // ≥ 60% no 1º mês
  tempoSaidaMs: 30_000, // < 30 s
  inadimplencia: 0.005, // < 0,5%
  nps: 75, // ≥ 75
};

export interface Indicadores {
  periodo: { de: string; ate: string };
  comandas: number;
  comandasComConsumo: number;
  pagasPeloApp: number;
  clientesCaixa: number;
  faturamento: number;
  ticketMedio: number | null;
  adocao: number | null;
  tempoMedioSaidaMs: number | null;
  validacoes: { liberadas: number; bloqueadas: number };
  inadimplencia: number | null;
  inadimplentes: number;
  nps: number | null;
  respostasNps: number;
}

export async function calcularIndicadores(restauranteId: string, de: string, ate: string): Promise<Indicadores> {
  const admin = supabaseAdmin();
  const inicio = inicioDoDiaSP(de);
  const fim = inicioDoDiaSP(somarDias(ate, 1));
  const hoje = inicioDoDiaSP(hojeSP());

  const [comandasR, movR, valR, npsR] = await Promise.all([
    admin
      .from("comandas")
      .select("id,status,total,total_pago,criada_em")
      .eq("restaurante_id", restauranteId)
      .gte("criada_em", inicio)
      .lt("criada_em", fim),
    admin
      .from("movimento_diario")
      .select("clientes_caixa")
      .eq("restaurante_id", restauranteId)
      .gte("data", de)
      .lte("data", ate),
    admin
      .from("validacoes_saida")
      .select("resultado,duracao_ms")
      .eq("restaurante_id", restauranteId)
      .gte("criado_em", inicio)
      .lt("criado_em", fim),
    admin
      .from("nps")
      .select("nota")
      .eq("restaurante_id", restauranteId)
      .gte("criado_em", inicio)
      .lt("criado_em", fim),
  ]);

  const comandas = (comandasR.data ?? []) as Pick<Comanda, "id" | "status" | "total" | "total_pago" | "criada_em">[];
  const validas = comandas.filter((c) => c.status !== "CANCELADA" && c.status !== "EXPIRADA");
  const comConsumo = validas.filter((c) => Number(c.total) > 0);
  const pagas = validas.filter((c) => c.status === "PAGA" || c.status === "FINALIZADA");
  const clientesCaixa = (movR.data ?? []).reduce((s, m) => s + m.clientes_caixa, 0);
  const faturamento = validas.reduce((s, c) => s + Number(c.total_pago), 0);

  // Inadimplência: comandas de dias já encerrados que ficaram com saldo.
  const diasEncerrados = comConsumo.filter((c) => c.criada_em < hoje);
  const inadimplentes = diasEncerrados.filter((c) => Number(c.total) > Number(c.total_pago)).length;

  const liberadas = (valR.data ?? []).filter((v) => v.resultado === "liberada");
  const tempos = liberadas.map((v) => v.duracao_ms).filter((d): d is number => typeof d === "number");

  const notas = (npsR.data ?? []).map((n) => n.nota);
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;

  const baseAdocao = pagas.length + clientesCaixa;

  return {
    periodo: { de, ate },
    comandas: validas.length,
    comandasComConsumo: comConsumo.length,
    pagasPeloApp: pagas.length,
    clientesCaixa,
    faturamento,
    ticketMedio: pagas.length ? faturamento / pagas.length : null,
    adocao: baseAdocao ? pagas.length / baseAdocao : null,
    tempoMedioSaidaMs: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
    validacoes: { liberadas: liberadas.length, bloqueadas: (valR.data ?? []).length - liberadas.length },
    inadimplencia: diasEncerrados.length ? inadimplentes / diasEncerrados.length : null,
    inadimplentes,
    nps: notas.length ? Math.round(((promotores - detratores) / notas.length) * 100) : null,
    respostasNps: notas.length,
  };
}
