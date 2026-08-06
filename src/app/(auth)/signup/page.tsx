'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    familyName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            family_name: formData.familyName,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Se a confirmação de email estiver ativada, a sessão pode vir nula
        if (!data.session) {
          setError('Cadastro realizado! Por favor, verifique seu email para confirmar a conta.');
          setLoading(false);
          return;
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-gradient-to-br from-[#f8f9ff] to-[#e6edfa] dark:from-[#0f1419] dark:to-[#162032]">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar Nova Conta</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Comece a gerenciar suas finanças</p>
        </div>

        <GlassCard elevated className="w-full">
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
            
            <Input
              label="Nome da Família"
              name="familyName"
              type="text"
              placeholder="Ex: Família Silva"
              value={formData.familyName}
              onChange={handleChange}
              required
              prefix="group"
              helperText="Criaremos um grupo familiar com este nome."
            />
            
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
              Cadastrar
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
    </div>
  );
}
