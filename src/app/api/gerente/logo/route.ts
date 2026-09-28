import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { auditar } from "@/lib/contas";
import { supabaseAdmin } from "@/lib/supabase/server";

const TIPOS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Upload do logo para o Storage (bucket público "logos"). */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const form = await req.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) throw new ErroApi(400, "Envie uma imagem.");
  const ext = TIPOS[arquivo.type];
  if (!ext) throw new ErroApi(400, "Use PNG, JPG, WEBP ou SVG.");
  if (arquivo.size > 1024 * 1024) throw new ErroApi(400, "A imagem deve ter até 1 MB.");

  const admin = supabaseAdmin();
  const id = perfil.restaurante_id!;
  const caminho = `${id}/logo-${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from("logos")
    .upload(caminho, await arquivo.arrayBuffer(), { contentType: arquivo.type, upsert: false });
  if (error) throw new ErroApi(500, "Falha no upload do logo.");

  const url = admin.storage.from("logos").getPublicUrl(caminho).data.publicUrl;
  const { data: antes } = await admin.from("restaurantes").select("logo_url").eq("id", id).single();
  await admin.from("restaurantes").update({ logo_url: url }).eq("id", id);
  await auditar(admin, {
    usuario_id: perfil.id,
    restaurante_id: id,
    acao: "atualizar_logo",
    entidade: "restaurantes",
    entidade_id: id,
    antes,
    depois: { logo_url: url },
  });
  return NextResponse.json({ logo_url: url });
});
