'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('Credenciais inválidas. Verifique seu email e senha.');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#f8f9ff] to-[#e6edfa] dark:from-[#0f1419] dark:to-[#162032]">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#006c49] to-[#10b981] text-white shadow-lg mb-4">
            <Icon name="account_balance" size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Luminous</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Gestão Financeira Familiar</p>
        </div>

        <GlassCard elevated className="w-full">
          <form onSubmit={handleLogin} className="space-y-5">
            <h2 className="text-xl font-semibold mb-6">Acesse sua conta</h2>
            
            {error && (
              <div className="p-3 bg-[#ba1a1a]/10 dark:bg-[#ffb4ab]/20 text-[#ba1a1a] dark:text-[#ffb4ab] rounded-xl text-sm flex items-center gap-2">
                <Icon name="error" size="sm" />
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              prefix="mail"
            />
            
            <div className="space-y-1">
              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                prefix="lock"
                showPasswordToggle
              />
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-[#0058be] dark:text-[#adc6ff] hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Entrar
            </Button>
            
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Não tem conta?{' '}
                <Link href="/signup" className="text-[#006c49] dark:text-[#4edea3] font-semibold hover:underline">
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
