'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Investment } from '@/hooks/useInvestments';
import { GrahamStockData } from '@/app/api/stocks/graham/route';
import { BazinStockData } from '@/app/api/stocks/bazin/route';
import { FIIAnalysisData } from '@/app/api/stocks/fii/route';

interface GrahamAnalysisTableProps {
  investments: Investment[];
  onOpenEntryModal?: (inv: Investment) => void;
  onOpenNewInvModal?: (prefilledTicker?: string, prefilledPrice?: number) => void;
}

const POPULAR_GRAHAM_TICKERS = [
  { ticker: 'PETR4', name: 'Petrobras PN' },
  { ticker: 'VALE3', name: 'Vale ON' },
  { ticker: 'BBAS3', name: 'Banco do Brasil ON' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN' },
  { ticker: 'BBDC4', name: 'Bradesco PN' },
  { ticker: 'TAEE11', name: 'Taesa UNT' },
  { ticker: 'EGIE3', name: 'Engie Brasil ON' },
  { ticker: 'WEGE3', name: 'WEG ON' },
  { ticker: 'CPLE6', name: 'Copel PNB' },
  { ticker: 'SAPR11', name: 'Sanepar UNT' }
];

const POPULAR_BAZIN_TICKERS = [
  { ticker: 'BBAS3', name: 'Banco do Brasil ON' },
  { ticker: 'TAEE11', name: 'Taesa UNT' },
  { ticker: 'EGIE3', name: 'Engie Brasil ON' },
  { ticker: 'PETR4', name: 'Petrobras PN' },
  { ticker: 'CPLE6', name: 'Copel PNB' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN' },
  { ticker: 'VALE3', name: 'Vale ON' },
  { ticker: 'VIVT3', name: 'Telefônica Brasil' },
  { ticker: 'SAPR11', name: 'Sanepar UNT' },
  { ticker: 'CXSE3', name: 'Caixa Seguridade' }
];

const POPULAR_FII_TICKERS = [
  { ticker: 'MXRF11', name: 'Maxi Renda FII' },
  { ticker: 'HGLG11', name: 'CSHG Logística' },
  { ticker: 'XPML11', name: 'XP Malls FII' },
  { ticker: 'KNCR11', name: 'Kinea Rendimentos' },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística' },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers' },
  { ticker: 'TGAR11', name: 'TG Ativo Real' },
  { ticker: 'CPTS11', name: 'Capitânia Securities' },
  { ticker: 'XPLG11', name: 'XP Log FII' },
  { ticker: 'VGHF11', name: 'Valora Hedge Fund' }
];

export function GrahamAnalysisTable({
  investments,
  onOpenEntryModal,
  onOpenNewInvModal
}: GrahamAnalysisTableProps) {
  // Main Method Selection: 'graham' | 'bazin' | 'fii'
  const [activeMethod, setActiveMethod] = useState<'graham' | 'bazin' | 'fii'>('graham');
  const [activeView, setActiveView] = useState<'portfolio' | 'simulator'>('portfolio');

  // --- GRAHAM STATE ---
  const [grahamDataMap, setGrahamDataMap] = useState<Record<string, GrahamStockData>>({});
  const [isLoadingGraham, setIsLoadingGraham] = useState(false);
  const [grahamSearchTicker, setGrahamSearchTicker] = useState('BBAS3');
  const [grahamSimData, setGrahamSimData] = useState<GrahamStockData | null>(null);
  const [isGrahamSimLoading, setIsGrahamSimLoading] = useState(false);
  const [grahamSimError, setGrahamSimError] = useState('');
  const [customLpa, setCustomLpa] = useState('');
  const [customVpa, setCustomVpa] = useState('');
  const [customGrahamPrice, setCustomGrahamPrice] = useState('');

  // --- BAZIN / BARSI STATE ---
  const [bazinPeriod, setBazinPeriod] = useState<'1y' | '3y' | '5y'>('5y');
  const [bazinTargetYield, setBazinTargetYield] = useState<number>(6);
  const [bazinDataMap, setBazinDataMap] = useState<Record<string, BazinStockData>>({});
  const [isLoadingBazin, setIsLoadingBazin] = useState(false);
  const [bazinSearchTicker, setBazinSearchTicker] = useState('BBAS3');
  const [bazinSimData, setBazinSimData] = useState<BazinStockData | null>(null);
  const [isBazinSimLoading, setIsBazinSimLoading] = useState(false);
  const [bazinSimError, setBazinSimError] = useState('');
  const [customBazinDiv, setCustomBazinDiv] = useState('');
  const [customBazinPrice, setCustomBazinPrice] = useState('');

  // --- FII STATE ---
  const [fiiPeriod, setFiiPeriod] = useState<'1y' | '3y' | '5y'>('5y');
  const [fiiTargetYield, setFiiTargetYield] = useState<number>(8.5);
  const [fiiDataMap, setFiiDataMap] = useState<Record<string, FIIAnalysisData>>({});
  const [isLoadingFii, setIsLoadingFii] = useState(false);
  const [fiiSearchTicker, setFiiSearchTicker] = useState('MXRF11');
  const [fiiSimData, setFiiSimData] = useState<FIIAnalysisData | null>(null);
  const [isFiiSimLoading, setIsFiiSimLoading] = useState(false);
  const [fiiSimError, setFiiSimError] = useState('');

  // --- PORTFOLIO FILTERING ---
  const isFiiInvestment = (inv: Investment) => {
    const typeName = inv.investment_type?.name?.toLowerCase() || '';
    const ticker = (inv.ticker || inv.name || '').toUpperCase().trim();
    return typeName.includes('fii') || typeName.includes('imobiliário') || typeName.includes('imobiliario') ||
      (ticker.endsWith('11') && !['TAEE11', 'KLBN11', 'SAPR11', 'SANB11', 'BPAC11', 'ALUP11', 'CPLE11'].includes(ticker));
  };

  const isStockInvestment = (inv: Investment) => {
    const typeName = inv.investment_type?.name?.toLowerCase() || '';
    const ticker = (inv.ticker || inv.name || '').toUpperCase().trim();
    if (isFiiInvestment(inv)) return false;
    const isStockType = typeName.includes('ação') || typeName.includes('ações') || typeName.includes('acoes') || typeName.includes('stock');
    const hasStockTicker = /^[A-Z]{4}\d{1,2}[A-Z]?$/.test(ticker);
    return isStockType || hasStockTicker;
  };

  // Stocks for Graham (exclusively companies/stocks)
  const stockInvestments = useMemo(() => {
    return investments.filter(isStockInvestment);
  }, [investments]);

  const stockTickers = useMemo(() => {
    return stockInvestments
      .map(inv => inv.ticker || (inv.name.match(/^[A-Z]{4}\d{1,2}[A-Z]?$/i) ? inv.name : ''))
      .filter(Boolean);
  }, [stockInvestments]);

  // FIIs for FII Analysis
  const fiiInvestments = useMemo(() => {
    return investments.filter(isFiiInvestment);
  }, [investments]);

  const fiiTickers = useMemo(() => {
    return fiiInvestments
      .map(inv => inv.ticker || (inv.name.match(/^[A-Z]{4}11$/i) ? inv.name : ''))
      .filter(Boolean);
  }, [fiiInvestments]);

  // All dividend assets (Stocks + FIIs) for Bazin
  const allDividendInvestments = useMemo(() => {
    return investments.filter(inv => isStockInvestment(inv) || isFiiInvestment(inv));
  }, [investments]);

  const allDividendTickers = useMemo(() => {
    return allDividendInvestments
      .map(inv => inv.ticker || (inv.name.match(/^[A-Z]{4}\d{1,2}[A-Z]?$/i) ? inv.name : ''))
      .filter(Boolean);
  }, [allDividendInvestments]);

  // --- FETCHERS ---
  const fetchPortfolioGrahamData = async () => {
    if (stockTickers.length === 0) return;
    setIsLoadingGraham(true);
    try {
      const res = await fetch('/api/stocks/graham', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: stockTickers })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results) setGrahamDataMap(data.results);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados de Graham:', err);
    } finally {
      setIsLoadingGraham(false);
    }
  };

  const fetchPortfolioBazinData = async () => {
    if (allDividendTickers.length === 0) return;
    setIsLoadingBazin(true);
    try {
      const res = await fetch('/api/stocks/bazin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: allDividendTickers,
          period: bazinPeriod,
          targetYield: bazinTargetYield
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results) setBazinDataMap(data.results);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados Bazin:', err);
    } finally {
      setIsLoadingBazin(false);
    }
  };

  const fetchPortfolioFiiData = async () => {
    if (fiiTickers.length === 0) return;
    setIsLoadingFii(true);
    try {
      const res = await fetch('/api/stocks/fii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: fiiTickers,
          period: fiiPeriod,
          targetYield: fiiTargetYield
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results) setFiiDataMap(data.results);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados de FII:', err);
    } finally {
      setIsLoadingFii(false);
    }
  };

  // Trigger loads based on active method
  useEffect(() => {
    if (activeMethod === 'graham' && stockTickers.length > 0) {
      fetchPortfolioGrahamData();
    } else if (activeMethod === 'bazin' && allDividendTickers.length > 0) {
      fetchPortfolioBazinData();
    } else if (activeMethod === 'fii' && fiiTickers.length > 0) {
      fetchPortfolioFiiData();
    }
  }, [activeMethod, stockTickers.join(','), allDividendTickers.join(','), fiiTickers.join(','), bazinPeriod, bazinTargetYield, fiiPeriod, fiiTargetYield]);

  // --- SIMULATOR SEARCHES ---
  const handleSearchGrahamTicker = async (t?: string) => {
    const raw = (t || grahamSearchTicker).trim().toUpperCase();
    if (!raw) return;
    setIsGrahamSimLoading(true);
    setGrahamSimError('');
    try {
      const res = await fetch(`/api/stocks/graham?ticker=${encodeURIComponent(raw)}`);
      if (res.ok) {
        const data: GrahamStockData = await res.json();
        setGrahamSimData(data);
        setCustomLpa(data.lpa !== null ? String(data.lpa) : '');
        setCustomVpa(data.vpa !== null ? String(data.vpa) : '');
        setCustomGrahamPrice(data.currentPrice > 0 ? String(data.currentPrice) : '');
      } else {
        const err = await res.json();
        setGrahamSimError(err.error || 'Ação não encontrada ou sem dados fundamentalistas na B3.');
      }
    } catch (e: any) {
      setGrahamSimError(e.message || 'Erro ao consultar cotação.');
    } finally {
      setIsGrahamSimLoading(false);
    }
  };

  const handleSearchBazinTicker = async (t?: string) => {
    const raw = (t || bazinSearchTicker).trim().toUpperCase();
    if (!raw) return;
    setIsBazinSimLoading(true);
    setBazinSimError('');
    try {
      const res = await fetch(`/api/stocks/bazin?ticker=${encodeURIComponent(raw)}&period=${bazinPeriod}&targetYield=${bazinTargetYield}`);
      if (res.ok) {
        const data: BazinStockData = await res.json();
        setBazinSimData(data);
        setCustomBazinDiv(data.selectedDividend > 0 ? String(data.selectedDividend) : '');
        setCustomBazinPrice(data.currentPrice > 0 ? String(data.currentPrice) : '');
      } else {
        const err = await res.json();
        setBazinSimError(err.error || 'Ativo não encontrado ou sem histórico de dividendos.');
      }
    } catch (e: any) {
      setBazinSimError(e.message || 'Erro ao consultar proventos.');
    } finally {
      setIsBazinSimLoading(false);
    }
  };

  const handleSearchFiiTicker = async (t?: string) => {
    const raw = (t || fiiSearchTicker).trim().toUpperCase();
    if (!raw) return;
    setIsFiiSimLoading(true);
    setFiiSimError('');
    try {
      const res = await fetch(`/api/stocks/fii?ticker=${encodeURIComponent(raw)}&period=${fiiPeriod}&targetYield=${fiiTargetYield}`);
      if (res.ok) {
        const data: FIIAnalysisData = await res.json();
        setFiiSimData(data);
      } else {
        const err = await res.json();
        setFiiSimError(err.error || 'FII não encontrado ou sem dados na B3.');
      }
    } catch (e: any) {
      setFiiSimError(e.message || 'Erro ao consultar FII.');
    } finally {
      setIsFiiSimLoading(false);
    }
  };

  // Initial runs
  useEffect(() => {
    handleSearchGrahamTicker('BBAS3');
    handleSearchBazinTicker('BBAS3');
    handleSearchFiiTicker('MXRF11');
  }, []);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Counts
  const grahamOppsCount = useMemo(() => {
    return Object.values(grahamDataMap).filter(d => d.status === 'OTIMO_PRECO').length;
  }, [grahamDataMap]);

  const bazinOppsCount = useMemo(() => {
    return Object.values(bazinDataMap).filter(d => d.status === 'OTIMO_PRECO' || d.status === 'ABAIXO_DO_TETO').length;
  }, [bazinDataMap]);

  const fiiOppsCount = useMemo(() => {
    return Object.values(fiiDataMap).filter(d => d.pvpStatus === 'FORTE_DESCONTO' || d.pvpStatus === 'DESCONTO').length;
  }, [fiiDataMap]);

  return (
    <div className="space-y-4">
      <GlassCard className="p-5 md:p-6 space-y-5 border-l-4 border-l-emerald-500 shadow-md">
        {/* Header with Title & Main Method Tabs */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Icon name="analytics" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  Central de Avaliação & Preço Justo (B3)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Métodos consagrados de valuation: Graham, Décio Bazin (Média 5 anos) e Análise de FIIs (P/VP e Yield).
                </p>
              </div>
            </div>
          </div>

          {/* View Switcher (Portfolio vs Simulator) */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveView('portfolio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === 'portfolio'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="inventory_2" size="sm" />
                <span>Minha Carteira</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('simulator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeView === 'simulator'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="search" size="sm" />
                <span>Simulador / Buscar Ativo</span>
              </button>
            </div>

            {activeView === 'portfolio' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (activeMethod === 'graham') fetchPortfolioGrahamData();
                  else if (activeMethod === 'bazin') fetchPortfolioBazinData();
                  else fetchPortfolioFiiData();
                }}
                disabled={isLoadingGraham || isLoadingBazin || isLoadingFii}
                className="text-xs flex items-center gap-1"
                title="Recalcular indicadores da carteira"
              >
                <Icon name="refresh" size="sm" className={(isLoadingGraham || isLoadingBazin || isLoadingFii) ? 'animate-spin' : ''} />
                <span>Recalcular</span>
              </Button>
            )}
          </div>
        </div>

        {/* 3 Valuation Method Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl">
          {/* Method 1: Graham */}
          <button
            type="button"
            onClick={() => setActiveMethod('graham')}
            className={`p-3 rounded-xl text-left transition-all relative ${
              activeMethod === 'graham'
                ? 'bg-white dark:bg-gray-700 shadow-sm ring-2 ring-emerald-500/50'
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs flex items-center gap-1.5 text-gray-900 dark:text-white">
                <span>🏛️</span> 1. Preço Justo de Graham
              </span>
              {grahamOppsCount > 0 && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] rounded-full font-extrabold">
                  {grahamOppsCount} {grahamOppsCount === 1 ? 'Oportunidade' : 'Oportunidades'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              Fórmula: √(22,5 × LPA × VPA) para Ações
            </p>
          </button>

          {/* Method 2: Décio Bazin (Historical Dividends: 1, 3 or 5 years) */}
          <button
            type="button"
            onClick={() => setActiveMethod('bazin')}
            className={`p-3 rounded-xl text-left transition-all relative ${
              activeMethod === 'bazin'
                ? 'bg-white dark:bg-gray-700 shadow-sm ring-2 ring-blue-500/50'
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs flex items-center gap-1.5 text-gray-900 dark:text-white">
                <span>💰</span> 2. Décio Bazin / Barsi (5 Anos)
              </span>
              {bazinOppsCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] rounded-full font-extrabold">
                  {bazinOppsCount} Abaixo do Teto
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              Preço Teto por Dividendos (Média de 5 anos com Yield {bazinTargetYield}%)
            </p>
          </button>

          {/* Method 3: FIIs (P/VP + Yield) */}
          <button
            type="button"
            onClick={() => setActiveMethod('fii')}
            className={`p-3 rounded-xl text-left transition-all relative ${
              activeMethod === 'fii'
                ? 'bg-white dark:bg-gray-700 shadow-sm ring-2 ring-purple-500/50'
                : 'hover:bg-white/50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs flex items-center gap-1.5 text-gray-900 dark:text-white">
                <span>🏢</span> 3. Análise de FIIs (Imobiliário)
              </span>
              {fiiOppsCount > 0 && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] rounded-full font-extrabold">
                  {fiiOppsCount} Desconto no VP
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
              Métricas exclusivas: P/VP, VP/Cota, DY 12m e Preço Teto
            </p>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* METHOD 1: GRAHAM FORMULA (STOCKS ONLY) */}
        {/* ========================================================================= */}
        {activeMethod === 'graham' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Informative notice about FIIs exclusion */}
            <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <Icon name="info" className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Por que FIIs não entram em Graham?</strong> A fórmula de Graham <code className="bg-white/60 dark:bg-black/40 px-1 py-0.5 rounded font-mono">√(22,5 × LPA × VPA)</code> foi criada para empresas industriais e comerciais que retêm lucros. Como FIIs distribuem 95% do caixa e negociam próximos ao VP (P/VP ≈ 1,00), use as abas <strong>Décio Bazin (Dividendos)</strong> ou <strong>Análise de FIIs</strong> acima.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMethod('fii')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shrink-0 transition-colors"
              >
                Ver Métricas para FIIs →
              </button>
            </div>

            {/* Criteria summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>🟢 ÓTIMO PREÇO (Margem ≥ 20%)</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                  Cotação atual com <strong>20% ou mais de desconto</strong> sobre o Preço Justo de Graham.
                </p>
              </div>

              <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>🟡 PREÇO JUSTO (Valor Intrínseco)</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                  Cotação negociando <strong>entre o Ótimo Preço e o Preço Teto de Graham</strong>.
                </p>
              </div>

              <div className="bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span>🔴 PREÇO ACIMA (Sobreavaliado)</span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                  Cotação <strong>acima do Preço Justo</strong> (P/L × P/VP &gt; 22,5). Aguardar correção.
                </p>
              </div>
            </div>

            {/* Graham: Minha Carteira View */}
            {activeView === 'portfolio' && (
              <div className="space-y-3">
                {stockInvestments.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 mx-auto flex items-center justify-center">
                      <Icon name="trending_up" className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Nenhuma Ação da B3 cadastrada na carteira</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Cadastre ações da B3 (ex: PETR4, VALE3, BBAS3, ITUB4) com o ticker preenchido para acompanhar o Preço Justo de Graham automaticamente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/80 dark:text-gray-400">
                        <tr>
                          <th scope="col" className="px-3.5 py-3">Ação / Ticker</th>
                          <th scope="col" className="px-3 py-3 text-right">Cotação Atual</th>
                          <th scope="col" className="px-3 py-3 text-right" title="Lucro por Ação">LPA</th>
                          <th scope="col" className="px-3 py-3 text-right" title="Valor Patrimonial por Ação">VPA</th>
                          <th scope="col" className="px-3 py-3 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold">
                            🟢 Ótimo Preço
                          </th>
                          <th scope="col" className="px-3 py-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold">
                            🟡 Preço Justo Graham
                          </th>
                          <th scope="col" className="px-3 py-3 text-center">Desconto / Margem</th>
                          <th scope="col" className="px-3 py-3 text-center">Diagnóstico</th>
                          <th scope="col" className="px-3 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {stockInvestments.map((inv) => {
                          const ticker = (inv.ticker || inv.name).toUpperCase().trim();
                          const gData = grahamDataMap[ticker];
                          const currentPrice = (gData && gData.currentPrice > 0) ? gData.currentPrice : (inv.current_price || inv.average_price || 0);
                          const isOpt = gData?.status === 'OTIMO_PRECO';
                          const isFair = gData?.status === 'PRECO_JUSTO';
                          const isAbove = gData?.status === 'PRECO_ACIMA';
                          const isNeg = gData?.status === 'PREJUIZO_OU_PL_NEGATIVO';

                          return (
                            <tr
                              key={inv.id}
                              className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${
                                isOpt ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                              }`}
                            >
                              <td className="px-3.5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono font-extrabold text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-xs">
                                    {ticker}
                                  </span>
                                  <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-xs line-clamp-1">{inv.name}</p>
                                    <p className="text-[10px] text-gray-400">{inv.institution || 'B3'}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(currentPrice)}
                              </td>

                              <td className="px-3 py-3.5 text-right text-gray-600 dark:text-gray-300 font-mono">
                                {gData?.lpa !== null && gData?.lpa !== undefined ? formatCurrency(gData.lpa) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right text-gray-600 dark:text-gray-300 font-mono">
                                {gData?.vpa !== null && gData?.vpa !== undefined ? formatCurrency(gData.vpa) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                                {gData?.otimoPrice ? formatCurrency(gData.otimoPrice) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/10 whitespace-nowrap">
                                {gData?.grahamPrice ? formatCurrency(gData.grahamPrice) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {gData?.discountPercent !== null && gData?.discountPercent !== undefined ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-0.5 ${
                                      gData.discountPercent >= 20
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                        : gData.discountPercent > 0
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                                    }`}
                                  >
                                    {gData.discountPercent > 0 ? `+${gData.discountPercent}% desc.` : `${gData.discountPercent}% ágio`}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {isOpt && <Badge color="green" className="text-[10px] font-bold">🟢 Ótimo Preço</Badge>}
                                {isFair && <Badge color="yellow" className="text-[10px] font-bold">🟡 Preço Justo</Badge>}
                                {isAbove && <Badge color="red" className="text-[10px] font-bold">🔴 Preço Acima</Badge>}
                                {isNeg && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] rounded font-medium">⚠️ Prejuízo/PL Neg.</span>}
                                {!gData && <span className="text-[10px] text-gray-400">{isLoadingGraham ? 'Calculando...' : 'Sem dados'}</span>}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {onOpenEntryModal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenEntryModal(inv)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                    title="Registrar novo aporte"
                                  >
                                    <Icon name="add_circle" size="sm" />
                                    <span>Aportar</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Graham: Simulator View */}
            {activeView === 'simulator' && (
              <div className="space-y-4">
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Digite o código da ação (Ex: PETR4, VALE3, BBAS3, ITUB4...)"
                      value={grahamSearchTicker}
                      onChange={(e) => setGrahamSearchTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchGrahamTicker(grahamSearchTicker);
                        }
                      }}
                      className="font-mono font-bold uppercase text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleSearchGrahamTicker(grahamSearchTicker)}
                      disabled={isGrahamSimLoading || !grahamSearchTicker.trim()}
                      className="shrink-0 text-xs flex items-center gap-1"
                    >
                      <Icon name="search" size="sm" className={isGrahamSimLoading ? 'animate-spin' : ''} />
                      <span>{isGrahamSimLoading ? 'Buscando...' : 'Calcular Graham'}</span>
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Atalhos rápidos:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_GRAHAM_TICKERS.map(item => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => {
                            setGrahamSearchTicker(item.ticker);
                            handleSearchGrahamTicker(item.ticker);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                            grahamSimData?.ticker === item.ticker
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-gray-700/80 hover:bg-blue-50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {item.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {grahamSimError && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-lg text-xs">
                    {grahamSimError}
                  </div>
                )}

                {grahamSimData && (
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-md">
                          {grahamSimData.ticker}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-gray-900 dark:text-white text-base">{grahamSimData.name}</h4>
                          <p className="text-xs text-gray-500">Indicadores fundamentalistas extraídos da B3</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                          grahamSimData.status === 'OTIMO_PRECO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          grahamSimData.status === 'PRECO_JUSTO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {grahamSimData.statusLabel}
                        </span>

                        {onOpenNewInvModal && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenNewInvModal(grahamSimData.ticker, grahamSimData.currentPrice)}
                            className="text-xs flex items-center gap-1"
                          >
                            <Icon name="add" size="sm" /> Adicionar à Carteira
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Cotação Atual</span>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(grahamSimData.currentPrice)}</p>
                        <span className="text-[10px] text-gray-500">B3</span>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">🟢 Ótimo Preço (-20%)</span>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(grahamSimData.otimoPrice)}</p>
                        <span className="text-[10px] text-emerald-700/80">Faixa ideal com margem</span>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">🟡 Preço Justo Graham</span>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(grahamSimData.grahamPrice)}</p>
                        <span className="text-[10px] text-blue-700/80">Valor intrínseco teto</span>
                      </div>

                      <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase">🔴 Preço Acima (Caro)</span>
                        <p className="text-xl font-black text-red-600 dark:text-red-400">
                          {grahamSimData.grahamPrice ? `> ${formatCurrency(grahamSimData.grahamPrice)}` : '-'}
                        </p>
                        <span className="text-[10px] text-red-700/80">Sem margem de segurança</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* METHOD 2: DÉCIO BAZIN / BARSI (HISTORICAL DIVIDENDS - 1, 3 OR 5 YEARS) */}
        {/* ========================================================================= */}
        {activeMethod === 'bazin' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Controls Bar: Period selector & Target Yield */}
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="font-extrabold text-blue-900 dark:text-blue-200 text-sm flex items-center gap-1.5">
                    <Icon name="payments" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Parâmetros do Método Décio Bazin & Luiz Barsi
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    Preço Teto = <code className="bg-white/80 dark:bg-black/50 px-1 py-0.5 rounded font-mono font-bold">Dividendo Médio Anual ÷ Yield Alvo</code>. A média de 5 anos evita distorções de dividendos não recorrentes!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Period Pills */}
                  <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-blue-200 dark:border-blue-800 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setBazinPeriod('5y')}
                      className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all ${
                        bazinPeriod === '5y'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                      }`}
                      title="Média recomendada por Décio Bazin (5 anos)"
                    >
                      ⭐ Média 5 Anos (Bazin)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBazinPeriod('3y')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                        bazinPeriod === '3y'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                      }`}
                    >
                      Média 3 Anos
                    </button>
                    <button
                      type="button"
                      onClick={() => setBazinPeriod('1y')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                        bazinPeriod === '1y'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                      }`}
                    >
                      Últimos 12 Meses
                    </button>
                  </div>

                  {/* Target Yield Selector */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-2xs">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Yield Alvo:</span>
                    <select
                      value={bazinTargetYield}
                      onChange={(e) => setBazinTargetYield(parseFloat(e.target.value) || 6)}
                      className="text-xs font-extrabold bg-transparent text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
                    >
                      <option value={6}>6% a.a. (Padrão Ações Bazin)</option>
                      <option value={7}>7% a.a.</option>
                      <option value={8}>8% a.a. (Moderado)</option>
                      <option value={10}>10% a.a. (FIIs / Alto Rendimento)</option>
                      <option value={12}>12% a.a.</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Bazin: Minha Carteira View */}
            {activeView === 'portfolio' && (
              <div className="space-y-3">
                {allDividendInvestments.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 mx-auto flex items-center justify-center">
                      <Icon name="payments" className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Nenhum ativo de dividendos na carteira</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Cadastre Ações ou FIIs para acompanhar o Preço Teto calculado com a média de dividendos dos últimos 5 anos!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/80 dark:text-gray-400">
                        <tr>
                          <th scope="col" className="px-3.5 py-3">Ativo / Ticker</th>
                          <th scope="col" className="px-3 py-3 text-right">Cotação Atual</th>
                          <th scope="col" className="px-3 py-3 text-right" title="Dividendo médio anual pago no período selecionado">
                            Div. Médio Anual ({bazinPeriod === '5y' ? '5 Anos' : bazinPeriod === '3y' ? '3 Anos' : '12 Meses'})
                          </th>
                          <th scope="col" className="px-3 py-3 text-right" title="Dividend Yield anualizado atual">DY Atual</th>
                          <th scope="col" className="px-3 py-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold" title="Preço Teto de Bazin para garantir o Yield Alvo">
                            🎯 Preço Teto (Yield {bazinTargetYield}%)
                          </th>
                          <th scope="col" className="px-3 py-3 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold" title="Preço com 20% de margem sobre o teto">
                            🟢 Ótimo Preço
                          </th>
                          <th scope="col" className="px-3 py-3 text-center">Margem / Desconto</th>
                          <th scope="col" className="px-3 py-3 text-center">Diagnóstico Bazin</th>
                          <th scope="col" className="px-3 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {allDividendInvestments.map((inv) => {
                          const ticker = (inv.ticker || inv.name).toUpperCase().trim();
                          const bData = bazinDataMap[ticker];
                          const currentPrice = (bData && bData.currentPrice > 0) ? bData.currentPrice : (inv.current_price || inv.average_price || 0);
                          const isOpt = bData?.status === 'OTIMO_PRECO';
                          const isBelow = bData?.status === 'ABAIXO_DO_TETO';
                          const isAbove = bData?.status === 'ACIMA_DO_TETO';

                          return (
                            <tr
                              key={inv.id}
                              className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${
                                isOpt ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                              }`}
                            >
                              <td className="px-3.5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono font-extrabold text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-xs">
                                    {ticker}
                                  </span>
                                  <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-xs line-clamp-1">{inv.name}</p>
                                    <p className="text-[10px] text-gray-400">{inv.investment_type?.name || 'Renda Variável'}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(currentPrice)}
                              </td>

                              <td className="px-3 py-3.5 text-right text-gray-700 dark:text-gray-300 font-mono font-semibold">
                                {bData?.selectedDividend ? formatCurrency(bData.selectedDividend) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right text-blue-600 dark:text-blue-400 font-bold font-mono">
                                {bData?.dyCurrent !== null && bData?.dyCurrent !== undefined ? `${bData.dyCurrent.toFixed(1)}%` : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-black text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/10 whitespace-nowrap">
                                {bData?.ceilingPrice ? formatCurrency(bData.ceilingPrice) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                                {bData?.otimoPrice ? formatCurrency(bData.otimoPrice) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {bData?.discountPercent !== null && bData?.discountPercent !== undefined ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-0.5 ${
                                      bData.discountPercent >= 20
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                        : bData.discountPercent > 0
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                                    }`}
                                  >
                                    {bData.discountPercent > 0 ? `+${bData.discountPercent}% desc.` : `${bData.discountPercent}% acima`}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {isOpt && <Badge color="green" className="text-[10px] font-bold">🟢 Ótimo Preço (≥20%)</Badge>}
                                {isBelow && <Badge color="blue" className="text-[10px] font-bold">🟡 Abaixo do Teto (Comprar)</Badge>}
                                {isAbove && <Badge color="red" className="text-[10px] font-bold">🔴 Acima do Teto (Aguardar)</Badge>}
                                {!bData && <span className="text-[10px] text-gray-400">{isLoadingBazin ? 'Calculando...' : 'Sem dados'}</span>}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {onOpenEntryModal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenEntryModal(inv)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                    title="Registrar aporte"
                                  >
                                    <Icon name="add_circle" size="sm" />
                                    <span>Aportar</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Bazin: Simulator View */}
            {activeView === 'simulator' && (
              <div className="space-y-4">
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Digite o código da ação ou FII (Ex: BBAS3, TAEE11, PETR4, MXRF11...)"
                      value={bazinSearchTicker}
                      onChange={(e) => setBazinSearchTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchBazinTicker(bazinSearchTicker);
                        }
                      }}
                      className="font-mono font-bold uppercase text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleSearchBazinTicker(bazinSearchTicker)}
                      disabled={isBazinSimLoading || !bazinSearchTicker.trim()}
                      className="shrink-0 text-xs flex items-center gap-1"
                    >
                      <Icon name="search" size="sm" className={isBazinSimLoading ? 'animate-spin' : ''} />
                      <span>{isBazinSimLoading ? 'Buscando Proventos...' : 'Calcular Preço Teto Bazin'}</span>
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Atalhos rápidos para análise de dividendos:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_BAZIN_TICKERS.map(item => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => {
                            setBazinSearchTicker(item.ticker);
                            handleSearchBazinTicker(item.ticker);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                            bazinSimData?.ticker === item.ticker
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-gray-700/80 hover:bg-blue-50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {item.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {bazinSimError && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-lg text-xs">
                    {bazinSimError}
                  </div>
                )}

                {bazinSimData && (
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-md">
                          {bazinSimData.ticker}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-gray-900 dark:text-white text-base">{bazinSimData.name}</h4>
                          <p className="text-xs text-gray-500">Histórico de proventos com ajuste de desdobramentos</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                          bazinSimData.status === 'OTIMO_PRECO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          bazinSimData.status === 'ABAIXO_DO_TETO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {bazinSimData.statusLabel}
                        </span>

                        {onOpenNewInvModal && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenNewInvModal(bazinSimData.ticker, bazinSimData.currentPrice)}
                            className="text-xs flex items-center gap-1"
                          >
                            <Icon name="add" size="sm" /> Adicionar à Carteira
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Historical Dividends Comparison (1y vs 3y vs 5y) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Últimos 12 Meses (1 Ano)</span>
                        <p className="text-base font-extrabold text-gray-800 dark:text-gray-200">{formatCurrency(bazinSimData.dividend1y)} / cota</p>
                        <span className="text-[10px] text-blue-500 font-semibold">Teto 6%: {formatCurrency(bazinSimData.dividend1y / 0.06)}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Média Anual (3 Anos)</span>
                        <p className="text-base font-extrabold text-gray-800 dark:text-gray-200">{formatCurrency(bazinSimData.dividend3yAvg)} / cota / ano</p>
                        <span className="text-[10px] text-blue-500 font-semibold">Teto 6%: {formatCurrency(bazinSimData.dividend3yAvg / 0.06)}</span>
                      </div>

                      <div className="space-y-0.5 border-l-2 border-l-blue-500 pl-3">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase">⭐ Média Anual 5 Anos (Bazin)</span>
                        <p className="text-base font-black text-blue-600 dark:text-blue-400">{formatCurrency(bazinSimData.dividend5yAvg)} / cota / ano</p>
                        <span className="text-[10px] text-blue-600 font-bold">Teto 6%: {formatCurrency(bazinSimData.dividend5yAvg / 0.06)}</span>
                      </div>
                    </div>

                    {/* Main Pricing Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Cotação Atual</span>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(bazinSimData.currentPrice)}</p>
                        <span className="text-[10px] text-gray-500">B3</span>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">🎯 Preço Teto (Yield {bazinTargetYield}%)</span>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(bazinSimData.ceilingPrice)}</p>
                        <span className="text-[10px] text-blue-700/80">Valor máximo para comprar</span>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">🟢 Ótimo Preço (-20%)</span>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(bazinSimData.otimoPrice)}</p>
                        <span className="text-[10px] text-emerald-700/80">Margem de segurança alta</span>
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">DY 12M Atual</span>
                        <p className="text-xl font-black text-purple-600 dark:text-purple-400">
                          {bazinSimData.dyCurrent !== null ? `${bazinSimData.dyCurrent}%` : '-'}
                        </p>
                        <span className="text-[10px] text-purple-700/80">Retorno em dividendos</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* METHOD 3: FII ANALYSIS (IMOBILIÁRIO - P/VP, VP/COTA, DY 12M) */}
        {/* ========================================================================= */}
        {activeMethod === 'fii' && (
          <div className="space-y-4 animate-fadeIn">
            {/* FII Guidance Banner */}
            <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-4 space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="font-extrabold text-purple-900 dark:text-purple-200 text-sm flex items-center gap-1.5">
                    <Icon name="apartment" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Como Avaliar Fundos Imobiliários (FIIs) Corretamente
                  </h4>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    FIIs são avaliados principalmente pela relação <strong>P/VP (Preço / Valor Patrimonial)</strong> e pelo <strong>Dividend Yield recorrente</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 shadow-2xs">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Yield Alvo FII:</span>
                  <select
                    value={fiiTargetYield}
                    onChange={(e) => setFiiTargetYield(parseFloat(e.target.value) || 8.5)}
                    className="text-xs font-extrabold bg-transparent text-purple-600 dark:text-purple-400 focus:outline-none cursor-pointer"
                  >
                    <option value={8}>8.0% a.a.</option>
                    <option value={8.5}>8.5% a.a. (Recomendado FII)</option>
                    <option value={9}>9.0% a.a.</option>
                    <option value={10}>10.0% a.a.</option>
                    <option value={11}>11.0% a.a.</option>
                  </select>
                </div>
              </div>

              {/* P/VP Criteria Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 bg-emerald-100/60 dark:bg-emerald-950/40 rounded-lg text-emerald-800 dark:text-emerald-300">
                  <strong>🟢 P/VP &lt; 0,90:</strong> Forte Desconto (&gt;10% abaixo do patrimônio).
                </div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-emerald-700 dark:text-emerald-300">
                  <strong>🟢 0,90 a 0,99:</strong> Desconto Atrativo no valor patrimonial.
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-300">
                  <strong>🟡 1,00 a 1,05:</strong> Preço Justo / Equilibrado com o VP.
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-800 dark:text-red-300">
                  <strong>🔴 P/VP &gt; 1,05:</strong> Negociando com Ágio (Caro).
                </div>
              </div>
            </div>

            {/* FII: Minha Carteira View */}
            {activeView === 'portfolio' && (
              <div className="space-y-3">
                {fiiInvestments.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-500 mx-auto flex items-center justify-center">
                      <Icon name="apartment" className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Nenhum FII cadastrado na carteira</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Cadastre seus fundos imobiliários (ex: MXRF11, HGLG11, XPML11) para acompanhar o P/VP, VP por cota e rendimentos mensais em tempo real!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/80 dark:text-gray-400">
                        <tr>
                          <th scope="col" className="px-3.5 py-3">FII / Ticker</th>
                          <th scope="col" className="px-3 py-3">Segmento</th>
                          <th scope="col" className="px-3 py-3 text-right">Cotação Atual</th>
                          <th scope="col" className="px-3 py-3 text-right" title="Valor Patrimonial por Cota">VP / Cota</th>
                          <th scope="col" className="px-3 py-3 text-center font-bold" title="Preço sobre Valor Patrimonial">P/VP</th>
                          <th scope="col" className="px-3 py-3 text-right text-purple-600 dark:text-purple-400 font-bold" title="Dividend Yield últimos 12 meses">DY 12M</th>
                          <th scope="col" className="px-3 py-3 text-right text-gray-600 dark:text-gray-300" title="Rendimento médio mensal por cota">Rend. Médio Mês</th>
                          <th scope="col" className="px-3 py-3 text-right bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-bold">
                            🎯 Preço Teto (Yield {fiiTargetYield}%)
                          </th>
                          <th scope="col" className="px-3 py-3 text-center">Diagnóstico Patrimonial</th>
                          <th scope="col" className="px-3 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {fiiInvestments.map((inv) => {
                          const ticker = (inv.ticker || inv.name).toUpperCase().trim();
                          const fData = fiiDataMap[ticker];
                          const currentPrice = (fData && fData.currentPrice > 0) ? fData.currentPrice : (inv.current_price || inv.average_price || 0);

                          return (
                            <tr
                              key={inv.id}
                              className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${
                                fData?.pvpStatus === 'FORTE_DESCONTO' ? 'bg-emerald-50/30 dark:bg-emerald-950/15' : ''
                              }`}
                            >
                              <td className="px-3.5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono font-extrabold text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-xs">
                                    {ticker}
                                  </span>
                                  <div>
                                    <p className="font-bold text-gray-900 dark:text-white text-xs line-clamp-1">{inv.name}</p>
                                    <p className="text-[10px] text-gray-400">Fundo Imobiliário</p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3.5 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                                {fData?.segment || 'Imobiliário'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                                {formatCurrency(currentPrice)}
                              </td>

                              <td className="px-3 py-3.5 text-right text-gray-600 dark:text-gray-300 font-mono">
                                {fData?.vpCota ? formatCurrency(fData.vpCota) : '-'}
                              </td>

                              {/* P/VP with color coded badge */}
                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {fData?.pvp !== null && fData?.pvp !== undefined ? (
                                  <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                                    fData.pvp < 0.90 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                    fData.pvp < 1.00 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                    fData.pvp <= 1.05 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                    'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  }`}>
                                    {fData.pvp.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>

                              <td className="px-3 py-3.5 text-right text-purple-600 dark:text-purple-400 font-black font-mono">
                                {fData?.dy12m !== null && fData?.dy12m !== undefined ? `${fData.dy12m.toFixed(1)}%` : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right text-gray-700 dark:text-gray-300 font-mono">
                                {fData?.avgMonthlyDividend ? formatCurrency(fData.avgMonthlyDividend) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-right font-black text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-950/10 whitespace-nowrap">
                                {fData?.ceilingPrice ? formatCurrency(fData.ceilingPrice) : '-'}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {fData?.pvpStatus === 'FORTE_DESCONTO' && <Badge color="green" className="text-[10px] font-bold">🟢 Forte Desconto</Badge>}
                                {fData?.pvpStatus === 'DESCONTO' && <Badge color="green" className="text-[10px] font-bold">🟢 Desconto no VP</Badge>}
                                {fData?.pvpStatus === 'JUSTO' && <Badge color="yellow" className="text-[10px] font-bold">🟡 Preço Justo (≈1,00)</Badge>}
                                {fData?.pvpStatus === 'AGIO' && <Badge color="red" className="text-[10px] font-bold">🔴 Negociando com Ágio</Badge>}
                                {!fData && <span className="text-[10px] text-gray-400">{isLoadingFii ? 'Calculando...' : 'Sem dados'}</span>}
                              </td>

                              <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                {onOpenEntryModal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenEntryModal(inv)}
                                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-colors inline-flex items-center gap-1"
                                    title="Registrar aporte"
                                  >
                                    <Icon name="add_circle" size="sm" />
                                    <span>Aportar</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* FII: Simulator View */}
            {activeView === 'simulator' && (
              <div className="space-y-4">
                <div className="bg-gray-50/80 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Digite o código do FII (Ex: MXRF11, HGLG11, XPML11, KNCR11...)"
                      value={fiiSearchTicker}
                      onChange={(e) => setFiiSearchTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchFiiTicker(fiiSearchTicker);
                        }
                      }}
                      className="font-mono font-bold uppercase text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleSearchFiiTicker(fiiSearchTicker)}
                      disabled={isFiiSimLoading || !fiiSearchTicker.trim()}
                      className="shrink-0 text-xs flex items-center gap-1"
                    >
                      <Icon name="search" size="sm" className={isFiiSimLoading ? 'animate-spin' : ''} />
                      <span>{isFiiSimLoading ? 'Buscando FII...' : 'Analisar FII na B3'}</span>
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Atalhos rápidos de FIIs:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_FII_TICKERS.map(item => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => {
                            setFiiSearchTicker(item.ticker);
                            handleSearchFiiTicker(item.ticker);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                            fiiSimData?.ticker === item.ticker
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-white dark:bg-gray-700/80 hover:bg-purple-50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {item.ticker}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {fiiSimError && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-lg text-xs">
                    {fiiSimError}
                  </div>
                )}

                {fiiSimData && (
                  <div className="bg-white dark:bg-gray-800/90 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-md">
                          {fiiSimData.ticker}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-gray-900 dark:text-white text-base">{fiiSimData.name}</h4>
                          <p className="text-xs text-gray-500">Segmento: <strong>{fiiSimData.segment}</strong> • Indicadores da B3</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                          fiiSimData.pvpStatus === 'FORTE_DESCONTO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          fiiSimData.pvpStatus === 'DESCONTO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          fiiSimData.pvpStatus === 'JUSTO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {fiiSimData.pvpStatusLabel}
                        </span>

                        {onOpenNewInvModal && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenNewInvModal(fiiSimData.ticker, fiiSimData.currentPrice)}
                            className="text-xs flex items-center gap-1"
                          >
                            <Icon name="add" size="sm" /> Adicionar à Carteira
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Cotação Atual</span>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(fiiSimData.currentPrice)}</p>
                        <span className="text-[10px] text-gray-500">B3</span>
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">P/VP (Preço / Patrimônio)</span>
                        <p className="text-xl font-black text-purple-600 dark:text-purple-400">
                          {fiiSimData.pvp !== null ? fiiSimData.pvp.toFixed(2) : '-'}
                        </p>
                        <span className="text-[10px] text-purple-700/80">VP/Cota: {formatCurrency(fiiSimData.vpCota)}</span>
                      </div>

                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">DY 12M & Rendimento</span>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                          {fiiSimData.dy12m !== null ? `${fiiSimData.dy12m}%` : '-'}
                        </p>
                        <span className="text-[10px] text-emerald-700/80">Média: {formatCurrency(fiiSimData.avgMonthlyDividend)}/mês</span>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">🎯 Preço Teto ({fiiTargetYield}%)</span>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(fiiSimData.ceilingPrice)}</p>
                        <span className="text-[10px] text-blue-700/80">Baseado no rendimento</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-xl text-xs space-y-1 border border-gray-100 dark:border-gray-700">
                      <span className="font-extrabold text-gray-700 dark:text-gray-200">Diagnóstico da Análise:</span>
                      <p className="text-gray-600 dark:text-gray-300">{fiiSimData.overallVerdict}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
