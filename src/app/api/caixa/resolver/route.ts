import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { STATUS_ATIVOS } from "@/lib/tipos";
import { verificarToken } from "@/lib/tokens";

/** Recebe o QR escaneado ou o código curto e devolve o id da comanda. */
export const POST = rota(async (req) => {
  const perfil = await exigirPapelApi(["atendente"]);
  const { texto } = (await req.json()) as { texto?: string };
  const entrada = (texto ?? "").trim();
  if (!entrada) throw new ErroApi(400, "Escaneie o QR ou digite o código.");

  if (entrada.includes(".")) {
    const r = await verificarToken(entrada, "comanda");
    if (!r.ok) {
      throw new ErroApi(400, r.motivo === "expirado" ? "QR expirado. Peça para o cliente atualizar a tela." : "QR inválido. Este não é o QR de uma comanda.");
    }
    if (r.restauranteId !== perfil.restaurante_id) {
      throw new ErroApi(400, "Esta comanda é de outro restaurante.");
    }
    return NextResponse.json({ comandaId: r.comandaId });
  }

  const codigo = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (codigo.length !== 4) throw new ErroApi(400, "O código da comanda tem 4 caracteres.");
  const { data } = await supabaseAdmin()
    .from("comandas")
    .select("id")
    .eq("restaurante_id", perfil.restaurante_id!)
    .eq("codigo_curto", codigo)
    .in("status", STATUS_ATIVOS)
    .maybeSingle();
  if (!data) throw new ErroApi(404, `Nenhuma comanda ativa com o código ${codigo}.`);
  return NextResponse.json({ comandaId: data.id });
});
