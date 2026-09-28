import "server-only";
import { supabaseServidor } from "@/lib/supabase/server";
import { STATUS_ATIVOS, type Comanda, type Restaurante } from "@/lib/tipos";

export type ComandaComRestaurante = Comanda & { restaurantes: Restaurante };

/** Comanda ativa do cliente logado (via RLS), com o restaurante. */
export async function comandaAtivaComRestaurante(): Promise<ComandaComRestaurante | null> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("comandas")
    .select("*, restaurantes(*)")
    .eq("cliente_id", user.id)
    .in("status", STATUS_ATIVOS)
    .maybeSingle();
  return (data as ComandaComRestaurante | null) ?? null;
}
