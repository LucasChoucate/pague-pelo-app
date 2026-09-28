"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Heart } from "lucide-react";
import { Alerta, Botao, Cartao, cx } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/client";

export function Avaliacao({ comandaId, restaurante, jaAvaliou }: { comandaId: string; restaurante: string; jaAvaliou: boolean }) {
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(jaAvaliou);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    if (nota === null) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabaseNavegador().rpc("enviar_nps", {
      p_comanda: comandaId,
      p_nota: nota,
      p_comentario: comentario || null,
    });
    setOcupado(false);
    if (error) setErro(error.message);
    else setEnviado(true);
  }

  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <section className="linhas-decorativas rounded-[28px] bg-marca p-6 text-marca-texto shadow-cartao">
        <CheckCircle2 className="size-10" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">Saída liberada. Até a próxima!</h1>
        <p className="mt-1 opacity-90">Obrigado por usar o Pague pelo App no {restaurante}.</p>
      </section>

      {enviado ? (
        <Cartao className="text-center">
          <Heart className="mx-auto size-10 text-destaque" aria-hidden />
          <p className="mt-2 text-lg font-semibold">Obrigado pela avaliação!</p>
          <p className="mt-1 text-sm text-texto-2">Você já pode pegar uma nova comanda na próxima visita.</p>
          <Link href="/app" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-botao bg-marca px-6 font-semibold text-marca-texto">
            Voltar ao início
          </Link>
        </Cartao>
      ) : (
        <Cartao>
          <h2 className="text-lg font-bold">De 0 a 10, quanto você recomendaria o Pague pelo App a um amigo?</h2>
          <div className="mt-4 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Nota de 0 a 10">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                role="radio"
                aria-checked={nota === n}
                onClick={() => setNota(n)}
                className={cx(
                  "num min-h-12 rounded-botao border text-lg font-semibold transition",
                  nota === n ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-texto-2">
            <span>Nada provável</span>
            <span>Muito provável</span>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium">Quer contar algo? (opcional)</span>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-botao border border-borda bg-superficie p-3 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
            />
          </label>

          {erro && <div className="mt-3"><Alerta>{erro}</Alerta></div>}

          <Botao grande className="mt-4 w-full" disabled={nota === null} carregando={ocupado} onClick={enviar}>
            Enviar avaliação
          </Botao>
          <Link href="/app" className="mt-3 block text-center text-sm font-medium text-texto-2 hover:underline">
            Pular
          </Link>
        </Cartao>
      )}
    </main>
  );
}
