import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Transaction } from './useTransactions';

export type DashboardData = {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  upcomingBills: any[];
  chartData: any;
  expensesByCategory: any;
  topExpenses: { name: string; amount: number; color: string; percentage: number }[];
};

export function useDashboard(monthFilter?: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all transactions to compute dashboard
      // In a real large scale app, this would be done via SQL aggregates (RPC)
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('*, category:categories(*), credit_card:credit_cards(*)')
        .order('date', { ascending: false });

      if (txError) throw txError;

      const transactions = (txs || []).map((t: any) => ({
        ...t,
        category: Array.isArray(t.category) ? t.category[0] : t.category,
        credit_card: Array.isArray(t.credit_card) ? t.credit_card[0] : t.credit_card
      })) as any[];

      const now = new Date();
      let filterMonth = now.getMonth();
      let filterYear = now.getFullYear();

      if (monthFilter) {
        const [y, m] = monthFilter.split('-');
        filterYear = parseInt(y);
        filterMonth = parseInt(m) - 1;
      }

      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let totalBalance = 0;
      let monthlyIncome = 0;
      let monthlyExpense = 0;
      const upcomingBillsRaw: any[] = [];

      // Monthly aggregation for the bar chart (Jan to Jun for example)
      // We will do last 6 months
      const months = Array.from({length: 6}, (_, i) => {
        const d = new Date(currentYear, currentMonth - 5 + i, 1);
        return {
          month: d.getMonth(),
          year: d.getFullYear(),
          label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d),
          income: 0,
          expense: 0
        };
      });

      // Category aggregation for the doughnut chart
      const categoryExpenses: Record<string, { total: number, color: string }> = {};

      transactions.forEach(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();
        const amount = Number(t.amount);

        // Balance (Only count Paid/Received for all-time balance)
        if (t.status === 'pago') {
          if (t.type === 'receita') {
            totalBalance += amount;
          } else {
            totalBalance -= amount;
          }
        }

        // Selected Month (Income/Expense/Category)
        if (tMonth === filterMonth && tYear === filterYear) {
          if (t.type === 'receita') monthlyIncome += amount;
          else monthlyExpense += amount;
        }

        // Upcoming Bills (Always from today onwards, independent of month filter)
        if (t.status === 'pendente' && t.type === 'despesa') {
          upcomingBillsRaw.push(t);
        }

        // 6 months chart
        const monthData = months.find(m => m.month === tMonth && m.year === tYear);
        if (monthData) {
          if (t.type === 'receita') monthData.income += amount;
          else monthData.expense += amount;
        }

        // Category Expenses (For the selected month)
        if (t.type === 'despesa' && tMonth === filterMonth && tYear === filterYear) {
          const catName = t.category?.name || 'Sem Categoria';
          const catColor = t.category?.color || '#6c7a71';
          if (!categoryExpenses[catName]) {
            categoryExpenses[catName] = { total: 0, color: catColor };
          }
          categoryExpenses[catName].total += amount;
        }
      });

      // Consolidate Credit Card Invoices for Upcoming Bills
      const upcomingBills: any[] = [];
      const consolidatedCards: Record<string, any> = {};

      upcomingBillsRaw.forEach(t => {
        if (t.credit_card) {
          const tDate = new Date(t.date + 'T12:00:00');
          const monthKey = `${tDate.getFullYear()}-${tDate.getMonth()}`;
          const key = `${t.credit_card_id}-${monthKey}`;
          
          if (!consolidatedCards[key]) {
            consolidatedCards[key] = {
              id: `fatura-${key}`,
              description: `Fatura - ${t.credit_card.name}`,
              amount: 0,
              date: t.date, // Will just use the first transaction's date for sorting
              type: 'despesa',
              status: 'pendente',
              isInvoice: true,
              category: { name: 'Cartão de Crédito', icon: 'credit_card', color: t.credit_card.color }
            };
            upcomingBills.push(consolidatedCards[key]);
          }
          consolidatedCards[key].amount += Number(t.amount);
        } else {
          upcomingBills.push(t);
        }
      });

      // Sort upcoming bills by date ascending (oldest/closest first)
      upcomingBills.sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime());

      // Format Chart Data
      const chartData = {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Receitas',
            data: months.map(m => m.income),
            backgroundColor: '#10b981',
          },
          {
            label: 'Despesas',
            data: months.map(m => m.expense),
            backgroundColor: '#ef4444',
          }
        ]
      };

      const expensesByCategory = {
        labels: Object.keys(categoryExpenses),
        datasets: [
          {
            data: Object.values(categoryExpenses).map(c => c.total),
            backgroundColor: Object.values(categoryExpenses).map(c => c.color),
          }
        ]
      };

      // Top 5 Expenses
      const expensesList = transactions
        .filter(t => t.type === 'despesa' && new Date(t.date + 'T12:00:00').getMonth() === filterMonth && new Date(t.date + 'T12:00:00').getFullYear() === filterYear)
        .map(t => ({
          name: t.description,
          amount: Number(t.amount),
          color: t.category?.color || '#ef4444'
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const totalMonthlyExp = monthlyExpense || 1; 
      const topExpenses = expensesList.map(e => ({
        ...e,
        percentage: Math.round((e.amount / totalMonthlyExp) * 100)
      }));

      setData({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        upcomingBills: upcomingBills.slice(0, 5), // top 5
        chartData,
        expensesByCategory,
        topExpenses
      });

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, [supabase, monthFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    data,
    loading,
    error,
    refreshData: fetchDashboardData
  };
}
