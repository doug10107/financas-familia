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
  amount: number;
  date: string;
  notes: string | null;
};

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
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

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchGoals();
    } catch (err: any) {
      console.error('Error fetching goals data:', err);
      setError(err.message || 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, [fetchGoals]);

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

  const addGoalContribution = async (input: {
    goal_id: string;
    amount: number;
    date: string;
    notes?: string;
  }) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await (supabase
        .from('goal_contributions')
        .insert({
          goal_id: input.goal_id,
          user_id: user.id,
          amount: input.amount,
          date: input.date,
          notes: input.notes || null
        } as any) as any);

      if (error) throw error;

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding goal contribution:', err);
      setError(err.message || 'Erro ao registrar aporte');
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
    loading,
    error,
    refreshData,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution
  };
}
