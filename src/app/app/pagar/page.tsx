import Link from "next/link";
import { Wallet } from "lucide-react";
import { Vazio } from "@/components/ui";
import { comandaAtivaComRestaurante } from "@/lib/cliente";
import { Pagamento } from "./Pagamento";

export const metadata = { title: "Pagar" };

export default async function PaginaPagar() {
  const comanda = await comandaAtivaComRestaurante();
  if (!comanda) {
    return (
      <main className="flex flex-1 flex-col justify-center">
        <Vazio icone={<Wallet className="size-7" />} titulo="Nada para pagar" texto="Você não tem comanda ativa.">
          <Link href="/app" className="font-semibold text-marca hover:underline">Voltar ao início</Link>
        </Vazio>
      </main>
    );
  }
  return <Pagamento comandaId={comanda.id} restaurante={comanda.restaurantes.nome} />;
}
