import { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Building2, TrendingUp, Coins, Trash2, Check, X, RefreshCw, PlusCircle } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import { assetTypeColors, assetTypes } from '@/data/financeData';
import { formatCurrency, formatDateLong, todayISO } from '@/utils/format';

interface AssetPosition {
  id: string;
  name: string;
  type: string;
  totalContributed: number;
  currentBalance: number;
  lastUpdated: string;
}

export default function Investimentos() {
  const [assets, setAssets] = useState<AssetPosition[]>(() => {
    const saved = localStorage.getItem('pf_investments');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({
    nome: '',
    tipo: 'Renda Fixa',
    valor: '',
    data: todayISO(),
  });

  const [modalMode, setModalMode] = useState<{ id: string; mode: 'balance' | 'contribute' } | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    localStorage.setItem('pf_investments', JSON.stringify(assets));
  }, [assets]);

  const totalAplicado = useMemo(() => {
    return assets.reduce((sum, item) => sum + (item.totalContributed || 0), 0);
  }, [assets]);

  const patrimonioTotal = useMemo(() => {
    return assets.reduce((sum, item) => sum + (item.currentBalance || 0), 0);
  }, [assets]);

  const rendimentoTotal = patrimonioTotal - totalAplicado;
  const rentabilidadePercentual = totalAplicado > 0 ? (rendimentoTotal / totalAplicado) * 100 : 0;
  
  const lucroLabel = `Lucro / Juros (${rentabilidadePercentual >= 0 ? '+' : ''}${rentabilidadePercentual.toFixed(2)}%)`;

  const donutData = useMemo(() => {
    const map = new Map<string, number>();
    assets.forEach((item) => {
      map.set(item.type, (map.get(item.type) || 0) + (item.currentBalance || 0));
    });
    return Array.from(map.entries()).map(([type, value]) => ({
      name: type,
      value,
      color: assetTypeColors[type] || '#64748B',
    }));
  }, [assets]);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(form.valor);
    if (!form.nome || isNaN(val)) return;

    const newAsset: AssetPosition = {
      id: String(Date.now()),
      name: form.nome,
      type: form.tipo,
      totalContributed: val,
      currentBalance: val,
      lastUpdated: form.data,
    };

    setAssets((prev) => [newAsset, ...prev]);
    setForm({ nome: '', tipo: 'Renda Fixa', valor: '', data: todayISO() });
  };

  const handleApplyModal = (id: string) => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || !modalMode) return;

    setAssets((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (modalMode.mode === 'balance') {
          return {
            ...item,
            currentBalance: val,
            lastUpdated: todayISO(),
          };
        }

        return {
          ...item,
          totalContributed: item.totalContributed + val,
          currentBalance: item.currentBalance + val,
          lastUpdated: todayISO(),
        };
      })
    );

    setModalMode(null);
    setInputValue('');
  };

  const handleDelete = (id: string) => {
    setAssets((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-lg font-semibold text-white tracking-wide">INVESTIMENTOS & RESERVAS</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Património Atual (Corretoras)"
          value={patrimonioTotal}
          variant="accent"
          icon={Building2}
        />
        <MetricCard
          label="Total Aportado (Do seu bolso)"
          value={totalAplicado}
          variant="default"
          icon={Coins}
        />
        <MetricCard
          label={lucroLabel}
          value={rendimentoTotal}
          variant={rendimentoTotal >= 0 ? 'positive' : 'negative'}
          icon={TrendingUp}
        />
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Distribuição do Saldo Atual</h2>
        {assets.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">Nenhum ativo cadastrado.</p>
        ) : (
          <div className="h-48 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    stroke="none"
                    labelLine={false}
                    label={({ percent }: any) =>
                      percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#12161A',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2">
              {donutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="text-slate-300 truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-white">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleAddAsset} className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Adicionar Novo Ativo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label-base">Nome</label>
            <input
              type="text"
              className="input-base"
              placeholder="Ex: Tesouro Selic, CDB 110%"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="label-base">Tipo</label>
            <select
              className="input-base"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              {assetTypes.map((itemType) => (
                <option key={itemType} value={itemType}>
                  {itemType}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-base">Aporte Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input-base"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </div>
          <div>
            <label className="label-base">Data</label>
            <input
              type="date"
              className="input-base"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full sm:w-auto">
          Adicionar Ativo
        </button>
      </form>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Carteira & Posições</h2>
        {assets.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum investimento registado.</p>
        ) : (
          <div className="space-y-3">
            {assets.map((item) => {
              const profit = (item.currentBalance || 0) - (item.totalContributed || 0);
              const profitPct =
                item.totalContributed > 0 ? (profit / item.totalContributed) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="border border-slate-800/60 rounded-xl p-3 bg-slate-900/40 hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${assetTypeColors[item.type] || '#64748B'}20` }}
                      >
                        <TrendingUp
                          className="w-4 h-4"
                          style={{ color: assetTypeColors[item.type] || '#64748B' }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.type} • Posição em {formatDateLong(item.lastUpdated)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 transition"
                      title="Remover Ativo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-[#0E1318] rounded-lg p-2 border border-slate-800/40">
                      <p className="text-[10px] text-slate-500">Total Aportado</p>
                      <p className="text-xs font-semibold text-slate-200">
                        {formatCurrency(item.totalContributed)}
                      </p>
                    </div>
                    <div className="bg-[#0E1318] rounded-lg p-2 border border-slate-800/40">
                      <p className="text-[10px] text-slate-500">Rendimento Total</p>
                      <p
                        className={`text-xs font-semibold ${
                          profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {profit >= 0 ? '+' : ''}
                        {formatCurrency(profit)} ({profitPct.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="bg-[#0E1318] rounded-lg p-2 border border-blue-900/40 bg-blue-950/10">
                      <p className="text-[10px] text-blue-400/70">Saldo na Corretora</p>
                      <p className="text-xs font-bold text-white">
                        {formatCurrency(item.currentBalance)}
                      </p>
                    </div>
                  </div>

                  {modalMode?.id === item.id ? (
                    <div className="flex items-center gap-2 bg-[#0E1318] p-2 rounded-lg border border-blue-800/50">
                      <span className="text-[10px] font-semibold text-blue-400 uppercase w-32 truncate">
                        {modalMode.mode === 'balance' ? 'Novo Saldo Total' : 'Valor do Aporte'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        className="input-base text-xs py-1.5 flex-1"
                        placeholder="R$ 0,00"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleApplyModal(item.id)}
                        className="btn-primary p-1.5 px-3"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setModalMode(null);
                          setInputValue('');
                        }}
                        className="btn-secondary p-1.5 px-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setModalMode({ id: item.id, mode: 'balance' });
                          setInputValue(String(item.currentBalance));
                        }}
                        className="flex-1 btn-primary py-1.5 text-xs flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar Saldo do Extrato
                      </button>
                      <button
                        onClick={() => {
                          setModalMode({ id: item.id, mode: 'contribute' });
                          setInputValue('');
                        }}
                        className="btn-secondary py-1.5 px-3 text-xs text-slate-300 hover:text-white flex items-center justify-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-blue-400" /> Aportar Mais
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}