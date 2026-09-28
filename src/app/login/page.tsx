import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMarca } from "@/components/Marca";
import { Cartao } from "@/components/ui";
import { obterSessao } from "@/lib/auth";
import { HOME_DO_PAPEL } from "@/lib/tipos";
import { FormLogin } from "./FormLogin";

export const metadata = { title: "Entrar" };

function destinoSeguro(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const destino = destinoSeguro(next);
  const perfil = await obterSessao();
  if (perfil) redirect(destino ?? HOME_DO_PAPEL[perfil.papel]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <LogoMarca className="text-2xl" />
        <p className="mt-2 text-texto-2">Sua comanda no celular. Sem fila no caixa.</p>
      </div>
      <Cartao>
        <h1 className="mb-4 text-xl font-bold">Entrar</h1>
        <FormLogin destino={destino} />
      </Cartao>
      <p className="text-center text-sm text-texto-2">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro${destino ? `?next=${encodeURIComponent(destino)}` : ""}`} className="font-semibold text-marca hover:underline">
          Criar conta grátis
        </Link>
      </p>
      <p className="text-center text-xs text-texto-2">
        Funcionários: use o acesso criado pelo gerente do restaurante.
      </p>
    </main>
  );
}
