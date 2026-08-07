import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type InvestmentType = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type Investment = {
  id: string;
  name: string;
  institution: string | null;
  current_balance: number;
  total_invested: number;
  notes: string | null;
  type_id: string | null;
  investment_type?: InvestmentType;
};

export type InvestmentEntry = {
  id: string;
  investment_id: string;
  type: 'aporte' | 'resgate' | 'rendimento';
  amount: number;
  date: string;
  notes: string | null;
};

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [types, setTypes] = useState<InvestmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('investment_types')
      .select('*')
      .order('name');

    if (error) throw error;
    setTypes(data || []);
  }, [supabase]);

  const fetchInvestments = useCallback(async () => {
    const { data, error } = await supabase
      .from('investments')
      .select(`
        *,
        investment_type:investment_types(*)
      `)
      .order('name');

    if (error) throw error;
    
    const mapped = (data || []).map((t: any) => ({
      ...t,
      investment_type: Array.isArray(t.investment_type) ? t.investment_type[0] : t.investment_type
    })) as Investment[];
    setInvestments(mapped);
  }, [supabase]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTypes(), fetchInvestments()]);
    } catch (err: any) {
      console.error('Error fetching investments data:', err);
      setError(err.message || 'Erro ao carregar investimentos');
    } finally {
      setLoading(false);
    }
  }, [fetchTypes, fetchInvestments]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addInvestment = async (input: {
    name: string;
    type_id: string;
    institution?: string;
    initial_amount?: number;
    date?: string;
    notes?: string;
  }) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as any;

      if (!profile) throw new Error('Perfil não encontrado');

      const { data: newInv, error: invError } = await (supabase
        .from('investments')
        .insert({
          family_id: profile.family_id,
          user_id: user.id,
          type_id: input.type_id,
          name: input.name,
          institution: input.institution || null,
          notes: input.notes || null
        } as any)
        .select('id')
        .single() as any);

      if (invError) throw invError;

      if (input.initial_amount && input.initial_amount > 0) {
        const { error: entryError } = await (supabase
          .from('investment_entries')
          .insert({
            investment_id: newInv.id,
            user_id: user.id,
            type: 'aporte',
            amount: input.initial_amount,
            date: input.date || new Date().toISOString().split('T')[0],
            notes: 'Aporte Inicial'
          } as any) as any);

        if (entryError) throw entryError;
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding investment:', err);
      setError(err.message || 'Erro ao adicionar investimento');
      return false;
    }
  };

  const addInvestmentEntry = async (input: {
    investment_id: string;
    type: 'aporte' | 'resgate' | 'rendimento';
    amount: number;
    date: string;
    notes?: string;
  }) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await (supabase
        .from('investment_entries')
        .insert({
          investment_id: input.investment_id,
          user_id: user.id,
          type: input.type,
          amount: input.amount,
          date: input.date,
          notes: input.notes || null
        } as any) as any);

      if (error) throw error;

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding entry:', err);
      setError(err.message || 'Erro ao registrar movimentação');
      return false;
    }
  };

  return {
    investments,
    types,
    loading,
    error,
    refreshData,
    addInvestment,
    addInvestmentEntry
  };
}
