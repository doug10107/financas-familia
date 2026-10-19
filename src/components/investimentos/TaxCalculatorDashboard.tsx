'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTaxCalculator } from '@/hooks/useTaxCalculator';
import { UploadBrokerageNoteModal } from './UploadBrokerageNoteModal';
import { HistoricalLossModal } from './HistoricalLossModal';
import { DarfSlipModal } from './DarfSlipModal';
import { AnnualTaxReportModal } from './AnnualTaxReportModal';

export function TaxCalculatorDashboard() {
  const {
    notes,
    orders,
    settlements,
    initialLosses,
    loading,
    error,
    saveBrokerageNote,
    deleteBrokerageNote,
    saveHistoricalLosses,
    refreshData
  } = useTaxCalculator();

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isDarfModalOpen, setIsDarfModalOpen] = useState(false);
  const [isAnnualReportOpen, setIsAnnualReportOpen] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  // Define o mês ativo (padrão: primeiro da lista ou mês atual)
  const activeSettlement = settlements.find(s => s.periodMonthYear === selectedMonth) || settlements[0];

  const currentYear = activeSettlement?.periodMonthYear.slice(0, 4) || new Date().getFullYear().toString();

  const swingSales = activeSettlement?.swingTrade.salesTotal || 0;
  const swingLimit = 20000;
  const swingProgressPercent = Math.min(100, (swingSales / swingLimit) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-emerald-500/10 p-5 rounded-2xl border border-orange-500/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-600 text-white font-extrabold text-sm shadow-xs">
              íon
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Calculadora de IR & DARF de Investimentos
            </h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">
            Apuração automática de imposto de renda da B3 para o <strong>íon Itaú</strong>. Faça upload da sua nota de corretagem em PDF ou extrato de ordens para calcular o preço médio, isenções de R$ 20k, compensar prejuízos passados e emitir a DARF (código 6015).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsLossModalOpen(true)}
            className="text-xs flex items-center gap-1.5 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40"
            title="Cadastrar prejuízos de meses anteriores para abater lucros futuros"
          >
            <Icon name="history_edu" size="sm" className="text-purple-600" />
            <span>Prejuízos Anteriores</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAnnualReportOpen(true)}
            className="text-xs flex items-center gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40"
            title="Visualizar fichas prontas para a Declaração Anual da Receita Federal"
          >
            <Icon name="assignment" size="sm" className="text-blue-600" />
            <span>Informe Anual IRPF</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs flex items-center gap-1.5 shadow-sm font-bold"
          >
            <Icon name="cloud_upload" size="sm" />
            <span>Subir Nota íon Itaú (PDF/Foto)</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
          <Icon name="error" size="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Period Selector Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon name="calendar_month" className="text-gray-400 w-5 h-5" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Período de Apuração:
          </span>
          <select
            value={activeSettlement?.periodMonthYear || ''}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs cursor-pointer"
          >
            {settlements.map((s) => (
              <option key={s.periodMonthYear} value={s.periodMonthYear}>
                {s.periodLabel} {s.finalDarfToPay > 0 ? `(DARF: ${formatCurrency(s.finalDarfToPay)})` : '(Isento/Sem DARF)'}
              </option>
            ))}
          </select>
        </div>

        {activeSettlement && activeSettlement.finalDarfToPay > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsDarfModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs animate-pulse"
          >
            <Icon name="receipt" size="sm" />
            <span>Emitir Guia DARF ({formatCurrency(activeSettlement.finalDarfToPay)})</span>
          </Button>
        )}
      </div>

      {/* Main KPI Cards */}
      {activeSettlement ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Status Tributário & DARF */}
          <GlassCard className="p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Obrigação Fiscal (DARF)
              </span>
              <div className={`p-2 rounded-xl text-white ${
                activeSettlement.finalDarfToPay > 0
                  ? 'bg-red-500'
                  : activeSettlement.status === 'prejuizo'
                  ? 'bg-purple-500'
                  : 'bg-emerald-500'
              }`}>
                <Icon name={activeSettlement.finalDarfToPay > 0 ? 'gavel' : 'verified'} className="w-5 h-5" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-2xl font-extrabold ${
                  activeSettlement.finalDarfToPay > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {formatCurrency(activeSettlement.finalDarfToPay)}
                </h3>
              </div>

              <div className="mt-1 text-xs">
                {activeSettlement.finalDarfToPay > 0 ? (
                  <p className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                    <Icon name="alarm" size="sm" />
                    <span>Vencimento: {formatDate(activeSettlement.dueDate)}</span>
                  </p>
                ) : activeSettlement.isUnderMinimum ? (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    DARF &lt; R$ 10 ({formatCurrency(activeSettlement.darfAmount)}). Acumula p/ próx. mês.
                  </p>
                ) : activeSettlement.status === 'prejuizo' ? (
                  <p className="text-purple-600 dark:text-purple-400 font-semibold">
                    Prejuízo acumulado como crédito fiscal.
                  </p>
                ) : (
                  <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Icon name="check_circle" size="sm" />
                    <span>Nenhum imposto a recolher este mês.</span>
                  </p>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Card 2: Termômetro da Isenção dos R$ 20.000 em Ações */}
          <GlassCard className="p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Teto de Isenção (Ações)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeSettlement.swingTrade.isExempt
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}>
                {activeSettlement.swingTrade.isExempt ? 'ISENTO (≤ 20k)' : 'TRIBUTÁVEL (&gt; 20k)'}
              </span>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                  {formatCurrency(swingSales)}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  de {formatCurrency(swingLimit)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    swingProgressPercent > 90
                      ? 'bg-red-500'
                      : swingProgressPercent > 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${swingProgressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {activeSettlement.swingTrade.isExempt
                  ? `Margem restante: ${formatCurrency(Math.max(0, swingLimit - swingSales))}`
                  : 'Limite ultrapassado. Lucros tributados a 15%.'}
              </p>
            </div>
          </GlassCard>

          {/* Card 3: Lucro Líquido Total no Mês */}
          <GlassCard className="p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Resultado Líquido do Mês
              </span>
              <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Icon name="query_stats" className="w-5 h-5" />
              </div>
            </div>

            <div>
              <h3 className={`text-2xl font-extrabold ${
                activeSettlement.totalGrossProfit >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              }`}>
                {activeSettlement.totalGrossProfit >= 0 ? '+' : ''}
                {formatCurrency(activeSettlement.totalGrossProfit)}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Total movimentado em vendas: {formatCurrency(activeSettlement.totalSales)}
              </p>
            </div>
          </GlassCard>

          {/* Card 4: Prejuízos Acumulados para Compensação */}
          <GlassCard className="p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Prejuízos a Compensar
              </span>
              <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                <Icon name="shield" className="w-5 h-5" />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {formatCurrency(
                  activeSettlement.swingTrade.lossCarriedForward +
                  activeSettlement.dayTrade.lossCarriedForward +
                  activeSettlement.fiis.lossCarriedForward
                )}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                IRRF retido acumulado: {formatCurrency(activeSettlement.irrfAccumulatedRemaining)}
              </p>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {/* Tax Category Breakdown (Caixinhas Tributárias) */}
      {activeSettlement && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Icon name="layers" className="text-orange-500" />
              Demonstrativo por Caixinha Tributária (B3 / Receita Federal)
            </h3>
            <span className="text-xs text-gray-400">
              Código da Receita DARF: <strong className="text-blue-600 dark:text-blue-400 font-mono">6015</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Swing Trade */}
            <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Ações (Swing Trade)</h4>
                  <span className="text-[10px] text-gray-400">Alíquota 15% | Isenção até R$ 20k</span>
                </div>
                <Badge color={activeSettlement.swingTrade.isExempt ? 'green' : 'yellow'}>
                  {activeSettlement.swingTrade.isExempt ? 'Isento' : '15%'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total Vendas:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(activeSettlement.swingTrade.salesTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Lucro/Prejuízo:</span>
                  <span className={`font-bold ${activeSettlement.swingTrade.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(activeSettlement.swingTrade.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Prejuízo Compensado:</span>
                  <span className="text-purple-600 font-medium">-{formatCurrency(activeSettlement.swingTrade.lossUsed)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700 font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Imposto Devido:</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(activeSettlement.swingTrade.taxDue)}</span>
                </div>
              </div>
            </div>

            {/* 2. Day Trade */}
            <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">Day Trade</h4>
                  <span className="text-[10px] text-gray-400">Alíquota 20% | Sem Isenção</span>
                </div>
                <Badge color="red">20%</Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total Vendas:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(activeSettlement.dayTrade.salesTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Lucro/Prejuízo:</span>
                  <span className={`font-bold ${activeSettlement.dayTrade.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(activeSettlement.dayTrade.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Prejuízo Compensado:</span>
                  <span className="text-purple-600 font-medium">-{formatCurrency(activeSettlement.dayTrade.lossUsed)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700 font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Imposto Devido:</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(activeSettlement.dayTrade.taxDue)}</span>
                </div>
              </div>
            </div>

            {/* 3. FIIs e FIAGRO */}
            <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">FIIs & FIAGRO</h4>
                  <span className="text-[10px] text-gray-400">Alíquota 20% | Sem Isenção</span>
                </div>
                <Badge color="yellow">20%</Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Alienação Cotas:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(activeSettlement.fiis.salesTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Lucro/Prejuízo:</span>
                  <span className={`font-bold ${activeSettlement.fiis.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(activeSettlement.fiis.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Prejuízo Compensado:</span>
                  <span className="text-purple-600 font-medium">-{formatCurrency(activeSettlement.fiis.lossUsed)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700 font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Imposto Devido:</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(activeSettlement.fiis.taxDue)}</span>
                </div>
              </div>
            </div>

            {/* 4. ETFs & BDRs */}
            <div className="p-4 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">ETFs & BDRs</h4>
                  <span className="text-[10px] text-gray-400">Alíquota 15% | Sem Isenção</span>
                </div>
                <Badge color="blue">15%</Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total Vendas:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(activeSettlement.etfs.salesTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Lucro/Prejuízo:</span>
                  <span className={`font-bold ${activeSettlement.etfs.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(activeSettlement.etfs.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Prejuízo Compensado:</span>
                  <span className="text-purple-600 font-medium">-R$ 0,00</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700 font-bold">
                  <span className="text-gray-700 dark:text-gray-300">Imposto Devido:</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(activeSettlement.etfs.taxDue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History of Uploaded Brokerage Notes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Icon name="receipt_long" className="text-emerald-500" />
            Notas de Corretagem do íon Itaú Importadas ({notes.length})
          </h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="text-xs text-orange-600 dark:text-orange-400"
          >
            + Subir Outra Nota
          </Button>
        </div>

        {notes.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Icon name="receipt" className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Nenhuma nota de corretagem do íon Itaú cadastrada
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Suba o PDF da sua primeira nota de corretagem ou foto de ordens para que o sistema comece a apurar seus impostos e atualizar o preço médio.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsUploadOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
            >
              <Icon name="cloud_upload" size="sm" />
              <span>Subir Primeira Nota do íon</span>
            </Button>
          </GlassCard>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-x-auto bg-white dark:bg-gray-800/80 shadow-xs no-scrollbar">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="p-3">Data Pregão</th>
                  <th className="p-3">Corretora</th>
                  <th className="p-3">Nº Nota</th>
                  <th className="p-3 text-right">Total Operações</th>
                  <th className="p-3 text-right">Taxas B3</th>
                  <th className="p-3 text-right">IRRF (Dedo-Duro)</th>
                  <th className="p-3 text-right">Valor Líquido</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-[11px]">
                {notes.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <td className="p-3 font-bold text-gray-900 dark:text-white">
                      {formatDate(n.trading_date)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-extrabold text-[10px]">
                        {n.broker_name}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-600 dark:text-gray-300">
                      {n.note_number || '-'}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(n.total_operations)}
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      {formatCurrency(
                        Number(n.settlement_fee || 0) +
                        Number(n.emoluments || 0) +
                        Number(n.brokerage_fee || 0) +
                        Number(n.taxes || 0)
                      )}
                    </td>
                    <td className="p-3 text-right text-orange-600 dark:text-orange-400 font-bold">
                      {formatCurrency(n.irrf_amount)}
                    </td>
                    <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(n.net_amount || n.total_operations)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Deseja excluir a nota do dia ${formatDate(n.trading_date)} e reverter seus cálculos?`)) {
                            deleteBrokerageNote(n.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Excluir nota"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadBrokerageNoteModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSaveNote={saveBrokerageNote}
      />

      <HistoricalLossModal
        isOpen={isLossModalOpen}
        onClose={() => setIsLossModalOpen(false)}
        currentLosses={initialLosses}
        onSaveLosses={saveHistoricalLosses}
      />

      <DarfSlipModal
        isOpen={isDarfModalOpen}
        onClose={() => setIsDarfModalOpen(false)}
        settlement={activeSettlement}
      />

      <AnnualTaxReportModal
        isOpen={isAnnualReportOpen}
        onClose={() => setIsAnnualReportOpen(false)}
        settlements={settlements}
        orders={orders}
        year={currentYear}
      />
    </div>
  );
}
