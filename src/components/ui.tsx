import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ROTULO_STATUS, type StatusComanda } from "@/lib/tipos";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "destaque";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-marca-texto hover:brightness-110 active:brightness-95",
  secundario: "bg-superficie text-texto border border-borda hover:bg-superficie-2",
  fantasma: "bg-transparent text-marca hover:bg-marca-clara/60",
  perigo: "bg-erro text-white hover:brightness-110",
  destaque: "bg-destaque text-destaque-texto hover:brightness-105",
};

export function Botao({
  variante = "primario",
  carregando,
  grande,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; grande?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-botao px-5 font-semibold transition select-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        grande ? "min-h-14 text-lg" : "min-h-12 text-base",
        VARIANTES[variante],
        className,
      )}
    >
      {carregando && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-[24px] border border-borda bg-superficie p-5 shadow-cartao", className)}>
      {children}
    </section>
  );
}

export function Campo({
  rotulo,
  ajuda,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: string }) {
  const campoId = id ?? props.name;
  return (
    <label htmlFor={campoId} className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-texto">{rotulo}</span>
      <input
        id={campoId}
        {...props}
        className="min-h-12 rounded-botao border border-borda bg-superficie px-4 text-base text-texto placeholder:text-texto-2 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
      />
      {ajuda && <span className="text-xs text-texto-2">{ajuda}</span>}
    </label>
  );
}

export function Alerta({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "ok" | "atencao" | "info";
  children: ReactNode;
}) {
  const estilos = {
    erro: "border-erro/40 bg-erro/10 text-erro-texto",
    ok: "border-ok/40 bg-ok/10 text-ok-texto",
    atencao: "border-atencao/40 bg-atencao/10 text-atencao-texto",
    info: "border-info/40 bg-info/10 text-info-texto",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={cx("rounded-botao border px-4 py-3 text-sm font-medium", estilos)}>
      {children}
    </div>
  );
}

const COR_STATUS: Record<StatusComanda, string> = {
  ABERTA: "bg-info/12 text-info-texto",
  PENDENTE_PAGAMENTO: "bg-atencao/15 text-atencao-texto",
  PAGA: "bg-ok/12 text-ok-texto",
  FINALIZADA: "bg-superficie-2 text-texto-2",
  CANCELADA: "bg-erro/10 text-erro-texto",
  EXPIRADA: "bg-superficie-2 text-texto-2",
};

export function SeloStatus({ status, className }: { status: StatusComanda; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", COR_STATUS[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-16 text-texto-2" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function Vazio({ icone, titulo, texto, children }: { icone?: ReactNode; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icone && <div className="grid size-14 place-items-center rounded-full bg-marca-clara text-marca">{icone}</div>}
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {texto && <p className="max-w-sm text-sm text-texto-2">{texto}</p>}
      {children}
    </div>
  );
}
