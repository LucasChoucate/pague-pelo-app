import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";
import { Avaliacao } from "./Avaliacao";

export const metadata = { title: "Como foi?" };

export default async function PaginaAvaliar({ searchParams }: PageProps<"/app/avaliar">) {
  const { c } = await searchParams;
  if (typeof c !== "string") redirect("/app");
  const supabase = await supabaseServidor();
  const { data: comanda } = await supabase
    .from("comandas")
    .select("id, status, total_pago, restaurantes(nome), nps(id)")
    .eq("id", c)
    .maybeSingle();
  if (!comanda || comanda.status !== "FINALIZADA") redirect("/app");

  const jaAvaliou = Array.isArray(comanda.nps) ? comanda.nps.length > 0 : Boolean(comanda.nps);
  return (
    <Avaliacao
      comandaId={comanda.id}
      restaurante={(comanda.restaurantes as unknown as { nome: string }).nome}
      jaAvaliou={jaAvaliou}
    />
  );
}
