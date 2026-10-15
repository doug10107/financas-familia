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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Metas Financeiras
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              <Icon name="auto_awesome" size="sm" />
              Inteligente
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Planeje metas com cálculo de taxa em tempo real e integre aos seus investimentos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/planejamento">
            <Button variant="secondary" className="border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <Icon name="flight_takeoff" className="w-4 h-4 mr-2" />
              Prever Gastos & Orçar
            </Button>
          </Link>
          <Button variant="primary" onClick={() => handleOpenGoalModal()}>
            <Icon name="add" className="w-4 h-4 mr-2" />
            Nova Meta
          </Button>
        </div>
      </div>

      {/* Banner de Previsão de Gastos Detalhada (TrabeePocket) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
            <Icon name="calculate" size="md" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Deseja criar metas com muito mais fidelidade e datas realistas?
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Utilize o novo módulo de <strong>Previsão de Gastos & Planejamento</strong> (estilo TrabeePocket) para orçar despesas de viagem, passagens, hospedagem, transporte, reforma ou veículo item a item, e descobrir a data exata da meta de acordo com o seu aporte mensal!
            </p>
          </div>
        </div>
        <Link href="/planejamento" className="shrink-0 w-full sm:w-auto">
          <Button variant="primary" size="sm" className="w-full shadow-xs">
            Abrir Planejamento →
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
            const progress = calculateProgress(goal.current_amount, goal.target_amount);
            const monthsLeft = calculateMonthsRemaining(goal.deadline);

            return (
              <GlassCard key={goal.id} className="p-6 flex flex-col h-full justify-between hover:shadow-lg transition-all duration-200">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className="p-3 rounded-xl text-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: goal.color }}
                    >
                      <Icon name={goal.icon} className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenSimulatorModal(goal)}
                        className="p-1.5 text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        title="Simulador de Taxa & Aportes"
                      >
                        <Icon name="auto_awesome" size="sm" />
                      </button>
                      <button
                        onClick={() => handleOpenHistoryModal(goal)}
                        className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-[#adc6ff] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        title="Ver Extrato / Histórico da Meta"
                      >
                        <Icon name="history" size="sm" />
                      </button>
                      <button
                        onClick={() => handleOpenGoalModal(goal)}
                        className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-[#adc6ff] transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        title="Editar Meta"
                      >
                        <Icon name="edit" size="sm" />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                        title="Excluir Meta"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                      <Badge color={progress >= 100 ? 'green' : 'blue'}>
                        {progress}%
                      </Badge>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{goal.name}</h3>
                  {goal.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 line-clamp-2">{goal.description}</p>
                  )}

                  {/* Vínculo com Ativo de Investimento */}
                  {goal.investment ? (
                    <div className="mb-3 p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon name="account_balance_wallet" size="sm" className="text-primary dark:text-blue-400 shrink-0" />
                        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                          {goal.investment.ticker || goal.investment.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-primary dark:text-blue-400 shrink-0 ml-2">
                        {formatCurrency(goal.investment.current_balance)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <span className="flex items-center gap-1.5">
                      <Icon name="calendar_month" size="sm" className="text-gray-400 shrink-0" />
                      {formatDate(goal.deadline)}
                    </span>
                    {goal.deadline && monthsLeft > 0 && (
                      <span className="text-[11px] text-gray-400 font-medium">
                        {monthsLeft} {monthsLeft === 1 ? 'mês restante' : 'meses restantes'}
                      </span>
                    )}
                  </div>

                  {/* Detalhes do Aporte Planejado */}
                  {goal.target_monthly_deposit && goal.target_monthly_deposit > 0 ? (
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 mb-4 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Icon name="trending_up" size="sm" className="text-emerald-500" />
                          Aporte Planejado:
                        </span>
                        <strong className="text-gray-900 dark:text-white font-bold">
                          {formatCurrency(goal.target_monthly_deposit)}/mês
                        </strong>
                      </div>
                      <div className="text-[10px] text-gray-400 text-right mt-0.5">
                        Rentabilidade est.: {goal.estimated_annual_rate || 10.5}% a.a.
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto pt-2">
                  <div className="flex justify-between text-sm mb-2">
                    <div>
                      <span className="text-xs text-gray-400 block">Acumulado</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(goal.current_amount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Objetivo</span>
                      <span className="text-gray-500">{formatCurrency(goal.target_amount)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700/80 rounded-full h-2.5 mb-5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: goal.color }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenMovementModal(goal, 'aporte')}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Icon name="add_circle" size="sm" className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Aporte</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenMovementModal(goal, 'resgate')}
                      disabled={goal.current_amount <= 0}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="remove_circle" size="sm" className="text-rose-600 dark:text-rose-400 shrink-0" />
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
