'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { 
  OptionStrategy, 
  analyzeStrategy 
} from '@/lib/options/optionsEngine';
import { formatCurrency } from '@/lib/formatters';

interface OptionsStrategyDashboardProps {
  strategies: OptionStrategy[];
  investments?: any[];
  totalPortfolioValue: number;
  isSyncing: boolean;
  autoRefresh: boolean;
  lastSyncTime: Date | null;
  onToggleAutoRefresh: () => void;
  onSyncQuotes: () => void;
  onOpenNewStrategyModal: () => void;
  onUpdateStrategy: (id: string, updates: Partial<OptionStrategy>) => void;
  onDeleteStrategy: (id: string) => void;
  onCloseStrategy: (id: string) => void;
  onUpdateLegPrice: (stratId: string, ticker: string, price: number) => void;
  onResetLegOverride?: (stratId: string, ticker: string) => void;
  notificationPermission: NotificationPermission;
  onRequestNotifications: () => void;
}

export function OptionsStrategyDashboard({
  strategies,
  investments = [],
  totalPortfolioValue,
  isSyncing,
  autoRefresh,
  lastSyncTime,
  onToggleAutoRefresh,
  onSyncQuotes,
  onOpenNewStrategyModal,
  onUpdateStrategy,
  onDeleteStrategy,
  onCloseStrategy,
  onUpdateLegPrice,
  onResetLegOverride,
  notificationPermission,
  onRequestNotifications
}: OptionsStrategyDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(strategies[0]?.id || null);
  const [editingLegPrice, setEditingLegPrice] = useState<{ stratId: string; ticker: string; price: string } | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [strategyToEdit, setStrategyToEdit] = useState<OptionStrategy | null>(null);

  // Active strategies only for KPI calculations
  const activeStrategies = strategies.filter(s => s.status !== 'closed');

  const handleSaveInlineName = (stratId: string) => {
    if (editingNameValue.trim()) {
      onUpdateStrategy(stratId, { name: editingNameValue.trim() });
    }
    setEditingNameId(null);
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategyToEdit) return;

    onUpdateStrategy(strategyToEdit.id, {
      name: strategyToEdit.name.trim(),
      notes: strategyToEdit.notes,
      entryCostPerUnit: Number(strategyToEdit.entryCostPerUnit) || 0,
      totalEntryCost: (Number(strategyToEdit.entryCostPerUnit) || 0) * (strategyToEdit.quantity || 100),
      targetProfit50: Number(strategyToEdit.targetProfit50) || 0,
      targetProfit80: Number(strategyToEdit.targetProfit80) || 0,
      stopLossPrice: Number(strategyToEdit.stopLossPrice) || 0
    });
    setStrategyToEdit(null);
  };

  // KPI 1: Capital Alocado & Garantia Total Exigida
  const totalAllocated = activeStrategies.reduce((sum, s) => {
    const analysis = analyzeStrategy(s);
    return sum + analysis.totalEntryCost;
  }, 0);
  const totalCollateral = activeStrategies.reduce((sum, s) => {
    const analysis = analyzeStrategy(s);
    return sum + analysis.collateralTotal;
  }, 0);
  const totalCollateralNet = activeStrategies.reduce((sum, s) => {
    const analysis = analyzeStrategy(s);
    return sum + analysis.collateralNet;
  }, 0);
  const riskAllocationPercent = totalPortfolioValue > 0 ? (totalAllocated / totalPortfolioValue) * 100 : 0;
  const collateralAllocationPercent = totalPortfolioValue > 0 ? (totalCollateral / totalPortfolioValue) * 100 : 0;

  // KPI 2: Total Open P&L
  const totalOpenPnL = activeStrategies.reduce((sum, s) => {
    const analysis = analyzeStrategy(s);
    return sum + analysis.pnlTotal;
  }, 0);
  const totalPnlPercent = totalAllocated > 0 ? (totalOpenPnL / totalAllocated) * 100 : 0;

  // KPI 3: Nearest Profit Target
  const nearestTargetValue = activeStrategies.length > 0
    ? (() => {
        const a = analyzeStrategy(activeStrategies[0]);
        return a.target50 * activeStrategies[0].quantity;
      })()
    : 0;

  // KPI 4: Nearest Expiration / DTE
  const nearestDte = activeStrategies.reduce((min, s) => {
    const analysis = analyzeStrategy(s);
    return min === null || analysis.dte.calendarDays < min ? analysis.dte.calendarDays : min;
  }, null as number | null);

  const nearestExpDate = activeStrategies.length > 0
    ? activeStrategies[0].legs[0]?.expirationDate || '19/11/2026'
    : 'Sem vencimentos';

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleSaveLegPrice = (stratId: string, ticker: string) => {
    if (!editingLegPrice) return;
    const price = parseFloat(editingLegPrice.price.replace(',', '.')) || 0;
    if (price >= 0) {
      onUpdateLegPrice(stratId, ticker, price);
    }
    setEditingLegPrice(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar with Realtime Feed Status & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Icon name="candlestick_chart" size="sm" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              Opções & Estratégias Táticas
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Feed B3 Conectado
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {lastSyncTime ? `Última cotação: ${lastSyncTime.toLocaleTimeString()}` : 'Cotação pronta para atualização'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Notification Permission Pill */}
          {notificationPermission !== 'granted' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRequestNotifications}
              className="text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50/50 hover:bg-purple-100"
              title="Ativar avisos de alvo de saída e stop no navegador"
            >
              <Icon name="notifications_active" size="sm" />
              <span>Ativar Alertas</span>
            </Button>
          )}

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              autoRefresh 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
            }`}
            title="Atualização automática contínua a cada 30 segundos"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`}></span>
            <span>Auto-Refresh (30s)</span>
          </button>

          {/* Manual Sync Quotes */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onSyncQuotes}
            disabled={isSyncing}
            className="text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/50 hover:bg-blue-100"
          >
            <Icon name="sync" size="sm" className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Atualizando...' : 'Recalcular Spreads'}</span>
          </Button>

          {/* New Strategy Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewStrategyModal}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Icon name="add" size="sm" />
            <span>+ Nova Trava / Opção</span>
          </Button>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Garantia Total & Capital Alocado */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Garantia Total da Operação</span>
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Icon name="shield" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatCurrency(totalCollateral)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Líq: {formatCurrency(totalCollateralNet)}
              </span>
              <span>•</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                Prêmios/Custo: {formatCurrency(totalAllocated)}
              </span>
            </p>
          </div>
        </GlassCard>

        {/* Card 2: Resultado Atual (P&L Aberto) */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resultado Atual (P&L Aberto)</span>
            <div className={`p-2 rounded-xl ${totalOpenPnL >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
              <Icon name={totalOpenPnL >= 0 ? 'trending_up' : 'trending_down'} className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className={`text-2xl font-extrabold ${totalOpenPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {totalOpenPnL >= 0 ? '+' : ''}{formatCurrency(totalOpenPnL)}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge color={totalOpenPnL >= 0 ? 'green' : 'red'}>
                {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}% retorno
              </Badge>
              <span className="text-[11px] text-gray-400">em {activeStrategies.length} operação(ões)</span>
            </div>
          </div>
        </GlassCard>

        {/* Card 3: Alvo de Saída Mais Próximo */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Alvo de Saída Mais Próximo</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Icon name="flag" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(nearestTargetValue)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <span>🎯 Faixa de Realização: +50% a +80%</span>
            </p>
          </div>
        </GlassCard>

        {/* Card 4: Próximo Vencimento */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Próximo Vencimento</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Icon name="schedule" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {nearestExpDate}
            </h2>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">
              {nearestDte !== null ? `${nearestDte} dias restantes (DTE)` : 'Sem vencimentos'}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 3. Barômetro de Risco & Alocação em Opções (1% a 3%) */}
      <GlassCard className="p-4 bg-linear-to-r from-purple-500/5 to-indigo-500/5 border border-purple-200/50 dark:border-purple-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="shield" size="sm" className="text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Gestão de Risco & Limite de Exposição
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Limite seguro recomendado para opções: <strong>1% a 3%</strong> do patrimônio total de {formatCurrency(totalPortfolioValue)}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="text-right">
              <span className="text-xs text-gray-500">Garantia Exigida:</span>
              <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalCollateral)}{' '}
                <span className="text-xs font-medium text-gray-400">
                  ({collateralAllocationPercent.toFixed(1)}%)
                </span>
              </p>
            </div>

            <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-700/70" />

            <div className="text-right">
              <span className="text-xs text-gray-500">Prêmios / Custo Base:</span>
              <p className={`text-sm font-extrabold ${riskAllocationPercent <= 3 ? 'text-emerald-600' : 'text-red-500'}`}>
                {riskAllocationPercent.toFixed(2)}% ({formatCurrency(totalAllocated)})
              </p>
            </div>
            <div className="w-28 sm:w-36 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  riskAllocationPercent <= 3 ? 'bg-emerald-500' : riskAllocationPercent <= 5 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (riskAllocationPercent / 3) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Visão Agrupada por Estratégia (Accordions / Sanfona) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="layers" size="sm" className="text-purple-600" />
            Minhas Travas & Estratégias ({strategies.length})
          </h3>
          <span className="text-xs text-gray-400">Clique no card para expandir e ver as pernas</span>
        </div>

        {strategies.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            <Icon name="candlestick_chart" className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhuma trava de opções cadastrada</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Cadastre sua primeira operação para acompanhar o spread e receber alertas em tempo real.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewStrategyModal}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
            >
              + Nova Trava / Opção
            </Button>
          </div>
        ) : (
          strategies.map((strat) => {
            const analysis = analyzeStrategy(strat);
            const isExpanded = expandedId === strat.id;
            const buyLeg = strat.legs.find(l => l.side === 'buy');
            const sellLeg = strat.legs.find(l => l.side === 'sell');

            return (
              <GlassCard 
                key={strat.id} 
                className="overflow-hidden border border-gray-200/80 dark:border-gray-700/80 transition-all hover:shadow-md"
              >
                {/* Accordion Header */}
                <div 
                  onClick={() => toggleExpand(strat.id)}
                  className="p-5 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold shrink-0">
                      <Icon name="alt_route" size="sm" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {editingNameId === strat.id ? (
                          <div 
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlineName(strat.id);
                                if (e.key === 'Escape') setEditingNameId(null);
                              }}
                              className="px-2.5 py-1 text-sm font-extrabold bg-white dark:bg-gray-800 border-2 border-purple-500 rounded-lg text-gray-900 dark:text-white focus:outline-hidden shadow-xs"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineName(strat.id)}
                              className="p-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-xs"
                              title="Salvar novo nome"
                            >
                              <Icon name="check" size="sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNameId(null)}
                              className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 transition-colors"
                              title="Cancelar"
                            >
                              <Icon name="close" size="sm" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <h4 
                              className="text-base font-extrabold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                              title="Clique no lápis para renomear"
                            >
                              {strat.name}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNameId(strat.id);
                                setEditingNameValue(strat.name);
                              }}
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                              title="Editar nome da operação"
                            >
                              <Icon name="edit" size="sm" />
                            </button>
                          </div>
                        )}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {strat.quantity} opções
                        </span>
                        <Badge 
                          color={
                            analysis.statusBadge.color === 'emerald' ? 'green' : 
                            analysis.statusBadge.color === 'red' ? 'red' : 
                            analysis.statusBadge.color === 'amber' ? 'yellow' : 'gray'
                          }
                        >
                          {analysis.statusBadge.label}
                        </Badge>
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>Ativo: <strong>{strat.underlyingTicker}</strong> (R$ {strat.underlyingPrice.toFixed(2)})</span>
                        <span>•</span>
                        {strat.strategyCategory === 'venda_put' || strat.strategyCategory === 'venda_coberta' || (!buyLeg && !!sellLeg) ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            Ponta Vendida: <strong>{sellLeg?.ticker || '---'}</strong> ({sellLeg?.type || 'PUT'} K R$ {sellLeg?.strike.toFixed(2) || '---'})
                          </span>
                        ) : strat.strategyCategory === 'compra_seco' || (!!buyLeg && !sellLeg) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Ponta Comprada: <strong>{buyLeg?.ticker || '---'}</strong> ({buyLeg?.type || 'CALL'} K R$ {buyLeg?.strike.toFixed(2) || '---'})
                          </span>
                        ) : (
                          <>
                            <span>Compra: <strong>{buyLeg?.ticker || '---'}</strong> (K {buyLeg?.strike?.toFixed(2) || '---'})</span>
                            <span>+</span>
                            <span>Venda: <strong>{sellLeg?.ticker || '---'}</strong> (K {sellLeg?.strike?.toFixed(2) || '---'})</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Financial Results in Header */}
                  {(() => {
                    const isShort = strat.strategyCategory === 'venda_put' || strat.strategyCategory === 'venda_coberta' || (!buyLeg && !!sellLeg);
                    const isLong = strat.strategyCategory === 'compra_seco' || (!!buyLeg && !sellLeg);

                    return (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 xl:gap-6 justify-between lg:justify-end shrink-0">
                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-gray-400 font-semibold block">
                            {isShort ? 'Garantia (Strike)' : 'Garantia / Risco'}
                          </span>
                          <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 block">
                            {formatCurrency(analysis.collateralTotal)}
                          </span>
                          {isShort && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                              Líq: {formatCurrency(analysis.collateralNet)} • PM R$ {analysis.breakevenPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-700/70" />

                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-gray-400 font-semibold block">
                            {isShort ? 'Prêmio Recebido' : 'Custo Base'}
                          </span>
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 block">
                            {formatCurrency(analysis.totalEntryCost)}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                            R$ {analysis.entryCost.toFixed(2)}/un
                          </span>
                        </div>

                        <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-700/70" />

                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-gray-400 font-semibold block">
                            {isShort ? 'Cotação Recompra' : isLong ? 'Cotação Atual' : 'Spread Atual'}
                          </span>
                          <span className="text-sm font-extrabold text-purple-600 dark:text-purple-400 block">
                            R$ {analysis.currentSpread.toFixed(2)}
                          </span>
                          {analysis.distanceToShortStrikePercent !== undefined && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                              Dist. Strike: {analysis.distanceToShortStrikePercent > 0 ? '+' : ''}{analysis.distanceToShortStrikePercent.toFixed(1)}%
                            </span>
                          )}
                        </div>

                        <div className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-gray-700/70" />

                        <div className="text-left lg:text-right">
                          <span className="text-[11px] text-gray-400 font-semibold block">P&L Aberto</span>
                          <span className={`text-sm font-extrabold block ${analysis.pnlTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {analysis.pnlTotal >= 0 ? '+' : ''}{formatCurrency(analysis.pnlTotal)}
                          </span>
                          <span className={`text-[10px] font-bold block ${analysis.pnlPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {analysis.pnlPercent >= 0 ? '+' : ''}{analysis.pnlPercent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="w-6 h-6 flex items-center justify-center text-gray-400 ml-1">
                          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size="sm" />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Termômetro Visual de Saída (Spread / Prêmio Progress Bar) */}
                <div className="px-5 pb-4">
                  {(() => {
                    const isShort = strat.strategyCategory === 'venda_put' || strat.strategyCategory === 'venda_coberta' || (!buyLeg && !!sellLeg);
                    const { target50, target80, stopLoss } = analysis;
                    const cost = analysis.entryCost;

                    // Escala dinâmica min/max para mapeamento proporcional
                    const minVal = isShort 
                      ? 0 
                      : Math.max(0, Math.min(stopLoss * 0.7, cost * 0.3));
                    const maxVal = isShort 
                      ? Math.max(stopLoss * 1.25, cost * 1.5, 0.1) 
                      : Math.max(target80 * 1.25, cost * 2.2, 0.1);
                    const range = Math.max(0.01, maxVal - minVal);

                    // Posição do cursor / marcador do Spread Atual em % (3% a 97%)
                    const pinPos = Math.max(3, Math.min(97, ((analysis.currentSpread - minVal) / range) * 100));

                    // Posições relativas das faixas no termômetro
                    const stopPos = Math.max(4, Math.min(96, ((stopLoss - minVal) / range) * 100));
                    const costPos = Math.max(4, Math.min(96, ((cost - minVal) / range) * 100));
                    const t50Pos = Math.max(4, Math.min(96, ((target50 - minVal) / range) * 100));
                    const t80Pos = Math.max(4, Math.min(96, ((target80 - minVal) / range) * 100));

                    return (
                      <div className="p-3 bg-gray-50/70 dark:bg-gray-800/30 rounded-xl border border-gray-200/50 dark:border-gray-700/40 space-y-2">
                        <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                          <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Icon name="speed" size="sm" className="text-purple-500" /> 
                            <span>{isShort ? 'Termômetro da Venda:' : 'Termômetro da Trava:'}</span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-extrabold font-mono text-xs">
                              {isShort ? `Cotação R$ ${analysis.currentSpread.toFixed(2)}` : `Spread Atual R$ ${analysis.currentSpread.toFixed(2)}`}
                            </span>
                          </span>

                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Icon name="info" size="xs" className="text-gray-400" />
                            <span>{analysis.statusBadge.actionRecommendation || 'Aguardando faixa de saída'}</span>
                          </span>
                        </div>

                        {/* Barra do Termômetro com Indicador Dinâmico */}
                        <div className="relative pt-6 pb-1">
                          {/* Pin / Cursor indicador da cotação/spread atual */}
                          <div
                            className="absolute top-0 flex flex-col items-center pointer-events-none transition-all duration-500 ease-out z-20"
                            style={{ left: `${pinPos}%`, transform: 'translateX(-50%)' }}
                          >
                            <div className={`px-2 py-0.5 rounded text-[10px] font-extrabold shadow-md whitespace-nowrap border flex items-center gap-1 ${
                              analysis.statusBadge.color === 'emerald'
                                ? 'bg-emerald-600 text-white border-emerald-400 animate-pulse'
                                : analysis.statusBadge.color === 'red'
                                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                                : 'bg-purple-700 text-white border-purple-400'
                            }`}>
                              <span>{isShort ? 'Atual' : 'Spread'}: R$ {analysis.currentSpread.toFixed(2)}</span>
                            </div>
                            <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] ${
                              analysis.statusBadge.color === 'emerald'
                                ? 'border-t-emerald-600'
                                : analysis.statusBadge.color === 'red'
                                ? 'border-t-red-600'
                                : 'border-t-purple-700'
                            }`}></div>
                          </div>

                          {/* Trilho multi-segmento do Termômetro */}
                          <div className="relative w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex shadow-inner">
                            {isShort ? (
                              <>
                                <div className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${t80Pos}%` }} title="Lucro Máximo (Virando Pó)"></div>
                                <div className="h-full bg-emerald-400 dark:bg-emerald-600" style={{ width: `${Math.max(0, t50Pos - t80Pos)}%` }} title="Alvo de Realização (+50% a +80%)"></div>
                                <div className="h-full bg-amber-400/90 dark:bg-amber-500/90" style={{ width: `${Math.max(0, costPos - t50Pos)}%` }} title="Zona de Entrada / Neutra"></div>
                                <div className="h-full bg-red-500 dark:bg-red-600 flex-1" title="Zona de Stop Loss"></div>
                              </>
                            ) : (
                              <>
                                <div className="h-full bg-red-500/90 dark:bg-red-600/90" style={{ width: `${stopPos}%` }} title="Zona de Stop Loss (-50%)"></div>
                                <div className="h-full bg-amber-400/90 dark:bg-amber-500/90" style={{ width: `${Math.max(0, t50Pos - stopPos)}%` }} title="Zona de Entrada / Neutra"></div>
                                <div className="h-full bg-emerald-400/90 dark:bg-emerald-500/90" style={{ width: `${Math.max(0, t80Pos - t50Pos)}%` }} title="Faixa de Alvo (+50% a +80%)"></div>
                                <div className="h-full bg-emerald-600 dark:bg-emerald-400 flex-1" title="Super Meta (+80% ou Mais)"></div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Scale Labels */}
                        <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-mono pt-0.5">
                          {isShort ? (
                            <>
                              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">Pó: R$ 0,00</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Alvo 2: R$ {target80.toFixed(2)} (+80%)</span>
                              <span className="text-emerald-600 dark:text-emerald-500 font-semibold">Alvo 1: R$ {target50.toFixed(2)} (+50%)</span>
                              <span className="text-gray-600 dark:text-gray-300 font-medium">Entrada: R$ {cost.toFixed(2)}</span>
                              <span className="text-red-500 font-bold">Stop: R$ {stopLoss.toFixed(2)} (-50%)</span>
                            </>
                          ) : (
                            <>
                              <span className="text-red-500 font-bold">Stop: R$ {stopLoss.toFixed(2)} (-50%)</span>
                              <span className="text-gray-600 dark:text-gray-300 font-medium">Entrada: R$ {cost.toFixed(2)}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Alvo 1: R$ {target50.toFixed(2)} (+50%)</span>
                              <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">Alvo 2: R$ {target80.toFixed(2)} (+80%)</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Expanded Section with Leg Details & Actions */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-gray-200/80 dark:border-gray-700/80 space-y-3 bg-white/40 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <Icon name="view_list" size="sm" className="text-gray-400" />
                        <span>Pernas Detalhadas da Operação</span>
                      </h5>
                      <span className="text-[11px] text-gray-400">
                        Cotação sincronizada em tempo real (2 cliques para override manual)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold uppercase">
                          <tr>
                            <th className="p-2.5 rounded-l-lg">Ponta</th>
                            <th className="p-2.5">Ticker Opção</th>
                            <th className="p-2.5">Tipo</th>
                            <th className="p-2.5">Strike</th>
                            <th className="p-2.5">Preço Entrada</th>
                            <th className="p-2.5">Cotação Atual (Pedra)</th>
                            <th className="p-2.5">Bid / Ask</th>
                            <th className="p-2.5 rounded-r-lg">Vencimento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
                          {strat.legs.map((leg) => {
                            const isBuy = leg.side === 'buy';
                            const isEditing = editingLegPrice?.stratId === strat.id && editingLegPrice?.ticker === leg.ticker;
                            const cleanLegTicker = leg.ticker.trim().toUpperCase().replace('.SA', '');
                            const assetMatch = investments?.find(inv => {
                              const t = (inv.ticker || '').trim().toUpperCase().replace('.SA', '');
                              const n = (inv.name || '').trim().toUpperCase().replace('.SA', '');
                              return t === cleanLegTicker || n === cleanLegTicker;
                            });
                            const isSyncedWithAssets = !!assetMatch && typeof assetMatch.current_price === 'number' && assetMatch.current_price > 0;

                            return (
                              <tr key={leg.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="p-2.5 font-bold">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isBuy 
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' 
                                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  }`}>
                                    {isBuy ? 'COMPRADA (+)' : 'VENDIDA (-)'}
                                  </span>
                                </td>
                                <td className="p-2.5 font-mono font-bold text-gray-900 dark:text-white">
                                  {leg.ticker}
                                </td>
                                <td className="p-2.5 font-semibold text-gray-600 dark:text-gray-400">
                                  {leg.type}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-gray-900 dark:text-white">
                                  R$ {leg.strike.toFixed(2)}
                                </td>
                                <td className="p-2.5 font-mono text-gray-600 dark:text-gray-300">
                                  R$ {leg.entryPrice.toFixed(2)}
                                </td>
                                <td className="p-2.5 font-mono font-bold">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={editingLegPrice.price}
                                        onChange={(e) => setEditingLegPrice({ ...editingLegPrice, price: e.target.value })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveLegPrice(strat.id, leg.ticker);
                                          if (e.key === 'Escape') setEditingLegPrice(null);
                                        }}
                                        className="w-16 px-1.5 py-0.5 text-xs border rounded bg-white dark:bg-gray-800 font-mono font-bold"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveLegPrice(strat.id, leg.ticker)}
                                        className="p-1 text-emerald-600 hover:text-emerald-700"
                                        title="Salvar override"
                                      >
                                        <Icon name="check" size="sm" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingLegPrice(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                        title="Cancelar"
                                      >
                                        <Icon name="close" size="sm" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        onDoubleClick={() => setEditingLegPrice({ stratId: strat.id, ticker: leg.ticker, price: String(leg.currentPrice) })}
                                        className="cursor-pointer hover:underline text-purple-600 dark:text-purple-400 font-extrabold"
                                        title="Dois cliques para editar cotação manualmente (override)"
                                      >
                                        R$ {leg.currentPrice.toFixed(2)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingLegPrice({ stratId: strat.id, ticker: leg.ticker, price: String(leg.currentPrice) })}
                                        className="text-gray-400 hover:text-purple-600 transition-colors p-0.5"
                                        title="Editar cotação manualmente (override)"
                                      >
                                        <Icon name="edit" size="sm" />
                                      </button>

                                      {leg.manualOverride ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold" title="Valor fixado manualmente pelo usuário">
                                          Manual
                                          {onResetLegOverride && (
                                            <button
                                              type="button"
                                              onClick={() => onResetLegOverride(strat.id, leg.ticker)}
                                              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 font-bold ml-0.5 hover:underline"
                                              title="Voltar para sincronização automática da Lista de Ativos"
                                            >
                                              ↺ Auto
                                            </button>
                                          )}
                                        </span>
                                      ) : isSyncedWithAssets ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold" title="Sincronizado automaticamente com a Lista de Ativos">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                          Lista de Ativos
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 font-semibold" title="Cotação em tempo real B3">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                          B3 Ao Vivo
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono text-[11px] text-gray-400">
                                  {leg.bidPrice ? `R$ ${leg.bidPrice.toFixed(2)}` : '---'} / {leg.askPrice ? `R$ ${leg.askPrice.toFixed(2)}` : '---'}
                                </td>
                                <td className="p-2.5 text-gray-600 dark:text-gray-300">
                                  {leg.expirationDate}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Strategy Actions Bottom Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <div className="text-xs text-gray-500">
                        {strat.notes && (
                          <span className="italic">💡 {strat.notes}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStrategyToEdit({ ...strat })}
                          className="text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          title="Editar nome, alvos e anotações da trava"
                        >
                          <Icon name="edit" size="sm" />
                          <span>Editar Detalhes</span>
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onCloseStrategy(strat.id)}
                          className="text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50"
                        >
                          <Icon name="check_circle" size="sm" />
                          <span>Desmontar / Encerrar</span>
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onDeleteStrategy(strat.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50"
                        >
                          <Icon name="delete" size="sm" />
                          <span>Excluir</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Modal para Editar Detalhes da Estratégia */}
      {strategyToEdit && (
        <Modal 
          isOpen={true} 
          onClose={() => setStrategyToEdit(null)} 
          title="Editar Estratégia de Opções"
        >
          <form onSubmit={handleSaveEditModal} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Nome da Operação
              </label>
              <Input
                value={strategyToEdit.name}
                onChange={(e) => setStrategyToEdit({ ...strategyToEdit, name: e.target.value })}
                placeholder="Ex: Trava de Baixa - BOVA11 (205 x 199)"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Custo Base por Opção (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={strategyToEdit.entryCostPerUnit}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    setStrategyToEdit({
                      ...strategyToEdit,
                      entryCostPerUnit: cost,
                      targetProfit50: Number((cost * 1.5).toFixed(2)),
                      targetProfit80: Number((cost * 1.8).toFixed(2)),
                      stopLossPrice: Number((cost * 0.5).toFixed(2))
                    });
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Quantidade (Opções)
                </label>
                <Input
                  type="number"
                  value={strategyToEdit.quantity}
                  onChange={(e) => setStrategyToEdit({ ...strategyToEdit, quantity: parseInt(e.target.value, 10) || 100 })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/40">
              <div>
                <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {strategyToEdit.strategyCategory === 'venda_put' || strategyToEdit.strategyCategory === 'venda_coberta' 
                    ? 'Alvo 1 (Recompra a 50%)' 
                    : 'Alvo 1 (+50%)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={strategyToEdit.targetProfit50}
                  onChange={(e) => setStrategyToEdit({ ...strategyToEdit, targetProfit50: parseFloat(e.target.value) || 0 })}
                  className="text-xs font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {strategyToEdit.strategyCategory === 'venda_put' || strategyToEdit.strategyCategory === 'venda_coberta' 
                    ? 'Alvo 2 (Recompra a 20%)' 
                    : 'Alvo 2 (+80%)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={strategyToEdit.targetProfit80}
                  onChange={(e) => setStrategyToEdit({ ...strategyToEdit, targetProfit80: parseFloat(e.target.value) || 0 })}
                  className="text-xs font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-red-600 dark:text-red-400">
                  {strategyToEdit.strategyCategory === 'venda_put' || strategyToEdit.strategyCategory === 'venda_coberta' 
                    ? 'Stop Loss (Recompra -50%)' 
                    : 'Stop Loss (-50%)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={strategyToEdit.stopLossPrice}
                  onChange={(e) => setStrategyToEdit({ ...strategyToEdit, stopLossPrice: parseFloat(e.target.value) || 0 })}
                  className="text-xs font-bold text-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Anotações / Tese
              </label>
              <Input
                value={strategyToEdit.notes || ''}
                onChange={(e) => setStrategyToEdit({ ...strategyToEdit, notes: e.target.value })}
                placeholder="Observações da operação..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button variant="secondary" type="button" onClick={() => setStrategyToEdit(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
