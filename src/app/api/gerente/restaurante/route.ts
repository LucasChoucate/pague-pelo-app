import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar } from "@/lib/contas";
import { COR_PRIMARIA, corPassaAA, hexValido } from "@/lib/cor";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Gerente atualiza nome, preço do kg e cor de destaque do próprio restaurante. */
export const PATCH = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const corpo = (await req.json()) as { nome?: string; preco_kg?: number; cor_destaque?: string };
  const admin = supabaseAdmin();
  const id = perfil.restaurante_id!;

  const { data: antes } = await admin.from("restaurantes").select("*").eq("id", id).single();
  if (!antes) throw new ErroApi(404, "Restaurante não encontrado.");

  const mudancas: Record<string, unknown> = {};
  let aviso: string | null = null;

  if (corpo.nome !== undefined) {
    if (corpo.nome.trim().length < 2) throw new ErroApi(400, "Nome muito curto.");
    mudancas.nome = corpo.nome.trim();
  }
  if (corpo.preco_kg !== undefined) {
    const preco = Math.round(Number(corpo.preco_kg) * 100) / 100;
    if (!(preco > 0 && preco < 1000)) throw new ErroApi(400, "Preço do kg inválido.");
    mudancas.preco_kg = preco;
  }
  if (corpo.cor_destaque !== undefined) {
    const cor = corpo.cor_destaque.toUpperCase();
    if (!hexValido(cor)) throw new ErroApi(400, "Cor inválida. Use o formato #RRGGBB.");
    if (corPassaAA(cor)) {
      mudancas.cor_destaque = cor;
    } else {
      mudancas.cor_destaque = COR_PRIMARIA;
      aviso = "A cor escolhida não tem contraste suficiente com texto branco (WCAG AA). Usamos a cor padrão do Pague pelo App.";
    }
  }
  if (Object.keys(mudancas).length === 0) throw new ErroApi(400, "Nada para salvar.");

  const { data: depois, error } = await admin.from("restaurantes").update(mudancas).eq("id", id).select().single();
  if (error) throw new ErroApi(500, "Não foi possível salvar.");

  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: id,
    acao: "atualizar_restaurante",
    entidade: "restaurantes",
    entidade_id: id,
    antes: Object.fromEntries(Object.keys(mudancas).map((k) => [k, antes[k]])),
    depois: mudancas,
  });

  return NextResponse.json({ restaurante: depois, aviso });
});
