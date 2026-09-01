import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getInvoiceMonthKey } from '@/lib/creditCardUtils';

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
      // Find card configuration
      const { data: cardData } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('id', cardId)
        .single() as any;

      // Fetch pending transactions for this card
      const { data: pendingTxs, error: fetchErr } = await supabase
        .from('transactions')
        .select('id, date')
        .eq('credit_card_id', cardId)
        .eq('status', 'pendente');

      if (fetchErr) throw fetchErr;

      // Filter transactions that belong to this invoice month (or older)
      const targetIds = (pendingTxs || []).filter((t: any) => {
        if (!cardData?.closing_day || !cardData?.due_day) {
          return t.date.substring(0, 7) <= month;
        }
        const invMonth = getInvoiceMonthKey(t.date, cardData.closing_day, cardData.due_day);
        return invMonth <= month;
      }).map((t: any) => t.id);

      if (targetIds.length > 0) {
        const { error: updateErr } = await (supabase
          .from('transactions') as any)
          .update({ status: 'pago' })
          .in('id', targetIds);

        if (updateErr) throw updateErr;
      }

      await fetchCreditCards();
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
