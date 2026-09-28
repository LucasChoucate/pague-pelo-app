import { CabecalhoEquipe } from "@/components/CabecalhoEquipe";
import { exigirPapelPagina } from "@/lib/auth";
import { restauranteDaEquipe } from "@/lib/equipe";
import { supabaseServidor } from "@/lib/supabase/server";
import type { ItemAvulso } from "@/lib/tipos";
import { Caixa } from "./Caixa";

export const metadata = { title: "Caixa" };

export default async function PaginaCaixa() {
  const perfil = await exigirPapelPagina(["atendente"], "/caixa");
  const restaurante = (await restauranteDaEquipe(perfil.restaurante_id))!;
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("itens_avulsos")
    .select("*")
    .eq("restaurante_id", restaurante.id)
    .eq("ativo", true)
    .order("ordem")
    .order("nome");

  return (
    <>
      <CabecalhoEquipe perfil={perfil} restaurante={restaurante} titulo="Caixa / Balança" />
      <Caixa precoKg={Number(restaurante.preco_kg)} avulsos={(data ?? []) as ItemAvulso[]} />
    </>
  );
}
