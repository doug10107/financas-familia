import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'receita' | 'despesa' | 'ambos';
  is_default?: boolean;
};

export type Transaction = {
  id: string;
  type: 'receita' | 'despesa';
  description: string;
  amount: number;
  date: string;
  status: 'pago' | 'pendente' | 'cancelado';
  category_id: string | null;
  credit_card_id?: string | null;
  installment_group_id?: string | null;
  current_installment?: number | null;
  total_installments?: number | null;
  category?: Category; // Joined data
};

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
      
    if (error) throw error;
    setCategories(data || []);
  }, [supabase]);

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        category:categories(*)
      `)
      .order('date', { ascending: false });
      
    if (error) throw error;
    
    // O Supabase retorna array para joins '1 to many', ou object para '1 to 1'. 
    // Como transaction -> category é many to 1, o 'categories' pode vir como array dependendo de como a view foi gerada.
    // O select 'category:categories(*)' retorna um objeto.
    const mapped = (data || []).map((t: any) => ({
      ...t,
      category: Array.isArray(t.category) ? t.category[0] : t.category
    })) as Transaction[];
    setTransactions(mapped);
  }, [supabase]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchCategories(), fetchTransactions()]);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [fetchCategories, fetchTransactions]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addTransaction = async (transactionInput: {
    type: 'receita' | 'despesa';
    description: string;
    amount: number;
    date: string; // This will be the purchase date
    category_id: string;
    status?: 'pago' | 'pendente' | 'cancelado';
    credit_card_id?: string | null;
    installments?: number;
    card_due_day?: number;
    card_closing_day?: number;
    repeat_until?: string; // Formato "YYYY-MM"
  }) => {
    setError(null);
    try {
      // get user family_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as any;
        
      if (!profile) throw new Error('Perfil não encontrado');

      const isCreditCard = !!transactionInput.credit_card_id;
      const totalInstallments = transactionInput.installments || 1;

      if (transactionInput.repeat_until) {
        // Generates recurring transactions month-by-month
        const baseDate = new Date(transactionInput.date + 'T12:00:00');
        const [endYear, endMonth] = transactionInput.repeat_until.split('-').map(Number);
        
        const datesToInsert: string[] = [];
        let year = baseDate.getFullYear();
        let month = baseDate.getMonth(); // 0-11
        const day = baseDate.getDate();
        
        while (year < endYear || (year === endYear && month <= endMonth - 1)) {
          const d = new Date(year, month, day, 12, 0, 0);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          datesToInsert.push(`${yyyy}-${mm}-${dd}`);
          
          month++;
          if (month > 11) {
            month = 0;
            year++;
          }
        }

        if (datesToInsert.length === 0) {
          datesToInsert.push(transactionInput.date);
        }

        // Insert first transaction
        const { data: parentTx, error: parentError } = await (supabase
          .from('transactions')
          .insert({
            family_id: profile.family_id,
            user_id: user.id,
            type: transactionInput.type,
            description: transactionInput.description,
            amount: transactionInput.amount,
            date: datesToInsert[0],
            category_id: transactionInput.category_id,
            status: transactionInput.status || 'pago',
            credit_card_id: transactionInput.credit_card_id || null,
            is_recurring: true,
            total_installments: isCreditCard ? 1 : null,
            current_installment: isCreditCard ? 1 : null
          } as any)
          .select('id')
          .single() as any);

        if (parentError) throw parentError;
        const parentId = parentTx.id;

        if (datesToInsert.length > 1) {
          const today = new Date();
          const remainingTxs = datesToInsert.slice(1).map(dateStr => {
            const isFuture = new Date(dateStr) > today;
            return {
              family_id: profile.family_id,
              user_id: user.id,
              type: transactionInput.type,
              description: transactionInput.description,
              amount: transactionInput.amount,
              date: dateStr,
              category_id: transactionInput.category_id,
              status: isFuture ? 'pendente' : (transactionInput.status || 'pago'),
              credit_card_id: transactionInput.credit_card_id || null,
              is_recurring: true,
              parent_recurring_id: parentId,
              total_installments: isCreditCard ? 1 : null,
              current_installment: isCreditCard ? 1 : null
            };
          });

          const { error: remainingError } = await supabase
            .from('transactions')
            .insert(remainingTxs as any);

          if (remainingError) throw remainingError;
        }
      } else if (!isCreditCard || totalInstallments === 1) {
        // Normal transaction or 1x credit card (treated as a single transaction)
        let dueDate = transactionInput.date;
        let status = transactionInput.status;

        // If it's a 1x credit card purchase, calculate the invoice due date
        if (isCreditCard && transactionInput.card_due_day && transactionInput.card_closing_day) {
           const purchaseDate = new Date(transactionInput.date + 'T12:00:00');
           const invoiceDate = calculateInvoiceDueDate(purchaseDate, transactionInput.card_closing_day, transactionInput.card_due_day, 0);
           dueDate = invoiceDate.toISOString().split('T')[0];
           status = 'pendente'; // Credit card purchases are always pending until paid
        }

        const { error } = await supabase
          .from('transactions')
          .insert({
            family_id: profile.family_id,
            user_id: user.id,
            type: transactionInput.type,
            description: transactionInput.description,
            amount: transactionInput.amount,
            date: dueDate,
            category_id: transactionInput.category_id,
            status: status || 'pago',
            credit_card_id: transactionInput.credit_card_id || null,
            total_installments: isCreditCard ? 1 : null,
            current_installment: isCreditCard ? 1 : null
          } as any);

        if (error) throw error;
      } else {
        // Installments transaction
        // Generates a UUID for the group
        const groupId = crypto.randomUUID();
        const installmentAmount = Number((transactionInput.amount / totalInstallments).toFixed(2));
        
        const purchaseDate = new Date(transactionInput.date + 'T12:00:00');
        const transactionsToInsert = [];

        for (let i = 0; i < totalInstallments; i++) {
          const invoiceDate = calculateInvoiceDueDate(purchaseDate, transactionInput.card_closing_day!, transactionInput.card_due_day!, i);
          
          transactionsToInsert.push({
            family_id: profile.family_id,
            user_id: user.id,
            type: transactionInput.type,
            description: `${transactionInput.description} (${i + 1}/${totalInstallments})`,
            amount: installmentAmount, // In a real app we'd adjust the last installment for rounding errors
            date: invoiceDate.toISOString().split('T')[0],
            category_id: transactionInput.category_id,
            status: 'pendente', // Installments are always pending initially
            credit_card_id: transactionInput.credit_card_id,
            installment_group_id: groupId,
            current_installment: i + 1,
            total_installments: totalInstallments
          });
        }

        const { error } = await supabase
          .from('transactions')
          .insert(transactionsToInsert as any);

        if (error) throw error;
      }
      
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      setError(err.message || 'Erro ao salvar lançamento');
      return false;
    }
  };

  // Helper to calculate invoice due date based on purchase date, closing day and due day
  const calculateInvoiceDueDate = (purchaseDate: Date, closingDay: number, dueDay: number, monthOffset: number) => {
    const pYear = purchaseDate.getFullYear();
    const pMonth = purchaseDate.getMonth();
    const pDay = purchaseDate.getDate();

    let invoiceMonth = pMonth;
    let invoiceYear = pYear;

    // If purchase day is on or after the closing day, it goes to the next month's invoice
    if (pDay >= closingDay) {
      invoiceMonth++;
    }

    // Add the installment offset
    invoiceMonth += monthOffset;

    // Adjust year if month goes beyond December
    while (invoiceMonth > 11) {
      invoiceMonth -= 12;
      invoiceYear++;
    }

    // Usually if dueDay is less than closingDay (e.g. closing 25, due 05), the due date is actually in the following month of the closing date.
    // E.g. buys on Aug 20. Closes Aug 25. Due Sep 05.
    // E.g. buys on Aug 26. Closes Sep 25. Due Oct 05.
    let finalDueMonth = invoiceMonth;
    if (dueDay < closingDay) {
      finalDueMonth++;
      if (finalDueMonth > 11) {
        finalDueMonth = 0;
        invoiceYear++;
      }
    }

    return new Date(invoiceYear, finalDueMonth, dueDay, 12, 0, 0);
  };

  const updateTransaction = async (id: string, transactionInput: {
    type?: 'receita' | 'despesa';
    description?: string;
    amount?: number;
    date?: string;
    category_id?: string;
    status?: 'pago' | 'pendente' | 'cancelado';
  }) => {
    setError(null);
    try {
      const { error } = await (supabase
        .from('transactions') as any)
        .update(transactionInput)
        .eq('id', id);

      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      setError(err.message || 'Erro ao atualizar lançamento');
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      setError(err.message || 'Erro ao excluir lançamento');
      return false;
    }
  };

  const addCategory = async (categoryInput: {
    name: string;
    icon?: string;
    color?: string;
    type: 'receita' | 'despesa' | 'ambos';
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

      const { data: newCat, error } = await (supabase
        .from('categories')
        .insert({
          family_id: profile.family_id,
          name: categoryInput.name,
          icon: categoryInput.icon || 'category',
          color: categoryInput.color || '#6c7a71',
          type: categoryInput.type,
          is_default: false
        } as any)
        .select('*')
        .single() as any);

      if (error) throw error;
      
      await fetchCategories();
      return newCat;
    } catch (err: any) {
      console.error('Error adding category:', err);
      setError(err.message || 'Erro ao criar categoria');
      return null;
    }
  };

  const deleteCategory = async (id: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchCategories();
      return true;
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setError(err.message || 'Erro ao excluir categoria');
      return false;
    }
  };

  return {
    transactions,
    categories,
    loading,
    error,
    refreshData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    deleteCategory
  };
}
