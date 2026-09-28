import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar } from "@/lib/contas";
import { ehEmoji } from "@/lib/emoji";
import { supabaseAdmin } from "@/lib/supabase/server";

function validarEmoji(e: unknown) {
  if (e === null || e === undefined || e === "") return null;
  const texto = String(e).trim();
  if (!ehEmoji(texto)) throw new ErroApi(400, "O ícone precisa ser um emoji.");
  return texto;
}

function validarPreco(p: unknown) {
  const preco = Math.round(Number(p) * 100) / 100;
  if (!(preco > 0 && preco < 10000)) throw new ErroApi(400, "Preço inválido.");
  return preco;
}

/** Cria item avulso (bebida, sobremesa...). */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const corpo = await req.json();
  const nome = String(corpo.nome ?? "").trim();
  if (nome.length < 2) throw new ErroApi(400, "Informe o nome do item.");
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("itens_avulsos")
    .insert({
      restaurante_id: perfil.restaurante_id,
      nome,
      preco: validarPreco(corpo.preco),
      emoji: validarEmoji(corpo.emoji),
      ordem: Number(corpo.ordem) || 0,
    })
    .select()
    .single();
  if (error) throw new ErroApi(500, "Não foi possível salvar o item.");
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "criar_item_avulso",
    entidade: "itens_avulsos",
    entidade_id: data.id,
    depois: data,
  });
  return NextResponse.json({ item: data });
});

/** Edita nome, preço, emoji, ordem ou ativa/desativa um item. */
export const PATCH = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const corpo = await req.json();
  const admin = supabaseAdmin();
  const { data: antes } = await admin
    .from("itens_avulsos")
    .select("*")
    .eq("id", corpo.id)
    .eq("restaurante_id", perfil.restaurante_id!)
    .maybeSingle();
  if (!antes) throw new ErroApi(404, "Item não encontrado.");

  const mudancas: Record<string, unknown> = {};
  if (corpo.nome !== undefined) mudancas.nome = String(corpo.nome).trim();
  if (corpo.preco !== undefined) mudancas.preco = validarPreco(corpo.preco);
  if (corpo.emoji !== undefined) mudancas.emoji = validarEmoji(corpo.emoji);
  if (corpo.ordem !== undefined) mudancas.ordem = Number(corpo.ordem) || 0;
  if (corpo.ativo !== undefined) mudancas.ativo = Boolean(corpo.ativo);

  const { data, error } = await admin.from("itens_avulsos").update(mudancas).eq("id", antes.id).select().single();
  if (error) throw new ErroApi(500, "Não foi possível salvar o item.");
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "editar_item_avulso",
    entidade: "itens_avulsos",
    entidade_id: antes.id,
    antes,
    depois: data,
  });
  return NextResponse.json({ item: data });
});

/** Exclui o item. Comandas antigas mantêm descrição e valor (FK vira null). */
export const DELETE = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const id = new URL(req.url).searchParams.get("id");
  const admin = supabaseAdmin();
  const { data: antes } = await admin
    .from("itens_avulsos")
    .select("*")
    .eq("id", id ?? "")
    .eq("restaurante_id", perfil.restaurante_id!)
    .maybeSingle();
  if (!antes) throw new ErroApi(404, "Item não encontrado.");
  const { error } = await admin.from("itens_avulsos").delete().eq("id", antes.id);
  if (error) throw new ErroApi(500, "Não foi possível excluir o item.");
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: perfil.restaurante_id,
    acao: "excluir_item_avulso",
    entidade: "itens_avulsos",
    entidade_id: antes.id,
    antes,
  });
  return NextResponse.json({ ok: true });
});
