export type Transaction = {
  id: string;
  date: string;
  type: 'entrada' | 'saida';
  category: string;
  account?: string;
  description: string;
  value: number;
};

export const initialTransactions: Transaction[] = [];

export const defaultCategories: string[] = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Educação',
  'Moradia',
  'Outros',
];

export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
};

export type Receivable = {
  id: string;
  description: string;
  value: number;
  paidValue?: number;
  dueDate: string;
  client: string;
  status: 'pendente' | 'recebido' | 'parcial';
};

export const initialReceivables: Receivable[] = [];

export const assetTypes = [
  'Renda Fixa',
  'Ações',
  'Criptomoedas',
  'Fundos Imobiliários',
  'Previdência',
  'Reserva de Emergência',
  'Outros',
];

export const assetTypeColors: Record<string, string> = {
  'Renda Fixa': '#3B82F6',
  'Ações': '#8B5CF6',
  'Criptomoedas': '#F59E0B',
  'Fundos Imobiliários': '#10B981',
  'Previdência': '#06B6D4',
  'Reserva de Emergência': '#14B8A6',
  'Outros': '#64748B',
};