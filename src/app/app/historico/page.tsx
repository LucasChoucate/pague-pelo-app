import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { Cartao, SeloStatus, Vazio } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { formatarBRL, formatarDataHora } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase/server";
import type { StatusComanda } from "@/lib/tipos";

export const metadata = { title: "Histórico" };

export default async function Historico() {
  const perfil = await exigirPapelPagina(["cliente"], "/app/historico");
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("comandas")
    .select("id, codigo_curto, status, total, total_pago, criada_em, restaurantes(nome), pagamentos(id, status)")
    .eq("cliente_id", perfil.id)
    .order("criada_em", { ascending: false })
    .limit(50);
  const comandas = data ?? [];

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <h1 className="text-2xl font-bold">Histórico</h1>
      {comandas.length === 0 ? (
        <Vazio icone={<History className="size-7" />} titulo="Nenhuma visita ainda" texto="Suas comandas e comprovantes aparecem aqui." />
      ) : (
        <Cartao className="p-3">
          <ul className="flex flex-col divide-y divide-borda">
            {comandas.map((c) => {
              const pagamentos = (c.pagamentos as { id: string; status: string }[]).filter((p) => p.status === "aprovado");
              const ultimo = pagamentos.at(-1);
              const conteudo = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{(c.restaurantes as unknown as { nome: string }).nome}</p>
                    <p className="num text-sm text-texto-2">
                      {formatarDataHora(c.criada_em)} · {c.codigo_curto}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="num font-semibold">{formatarBRL(c.total)}</span>
                    <SeloStatus status={c.status as StatusComanda} />
                  </div>
                  {ultimo && <ChevronRight className="size-5 text-texto-2" aria-hidden />}
                </>
              );
              return (
                <li key={c.id}>
                  {ultimo ? (
                    <Link href={`/app/comprovante/${ultimo.id}`} className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 hover:bg-superficie-2">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex min-h-16 items-center gap-3 px-2 py-3">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}
    </main>
  );
}
