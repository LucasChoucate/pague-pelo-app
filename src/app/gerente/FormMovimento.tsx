"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui";

export function FormMovimento({ data, inicial }: { data: string; inicial: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(inicial));
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo" | "erro">("parado");

  async function salvar() {
    setEstado("salvando");
    const r = await fetch("/api/gerente/movimento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, clientes_caixa: Number(valor) }),
    });
    setEstado(r.ok ? "salvo" : "erro");
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        aria-label="Clientes no caixa tradicional"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value.replace(/\D/g, ""));
          setEstado("parado");
        }}
        inputMode="numeric"
        className="num min-h-12 w-32 rounded-botao border border-borda bg-superficie px-4 text-lg font-semibold"
      />
      <Botao onClick={salvar} carregando={estado === "salvando"}>Salvar</Botao>
      {estado === "salvo" && <span className="text-sm font-medium text-ok-texto">Salvo.</span>}
      {estado === "erro" && <span className="text-sm font-medium text-erro-texto">Não foi possível salvar.</span>}
    </div>
  );
}
