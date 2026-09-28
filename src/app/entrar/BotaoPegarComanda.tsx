"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Alerta, Botao } from "@/components/ui";
import { supabaseNavegador } from "@/lib/supabase/client";

export function BotaoPegarComanda({ slug }: { slug: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function pegar() {
    setOcupado(true);
    setErro(null);
    const { error } = await supabaseNavegador().rpc("abrir_comanda", { p_slug: slug });
    if (error) {
      setErro(error.message);
      setOcupado(false);
      return;
    }
    router.push("/app/comanda");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <Alerta>{erro}</Alerta>}
      <Botao grande onClick={pegar} carregando={ocupado} className="shadow-cartao">
        <Ticket className="size-6" aria-hidden /> Pegar minha comanda
      </Botao>
    </div>
  );
}
