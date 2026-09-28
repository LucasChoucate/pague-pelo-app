import { CabecalhoEquipe } from "@/components/CabecalhoEquipe";
import { exigirPapelPagina } from "@/lib/auth";
import { restauranteDaEquipe } from "@/lib/equipe";
import { AbasGerente } from "./AbasGerente";

export default async function LayoutGerente({ children }: LayoutProps<"/gerente">) {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente");
  const restaurante = await restauranteDaEquipe(perfil.restaurante_id);
  return (
    <>
      <CabecalhoEquipe perfil={perfil} restaurante={restaurante} titulo="Painel do gerente" />
      <AbasGerente />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">{children}</main>
    </>
  );
}
