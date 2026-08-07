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
import { useGoals } from '@/hooks/useGoals';

export default function GoalsPage() {
  const { goals, loading, error, addGoal, updateGoal, deleteGoal, addGoalContribution } = useGoals();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

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
    color: '#10b981'
  });

  const [contribForm, setContribForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
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

  const handleOpenGoalModal = (goal?: any) => {
    setFormError('');
    const isGoalObject = goal && typeof goal === 'object' && 'target_amount' in goal;

    if (isGoalObject) {
      setEditingId(goal.id);
      setGoalForm({
        name: goal.name,
        target_amount: goal.target_amount.toString(),
        initial_amount: '',
        deadline: goal.deadline || '',
        description: goal.description || '',
        icon: goal.icon,
        color: goal.color
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
        color: '#10b981'
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenContributionModal = (goalId: string) => {
    setFormError('');
    setSelectedGoalId(goalId);
    setContribForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsContributionModalOpen(true);
  };

  const handleCreateGoal = async () => {
    if (!goalForm.name || !goalForm.target_amount) {
      setFormError('Por favor, preencha o nome da meta e o valor objetivo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    let success = false;
    if (editingId) {
      success = await updateGoal(editingId, {
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount.replace(',', '.')),
        deadline: goalForm.deadline || null,
        description: goalForm.description || null,
        icon: goalForm.icon,
        color: goalForm.color
      });
    } else {
      success = await addGoal({
        name: goalForm.name,
        target_amount: parseFloat(goalForm.target_amount.replace(',', '.')),
        initial_amount: goalForm.initial_amount ? parseFloat(goalForm.initial_amount.replace(',', '.')) : 0,
        deadline: goalForm.deadline || undefined,
        description: goalForm.description || undefined,
        icon: goalForm.icon,
        color: goalForm.color
      });
    }

    setIsSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    } else {
      setFormError('Erro ao salvar meta. Tente novamente.');
    }
  };

  const handleAddContribution = async () => {
    if (!selectedGoalId || !contribForm.amount) {
      setFormError('Por favor, preencha o valor do aporte.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addGoalContribution({
      goal_id: selectedGoalId,
      amount: parseFloat(contribForm.amount.replace(',', '.')),
      date: contribForm.date,
      notes: contribForm.notes || undefined
    });

    setIsSubmitting(false);
    if (success) {
      setIsContributionModalOpen(false);
    } else {
      setFormError('Erro ao registrar aporte. Tente novamente.');
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Acompanhe seus objetivos financeiros e reservas</p>
        </div>
        <Button variant="primary" onClick={() => handleOpenGoalModal()}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Nova Meta
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
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
            return (
              <GlassCard key={goal.id} className="p-6 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div 
                      className="p-3 rounded-xl text-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: goal.color }}
                    >
                      <Icon name={goal.icon} className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 flex items-center">
                    <Icon name="calendar_month" className="w-3.5 h-3.5 mr-1" />
                    Prazo: {formatDate(goal.deadline)}
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-gray-500">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700/80 rounded-full h-2.5 mb-6 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${progress}%`, backgroundColor: goal.color }}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      className="flex-1 text-xs py-2 hover:bg-gray-100 dark:hover:bg-gray-800" 
                      onClick={() => handleOpenContributionModal(goal.id)}
                    >
                      <Icon name="add" className="w-3.5 h-3.5 mr-1" /> Aporte
                    </Button>
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
            description="Comece a planejar seu futuro criando sua primeira meta financeira." 
            icon="ads_click"
            actionLabel="Criar Meta"
            onAction={() => handleOpenGoalModal()}
          />
        </div>
      )}

      {/* Modal - Nova Meta */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !isSubmitting && setIsModalOpen(false)} 
        title="Nova Meta"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Input 
            label="Título da Meta" 
            placeholder="Ex: Reserva de Emergência, Compra de Celular" 
            value={goalForm.name}
            onChange={(e) => setGoalForm({...goalForm, name: e.target.value})}
          />
          
          <Input 
            label="Descrição (Opcional)" 
            placeholder="Algum detalhe importante sobre essa meta" 
            value={goalForm.description}
            onChange={(e) => setGoalForm({...goalForm, description: e.target.value})}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Valor Objetivo (R$)" 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={goalForm.target_amount}
              onChange={(e) => setGoalForm({...goalForm, target_amount: e.target.value})}
            />
            {!editingId ? (
              <Input 
                label="Valor Inicial (Opcional)" 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                value={goalForm.initial_amount}
                onChange={(e) => setGoalForm({...goalForm, initial_amount: e.target.value})}
              />
            ) : (
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-sm font-medium text-gray-400 dark:text-gray-500">Valor Acumulado</label>
                <div className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a2332] text-gray-400 dark:text-gray-500 font-semibold select-none">
                  Contido nos aportes
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Data Limite (Opcional)" 
              type="date" 
              value={goalForm.deadline}
              onChange={(e) => setGoalForm({...goalForm, deadline: e.target.value})}
            />
            <Select 
              label="Ícone" 
              value={goalForm.icon}
              onChange={(e) => setGoalForm({...goalForm, icon: e.target.value})}
              options={iconOptions}
            />
          </div>

          <Select 
            label="Cor" 
            value={goalForm.color}
            onChange={(e) => setGoalForm({...goalForm, color: e.target.value})}
            options={colorOptions}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreateGoal} loading={isSubmitting}>
              {editingId ? "Salvar Alterações" : "Salvar Meta"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Novo Aporte */}
      <Modal 
        isOpen={isContributionModalOpen} 
        onClose={() => !isSubmitting && setIsContributionModalOpen(false)} 
        title="Novo Aporte"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Adicione fundos à sua meta para acompanhar o progresso.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Valor do Aporte (R$)" 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={contribForm.amount}
              onChange={(e) => setContribForm({...contribForm, amount: e.target.value})}
            />
            <Input 
              label="Data do Aporte" 
              type="date" 
              value={contribForm.date}
              onChange={(e) => setContribForm({...contribForm, date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Ex: Aporte mensal, Dinheiro extra" 
            value={contribForm.notes}
            onChange={(e) => setContribForm({...contribForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsContributionModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddContribution} loading={isSubmitting}>Confirmar Aporte</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
