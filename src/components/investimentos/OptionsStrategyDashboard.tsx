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
import { SyntheticDividendCard } from './SyntheticDividendCard';

interface OptionsStrategyDashboardProps {
  strategies: OptionStrategy[];
  investments?: any[];
  totalPortfolioValue: number;
  isSyncing: boolean;
  isSupabaseTableMissing?: boolean;
  onImportStrategies?: (strats: OptionStrategy[]) => void;
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

const MIGRATION_SQL = `-- Migration 024: Estruturas para Estratégias de Opções B3 Sincronizadas
CREATE TABLE IF NOT EXISTS public.options_strategies (
    id TEXT PRIMARY KEY,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    underlying_ticker VARCHAR(20) NOT NULL,
    underlying_price NUMERIC(14, 4) NOT NULL DEFAULT 0,
    strategy_category VARCHAR(50) NOT NULL DEFAULT 'personalizada',
    legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 100,
    entry_cost_per_unit NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_entry_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_profit_50 NUMERIC(14, 4) NOT NULL DEFAULT 0,
    target_profit_80 NUMERIC(14, 4) NOT NULL DEFAULT 0,
    stop_loss_price NUMERIC(14, 4) NOT NULL DEFAULT 0,
    max_profit_per_unit NUMERIC(14, 4),
    underlying_dy_5y NUMERIC(10, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_strategies_family ON public.options_strategies(family_id);
CREATE INDEX IF NOT EXISTS idx_options_strategies_status ON public.options_strategies(status);

ALTER TABLE public.options_strategies ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família visualiza opções') THEN
        CREATE POLICY "Família visualiza opções"
            ON public.options_strategies FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família cria opções') THEN
        CREATE POLICY "Família cria opções"
            ON public.options_strategies FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família atualiza opções') THEN
        CREATE POLICY "Família atualiza opções"
            ON public.options_strategies FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família remove opções') THEN
        CREATE POLICY "Família remove opções"
            ON public.options_strategies FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

DROP TRIGGER IF EXISTS set_options_strategies_updated_at ON public.options_strategies;
CREATE TRIGGER set_options_strategies_updated_at
    BEFORE UPDATE ON public.options_strategies
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
`;

export function OptionsStrategyDashboard({
  strategies,
  investments = [],
  totalPortfolioValue,
  isSyncing,
  isSupabaseTableMissing = false,
  onImportStrategies,
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
  const [copiedSql, setCopiedSql] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState('');
  const [copiedBackup, setCopiedBackup] = useState(false);
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

  const handleCopyMigrationSql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(strategies, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 3000);
    }
  };

  const handleImportJson = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(backupJsonInput.trim());
      if (Array.isArray(parsed) && onImportStrategies) {
        onImportStrategies(parsed);
        setBackupModalOpen(false);
        setBackupJsonInput('');
      } else {
        alert('Formato inválido. Certifique-se de colar a lista de opções correta.');
      }
    } catch {
      alert('Erro ao processar JSON. Verifique o texto colado.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar with Realtime Feed Status & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-gray-700/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Opções & Estratégias
            </h3>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
              B3 ao vivo
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {lastSyncTime ? `Última atualização: ${lastSyncTime.toLocaleTimeString()}` : 'Aguardando atualização'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notificationPermission !== 'granted' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestNotifications}
              className="text-xs text-gray-600 dark:text-gray-300"
              title="Ativar avisos de alvo e stop"
            >
              <Icon name="notifications_active" size="sm" />
              <span>Alertas</span>
            </Button>
          )}

          {/* Sync / Transfer Helper Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBackupModalOpen(true)}
            className="text-xs text-gray-600 dark:text-gray-300"
            title="Transferir operações entre dispositivos ou fazer backup"
          >
            <Icon name="swap_horiz" size="sm" />
            <span>Transferir</span>
          </Button>

          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              autoRefresh 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                : 'bg-white/60 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
            title="Atualização automática a cada 30s"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`}></span>
            <span>Auto-Refresh</span>
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSyncQuotes}
            disabled={isSyncing}
            className="text-xs text-gray-600 dark:text-gray-300"
          >
            <Icon name="sync" size="sm" className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Atualizando...' : 'Recalcular'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewStrategyModal}
            className="text-xs font-medium"
          >
            <Icon name="add" size="sm" />
            <span>Nova Estratégia</span>
          </Button>
        </div>
      </div>

      {/* Cloud Sync Warning Banner (When Supabase table has not been created yet) */}
      {isSupabaseTableMissing && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Icon name="cloud_off" size="sm" className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-300">
                  Sincronização com o Celular Pendente
                </h4>
                <p className="mt-1 opacity-90 leading-relaxed text-slate-700 dark:text-slate-300">
                  Suas operações estão salvas neste computador. Para sincronizar e <strong>aparecer automaticamente no seu celular</strong>, execute o script SQL da migration 024 no SQL Editor do seu Supabase.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyMigrationSql}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <Icon name={copiedSql ? 'check' : 'content_copy'} size="xs" />
                <span>{copiedSql ? 'SQL Copiado!' : 'Copiar Script SQL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Garantia Total & Capital Alocado */}
        <GlassCard className="p-4 flex flex-col justify-between space-y-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Garantia Total</span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(totalCollateral)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Líquido: {formatCurrency(totalCollateralNet)} · Custo: {formatCurrency(totalAllocated)}
            </p>
          </div>
        </GlassCard>

        {/* Card 2: Resultado Atual (P&L Aberto) */}
        <GlassCard className="p-4 flex flex-col justify-between space-y-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">P&L Aberto</span>
          <div>
            <h2 className={`text-2xl font-bold tracking-tight ${totalOpenPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {totalOpenPnL >= 0 ? '+' : ''}{formatCurrency(totalOpenPnL)}
            </h2>
            <p className="text-xs mt-1">
              <span className={`font-medium ${totalOpenPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}% retorno
              </span>
              <span className="text-gray-400 ml-1">({activeStrategies.length} ativas)</span>
            </p>
          </div>
        </GlassCard>

        {/* Card 3: Alvo Mais Próximo */}
        <GlassCard className="p-4 flex flex-col justify-between space-y-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Alvo Mais Próximo</span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(nearestTargetValue)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Realização entre +50% e +80%
            </p>
          </div>
        </GlassCard>

        {/* Card 4: Próximo Vencimento */}
        <GlassCard className="p-4 flex flex-col justify-between space-y-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Próximo Vencimento</span>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {nearestExpDate}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {nearestDte !== null ? `${nearestDte} dias restantes (DTE)` : 'Sem vencimentos'}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 3. Gestão de Risco e Exposição */}
      <GlassCard className="p-4 bg-white/40 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-gray-900 dark:text-white">Exposição da Carteira</span>
            <p className="text-gray-400">
              Recomendado manter entre 1% e 3% do patrimônio ({formatCurrency(totalPortfolioValue)}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-gray-400">Garantia: </span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(totalCollateral)} ({collateralAllocationPercent.toFixed(1)}%)</span>
            </div>
            <div>
              <span className="text-gray-400">Prêmios/Custo: </span>
              <span className={`font-mono font-medium ${riskAllocationPercent <= 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {riskAllocationPercent.toFixed(2)}% ({formatCurrency(totalAllocated)})
              </span>
            </div>
            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  riskAllocationPercent <= 3 ? 'bg-emerald-500' : riskAllocationPercent <= 5 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (riskAllocationPercent / 3) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Visão Agrupada por Estratégia */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Minhas Estratégias ({strategies.length})
          </h3>
          <span className="text-xs text-gray-400 font-normal">Clique no card para expandir detalhes</span>
        </div>

        {strategies.length === 0 ? (
          <div className="p-8 text-center bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nenhuma estratégia cadastrada</p>
            <p className="text-xs text-gray-400 mt-1">
              Cadastre sua operação para acompanhar spreads e alvos.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNewStrategyModal}
              className="mt-4 text-xs font-medium"
            >
              + Nova Estratégia
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
                className="overflow-hidden border border-gray-200/60 dark:border-gray-700/60 transition-all hover:border-gray-300 dark:hover:border-gray-600"
              >
                {/* Accordion Header */}
                <div 
                  onClick={() => toggleExpand(strat.id)}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-start gap-3">
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
                              className="px-2 py-0.5 text-sm font-semibold bg-white dark:bg-gray-800 border border-blue-500 rounded-lg text-gray-900 dark:text-white focus:outline-hidden"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineName(strat.id)}
                              className="p-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                              title="Salvar"
                            >
                              <Icon name="check" size="sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNameId(null)}
                              className="p-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                              title="Cancelar"
                            >
                              <Icon name="close" size="sm" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                              {strat.name}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNameId(strat.id);
                                setEditingNameValue(strat.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
                              title="Editar nome"
                            >
                              <Icon name="edit" size="xs" />
                            </button>
                          </div>
                        )}
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {strat.quantity} opções
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          analysis.statusBadge.color === 'emerald'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : analysis.statusBadge.color === 'red'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          {analysis.statusBadge.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-1.5">
                        <span>{strat.underlyingTicker} ({formatCurrency(strat.underlyingPrice)})</span>
                        <span>·</span>
                        {strat.strategyCategory === 'venda_put' || strat.strategyCategory === 'venda_coberta' || (!buyLeg && !!sellLeg) ? (
                          <span>
                            Vendida: <strong className="text-gray-700 dark:text-gray-300">{sellLeg?.ticker || '---'}</strong> (K {formatCurrency(sellLeg?.strike || 0)})
                          </span>
                        ) : strat.strategyCategory === 'compra_seco' || (!!buyLeg && !sellLeg) ? (
                          <span>
                            Comprada: <strong className="text-gray-700 dark:text-gray-300">{buyLeg?.ticker || '---'}</strong> (K {formatCurrency(buyLeg?.strike || 0)})
                          </span>
                        ) : (
                          <>
                            <span>Compra: {buyLeg?.ticker || '---'} (K {formatCurrency(buyLeg?.strike || 0)})</span>
                            <span>+</span>
                            <span>Venda: {sellLeg?.ticker || '---'} (K {formatCurrency(sellLeg?.strike || 0)})</span>
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
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 justify-between lg:justify-end shrink-0">
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">
                            {isShort ? 'Garantia' : 'Risco'}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold font-mono text-gray-900 dark:text-white block">
                            {formatCurrency(analysis.collateralTotal)}
                          </span>
                        </div>

                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">
                            {isShort ? 'Prêmio' : 'Custo'}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold font-mono text-gray-900 dark:text-white block">
                            {formatCurrency(analysis.totalEntryCost)}
                          </span>
                          <span className="text-[10px] text-gray-400 block font-mono">
                            {formatCurrency(analysis.entryCost)}/un
                          </span>
                        </div>

                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">
                            {isShort ? 'Recompra' : isLong ? 'Cotação' : 'Spread'}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold font-mono text-gray-900 dark:text-white block">
                            {formatCurrency(analysis.currentSpread)}
                          </span>
                        </div>

                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-gray-400 uppercase font-medium block">P&L Aberto</span>
                          <span className={`text-xs sm:text-sm font-semibold font-mono block ${analysis.pnlTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {analysis.pnlTotal >= 0 ? '+' : ''}{formatCurrency(analysis.pnlTotal)}
                          </span>
                          <span className={`text-[10px] font-medium block ${analysis.pnlPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {analysis.pnlPercent >= 0 ? '+' : ''}{analysis.pnlPercent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size="sm" />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Minimalist Visual Thermometer Gauge */}
                <div className="px-4 sm:px-5 pb-4">
                  {(() => {
                    const isShort = strat.strategyCategory === 'venda_put' || strat.strategyCategory === 'venda_coberta' || (!buyLeg && !!sellLeg);
                    const { target50, target80, stopLoss } = analysis;
                    const cost = analysis.entryCost;

                    const minVal = isShort 
                      ? 0 
                      : Math.max(0, Math.min(stopLoss * 0.7, cost * 0.3));
                    const maxVal = isShort 
                      ? Math.max(stopLoss * 1.25, cost * 1.5, 0.1) 
                      : Math.max(target80 * 1.25, cost * 2.2, 0.1);
                    const range = Math.max(0.01, maxVal - minVal);
                    const pinPos = Math.max(2, Math.min(98, ((analysis.currentSpread - minVal) / range) * 100));

                    return (
                      <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                        <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">
                              {isShort ? 'Cotação da opção:' : 'Spread:'}
                            </span>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(analysis.currentSpread)}
                            </span>
                          </div>

                          <span className="text-[11px] text-gray-400">
                            {analysis.statusBadge.actionRecommendation || 'Oscilando na faixa neutra'}
                          </span>
                        </div>

                        {/* Minimal Sleek Track with Marker Dot */}
                        <div className="relative py-1">
                          <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
                            {/* Position Marker */}
                            <div
                              className="absolute -top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 bg-blue-600 shadow-xs transition-all duration-300"
                              style={{ left: `${pinPos}%`, transform: 'translateX(-50%)' }}
                              title={`Atual: ${formatCurrency(analysis.currentSpread)}`}
                            />
                          </div>
                        </div>

                        {/* Minimal Scale Milestones */}
                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono pt-0.5">
                          {isShort ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400">Pó: R$ 0,00</span>
                              <span>Alvo 2: {formatCurrency(target80)}</span>
                              <span>Alvo 1: {formatCurrency(target50)}</span>
                              <span>Entrada: {formatCurrency(cost)}</span>
                              <span className="text-rose-500">Stop: {formatCurrency(stopLoss)}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-rose-500">Stop: {formatCurrency(stopLoss)}</span>
                              <span>Entrada: {formatCurrency(cost)}</span>
                              <span>Alvo 1: {formatCurrency(target50)}</span>
                              <span className="text-emerald-600 dark:text-emerald-400">Alvo 2: {formatCurrency(target80)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Expanded Section with Leg Details & Actions */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-4 bg-gray-50/30 dark:bg-gray-900/20">
                    {/* Dividendo Sintético vs Proventos da Ação */}
                    <SyntheticDividendCard 
                      strategy={strat}
                      onUpdateStrategy={onUpdateStrategy}
                    />

                    <div className="flex items-center justify-between pt-1">
                      <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pernas da Operação
                      </h5>
                      <span className="text-[11px] text-gray-400">
                        2 cliques na cotação para override manual
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-gray-400 uppercase font-medium border-b border-gray-100 dark:border-gray-800">
                          <tr>
                            <th className="py-2 pr-3">Ponta</th>
                            <th className="py-2 px-3">Ticker</th>
                            <th className="py-2 px-2">Tipo</th>
                            <th className="py-2 px-3 text-right">Strike</th>
                            <th className="py-2 px-3 text-right">Entrada</th>
                            <th className="py-2 px-3 text-right">Cotação Atual</th>
                            <th className="py-2 px-3 text-right">Bid / Ask</th>
                            <th className="py-2 pl-3 text-right">Vencimento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                          {strat.legs.map((leg) => {
                            const isBuy = leg.side === 'buy';
                            const isEditing = editingLegPrice?.stratId === strat.id && editingLegPrice?.ticker === leg.ticker;

                            return (
                              <tr key={leg.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="py-2.5 pr-3">
                                  <span className={`text-[11px] font-medium ${
                                    isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {isBuy ? 'Comprada' : 'Vendida'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-gray-900 dark:text-white">
                                  {leg.ticker}
                                </td>
                                <td className="py-2.5 px-2 text-gray-500">
                                  {leg.type}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-gray-900 dark:text-white">
                                  {formatCurrency(leg.strike)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-gray-500">
                                  {formatCurrency(leg.entryPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
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
                                      >
                                        <Icon name="check" size="sm" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingLegPrice(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                      >
                                        <Icon name="close" size="sm" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span
                                        onDoubleClick={() => setEditingLegPrice({ stratId: strat.id, ticker: leg.ticker, price: String(leg.currentPrice) })}
                                        className="cursor-pointer hover:underline font-semibold text-gray-900 dark:text-white"
                                        title="2 cliques para editar"
                                      >
                                        {formatCurrency(leg.currentPrice)}
                                      </span>
                                      {leg.manualOverride ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                          manual
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-[11px] text-gray-400">
                                  {leg.bidPrice ? formatCurrency(leg.bidPrice) : '-'} / {leg.askPrice ? formatCurrency(leg.askPrice) : '-'}
                                </td>
                                <td className="py-2.5 pl-3 text-right text-gray-500">
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
                      <div className="text-xs text-gray-400">
                        {strat.notes && <span>{strat.notes}</span>}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStrategyToEdit({ ...strat })}
                          className="text-xs text-gray-600 dark:text-gray-300"
                        >
                          <Icon name="edit" size="sm" />
                          <span>Editar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCloseStrategy(strat.id)}
                          className="text-xs text-amber-600 dark:text-amber-400"
                        >
                          <Icon name="check_circle" size="sm" />
                          <span>Encerrar Operação</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteStrategy(strat.id)}
                          className="text-xs text-rose-500 hover:text-rose-700"
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

      {/* Modal para Backup / Transferência Manual Instantânea */}
      {backupModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setBackupModalOpen(false)}
          title="Transferência / Backup de Opções"
        >
          <div className="space-y-4 text-xs">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Você pode transferir suas operações gravadas deste aparelho para o outro (ex: via WhatsApp, e-mail ou bloco de notas) para tê-las instantaneamente em qualquer dispositivo:
            </p>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  1. Copiar deste aparelho ({strategies.length} operações)
                </span>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Icon name={copiedBackup ? 'check' : 'content_copy'} size="xs" />
                  <span>{copiedBackup ? 'Copiado!' : 'Copiar Operações'}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleImportJson} className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
              <span className="font-semibold text-gray-800 dark:text-gray-200 block">
                2. Importar neste aparelho
              </span>
              <textarea
                value={backupJsonInput}
                onChange={(e) => setBackupJsonInput(e.target.value)}
                placeholder="Cole aqui o texto copiado do outro dispositivo..."
                rows={3}
                className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono text-[11px] focus:outline-hidden"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!backupJsonInput.trim()}
                  className="text-xs"
                >
                  Salvar e Carregar Operações
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
