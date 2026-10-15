'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { 
  ExpensePlan, 
  ExpensePlanItem, 
  PlanCategoryType, 
  PLAN_TEMPLATES, 
  calculatePlanTotals, 
  calculateTargetDateFromContribution,
  calculateMonthlyDepositFromTargetDate,
  calculateItemTotalBrl,
  CostType,
  ItemStatus
} from '@/lib/expensePlanCalculators';

export default function PlanejamentoPage() {
  const {
    plans,
    activePlan,
    activePlanId,
    setActivePlanId,
    loading,
    createPlan,
    updatePlan,
    deletePlan,
    addItem,
    updateItem,
    deleteItem,
    toggleItemPaid,
    exportPlanToGoal
  } = useExpensePlans();

  // Estados dos modais
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpensePlanItem | null>(null);
  const [isExportingGoal, setIsExportingGoal] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Aba ativa: 'itens' | 'simulador' | 'metricas'
  const [activeTab, setActiveTab] = useState<'itens' | 'simulador' | 'metricas'>('itens');

  // Filtros da lista de itens
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');

  // Modo do simulador de meta: 'pelo_aporte' ou 'pelo_prazo'
  const [simulatorMode, setSimulatorMode] = useState<'pelo_aporte' | 'pelo_prazo'>('pelo_aporte');
  const [fixedTargetDate, setFixedTargetDate] = useState<string>('');

  // Formulário de Novo Plano
  const [newPlanForm, setNewPlanForm] = useState({
    title: '',
    category_type: 'viagem' as PlanCategoryType,
    days_count: 7,
    people_count: 2,
    monthly_contribution_capacity: 1000,
    current_saved_amount: 0,
    currency: 'BRL',
    exchange_rate: 1.0,
    contingency_percent: 10,
    useTemplateItems: true
  });

  // Formulário de Configurações do Plano Ativo
  const [configForm, setConfigForm] = useState({
    title: '',
    days_count: 7,
    people_count: 2,
    monthly_contribution_capacity: 1000,
    current_saved_amount: 0,
    currency: 'BRL',
    exchange_rate: 1.0,
    include_iof: false,
    contingency_percent: 10
  });

  // Formulário de Item
  const [itemForm, setItemForm] = useState({
    category: 'Transporte',
    name: '',
    cost_type: 'fixo' as CostType,
    quantity: 1,
    unit_cost: 0,
    original_currency: 'BRL',
    status: 'planejado' as ItemStatus,
    payment_method: 'dinheiro',
    notes: ''
  });

  const formatCurrency = (val: number, cur = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(val);
  };

  // Totais do plano ativo calculados em tempo real
  const totals = useMemo(() => {
    if (!activePlan) return null;
    return calculatePlanTotals(activePlan, activePlan.items || []);
  }, [activePlan]);

  // Cálculo da data coerente com base no aporte mensal
  const targetDateResult = useMemo(() => {
    if (!activePlan || !totals) return null;
    return calculateTargetDateFromContribution(
      totals.remainingToSave,
      activePlan.monthly_contribution_capacity || 500,
      10.5
    );
  }, [activePlan, totals]);

  // Cálculo do aporte mensal necessário caso o usuário fixe um prazo
  const requiredDepositResult = useMemo(() => {
    if (!activePlan || !totals || !fixedTargetDate) return null;
    return calculateMonthlyDepositFromTargetDate(
      totals.remainingToSave,
      fixedTargetDate,
      10.5
    );
  }, [activePlan, totals, fixedTargetDate]);

  // Categorias únicas presentes nos itens do plano ativo
  const uniqueCategories = useMemo(() => {
    if (!activePlan || !activePlan.items) return [];
    const set = new Set<string>();
    activePlan.items.forEach((item) => set.add(item.category));
    return Array.from(set);
  }, [activePlan]);

  // Itens filtrados
  const filteredItems = useMemo(() => {
    if (!activePlan || !activePlan.items) return [];
    return activePlan.items.filter((item) => {
      const matchCat = selectedCategoryFilter === 'todos' || item.category === selectedCategoryFilter;
      const matchStatus = selectedStatusFilter === 'todos' || item.status === selectedStatusFilter;
      return matchCat && matchStatus;
    });
  }, [activePlan, selectedCategoryFilter, selectedStatusFilter]);

  // Abrir modal de novo plano com template padrão
  const handleOpenNewPlanModal = () => {
    const defaultTemplate = PLAN_TEMPLATES.viagem;
    setNewPlanForm({
      title: defaultTemplate.title,
      category_type: 'viagem',
      days_count: defaultTemplate.defaultDays,
      people_count: defaultTemplate.defaultPeople,
      monthly_contribution_capacity: 1000,
      current_saved_amount: 0,
      currency: 'BRL',
      exchange_rate: 1.0,
      contingency_percent: defaultTemplate.contingencyPercent,
      useTemplateItems: true
    });
    setIsNewPlanModalOpen(true);
  };

  // Trocar template no modal de criação
  const handleSelectTemplate = (type: PlanCategoryType) => {
    const tpl = PLAN_TEMPLATES[type];
    setNewPlanForm((prev) => ({
      ...prev,
      category_type: type,
      title: tpl.title,
      days_count: tpl.defaultDays,
      people_count: tpl.defaultPeople,
      contingency_percent: tpl.contingencyPercent
    }));
  };

  // Submeter criação de plano
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanForm.title.trim()) return;

    await createPlan({
      title: newPlanForm.title,
      category_type: newPlanForm.category_type,
      days_count: Number(newPlanForm.days_count),
      people_count: Number(newPlanForm.people_count),
      monthly_contribution_capacity: Number(newPlanForm.monthly_contribution_capacity),
      current_saved_amount: Number(newPlanForm.current_saved_amount),
      currency: newPlanForm.currency,
      exchange_rate: Number(newPlanForm.exchange_rate),
      contingency_percent: Number(newPlanForm.contingency_percent),
      useTemplateItems: newPlanForm.useTemplateItems
    });

    setIsNewPlanModalOpen(false);
  };

  // Abrir configurações do plano
  const handleOpenConfigModal = () => {
    if (!activePlan) return;
    setConfigForm({
      title: activePlan.title,
      days_count: activePlan.days_count,
      people_count: activePlan.people_count,
      monthly_contribution_capacity: activePlan.monthly_contribution_capacity,
      current_saved_amount: activePlan.current_saved_amount,
      currency: activePlan.currency,
      exchange_rate: activePlan.exchange_rate,
      include_iof: activePlan.include_iof,
      contingency_percent: activePlan.contingency_percent
    });
    setIsConfigModalOpen(true);
  };

  // Salvar configurações do plano
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan) return;

    await updatePlan(activePlan.id, {
      title: configForm.title,
      days_count: Number(configForm.days_count),
      people_count: Number(configForm.people_count),
      monthly_contribution_capacity: Number(configForm.monthly_contribution_capacity),
      current_saved_amount: Number(configForm.current_saved_amount),
      currency: configForm.currency,
      exchange_rate: Number(configForm.exchange_rate),
      include_iof: configForm.include_iof,
      contingency_percent: Number(configForm.contingency_percent)
    });

    setIsConfigModalOpen(false);
  };

  // Abrir modal de item (Adicionar ou Editar)
  const handleOpenItemModal = (item?: ExpensePlanItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        category: item.category,
        name: item.name,
        cost_type: item.cost_type,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        original_currency: item.original_currency || 'BRL',
        status: item.status,
        payment_method: item.payment_method || 'dinheiro',
        notes: item.notes || ''
      });
    } else {
      setEditingItem(null);
      setItemForm({
        category: uniqueCategories[0] || 'Transporte',
        name: '',
        cost_type: 'fixo',
        quantity: 1,
        unit_cost: 0,
        original_currency: activePlan?.currency || 'BRL',
        status: 'planejado',
        payment_method: 'dinheiro',
        notes: ''
      });
    }
    setIsItemModalOpen(true);
  };

  // Submeter Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan || !itemForm.name.trim()) return;

    if (editingItem) {
      await updateItem(activePlan.id, editingItem.id, {
        category: itemForm.category,
        name: itemForm.name,
        cost_type: itemForm.cost_type,
        quantity: Number(itemForm.quantity) || 1,
        unit_cost: Number(itemForm.unit_cost) || 0,
        original_currency: itemForm.original_currency,
        original_amount: Number(itemForm.unit_cost) || 0,
        status: itemForm.status,
        payment_method: itemForm.payment_method,
        notes: itemForm.notes
      });
    } else {
      await addItem(activePlan.id, {
        category: itemForm.category,
        name: itemForm.name,
        cost_type: itemForm.cost_type,
        quantity: Number(itemForm.quantity) || 1,
        unit_cost: Number(itemForm.unit_cost) || 0,
        original_currency: itemForm.original_currency,
        original_amount: Number(itemForm.unit_cost) || 0,
        status: itemForm.status,
        payment_method: itemForm.payment_method,
        notes: itemForm.notes
      });
    }

    setIsItemModalOpen(false);
  };

  // Exportar / Conectar com Metas
  const handleExportToGoal = async () => {
    if (!activePlan) return;
    setIsExportingGoal(true);
    setExportSuccessMessage(null);
    try {
      await exportPlanToGoal(activePlan.id);
      setExportSuccessMessage('Meta sincronizada com sucesso no módulo de Metas!');
      setTimeout(() => setExportSuccessMessage(null), 5000);
    } catch (err: any) {
      alert('Não foi possível exportar a meta: ' + err.message);
    } finally {
      setIsExportingGoal(false);
    }
  };

  // Atualizar aporte mensal rapidamente via slider
  const handleMonthlyContributionChange = (newVal: number) => {
    if (!activePlan) return;
    updatePlan(activePlan.id, { monthly_contribution_capacity: newVal });
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Icon name="progress_activity" className="animate-spin text-[#006c49] dark:text-[#4edea3]" size="xl" />
        <p className="text-gray-500 font-medium">Carregando planejamentos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header Limpo & Elegante */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Previsão de Gastos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Orçamento granular com cálculo de datas e aporte mensal coerente
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon="tune"
            onClick={handleOpenConfigModal}
            disabled={!activePlan}
            className="rounded-xl text-xs sm:text-sm"
          >
            Ajustar Plano
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon="add"
            onClick={handleOpenNewPlanModal}
            className="rounded-xl shadow-xs text-xs sm:text-sm"
          >
            Novo Planejamento
          </Button>
        </div>
      </div>

      {/* Alerta de Sucesso na Exportação para Metas */}
      {exportSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" className="text-emerald-600 dark:text-emerald-400" />
            <span>{exportSuccessMessage}</span>
          </div>
          <Link href="/metas" className="font-semibold underline hover:opacity-80 text-xs">
            Ir para Metas →
          </Link>
        </div>
      )}

      {/* Seletor de Planos Ativos (Pills Modernos) */}
      {plans.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {plans.map((p) => {
            const isActive = p.id === activePlanId;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all whitespace-nowrap border shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-[#1a2332] text-gray-900 dark:text-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-white/60 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color || '#0ea5e9' }}
                />
                <Icon name={p.icon || 'flight'} size="xs" />
                <span>{p.title}</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  ({p.items?.length || 0})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo Principal do Plano Ativo */}
      {activePlan && totals ? (
        <div className="flex flex-col gap-5">
          {/* Card Resumo Executivo Compacto */}
          <GlassCard className="p-4 sm:p-5 border border-gray-200/70 dark:border-gray-800 rounded-2xl relative shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                  style={{ backgroundColor: activePlan.color || '#0ea5e9' }}
                >
                  <Icon name={activePlan.icon || 'flight'} size="md" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                      {activePlan.title}
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/20">
                      {PLAN_TEMPLATES[activePlan.category_type]?.title || activePlan.category_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span>{activePlan.days_count} dias</span>
                    <span>•</span>
                    <span>{activePlan.people_count} {activePlan.people_count === 1 ? 'pessoa' : 'pessoas'}</span>
                    {activePlan.contingency_percent > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-600 dark:text-amber-400">+{activePlan.contingency_percent}% reserva</span>
                      </>
                    )}
                    {activePlan.currency !== 'BRL' && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          1 {activePlan.currency} = R$ {activePlan.exchange_rate.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão Sincronizar com Metas */}
              <button
                type="button"
                onClick={handleExportToGoal}
                disabled={isExportingGoal}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1.5"
              >
                <Icon name="flag" size="xs" className="text-emerald-600 dark:text-emerald-400" />
                <span>{activePlan.goal_id ? 'Sincronizado com Metas' : 'Vincular a Metas'}</span>
              </button>
            </div>

            {/* 3 Métricas Essenciais em Linha */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium block">Orçamento Total</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 block">
                  {formatCurrency(totals.grandTotal)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  Subtotal {formatCurrency(totals.subtotal)} (+{formatCurrency(totals.contingencyAmount)} reserva)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium block">
                  Já Pago / Guardado ({totals.savedPercentage}%)
                </span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {formatCurrency(totals.paidAmount + totals.savedAmount)}
                </span>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">
                  {formatCurrency(totals.paidAmount)} pago • {formatCurrency(totals.savedAmount)} guardado
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20">
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium block">
                  Falta Poupar
                </span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">
                  {formatCurrency(totals.remainingToSave)}
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 block mt-0.5">
                  Valor alvo para alcançar o plano
                </span>
              </div>
            </div>

            {/* Barra de Progresso Fina */}
            <div className="mt-4">
              <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${totals.paidPercentage}%` }}
                  title={`Já Pago: ${totals.paidPercentage}%`}
                />
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${Math.max(0, totals.savedPercentage - totals.paidPercentage)}%` }}
                  title={`Já Guardado: ${totals.savedPercentage - totals.paidPercentage}%`}
                />
              </div>
            </div>
          </GlassCard>

          {/* Segmented Control - Abas Limpas */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/70 rounded-2xl w-full sm:w-fit border border-gray-200/50 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab('itens')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'itens'
                  ? 'bg-white dark:bg-[#1a2332] text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="receipt_long" size="xs" />
              <span>Despesas & Itens</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gray-200/70 dark:bg-gray-700 font-normal">
                {activePlan.items?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('simulador')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'simulador'
                  ? 'bg-white dark:bg-[#1a2332] text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="calculate" size="xs" className="text-emerald-500" />
              <span>Simulador de Prazos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('metricas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'metricas'
                  ? 'bg-white dark:bg-[#1a2332] text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="pie_chart" size="xs" />
              <span>Visão Geral & Categorias</span>
            </button>
          </div>

          {/* ABA 1: ITENS & DESPESAS (Operação Limpa) */}
          {activeTab === 'itens' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filtro de Categoria */}
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2332] px-3 py-1.5 text-gray-700 dark:text-gray-300"
                  >
                    <option value="todos">Todas as Categorias</option>
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Filtro de Status */}
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a2332] px-3 py-1.5 text-gray-700 dark:text-gray-300"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="planejado">Planejados</option>
                    <option value="reservado">Reservados</option>
                    <option value="pago">Já Pagos</option>
                  </select>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon="add"
                  onClick={() => handleOpenItemModal()}
                  className="rounded-xl shadow-xs self-start sm:self-auto text-xs"
                >
                  Adicionar Despesa
                </Button>
              </div>

              {/* Listagem dos Itens */}
              {filteredItems.length === 0 ? (
                <EmptyState
                  icon="receipt_long"
                  title="Nenhum item encontrado"
                  description="Adicione itens de despesas ou altere os filtros selecionados."
                  actionLabel="Adicionar Primeiro Item"
                  onAction={() => handleOpenItemModal()}
                />
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredItems.map((item) => {
                    const isPaid = item.status === 'pago';
                    const isReserved = item.status === 'reservado';

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all ${
                          isPaid
                            ? 'bg-emerald-50/15 dark:bg-emerald-950/10 border-emerald-500/20 opacity-80'
                            : 'bg-white dark:bg-[#1a2332] border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checkbox de Status Pago */}
                          <button
                            type="button"
                            onClick={() => toggleItemPaid(activePlan.id, item.id)}
                            title={isPaid ? 'Marcar como não pago' : 'Marcar como pago'}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                              isPaid
                                ? 'bg-emerald-500 text-white'
                                : 'border border-gray-300 dark:border-gray-600 hover:border-emerald-500 text-transparent'
                            }`}
                          >
                            <Icon name="check" size="xs" />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm truncate ${isPaid ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                {item.name}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                                {item.category}
                              </span>
                              {isReserved && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                  Reservado
                                </span>
                              )}
                              {isPaid && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                                  Pago
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                              {item.cost_type === 'diario' && (
                                <span>{formatCurrency(item.unit_cost)}/dia × {item.quantity}d</span>
                              )}
                              {item.cost_type === 'unitario' && (
                                <span>{formatCurrency(item.unit_cost)} × {item.quantity}p</span>
                              )}
                              {item.notes && (
                                <span className="text-gray-400 italic">“{item.notes}”</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lado Direito: Valor e Ações */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800 shrink-0">
                          <div className="text-right">
                            <span className={`text-sm sm:text-base font-bold ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                              {formatCurrency(item.total_brl)}
                            </span>
                            {item.original_currency !== 'BRL' && typeof item.original_amount === 'number' && item.original_amount > 0 && (
                              <div className="text-[10px] text-gray-400">
                                {item.original_currency} {item.original_amount.toFixed(2)}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenItemModal(item)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title="Editar item"
                            >
                              <Icon name="edit" size="xs" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(activePlan.id, item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-colors"
                              title="Excluir item"
                            >
                              <Icon name="delete" size="xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: SIMULADOR DE PRAZOS & APORTES */}
          {activeTab === 'simulador' && (
            <GlassCard className="p-5 border border-gray-200/70 dark:border-gray-800 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Icon name="calculate" size="sm" className="text-emerald-500" />
                    Simulador de Viabilidade & Prazos
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Descubra datas coerentes e simule o poder dos juros compostos
                  </p>
                </div>

                {/* Alternância de Modo */}
                <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSimulatorMode('pelo_aporte')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      simulatorMode === 'pelo_aporte'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Tenho um Aporte Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorMode('pelo_prazo')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      simulatorMode === 'pelo_prazo'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Tenho uma Data Limite
                  </button>
                </div>
              </div>

              {simulatorMode === 'pelo_aporte' ? (
                <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Slider de Aporte */}
                  <div className="lg:col-span-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Capacidade de Aporte Mensal:
                      </span>
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(activePlan.monthly_contribution_capacity || 0)}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="50"
                      value={activePlan.monthly_contribution_capacity || 500}
                      onChange={(e) => handleMonthlyContributionChange(Number(e.target.value))}
                      className="w-full accent-emerald-600 dark:accent-emerald-400 cursor-pointer h-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    />

                    <div className="flex gap-2 flex-wrap">
                      {[300, 500, 1000, 1500, 2500].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleMonthlyContributionChange(preset)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            activePlan.monthly_contribution_capacity === preset
                              ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-500'
                          }`}
                        >
                          R$ {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cards de Previsão */}
                  <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <span>Com Rendimento CDI</span>
                          <Icon name="verified" size="xs" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                          {targetDateResult?.formattedDateWithInterest}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Em <strong>{targetDateResult?.monthsNeededWithInterest} meses</strong> de economia.
                        </p>
                      </div>

                      {targetDateResult && targetDateResult.interestSaved > 0 && (
                        <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          +{formatCurrency(targetDateResult.interestSaved)} gerados por juros!
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Poupança / Sem Juros
                        </span>
                        <h4 className="text-base font-bold text-gray-700 dark:text-gray-300 mt-1">
                          {targetDateResult?.formattedDateNoInterest}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Necessita de <strong>{targetDateResult?.monthsNeededNoInterest} meses</strong>.
                        </p>
                      </div>
                      <div className="mt-2 text-[10px] text-gray-400">
                        Faltam {formatCurrency(totals.remainingToSave)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  <div className="sm:col-span-5 flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Quando você deseja realizar este plano?
                    </label>
                    <Input
                      type="date"
                      value={fixedTargetDate}
                      onChange={(e) => setFixedTargetDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="sm:col-span-7">
                    {requiredDepositResult ? (
                      <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-500/30 flex flex-col gap-1">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Aporte Mensal Necessário
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(requiredDepositResult.monthlyDeposit)}
                          </span>
                          <span className="text-xs text-gray-500">/ mês</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          Você tem <strong>{requiredDepositResult.monthsRemaining} meses</strong> até a data escolhida.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Selecione uma data para calcular o aporte mensal necessário.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* ABA 3: VISÃO GERAL & CATEGORIAS */}
          {activeTab === 'metricas' && (
            <div className="flex flex-col gap-4">
              {/* Médias Rápidas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a2332] border border-gray-200/70 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <Icon name="person" size="sm" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">Custo por Pessoa</span>
                      <strong className="text-base font-bold text-gray-900 dark:text-white">
                        {formatCurrency(totals.costPerPerson)}
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{activePlan.people_count} participantes</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-[#1a2332] border border-gray-200/70 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <Icon name="schedule" size="sm" />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block font-medium">Custo Diário Médio</span>
                      <strong className="text-base font-bold text-gray-900 dark:text-white">
                        {formatCurrency(totals.costPerDay)} / dia
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{activePlan.days_count} dias</span>
                </div>
              </div>

              {/* Distribuição por Categorias */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1a2332] border border-gray-200/70 dark:border-gray-800">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icon name="pie_chart" size="xs" className="text-emerald-500" />
                  Distribuição Orçamentária por Categoria
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {totals.categories.map((cat) => (
                    <div
                      key={cat.category}
                      onClick={() => {
                        setSelectedCategoryFilter(cat.category);
                        setActiveTab('itens');
                      }}
                      className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-500/50 bg-gray-50/50 dark:bg-gray-900/30 transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {cat.category}
                        </span>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          {cat.percentage}%
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCurrency(cat.total)}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {cat.itemCount} {cat.itemCount === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200/60 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon="add_chart"
          title="Nenhum planejamento ativo"
          description="Crie seu primeiro orçamento inteligente de Viagem, Reforma, Casamento ou Compra de Veículo."
          actionLabel="Criar Novo Planejamento"
          onAction={handleOpenNewPlanModal}
        />
      )}

      {/* MODAL 1: NOVO PLANEJAMENTO (COM SELETOR DE TEMPLATES) */}
      <Modal
        isOpen={isNewPlanModalOpen}
        onClose={() => setIsNewPlanModalOpen(false)}
        title="Criar Novo Planejamento & Previsão de Gastos"
        size="xl"
      >
        <form onSubmit={handleCreatePlan} className="flex flex-col gap-5">
          {/* Seletor de Tipo / Usabilidade */}
          <div>
            <label className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 block">
              Selecione o Tipo de Projeto (Template):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(PLAN_TEMPLATES) as PlanCategoryType[]).map((key) => {
                const tpl = PLAN_TEMPLATES[key];
                const isSelected = newPlanForm.category_type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectTemplate(key)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 font-bold text-gray-900 dark:text-white'
                        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <Icon name={tpl.icon} className="mb-1 text-emerald-600 dark:text-emerald-400" size="md" />
                    <span className="text-xs leading-tight">{tpl.title.split('/')[0].trim()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Título do Planejamento"
            placeholder="Ex: Férias em Orlando 2027, Reforma do Apartamento, Casamento..."
            value={newPlanForm.title}
            onChange={(e) => setNewPlanForm({ ...newPlanForm, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              min="1"
              label="Duração (Dias)"
              value={newPlanForm.days_count}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, days_count: Number(e.target.value) })}
            />
            <Input
              type="number"
              min="1"
              label="Pessoas / Participantes"
              value={newPlanForm.people_count}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, people_count: Number(e.target.value) })}
            />
            <Input
              type="number"
              min="0"
              max="50"
              label="Margem de Imprevistos (%)"
              value={newPlanForm.contingency_percent}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, contingency_percent: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              min="0"
              step="50"
              label="Aporte Mensal Disponível (R$)"
              helperText="Quanto você pretende poupar por mês para este plano"
              value={newPlanForm.monthly_contribution_capacity}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, monthly_contribution_capacity: Number(e.target.value) })}
            />
            <Input
              type="number"
              min="0"
              step="50"
              label="Saldo Já Guardado (R$)"
              helperText="Caso já tenha economias reservadas para este plano"
              value={newPlanForm.current_saved_amount}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, current_saved_amount: Number(e.target.value) })}
            />
          </div>

          {/* Opção de pré-carregar itens sugeridos */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={newPlanForm.useTemplateItems}
              onChange={(e) => setNewPlanForm({ ...newPlanForm, useTemplateItems: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Preencher automaticamente com a lista detalhada recomendada para <strong>{PLAN_TEMPLATES[newPlanForm.category_type]?.title}</strong> (você poderá editar ou excluir qualquer item depois).
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button variant="ghost" type="button" onClick={() => setIsNewPlanModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Criar Planejamento
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: AJUSTAR PARÂMETROS / CONFIGURAÇÕES DO PLANO */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Ajustar Parâmetros do Planejamento"
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">
          <Input
            label="Título"
            value={configForm.title}
            onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Dias de Duração"
              value={configForm.days_count}
              onChange={(e) => setConfigForm({ ...configForm, days_count: Number(e.target.value) })}
            />
            <Input
              type="number"
              label="Pessoas"
              value={configForm.people_count}
              onChange={(e) => setConfigForm({ ...configForm, people_count: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Aporte Mensal (R$)"
              value={configForm.monthly_contribution_capacity}
              onChange={(e) => setConfigForm({ ...configForm, monthly_contribution_capacity: Number(e.target.value) })}
            />
            <Input
              type="number"
              label="Já Guardado (R$)"
              value={configForm.current_saved_amount}
              onChange={(e) => setConfigForm({ ...configForm, current_saved_amount: Number(e.target.value) })}
            />
          </div>

          <Input
            type="number"
            label="Margem de Imprevistos (%)"
            helperText="Recomendado: 10% a 15% para viagens e reformas"
            value={configForm.contingency_percent}
            onChange={(e) => setConfigForm({ ...configForm, contingency_percent: Number(e.target.value) })}
          />

          {/* Configurações de Câmbio TrabeePocket */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Moeda Estrangeira & Câmbio
            </span>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Moeda Principal"
                value={configForm.currency}
                onChange={(e) => setConfigForm({ ...configForm, currency: e.target.value })}
                options={[
                  { label: 'Real (BRL R$)', value: 'BRL' },
                  { label: 'Dólar (USD $)', value: 'USD' },
                  { label: 'Euro (EUR €)', value: 'EUR' },
                  { label: 'Libra (GBP £)', value: 'GBP' }
                ]}
              />
              <Input
                type="number"
                step="0.01"
                label="Cotação em Reais"
                value={configForm.exchange_rate}
                onChange={(e) => setConfigForm({ ...configForm, exchange_rate: Number(e.target.value) })}
                disabled={configForm.currency === 'BRL'}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                if (activePlan && confirm('Tem certeza que deseja excluir este planejamento?')) {
                  deletePlan(activePlan.id);
                  setIsConfigModalOpen(false);
                }
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Excluir este plano
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setIsConfigModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit">
                Salvar Alterações
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ADICIONAR / EDITAR ITEM DE DESPESA */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Editar Despesa Prevista' : 'Adicionar Despesa Prevista'}
        size="md"
      >
        <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
          <Input
            label="Categoria"
            placeholder="Ex: Passagens, Transporte, Hospedagem, Alimentação..."
            value={itemForm.category}
            onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
            required
          />

          <Input
            label="Descrição / Nome do Item"
            placeholder="Ex: Carro alugado 7 dias, Almoço diário, Ingressos..."
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            required
          />

          {/* Tipo de Custo TrabeePocket: Fixo vs Diário vs Por Pessoa */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Formato do Custo:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'fixo', label: 'Fixo Único', icon: 'payments' },
                { type: 'diario', label: 'Diário (× Dias)', icon: 'calendar_month' },
                { type: 'unitario', label: 'Por Pessoa', icon: 'group' }
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    const defaultQty = opt.type === 'diario' ? (activePlan?.days_count || 1) : opt.type === 'unitario' ? (activePlan?.people_count || 1) : 1;
                    setItemForm({ ...itemForm, cost_type: opt.type as CostType, quantity: defaultQty });
                  }}
                  className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                    itemForm.cost_type === opt.type
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Icon name={opt.icon} size="xs" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              min="0"
              label="Valor Unitário"
              value={itemForm.unit_cost}
              onChange={(e) => setItemForm({ ...itemForm, unit_cost: Number(e.target.value) })}
              required
            />
            <Input
              type="number"
              min="1"
              label={itemForm.cost_type === 'diario' ? 'Quantidade de Dias' : itemForm.cost_type === 'unitario' ? 'Quantidade de Pessoas' : 'Unidades'}
              value={itemForm.quantity}
              onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
              disabled={itemForm.cost_type === 'fixo'}
            />
          </div>

          {/* Moeda e Status */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Moeda"
              value={itemForm.original_currency}
              onChange={(e) => setItemForm({ ...itemForm, original_currency: e.target.value })}
              options={[
                { label: 'Real (BRL R$)', value: 'BRL' },
                { label: 'Dólar (USD $)', value: 'USD' },
                { label: 'Euro (EUR €)', value: 'EUR' }
              ]}
            />
            <Select
              label="Status Atual"
              value={itemForm.status}
              onChange={(e) => setItemForm({ ...itemForm, status: e.target.value as ItemStatus })}
              options={[
                { label: 'Planejado (A Poupar)', value: 'planejado' },
                { label: 'Reservado (Compromisso)', value: 'reservado' },
                { label: 'Já Pago / Liquidado', value: 'pago' }
              ]}
            />
          </div>

          <Input
            label="Observações / Detalhes (Opcional)"
            placeholder="Ex: Reserva n° 12345, check-in às 14h, franquia de bagagem..."
            value={itemForm.notes}
            onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
          />

          {/* Pré-visualização do Total do Item */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Total Calculado em Reais:</span>
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(
                calculateItemTotalBrl(
                  itemForm,
                  activePlan?.exchange_rate || 1,
                  activePlan?.include_iof || false,
                  activePlan?.iof_rate || 4.38
                )
              )}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button variant="ghost" type="button" onClick={() => setIsItemModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingItem ? 'Salvar Item' : 'Adicionar ao Planejamento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
