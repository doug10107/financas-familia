import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  calculateMonthlySettlement,
  MonthlyTaxSettlement,
  RawBrokerageNote,
  RawBrokerageOrder
} from '@/lib/tax/taxEngine';

export interface BrokerageNoteRecord {
  id: string;
  broker_name: string;
  note_number: string | null;
  trading_date: string;
  clearing_date: string | null;
  total_operations: number;
  net_amount: number;
  settlement_fee: number;
  registration_fee: number;
  emoluments: number;
  brokerage_fee: number;
  taxes: number;
  other_expenses: number;
  irrf_amount: number;
  irrf_base: number;
  raw_file_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface BrokerageOrderRecord {
  id: string;
  note_id: string;
  ticker: string;
  asset_name: string | null;
  asset_category: 'Ações' | 'FIIs' | 'ETFs' | 'BDRs' | 'Opções' | 'Futuros';
  operation_type: 'C' | 'V';
  market_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  apportioned_costs: number;
  effective_total: number;
  effective_unit_price: number;
  is_day_trade: boolean;
  trading_date: string;
}

export function useTaxCalculator() {
  const [notes, setNotes] = useState<BrokerageNoteRecord[]>([]);
  const [orders, setOrders] = useState<BrokerageOrderRecord[]>([]);
  const [settlements, setSettlements] = useState<MonthlyTaxSettlement[]>([]);
  const [initialLosses, setInitialLosses] = useState({
    swingTradeLoss: 0,
    dayTradeLoss: 0,
    fiisLoss: 0,
    accumulatedIrrf: 0,
    carriedOverDarf: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchInitialLosses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tax_loss_carry')
        .select('*');

      if (error) {
        console.warn('Erro ao carregar tax_loss_carry:', error);
        return;
      }

      if (data && data.length > 0) {
        let swing = 0;
        let dayTrade = 0;
        let fiis = 0;
        let irrf = 0;

        data.forEach((row: any) => {
          if (row.category === 'swing_trade') swing = Number(row.accumulated_loss) || 0;
          if (row.category === 'day_trade') dayTrade = Number(row.accumulated_loss) || 0;
          if (row.category === 'fiis') fiis = Number(row.accumulated_loss) || 0;
          if (row.accumulated_irrf) irrf += Number(row.accumulated_irrf) || 0;
        });

        setInitialLosses({
          swingTradeLoss: swing,
          dayTradeLoss: dayTrade,
          fiisLoss: fiis,
          accumulatedIrrf: irrf,
          carriedOverDarf: 0
        });
      }
    } catch (err: any) {
      console.warn('Erro ao carregar prejuízos anteriores:', err);
    }
  }, [supabase]);

  const fetchNotesAndOrders = useCallback(async () => {
    try {
      const [notesRes, ordersRes] = await Promise.all([
        supabase.from('brokerage_notes').select('*').order('trading_date', { ascending: false }),
        supabase.from('brokerage_orders').select('*').order('trading_date', { ascending: true })
      ]);

      if (notesRes.error) throw notesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setNotes((notesRes.data || []) as BrokerageNoteRecord[]);
      setOrders((ordersRes.data || []) as BrokerageOrderRecord[]);
      return {
        fetchedNotes: (notesRes.data || []) as BrokerageNoteRecord[],
        fetchedOrders: (ordersRes.data || []) as BrokerageOrderRecord[]
      };
    } catch (err: any) {
      console.error('Erro ao buscar notas e ordens:', err);
      throw err;
    }
  }, [supabase]);

  // Recalcula apuração de todos os meses de forma cronológica encadeada
  const computeAllSettlements = useCallback((
    allOrders: BrokerageOrderRecord[],
    allNotes: BrokerageNoteRecord[],
    baseLosses: typeof initialLosses
  ) => {
    if (!allOrders || allOrders.length === 0) {
      // Se não houver ordens, cria pelo menos o mês atual para exibição de status
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { settlement } = calculateMonthlySettlement(currentPeriod, [], new Map(), baseLosses, 0);
      setSettlements([settlement]);
      return;
    }

    // Agrupa ordens por mês 'YYYY-MM'
    const monthMap: { [key: string]: RawBrokerageOrder[] } = {};
    allOrders.forEach(o => {
      const monthKey = o.trading_date.slice(0, 7);
      if (!monthMap[monthKey]) monthMap[monthKey] = [];
      monthMap[monthKey].push(o as any);
    });

    // Agrupa IRRF das notas por mês
    const irrfMonthMap: { [key: string]: number } = {};
    allNotes.forEach(n => {
      const monthKey = n.trading_date.slice(0, 7);
      irrfMonthMap[monthKey] = (irrfMonthMap[monthKey] || 0) + (Number(n.irrf_amount) || 0);
    });

    // Garante que o mês atual esteja na lista mesmo se ainda não tiver ordens
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[currentPeriod]) {
      monthMap[currentPeriod] = [];
    }

    const sortedMonths = Object.keys(monthMap).sort((a, b) => a.localeCompare(b));

    let runningPositions = new Map<string, { quantity: number; averagePrice: number }>();
    let currentLosses = { ...baseLosses };
    const calculatedSettlements: MonthlyTaxSettlement[] = [];

    for (const monthKey of sortedMonths) {
      const monthOrders = monthMap[monthKey] || [];
      const irrfRetidoMes = irrfMonthMap[monthKey] || 0;

      const { settlement, updatedPositions } = calculateMonthlySettlement(
        monthKey,
        monthOrders,
        runningPositions,
        currentLosses,
        irrfRetidoMes
      );

      runningPositions = updatedPositions;
      calculatedSettlements.push(settlement);

      // Atualiza os prejuízos e IRRF acumulados que passam para o próximo mês
      currentLosses = {
        swingTradeLoss: settlement.swingTrade.lossCarriedForward,
        dayTradeLoss: settlement.dayTrade.lossCarriedForward,
        fiisLoss: settlement.fiis.lossCarriedForward,
        accumulatedIrrf: settlement.irrfAccumulatedRemaining,
        carriedOverDarf: settlement.isUnderMinimum ? (settlement.darfCarriedOverFromPast + settlement.darfAmount) : 0
      };
    }

    // Exibe os meses em ordem decrescente (mais recente primeiro)
    setSettlements(calculatedSettlements.reverse());
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchInitialLosses();
      const { fetchedNotes, fetchedOrders } = await fetchNotesAndOrders();
      computeAllSettlements(fetchedOrders, fetchedNotes, initialLosses);
    } catch (err: any) {
      console.error('Error refreshing tax calculator:', err);
      setError(err.message || 'Erro ao carregar dados fiscais.');
    } finally {
      setLoading(false);
    }
  }, [fetchInitialLosses, fetchNotesAndOrders, computeAllSettlements, initialLosses]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Salva uma nova nota de corretagem com suas ordens
  const saveBrokerageNote = async (note: RawBrokerageNote, updateMainPortfolio: boolean = true): Promise<boolean> => {
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as any;

      if (!profile) throw new Error('Perfil familiar não encontrado');

      // 1. Insere a Nota
      const { data: savedNote, error: noteErr } = await (supabase
        .from('brokerage_notes')
        .insert({
          family_id: profile.family_id,
          user_id: user.id,
          broker_name: note.broker_name || 'íon Itaú',
          note_number: note.note_number || null,
          trading_date: note.trading_date,
          clearing_date: note.clearing_date || null,
          total_operations: note.total_operations,
          net_amount: note.net_amount,
          settlement_fee: note.settlement_fee || 0,
          registration_fee: note.registration_fee || 0,
          emoluments: note.emoluments || 0,
          brokerage_fee: note.brokerage_fee || 0,
          taxes: note.taxes || 0,
          other_expenses: note.other_expenses || 0,
          irrf_amount: note.irrf_amount || 0,
          irrf_base: note.irrf_base || 0,
          raw_file_name: note.broker_name || 'Nota_Corretagem'
        } as any)
        .select('id')
        .single() as any);

      if (noteErr) throw noteErr;

      // 2. Insere as Ordens
      if (note.orders && note.orders.length > 0) {
        const ordersToInsert = note.orders.map(o => ({
          note_id: savedNote.id,
          family_id: profile.family_id,
          ticker: o.ticker.toUpperCase().trim(),
          asset_name: o.asset_name || o.ticker,
          asset_category: o.asset_category || 'Ações',
          operation_type: o.operation_type,
          market_type: o.market_type || 'VISTA',
          quantity: o.quantity,
          unit_price: o.unit_price,
          total_price: o.total_price,
          apportioned_costs: o.apportioned_costs || 0,
          effective_total: o.effective_total || o.total_price,
          effective_unit_price: o.effective_unit_price || o.unit_price,
          is_day_trade: Boolean(o.is_day_trade),
          trading_date: note.trading_date
        }));

        const { error: ordErr } = await (supabase
          .from('brokerage_orders')
          .insert(ordersToInsert as any) as any);

        if (ordErr) throw ordErr;
      }

      // 3. Atualiza ou cria investimentos na carteira principal se solicitado
      if (updateMainPortfolio && note.orders && note.orders.length > 0) {
        try {
          const { data: existingInvs } = await supabase
            .from('investments')
            .select('id, ticker, quantity, average_price, current_balance, total_invested');

          const { data: types } = await (supabase
            .from('investment_types') as any)
            .select('id, name');

          const typeList = (types as Array<{ id: string; name: string }>) || [];
          const getTypeIdForCat = (cat: string) => {
            const c = (cat || '').toLowerCase();
            const match = typeList.find(t => t.name.toLowerCase().includes(c));
            return match ? match.id : typeList[0]?.id || null;
          };

          for (const ord of note.orders) {
            const sym = ord.ticker.toUpperCase().trim();
            const matchInv = (existingInvs as any[])?.find((i: any) => i.ticker?.toUpperCase() === sym);

            if (ord.operation_type === 'C') {
              if (matchInv) {
                // Adiciona aporte
                await (supabase.from('investment_entries') as any).insert({
                  investment_id: matchInv.id,
                  user_id: user.id,
                  type: 'aporte',
                  amount: ord.effective_total || ord.total_price,
                  quantity: ord.quantity,
                  unit_price: ord.effective_unit_price || ord.unit_price,
                  fees: ord.apportioned_costs || 0,
                  date: note.trading_date,
                  notes: `Nota ${note.note_number || ''} (${note.broker_name || 'íon'})`
                });
              } else {
                // Cria novo ativo
                const { data: newInv } = await (supabase
                  .from('investments')
                  .insert({
                    family_id: profile.family_id,
                    user_id: user.id,
                    type_id: getTypeIdForCat(ord.asset_category || 'Ações'),
                    name: ord.asset_name || sym,
                    ticker: sym,
                    quantity: ord.quantity,
                    average_price: ord.effective_unit_price || ord.unit_price,
                    current_price: ord.unit_price,
                    institution: note.broker_name || 'íon Itaú',
                    notes: `Adicionado via Nota ${note.note_number || ''}`
                  } as any)
                  .select('id')
                  .single() as any);

                if (newInv) {
                  await (supabase.from('investment_entries') as any).insert({
                    investment_id: newInv.id,
                    user_id: user.id,
                    type: 'aporte',
                    amount: ord.effective_total || ord.total_price,
                    quantity: ord.quantity,
                    unit_price: ord.effective_unit_price || ord.unit_price,
                    fees: ord.apportioned_costs || 0,
                    date: note.trading_date,
                    notes: 'Aporte Inicial via Nota'
                  });
                }
              }
            } else if (ord.operation_type === 'V' && matchInv) {
              // Registra resgate
              await (supabase.from('investment_entries') as any).insert({
                investment_id: matchInv.id,
                user_id: user.id,
                type: 'resgate',
                amount: ord.effective_total || ord.total_price,
                quantity: ord.quantity,
                unit_price: ord.effective_unit_price || ord.unit_price,
                fees: ord.apportioned_costs || 0,
                date: note.trading_date,
                notes: `Venda via Nota ${note.note_number || ''}`
              });
            }
          }
        } catch (portErr) {
          console.warn('Aviso: Não foi possível sincronizar com carteira principal:', portErr);
        }
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar nota de corretagem:', err);
      setError(err.message || 'Erro ao registrar nota de corretagem');
      return false;
    }
  };

  // Exclui uma nota e suas ordens vinculadas
  const deleteBrokerageNote = async (noteId: string): Promise<boolean> => {
    setError(null);
    try {
      const { error: delErr } = await (supabase
        .from('brokerage_notes')
        .delete()
        .eq('id', noteId) as any);

      if (delErr) throw delErr;
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Erro ao excluir nota:', err);
      setError(err.message || 'Erro ao excluir nota');
      return false;
    }
  };

  // Salva saldo inicial de prejuízos de anos/meses anteriores
  const saveHistoricalLosses = async (losses: {
    swingTradeLoss: number;
    dayTradeLoss: number;
    fiisLoss: number;
    accumulatedIrrf: number;
  }): Promise<boolean> => {
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

      const categories = [
        { cat: 'swing_trade', loss: losses.swingTradeLoss, irrf: losses.accumulatedIrrf },
        { cat: 'day_trade', loss: losses.dayTradeLoss, irrf: 0 },
        { cat: 'fiis', loss: losses.fiisLoss, irrf: 0 }
      ];

      for (const item of categories) {
        const { error: upsertErr } = await (supabase
          .from('tax_loss_carry')
          .upsert(
            {
              family_id: profile.family_id,
              category: item.cat,
              accumulated_loss: item.loss,
              accumulated_irrf: item.irrf,
              reference_date: new Date().toISOString().split('T')[0]
            } as any,
            { onConflict: 'family_id,category' }
          ) as any);

        if (upsertErr) throw upsertErr;
      }

      await refreshData();
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar prejuízos históricos:', err);
      setError(err.message || 'Erro ao salvar prejuízos acumulados');
      return false;
    }
  };

  return {
    notes,
    orders,
    settlements,
    initialLosses,
    loading,
    error,
    refreshData,
    saveBrokerageNote,
    deleteBrokerageNote,
    saveHistoricalLosses
  };
}
