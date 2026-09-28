"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CameraOff } from "lucide-react";

/**
 * Leitor de QR pela câmera traseira (html5-qrcode).
 * Chama `aoLer` uma vez por leitura; pausa enquanto `pausado`.
 */
export function Scanner({
  aoLer,
  pausado = false,
  className,
}: {
  aoLer: (texto: string) => void;
  pausado?: boolean;
  className?: string;
}) {
  const id = `leitor-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const aoLerRef = useRef(aoLer);
  const pausadoRef = useRef(pausado);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    aoLerRef.current = aoLer;
    pausadoRef.current = pausado;
  });

  useEffect(() => {
    let parar: (() => Promise<void>) | null = null;
    let cancelado = false;

    (async () => {
      // Pequena espera: no modo dev o React monta/desmonta duas vezes.
      await new Promise((r) => setTimeout(r, 80));
      if (cancelado) return;
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelado) return;
      const leitor = new Html5Qrcode(id, { verbose: false });
      let ultimo = "";
      let ultimoEm = 0;
      try {
        await leitor.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
          (texto) => {
            if (pausadoRef.current) return;
            const agora = Date.now();
            // Evita ler o mesmo QR várias vezes seguidas.
            if (texto === ultimo && agora - ultimoEm < 3000) return;
            ultimo = texto;
            ultimoEm = agora;
            aoLerRef.current(texto);
          },
          () => {},
        );
        parar = async () => {
          try {
            await leitor.stop();
            leitor.clear();
          } catch {}
        };
        if (cancelado) await parar();
      } catch {
        if (!cancelado) setErro("Não foi possível abrir a câmera. Libere o acesso nas permissões do navegador ou use o código.");
      }
    })();

    return () => {
      cancelado = true;
      parar?.();
    };
  }, [id]);

  return (
    <div className={className}>
      <div id={id} className="overflow-hidden rounded-[20px] bg-black [&_video]:!w-full [&_video]:object-cover" />
      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-botao bg-superficie-2 p-3 text-sm text-texto-2">
          <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}
    </div>
  );
}
