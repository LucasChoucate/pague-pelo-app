import { CabecalhoEquipe } from "@/components/CabecalhoEquipe";
import { LogoRestaurante } from "@/components/Marca";
import { Cartao } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { corSegura } from "@/lib/cor";
import { formatarBRL } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Restaurante } from "@/lib/tipos";
import { AcoesRestaurante, NovoRestaurante } from "./Admin";

export const metadata = { title: "Admin da plataforma" };

export default async function Admin() {
  const perfil = await exigirPapelPagina(["admin_plataforma"], "/admin");
  const admin = supabaseAdmin();
  const [{ data: rs }, { data: gerentes }, { data: comandas }] = await Promise.all([
    admin.from("restaurantes").select("*").order("criado_em"),
    admin.from("usuarios").select("nome, email, restaurante_id").eq("papel", "gerente"),
    admin.from("comandas").select("restaurante_id"),
  ]);
  const restaurantes = (rs ?? []) as Restaurante[];
  const contagem = (comandas ?? []).reduce<Record<string, number>>((a, c) => ({ ...a, [c.restaurante_id]: (a[c.restaurante_id] ?? 0) + 1 }), {});

  return (
    <>
      <CabecalhoEquipe perfil={perfil} restaurante={null} titulo="Admin da plataforma" />
      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[1.4fr_1fr]">
        <Cartao className="p-3">
          <h1 className="px-2 pb-2 pt-1 text-xl font-bold">Restaurantes ({restaurantes.length})</h1>
          <ul className="divide-y divide-borda">
            {restaurantes.map((r) => (
              <li key={r.id} className="flex min-h-16 flex-wrap items-center gap-3 px-2 py-3">
                <LogoRestaurante nome={r.nome} logoUrl={r.logo_url} cor={corSegura(r.cor_destaque)} className="size-12 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {r.nome} {!r.ativo && <span className="text-sm font-normal text-texto-2">(inativo)</span>}
                  </p>
                  <p className="num truncate text-sm text-texto-2">
                    /{r.slug} · {formatarBRL(r.preco_kg)}/kg · {contagem[r.id] ?? 0} comandas
                  </p>
                  <p className="truncate text-xs text-texto-2">
                    Gerente: {(gerentes ?? []).filter((g) => g.restaurante_id === r.id).map((g) => g.nome).join(", ") || "—"}
                  </p>
                </div>
                <AcoesRestaurante id={r.id} nome={r.nome} ativo={r.ativo} />
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao>
          <h2 className="mb-4 text-lg font-bold">Novo restaurante</h2>
          <NovoRestaurante />
        </Cartao>
      </main>
    </>
  );
}
