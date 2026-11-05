import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, Calendar } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import { initialTransactions, Transaction } from '@/data/financeData';
import { formatCurrency } from '@/utils/format';

const CATEGORY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F43F5E', '#64748B'];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Extrai ano e mês (0-indexado) diretamente da string, sem desvio de timezone UTC
function parseDateParts(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;

  // Formato padrão ISO ou YYYY-MM-DD
  if (dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      if (!isNaN(year) && !isNaN(month)) return { year, month };
    }
  }

  // Formato brasileiro DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const year = parseInt(parts[2], 10);
      const month = parseInt(parts[1], 10) - 1;
      if (!isNaN(year) && !isNaN(month)) return { year, month };
    }
  }

  // Fallback caso venha num formato não previsto
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() };
  }

  return null;
}

export default function Dashboard() {
  const [chartTab, setChartTab] = useState<'fluxo' | 'categoria' | 'itens'>('fluxo');

  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return sessionStorage.getItem('dashboard_selected_month') || String(currentMonthIndex);
  });

  const handleMonthChange = (newVal: string) => {
    setSelectedMonth(newVal);
    sessionStorage.setItem('dashboard_selected_month', newVal);
  };
  const currentYear = new Date().getFullYear();

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('pf_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem('pf_transactions');
      if (saved) setTransactions(JSON.parse(saved));
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('finance_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('finance_data_updated', handleUpdate);
    };
  }, []);

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'all') return transactions;
    const targetMonth = parseInt(selectedMonth, 10);
    return transactions.filter((tx) => {
      const parsed = parseDateParts(tx.date);
      if (!parsed) return false;
      return parsed.year === currentYear && parsed.month === targetMonth;
    });
  }, [transactions, selectedMonth, currentYear]);

  const totalEntradas = useMemo(() => {
    return filteredTransactions.filter((t) => t.type === 'entrada').reduce((acc, t) => acc + t.value, 0);
  }, [filteredTransactions]);

  const totalSaidas = useMemo(() => {
    return filteredTransactions.filter((t) => t.type === 'saida').reduce((acc, t) => acc + t.value, 0);
  }, [filteredTransactions]);

  const lucroFinal = totalEntradas - totalSaidas;
  const saldoMes = lucroFinal;

  const dynamicCashFlow = useMemo(() => {
    const monthlyData = MONTH_NAMES.map((month) => ({
      month,
      entradas: 0,
      saidas: 0,
    }));

    transactions.forEach((tx) => {
      const parsed = parseDateParts(tx.date);
      if (parsed && parsed.year === currentYear) {
        if (parsed.month >= 0 && parsed.month < 12) {
          if (tx.type === 'entrada') {
            monthlyData[parsed.month].entradas += tx.value;
          } else if (tx.type === 'saida') {
            monthlyData[parsed.month].saidas += tx.value;
          }
        }
      }
    });

    return monthlyData;
  }, [transactions, currentYear]);

  const categorySpending = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'saida');
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.value;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
  }, [filteredTransactions]);

  const topDescriptions = useMemo(() => {
    const map: Record<string, { total: number; count: number; name: string }> = {};

    filteredTransactions
      .filter((tx) => tx.type === 'saida')
      .forEach((tx) => {
        const key = tx.description.trim().toLowerCase();
        if (!map[key]) {
          map[key] = { total: 0, count: 0, name: tx.description.trim() };
        }
        map[key].total += tx.value;
        map[key].count += 1;
      });

    const list = Object.values(map).sort((a, b) => b.total - a.total);
    const maxVal = list.length > 0 ? list[0].total : 1;

    return {
      items: list.slice(0, 6),
      maxVal,
    };
  }, [filteredTransactions]);

  const getProgressColor = (percent: number) => {
    if (percent >= 80) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-400',
      };
    }
    if (percent >= 50) {
      return {
        bar: 'bg-amber-400',
        text: 'text-amber-300',
      };
    }
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
    };
  };

  const isLucroPositivo = lucroFinal >= 0;

  const formatYAxis = (v: number) => {
    if (v >= 1000) {
      return (v / 1000).toFixed(0) + 'k';
    }
    return String(v);
  };

  const formatTooltipValue = (value: unknown) => {
    return formatCurrency(Number(value));
  };

  const selectedMonthName = selectedMonth === 'all'
    ? 'Ano'
    : (MONTH_NAMES[parseInt(selectedMonth, 10)] || '');

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-white tracking-wide hidden lg:block">INÍCIO</h1>

        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5 self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-blue-400" />
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#12161A] text-white">Ano Completo ({currentYear})</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={String(idx)} className="bg-[#12161A] text-white">
                {m} / {currentYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Saldo Disponível */}
      <div className="card p-4 sm:p-5 bg-gradient-to-br from-blue-900/25 to-[#12161A]">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide">
            {selectedMonth === 'all' ? 'Saldo Acumulado no Ano' : 'Saldo Disponível no Mês'}
          </span>
          <Wallet className="w-4 h-5 text-blue-400" />
        </div>
        <p className="mt-2 text-2xl sm:text-3xl font-bold text-white tabular-nums">{formatCurrency(saldoMes)}</p>
      </div>

      {/* Entradas / Saídas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricCard label="Total de Entradas" value={totalEntradas} variant="positive" icon={ArrowDownCircle} />
        <MetricCard label="Total de Saídas" value={totalSaidas} variant="negative" icon={ArrowUpCircle} />
      </div>

      {/* Lucro Final */}
      <div className={`card p-4 sm:p-5 ${isLucroPositivo ? 'bg-gradient-to-br from-emerald-900/20 to-[#12161A]' : 'bg-gradient-to-br from-rose-900/20 to-[#12161A]'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide">Lucro Final</span>
          <TrendingUp className={`w-5 h-5 ${isLucroPositivo ? 'text-emerald-500' : 'text-rose-500'}`} />
        </div>
        <p className={`mt-2 text-2xl sm:text-3xl font-bold tabular-nums ${isLucroPositivo ? 'text-emerald-500' : 'text-rose-500'}`}>
          {formatCurrency(lucroFinal)}
        </p>
      </div>

      {/* Gráficos e Visualizações */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setChartTab('fluxo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              chartTab === 'fluxo' ? 'bg-blue-700 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            Entradas x Saídas (Ano)
          </button>
          <button
            onClick={() => setChartTab('categoria')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              chartTab === 'categoria' ? 'bg-blue-700 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            Gastos por Categoria ({selectedMonthName})
          </button>
          <button
            onClick={() => setChartTab('itens')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              chartTab === 'itens' ? 'bg-blue-700 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            Maiores Gastos ({selectedMonthName})
          </button>
        </div>

        {chartTab === 'fluxo' && (
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicCashFlow} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatYAxis}
                />
                <Tooltip
                  cursor={{ fill: '#1E293B40' }}
                  contentStyle={{ background: '#12161A', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={formatTooltipValue}
                />
                <Bar dataKey="entradas" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="saidas" name="Saídas" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartTab === 'categoria' && (
          <div className="h-64 sm:h-72 flex flex-col sm:flex-row items-center gap-4">
            {categorySpending.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center w-full">Nenhum gasto registrado neste período.</p>
            ) : (
              <>
                <div className="relative w-full sm:w-1/2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySpending}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        stroke="none"
                        labelLine={false}
                        label={({ percent }: any) =>
                          percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                        }
                      >
                        {categorySpending.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#12161A', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={formatTooltipValue}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2">
                  {categorySpending.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <span className="text-slate-300 truncate">{c.name}</span>
                      </div>
                      <span className="font-semibold text-white">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {chartTab === 'itens' && (
          <div className="h-64 sm:h-72 flex flex-col justify-center">
            {topDescriptions.items.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center w-full">
                Nenhum gasto registrado neste período.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1 overflow-y-auto max-h-64 pr-1">
                {topDescriptions.items.map((item, idx) => {
                  const percentOfMax = Math.round((item.total / topDescriptions.maxVal) * 100);
                  const color = getProgressColor(percentOfMax);

                  return (
                    <div
                      key={idx}
                      className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700/80 transition"
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-slate-300 truncate capitalize" title={item.name}>
                          {item.name}
                        </span>
                        <span className={`text-xs font-semibold ${color.text}`}>
                          {formatCurrency(item.total)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                        <span>{item.count} {item.count === 1 ? 'registro' : 'registros'}</span>
                        <span>{percentOfMax}% do maior</span>
                      </div>

                      <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`${color.bar} h-full rounded-full transition-all duration-300`}
                          style={{ width: `${percentOfMax}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}