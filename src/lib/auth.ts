import "server-only";
import { redirect } from "next/navigation";
import { NextResponse, connection } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import type { Papel, Usuario } from "@/lib/tipos";
import { HOME_DO_PAPEL } from "@/lib/tipos";

export function supabaseConfigurado() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Usuário logado e seu perfil (ou null). */
export async function obterSessao(): Promise<Usuario | null> {
  await connection(); // sempre por requisição (lê cookies da sessão)
  if (!supabaseConfigurado()) return null;
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("usuarios").select("*").eq("id", user.id).single();
  if (!data || !data.ativo) return null;
  return data as Usuario;
}

/** Para páginas: exige login e um dos papéis, senão redireciona. */
export async function exigirPapelPagina(papeis: Papel[], voltarPara: string): Promise<Usuario> {
  await connection();
  if (!supabaseConfigurado()) redirect("/");
  const perfil = await obterSessao();
  if (!perfil) redirect(`/login?next=${encodeURIComponent(voltarPara)}`);
  if (!papeis.includes(perfil.papel)) redirect(HOME_DO_PAPEL[perfil.papel]);
  return perfil;
}

export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Para rotas de API: exige login e um dos papéis, senão lança ErroApi. */
export async function exigirPapelApi(papeis: Papel[]): Promise<Usuario> {
  const perfil = await obterSessao();
  if (!perfil) throw new ErroApi(401, "Faça login para continuar.");
  if (!papeis.includes(perfil.papel)) throw new ErroApi(403, "Você não tem permissão para isso.");
  return perfil;
}

/** Envolve o handler e converte erros em JSON { erro }. */
export function rota<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ErroApi) return NextResponse.json({ erro: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ erro: "Erro inesperado. Tente de novo." }, { status: 500 });
    }
  };
}
