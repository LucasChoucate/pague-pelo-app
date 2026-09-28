"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/client";

export function CancelarComanda({ comandaId, codigo }: { comandaId: string; codigo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cancelar() {
    setOcupado(true);
    const { error } = await supabaseNavegador().rpc("cancelar_comanda", { p_comanda: comandaId, p_motivo: motivo });
    setOcupado(false);
    if (error) return setErro(error.message);
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="min-h-12 rounded-lg px-3 text-sm font-semibold text-erro-texto hover:bg-erro/10">
        Cancelar
      </button>
    );
  }
  return (
    <div className="flex min-w-64 flex-col gap-2 text-left">
      <label className="text-xs font-medium">
        Justificativa para cancelar {codigo}
        <input
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="mt-1 min-h-12 w-full rounded-lg border border-borda bg-superficie px-3 text-sm"
          placeholder="Ex.: cliente desistiu antes de servir"
        />
      </label>
      {erro && <p className="text-xs font-medium text-erro-texto">{erro}</p>}
      <div className="flex gap-2">
        <Botao variante="secundario" className="min-h-12 flex-1 text-sm" onClick={() => setAberto(false)}>Voltar</Botao>
        <Botao variante="perigo" className="min-h-12 flex-1 text-sm" carregando={ocupado} disabled={motivo.trim().length < 5} onClick={cancelar}>
          Confirmar
        </Botao>
      </div>
    </div>
  );
}
