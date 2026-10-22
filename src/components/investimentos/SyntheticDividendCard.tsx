'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '@/lib/formatters';
import { OptionStrategy, OptionLeg } from '@/lib/options/optionsEngine';

// Curated default 5-year average dividend yields for benchmark Brazilian dividend stocks
const DEFAULT_5Y_DY: Record<string, number> = {
  BBDC3: 6.57,
  BBDC4: 7.20,
  TAEE11: 8.07,
  BBAS3: 9.85,
  PETR4: 14.50,
  PETR3: 13.80,
  VALE3: 7.40,
  ITUB4: 6.34,
  ITUB3: 5.90,
  BBSE3: 9.15,
  CMIG4: 8.70,
  CPLE6: 9.20,
  EGIE3: 6.90,
  SAPR11: 7.10,
  SAPR4: 6.90,
  VIVT3: 7.80,
  ITSA4: 7.90,
  ABEV3: 4.80,
  WEGE3: 1.85,
  KLBN11: 6.80,
  SANB11: 7.50,
  CSMG3: 6.20,
  TRPL4: 8.40,
  ALUP11: 6.10
};

interface SyntheticDividendCardProps {
  strategy: OptionStrategy;
  onUpdateStrategy?: (id: string, updates: Partial<OptionStrategy>) => void;
}

export function SyntheticDividendCard({
  strategy,
  onUpdateStrategy
}: SyntheticDividendCardProps) {
  const cleanTicker = (strategy.underlyingTicker || '').trim().toUpperCase().replace('.SA', '');
  
  // Custom DY state (from strategy or default)
  const initialDy = strategy.underlyingDy5y || DEFAULT_5Y_DY[cleanTicker] || 6.5;
  const [dy5y, setDy5y] = useState<number>(initialDy);
  const [isEditingDy, setIsEditingDy] = useState(false);
  const [dyInput, setDyInput] = useState(String(initialDy));
  const [loadingDy, setLoadingDy] = useState(false);

  // Fetch 5-year dividend history from API if not set on strategy
  useEffect(() => {
    if (strategy.underlyingDy5y) {
      setDy5y(strategy.underlyingDy5y);
      setDyInput(String(strategy.underlyingDy5y));
      return;
    }

    if (!cleanTicker) return;

    let isMounted = true;
    setLoadingDy(true);

    fetch('/api/stocks/bazin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: [cleanTicker], period: '5y' })
    })
      .then(r => r.json())
      .then(data => {
        if (!isMounted) return;
        const result = data?.results?.[cleanTicker];
        if (result && result.currentPrice > 0 && result.dividend5yAvg > 0) {
          const calculatedDy5y = Number(((result.dividend5yAvg / result.currentPrice) * 100).toFixed(2));
          if (calculatedDy5y > 0) {
            setDy5y(calculatedDy5y);
            setDyInput(String(calculatedDy5y));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingDy(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanTicker, strategy.underlyingDy5y]);

  const handleSaveDy = () => {
    const parsed = parseFloat(dyInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setDy5y(parsed);
      if (onUpdateStrategy) {
        onUpdateStrategy(strategy.id, { underlyingDy5y: parsed });
      }
    }
    setIsEditingDy(false);
  };

  // Find the sold leg (which generated the premium/synthetic dividend)
  const soldLeg = strategy.legs.find(l => l.side === 'sell');
  const boughtLeg = strategy.legs.find(l => l.side === 'buy');

  // Premium per share
  // For short single legs (venda de put / venda coberta), premium is entryPrice of the sold leg
  // For spreads, it's net credit (entryPrice of sold - entryPrice of bought)
  const qty = strategy.quantity || 100;
  const isNetCredit = strategy.strategyCategory === 'venda_put' || 
                      strategy.strategyCategory === 'venda_coberta' || 
                      (!boughtLeg && !!soldLeg);

  const premiumPerShare = isNetCredit
    ? (soldLeg ? soldLeg.entryPrice : strategy.entryCostPerUnit)
    : Math.max(0, strategy.entryCostPerUnit);

  const totalPremiumReceived = premiumPerShare * qty;

  const undPrice = strategy.underlyingPrice > 0 
    ? strategy.underlyingPrice 
    : (soldLeg?.strike || 1);

  // Dividend Calculations
  // 1. Annual Dividend in R$ per share: Cotação * (DY 5y / 100)
  const dyAnnualPerShare = Number(((undPrice * dy5y) / 100).toFixed(2));
  
  // 2. Monthly Dividend in R$ per share: Annual / 12
  const dyMonthlyPerShare = dyAnnualPerShare > 0 ? Number((dyAnnualPerShare / 12).toFixed(2)) : 0;

  // 3. Option Yield (% rate on strike or stock price)
  const referenceBase = soldLeg?.strike && soldLeg.strike > 0 ? soldLeg.strike : undPrice;
  const syntheticYieldPercent = referenceBase > 0 
    ? Number(((premiumPerShare / referenceBase) * 100).toFixed(2)) 
    : 0;

  // 4. Months of regular dividends equivalent
  const monthsEquivalent = dyMonthlyPerShare > 0 
    ? Number((premiumPerShare / dyMonthlyPerShare).toFixed(1)) 
    : 0;

  return (
    <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800/90 border border-emerald-100 dark:border-emerald-900/40 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Icon name="payments" size="sm" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>Dividendo Sintético vs Proventos da Ação</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold font-mono">
                {cleanTicker}
              </span>
            </h5>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Comparativo de renda passiva da operação de opções contra os dividendos pagos pela ação
            </p>
          </div>
        </div>

        {/* Highlight Pill */}
        {monthsEquivalent > 0 && (
          <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1">
            <span>⚡ Equivale a</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{monthsEquivalent} meses</span>
            <span>de proventos</span>
          </div>
        )}
      </div>

      {/* Spreadsheet Comparison Table (matching the user spreadsheet format) */}
      <div className="overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-900/40">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold border-b border-gray-200 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70">
            <tr>
              <th className="py-2 px-2.5">Ativo</th>
              <th className="py-2 px-2.5 text-right">Cotação</th>
              <th className="py-2 px-2.5 text-right">DY Médio 5a</th>
              <th className="py-2 px-2.5 text-right">DY Anual (Ação)</th>
              <th className="py-2 px-2.5 text-right">Provento / Mês</th>
              <th className="py-2 px-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                Opção (Sintético)
              </th>
              <th className="py-2 px-2.5 text-right">Ganho Total</th>
              <th className="py-2 px-2.5 text-center">Adiantamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800/60 font-mono text-[11px]">
            <tr className="hover:bg-white dark:hover:bg-gray-800/60 transition-colors">
              {/* Ativo */}
              <td className="py-2.5 px-2.5 font-bold text-gray-900 dark:text-white">
                {cleanTicker}
              </td>

              {/* Cotação */}
              <td className="py-2.5 px-2.5 text-right text-gray-900 dark:text-white">
                {formatCurrency(undPrice)}
              </td>

              {/* DY Médio 5 anos (Editável) */}
              <td className="py-2.5 px-2.5 text-right font-sans">
                {isEditingDy ? (
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="text"
                      value={dyInput}
                      onChange={(e) => setDyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDy();
                        if (e.key === 'Escape') setIsEditingDy(false);
                      }}
                      className="w-14 px-1 py-0.5 text-xs border rounded bg-white dark:bg-gray-800 font-mono font-bold text-right"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveDy}
                      className="p-0.5 text-emerald-600 hover:text-emerald-700"
                    >
                      <Icon name="check" size="xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingDy(false)}
                      className="p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <Icon name="close" size="xs" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDy(true)}
                    className="group inline-flex items-center gap-1 font-mono font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    title="Clique para ajustar o DY médio dos 5 anos"
                  >
                    <span>{dy5y.toFixed(2)}%</span>
                    <Icon name="edit" size="xs" className="opacity-0 group-hover:opacity-100 text-gray-400" />
                  </button>
                )}
              </td>

              {/* DY Anual em R$ */}
              <td className="py-2.5 px-2.5 text-right text-gray-600 dark:text-gray-300">
                {formatCurrency(dyAnnualPerShare)}
              </td>

              {/* Mês em R$/mês */}
              <td className="py-2.5 px-2.5 text-right font-semibold text-gray-900 dark:text-white">
                {formatCurrency(dyMonthlyPerShare)}
                <span className="text-[10px] text-gray-400 font-normal">/mês</span>
              </td>

              {/* Opção (Dividendo Sintético por ação) */}
              <td className="py-2.5 px-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span>{formatCurrency(premiumPerShare)}</span>
                <span className="text-[10px] font-normal opacity-80 block">
                  +{syntheticYieldPercent.toFixed(2)}% no mês
                </span>
              </td>

              {/* Ganho Total da Operação */}
              <td className="py-2.5 px-2.5 text-right font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalPremiumReceived)}
              </td>

              {/* Equivalência em Meses */}
              <td className="py-2.5 px-2.5 text-center font-sans">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200">
                  {monthsEquivalent > 0 ? `${monthsEquivalent}x mês` : '1x'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Narrative Synthesis */}
      <div className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-800/50 text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
        <Icon name="lightbulb" size="sm" className="text-amber-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Enquanto <strong className="text-gray-900 dark:text-white">{cleanTicker}</strong> paga em média{' '}
          <strong className="font-mono text-gray-900 dark:text-white">{formatCurrency(dyMonthlyPerShare)}/mês</strong> por ação em proventos,{' '}
          esta operação de opções gerou <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(premiumPerShare)}/ação</strong>{' '}
          (<strong className="text-emerald-600 dark:text-emerald-400">+{syntheticYieldPercent.toFixed(2)}%</strong> imediato),{' '}
          antecipando o equivalente a <strong className="text-gray-900 dark:text-white font-bold">{monthsEquivalent} meses</strong> de dividendos regulares na sua conta!
        </p>
      </div>
    </div>
  );
}
