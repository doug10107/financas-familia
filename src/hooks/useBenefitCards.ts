import { useState, useEffect } from 'react';

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

const DEFAULT_CARDS: BenefitCard[] = [
  {
    id: 'va-1',
    name: 'VA Alimentação 1',
    type: 'va',
    balance: 850.00,
    rechargeAmount: 1000.00,
    rechargeDay: 1,
    color: '#10b981',
    icon: 'restaurant'
  },
  {
    id: 'va-2',
    name: 'VA Alimentação 2',
    type: 'va',
    balance: 600.00,
    rechargeAmount: 800.00,
    rechargeDay: 15,
    color: '#059669',
    icon: 'store'
  },
  {
    id: 'vr-1',
    name: 'VR Refeição',
    type: 'vr',
    balance: 450.00,
    rechargeAmount: 600.00,
    rechargeDay: 1,
    color: '#f59e0b',
    icon: 'flatware'
  }
];

const DEFAULT_TXS: BenefitTransaction[] = [
  {
    id: 'btx-1',
    cardId: 'va-1',
    description: 'Supermercado Extra',
    amount: 150.00,
    date: new Date().toISOString().split('T')[0],
    type: 'debito',
    categoryName: 'Alimentação'
  },
  {
    id: 'btx-2',
    cardId: 'vr-1',
    description: 'Almoço Restaurante',
    amount: 45.00,
    date: new Date().toISOString().split('T')[0],
    type: 'debito',
    categoryName: 'Alimentação'
  }
];

export function useBenefitCards() {
  const [cards, setCards] = useState<BenefitCard[]>(DEFAULT_CARDS);
  const [transactions, setTransactions] = useState<BenefitTransaction[]>(DEFAULT_TXS);

  useEffect(() => {
    try {
      const savedCards = localStorage.getItem(CARDS_STORAGE_KEY);
      if (savedCards) {
        setCards(JSON.parse(savedCards));
      } else {
        localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(DEFAULT_CARDS));
      }

      const savedTxs = localStorage.getItem(TXS_STORAGE_KEY);
      if (savedTxs) {
        setTransactions(JSON.parse(savedTxs));
      } else {
        localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(DEFAULT_TXS));
      }
    } catch (e) {
      console.error('Erro ao ler benefícios do localStorage:', e);
    }
  }, []);

  const saveCards = (newCards: BenefitCard[]) => {
    setCards(newCards);
    try {
      localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(newCards));
    } catch (e) {
      console.error('Erro ao salvar cartões de benefício:', e);
    }
  };

  const saveTxs = (newTxs: BenefitTransaction[]) => {
    setTransactions(newTxs);
    try {
      localStorage.setItem(TXS_STORAGE_KEY, JSON.stringify(newTxs));
    } catch (e) {
      console.error('Erro ao salvar transações de benefício:', e);
    }
  };

  const updateCard = (id: string, updatedData: Partial<BenefitCard>) => {
    const updated = cards.map(c => c.id === id ? { ...c, ...updatedData } : c);
    saveCards(updated);
  };

  const addRecharge = (cardId: string, amount: number, date?: string) => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return;

    const newBalance = targetCard.balance + amount;
    updateCard(cardId, { balance: newBalance });

    const newTx: BenefitTransaction = {
      id: `btx-${Date.now()}`,
      cardId,
      description: 'Recarga de Saldo',
      amount,
      date: date || new Date().toISOString().split('T')[0],
      type: 'recarga',
      categoryName: 'Receita Benefício'
    };

    saveTxs([newTx, ...transactions]);
  };

  const debitBalance = (cardId: string, amount: number, description: string, categoryName: string = 'Alimentação') => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return;

    const newBalance = Math.max(0, targetCard.balance - amount);
    updateCard(cardId, { balance: newBalance });

    const newTx: BenefitTransaction = {
      id: `btx-${Date.now()}`,
      cardId,
      description,
      amount,
      date: new Date().toISOString().split('T')[0],
      type: 'debito',
      categoryName
    };

    saveTxs([newTx, ...transactions]);
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

  const addCard = (cardData: Omit<BenefitCard, 'id'>) => {
    const newCard: BenefitCard = {
      ...cardData,
      id: `${cardData.type}-${Date.now()}`
    };
    saveCards([...cards, newCard]);
  };

  const deleteCard = (id: string) => {
    const filtered = cards.filter(c => c.id !== id);
    saveCards(filtered);
  };

  const deleteTransaction = (txId: string) => {
    const filtered = transactions.filter(t => t.id !== txId);
    saveTxs(filtered);
  };

  const clearAllTransactions = () => {
    saveTxs([]);
  };

  return {
    cards,
    transactions,
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
