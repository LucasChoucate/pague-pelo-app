/** Emojis sugeridos para itens avulsos. */
export const EMOJIS_ITENS = [
  "🥤", "🧃", "🍊", "🍹", "💧", "🍺", "🍷", "☕",
  "🍵", "🧋", "🍮", "🍨", "🍦", "🍰", "🎂", "🍫",
  "🍩", "🍪", "🧀", "🥐", "🍞", "🥗", "🍟", "🍽️",
];

const PICTOGRAMA = /\p{Extended_Pictographic}/u;
/** Tudo o que pode compor um emoji (pictograma, variação, pele, ZWJ, bandeiras, keycap). */
const PARTES = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;

/** Aceita só emoji (1 a 2 emojis), sem letras nem números. */
export function ehEmoji(texto: string) {
  const t = texto.trim();
  if (!t || !PICTOGRAMA.test(t)) return false;
  if (t.replace(PARTES, "") !== "") return false;
  return [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(t)].length <= 2;
}
