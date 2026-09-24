'use client';

import React, { useState, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface DailyExpenseHeatmapProps {
  monthFilter: string; // 'YYYY-MM'
  transactions?: any[];
  totalExpense: number;
  totalIncome: number;
}

export function DailyExpenseHeatmap({
  monthFilter,
  transactions = [],
  totalExpense,
  totalIncome,
}: DailyExpenseHeatmapProps) {
  const [viewType, setViewType] = useState<'despesa' | 'receita'>('despesa');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Parse Year and Month
  const { year, monthIndex, monthName } = useMemo(() => {
    let y = new Date().getFullYear();
    let m = new Date().getMonth();
    if (monthFilter) {
      const parts = monthFilter.split('-');
      if (parts.length === 2) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
      }
    }
    const d = new Date(y, m, 1);
    const mName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
    return { year: y, monthIndex: m, monthName: mName.charAt(0).toUpperCase() + mName.slice(1) };
  }, [monthFilter]);

  // Calendar Geometry
  const { daysInMonth, firstDayOfWeek, calendarDays } = useMemo(() => {
    const daysCount = new Date(year, monthIndex + 1, 0).getDate();
    const firstDay = new Date(year, monthIndex, 1).getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb

    // Group transactions by day
    const dayMap: Record<number, { total: number; transactions: any[] }> = {};
    for (let i = 1; i <= daysCount; i++) {
      dayMap[i] = { total: 0, transactions: [] };
    }

    transactions.forEach((t) => {
      if (t.type !== viewType) return;
      if (!t.date) return;
      const tDate = new Date(t.date + 'T12:00:00');
      if (tDate.getFullYear() === year && tDate.getMonth() === monthIndex) {
        const dayNum = tDate.getDate();
        if (dayMap[dayNum]) {
          dayMap[dayNum].total += Number(t.amount) || 0;
          dayMap[dayNum].transactions.push(t);
        }
      }
    });

    // Compute max amount
    let maxAmount = 0;
    let maxDayNum: number | null = null;
    let activeDaysCount = 0;
    let totalComputed = 0;

    for (let d = 1; d <= daysCount; d++) {
      const dayTotal = dayMap[d].total;
      if (dayTotal > 0) {
        activeDaysCount++;
        totalComputed += dayTotal;
        if (dayTotal > maxAmount) {
          maxAmount = dayTotal;
          maxDayNum = d;
        }
      }
    }

    return {
      daysInMonth: daysCount,
      firstDayOfWeek: firstDay,
      calendarDays: dayMap,
      maxAmount,
      maxDayNum,
      activeDaysCount,
      totalComputed,
      zeroDaysCount: daysCount - activeDaysCount,
      dailyAverage: activeDaysCount > 0 ? totalComputed / activeDaysCount : 0,
    };
  }, [year, monthIndex, transactions, viewType]);

  const { maxAmount, maxDayNum, activeDaysCount, totalComputed, zeroDaysCount, dailyAverage } = useMemo(() => {
    const daysCount = new Date(year, monthIndex + 1, 0).getDate();
    let maxAmt = 0;
    let maxDay: number | null = null;
    let activeDays = 0;
    let total = 0;

    for (let d = 1; d <= daysCount; d++) {
      const val = calendarDays[d]?.total || 0;
      if (val > 0) {
        activeDays++;
        total += val;
        if (val > maxAmt) {
          maxAmt = val;
          maxDay = d;
        }
      }
    }

    return {
      maxAmount: maxAmt,
      maxDayNum: maxDay,
      activeDaysCount: activeDays,
      totalComputed: total,
      zeroDaysCount: daysCount - activeDays,
      dailyAverage: activeDays > 0 ? total / activeDays : 0,
    };
  }, [year, monthIndex, calendarDays]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatCompactValue = (val: number) => {
    if (!val || val === 0) return '-';
    if (val >= 1_000_000) {
      const formatted = (val / 1_000_000).toFixed(1).replace('.', ',');
      return `R$ ${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted}M`;
    }
    if (val >= 1_000) {
      const formatted = (val / 1_000).toFixed(1).replace('.', ',');
      return `R$ ${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted}mil`;
    }
    return `R$ ${Math.round(val).toLocaleString('pt-BR')}`;
  };

  const isDespesa = viewType === 'despesa';

  const getHeatmapColorClass = (amount: number) => {
    if (!amount || amount === 0) {
      return 'bg-gray-50/70 dark:bg-gray-800/30 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-800/60 hover:bg-gray-100/70 dark:hover:bg-gray-800/60';
    }

    const ratio = maxAmount > 0 ? amount / maxAmount : 0;

    if (isDespesa) {
      if (ratio < 0.15) {
        return 'bg-rose-50/90 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-100 dark:border-rose-900/40 hover:bg-rose-100/80';
      }
      if (ratio < 0.45) {
        return 'bg-rose-100/95 dark:bg-rose-900/40 text-rose-950 dark:text-rose-100 border-rose-200 dark:border-rose-800/50 hover:bg-rose-200/90';
      }
      if (ratio < 0.75) {
        return 'bg-rose-200 dark:bg-rose-800/60 text-rose-950 dark:text-rose-50 border-rose-300 dark:border-rose-700/60 font-semibold hover:bg-rose-300/80';
      }
      return 'bg-gradient-to-br from-rose-400 to-rose-500 text-white dark:from-rose-600 dark:to-rose-700 border-rose-400 shadow-sm font-bold hover:brightness-105';
    } else {
      if (ratio < 0.15) {
        return 'bg-emerald-50/90 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100/80';
      }
      if (ratio < 0.45) {
        return 'bg-emerald-100/95 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-200/90';
      }
      if (ratio < 0.75) {
        return 'bg-emerald-200 dark:bg-emerald-800/60 text-emerald-950 dark:text-emerald-50 border-emerald-300 dark:border-emerald-700/60 font-semibold hover:bg-emerald-300/80';
      }
      return 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white dark:from-emerald-600 dark:to-emerald-700 border-emerald-400 shadow-sm font-bold hover:brightness-105';
    }
  };

  const selectedDayData = selectedDay ? calendarDays[selectedDay] : null;

  return (
    <GlassCard className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {isDespesa ? 'Saídas por dia' : 'Entradas por dia'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {monthName.toLowerCase()} · quanto {isDespesa ? 'saiu' : 'entrou'} em cada dia
          </p>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {formatCurrency(isDespesa ? totalExpense : totalIncome)}
            </span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              em {activeDaysCount} {activeDaysCount === 1 ? 'dia' : 'dias'} com {isDespesa ? 'saída' : 'entrada'}
            </span>
          </div>
        </div>

        {/* Type Switcher (Saídas / Entradas) */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-center">
          <button
            type="button"
            onClick={() => setViewType('despesa')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              isDespesa
                ? 'bg-white dark:bg-gray-700 text-rose-600 dark:text-rose-400 shadow-sm font-bold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="trending_down" size="sm" />
            Saídas
          </button>
          <button
            type="button"
            onClick={() => setViewType('receita')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              !isDespesa
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="trending_up" size="sm" />
            Entradas
          </button>
        </div>
      </div>

      {/* Calendar Matrix */}
      <div className="space-y-2">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-1">
          <div>DOM</div>
          <div>SEG</div>
          <div>TER</div>
          <div>QUA</div>
          <div>QUI</div>
          <div>SEX</div>
          <div>SÁB</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Empty offset slots before 1st day of the month */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[58px] sm:min-h-[70px] rounded-xl sm:rounded-2xl opacity-0 pointer-events-none" />
          ))}

          {/* Actual days of month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayData = calendarDays[dayNum];
            const amount = dayData?.total || 0;
            const isHighest = maxDayNum === dayNum && amount > 0;
            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === monthIndex &&
              new Date().getDate() === dayNum;

            return (
              <button
                key={`day-${dayNum}`}
                type="button"
                onClick={() => setSelectedDay(dayNum)}
                className={`group relative min-h-[58px] sm:min-h-[70px] p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-between text-left cursor-pointer hover:scale-[1.03] active:scale-95 ${getHeatmapColorClass(
                  amount
                )} ${
                  isToday ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-gray-900' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold opacity-90">{dayNum}</span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Hoje" />
                  )}
                </div>

                <div className="mt-auto">
                  <span
                    className={`text-[10px] sm:text-xs tracking-tight truncate block ${
                      amount > 0 ? 'font-bold' : 'opacity-60'
                    }`}
                  >
                    {formatCompactValue(amount)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Metrics and helper hint */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-4 sm:gap-8">
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              MÉDIA POR DIA
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {formatCurrency(dailyAverage)}
            </p>
          </div>

          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              MAIOR DIA
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {maxDayNum && maxAmount > 0
                ? `${String(maxDayNum).padStart(2, '0')}/${String(monthIndex + 1).padStart(2, '0')} - ${formatCompactValue(maxAmount)}`
                : '-'}
            </p>
          </div>

          <div>
            <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              DIAS SEM {isDespesa ? 'SAÍDA' : 'ENTRADA'}
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {zeroDaysCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 italic">
          <Icon name="touch_app" size="sm" className="text-gray-400" />
          <span>Toque num dia para ver as transações</span>
        </div>
      </div>

      {/* Modal for Selected Day Transactions */}
      <Modal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? `${String(selectedDay).padStart(2, '0')} de ${monthName} · ${
                isDespesa ? 'Saídas' : 'Entradas'
              }`
            : 'Transações do dia'
        }
        size="lg"
      >
        {selectedDay && (
          <div className="space-y-4">
            {/* Day Summary Banner */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total do dia</p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(selectedDayData?.total || 0)}
                </h4>
              </div>
              <Badge color={isDespesa ? 'red' : 'green'}>
                {selectedDayData?.transactions.length || 0}{' '}
                {selectedDayData?.transactions.length === 1 ? 'transação' : 'transações'}
              </Badge>
            </div>

            {/* List of Transactions */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {selectedDayData && selectedDayData.transactions.length > 0 ? (
                selectedDayData.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                        style={{
                          backgroundColor: `${tx.category?.color || '#ef4444'}20`,
                          color: tx.category?.color || '#ef4444',
                        }}
                      >
                        <Icon name={tx.category?.icon || (isDespesa ? 'receipt' : 'payments')} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{tx.category?.name || 'Geral'}</span>
                          {tx.credit_card && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Icon name="credit_card" className="text-[12px]" />
                                {tx.credit_card.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`font-bold text-sm ${
                          isDespesa ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isDespesa ? '-' : '+'}
                        {formatCurrency(Number(tx.amount))}
                      </p>
                      <Badge
                        color={tx.status === 'pago' ? 'green' : 'yellow'}
                        className="text-[10px] px-1.5 py-0 mt-1"
                      >
                        {tx.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-400 italic">
                  Nenhuma transação registrada neste dia.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </GlassCard>
  );
}
