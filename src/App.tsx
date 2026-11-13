import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  PlusCircle,
  PiggyBank,
  TrendingUp,
  Clock,
  LogOut,
  RotateCcw,
  Download,
  Upload,
  FileText,
} from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Lancamentos from '@/pages/Lancamentos';
import Orcamento from '@/pages/Orcamento';
import Investimentos from '@/pages/Investimentos';
import AReceber from '@/pages/AReceber';
import Login from '@/pages/Login';
import NavItem from '@/components/NavItem';
import Anotacoes from '@/pages/Anotacoes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  pushPagesToSupabase,
  getCurrentUserNamespace,
  getUserNotesStorageKey,
} from '@/notes/migrationAndStorage';

const PAGES = [
  { id: 'inicio', label: 'Início', icon: Home, component: Dashboard },
  { id: 'lancar', label: 'Lançar', icon: PlusCircle, component: Lancamentos },
  { id: 'orcamento', label: 'Orçamento', icon: PiggyBank, component: Orcamento },
  { id: 'investir', label: 'Investir', icon: TrendingUp, component: Investimentos },
  { id: 'areceber', label: 'A receber', icon: Clock, component: AReceber },
  { id: 'anotacoes', label: 'Notas', icon: FileText, component: Anotacoes },
];

const STORAGE_MAP = {
  transactions: 'pf_transactions',
  budgets: 'pf_budgets',
  receivables: 'pf_receivables',
  categories: 'pf_categories',
  investments: 'pf_investments',
} as const;

const FINANCIAL_KEYS: string[] = Object.values(STORAGE_MAP);
const RESET_KEYS = ['pf_transactions', 'pf_receivables', 'pf_budgets', 'pf_investments'];

const safeParse = (key: string, fallback: any = []) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

// Prepara o espaço isolado do usuário no localStorage (migrando dados antigos do aparelho para o 1º usuário cadastrado nele)
function hydrateActiveUserWorkspace(ns: string) {
  for (const key of FINANCIAL_KEYS) {
    const namespacedKey = `${ns}::${key}`;
    const namespacedTsKey = `${ns}::${key}__updated_at`;
    const userVal = localStorage.getItem(namespacedKey);

    if (userVal !== null) {
      localStorage.setItem(key, userVal);
      const userTs = localStorage.getItem(namespacedTsKey);
      if (userTs) localStorage.setItem(`${key}__updated_at`, userTs);
    } else {
      const legacyOwner = localStorage.getItem('pf_legacy_migrated_owner');
      const currentRaw = localStorage.getItem(key);

      if ((!legacyOwner || legacyOwner === 'admin' || legacyOwner === ns) && currentRaw !== null) {
        localStorage.setItem(namespacedKey, currentRaw);
        const now = String(Date.now());
        localStorage.setItem(namespacedTsKey, now);
        localStorage.setItem(`${key}__updated_at`, now);
      } else {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}__updated_at`);
      }
    }
  }

  const currentOwner = localStorage.getItem('pf_legacy_migrated_owner');
  if (!currentOwner || currentOwner === 'admin') {
    localStorage.setItem('pf_legacy_migrated_owner', ns);
  }
}

async function pushFinancialKeyToSupabase(
  ns: string,
  storageKey: string,
  rawValue: string | null
) {
  if (!isSupabaseConfigured || !supabase || rawValue === null) return;
  try {
    const parsedData = JSON.parse(rawValue);
    const updatedAt = Date.now();
    const cloudKey = `${ns}::${storageKey}`;

    localStorage.setItem(`${storageKey}__updated_at`, String(updatedAt));
    localStorage.setItem(`${ns}::${storageKey}__updated_at`, String(updatedAt));

    await supabase.from('financial_storage').upsert(
      {
        storage_key: cloudKey,
        data: parsedData,
        updated_at: updatedAt,
      },
      { onConflict: 'storage_key' }
    );
  } catch (err) {
    console.error(`Erro ao sincronizar ${storageKey} com Supabase:`, err);
  }
}

export default function App() {
  const [active, setActive] = useState('inicio');
  const [user, setUser] = useState<{ username?: string; email?: string; name: string } | null>(
    () => {
      const u = safeParse('pf_auth_user', null);
      if (u) {
        const ns = (u.username || u.name || u.email || 'default')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');
        hydrateActiveUserWorkspace(ns);
      }
      return u;
    }
  );
  const [cloudRefreshTick, setCloudRefreshTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronização Automática Offline-First Isolada pelo Nome de Usuário
  useEffect(() => {
    if (!user) return;

    const ns = getCurrentUserNamespace();
    const prefix = `${ns}::`;

    let isMounted = true;
    let isApplyingRemote = false;
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

    localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);
      if (!isApplyingRemote && FINANCIAL_KEYS.includes(key)) {
        const now = Date.now();
        originalSetItem(`${ns}::${key}`, value);
        originalSetItem(`${key}__updated_at`, String(now));
        originalSetItem(`${ns}::${key}__updated_at`, String(now));

        if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(() => {
          pushFinancialKeyToSupabase(ns, key, value);
        }, 600);
      }
    };

    const syncAllFinancialData = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data: rows, error } = await supabase
          .from('financial_storage')
          .select('*')
          .like('storage_key', `${prefix}%`);

        if (error) {
          console.error('Erro ao buscar financial_storage:', error.message);
          return;
        }

        const remoteMap = new Map<string, { data: any; updated_at: number }>();
        for (const r of rows || []) {
          const shortKey = r.storage_key.startsWith(prefix)
            ? r.storage_key.slice(prefix.length)
            : r.storage_key;
          remoteMap.set(shortKey, {
            data: r.data,
            updated_at: Number(r.updated_at) || 0,
          });
        }

        let updatedFromCloud = false;
        const toPush: { storage_key: string; data: any; updated_at: number }[] = [];

        for (const key of FINANCIAL_KEYS) {
          const localRaw = localStorage.getItem(key);
          const localUpdatedAt = Number(
            localStorage.getItem(`${ns}::${key}__updated_at`) ||
              localStorage.getItem(`${key}__updated_at`) ||
              '0'
          );
          const remote = remoteMap.get(key);

          if (!remote) {
            if (localRaw !== null) {
              try {
                const parsed = JSON.parse(localRaw);
                const ts = localUpdatedAt || Date.now();
                originalSetItem(`${ns}::${key}`, localRaw);
                originalSetItem(`${key}__updated_at`, String(ts));
                originalSetItem(`${ns}::${key}__updated_at`, String(ts));
                toPush.push({
                  storage_key: `${ns}::${key}`,
                  data: parsed,
                  updated_at: ts,
                });
              } catch {}
            }
          } else {
            const remoteStr = JSON.stringify(remote.data);
            if (localRaw === null || remote.updated_at > localUpdatedAt) {
              isApplyingRemote = true;
              originalSetItem(key, remoteStr);
              originalSetItem(`${ns}::${key}`, remoteStr);
              originalSetItem(`${key}__updated_at`, String(remote.updated_at));
              originalSetItem(`${ns}::${key}__updated_at`, String(remote.updated_at));
              isApplyingRemote = false;
              if (localRaw !== remoteStr) {
                updatedFromCloud = true;
              }
            } else if (localUpdatedAt > remote.updated_at && localRaw !== remoteStr) {
              try {
                toPush.push({
                  storage_key: `${ns}::${key}`,
                  data: JSON.parse(localRaw),
                  updated_at: localUpdatedAt,
                });
              } catch {}
            }
          }
        }

        if (toPush.length > 0) {
          await supabase
            .from('financial_storage')
            .upsert(toPush, { onConflict: 'storage_key' });
        }

        if (updatedFromCloud && isMounted) {
          setCloudRefreshTick((t) => t + 1);
        }
      } catch (err) {
        console.error('Erro na sincronização financeira inicial:', err);
      }
    };

    syncAllFinancialData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAllFinancialData();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      localStorage.setItem = originalSetItem;
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('pf_auth_user');
    setUser(null);
  };

  const handleExportJSON = () => {
    const userNotesKey = getUserNotesStorageKey();
    const data: Record<string, any> = {
      notes: safeParse(userNotesKey, safeParse('enchiridion_notion_pages_v8', null)),
      workspaceTitle: localStorage.getItem('enchiridion_workspace_title') || 'ENCHIRIDION',
    };

    Object.entries(STORAGE_MAP).forEach(([exportKey, storageKey]) => {
      data[exportKey] = safeParse(storageKey, []);
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_financas_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        if (
          !window.confirm(
            'Isto irá substituir todos os seus dados atuais pelo backup. Deseja continuar?'
          )
        ) {
          e.target.value = '';
          return;
        }

        const ns = getCurrentUserNamespace();
        const now = Date.now();
        const cloudPayload: { storage_key: string; data: any; updated_at: number }[] = [];

        Object.entries(STORAGE_MAP).forEach(([exportKey, storageKey]) => {
          if (data[exportKey]) {
            const raw = JSON.stringify(data[exportKey]);
            localStorage.setItem(storageKey, raw);
            localStorage.setItem(`${ns}::${storageKey}`, raw);
            localStorage.setItem(`${storageKey}__updated_at`, String(now));
            localStorage.setItem(`${ns}::${storageKey}__updated_at`, String(now));
            cloudPayload.push({
              storage_key: `${ns}::${storageKey}`,
              data: data[exportKey],
              updated_at: now,
            });
          }
        });

        if (isSupabaseConfigured && supabase && cloudPayload.length > 0) {
          await supabase
            .from('financial_storage')
            .upsert(cloudPayload, { onConflict: 'storage_key' });
        }

        if (data.notes) {
          const userNotesKey = getUserNotesStorageKey();
          localStorage.setItem(userNotesKey, JSON.stringify(data.notes));
          if (Array.isArray(data.notes)) {
            await pushPagesToSupabase(data.notes);
          }
        }
        if (data.workspaceTitle) {
          localStorage.setItem('enchiridion_workspace_title', data.workspaceTitle);
        }

        alert('Backup restaurado com sucesso!');
        window.location.reload();
      } catch {
        alert('Erro ao importar. Certifique-se de que o ficheiro é um backup válido (JSON).');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (
      !window.confirm(
        'Tem a certeza de que deseja apagar todos os lançamentos para começar as suas finanças do zero?'
      )
    )
      return;

    const ns = getCurrentUserNamespace();
    const now = Date.now();
    const resetPayload = RESET_KEYS.map((key) => {
      localStorage.setItem(key, '[]');
      localStorage.setItem(`${ns}::${key}`, '[]');
      localStorage.setItem(`${key}__updated_at`, String(now));
      localStorage.setItem(`${ns}::${key}__updated_at`, String(now));
      return { storage_key: `${ns}::${key}`, data: [], updated_at: now };
    });

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('financial_storage')
        .upsert(resetPayload, { onConflict: 'storage_key' });
    }

    window.location.reload();
  };

  if (!user) {
    return (
      <Login
        onLoginSuccess={() => {
          const loggedUser = safeParse('pf_auth_user', {
            username: 'usuario',
            name: 'Usuário',
          });
          const ns = (loggedUser.username || loggedUser.name || 'default')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
          hydrateActiveUserWorkspace(ns);
          setUser(loggedUser);
        }}
      />
    );
  }

  const ActivePage = PAGES.find((p) => p.id === active)?.component || Dashboard;
  const displayUsername = user.username || user.email || user.name.toLowerCase();

  return (
    <div className="min-h-screen bg-[#090A0F] flex overflow-x-hidden">
      {/* Input único compartilhado para Restaurar Backup (Desktop & Mobile) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportJSON}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-slate-800/60 bg-[#0C0E14] fixed h-screen z-30">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-full h-full text-amber-400"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                className="text-amber-500/30"
                stroke="currentColor"
                strokeDasharray="2 3"
              />
              <line x1="12" y1="4" x2="12" y2="18" className="text-amber-300" strokeWidth="2" />
              <line x1="9.5" y1="8" x2="14.5" y2="8" className="text-amber-400" strokeWidth="2" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-wider text-slate-100">ENCHIRIDION</span>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active === p.id
                  ? 'bg-blue-700/15 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <p.icon className="w-5 h-5" />
              {p.label}
            </button>
          ))}
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-slate-800/60 space-y-1.5">
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 transition"
            title="Exportar base de dados local"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Backup JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 transition"
            title="Restaurar base de dados"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-500" />
            <span>Restaurar Backup</span>
          </button>

          <button
            onClick={handleResetData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800/40 transition"
            title="Zerar Dados"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span>Zerar Dados</span>
          </button>

          <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-800/40">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">@{displayUsername}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 transition p-1.5 rounded-lg hover:bg-slate-800/50"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {/* Top App Bar — Mobile Only */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#090A0F]/95 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-bold text-white tracking-wide uppercase">
            Painel Financeiro
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportJSON}
              className="icon-btn p-2 text-slate-400 hover:text-blue-400"
              title="Backup JSON"
            >
              <Download className="w-4 h-4 text-blue-500" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="icon-btn p-2 text-slate-400 hover:text-emerald-400"
              title="Restaurar Backup"
            >
              <Upload className="w-4 h-4 text-emerald-500" />
            </button>
            <button
              onClick={handleResetData}
              className="icon-btn p-2 text-slate-400 hover:text-amber-400"
              title="Zerar Dados"
            >
              <RotateCcw className="w-4 h-4 text-amber-500" />
            </button>
            <button
              onClick={handleLogout}
              className="icon-btn p-2 text-slate-400 hover:text-rose-400"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-32 lg:pb-8">
          <ActivePage key={`${active}-${cloudRefreshTick}`} />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E1318]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex justify-around items-center">
        {PAGES.map((p) => (
          <NavItem
            key={p.id}
            active={active === p.id}
            label={p.label}
            icon={p.icon}
            onClick={() => setActive(p.id)}
          />
        ))}
      </nav>
    </div>
  );
}