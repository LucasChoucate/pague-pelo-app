import { NextResponse } from "next/server";
import { ErroApi, rota, supabaseConfigurado } from "@/lib/auth";
import { criarConta } from "@/lib/contas";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Cadastro de CLIENTE. Funcionários são criados pelo gerente. */
export const POST = rota(async (req) => {
  if (!supabaseConfigurado()) throw new ErroApi(503, "Supabase não configurado.");
  const corpo = await req.json();
  if (!corpo.aceitouPrivacidade) {
    throw new ErroApi(400, "Para continuar, aceite o aviso de privacidade.");
  }
  await criarConta(supabaseAdmin(), {
    nome: corpo.nome,
    identificador: corpo.identificador,
    senha: corpo.senha,
    cpf: corpo.cpf || null,
    papel: "cliente",
    restauranteId: null,
    aceitouPrivacidade: true,
  });
  return NextResponse.json({ ok: true });
});
