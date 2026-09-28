'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Investment } from '@/hooks/useInvestments';
import { GrahamStockData } from '@/app/api/stocks/graham/route';

interface GrahamAnalysisTableProps {
  investments: Investment[];
  onOpenEntryModal?: (inv: Investment) => void;
  onOpenNewInvModal?: (prefilledTicker?: string, prefilledPrice?: number) => void;
}

const POPULAR_TICKERS = [
  { ticker: 'PETR4', name: 'Petrobras PN' },
  { ticker: 'VALE3', name: 'Vale ON' },
  { ticker: 'BBAS3', name: 'Banco do Brasil ON' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN' },
  { ticker: 'BBDC4', name: 'Bradesco PN' },
  { ticker: 'TAEE11', name: 'Taesa UNT' },
  { ticker: 'EGIE3', name: 'Engie Brasil ON' },
  { ticker: 'WEGE3', name: 'WEG ON' },
  { ticker: 'KLBN11', name: 'Klabin UNT' },
  { ticker: 'CPLE6', name: 'Copel PNB' },
  { ticker: 'SAPR11', name: 'Sanepar UNT' }
];

export function GrahamAnalysisTable({
  investments,
  onOpenEntryModal,
  onOpenNewInvModal
}: GrahamAnalysisTableProps) {
  const [grahamDataMap, setGrahamDataMap] = useState<Record<string, GrahamStockData>>({});
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'simulator'>('portfolio');

  // Simulator state
  const [searchTicker, setSearchTicker] = useState('BBAS3');
  const [simData, setSimData] = useState<GrahamStockData | null>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [simError, setSimError] = useState('');
  const [customLpa, setCustomLpa] = useState('');
  const [customVpa, setCustomVpa] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Filter stock investments in user portfolio
  const stockInvestments = useMemo(() => {
    return investments.filter(inv => {
      const typeName = inv.investment_type?.name?.toLowerCase() || '';
      const ticker = (inv.ticker || inv.name || '').toUpperCase().trim();
      const isStockType = typeName.includes('ação') || typeName.includes('ações') || typeName.includes('acoes') || typeName.includes('stock');
      const hasStockTicker = /^[A-Z]{4}\d{1,2}[A-Z]?$/.test(ticker) && !ticker.endsWith('11'); // usually 3, 4, 5, 6 are stocks; 11 can be FII/UNIT
      const isUntOrStock = /^[A-Z]{4}(3|4|5|6|11)$/.test(ticker) && (isStockType || !typeName.includes('fii'));
      
      return isStockType || hasStockTicker || isUntOrStock;
    });
  }, [investments]);

  const stockTickers = useMemo(() => {
    return stockInvestments
      .map(inv => inv.ticker || (inv.name.match(/^[A-Z]{4}\d{1,2}[A-Z]?$/i) ? inv.name : ''))
      .filter(Boolean);
  }, [stockInvestments]);

  // Fetch Graham data for all stocks in portfolio
  const fetchPortfolioGrahamData = async () => {
    if (stockTickers.length === 0) return;

    setIsLoadingPortfolio(true);
    try {
      const res = await fetch('/api/stocks/graham', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: stockTickers })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setGrahamDataMap(data.results);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dados de Graham:', err);
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  useEffect(() => {
    if (stockTickers.length > 0) {
      fetchPortfolioGrahamData();
    }
  }, [stockTickers.join(',')]);

  // Handle single ticker search for simulator
  const handleSearchTicker = async (tickerToSearch?: string) => {
    const raw = (tickerToSearch || searchTicker).trim().toUpperCase();
    if (!raw) return;

    setIsSimLoading(true);
    setSimError('');
    try {
      const res = await fetch(`/api/stocks/graham?ticker=${encodeURIComponent(raw)}`);
      if (res.ok) {
        const data: GrahamStockData = await res.json();
        setSimData(data);
        setCustomLpa(data.lpa !== null ? String(data.lpa) : '');
        setCustomVpa(data.vpa !== null ? String(data.vpa) : '');
        setCustomPrice(data.currentPrice > 0 ? String(data.currentPrice) : '');
      } else {
        const err = await res.json();
        setSimError(err.error || 'Ativo não encontrado ou sem dados fundamentalistas na B3.');
      }
    } catch (e: any) {
      setSimError(e.message || 'Erro ao consultar cotação e dados fundamentalistas.');
    } finally {
      setIsSimLoading(false);
    }
  };

  // Re-calculate simulation on custom LPA/VPA/Price changes
  const handleRecalculateCustom = () => {
    const lpa = parseFloat(customLpa.replace(',', '.')) || 0;
    const vpa = parseFloat(customVpa.replace(',', '.')) || 0;
    const price = parseFloat(customPrice.replace(',', '.')) || 0;

    if (lpa <= 0 || vpa <= 0) {
      setSimError('LPA e VPA devem ser maiores que zero para o cálculo de Graham.');
      return;
    }

    const grahamPrice = Math.sqrt(22.5 * lpa * vpa);
    const otimoPrice = grahamPrice * 0.8;
    const discountPercent = price > 0 ? ((grahamPrice - price) / grahamPrice) * 100 : 0;

    let status: GrahamStockData['status'] = 'PRECO_JUSTO';
    let statusLabel = 'Preço Justo (Abaixo do Teto)';
    let statusColor: GrahamStockData['statusColor'] = 'amber';

    if (price > 0) {
      if (price <= otimoPrice) {
        status = 'OTIMO_PRECO';
        statusLabel = 'Ótimo Preço (Desconto ≥ 20%)';
        statusColor = 'green';
      } else if (price <= grahamPrice) {
        status = 'PRECO_JUSTO';
        statusLabel = 'Preço Justo (Abaixo do Teto)';
        statusColor = 'amber';
      } else {
        status = 'PRECO_ACIMA';
        statusLabel = 'Preço Acima (Caro / Sem Margem)';
        statusColor = 'red';
      }
    }

    setSimData(prev => ({
      ticker: prev?.ticker || searchTicker.toUpperCase(),
      name: prev?.name || 'Simulação Personalizada',
      currentPrice: price,
      lpa,
      vpa,
      pl: prev?.pl || null,
      pvp: prev?.pvp || null,
      dy: prev?.dy || null,
      grahamPrice: Number(grahamPrice.toFixed(2)),
      otimoPrice: Number(otimoPrice.toFixed(2)),
      discountPercent: Number(discountPercent.toFixed(1)),
      status,
      statusLabel,
      statusColor,
      lastUpdated: new Date().toISOString()
    }));
    setSimError('');
  };

  // Run initial simulation for BBAS3
  useEffect(() => {
    handleSearchTicker('BBAS3');
  }, []);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Count opportunities in portfolio
  const opportunitiesCount = useMemo(() => {
    return Object.values(grahamDataMap).filter(d => d.status === 'OTIMO_PRECO').length;
  }, [grahamDataMap]);

  return (
    <div className="space-y-4">
      {/* Header & Section Title */}
      <GlassCard className="p-5 md:p-6 space-y-4 border-l-4 border-l-emerald-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Icon name="verified" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  1. Preço Justo de Graham para Ações (B3)
                  {opportunitiesCount > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs rounded-full font-bold animate-pulse">
                      {opportunitiesCount} {opportunitiesCount === 1 ? 'Ótima Oportunidade' : 'Ótimas Oportunidades'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Avaliação do valor intrínseco segundo a fórmula clássica de Benjamin Graham: <code className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.5 rounded">Preço Justo = √(22,5 × LPA × VPA)</code>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switch */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('portfolio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'portfolio'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="inventory_2" size="sm" />
                <span>Minha Carteira ({stockInvestments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'simulator'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Icon name="search" size="sm" />
                <span>Simulador / Qualquer Ação B3</span>
              </button>
            </div>

            {activeTab === 'portfolio' && stockTickers.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchPortfolioGrahamData}
                disabled={isLoadingPortfolio}
                className="text-xs flex items-center gap-1"
                title="Atualizar indicadores fundamentalistas das ações"
              >
                <Icon name="refresh" size="sm" className={isLoadingPortfolio ? 'animate-spin' : ''} />
                <span>{isLoadingPortfolio ? 'Calculando...' : 'Recalcular'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Informative Graham Criteria Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Ótimo Preço */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>🟢 ÓTIMO PREÇO (Margem ≥ 20%)</span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
              Cotação atual com <strong>20% ou mais de desconto</strong> sobre o Preço Justo de Graham. Margem de segurança ideal para aportes com proteção de capital.
            </p>
          </div>

          {/* Preço Justo */}
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>🟡 PREÇO JUSTO (Valor Intrínseco)</span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
              Cotação negociando <strong>entre o Ótimo Preço e o Preço Teto de Graham</strong>. Preço equilibrado e aceitável para empresas sólidas e pagadoras de dividendos.
            </p>
          </div>

          {/* Preço Acima */}
          <div className="bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>🔴 PREÇO ACIMA (Sobreavaliado)</span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
              Cotação <strong>acima do Preço Justo de Graham</strong>. Ação cara segundo os múltiplos de Graham (P/L × P/VP &gt; 22,5). Recomenda-se aguardar correção.
            </p>
          </div>
        </div>

        {/* TAB 1: Minha Carteira */}
        {activeTab === 'portfolio' && (
          <div className="space-y-3 pt-2">
            {stockInvestments.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 mx-auto flex items-center justify-center">
                  <Icon name="trending_up" className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Nenhuma Ação da B3 cadastrada na carteira</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    Cadastre ações da B3 (ex: PETR4, VALE3, BBAS3, ITUB4) com o ticker preenchido para acompanhar automaticamente o Preço Justo de Graham de cada uma, ou utilize o simulador ao lado!
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('simulator')}
                    className="text-xs"
                  >
                    <Icon name="search" size="sm" /> Ir para o Simulador de Ações
                  </Button>
                  {onOpenNewInvModal && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenNewInvModal()}
                      className="text-xs"
                    >
                      <Icon name="add" size="sm" /> Cadastrar Nova Ação
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/80 dark:text-gray-400">
                    <tr>
                      <th scope="col" className="px-3.5 py-3">Ação / Ticker</th>
                      <th scope="col" className="px-3 py-3 text-right">Cotação Atual</th>
                      <th scope="col" className="px-3 py-3 text-right" title="Lucro por Ação dos últimos 12 meses">LPA</th>
                      <th scope="col" className="px-3 py-3 text-right" title="Valor Patrimonial por Ação">VPA</th>
                      <th scope="col" className="px-3 py-3 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold" title="Preço Justo com 20% de Margem de Segurança">
                        🟢 Ótimo Preço
                      </th>
                      <th scope="col" className="px-3 py-3 text-right bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-bold" title="Preço Justo calculado pela fórmula de Graham: √(22,5 * LPA * VPA)">
                        🟡 Preço Justo Graham
                      </th>
                      <th scope="col" className="px-3 py-3 text-right text-red-600 dark:text-red-400" title="Faixa acima do Preço Justo">
                        🔴 Preço Acima
                      </th>
                      <th scope="col" className="px-3 py-3 text-center">Desconto / Margem</th>
                      <th scope="col" className="px-3 py-3 text-center">Diagnóstico</th>
                      <th scope="col" className="px-3 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stockInvestments.map((inv) => {
                      const ticker = (inv.ticker || inv.name).toUpperCase().trim();
                      const gData = grahamDataMap[ticker];
                      const currentPrice = (gData && gData.currentPrice > 0) ? gData.currentPrice : (inv.current_price || inv.average_price || 0);
                      const isOpt = gData?.status === 'OTIMO_PRECO';
                      const isFair = gData?.status === 'PRECO_JUSTO';
                      const isAbove = gData?.status === 'PRECO_ACIMA';
                      const isNeg = gData?.status === 'PREJUIZO_OU_PL_NEGATIVO';

                      return (
                        <tr
                          key={inv.id}
                          className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${
                            isOpt ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                          }`}
                        >
                          {/* Ação / Ticker */}
                          <td className="px-3.5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-mono font-extrabold text-xs bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-xs">
                                {ticker}
                              </span>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white text-xs line-clamp-1">{inv.name}</p>
                                <p className="text-[10px] text-gray-400">{inv.institution || 'B3'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Cotação Atual */}
                          <td className="px-3 py-3.5 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(currentPrice)}
                          </td>

                          {/* LPA */}
                          <td className="px-3 py-3.5 text-right text-gray-600 dark:text-gray-300 font-mono">
                            {gData?.lpa !== null && gData?.lpa !== undefined ? formatCurrency(gData.lpa) : '-'}
                          </td>

                          {/* VPA */}
                          <td className="px-3 py-3.5 text-right text-gray-600 dark:text-gray-300 font-mono">
                            {gData?.vpa !== null && gData?.vpa !== undefined ? formatCurrency(gData.vpa) : '-'}
                          </td>

                          {/* Ótimo Preço */}
                          <td className="px-3 py-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 whitespace-nowrap">
                            {gData?.otimoPrice ? formatCurrency(gData.otimoPrice) : '-'}
                          </td>

                          {/* Preço Justo Graham */}
                          <td className="px-3 py-3.5 text-right font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/10 whitespace-nowrap">
                            {gData?.grahamPrice ? formatCurrency(gData.grahamPrice) : '-'}
                          </td>

                          {/* Preço Acima */}
                          <td className="px-3 py-3.5 text-right text-red-500 whitespace-nowrap font-medium">
                            {gData?.grahamPrice ? `> ${formatCurrency(gData.grahamPrice)}` : '-'}
                          </td>

                          {/* Desconto / Margem */}
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {gData?.discountPercent !== null && gData?.discountPercent !== undefined ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-0.5 ${
                                  gData.discountPercent >= 20
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : gData.discountPercent > 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300'
                                }`}
                              >
                                {gData.discountPercent > 0 ? `+${gData.discountPercent}% desc.` : `${gData.discountPercent}% ágio`}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>

                          {/* Diagnóstico / Momento */}
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            {isOpt && (
                              <Badge color="green" className="text-[10px] font-bold uppercase tracking-wider">
                                🟢 Ótimo Preço
                              </Badge>
                            )}
                            {isFair && (
                              <Badge color="yellow" className="text-[10px] font-bold uppercase tracking-wider">
                                🟡 Preço Justo
                              </Badge>
                            )}
                            {isAbove && (
                              <Badge color="red" className="text-[10px] font-bold uppercase tracking-wider">
                                🔴 Preço Acima
                              </Badge>
                            )}
                            {isNeg && (
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] rounded font-medium">
                                ⚠️ Prejuízo/PL Neg.
                              </span>
                            )}
                            {!gData && (
                              <span className="text-[10px] text-gray-400">
                                {isLoadingPortfolio ? 'Calculando...' : 'Sem dados'}
                              </span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {onOpenEntryModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEntryModal(inv)}
                                  className={`px-2 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${
                                    isOpt
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                                  }`}
                                  title="Registrar novo aporte"
                                >
                                  <Icon name="add_circle" size="sm" />
                                  <span>Aportar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Simulador Interativo & Pesquisa de Qualquer Ação */}
        {activeTab === 'simulator' && (
          <div className="space-y-4 pt-2">
            {/* Search Input & Popular Chips */}
            <div className="bg-gray-50/80 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Digite o código da ação (Ex: PETR4, VALE3, BBAS3, ITUB4, WEGE3...)"
                    value={searchTicker}
                    onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchTicker(searchTicker);
                      }
                    }}
                    className="font-mono font-bold uppercase text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleSearchTicker(searchTicker)}
                  disabled={isSimLoading || !searchTicker.trim()}
                  className="shrink-0 text-xs flex items-center gap-1"
                >
                  <Icon name="search" size="sm" className={isSimLoading ? 'animate-spin' : ''} />
                  <span>{isSimLoading ? 'Buscando Dados...' : 'Analisar Ação na B3'}</span>
                </Button>
              </div>

              {/* Popular Ticker Quick Chips */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Atalhos rápidos para análise:</span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TICKERS.map(item => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => {
                        setSearchTicker(item.ticker);
                        handleSearchTicker(item.ticker);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                        simData?.ticker === item.ticker
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-gray-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {item.ticker}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {simError && (
              <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded-lg text-xs">
                {simError}
              </div>
            )}

            {/* Simulation Card Result */}
            {simData && (
              <div className="bg-white dark:bg-gray-800/90 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-md">
                      {simData.ticker}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 dark:text-white text-base">{simData.name}</h4>
                      <p className="text-xs text-gray-500">Indicadores fundamentalistas extraídos da B3</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {simData.status === 'OTIMO_PRECO' && (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                        <Icon name="check_circle" size="sm" /> 🟢 Ótimo Preço para Comprar
                      </span>
                    )}
                    {simData.status === 'PRECO_JUSTO' && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                        <Icon name="info" size="sm" /> 🟡 Preço Justo / Neutro
                      </span>
                    )}
                    {simData.status === 'PRECO_ACIMA' && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 rounded-full text-xs font-extrabold flex items-center gap-1">
                        <Icon name="warning" size="sm" /> 🔴 Preço Acima do Justo (Caro)
                      </span>
                    )}
                    {simData.status === 'PREJUIZO_OU_PL_NEGATIVO' && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-full text-xs font-bold">
                        ⚠️ Fórmula de Graham Não Aplicável
                      </span>
                    )}

                    {onOpenNewInvModal && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onOpenNewInvModal(simData.ticker, simData.currentPrice)}
                        className="text-xs flex items-center gap-1"
                      >
                        <Icon name="add" size="sm" /> Adicionar à Carteira
                      </Button>
                    )}
                  </div>
                </div>

                {/* 3 Price Tiers Highlight Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Cotação Atual */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cotação Atual</span>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrency(simData.currentPrice)}</p>
                    <span className="text-[10px] text-gray-500">Preço negociado agora na B3</span>
                  </div>

                  {/* Ótimo Preço */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ótimo Preço (Margem 20%)
                    </span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(simData.otimoPrice)}</p>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">Faixa ideal de compra</span>
                  </div>

                  {/* Preço Justo de Graham */}
                  <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Preço Justo Graham (100%)
                    </span>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(simData.grahamPrice)}</p>
                    <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80">Valor intrínseco máximo</span>
                  </div>

                  {/* Preço Acima */}
                  <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Preço Acima (Caro)
                    </span>
                    <p className="text-xl font-black text-red-600 dark:text-red-400">
                      {simData.grahamPrice ? `> ${formatCurrency(simData.grahamPrice)}` : '-'}
                    </p>
                    <span className="text-[10px] text-red-700/80 dark:text-red-400/80">Sobreavaliado</span>
                  </div>
                </div>

                {/* Visual Gauge / Price Bar */}
                {simData.grahamPrice && simData.otimoPrice && (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Termômetro de Preço & Valor Intrínseco</span>
                      <span className="text-gray-500 text-[11px]">
                        Margem de Segurança: <strong className={simData.discountPercent && simData.discountPercent > 0 ? 'text-emerald-600' : 'text-red-500'}>
                          {simData.discountPercent !== null ? `${simData.discountPercent}%` : '-'}
                        </strong>
                      </span>
                    </div>

                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex relative">
                      {/* Green Zone: Up to Otimo Price (80% of Graham) */}
                      <div className="bg-emerald-500 h-full w-[45%]" title={`Zona Verde (Ótimo Preço: até ${formatCurrency(simData.otimoPrice)})`} />
                      {/* Yellow Zone: From Otimo Price to Graham Price */}
                      <div className="bg-amber-400 h-full w-[25%]" title={`Zona Amarela (Preço Justo: de ${formatCurrency(simData.otimoPrice)} até ${formatCurrency(simData.grahamPrice)})`} />
                      {/* Red Zone: Above Graham Price */}
                      <div className="bg-red-500 h-full w-[30%]" title={`Zona Vermelha (Preço Acima: acima de ${formatCurrency(simData.grahamPrice)})`} />
                    </div>

                    <div className="flex justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                      <span className="text-emerald-600 dark:text-emerald-400">🟢 Até {formatCurrency(simData.otimoPrice)} (Ótimo)</span>
                      <span className="text-amber-600 dark:text-amber-400">🟡 Até {formatCurrency(simData.grahamPrice)} (Preço Justo)</span>
                      <span className="text-red-600 dark:text-red-400">🔴 Acima de {formatCurrency(simData.grahamPrice)} (Caro)</span>
                    </div>
                  </div>
                )}

                {/* Editable Fundamentals for Custom Simulation */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Icon name="tune" size="sm" className="text-blue-500" />
                      Ajustar Parâmetros & Simular Cenários (LPA / VPA)
                    </span>
                    <span className="text-[10px] text-gray-400">Altere os números para simular lucros futuros</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Input
                        label="LPA (Lucro por Ação)"
                        value={customLpa}
                        onChange={(e) => setCustomLpa(e.target.value)}
                        placeholder="Ex: 5.40"
                      />
                    </div>
                    <div>
                      <Input
                        label="VPA (Valor Patrimonial/Ação)"
                        value={customVpa}
                        onChange={(e) => setCustomVpa(e.target.value)}
                        placeholder="Ex: 32.50"
                      />
                    </div>
                    <div>
                      <Input
                        label="Cotação a Simular (R$)"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        placeholder="Ex: 28.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRecalculateCustom}
                      className="text-xs flex items-center gap-1"
                    >
                      <Icon name="calculate" size="sm" />
                      <span>Recalcular Simulação de Graham</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
