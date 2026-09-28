import Link from "next/link";
import { notFound } from "next/navigation";
import { Scale, Smartphone, DoorOpen } from "lucide-react";
import { LogoMarca, LogoRestaurante } from "@/components/Marca";
import { Alerta, Cartao } from "@/components/ui";
import { obterSessao, supabaseConfigurado } from "@/lib/auth";
import { comandaAtivaComRestaurante } from "@/lib/cliente";
import { corSegura } from "@/lib/cor";
import { formatarBRL } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase/server";
import { HOME_DO_PAPEL, type Restaurante } from "@/lib/tipos";
import { BotaoPegarComanda } from "./BotaoPegarComanda";

export const metadata = { title: "Bem-vindo" };

/** Destino do QR Code fixo da entrada: /entrar?loja=<slug> */
export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { loja } = await searchParams;
  if (typeof loja !== "string" || !supabaseConfigurado()) notFound();

  const supabase = await supabaseServidor();
  const { data } = await supabase.from("restaurantes").select("*").eq("slug", loja).eq("ativo", true).maybeSingle();
  if (!data) notFound();
  const restaurante = data as Restaurante;
  const cor = corSegura(restaurante.cor_destaque);

  const perfil = await obterSessao();
  const comanda = perfil?.papel === "cliente" ? await comandaAtivaComRestaurante() : null;
  const voltar = encodeURIComponent(`/entrar?loja=${restaurante.slug}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      {/* Boas-vindas com a cor do restaurante (contraste AA garantido). */}
      <section className="linhas-decorativas relative overflow-hidden rounded-b-[36px] px-6 pb-10 pt-[max(env(safe-area-inset-top),32px)] text-white" style={{ backgroundColor: cor }}>
        <LogoRestaurante nome={restaurante.nome} logoUrl={restaurante.logo_url} cor="rgb(255 255 255 / 0.2)" className="size-20 text-2xl" />
        <p className="mt-5 text-base font-medium opacity-90">Bem-vindo ao</p>
        <h1 className="text-3xl font-bold leading-tight">{restaurante.nome}</h1>
        <p className="num mt-2 text-lg opacity-95">Comida a quilo · {formatarBRL(restaurante.preco_kg)}/kg</p>
      </section>

      <div className="relative z-10 -mt-6 flex flex-col gap-4 px-4 pb-10">
        <Cartao>
          <ol className="flex flex-col gap-4">
            {[
              [Smartphone, "Pegue sua comanda digital", "Um QR Code no seu celular."],
              [Scale, "Mostre no caixa ao pesar", "Os itens aparecem na hora, na sua tela."],
              [DoorOpen, "Pague pelo app e saia", "Pix ou cartão. Mostre o passe na porta."],
            ].map(([Icone, titulo, texto], i) => {
              const I = Icone as typeof Smartphone;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marca-clara text-marca">
                    <I className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold">{titulo as string}</p>
                    <p className="text-sm text-texto-2">{texto as string}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Cartao>

        {!perfil && (
          <div className="flex flex-col gap-3">
            <Link href={`/cadastro?next=${voltar}`} className="flex min-h-14 items-center justify-center rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao hover:brightness-110">
              Continuar com e-mail/telefone
            </Link>
            <Link href={`/login?next=${voltar}`} className="flex min-h-12 items-center justify-center rounded-botao border border-borda bg-superficie font-semibold">
              Já tenho conta
            </Link>
          </div>
        )}

        {perfil && perfil.papel !== "cliente" && (
          <Alerta tipo="info">
            Você está logado como funcionário.{" "}
            <Link href={HOME_DO_PAPEL[perfil.papel]} className="font-semibold underline">Ir para sua área</Link>
          </Alerta>
        )}

        {perfil?.papel === "cliente" &&
          (comanda ? (
            <>
              <Alerta tipo="info">
                Você já tem uma comanda ativa ({comanda.codigo_curto}) no {comanda.restaurantes.nome}. Pague e valide a saída antes de abrir outra.
              </Alerta>
              <Link href="/app/comanda" className="flex min-h-14 items-center justify-center rounded-botao bg-marca text-lg font-semibold text-marca-texto shadow-cartao">
                Ver minha comanda
              </Link>
            </>
          ) : (
            <BotaoPegarComanda slug={restaurante.slug} />
          ))}

        <div className="mt-4 flex justify-center opacity-80">
          <LogoMarca className="text-sm" />
        </div>
      </div>
    </main>
  );
}
