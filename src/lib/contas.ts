import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErroApi } from "@/lib/auth";
import { identificadorParaEmail, pareceTelefone } from "@/lib/formato";
import type { Papel } from "@/lib/tipos";

interface NovaConta {
  nome: string;
  identificador: string;
  senha: string;
  cpf?: string | null;
  papel: Papel;
  restauranteId: string | null;
  aceitouPrivacidade?: boolean;
}

export function validarDadosConta(nome: string, identificador: string, senha: string) {
  if (!nome || nome.trim().length < 2) throw new ErroApi(400, "Informe o nome.");
  const ident = (identificador ?? "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ident);
  if (!emailOk && !pareceTelefone(ident)) {
    throw new ErroApi(400, "Informe um e-mail válido ou um telefone com DDD.");
  }
  if (!senha || senha.length < 6) throw new ErroApi(400, "A senha precisa ter pelo menos 6 caracteres.");
}

/**
 * Cria a conta no Auth. O trigger do banco cria o perfil como cliente;
 * para funcionários, o papel é ajustado aqui, com a service role.
 */
export async function criarConta(admin: SupabaseClient, dados: NovaConta) {
  validarDadosConta(dados.nome, dados.identificador, dados.senha);
  const telefone = pareceTelefone(dados.identificador) ? dados.identificador.replace(/\D/g, "") : null;
  const cpf = dados.cpf ? dados.cpf.replace(/\D/g, "") : null;
  if (cpf && cpf.length !== 11) throw new ErroApi(400, "CPF deve ter 11 dígitos.");

  const { data, error } = await admin.auth.admin.createUser({
    email: identificadorParaEmail(dados.identificador),
    password: dados.senha,
    email_confirm: true,
    user_metadata: {
      nome: dados.nome.trim(),
      telefone,
      cpf,
      aceitou_privacidade: Boolean(dados.aceitouPrivacidade),
    },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      throw new ErroApi(409, "Já existe uma conta com esse e-mail ou telefone.");
    }
    throw new ErroApi(400, "Não foi possível criar a conta.");
  }

  if (dados.papel !== "cliente") {
    const { error: e2 } = await admin
      .from("usuarios")
      .update({ papel: dados.papel, restaurante_id: dados.restauranteId })
      .eq("id", data.user.id);
    if (e2) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new ErroApi(500, "Não foi possível definir o papel do funcionário.");
    }
  }
  return data.user.id;
}

export async function auditar(
  admin: SupabaseClient,
  registro: {
    usuario_id: string | null;
    restaurante_id: string | null;
    acao: string;
    entidade: string;
    entidade_id?: string | null;
    antes?: unknown;
    depois?: unknown;
  },
) {
  await admin.from("auditoria").insert({
    ...registro,
    antes: registro.antes ?? null,
    depois: registro.depois ?? null,
  });
}
