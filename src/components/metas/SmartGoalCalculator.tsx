'use client';

import React, { useState, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  calculateMonthsRemaining,
  calculateMonthlyDepositNeeded,
  calculateRequiredAnnualRate,
  getInvestmentRecommendation
} from '@/lib/goalCalculators';
import { FamilyInvestment } from '@/hooks/useGoals';

interface SmartGoalCalculatorProps {
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  initialRate?: number;
  initialMonthlyDeposit?: number | null;
  selectedInvestmentId?: string | null;
  investments: FamilyInvestment[];
  onApplyPlan?: (plan: {
    monthlyDeposit: number;
    annualRate: number;
    investmentId?: string | null;
  }) => void;
  onSelectInvestment?: (id: string | null) => void;
  onRateChange?: (rate: number) => void;
  onMonthlyDepositChange?: (deposit: number | null) => void;
}

export function SmartGoalCalculator({
  targetAmount,
  currentAmount = 0,
  deadline,
  initialRate = 10.5,
  initialMonthlyDeposit = null,
  selectedInvestmentId = null,
  investments,
  onApplyPlan,
  onSelectInvestment,
  onRateChange,
  onMonthlyDepositChange
}: SmartGoalCalculatorProps) {
  const [calcMode, setCalcMode] = useState<'findDeposit' | 'findRate'>('findDeposit');
  const [annualRate, setAnnualRate] = useState<number>(initialRate || 10.5);
  const [userMonthlyDeposit, setUserMonthlyDeposit] = useState<string>(
    initialMonthlyDeposit ? initialMonthlyDeposit.toString() : ''
  );
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Calcula meses restantes
  const months = useMemo(() => calculateMonthsRemaining(deadline), [deadline]);

  // Modo 1: Aporte mensal necessário dado taxa
  const depositPlan = useMemo(() => {
    return calculateMonthlyDepositNeeded({
      targetAmount,
      currentAmount,
      months,
      annualRate
    });
  }, [targetAmount, currentAmount, months, annualRate]);

  // Modo 2: Taxa anual necessária dado aporte informado
  const parsedDeposit = parseFloat(userMonthlyDeposit.replace(',', '.')) || 0;
  const ratePlan = useMemo(() => {
    return calculateRequiredAnnualRate({
      targetAmount,
      currentAmount,
      months,
      monthlyDeposit: parsedDeposit
    });
  }, [targetAmount, currentAmount, months, parsedDeposit]);

  // Recomendações de ativos com base no prazo
  const recommendation = useMemo(() => getInvestmentRecommendation(months), [months]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleRateQuickSelect = (rate: number) => {
    setAnnualRate(rate);
    if (onRateChange) onRateChange(rate);
  };

  const handleDepositChange = (val: string) => {
    setUserMonthlyDeposit(val);
    const num = parseFloat(val.replace(',', '.'));
    if (onMonthlyDepositChange) {
      onMonthlyDepositChange(isNaN(num) ? null : num);
    }
  };

  const selectedInvestment = useMemo(() => {
    return investments.find(i => i.id === selectedInvestmentId);
  }, [investments, selectedInvestmentId]);

  return (
    <div className="rounded-2xl border border-primary/20 dark:border-primary/20 bg-gradient-to-br from-primary/5 via-blue-500/5 to-transparent p-4.5 space-y-4">
      {/* Header com badge de IA / Inteligência */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
            <Icon name="auto_awesome" size="sm" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              Simulador Inteligente da Meta
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {months > 0
                ? `Prazo previsto: ${months} ${months === 1 ? 'mês' : 'meses'}`
                : 'Defina uma data limite acima para projeções precisas'}
            </p>
          </div>
        </div>

        {/* Alternador de Modo */}
        <div className="flex items-center bg-gray-200/70 dark:bg-gray-800/80 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setCalcMode('findDeposit')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              calcMode === 'findDeposit'
                ? 'bg-white dark:bg-gray-700 text-primary dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Calcular Aporte
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('findRate')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              calcMode === 'findRate'
                ? 'bg-white dark:bg-gray-700 text-primary dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Calcular Taxa
          </button>
        </div>
      </div>

      {/* MODO 1: CALCULAR APORTE MENSAL NECESSÁRIO */}
      {calcMode === 'findDeposit' && (
        <div className="space-y-3.5">
          {/* Seletor de Taxa de Rendimento */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label className="font-semibold text-gray-700 dark:text-gray-300">
                Taxa de Rentabilidade Anual Estimada:
              </label>
              <span className="font-bold text-primary dark:text-blue-400 text-sm">
                {annualRate}% a.a.
              </span>
            </div>

            {/* Quick buttons de taxas */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '0% (Sem Juros)', rate: 0 },
                { label: '10.5% (CDI)', rate: 10.5 },
                { label: '12% (Moderado)', rate: 12 },
                { label: '14% (Arrojado)', rate: 14 }
              ].map(opt => (
                <button
                  key={opt.rate}
                  type="button"
                  onClick={() => handleRateQuickSelect(opt.rate)}
                  className={`py-1 px-1.5 rounded-lg text-[11px] font-medium border text-center transition-all ${
                    annualRate === opt.rate
                      ? 'border-primary bg-primary/10 text-primary dark:text-blue-400 font-bold'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards de Resultado do Aporte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 shadow-xs">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                Aporte Mensal Recomendado
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(depositPlan.monthlyDeposit)}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                por {depositPlan.months} {depositPlan.months === 1 ? 'mês' : 'meses'} a {annualRate}% a.a.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/70 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/60 shadow-xs">
              <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                Economia com Juros Compostos
              </span>
              <span className="text-lg font-black text-primary dark:text-blue-400">
                + {formatCurrency(depositPlan.totalInterestEarned)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                {depositPlan.interestSavings > 0
                  ? `Economiza ${formatCurrency(depositPlan.interestSavings)} do seu bolso`
                  : 'Rendimento estimado ao atingir a meta'}
              </span>
            </div>
          </div>

          {/* Comparativo de Esforço */}
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Total pago do seu bolso:</span>
              <strong className="text-gray-900 dark:text-white">
                {formatCurrency(depositPlan.totalOutOfPocket)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Sem investir (aporte puro):</span>
              <span className="text-gray-500">
                {formatCurrency(depositPlan.monthlyDepositNoInterest)}/mês
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: CALCULAR TAXA DADO APORTE DISPONÍVEL */}
      {calcMode === 'findRate' && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Quanto você consegue guardar por mês? (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 500,00"
                value={userMonthlyDeposit}
                onChange={e => handleDepositChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Resultado da Taxa Necessária */}
          {parsedDeposit > 0 ? (
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                ratePlan.badgeColor === 'green'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                  : ratePlan.badgeColor === 'blue'
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60'
                  : ratePlan.badgeColor === 'yellow'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <span className="text-xs font-bold block text-gray-900 dark:text-white">
                    {ratePlan.title}
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-300">
                    {ratePlan.message}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">Taxa Exigida</span>
                  <span className="text-base font-black text-gray-900 dark:text-white">
                    {ratePlan.requiredAnnualRate}% a.a.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
              Digite um valor de aporte acima para calcular a taxa de rentabilidade necessária.
            </div>
          )}
        </div>
      )}

      {/* INTEGRAÇÃO: ONDE ESTOU INVESTINDO PARA ESSA META */}
      <div className="pt-3 border-t border-gray-200/80 dark:border-gray-800 space-y-2">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Onde estou investindo para esta meta? (Vincular Ativo da Carteira)
        </label>
        <div className="grid grid-cols-1 gap-2">
          <select
            value={selectedInvestmentId || ''}
            onChange={e => {
              const val = e.target.value || null;
              if (onSelectInvestment) onSelectInvestment(val);
            }}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Nenhum ativo vinculado (Caixa / Meta Geral)</option>
            {investments.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.ticker ? `[${inv.ticker}] ` : ''}{inv.name} • Saldo: {formatCurrency(inv.current_balance)} {inv.institution ? `(${inv.institution})` : ''}
              </option>
            ))}
          </select>

          {selectedInvestment && (
            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Icon name="account_balance_wallet" size="sm" className="text-primary dark:text-blue-400" />
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white block">
                    {selectedInvestment.ticker ? `${selectedInvestment.ticker} - ` : ''}{selectedInvestment.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Instituição: {selectedInvestment.institution || 'Geral'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">Saldo na Carteira</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(selectedInvestment.current_balance)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DROPDOWN EXPANSÍVEL: SUGESTÕES INTELIGENTES POR PRAZO */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowRecommendations(!showRecommendations)}
          className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-primary dark:text-blue-400 hover:bg-primary/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Icon name="lightbulb" size="sm" />
            Onde os especialistas recomendam investir para esse prazo?
          </span>
          <Icon name={showRecommendations ? 'expand_less' : 'expand_more'} size="sm" />
        </button>

        {showRecommendations && (
          <div className="mt-2 p-3 rounded-xl bg-white/80 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700/80 space-y-2 text-xs">
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">
                {recommendation.title}
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {recommendation.description}
              </p>
            </div>
            <div className="space-y-1 pt-1">
              {recommendation.suggestions.map((sug, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-gray-700 dark:text-gray-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{sug}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botão de Aplicar ao Formulário */}
      {onApplyPlan && (
        <button
          type="button"
          onClick={() => {
            const finalDeposit = calcMode === 'findDeposit' ? depositPlan.monthlyDeposit : (parsedDeposit || depositPlan.monthlyDeposit);
            const finalRate = calcMode === 'findDeposit' ? annualRate : (ratePlan.requiredAnnualRate || annualRate);
            onApplyPlan({
              monthlyDeposit: finalDeposit,
              annualRate: finalRate,
              investmentId: selectedInvestmentId
            });
          }}
          className="w-full py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Icon name="check" size="sm" />
          <span>Fixar Aporte de {formatCurrency(calcMode === 'findDeposit' ? depositPlan.monthlyDeposit : (parsedDeposit || depositPlan.monthlyDeposit))}/mês na Meta</span>
        </button>
      )}
    </div>
  );
}
