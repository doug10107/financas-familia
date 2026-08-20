import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Transaction } from './useTransactions';

export type ProjectionMonth = {
  month: number;
  year: number;
  key: string;
  label: string;
  fullLabel: string;
  isSelected: boolean;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  income: number;
  expense: number;
  balance: number;
  accumulatedBalance: number;
};

export type DashboardData = {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  upcomingBills: any[];
  chartData: any;
  projectionMonths: ProjectionMonth[];
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

      // Descobrir a data máxima futura entre todas as transações (ou pelo menos até o fim do ano que vem)
      let maxFutureDate = new Date(currentYear + 1, 11, 1); // Pelo menos até Dezembro do ano que vem

      transactions.forEach(t => {
        if (t.date) {
          const tDate = new Date(t.date + 'T12:00:00');
          if (tDate > maxFutureDate) {
            maxFutureDate = tDate;
          }
        }
      });

      // Gerar todos os meses da projeção (desde 3 meses no passado até maxFutureDate)
      const startMonthDate = new Date(currentYear, currentMonth - 3, 1);
      const totalMonthsToProject = Math.max(
        18,
        (maxFutureDate.getFullYear() - startMonthDate.getFullYear()) * 12 + (maxFutureDate.getMonth() - startMonthDate.getMonth()) + 1
      );

      const allProjectionMonths: ProjectionMonth[] = [];
      let runningAccumulatedBalance = totalBalance;

      for (let i = 0; i < totalMonthsToProject; i++) {
        const d = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;

        const mShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
        const label = `${mShort.charAt(0).toUpperCase() + mShort.slice(1).replace('.', '')}/${String(y).slice(2)}`;
        const fullLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);

        const isCurrent = y === currentYear && m === currentMonth;
        const isPast = (y < currentYear) || (y === currentYear && m < currentMonth);
        const isFuture = (y > currentYear) || (y === currentYear && m > currentMonth);
        const isSelected = y === filterYear && m === filterMonth;

        // Calcular receitas e despesas do mês
        let mIncome = 0;
        let mExpense = 0;

        transactions.forEach(t => {
          const tDate = new Date(t.date + 'T12:00:00');
          if (tDate.getFullYear() === y && tDate.getMonth() === m) {
            if (t.type === 'receita') {
              mIncome += Number(t.amount);
            } else if (t.type === 'despesa') {
              mExpense += Number(t.amount);
            }
          }
        });

        const mBalance = mIncome - mExpense;
        
        // Se for mês futuro, projeta o saldo acumulado
        if (isFuture) {
          runningAccumulatedBalance += mBalance;
        }

        allProjectionMonths.push({
          month: m,
          year: y,
          key,
          label: isSelected ? `📍 ${label}` : label,
          fullLabel: fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1),
          isSelected,
          isPast,
          isCurrent,
          isFuture,
          income: mIncome,
          expense: mExpense,
          balance: mBalance,
          accumulatedBalance: isFuture ? runningAccumulatedBalance : totalBalance
        });
      }

      // 6 months chart padrão para compatibilidade
      const months = Array.from({length: 6}, (_, i) => {
        const d = new Date(filterYear, filterMonth - 2 + i, 1);
        const mShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
        const formattedMonth = mShort.charAt(0).toUpperCase() + mShort.slice(1).replace('.', '');
        const formattedYear = String(d.getFullYear()).slice(2);
        const isSelected = d.getMonth() === filterMonth && d.getFullYear() === filterYear;

        const proj = allProjectionMonths.find(p => p.year === d.getFullYear() && p.month === d.getMonth());

        return {
          month: d.getMonth(),
          year: d.getFullYear(),
          label: isSelected ? `📍 ${formattedMonth}/${formattedYear}` : `${formattedMonth}/${formattedYear}`,
          isSelected,
          income: proj?.income || 0,
          expense: proj?.expense || 0
        };
      });

      // Category aggregation for the doughnut chart
      const categoryExpenses: Record<string, { total: number; color: string; icon: string; transactions: any[] }> = {};

      transactions.forEach(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();
        const amount = Number(t.amount);

        // Category Expenses (For the selected month)
        if (t.type === 'despesa' && tMonth === filterMonth && tYear === filterYear) {
          const catName = t.category?.name || 'Sem Categoria';
          const catColor = t.category?.color || '#6c7a71';
          const catIcon = t.category?.icon || 'category';
          if (!categoryExpenses[catName]) {
            categoryExpenses[catName] = { total: 0, color: catColor, icon: catIcon, transactions: [] };
          }
          categoryExpenses[catName].total += amount;
          categoryExpenses[catName].transactions.push(t);
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
              date: t.date,
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

      // Format Projection Chart Data (Entradas, Saídas, Saldo)
      const chartData = {
        labels: months.map(m => m.label),
        datasets: [
          {
            label: 'Entradas',
            data: months.map(m => m.income),
            backgroundColor: '#10b981',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Saídas',
            data: months.map(m => m.expense),
            backgroundColor: '#ef4444',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Saldo',
            data: months.map(m => m.income - m.expense),
            backgroundColor: '#3b82f6',
            borderRadius: 6,
            borderSkipped: false,
          }
        ]
      };

      const totalExpForMonth = monthlyExpense || 1;
      const categoryList = Object.entries(categoryExpenses)
        .map(([name, data]: [string, any]) => ({
          name,
          total: data.total,
          color: data.color,
          icon: data.icon,
          percentage: Number(((data.total / totalExpForMonth) * 100).toFixed(1)),
          transactions: data.transactions
        }))
        .sort((a, b) => b.total - a.total);

      const expensesByCategory = {
        labels: categoryList.map(c => c.name),
        categoryList,
        datasets: [
          {
            data: categoryList.map(c => c.total),
            backgroundColor: categoryList.map(c => c.color),
          }
        ]
      };

      // Top Expenses with Fixed vs Variable Classification
      const expensesList = transactions
        .filter(t => t.type === 'despesa' && new Date(t.date + 'T12:00:00').getMonth() === filterMonth && new Date(t.date + 'T12:00:00').getFullYear() === filterYear)
        .map(t => {
          const catName = t.category?.name || 'Sem Categoria';
          const fixedCategories = ['Contas Fixas', 'Assinaturas', 'Moradia', 'Educação'];
          const isFixed = t.is_recurring || fixedCategories.includes(catName);

          return {
            name: t.description,
            amount: Number(t.amount),
            color: t.category?.color || '#ef4444',
            categoryName: catName,
            isFixed
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const totalMonthlyExp = monthlyExpense || 1; 
      const topExpenses = expensesList.map(e => ({
        ...e,
        percentage: Math.round((e.amount / totalMonthlyExp) * 100)
      }));

      setData({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        upcomingBills: upcomingBills.slice(0, 5),
        chartData,
        projectionMonths: allProjectionMonths,
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
