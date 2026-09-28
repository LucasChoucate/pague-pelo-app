import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar, criarConta } from "@/lib/contas";
import { supabaseAdmin } from "@/lib/supabase/server";

const PAPEIS_EQUIPE = ["atendente", "porteiro"] as const;

/** Gerente cria atendente ou porteiro, sempre no próprio restaurante. */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const corpo = await req.json();
  if (!PAPEIS_EQUIPE.includes(corpo.papel)) throw new ErroApi(400, "Papel inválido.");
  const admin = supabaseAdmin();
  const id = await criarConta(admin, {
    nome: corpo.nome,
    identificador: corpo.identificador,
    senha: corpo.senha,
    papel: corpo.papel,
    restauranteId: perfil.restaurante_id,
  });
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "criar_funcionario",
    entidade: "usuarios",
    entidade_id: id,
    depois: { nome: corpo.nome, papel: corpo.papel },
  });
  return NextResponse.json({ id });
});

/** Ativa/desativa funcionário (desativado não consegue logar). */
export const PATCH = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const { id, ativo, papel } = await req.json();
  const admin = supabaseAdmin();
  const { data: alvo } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .eq("restaurante_id", perfil.restaurante_id!)
    .is("excluido_em", null)
    .maybeSingle();
  if (!alvo || !PAPEIS_EQUIPE.includes(alvo.papel)) throw new ErroApi(404, "Funcionário não encontrado.");

  const mudancas: Record<string, unknown> = {};
  if (ativo !== undefined) mudancas.ativo = Boolean(ativo);
  if (papel !== undefined) {
    if (!PAPEIS_EQUIPE.includes(papel)) throw new ErroApi(400, "Papel inválido.");
    mudancas.papel = papel;
  }
  await admin.from("usuarios").update(mudancas).eq("id", id);
  if (ativo !== undefined) {
    await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" });
  }
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "editar_funcionario",
    entidade: "usuarios",
    entidade_id: id,
    antes: { ativo: alvo.ativo, papel: alvo.papel },
    depois: mudancas,
  });
  return NextResponse.json({ ok: true });
});

/**
 * Exclui o acesso do funcionário. O login é bloqueado e o e-mail/telefone
 * fica livre para uma nova conta; o nome continua no histórico (auditoria,
 * itens lançados, validações de saída).
 */
export const DELETE = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const admin = supabaseAdmin();
  const { data: alvo } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .eq("restaurante_id", perfil.restaurante_id!)
    .is("excluido_em", null)
    .maybeSingle();
  if (!alvo || !PAPEIS_EQUIPE.includes(alvo.papel)) throw new ErroApi(404, "Funcionário não encontrado.");

  const { error } = await admin.auth.admin.updateUserById(id, {
    email: `excluido-${id}@excluido.paguepeloapp.local`,
    email_confirm: true,
    password: randomBytes(24).toString("hex"),
    ban_duration: "876000h",
    user_metadata: {},
  });
  if (error) throw new ErroApi(500, "Não foi possível excluir o acesso.");
  await admin
    .from("usuarios")
    .update({ ativo: false, excluido_em: new Date().toISOString(), email: null, telefone: null, cpf: null })
    .eq("id", id);

  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "excluir_funcionario",
    entidade: "usuarios",
    entidade_id: id,
    antes: { nome: alvo.nome, papel: alvo.papel, email: alvo.email, telefone: alvo.telefone },
  });
  return NextResponse.json({ ok: true });
});
