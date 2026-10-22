'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/formatters';
import { ChainOptionItem, OptionsChainResponse } from '@/app/api/stocks/options/route';

interface AvailableOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  underlyingTicker: string;
  underlyingPrice?: number;
  initialType?: 'PUT' | 'CALL' | 'ALL';
  zoneFilter?: {
    type: 'PUT' | 'CALL';
    strikeCondition: 'lte' | 'gte';
    targetStrike: number;
    zoneLabel: string;
  };
  onSelectOption?: (option: ChainOptionItem) => void;
}

export function AvailableOptionsModal({
  isOpen,
  onClose,
  underlyingTicker,
  underlyingPrice = 0,
  initialType = 'ALL',
  zoneFilter,
  onSelectOption
}: AvailableOptionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainData, setChainData] = useState<OptionsChainResponse | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<'PUT' | 'CALL' | 'ALL'>(initialType);
  const [selectedVencimento, setSelectedVencimento] = useState<string>('ALL');
  const [selectedMoneyness, setSelectedMoneyness] = useState<'ALL' | 'OTM' | 'ATM' | 'ITM'>('ALL');
  const [onlyRecommendedZone, setOnlyRecommendedZone] = useState<boolean>(Boolean(zoneFilter));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);

  // Sync initial type when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType);
      setOnlyRecommendedZone(Boolean(zoneFilter));
      setSelectedVencimento('ALL');
      setSelectedMoneyness('ALL');
      setSearchQuery('');
    }
  }, [isOpen, initialType, zoneFilter]);

  // Fetch Options Chain
  useEffect(() => {
    if (!isOpen || !underlyingTicker) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const cleanTicker = underlyingTicker.trim().toUpperCase().replace('.SA', '');
    fetch(`/api/stocks/options?underlying=${encodeURIComponent(cleanTicker)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Falha ao carregar opções da B3');
        return res.json();
      })
      .then((data: OptionsChainResponse) => {
        if (!isMounted) return;
        setChainData(data);
        // Default selected vencimento to the first selected or available
        if (data.vencimentos && data.vencimentos.length > 0) {
          const defaultVenc = data.vencimentos.find(v => v.selected)?.value || data.vencimentos[0]?.value;
          // Keep ALL as default or select primary
          setSelectedVencimento(defaultVenc || 'ALL');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Erro ao consultar grade de opções');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, underlyingTicker]);

  // Filtered Options
  const filteredOptions = useMemo(() => {
    if (!chainData?.options) return [];

    return chainData.options.filter((opt) => {
      // Type Filter
      if (selectedType !== 'ALL' && opt.tipo !== selectedType) return false;

      // Expiration Filter
      if (selectedVencimento !== 'ALL' && opt.dataVencimento !== selectedVencimento && opt.vencimento !== selectedVencimento) {
        return false;
      }

      // Moneyness Filter
      if (selectedMoneyness !== 'ALL' && opt.status !== selectedMoneyness) return false;

      // Recommended Zone Filter
      if (onlyRecommendedZone && zoneFilter) {
        if (zoneFilter.type && opt.tipo !== zoneFilter.type) return false;
        if (zoneFilter.strikeCondition === 'lte' && opt.strike > zoneFilter.targetStrike) return false;
        if (zoneFilter.strikeCondition === 'gte' && opt.strike < zoneFilter.targetStrike) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toUpperCase();
        const matchesTicker = opt.ticker.toUpperCase().includes(query);
        const matchesStrike = opt.strike.toString().includes(query);
        if (!matchesTicker && !matchesStrike) return false;
      }

      return true;
    }).sort((a, b) => a.strike - b.strike);
  }, [chainData, selectedType, selectedVencimento, selectedMoneyness, onlyRecommendedZone, zoneFilter, searchQuery]);

  const handleCopyTicker = (ticker: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ticker);
      setCopiedTicker(ticker);
      setTimeout(() => setCopiedTicker(null), 2000);
    }
  };

  const currentPrice = chainData?.underlyingPrice || underlyingPrice || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
    >
      <div className="space-y-4">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Opções Disponíveis na B3</span>
                <span className="px-2 py-0.5 rounded-lg text-sm bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                  {underlyingTicker}
                </span>
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span>Cotação atual do ativo:</span>
              <strong className="font-mono text-gray-900 dark:text-white">
                {currentPrice > 0 ? formatCurrency(currentPrice) : '---'}
              </strong>
              <span>·</span>
              <span>{filteredOptions.length} de {chainData?.options?.length || 0} contratos</span>
            </p>
          </div>

          {/* Type Segmented Control */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-medium w-fit">
            <button
              type="button"
              onClick={() => setSelectedType('PUT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedType === 'PUT'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              PUTs (Venda)
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('CALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedType === 'CALL'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              CALLs (Compra/Coberta)
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedType === 'ALL'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        {/* Zone Filter Banner (when active) */}
        {zoneFilter && (
          <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            zoneFilter.type === 'PUT'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <Icon 
                name={zoneFilter.type === 'PUT' ? 'trending_down' : 'trending_up'} 
                size="sm" 
                className={zoneFilter.type === 'PUT' ? 'text-emerald-600' : 'text-amber-600'} 
              />
              <div>
                <span className="font-semibold">{zoneFilter.zoneLabel}</span>
                <span className="text-[11px] opacity-80 block">
                  {zoneFilter.type === 'PUT' 
                    ? `Filtrando PUTs com Strike ≤ ${formatCurrency(zoneFilter.targetStrike)} para aquisição com desconto.` 
                    : `Filtrando CALLs com Strike ≥ ${formatCurrency(zoneFilter.targetStrike)} para lançamento coberto.`}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 font-medium">
              <input
                type="checkbox"
                checked={onlyRecommendedZone}
                onChange={(e) => setOnlyRecommendedZone(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Apenas Zona Recomendada</span>
            </label>
          </div>
        )}

        {/* Controls Toolbar: Expiration, Moneyness, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Expiration Select */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              Vencimento:
            </label>
            <select
              value={selectedVencimento}
              onChange={(e) => setSelectedVencimento(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-hidden"
            >
              <option value="ALL">Todos os Vencimentos</option>
              {chainData?.vencimentos?.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.text} ({v.value})
                </option>
              ))}
            </select>
          </div>

          {/* Moneyness Select */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              Status (Moneyness):
            </label>
            <select
              value={selectedMoneyness}
              onChange={(e) => setSelectedMoneyness(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-hidden"
            >
              <option value="ALL">Todas (OTM / ATM / ITM)</option>
              <option value="OTM">OTM (Fora do Dinheiro - Ideal p/ Renda)</option>
              <option value="ATM">ATM (No Dinheiro)</option>
              <option value="ITM">ITM (Dentro do Dinheiro)</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">
              Buscar por Ticker ou Strike:
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: W428 ou 41.85..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-hidden"
              />
              <Icon 
                name="search" 
                size="sm" 
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" 
              />
            </div>
          </div>
        </div>

        {/* Content Table Area */}
        <div className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 overflow-hidden bg-white dark:bg-gray-900">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <Icon name="refresh" size="lg" className="animate-spin text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Consultando grade de opções na B3 em tempo real...
              </p>
              <p className="text-xs text-gray-400">
                Identificando strikes, prêmios e vencimentos para {underlyingTicker}
              </p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-rose-500">{error}</p>
              <p className="text-xs text-gray-400">Verifique sua conexão ou tente novamente.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  fetch(`/api/stocks/options?underlying=${encodeURIComponent(underlyingTicker)}`)
                    .then(r => r.json())
                    .then(data => setChainData(data))
                    .catch(() => {})
                    .finally(() => setLoading(false));
                }}
              >
                Tentar novamente
              </Button>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Nenhuma opção encontrada com os filtros selecionados.
              </p>
              <p className="text-xs text-gray-400">
                Tente desmarcar a &quot;Zona Recomendada&quot; ou selecionar outro vencimento/tipo.
              </p>
              {onlyRecommendedZone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOnlyRecommendedZone(false)}
                  className="text-xs text-blue-600 mt-2"
                >
                  Ver todos os strikes disponíveis
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold border-b border-gray-200 dark:border-gray-700 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Ticker</th>
                    <th className="py-2.5 px-2">Tipo</th>
                    <th className="py-2.5 px-2">Mod.</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-3 text-right">Strike</th>
                    <th className="py-2.5 px-3 text-right">Distância %</th>
                    <th className="py-2.5 px-3 text-right">Prêmio</th>
                    <th className="py-2.5 px-3 text-right">Taxa (Yield)</th>
                    <th className="py-2.5 px-3 text-center">Vencimento</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                  {filteredOptions.map((opt) => {
                    const isCopied = copiedTicker === opt.ticker;
                    const isPut = opt.tipo === 'PUT';
                    const estimatedRate = opt.strike > 0 && opt.ultimo > 0 
                      ? (opt.ultimo / opt.strike) * 100 
                      : (currentPrice > 0 && opt.ultimo > 0 ? (opt.ultimo / currentPrice) * 100 : 0);

                    return (
                      <tr
                        key={opt.ticker}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        {/* Ticker */}
                        <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{opt.ticker}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTicker(opt.ticker)}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Copiar Ticker"
                          >
                            <Icon name={isCopied ? 'check' : 'content_copy'} size="xs" className={isCopied ? 'text-emerald-500' : ''} />
                          </button>
                        </td>

                        {/* Tipo */}
                        <td className="py-2.5 px-2 font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isPut
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          }`}>
                            {opt.tipo}
                          </span>
                        </td>

                        {/* Modelo */}
                        <td className="py-2.5 px-2 text-gray-500 font-sans" title={opt.modelo === 'E' ? 'Europeia (exercício no vencimento)' : 'Americana (exercício a qualquer momento)'}>
                          {opt.modelo}
                        </td>

                        {/* Status (Moneyness) */}
                        <td className="py-2.5 px-2 font-sans">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            opt.status === 'OTM'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : opt.status === 'ATM'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          }`}>
                            {opt.status}
                          </span>
                        </td>

                        {/* Strike */}
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(opt.strike)}
                        </td>

                        {/* Distancia % */}
                        <td className={`py-2.5 px-3 text-right ${
                          opt.distanciaPercent < 0 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {opt.distanciaPercent > 0 ? `+${opt.distanciaPercent.toFixed(1)}%` : `${opt.distanciaPercent.toFixed(1)}%`}
                        </td>

                        {/* Ultimo Premio */}
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {opt.ultimo > 0 ? formatCurrency(opt.ultimo) : '-'}
                        </td>

                        {/* Taxa % */}
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {estimatedRate > 0 ? `+${estimatedRate.toFixed(2)}%` : '-'}
                        </td>

                        {/* Vencimento */}
                        <td className="py-2.5 px-3 text-center text-gray-500 dark:text-gray-400">
                          {opt.vencimento}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-right font-sans">
                          {onSelectOption ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                onSelectOption(opt);
                                onClose();
                              }}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 px-2 py-1"
                            >
                              + Usar Opção
                            </Button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCopyTicker(opt.ticker)}
                              className="text-[11px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                            >
                              {isCopied ? 'Copiado!' : 'Copiar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 pt-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>OTM: Fora do dinheiro (melhor para ganho de prêmio sem exercício)</span>
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-gray-600 dark:text-gray-300"
          >
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
