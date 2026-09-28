export const FUSO = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarBRL(valor: number | string | null | undefined) {
  return brl.format(Number(valor ?? 0));
}

export function formatarPeso(gramas: number) {
  return gramas >= 1000
    ? `${(gramas / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
    : `${gramas} g`;
}

export function formatarHora(iso: string | Date, comSegundos = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    ...(comSegundos ? { second: "2-digit" } : {}),
  }).format(new Date(iso));
}

export function formatarDataHora(iso: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatarData(iso: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** Data de hoje em São Paulo, no formato YYYY-MM-DD. */
export function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

/** Soma dias a uma data YYYY-MM-DD. */
export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Início do dia em São Paulo (sem horário de verão desde 2019: UTC-3). */
export function inicioDoDiaSP(data: string) {
  return `${data}T00:00:00-03:00`;
}

/** Converte "email ou telefone" no e-mail de login usado pelo Supabase Auth. */
export function identificadorParaEmail(identificador: string) {
  const texto = identificador.trim().toLowerCase();
  if (texto.includes("@")) return texto;
  const digitos = texto.replace(/\D/g, "");
  return `${digitos}@tel.paguepeloapp.local`;
}

export function pareceTelefone(texto: string) {
  return !texto.includes("@") && texto.replace(/\D/g, "").length >= 10;
}
