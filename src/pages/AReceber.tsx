import { useState } from 'react';
import { CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react';
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

  const saveReceivables = (newItems: Receivable[]) => {
    setItems(newItems);
    localStorage.setItem('pf_receivables', JSON.stringify(newItems));
    // Avisa os outros componentes que houve uma alteração
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
      dueDate: form.dueDate,
      client: form.client.trim() || 'Nao especificado',
      status: 'pendente',
    };

    saveReceivables([newItem, ...items]);
    setForm({
      description: '',
      value: '',
      dueDate: todayISO(),
      client: '',
    });
  };

  const handleToggleStatus = (item: Receivable) => {
    const nextStatus: 'pendente' | 'recebido' = item.status === 'pendente' ? 'recebido' : 'pendente';
    
    // Declaramos explicitamente que o array atualizado é do tipo Receivable[]
    const updated: Receivable[] = items.map((i) => 
      i.id === item.id ? { ...i, status: nextStatus } : i
    );
    
    saveReceivables(updated);

    // Cria ou remove automaticamente o lançamento correspondente no extrato
    const savedTx = localStorage.getItem('pf_transactions');
    let txList: Transaction[] = savedTx ? JSON.parse(savedTx) : initialTransactions;

    if (nextStatus === 'recebido') {
      const newTx: Transaction = {
        id: `rec_${item.id}`,
        date: todayISO(),
        type: 'entrada',
        category: 'Servicos / Freelance',
        description: `Recebimento: ${item.description}`,
        value: item.value,
      };
      txList = [newTx, ...txList];
    } else {
      txList = txList.filter((t) => t.id !== `rec_${item.id}`);
    }

    localStorage.setItem('pf_transactions', JSON.stringify(txList));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const handleDelete = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    saveReceivables(updated);

    // Se for apagado, remove também a transação automática gerada (se existir)
    const savedTx = localStorage.getItem('pf_transactions');
    if (savedTx) {
      const txList: Transaction[] = JSON.parse(savedTx);
      const filtered = txList.filter((t) => t.id !== `rec_${id}`);
      localStorage.setItem('pf_transactions', JSON.stringify(filtered));
      window.dispatchEvent(new Event('finance_data_updated'));
    }
  };

  const totalPendente = items.filter((i) => i.status === 'pendente').reduce((s, i) => s + i.value, 0);
  const totalRecebido = items.filter((i) => i.status === 'recebido').reduce((s, i) => s + i.value, 0);

  // Função isolada para evitar erros sintáticos no JSX map
  const renderItem = (item: Receivable) => {
    const isRecebido = item.status === 'recebido';
    
    const btnClass = isRecebido
      ? 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
      : 'w-8 h-8 rounded-lg flex items-center justify-center transition bg-slate-800/60 text-slate-400 hover:text-emerald-400';
      
    const titleClass = isRecebido 
      ? 'text-xs sm:text-sm font-medium line-through text-slate-400' 
      : 'text-xs sm:text-sm font-medium text-white';
      
    const valueClass = isRecebido 
      ? 'text-xs sm:text-sm font-semibold tabular-nums text-emerald-400' 
      : 'text-xs sm:text-sm font-semibold tabular-nums text-white';

    return (
      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:bg-slate-800/40 transition">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleToggleStatus(item)}
            className={btnClass}
            title={isRecebido ? 'Marcar como pendente' : 'Marcar como recebido'}
          >
            <CheckCircle2 className="w-4 h-4"></CheckCircle2>
          </button>
          <div>
            <p className={titleClass}>{item.description}</p>
            <p className="text-[10px] text-slate-500">
              Cliente: {item.client} - {item.dueDate ? `Vencimento: ${formatDateLong(item.dueDate)}` : 'Sem prazo'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={valueClass}>
            {formatCurrency(item.value)}
          </span>
          <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-rose-400 p-1 transition">
            <Trash2 className="w-4 h-4"></Trash2>
          </button>
        </div>
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
            <Clock className="w-4 h-4 text-amber-400"></Clock>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-400 tabular-nums">{formatCurrency(totalPendente)}</p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-emerald-900/20 to-[#12161A]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Recebido</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400"></CheckCircle2>
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
          <Plus className="w-4 h-4"></Plus>
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