import { useState, useEffect } from 'react';

const STORAGE_KEY = 'financas_category_budgets';

const DEFAULT_BUDGETS: Record<string, number> = {
  'Alimentação': 1500,
  'Moradia': 2500,
  'Transporte': 800,
  'Saúde': 500,
  'Educação': 600,
  'Lazer': 500,
  'Vestuário': 400,
  'Contas Fixas': 1200,
  'Assinaturas': 300,
  'Outros (Despesa)': 500
};

export function useCategoryBudgets() {
  const [budgets, setBudgetsState] = useState<Record<string, number>>(DEFAULT_BUDGETS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBudgetsState({ ...DEFAULT_BUDGETS, ...parsed });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BUDGETS));
      }
    } catch (e) {
      console.error('Erro ao ler orçamentos do localStorage:', e);
    }
  }, []);

  const setBudget = (categoryName: string, amount: number) => {
    setBudgetsState(prev => {
      const updated = { ...prev, [categoryName]: amount };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao salvar orçamento no localStorage:', e);
      }
      return updated;
    });
  };

  const setAllBudgets = (newBudgets: Record<string, number>) => {
    setBudgetsState(newBudgets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newBudgets));
    } catch (e) {
      console.error('Erro ao salvar orçamentos no localStorage:', e);
    }
  };

  const getBudget = (categoryName: string): number => {
    return budgets[categoryName] || 0;
  };

  return {
    budgets,
    setBudget,
    setAllBudgets,
    getBudget
  };
}
