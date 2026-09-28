import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar, criarConta, validarDadosConta } from "@/lib/contas";
import { COR_PRIMARIA, corPassaAA } from "@/lib/cor";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Admin da plataforma cadastra restaurante + primeiro gerente. */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["admin_plataforma"]);
  const corpo = await req.json();
  const nome = String(corpo.nome ?? "").trim();
  const slug = String(corpo.slug ?? "").trim().toLowerCase();
  const preco = Math.round(Number(corpo.preco_kg) * 100) / 100;
  const cor = String(corpo.cor_destaque ?? COR_PRIMARIA).toUpperCase();
  if (nome.length < 2) throw new ErroApi(400, "Informe o nome do restaurante.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new ErroApi(400, "Slug inválido. Use letras minúsculas, números e hífens.");
  if (!(preco > 0 && preco < 1000)) throw new ErroApi(400, "Preço do kg inválido.");
  const g = corpo.gerente ?? {};
  validarDadosConta(g.nome, g.identificador, g.senha);

  const admin = supabaseAdmin();
  const { data: rest, error } = await admin
    .from("restaurantes")
    .insert({ nome, slug, preco_kg: preco, cor_destaque: corPassaAA(cor) ? cor : COR_PRIMARIA })
    .select()
    .single();
  if (error) {
    throw new ErroApi(error.code === "23505" ? 409 : 500, error.code === "23505" ? "Já existe um restaurante com esse slug." : "Não foi possível criar o restaurante.");
  }

  try {
    await criarConta(admin, { nome: g.nome, identificador: g.identificador, senha: g.senha, papel: "gerente", restauranteId: rest.id });
  } catch (e) {
    await admin.from("restaurantes").delete().eq("id", rest.id);
    throw e;
  }
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: rest.id,
    acao: "criar_restaurante",
    entidade: "restaurantes",
    entidade_id: rest.id,
    depois: rest,
  });
  return NextResponse.json({ restaurante: rest });
});

/** Ativa/desativa restaurante. */
export const PATCH = rota(async (req) => {
  const perfil = await exigirPapelApi(["admin_plataforma"]);
  const { id, ativo } = await req.json();
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("restaurantes").update({ ativo: Boolean(ativo) }).eq("id", id).select().single();
  if (error || !data) throw new ErroApi(404, "Restaurante não encontrado.");
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: id,
    acao: ativo ? "ativar_restaurante" : "desativar_restaurante",
    entidade: "restaurantes",
    entidade_id: id,
    depois: { ativo: Boolean(ativo) },
  });
  return NextResponse.json({ restaurante: data });
});

/**
 * Exclui o restaurante e TODOS os dados dele (comandas, pagamentos,
 * equipe, itens, logo). Exige digitar o nome do restaurante para confirmar.
 */
export const DELETE = rota(async (req) => {
  const perfil = await exigirPapelApi(["admin_plataforma"]);
  const { id, confirmacao } = await req.json();
  const admin = supabaseAdmin();
  const { data: rest } = await admin.from("restaurantes").select("*").eq("id", id).maybeSingle();
  if (!rest) throw new ErroApi(404, "Restaurante não encontrado.");
  if (String(confirmacao ?? "").trim() !== rest.nome) {
    throw new ErroApi(400, "Digite o nome do restaurante exatamente como aparece para confirmar.");
  }

  const { data: equipe, error } = await admin.rpc("excluir_dados_restaurante", { p_restaurante: id });
  if (error) throw new ErroApi(500, "Não foi possível apagar os dados do restaurante.");
  for (const uid of (equipe ?? []) as string[]) {
    await admin.auth.admin.deleteUser(uid); // o perfil sai junto (cascade)
  }
  const { data: arquivos } = await admin.storage.from("logos").list(id);
  if (arquivos?.length) await admin.storage.from("logos").remove(arquivos.map((a) => `${id}/${a.name}`));

  const { error: e2 } = await admin.from("restaurantes").delete().eq("id", id);
  if (e2) throw new ErroApi(500, "Os dados foram apagados, mas o restaurante não. Tente de novo.");

  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: null,
    acao: "excluir_restaurante",
    entidade: "restaurantes",
    entidade_id: id,
    antes: { nome: rest.nome, slug: rest.slug, funcionarios: (equipe ?? []).length },
  });
  return NextResponse.json({ ok: true });
});
