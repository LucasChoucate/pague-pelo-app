"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DoorOpen, History, Home, QrCode, User } from "lucide-react";
import { cx } from "@/components/ui";

const ITENS = [
  { href: "/app", rotulo: "Início", Icone: Home },
  { href: "/app/historico", rotulo: "Histórico", Icone: History },
  { href: "/app/saida", rotulo: "Saída", Icone: DoorOpen },
  { href: "/app/perfil", rotulo: "Perfil", Icone: User },
];

/** Barra inferior com botão central elevado (comanda), como na referência. */
export function NavCliente() {
  const caminho = usePathname();
  const ativo = (href: string) => (href === "/app" ? caminho === "/app" : caminho.startsWith(href));
  const [esq, dir] = [ITENS.slice(0, 2), ITENS.slice(2)];

  const item = ({ href, rotulo, Icone }: (typeof ITENS)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={ativo(href) ? "page" : undefined}
      className={cx(
        "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
        ativo(href) ? "text-marca" : "text-texto-2",
      )}
    >
      <Icone className="size-[22px]" aria-hidden />
      {rotulo}
    </Link>
  );

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <div className="relative flex items-center rounded-[28px] border border-borda bg-superficie px-2 py-1.5 shadow-cartao">
        {esq.map(item)}
        <div className="w-20 shrink-0" />
        {dir.map(item)}
        <Link
          href="/app/comanda"
          aria-label="Minha comanda"
          aria-current={ativo("/app/comanda") ? "page" : undefined}
          className="absolute left-1/2 -top-6 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-marca text-marca-texto shadow-lg ring-[6px] ring-fundo transition hover:brightness-110"
        >
          <QrCode className="size-7" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
