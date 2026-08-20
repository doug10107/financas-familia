'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';

function SignupForm() {
  const searchParams = useSearchParams();
  const initialInvite = searchParams.get('invite') || '';

  const [mode, setMode] = useState<'create' | 'join'>(initialInvite ? 'join' : 'create');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    familyName: '',
    inviteCode: initialInvite
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (initialInvite) {
      setMode('join');
      setFormData(prev => ({ ...prev, inviteCode: initialInvite }));
    }
  }, [initialInvite]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.name === 'inviteCode' ? e.target.value.toUpperCase() : e.target.value;
    setFormData({ ...formData, [e.target.name]: val });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    if (mode === 'join' && !formData.inviteCode.trim()) {
      setError('Por favor, informe o Código de Convite da Família.');
      setLoading(false);
      return;
    }
    
    try {
      const supabase = createClient();
      const metadata: Record<string, any> = {
        full_name: formData.name,
      };

      if (mode === 'create') {
        metadata.family_name = formData.familyName || `Família de ${formData.name}`;
      } else {
        metadata.invite_code = formData.inviteCode.trim().toUpperCase();
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: metadata
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        if (!data.session) {
          setError('Cadastro realizado! Por favor, verifique seu email para confirmar a conta.');
          setLoading(false);
          return;
        }

        // Se entrou por código e já temos sessão, garantir o vínculo via RPC como segurança extra
        if (mode === 'join' && formData.inviteCode.trim()) {
          try {
            await (supabase.rpc as any)('join_family_by_code', {
              p_invite_code: formData.inviteCode.trim().toUpperCase()
            });
          } catch {
            // Se falhar o RPC, o trigger do auth.users cuidará
          }
        }

        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-slide-up">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar Nova Conta</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie suas finanças em família</p>
      </div>

      <GlassCard elevated className="w-full">
        {/* Seletor de Modo: Nova Família vs Entrar em Família Existente */}
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'create'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            <Icon name="add_circle" size="sm" />
            Criar Nova Família
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'join'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
            }`}
          >
            <Icon name="group_add" size="sm" />
            Entrar com Convite
          </button>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="p-3 bg-[#ba1a1a]/10 dark:bg-[#ffb4ab]/20 text-[#ba1a1a] dark:text-[#ffb4ab] rounded-xl text-sm flex items-center gap-2">
              <Icon name="error" size="sm" />
              {error}
            </div>
          )}

          <Input
            label="Nome completo"
            name="name"
            type="text"
            placeholder="Seu nome"
            value={formData.name}
            onChange={handleChange}
            required
            prefix="person"
          />

          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={handleChange}
            required
            prefix="mail"
          />
          
          {mode === 'create' ? (
            <Input
              label="Nome da Família"
              name="familyName"
              type="text"
              placeholder="Ex: Família Menezes"
              value={formData.familyName}
              onChange={handleChange}
              required
              prefix="group"
              helperText="Criaremos um novo espaço financeiro compartilhado."
            />
          ) : (
            <div className="space-y-1">
              <Input
                label="Código de Convite da Família"
                name="inviteCode"
                type="text"
                placeholder="Ex: FAM-7X9K"
                value={formData.inviteCode}
                onChange={handleChange}
                required
                prefix="key"
                helperText="Peça o código ou link de convite ao seu cônjuge."
              />
              {initialInvite && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Icon name="check_circle" size="sm" /> Código de convite aplicado automaticamente!
                </p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Senha"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <Input
              label="Confirmar Senha"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <Button type="submit" className="w-full mt-4" size="lg" loading={loading}>
            {mode === 'create' ? 'Cadastrar e Criar Família' : 'Cadastrar e Entrar na Família'}
          </Button>
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Já tem conta?{' '}
              <Link href="/login" className="text-[#0058be] dark:text-[#adc6ff] font-semibold hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-gradient-to-br from-[#f8f9ff] to-[#e6edfa] dark:from-[#0f1419] dark:to-[#162032]">
      <Suspense fallback={<div className="text-center text-sm text-gray-400">Carregando...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
