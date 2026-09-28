import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Clientes que pagaram no caixa tradicional num dia (base da taxa de adoção). */
export const PUT = rota(async (req) => {
  const perfil = await exigirPapelApi(["gerente"]);
  const { data, clientes_caixa } = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) throw new ErroApi(400, "Data inválida.");
  const n = Math.floor(Number(clientes_caixa));
  if (!(n >= 0 && n < 100000)) throw new ErroApi(400, "Quantidade inválida.");
  const { error } = await supabaseAdmin()
    .from("movimento_diario")
    .upsert({ restaurante_id: perfil.restaurante_id, data, clientes_caixa: n });
  if (error) throw new ErroApi(500, "Não foi possível salvar.");
  return NextResponse.json({ ok: true });
});
