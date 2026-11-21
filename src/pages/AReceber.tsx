import { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Edit2, X } from 'lucide-react';
import { initialReceivables, Receivable, Transaction, initialTransactions } from '@/data/financeData';
import { formatCurrency, formatDateLong, todayISO } from '@/utils/format';

interface ManageState {
  id: string;
  mode: 'abater' | 'editar';
  abateAmount: string;
  addAmount: string;
  description: string;
  client: string;
  totalValue: string;
  dueDate: string;
}

const safeReadStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

export default function AReceber() {
  const [items, setItems] = useState<Receivable[]>(() =>
    safeReadStorage<Receivable[]>('pf_receivables', initialReceivables)
  );

  const [form, setForm] = useState({
    description: '',
    value: '',
    dueDate: todayISO(),
    client: '',
  });

  const [manage, setManage] = useState<ManageState | null>(null);
  const today = todayISO();

  const saveReceivables = (newItems: Receivable[]) => {
    setItems(newItems);
    localStorage.setItem('pf_receivables', JSON.stringify(newItems));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const addTransaction = (description: string, val: number, id: string) => {
    if (val <= 0) return;
    const txList = safeReadStorage<Transaction[]>('pf_transactions', initialTransactions);

    const newTx: Transaction = {
      id: `rec_${id}_${Date.now()}`,
      date: todayISO(),
      type: 'entrada',
      category: 'Serviços / Freelance',
      description,
      value: val,
    };

    localStorage.setItem('pf_transactions', JSON.stringify([newTx, ...txList]));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(form.value);
    if (!form.description.trim() || isNaN(val) || val <= 0) return;

    const newItem: Receivable = {
      id: String(Date.now()),
      description: form.description.trim(),
      value: val,
      paidValue: 0,
      dueDate: form.dueDate,
      client: form.client.trim() || 'Não especificado',
      status: 'pendente',
    };

    saveReceivables([newItem, ...items]);
    setForm({ description: '', value: '', dueDate: todayISO(), client: '' });
  };

  const handleToggleStatus = (item: Receivable) => {
    if (item.status === 'recebido') return;

    const remainingVal = Math.max(0, item.value - (item.paidValue || 0));
    const updated = items.map((i): Receivable =>
      i.id === item.id ? { ...i, status: 'recebido', paidValue: item.value } : i
    );

    saveReceivables(updated);
    addTransaction(`Recebimento (Total): ${item.description}`, remainingVal, item.id);
    if (manage?.id === item.id) setManage(null);
  };

  const openManagePanel = (item: Receivable) => {
    if (manage?.id === item.id) {
      setManage(null);
      return;
    }
    setManage({
      id: item.id,
      mode: 'abater',
      abateAmount: '',
      addAmount: '',
      description: item.description,
      client: item.client,
      totalValue: String(item.value),
      dueDate: item.dueDate || '',
    });
  };

  const handlePartialSubmit = (item: Receivable) => {
    if (!manage || manage.id !== item.id) return;

    const amountToPay = parseFloat(manage.abateAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) return;

    const currentPaid = item.paidValue || 0;
    const remaining = Math.max(0, item.value - currentPaid);
    const finalPayment = Math.min(amountToPay, remaining);
    if (finalPayment <= 0) return;

    const newPaidTotal = currentPaid + finalPayment;
    const newStatus: 'recebido' | 'parcial' = newPaidTotal >= item.value ? 'recebido' : 'parcial';

    const updated = items.map((i): Receivable =>
      i.id === item.id ? { ...i, status: newStatus, paidValue: newPaidTotal } : i
    );

    saveReceivables(updated);
    addTransaction(`Recebimento (Parcial): ${item.description}`, finalPayment, item.id);
    setManage(null);
  };

  const handleAddDebtAmount = (item: Receivable) => {
    if (!manage || manage.id !== item.id) return;

    const extra = parseFloat(manage.addAmount);
    if (isNaN(extra) || extra <= 0) return;

    const newTotal = Number((item.value + extra).toFixed(2));
    const currentPaid = item.paidValue || 0;
    const newStatus: 'pendente' | 'parcial' = currentPaid > 0 ? 'parcial' : 'pendente';

    const updated = items.map((i): Receivable =>
      i.id === item.id ? { ...i, value: newTotal, status: newStatus } : i
    );

    saveReceivables(updated);
    setManage(null);
  };

  const handleEditDetailsSubmit = (item: Receivable) => {
    if (!manage || manage.id !== item.id) return;

    const newTotal = parseFloat(manage.totalValue);
    if (!manage.description.trim() || isNaN(newTotal) || newTotal <= 0) return;

    const currentPaid = item.paidValue || 0;
    const clampedPaid = Math.min(currentPaid, newTotal);
    const newStatus: 'pendente' | 'parcial' | 'recebido' =
      clampedPaid >= newTotal ? 'recebido' : clampedPaid > 0 ? 'parcial' : 'pendente';

    const updated = items.map((i): Receivable =>
      i.id === item.id
        ? {
            ...i,
            description: manage.description.trim(),
            client: manage.client.trim() || 'Não especificado',
            value: newTotal,
            paidValue: clampedPaid,
            dueDate: manage.dueDate,
            status: newStatus,
          }
        : i
    );

    saveReceivables(updated);
    setManage(null);
  };

  const handleDelete = (id: string) => {
    saveReceivables(items.filter((i) => i.id !== id));
    if (manage?.id === id) setManage(null);
  };

  const totalPendente = items.reduce((s, i) => s + Math.max(0, i.value - (i.paidValue || 0)), 0);
  const totalRecebido = items.reduce((s, i) => s + (i.paidValue || 0), 0);
  const totalVencido = items.reduce((s, i) => {
    const overdue = i.status !== 'recebido' && Boolean(i.dueDate) && i.dueDate < today;
    return overdue ? s + Math.max(0, i.value - (i.paidValue || 0)) : s;
  }, 0);

  const renderItem = (item: Receivable) => {
    const paid = item.paidValue || 0;
    const remaining = Math.max(0, item.value - paid);
    const isRecebido = item.status === 'recebido';
    const isPartial = item.status === 'parcial';
    const isOverdue = !isRecebido && Boolean(item.dueDate) && item.dueDate < today;
    const isManaging = manage?.id === item.id;

    const btnClass = isRecebido
      ? 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-emerald-500/20 text-emerald-400 cursor-default shrink-0'
      : 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-slate-800/60 text-slate-400 hover:text-emerald-400 shrink-0';

    const titleClass = isRecebido
      ? 'text-xs sm:text-sm font-medium line-through text-slate-400'
      : 'text-xs sm:text-sm font-medium text-white';

    return (
      <div
        key={item.id}
        className={`flex flex-col p-3 rounded-xl bg-slate-900/40 border transition ${
          isOverdue
            ? 'border-rose-500/30 hover:bg-slate-800/40'
            : 'border-slate-800/60 hover:bg-slate-800/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => handleToggleStatus(item)}
              className={btnClass}
              title={isRecebido ? 'Pago integralmente' : 'Liquidar Total'}
              disabled={isRecebido}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <p className={titleClass}>{item.description}</p>
                {isPartial && !isRecebido && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase font-medium">
                    Parcial
                  </span>
                )}
                {isOverdue && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 uppercase font-medium">
                    Vencido
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                Cliente: {item.client} •{' '}
                {item.dueDate ? `Venc.: ${formatDateLong(item.dueDate)}` : 'Sem prazo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <span
                className={`text-xs sm:text-sm font-semibold tabular-nums ${
                  isRecebido ? 'text-emerald-400' : isOverdue ? 'text-rose-400' : 'text-white'
                }`}
              >
                {formatCurrency(remaining)}
              </span>
              {paid > 0 && !isRecebido && (
                <p className="text-[10px] text-emerald-400">Pago: {formatCurrency(paid)}</p>
              )}
            </div>

            {!isRecebido && (
              <button
                onClick={() => openManagePanel(item)}
                className={`p-1 transition ${
                  isManaging ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
                }`}
                title="Gerenciar dívida"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => handleDelete(item.id)}
              className="text-slate-600 hover:text-rose-400 p-1 transition"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isManaging && manage && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setManage({ ...manage, mode: 'abater' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    manage.mode === 'abater'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Abater (-)
                </button>
                <button
                  type="button"
                  onClick={() => setManage({ ...manage, mode: 'editar' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    manage.mode === 'editar'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Acrescentar / Editar
                </button>
              </div>

              <button
                type="button"
                onClick={() => setManage(null)}
                className="text-slate-400 hover:text-white p-1"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {manage.mode === 'abater' ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor recebido (R$)"
                  className="input-base text-sm py-1.5 h-auto w-44"
                  value={manage.abateAmount}
                  onChange={(e) => setManage({ ...manage, abateAmount: e.target.value })}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handlePartialSubmit(item)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition"
                >
                  Confirmar Abatimento
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60">
                  <span className="text-xs text-slate-400">Somar acréscimo à dívida:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="+ Valor (R$)"
                    className="input-base text-sm py-1.5 h-auto w-36"
                    value={manage.addAmount}
                    onChange={(e) => setManage({ ...manage, addAmount: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddDebtAmount(item)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    + Somar na Dívida
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <label className="label-base">Descrição</label>
                    <input
                      type="text"
                      className="input-base text-xs py-1.5 h-auto"
                      value={manage.description}
                      onChange={(e) => setManage({ ...manage, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-base">Cliente</label>
                    <input
                      type="text"
                      className="input-base text-xs py-1.5 h-auto"
                      value={manage.client}
                      onChange={(e) => setManage({ ...manage, client: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-base">Valor Total (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-base text-xs py-1.5 h-auto"
                      value={manage.totalValue}
                      onChange={(e) => setManage({ ...manage, totalValue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label-base">Vencimento</label>
                    <input
                      type="date"
                      className="input-base text-xs py-1.5 h-auto"
                      value={manage.dueDate}
                      onChange={(e) => setManage({ ...manage, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleEditDetailsSubmit(item)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-lg font-semibold text-white tracking-wide">A RECEBER</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-gradient-to-br from-amber-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Pendente</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 tabular-nums">
            {formatCurrency(totalPendente)}
          </p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-rose-900/25 to-[#12161A] border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Vencidos</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400 tabular-nums">
            {formatCurrency(totalVencido)}
          </p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-emerald-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Recebido</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">
            {formatCurrency(totalRecebido)}
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Novo Valor a Receber</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="label-base">Descrição</label>
            <input
              type="text"
              className="input-base"
              placeholder="Ex: Projeto Freelance"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label-base">Cliente / Origem</label>
            <input
              type="text"
              className="input-base"
              placeholder="Ex: Empresa X"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
            />
          </div>
          <div>
            <label className="label-base">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input-base"
              placeholder="0,00"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div>
            <label className="label-base">Vencimento</label>
            <input
              type="date"
              className="input-base"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Pendência</span>
        </button>
      </form>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Lista de Pendências</h2>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhum valor a receber registrado.
          </p>
        ) : (
          <div className="space-y-2">{items.map(renderItem)}</div>
        )}
      </div>
    </div>
  );
}