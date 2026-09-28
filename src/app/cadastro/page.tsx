import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMarca } from "@/components/Marca";
import { Cartao } from "@/components/ui";
import { obterSessao } from "@/lib/auth";
import { HOME_DO_PAPEL } from "@/lib/tipos";
import { FormCadastro } from "./FormCadastro";

export const metadata = { title: "Criar conta" };

export default async function Cadastro({ searchParams }: PageProps<"/cadastro">) {
  const { next } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const perfil = await obterSessao();
  if (perfil) redirect(destino ?? HOME_DO_PAPEL[perfil.papel]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <LogoMarca className="text-2xl" />
      </div>
      <Cartao>
        <h1 className="text-xl font-bold">Criar conta</h1>
        <p className="mb-4 mt-1 text-sm text-texto-2">Uma conta só, para usar em todos os restaurantes parceiros.</p>
        <FormCadastro destino={destino} />
      </Cartao>
      <p className="text-center text-sm text-texto-2">
        Já tem conta?{" "}
        <Link href={`/login${destino ? `?next=${encodeURIComponent(destino)}` : ""}`} className="font-semibold text-marca hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
