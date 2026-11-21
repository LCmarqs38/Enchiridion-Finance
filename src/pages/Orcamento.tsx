import { useState, useEffect, useMemo } from 'react';
import {
  Target,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Budget, Transaction, initialTransactions, defaultCategories } from '@/data/financeData';
import { formatCurrency } from '@/utils/format';

const INCOME_KEYWORDS = [
  'salário',
  'salario',
  'renda',
  'freelance',
  'serviço',
  'servico',
  'recebimento',
  'dividendo',
  'bônus',
  'bonus',
  'prêmio',
  'premio',
  'reembolso',
];

function isIncomeCategoryName(name: string): boolean {
  const lower = name.toLowerCase();
  return INCOME_KEYWORDS.some((kw) => lower.includes(kw));
}

function readExpenseCategories(): string[] {
  try {
    const saved = localStorage.getItem('pf_categories');
    const parsed = saved ? JSON.parse(saved) : defaultCategories;

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray(parsed.saida)
    ) {
      return parsed.saida.length > 0 ? parsed.saida : ['Outros'];
    }

    if (Array.isArray(parsed)) {
      const expenses = parsed.filter(
        (c): c is string =>
          typeof c === 'string' && c.trim().length > 0 && !isIncomeCategoryName(c)
      );
      return expenses.length > 0 ? expenses : ['Outros'];
    }
  } catch {}

  const fallback = defaultCategories.filter((c) => !isIncomeCategoryName(c));
  return fallback.length > 0 ? fallback : ['Outros'];
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export default function Orcamento() {
  const [budgets, setBudgets] = useState<Budget[]>(() => readStorage<Budget[]>('pf_budgets', []));
  const [categories, setCategories] = useState<string[]>(readExpenseCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    readStorage<Transaction[]>('pf_transactions', initialTransactions)
  );

  const [formCategory, setFormCategory] = useState(() => readExpenseCategories()[0] || 'Outros');
  const [formLimit, setFormLimit] = useState('');

  useEffect(() => {
    const syncData = () => {
      setBudgets(readStorage<Budget[]>('pf_budgets', []));
      setCategories(readExpenseCategories());
      setTransactions(readStorage<Transaction[]>('pf_transactions', initialTransactions));
    };

    window.addEventListener('storage', syncData);
    window.addEventListener('finance_data_updated', syncData);
    return () => {
      window.removeEventListener('storage', syncData);
      window.removeEventListener('finance_data_updated', syncData);
    };
  }, []);

  useEffect(() => {
    if (!categories.includes(formCategory)) {
      setFormCategory(categories[0] || 'Outros');
    }
  }, [categories, formCategory]);

  const saveBudgets = (newBudgets: Budget[]) => {
    setBudgets(newBudgets);
    localStorage.setItem('pf_budgets', JSON.stringify(newBudgets));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const spentPerCategory = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const spending: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.type !== 'saida' || !tx.date) return;

      const parts = tx.date.split('T')[0].split('-');
      if (parts.length !== 3) return;

      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;

      if (year === currentYear && month === currentMonth) {
        spending[tx.category] = (spending[tx.category] || 0) + tx.value;
      }
    });
    return spending;
  }, [transactions]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(formLimit);
    if (!formCategory || isNaN(limitNum) || limitNum <= 0) return;

    const exists = budgets.some((b) => b.category === formCategory);
    const updated: Budget[] = exists
      ? budgets.map((b) => (b.category === formCategory ? { ...b, limit: limitNum } : b))
      : [
          ...budgets,
          {
            id: String(Date.now()),
            category: formCategory,
            limit: limitNum,
            spent: 0,
          },
        ];

    saveBudgets(updated);
    setFormLimit('');
  };

  const handleDeleteBudget = (id: string) => {
    saveBudgets(budgets.filter((b) => b.id !== id));
  };

  const totalLimite = useMemo(() => budgets.reduce((acc, b) => acc + b.limit, 0), [budgets]);
  const totalGasto = useMemo(
    () => budgets.reduce((acc, b) => acc + (spentPerCategory[b.category] || 0), 0),
    [budgets, spentPerCategory]
  );
  const totalDisponivel = totalLimite - totalGasto;
  const isDisponivelNegativo = totalDisponivel < 0;

  return (
    <div className="space-y-5 fade-in min-w-0 w-full">
      <h1 className="text-lg font-semibold text-white tracking-wide">ORÇAMENTO MENSAL</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-gradient-to-br from-blue-900/20 to-[#12161A] min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide truncate">
              Limite Total
            </span>
            <Target className="w-4 h-4 text-blue-400 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-400 tabular-nums break-all sm:break-normal">
            {formatCurrency(totalLimite)}
          </p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-rose-900/20 to-[#12161A] min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide truncate">
              Gasto no Mês
            </span>
            <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400 tabular-nums break-all sm:break-normal">
            {formatCurrency(totalGasto)}
          </p>
        </div>

        <div
          className={`card p-4 bg-gradient-to-br to-[#12161A] min-w-0 ${
            isDisponivelNegativo
              ? 'from-rose-900/25 border-rose-500/20'
              : 'from-emerald-900/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide truncate">
              Disponível
            </span>
            {isDisponivelNegativo ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums break-all sm:break-normal ${
              isDisponivelNegativo ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formatCurrency(totalDisponivel)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveBudget} className="card p-4 space-y-3 min-w-0">
        <h2 className="text-sm font-semibold text-slate-200">Definir Limite por Categoria</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <label className="label-base">Categoria</label>
            <select
              className="input-base"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="label-base">Limite Mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              className="input-base"
              value={formLimit}
              onChange={(e) => setFormLimit(e.target.value)}
            />
          </div>
          <div className="flex items-end min-w-0">
            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Salvar Meta</span>
            </button>
          </div>
        </div>
      </form>

      <div className="card p-4 min-w-0">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Acompanhamento das Categorias</h2>
        {budgets.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhum limite cadastrado. Defina acima as suas metas mensais.
          </p>
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => {
              const gasto = spentPerCategory[b.category] || 0;
              const pct = b.limit > 0 ? Math.min((gasto / b.limit) * 100, 100) : 0;
              const isOver = gasto > b.limit;
              const barColor = isOver
                ? 'bg-rose-500'
                : pct > 80
                  ? 'bg-amber-500'
                  : 'bg-blue-500';

              return (
                <div
                  key={b.id}
                  className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 space-y-2 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">{b.category}</span>
                      {isOver && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                          <AlertCircle className="w-3 h-3" />
                          <span>Limite excedido</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="text-xs font-semibold text-slate-300 tabular-nums">
                        {formatCurrency(gasto)}{' '}
                        <span className="text-slate-500 font-normal">
                          / {formatCurrency(b.limit)}
                        </span>
                      </span>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-600 hover:text-rose-400 p-1 transition"
                        title="Excluir meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}