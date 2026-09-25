'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { BenefitTransaction } from '@/hooks/useBenefitCards';

export interface PurchaseInsight {
  id: string;
  tipo: 'timing' | 'fracionada' | 'fluxo' | 'preco' | string;
  titulo: string;
  descricao: string;
  impacto?: string;
  badge?: string;
  cor?: 'emerald' | 'purple' | 'amber' | 'blue' | string;
  icone?: string;
}

export interface MonthlySuggestedItem {
  nome: string;
  categoria?: string;
  quantidadeSugerida: number;
  unidade: string;
  precoUnitarioMedio: number;
  precoTotalEstimado?: number;
  justificativaConsumo?: string;
  tipoItem?: 'estocavel' | 'semanal' | 'quinzenal';
  dicaEconomia?: string;
}

export interface MonthlyShoppingListSuggestion {
  titulo: string;
  custoEstimadoTotal: number;
  resumoConsumo?: string;
  itens: MonthlySuggestedItem[];
}

export interface PurchaseInsightsData {
  resumoAnalise: string;
  economiaTotalEstimada?: string;
  insights: PurchaseInsight[];
  itensSugeridosParaLista?: string[];
  listaMensalSugerida?: MonthlyShoppingListSuggestion;
}

interface PurchaseInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: BenefitTransaction[];
  onCreateListFromInsights?: (suggestedItems: string[]) => void;
  onCreateMonthlyListFromInsights?: (suggestion: MonthlyShoppingListSuggestion) => void;
}

const LOADING_STEPS = [
  'Avaliando todas as compras do mês e histórico de consumo...',
  'Cruzando itens de feira com calendários promocionais (Quarta da Feira)...',
  'Mapeando produtos estocáveis, despensa e compras picadas...',
  'Calculando projeção de quantidades para 30 dias e média de preços...'
];

export function PurchaseInsightsModal({
  isOpen,
  onClose,
  transactions,
  onCreateListFromInsights,
  onCreateMonthlyListFromInsights
}: PurchaseInsightsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<PurchaseInsightsData | null>(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  // Editable items state
  const [itemsList, setItemsList] = useState<MonthlySuggestedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'lista' | 'insights'>('lista');

  // Sync items when API returns
  useEffect(() => {
    if (insightsData?.listaMensalSugerida?.itens) {
      const items = insightsData.listaMensalSugerida.itens;
      setItemsList(items);
      const initial: Record<string, boolean> = {};
      items.forEach(it => {
        initial[it.nome] = true;
      });
      setSelectedItems(initial);
    }
  }, [insightsData]);

  // Rotate loading step phrases
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStepIndex(prev => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const analyzePurchases = async () => {
    setLoading(true);
    setError(null);
    setLoadingStepIndex(0);

    try {
      const response = await fetch('/api/ai/analyze-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Falha ao analisar compras.');
      }

      setInsightsData(result);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado na análise de compras.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-trigger analysis when opened if not loaded yet
  useEffect(() => {
    if (isOpen && !insightsData && !loading) {
      analyzePurchases();
    }
  }, [isOpen]);

  const handleToggleItem = (name: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [name]: prev[name] === false ? true : false
    }));
  };

  const handleToggleAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    itemsList.forEach(it => {
      updated[it.nome] = select;
    });
    setSelectedItems(updated);
  };

  const handleQuantityChange = (name: string, delta: number) => {
    setItemsList(prev =>
      prev.map(it => {
        if (it.nome === name) {
          const newQty = Math.max(1, Number(it.quantidadeSugerida || 1) + delta);
          return { ...it, quantidadeSugerida: newQty };
        }
        return it;
      })
    );
  };

  const handlePriceChange = (name: string, newPrice: number) => {
    setItemsList(prev =>
      prev.map(it => {
        if (it.nome === name) {
          return { ...it, precoUnitarioMedio: Math.max(0, newPrice) };
        }
        return it;
      })
    );
  };

  // Calculations
  const selectedActiveItems = itemsList.filter(it => selectedItems[it.nome] !== false);
  const selectedCount = selectedActiveItems.length;
  const selectedTotal = selectedActiveItems.reduce(
    (acc, it) => acc + (Number(it.quantidadeSugerida) || 1) * (Number(it.precoUnitarioMedio) || 0),
    0
  );

  // Categories extraction for filtering
  const categoriesList = ['todos', ...Array.from(new Set(itemsList.map(it => it.categoria || 'Alimentação')))];

  const filteredItems = itemsList.filter(it => {
    if (activeCategoryFilter === 'todos') return true;
    if (activeCategoryFilter === 'estocavel') return it.tipoItem === 'estocavel';
    if (activeCategoryFilter === 'semanal') return it.tipoItem === 'semanal';
    return (it.categoria || 'Alimentação') === activeCategoryFilter;
  });

  const handleGenerateMonthlyList = () => {
    if (selectedActiveItems.length === 0) return;

    if (onCreateMonthlyListFromInsights) {
      onCreateMonthlyListFromInsights({
        titulo: insightsData?.listaMensalSugerida?.titulo || 'Abastecimento Mensal de Começo de Mês',
        custoEstimadoTotal: Number(selectedTotal.toFixed(2)),
        resumoConsumo: insightsData?.listaMensalSugerida?.resumoConsumo || 'Lista calculada com base no seu consumo real para o mês todo.',
        itens: selectedActiveItems
      });
    } else if (onCreateListFromInsights) {
      onCreateListFromInsights(selectedActiveItems.map(it => `${it.nome} (${it.quantidadeSugerida} ${it.unidade})`));
    }
  };

  const getColorStyles = (color?: string) => {
    switch (color) {
      case 'purple':
        return {
          bg: 'bg-purple-500/10 dark:bg-purple-950/30',
          border: 'border-purple-200 dark:border-purple-800/60',
          text: 'text-purple-700 dark:text-purple-300',
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
          iconBg: 'bg-purple-500 text-white'
        };
      case 'amber':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800/60',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
          iconBg: 'bg-amber-500 text-white'
        };
      case 'blue':
        return {
          bg: 'bg-blue-500/10 dark:bg-blue-950/30',
          border: 'border-blue-200 dark:border-blue-800/60',
          text: 'text-blue-700 dark:text-blue-300',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
          iconBg: 'bg-blue-500 text-white'
        };
      case 'emerald':
      default:
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
          border: 'border-emerald-200 dark:border-emerald-800/60',
          text: 'text-emerald-700 dark:text-emerald-300',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
          iconBg: 'bg-emerald-500 text-white'
        };
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assistente de Compras & Lista do Mês (IA)"
      size="xl"
    >
      <div className="space-y-4">
        {/* Loading State */}
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20">
              <Icon name="auto_awesome" size="md" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Analisando Todo o Seu Consumo & Projetando Lista do Mês
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[20px] transition-all animate-pulse">
                {LOADING_STEPS[loadingStepIndex]}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 space-y-3">
            <div className="flex items-center gap-2 font-bold">
              <Icon name="error" size="sm" />
              <span>Não foi possível gerar a análise</span>
            </div>
            <p>{error}</p>
            <Button size="sm" variant="secondary" onClick={analyzePurchases}>
              Tentar Novamente
            </Button>
          </div>
        ) : insightsData ? (
          <>
            {/* Top Diagnostic Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-blue-500/15 border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Icon name="psychology" size="sm" className="!text-sm" /> Diagnóstico do Mês & Hábitos de Consumo
                </span>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {insightsData.resumoAnalise}
                </p>
              </div>

              {insightsData.economiaTotalEstimada && (
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-500/30 text-right shrink-0">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Potencial de Economia</span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {insightsData.economiaTotalEstimada}
                  </span>
                </div>
              )}
            </div>

            {/* Main Tabs: Lista do Mês (Prioritária) vs Oportunidades & Padrões */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
              <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('lista')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'lista'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="shopping_cart" size="sm" className="!text-sm" />
                  <span>Lista de Abastecimento do Mês ({itemsList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('insights')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'insights'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon name="lightbulb" size="sm" className="!text-sm" />
                  <span>Dicas & Padrões ({insightsData.insights?.length || 0})</span>
                </button>
              </div>

              {activeTab === 'lista' && (
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Previsão Total</span>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                    R$ {selectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* TAB 1: LISTA DE ABASTECIMENTO MENSAL INTELIGENTE */}
            {activeTab === 'lista' && (
              <div className="space-y-3">
                {/* Filter Pills & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setActiveCategoryFilter('todos')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        activeCategoryFilter === 'todos'
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      Todos ({itemsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCategoryFilter('estocavel')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        activeCategoryFilter === 'estocavel'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-200/80'
                      }`}
                    >
                      📦 Despensa (Mês Todo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCategoryFilter('semanal')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        activeCategoryFilter === 'semanal'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-200/80'
                      }`}
                    >
                      🥦 Frescos / Feira (Semanal)
                    </button>
                  </div>

                  {/* Bulk toggle */}
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {selectedCount} de {itemsList.length} itens marcados
                    </span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                    >
                      Marcar todos
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredItems.map((item) => {
                    const isChecked = selectedItems[item.nome] !== false;
                    const subtotal = (Number(item.quantidadeSugerida) || 1) * (Number(item.precoUnitarioMedio) || 0);

                    return (
                      <div
                        key={item.nome}
                        className={`p-3 rounded-xl border text-xs transition-all flex flex-col justify-between gap-2 ${
                          isChecked
                            ? 'bg-white dark:bg-gray-800/90 border-blue-200 dark:border-blue-900/60 shadow-xs'
                            : 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-200/50 dark:border-gray-800 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleItem(item.nome)}
                                className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer shrink-0"
                              />
                              <span className={`font-bold truncate ${isChecked ? 'text-gray-900 dark:text-white' : 'text-gray-500 line-through'}`}>
                                {item.nome}
                              </span>
                            </label>

                            <span className="font-extrabold text-blue-600 dark:text-blue-400 shrink-0">
                              R$ {subtotal.toFixed(2)}
                            </span>
                          </div>

                          {/* Consumption Justification & Dica */}
                          <div className="pl-6 mt-1 space-y-0.5">
                            {item.justificativaConsumo && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                {item.justificativaConsumo}
                              </p>
                            )}
                            {item.dicaEconomia && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                <Icon name="savings" size="sm" className="!text-xs shrink-0" />
                                <span>{item.dicaEconomia}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Interactive Quantity & Unit Price Controls */}
                        <div className="pl-6 pt-1 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800/80 text-[11px]">
                          {/* Quantity selector */}
                          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.nome, -1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold"
                              title="Diminuir quantidade"
                            >
                              -
                            </button>
                            <span className="font-bold text-gray-900 dark:text-white px-1">
                              {item.quantidadeSugerida} {item.unidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.nome, 1)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold"
                              title="Aumentar quantidade"
                            >
                              +
                            </button>
                          </div>

                          {/* Unit price indicator / editable */}
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <span>R$</span>
                            <input
                              type="number"
                              step="0.10"
                              value={item.precoUnitarioMedio || ''}
                              onChange={(e) => handlePriceChange(item.nome, parseFloat(e.target.value) || 0)}
                              className="w-14 px-1 py-0.5 text-right font-medium rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-[11px]"
                              title="Preço unitário médio pago"
                            />
                            <span>/{item.unidade}</span>
                          </div>

                          {/* Badge Tipo */}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            item.tipoItem === 'estocavel'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          }`}>
                            {item.tipoItem === 'estocavel' ? 'Mês Todo' : 'Semanal'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Finalize & Export to Compras Button */}
                <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-blue-100 dark:border-blue-900/40">
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
                    <span className="font-semibold text-gray-900 dark:text-white block">
                      Total Estimado para o Abastecimento: R$ {selectedTotal.toFixed(2)}
                    </span>
                    <span>Cria uma nova lista interativa em "Compras" pronta para levar ao mercado.</span>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    disabled={selectedCount === 0}
                    onClick={handleGenerateMonthlyList}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 flex items-center justify-center gap-2 shadow-md"
                  >
                    <Icon name="playlist_add_check" size="sm" />
                    <span>Gerar Lista do Mês ({selectedCount} itens)</span>
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: INSIGHTS & OPORTUNIDADES */}
            {activeTab === 'insights' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {insightsData.insights.map((insight) => {
                    const style = getColorStyles(insight.cor);

                    return (
                      <div
                        key={insight.id}
                        className={`p-4 rounded-xl border ${style.border} ${style.bg} transition-all space-y-2`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.iconBg} shadow-xs`}>
                              <Icon name={insight.icone || 'lightbulb'} size="sm" />
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                                {insight.titulo}
                              </h4>
                              {insight.badge && (
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${style.badge}`}>
                                  {insight.badge}
                                </span>
                              )}
                            </div>
                          </div>

                          {insight.impacto && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-lg shrink-0 text-right">
                              {insight.impacto}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pl-10">
                          {insight.descricao}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
          <Button
            size="sm"
            variant="ghost"
            onClick={analyzePurchases}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 flex items-center gap-1"
          >
            <Icon name="refresh" size="sm" className={loading ? 'animate-spin' : ''} />
            <span>Recalcular Análise</span>
          </Button>

          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
