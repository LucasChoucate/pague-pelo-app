import { exigirPapelPagina } from "@/lib/auth";
import { restauranteDaEquipe } from "@/lib/equipe";
import { Marca } from "./Marca";

export const metadata = { title: "Marca do restaurante" };

export default async function PaginaMarca() {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente/marca");
  const r = (await restauranteDaEquipe(perfil.restaurante_id))!;
  return (
    <>
      <h1 className="text-2xl font-bold">Marca do restaurante</h1>
      <Marca nome={r.nome} cor={r.cor_destaque} logoUrl={r.logo_url} slug={r.slug} precoKg={Number(r.preco_kg)} />
    </>
  );
}
