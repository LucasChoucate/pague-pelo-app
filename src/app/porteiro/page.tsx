import { CabecalhoEquipe } from "@/components/CabecalhoEquipe";
import { exigirPapelPagina } from "@/lib/auth";
import { restauranteDaEquipe } from "@/lib/equipe";
import { Porteiro } from "./Porteiro";

export const metadata = { title: "Portaria" };

export default async function PaginaPorteiro() {
  const perfil = await exigirPapelPagina(["porteiro"], "/porteiro");
  const restaurante = await restauranteDaEquipe(perfil.restaurante_id);
  return (
    <>
      <CabecalhoEquipe perfil={perfil} restaurante={restaurante} titulo="Validação de saída" />
      <Porteiro />
    </>
  );
}
