"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Palette, ReceiptText, UsersRound, UtensilsCrossed } from "lucide-react";
import { cx } from "@/components/ui";

const ABAS = [
  { href: "/gerente", rotulo: "Indicadores", Icone: BarChart3 },
  { href: "/gerente/comandas", rotulo: "Comandas", Icone: ReceiptText },
  { href: "/gerente/equipe", rotulo: "Equipe", Icone: UsersRound },
  { href: "/gerente/cardapio", rotulo: "Preços e itens", Icone: UtensilsCrossed },
  { href: "/gerente/marca", rotulo: "Marca", Icone: Palette },
];

export function AbasGerente() {
  const caminho = usePathname();
  return (
    <nav aria-label="Seções do painel" className="border-b border-borda bg-superficie">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
        {ABAS.map(({ href, rotulo, Icone }) => {
          const ativo = href === "/gerente" ? caminho === href : caminho.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cx(
                "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold",
                ativo ? "border-marca text-marca" : "border-transparent text-texto-2 hover:text-texto",
              )}
            >
              <Icone className="size-4" aria-hidden /> {rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
