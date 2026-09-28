import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DoorOpen, Scale, Smartphone, Timer } from "lucide-react";
import { LogoMarca } from "@/components/Marca";
import { Alerta, Cartao } from "@/components/ui";
import { obterSessao, supabaseConfigurado } from "@/lib/auth";
import { HOME_DO_PAPEL } from "@/lib/tipos";

export default async function Inicio() {
  await connection();
  if (!supabaseConfigurado()) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-10">
        <LogoMarca className="text-2xl" />
        <Alerta tipo="atencao">Falta conectar o Supabase.</Alerta>
        <Cartao className="flex flex-col gap-2 text-sm leading-relaxed">
          <p>1. Crie um projeto em supabase.com e rode <code>supabase/schema.sql</code> no SQL Editor.</p>
          <p>2. Copie <code>.env.example</code> para <code>.env.local</code> e preencha as chaves.</p>
          <p>3. Rode <code>npm run seed</code> e reinicie o <code>npm run dev</code>.</p>
          <p className="text-texto-2">O passo a passo completo está no README.md.</p>
        </Cartao>
      </main>
    );
  }

  const perfil = await obterSessao();
  if (perfil) redirect(HOME_DO_PAPEL[perfil.papel]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10 pt-[max(env(safe-area-inset-top),24px)]">
      <LogoMarca className="text-xl" />
      <section className="linhas-decorativas rounded-[32px] bg-marca p-7 text-marca-texto shadow-cartao">
        <h1 className="text-3xl font-bold leading-tight">Almoce, pague no celular e saia sem fila.</h1>
        <p className="mt-3 opacity-90">A comanda digital dos restaurantes a quilo.</p>
      </section>

      <Cartao>
        <ul className="flex flex-col gap-4">
          {[
            [Smartphone, "Comanda no celular", "Escaneie o QR da entrada."],
            [Scale, "Itens ao vivo", "Pesou, apareceu na sua tela."],
            [Timer, "Pix ou cartão", "Pague quando quiser, pelo app."],
            [DoorOpen, "Saída sem fila", "Mostre o passe e pronto."],
          ].map(([Icone, t, d], i) => {
            const I = Icone as typeof Smartphone;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-marca-clara text-marca">
                  <I className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{t as string}</p>
                  <p className="text-sm text-texto-2">{d as string}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Cartao>

      <div className="flex flex-col gap-3">
        <Link href="/cadastro" className="flex min-h-14 items-center justify-center rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao hover:brightness-110">
          Criar conta
        </Link>
        <Link href="/login" className="flex min-h-12 items-center justify-center rounded-botao border border-borda bg-superficie font-semibold">
          Entrar
        </Link>
      </div>
    </main>
  );
}
