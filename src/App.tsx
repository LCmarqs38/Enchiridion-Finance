import { useState, useRef } from 'react';
import { Home, PlusCircle, PiggyBank, TrendingUp, Clock, LogOut, RotateCcw, Download, Upload, FileText } from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Lancamentos from '@/pages/Lancamentos';
import Orcamento from '@/pages/Orcamento';
import Investimentos from '@/pages/Investimentos';
import AReceber from '@/pages/AReceber';
import Login from '@/pages/Login';
import NavItem from '@/components/NavItem';
import Anotacoes from '@/pages/Anotacoes';

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

const RESET_KEYS = ['pf_transactions', 'pf_receivables', 'pf_budgets', 'pf_investments'];

const safeParse = (key: string, fallback: any = []) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [active, setActive] = useState('inicio');
  const [user, setUser] = useState<{ email: string; name: string } | null>(() => safeParse('pf_auth_user', null));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    localStorage.removeItem('pf_auth_user');
    setUser(null);
  };

  const handleExportJSON = () => {
    const data: Record<string, any> = {
      notes: safeParse('enchiridion_notion_pages_v8', null),
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
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        if (!window.confirm('Isto irá substituir todos os seus dados atuais pelo backup. Deseja continuar?')) {
          e.target.value = '';
          return;
        }

        Object.entries(STORAGE_MAP).forEach(([exportKey, storageKey]) => {
          if (data[exportKey]) localStorage.setItem(storageKey, JSON.stringify(data[exportKey]));
        });

        if (data.notes) localStorage.setItem('enchiridion_notion_pages_v8', JSON.stringify(data.notes));
        if (data.workspaceTitle) localStorage.setItem('enchiridion_workspace_title', data.workspaceTitle);

        alert('Backup restaurado com sucesso!');
        window.location.reload();
      } catch {
        alert('Erro ao importar. Certifique-se de que o ficheiro é um backup válido (JSON).');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (!window.confirm('Tem a certeza de que deseja apagar todos os lançamentos para começar as suas finanças do zero?')) return;
    RESET_KEYS.forEach((key) => localStorage.setItem(key, '[]'));
    window.location.reload();
  };

  if (!user) {
    return (
      <Login
        onLoginSuccess={() => setUser(safeParse('pf_auth_user', { email: 'usuario@finance.com', name: 'Usuário' }))}
      />
    );
  }

  const ActivePage = PAGES.find((p) => p.id === active)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-[#090A0F] flex overflow-x-hidden">
      {/* Input único compartilhado para Restaurar Backup (Desktop & Mobile) */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-slate-800/60 bg-[#0C0E14] fixed h-screen z-30">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-md">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-amber-400" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" className="text-amber-500/30" stroke="currentColor" strokeDasharray="2 3" />
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
                active === p.id ? 'bg-blue-700/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
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
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition p-1.5 rounded-lg hover:bg-slate-800/50" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {/* Top App Bar — Mobile Only */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#090A0F]/95 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-bold text-white tracking-wide uppercase">Painel Financeiro</span>
          <div className="flex items-center gap-1">
            <button onClick={handleExportJSON} className="icon-btn p-2 text-slate-400 hover:text-blue-400" title="Backup JSON">
              <Download className="w-4 h-4 text-blue-500" />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="icon-btn p-2 text-slate-400 hover:text-emerald-400" title="Restaurar Backup">
              <Upload className="w-4 h-4 text-emerald-500" />
            </button>
            <button onClick={handleResetData} className="icon-btn p-2 text-slate-400 hover:text-amber-400" title="Zerar Dados">
              <RotateCcw className="w-4 h-4 text-amber-500" />
            </button>
            <button onClick={handleLogout} className="icon-btn p-2 text-slate-400 hover:text-rose-400" title="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-32 lg:pb-8">
          <ActivePage />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E1318]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex justify-around items-center">
        {PAGES.map((p) => (
          <NavItem key={p.id} active={active === p.id} label={p.label} icon={p.icon} onClick={() => setActive(p.id)} />
        ))}
      </nav>
    </div>
  );
}