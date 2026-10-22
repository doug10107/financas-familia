import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  OptionStrategy, 
  OptionLeg, 
  StrategyCategory,
  analyzeStrategy 
} from '@/lib/options/optionsEngine';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'financas_options_strategies';

function mapDbToStrategy(row: any): OptionStrategy {
  let legs: OptionLeg[] = [];
  if (Array.isArray(row.legs)) {
    legs = row.legs;
  } else if (typeof row.legs === 'string') {
    try {
      legs = JSON.parse(row.legs);
    } catch {
      legs = [];
    }
  }

  return {
    id: String(row.id),
    name: row.name || 'Estratégia de Opções',
    underlyingTicker: (row.underlying_ticker || row.underlyingTicker || '').toUpperCase(),
    underlyingPrice: Number(row.underlying_price ?? row.underlyingPrice ?? 0),
    strategyCategory: (row.strategy_category || row.strategyCategory || 'personalizada') as StrategyCategory,
    legs,
    quantity: Number(row.quantity ?? 100),
    entryCostPerUnit: Number(row.entry_cost_per_unit ?? row.entryCostPerUnit ?? 0),
    totalEntryCost: Number(row.total_entry_cost ?? row.totalEntryCost ?? 0),
    entryDate: row.entry_date || row.entryDate || new Date().toISOString().split('T')[0],
    targetProfit50: Number(row.target_profit_50 ?? row.targetProfit50 ?? 0),
    targetProfit80: Number(row.target_profit_80 ?? row.targetProfit80 ?? 0),
    stopLossPrice: Number(row.stop_loss_price ?? row.stopLossPrice ?? 0),
    maxProfitPerUnit: row.max_profit_per_unit != null 
      ? Number(row.max_profit_per_unit) 
      : (row.maxProfitPerUnit != null ? Number(row.maxProfitPerUnit) : undefined),
    status: (row.status || 'active') as any,
    notes: row.notes || undefined,
    underlyingDy5y: row.underlying_dy_5y != null ? Number(row.underlying_dy_5y) : (row.underlyingDy5y != null ? Number(row.underlyingDy5y) : undefined),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
  };
}

function mapStrategyToDb(strat: OptionStrategy, familyId: string, userId?: string | null) {
  return {
    id: strat.id,
    family_id: familyId,
    user_id: userId || null,
    name: strat.name,
    underlying_ticker: (strat.underlyingTicker || '').toUpperCase(),
    underlying_price: strat.underlyingPrice || 0,
    strategy_category: strat.strategyCategory || 'personalizada',
    legs: strat.legs as any,
    quantity: strat.quantity || 100,
    entry_cost_per_unit: strat.entryCostPerUnit || 0,
    total_entry_cost: strat.totalEntryCost || 0,
    entry_date: strat.entryDate || new Date().toISOString().split('T')[0],
    target_profit_50: strat.targetProfit50 || 0,
    target_profit_80: strat.targetProfit80 || 0,
    stop_loss_price: strat.stopLossPrice || 0,
    max_profit_per_unit: strat.maxProfitPerUnit != null ? strat.maxProfitPerUnit : null,
    status: strat.status || 'active',
    notes: strat.notes || null,
    underlying_dy_5y: strat.underlyingDy5y != null ? strat.underlyingDy5y : null,
    updated_at: new Date().toISOString()
  };
}

export function useOptionsStrategies(investments: any[] = []) {
  const [strategies, setStrategies] = useState<OptionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // 30 seconds
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const supabase = createClient();
  const alertSentMap = useRef<Record<string, boolean>>({});
  const initialSyncDone = useRef(false);
  const authRef = useRef<{ userId: string; familyId: string } | null>(null);

  // Helper to fetch user & family ID
  const getFamilyAndUser = useCallback(async () => {
    if (authRef.current) return authRef.current;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await (supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as any);

      if (profile?.family_id) {
        authRef.current = { userId: user.id, familyId: profile.family_id };
        return authRef.current;
      }
      return null;
    } catch {
      return null;
    }
  }, [supabase]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    }
    return 'denied';
  }, []);

  // Check and dispatch notifications
  const checkStrategyAlerts = useCallback((strat: OptionStrategy) => {
    const analysis = analyzeStrategy(strat);
    const alertKey = `${strat.id}-${strat.updatedAt}`;

    if (alertSentMap.current[alertKey]) return;

    if (analysis.statusBadge.color === 'emerald') {
      alertSentMap.current[alertKey] = true;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🎯 ALVO ATINGIDO: ${strat.name}`, {
          body: `O spread atingiu R$ ${analysis.currentSpread.toFixed(2)} (+${analysis.pnlPercent.toFixed(1)}%). Recomendado desmontar!`,
          icon: '/favicon.ico'
        });
      }
    } else if (analysis.statusBadge.color === 'red') {
      alertSentMap.current[alertKey] = true;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🛑 STOP LOSS: ${strat.name}`, {
          body: `O spread recuou para R$ ${analysis.currentSpread.toFixed(2)} (${analysis.pnlPercent.toFixed(1)}%). Avalie desmontar.`,
          icon: '/favicon.ico'
        });
      }
    }
  }, []);

  // Update local storage cache helper
  const saveToLocalStorage = useCallback((updated: OptionStrategy[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
  }, []);

  // Fetch strategies (Supabase cloud first with auto-migration from localStorage fallback)
  const fetchStrategies = useCallback(async () => {
    setLoading(true);

    // 1. Instant local cache load
    let localList: OptionStrategy[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Remove legacy hardcoded example if present
          localList = parsed.filter((s: OptionStrategy) => s && s.id !== 'strat-bova-trava-baixa-1');
          setStrategies(localList);
        }
      }
    } catch (e) {
      console.warn('Erro ao ler localStorage de opções:', e);
    }

    // 2. Query Supabase cloud
    try {
      const auth = await getFamilyAndUser();
      if (auth?.familyId) {
        const { data: dbData, error: dbError } = await (supabase as any)
          .from('options_strategies')
          .select('*')
          .eq('family_id', auth.familyId)
          .order('created_at', { ascending: false });

        if (!dbError && Array.isArray(dbData)) {
          if (dbData.length > 0) {
            const mappedList = dbData.map(mapDbToStrategy);
            setStrategies(mappedList);
            saveToLocalStorage(mappedList);
            setLoading(false);
            return;
          } else if (localList.length > 0) {
            // Supabase tá vazio mas este dispositivo (PC) já tinha estratégias cadastradas no localStorage.
            // Sobe para a nuvem automaticamente para ficar disponível no celular e em outros dispositivos!
            console.info('[useOptionsStrategies] Sincronizando estratégias locais para o Supabase...');
            const inserts = localList.map(s => mapStrategyToDb(s, auth.familyId, auth.userId));
            await (supabase as any).from('options_strategies').insert(inserts);
          }
        } else if (dbError) {
          // Se a tabela ainda não foi criada no Supabase (código 42P01), usa o cache local sem quebrar
          console.warn('[useOptionsStrategies] Tabela de opções não disponível no Supabase:', dbError.message);
        }
      }
    } catch (err) {
      console.warn('[useOptionsStrategies] Erro ao sincronizar com Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [getFamilyAndUser, supabase, saveToLocalStorage]);

  // Initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    fetchStrategies();
  }, [fetchStrategies]);

  // Helper to persist list both locally and to Supabase
  const saveStrategies = useCallback((updated: OptionStrategy[]) => {
    setStrategies(updated);
    saveToLocalStorage(updated);
  }, [saveToLocalStorage]);

  // 1. SINCRONIZAÇÃO AUTOMÁTICA EM TEMPO REAL COM A LISTA DE ATIVOS
  useEffect(() => {
    if (!investments || investments.length === 0 || strategies.length === 0) return;

    // Build price map from Lista de Ativos
    const assetPriceMap = new Map<string, number>();
    investments.forEach(inv => {
      const cleanTicker = (inv.ticker || '').trim().toUpperCase();
      const cleanName = (inv.name || '').trim().toUpperCase();
      const price = typeof inv.current_price === 'number' && inv.current_price > 0 
        ? inv.current_price 
        : (typeof inv.average_price === 'number' && inv.average_price > 0 ? inv.average_price : 0);

      if (price > 0) {
        if (cleanTicker) {
          assetPriceMap.set(cleanTicker, price);
          assetPriceMap.set(cleanTicker.replace('.SA', ''), price);
        }
        if (cleanName) {
          assetPriceMap.set(cleanName, price);
          assetPriceMap.set(cleanName.replace('.SA', ''), price);
        }
      }
    });

    let hasChanges = false;
    const nextStrategies = strategies.map(strat => {
      let stratChanged = false;

      // Update underlying asset price if available in Lista de Ativos
      let undPrice = strat.underlyingPrice;
      const underlyingQuote = assetPriceMap.get(strat.underlyingTicker.toUpperCase().replace('.SA', ''));
      if (underlyingQuote !== undefined && underlyingQuote > 0 && underlyingQuote !== undPrice) {
        undPrice = underlyingQuote;
        stratChanged = true;
      }

      const nextLegs = strat.legs.map(leg => {
        if (leg.manualOverride) return leg;

        const cleanLegTicker = leg.ticker.trim().toUpperCase().replace('.SA', '');
        const assetPrice = assetPriceMap.get(cleanLegTicker);

        if (assetPrice !== undefined && assetPrice > 0 && assetPrice !== leg.currentPrice) {
          stratChanged = true;
          return {
            ...leg,
            currentPrice: assetPrice
          };
        }
        return leg;
      });

      if (stratChanged) {
        hasChanges = true;
        const updatedStrat: OptionStrategy = {
          ...strat,
          underlyingPrice: undPrice,
          legs: nextLegs,
          updatedAt: new Date().toISOString()
        };
        checkStrategyAlerts(updatedStrat);
        return updatedStrat;
      }
      return strat;
    });

    if (hasChanges) {
      saveStrategies(nextStrategies);
    }
  }, [investments, strategies, saveStrategies, checkStrategyAlerts]);

  // Sync Quotes for all active strategies from API
  const syncQuotes = useCallback(async () => {
    if (strategies.length === 0) return;

    setIsSyncing(true);
    try {
      const tickersToFetch = new Set<string>();
      strategies.forEach(s => {
        if (s.underlyingTicker) tickersToFetch.add(s.underlyingTicker);
        s.legs.forEach(l => {
          if (l.ticker) tickersToFetch.add(l.ticker);
        });
      });

      const tickerArray = Array.from(tickersToFetch);

      const res = await fetch('/api/stocks/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickerArray })
      });

      if (res.ok) {
        const { quotes } = await res.json();

        if (quotes && Object.keys(quotes).length > 0) {
          const updated = strategies.map(strat => {
            let undPrice = strat.underlyingPrice;
            if (quotes[strat.underlyingTicker] && quotes[strat.underlyingTicker].price > 0) {
              undPrice = quotes[strat.underlyingTicker].price;
            }

            const updatedLegs = strat.legs.map(leg => {
              const quote = quotes[leg.ticker];
              if (quote) {
                return {
                  ...leg,
                  currentPrice: leg.manualOverride ? leg.currentPrice : (quote.price > 0 ? quote.price : leg.currentPrice),
                  bidPrice: quote.bidPrice || leg.bidPrice,
                  askPrice: quote.askPrice || leg.askPrice,
                  strike: quote.strike > 0 ? quote.strike : leg.strike
                };
              }
              return leg;
            });

            const updatedStrat: OptionStrategy = {
              ...strat,
              underlyingPrice: undPrice,
              legs: updatedLegs,
              updatedAt: new Date().toISOString()
            };

            checkStrategyAlerts(updatedStrat);
            return updatedStrat;
          });

          saveStrategies(updated);
          setLastSyncTime(new Date());
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar cotações de opções:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [strategies, saveStrategies, checkStrategyAlerts]);

  // Initial quote sync when strategies finish loading
  useEffect(() => {
    if (!loading && strategies.length > 0 && !initialSyncDone.current) {
      initialSyncDone.current = true;
      syncQuotes();
    }
  }, [loading, strategies.length, syncQuotes]);

  // Auto-refresh interval effect
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      syncQuotes();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, syncQuotes]);

  // CRUD Actions - With dual-sync to Supabase & localStorage
  const addStrategy = useCallback(async (newStrat: Omit<OptionStrategy, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created: OptionStrategy = {
      ...newStrat,
      id: `strat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextList = [created, ...strategies];
    saveStrategies(nextList);

    // Save to Supabase
    try {
      const auth = await getFamilyAndUser();
      if (auth?.familyId) {
        await (supabase as any)
          .from('options_strategies')
          .insert(mapStrategyToDb(created, auth.familyId, auth.userId));
      }
    } catch (err) {
      console.warn('[useOptionsStrategies] Erro ao salvar estratégia no Supabase:', err);
    }

    return created;
  }, [strategies, saveStrategies, getFamilyAndUser, supabase]);

  const updateStrategy = useCallback(async (id: string, updates: Partial<OptionStrategy>) => {
    let updatedStrat: OptionStrategy | null = null;
    const nextList = strategies.map(s => {
      if (s.id === id) {
        updatedStrat = {
          ...s,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        return updatedStrat;
      }
      return s;
    });

    saveStrategies(nextList);

    // Update in Supabase
    if (updatedStrat) {
      try {
        const auth = await getFamilyAndUser();
        if (auth?.familyId) {
          const dbPayload = mapStrategyToDb(updatedStrat, auth.familyId, auth.userId);
          await (supabase as any)
            .from('options_strategies')
            .update(dbPayload)
            .eq('id', id);
        }
      } catch (err) {
        console.warn('[useOptionsStrategies] Erro ao atualizar no Supabase:', err);
      }
    }
  }, [strategies, saveStrategies, getFamilyAndUser, supabase]);

  const deleteStrategy = useCallback(async (id: string) => {
    const nextList = strategies.filter(s => s.id !== id);
    saveStrategies(nextList);

    // Delete in Supabase
    try {
      const auth = await getFamilyAndUser();
      if (auth?.familyId) {
        await (supabase as any)
          .from('options_strategies')
          .delete()
          .eq('id', id);
      }
    } catch (err) {
      console.warn('[useOptionsStrategies] Erro ao excluir no Supabase:', err);
    }
  }, [strategies, saveStrategies, getFamilyAndUser, supabase]);

  const closeStrategy = useCallback((id: string) => {
    updateStrategy(id, { status: 'closed' });
  }, [updateStrategy]);

  // Manual override for a specific leg price (double click / pencil)
  const updateLegPrice = useCallback((strategyId: string, legTicker: string, newPrice: number) => {
    const strat = strategies.find(s => s.id === strategyId);
    if (!strat) return;

    const updatedLegs = strat.legs.map(l => {
      if (l.ticker.toUpperCase() === legTicker.toUpperCase()) {
        return { ...l, currentPrice: newPrice, manualOverride: true };
      }
      return l;
    });

    updateStrategy(strategyId, { legs: updatedLegs });
  }, [strategies, updateStrategy]);

  // Reset manual override back to real-time auto quotation
  const resetLegOverride = useCallback((strategyId: string, legTicker: string) => {
    const strat = strategies.find(s => s.id === strategyId);
    if (!strat) return;

    let autoPrice: number | undefined;
    const cleanTicker = legTicker.trim().toUpperCase().replace('.SA', '');

    if (investments && investments.length > 0) {
      const match = investments.find(inv => {
        const t = (inv.ticker || '').trim().toUpperCase().replace('.SA', '');
        const n = (inv.name || '').trim().toUpperCase().replace('.SA', '');
        return t === cleanTicker || n === cleanTicker;
      });
      if (match && typeof match.current_price === 'number' && match.current_price > 0) {
        autoPrice = match.current_price;
      }
    }

    const updatedLegs = strat.legs.map(l => {
      if (l.ticker.toUpperCase() === legTicker.toUpperCase()) {
        return {
          ...l,
          manualOverride: false,
          currentPrice: autoPrice !== undefined ? autoPrice : l.currentPrice
        };
      }
      return l;
    });

    updateStrategy(strategyId, { legs: updatedLegs });
  }, [strategies, investments, updateStrategy]);

  return {
    strategies,
    loading,
    isSyncing,
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval,
    lastSyncTime,
    notificationPermission,
    requestNotificationPermission,
    syncQuotes,
    addStrategy,
    updateStrategy,
    deleteStrategy,
    closeStrategy,
    updateLegPrice,
    resetLegOverride,
    refreshStrategies: fetchStrategies
  };
}
