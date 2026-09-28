import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, DoorOpen } from "lucide-react";
import { Cartao } from "@/components/ui";
import { formatarBRL, formatarDataHora } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase/server";

export const metadata = { title: "Comprovante" };

export default async function Comprovante({ params }: PageProps<"/app/comprovante/[id]">) {
  const { id } = await params;
  const supabase = await supabaseServidor();
  // RLS: o cliente só enxerga os próprios pagamentos.
  const { data: p } = await supabase
    .from("pagamentos")
    .select("*, comandas(codigo_curto, status, total, total_pago), restaurantes(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const aprovado = p.status === "aprovado";
  const comanda = p.comandas as { codigo_curto: string; status: string; total: number; total_pago: number };
  const linhas: [string, string][] = [
    ["Restaurante", (p.restaurantes as { nome: string }).nome],
    ["Comanda", comanda.codigo_curto],
    ["Forma de pagamento", p.metodo === "pix" ? "Pix" : `Cartão final ${p.cartao_final ?? "----"}`],
    ["Data e hora", formatarDataHora(p.aprovado_em ?? p.criado_em)],
    ["Autenticação", p.referencia_externa ?? "-"],
  ];

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <Cartao className="text-center">
        {aprovado ? (
          <CheckCircle2 className="mx-auto size-16 text-ok" aria-hidden />
        ) : (
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-superficie-2 text-2xl" aria-hidden>…</span>
        )}
        <h1 className="mt-3 text-xl font-bold">{aprovado ? "Pagamento aprovado" : `Pagamento ${p.status}`}</h1>
        <p className="num mt-1 text-4xl font-bold">{formatarBRL(p.valor)}</p>
        <p className="mt-1 text-xs text-texto-2">Comprovante nº {String(p.id).slice(0, 8).toUpperCase()} · simulado</p>

        <dl className="mt-5 flex flex-col gap-2 border-t border-dashed border-borda pt-4 text-left text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-texto-2">{k}</dt>
              <dd className="num text-right font-medium break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      {comanda.status === "PAGA" && (
        <Link
          href="/app/saida"
          className="flex min-h-14 items-center justify-center gap-2 rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao hover:brightness-110"
        >
          <DoorOpen className="size-5" aria-hidden /> Mostrar Passe de Saída
        </Link>
      )}
      {comanda.status === "PENDENTE_PAGAMENTO" && (
        <Link href="/app/pagar" className="flex min-h-12 items-center justify-center rounded-botao border border-borda bg-superficie font-semibold">
          Ainda há saldo pendente. Pagar diferença
        </Link>
      )}
      <Link href="/app" className="text-center font-semibold text-marca hover:underline">
        Voltar ao início
      </Link>
    </main>
  );
}
