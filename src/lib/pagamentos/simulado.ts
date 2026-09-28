import { randomBytes } from "node:crypto";
import type { GatewayPagamento } from "./gateway";

/**
 * Gateway fictício. Regras do cartão de teste:
 *  - final 0002 → recusado ("Cartão recusado pelo emissor")
 *  - final 0003 → recusado ("Saldo insuficiente")
 *  - qualquer outro número com 16 dígitos e validade futura → aprovado
 */
export const gatewaySimulado: GatewayPagamento = {
  nome: "simulado",

  async criarCobrancaPix({ valor, pagamentoId, descricao }) {
    const referencia = `PIXSIM-${randomBytes(6).toString("hex").toUpperCase()}`;
    // Parece um BR Code, mas é fictício e não paga nada.
    const copiaECola =
      `00020126580014BR.GOV.BCB.PIX0136${pagamentoId}` +
      `5204000053039865406${valor.toFixed(2)}5802BR5913PAGUEPELOAPP6009SAO PAULO` +
      `62${String(descricao.length + 4).padStart(2, "0")}05${String(descricao.length).padStart(2, "0")}${descricao}6304SIMU`;
    const expiraEm = new Date(Date.now() + 15 * 60_000).toISOString();
    return { referencia, copiaECola, expiraEm };
  },

  async cobrarCartao({ cartao }) {
    const numero = cartao.numero.replace(/\D/g, "");
    const final = numero.slice(-4);
    await new Promise((r) => setTimeout(r, 900)); // "processando"

    if (numero.length !== 16) return { aprovado: false, motivo: "Número do cartão inválido.", final };
    const [mm, aa] = cartao.validade.split("/").map((p) => parseInt(p, 10));
    const fimValidade = new Date(2000 + (aa || 0), mm || 0, 1);
    if (!mm || mm > 12 || fimValidade <= new Date()) {
      return { aprovado: false, motivo: "Cartão vencido ou validade inválida.", final };
    }
    if (!/^\d{3,4}$/.test(cartao.cvv)) return { aprovado: false, motivo: "CVV inválido.", final };
    if (final === "0002") return { aprovado: false, motivo: "Cartão recusado pelo emissor.", final };
    if (final === "0003") return { aprovado: false, motivo: "Saldo insuficiente.", final };

    return { aprovado: true, referencia: `CARDSIM-${randomBytes(6).toString("hex").toUpperCase()}`, final };
  },
};
