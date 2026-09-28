export type Papel = "cliente" | "atendente" | "porteiro" | "gerente" | "admin_plataforma";

export type StatusComanda =
  | "ABERTA"
  | "PENDENTE_PAGAMENTO"
  | "PAGA"
  | "FINALIZADA"
  | "CANCELADA"
  | "EXPIRADA";

export const STATUS_ATIVOS: StatusComanda[] = ["ABERTA", "PENDENTE_PAGAMENTO", "PAGA"];

export interface Restaurante {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cor_destaque: string;
  preco_kg: number;
  ativo: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  papel: Papel;
  restaurante_id: string | null;
  ativo: boolean;
}

export interface ItemAvulso {
  id: string;
  restaurante_id: string;
  nome: string;
  preco: number;
  emoji: string | null;
  ordem: number;
  ativo: boolean;
}

export interface Comanda {
  id: string;
  restaurante_id: string;
  cliente_id: string;
  codigo_curto: string;
  status: StatusComanda;
  total: number;
  total_pago: number;
  criada_em: string;
  paga_em: string | null;
  saida_em: string | null;
  cancelada_motivo: string | null;
}

export interface ItemComanda {
  id: string;
  comanda_id: string;
  tipo: "pesagem" | "avulso";
  item_avulso_id: string | null;
  descricao: string;
  peso_g: number | null;
  quantidade: number;
  preco_unit: number;
  valor: number;
  lancado_por: string;
  criado_em: string;
  removido_em: string | null;
  motivo_remocao: string | null;
}

export interface Pagamento {
  id: string;
  comanda_id: string;
  restaurante_id: string;
  cliente_id: string;
  metodo: "pix" | "cartao";
  valor: number;
  status: "pendente" | "aprovado" | "recusado" | "cancelado";
  motivo: string | null;
  referencia_externa: string | null;
  pix_copia_e_cola: string | null;
  cartao_final: string | null;
  criado_em: string;
  aprovado_em: string | null;
}

export const ROTULO_STATUS: Record<StatusComanda, string> = {
  ABERTA: "Aberta",
  PENDENTE_PAGAMENTO: "Saldo pendente",
  PAGA: "Paga",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  cliente: "Cliente",
  atendente: "Atendente de caixa",
  porteiro: "Porteiro",
  gerente: "Gerente",
  admin_plataforma: "Admin da plataforma",
};

/** Página inicial de cada papel. */
export const HOME_DO_PAPEL: Record<Papel, string> = {
  cliente: "/app",
  atendente: "/caixa",
  porteiro: "/porteiro",
  gerente: "/gerente",
  admin_plataforma: "/admin",
};
