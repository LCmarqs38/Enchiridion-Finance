// Transações
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

// Categorias
export const defaultCategories: string[] = [
  'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Moradia', 'Outros'
];

// Open Finance — Contas bancárias
export type BankAccount = {
  id: string;
  bank: string;
  balance: number;
  lastSync: string;
  syncing?: boolean;
};
export const initialAccounts: BankAccount[] = [
  { id: 'c1', bank: 'Nubank', balance: 0, lastSync: 'Pendente' },
  { id: 'c2', bank: 'Itaú', balance: 0, lastSync: 'Pendente' },
  { id: 'c3', bank: 'Bradesco', balance: 0, lastSync: 'Pendente' },
];

// Orçamentos
export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
};
export const initialBudget: Budget[] = [];
export const initialBudgets = initialBudget;

// Dinheiro a Receber
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

// Investimentos / Patrimônio
export type Asset = {
  id: string;
  name: string;
  type: string;
  value: number;
  date: string;
};
export const assetTypes = [
  'Renda Fixa', 'Ações', 'Criptomoedas', 'Fundos Imobiliários', 'Previdência', 'Reserva de Emergência', 'Outros'
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
export const initialAssets: Asset[] = [];

// Dados para os gráficos estáticos (Evolução Patrimonial) - Podem iniciar vazios
export const patrimonioEvolution = [
  { month: 'Jan', valor: 0 },
];