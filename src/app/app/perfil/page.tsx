import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { Cartao } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { FormPerfil } from "./FormPerfil";

export const metadata = { title: "Perfil" };

export default async function Perfil() {
  const perfil = await exigirPapelPagina(["cliente"], "/app/perfil");
  return (
    <main className="flex flex-col gap-4 px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <Cartao>
        <FormPerfil nome={perfil.nome} telefone={perfil.telefone ?? ""} cpf={perfil.cpf ?? ""} email={perfil.email} />
      </Cartao>
      <Cartao className="flex flex-col gap-1 p-2">
        <Link href="/privacidade" className="flex min-h-12 items-center gap-3 rounded-xl px-3 hover:bg-superficie-2">
          <ShieldCheck className="size-5 text-marca" aria-hidden /> Aviso de privacidade
        </Link>
        <form action="/auth/sair" method="post">
          <button className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-erro-texto hover:bg-superficie-2">
            <LogOut className="size-5" aria-hidden /> Sair da conta
          </button>
        </form>
      </Cartao>
    </main>
  );
}
