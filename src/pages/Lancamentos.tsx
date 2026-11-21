import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Settings2,
  X,
  Check,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { initialTransactions, Transaction, defaultCategories } from '@/data/financeData';
import { formatCurrency, formatDateLong, todayISO } from '@/utils/format';

export interface CategorizedLists {
  entrada: string[];
  saida: string[];
}

const DEFAULT_INCOME_CATEGORIES = ['Salário', 'Renda Extra', 'Serviços / Freelance'];
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

function normalizeCategories(raw: unknown): CategorizedLists {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as CategorizedLists).entrada) &&
    Array.isArray((raw as CategorizedLists).saida)
  ) {
    const typed = raw as CategorizedLists;
    return {
      entrada: typed.entrada.length > 0 ? typed.entrada : DEFAULT_INCOME_CATEGORIES,
      saida: typed.saida.length > 0 ? typed.saida : ['Outros'],
    };
  }

  const list = Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    : defaultCategories;

  const entrada = list.filter(isIncomeCategoryName);
  const saida = list.filter((c) => !isIncomeCategoryName(c));

  return {
    entrada: entrada.length > 0 ? entrada : DEFAULT_INCOME_CATEGORIES,
    saida: saida.length > 0 ? saida : ['Outros'],
  };
}

function readTransactions(): Transaction[] {
  try {
    const saved = localStorage.getItem('pf_transactions');
    return saved ? JSON.parse(saved) : initialTransactions;
  } catch {
    return initialTransactions;
  }
}

function readCategories(): CategorizedLists {
  try {
    const saved = localStorage.getItem('pf_categories');
    return normalizeCategories(saved ? JSON.parse(saved) : defaultCategories);
  } catch {
    return normalizeCategories(defaultCategories);
  }
}

export default function Lancamentos() {
  const [transactions, setTransactions] = useState<Transaction[]>(readTransactions);
  const [categories, setCategories] = useState<CategorizedLists>(readCategories);

  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(() => readCategories().saida[0] || 'Outros');
  const [data, setData] = useState(todayISO());

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'saida' | 'entrada'>('saida');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [newCategoryModalInput, setNewCategoryModalInput] = useState('');

  const activeCategoryList = categories[tipo];
  const modalCategoryList = categories[modalTab];

  useEffect(() => {
    const handleSync = () => {
      setTransactions(readTransactions());
      setCategories(readCategories());
    };
    window.addEventListener('finance_data_updated', handleSync);
    return () => window.removeEventListener('finance_data_updated', handleSync);
  }, []);

  useEffect(() => {
    if (!activeCategoryList.includes(categoria)) {
      setCategoria(activeCategoryList[0] || 'Outros');
    }
  }, [tipo, activeCategoryList, categoria]);

  const updateCategories = (next: CategorizedLists) => {
    setCategories(next);
    localStorage.setItem('pf_categories', JSON.stringify(next));
    window.dispatchEvent(new Event('finance_data_updated'));
  };

  const handleOpenCategoryModal = () => {
    setModalTab(tipo);
    setEditingCategory(null);
    setNewCategoryModalInput('');
    setIsCategoryModalOpen(true);
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryModalInput.trim();
    if (!trimmed) return;

    const currentList = categories[modalTab];
    if (currentList.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;

    const next: CategorizedLists = {
      ...categories,
      [modalTab]: [...currentList, trimmed],
    };
    updateCategories(next);
    if (modalTab === tipo) {
      setCategoria(trimmed);
    }
    setNewCategoryModalInput('');
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditedCategoryName(cat);
  };

  const handleSaveEditCategory = (oldCat: string) => {
    const trimmed = editedCategoryName.trim();
    const currentList = categories[modalTab];

    if (
      !trimmed ||
      trimmed === oldCat ||
      currentList.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setEditingCategory(null);
      return;
    }

    const updatedList = currentList.map((c) => (c === oldCat ? trimmed : c));
    updateCategories({ ...categories, [modalTab]: updatedList });

    if (modalTab === tipo && categoria === oldCat) {
      setCategoria(trimmed);
    }
    setEditingCategory(null);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    const currentList = categories[modalTab];
    if (currentList.length <= 1) {
      alert('É necessário manter pelo menos uma categoria cadastrada.');
      return;
    }
    if (!window.confirm(`Tem certeza de que deseja excluir a categoria "${catToDelete}"?`)) return;

    const updatedList = currentList.filter((c) => c !== catToDelete);
    updateCategories({ ...categories, [modalTab]: updatedList });

    if (modalTab === tipo && categoria === catToDelete) {
      setCategoria(updatedList[0]);
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
    setDescricao('');
    setValor('');
    setData(todayISO());
  };

  const handleDelete = (id: string) => {
    saveTransactions(transactions.filter((t) => t.id !== id));
  };

  const renderTransaction = (tx: Transaction) => {
    const isEntradaTx = tx.type === 'entrada';
    const iconContainerClass = isEntradaTx
      ? 'w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-400 shrink-0'
      : 'w-8 h-8 rounded-lg flex items-center justify-center bg-rose-500/20 text-rose-400 shrink-0';

    const valueClass = isEntradaTx
      ? 'text-xs sm:text-sm font-semibold tabular-nums text-emerald-400'
      : 'text-xs sm:text-sm font-semibold tabular-nums text-rose-400';

    return (
      <div
        key={tx.id}
        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:bg-slate-800/40 transition min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={iconContainerClass}>
            {isEntradaTx ? (
              <ArrowDownCircle className="w-4 h-4" />
            ) : (
              <ArrowUpCircle className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-white truncate">{tx.description}</p>
            <p className="text-[10px] text-slate-500 truncate">
              {tx.category} • {formatDateLong(tx.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className={valueClass}>
            {isEntradaTx ? '+' : '-'}
            {formatCurrency(tx.value)}
          </span>
          <button
            onClick={() => handleDelete(tx.id)}
            className="text-slate-600 hover:text-rose-400 p-1 transition"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 fade-in min-w-0 w-full">
      <h1 className="text-lg font-semibold text-white tracking-wide">LANÇAMENTOS</h1>

      <form onSubmit={handleAddTransaction} className="card p-4 space-y-4 min-w-0">
        <h2 className="text-sm font-semibold text-slate-200">Novo Registro</h2>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipo('saida')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition min-w-0 ${
              tipo === 'saida'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Despesa / Saída</span>
          </button>

          <button
            type="button"
            onClick={() => setTipo('entrada')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition min-w-0 ${
              tipo === 'entrada'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Receita / Entrada</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2 min-w-0">
            <label className="label-base">Descrição</label>
            <input
              type="text"
              className="input-base"
              placeholder={tipo === 'saida' ? 'Ex: Almoço, Internet' : 'Ex: Salário, Freelance'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="min-w-0">
            <label className="label-base">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input-base"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="min-w-0">
            <div className="flex justify-between items-center gap-2 mb-1">
              <label className="text-xs text-slate-400 font-medium truncate">Categoria</label>
              <button
                type="button"
                onClick={handleOpenCategoryModal}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition shrink-0"
                title="Gerenciar categorias"
              >
                <Settings2 className="w-3 h-3 shrink-0" />
                <span>Gerenciar</span>
              </button>
            </div>
            <select
              className="input-base"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {activeCategoryList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="w-full sm:w-48 min-w-0">
            <label className="label-base">Data</label>
            <input
              type="date"
              className="input-base"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto sm:self-end">
            Adicionar Lançamento
          </button>
        </div>
      </form>

      <div className="card p-4 min-w-0">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Extrato Geral</h2>
        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            Nenhuma movimentação registrada.
          </p>
        ) : (
          <div className="space-y-2">{transactions.map(renderTransaction)}</div>
        )}
      </div>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F1318] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Gerenciar Categorias</h3>
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

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalTab('saida');
                  setEditingCategory(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition ${
                  modalTab === 'saida'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Despesas
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('entrada');
                  setEditingCategory(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-medium transition ${
                  modalTab === 'entrada'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Receitas
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  modalTab === 'saida' ? 'Nova categoria de despesa...' : 'Nova categoria de receita...'
                }
                value={newCategoryModalInput}
                onChange={(e) => setNewCategoryModalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                className="input-base text-xs flex-1"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {modalCategoryList.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                >
                  {editingCategory === cat ? (
                    <div className="flex items-center gap-1.5 flex-1 mr-2 min-w-0">
                      <input
                        type="text"
                        value={editedCategoryName}
                        onChange={(e) => setEditedCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEditCategory(cat);
                          } else if (e.key === 'Escape') {
                            setEditingCategory(null);
                          }
                        }}
                        className="input-base text-xs py-1 px-2 w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditCategory(cat)}
                        className="text-emerald-400 hover:text-emerald-300 p-1 shrink-0"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="text-slate-400 hover:text-slate-300 p-1 shrink-0"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-200 font-medium truncate pr-2">{cat}</span>
                      <div className="flex items-center gap-1 shrink-0">
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
                          title="Excluir"
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