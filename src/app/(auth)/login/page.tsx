'use client';
import { useState } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const finalEmail = (email || String(formData.get('email') || '')).trim();
    const finalPassword = password || String(formData.get('password') || '');

    if (!finalEmail || !finalPassword) {
      setError('Preencha seu email e senha para continuar.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: finalPassword,
      });

      if (error) {
        console.error('[Login] Supabase auth error:', error);
        const msg =
          error.message === 'Invalid login credentials'
            ? 'Credenciais inválidas. Verifique seu email e senha.'
            : error.message === 'Email not confirmed'
            ? 'Seu email ainda não foi confirmado. Verifique sua caixa de entrada.'
            : `Erro ao entrar: ${error.message}`;
        setError(msg);
        setLoading(false);
      } else {
        // Hard navigation ensures freshly set Supabase session cookies are sent to middleware/proxy
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      console.error('[Login] Unexpected error:', err);
      setError(`Não foi possível conectar ao servidor de autenticação${err?.message ? ` (${err.message})` : ''}. Tente novamente.`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#E8E7E3] dark:bg-gradient-to-br dark:from-[#0f1419] dark:to-[#162032]">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2D5346] dark:bg-gradient-to-tr dark:from-[#006c49] dark:to-[#10b981] text-[#C6E379] dark:text-white shadow-lg shadow-[#2D5346]/20 mb-4">
            <Icon name="account_balance" size="lg" />
          </div>
          <h1 className="text-3xl font-semibold text-[#1B221E] dark:text-white tracking-tight">Luminous</h1>
          <p className="text-[#5F6963] dark:text-gray-400 mt-2">Gestão Financeira Familiar</p>
        </div>

        <GlassCard elevated className="w-full">
          <form onSubmit={handleLogin} className="space-y-5">
            <h2 className="text-xl font-medium text-[#1B221E] dark:text-white mb-6">Acesse sua conta</h2>
            
            {error && (
              <div className="p-3 bg-[#F4E6E2] dark:bg-[#ffb4ab]/20 text-[#B84A39] dark:text-[#ffb4ab] rounded-xl text-sm flex items-center gap-2">
                <Icon name="error" size="sm" />
                {error}
              </div>
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              prefix="mail"
            />
            
            <div className="space-y-1">
              <Input
                label="Senha"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                prefix="lock"
                showPasswordToggle
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-[#2D5346] dark:text-[#adc6ff] hover:underline font-medium">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Entrar
            </Button>
            
            <div className="text-center mt-6">
              <p className="text-sm text-[#5F6963] dark:text-gray-400">
                Não tem conta?{' '}
                <Link href="/signup" className="text-[#2D5346] dark:text-[#4edea3] font-semibold hover:underline">
                  Cadastre-se
                </Link>
              </p>
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
