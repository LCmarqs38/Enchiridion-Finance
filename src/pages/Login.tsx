import React, { useState } from 'react';
import { User, Lock, LogIn, UserPlus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface LoginProps {
  onLoginSuccess: () => void;
}

const LOCAL_USERS_KEY = 'pf_registered_users';

interface StoredUser {
  username: string;
  displayName: string;
  password: string;
}

function getLocalUsers(): Record<string, StoredUser> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalUser(user: StoredUser) {
  const users = getLocalUsers();
  users[user.username] = user;
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const rawName = username.trim();
    const normalizedUser = rawName.toLowerCase().replace(/\s+/g, '_');

    if (!normalizedUser || !password.trim()) {
      setError('Preencha o nome de usuário e a senha.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        // 1. Verifica se já existe no Supabase
        if (isSupabaseConfigured && supabase) {
          const { data: existing } = await supabase
            .from('app_users')
            .select('username')
            .eq('username', normalizedUser)
            .maybeSingle();

          if (existing) {
            setError('Este nome de usuário já está em uso. Escolha outro ou faça login.');
            setLoading(false);
            return;
          }

          const { error: insertErr } = await supabase.from('app_users').insert({
            username: normalizedUser,
            display_name: rawName,
            password: password.trim(),
            created_at: Date.now(),
          });

          if (insertErr) {
            setError('Erro ao cadastrar no banco. Tente novamente.');
            setLoading(false);
            return;
          }
        } else {
          const localUsers = getLocalUsers();
          if (localUsers[normalizedUser]) {
            setError('Este nome de usuário já existe neste dispositivo.');
            setLoading(false);
            return;
          }
        }

        saveLocalUser({
          username: normalizedUser,
          displayName: rawName,
          password: password.trim(),
        });

        localStorage.setItem(
          'pf_auth_user',
          JSON.stringify({
            username: normalizedUser,
            name: rawName,
          })
        );
        onLoginSuccess();
        return;
      }

      // MODO LOGIN
      if (isSupabaseConfigured && supabase) {
        const { data: remoteUser } = await supabase
          .from('app_users')
          .select('*')
          .eq('username', normalizedUser)
          .maybeSingle();

        if (remoteUser) {
          if (remoteUser.password !== password.trim()) {
            setError('Senha incorreta.');
            setLoading(false);
            return;
          }

          saveLocalUser({
            username: remoteUser.username,
            displayName: remoteUser.display_name,
            password: remoteUser.password,
          });

          localStorage.setItem(
            'pf_auth_user',
            JSON.stringify({
              username: remoteUser.username,
              name: remoteUser.display_name,
            })
          );
          onLoginSuccess();
          return;
        }
      }

      // Fallback para usuários salvos localmente ou conta admin antiga
      const localUsers = getLocalUsers();
      const foundLocal = localUsers[normalizedUser];

      if (foundLocal && foundLocal.password === password.trim()) {
        localStorage.setItem(
          'pf_auth_user',
          JSON.stringify({
            username: foundLocal.username,
            name: foundLocal.displayName,
          })
        );
        onLoginSuccess();
        return;
      }

      if (normalizedUser === 'admin' && password.trim() === 'admin') {
        localStorage.setItem(
          'pf_auth_user',
          JSON.stringify({
            username: 'admin',
            name: 'Admin',
          })
        );
        onLoginSuccess();
        return;
      }

      setError('Usuário não encontrado ou senha incorreta. Se for seu primeiro acesso, clique em "Criar conta".');
    } catch {
      setError('Erro ao autenticar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] flex items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-[#0C0E14] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Logo & Título */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-2 shadow-md mb-3">
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
          <h1 className="text-xl font-extrabold tracking-wider text-white">ENCHIRIDION</h1>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Entre com seu nome de usuário para sincronizar seus dados'
              : 'Cadastre seu usuário individual'}
          </p>
        </div>

        {/* Alternador Entrar / Criar Conta */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#12161A] border border-slate-800 rounded-xl mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`py-2 rounded-lg transition ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-2 rounded-lg transition ${
              mode === 'register'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome de usuário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: lucas"
                autoComplete="username"
                className="w-full bg-[#12161A] border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-[#12161A] border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg transition"
          >
            {mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Entrando...' : 'Entrar'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Criando usuário...' : 'Cadastrar e Entrar'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}