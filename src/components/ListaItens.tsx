import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import { formatarBRL, formatarHora, formatarPeso } from "@/lib/formato";
import type { ItemComanda } from "@/lib/tipos";

export function descricaoItem(item: ItemComanda) {
  if (item.tipo === "pesagem" && item.peso_g) {
    return `${formatarPeso(item.peso_g)} × ${formatarBRL(item.preco_unit)}/kg`;
  }
  return item.quantidade > 1 ? `${item.quantidade} × ${formatarBRL(item.preco_unit)}` : formatarBRL(item.preco_unit);
}

/** Lista de itens no estilo da referência: miniatura redonda + texto + valor. */
export function ListaItens({
  itens,
  emojis = {},
  acao,
}: {
  itens: ItemComanda[];
  emojis?: Record<string, string | null>;
  acao?: (item: ItemComanda) => ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-[18px] bg-superficie-2 p-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie text-xl shadow-sm" aria-hidden>
            {item.tipo === "pesagem" ? <Scale className="size-5 text-marca" /> : (item.item_avulso_id && emojis[item.item_avulso_id]) || "🍽️"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{item.descricao}</p>
            <p className="num text-sm text-texto-2">
              {descricaoItem(item)} · {formatarHora(item.criado_em)}
            </p>
          </div>
          <span className="num font-semibold">{formatarBRL(item.valor)}</span>
          {acao?.(item)}
        </li>
      ))}
    </ul>
  );
}
