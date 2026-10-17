'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { StockFullDetails } from '@/app/api/stocks/details/route';

interface IndicatorConfig {
  id: string;
  label: string;
  category: 'valuation' | 'endividamento' | 'eficiencia';
  info: string;
  format: 'percent' | 'decimal' | 'currency' | 'billions';
  winnerRule: 'higher' | 'lower' | 'none';
  getValue: (s: StockFullDetails) => number | null;
}

const ALL_INDICATORS: IndicatorConfig[] = [
  // --- VALUATION ---
  {
    id: 'earningYield',
    label: 'EARNING YIELD',
    category: 'valuation',
    info: 'Rendimento do Lucro em relação ao preço da ação (Inverso do P/L). Quanto maior, mais atrativo.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => (s.pl && s.pl > 0 ? (1 / s.pl) * 100 : s.lpa && s.currentPrice > 0 ? (s.lpa / s.currentPrice) * 100 : null)
  },
  {
    id: 'dy',
    label: 'D.Y. (DIVIDEND YIELD)',
    category: 'valuation',
    info: 'Rendimento de dividendos pagos por ação nos últimos 12 meses dividido pela cotação.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.dy
  },
  {
    id: 'lpa',
    label: 'LPA',
    category: 'valuation',
    info: 'Lucro por Ação: indica o lucro líquido gerado por cada cota.',
    format: 'decimal',
    winnerRule: 'higher',
    getValue: (s) => s.lpa
  },
  {
    id: 'pl',
    label: 'P/L',
    category: 'valuation',
    info: 'Preço sobre Lucro: quantos anos levaria para recuperar o capital investido através do lucro.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => (s.pl && s.pl > 0 ? s.pl : null)
  },
  {
    id: 'pvp',
    label: 'P/VP',
    category: 'valuation',
    info: 'Preço sobre Valor Patrimonial: relação entre o preço de mercado e o patrimônio líquido contábil.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => (s.pvp && s.pvp > 0 ? s.pvp : null)
  },
  {
    id: 'vpa',
    label: 'VPA',
    category: 'valuation',
    info: 'Valor Patrimonial por Ação: patrimônio líquido dividido pelo número de ações.',
    format: 'decimal',
    winnerRule: 'higher',
    getValue: (s) => s.vpa
  },
  {
    id: 'evFcl',
    label: 'EV/FCL',
    category: 'valuation',
    info: 'Enterprise Value dividido pelo Fluxo de Caixa Livre gerado pela empresa.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => {
      // Estimated EV/FCL
      if (s.enterpriseValue && s.lucroLiquido12m) {
        const estFcl = s.lucroLiquido12m * 0.8;
        return estFcl > 0 ? s.enterpriseValue / estFcl : null;
      }
      return null;
    }
  },
  {
    id: 'evFco',
    label: 'EV/FCO',
    category: 'valuation',
    info: 'Enterprise Value dividido pelo Fluxo de Caixa Operacional.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => {
      if (s.enterpriseValue && s.ebitda12m) {
        return s.ebitda12m > 0 ? s.enterpriseValue / (s.ebitda12m * 0.9) : null;
      }
      return s.evebitda;
    }
  },
  {
    id: 'evReceitaLiquida',
    label: 'EV/RECEITA LÍQUIDA',
    category: 'valuation',
    info: 'Valor da Firma dividido pela Receita Líquida dos últimos 12 meses.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => (s.enterpriseValue && s.receitaLiquida12m ? s.enterpriseValue / s.receitaLiquida12m : null)
  },
  {
    id: 'pFcl',
    label: 'P/FCL',
    category: 'valuation',
    info: 'Preço da ação dividido pelo Fluxo de Caixa Livre por ação.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => {
      if (s.marketCap && s.lucroLiquido12m) {
        const estFcl = s.lucroLiquido12m * 0.8;
        return estFcl > 0 ? s.marketCap / estFcl : null;
      }
      return null;
    }
  },
  {
    id: 'pFco',
    label: 'P/FCO',
    category: 'valuation',
    info: 'Preço da ação dividido pelo Fluxo de Caixa Operacional por ação.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => {
      if (s.marketCap && s.ebitda12m) {
        return s.ebitda12m > 0 ? s.marketCap / (s.ebitda12m * 0.9) : null;
      }
      return null;
    }
  },
  {
    id: 'pebitda',
    label: 'P/EBITDA',
    category: 'valuation',
    info: 'Preço sobre EBITDA: avalia a geração operacional de caixa.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.pebitda
  },
  {
    id: 'pebit',
    label: 'P/EBIT',
    category: 'valuation',
    info: 'Preço sobre Lucro Operacional (EBIT).',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.pebit
  },
  {
    id: 'evebit',
    label: 'EV/EBIT',
    category: 'valuation',
    info: 'Enterprise Value sobre EBIT (avalia o valor de mercado mais dívida sobre o lucro operacional).',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.evebit
  },
  {
    id: 'evebitda',
    label: 'EV/EBITDA',
    category: 'valuation',
    info: 'Enterprise Value sobre EBITDA.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.evebitda
  },
  {
    id: 'enterpriseValue',
    label: 'ENTERPRISE VALUE',
    category: 'valuation',
    info: 'Valor total da firma (Valor de mercado + Dívida Líquida).',
    format: 'billions',
    winnerRule: 'higher',
    getValue: (s) => s.enterpriseValue
  },
  {
    id: 'marketCap',
    label: 'VALOR DE MERCADO',
    category: 'valuation',
    info: 'Cotação multiplicada pelo número total de ações da empresa.',
    format: 'billions',
    winnerRule: 'higher',
    getValue: (s) => s.marketCap
  },
  {
    id: 'psr',
    label: 'P/RECEITA (PSR)',
    category: 'valuation',
    info: 'Preço sobre Receita Líquida (Price to Sales Ratio).',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.psr
  },
  {
    id: 'payout',
    label: 'PAYOUT',
    category: 'valuation',
    info: 'Porcentagem do lucro líquido distribuída aos acionistas em forma de dividendos e JCP.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.payout
  },

  // --- ENDIVIDAMENTO ---
  {
    id: 'dividaLiquida',
    label: 'DÍVIDA LÍQUIDA',
    category: 'endividamento',
    info: 'Dívida Bruta total menos disponibilidades em caixa e equivalentes.',
    format: 'billions',
    winnerRule: 'lower',
    getValue: (s) => s.dividaLiquida
  },
  {
    id: 'dividaLiquidaEbitda',
    label: 'DÍV. LÍQ./EBITDA',
    category: 'endividamento',
    info: 'Grau de endividamento da empresa em relação à sua capacidade de gerar caixa operacional.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.dividaLiquidaEbitda
  },
  {
    id: 'dividaLiquidaPatrimonio',
    label: 'DÍV. LÍQUIDA/PL',
    category: 'endividamento',
    info: 'Dívida Líquida em proporção ao Patrimônio Líquido dos acionistas.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => s.dividaLiquidaPatrimonio
  },
  {
    id: 'liquidezCorrente',
    label: 'LIQ. CORRENTE',
    category: 'endividamento',
    info: 'Capacidade da empresa de honrar suas obrigações de curto prazo (Ativo Circulante / Passivo Circulante).',
    format: 'decimal',
    winnerRule: 'higher',
    getValue: (s) => s.liquidezCorrente
  },
  {
    id: 'plAtivos',
    label: 'PL/ATIVOS',
    category: 'endividamento',
    info: 'Patrimônio Líquido dividido pelo Ativo Total.',
    format: 'decimal',
    winnerRule: 'higher',
    getValue: (s) => (s.patrimonioLiquido && s.ativoTotal ? s.patrimonioLiquido / s.ativoTotal : null)
  },
  {
    id: 'passivosAtivos',
    label: 'PASSIVOS/ATIVOS',
    category: 'endividamento',
    info: 'Participação do capital de terceiros no financiamento dos ativos.',
    format: 'decimal',
    winnerRule: 'lower',
    getValue: (s) => (s.patrimonioLiquido && s.ativoTotal ? (s.ativoTotal - s.patrimonioLiquido) / s.ativoTotal : null)
  },

  // --- EFICIÊNCIA & RENTABILIDADE ---
  {
    id: 'margemLiquida',
    label: 'MARGEM LÍQUIDA',
    category: 'eficiencia',
    info: 'Porcentagem de cada Real de receita líquida que se transforma em lucro líquido.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.margemLiquida
  },
  {
    id: 'margemEbitda',
    label: 'MARGEM EBITDA',
    category: 'eficiencia',
    info: 'EBITDA sobre Receita Líquida.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.margemEbitda
  },
  {
    id: 'margemEbit',
    label: 'MARGEM EBIT',
    category: 'eficiencia',
    info: 'Lucro Operacional (EBIT) sobre Receita Líquida.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.margemEbit
  },
  {
    id: 'margemBruta',
    label: 'MARGEM BRUTA',
    category: 'eficiencia',
    info: 'Lucro Bruto dividido pela Receita Líquida.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.margemBruta
  },
  {
    id: 'roe',
    label: 'ROE (RETORNO S/ PL)',
    category: 'eficiencia',
    info: 'Retorno sobre o Patrimônio Líquido: mede a rentabilidade do dinheiro dos acionistas.',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.roe
  },
  {
    id: 'roic',
    label: 'ROIC (CAPITAL INVESTIDO)',
    category: 'eficiencia',
    info: 'Retorno sobre o Capital Total Investido (acionistas + credores).',
    format: 'percent',
    winnerRule: 'higher',
    getValue: (s) => s.roic
  }
];

interface StockComparatorProps {
  initialTickers?: string[];
  onSelectTicker?: (ticker: string) => void;
}

export function StockComparator({
  initialTickers = ['SAPR4', 'SBSP3', 'CSMG3'],
  onSelectTicker
}: StockComparatorProps) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(initialTickers);
  const [stocksData, setStocksData] = useState<Record<string, StockFullDetails>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  // Collapsible section states
  const [openSections, setOpenSections] = useState({
    valuation: true,
    endividamento: true,
    eficiencia: true
  });

  // Filter Modal
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [enabledIndicatorIds, setEnabledIndicatorIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_INDICATORS.forEach((ind) => {
      init[ind.id] = true;
    });
    return init;
  });

  // Add Company Input
  const [newTickerInput, setNewTickerInput] = useState('');
  const [isAddingTicker, setIsAddingTicker] = useState(false);

  // Fetch ticker details
  const fetchTickerData = async (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!clean || stocksData[clean]) return;

    setLoadingMap((prev) => ({ ...prev, [clean]: true }));
    setErrorMap((prev) => ({ ...prev, [clean]: '' }));

    try {
      const res = await fetch(`/api/stocks/details?ticker=${encodeURIComponent(clean)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data: StockFullDetails = await res.json();
        setStocksData((prev) => ({ ...prev, [clean]: data }));
      } else {
        const err = await res.json();
        setErrorMap((prev) => ({ ...prev, [clean]: err.error || 'Erro ao carregar ativo' }));
      }
    } catch {
      setErrorMap((prev) => ({ ...prev, [clean]: 'Erro de conexão' }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [clean]: false }));
    }
  };

  useEffect(() => {
    selectedTickers.forEach((t) => {
      if (!stocksData[t]) {
        fetchTickerData(t);
      }
    });
  }, [selectedTickers]);

  const handleAddTicker = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTickerInput.trim().toUpperCase();
    if (!clean) return;

    if (!selectedTickers.includes(clean)) {
      setSelectedTickers((prev) => [...prev, clean]);
      fetchTickerData(clean);
    }
    setNewTickerInput('');
    setIsAddingTicker(false);
  };

  const handleRemoveTicker = (tickerToRemove: string) => {
    setSelectedTickers((prev) => prev.filter((t) => t !== tickerToRemove));
  };

  const toggleSection = (cat: 'valuation' | 'endividamento' | 'eficiencia') => {
    setOpenSections((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleToggleIndicator = (id: string) => {
    setEnabledIndicatorIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    ALL_INDICATORS.forEach((ind) => {
      updated[ind.id] = select;
    });
    setEnabledIndicatorIds(updated);
  };

  // Format Helper
  const formatValue = (val: number | null | undefined, format: IndicatorConfig['format']) => {
    if (val === null || val === undefined || isNaN(val)) return '-';

    switch (format) {
      case 'percent':
        return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      case 'decimal':
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'currency':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      case 'billions': {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1e9) {
          return `R$ ${sign}${(abs / 1e9).toFixed(0)} bi`;
        }
        if (abs >= 1e6) {
          return `R$ ${sign}${(abs / 1e6).toFixed(0)} mi`;
        }
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      }
      default:
        return String(val);
    }
  };

  // Determine winner for each indicator row
  const getWinnerTicker = (indicator: IndicatorConfig): string | null => {
    if (indicator.winnerRule === 'none' || selectedTickers.length < 2) return null;

    let bestTicker: string | null = null;
    let bestVal: number | null = null;

    for (const t of selectedTickers) {
      const stock = stocksData[t];
      if (!stock) continue;
      const v = indicator.getValue(stock);
      if (v === null || isNaN(v)) continue;

      if (bestVal === null) {
        bestVal = v;
        bestTicker = t;
      } else if (indicator.winnerRule === 'higher') {
        if (v > bestVal) {
          bestVal = v;
          bestTicker = t;
        }
      } else if (indicator.winnerRule === 'lower') {
        // Lower is better, but must usually be > 0 unless negative debt
        if (v < bestVal) {
          bestVal = v;
          bestTicker = t;
        }
      }
    }

    return bestTicker;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Card: Selected Companies & Actions */}
      <GlassCard className="p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              EMPRESAS SELECIONADAS
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {selectedTickers.map((ticker) => {
                const stock = stocksData[ticker];
                const isLoading = loadingMap[ticker];
                return (
                  <div
                    key={ticker}
                    className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xs hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black">
                      {ticker.slice(0, 2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectTicker?.(ticker)}
                      className="font-bold text-xs text-gray-800 dark:text-slate-200 hover:text-emerald-600 transition-colors"
                      title={stock ? `${stock.name} - R$ ${stock.currentPrice}` : 'Ver Detalhes'}
                    >
                      {ticker}
                    </button>
                    {isLoading && (
                      <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {selectedTickers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTicker(ticker)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                        title="Remover empresa"
                      >
                        <Icon name="close" className="text-[14px]" />
                      </button>
                    )}
                  </div>
                );
              })}

              {isAddingTicker ? (
                <form onSubmit={handleAddTicker} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newTickerInput}
                    onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                    placeholder="TICKER (ex: PETR4)"
                    autoFocus
                    className="w-32 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-slate-900 border border-emerald-500 text-xs font-bold uppercase focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs shadow-xs"
                  >
                    <Icon name="check" className="text-[14px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingTicker(false)}
                    className="p-1.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs"
                  >
                    <Icon name="close" className="text-[14px]" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-500/40 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Icon name="add" className="text-[16px]" />
                  <span>ADICIONAR</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick presets for common sectors */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 self-start md:self-center">
            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">Exemplos rápidos:</span>
            <button
              type="button"
              onClick={() => setSelectedTickers(['SAPR4', 'SBSP3', 'CSMG3'])}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 transition-colors whitespace-nowrap"
            >
              💧 Saneamento
            </button>
            <button
              type="button"
              onClick={() => setSelectedTickers(['BBAS3', 'ITUB4', 'BBDC4'])}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 transition-colors whitespace-nowrap"
            >
              🏦 Bancos
            </button>
            <button
              type="button"
              onClick={() => setSelectedTickers(['CMIG4', 'CPLE6', 'TAEE11'])}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 transition-colors whitespace-nowrap"
            >
              ⚡ Elétricas
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Sub-Header: Comparar Indicadores + Filter Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-700 dark:text-slate-300">
            COMPARAR INDICADORES
          </h2>
          <p className="text-xs text-gray-400">
            O troféu <span className="inline-block">🏆</span> indica a empresa com a melhor métrica no critério
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/80 shadow-xs transition-colors"
        >
          <Icon name="tune" className="text-[16px] text-emerald-500" />
          <span>Filtrar indicadores</span>
        </button>
      </div>

      {/* Table Section: 1. Valuation */}
      {(['valuation', 'endividamento', 'eficiencia'] as const).map((cat) => {
        const catTitle =
          cat === 'valuation'
            ? 'INDICADORES DE VALUATION'
            : cat === 'endividamento'
            ? 'INDICADORES DE ENDIVIDAMENTO'
            : 'INDICADORES DE EFICIÊNCIA';

        const catIndicators = ALL_INDICATORS.filter(
          (ind) => ind.category === cat && enabledIndicatorIds[ind.id] !== false
        );

        if (catIndicators.length === 0) return null;

        const isOpen = openSections[cat];

        return (
          <div
            key={cat}
            className="rounded-2xl border border-gray-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs"
          >
            {/* Header Accordion */}
            <button
              type="button"
              onClick={() => toggleSection(cat)}
              className="w-full flex items-center justify-between p-4 bg-gray-50/70 dark:bg-slate-800/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-white">
                  {catTitle}
                </h3>
                <span className="text-[11px] text-gray-400 font-semibold">({catIndicators.length})</span>
              </div>
              <Icon
                name={isOpen ? 'expand_less' : 'expand_more'}
                className="text-gray-400 transition-transform duration-200"
              />
            </button>

            {/* Table Content */}
            {isOpen && (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50">
                      <th className="py-3 px-4 font-extrabold text-gray-400 uppercase tracking-wider min-w-[200px]">
                        INDICADOR
                      </th>
                      {selectedTickers.map((ticker) => {
                        return (
                          <th
                            key={ticker}
                            className="py-3 px-4 font-bold text-gray-800 dark:text-slate-200 min-w-[130px]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-sky-500" />
                              <span className="font-extrabold text-sm">{ticker}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80 dark:divide-slate-800/60">
                    {catIndicators.map((indicator) => {
                      const winner = getWinnerTicker(indicator);

                      return (
                        <tr
                          key={indicator.id}
                          className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                        >
                          <td className="py-3 px-4 font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {indicator.label}
                            </span>
                            <span
                              className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 cursor-pointer text-[14px]"
                              title={indicator.info}
                            >
                              <Icon name="info" className="text-[14px]" />
                            </span>
                          </td>

                          {selectedTickers.map((ticker) => {
                            const stock = stocksData[ticker];
                            const val = stock ? indicator.getValue(stock) : null;
                            const isWinner = winner === ticker;

                            return (
                              <td
                                key={ticker}
                                className={`py-3 px-4 tabular-nums font-medium ${
                                  isWinner
                                    ? 'text-gray-900 dark:text-white font-bold'
                                    : 'text-gray-600 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{formatValue(val, indicator.format)}</span>
                                  {isWinner && (
                                    <span
                                      className="text-amber-500 text-sm animate-pulse-soft"
                                      title="Melhor indicador entre as selecionadas"
                                    >
                                      🏆
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Filter Modal (Image 3) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon name="tune" className="text-emerald-500" />
                <span>Filtrar indicadores</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
                INDICADORES
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  + Marcar todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-xs font-bold text-gray-400 hover:underline"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
              {/* Valuation Pills */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2.5">
                  Indicadores de valuation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_INDICATORS.filter((i) => i.category === 'valuation').map((ind) => {
                    const isChecked = enabledIndicatorIds[ind.id] !== false;
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => handleToggleIndicator(ind.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-400'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-sky-600 text-white' : 'border border-gray-400'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span>{ind.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Endividamento Pills */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2.5">
                  Indicadores de endividamento
                </h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_INDICATORS.filter((i) => i.category === 'endividamento').map((ind) => {
                    const isChecked = enabledIndicatorIds[ind.id] !== false;
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => handleToggleIndicator(ind.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-400'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-sky-600 text-white' : 'border border-gray-400'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span>{ind.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Eficiência Pills */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2.5">
                  Indicadores de eficiência
                </h4>
                <div className="flex flex-wrap gap-2">
                  {ALL_INDICATORS.filter((i) => i.category === 'eficiencia').map((ind) => {
                    const isChecked = enabledIndicatorIds[ind.id] !== false;
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => handleToggleIndicator(ind.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-400'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-transparent'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-sky-600 text-white' : 'border border-gray-400'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span>{ind.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                Concluir Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
