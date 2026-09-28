export const COR_PRIMARIA = "#0F766E";

function luminancia(hex: string) {
  const n = hex.replace("#", "");
  const canais = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(hexA: string, hexB: string) {
  const [a, b] = [luminancia(hexA), luminancia(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

export function hexValido(hex: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * A cor do restaurante recebe texto branco na tela de boas-vindas,
 * então precisa de contraste AA (4,5:1) com branco.
 */
export function corPassaAA(hex: string) {
  return hexValido(hex) && contraste(hex, "#FFFFFF") >= 4.5;
}

/** Cor segura para exibir: a do restaurante, ou a primária da marca se falhar. */
export function corSegura(hex: string | null | undefined) {
  return hex && corPassaAA(hex) ? hex : COR_PRIMARIA;
}
