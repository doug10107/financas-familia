'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useDashboard } from '@/hooks/useDashboard';
import { useFamily } from '@/hooks/useFamily';
import { FinancialProjectionChart } from '@/components/dashboard/FinancialProjectionChart';
import { DailyExpenseHeatmap } from '@/components/dashboard/DailyExpenseHeatmap';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

export default function DashboardPage() {
  const router = useRouter();
  const { family } = useFamily();

  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: dashboardData, loading, error } = useDashboard(filterMonth);

  const [expenseTab, setExpenseTab] = useState<'all' | 'fixed' | 'variable'>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setFilterMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = filterMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setFilterMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatCurrency = (value: number) => {
    if (isBalanceHidden) return 'R$ ••••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const currentMember = family?.members?.find(m => m.is_current_user);
  const familyDisplayName = family?.family_name || 'Família Menezes';
  const userGreetingName = currentMember?.display_name || 'Douglas';

  // Calculations for insights and family health score
  const financialInsights = useMemo(() => {
    if (!dashboardData) return null;

    const income = dashboardData.monthlyIncome || 0;
    const totalExpense = dashboardData.monthlyExpense || 0;
    const investments = dashboardData.monthlyInvestments || 0;
    // Gastos operacionais de consumo (exclui aportes e poupança)
    const operatingExpense = dashboardData.monthlyOperatingExpense ?? Math.max(0, totalExpense - investments);

    // Poupança real = sobra líquida de caixa + valor aportado em investimentos
    const netSavings = Math.max(0, income - totalExpense) + investments;
    const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 0;
    const investmentRate = income > 0 ? Math.round((investments / income) * 100) : 0;

    // Fixed expense percentage (sem contar investimentos)
    const fixedExpensesTotal = (dashboardData.topExpenses || [])
      .filter((e: any) => e.isFixed && !e.isInvestment)
      .reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
    const fixedRatio = income > 0 ? Math.round((fixedExpensesTotal / income) * 100) : 0;

    // Overdue bills check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCount = dashboardData.upcomingBills.filter((bill: any) => {
      const billDate = new Date(bill.date + 'T00:00:00');
      return billDate.getTime() < today.getTime();
    }).length;

    // Calculate score (0-100)
    let score = 85;
    if (savingsRate >= 20 || investmentRate >= 20) score += 12;
    else if (savingsRate < 0) score -= 25;
    else if (savingsRate < 10) score -= 10;

    if (overdueCount > 0) score -= overdueCount * 12;
    if (fixedRatio > 60) score -= 8;
    score = Math.max(20, Math.min(100, score));

    // Teto de despesas operacionais da família:
    // O teto padrão é a renda líquida menos a meta de investimentos realizada/programada (ou 85% da renda)
    const plannedInvestment = Math.max(investments, income * 0.15);
    const estimatedCeiling = income > 0 
      ? Math.round(income - plannedInvestment > 0 ? (income - plannedInvestment) : income * 0.85)
      : Math.max(operatingExpense * 1.2, 5000);

    const budgetPercentage = Math.min(100, Math.round((operatingExpense / (estimatedCeiling || 1)) * 100));

    return {
      savingsRate,
      investmentRate,
      investments,
      operatingExpense,
      fixedRatio,
      overdueCount,
      score,
      estimatedCeiling,
      budgetPercentage,
      netSavings
    };
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
        <p className="text-xs text-gray-500 font-medium">Carregando painel financeiro...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">Não foi possível carregar os dados</p>
          <p className="text-xs mt-0.5">{error || 'Tente recarregar a página.'}</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    );
  }

  const filteredTopExpenses = (dashboardData.topExpenses || []).filter((e: any) => {
    if (expenseTab === 'all') return true;
    if (expenseTab === 'fixed') return e.isFixed;
    return !e.isFixed;
  });

  const overallMonthlyExpense = dashboardData.monthlyExpense || 1;
  const topExpensesDisplayed = filteredTopExpenses.slice(0, 5).map((e: any) => ({
    ...e,
    percentage: Math.round((e.amount / overallMonthlyExpense) * 100)
  }));

  return (
    <div className="space-y-6 pb-6">
      {/* =========================================================================
          TOP COMMAND & ACTION BAR
         ========================================================================= */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Painel Consolidado
            </span>
            <span className="text-gray-300 dark:text-slate-700">•</span>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">
              {familyDisplayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">
            Olá, {userGreetingName}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Month Selector with Previous / Next Controls */}
          <div className="flex items-center bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xs p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Icon name="chevron_left" className="text-[18px]" />
            </button>

            <div className="w-48 sm:w-52 px-1">
              <Select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="!text-sm !py-1.5 !px-3 !pr-8 font-semibold"
                options={[
                  ...Array.from({ length: 15 }, (_, i) => {
                    const today = new Date();
                    const d = new Date(today.getFullYear(), today.getMonth() - 7 + i, 1);
                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
                    return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
                  })
                ]}
              />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Próximo mês"
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>

          {/* Quick Actions (Stitch Neo-Banking Shape) */}
          <div className="flex items-center gap-1.5 bg-gray-100/80 dark:bg-slate-800/60 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => router.push('/lancamentos?action=new&type=receita')}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-2 rounded-xl shadow-xs text-xs font-bold transition-all active:scale-95"
            >
              <Icon name="arrow_downward" className="text-[15px]" />
              <span>+ Receita</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/lancamentos?action=new&type=despesa')}
              className="flex items-center gap-1.5 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-2 rounded-xl shadow-xs text-xs font-bold transition-all active:scale-95"
            >
              <Icon name="arrow_upward" className="text-[15px]" />
              <span>- Despesa</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/lancamentos')}
              className="hidden sm:flex items-center gap-1.5 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Icon name="sync_alt" className="text-[15px]" />
              <span>Lançamentos</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/metas')}
              className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-white/60 dark:hover:bg-slate-700/50 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <Icon name="track_changes" className="text-[15px]" />
              <span className="hidden sm:inline">Metas</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KPI METRICS STRIP (4-CARD NEO-BANKING ELEVATED LAYOUT)
         ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* Card 1: Patrimônio Líquido Total / Saldo Consolidado */}
        <div className="relative bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none blur-xl" />

          <div>
            <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold tracking-tight">Patrimônio / Saldo Geral</span>
              <button
                type="button"
                onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                aria-label="Alternar visibilidade do saldo"
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <Icon name={isBalanceHidden ? 'visibility_off' : 'visibility'} className="text-[18px]" />
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {formatCurrency(dashboardData.totalBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-slate-800/80">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold">
              <Icon name="trending_up" className="text-[13px]" />
              Fluxo Positivo
            </span>
            <span className="text-[11px] text-gray-400">Total acumulado</span>
          </div>
        </div>

        {/* Card 2: Entradas Totais (Mês Selecionado) */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold tracking-tight">Entradas do Mês</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Icon name="south_west" className="text-[17px]" />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(dashboardData.monthlyIncome)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-50 dark:border-slate-800/80 text-[11px] text-gray-500 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Receitas registradas no período</span>
          </div>
        </div>

        {/* Card 3: Saídas Operacionais (Mês Selecionado) */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold tracking-tight">Saídas do Mês</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Icon name="north_east" className="text-[17px]" />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(dashboardData.monthlyExpense)}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-slate-800/80 text-[11px] font-medium">
            <span className="text-gray-500 dark:text-slate-400">
              Consumo: {formatCurrency(financialInsights?.operatingExpense || 0)}
            </span>
            {(dashboardData.monthlyInvestments || 0) > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                Aporte: {formatCurrency(dashboardData.monthlyInvestments)}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Aporte & Reservas / Poupança Total */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold tracking-tight">Investimentos & Poupança</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Icon name="savings" className="text-[17px]" />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
              {formatCurrency(financialInsights?.netSavings || 0)}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-slate-800/80 text-[11px] font-bold">
            <span className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
              <Icon name="trending_up" className="text-[13px]" />
              {financialInsights?.savingsRate ?? 0}% poupado ({financialInsights?.investmentRate ?? 0}% em ativos)
            </span>
            <span className="text-gray-400 font-normal">no mês</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN CONTENT GRID (8 COLS LEFT vs 4 COLS RIGHT)
         ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =====================================================================
            LEFT COLUMN (8 COLS): CHARTS, SHARED BUDGET & HEATMAP
           ===================================================================== */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. Projeção & Fluxo Mensal Consolidado */}
          <FinancialProjectionChart
            chartData={dashboardData.chartData}
            projectionMonths={dashboardData.projectionMonths}
            currentBalance={dashboardData.totalBalance}
          />

          {/* 2. Meta Conjunta de Gastos Mensal (Teto Familiar Inteligente) */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Icon name="groups" className="text-[22px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                    Meta Conjunta de Gastos Mensal
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Teto programado de despesas familiares
                  </p>
                </div>
              </div>

              {/* Family Members Active Pill */}
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2 overflow-hidden">
                  {(family?.members || []).slice(0, 4).map((member, mIdx) => (
                    <div
                      key={member.id || mIdx}
                      className="inline-flex h-8 w-8 rounded-full bg-emerald-600 text-white items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-xs"
                      title={member.display_name}
                    >
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {(!family?.members || family.members.length === 0) && (
                    <div className="inline-flex h-8 w-8 rounded-full bg-emerald-600 text-white items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-xs">
                      D
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {family?.members?.length || 1} {family?.members?.length === 1 ? 'ativo' : 'ativos'}
                </span>
              </div>
            </div>

            {/* Gauge Progress Bar */}
            <div className="space-y-2 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {formatCurrency(financialInsights?.operatingExpense || 0)}
                  </span>
                  <span className="text-xs text-gray-400">
                    consumo de {formatCurrency(financialInsights?.estimatedCeiling || 9610)} teto
                  </span>
                  {(dashboardData.monthlyInvestments || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold inline-flex items-center gap-1 shadow-2xs">
                      <Icon name="trending_up" className="text-[12px]" />
                      +{formatCurrency(dashboardData.monthlyInvestments)} ({financialInsights?.investmentRate}%) em investimentos
                    </span>
                  )}
                </div>
                <span className={`text-xs font-extrabold ${
                  (financialInsights?.budgetPercentage || 0) > 90
                    ? 'text-rose-600 dark:text-rose-400'
                    : (financialInsights?.budgetPercentage || 0) > 75
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {financialInsights?.budgetPercentage || 0}% consumido
                </span>
              </div>

              {/* Progress track */}
              <div className="h-2.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    (financialInsights?.budgetPercentage || 0) > 90
                      ? 'bg-rose-500'
                      : (financialInsights?.budgetPercentage || 0) > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, financialInsights?.budgetPercentage || 0))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium pt-1">
                <span>R$ 0</span>
                <span>
                  Risco de estouro: {(financialInsights?.budgetPercentage || 0) > 90 ? 'Alto' : (financialInsights?.budgetPercentage || 0) > 70 ? 'Moderado' : 'Baixo'}
                </span>
                <span>
                  Disponível p/ consumo: {formatCurrency(Math.max(0, (financialInsights?.estimatedCeiling || 9610) - (financialInsights?.operatingExpense || 0)))}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Mapa de Calor Diário (Calendário de Gastos) */}
          <DailyExpenseHeatmap
            monthFilter={filterMonth}
            transactions={dashboardData.monthlyTransactions}
            totalExpense={dashboardData.monthlyExpense}
            totalIncome={dashboardData.monthlyIncome}
          />

          {/* 4. Diagnóstico Financeiro & Dica do Planejador (Abaixo do Calendário de Saídas por Dia) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Diagnóstico de Inteligência Financeira / Score */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/10 pointer-events-none blur-xl" />

              <div className="z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                    <Icon name="verified_user" className="text-white text-[22px]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-extrabold">
                    Score: {financialInsights?.score ?? 90}/100
                  </span>
                </div>

                <h4 className="font-extrabold text-base tracking-tight">
                  {(financialInsights?.score ?? 90) >= 80 ? 'Tudo sob controle' : 'Atenção ao fluxo'}
                </h4>
                <p className="text-[11px] text-white/80 font-medium mt-0.5">
                  Diagnóstico de Inteligência Financeira
                </p>

                <p className="text-xs text-white/95 mt-3 leading-relaxed">
                  {(financialInsights?.overdueCount ?? 0) > 0 ? (
                    <>Você possui <strong className="font-bold underline">{financialInsights?.overdueCount} contas vencidas</strong> aguardando liquidação para regularizar seu fluxo.</>
                  ) : (financialInsights?.investmentRate ?? 0) >= 15 || (financialInsights?.savingsRate ?? 0) >= 20 ? (
                    <>Excelente gestão! Você já direcionou <strong className="font-bold">{financialInsights?.investmentRate}% da renda para investimentos ({formatCurrency(financialInsights?.investments || 0)})</strong> e seus gastos de consumo estão sob controle.</>
                  ) : (
                    <>Suas contas estão em dia. Mantenha as saídas de consumo sob controle para acelerar os aportes em investimentos e reservas.</>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/20 z-10 text-xs">
                <span className="text-white/80 font-medium">Saúde Financeira</span>
                <span className="font-extrabold text-white">
                  {(financialInsights?.score ?? 90) >= 80 ? 'Nível Excelente' : 'Nível Moderado'}
                </span>
              </div>
            </div>

            {/* Dica do Planejador / Insights Inteligentes */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Icon name="tips_and_updates" className="text-[22px]" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                    Dica do Planejador
                  </span>
                </div>

                <h4 className="font-extrabold text-base tracking-tight text-gray-900 dark:text-white mt-1">
                  Estratégia do Mês
                </h4>
                <p className="text-xs text-gray-600 dark:text-slate-300 mt-2 leading-relaxed">
                  {(financialInsights?.savingsRate ?? 0) > 0 
                    ? 'Sua taxa de poupança está saudável! Potencialize suas metas familiares realizando aportes programados nas reservas de longo prazo.' 
                    : 'Revise suas despesas variáveis este mês para estancar vazamentos e gerar sobras financeiras para investimentos.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => router.push('/metas')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Acessar Metas & Investimentos</span>
                  <Icon name="chevron_right" className="text-[14px]" />
                </button>
                <span className="text-[11px] text-gray-400">Automatizado</span>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            RIGHT COLUMN (4 COLS): BILLS, TOP EXPENSES, CATEGORIES & INSIGHTS
           ===================================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. Próximos Vencimentos */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Próximos Vencimentos</h3>
                  {dashboardData.upcomingBills.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {dashboardData.upcomingBills.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/lancamentos')}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Ver todas
                </button>
              </div>

              <div className="space-y-2.5">
                {dashboardData.upcomingBills.length > 0 ? (
                  dashboardData.upcomingBills.map((bill: any) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const billDate = new Date(bill.date + 'T00:00:00');
                    const diffTime = billDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300';
                    let badgeLabel = 'Pendente';
                    const isOverdue = diffDays < 0;

                    if (isOverdue) {
                      badgeClass = 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
                      badgeLabel = 'Atrasado';
                    } else if (diffDays === 0) {
                      badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
                      badgeLabel = 'Vence Hoje';
                    } else if (diffDays === 1) {
                      badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
                      badgeLabel = 'Vence Amanhã';
                    } else if (bill.isInvoice) {
                      badgeClass = 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';
                      badgeLabel = 'Fatura';
                    }

                    return (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 hover:bg-gray-100/70 dark:hover:bg-slate-800/70 transition-colors border border-transparent"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                            style={{ backgroundColor: bill.category?.color || '#ef4444' }}
                          >
                            <Icon name={bill.isInvoice ? 'credit_card' : (bill.category?.icon || 'receipt')} className="text-white text-[18px]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-gray-900 dark:text-white truncate">{bill.description}</p>
                            <p className={`text-[10px] mt-0.5 ${isOverdue ? 'text-rose-500 font-bold' : 'text-gray-400'}`}>
                              {isOverdue ? `Venceu dia ${billDate.getDate().toString().padStart(2, '0')}/${(billDate.getMonth() + 1).toString().padStart(2, '0')}` : `Vence dia ${billDate.getDate().toString().padStart(2, '0')}/${(billDate.getMonth() + 1).toString().padStart(2, '0')}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end shrink-0 ml-2">
                          <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                            {formatCurrency(bill.amount)}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mt-1 ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    Nenhum vencimento pendente no momento.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/lancamentos?action=new&type=despesa')}
              className="w-full mt-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="add_circle" className="text-[16px]" />
              <span>Agendar novo compromisso</span>
            </button>
          </div>

          {/* 2. Top 5 Despesas */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Top 5 Despesas</h3>
                <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setExpenseTab('all')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${expenseTab === 'all' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseTab('fixed')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${expenseTab === 'fixed' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                  >
                    Fixas
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseTab('variable')}
                    className={`px-2 py-0.5 rounded-md transition-colors ${expenseTab === 'variable' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                  >
                    Variáveis
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {topExpensesDisplayed.length > 0 ? (
                  topExpensesDisplayed.map((expense: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">{expense.name}</span>
                        <span className="font-bold text-gray-900 dark:text-white shrink-0">{formatCurrency(expense.amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(3, expense.percentage)}%`, backgroundColor: expense.color }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs py-10">
                    Nenhuma despesa para listar.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Despesas por Categoria (Distribuição Mensal) */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="w-full flex items-center justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 inline-flex items-center gap-1">
                      <Icon name="donut_large" className="text-[14px]" /> Categorias
                    </span>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white mt-1">
                      Distribuição Mensal
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Detalhamento do fluxo por grupo de gasto
                    </p>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center justify-center pt-2">
                  <div className="h-44 w-44 relative flex items-center justify-center">
                    {dashboardData.expensesByCategory.labels.length > 0 ? (
                      <>
                        <Doughnut
                          data={dashboardData.expensesByCategory}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: function(context: any) {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                                    return ` ${context.label}: ${formattedValue} (${percentage}%)`;
                                  }
                                }
                              }
                            },
                            cutout: '78%'
                          }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                            TOTAL
                          </span>
                          <span className="text-base font-extrabold text-gray-900 dark:text-white">
                            {formatCurrency(dashboardData.monthlyExpense)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                        Sem despesas no mês
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Rows List */}
              <div className="space-y-2 pt-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {dashboardData.expensesByCategory.categoryList && dashboardData.expensesByCategory.categoryList.length > 0 ? (
                  dashboardData.expensesByCategory.categoryList.map((cat: any, idx: number) => {
                    const isExpanded = expandedCategory === cat.name;

                    return (
                      <div key={idx} className="bg-gray-50/70 dark:bg-slate-800/40 rounded-xl p-3 hover:bg-gray-100/70 dark:hover:bg-slate-800/70 transition-all border border-transparent space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                            >
                              <Icon name={cat.icon || 'category'} className="text-[17px]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-gray-900 dark:text-white truncate">{cat.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {cat.transactions.length} {cat.transactions.length === 1 ? 'item' : 'itens'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                              {formatCurrency(cat.total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                              <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-[18px]" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${Math.max(2, cat.percentage)}%`, backgroundColor: cat.color }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 w-10 text-right">
                            {cat.percentage}%
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-slate-700/50 space-y-1">
                            {cat.transactions.map((tx: any, tIdx: number) => (
                              <div key={tIdx} className="flex justify-between items-center text-[11px] py-0.5">
                                <span className="text-gray-600 dark:text-slate-300 font-medium truncate pr-2">
                                  {tx.description}
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                  {formatCurrency(Number(tx.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-gray-400 italic">
                    Nenhuma despesa para exibir no mês.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
