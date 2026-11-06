import { useState, useEffect, useMemo } from 'react';
import { Target, TrendingDown, CheckCircle2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Budget, Transaction, initialTransactions, defaultCategories } from '@/data/financeData';
import { formatCurrency } from '@/utils/format';

export default function Orcamento() {
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('pf_budgets');
    return saved ? JSON.parse(saved) : [];
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('pf_categories');
    return saved ? JSON.parse(saved) : defaultCategories;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('pf_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [formCategory, setFormCategory] = useState(categories[0] || 'Outros');
  const [formLimit, setFormLimit] = useState('');

  useEffect(() => {
    const syncData = () => {
      const savedBud = localStorage.getItem('pf_budgets');
      if (savedBud) setBudgets(JSON.parse(savedBud));
      
      const savedCat = localStorage.getItem('pf_categories');
      if (savedCat) setCategories(JSON.parse(savedCat));
      
      const savedTx = localStorage.getItem('pf_transactions');
      if (savedTx) setTransactions(JSON.parse(savedTx));
    };

    window.addEventListener('storage', syncData);
    window.addEventListener('finance_data_updated', syncData);
    return () => {
      window.removeEventListener('storage', syncData);
      window.removeEventListener('finance_data_updated', syncData);
    };
  }, []);

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
      if (tx.type !== 'saida') return;
  
      // Quebra a string "YYYY-MM-DD" e cria a data forçando o fuso local
      const [year, month, day] = tx.date.split('-');
      const txDate = new Date(Number(year), Number(month) - 1, Number(day));
  
      if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
        spending[tx.category] = (spending[tx.category] || 0) + tx.value;
      }
    });
    return spending;
  }, [transactions]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(formLimit);
    if (!formCategory || isNaN(limitNum) || limitNum <= 0) return;

    const existingIndex = budgets.findIndex((b) => b.category === formCategory);
    let updated: Budget[];

    if (existingIndex >= 0) {
      updated = budgets.map((b) => (b.category === formCategory ? { ...b, limit: limitNum } : b));
    } else {
      updated = [
        ...budgets,
        {
          id: String(Date.now()),
          category: formCategory,
          limit: limitNum,
          spent: 0,
        },
      ];
    }

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

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-lg font-semibold text-white tracking-wide">ORCAMENTO MENSAL</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-gradient-to-br from-blue-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Limite Total</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-400 tabular-nums">{formatCurrency(totalLimite)}</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-rose-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Gasto no Mes</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400 tabular-nums">{formatCurrency(totalGasto)}</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-emerald-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Disponivel</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(totalDisponivel)}</p>
        </div>
      </div>

      <form onSubmit={handleSaveBudget} className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Definir Limite por Categoria</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label-base">Categoria</label>
            <select
              className="input-base"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
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
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Salvar Meta</span>
            </button>
          </div>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Acompanhamento das Categorias</h2>
        {budgets.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum limite cadastrado. Defina acima as suas metas mensais.</p>
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => {
              const gasto = spentPerCategory[b.category] || 0;
              const pct = b.limit > 0 ? Math.min((gasto / b.limit) * 100, 100) : 0;
              const isOver = gasto > b.limit;

              let barColor = 'bg-blue-500';
              if (isOver) {
                barColor = 'bg-rose-500';
              } else if (pct > 80) {
                barColor = 'bg-amber-500';
              }

              const progressClass = "h-full transition-all duration-300 " + barColor;
              const progressStyle = { width: String(pct) + '%' };

              return (
                <div key={b.id} className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{b.category}</span>
                      {isOver ? (
                        <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <AlertCircle className="w-3 h-3" />
                          <span>Limite excedido</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-300">
                        {formatCurrency(gasto)} <span className="text-slate-500 font-normal">/ {formatCurrency(b.limit)}</span>
                      </span>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-slate-600 hover:text-rose-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={progressClass} style={progressStyle} />
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