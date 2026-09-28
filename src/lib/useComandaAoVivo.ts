"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";
import type { Comanda, ItemComanda } from "@/lib/tipos";

/**
 * Comanda + itens com atualização em tempo real (Supabase Realtime).
 * A cada evento recarrega do banco: o servidor é a fonte da verdade.
 */
export function useComandaAoVivo(comandaId: string | null) {
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [itens, setItens] = useState<ItemComanda[]>([]);
  const [carregando, setCarregando] = useState(Boolean(comandaId));
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    if (!comandaId) return;
    const supabase = supabaseNavegador();
    const [c, i] = await Promise.all([
      supabase.from("comandas").select("*").eq("id", comandaId).maybeSingle(),
      supabase.from("itens_comanda").select("*").eq("comanda_id", comandaId).order("criado_em"),
    ]);
    if (c.error || i.error) {
      setErro("Não foi possível atualizar a comanda.");
    } else {
      setErro(null);
      setComanda(c.data as Comanda | null);
      setItens((i.data ?? []) as ItemComanda[]);
    }
    setCarregando(false);
  }, [comandaId]);

  useEffect(() => {
    if (!comandaId) return;
    const supabase = supabaseNavegador();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    recarregar();

    const canal = supabase
      .channel(`comanda-${comandaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas", filter: `id=eq.${comandaId}` }, () => recarregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "itens_comanda", filter: `comanda_id=eq.${comandaId}` }, () => recarregar())
      .subscribe((status: string) => {
        // Ao (re)conectar, garante que nada foi perdido.
        if (status === "SUBSCRIBED") recarregar();
      });

    const aoVoltar = () => document.visibilityState === "visible" && recarregar();
    window.addEventListener("online", recarregar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      supabase.removeChannel(canal);
      window.removeEventListener("online", recarregar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [comandaId, recarregar]);

  const ativos = itens.filter((i) => !i.removido_em);
  return { comanda, itens: ativos, itensRemovidos: itens.filter((i) => i.removido_em), carregando, erro, recarregar };
}
