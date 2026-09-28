"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { EMOJIS_ITENS } from "@/lib/emoji";

/** Grade de emojis; envia o escolhido no campo oculto `name`. */
export function SeletorEmoji({ name, inicial }: { name: string; inicial?: string | null }) {
  const [valor, setValor] = useState(inicial ?? "🍽️");
  const opcoes = EMOJIS_ITENS.includes(valor) ? EMOJIS_ITENS : [valor, ...EMOJIS_ITENS];
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Ícone</legend>
      <input type="hidden" name={name} value={valor} />
      <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Ícone do item">
        {opcoes.map((e) => (
          <button
            type="button"
            key={e}
            role="radio"
            aria-checked={valor === e}
            aria-label={e}
            onClick={() => setValor(e)}
            className={cx(
              "grid aspect-square min-h-10 place-items-center rounded-lg text-xl transition",
              valor === e ? "bg-marca-clara ring-2 ring-marca" : "hover:bg-superficie-2",
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
