import { useState } from 'react';
import { Home, PlusCircle, PiggyBank, TrendingUp, Clock, LogOut, RotateCcw, Download, Upload } from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import Lancamentos from '@/pages/Lancamentos';
import Orcamento from '@/pages/Orcamento';
import Investimentos from '@/pages/Investimentos';
import AReceber from '@/pages/AReceber';
import Login from '@/pages/Login';
import NavItem from '@/components/NavItem';
import Anotacoes from '@/pages/Anotacoes';
import { FileText } from 'lucide-react';

  const pages = [
    { id: 'inicio', label: 'Início', icon: Home, component: Dashboard },
    { id: 'lancar', label: 'Lançar', icon: PlusCircle, component: Lancamentos },
    { id: 'orcamento', label: 'Orçamento', icon: PiggyBank, component: Orcamento },
    { id: 'investir', label: 'Investir', icon: TrendingUp, component: Investimentos },
    { id: 'areceber', label: 'A receber', icon: Clock, component: AReceber },
    { id: 'anotacoes', label: 'Notas', icon: FileText, component: Anotacoes },
  ];

export default function App() {
  const [active, setActive] = useState('inicio');

  const [user, setUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem('pf_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('pf_auth_user');
    setUser(null);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        const confirmImport = window.confirm(
          'Isto irá substituir todos os seus dados atuais pelo backup. Deseja continuar?'
        );
        
        if (!confirmImport) {
          e.target.value = '';
          return;
        }

        if (data.transactions) localStorage.setItem('pf_transactions', JSON.stringify(data.transactions));
        if (data.budgets) localStorage.setItem('pf_budgets', JSON.stringify(data.budgets));
        if (data.receivables) localStorage.setItem('pf_receivables', JSON.stringify(data.receivables));
        if (data.categories) localStorage.setItem('pf_categories', JSON.stringify(data.categories));
        if (data.investments) localStorage.setItem('pf_investments', JSON.stringify(data.investments));

        alert('Backup restaurado com sucesso!');
        window.location.reload(); 
      } catch (error) {
        alert('Erro ao importar. Certifique-se de que o ficheiro é um backup válido (JSON).');
      }
      
      e.target.value = ''; 
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const data = {
      transactions: JSON.parse(localStorage.getItem('pf_transactions') || '[]'),
      budgets: JSON.parse(localStorage.getItem('pf_budgets') || '[]'),
      receivables: JSON.parse(localStorage.getItem('pf_receivables') || '[]'),
      categories: JSON.parse(localStorage.getItem('pf_categories') || '[]'),
      investments: JSON.parse(localStorage.getItem('pf_investments') || '[]'),
    };
    
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

  const handleResetData = () => {
    const confirmReset = window.confirm(
      'Tem a certeza de que deseja apagar todos os lançamentos para começar as suas finanças do zero?'
    );
    if (!confirmReset) return;

    localStorage.setItem('pf_transactions', JSON.stringify([]));
    localStorage.setItem('pf_receivables', JSON.stringify([]));
    localStorage.setItem('pf_budgets', JSON.stringify([]));
    localStorage.setItem('pf_investments', JSON.stringify([]));

    window.location.reload();
  };

  if (!user) {
    return (
      <Login
        onLoginSuccess={() => {
          const saved = localStorage.getItem('pf_auth_user');
          setUser(saved ? JSON.parse(saved) : { email: 'usuario@finance.com', name: 'Usuário' });
        }}
      />
    );
  }

  const ActivePage = pages.find((p) => p.id === active)!.component;

  return (
    <div className="min-h-screen bg-[#090A0F] flex overflow-x-hidden">
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
          <span className="font-bold text-sm tracking-wider text-slate-100">
            ENCHIRIDION
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1">
          {pages.map((p) => (
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
        <div className="p-3 border-t border-slate-800/60 space-y-2">
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 transition mb-1"
            title="Exportar base de dados local"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Backup JSON</span>
          </button>
          
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 transition mb-1 cursor-pointer" title="Restaurar base de dados">
            <Upload className="w-3.5 h-3.5 text-emerald-500" />
            <span>Restaurar Backup</span>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleImportJSON} 
            />
          </label>
          
          <button
            onClick={handleResetData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800/40 transition"
            title="Zerar Dados"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
            <span>Zerar Dados</span>
          </button>

          <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-800/40">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
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
        {/* Top App Bar — mobile only */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#090A0F]/95 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between">
          <span className="text-sm font-bold text-white tracking-wide uppercase">Painel Financeiro</span>
          <div className="flex items-center gap-1">
            
            {/* Ícone de Restaurar Backup (Mobile) */}
            <label className="icon-btn p-2 text-slate-400 hover:text-emerald-400 cursor-pointer" title="Restaurar Backup">
              <Upload className="w-4 h-4 text-emerald-500" />
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleImportJSON} 
              />
            </label>

            <button
              onClick={handleResetData}
              className="icon-btn p-2 text-slate-400 hover:text-amber-400"
              title="Zerar Dados"
            >
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
        {pages.map((p) => (
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