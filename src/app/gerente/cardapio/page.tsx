import { Cartao } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { restauranteDaEquipe } from "@/lib/equipe";
import { supabaseServidor } from "@/lib/supabase/server";
import type { ItemAvulso } from "@/lib/tipos";
import { FormItem, LinhaItem, PrecoKg } from "./Cardapio";

export const metadata = { title: "Preços e itens" };

export default async function Cardapio() {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente/cardapio");
  const restaurante = (await restauranteDaEquipe(perfil.restaurante_id))!;
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("itens_avulsos")
    .select("*")
    .eq("restaurante_id", restaurante.id)
    .order("ativo", { ascending: false })
    .order("ordem")
    .order("nome");
  const itens = (data ?? []) as ItemAvulso[];

  return (
    <>
      <h1 className="text-2xl font-bold">Preços e itens</h1>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="text-lg font-bold">Preço do quilo</h2>
            <p className="mb-3 text-sm text-texto-2">Vale para as próximas pesagens. As já lançadas mantêm o preço da hora.</p>
            <PrecoKg inicial={Number(restaurante.preco_kg)} />
          </Cartao>
          <Cartao>
            <h2 className="mb-3 text-lg font-bold">Novo item avulso</h2>
            <FormItem />
          </Cartao>
        </div>
        <Cartao className="p-3">
          <h2 className="px-2 pb-2 pt-1 text-lg font-bold">Itens avulsos ({itens.length})</h2>
          {itens.length === 0 ? (
            <p className="p-6 text-center text-texto-2">Cadastre bebidas, sobremesas e outros itens vendidos por unidade.</p>
          ) : (
            <ul className="divide-y divide-borda">
              {itens.map((i) => (
                <LinhaItem key={i.id} item={i} />
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
