'use client';

import React, { useState, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bar } from 'react-chartjs-2';
import { ProjectionMonth } from '@/hooks/useDashboard';

type ProjectionRange = '6m' | '12m' | '2027' | 'max';

interface FinancialProjectionChartProps {
  chartData?: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderRadius?: number;
      borderSkipped?: boolean;
    }[];
  };
  projectionMonths?: ProjectionMonth[];
  currentBalance?: number;
}

export function FinancialProjectionChart({ 
  chartData, 
  projectionMonths = [], 
  currentBalance = 0 
}: FinancialProjectionChartProps) {
  const [range, setRange] = useState<ProjectionRange>('6m');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showAccumulatedLine, setShowAccumulatedLine] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatYAxis = (value: number) => {
    if (value === 0) return 'R$ 0';
    if (Math.abs(value) >= 1000) {
      const kValue = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1);
      return `R$ ${kValue}k`;
    }
    return `R$ ${value}`;
  };

  // Filtrar meses de acordo com o range selecionado
  const filteredMonths = useMemo(() => {
    if (!projectionMonths || projectionMonths.length === 0) return [];

    const selectedIdx = projectionMonths.findIndex(m => m.isSelected);
    const baseIdx = selectedIdx >= 0 ? selectedIdx : projectionMonths.findIndex(m => m.isCurrent);
    const startIdx = baseIdx >= 0 ? baseIdx : 0;

    if (range === '6m') {
      // 2 meses antes do selecionado + 4 meses à frente (6 meses total)
      const from = Math.max(0, startIdx - 2);
      return projectionMonths.slice(from, from + 6);
    }

    if (range === '12m') {
      // Mês selecionado + 11 meses à frente (1 ano)
      const from = Math.max(0, startIdx - 1);
      return projectionMonths.slice(from, from + 12);
    }

    if (range === '2027') {
      // Desde o mês atual até o final de 2027
      const from = Math.max(0, startIdx - 1);
      return projectionMonths.filter((m, idx) => idx >= from && (m.year <= 2027));
    }

    // range === 'max'
    // Apenas meses a partir de 2 meses no passado até o último mês com movimentação
    let lastActiveIdx = projectionMonths.length - 1;
    for (let i = projectionMonths.length - 1; i >= 0; i--) {
      if (projectionMonths[i].income > 0 || projectionMonths[i].expense > 0) {
        lastActiveIdx = i;
        break;
      }
    }
    const from = Math.max(0, startIdx - 2);
    return projectionMonths.slice(from, Math.max(from + 6, lastActiveIdx + 1));
  }, [projectionMonths, range]);

  // Montar dados para o gráfico Bar
  const activeChartData = useMemo(() => {
    if (filteredMonths.length === 0 && chartData) {
      return {
        ...chartData,
        datasets: chartData.datasets.map(ds => ({
          ...ds,
          barThickness: 16,
          categoryPercentage: 0.7,
          barPercentage: 0.8,
        }))
      };
    }

    const labels = filteredMonths.map(m => m.label);
    const incomes = filteredMonths.map(m => m.income);
    const expenses = filteredMonths.map(m => m.expense);
    const balances = filteredMonths.map(m => m.balance);

    // Ajustar espessura das barras dinamicamente dependendo do número de meses
    const barThickness = filteredMonths.length > 12 ? 8 : (filteredMonths.length > 8 ? 12 : 16);

    const datasets: any[] = [
      {
        label: 'Entradas',
        data: incomes,
        backgroundColor: '#10b981', // Emerald green
        borderRadius: 6,
        borderSkipped: false,
        barThickness,
        categoryPercentage: 0.7,
        barPercentage: 0.8,
      },
      {
        label: 'Saídas',
        data: expenses,
        backgroundColor: '#ef4444', // Red
        borderRadius: 6,
        borderSkipped: false,
        barThickness,
        categoryPercentage: 0.7,
        barPercentage: 0.8,
      },
      {
        label: 'Saldo',
        data: balances,
        backgroundColor: '#3b82f6', // Blue
        borderRadius: 6,
        borderSkipped: false,
        barThickness,
        categoryPercentage: 0.7,
        barPercentage: 0.8,
      }
    ];

    if (showAccumulatedLine) {
      datasets.push({
        type: 'line',
        label: 'Saldo Acumulado',
        data: filteredMonths.map(m => m.accumulatedBalance),
        borderColor: '#a855f7',
        backgroundColor: '#a855f7',
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 4,
        fill: false,
      });
    }

    return { labels, datasets };
  }, [filteredMonths, chartData, showAccumulatedLine]);

  // Totais do período selecionado
  const periodTotals = useMemo(() => {
    const totalIncome = filteredMonths.reduce((acc, m) => acc + m.income, 0);
    const totalExpense = filteredMonths.reduce((acc, m) => acc + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const finalAccumulated = filteredMonths.length > 0 ? filteredMonths[filteredMonths.length - 1].accumulatedBalance : currentBalance;

    return { totalIncome, totalExpense, totalBalance, finalAccumulated };
  }, [filteredMonths, currentBalance]);

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
            return ` ${label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: {
            size: filteredMonths.length > 12 ? 9 : 11,
            weight: '600'
          }
        },
        border: { display: false }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value: any) => formatYAxis(Number(value))
        },
        border: { display: false }
      }
    }
  };

  const getSubtitle = () => {
    switch (range) {
      case '6m': return 'Comparativo de 6 meses ao redor do mês selecionado';
      case '12m': return 'Visão anual de 12 meses consecutivos';
      case '2027': return 'Projeção completa até o final de 2027';
      case 'max': return `Visão completa de todas as ${filteredMonths.length} parcelas / meses cadastrados`;
    }
  };

  return (
    <>
      <GlassCard className="p-6 flex flex-col justify-between h-full">
        <div>
          {/* Header with Title, Range Selector & Custom Legends */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Icon name="insights" size="md" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Projeção Financeira
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                    {range === '6m' ? '6 Meses' : range === '12m' ? '12 Meses' : range === '2027' ? 'Até 2027' : 'Máximo'}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{getSubtitle()}</p>
              </div>
            </div>

            {/* Range Selector & Expand Button */}
            <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end flex-wrap">
              {/* Pills Selector */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRange('6m')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    range === '6m' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  6M
                </button>
                <button
                  type="button"
                  onClick={() => setRange('12m')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    range === '12m' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  12M
                </button>
                <button
                  type="button"
                  onClick={() => setRange('2027')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    range === '2027' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  2027
                </button>
                <button
                  type="button"
                  onClick={() => setRange('max')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    range === 'max' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Máx
                </button>
              </div>

              {/* Botão de Expansão Detalhada */}
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(true)}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                title="Abrir Relatório Detalhado de Projeção"
              >
                <Icon name="open_in_full" size="sm" />
              </button>
            </div>
          </div>

          {/* Custom Legends */}
          <div className="flex items-center justify-end gap-4 text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
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

          {/* Chart Canvas Area */}
          <div className="relative h-[340px] w-full">
            <Bar data={activeChartData} options={options} />
          </div>
        </div>
      </GlassCard>

      {/* Modal - Visão Expandida e Detalhada de Projeção */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Projeção Financeira Detalhada & Fluxo Futuro"
      >
        <div className="space-y-6">
          {/* Controles de Período no Modal */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Horizonte:</span>
              <div className="flex bg-white dark:bg-gray-900 p-1 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setRange('6m')}
                  className={`px-3 py-1 rounded-lg transition-all ${range === '6m' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500'}`}
                >
                  6 Meses
                </button>
                <button
                  type="button"
                  onClick={() => setRange('12m')}
                  className={`px-3 py-1 rounded-lg transition-all ${range === '12m' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500'}`}
                >
                  12 Meses (1 Ano)
                </button>
                <button
                  type="button"
                  onClick={() => setRange('2027')}
                  className={`px-3 py-1 rounded-lg transition-all ${range === '2027' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500'}`}
                >
                  Até Dez/2027
                </button>
                <button
                  type="button"
                  onClick={() => setRange('max')}
                  className={`px-3 py-1 rounded-lg transition-all ${range === 'max' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500'}`}
                >
                  Todas as Parcelas
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAccumulatedLine}
                onChange={(e) => setShowAccumulatedLine(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <span>Mostrar Linha de Saldo Acumulado</span>
            </label>
          </div>

          {/* Cards Resumo do Período */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Total Receitas</p>
              <p className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                {formatCurrency(periodTotals.totalIncome)}
              </p>
            </div>
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl">
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Total Despesas/Faturas</p>
              <p className="text-base font-bold text-rose-800 dark:text-rose-200 mt-0.5">
                {formatCurrency(periodTotals.totalExpense)}
              </p>
            </div>
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Balanço Líquido</p>
              <p className={`text-base font-bold mt-0.5 ${periodTotals.totalBalance >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-600'}`}>
                {formatCurrency(periodTotals.totalBalance)}
              </p>
            </div>
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
              <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">Saldo Estimado ao Final</p>
              <p className="text-base font-bold text-purple-800 dark:text-purple-200 mt-0.5">
                {formatCurrency(periodTotals.finalAccumulated)}
              </p>
            </div>
          </div>

          {/* Gráfico Expandido */}
          <div className="h-[280px] w-full bg-white dark:bg-gray-900/60 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
            <Bar data={activeChartData} options={options} />
          </div>

          {/* Tabela de Detalhamento Mês a Mês */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Detalhamento Mês a Mês ({filteredMonths.length} meses)
            </h4>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 sticky top-0 font-bold">
                  <tr>
                    <th className="p-3">Mês / Ano</th>
                    <th className="p-3 text-right">Entradas</th>
                    <th className="p-3 text-right">Saídas</th>
                    <th className="p-3 text-right">Resultado</th>
                    <th className="p-3 text-right">Saldo Projetado</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredMonths.map((m) => (
                    <tr 
                      key={m.key} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                        m.isCurrent ? 'bg-amber-500/10 dark:bg-amber-950/20 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 text-gray-900 dark:text-white flex items-center gap-1.5">
                        {m.isCurrent && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                        {m.fullLabel}
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{formatCurrency(m.income)}</td>
                      <td className="p-3 text-right text-rose-600 font-semibold">{formatCurrency(m.expense)}</td>
                      <td className={`p-3 text-right font-bold ${m.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.balance >= 0 ? '+' : ''}{formatCurrency(m.balance)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                        {formatCurrency(m.accumulatedBalance)}
                      </td>
                      <td className="p-3 text-center">
                        {m.isPast ? (
                          <Badge color="gray">Passado</Badge>
                        ) : m.isCurrent ? (
                          <Badge color="yellow">Atual</Badge>
                        ) : m.balance >= 0 ? (
                          <Badge color="green">Superávit</Badge>
                        ) : (
                          <Badge color="red">Déficit</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
