import "server-only";
import { ErroApi } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { STATUS_ATIVOS, type Comanda } from "@/lib/tipos";

/** Comanda ativa do cliente (lida com service role, já filtrada pelo dono). */
export async function comandaAtivaDoCliente(clienteId: string): Promise<Comanda> {
  const { data } = await supabaseAdmin()
    .from("comandas")
    .select("*")
    .eq("cliente_id", clienteId)
    .in("status", STATUS_ATIVOS)
    .maybeSingle();
  if (!data) throw new ErroApi(404, "Você não tem comanda ativa.");
  return data as Comanda;
}
