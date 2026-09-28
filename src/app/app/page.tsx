import Link from "next/link";
import { ChevronRight, MapPin, QrCode, Store } from "lucide-react";
import { LogoRestaurante } from "@/components/Marca";
import { Cartao, SeloStatus } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { comandaAtivaComRestaurante } from "@/lib/cliente";
import { corSegura } from "@/lib/cor";
import { formatarBRL, formatarHora } from "@/lib/formato";
import { supabaseServidor } from "@/lib/supabase/server";
import type { Restaurante } from "@/lib/tipos";

export const metadata = { title: "Início" };

export default async function InicioCliente() {
  const perfil = await exigirPapelPagina(["cliente"], "/app");
  const comanda = await comandaAtivaComRestaurante();
  const primeiroNome = perfil.nome.split(" ")[0];

  let restaurantes: Restaurante[] = [];
  if (!comanda) {
    const supabase = await supabaseServidor();
    const { data } = await supabase.from("restaurantes").select("*").eq("ativo", true).order("nome");
    restaurantes = (data ?? []) as Restaurante[];
  }

  return (
    <main className="flex flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),20px)]">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-texto-2">Olá,</p>
          <h1 className="text-2xl font-bold">{primeiroNome}</h1>
        </div>
        {comanda && (
          <span className="inline-flex max-w-[60%] items-center gap-1.5 truncate rounded-full border border-borda bg-superficie px-3 py-2 text-sm font-medium shadow-cartao">
            <MapPin className="size-4 shrink-0 text-marca" aria-hidden />
            <span className="truncate">{comanda.restaurantes.nome}</span>
          </span>
        )}
      </header>

      {comanda ? <CartaoComanda comanda={comanda} /> : <SemComanda />}

      {!comanda && restaurantes.length > 0 && (
        <Cartao>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Restaurantes parceiros</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {restaurantes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/entrar?loja=${r.slug}`}
                  className="flex items-center gap-3 rounded-[18px] bg-superficie-2 p-3 transition hover:bg-marca-clara/50"
                >
                  <LogoRestaurante nome={r.nome} logoUrl={r.logo_url} cor={corSegura(r.cor_destaque)} className="size-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.nome}</p>
                    <p className="num text-sm text-texto-2">{formatarBRL(r.preco_kg)}/kg</p>
                  </div>
                  <ChevronRight className="size-5 text-texto-2" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-texto-2">
            No restaurante, é só escanear o QR Code da entrada: ele abre o app já no lugar certo.
          </p>
        </Cartao>
      )}
    </main>
  );
}

function SemComanda() {
  return (
    <section className="linhas-decorativas relative overflow-hidden rounded-[28px] bg-marca p-6 text-marca-texto shadow-cartao">
      <Store className="mb-4 size-10 opacity-90" aria-hidden />
      <h2 className="text-2xl font-bold leading-tight">Chegou no restaurante?</h2>
      <p className="mt-2 max-w-xs opacity-90">
        Escaneie o QR Code da entrada com a câmera do celular para pegar sua comanda digital.
      </p>
    </section>
  );
}

function CartaoComanda({ comanda }: { comanda: NonNullable<Awaited<ReturnType<typeof comandaAtivaComRestaurante>>> }) {
  const saldo = Number(comanda.total) - Number(comanda.total_pago);
  const acao =
    comanda.status === "PAGA"
      ? { href: "/app/saida", texto: "Passe de saída" }
      : comanda.status === "PENDENTE_PAGAMENTO"
        ? { href: "/app/pagar", texto: `Pagar ${formatarBRL(saldo)}` }
        : { href: "/app/comanda", texto: "Mostrar QR ao caixa" };

  return (
    <section
      className="linhas-decorativas relative overflow-hidden rounded-[28px] bg-marca p-5 text-marca-texto shadow-cartao"
      aria-label="Sua comanda"
    >
      {/* faixa fina com a cor do restaurante */}
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: corSegura(comanda.restaurantes.cor_destaque) }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium opacity-90">Sua comanda</p>
          <p className="num mt-0.5 text-3xl font-bold tracking-widest">{comanda.codigo_curto}</p>
          <p className="mt-1 text-sm opacity-85">Aberta às {formatarHora(comanda.criada_em)}</p>
        </div>
        <SeloStatus status={comanda.status} className="bg-white/90 dark:bg-black/40" />
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-sm opacity-90">Total</p>
          <p className="num text-4xl font-bold">{formatarBRL(comanda.total)}</p>
        </div>
        <Link href="/app/comanda" className="flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
          <QrCode className="size-4" aria-hidden /> Ver itens
        </Link>
      </div>

      <Link
        href={acao.href}
        className="mt-5 flex min-h-14 items-center gap-3 rounded-full bg-superficie p-1.5 pr-5 font-semibold text-texto shadow-sm transition hover:brightness-105"
      >
        <span className="grid size-11 place-items-center rounded-full bg-marca text-marca-texto">
          <ChevronRight className="size-5" aria-hidden />
        </span>
        <span className="flex-1">{acao.texto}</span>
        <span className="flex text-texto-2" aria-hidden>
          <ChevronRight className="-mr-2.5 size-4 opacity-40" />
          <ChevronRight className="-mr-2.5 size-4 opacity-70" />
          <ChevronRight className="size-4" />
        </span>
      </Link>
    </section>
  );
}
