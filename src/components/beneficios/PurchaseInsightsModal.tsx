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
  justificativaConsumo?: string;
  tipoItem?: 'estocavel' | 'semanal';
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
  'Analisando histórico de compras e dias da semana...',
  'Cruzando itens de feira com calendários promocionais (Quarta da Feira)...',
  'Mapeando compras picadas e itens recorrentes...',
  'Calculando ritmo de consumo do saldo e economia estimada...'
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
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [isMonthlyListExpanded, setIsMonthlyListExpanded] = useState(true);

  // Initialize selected items when monthly list suggestion arrives
  useEffect(() => {
    if (insightsData?.listaMensalSugerida?.itens) {
      const initial: Record<string, boolean> = {};
      insightsData.listaMensalSugerida.itens.forEach(it => {
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

  const monthlyItems = insightsData?.listaMensalSugerida?.itens || [];
  const selectedCount = monthlyItems.filter(it => selectedItems[it.nome] !== false).length;
  const selectedTotal = monthlyItems
    .filter(it => selectedItems[it.nome] !== false)
    .reduce((acc, it) => acc + (Number(it.quantidadeSugerida) || 1) * (Number(it.precoUnitarioMedio) || 0), 0);

  const handleToggleItem = (name: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [name]: prev[name] === false ? true : false
    }));
  };

  const handleToggleAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    monthlyItems.forEach(it => {
      updated[it.nome] = select;
    });
    setSelectedItems(updated);
  };

  const handleGenerateMonthlyList = () => {
    if (!insightsData?.listaMensalSugerida) return;
    const activeItems = monthlyItems.filter(it => selectedItems[it.nome] !== false);
    if (activeItems.length === 0) return;

    if (onCreateMonthlyListFromInsights) {
      onCreateMonthlyListFromInsights({
        ...insightsData.listaMensalSugerida,
        itens: activeItems
      });
    } else if (onCreateListFromInsights) {
      onCreateListFromInsights(activeItems.map(it => `${it.nome} (${it.quantidadeSugerida} ${it.unidade})`));
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
      title="Assistente de Compras & Insights com IA"
      size="xl"
    >
      <div className="space-y-5">
        {/* Top Overview Box */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/20">
              <Icon name="auto_awesome" size="md" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Inteligência Artificial Analisando Suas Compras
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
            {/* Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-blue-500/15 border border-emerald-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Icon name="psychology" size="sm" className="!text-sm" /> Diagnóstico do Fluxo de Compras
                </span>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {insightsData.resumoAnalise}
                </p>
              </div>

              {insightsData.economiaTotalEstimada && (
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-500/30 text-right shrink-0">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Potencial de Economia</span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {insightsData.economiaTotalEstimada}
                  </span>
                </div>
              )}
            </div>

            {/* Insights Cards List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Oportunidades e Padrões Detectados
              </span>

              <div className="grid grid-cols-1 gap-3">
                {insightsData.insights.map((insight) => {
                  const style = getColorStyles(insight.cor);

                  return (
                    <div
                      key={insight.id}
                      className={`p-4 rounded-xl border ${style.border} ${style.bg} transition-all space-y-2.5`}
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

            {/* Sugestão de Abastecimento Mensal com base em Consumo */}
            {insightsData.listaMensalSugerida && insightsData.listaMensalSugerida.itens?.length > 0 ? (
              <div className="rounded-xl bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/80 dark:from-blue-950/40 dark:via-gray-900 dark:to-indigo-950/40 border border-blue-200/90 dark:border-blue-800/60 shadow-xs overflow-hidden">
                {/* Header */}
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-100/80 dark:border-blue-900/40">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Icon name="shopping_cart" size="sm" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                          {insightsData.listaMensalSugerida.titulo || 'Lista de Abastecimento Mensal (IA)'}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                          Projeção 30 Dias
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {insightsData.listaMensalSugerida.resumoConsumo || 'Quantidades estimadas com base no seu consumo real das últimas compras.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Total Previsto</div>
                      <div className="text-sm font-black text-blue-600 dark:text-blue-400">
                        R$ {selectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMonthlyListExpanded(!isMonthlyListExpanded)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                      title={isMonthlyListExpanded ? 'Recolher itens' : 'Expandir itens'}
                    >
                      <Icon name={isMonthlyListExpanded ? 'expand_less' : 'expand_more'} size="sm" />
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {isMonthlyListExpanded && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pb-1">
                      <span className="font-medium">
                        {selectedCount} de {insightsData.listaMensalSugerida.itens.length} itens selecionados
                      </span>
                      <div className="flex items-center gap-2">
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
                          Desmarcar todos
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {insightsData.listaMensalSugerida.itens.map((item, idx) => {
                        const isChecked = selectedItems[item.nome] !== false;
                        const subtotal = (Number(item.quantidadeSugerida) || 1) * (Number(item.precoUnitarioMedio) || 0);

                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleItem(item.nome)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-white dark:bg-gray-800/95 border-blue-200 dark:border-blue-900/60 shadow-2xs'
                                : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-800 opacity-60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by container click
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`font-semibold truncate ${isChecked ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 line-through'}`}>
                                  {item.nome}
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white shrink-0">
                                  R$ {subtotal.toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
                                    {item.quantidadeSugerida} {item.unidade}
                                  </span>
                                  <span>(R$ {Number(item.precoUnitarioMedio || 0).toFixed(2)} un)</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                  item.tipoItem === 'estocavel'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                }`}>
                                  {item.tipoItem === 'estocavel' ? 'Mês Todo' : 'Semanal'}
                                </span>
                              </div>

                              {item.justificativaConsumo && (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic line-clamp-1">
                                  {item.justificativaConsumo}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Button to Create List in Compras */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-blue-100/60 dark:border-blue-900/30">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 text-center sm:text-left">
                        Será gerada uma nova lista pronta em Compras com estas quantidades e preços médios.
                      </span>

                      <Button
                        size="sm"
                        variant="primary"
                        disabled={selectedCount === 0}
                        onClick={handleGenerateMonthlyList}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Icon name="playlist_add_check" size="sm" />
                        <span>Gerar Lista do Mês ({selectedCount} itens)</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: Lista simples de itens */
              insightsData.itensSugeridosParaLista && insightsData.itensSugeridosParaLista.length > 0 && onCreateListFromInsights && (
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                      <Icon name="format_list_bulleted" size="sm" className="text-blue-600 dark:text-blue-400" />
                      <span>Criar Lista Automática de Reposição</span>
                    </div>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      Itens essenciais detectados: {insightsData.itensSugeridosParaLista.slice(0, 5).join(', ')}...
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onCreateListFromInsights(insightsData.itensSugeridosParaLista!)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs whitespace-nowrap flex items-center gap-1 shrink-0"
                  >
                    <Icon name="playlist_add" size="sm" /> Gerar Lista de Compras
                  </Button>
                </div>
              )
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
            <span>Atualizar Análise</span>
          </Button>

          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
