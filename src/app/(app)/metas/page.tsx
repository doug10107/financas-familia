'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGoals, Goal, GoalContribution } from '@/hooks/useGoals';
import { SmartGoalCalculator } from '@/components/metas/SmartGoalCalculator';
import { calculateMonthsRemaining } from '@/lib/goalCalculators';

export default function GoalsPage() {
  const {
    goals,
    categories,
    investments,
    loading,
    error,
    addGoal,
    updateGoal,
    deleteGoal,
    addGoalContribution,
    fetchGoalContributions,
    deleteGoalContribution
  } = useGoals();

  const [editingId, setEditingId] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);

  // Selected goal state
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [movementType, setMovementType] = useState<'aporte' | 'resgate'>('aporte');
  const [activeMenuGoalId, setActiveMenuGoalId] = useState<string | null>(null);

  // Close card menu on outside click
  React.useEffect(() => {
    const handleGlobalClick = () => setActiveMenuGoalId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // History state
  const [historyList, setHistoryList] = useState<GoalContribution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [goalForm, setGoalForm] = useState({
    name: '',
    target_amount: '',
    initial_amount: '',
    deadline: '',
    description: '',
    icon: 'flag',
    color: '#10b981',
    target_monthly_deposit: '',
    estimated_annual_rate: '10.5',
    investment_id: ''
  });

  const [movementForm, setMovementForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    syncTransaction: false,
    transactionType: 'despesa' as 'despesa' | 'receita',
    categoryId: '',
    customDescription: '',
    syncInvestment: false,
    investmentId: ''
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min(Math.round((Number(current) / (Number(target) || 1)) * 100), 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sem prazo';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleOpenGoalModal = (goal?: Goal) => {
    setFormError('');
    if (goal) {
      setEditingId(goal.id);
      setGoalForm({
        name: goal.name,
        target_amount: goal.target_amount.toString(),
        initial_amount: '',
        deadline: goal.deadline || '',
        description: goal.description || '',
        icon: goal.icon,
        color: goal.color,
        target_monthly_deposit: goal.target_monthly_deposit ? goal.target_monthly_deposit.toString() : '',
        estimated_annual_rate: goal.estimated_annual_rate ? goal.estimated_annual_rate.toString() : '10.5',
        investment_id: goal.investment_id || ''
      });
    } else {
      setEditingId(null);
      setGoalForm({
        name: '',
        target_amount: '',
        initial_amount: '',
        deadline: '',
        description: '',
        icon: 'flag',
        color: '#10b981',
        target_monthly_deposit: '',
        estimated_annual_rate: '10.5',
        investment_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenSimulatorModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsSimulatorModalOpen(true);
  };

  const handleOpenMovementModal = (goal: Goal, type: 'aporte' | 'resgate' = 'aporte') => {
    setFormError('');
    setSelectedGoal(goal);
    setMovementType(type);
    setMovementForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      syncTransaction: false,
      transactionType: type === 'resgate' ? 'despesa' : 'despesa',
      categoryId: categories.length > 0 ? categories[0].id : '',
      customDescription: '',
      syncInvestment: !!goal.investment_id,
      investmentId: goal.investment_id || (investments.length > 0 ? investments[0].id : '')
    });
    setIsMovementModalOpen(true);
  };

  const handleOpenHistoryModal = async (goal: Goal) => {
    setSelectedGoal(goal);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    const data = await fetchGoalContributions(goal.id);
    setHistoryList(data);
    setLoadingHistory(false);
  };

  const handleDeleteHistoryItem = async (contributionId: string) => {
    if (!window.confirm('Deseja excluir esta movimentação? O saldo da meta será recalculado.')) return;
    const ok = await deleteGoalContribution(contributionId);
    if (ok && selectedGoal) {
      const data = await fetchGoalContributions(selectedGoal.id);
      setHistoryList(data);
    }
  };

  const handleCreateGoal = async () => {
    if (!goalForm.name || !goalForm.target_amount) {
      setFormError('Por favor, preencha o nome da meta e o valor objetivo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const targetMonthly = goalForm.target_monthly_deposit
      ? parseFloat(goalForm.target_monthly_deposit.replace(',', '.'))
      : null;
    const estRate = goalForm.estimated_annual_rate
      ? parseFloat(goalForm.estimated_annual_rate.replace(',', '.'))
      : 10.5;

    let success = false;
    if (editingId) {
      success = await updateGoal(editingId, {
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount.replace(',', '.')),
        deadline: goalForm.deadline || null,
        description: goalForm.description || null,
        icon: goalForm.icon,
        color: goalForm.color,
        target_monthly_deposit: targetMonthly,
        estimated_annual_rate: estRate,
        investment_id: goalForm.investment_id || null
      });
    } else {
      success = await addGoal({
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount.replace(',', '.')),
        initial_amount: goalForm.initial_amount ? parseFloat(goalForm.initial_amount.replace(',', '.')) : 0,
        deadline: goalForm.deadline || undefined,
        description: goalForm.description || undefined,
        icon: goalForm.icon,
        color: goalForm.color,
        target_monthly_deposit: targetMonthly,
        estimated_annual_rate: estRate,
        investment_id: goalForm.investment_id || null
      });
    }

    setIsSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    } else {
      setFormError('Erro ao salvar meta. Tente novamente.');
    }
  };

  const handleSaveMovement = async () => {
    if (!selectedGoal || !movementForm.amount) {
      setFormError('Por favor, preencha o valor da movimentação.');
      return;
    }

    const rawAmount = parseFloat(movementForm.amount.replace(',', '.'));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setFormError('Por favor, informe um valor válido maior que zero.');
      return;
    }

    if (movementType === 'resgate' && rawAmount > selectedGoal.current_amount) {
      setFormError(`O valor de resgate não pode ser maior que o saldo acumulado (Disponível: ${formatCurrency(selectedGoal.current_amount)}).`);
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addGoalContribution({
      goal_id: selectedGoal.id,
      amount: rawAmount,
      type: movementType,
      date: movementForm.date,
      notes: movementForm.notes || undefined,
      sync_transaction: movementForm.syncTransaction,
      transaction_category_id: movementForm.syncTransaction ? movementForm.categoryId : undefined,
      transaction_type: movementForm.transactionType,
      transaction_description: movementForm.customDescription || undefined,
      sync_investment: movementForm.syncInvestment,
      investment_id: movementForm.syncInvestment ? (movementForm.investmentId || selectedGoal.investment_id || undefined) : undefined
    });

    setIsSubmitting(false);
    if (success) {
      setIsMovementModalOpen(false);
    } else {
      setFormError('Erro ao registrar movimentação. Tente novamente.');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta? Contribuições vinculadas serão excluídas.')) {
      await deleteGoal(id);
    }
  };

  const iconOptions = [
    { value: 'flag', label: 'Bandeira (Geral)' },
    { value: 'savings', label: 'Porquinho (Economia)' },
    { value: 'flight', label: 'Avião (Viagem)' },
    { value: 'directions_car', label: 'Carro' },
    { value: 'home', label: 'Casa' },
    { value: 'school', label: 'Educação' },
    { value: 'shield', label: 'Escudo (Reserva)' },
    { value: 'sports_esports', label: 'Lazer / Games' },
    { value: 'favorite', label: 'Coração / Saúde' },
    { value: 'shopping_bag', label: 'Compras' }
  ];

  const colorOptions = [
    { label: 'Verde', value: '#10b981' },
    { label: 'Roxo', value: '#8b5cf6' },
    { label: 'Azul', value: '#3b82f6' },
    { label: 'Vermelho', value: '#ef4444' },
    { label: 'Laranja', value: '#f97316' },
    { label: 'Ciano', value: '#06b6d4' }
  ];

  const categoryOptions = categories.map(c => ({
    value: c.id,
    label: c.name
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Limpo & Direto */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Metas Financeiras
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Acompanhe o progresso e simule o alcance dos seus objetivos patrimoniais
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/planejamento">
            <Button variant="secondary" size="sm" className="rounded-xl text-xs sm:text-sm">
              <Icon name="event_note" className="w-4 h-4 mr-1.5 text-gray-500" />
              Previsão de Gastos
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => handleOpenGoalModal()} className="rounded-xl shadow-xs">
            <Icon name="add" className="w-4 h-4 mr-1.5" />
            Nova Meta
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map(goal => {
            const progress = calculateProgress(goal.current_amount, goal.target_amount);
            const monthsLeft = calculateMonthsRemaining(goal.deadline);
            const isMenuOpen = activeMenuGoalId === goal.id;

            return (
              <GlassCard 
                key={goal.id} 
                className="p-5 flex flex-col justify-between border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all rounded-2xl relative shadow-xs"
              >
                <div>
                  {/* Cabeçalho do Card: Ícone, Título e Menu 3 Pontinhos */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl text-white shadow-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: goal.color }}
                      >
                        <Icon name={goal.icon} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate text-base leading-tight">
                          {goal.name}
                        </h3>
                        {goal.description ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {goal.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Progresso Badge + Menu Dropdown Clean */}
                    <div className="flex items-center gap-1.5 shrink-0 relative">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        progress >= 100 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                      }`}>
                        {progress}%
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuGoalId(isMenuOpen ? null : goal.id);
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Mais opções"
                      >
                        <Icon name="more_vert" size="sm" />
                      </button>

                      {/* Dropdown de Opções */}
                      {isMenuOpen && (
                        <div 
                          className="absolute right-0 top-8 w-48 bg-white dark:bg-[#1a2332] rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 py-1 z-30 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuGoalId(null);
                              handleOpenSimulatorModal(goal);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
                          >
                            <Icon name="auto_awesome" size="xs" className="text-amber-500" />
                            Simular Rendimentos
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuGoalId(null);
                              handleOpenHistoryModal(goal);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
                          >
                            <Icon name="history" size="xs" className="text-blue-500" />
                            Histórico de Aportes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuGoalId(null);
                              handleOpenGoalModal(goal);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
                          >
                            <Icon name="edit" size="xs" className="text-gray-500" />
                            Editar Meta
                          </button>
                          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuGoalId(null);
                              handleDeleteGoal(goal.id);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2 transition-colors"
                          >
                            <Icon name="delete" size="xs" />
                            Excluir Meta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informações Complementares em Pills Sutis */}
                  <div className="flex items-center gap-2 flex-wrap mb-4 text-[11px] text-gray-500 dark:text-gray-400">
                    {goal.deadline && (
                      <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/60 px-2 py-0.5 rounded-md">
                        <Icon name="calendar_today" size="xs" className="text-gray-400" />
                        {formatDate(goal.deadline)}
                        {monthsLeft > 0 ? ` (${monthsLeft}m)` : ''}
                      </span>
                    )}

                    {goal.target_monthly_deposit && goal.target_monthly_deposit > 0 ? (
                      <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md font-medium">
                        <Icon name="trending_up" size="xs" />
                        {formatCurrency(goal.target_monthly_deposit)}/mês
                      </span>
                    ) : null}

                    {goal.investment ? (
                      <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-medium truncate max-w-[140px]">
                        <Icon name="account_balance_wallet" size="xs" />
                        {goal.investment.ticker || goal.investment.name}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Bloco de Progresso e Valores */}
                <div className="mt-2">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-[11px] text-gray-400 block font-medium">Acumulado</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(goal.current_amount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-gray-400 block font-medium">Objetivo</span>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {formatCurrency(goal.target_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Fina e Suave */}
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: goal.color }}
                    />
                  </div>

                  {/* Botões Aporte e Resgatar Minimalistas */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenMovementModal(goal, 'aporte')}
                      className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Icon name="add" size="xs" />
                      <span>Aporte</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenMovementModal(goal, 'resgate')}
                      disabled={goal.current_amount <= 0}
                      className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Icon name="remove" size="xs" />
                      <span>Resgatar</span>
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="col-span-full">
          <EmptyState
            title="Nenhuma meta cadastrada"
            description="Comece a planejar seu futuro criando sua primeira meta financeira com cálculos inteligentes."
            icon="ads_click"
            actionLabel="Criar Meta"
            onAction={() => handleOpenGoalModal()}
          />
        </div>
      )}

      {/* Modal - Nova Meta / Editar Meta (com Simulador Inteligente Integrado) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title={editingId ? 'Editar Meta' : 'Nova Meta'}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {formError && (
            <div className="p-3 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Input
            label="Título da Meta"
            placeholder="Ex: Reserva de Emergência, Compra de Celular, Viagem"
            value={goalForm.name}
            onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
          />

          <Input
            label="Descrição (Opcional)"
            placeholder="Algum detalhe importante sobre essa meta"
            value={goalForm.description}
            onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Valor Objetivo (R$)"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={goalForm.target_amount}
              onChange={(e) => setGoalForm({ ...goalForm, target_amount: e.target.value })}
            />
            {!editingId ? (
              <Input
                label="Valor Inicial Guardado (Opcional)"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={goalForm.initial_amount}
                onChange={(e) => setGoalForm({ ...goalForm, initial_amount: e.target.value })}
              />
            ) : (
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-sm font-medium text-gray-400 dark:text-gray-500">Valor Acumulado</label>
                <div className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a2332] text-gray-400 dark:text-gray-500 font-semibold select-none">
                  Calculado pelos aportes e resgates
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Data Limite (Prazo)"
              type="date"
              value={goalForm.deadline}
              onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
            />
            <Select
              label="Ícone"
              value={goalForm.icon}
              onChange={(e) => setGoalForm({ ...goalForm, icon: e.target.value })}
              options={iconOptions}
            />
          </div>

          <Select
            label="Cor"
            value={goalForm.color}
            onChange={(e) => setGoalForm({ ...goalForm, color: e.target.value })}
            options={colorOptions}
          />

          {/* SIMULADOR INTELIGENTE DINÂMICO EM TEMPO REAL */}
          {parseFloat(goalForm.target_amount.replace(',', '.')) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <SmartGoalCalculator
                targetAmount={parseFloat(goalForm.target_amount.replace(',', '.')) || 0}
                currentAmount={
                  editingId && selectedGoal
                    ? selectedGoal.current_amount
                    : parseFloat(goalForm.initial_amount.replace(',', '.')) || 0
                }
                deadline={goalForm.deadline}
                initialRate={parseFloat(goalForm.estimated_annual_rate) || 10.5}
                initialMonthlyDeposit={
                  goalForm.target_monthly_deposit
                    ? parseFloat(goalForm.target_monthly_deposit.replace(',', '.'))
                    : null
                }
                selectedInvestmentId={goalForm.investment_id}
                investments={investments}
                onSelectInvestment={(id) => setGoalForm(prev => ({ ...prev, investment_id: id || '' }))}
                onRateChange={(rate) => setGoalForm(prev => ({ ...prev, estimated_annual_rate: rate.toString() }))}
                onMonthlyDepositChange={(dep) =>
                  setGoalForm(prev => ({ ...prev, target_monthly_deposit: dep ? dep.toString() : '' }))
                }
                onApplyPlan={(plan) => {
                  setGoalForm(prev => ({
                    ...prev,
                    target_monthly_deposit: plan.monthlyDeposit.toString(),
                    estimated_annual_rate: plan.annualRate.toString(),
                    investment_id: plan.investmentId || prev.investment_id
                  }));
                }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCreateGoal} loading={isSubmitting}>
              {editingId ? 'Salvar Alterações' : 'Salvar Meta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Simulador Rápido Dedicado */}
      <Modal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        title={selectedGoal ? `Simulador de Investimento: ${selectedGoal.name}` : 'Simulador de Meta'}
      >
        <div className="space-y-4">
          {selectedGoal && (
            <SmartGoalCalculator
              targetAmount={selectedGoal.target_amount}
              currentAmount={selectedGoal.current_amount}
              deadline={selectedGoal.deadline || undefined}
              initialRate={selectedGoal.estimated_annual_rate || 10.5}
              initialMonthlyDeposit={selectedGoal.target_monthly_deposit || null}
              selectedInvestmentId={selectedGoal.investment_id}
              investments={investments}
              onApplyPlan={async (plan) => {
                await updateGoal(selectedGoal.id, {
                  target_monthly_deposit: plan.monthlyDeposit,
                  estimated_annual_rate: plan.annualRate,
                  investment_id: plan.investmentId || null
                });
                setIsSimulatorModalOpen(false);
              }}
              onSelectInvestment={async (id) => {
                await updateGoal(selectedGoal.id, {
                  investment_id: id || null
                });
              }}
            />
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setIsSimulatorModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Movimentação (Aporte / Resgate) com Sincronização de Investimento */}
      <Modal
        isOpen={isMovementModalOpen}
        onClose={() => !isSubmitting && setIsMovementModalOpen(false)}
        title={selectedGoal ? `Movimentação: ${selectedGoal.name}` : 'Movimentação da Meta'}
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {formError && (
            <div className="p-3 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              {formError}
            </div>
          )}

          {/* Type Toggle: Aporte vs Resgate */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMovementType('aporte');
                setMovementForm({
                  ...movementForm,
                  transactionType: 'despesa'
                });
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                movementType === 'aporte'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="add_circle" size="sm" className="shrink-0" />
              <span>Aporte (Guardar)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMovementType('resgate');
                setMovementForm({
                  ...movementForm,
                  transactionType: 'despesa'
                });
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                movementType === 'resgate'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="remove_circle" size="sm" className="shrink-0" />
              <span>Resgate (Retirar)</span>
            </button>
          </div>

          {selectedGoal && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-gray-400">Saldo acumulado nesta meta:</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {formatCurrency(selectedGoal.current_amount)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={movementType === 'aporte' ? 'Valor do Aporte (R$)' : 'Valor a Resgatar (R$)'}
              type="number"
              step="0.01"
              placeholder="0,00"
              value={movementForm.amount}
              onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })}
            />
            <Input
              label="Data"
              type="date"
              value={movementForm.date}
              onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })}
            />
          </div>

          <Input
            label={movementType === 'aporte' ? 'Observações (Opcional)' : 'Motivo do Resgate / Observações (Opcional)'}
            placeholder={movementType === 'aporte' ? 'Ex: Aporte mensal, Dinheiro extra' : 'Ex: Pagamento do mecânico, Compras'}
            value={movementForm.notes}
            onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
          />

          {/* SEÇÃO: SINCRONIZAR COM INVESTIMENTOS */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={movementForm.syncInvestment}
                onChange={(e) => setMovementForm({ ...movementForm, syncInvestment: e.target.checked })}
                className="w-4 h-4 text-primary rounded border-gray-300 dark:border-gray-700 focus:ring-primary"
              />
              <span className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Icon name="account_balance_wallet" size="sm" className="text-primary" />
                Sincronizar com a Carteira de Investimentos
              </span>
            </label>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 ml-6 mt-0.5">
              Registra automaticamente um {movementType === 'aporte' ? 'aporte' : 'resgate'} no ativo selecionado e atualiza o saldo na aba Investimentos.
            </p>

            {movementForm.syncInvestment && (
              <div className="mt-3 ml-6 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 space-y-2">
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Selecionar Ativo da Carteira:
                </label>
                <select
                  value={movementForm.investmentId}
                  onChange={(e) => setMovementForm({ ...movementForm, investmentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione um ativo...</option>
                  {investments.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.ticker ? `[${inv.ticker}] ` : ''}{inv.name} • Saldo: {formatCurrency(inv.current_balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Transaction Sync Section (Lançamentos / Caixa da Família) */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={movementForm.syncTransaction}
                onChange={(e) => setMovementForm({ ...movementForm, syncTransaction: e.target.checked })}
                className="w-4 h-4 text-primary rounded border-gray-300 dark:border-gray-700 focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {movementType === 'resgate'
                  ? 'Registrar saída/despesa automaticamente em Lançamentos'
                  : 'Registrar saída do caixa em Lançamentos (Despesa de aporte)'}
              </span>
            </label>

            {movementForm.syncTransaction && (
              <div className="mt-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Tipo de Lançamento"
                    value={movementForm.transactionType}
                    onChange={(e) => setMovementForm({ ...movementForm, transactionType: e.target.value as any })}
                    options={[
                      { value: 'despesa', label: 'Despesa (Dinheiro gasto no pagamento)' },
                      { value: 'receita', label: 'Receita (Entrou de volta na conta corrente)' }
                    ]}
                  />

                  {categoryOptions.length > 0 ? (
                    <Select
                      label="Categoria da Despesa"
                      value={movementForm.categoryId}
                      onChange={(e) => setMovementForm({ ...movementForm, categoryId: e.target.value })}
                      options={categoryOptions}
                    />
                  ) : (
                    <div className="text-xs text-gray-500 self-center">Nenhuma categoria cadastrada</div>
                  )}
                </div>

                <Input
                  label="Descrição no Extrato (Opcional)"
                  placeholder={
                    movementType === 'resgate'
                      ? `[Resgate Meta: ${selectedGoal?.name}] ${movementForm.notes || ''}`
                      : `[Aporte Meta: ${selectedGoal?.name}] ${movementForm.notes || ''}`
                  }
                  value={movementForm.customDescription}
                  onChange={(e) => setMovementForm({ ...movementForm, customDescription: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsMovementModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              variant={movementType === 'aporte' ? 'primary' : 'danger'}
              onClick={handleSaveMovement}
              loading={isSubmitting}
            >
              {movementType === 'aporte' ? 'Confirmar Aporte' : 'Confirmar Resgate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Extrato / Histórico de Movimentações da Meta */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={selectedGoal ? `Histórico: ${selectedGoal.name}` : 'Histórico da Meta'}
      >
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
            </div>
          ) : historyList.length > 0 ? (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {historyList.map((item) => {
                const isWithdrawal = item.amount < 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-800/40 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isWithdrawal
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <Icon name={isWithdrawal ? 'remove' : 'add'} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white">
                            {isWithdrawal ? 'Resgate' : 'Aporte'}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</p>
                        )}
                        {item.profile?.display_name && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Por: {item.profile.display_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          isWithdrawal
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isWithdrawal ? '-' : '+'} {formatCurrency(Math.abs(item.amount))}
                      </span>
                      <button
                        onClick={() => handleDeleteHistoryItem(item.id)}
                        className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                        title="Excluir movimentação"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              Nenhum aporte ou resgate registrado ainda para esta meta.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="ghost" onClick={() => setIsHistoryModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
