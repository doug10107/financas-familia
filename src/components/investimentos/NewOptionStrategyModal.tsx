'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { 
  OptionStrategy, 
  OptionLeg, 
  StrategyCategory, 
  parseB3OptionTicker 
} from '@/lib/options/optionsEngine';

interface NewOptionStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (strat: Omit<OptionStrategy, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function NewOptionStrategyModal({ isOpen, onClose, onSave }: NewOptionStrategyModalProps) {
  const [strategyCategory, setStrategyCategory] = useState<StrategyCategory>('trava_baixa');
  const [name, setName] = useState('');
  const [underlyingTicker, setUnderlyingTicker] = useState('BOVA11');
  const [underlyingPrice, setUnderlyingPrice] = useState('121.45');
  const [quantity, setQuantity] = useState('100');
  const [entryCostPerUnit, setEntryCostPerUnit] = useState('2.13');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Targets
  const [target50, setTarget50] = useState('3.20');
  const [target80, setTarget80] = useState('3.83');
  const [stopLoss, setStopLoss] = useState('1.06');

  // Legs
  const [leg1Ticker, setLeg1Ticker] = useState('BOVAW205');
  const [leg1Type, setLeg1Type] = useState<'CALL' | 'PUT'>('PUT');
  const [leg1Side, setLeg1Side] = useState<'buy' | 'sell'>('buy');
  const [leg1Strike, setLeg1Strike] = useState('205.00');
  const [leg1Price, setLeg1Price] = useState('2.21');
  const [leg1Exp, setLeg1Exp] = useState('2026-11-20');
  const [isSearchingLeg1, setIsSearchingLeg1] = useState(false);

  const [leg2Ticker, setLeg2Ticker] = useState('BOVAW199');
  const [leg2Type, setLeg2Type] = useState<'CALL' | 'PUT'>('PUT');
  const [leg2Side, setLeg2Side] = useState<'buy' | 'sell'>('sell');
  const [leg2Strike, setLeg2Strike] = useState('199.00');
  const [leg2Price, setLeg2Price] = useState('0.08');
  const [leg2Exp, setLeg2Exp] = useState('2026-11-20');
  const [isSearchingLeg2, setIsSearchingLeg2] = useState(false);

  const [error, setError] = useState('');

  const isShortSingle = strategyCategory === 'venda_put' || strategyCategory === 'venda_coberta';
  const isLongSingle = strategyCategory === 'compra_seco' || strategyCategory === 'compra_seco_call' || strategyCategory === 'compra_seco_put';
  const isSpread = !isShortSingle && !isLongSingle;

  // Auto calculate targets when cost changes
  const handleCostChange = (val: string, categoryOverride?: StrategyCategory) => {
    setEntryCostPerUnit(val);
    const cost = parseFloat(val.replace(',', '.')) || 0;
    const cat = categoryOverride || strategyCategory;

    if (cost > 0) {
      if (cat === 'venda_put' || cat === 'venda_coberta') {
        // Operações vendidas: ganho ocorre com o prêmio desvalorizando (recompra mais barata)
        setTarget50((cost * 0.50).toFixed(2)); // Recompra por 50% do prêmio (+50% retido)
        setTarget80((cost * 0.20).toFixed(2)); // Recompra por 20% do prêmio (+80% retido)
        setStopLoss((cost * 1.50).toFixed(2)); // Stop se a opção subir 50% acima da venda
      } else {
        // Operações compradas ou travas a débito: ganho ocorre com valorização do spread
        setTarget50((cost * 1.50).toFixed(2));
        setTarget80((cost * 1.80).toFixed(2));
        setStopLoss((cost * 0.50).toFixed(2));
      }
    }
  };

  // Switch category defaults
  const handleCategoryChange = (cat: StrategyCategory) => {
    setStrategyCategory(cat);
    setError('');

    if (cat === 'venda_put') {
      setLeg1Ticker('');
      setLeg1Price('');
      setLeg2Type('PUT');
      setLeg2Side('sell');
      if (leg2Price) {
        handleCostChange(leg2Price, cat);
      }
      autoSuggestSingleLegName(cat, underlyingTicker, leg2Strike || 'STRIKE');
    } else if (cat === 'venda_coberta') {
      setLeg1Ticker('');
      setLeg1Price('');
      setLeg2Type('CALL');
      setLeg2Side('sell');
      if (leg2Price) {
        handleCostChange(leg2Price, cat);
      }
      autoSuggestSingleLegName(cat, underlyingTicker, leg2Strike || 'STRIKE');
    } else if (cat === 'compra_seco') {
      setLeg2Ticker('');
      setLeg2Price('');
      setLeg1Side('buy');
      if (leg1Price) {
        handleCostChange(leg1Price, cat);
      }
      autoSuggestSingleLegName(cat, underlyingTicker, leg1Strike || 'STRIKE');
    } else {
      // Travas / Spreads
      setLeg1Side('buy');
      setLeg2Side('sell');
      autoSuggestSpreadAndName(cat);
    }
  };

  const autoSuggestSingleLegName = (cat: StrategyCategory, root: string, strike: string) => {
    const asset = root || 'ATIVO';
    if (cat === 'venda_put') {
      setName(`Venda de Put - ${asset} (K ${strike})`);
    } else if (cat === 'venda_coberta') {
      setName(`Venda Coberta - ${asset} (K ${strike})`);
    } else if (cat === 'compra_seco') {
      setName(`Compra a Seco - ${asset} (K ${strike})`);
    }
  };

  // Intelligent parser for Leg 1
  const handleLeg1TickerBlur = async () => {
    const clean = leg1Ticker.trim().toUpperCase();
    if (!clean) return;

    setIsSearchingLeg1(true);
    try {
      const parsed = parseB3OptionTicker(clean);
      if (parsed.isValid) {
        setLeg1Type(parsed.type);
        if (parsed.estimatedStrike > 0) setLeg1Strike(parsed.estimatedStrike.toFixed(2));
        if (parsed.expirationDate) setLeg1Exp(parsed.expirationDate);
        if (!underlyingTicker || underlyingTicker === 'BOVA11') {
          setUnderlyingTicker(parsed.underlyingTicker);
        }
      }

      // Fetch live quote from API
      const res = await fetch(`/api/stocks/options?ticker=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price > 0) {
          setLeg1Price(data.price.toFixed(2));
          if (isLongSingle) {
            handleCostChange(data.price.toFixed(2));
          }
        }
        if (data.strike > 0) {
          setLeg1Strike(data.strike.toFixed(2));
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar ticker da perna 1:', e);
    } finally {
      setIsSearchingLeg1(false);
      if (isSpread) {
        autoSuggestSpreadAndName();
      } else if (isLongSingle) {
        autoSuggestSingleLegName(strategyCategory, underlyingTicker, leg1Strike);
      }
    }
  };

  // Intelligent parser for Leg 2
  const handleLeg2TickerBlur = async () => {
    const clean = leg2Ticker.trim().toUpperCase();
    if (!clean) return;

    setIsSearchingLeg2(true);
    try {
      const parsed = parseB3OptionTicker(clean);
      if (parsed.isValid) {
        setLeg2Type(parsed.type);
        if (parsed.estimatedStrike > 0) setLeg2Strike(parsed.estimatedStrike.toFixed(2));
        if (parsed.expirationDate) setLeg2Exp(parsed.expirationDate);
        if (isShortSingle && (!underlyingTicker || underlyingTicker === 'BOVA11')) {
          setUnderlyingTicker(parsed.underlyingTicker);
        }
      }

      // Fetch live quote from API
      const res = await fetch(`/api/stocks/options?ticker=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price > 0) {
          setLeg2Price(data.price.toFixed(2));
          if (isShortSingle) {
            handleCostChange(data.price.toFixed(2));
          }
        }
        if (data.strike > 0) {
          setLeg2Strike(data.strike.toFixed(2));
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar ticker da perna 2:', e);
    } finally {
      setIsSearchingLeg2(false);
      if (isSpread) {
        autoSuggestSpreadAndName();
      } else if (isShortSingle) {
        autoSuggestSingleLegName(strategyCategory, underlyingTicker, leg2Strike);
      }
    }
  };

  const autoSuggestSpreadAndName = (currentCat?: StrategyCategory) => {
    const p1 = parseFloat(leg1Price.replace(',', '.')) || 0;
    const p2 = parseFloat(leg2Price.replace(',', '.')) || 0;
    const spread = Math.abs(p1 - p2);

    if (spread > 0 && (!entryCostPerUnit || entryCostPerUnit === '0')) {
      handleCostChange(spread.toFixed(2), currentCat);
    }

    if (!name || name.startsWith('Trava') || name.startsWith('VENDA') || name.startsWith('COMPRA')) {
      const root = underlyingTicker || 'ATIVO';
      const k1 = leg1Strike || 'K1';
      const k2 = leg2Strike || 'K2';
      const cat = currentCat || strategyCategory;
      const label = cat === 'trava_baixa' ? 'Trava de Baixa' : 'Trava de Alta';
      setName(`${label} - ${root} (${k1} x ${k2})`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const qty = parseInt(quantity, 10) || 100;
    const cost = parseFloat(entryCostPerUnit.replace(',', '.')) || 0;
    const undPrice = parseFloat(underlyingPrice.replace(',', '.')) || 0;

    const legs: OptionLeg[] = [];

    if (isShortSingle) {
      // Venda de Put ou Venda Coberta: Apenas Ponta 2 (Vendida) é registrada
      if (!leg2Ticker.trim()) {
        setError('Por favor, informe o ticker da opção vendida (Ponta 2).');
        return;
      }
      legs.push({
        id: `leg-${Date.now()}-2`,
        ticker: leg2Ticker.trim().toUpperCase(),
        type: leg2Type,
        side: 'sell',
        strike: parseFloat(leg2Strike.replace(',', '.')) || 0,
        entryPrice: parseFloat(leg2Price.replace(',', '.')) || cost,
        currentPrice: parseFloat(leg2Price.replace(',', '.')) || cost,
        quantity: qty,
        expirationDate: leg2Exp
      });
    } else if (isLongSingle) {
      // Compra a Seco: Apenas Ponta 1 (Comprada) é registrada
      if (!leg1Ticker.trim()) {
        setError('Por favor, informe o ticker da opção comprada (Ponta 1).');
        return;
      }
      legs.push({
        id: `leg-${Date.now()}-1`,
        ticker: leg1Ticker.trim().toUpperCase(),
        type: leg1Type,
        side: 'buy',
        strike: parseFloat(leg1Strike.replace(',', '.')) || 0,
        entryPrice: parseFloat(leg1Price.replace(',', '.')) || cost,
        currentPrice: parseFloat(leg1Price.replace(',', '.')) || cost,
        quantity: qty,
        expirationDate: leg1Exp
      });
    } else {
      // Operações com 2 pontas (Travas / Personalizada)
      if (!leg1Ticker.trim()) {
        setError('Por favor, informe a ponta comprada (Ponta 1) da trava.');
        return;
      }
      legs.push({
        id: `leg-${Date.now()}-1`,
        ticker: leg1Ticker.trim().toUpperCase(),
        type: leg1Type,
        side: leg1Side,
        strike: parseFloat(leg1Strike.replace(',', '.')) || 0,
        entryPrice: parseFloat(leg1Price.replace(',', '.')) || 0,
        currentPrice: parseFloat(leg1Price.replace(',', '.')) || 0,
        quantity: qty,
        expirationDate: leg1Exp
      });

      if (leg2Ticker.trim()) {
        legs.push({
          id: `leg-${Date.now()}-2`,
          ticker: leg2Ticker.trim().toUpperCase(),
          type: leg2Type,
          side: leg2Side,
          strike: parseFloat(leg2Strike.replace(',', '.')) || 0,
          entryPrice: parseFloat(leg2Price.replace(',', '.')) || 0,
          currentPrice: parseFloat(leg2Price.replace(',', '.')) || 0,
          quantity: qty,
          expirationDate: leg2Exp
        });
      }
    }

    const defaultPrefix = isShortSingle 
      ? (strategyCategory === 'venda_put' ? 'Venda de Put' : 'Venda Coberta') 
      : (isLongSingle ? 'Compra a Seco' : strategyCategory.toUpperCase());

    const finalName = name.trim() || `${defaultPrefix} - ${underlyingTicker}`;

    // Max profit calculation:
    // For short single: 100% of received premium
    // For spread: difference of strikes - cost
    let calculatedMaxProfit = cost;
    if (isSpread && legs.length >= 2) {
      const strikeDiff = Math.abs(legs[0].strike - legs[1].strike);
      if (strikeDiff > 0) calculatedMaxProfit = Math.max(0, strikeDiff - cost);
    }

    onSave({
      name: finalName,
      underlyingTicker: underlyingTicker.trim().toUpperCase() || 'BOVA11',
      underlyingPrice: undPrice,
      strategyCategory,
      legs,
      quantity: qty,
      entryCostPerUnit: cost,
      totalEntryCost: cost * qty,
      entryDate,
      targetProfit50: parseFloat(target50.replace(',', '.')) || (isShortSingle ? cost * 0.5 : cost * 1.5),
      targetProfit80: parseFloat(target80.replace(',', '.')) || (isShortSingle ? cost * 0.2 : cost * 1.8),
      stopLossPrice: parseFloat(stopLoss.replace(',', '.')) || (isShortSingle ? cost * 1.5 : cost * 0.5),
      maxProfitPerUnit: calculatedMaxProfit,
      status: 'active',
      notes
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Estratégia / Operação de Opções">
      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Strategy Category & Underlying Asset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Operação / Estrutura
            </label>
            <select
              value={strategyCategory}
              onChange={(e) => handleCategoryChange(e.target.value as StrategyCategory)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500"
            >
              <optgroup label="Trava / Spreads (2 Pontas)">
                <option value="trava_baixa">Trava de Baixa (Bear Put/Call Spread)</option>
                <option value="trava_alta">Trava de Alta (Bull Call/Put Spread)</option>
                <option value="personalizada">Estratégia Personalizada</option>
              </optgroup>
              <optgroup label="Perna Única Vendida (Recebimento de Prêmio)">
                <option value="venda_put">Venda de Put (Lançamento / Renda com Caixa)</option>
                <option value="venda_coberta">Lançamento Coberto de Call (Venda Coberta)</option>
              </optgroup>
              <optgroup label="Perna Única Comprada (Direcional)">
                <option value="compra_seco">Compra a Seco (Call ou Put Comprada)</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Ativo-Objeto (Ação / ETF)
            </label>
            <div className="flex gap-2">
              <Input
                value={underlyingTicker}
                onChange={(e) => setUnderlyingTicker(e.target.value.toUpperCase())}
                placeholder="ex: BOVA11, PETR4, VALE3"
                className="uppercase font-bold"
                required
              />
              <Input
                value={underlyingPrice}
                onChange={(e) => setUnderlyingPrice(e.target.value)}
                placeholder="Cotação R$"
                className="w-28 text-xs font-mono"
                title="Cotação da ação"
              />
            </div>
          </div>
        </div>

        {/* Strategy Name */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Nome de Identificação da Operação
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Venda de Put - PETR4 (K 36.50) ou Trava de Baixa BOVA11"
            required
          />
        </div>

        {/* Legs Section */}
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700/80">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Icon name="alt_route" size="sm" /> 
              {isShortSingle ? 'Perna Única Vendida' : isLongSingle ? 'Perna Única Comprada' : 'Pernas da Trava (Opções B3)'}
            </h4>
            {isShortSingle && (
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                Operação Vendida: Ponta 1 Desativada
              </span>
            )}
            {isLongSingle && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Operação Comprada: Ponta 2 Desativada
              </span>
            )}
          </div>

          {/* Leg 1: Comprada (Long) */}
          <div className={`p-3 rounded-xl border transition-all ${
            isShortSingle 
              ? 'bg-gray-100/60 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-40 cursor-not-allowed' 
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/60 space-y-2'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon name="add_circle" size="sm" /> Ponta 1 (Comprada / Long)
              </span>
              {isShortSingle ? (
                <span className="text-[10px] text-gray-400 italic">Desativada para {strategyCategory === 'venda_put' ? 'Venda de Put' : 'Venda Coberta'}</span>
              ) : isSearchingLeg1 ? (
                <span className="text-[10px] text-gray-400 animate-pulse">Buscando cotação na B3...</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-gray-500 font-semibold">Ticker Opção</label>
                <Input
                  value={leg1Ticker}
                  onChange={(e) => setLeg1Ticker(e.target.value.toUpperCase())}
                  onBlur={handleLeg1TickerBlur}
                  placeholder="ex: BOVAW205"
                  className="text-xs font-mono font-bold uppercase"
                  disabled={isShortSingle}
                  required={!isShortSingle}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-500 font-semibold">Tipo / Strike (R$)</label>
                  <select
                    value={leg1Type}
                    onChange={(e) => setLeg1Type(e.target.value as 'CALL' | 'PUT')}
                    disabled={isShortSingle}
                    className="text-[10px] font-bold bg-transparent text-purple-600"
                  >
                    <option value="CALL">CALL</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>
                <Input
                  value={leg1Strike}
                  onChange={(e) => setLeg1Strike(e.target.value)}
                  placeholder="205.00"
                  className="text-xs font-mono"
                  disabled={isShortSingle}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-semibold">Preço Pago (R$)</label>
                <Input
                  value={leg1Price}
                  onChange={(e) => {
                    setLeg1Price(e.target.value);
                    if (isLongSingle) handleCostChange(e.target.value);
                    else autoSuggestSpreadAndName();
                  }}
                  placeholder="2.21"
                  className="text-xs font-mono font-bold text-emerald-600"
                  disabled={isShortSingle}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-semibold">Vencimento</label>
                <Input
                  type="date"
                  value={leg1Exp}
                  onChange={(e) => setLeg1Exp(e.target.value)}
                  className="text-xs"
                  disabled={isShortSingle}
                />
              </div>
            </div>
          </div>

          {/* Leg 2: Vendida (Short) */}
          <div className={`p-3 rounded-xl border transition-all ${
            isLongSingle 
              ? 'bg-gray-100/60 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-40 cursor-not-allowed' 
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/60 space-y-2'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Icon name="remove_circle" size="sm" /> Ponta 2 (Vendida / Short)
              </span>
              {isLongSingle ? (
                <span className="text-[10px] text-gray-400 italic">Desativada para Compra a Seco</span>
              ) : isSearchingLeg2 ? (
                <span className="text-[10px] text-gray-400 animate-pulse">Buscando cotação na B3...</span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-gray-500 font-semibold">Ticker Opção</label>
                <Input
                  value={leg2Ticker}
                  onChange={(e) => setLeg2Ticker(e.target.value.toUpperCase())}
                  onBlur={handleLeg2TickerBlur}
                  placeholder={strategyCategory === 'venda_put' ? 'ex: PETRV360' : 'ex: BOVAW19'}
                  className="text-xs font-mono font-bold uppercase"
                  disabled={isLongSingle}
                  required={isShortSingle}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-500 font-semibold">Tipo / Strike (R$)</label>
                  <select
                    value={leg2Type}
                    onChange={(e) => setLeg2Type(e.target.value as 'CALL' | 'PUT')}
                    disabled={isLongSingle || isShortSingle}
                    className="text-[10px] font-bold bg-transparent text-purple-600"
                  >
                    <option value="PUT">PUT</option>
                    <option value="CALL">CALL</option>
                  </select>
                </div>
                <Input
                  value={leg2Strike}
                  onChange={(e) => setLeg2Strike(e.target.value)}
                  placeholder="36.00"
                  className="text-xs font-mono"
                  disabled={isLongSingle}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-semibold">
                  {isShortSingle ? 'Prêmio Recebido (R$)' : 'Preço Recebido (R$)'}
                </label>
                <Input
                  value={leg2Price}
                  onChange={(e) => {
                    setLeg2Price(e.target.value);
                    if (isShortSingle) handleCostChange(e.target.value);
                    else autoSuggestSpreadAndName();
                  }}
                  placeholder="1.20"
                  className="text-xs font-mono font-bold text-blue-600"
                  disabled={isLongSingle}
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-semibold">Vencimento</label>
                <Input
                  type="date"
                  value={leg2Exp}
                  onChange={(e) => setLeg2Exp(e.target.value)}
                  className="text-xs"
                  disabled={isLongSingle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quantities & Financial Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Quantidade de Contratos
            </label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              {isShortSingle ? 'Prêmio Recebido Líquido (R$/un)' : 'Custo Base Líquido (R$/un)'}
            </label>
            <Input
              value={entryCostPerUnit}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder="ex: 1.20"
              className={`font-bold ${isShortSingle ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Data de Montagem
            </label>
            <Input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>

        {/* Exit Targets & Stop Loss */}
        <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
              <Icon name="flag" size="sm" /> 
              {isShortSingle ? 'Alvos de Recompra & Lucro Máximo (100% Prêmio)' : 'Alvos Automáticos de Saída & Stop Loss'}
            </span>
            <div className="text-[11px] font-semibold">
              {isShortSingle ? (
                <span className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                  Lucro Máximo (Virar Pó): R$ {((parseFloat(entryCostPerUnit.replace(',', '.')) || 0) * (parseInt(quantity, 10) || 100)).toFixed(2)} (100%)
                </span>
              ) : (
                <span className="text-purple-600 dark:text-purple-400">
                  Total Investido: R$ {((parseFloat(entryCostPerUnit.replace(',', '.')) || 0) * (parseInt(quantity, 10) || 100)).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                🎯 {isShortSingle ? 'Alvo 1: Recompra 50% (R$)' : 'Alvo 1 (+50% ganho)'}
              </label>
              <Input
                value={target50}
                onChange={(e) => setTarget50(e.target.value)}
                placeholder="0.60"
                className="text-xs font-mono font-bold text-emerald-600"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                {isShortSingle ? 'Recompra com 50% do prêmio embolsado' : 'Spread atingindo +50%'}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                🚀 {isShortSingle ? 'Alvo 2: Recompra 20% (R$)' : 'Alvo 2 (+80% ganho)'}
              </label>
              <Input
                value={target80}
                onChange={(e) => setTarget80(e.target.value)}
                placeholder="0.24"
                className="text-xs font-mono font-bold text-emerald-600"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                {isShortSingle ? 'Recompra com 80% do prêmio embolsado' : 'Spread atingindo +80%'}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                🛑 {isShortSingle ? 'Stop Loss: Recompra (R$)' : 'Stop Loss (-50% perda)'}
              </label>
              <Input
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="1.80"
                className="text-xs font-mono font-bold text-red-500"
              />
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                {isShortSingle ? 'Preço máximo aceito para zerar risco' : 'Spread caindo pela metade'}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
            Anotações / Tese da Operação
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              strategyCategory === 'venda_put'
                ? 'ex: Venda de Put remunerada. Aceito ser exercido no Strike ou embolsar 100% se virar pó.'
                : strategyCategory === 'venda_coberta'
                ? 'ex: Lançamento coberto de Call para gerar dividendo sintético sobre as ações em carteira.'
                : 'ex: Trava montada para aproveitar tendência direcional pós-resultados.'
            }
          />
        </div>

        {/* Modal Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
            <Icon name="check" size="sm" /> 
            {isShortSingle ? 'Cadastrar Operação Vendida' : isLongSingle ? 'Cadastrar Compra a Seco' : 'Cadastrar Trava'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
