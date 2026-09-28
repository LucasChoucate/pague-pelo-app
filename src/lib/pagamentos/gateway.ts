/**
 * Contrato do provedor de pagamento. A versão atual é simulada;
 * para produção, crie uma implementação (Mercado Pago, Pagar.me, Efí...)
 * que cumpra esta interface e troque em `index.ts`.
 *
 * Em um gateway real o Pix é confirmado por webhook: a rota do webhook
 * valida a assinatura do provedor e chama `confirmar_pagamento` no banco,
 * exatamente como a rota de simulação faz hoje.
 */
export interface CobrancaPix {
  referencia: string;
  copiaECola: string;
  expiraEm: string;
}

export interface DadosCartao {
  numero: string;
  nome: string;
  validade: string; // MM/AA
  cvv: string;
}

export type ResultadoCartao =
  | { aprovado: true; referencia: string; final: string }
  | { aprovado: false; motivo: string; final: string };

export interface GatewayPagamento {
  nome: string;
  criarCobrancaPix(params: { valor: number; pagamentoId: string; descricao: string }): Promise<CobrancaPix>;
  cobrarCartao(params: { valor: number; pagamentoId: string; cartao: DadosCartao }): Promise<ResultadoCartao>;
}
