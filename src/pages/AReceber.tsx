import { useState } from 'react';
import { CheckCircle2, Clock, Plus, Trash2, Edit2, X } from 'lucide-react';
import { initialReceivables, Receivable, Transaction, initialTransactions } from '@/data/financeData';
import { formatCurrency, formatDateLong, todayISO } from '@/utils/format';

export default function AReceber() {
  const [items, setItems] = useState<Receivable[]>(() => {
    const saved = localStorage.getItem('pf_receivables');
    return saved ? JSON.parse(saved) : initialReceivables;
  });

  const [form, setForm] = useState({
    description: '',
    value: '',
    dueDate: todayISO(),
    client: '',
  });

  // Estado para controlar qual item está a receber um pagamento parcial
  const [partialPayment, setPartialPayment] = useState<{ id: string; amount: string } | null>(null);

  const saveReceivables = (newItems: Receivable[]) => {
    setItems(newItems);
    localStorage.setItem('pf_receivables', JSON.stringify(newItems));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const addTransaction = (description: string, val: number, id: string) => {
    const savedTx = localStorage.getItem('pf_transactions');
    const txList: Transaction[] = savedTx ? JSON.parse(savedTx) : initialTransactions;
    
    const newTx: Transaction = {
      id: `rec_${id}_${Date.now()}`,
      date: todayISO(),
      type: 'entrada',
      category: 'Servicos / Freelance',
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
      client: form.client.trim() || 'Nao especificado',
      status: 'pendente',
    };

    saveReceivables([newItem, ...items]);
    setForm({ description: '', value: '', dueDate: todayISO(), client: '' });
  };

  // Liquidação total automática
  const handleToggleStatus = (item: Receivable) => {
    if (item.status === 'recebido') return; // Se já foi recebido, ignorar
    
    const remainingVal = item.value - (item.paidValue || 0);
    
    const updated = items.map((i): Receivable =>
      i.id === item.id ? { ...i, status: 'recebido', paidValue: item.value } : i
    );
    
    saveReceivables(updated);
    addTransaction(`Recebimento (Total): ${item.description}`, remainingVal, item.id);
  };

  // Registo de pagamento parcial
  const handlePartialSubmit = (item: Receivable) => {
    if (!partialPayment || partialPayment.id !== item.id) return;
    
    const amountToPay = parseFloat(partialPayment.amount);
    if (isNaN(amountToPay) || amountToPay <= 0) return;

    const currentPaid = item.paidValue || 0;
    const remaining = item.value - currentPaid;
    
    // Evita pagar mais do que se deve; se for igual, liquida tudo
    const finalPayment = Math.min(amountToPay, remaining);
    const newPaidTotal = currentPaid + finalPayment;
    
    const newStatus: 'recebido' | 'parcial' = newPaidTotal >= item.value ? 'recebido' : 'parcial';

    const updated = items.map((i): Receivable => 
      i.id === item.id ? { ...i, status: newStatus, paidValue: newPaidTotal } : i
    );

    saveReceivables(updated);
    addTransaction(`Recebimento (Parcial): ${item.description}`, finalPayment, item.id);
    setPartialPayment(null); // Fecha o input
  };

  const handleDelete = (id: string) => {
    saveReceivables(items.filter((i) => i.id !== id));
  };

  // Cálculos consolidados para os cartões no topo
  const totalPendente = items.reduce((s, i) => s + (i.value - (i.paidValue || 0)), 0);
  const totalRecebido = items.reduce((s, i) => s + (i.paidValue || 0), 0);

  const renderItem = (item: Receivable) => {
    const paid = item.paidValue || 0;
    const remaining = item.value - paid;
    const isRecebido = item.status === 'recebido';
    const isPartial = item.status === 'parcial';
    
    const btnClass = isRecebido
      ? 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-emerald-500/20 text-emerald-400 cursor-default'
      : 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-slate-800/60 text-slate-400 hover:text-emerald-400';
      
    const titleClass = isRecebido 
      ? 'text-xs sm:text-sm font-medium line-through text-slate-400' 
      : 'text-xs sm:text-sm font-medium text-white';

    const isPayingPartial = partialPayment?.id === item.id;

    return (
      <div key={item.id} className="flex flex-col p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:bg-slate-800/40 transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleToggleStatus(item)}
              className={btnClass}
              title={isRecebido ? 'Pago integralmente' : 'Liquidar Total'}
              disabled={isRecebido}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div>
              <p className={titleClass}>
                {item.description}
                {isPartial && !isRecebido && (
                  <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase">
                    Parcial
                  </span>
                )}
              </p>
              <p className="text-[10px] text-slate-500">
                Cliente: {item.client} &bull; {item.dueDate ? `Venc.: ${formatDateLong(item.dueDate)}` : 'Sem prazo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={`text-xs sm:text-sm font-semibold tabular-nums ${isRecebido ? 'text-emerald-400' : 'text-white'}`}>
                {formatCurrency(remaining)}
              </span>
              {(paid > 0 && !isRecebido) && (
                <p className="text-[10px] text-emerald-400">Pago: {formatCurrency(paid)}</p>
              )}
            </div>
            
            {!isRecebido && (
              <button 
                onClick={() => setPartialPayment(isPayingPartial ? null : { id: item.id, amount: '' })} 
                className="text-slate-500 hover:text-amber-400 p-1 transition"
                title="Abater Valor"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            
            <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-rose-400 p-1 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área expansível para pagamento parcial */}
        {isPayingPartial && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Valor a abater"
              className="input-base text-sm py-1.5 h-auto w-32"
              value={partialPayment.amount}
              onChange={(e) => setPartialPayment({ ...partialPayment, amount: e.target.value })}
              autoFocus
            />
            <button 
              onClick={() => handlePartialSubmit(item)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              Confirmar
            </button>
            <button 
              onClick={() => setPartialPayment(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-lg font-semibold text-white tracking-wide">A RECEBER</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 bg-gradient-to-br from-amber-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Pendente</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 tabular-nums">{formatCurrency(totalPendente)}</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-emerald-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Recebido</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(totalRecebido)}</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Novo Valor a Receber</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="label-base">Descricao</label>
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
        <button type="submit" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" />
          <span>Cadastrar Pendencia</span>
        </button>
      </form>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Lista de Pendencias</h2>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum valor a receber registado.</p>
        ) : (
          <div className="space-y-2">
            {items.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}