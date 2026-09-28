import { Cartao } from "@/components/ui";
import { exigirPapelPagina } from "@/lib/auth";
import { supabaseServidor } from "@/lib/supabase/server";
import { ROTULO_PAPEL, type Usuario } from "@/lib/tipos";
import { AcoesFuncionario, NovoFuncionario } from "./Equipe";

export const metadata = { title: "Equipe" };

export default async function Equipe() {
  const perfil = await exigirPapelPagina(["gerente"], "/gerente/equipe");
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("restaurante_id", perfil.restaurante_id!)
    .is("excluido_em", null)
    .order("papel")
    .order("nome");
  const equipe = (data ?? []) as Usuario[];

  return (
    <>
      <h1 className="text-2xl font-bold">Equipe</h1>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Cartao className="p-3">
          <ul className="divide-y divide-borda">
            {equipe.map((u) => (
              <li key={u.id} className="flex min-h-16 items-center gap-3 px-2 py-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marca-clara font-bold text-marca">
                  {u.nome[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {u.nome} {!u.ativo && <span className="text-sm font-normal text-texto-2">(desativado)</span>}
                  </p>
                  <p className="truncate text-sm text-texto-2">
                    {ROTULO_PAPEL[u.papel]} · {u.email?.endsWith("@tel.paguepeloapp.local") ? u.telefone : (u.email ?? u.telefone)}
                  </p>
                </div>
                {u.papel !== "gerente" && <AcoesFuncionario id={u.id} nome={u.nome} ativo={u.ativo} />}
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao>
          <h2 className="mb-1 text-lg font-bold">Novo funcionário</h2>
          <p className="mb-4 text-sm text-texto-2">A conta fica vinculada a este restaurante. Passe o login e a senha para a pessoa.</p>
          <NovoFuncionario />
        </Cartao>
      </div>
    </>
  );
}
