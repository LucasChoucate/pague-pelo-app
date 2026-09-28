/* eslint-disable @next/next/no-img-element */
import { cx } from "@/components/ui";

export function LogoMarca({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <img src="/icon.svg" alt="" className="size-8" />
      <span>
        Pague <span className="text-marca">pelo App</span>
      </span>
    </span>
  );
}

/** Logo do restaurante ou, se não houver, as iniciais sobre a cor dele. */
export function LogoRestaurante({
  nome,
  logoUrl,
  cor,
  className,
}: {
  nome: string;
  logoUrl: string | null;
  cor: string;
  className?: string;
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt={`Logo ${nome}`} className={cx("rounded-2xl bg-white object-contain", className)} />;
  }
  const iniciais = nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-label={nome}
      className={cx("grid place-items-center rounded-2xl font-bold text-white", className)}
      style={{ backgroundColor: cor }}
    >
      {iniciais}
    </span>
  );
}
