"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Wallet } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { Alerta, Carregando } from "@/components/ui";
import { FUSO, formatarBRL, formatarHora } from "@/lib/formato";
import { useComandaAoVivo } from "@/lib/useComandaAoVivo";

interface Passe {
  token: string;
  codigo: string;
  renovaEm: number;
  agora: number;
  nome: string;
  totalPago: number;
  pagaEm: string | null;
  /** relógio do servidor − relógio do celular */
  desvio: number;
}

const JANELA_MS = 30_000;
const relogio = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function PasseSaida({ comandaId, restaurante, corRestaurante }: { comandaId: string; restaurante: string; corRestaurante: string }) {
  const router = useRouter();
  const { comanda } = useComandaAoVivo(comandaId);
  const [passe, setPasse] = useState<Passe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const status = comanda?.status;

  const buscar = useCallback(async () => {
    try {
      const r = await fetch("/api/passe", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setPasse({ ...j, desvio: j.agora - Date.now() });
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Sem conexão para renovar o passe.");
    }
  }, []);

  // Busca inicial e sempre que a comanda voltar a ficar PAGA.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o servidor
    if (status === "PAGA") buscar();
  }, [status, buscar]);

  // Renova ao virar a janela de 30 s.
  useEffect(() => {
    if (!passe || status !== "PAGA") return;
    const espera = Math.max(passe.renovaEm - (Date.now() + passe.desvio), 0) + 150;
    const t = setTimeout(buscar, espera);
    return () => clearTimeout(t);
  }, [passe, status, buscar]);

  // Relógio "vivo" (dificulta usar print da tela).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Mantém a tela acesa enquanto o passe está aberto.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (status === "FINALIZADA") router.replace(`/app/avaliar?c=${comandaId}`);
  }, [status, comandaId, router]);

  if (!comanda) return <Carregando />;

  if (status === "PENDENTE_PAGAMENTO" || status === "ABERTA") {
    const saldo = Number(comanda.total) - Number(comanda.total_pago);
    return (
      <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),20px)]">
        <h1 className="text-xl font-bold">Passe de Saída</h1>
        <Alerta tipo="atencao">
          {status === "ABERTA"
            ? "Sua comanda ainda não tem itens pagos."
            : `Foi lançado um novo item. Pague a diferença de ${formatarBRL(saldo)} para liberar a saída.`}
        </Alerta>
        {status === "PENDENTE_PAGAMENTO" && (
          <Link
            href="/app/pagar"
            className="flex min-h-14 items-center justify-center gap-2 rounded-botao bg-marca text-lg font-semibold text-marca-texto hover:brightness-110"
          >
            <Wallet className="size-5" aria-hidden /> Pagar {formatarBRL(saldo)}
          </Link>
        )}
      </main>
    );
  }

  const agoraServidor = agora + (passe?.desvio ?? 0);
  const restanteMs = passe ? Math.max(passe.renovaEm - agoraServidor, 0) : 0;
  const progresso = restanteMs / JANELA_MS;

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),16px)]">
      <section className="brilho-passante linhas-decorativas relative overflow-hidden rounded-[28px] bg-marca p-5 text-marca-texto shadow-cartao">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: corRestaurante }} aria-hidden />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">{restaurante}</p>
            <h1 className="text-2xl font-bold">Passe de Saída</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-sm font-semibold">
            <span className="pulso-vivo size-2 rounded-full bg-current" aria-hidden /> AO VIVO
          </span>
        </div>

        <div className="relative z-10 mt-4 flex flex-col items-center">
          {passe ? (
            <QrCode valor={passe.token} tamanho={232} rotulo="QR Code do Passe de Saída" />
          ) : (
            <div className="size-[232px] animate-pulse rounded-2xl bg-white/40" />
          )}

          {/* barra de contagem até o próximo código */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/20" role="progressbar" aria-label="Tempo até o próximo código"
            aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.ceil(restanteMs / 1000)}>
            <div className="h-full rounded-full bg-current transition-[width] duration-200 ease-linear" style={{ width: `${progresso * 100}%` }} />
          </div>
          <p className="mt-1.5 text-sm opacity-90">Novo código em {Math.ceil(restanteMs / 1000)} s</p>

          <p className="mt-3 text-sm opacity-90">Código alternativo</p>
          <p className="num text-4xl font-bold tracking-[0.25em]" aria-live="polite">
            {passe ? `${passe.codigo.slice(0, 3)} ${passe.codigo.slice(3)}` : "--- ---"}
          </p>
        </div>
      </section>

      {erro && <Alerta tipo="atencao">{erro}</Alerta>}

      <section className="rounded-[24px] border border-borda bg-superficie p-5 shadow-cartao">
        <div className="flex items-center justify-between">
          <p className="num text-3xl font-bold" aria-label="Horário atual">{relogio.format(agoraServidor)}</p>
          <ShieldCheck className="size-8 text-ok" aria-hidden />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-texto-2">Cliente</dt>
            <dd className="font-semibold">{passe?.nome ?? "…"}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Valor pago</dt>
            <dd className="num font-semibold">{passe ? formatarBRL(passe.totalPago) : "…"}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Pago às</dt>
            <dd className="num font-semibold">{passe?.pagaEm ? formatarHora(passe.pagaEm, true) : "…"}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Comanda</dt>
            <dd className="num font-semibold">{comanda.codigo_curto}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-texto-2">
          Mostre esta tela ao porteiro. O código muda a cada 30 segundos e só pode ser usado uma vez: prints e fotos não funcionam.
        </p>
      </section>
    </main>
  );
}
