"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import { Alerta, Botao, Cartao } from "@/components/ui";
import { formatarBRL, formatarHora } from "@/lib/formato";

interface Resultado {
  liberada: boolean;
  motivo: string | null;
  cliente: string | null;
  valorPago: number | null;
  pagaEm: string | null;
  codigo: string | null;
}

const TEMPO_RESULTADO_MS = 6000;

export function Porteiro() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const inicioDigitacao = useRef<number | null>(null);

  async function validar(texto: string, metodo: "qr" | "codigo", inicio: number) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch("/api/porteiro/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, metodo, duracaoClienteMs: performance.now() - inicio }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setResultado(j);
      navigator.vibrate?.(j.liberada ? 120 : [80, 60, 80, 60, 200]);
      setCodigo("");
      inicioDigitacao.current = null;
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Sem conexão. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    if (codigo.length === 6) validar(codigo, "codigo", inicioDigitacao.current ?? performance.now());
  }

  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => setResultado(null), TEMPO_RESULTADO_MS);
    return () => clearTimeout(t);
  }, [resultado]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-5">
      <Cartao className="p-3">
        <Scanner aoLer={(t) => validar(t, "qr", performance.now())} pausado={ocupado || Boolean(resultado)} />
        <p className="mt-3 text-center text-sm text-texto-2">Aponte para o Passe de Saída no celular do cliente.</p>
      </Cartao>

      {erro && <Alerta>{erro}</Alerta>}

      <Cartao>
        <form onSubmit={enviarCodigo} className="flex flex-col gap-3">
          <label htmlFor="codigo-saida" className="text-sm font-medium">A câmera falhou? Digite o código de 6 dígitos</label>
          <input
            id="codigo-saida"
            value={codigo}
            onChange={(e) => {
              if (inicioDigitacao.current === null) inicioDigitacao.current = performance.now();
              setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            className="num min-h-16 rounded-botao border border-borda bg-superficie text-center text-4xl font-bold tracking-[0.3em] focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
          />
          <Botao grande type="submit" disabled={codigo.length !== 6} carregando={ocupado}>
            Validar código
          </Botao>
        </form>
      </Cartao>

      {resultado && <TelaResultado r={resultado} fechar={() => setResultado(null)} />}
    </main>
  );
}

/** Resultado em tela cheia. Cores de status fixas (iguais em todo restaurante e tema). */
function TelaResultado({ r, fechar }: { r: Resultado; fechar: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={r.liberada ? "Saída liberada" : `Saída bloqueada: ${r.motivo}`}
      onClick={fechar}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 text-center text-white"
      style={{ backgroundColor: r.liberada ? "#16A34A" : "#DC2626" }}
    >
      {r.liberada ? <CheckCircle2 className="size-32" strokeWidth={2.2} aria-hidden /> : <XCircle className="size-32" strokeWidth={2.2} aria-hidden />}
      <p className="text-5xl font-extrabold leading-tight">{r.liberada ? "Saída liberada" : "Saída bloqueada"}</p>
      {!r.liberada && <p className="max-w-lg text-3xl font-bold leading-snug">{r.motivo}</p>}

      {(r.liberada || r.cliente) && (
        <div className="w-full max-w-sm rounded-[24px] bg-white p-5 text-left text-[#0F172A] shadow-xl">
          <dl className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <dt className="text-sm text-[#475569]">Cliente</dt>
              <dd className="text-2xl font-bold">{r.cliente ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[#475569]">Valor pago</dt>
              <dd className="num text-xl font-bold">{r.valorPago !== null ? formatarBRL(r.valorPago) : "-"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[#475569]">Pago às</dt>
              <dd className="num text-xl font-bold">{r.pagaEm ? formatarHora(r.pagaEm) : "-"}</dd>
            </div>
          </dl>
        </div>
      )}
      <p className="text-xl font-bold">Toque para o próximo cliente</p>
    </div>
  );
}
