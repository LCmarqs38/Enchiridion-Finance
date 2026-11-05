import { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (email: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  // Troque a linha do email por esta:
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Verifica se os campos estão preenchidos
    if (!username || !password || (isRegister && !name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // 🔒 Credenciais Fixas
    const USUARIO_MESTRE = "Admin"; // Pode mudar para "Dev", "Lucas", etc.
    const SENHA_MESTRA = "Lucas2026!";

    // Verifica se AMBOS estão corretos
    if (username !== USUARIO_MESTRE || password !== SENHA_MESTRA) {
      setError('Acesso negado. Usuário ou senha incorretos.');
      return;
    }

    // Se passou, liberta o acesso
    const userData = { email: username, name: isRegister ? name : username };
    localStorage.setItem('pf_auth_user', JSON.stringify(userData));
    onLoginSuccess(username);
  };

  return (
    <div className="min-h-screen bg-[#090A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0C0E14] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-blue-950/20">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-2.5 mb-3 shadow-lg shadow-amber-500/5">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-amber-400" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" className="text-amber-500/30" stroke="currentColor" strokeDasharray="2 3" />
              <line x1="12" y1="4" x2="12" y2="18" className="text-amber-300" strokeWidth="2" />
              <line x1="9.5" y1="8" x2="14.5" y2="8" className="text-amber-400" strokeWidth="2" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-wider uppercase">
            ENCHIRIDION
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister ? 'Crie sua conta para gerenciar seus dados' : 'Entre para acessar sua gestão financeira'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="label-base">Nome Completo</label>
              <input
                type="text"
                placeholder="Seu nome"
                className="input-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

<div>
            <label className="label-base">Usuário</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: Admin"
                className="input-base pl-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-base">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                className="input-base pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mt-2">
            <span>{isRegister ? 'Criar Conta' : 'Entrar no Sistema'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/60 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition"
          >
            {isRegister
              ? 'Já tem uma conta? Faça login'
              : 'Não tem conta? Cadastre-se gratuitamente'}
          </button>
        </div>
      </div>
    </div>
  );
}