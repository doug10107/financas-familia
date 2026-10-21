import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  OptionStrategy, 
  OptionLeg, 
  StrategyCategory,
  analyzeStrategy 
} from '@/lib/options/optionsEngine';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'financas_options_strategies';

// Default initial strategy for testing (matches user's real-life example)
const INITIAL_DEFAULT_STRATEGIES: OptionStrategy[] = [
  {
    id: 'strat-bova-trava-baixa-1',
    name: 'Trava de Baixa - BOVA11 (205 x 199)',
    underlyingTicker: 'BOVA11',
    underlyingPrice: 121.45,
    strategyCategory: 'trava_baixa',
    quantity: 100,
    entryCostPerUnit: 2.13,
    totalEntryCost: 213.00,
    entryDate: '2026-10-15',
    targetProfit50: 3.20,
    targetProfit80: 3.83,
    stopLossPrice: 1.06,
    maxProfitPerUnit: 3.87,
    status: 'active',
    notes: 'Operação de trava de baixa visando queda ou lateralização do índice.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    legs: [
      {
        id: 'leg-1',
        ticker: 'BOVAW205',
        type: 'PUT',
        side: 'buy',
        strike: 205.00,
        entryPrice: 2.21,
        currentPrice: 3.28,
        bidPrice: 3.25,
        askPrice: 3.30,
        quantity: 100,
        expirationDate: '2026-11-20'
      },
      {
        id: 'leg-2',
        ticker: 'BOVAW199',
        type: 'PUT',
        side: 'sell',
        strike: 199.00,
        entryPrice: 0.08,
        currentPrice: 0.08,
        bidPrice: 0.07,
        askPrice: 0.09,
        quantity: 100,
        expirationDate: '2026-11-20'
      }
    ]
  }
];

export function useOptionsStrategies(investments: any[] = []) {
  const [strategies, setStrategies] = useState<OptionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // 30 seconds
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const supabase = createClient();
  const alertSentMap = useRef<Record<string, boolean>>({});

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

  // Load strategies from storage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize any legacy typo (e.g. BOVAW19 -> BOVAW199)
          const sanitized = parsed.map((s: OptionStrategy) => ({
            ...s,
            legs: (s.legs || []).map(l => ({
              ...l,
              ticker: l.ticker === 'BOVAW19' ? 'BOVAW199' : l.ticker
            }))
          }));
          setStrategies(sanitized);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar estratégias de opções do localStorage:', e);
    }

    // Default seed
    setStrategies(INITIAL_DEFAULT_STRATEGIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_STRATEGIES));
    } catch {}
    setLoading(false);
  }, []);

  // Save to localStorage when state updates
  const saveStrategies = useCallback((updated: OptionStrategy[]) => {
    setStrategies(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao salvar estratégias:', e);
    }
  }, []);

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
        // If user manually overrode the price via double-click, preserve the override
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
      // Gather all tickers (options and underlying assets)
      const tickersToFetch = new Set<string>();
      strategies.forEach(s => {
        if (s.underlyingTicker) tickersToFetch.add(s.underlyingTicker);
        s.legs.forEach(l => {
          if (l.ticker) tickersToFetch.add(l.ticker);
        });
      });

      const tickerArray = Array.from(tickersToFetch);

      // 1. Fetch Option & Stock Quotes
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
              if (quote && quote.price > 0) {
                return {
                  ...leg,
                  // Do not override user's manual override
                  currentPrice: leg.manualOverride ? leg.currentPrice : quote.price,
                  bidPrice: quote.bidPrice || leg.bidPrice,
                  askPrice: quote.askPrice || leg.askPrice,
                  strike: leg.strike || quote.strike
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

            // Check alerts
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

  // Auto-refresh interval effect
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      syncQuotes();
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, syncQuotes]);

  // CRUD Actions
  const addStrategy = useCallback((newStrat: Omit<OptionStrategy, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created: OptionStrategy = {
      ...newStrat,
      id: `strat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextList = [created, ...strategies];
    saveStrategies(nextList);
    return created;
  }, [strategies, saveStrategies]);

  const updateStrategy = useCallback((id: string, updates: Partial<OptionStrategy>) => {
    const nextList = strategies.map(s => {
      if (s.id === id) {
        return {
          ...s,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    });
    saveStrategies(nextList);
  }, [strategies, saveStrategies]);

  const deleteStrategy = useCallback((id: string) => {
    const nextList = strategies.filter(s => s.id !== id);
    saveStrategies(nextList);
  }, [strategies, saveStrategies]);

  const closeStrategy = useCallback((id: string) => {
    updateStrategy(id, { status: 'closed' });
  }, [updateStrategy]);

  // Manual override for a specific leg price (double click / pencil)
  const updateLegPrice = useCallback((strategyId: string, legTicker: string, newPrice: number) => {
    const nextList = strategies.map(s => {
      if (s.id === strategyId) {
        const updatedLegs = s.legs.map(l => {
          if (l.ticker.toUpperCase() === legTicker.toUpperCase()) {
            return { ...l, currentPrice: newPrice, manualOverride: true };
          }
          return l;
        });
        return { ...s, legs: updatedLegs, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    saveStrategies(nextList);
  }, [strategies, saveStrategies]);

  // Reset manual override back to real-time auto quotation
  const resetLegOverride = useCallback((strategyId: string, legTicker: string) => {
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

    const nextList = strategies.map(s => {
      if (s.id === strategyId) {
        const updatedLegs = s.legs.map(l => {
          if (l.ticker.toUpperCase() === legTicker.toUpperCase()) {
            return {
              ...l,
              manualOverride: false,
              currentPrice: autoPrice !== undefined ? autoPrice : l.currentPrice
            };
          }
          return l;
        });
        return { ...s, legs: updatedLegs, updatedAt: new Date().toISOString() };
      }
      return s;
    });
    saveStrategies(nextList);
  }, [strategies, investments, saveStrategies]);

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
    resetLegOverride
  };
}
