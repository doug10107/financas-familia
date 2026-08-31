import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type InvestmentType = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type Investment = {
  id: string;
  name: string;
  ticker?: string | null;
  institution: string | null;
  current_balance: number;
  total_invested: number;
  quantity?: number | null;
  average_price?: number | null;
  current_price?: number | null;
  plan_type?: string | null; // e.g. 'PGBL' | 'VGBL'
  tax_regime?: string | null; // e.g. 'Regressivo' | 'Progressivo'
  notes: string | null;
  due_date?: string | null;
  type_id: string | null;
  investment_type?: InvestmentType;
};

export type InvestmentEntry = {
  id: string;
  investment_id: string;
  type: 'aporte' | 'resgate' | 'rendimento';
  amount: number;
  quantity?: number | null;
  unit_price?: number | null;
  fees?: number | null;
  date: string;
  notes: string | null;
};

export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [types, setTypes] = useState<InvestmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncingQuotes, setIsSyncingQuotes] = useState(false);
  const supabase = createClient();

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('investment_types')
      .select('*')
      .order('name');

    if (error) throw error;
    setTypes(data || []);
  }, [supabase]);

  const fetchInvestments = useCallback(async () => {
    const { data, error } = await supabase
      .from('investments')
      .select(`
        *,
        investment_type:investment_types(*)
      `)
      .order('name');

    if (error) throw error;
    
    const mapped = (data || []).map((t: any) => ({
      ...t,
      quantity: Number(t.quantity) || 0,
      average_price: Number(t.average_price) || 0,
      current_price: Number(t.current_price) || 0,
      current_balance: Number(t.current_balance) || 0,
      total_invested: Number(t.total_invested) || 0,
      investment_type: Array.isArray(t.investment_type) ? t.investment_type[0] : t.investment_type
    })) as Investment[];
    setInvestments(mapped);
  }, [supabase]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTypes(), fetchInvestments()]);
    } catch (err: any) {
      console.error('Error fetching investments data:', err);
      setError(err.message || 'Erro ao carregar investimentos');
    } finally {
      setLoading(false);
    }
  }, [fetchTypes, fetchInvestments]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Sync real-time stock and FII prices from B3
  const syncLiveQuotes = useCallback(async (customList?: Investment[]) => {
    const listToSync = customList || investments;
    const tickers = listToSync
      .map(i => i.ticker || (i.name.match(/^[A-Z]{4}\d{1,2}[A-Z]?$/i) ? i.name : ''))
      .filter(Boolean);

    if (tickers.length === 0) return;

    setIsSyncingQuotes(true);
    try {
      const res = await fetch('/api/stocks/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });

      if (res.ok) {
        const { quotes } = await res.json();
        if (quotes && Object.keys(quotes).length > 0) {
          setInvestments(prev =>
            prev.map(inv => {
              const sym = (inv.ticker || inv.name).toUpperCase();
              const quote = quotes[sym];
              if (quote && quote.price > 0) {
                const qty = Number(inv.quantity) || 1;
                const newBalance = qty * quote.price;
                return {
                  ...inv,
                  current_price: quote.price,
                  current_balance: newBalance > 0 ? Number(newBalance.toFixed(2)) : inv.current_balance
                };
              }
              return inv;
            })
          );
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar cotações em tempo real:', err);
    } finally {
      setIsSyncingQuotes(false);
    }
  }, [investments]);

  const addInvestment = async (input: {
    name: string;
    ticker?: string;
    type_id: string;
    institution?: string;
    quantity?: number;
    unit_price?: number;
    fees?: number;
    initial_amount?: number;
    date?: string;
    due_date?: string;
    plan_type?: string | null;
    tax_regime?: string | null;
    notes?: string;
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

      const totalCalculated = (input.quantity && input.unit_price)
        ? (input.quantity * input.unit_price) + (input.fees || 0)
        : (input.initial_amount || 0);

      const avgPrice = input.unit_price || (input.quantity && input.quantity > 0 ? totalCalculated / input.quantity : 0);

      const { data: newInv, error: invError } = await (supabase
        .from('investments')
        .insert({
          family_id: profile.family_id,
          user_id: user.id,
          type_id: input.type_id,
          name: input.name,
          ticker: input.ticker ? input.ticker.toUpperCase().trim() : null,
          quantity: input.quantity || 0,
          average_price: avgPrice,
          current_price: input.unit_price || avgPrice,
          plan_type: input.plan_type || null,
          tax_regime: input.tax_regime || null,
          institution: input.institution || null,
          due_date: input.due_date || null,
          notes: input.notes || null
        } as any)
        .select('id')
        .single() as any);

      if (invError) throw invError;

      if (totalCalculated > 0) {
        const { error: entryError } = await (supabase
          .from('investment_entries')
          .insert({
            investment_id: newInv.id,
            user_id: user.id,
            type: 'aporte',
            amount: totalCalculated,
            quantity: input.quantity || null,
            unit_price: input.unit_price || null,
            fees: input.fees || 0,
            date: input.date || new Date().toISOString().split('T')[0],
            notes: input.notes || 'Aporte Inicial'
          } as any) as any);

        if (entryError) throw entryError;
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding investment:', err);
      setError(err.message || 'Erro ao adicionar investimento');
      return false;
    }
  };

  const addInvestmentEntry = async (input: {
    investment_id: string;
    type: 'aporte' | 'resgate' | 'rendimento';
    amount?: number;
    quantity?: number;
    unit_price?: number;
    fees?: number;
    date: string;
    notes?: string;
  }) => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const finalAmount = (input.quantity && input.unit_price)
        ? (input.quantity * input.unit_price) + (input.fees || 0)
        : (input.amount || 0);

      if (finalAmount <= 0) throw new Error('Valor inválido para movimentação');

      const { error } = await (supabase
        .from('investment_entries')
        .insert({
          investment_id: input.investment_id,
          user_id: user.id,
          type: input.type,
          amount: finalAmount,
          quantity: input.quantity || null,
          unit_price: input.unit_price || null,
          fees: input.fees || 0,
          date: input.date,
          notes: input.notes || null
        } as any) as any);

      if (error) throw error;

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error adding entry:', err);
      setError(err.message || 'Erro ao registrar movimentação');
      return false;
    }
  };

  const updateInvestment = async (
    id: string,
    input: {
      name?: string;
      ticker?: string;
      type_id?: string;
      institution?: string;
      due_date?: string | null;
      plan_type?: string | null;
      tax_regime?: string | null;
      notes?: string;
    }
  ) => {
    setError(null);
    try {
      const payload: any = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.ticker !== undefined) payload.ticker = input.ticker ? input.ticker.toUpperCase().trim() : null;
      if (input.type_id !== undefined) payload.type_id = input.type_id;
      if (input.institution !== undefined) payload.institution = input.institution || null;
      if (input.due_date !== undefined) payload.due_date = input.due_date || null;
      if (input.plan_type !== undefined) payload.plan_type = input.plan_type || null;
      if (input.tax_regime !== undefined) payload.tax_regime = input.tax_regime || null;
      if (input.notes !== undefined) payload.notes = input.notes || null;

      const { error } = await (supabase
        .from('investments') as any)
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error updating investment:', err);
      setError(err.message || 'Erro ao atualizar investimento');
      return false;
    }
  };

  const deleteInvestment = async (id: string) => {
    setError(null);
    try {
      await (supabase.from('investment_entries') as any).delete().eq('investment_id', id);

      const { error } = await (supabase
        .from('investments') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error deleting investment:', err);
      setError(err.message || 'Erro ao excluir investimento');
      return false;
    }
  };

  // Batch import from Investidor10 or AI Scan
  const batchImportInvestments = async (assets: {
    ticker?: string;
    name: string;
    type?: string;
    quantity: number;
    averagePrice: number;
    totalInvested: number;
    currentPrice?: number;
    institution?: string;
  }[]): Promise<boolean> => {
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

      // Helper to map type string to existing investment_type UUID
      const getTypeId = (rawType?: string, ticker?: string): string | null => {
        const t = (rawType || '').toLowerCase();
        const tick = (ticker || '').toUpperCase();

        if (t.includes('fii') || t.includes('imob') || tick.endsWith('11')) {
          const match = types.find(it => it.name.toLowerCase().includes('fii'));
          if (match) return match.id;
        }
        if (t.includes('ação') || t.includes('acoes') || t.includes('stock')) {
          const match = types.find(it => it.name.toLowerCase().includes('ações') || it.name.toLowerCase().includes('acoes'));
          if (match) return match.id;
        }
        if (t.includes('renda fixa') || t.includes('cdb') || t.includes('lci') || t.includes('lca') || t.includes('cra') || t.includes('cri')) {
          const match = types.find(it => it.name.toLowerCase().includes('renda fixa'));
          if (match) return match.id;
        }
        if (t.includes('tesouro')) {
          const match = types.find(it => it.name.toLowerCase().includes('tesouro'));
          if (match) return match.id;
        }
        if (t.includes('cripto') || t.includes('crypto') || t.includes('bitcoin') || t.includes('btc') || t.includes('eth')) {
          const match = types.find(it => it.name.toLowerCase().includes('cripto'));
          if (match) return match.id;
        }
        if (t.includes('previd') || t.includes('pgbl') || t.includes('vgbl') || t.includes('prev') || t.includes('pension')) {
          const match = types.find(it => it.name.toLowerCase().includes('previd'));
          if (match) return match.id;
        }
        if (t.includes('etf')) {
          const match = types.find(it => it.name.toLowerCase().includes('etf'));
          if (match) return match.id;
        }
        return types[0]?.id || null;
      };

      for (const item of assets) {
        const resolvedTypeId = getTypeId(item.type, item.ticker);
        const resolvedName = item.name || item.ticker || 'Novo Ativo';
        const total = item.totalInvested > 0 ? item.totalInvested : item.quantity * item.averagePrice;
        const avg = item.averagePrice > 0 ? item.averagePrice : (item.quantity > 0 ? total / item.quantity : 0);

        // Check if investment with same ticker or name already exists in this family
        const existing = investments.find(
          i => (item.ticker && i.ticker?.toUpperCase() === item.ticker.toUpperCase()) ||
               i.name.toLowerCase() === resolvedName.toLowerCase()
        );

        if (existing) {
          // Add as a new entry
          await (supabase.from('investment_entries') as any).insert({
            investment_id: existing.id,
            user_id: user.id,
            type: 'aporte',
            amount: total,
            quantity: item.quantity,
            unit_price: avg,
            fees: 0,
            date: new Date().toISOString().split('T')[0],
            notes: 'Importado do Investidor10'
          });
        } else {
          // Insert new investment
          const { data: newInv, error: insErr } = await (supabase
            .from('investments')
            .insert({
              family_id: profile.family_id,
              user_id: user.id,
              type_id: resolvedTypeId,
              name: resolvedName,
              ticker: item.ticker ? item.ticker.toUpperCase().trim() : null,
              quantity: item.quantity,
              average_price: avg,
              current_price: item.currentPrice || avg,
              institution: item.institution || 'Investidor10',
              notes: 'Importado do Investidor10'
            } as any)
            .select('id')
            .single() as any);

          if (!insErr && newInv) {
            await (supabase.from('investment_entries') as any).insert({
              investment_id: newInv.id,
              user_id: user.id,
              type: 'aporte',
              amount: total,
              quantity: item.quantity,
              unit_price: avg,
              fees: 0,
              date: new Date().toISOString().split('T')[0],
              notes: 'Posição Inicial'
            });
          }
        }
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Error batch importing investments:', err);
      setError(err.message || 'Erro ao importar carteira');
      return false;
    }
  };

  return {
    investments,
    types,
    loading,
    error,
    isSyncingQuotes,
    refreshData,
    syncLiveQuotes,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addInvestmentEntry,
    batchImportInvestments
  };
}
