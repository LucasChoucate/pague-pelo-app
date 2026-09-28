import { NextResponse } from "next/server";
import { exigirPapelApi, rota } from "@/lib/auth";
import { comandaAtivaDoCliente } from "@/lib/comandas";
import { assinarTokenComanda } from "@/lib/tokens";

/** Token assinado que vai no QR da comanda (escaneado pelo atendente). */
export const GET = rota(async () => {
  const perfil = await exigirPapelApi(["cliente"]);
  const comanda = await comandaAtivaDoCliente(perfil.id);
  const token = await assinarTokenComanda(comanda.id, comanda.restaurante_id);
  return NextResponse.json({ token });
});
