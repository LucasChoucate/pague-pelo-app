"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function assinar(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );
}

/** Faixa fixa no topo quando a internet cai. */
export function AvisoConexao() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-atencao px-4 py-2 text-sm font-semibold text-[#0F172A]"
    >
      <WifiOff className="size-4" aria-hidden />
      Sem internet. Os valores serão atualizados quando a conexão voltar.
    </div>
  );
}
