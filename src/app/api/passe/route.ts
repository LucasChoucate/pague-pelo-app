import { NextResponse } from "next/server";
import { ErroApi, exigirPapelApi, rota } from "@/lib/auth";
import { comandaAtivaDoCliente } from "@/lib/comandas";
import { gerarPasseSaida } from "@/lib/tokens";

/** Passe de Saída: token + código de 6 dígitos da janela atual de 30 s. */
export const GET = rota(async () => {
  const perfil = await exigirPapelApi(["cliente"]);
  const comanda = await comandaAtivaDoCliente(perfil.id);
  if (comanda.status !== "PAGA") {
    throw new ErroApi(409, "O Passe de Saída aparece quando a comanda está paga.");
  }
  const passe = await gerarPasseSaida(comanda.id, comanda.restaurante_id);
  return NextResponse.json(
    {
      ...passe,
      agora: Date.now(),
      nome: perfil.nome,
      totalPago: Number(comanda.total_pago),
      pagaEm: comanda.paga_em,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
