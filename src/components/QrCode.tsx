"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cx } from "@/components/ui";

/** QR sempre preto sobre branco (leitura confiável em qualquer tema). */
export function QrCode({ valor, tamanho = 260, className, rotulo }: { valor: string; tamanho?: number; className?: string; rotulo: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    QRCode.toString(valor, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F172A", light: "#FFFFFF" } })
      .then((s) => vivo && setSvg(s))
      .catch(() => vivo && setSvg(null));
    return () => {
      vivo = false;
    };
  }, [valor]);

  return (
    <div
      role="img"
      aria-label={rotulo}
      className={cx("overflow-hidden rounded-2xl bg-white p-3", className)}
      style={{ width: tamanho, height: tamanho }}
    >
      {svg ? (
        <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="size-full animate-pulse rounded-xl bg-slate-200" />
      )}
    </div>
  );
}
