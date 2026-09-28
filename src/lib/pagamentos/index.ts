import "server-only";
import type { GatewayPagamento } from "./gateway";
import { gatewaySimulado } from "./simulado";

/** Troque aqui pela implementação real quando integrar um provedor. */
export const gateway: GatewayPagamento = gatewaySimulado;

export const PAGAMENTO_SIMULADO = gateway.nome === "simulado";

export type { DadosCartao } from "./gateway";
