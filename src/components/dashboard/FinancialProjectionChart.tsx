'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Bar } from 'react-chartjs-2';

interface FinancialProjectionChartProps {
  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderRadius?: number;
      borderSkipped?: boolean;
    }[];
  };
}

export function FinancialProjectionChart({ chartData }: FinancialProjectionChartProps) {
  const formatYAxis = (value: number) => {
    if (value === 0) return 'R$ 0';
    if (Math.abs(value) >= 1000) {
      const kValue = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1);
      return `R$ ${kValue}k`;
    }
    return `R$ ${value}`;
  };

  const formatTooltipCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We render a custom visual legend at the top right to match the exact design
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.raw || 0;
            return ` ${label}: ${formatTooltipCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11,
            weight: '600'
          }
        },
        border: {
          display: false,
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          },
          callback: (value: any) => formatYAxis(Number(value))
        },
        border: {
          display: false,
        }
      }
    }
  };

  // Enhance dataset bar thickness & styling
  const styledData = {
    ...chartData,
    datasets: chartData.datasets.map(ds => ({
      ...ds,
      barThickness: 16,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
    }))
  };

  return (
    <GlassCard className="p-6 flex flex-col justify-between h-full">
      <div>
        {/* Header with Title and Custom Legends */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Icon name="insights" size="md" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Projeção Financeira</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Entradas, Saídas e Saldo comparativos (6 meses)</p>
            </div>
          </div>

          {/* Custom Legend Matching Screenshot */}
          <div className="flex items-center gap-4 text-xs font-medium text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Entradas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>Saídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span>Saldo</span>
            </div>
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div className="relative h-[340px] w-full">
          <Bar data={styledData} options={options} />
        </div>
      </div>
    </GlassCard>
  );
}
