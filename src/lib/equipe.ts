import "server-only";
import { supabaseServidor } from "@/lib/supabase/server";
import type { Restaurante } from "@/lib/tipos";

/** Restaurante do funcionário logado (via RLS). */
export async function restauranteDaEquipe(restauranteId: string | null): Promise<Restaurante | null> {
  if (!restauranteId) return null;
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("restaurantes").select("*").eq("id", restauranteId).single();
  return (data as Restaurante | null) ?? null;
}
