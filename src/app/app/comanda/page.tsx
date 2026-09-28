import Link from "next/link";
import { QrCode } from "lucide-react";
import { Vazio } from "@/components/ui";
import { comandaAtivaComRestaurante } from "@/lib/cliente";
import { corSegura } from "@/lib/cor";
import { supabaseServidor } from "@/lib/supabase/server";
import { ComandaCliente } from "./ComandaCliente";

export const metadata = { title: "Minha comanda" };

export default async function PaginaComanda() {
  const comanda = await comandaAtivaComRestaurante();
  if (!comanda) {
    return (
      <main className="flex flex-1 flex-col justify-center">
        <Vazio icone={<QrCode className="size-7" />} titulo="Nenhuma comanda ativa" texto="Escaneie o QR Code na entrada do restaurante para pegar sua comanda.">
          <Link href="/app" className="font-semibold text-marca underline-offset-4 hover:underline">
            Voltar ao início
          </Link>
        </Vazio>
      </main>
    );
  }

  const supabase = await supabaseServidor();
  const { data: avulsos } = await supabase.from("itens_avulsos").select("id, emoji").eq("restaurante_id", comanda.restaurante_id);
  const emojis = Object.fromEntries((avulsos ?? []).map((a) => [a.id, a.emoji]));

  return (
    <ComandaCliente
      comandaId={comanda.id}
      restaurante={{
        nome: comanda.restaurantes.nome,
        cor: corSegura(comanda.restaurantes.cor_destaque),
        precoKg: Number(comanda.restaurantes.preco_kg),
      }}
      emojis={emojis}
    />
  );
}
