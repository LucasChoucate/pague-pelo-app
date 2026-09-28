"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorOpen, Radio, Wallet } from "lucide-react";
import { ListaItens } from "@/components/ListaItens";
import { QrCode } from "@/components/QrCode";
import { Alerta, Cartao, Carregando, SeloStatus } from "@/components/ui";
import { formatarBRL } from "@/lib/formato";
import { useComandaAoVivo } from "@/lib/useComandaAoVivo";

export function ComandaCliente({
  comandaId,
  restaurante,
  emojis,
}: {
  comandaId: string;
  restaurante: { nome: string; cor: string; precoKg: number };
  emojis: Record<string, string | null>;
}) {
  const router = useRouter();
  const { comanda, itens, carregando, erro } = useComandaAoVivo(comandaId);
  const [token, setToken] = useState<string | null>(null);
  const [erroToken, setErroToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/comanda/qr")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.erro);
        setToken(j.token);
      })
      .catch((e) => setErroToken(e.message || "Não foi possível gerar o QR."));
  }, []);

  useEffect(() => {
    if (comanda?.status === "FINALIZADA") router.replace(`/app/avaliar?c=${comandaId}`);
  }, [comanda?.status, comandaId, router]);

  if (carregando || !comanda) return <Carregando texto="Abrindo sua comanda..." />;

  const saldo = Number(comanda.total) - Number(comanda.total_pago);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),16px)]">
      <Cartao className="relative overflow-hidden pt-7 text-center">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: restaurante.cor }} aria-hidden />
        <div className="flex items-center justify-between text-left">
          <div>
            <p className="text-sm text-texto-2">{restaurante.nome}</p>
            <h1 className="text-xl font-bold">Minha comanda</h1>
          </div>
          <SeloStatus status={comanda.status} />
        </div>

        <div className="mt-5 flex justify-center">
          {token ? (
            <QrCode valor={token} tamanho={248} rotulo={`QR Code da comanda ${comanda.codigo_curto}`} className="border border-borda" />
          ) : erroToken ? (
            <Alerta>{erroToken}</Alerta>
          ) : (
            <div className="size-[248px] animate-pulse rounded-2xl bg-superficie-2" />
          )}
        </div>
        <p className="mt-4 text-sm text-texto-2">Mostre ao caixa ou diga o código</p>
        <p className="num text-4xl font-bold tracking-[0.3em]">{comanda.codigo_curto}</p>
      </Cartao>

      {erro && <Alerta tipo="atencao">{erro}</Alerta>}

      <Cartao>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Consumo</h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-texto-2">
            <Radio className="pulso-vivo size-3.5 text-marca" aria-hidden /> ao vivo
          </span>
        </div>

        {itens.length === 0 ? (
          <p className="rounded-[18px] bg-superficie-2 p-4 text-center text-sm text-texto-2">
            Ainda sem itens. Quando o caixa pesar seu prato ({formatarBRL(restaurante.precoKg)}/kg), ele aparece aqui na hora.
          </p>
        ) : (
          <ListaItens itens={itens} emojis={emojis} />
        )}

        <dl className="mt-4 flex flex-col gap-1 border-t border-borda pt-4">
          <div className="flex justify-between text-texto-2">
            <dt>Subtotal</dt>
            <dd className="num">{formatarBRL(comanda.total)}</dd>
          </div>
          {Number(comanda.total_pago) > 0 && (
            <div className="flex justify-between text-texto-2">
              <dt>Já pago</dt>
              <dd className="num">− {formatarBRL(comanda.total_pago)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">{Number(comanda.total_pago) > 0 ? "Falta pagar" : "Total"}</dt>
            <dd className="num text-3xl font-bold">{formatarBRL(Math.max(saldo, 0))}</dd>
          </div>
        </dl>
      </Cartao>

      {comanda.status === "PENDENTE_PAGAMENTO" && (
        <Link
          href="/app/pagar"
          className="flex min-h-14 items-center justify-center gap-2 rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao hover:brightness-110"
        >
          <Wallet className="size-5" aria-hidden />
          {Number(comanda.total_pago) > 0 ? `Pagar diferença de ${formatarBRL(saldo)}` : `Pagar ${formatarBRL(saldo)}`}
        </Link>
      )}
      {comanda.status === "PAGA" && (
        <Link
          href="/app/saida"
          className="flex min-h-14 items-center justify-center gap-2 rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao hover:brightness-110"
        >
          <DoorOpen className="size-5" aria-hidden /> Mostrar Passe de Saída
        </Link>
      )}
    </main>
  );
}
