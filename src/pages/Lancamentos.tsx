import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Settings2, X, Check, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import {
  initialTransactions,
  Transaction,
  defaultCategories,
} from '@/data/financeData';
import { formatCurrency, formatDateLong, todayISO } from '@/utils/format';

export default function Lancamentos() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('pf_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('pf_categories');
    return saved ? JSON.parse(saved) : defaultCategories;
  });

  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(categories[0] || 'Outros');
  const [data, setData] = useState(todayISO());

  // Estados para o modal de gestão de categorias
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [newCategoryModalInput, setNewCategoryModalInput] = useState('');

  useEffect(() => {
    const handleSync = () => {
      const savedCat = localStorage.getItem('pf_categories');
      if (savedCat) {
        setCategories(JSON.parse(savedCat));
      }
    };
    window.addEventListener('finance_data_updated', handleSync);
    return () => {
      window.removeEventListener('finance_data_updated', handleSync);
    };
  }, []);

  // Funções de categorias
  const updateCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('pf_categories', JSON.stringify(newCats));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryModalInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    updateCategories([...categories, trimmed]);
    setCategoria(trimmed);
    setNewCategoryModalInput('');
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditedCategoryName(cat);
  };

  const handleSaveEditCategory = (oldCat: string) => {
    const trimmed = editedCategoryName.trim();
    if (!trimmed || trimmed === oldCat) {
      setEditingCategory(null);
      return;
    }
    const updated = categories.map((c) => (c === oldCat ? trimmed : c));
    updateCategories(updated);
    if (categoria === oldCat) {
      setCategoria(trimmed);
    }
    setEditingCategory(null);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) {
      alert('Precisa de manter pelo menos uma categoria registada.');
      return;
    }
    if (!window.confirm(`Tem a certeza de que deseja apagar a categoria "${catToDelete}"?`)) return;

    const updated = categories.filter((c) => c !== catToDelete);
    updateCategories(updated);
    if (categoria === catToDelete) {
      setCategoria(updated[0]);
    }
  };

  const saveTransactions = (newTx: Transaction[]) => {
    setTransactions(newTx);
    localStorage.setItem('pf_transactions', JSON.stringify(newTx));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(valor);
    if (!descricao.trim() || isNaN(num) || num <= 0) return;

    const newTx: Transaction = {
      id: String(Date.now()),
      date: data,
      type: tipo,
      category: categoria,
      description: descricao.trim(),
      value: num,
    };

    saveTransactions([newTx, ...transactions]);
    setTipo('saida');
    setDescricao('');
    setValor('');
    setCategoria(categories[0] || 'Outros');
    setData(todayISO());
  };

  const handleDelete = (id: string) => {
    saveTransactions(transactions.filter((t) => t.id !== id));
  };

  const getBtnSaidaClass = () => {
    if (tipo === 'saida') {
      return 'py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border bg-rose-500/20 text-rose-400 border-rose-500/50';
    }
    return 'py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border bg-slate-900/40 text-slate-400 border-slate-800';
  };

  const getBtnEntradaClass = () => {
    if (tipo === 'entrada') {
      return 'py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    }
    return 'py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border bg-slate-900/40 text-slate-400 border-slate-800';
  };

  const renderTransaction = (tx: Transaction) => {
    const isEntradaTx = tx.type === 'entrada';
    const iconContainerClass = isEntradaTx 
      ? 'w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-400' 
      : 'w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/20 text-rose-400';
    
    const valueClass = isEntradaTx
      ? 'text-xs sm:text-sm font-semibold tabular-nums text-emerald-400'
      : 'text-xs sm:text-sm font-semibold tabular-nums text-rose-400';

    const valuePrefix = isEntradaTx ? '+' : '-';

    return (
      <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:bg-slate-800/40 transition">
        <div className="flex items-center gap-3">
          <div className={iconContainerClass}>
            {isEntradaTx ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-white">{tx.description}</p>
            <p className="text-[10px] text-slate-500">{tx.category} • {formatDateLong(tx.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={valueClass}>
            {valuePrefix}{formatCurrency(tx.value)}
          </span>
          <button onClick={() => handleDelete(tx.id)} className="text-slate-600 hover:text-rose-400 p-1 transition" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-lg font-semibold text-white tracking-wide">LANÇAMENTOS</h1>

      <form onSubmit={handleAddTransaction} className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Novo Registo</h2>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTipo('saida')} className={getBtnSaidaClass()}>
            <ArrowUpCircle className="w-4 h-4" />
            <span>Despesa / Saída</span>
          </button>

          <button type="button" onClick={() => setTipo('entrada')} className={getBtnEntradaClass()}>
            <ArrowDownCircle className="w-4 h-4" />
            <span>Receita / Entrada</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="label-base">Descrição</label>
            <input type="text" className="input-base" placeholder="Ex: Almoço, Salário" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div>
            <label className="label-base">Valor (R$)</label>
            <input type="number" step="0.01" className="input-base" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-400 font-medium">Categoria</label>
              <button 
                type="button" 
                onClick={() => setIsCategoryModalOpen(true)} 
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                title="Gerir categorias"
              >
                <Settings2 className="w-3 h-3" />
                <span>Gerir</span>
              </button>
            </div>
            <select className="input-base" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="w-full sm:w-48">
            <label className="label-base">Data</label>
            <input type="date" className="input-base" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto self-end">Adicionar Lançamento</button>
        </div>
      </form>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Extrato Geral</h2>
        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhuma movimentação registada.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(renderTransaction)}
          </div>
        )}
      </div>

      {/* MODAL DE GESTÃO DE CATEGORIAS */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F1318] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Gerir Categorias</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nova categoria..."
                value={newCategoryModalInput}
                onChange={(e) => setNewCategoryModalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                className="input-base text-xs flex-1"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                >
                  {editingCategory === cat ? (
                    <div className="flex items-center gap-1.5 flex-1 mr-2">
                      <input
                        type="text"
                        value={editedCategoryName}
                        onChange={(e) => setEditedCategoryName(e.target.value)}
                        className="input-base text-xs py-1 px-2 w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditCategory(cat)}
                        className="text-emerald-400 hover:text-emerald-300 p-1"
                        title="Guardar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="text-slate-400 hover:text-slate-300 p-1"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-200 font-medium">{cat}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="text-slate-400 hover:text-blue-400 p-1 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-slate-400 hover:text-rose-400 p-1 transition"
                          title="Apagar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 text-right">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}