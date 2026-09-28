import { Cartao, SeloStatus, cx } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { formatarBRL, formatarHora, hojeSP, inicioDoDiaSP, somarDias } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase/server";
import { ROTULO_STATUS, type StatusComanda } from "@/lib/tipos";
import { CancelarComanda } from "./CancelarComanda";

export const metadata = { title: "Comandas" };

const STATUS = Object.keys(ROTULO_STATUS) as StatusComanda[];

export default async function Comandas({ searchParams }: PageProps<"/gerente/comandas">) {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente/comandas");
  const sp = await searchParams;
  const hoje = hojeSP();
  const data = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hoje;
  const status = STATUS.includes(sp.status as StatusComanda) ? (sp.status as StatusComanda) : null;

  const supabase = await supabaseServidor();
  let q = supabase
    .from("comandas")
    .select("*, usuarios!comandas_cliente_id_fkey(nome)")
    .eq("restaurante_id", perfil.restaurante_id!)
    .gte("criada_em", inicioDoDiaSP(data))
    .lt("criada_em", inicioDoDiaSP(somarDias(data, 1)))
    .order("criada_em", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: comandas } = await q;
  const lista = comandas ?? [];

  const contagem = lista.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Comandas</h1>
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-texto-2">
            Data
            <input type="date" name="data" defaultValue={data} max={hoje} className="min-h-12 rounded-botao border border-borda bg-superficie px-3 text-sm text-texto" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-texto-2">
            Status
            <select name="status" defaultValue={status ?? ""} className="min-h-12 rounded-botao border border-borda bg-superficie px-3 text-sm text-texto">
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{ROTULO_STATUS[s]}</option>
              ))}
            </select>
          </label>
          <button className="min-h-12 rounded-botao bg-marca px-4 text-sm font-semibold text-marca-texto">Filtrar</button>
        </form>
      </div>

      {!status && lista.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS.filter((s) => contagem[s]).map((s) => (
            <span key={s} className="rounded-full border border-borda bg-superficie px-3 py-1 text-sm">
              {ROTULO_STATUS[s]}: <strong className="num">{contagem[s]}</strong>
            </span>
          ))}
        </div>
      )}

      <Cartao className="overflow-x-auto p-0">
        {lista.length === 0 ? (
          <p className="p-8 text-center text-texto-2">Nenhuma comanda neste filtro.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-borda text-texto-2">
              <tr>
                {["Código", "Cliente", "Status", "Total", "Pago", "Aberta", "Paga", "Saída", ""].map((h) => (
                  <th key={h} className={cx("px-4 py-3 font-medium", ["Total", "Pago"].includes(h) && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.map((c) => (
                <tr key={c.id} className="hover:bg-superficie-2">
                  <td className="num px-4 py-3 font-bold tracking-wider">{c.codigo_curto}</td>
                  <td className="px-4 py-3">{(c.usuarios as { nome: string } | null)?.nome}</td>
                  <td className="px-4 py-3">
                    <SeloStatus status={c.status} />
                    {c.cancelada_motivo && <p className="mt-1 text-xs text-texto-2">{c.cancelada_motivo}</p>}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold">{formatarBRL(c.total)}</td>
                  <td className="num px-4 py-3 text-right">{formatarBRL(c.total_pago)}</td>
                  <td className="num px-4 py-3">{formatarHora(c.criada_em)}</td>
                  <td className="num px-4 py-3">{c.paga_em ? formatarHora(c.paga_em) : "—"}</td>
                  <td className="num px-4 py-3">{c.saida_em ? formatarHora(c.saida_em) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {["ABERTA", "PENDENTE_PAGAMENTO", "PAGA"].includes(c.status) && <CancelarComanda comandaId={c.id} codigo={c.codigo_curto} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </>
  );
}
