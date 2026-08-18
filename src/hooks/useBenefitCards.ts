import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type BenefitCard = {
  id: string;
  name: string;
  type: 'va' | 'vr';
  balance: number;
  rechargeAmount: number;
  rechargeDay: number;
  color: string;
  icon: string;
};

export type BenefitTransaction = {
  id: string;
  cardId: string;
  description: string;
  amount: number;
  date: string;
  type: 'debito' | 'recarga';
  categoryName?: string;
};

const CARDS_STORAGE_KEY = 'financas_benefit_cards';
const TXS_STORAGE_KEY = 'financas_benefit_transactions';

const DEFAULT_CARDS: Omit<BenefitCard, 'id'>[] = [
  {
    name: 'VA Alimentação 1',
    type: 'va',
    balance: 850.00,
    rechargeAmount: 1000.00,
    rechargeDay: 1,
    color: '#10b981',
    icon: 'restaurant'
  },
  {
    name: 'VA Alimentação 2',
    type: 'va',
    balance: 600.00,
    rechargeAmount: 800.00,
    rechargeDay: 15,
    color: '#059669',
    icon: 'store'
  },
  {
    name: 'VR Refeição',
    type: 'vr',
    balance: 450.00,
    rechargeAmount: 600.00,
    rechargeDay: 1,
    color: '#f59e0b',
    icon: 'flatware'
  }
];

export function useBenefitCards() {
  const [cards, setCards] = useState<BenefitCard[]>([]);
  const [transactions, setTransactions] = useState<BenefitTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const getFamilyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = (await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()) as any;

    return { userId: user.id, familyId: profile?.family_id as string | undefined };
  };

  const fetchCardsAndTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authInfo = await getFamilyId();
      if (!authInfo?.familyId) {
        setLoading(false);
        return;
      }

      // 1. Fetch Cards
      const { data: dbCards, error: cardsError } = await supabase
        .from('benefit_cards')
        .select('*')
        .order('created_at', { ascending: true });

      if (cardsError) throw cardsError;

      // Check if we need to auto-migrate from localStorage or seed defaults
      if (!dbCards || dbCards.length === 0) {
        let cardsToMigrate: Omit<BenefitCard, 'id'>[] = DEFAULT_CARDS;
        try {
          const localSaved = localStorage.getItem(CARDS_STORAGE_KEY);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              cardsToMigrate = parsed.map(c => ({
                name: c.name,
                type: c.type || 'va',
                balance: Number(c.balance) || 0,
                rechargeAmount: Number(c.rechargeAmount) || 0,
                rechargeDay: Number(c.rechargeDay) || 1,
                color: c.color || '#10b981',
                icon: c.icon || 'restaurant'
              }));
            }
          }
        } catch {}

        // Insert into Supabase
        const insertRows = cardsToMigrate.map(c => ({
          family_id: authInfo.familyId,
          user_id: authInfo.userId,
          name: c.name,
          type: c.type,
          balance: c.balance,
          recharge_amount: c.rechargeAmount,
          recharge_day: c.rechargeDay,
          color: c.color,
          icon: c.icon
        }));

        const { data: insertedCards, error: insertError } = await supabase
          .from('benefit_cards')
          .insert(insertRows as any)
          .select();

        if (insertError) throw insertError;

        if (insertedCards) {
          const mappedCards: BenefitCard[] = insertedCards.map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            balance: Number(c.balance),
            rechargeAmount: Number(c.recharge_amount),
            rechargeDay: c.recharge_day,
            color: c.color,
            icon: c.icon
          }));
          setCards(mappedCards);
        }
      } else {
        const mappedCards: BenefitCard[] = dbCards.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          balance: Number(c.balance),
          rechargeAmount: Number(c.recharge_amount),
          rechargeDay: c.recharge_day,
          color: c.color,
          icon: c.icon
        }));
        setCards(mappedCards);
      }

      // 2. Fetch Transactions
      const { data: dbTxs, error: txsError } = await supabase
        .from('benefit_transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (txsError) throw txsError;

      const mappedTxs: BenefitTransaction[] = (dbTxs || []).map((t: any) => ({
        id: t.id,
        cardId: t.card_id,
        description: t.description,
        amount: Number(t.amount),
        date: t.date,
        type: t.type,
        categoryName: t.category_name || 'Alimentação'
      }));

      setTransactions(mappedTxs);
    } catch (err: any) {
      console.error('Erro ao buscar cartões de benefícios:', err);
      setError(err.message || 'Erro ao carregar benefícios');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCardsAndTransactions();
  }, [fetchCardsAndTransactions]);

  const addCard = async (cardData: Omit<BenefitCard, 'id'>) => {
    try {
      const authInfo = await getFamilyId();
      if (!authInfo?.familyId) return false;

      const { data, error } = await supabase
        .from('benefit_cards')
        .insert({
          family_id: authInfo.familyId,
          user_id: authInfo.userId,
          name: cardData.name,
          type: cardData.type,
          balance: cardData.balance,
          recharge_amount: cardData.rechargeAmount,
          recharge_day: cardData.rechargeDay,
          color: cardData.color,
          icon: cardData.icon
        } as any)
        .select()
        .single();

      if (error) throw error;

      await fetchCardsAndTransactions();
      return true;
    } catch (err: any) {
      console.error('Erro ao adicionar cartão de benefício:', err);
      setError(err.message);
      return false;
    }
  };

  const updateCard = async (id: string, updatedData: Partial<BenefitCard>) => {
    try {
      const updatePayload: any = {};
      if (updatedData.name !== undefined) updatePayload.name = updatedData.name;
      if (updatedData.type !== undefined) updatePayload.type = updatedData.type;
      if (updatedData.balance !== undefined) updatePayload.balance = updatedData.balance;
      if (updatedData.rechargeAmount !== undefined) updatePayload.recharge_amount = updatedData.rechargeAmount;
      if (updatedData.rechargeDay !== undefined) updatePayload.recharge_day = updatedData.rechargeDay;
      if (updatedData.color !== undefined) updatePayload.color = updatedData.color;
      if (updatedData.icon !== undefined) updatePayload.icon = updatedData.icon;

      const { error } = await (supabase
        .from('benefit_cards') as any)
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      // Optimistic local update
      setCards(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
      return true;
    } catch (err: any) {
      console.error('Erro ao atualizar cartão:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteCard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('benefit_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCards(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.filter(t => t.cardId !== id));
      return true;
    } catch (err: any) {
      console.error('Erro ao deletar cartão:', err);
      setError(err.message);
      return false;
    }
  };

  const addRecharge = async (cardId: string, amount: number, date?: string) => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return false;

    const newBalance = targetCard.balance + amount;
    const authInfo = await getFamilyId();
    if (!authInfo?.familyId) return false;

    const rechargeDate = date || new Date().toISOString().split('T')[0];

    try {
      // 1. Update card balance
      await updateCard(cardId, { balance: newBalance });

      // 2. Insert transaction
      const { error } = await supabase
        .from('benefit_transactions')
        .insert({
          card_id: cardId,
          user_id: authInfo.userId,
          description: 'Recarga de Saldo',
          amount,
          date: rechargeDate,
          type: 'recarga',
          category_name: 'Receita Benefício'
        } as any);

      if (error) throw error;

      await fetchCardsAndTransactions();
      return true;
    } catch (err: any) {
      console.error('Erro ao registrar recarga:', err);
      return false;
    }
  };

  const debitBalance = async (cardId: string, amount: number, description: string, categoryName: string = 'Alimentação') => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return false;

    const newBalance = Math.max(0, targetCard.balance - amount);
    const authInfo = await getFamilyId();
    if (!authInfo?.familyId) return false;

    try {
      // 1. Update card balance
      await updateCard(cardId, { balance: newBalance });

      // 2. Insert transaction
      const { error } = await supabase
        .from('benefit_transactions')
        .insert({
          card_id: cardId,
          user_id: authInfo.userId,
          description,
          amount,
          date: new Date().toISOString().split('T')[0],
          type: 'debito',
          category_name: categoryName
        } as any);

      if (error) throw error;

      await fetchCardsAndTransactions();
      return true;
    } catch (err: any) {
      console.error('Erro ao debitar saldo:', err);
      return false;
    }
  };

  const deleteTransaction = async (txId: string) => {
    try {
      const { error } = await supabase
        .from('benefit_transactions')
        .delete()
        .eq('id', txId);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== txId));
      return true;
    } catch (err: any) {
      console.error('Erro ao excluir transação:', err);
      return false;
    }
  };

  const clearAllTransactions = async () => {
    try {
      const cardIds = cards.map(c => c.id);
      if (cardIds.length === 0) return true;

      const { error } = await supabase
        .from('benefit_transactions')
        .delete()
        .in('card_id', cardIds);

      if (error) throw error;

      setTransactions([]);
      return true;
    } catch (err: any) {
      console.error('Erro ao limpar transações:', err);
      return false;
    }
  };

  const getCardStats = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return { dailyAllowance: 0, daysRemaining: 0 };

    const today = new Date();
    const currentDay = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    let daysRemaining = 0;
    if (card.rechargeDay > currentDay) {
      daysRemaining = card.rechargeDay - currentDay;
    } else {
      daysRemaining = (lastDayOfMonth - currentDay) + card.rechargeDay;
    }

    daysRemaining = Math.max(1, daysRemaining);
    const dailyAllowance = card.balance / daysRemaining;

    return {
      dailyAllowance,
      daysRemaining
    };
  };

  return {
    cards,
    transactions,
    loading,
    error,
    refreshData: fetchCardsAndTransactions,
    addCard,
    updateCard,
    deleteCard,
    addRecharge,
    debitBalance,
    deleteTransaction,
    clearAllTransactions,
    getCardStats
  };
}
