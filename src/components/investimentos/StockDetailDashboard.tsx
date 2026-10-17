'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StockFullDetails } from '@/app/api/stocks/details/route';
import { Investment } from '@/hooks/useInvestments';

interface StockDetailDashboardProps {
  initialTicker?: string;
  investments?: Investment[];
  onOpenNewInvModal?: (prefilledTicker?: string, prefilledPrice?: number) => void;
  onClose?: () => void;
}

const POPULAR_STOCKS = [
  { ticker: 'CMIG4', label: 'CEMIG' },
  { ticker: 'BBAS3', label: 'Banco do Brasil' },
  { ticker: 'PETR4', label: 'Petrobras' },
  { ticker: 'VALE3', label: 'Vale' },
  { ticker: 'ITUB4', label: 'Itaú' },
  { ticker: 'TAEE11', label: 'Taesa' },
  { ticker: 'BBSE3', label: 'BB Seguridade' },
  { ticker: 'SAPR11', label: 'Sanepar' },
  { ticker: 'EGIE3', label: 'Engie' },
  { ticker: 'WEGE3', label: 'WEG' },
  { ticker: 'CPLE6', label: 'Copel' },
  { ticker: 'VIVT3', label: 'Vivo' }
];

function parseInputNum(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[R$\s%]/g, '').trim();
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(clean.replace(',', '.')) || 0;
}

function formatBillions(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1e9) {
    return `R$ ${sign}${(abs / 1e9).toFixed(2)} bi`;
  }
  if (abs >= 1e6) {
    return `R$ ${sign}${(abs / 1e6).toFixed(2)} mi`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatCurrencyBR(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
}

function formatDec(val: number | null | undefined, decimals = 2, suffix = ''): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return `${val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}${suffix}`;
}

export function StockDetailDashboard({
  initialTicker = 'CMIG4',
  investments = [],
  onOpenNewInvModal,
  onClose
}: StockDetailDashboardProps) {
  const [searchInput, setSearchInput] = useState(initialTicker || 'CMIG4');
  const [activeTicker, setActiveTicker] = useState(initialTicker || 'CMIG4');
  const [stock, setStock] = useState<StockFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    valuation: true,
    rentabilidade: true,
    endividamento: true
  });

  // --- 1. BAZIN INTERACTIVE STATE ---
  const [bazinDpaInput, setBazinDpaInput] = useState('1,52');
  const [bazinPeriodMode, setBazinPeriodMode] = useState<'1y' | '3y' | '5y'>('5y');
  const [bazinTargetDy, setBazinTargetDy] = useState(6.0);

  // --- 2. GRAHAM INTERACTIVE STATE ---
  const [grahamLpaInput, setGrahamLpaInput] = useState('1,80');
  const [grahamVpaInput, setGrahamVpaInput] = useState('10,45');

  // --- 3. PETER LYNCH INTERACTIVE STATE ---
  const [lynchDyInput, setLynchDyInput] = useState('8,03');
  const [lynchGrowthInput, setLynchGrowthInput] = useState('3,00');

  // --- 4. PREÇO TETO PROJETIVO (BARSI / AGF+) STATE ---
  const [projTargetDy, setProjTargetDy] = useState('6');
  const [projPayout, setProjPayout] = useState('81,42');
  const [projBaseProfit, setProjBaseProfit] = useState(4325639000);
  const [projGrowthPct, setProjGrowthPct] = useState(0); // -50% to +100%
  const [savedToast, setSavedToast] = useState('');

  // --- 5. VALUATION FLUXO DE CAIXA (DCF) STATE ---
  const [showDcfCalculator, setShowDcfCalculator] = useState(false);
  const [dcfDiscountRate, setDcfDiscountRate] = useState(12.0); // WACC / Taxa de desconto %
  const [dcfGrowth5y, setDcfGrowth5y] = useState(5.0); // Crescimento 5 anos %
  const [dcfPerpetualGrowth, setDcfPerpetualGrowth] = useState(3.0); // Crescimento na perpetuidade %

  // Sync when initialTicker changes from parent
  useEffect(() => {
    if (initialTicker && initialTicker.toUpperCase() !== activeTicker) {
      setSearchInput(initialTicker.toUpperCase());
      loadTickerDetails(initialTicker.toUpperCase());
    }
  }, [initialTicker]);

  // Initial load
  useEffect(() => {
    loadTickerDetails(activeTicker);
  }, []);

  const populateStatesFromStock = (data: StockFullDetails) => {
    // Check if user saved custom simulation for this ticker
    const savedSimRaw = typeof window !== 'undefined' ? localStorage.getItem(`stock_sim_${data.ticker}`) : null;
    if (savedSimRaw) {
      try {
        const saved = JSON.parse(savedSimRaw);
        if (saved.bazinDpaInput) setBazinDpaInput(saved.bazinDpaInput);
        if (saved.bazinTargetDy) setBazinTargetDy(saved.bazinTargetDy);
        if (saved.grahamLpaInput) setGrahamLpaInput(saved.grahamLpaInput);
        if (saved.grahamVpaInput) setGrahamVpaInput(saved.grahamVpaInput);
        if (saved.lynchDyInput) setLynchDyInput(saved.lynchDyInput);
        if (saved.lynchGrowthInput) setLynchGrowthInput(saved.lynchGrowthInput);
        if (saved.projTargetDy) setProjTargetDy(saved.projTargetDy);
        if (saved.projPayout) setProjPayout(saved.projPayout);
        if (saved.projBaseProfit) setProjBaseProfit(saved.projBaseProfit);
        if (saved.projGrowthPct !== undefined) setProjGrowthPct(saved.projGrowthPct);
        return;
      } catch {
        // fallback to live data
      }
    }

    const dpa = data.dpa5yAvg > 0 ? data.dpa5yAvg : data.dpa1y;
    setBazinDpaInput(dpa > 0 ? dpa.toFixed(2).replace('.', ',') : '1,00');
    setBazinTargetDy(6.0);

    setGrahamLpaInput(data.lpa !== null ? data.lpa.toFixed(2).replace('.', ',') : '0,00');
    setGrahamVpaInput(data.vpa !== null ? data.vpa.toFixed(2).replace('.', ',') : '0,00');

    setLynchDyInput(data.dy !== null ? data.dy.toFixed(2).replace('.', ',') : '6,00');
    const defaultGrowth = data.crescRec5a !== null && data.crescRec5a > 0 ? Math.min(data.crescRec5a, 15) : 5.0;
    setLynchGrowthInput(defaultGrowth.toFixed(2).replace('.', ','));

    setProjTargetDy('6');
    setProjPayout(data.payout !== null ? data.payout.toFixed(2).replace('.', ',') : '50,00');
    setProjBaseProfit(data.lucroLiquido12m || (data.lpa && data.totalShares ? data.lpa * data.totalShares : 1000000000));
    setProjGrowthPct(0);
  };

  const loadTickerDetails = async (tickerToFetch: string) => {
    const clean = tickerToFetch.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError('');
    setActiveTicker(clean);

    try {
      const res = await fetch(`/api/stocks/details?ticker=${encodeURIComponent(clean)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data: StockFullDetails = await res.json();
        setStock(data);
        populateStatesFromStock(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Não foi possível carregar os dados deste ativo.');
      }
    } catch {
      setError('Erro de conexão ao buscar indicadores fundamentalistas.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    if (!stock) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`stock_sim_${stock.ticker}`);
    }
    const dpa = stock.dpa5yAvg > 0 ? stock.dpa5yAvg : stock.dpa1y;
    setBazinDpaInput(dpa > 0 ? dpa.toFixed(2).replace('.', ',') : '1,00');
    setBazinTargetDy(6.0);
    setGrahamLpaInput(stock.lpa !== null ? stock.lpa.toFixed(2).replace('.', ',') : '0,00');
    setGrahamVpaInput(stock.vpa !== null ? stock.vpa.toFixed(2).replace('.', ',') : '0,00');
    setLynchDyInput(stock.dy !== null ? stock.dy.toFixed(2).replace('.', ',') : '6,00');
    const defaultGrowth = stock.crescRec5a !== null && stock.crescRec5a > 0 ? Math.min(stock.crescRec5a, 15) : 5.0;
    setLynchGrowthInput(defaultGrowth.toFixed(2).replace('.', ','));
    setProjTargetDy('6');
    setProjPayout(stock.payout !== null ? stock.payout.toFixed(2).replace('.', ',') : '50,00');
    setProjBaseProfit(stock.lucroLiquido12m || (stock.lpa && stock.totalShares ? stock.lpa * stock.totalShares : 1000000000));
    setProjGrowthPct(0);
    setSavedToast('Filtros restaurados para os dados oficiais do balanço!');
    setTimeout(() => setSavedToast(''), 3000);
  };

  const handleSaveSimulation = () => {
    if (!stock || typeof window === 'undefined') return;
    localStorage.setItem(
      `stock_sim_${stock.ticker}`,
      JSON.stringify({
        bazinDpaInput,
        bazinTargetDy,
        grahamLpaInput,
        grahamVpaInput,
        lynchDyInput,
        lynchGrowthInput,
        projTargetDy,
        projPayout,
        projBaseProfit,
        projGrowthPct
      })
    );
    setSavedToast(`Simulação de ${stock.ticker} salva com sucesso!`);
    setTimeout(() => setSavedToast(''), 3000);
  };

  const handleSwitchBazinPeriod = (mode: '1y' | '3y' | '5y') => {
    setBazinPeriodMode(mode);
    if (!stock) return;
    const val = mode === '1y' ? stock.dpa1y : mode === '3y' ? stock.dpa3yAvg : stock.dpa5yAvg;
    if (val > 0) {
      setBazinDpaInput(val.toFixed(2).replace('.', ','));
    }
  };

  // --- LIVE CALCULATIONS ---
  const currentPrice = stock?.currentPrice || 0;

  // 1. Bazin Calculation
  const bazinDpa = parseInputNum(bazinDpaInput);
  const bazinCeiling = bazinTargetDy > 0 ? bazinDpa / (bazinTargetDy / 100) : 0;
  // Margin of safety: ((Ceiling - Current) / Current) * 100 (as shown in the video: (25.35 - 18.33) / 18.33 = 38.28%)
  const bazinMargin = currentPrice > 0 && bazinCeiling > 0 ? ((bazinCeiling - currentPrice) / currentPrice) * 100 : 0;

  // 2. Graham Calculation
  const grahamLpa = parseInputNum(grahamLpaInput);
  const grahamVpa = parseInputNum(grahamVpaInput);
  const grahamCeiling = grahamLpa > 0 && grahamVpa > 0 ? Math.sqrt(22.5 * grahamLpa * grahamVpa) : 0;
  const grahamMargin = currentPrice > 0 && grahamCeiling > 0 ? ((grahamCeiling - currentPrice) / currentPrice) * 100 : 0;

  // 3. Peter Lynch Calculation: (DY + Growth) / P/L
  const lynchDy = parseInputNum(lynchDyInput);
  const lynchGrowth = parseInputNum(lynchGrowthInput);
  const plValue = stock?.pl && stock.pl > 0 ? stock.pl : grahamLpa > 0 ? currentPrice / grahamLpa : 0;
  const lynchScore = plValue > 0 ? (lynchDy + lynchGrowth) / plValue : 0;

  // 4. Preço Teto Projetivo Calculation
  const totalShares = stock?.totalShares && stock.totalShares > 0 ? stock.totalShares : 1;
  const projectedProfit = projBaseProfit * (1 + projGrowthPct / 100);
  const payoutPct = parseInputNum(projPayout);
  const targetDyPct = parseInputNum(projTargetDy) || 6;
  const projectedDpa = totalShares > 0 ? (projectedProfit * (payoutPct / 100)) / totalShares : 0;
  const projectedCeiling = targetDyPct > 0 ? projectedDpa / (targetDyPct / 100) : 0;
  const projectedYield = currentPrice > 0 ? (projectedDpa / currentPrice) * 100 : 0;
  const projectedMargin = currentPrice > 0 && projectedCeiling > 0 ? ((projectedCeiling - currentPrice) / currentPrice) * 100 : 0;

  // 5. DCF (Fluxo de Caixa Descontado) Calculation
  const dcfResult = useMemo(() => {
    if (!stock) return { fairPrice: 0, margin: 0, enterpriseFairValue: 0 };
    const baseCashFlow =
      (stock.lucroLiquido12m && stock.lucroLiquido12m > 0
        ? stock.lucroLiquido12m
        : stock.ebit12m
          ? stock.ebit12m * 0.75
          : 0);
    if (baseCashFlow <= 0 || !stock.totalShares) return { fairPrice: 0, margin: 0, enterpriseFairValue: 0 };

    const r = Math.max(dcfDiscountRate / 100, 0.06);
    const g5 = dcfGrowth5y / 100;
    const gPerp = Math.min(dcfPerpetualGrowth / 100, r - 0.02);

    let pvCashFlows = 0;
    let cf = baseCashFlow;
    for (let t = 1; t <= 5; t++) {
      cf = cf * (1 + g5);
      pvCashFlows += cf / Math.pow(1 + r, t);
    }

    const terminalValue = (cf * (1 + gPerp)) / (r - gPerp);
    const pvTerminal = terminalValue / Math.pow(1 + r, 5);
    const totalEquityValue = pvCashFlows + pvTerminal;
    const fairPrice = totalEquityValue / stock.totalShares;
    const margin = currentPrice > 0 ? ((fairPrice - currentPrice) / currentPrice) * 100 : 0;

    return {
      fairPrice,
      margin,
      enterpriseFairValue: totalEquityValue
    };
  }, [stock, dcfDiscountRate, dcfGrowth5y, dcfPerpetualGrowth, currentPrice]);

  // 6. Consensus & Fundamental Score (Increment based on video strategy)
  const consensus = useMemo(() => {
    const models = [
      { name: 'Bazin', price: bazinCeiling, approved: bazinMargin > 0 },
      { name: 'Graham', price: grahamCeiling, approved: grahamMargin > 0 },
      { name: 'Peter Lynch', price: null, approved: lynchScore >= 1.0 },
      { name: 'Projetivo (Barsi)', price: projectedCeiling, approved: projectedMargin > 0 },
      { name: 'Fluxo de Caixa (DCF)', price: dcfResult.fairPrice, approved: dcfResult.margin > 0 }
    ];
    const approvedCount = models.filter((m) => m.approved).length;
    const validPrices = models.map((m) => m.price).filter((p): p is number => p !== null && p > 0);
    const avgFairPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;

    // Checklist of the 5 Pillars from the Video
    const pillars = [
      {
        label: 'P/L Descontado (≤ 15x)',
        ok: stock?.pl !== null && stock?.pl !== undefined && stock.pl > 0 && stock.pl <= 15,
        value: stock?.pl ? `${formatDec(stock.pl, 2)}x` : '-'
      },
      {
        label: 'P/VP Saudável (≤ 2,0x)',
        ok: stock?.pvp !== null && stock?.pvp !== undefined && stock.pvp > 0 && stock.pvp <= 2.0,
        value: stock?.pvp ? `${formatDec(stock.pvp, 2)}x` : '-'
      },
      {
        label: 'Alta Rentabilidade (ROE ≥ 12%)',
        ok: stock?.roe !== null && stock?.roe !== undefined && stock.roe >= 12,
        value: stock?.roe ? `${formatDec(stock.roe, 1)}%` : '-'
      },
      {
        label: 'Dívida Controlada (Dív/EBITDA ≤ 3x)',
        ok:
          stock?.dividaLiquidaEbitda === null ||
          stock?.dividaLiquidaEbitda === undefined ||
          stock.dividaLiquidaEbitda <= 3.0,
        value: stock?.dividaLiquidaEbitda !== null && stock?.dividaLiquidaEbitda !== undefined ? `${formatDec(stock.dividaLiquidaEbitda, 2)}x` : 'Caixa Líq.'
      },
      {
        label: 'Margem de Segurança Positiva',
        ok: bazinMargin > 0 || grahamMargin > 0,
        value: `${formatDec(Math.max(bazinMargin, grahamMargin), 1)}%`
      }
    ];

    const score = Math.round(
      (approvedCount / 5) * 50 + (pillars.filter((p) => p.ok).length / 5) * 50
    );

    // Options Strike Zones (Venda de Put / Venda Coberta de Call)
    const conservativePutStrike =
      grahamCeiling > 0 && bazinCeiling > 0
        ? Math.min(currentPrice * 0.93, Math.min(grahamCeiling, bazinCeiling) * 0.9)
        : currentPrice * 0.92;
    const coveredCallStrike =
      avgFairPrice > currentPrice ? avgFairPrice : currentPrice * 1.12;

    return {
      models,
      approvedCount,
      avgFairPrice,
      pillars,
      score,
      conservativePutStrike,
      coveredCallStrike
    };
  }, [bazinCeiling, bazinMargin, grahamCeiling, grahamMargin, lynchScore, projectedCeiling, projectedMargin, dcfResult, stock, currentPrice]);

  // Portfolio tickers for quick switch (only stocks / 'Ações')
  const userStockTickers = useMemo(() => {
    const unitStocks = new Set(['TAEE11', 'SANB11', 'SAPR11', 'KLBN11', 'ALUP11', 'ENGI11', 'BPAC11', 'IGTI11']);
    return Array.from(
      new Set(
        investments
          .filter((inv) => {
            const typeName = (inv.investment_type?.name || '').toLowerCase();
            if (typeName.includes('fii') || typeName.includes('imobili')) return false;
            if (typeName.includes('aç') || typeName.includes('ac')) return true;
            const t = (inv.ticker || '').trim().toUpperCase();
            return /^[A-Z]{4}[3456]$/.test(t) || unitStocks.has(t);
          })
          .map((inv) => (inv.ticker || '').trim().toUpperCase())
          .filter((t) => /^[A-Z]{4}\d{1,2}$/.test(t))
      )
    ).sort();
  }, [investments]);

  const [quickFilterMode, setQuickFilterMode] = useState<'carteira' | 'populares'>('carteira');

  return (
    <div className="space-y-6">
      {/* BARRA DE BUSCA & SELETOR RÁPIDO DE AÇÕES */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#111827]/95 border border-slate-200 dark:border-slate-800/80 text-slate-900 dark:text-white shadow-sm dark:shadow-2xl transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-lg text-white shadow-md shrink-0">
              {stock?.ticker?.slice(0, 4) || activeTicker.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  {stock?.ticker || activeTicker}
                </h2>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  — {stock?.name || 'Carregando...'}
                </span>
                {stock?.sector && (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                    {stock.sector}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                <span>
                  Cotação: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrencyBR(currentPrice)}</strong>
                </span>
                {stock?.min52w && stock?.max52w && (
                  <span>
                    52 Semanas: <strong className="text-slate-700 dark:text-slate-200">{formatCurrencyBR(stock.min52w)}</strong> — <strong className="text-slate-700 dark:text-slate-200">{formatCurrencyBR(stock.max52w)}</strong>
                  </span>
                )}
                {stock?.lastBalanceDate && (
                  <span>Últ. Balanço: {stock.lastBalanceDate}</span>
                )}
              </p>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadTickerDetails(searchInput);
              }}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 focus-within:border-emerald-500 rounded-xl px-3 py-1.5 transition-colors"
            >
              <Icon name="search" size="sm" className="text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                placeholder="Ex: CMIG4, BBAS3..."
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none w-32 sm:w-40 uppercase placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {loading ? '...' : 'Analisar'}
              </button>
            </form>

            {onOpenNewInvModal && stock && (
              <button
                type="button"
                onClick={() => onOpenNewInvModal(stock.ticker, stock.currentPrice)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Icon name="add" className="text-sm text-white" />
                <span>Adicionar à Carteira</span>
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Fechar Detalhes"
              >
                <Icon name="close" size="sm" />
              </button>
            )}
          </div>
        </div>

        {/* Atalhos Rápidos sem Barra de Rolagem */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Seletor de Modo: Minha Carteira vs Populares */}
            {userStockTickers.length > 0 && (
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 mr-2">
                <button
                  type="button"
                  onClick={() => setQuickFilterMode('carteira')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    quickFilterMode === 'carteira'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon name="account_balance_wallet" className="text-[12px]" />
                  Minha Carteira ({userStockTickers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilterMode('populares')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    quickFilterMode === 'populares'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon name="trending_up" className="text-[12px]" />
                  Populares B3
                </button>
              </div>
            )}

            {/* Lista de Pílulas com Flex-Wrap (Sem Scrollbar) */}
            {quickFilterMode === 'carteira' && userStockTickers.length > 0 ? (
              userStockTickers.map((t) => {
                const isSelected = activeTicker === t;
                return (
                  <button
                    key={`cart-${t}`}
                    type="button"
                    onClick={() => {
                      setSearchInput(t);
                      loadTickerDetails(t);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-sm ring-2 ring-emerald-400/50'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/70 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-300'
                    }`}
                  >
                    {t}
                  </button>
                );
              })
            ) : (
              POPULAR_STOCKS.map((item) => {
                const isSelected = activeTicker === item.ticker;
                return (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => {
                      setSearchInput(item.ticker);
                      loadTickerDetails(item.ticker);
                    }}
                    title={item.label}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/50'
                        : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-white'
                    }`}
                  >
                    {item.ticker}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {savedToast && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <Icon name="check_circle" size="sm" />
          <span>{savedToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold">
            Buscando balanço patrimonial, múltiplos de valuation e histórico de proventos de {activeTicker}...
          </p>
        </div>
      ) : stock ? (
        <div className="space-y-6">
          {/* TOPO IMAGEM 1: 4 CARDS PRINCIPAIS (Cotação Atual, VPA, LPA, Payout) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              label="Cotação Atual"
              value={formatCurrencyBR(stock.currentPrice)}
              tooltip="Preço de negociação atual da ação na B3."
              highlight="white"
            />
            <IndicatorCard
              label="VPA"
              value={stock.vpa !== null ? formatCurrencyBR(stock.vpa) : '-'}
              tooltip="Valor Patrimonial por Ação (Patrimônio Líquido dividido pelo total de ações)."
              highlight="white"
            />
            <IndicatorCard
              label="LPA"
              value={stock.lpa !== null ? formatCurrencyBR(stock.lpa) : '-'}
              tooltip="Lucro por Ação acumulado nos últimos 12 meses."
              highlight={stock.lpa && stock.lpa > 0 ? 'white' : 'red'}
            />
            <IndicatorCard
              label="Payout"
              value={stock.payout !== null ? `${formatDec(stock.payout, 2)}%` : '-'}
              tooltip="Percentual do lucro líquido que a empresa distribui aos acionistas sob forma de dividendos e JCP."
              highlight="white"
            />
          </div>

          {/* TELA 1 (IMAGEM 4): VALUATION BAZIN, GRAHAM & PETER LYNCH LADO A LADO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* CARD 1: VALUATION BAZIN */}
            <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Valuation Bazin</h3>
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900/80 p-0.5 rounded-lg text-[10px] font-bold">
                  {(['1y', '3y', '5y'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSwitchBazinPeriod(p)}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        bazinPeriodMode === p
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p === '1y' ? '12M' : p === '3y' ? 'Méd 3A' : 'Méd 5A'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                      Dividendos por ação médio (DPA)
                      <span
                        className="ml-1 text-slate-400 dark:text-slate-500 cursor-help"
                        title="Média de dividendos pagos por ação. Você pode editar manualmente para simular cenários."
                      >
                        ⓘ
                      </span>
                    </label>
                    <div className="flex items-center bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-28">
                      <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">R$</span>
                      <input
                        type="text"
                        value={bazinDpaInput}
                        onChange={(e) => setBazinDpaInput(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-900 dark:text-white w-full text-right focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Dividend Yield que quer receber
                    </label>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => setBazinTargetDy((prev) => Math.max(1, Number((prev - 0.5).toFixed(1))))}
                        className="w-5 h-5 rounded-full bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 font-black flex items-center justify-center text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white min-w-[44px] text-center">
                        {formatDec(bazinTargetDy, 1)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setBazinTargetDy((prev) => Math.min(25, Number((prev + 0.5).toFixed(1))))}
                        className="w-5 h-5 rounded-full bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 font-black flex items-center justify-center text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Preço teto do Bazin</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {formatCurrencyBR(bazinCeiling)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Margem de Segurança</span>
                    <span
                      className={`text-sm font-black ${
                        bazinMargin >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatDec(bazinMargin, 2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: VALUATION GRAHAM */}
            <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Valuation Graham</h3>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">√(22,5 × LPA × VPA)</span>
              </div>

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Lucro por Ação no ano (LPA)
                    </label>
                    <input
                      type="text"
                      value={grahamLpaInput}
                      onChange={(e) => setGrahamLpaInput(e.target.value)}
                      className="bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-28 text-sm font-bold text-slate-900 dark:text-white text-right focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Valor patrimonial por ação (VPA)
                    </label>
                    <input
                      type="text"
                      value={grahamVpaInput}
                      onChange={(e) => setGrahamVpaInput(e.target.value)}
                      className="bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-28 text-sm font-bold text-slate-900 dark:text-white text-right focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Preço teto do Graham</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {formatCurrencyBR(grahamCeiling)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3">
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Margem de Segurança</span>
                    <span
                      className={`text-sm font-black ${
                        grahamMargin >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatDec(grahamMargin, 2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: VALUATION PETER LYNCH */}
            <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div className="p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Valuation Peter Lynch</h3>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">(DY + Cresc) / P/L</span>
              </div>

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Dividend Yield dos últimos 12 meses
                    </label>
                    <div className="flex items-center bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-28">
                      <input
                        type="text"
                        value={lynchDyInput}
                        onChange={(e) => setLynchDyInput(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-900 dark:text-white w-full text-right focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <label className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                      Crescimento projetivo do lucro anual
                      <span
                        className="ml-1 text-slate-400 dark:text-slate-500 cursor-help"
                        title="Crescimento anual esperado dos lucros (CAGR). Acima de 1,5 no indicador indica ação descontada."
                      >
                        ⓘ
                      </span>
                    </label>
                    <div className="flex items-center bg-slate-100 dark:bg-[#232f46] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-28">
                      <input
                        type="text"
                        value={lynchGrowthInput}
                        onChange={(e) => setLynchGrowthInput(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-900 dark:text-white w-full text-right focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between py-1.5 px-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">P/L</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{formatDec(plValue, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/30">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      Indicador Peter Lynch
                      <span
                        className="cursor-help text-slate-400"
                        title="< 1.0: Caro | 1.0 a 1.5: Preço Justo | 1.5 a 2.0: Bom Preço | ≥ 2.0: Muito Barato"
                      >
                        ⓘ
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base font-black ${
                          lynchScore >= 1.5
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : lynchScore >= 1.0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatDec(lynchScore, 2)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-amber-200/60 dark:border-transparent">
                        {lynchScore >= 2.0
                          ? 'Barganha'
                          : lynchScore >= 1.5
                            ? 'Atrat.'
                            : lynchScore >= 1.0
                              ? 'Justo'
                              : 'Caro'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TELA 2 (IMAGEM 5): PREÇO TETO PROJETIVO (BARSI) + VALUATION PELO FLUXO DE CAIXA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* PREÇO TETO PROJETIVO (8 COLUNAS) */}
            <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 p-5 shadow-sm dark:shadow-xl transition-colors">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Preço Teto Projetivo</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Icon name="podcasts" className="text-[12px] text-sky-600 dark:text-sky-400" />
                    Método Barsi / Influenciadores
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Coluna Esquerda: Inputs do Preço Teto Projetivo */}
                <div className="md:col-span-5 space-y-4 bg-slate-50 dark:bg-[#121927] p-4 rounded-xl border border-slate-200 dark:border-slate-800/90">
                  <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-24 text-center">
                      <input
                        type="text"
                        value={projTargetDy}
                        onChange={(e) => setProjTargetDy(e.target.value)}
                        className="bg-transparent text-sm font-extrabold text-slate-900 dark:text-white w-12 text-center focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">%</span>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">Dividend Yield</strong> desejado
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <div className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 w-24 text-center flex items-center justify-center">
                      <input
                        type="text"
                        value={projPayout}
                        onChange={(e) => setProjPayout(e.target.value)}
                        className="bg-transparent text-sm font-extrabold text-slate-900 dark:text-white w-14 text-center focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">%</span>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">Payout</strong> da empresa
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 flex-1 text-center">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {formatCurrencyBR(projectedProfit, 0)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setProjGrowthPct((p) => Math.max(-80, p - 5))}
                          className="w-5 h-5 rounded-full bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 font-black flex items-center justify-center text-xs cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white min-w-[44px] text-center">
                          {formatDec(projGrowthPct, 1)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setProjGrowthPct((p) => Math.min(200, p + 5))}
                          className="w-5 h-5 rounded-full bg-sky-500 hover:bg-sky-400 text-white dark:text-slate-950 font-black flex items-center justify-center text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                      <span>Lucro Projetivo</span>
                      <span>Projeção ⓘ</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveSimulation}
                      className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Icon name="check_circle" className="text-sm text-white" />
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      Reiniciar filtros
                    </button>
                  </div>
                </div>

                {/* Coluna Direita: 6 Cards de Resultado Projetivo */}
                <div className="md:col-span-7 grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      COTAÇÃO ATUAL <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {formatCurrencyBR(currentPrice)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      NÚMERO DE PAPÉIS <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p className="text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                      {totalShares.toLocaleString('pt-BR')}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30">
                      ⇄ Com tesouraria
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      PREÇO TETO <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrencyBR(projectedCeiling)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      DPA (PROJETIVO) <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {formatCurrencyBR(projectedDpa)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      YIELD (PROJETIVO) <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {formatDec(projectedYield, 2)}%
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-extrabold uppercase text-sky-600 dark:text-sky-400">
                      MARGEM SEGURANÇA <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
                    </p>
                    <p
                      className={`text-lg font-black mt-1 ${
                        projectedMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatDec(projectedMargin, 2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* VALUATION PELO FLUXO DE CAIXA (DCF) (4 COLUNAS) */}
            <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 p-5 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Valuation pelo Fluxo de Caixa</h3>
                <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Icon name="podcasts" className="text-[12px] text-sky-600 dark:text-sky-400" />
                  Fluxo Descontado (DCF)
                </span>
              </div>

              {!showDcfCalculator ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Icon name="inventory_2" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">Simulador DCF Disponível</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                      Faça seu valuation pelo fluxo de caixa descontado (5 anos + perpetuidade) para {stock.ticker}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDcfCalculator(true)}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-sky-50 dark:bg-[#1e293b] hover:bg-sky-500 hover:text-white dark:hover:text-slate-950 text-sky-700 dark:text-sky-400 font-extrabold text-xs border border-sky-200 dark:border-sky-500/30 transition-all cursor-pointer"
                  >
                    Calcular Valuation &gt;
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">Taxa de Desconto (WACC)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDcfDiscountRate((r) => Math.max(7, r - 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 dark:text-white w-12 text-center">{formatDec(dcfDiscountRate, 1)}%</span>
                      <button
                        type="button"
                        onClick={() => setDcfDiscountRate((r) => Math.min(20, r + 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">Crescimento Anual (5 anos)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDcfGrowth5y((g) => Math.max(0, g - 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 dark:text-white w-12 text-center">{formatDec(dcfGrowth5y, 1)}%</span>
                      <button
                        type="button"
                        onClick={() => setDcfGrowth5y((g) => Math.min(25, g + 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">Crescimento Perpétuo (g)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDcfPerpetualGrowth((g) => Math.max(1, g - 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-bold text-slate-900 dark:text-white w-12 text-center">{formatDec(dcfPerpetualGrowth, 1)}%</span>
                      <button
                        type="button"
                        onClick={() => setDcfPerpetualGrowth((g) => Math.min(8, g + 0.5))}
                        className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 space-y-1.5 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Preço Justo DCF</span>
                      <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                        {formatCurrencyBR(dcfResult.fairPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400">Margem DCF</span>
                      <span
                        className={`text-xs font-black ${
                          dcfResult.margin >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatDec(dcfResult.margin, 2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TELA 3 (IMAGEM 1): INDICADORES DE VALUATION */}
          <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors">
            <button
              type="button"
              onClick={() => setOpenSections((s) => ({ ...s, valuation: !s.valuation }))}
              className="w-full p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Icon name="trending_up" className="text-sky-600 dark:text-sky-400" size="sm" />
                <h3 className="text-sm font-extrabold text-sky-600 dark:text-sky-400">Indicadores de Valuation</h3>
              </div>
              <Icon name={openSections.valuation ? 'expand_less' : 'expand_more'} className="text-slate-400" />
            </button>

            {openSections.valuation && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <IndicatorCard
                  label="Market Cap"
                  value={formatBillions(stock.marketCap)}
                  tooltip="Valor de Mercado total da empresa na Bolsa (Cotação × Total de Ações)."
                />
                <IndicatorCard
                  label="Enterprise Value"
                  value={formatBillions(stock.enterpriseValue)}
                  tooltip="Valor da Firma (Market Cap + Dívida Líquida). Mostra quanto custaria comprar a empresa inteira assumindo seu caixa e dívidas."
                />
                <IndicatorCard
                  label="P/L"
                  value={formatDec(stock.pl, 3)}
                  tooltip="Preço / Lucro: Indica em quantos anos o lucro da empresa pagaria o valor investido. No vídeo, busca-se P/L descontado (abaixo de 10~15x)."
                  status={stock.pl && stock.pl > 0 && stock.pl <= 12 ? 'good' : stock.pl && stock.pl < 0 ? 'bad' : 'neutral'}
                />
                <IndicatorCard
                  label="P/VP"
                  value={formatDec(stock.pvp, 3)}
                  tooltip="Preço / Valor Patrimonial: Indica quanto o mercado paga pelo patrimônio líquido da empresa (1,00 = preço igual ao patrimônio)."
                  status={stock.pvp && stock.pvp > 0 && stock.pvp <= 1.5 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="P/EBIT"
                  value={formatDec(stock.pebit, 3)}
                  tooltip="Preço / EBIT: Compara o valor de mercado com a geração de lucro operacional da empresa antes de juros e impostos."
                />
                <IndicatorCard
                  label="P/EBITDA"
                  value={formatDec(stock.pebitda, 3)}
                  tooltip="Preço / EBITDA: Compara o valor de mercado com o potencial de geração de caixa operacional."
                />
                <IndicatorCard
                  label="EV/EBIT"
                  value={formatDec(stock.evebit, 3)}
                  tooltip="Enterprise Value / EBIT: Múltiplo preferido de Joel Greenblatt para avaliar quão barata é a operação incluindo a dívida."
                  status={stock.evebit && stock.evebit > 0 && stock.evebit <= 10 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="EV/EBITDA"
                  value={formatDec(stock.evebitda, 3)}
                  tooltip="Enterprise Value / EBITDA: Em quantos anos a geração operacional de caixa (EBITDA) paga o valor total da firma."
                  status={stock.evebitda && stock.evebitda > 0 && stock.evebitda <= 8 ? 'good' : 'neutral'}
                />
              </div>
            )}
          </div>

          {/* TELA 4 (IMAGEM 2): INDICADORES DE RENTABILIDADE */}
          <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors">
            <button
              type="button"
              onClick={() => setOpenSections((s) => ({ ...s, rentabilidade: !s.rentabilidade }))}
              className="w-full p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sky-600 dark:text-sky-400 font-black text-sm">%</span>
                <h3 className="text-sm font-extrabold text-sky-600 dark:text-sky-400">Indicadores de Rentabilidade</h3>
              </div>
              <Icon name={openSections.rentabilidade ? 'expand_less' : 'expand_more'} className="text-slate-400" />
            </button>

            {openSections.rentabilidade && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <IndicatorCard
                  label="ROE"
                  value={stock.roe !== null ? `${formatDec(stock.roe, 3)}%` : '-'}
                  tooltip="Return on Equity (Retorno sobre o Patrimônio Líquido). Acima de 15% demonstra alta rentabilidade para o acionista."
                  status={stock.roe && stock.roe >= 15 ? 'good' : stock.roe && stock.roe < 5 ? 'bad' : 'neutral'}
                />
                <IndicatorCard
                  label="ROA"
                  value={stock.roa !== null ? `${formatDec(stock.roa, 3)}%` : '-'}
                  tooltip="Return on Assets (Retorno sobre os Ativos Totais). Mede a eficiência da empresa em gerar lucro com tudo o que possui."
                  status={stock.roa && stock.roa >= 6 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="ROIC"
                  value={stock.roic !== null ? `${formatDec(stock.roic, 3)}%` : '-'}
                  tooltip="Return on Invested Capital (Retorno sobre o Capital Investido). Mede o retorno operacional sobre o capital total alocado (próprio + terceiros)."
                  status={stock.roic && stock.roic >= 12 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="Margem Líquida"
                  value={stock.margemLiquida !== null ? `${formatDec(stock.margemLiquida, 3)}%` : '-'}
                  tooltip="Percentual de cada R$ 1,00 de receita que vira lucro líquido final no bolso da empresa."
                  status={stock.margemLiquida && stock.margemLiquida >= 12 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="Margem EBITDA"
                  value={stock.margemEbitda !== null ? `${formatDec(stock.margemEbitda, 3)}%` : '-'}
                  tooltip="Percentual da receita líquida que se converte em geração operacional de caixa (EBITDA)."
                />
                <IndicatorCard
                  label="Margem Bruta"
                  value={stock.margemBruta !== null ? `${formatDec(stock.margemBruta, 3)}%` : '-'}
                  tooltip="Lucro Bruto dividido pela Receita Líquida. Mede a rentabilidade direta após custos de produção/serviço."
                />
                <IndicatorCard
                  label="Margem EBIT"
                  value={stock.margemEbit !== null ? `${formatDec(stock.margemEbit, 2)}%` : '-'}
                  tooltip="Lucro Operacional (EBIT) dividido pela Receita Líquida."
                />
                <IndicatorCard
                  label="Cresc. Receita (5a)"
                  value={stock.crescRec5a !== null ? `${formatDec(stock.crescRec5a, 2)}%` : '-'}
                  tooltip="Taxa de crescimento composta da receita líquida nos últimos 5 anos."
                />
              </div>
            )}
          </div>

          {/* TELA 5 (IMAGEM 3): INDICADORES DE ENDIVIDAMENTO */}
          <div className="rounded-2xl bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl transition-colors">
            <button
              type="button"
              onClick={() => setOpenSections((s) => ({ ...s, endividamento: !s.endividamento }))}
              className="w-full p-4 bg-slate-50 dark:bg-[#1c273b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Icon name="account_balance" className="text-sky-600 dark:text-sky-400" size="sm" />
                <h3 className="text-sm font-extrabold text-sky-600 dark:text-sky-400">Indicadores de Endividamento</h3>
              </div>
              <Icon name={openSections.endividamento ? 'expand_less' : 'expand_more'} className="text-slate-400" />
            </button>

            {openSections.endividamento && (
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <IndicatorCard
                  label="Dívida Líquida"
                  value={formatBillions(stock.dividaLiquida)}
                  tooltip="Dívida Bruta menos Disponibilidades (Caixa). Quando negativa (ex: R$ -1.88 bi), significa que a empresa tem mais dinheiro em caixa do que dívida!"
                  status={stock.dividaLiquida !== null && stock.dividaLiquida <= 0 ? 'good' : 'neutral'}
                />
                <IndicatorCard
                  label="Dívida Bruta"
                  value={formatBillions(stock.dividaBruta)}
                  tooltip="Soma de todas as obrigações financeiras e debêntures de curto e longo prazo."
                />
                <IndicatorCard
                  label="Disponibilidades"
                  value={formatBillions(stock.disponibilidades)}
                  tooltip="Dinheiro em caixa e aplicações financeiras de liquidez imediata da empresa."
                />
                <IndicatorCard
                  label="Dívida Líquida/EBITDA"
                  value={formatDec(stock.dividaLiquidaEbitda, 3)}
                  tooltip="Quantos anos de geração de caixa operacional (EBITDA) seriam necessários para quitar toda a dívida líquida. Abaixo de 2,5x é considerado muito saudável; negativo indica caixa líquido!"
                  status={
                    stock.dividaLiquidaEbitda !== null && stock.dividaLiquidaEbitda <= 2.0
                      ? 'good'
                      : stock.dividaLiquidaEbitda && stock.dividaLiquidaEbitda > 3.5
                        ? 'bad'
                        : 'neutral'
                  }
                />
              </div>
            )}
          </div>

          {/* INCREMENTO ESPECIAL: CONSENSO DOS VALUATIONS & ESTRATÉGIA COM OPÇÕES (BASEADO NO VÍDEO) */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-[#161f30] dark:to-[#0f172a] border border-sky-200 dark:border-sky-500/30 p-6 shadow-sm dark:shadow-2xl space-y-5 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    Incremento Inteligente
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Veredito Consolidado & Estratégia com Opções ({stock.ticker})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Síntese automática baseada nos 5 modelos de Valuation e nos pilares de seleção do vídeo
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white dark:bg-slate-900/90 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Score Fundamentalista</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {consensus.approvedCount} de 5 modelos aprovam
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                    consensus.score >= 70
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40'
                      : consensus.score >= 50
                        ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40'
                        : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40'
                  }`}
                >
                  {consensus.score}
                </div>
              </div>
            </div>

            {/* Checklist dos 5 Pilares do Vídeo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {consensus.pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    pillar.ok
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                      : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{pillar.label}</span>
                    <span className={pillar.ok ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                      {pillar.ok ? '✔' : '⚠'}
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{pillar.value}</p>
                </div>
              ))}
            </div>

            {/* Zonas Operacionais: Buy & Hold + Opções (Put / Call) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white dark:bg-[#1c273b]/90 border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase">
                    1. Zona para Venda de PUT
                  </span>
                  <Badge color="green">Aquisição c/ Desconto</Badge>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-2">
                  Strike ≤ {formatCurrencyBR(consensus.conservativePutStrike)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Faixa conservadora para vender PUT (ganhar prêmio para assumir o ativo ainda mais barato que a cotação atual).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#1c273b]/90 border border-sky-200 dark:border-sky-500/30 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-700 dark:text-sky-400 uppercase">
                    2. Preço Justo Médio (Consenso)
                  </span>
                  <Badge color="blue">Alvo Fundamentalista</Badge>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-2">
                  {formatCurrencyBR(consensus.avgFairPrice)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Média combinada entre os preços-teto de Bazin, Graham, Projetivo e Fluxo de Caixa Descontado.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#1c273b]/90 border border-amber-200 dark:border-amber-500/30 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase">
                    3. Zona para Venda Coberta (CALL)
                  </span>
                  <Badge color="yellow">Renda c/ Opções</Badge>
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-2">
                  Strike ≥ {formatCurrencyBR(consensus.coveredCallStrike)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Região acima do preço justo ideal para lançar Call coberta e rentabilizar a carteira com dividendos sintéticos.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  tooltip,
  highlight = 'white',
  status = 'neutral'
}: {
  label: string;
  value: string;
  tooltip: string;
  highlight?: 'white' | 'green' | 'red';
  status?: 'good' | 'bad' | 'neutral';
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="relative p-4 rounded-xl bg-white dark:bg-[#1c273b] border border-slate-200 dark:border-slate-800/90 hover:border-sky-300 dark:hover:border-slate-700 shadow-xs dark:shadow-none transition-all flex flex-col justify-between min-h-[88px]"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-sky-600 dark:text-sky-400 truncate">{label}</span>
        <button
          type="button"
          onClick={() => setShowTip((v) => !v)}
          className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-500 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:border-slate-500 dark:hover:border-white text-[10px] font-bold flex items-center justify-center shrink-0 cursor-pointer"
          title={tooltip}
        >
          ?
        </button>
      </div>

      <div className="flex items-end justify-between gap-2 mt-2">
        <span
          className={`text-lg sm:text-xl font-black tracking-tight ${
            status === 'good'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'bad'
                ? 'text-rose-600 dark:text-rose-400'
                : highlight === 'red'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
          }`}
        >
          {value}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs">📈</span>
      </div>

      {showTip && (
        <div className="absolute z-30 bottom-full left-0 mb-2 w-64 p-2.5 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 text-[11px] text-slate-100 shadow-2xl pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}
