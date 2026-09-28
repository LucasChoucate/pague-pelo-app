import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Vazio } from "@/components/ui";
import { comandaAtivaComRestaurante } from "@/lib/cliente";
import { corSegura } from "@/lib/cor";
import { PasseSaida } from "./PasseSaida";

export const metadata = { title: "Passe de Saída" };

export default async function PaginaSaida() {
  const comanda = await comandaAtivaComRestaurante();
  if (!comanda) {
    return (
      <main className="flex flex-1 flex-col justify-center">
        <Vazio icone={<DoorOpen className="size-7" />} titulo="Sem passe de saída" texto="O Passe de Saída aparece aqui quando sua comanda estiver paga.">
          <Link href="/app" className="font-semibold text-marca hover:underline">Voltar ao início</Link>
        </Vazio>
      </main>
    );
  }
  return (
    <PasseSaida
      comandaId={comanda.id}
      restaurante={comanda.restaurantes.nome}
      corRestaurante={corSegura(comanda.restaurantes.cor_destaque)}
    />
  );
}
