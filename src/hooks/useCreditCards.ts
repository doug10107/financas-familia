import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type CreditCard = {
  id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color: string;
  icon: string;
};

export function useCreditCards() {
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchCreditCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setCreditCards(data || []);
    } catch (err: any) {
      console.error('Error fetching credit cards:', err);
      setError(err.message || 'Erro ao carregar cartões');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCreditCards();
  }, [fetchCreditCards]);

  const addCreditCard = async (cardInput: Omit<CreditCard, 'id'>) => {
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

      const { error } = await supabase
        .from('credit_cards')
        .insert({
          family_id: profile.family_id,
          ...cardInput
        } as any);

      if (error) throw error;
      
      await fetchCreditCards();
      return true;
    } catch (err: any) {
      console.error('Error adding credit card:', err);
      setError(err.message || 'Erro ao salvar cartão');
      return false;
    }
  };

  const updateCreditCard = async (id: string, cardInput: Partial<CreditCard>) => {
    setError(null);
    try {
      const { error } = await (supabase
        .from('credit_cards') as any)
        .update(cardInput)
        .eq('id', id);

      if (error) throw error;
      
      await fetchCreditCards();
      return true;
    } catch (err: any) {
      console.error('Error updating credit card:', err);
      setError(err.message || 'Erro ao atualizar cartão');
      return false;
    }
  };

  const deleteCreditCard = async (id: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('credit_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchCreditCards();
      return true;
    } catch (err: any) {
      console.error('Error deleting credit card:', err);
      setError(err.message || 'Erro ao excluir cartão');
      return false;
    }
  };

  const payInvoice = async (cardId: string, month: string) => {
    setError(null);
    try {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);

      const startDate = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${yearStr}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { error } = await (supabase
        .from('transactions') as any)
        .update({ status: 'pago' })
        .eq('credit_card_id', cardId)
        .eq('status', 'pendente')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      return true;
    } catch (err: any) {
      console.error('Error paying invoice:', err);
      setError(err.message || 'Erro ao pagar fatura');
      return false;
    }
  };

  return {
    creditCards,
    loading,
    error,
    refreshData: fetchCreditCards,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    payInvoice
  };
}
