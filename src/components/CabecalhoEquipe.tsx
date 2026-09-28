import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { LogoRestaurante } from "@/components/Marca";
import { corSegura } from "@/lib/cor";
import { ROTULO_PAPEL, type Restaurante, type Usuario } from "@/lib/tipos";

export function CabecalhoEquipe({
  perfil,
  restaurante,
  titulo,
  children,
}: {
  perfil: Usuario;
  restaurante: Pick<Restaurante, "nome" | "logo_url" | "cor_destaque"> | null;
  titulo: string;
  children?: ReactNode;
}) {
  const cor = corSegura(restaurante?.cor_destaque);
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-superficie/95 backdrop-blur">
      <div className="h-1" style={{ backgroundColor: cor }} aria-hidden />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {restaurante ? (
          <LogoRestaurante nome={restaurante.nome} logoUrl={restaurante.logo_url} cor={cor} className="size-10 text-sm" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icon.svg" alt="" className="size-10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{titulo}</p>
          <p className="truncate text-sm text-texto-2">
            {restaurante?.nome ?? "Pague pelo App"} · {perfil.nome} ({ROTULO_PAPEL[perfil.papel]})
          </p>
        </div>
        {children}
        <form action="/auth/sair" method="post">
          <button aria-label="Sair" className="grid size-12 place-items-center rounded-full border border-borda text-texto-2 hover:bg-superficie-2">
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
