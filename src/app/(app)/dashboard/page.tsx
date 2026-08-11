'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { Bar, Doughnut } from 'react-chartjs-2';
import { useDashboard } from '@/hooks/useDashboard';

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex gap-2">
          <div className="w-48">
            <Select 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              options={[
                // Generate last 6 months, current, and next 6 months dynamically
                ...Array.from({length: 13}, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - 6 + i);
                  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
                  return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
                })
              ]} 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-900/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-sm">
              <Icon name="account_balance_wallet" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-blue-100 font-medium">Saldo Atual</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(dashboardData.totalBalance)}</h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-900/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-sm">
              <Icon name="trending_up" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-emerald-100 font-medium">Receitas (Mês)</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(dashboardData.monthlyIncome)}</h2>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 bg-gradient-to-br from-rose-500 to-red-600 shadow-xl shadow-red-900/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-sm">
              <Icon name="trending_down" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-rose-100 font-medium">Despesas (Mês)</p>
              <h2 className="text-2xl font-bold text-white">{formatCurrency(dashboardData.monthlyExpense)}</h2>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl p-6 bg-gradient-to-br shadow-xl ${dashboardData.monthlyIncome - dashboardData.monthlyExpense >= 0 ? 'from-cyan-500 to-blue-500 shadow-cyan-900/20' : 'from-orange-500 to-red-500 shadow-orange-900/20'}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-sm">
              <Icon name="account_balance" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-white/80 font-medium">Balanço (Mês)</p>
              <h2 className="text-2xl font-bold text-white">
                {formatCurrency(dashboardData.monthlyIncome - dashboardData.monthlyExpense)}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Linha 1: Receitas vs Despesas (2 cols) + Próximas Contas (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receitas vs Despesas (Últimos 6 meses)</h3>
          <div className="h-72">
            <Bar 
              data={{
                ...dashboardData.chartData,
                datasets: dashboardData.chartData.datasets.map((d: any) => ({
                  ...d,
                  borderRadius: 6,
                  borderSkipped: false,
                  barThickness: 16
                }))
              }} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false } },
                  y: { grid: { color: 'rgba(150, 150, 150, 0.1)' }, border: { display: false } }
                }
              }} 
            />
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Próximas Contas</h3>
          <div className="flex-1 overflow-auto">
            {dashboardData.upcomingBills.length > 0 ? (
              <ul className="space-y-4">
                {dashboardData.upcomingBills.map(bill => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const billDate = new Date(bill.date + 'T00:00:00');
                  
                  // Difference in days
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
                    <li key={bill.id} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
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
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                Nenhuma conta próxima pendente.
              </div>
            )}
          </div>
          {dashboardData.upcomingBills.length > 0 && (
            <Button variant="ghost" className="w-full mt-4 text-sm" size="sm" onClick={() => router.push('/lancamentos')}>
              Ver Todas
            </Button>
          )}
        </GlassCard>
      </div>
      
      {/* Linha 2: Top 5 Despesas (1 col) + Despesas por Categoria (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top 5 Despesas</h3>
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

          <div className="space-y-5">
            {(() => {
              const filtered = (dashboardData.topExpenses || []).filter((e: any) => {
                if (expenseTab === 'all') return true;
                if (expenseTab === 'fixed') return e.isFixed;
                return !e.isFixed;
              });
              
              const overallMonthlyExpense = dashboardData.monthlyExpense || 1;
              const displayed = filtered.slice(0, 5).map((e: any) => ({
                ...e,
                percentage: Math.round((e.amount / overallMonthlyExpense) * 100)
              }));

              return displayed.length > 0 ? (
                displayed.map((expense, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate pr-4">{expense.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.max(1, expense.percentage)}%`, backgroundColor: expense.color }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm py-12">
                  Nenhuma despesa para listar.
                </div>
              );
            })()}
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2 space-y-6">
          {/* Header & Center Text Donut Chart */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="w-full sm:w-1/2 flex flex-col items-center justify-center">
              <div className="h-56 w-56 relative flex items-center justify-center">
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
                    {/* Overlay Text in Center */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                      <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
                        TOTAL GASTO
                      </span>
                      <span className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
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

            {/* Title & Overview Info */}
            <div className="w-full sm:w-1/2 space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 inline-flex items-center gap-1">
                <Icon name="donut_large" size="sm" /> Despesas
              </span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Despesas por categoria
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Visão detalhada do seu fluxo de caixa mensal
              </p>
            </div>
          </div>

          {/* Category Rows List with Scroll Area */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800 max-h-[360px] overflow-y-auto pr-1">
            {dashboardData.expensesByCategory.categoryList && dashboardData.expensesByCategory.categoryList.length > 0 ? (
              dashboardData.expensesByCategory.categoryList.map((cat: any, idx: number) => {
                const isExpanded = expandedCategory === cat.name;
                return (
                  <div key={idx} className="bg-gray-50/70 dark:bg-gray-800/40 rounded-2xl p-4 transition-all">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-3 mb-2">
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
                        <span className="font-extrabold text-gray-900 dark:text-white text-sm">
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

                    {/* Progress Bar & Percentage */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200/80 dark:bg-gray-700/60 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(2, cat.percentage)}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300 w-12 text-right">
                        {cat.percentage}%
                      </span>
                    </div>

                    {/* Expandable Transaction Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
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
        </GlassCard>
      </div>
    </div>
  );
}
