'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useInvestments } from '@/hooks/useInvestments';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function InvestmentsPage() {
  const {
    investments,
    types,
    loading,
    error: loadError,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addInvestmentEntry
  } = useInvestments();

  // Modals state
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [invForm, setInvForm] = useState({
    name: '',
    type_id: '',
    institution: '',
    initial_amount: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: ''
  });

  const [entryForm, setEntryForm] = useState({
    type: 'aporte' as 'aporte' | 'resgate' | 'rendimento',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Overall Portfolio Calculations
  const totalInvested = investments.reduce((acc, curr) => acc + Number(curr.total_invested), 0);
  const totalCurrent = investments.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalYield = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Due date / Liquidity calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const lockedInvestments = investments.filter(i => i.due_date && i.due_date > todayStr);
  const totalLocked = lockedInvestments.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  const totalLiquid = totalCurrent - totalLocked;

  // Breakdown by Investment Type (for Doughnut chart & list)
  const typeAgg: { [key: string]: { name: string; icon: string; color: string; total: number; count: number } } = {};
  investments.forEach(inv => {
    const typeName = inv.investment_type?.name || 'Outros';
    const color = inv.investment_type?.color || '#3b82f6';
    const icon = inv.investment_type?.icon || 'account_balance_wallet';
    const balance = Number(inv.current_balance) || 0;

    if (!typeAgg[typeName]) {
      typeAgg[typeName] = { name: typeName, icon, color, total: 0, count: 0 };
    }
    typeAgg[typeName].total += balance;
    typeAgg[typeName].count += 1;
  });

  const typeList = Object.values(typeAgg).map(t => ({
    ...t,
    percentage: totalCurrent > 0 ? Number(((t.total / totalCurrent) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  const doughnutChartData = {
    labels: typeList.map(t => t.name),
    datasets: [
      {
        data: typeList.map(t => t.total),
        backgroundColor: typeList.map(t => t.color),
        borderWidth: 0,
      }
    ]
  };

  // Breakdown by Financial Institution (Banks/Brokers)
  const instAgg: { [key: string]: { name: string; total: number; count: number } } = {};
  investments.forEach(inv => {
    const instName = inv.institution?.trim() || 'Sem Instituição';
    const balance = Number(inv.current_balance) || 0;

    if (!instAgg[instName]) {
      instAgg[instName] = { name: instName, total: 0, count: 0 };
    }
    instAgg[instName].total += balance;
    instAgg[instName].count += 1;
  });

  const instList = Object.values(instAgg).map(i => ({
    ...i,
    percentage: totalCurrent > 0 ? Number(((i.total / totalCurrent) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  // Modal Open Handlers
  const handleOpenInvModal = (invToEdit?: typeof investments[0]) => {
    setFormError('');
    if (invToEdit) {
      setEditingInvId(invToEdit.id);
      setInvForm({
        name: invToEdit.name,
        type_id: invToEdit.type_id || (types.length > 0 ? types[0].id : ''),
        institution: invToEdit.institution || '',
        initial_amount: '',
        date: new Date().toISOString().split('T')[0],
        due_date: invToEdit.due_date || '',
        notes: invToEdit.notes || ''
      });
    } else {
      setEditingInvId(null);
      setInvForm({
        name: '',
        type_id: types.length > 0 ? types[0].id : '',
        institution: '',
        initial_amount: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
      });
    }
    setIsInvModalOpen(true);
  };

  const handleOpenEntryModal = (investmentId: string) => {
    setFormError('');
    setSelectedInvId(investmentId);
    setEntryForm({
      type: 'aporte',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsEntryModalOpen(true);
  };

  // Form Submission Handlers
  const handleSaveInvestment = async () => {
    if (!invForm.name || !invForm.type_id) {
      setFormError('Por favor, preencha o nome do ativo e selecione o tipo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    let success = false;
    if (editingInvId) {
      success = await updateInvestment(editingInvId, {
        name: invForm.name,
        type_id: invForm.type_id,
        institution: invForm.institution,
        due_date: invForm.due_date || null,
        notes: invForm.notes
      });
    } else {
      success = await addInvestment({
        name: invForm.name,
        type_id: invForm.type_id,
        institution: invForm.institution,
        initial_amount: invForm.initial_amount ? parseFloat(invForm.initial_amount.replace(',', '.')) : 0,
        date: invForm.date,
        due_date: invForm.due_date || undefined,
        notes: invForm.notes
      });
    }

    setIsSubmitting(false);
    if (success) {
      setIsInvModalOpen(false);
    } else {
      setFormError('Erro ao salvar investimento. Tente novamente.');
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este investimento e seu histórico de movimentações?')) {
      await deleteInvestment(id);
    }
  };

  const handleAddEntry = async () => {
    if (!selectedInvId || !entryForm.amount) {
      setFormError('Por favor, preencha o valor da movimentação.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addInvestmentEntry({
      investment_id: selectedInvId,
      type: entryForm.type,
      amount: parseFloat(entryForm.amount.replace(',', '.')),
      date: entryForm.date,
      notes: entryForm.notes
    });

    setIsSubmitting(false);
    if (success) {
      setIsEntryModalOpen(false);
    } else {
      setFormError('Erro ao registrar movimentação. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard de Investimentos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Visão consolidada do seu patrimônio, rentabilidade e alocação de ativos
          </p>
        </div>
        <Button variant="primary" onClick={() => handleOpenInvModal()}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Novo Investimento
        </Button>
      </div>

      {loadError && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {loadError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Patrimony */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patrimônio Total</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Icon name="account_balance_wallet" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <span className={`font-semibold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)} ({totalYield.toFixed(2)}%)
              </span>
            </p>
          </div>
        </GlassCard>

        {/* Total Invested */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Investido (Aportes)</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Icon name="savings" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalInvested)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {investments.length} {investments.length === 1 ? 'ativo cadastrado' : 'ativos cadastrados'}
            </p>
          </div>
        </GlassCard>

        {/* Total Profit */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lucro / Rendimento</span>
            <div className={`p-2 rounded-xl ${totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
              <Icon name={totalProfit >= 0 ? 'trending_up' : 'trending_down'} className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
            </h2>
            <Badge color={totalProfit >= 0 ? 'green' : 'red'} className="mt-1">
              {totalYield >= 0 ? '+' : ''}{totalYield.toFixed(2)}% de retorno
            </Badge>
          </div>
        </GlassCard>

        {/* Liquidity Breakdown */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Liquidez & Prazos</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Icon name="schedule" className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Icon name="check_circle" className="text-emerald-500 w-3.5 h-3.5" /> Liquidez Imediata:
              </span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalLiquid)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Icon name="lock" className="text-amber-500 w-3.5 h-3.5" /> Em Carência:
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalLocked)}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Charts & Allocation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation by Type (Donut Chart & Detailed Rows) */}
        <GlassCard className="p-6 lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Alocação por Tipo de Ativo</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distribuição do seu patrimônio entre categorias de investimentos</p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs font-bold flex items-center gap-1">
              <Icon name="pie_chart" size="sm" /> {typeList.length} Tipos
            </span>
          </div>

          {investments.length > 0 && totalCurrent > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Doughnut Chart with Center Total */}
              <div className="w-full md:w-1/2 flex items-center justify-center">
                <div className="h-56 w-56 relative flex items-center justify-center">
                  <Doughnut 
                    data={doughnutChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context: any) {
                              const value = context.raw;
                              const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                              const percentage = totalCurrent > 0 ? ((value / totalCurrent) * 100).toFixed(1) : '0';
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
                      PATRIMÔNIO
                    </span>
                    <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {formatCurrency(totalCurrent)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown Progress Bars */}
              <div className="w-full md:w-1/2 space-y-3.5">
                {typeList.map((type, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name} ({type.count})
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(type.total)} ({type.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(2, type.percentage)}%`, backgroundColor: type.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400 italic">
              Nenhum investimento com saldo cadastrado para exibir a composição da carteira.
            </div>
          )}
        </GlassCard>

        {/* Allocation by Financial Institution (Brokers/Banks) */}
        <GlassCard className="p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Por Instituição</h3>
              <span className="text-xs text-gray-400 font-medium">{instList.length} Bancos/Corretoras</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Onde o seu dinheiro está custodiado
            </p>

            {instList.length > 0 && totalCurrent > 0 ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {instList.map((inst, idx) => (
                  <div key={idx} className="bg-gray-50/80 dark:bg-gray-800/40 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                          <Icon name="account_balance" size="sm" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs">{inst.name}</p>
                          <p className="text-[10px] text-gray-400">{inst.count} {inst.count === 1 ? 'ativo' : 'ativos'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-gray-900 dark:text-white text-xs">{formatCurrency(inst.total)}</p>
                        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{inst.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-700" 
                        style={{ width: `${Math.max(2, inst.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                Nenhuma instituição registrada.
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Detailed Assets Table */}
      <GlassCard className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Meus Ativos</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Total em Carteira: <strong className="text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</strong>
          </span>
        </div>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : investments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-lg">Ativo</th>
                  <th scope="col" className="px-4 py-3">Instituição</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Vencimento / Liquidez</th>
                  <th scope="col" className="px-4 py-3 text-right">Total Investido</th>
                  <th scope="col" className="px-4 py-3 text-right">Saldo Atual</th>
                  <th scope="col" className="px-4 py-3 text-right">Rendimento</th>
                  <th scope="col" className="px-4 py-3 text-center rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const invYield = inv.total_invested > 0 ? ((inv.current_balance - inv.total_invested) / inv.total_invested) * 100 : 0;
                  const isPositive = inv.current_balance >= inv.total_invested;
                  
                  return (
                    <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-4 font-bold text-gray-900 dark:text-white">
                        {inv.name}
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400">
                        {inv.institution || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm inline-flex items-center gap-1"
                          style={{ backgroundColor: inv.investment_type?.color || '#0058be' }}
                        >
                          <Icon name={inv.investment_type?.icon || 'account_balance_wallet'} className="w-3.5 h-3.5" />
                          {inv.investment_type?.name || 'Outro'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {inv.due_date ? (() => {
                          const isLocked = inv.due_date > todayStr;
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isLocked ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                              <Icon name={isLocked ? 'lock' : 'check_circle'} size="sm" />
                              {formatDate(inv.due_date)} {isLocked ? '(Carência)' : '(Disponível)'}
                            </span>
                          );
                        })() : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                            Liquidez imediata
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatCurrency(inv.total_invested)}
                      </td>
                      <td className="px-4 py-4 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(inv.current_balance)}
                      </td>
                      <td className={`px-4 py-4 text-right font-extrabold whitespace-nowrap ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}{invYield.toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleOpenInvModal(inv)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Editar Ativo"
                          >
                            <Icon name="edit" size="sm" />
                          </button>
                          <button 
                            onClick={() => handleOpenEntryModal(inv.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            title="Registrar Movimentação (Aporte, Resgate ou Rendimento)"
                          >
                            <Icon name="swap_horiz" size="sm" />
                          </button>
                          <button 
                            onClick={() => handleDeleteInvestment(inv.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Excluir Ativo"
                          >
                            <Icon name="delete" size="sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12">
            <EmptyState 
              title="Nenhum investimento encontrado" 
              description="Cadastre seus ativos para começar a monitorar a rentabilidade da sua carteira." 
              icon="account_balance"
            />
          </div>
        )}
      </GlassCard>

      {/* Modal - Novo/Editar Investimento */}
      <Modal 
        isOpen={isInvModalOpen} 
        onClose={() => !isSubmitting && setIsInvModalOpen(false)} 
        title={editingInvId ? "Editar Investimento" : "Novo Investimento"}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Input 
            label="Nome do Ativo" 
            placeholder="Ex: Tesouro IPCA+ 2035, CDB Banco X" 
            value={invForm.name}
            onChange={(e) => setInvForm({...invForm, name: e.target.value})}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo de Investimento" 
              value={invForm.type_id}
              onChange={(e) => setInvForm({...invForm, type_id: e.target.value})}
              options={types.map(t => ({ value: t.id, label: t.name }))}
            />
            <Input 
              label="Instituição Financeira" 
              placeholder="Ex: XP, Inter, NuInvest" 
              value={invForm.institution}
              onChange={(e) => setInvForm({...invForm, institution: e.target.value})}
            />
          </div>

          <Input 
            label="Data de Vencimento / Prazo Mínimo de Resgate (Opcional)" 
            type="date" 
            value={invForm.due_date}
            onChange={(e) => setInvForm({...invForm, due_date: e.target.value})}
          />

          {!editingInvId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Aporte Inicial (R$)" 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                value={invForm.initial_amount}
                onChange={(e) => setInvForm({...invForm, initial_amount: e.target.value})}
              />
              <Input 
                label="Data da Aplicação" 
                type="date" 
                value={invForm.date}
                onChange={(e) => setInvForm({...invForm, date: e.target.value})}
              />
            </div>
          )}

          <Input 
            label="Observações" 
            placeholder="Alguma nota importante sobre este ativo" 
            value={invForm.notes}
            onChange={(e) => setInvForm({...invForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsInvModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveInvestment} loading={isSubmitting}>
              {editingInvId ? "Salvar Alterações" : "Adicionar Investimento"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Registrar Movimentação */}
      <Modal 
        isOpen={isEntryModalOpen} 
        onClose={() => !isSubmitting && setIsEntryModalOpen(false)} 
        title="Registrar Movimentação"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Select 
            label="Tipo de Operação" 
            value={entryForm.type}
            onChange={(e) => setEntryForm({...entryForm, type: e.target.value as any})}
            options={[
              { value: 'aporte', label: 'Aporte (Comprar mais)' },
              { value: 'resgate', label: 'Resgate (Vender / Retirar)' },
              { value: 'rendimento', label: 'Rendimento (Juros / Dividendos)' }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Valor (R$)" 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={entryForm.amount}
              onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
            />
            <Input 
              label="Data da Operação" 
              type="date" 
              value={entryForm.date}
              onChange={(e) => setEntryForm({...entryForm, date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Ex: Dividendos recebidos, Aporte mensal" 
            value={entryForm.notes}
            onChange={(e) => setEntryForm({...entryForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsEntryModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddEntry} loading={isSubmitting}>Salvar Movimentação</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
