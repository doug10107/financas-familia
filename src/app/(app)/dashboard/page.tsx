'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { useRouter } from 'next/navigation';
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
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const { data: dashboardData, loading, error } = useDashboard(filterMonth);
  const router = useRouter();
  
  const [expenseTab, setExpenseTab] = useState<'all' | 'fixed' | 'variable'>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  const formatCurrency = (value: number) => {
    if (isBalanceHidden) return '••••••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="p-6 bg-red-100 text-red-700 rounded-lg">
        Erro ao carregar dashboard: {error}
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
    <div className="space-y-6">
      {/* Header and Month Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Visão geral do seu fluxo financeiro familiar</p>
        </div>
        <div className="flex gap-2">
          <div className="w-48">
            <Select 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              options={[
                ...Array.from({length: 13}, (_, i) => {
                  const today = new Date();
                  const d = new Date(today.getFullYear(), today.getMonth() - 6 + i, 1);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
                  return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
                })
              ]} 
            />
          </div>
        </div>
      </div>

      {/* STITCH MODERN HERO CARD & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Hero Card: Saldo Total & Resumo Tonal (8 cols on desktop) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none blur-2xl" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Patrimônio Líquido / Saldo Consolidado
              </span>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold border border-emerald-500/20">
                  <Icon name="trending_up" className="text-[14px]" />
                  Fluxo Positivo
                </span>
                <button
                  type="button"
                  onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                  aria-label="Alternar visibilidade do saldo"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name={isBalanceHidden ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {formatCurrency(dashboardData.totalBalance)}
              </h2>
            </div>
          </div>

          {/* Tonal Strip: Entradas vs Saídas vs Economia */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Icon name="arrow_downward" className="text-[16px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">Entradas</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
                  {formatCurrency(dashboardData.monthlyIncome)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Icon name="arrow_upward" className="text-[16px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">Saídas</p>
                <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 truncate">
                  {formatCurrency(dashboardData.monthlyExpense)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Icon name="savings" className="text-[16px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">Economia</p>
                <p className={`text-xs sm:text-sm font-bold truncate ${dashboardData.monthlyIncome - dashboardData.monthlyExpense >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
                  {formatCurrency(dashboardData.monthlyIncome - dashboardData.monthlyExpense)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons Grid (4 cols on desktop) */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push('/lancamentos?action=new&type=receita')}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-slate-800/80 transition-all active:scale-95 shadow-xs group"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Icon name="add" className="text-[22px]" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">+ Receita</span>
            <span className="text-[10px] text-gray-400">Entrada rápida</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/lancamentos?action=new&type=despesa')}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 hover:border-rose-500/50 hover:bg-rose-50/30 dark:hover:bg-slate-800/80 transition-all active:scale-95 shadow-xs group"
          >
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Icon name="remove" className="text-[22px]" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">- Despesa</span>
            <span className="text-[10px] text-gray-400">Novo gasto</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/lancamentos?action=new')}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-slate-800/80 transition-all active:scale-95 shadow-xs group"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Icon name="sync_alt" className="text-[22px]" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">Lançamentos</span>
            <span className="text-[10px] text-gray-400">Extrato geral</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/metas')}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-100 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-slate-800/80 transition-all active:scale-95 shadow-xs group"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Icon name="track_changes" className="text-[22px]" />
            </div>
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">Metas</span>
            <span className="text-[10px] text-gray-400">Objetivos ativos</span>
          </button>
        </div>
      </div>

      {/* Row 1: Projeção Financeira (2 cols) + Próximas Contas (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <FinancialProjectionChart 
            chartData={dashboardData.chartData} 
            projectionMonths={dashboardData.projectionMonths}
            currentBalance={dashboardData.totalBalance}
          />
        </div>

        <GlassCard className="p-6 flex flex-col h-full justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Próximas Contas</h3>
            <div className="space-y-3">
              {dashboardData.upcomingBills.length > 0 ? (
                <ul className="space-y-3">
                  {dashboardData.upcomingBills.map((bill: any) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const billDate = new Date(bill.date + 'T00:00:00');
                    
                    const diffTime = billDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let badgeColor: 'red' | 'yellow' | 'purple' | 'gray' | 'blue' = 'gray';
                    let badgeText = 'Pendente';
                    const isOverdue = diffDays < 0;

                    if (isOverdue) {
                      badgeColor = 'red';
                      badgeText = 'Atrasado';
                    } else if (diffDays === 0) {
                      badgeColor = 'yellow';
                      badgeText = 'Vence Hoje';
                    } else if (diffDays === 1) {
                      badgeColor = 'yellow';
                      badgeText = 'Vence Amanhã';
                    } else if (bill.isInvoice) {
                      badgeColor = 'purple';
                      badgeText = 'Fatura';
                    }

                    return (
                      <li key={bill.id} className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/70 dark:hover:bg-gray-800/60 rounded-xl transition-colors border border-gray-100 dark:border-gray-800/50">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: bill.category?.color || '#ef4444' }}
                          >
                            <Icon name={bill.isInvoice ? 'credit_card' : (bill.category?.icon || 'receipt')} size="sm" className="text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{bill.description}</p>
                            <p className={`text-[11px] flex items-center mt-0.5 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                              <Icon name="calendar_today" className="text-[12px] mr-1" />
                              {isOverdue ? `Vencido dia ${billDate.getDate().toString().padStart(2, '0')}/${(billDate.getMonth() + 1).toString().padStart(2, '0')}` : `Vence dia ${billDate.getDate().toString().padStart(2, '0')}/${(billDate.getMonth() + 1).toString().padStart(2, '0')}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(bill.amount)}</p>
                          <Badge color={badgeColor} className="mt-1 text-[10px] px-1.5 py-0">
                            {badgeText}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-12 flex items-center justify-center text-gray-500 text-sm">
                  Nenhuma conta próxima pendente.
                </div>
              )}
            </div>
          </div>

          {dashboardData.upcomingBills.length > 0 && (
            <Button variant="ghost" className="w-full mt-4 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900" size="sm" onClick={() => router.push('/lancamentos')}>
              Ver Todas
            </Button>
          )}
        </GlassCard>
      </div>

      {/* Row 2: Mapa de Calor de Gastos Diários (Calendário) */}
      <DailyExpenseHeatmap 
        monthFilter={filterMonth}
        transactions={dashboardData.monthlyTransactions}
        totalExpense={dashboardData.monthlyExpense}
        totalIncome={dashboardData.monthlyIncome}
      />

      {/* Row 3: Top 5 Despesas (1 col - Left) + Despesas por Categoria (2 cols - Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Top 5 Despesas (1 col - Left, exactly like Production Example Image 3) */}
        <GlassCard className="p-6 flex flex-col justify-between h-full">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top 5 Despesas</h3>
              <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setExpenseTab('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${expenseTab === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseTab('fixed')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${expenseTab === 'fixed' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
                >
                  Fixas
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseTab('variable')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${expenseTab === 'variable' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
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
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out" 
                        style={{ width: `${Math.max(2, expense.percentage)}%`, backgroundColor: expense.color }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm py-12">
                  Nenhuma despesa para listar.
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Despesas por Categoria (2 cols - Right, exactly like Production Example Image 3) */}
        <GlassCard className="p-6 lg:col-span-2 space-y-6 flex flex-col justify-between h-full">
          <div>
            {/* Donut Chart & Category Breakdown Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-full sm:w-1/2 flex flex-col items-center justify-center">
                <div className="h-52 w-52 relative flex items-center justify-center">
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
                          TOTAL GASTO
                        </span>
                        <span className="text-xl font-extrabold text-gray-900 dark:text-white">
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

              <div className="w-full sm:w-1/2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 inline-flex items-center gap-1">
                    <Icon name="donut_large" size="sm" /> Despesas
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Despesas por categoria
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Visão detalhada do seu fluxo de caixa mensal
                </p>
              </div>
            </div>

            {/* Category Rows List */}
            <div className="space-y-3 pt-4 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {dashboardData.expensesByCategory.categoryList && dashboardData.expensesByCategory.categoryList.length > 0 ? (
                dashboardData.expensesByCategory.categoryList.map((cat: any, idx: number) => {
                  const isExpanded = expandedCategory === cat.name;

                  return (
                    <div key={idx} className="bg-gray-50/70 dark:bg-gray-800/40 rounded-2xl p-4 transition-all hover:bg-gray-100/70 dark:hover:bg-gray-800/70 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50 space-y-2">
                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                          >
                            <Icon name={cat.icon || 'category'} className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{cat.name}</p>
                            <p className="text-[11px] text-gray-400">
                              {cat.transactions.length} {cat.transactions.length === 1 ? 'lançamento' : 'lançamentos'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-gray-900 dark:text-white text-sm block">
                            {formatCurrency(cat.total)}
                          </span>
                          <button 
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg"
                          >
                            <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size="sm" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar (Category Share) */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-200/80 dark:bg-gray-700/60 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ 
                              width: `${Math.max(2, cat.percentage)}%`,
                              backgroundColor: cat.color
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 w-12 text-right">
                          {cat.percentage}%
                        </span>
                      </div>

                      {/* Expandable Transaction Details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
                          {cat.transactions.map((tx: any, tIdx: number) => (
                            <div key={tIdx} className="flex justify-between items-center text-xs py-1">
                              <span className="text-gray-700 dark:text-gray-300 font-medium truncate pr-2">
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
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  Nenhuma despesa registrada para o mês selecionado.
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
