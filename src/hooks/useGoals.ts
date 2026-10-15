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
  target_monthly_deposit?: number | null;
  estimated_annual_rate?: number | null;
  investment_id?: string | null;
  investment?: {
    id: string;
    name: string;
    ticker?: string | null;
    current_balance: number;
    institution?: string | null;
  } | null;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes: string | null;
  investment_id?: string | null;
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

export type FamilyInvestment = {
  id: string;
  name: string;
  ticker?: string | null;
  current_balance: number;
  institution?: string | null;
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
  investment_id?: string | null;
  sync_investment?: boolean;
};

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [investments, setInvestments] = useState<FamilyInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchGoals = useCallback(async () => {
    const { data, error } = await supabase
      .from('goals')
      .select(`
        *,
        investment:investments(id, name, ticker, current_balance, institution)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const mapped = (data || []).map((g: any) => ({
      ...g,
      target_amount: Number(g.target_amount) || 0,
      current_amount: Number(g.current_amount) || 0,
      target_monthly_deposit: g.target_monthly_deposit ? Number(g.target_monthly_deposit) : null,
      estimated_annual_rate: g.estimated_annual_rate ? Number(g.estimated_annual_rate) : 10.5,
      investment: Array.isArray(g.investment) ? g.investment[0] : g.investment
    })) as Goal[];

    setGoals(mapped);
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

  const fetchInvestments = useCallback(async () => {
    const { data, error } = await supabase
      .from('investments')
      .select('id, name, ticker, current_balance, institution')
      .order('name');
    if (!error && data) {
      setInvestments(
        data.map((inv: any) => ({
          ...inv,
          current_balance: Number(inv.current_balance) || 0
        }))
      );
    }
  }, [supabase]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchGoals(), fetchCategories(), fetchInvestments()]);
    } catch (err: any) {
      console.error('Error fetching goals data:', err);
      setError(err.message || 'Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  }, [fetchGoals, fetchCategories, fetchInvestments]);

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
    target_monthly_deposit?: number | null;
    estimated_annual_rate?: number | null;
    investment_id?: string | null;
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
          status: 'em_andamento',
          target_monthly_deposit: input.target_monthly_deposit || null,
          estimated_annual_rate: input.estimated_annual_rate !== undefined ? input.estimated_annual_rate : 10.5,
          investment_id: input.investment_id || null
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
            notes: 'Aporte Inicial',
            investment_id: input.investment_id || null
          } as any) as any);

        if (contribError) throw contribError;

        // Optionally link entry to investment if selected
        if (input.investment_id) {
          await (supabase
            .from('investment_entries')
            .insert({
              investment_id: input.investment_id,
              user_id: user.id,
              type: 'aporte',
              amount: input.initial_amount,
              currency: 'BRL',
              date: new Date().toISOString().split('T')[0],
              notes: `[Meta: ${input.name}] Aporte Inicial`
            } as any) as any);
        }
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

      const invId = input.investment_id || targetGoal?.investment_id || null;

      // 1. Insert into goal_contributions
      const { error: contribError } = await (supabase
        .from('goal_contributions')
        .insert({
          goal_id: input.goal_id,
          user_id: user.id,
          amount: contributionAmount,
          date: input.date,
          notes: input.notes || (isWithdrawal ? 'Resgate / Retirada' : 'Aporte'),
          investment_id: invId
        } as any) as any);

      if (contribError) throw contribError;

      // 2. Sync with Investments if requested and an asset is selected
      if (input.sync_investment && invId) {
        const { error: invErr } = await (supabase
          .from('investment_entries')
          .insert({
            investment_id: invId,
            user_id: user.id,
            type: isWithdrawal ? 'resgate' : 'aporte',
            amount: rawAmount,
            currency: 'BRL',
            date: input.date,
            notes: `[Meta: ${targetGoal?.name || 'Meta'}] ${input.notes || (isWithdrawal ? 'Resgate' : 'Aporte')}`
          } as any) as any);

        if (invErr) {
          console.warn('Erro ao sincronizar aporte no investimento:', invErr);
        }
      }

      // 3. Optionally sync with transactions table (Finanças do mês)
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
    investments,
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
