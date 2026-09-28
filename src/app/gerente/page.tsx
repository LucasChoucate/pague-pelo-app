import { AlertTriangle, CheckCircle2, Download, MinusCircle } from "lucide-react";
import { Cartao, cx } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { formatarBRL, formatarData, hojeSP, somarDias } from "@/lib/formato";
import { calcularIndicadores, METAS } from "@/lib/indicadores";
import { supabaseServidor } from "@/lib/supabase/server";
import { FormMovimento } from "./FormMovimento";

export const metadata = { title: "Indicadores" };

const DATA = /^\d{4}-\d{2}-\d{2}$/;

type Situacao = "ok" | "abaixo" | "sem";

function pct(v: number | null, casas = 1) {
  return v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
}

export default async function Indicadores({ searchParams }: PageProps<"/gerente">) {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente");
  const sp = await searchParams;
  const hoje = hojeSP();
  const ate = typeof sp.ate === "string" && DATA.test(sp.ate) ? sp.ate : hoje;
  const de = typeof sp.de === "string" && DATA.test(sp.de) && sp.de <= ate ? sp.de : somarDias(ate, -6);

  const ind = await calcularIndicadores(perfil.restaurante_id!, de, ate);
  const supabase = await supabaseServidor();
  const { data: mov } = await supabase
    .from("movimento_diario")
    .select("clientes_caixa")
    .eq("restaurante_id", perfil.restaurante_id!)
    .eq("data", hoje)
    .maybeSingle();

  const kpis: { titulo: string; valor: string; meta: string; situacao: Situacao; detalhe: string }[] = [
    {
      titulo: "Adoção do app",
      valor: pct(ind.adocao),
      meta: `Meta ≥ ${METAS.adocao * 100}%`,
      situacao: ind.adocao === null ? "sem" : ind.adocao >= METAS.adocao ? "ok" : "abaixo",
      detalhe: `${ind.pagasPeloApp} pelo app · ${ind.clientesCaixa} no caixa`,
    },
    {
      titulo: "Tempo médio de saída",
      valor: ind.tempoMedioSaidaMs === null ? "—" : `${(ind.tempoMedioSaidaMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`,
      meta: `Meta < ${METAS.tempoSaidaMs / 1000} s`,
      situacao: ind.tempoMedioSaidaMs === null ? "sem" : ind.tempoMedioSaidaMs < METAS.tempoSaidaMs ? "ok" : "abaixo",
      detalhe: `${ind.validacoes.liberadas} liberadas · ${ind.validacoes.bloqueadas} bloqueadas`,
    },
    {
      titulo: "Inadimplência",
      valor: pct(ind.inadimplencia, 2),
      meta: "Meta < 0,5%",
      situacao: ind.inadimplencia === null ? "sem" : ind.inadimplencia < METAS.inadimplencia ? "ok" : "abaixo",
      detalhe: `${ind.inadimplentes} comanda(s) não paga(s) no dia`,
    },
    {
      titulo: "NPS",
      valor: ind.nps === null ? "—" : String(ind.nps),
      meta: `Meta ≥ ${METAS.nps}`,
      situacao: ind.nps === null ? "sem" : ind.nps >= METAS.nps ? "ok" : "abaixo",
      detalhe: `${ind.respostasNps} resposta(s)`,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Indicadores</h1>
          <p className="text-sm text-texto-2">
            {formatarData(`${de}T12:00:00Z`)} a {formatarData(`${ate}T12:00:00Z`)}
          </p>
        </div>
        {/* Filtros em uma linha acima dos números */}
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-texto-2">
            De
            <input type="date" name="de" defaultValue={de} max={hoje} className="min-h-12 rounded-botao border border-borda bg-superficie px-3 text-sm text-texto" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-texto-2">
            Até
            <input type="date" name="ate" defaultValue={ate} max={hoje} className="min-h-12 rounded-botao border border-borda bg-superficie px-3 text-sm text-texto" />
          </label>
          <button className="min-h-12 rounded-botao bg-marca px-4 text-sm font-semibold text-marca-texto">Aplicar</button>
          <a
            href={`/api/gerente/relatorio?de=${de}&ate=${ate}`}
            className="inline-flex min-h-12 items-center gap-2 rounded-botao border border-borda bg-superficie px-4 text-sm font-semibold"
          >
            <Download className="size-4" aria-hidden /> Baixar CSV
          </a>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Cartao key={k.titulo} className="flex flex-col gap-1">
            <p className="text-sm font-medium text-texto-2">{k.titulo}</p>
            <p className="num text-4xl font-bold">{k.valor}</p>
            <SeloMeta situacao={k.situacao} meta={k.meta} />
            <p className="mt-1 text-xs text-texto-2">{k.detalhe}</p>
          </Cartao>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao>
          <p className="text-sm font-medium text-texto-2">Faturamento pelo app</p>
          <p className="num text-3xl font-bold">{formatarBRL(ind.faturamento)}</p>
        </Cartao>
        <Cartao>
          <p className="text-sm font-medium text-texto-2">Comandas no período</p>
          <p className="num text-3xl font-bold">{ind.comandas}</p>
        </Cartao>
        <Cartao>
          <p className="text-sm font-medium text-texto-2">Ticket médio</p>
          <p className="num text-3xl font-bold">{ind.ticketMedio === null ? "—" : formatarBRL(ind.ticketMedio)}</p>
        </Cartao>
      </div>

      <Cartao>
        <h2 className="text-lg font-bold">Movimento do caixa tradicional (hoje)</h2>
        <p className="mb-3 text-sm text-texto-2">
          Informe quantos clientes pagaram no caixa comum hoje. É a base da taxa de adoção do app.
        </p>
        <FormMovimento data={hoje} inicial={mov?.clientes_caixa ?? 0} />
      </Cartao>
    </>
  );
}

function SeloMeta({ situacao, meta }: { situacao: Situacao; meta: string }) {
  const [Icone, rotulo, cor] =
    situacao === "ok"
      ? [CheckCircle2, "Meta atingida", "text-ok-texto"]
      : situacao === "abaixo"
        ? [AlertTriangle, "Fora da meta", "text-atencao-texto"]
        : [MinusCircle, "Sem dados", "text-texto-2"];
  return (
    <p className={cx("flex flex-wrap items-center gap-1.5 text-sm font-semibold", cor)}>
      <Icone className="size-4" aria-hidden /> {rotulo}
      <span className="font-normal text-texto-2">· {meta}</span>
    </p>
  );
}
