'use client';

import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { GlassCard } from '@/components/ui/GlassCard';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { CreditCard } from '@/hooks/useCreditCards';
import { Transaction } from '@/hooks/useTransactions';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CreditCardEvolutionChartProps {
  creditCards: CreditCard[];
  transactions: Transaction[];
}

export function CreditCardEvolutionChart({ creditCards, transactions }: CreditCardEvolutionChartProps) {
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<string>('future-installments');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Compute maximum future month from transactions
  const maxFutureMonthKey = useMemo(() => {
    let maxKey = '';
    const todayKey = new Date().toISOString().substring(0, 7);
    maxKey = todayKey;

    transactions.forEach(t => {
      if (t.type !== 'despesa') return;
      if (!t.credit_card_id) return;
      if (selectedCardId !== 'all' && t.credit_card_id !== selectedCardId) return;

      const key = t.date.substring(0, 7);
      if (key > maxKey) {
        maxKey = key;
      }
    });

    return maxKey;
  }, [transactions, selectedCardId]);

  // Generate monthly data based on viewMode
  const chartInfo = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    let startOffset = 0; // relative to current month (negative = past)
    let endOffset = 0;   // relative to current month (positive = future)

    if (viewMode === 'past-6') {
      startOffset = -5;
      endOffset = 0;
    } else if (viewMode === 'past-12') {
      startOffset = -11;
      endOffset = 0;
    } else if (viewMode === 'future-6') {
      startOffset = 0;
      endOffset = 5;
    } else if (viewMode === 'future-12') {
      startOffset = 0;
      endOffset = 11;
    } else if (viewMode === 'future-installments') {
      startOffset = 0;
      // Calculate months between current month and maxFutureMonthKey
      const [maxY, maxM] = maxFutureMonthKey.split('-').map(Number);
      const diffMonths = (maxY - currentYear) * 12 + (maxM - 1 - currentMonth);
      endOffset = Math.max(diffMonths, 5); // At least 6 months into the future
    } else if (viewMode === 'all-timeline') {
      startOffset = -5; // 6 months in past
      const [maxY, maxM] = maxFutureMonthKey.split('-').map(Number);
      const diffMonths = (maxY - currentYear) * 12 + (maxM - 1 - currentMonth);
      endOffset = Math.max(diffMonths, 5);
    }

    const monthList: { label: string; key: string; total: number; isFuture: boolean; isCurrent: boolean }[] = [];

    for (let offset = startOffset; offset <= endOffset; offset++) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      const labelFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
      let formattedLabel = labelFormatter.format(d);
      formattedLabel = formattedLabel.charAt(0).toUpperCase() + formattedLabel.slice(1);

      const isFuture = key > currentMonthKey;
      const isCurrent = key === currentMonthKey;

      monthList.push({
        label: formattedLabel,
        key: key,
        total: 0,
        isFuture,
        isCurrent
      });
    }

    // Filter and sum transactions per month
    const cardMap = new Map(monthList.map(m => [m.key, 0]));

    transactions.forEach(t => {
      if (t.type !== 'despesa') return;
      if (!t.credit_card_id) return;
      if (selectedCardId !== 'all' && t.credit_card_id !== selectedCardId) return;

      const txKey = t.date.substring(0, 7); // YYYY-MM
      if (cardMap.has(txKey)) {
        const currentVal = cardMap.get(txKey) || 0;
        cardMap.set(txKey, currentVal + Number(t.amount));
      }
    });

    monthList.forEach(m => {
      m.total = cardMap.get(m.key) || 0;
    });

    const totals = monthList.map(m => m.total);
    const overallTotal = totals.reduce((acc, curr) => acc + curr, 0);
    const monthlyAverage = overallTotal / (monthList.length || 1);
    
    let peakMonth = { label: '-', total: 0 };
    monthList.forEach(m => {
      if (m.total > peakMonth.total) {
        peakMonth = { label: m.label, total: m.total };
      }
    });

    // Find date of last pending installment
    const lastInstallmentMonth = monthList.filter(m => m.total > 0).pop()?.label || '-';

    return {
      labels: monthList.map(m => m.label),
      totals,
      isFutureList: monthList.map(m => m.isFuture),
      isCurrentList: monthList.map(m => m.isCurrent),
      overallTotal,
      monthlyAverage,
      peakMonth,
      lastInstallmentMonth,
      totalMonths: monthList.length
    };
  }, [transactions, selectedCardId, viewMode, maxFutureMonthKey]);

  // Determine line color
  const selectedCard = creditCards.find(c => c.id === selectedCardId);
  const primaryColor = selectedCard ? selectedCard.color : '#8b5cf6'; // default purple

  const data = {
    labels: chartInfo.labels,
    datasets: [
      {
        label: selectedCard ? `Faturas (${selectedCard.name})` : 'Faturas de Cartão (Projeção)',
        data: chartInfo.totals,
        borderColor: primaryColor,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, `${primaryColor}35`); // 20% opacity
          gradient.addColorStop(1, `${primaryColor}00`); // transparent
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointBackgroundColor: (ctx: any) => {
          const index = ctx.dataIndex;
          if (chartInfo.isCurrentList[index]) return '#f59e0b'; // Amber highlight for current month
          return primaryColor;
        },
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => {
          const index = ctx.dataIndex;
          if (chartInfo.isCurrentList[index]) return 7;
          return 5;
        },
        pointHoverRadius: 8,
        segment: {
          borderDash: (ctx: any) => {
            // Dashed line segment for future months
            const p1Index = ctx.p1DataIndex;
            if (chartInfo.isFutureList[p1Index]) {
              return [6, 6];
            }
            return undefined;
          }
        }
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#9ca3af',
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: '500'
          },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#f3f4f6',
        padding: 12,
        borderRadius: 12,
        boxPadding: 6,
        callbacks: {
          title: (items: any[]) => {
            if (!items.length) return '';
            const idx = items[0].dataIndex;
            const label = items[0].label;
            if (chartInfo.isCurrentList[idx]) {
              return `${label} • Mês Atual`;
            }
            if (chartInfo.isFutureList[idx]) {
              return `${label} • Fatura Prevista (Futuro)`;
            }
            return `${label} • Histórico`;
          },
          label: (context: any) => {
            const val = context.raw || 0;
            const idx = context.dataIndex;
            const statusStr = chartInfo.isFutureList[idx] ? '(Previsto)' : '(Realizado/Fatura)';
            return ` Fatura: ${formatCurrency(val)} ${statusStr}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          color: (ctx: any) => {
            const idx = ctx.index;
            if (chartInfo.isCurrentList[idx]) return '#f59e0b';
            if (chartInfo.isFutureList[idx]) return '#a855f7';
            return '#9ca3af';
          },
          font: (ctx: any) => {
            const idx = ctx.index;
            if (chartInfo.isCurrentList[idx]) return { size: 12, weight: 'bold' };
            return { size: 11 };
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 11
          },
          callback: (value: number) => {
            if (value >= 1000) {
              return `R$ ${(value / 1000).toFixed(1)}k`;
            }
            return `R$ ${value}`;
          }
        }
      }
    }
  };

  const cardSelectOptions = [
    { value: 'all', label: 'Todos os Cartões' },
    ...creditCards.map(c => ({ value: c.id, label: c.name }))
  ];

  const viewModeOptions = [
    { value: 'future-installments', label: '🚀 Futuro: Até a Última Parcela' },
    { value: 'all-timeline', label: '📊 Visão Completa: Passado + Futuro' },
    { value: 'future-6', label: '🔮 Futuro: Próximos 6 meses' },
    { value: 'future-12', label: '🔮 Futuro: Próximos 12 meses' },
    { value: 'past-6', label: '📜 Histórico: Últimos 6 meses' },
    { value: 'past-12', label: '📜 Histórico: Últimos 12 meses' }
  ];

  return (
    <GlassCard className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
              <Icon name="show_chart" className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Projeção & Evolução de Faturas</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Visualize seus gastos passados e projeções futuras até a quitação das parcelas
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
          <div className="w-full sm:w-48">
            <Select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              options={cardSelectOptions}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              options={viewModeOptions}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-y border-gray-200/50 dark:border-gray-800/50 py-4">
        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total no Período</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(chartInfo.overallTotal)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Média Mensal</p>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {formatCurrency(chartInfo.monthlyAverage)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Fatura de Pico</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(chartInfo.peakMonth.total)}
            {chartInfo.peakMonth.total > 0 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                ({chartInfo.peakMonth.label})
              </span>
            )}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Última Parcela Ativa</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {chartInfo.lastInstallmentMonth}
          </p>
        </div>
      </div>

      {/* Helper legend info */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-purple-500 inline-block"></span> Linha contínua: Histórico/Mês atual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-purple-500 inline-block"></span> Linha tracejada: Projeção de Parcelas Futuras
        </span>
      </div>

      {/* Chart Canvas Container */}
      <div className="h-[300px] w-full">
        <Line data={data} options={options} />
      </div>
    </GlassCard>
  );
}
