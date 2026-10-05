import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Goal = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  icon: string;
  color: string;
  deadline: string | null;
  status: 'em_andamento' | 'concluida' | 'cancelada';
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at?: string;
  profile?: { id: string; display_name: string; avatar_url?: string | null };
};

export type GoalCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'receita' | 'despesa' | 'ambos';
};

export type AddContributionInput = {
  goal_id: string;
  amount: number;
  type: 'aporte' | 'resgate';
  date: string;
  notes?: string;
  sync_transaction?: boolean;
  transaction_category_id?: string;
  transaction_description?: string;
  transaction_type?: 'despesa' | 'receita';
};

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setGoals(data || []);
  }, [supabase]);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (!error && data) {
      setCategories(data);
    }
  }, [supabase]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchGoals(), fetchCategories()]);
    } catch (err: any) {
      console.error('Error fetching goals data:', err);
      setError(err.message || 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, [fetchGoals, fetchCategories]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addGoal = async (input: {
    name: string;
    target_amount: number;
    initial_amount?: number;
    deadline?: string;
    description?: string;
    icon?: string;
    color?: string;
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

      const { data: newGoal, error: goalError } = await (supabase
        .from('goals')
        .insert({
          family_id: profile.family_id,
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          target_amount: input.target_amount,
          icon: input.icon || 'flag',
          color: input.color || '#10b981',
          deadline: input.deadline || null,
          status: 'em_andamento'
        } as any)
        .select('id')
        .single() as any);

      if (goalError) throw goalError;

      if (input.initial_amount && input.initial_amount > 0) {
        const { error: contribError } = await (supabase
          .from('goal_contributions')
          .insert({
            goal_id: newGoal.id,
            user_id: user.id,
            amount: input.initial_amount,
            date: new Date().toISOString().split('T')[0],
            notes: 'Aporte Inicial'
          } as any) as any);

        if (contribError) throw contribError;
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding goal:', err);
      setError(err.message || 'Erro ao criar meta');
      return false;
    }
  };

  const addGoalContribution = async (input: AddContributionInput) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const isWithdrawal = input.type === 'resgate';
      const rawAmount = Math.abs(input.amount);
      const contributionAmount = isWithdrawal ? -rawAmount : rawAmount;

      const targetGoal = goals.find(g => g.id === input.goal_id);
      if (isWithdrawal && targetGoal && (targetGoal.current_amount < rawAmount)) {
        throw new Error(`Saldo insuficiente na meta. Disponível: R$ ${targetGoal.current_amount.toFixed(2)}`);
      }

      // 1. Insert into goal_contributions
      const { error: contribError } = await (supabase
        .from('goal_contributions')
        .insert({
          goal_id: input.goal_id,
          user_id: user.id,
          amount: contributionAmount,
          date: input.date,
          notes: input.notes || (isWithdrawal ? 'Resgate / Retirada' : 'Aporte')
        } as any) as any);

      if (contribError) throw contribError;

      // 2. Optionally sync with transactions table
      if (input.sync_transaction) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('family_id')
          .eq('id', user.id)
          .single() as any;

        if (profile?.family_id) {
          const goalName = targetGoal?.name || 'Meta';
          const defaultDesc = isWithdrawal
            ? `[Resgate Meta] ${goalName}${input.notes ? ` - ${input.notes}` : ''}`
            : `[Aporte Meta] ${goalName}${input.notes ? ` - ${input.notes}` : ''}`;

          const txType = input.transaction_type || (isWithdrawal ? 'despesa' : 'despesa');

          const { error: txError } = await (supabase
            .from('transactions')
            .insert({
              family_id: profile.family_id,
              user_id: user.id,
              type: txType,
              description: input.transaction_description || defaultDesc,
              amount: rawAmount,
              date: input.date,
              category_id: input.transaction_category_id || null,
              status: 'pago'
            } as any) as any);

          if (txError) {
            console.error('Error creating linked transaction:', txError);
          }
        }
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding goal contribution/withdrawal:', err);
      setError(err.message || 'Erro ao registrar movimentação');
      return false;
    }
  };

  const fetchGoalContributions = async (goalId: string): Promise<GoalContribution[]> => {
    try {
      const [{ data: contribs, error: contribError }, { data: profiles }] = await Promise.all([
        supabase
          .from('goal_contributions')
          .select('*')
          .eq('goal_id', goalId)
          .order('date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
      ]);

      if (contribError) throw contribError;

      const profilesMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
      return (contribs || []).map((c: any) => ({
        ...c,
        profile: c.user_id ? profilesMap.get(c.user_id) : undefined
      }));
    } catch (err: any) {
      console.error('Error fetching contributions:', err);
      return [];
    }
  };

  const deleteGoalContribution = async (contributionId: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('goal_contributions')
        .delete()
        .eq('id', contributionId);

      if (error) throw error;
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error deleting contribution:', err);
      setError(err.message || 'Erro ao excluir movimentação');
      return false;
    }
  };

  const updateGoal = async (id: string, goalInput: Partial<Goal>) => {
    setError(null);
    try {
      const { error } = await (supabase
        .from('goals') as any)
        .update(goalInput)
        .eq('id', id);

      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error updating goal:', err);
      setError(err.message || 'Erro ao atualizar meta');
      return false;
    }
  };

  const deleteGoal = async (id: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error deleting goal:', err);
      setError(err.message || 'Erro ao excluir meta');
      return false;
    }
  };

  return {
    goals,
    categories,
    loading,
    error,
    refreshData,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution,
    fetchGoalContributions,
    deleteGoalContribution
  };
}
