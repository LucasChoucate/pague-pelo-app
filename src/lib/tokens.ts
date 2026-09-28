import "server-only";
import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify, decodeJwt, errors } from "jose";

/**
 * Tokens dos QR Codes, assinados no servidor (HS256).
 *  - comanda: identifica a comanda para o atendente (validade longa).
 *  - saida:   Passe de Saída, renovado a cada 30 s, expira rápido.
 * Nenhum ID sequencial é exposto: o `sub` é o UUID dentro de um JWT assinado.
 */

export const JANELA_PASSE_S = 30;

function segredo() {
  const s = process.env.QR_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("Defina QR_TOKEN_SECRET (mínimo 32 caracteres) no .env.local");
  }
  return s;
}

const chave = () => new TextEncoder().encode(segredo());

export async function assinarTokenComanda(comandaId: string, restauranteId: string) {
  return new SignJWT({ t: "comanda", r: restauranteId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(comandaId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(chave());
}

export function janelaAtual(agoraMs = Date.now()) {
  return Math.floor(agoraMs / 1000 / JANELA_PASSE_S);
}

/** Código numérico de 6 dígitos derivado da comanda e da janela de 30 s. */
export function codigoSaida(comandaId: string, janela: number) {
  const h = createHmac("sha256", segredo()).update(`saida:${comandaId}:${janela}`).digest();
  const n = h.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function gerarPasseSaida(comandaId: string, restauranteId: string) {
  const janela = janelaAtual();
  const fimJanelaMs = (janela + 1) * JANELA_PASSE_S * 1000;
  const token = await new SignJWT({ t: "saida", r: restauranteId, w: janela })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(comandaId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(fimJanelaMs / 1000))
    .sign(chave());
  return { token, codigo: codigoSaida(comandaId, janela), renovaEm: fimJanelaMs };
}

/**
 * Situação de um código de 6 dígitos para a comanda:
 *  - "valido": só o código da janela atual (o que está na tela agora);
 *  - "expirado": foi desta comanda nos últimos 10 min, mas já trocou;
 *  - null: não é desta comanda.
 */
export function situacaoCodigo(comandaId: string, codigo: string, agoraMs = Date.now()): "valido" | "expirado" | null {
  const j = janelaAtual(agoraMs);
  if (codigoSaida(comandaId, j) === codigo) return "valido";
  for (let k = 1; k <= (10 * 60) / JANELA_PASSE_S; k++) {
    if (codigoSaida(comandaId, j - k) === codigo) return "expirado";
  }
  return null;
}

type ResultadoToken =
  | { ok: true; comandaId: string; restauranteId: string }
  | { ok: false; motivo: "expirado" | "invalido"; comandaId?: string; restauranteId?: string };

/** `agoraMs`: instante de referência (ex.: quando o pedido chegou ao servidor). */
export async function verificarToken(token: string, tipo: "comanda" | "saida", agoraMs = Date.now()): Promise<ResultadoToken> {
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"], currentDate: new Date(agoraMs) });
    if (payload.t !== tipo || !payload.sub) return { ok: false, motivo: "invalido" };
    return { ok: true, comandaId: payload.sub, restauranteId: String(payload.r) };
  } catch (e) {
    if (e instanceof errors.JWTExpired) {
      // Assinatura já foi conferida antes da checagem de expiração.
      const p = decodeJwt(token);
      return { ok: false, motivo: "expirado", comandaId: p.sub, restauranteId: String(p.r) };
    }
    return { ok: false, motivo: "invalido" };
  }
}
