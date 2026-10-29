'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { BarganhaStock } from '@/app/api/stocks/barganhas/route';

interface Top30BarganhasDashboardProps {
  onOpenNewInvModal?: (ticker: string, price: number) => void;
  onOpenStockDetails?: (ticker: string) => void;
}

interface BarganhasApiResponse {
  monthKey: string;
  monthName: string;
  previousMonthName: string;
  daysUntilNextRebalance: number;
  totalUniverse: number;
  eligibleCount: number;
  top30Count: number;
  summary: {
    avgDy: number;
    avgPatrimonioReal: number;
    avgEvEbit: number;
    netCashCount: number;
  };
  availableSectors: string[];
  availableSegments: string[];
  results: BarganhaStock[];
}

export function Top30BarganhasDashboard({
  onOpenNewInvModal,
  onOpenStockDetails
}: Top30BarganhasDashboardProps) {
  const [data, setData] = useState<BarganhasApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [selectedSegment, setSelectedSegment] = useState('Todos');
  const [minLiquidity, setMinLiquidity] = useState<number>(200000);
  const [excludeRJ, setExcludeRJ] = useState<boolean>(true);
  const [excludeLosses, setExcludeLosses] = useState<boolean>(true);
  const [excludeVolatile, setExcludeVolatile] = useState<boolean>(true);
  const [onlyNetCash, setOnlyNetCash] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('indice_valor');
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Sector Customization (Exclude Varejo, multi-select include/exclude)
  const [excludeVarejo, setExcludeVarejo] = useState<boolean>(false);
  const [excludedSectors, setExcludedSectors] = useState<string[]>([]);
  const [includedSectors, setIncludedSectors] = useState<string[]>([]);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState<boolean>(false);

  // Fetch stocks function
  const fetchBarganhas = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (selectedSector && selectedSector !== 'Todos') params.append('sector', selectedSector);
      if (selectedSegment && selectedSegment !== 'Todos') params.append('segment', selectedSegment);
      if (minLiquidity > 0) params.append('min_liquidity', String(minLiquidity));
      params.append('exclude_rj', String(excludeRJ));
      params.append('exclude_losses', String(excludeLosses));
      params.append('exclude_volatile', String(excludeVolatile));
      params.append('only_net_cash', String(onlyNetCash));
      if (excludeVarejo) params.append('exclude_varejo', 'true');
      if (excludedSectors.length > 0) params.append('excluded_sectors', excludedSectors.join(','));
      if (includedSectors.length > 0) params.append('included_sectors', includedSectors.join(','));
      params.append('sort_by', sortBy);
      if (searchQuery) params.append('search', searchQuery);
      if (forceRefresh) params.append('refresh', 'true');

      const res = await fetch(`/api/stocks/barganhas?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro ${res.status}: Não foi possível carregar a lista de barganhas.`);
      }

      const json: BarganhasApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Erro ao buscar barganhas:', err);
      setError(err?.message || 'Falha ao carregar as 30 ações mais baratas.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    selectedSector,
    selectedSegment,
    minLiquidity,
    excludeRJ,
    excludeLosses,
    excludeVolatile,
    onlyNetCash,
    excludeVarejo,
    excludedSectors,
    includedSectors,
    sortBy,
    searchQuery
  ]);

  useEffect(() => {
    fetchBarganhas();
  }, [fetchBarganhas]);

  // Export current list to CSV
  const handleExportCSV = () => {
    if (!data || !data.results || data.results.length === 0) return;

    const headers = [
      'Posicao',
      'Ticker',
      'Nome',
      'Setor',
      'Segmento',
      'Cotacao (R$)',
      'Indice de Valor',
      'Patrimonio por R$ 1',
      'EV/EBIT',
      'Margem EBIT (%)',
      'P/L',
      'P/VP',
      'DY (%)',
      'Posicao de Caixa',
      'Liquidez Diaria (R$)'
    ];

    const rows = data.results.map(s => [
      s.rank,
      s.ticker,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.sector}"`,
      `"${s.segment}"`,
      s.price.toFixed(2),
      s.indiceValor.toFixed(1),
      s.patrimonioPorReal.toFixed(2),
      s.evEbit.toFixed(2),
      s.mrgEbit.toFixed(1),
      s.pl.toFixed(2),
      s.pvp.toFixed(2),
      s.dy.toFixed(2),
      `"${s.cashStatusLabel}"`,
      s.liq2m.toFixed(0)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `top30_acoes_mais_baratas_${data.monthKey || 'b3'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const top3Stocks = useMemo(() => {
    if (!data || !data.results) return [];
    return data.results.slice(0, 3);
  }, [data]);

  const allB3Sectors = useMemo(() => {
    const list = data?.availableSectors?.length
      ? data.availableSectors
      : [
          'Financeiro',
          'Utilidade Pública',
          'Materiais Básicos',
          'Petróleo e Gás',
          'Bens Industriais',
          'Construção Civil',
          'Consumo Cíclico',
          'Consumo Não Cíclico',
          'Saúde',
          'Tecnologia',
          'Telecomunicações',
          'Educação'
        ];
    return Array.from(new Set(list)).sort();
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Monthly Rebalance Badge */}
      <GlassCard className="p-6 relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Icon name="verified" size="xs" />
                Deep Value &amp; Barganhas B3
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <Icon name="calendar_month" size="xs" />
                Carteira Oficial: {data?.monthName || 'Carregando mês...'}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Icon name="update" size="xs" />
                Refaz a cada 30 dias (em {data?.daysUntilNextRebalance ?? 30} dias)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span>🏆 Top 30 Ações Mais Baratas da Bolsa</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowMethodology(!showMethodology)}
              className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200"
            >
              <Icon name="help_outline" size="xs" />
              {showMethodology ? 'Ocultar Metodologia' : 'Como Funciona a Fórmula'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || !data?.results?.length}
              className="flex items-center gap-1.5 text-xs"
            >
              <Icon name="download" size="xs" />
              Exportar CSV
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => fetchBarganhas(true)}
              disabled={loading || isRefreshing}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Icon name="sync" size="xs" className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Atualizando Cotações...' : 'Recalcular Lista'}
            </Button>
          </div>
        </div>

        {/* Methodology Educational Card Accordion */}
        {showMethodology && (
          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-1.5">
              <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon name="account_balance" size="xs" />
                1. Patrimônio por R$ Pago
              </div>
              <p>
                Calculado como <strong>1 / (P/VP)</strong>. Representa o valor patrimonial real que você adquire para cada R$ 1,00 desembolsado. Se P/VP for 0,50, você leva <strong>R$ 2,00</strong> de patrimônio líquido para cada real investido.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-1.5">
              <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Icon name="trending_up" size="xs" />
                2. Lucro Operacional (EV/EBIT)
              </div>
              <p>
                Utilizado por investidores lendários (Joel Greenblatt e Carlisle). Compara o valor total da firma (EV = Ações + Dívidas - Caixa) ao resultado operacional puro (EBIT), isolando manobras contábeis e juros.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-1.5">
              <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Icon name="payments" size="xs" />
                3. Posição de Caixa Líquido
              </div>
              <p>
                Prioriza empresas com <strong>Caixa Líquido Positivo</strong> (Dívida Líq./PL &le; 0), nas quais o dinheiro em caixa supera toda a dívida da companhia, conferindo blindagem máxima em períodos de juros altos.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-1.5">
              <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Icon name="shield" size="xs" />
                4. Filtros de Exclusão Rígidos
              </div>
              <p>
                Exige liquidez diária negociada (elimina papéis ilíquidos), exclui empresas em recuperação judicial, em OPA/fechamento, deficitárias (último ano/tri) e o decil dos <strong>10% mais voláteis</strong> da B3.
              </p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Barganhas Selecionadas</span>
            <Icon name="checklist" size="sm" className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {data?.top30Count ?? 0}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5">
              de {data?.eligibleCount ?? 0} aprovadas
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Universo avaliado: {data?.totalUniverse ?? 0} ativos
          </p>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Patrimônio Médio / R$ 1</span>
            <Icon name="savings" size="sm" className="text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              R$ {data?.summary?.avgPatrimonioReal?.toFixed(2) ?? '0.00'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Por cada R$ 1,00 investido no Top 30
          </p>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>EV/EBIT Médio</span>
            <Icon name="insights" size="sm" className="text-purple-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {data?.summary?.avgEvEbit?.toFixed(1) ?? '0.0'}x
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Múltiplo de lucro operacional baixo
          </p>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Com Caixa Líquido</span>
            <Icon name="attach_money" size="sm" className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {data?.summary?.netCashCount ?? 0}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              / {data?.top30Count ?? 30}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Mais caixa do que dívidas
          </p>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Dividend Yield Médio</span>
            <Icon name="percent" size="sm" className="text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data?.summary?.avgDy?.toFixed(1) ?? '0.0'}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              a.a.
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Proventos médios no ano
          </p>
        </GlassCard>
      </div>

      {/* 3. Podium: Destaques Top 3 */}
      {!loading && top3Stocks.length >= 3 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="military_tech" size="xs" className="text-amber-500" />
              Pódio das Maiores Barganhas ({data?.monthName})
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Líderes absolutos do Índice de Valor
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3Stocks.map((stock, i) => {
              const medalColors = [
                { border: 'border-amber-400/50', badge: 'bg-amber-500 text-amber-950', title: '1º Lugar • Ouro 🥇' },
                { border: 'border-slate-400/50', badge: 'bg-slate-300 text-slate-900', title: '2º Lugar • Prata 🥈' },
                { border: 'border-amber-700/50', badge: 'bg-amber-700 text-white', title: '3º Lugar • Bronze 🥉' }
              ];
              const medal = medalColors[i];

              return (
                <GlassCard
                  key={stock.ticker}
                  className={`p-5 relative border-2 ${medal.border} transition-all hover:shadow-md flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${medal.badge}`}>
                        {medal.title}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Score: {stock.indiceValor} / 100
                      </div>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                          {stock.ticker}
                          {stock.rankChange === 'up' && (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center">
                              <Icon name="arrow_upward" size="xs" />+{stock.rankDiff}
                            </span>
                          )}
                          {stock.rankChange === 'new' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
                              NOVA
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-[180px]">
                          {stock.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          R$ {stock.price.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {stock.sector}
                        </div>
                      </div>
                    </div>

                    {/* Value Metrics Highlight */}
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Patrimônio p/ Real:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          R$ {stock.patrimonioPorReal.toFixed(2)} por R$ 1,00
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Lucro Operacional:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          EV/EBIT {stock.evEbit.toFixed(1)}x
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Posição de Caixa:</span>
                        <span className={`font-semibold ${stock.isNetCash ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {stock.isNetCash ? 'Caixa Líquido' : stock.cashStatusLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">P/L &amp; Dividend Yield:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {stock.pl.toFixed(1)}x • DY {stock.dy.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                    {onOpenStockDetails && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenStockDetails(stock.ticker)}
                        className="flex-1 text-xs py-1.5"
                      >
                        Ver Detalhes
                      </Button>
                    )}
                    {onOpenNewInvModal && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onOpenNewInvModal(stock.ticker, stock.price)}
                        className="flex-1 text-xs py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        + Aporte
                      </Button>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Complete Interactive Filters Toolbar */}
      <GlassCard className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="tune" size="sm" className="text-emerald-500" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Filtros Avançados &amp; Segmentação
            </h3>
          </div>
          {(selectedSector !== 'Todos' || selectedSegment !== 'Todos' || searchQuery || onlyNetCash || minLiquidity !== 200000 || !excludeRJ || !excludeLosses || !excludeVolatile || excludeVarejo || excludedSectors.length > 0 || includedSectors.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setSelectedSector('Todos');
                setSelectedSegment('Todos');
                setSearchQuery('');
                setMinLiquidity(200000);
                setExcludeRJ(true);
                setExcludeLosses(true);
                setExcludeVolatile(true);
                setOnlyNetCash(false);
                setExcludeVarejo(false);
                setExcludedSectors([]);
                setIncludedSectors([]);
                setSortBy('indice_valor');
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Icon name="restart_alt" size="xs" />
              Restaurar Padrão
            </button>
          )}
        </div>

        {/* Search, Sector, Segment, Sorting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Buscar Ação / Empresa
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: PETR4, CMIG4, Lojas Renner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 pl-8 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Icon
                name="search"
                size="xs"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <Icon name="close" size="xs" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Setor de Atuação
            </label>
            <select
              value={selectedSector}
              onChange={e => {
                setSelectedSector(e.target.value);
                setSelectedSegment('Todos'); // reset segment when sector changes
              }}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Todos">Todos os Setores</option>
              {data?.availableSectors?.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Segmento Específico
            </label>
            <select
              value={selectedSegment}
              onChange={e => setSelectedSegment(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Todos">Todos os Segmentos</option>
              {data?.availableSegments?.map(seg => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Liquidez Mínima Diária
            </label>
            <select
              value={minLiquidity}
              onChange={e => setMinLiquidity(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={50000}>Baixa (&gt; R$ 50 mil/dia)</option>
              <option value={200000}>Padrão (&gt; R$ 200 mil/dia)</option>
              <option value={500000}>Média (&gt; R$ 500 mil/dia)</option>
              <option value={1000000}>Alta (&gt; R$ 1 milhão/dia)</option>
              <option value={5000000}>Ultra (&gt; R$ 5 milhões/dia)</option>
            </select>
          </div>
        </div>

        {/* Toggle Pills & Sorting */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle: Excluir RJ e OPA */}
            <button
              type="button"
              onClick={() => setExcludeRJ(!excludeRJ)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                excludeRJ
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon name={excludeRJ ? 'check_circle' : 'cancel'} size="xs" />
              Excluir RJ e OPA
            </button>

            {/* Toggle: Excluir Prejuízo */}
            <button
              type="button"
              onClick={() => setExcludeLosses(!excludeLosses)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                excludeLosses
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon name={excludeLosses ? 'check_circle' : 'cancel'} size="xs" />
              Excluir Prejuízos (12M/Tri)
            </button>

            {/* Toggle: Excluir 10% Mais Voláteis */}
            <button
              type="button"
              onClick={() => setExcludeVolatile(!excludeVolatile)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                excludeVolatile
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon name={excludeVolatile ? 'check_circle' : 'cancel'} size="xs" />
              Excluir 10% Mais Voláteis
            </button>

            {/* Toggle: Apenas com Caixa Líquido */}
            <button
              type="button"
              onClick={() => setOnlyNetCash(!onlyNetCash)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                onlyNetCash
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon name={onlyNetCash ? 'check_circle' : 'radio_button_unchecked'} size="xs" />
              Apenas com Caixa Líquido
            </button>

            {/* Toggle: Excluir Varejo */}
            <button
              type="button"
              onClick={() => setExcludeVarejo(!excludeVarejo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                excludeVarejo
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name={excludeVarejo ? 'block' : 'storefront'} size="xs" />
              {excludeVarejo ? '🚫 Varejo Excluído' : 'Excluir Varejo'}
            </button>

            {/* Button: Personalizar Setores */}
            <button
              type="button"
              onClick={() => setIsSectorModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                excludedSectors.length > 0 || includedSectors.length > 0
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon name="tune" size="xs" />
              <span>Personalizar Setores</span>
              {(excludedSectors.length > 0 || includedSectors.length > 0) && (
                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {excludedSectors.length + includedSectors.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Ordenar por:
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="indice_valor">🏆 Maior Índice de Valor (Geral)</option>
              <option value="patrimonio_real">🏢 Mais Patrimônio por R$ 1 (1 / P/VP)</option>
              <option value="ev_ebit">⚙️ Menor EV/EBIT (Lucro Operacional)</option>
              <option value="caixa">💵 Posição de Caixa (Dív. Líq / PL)</option>
              <option value="pl">📉 Menor Preço/Lucro (P/L)</option>
              <option value="dy">💰 Maior Dividend Yield</option>
            </select>
          </div>
        </div>

        {/* Active Sector Filters Chips */}
        {(excludeVarejo || excludedSectors.length > 0 || includedSectors.length > 0) && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Icon name="filter_alt" size="xs" />
              Setores:
            </span>
            {excludeVarejo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <span>🚫 Sem Varejo</span>
                <button
                  type="button"
                  onClick={() => setExcludeVarejo(false)}
                  className="hover:text-rose-800 dark:hover:text-rose-200 ml-0.5"
                >
                  <Icon name="close" size="xs" />
                </button>
              </span>
            )}
            {excludedSectors.map(sec => (
              <span
                key={`exc-${sec}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              >
                <span>🚫 Sem {sec}</span>
                <button
                  type="button"
                  onClick={() => setExcludedSectors(prev => prev.filter(s => s !== sec))}
                  className="hover:text-rose-800 dark:hover:text-rose-200 ml-0.5"
                >
                  <Icon name="close" size="xs" />
                </button>
              </span>
            ))}
            {includedSectors.map(sec => (
              <span
                key={`inc-${sec}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                <span>✓ Apenas {sec}</span>
                <button
                  type="button"
                  onClick={() => setIncludedSectors(prev => prev.filter(s => s !== sec))}
                  className="hover:text-emerald-800 dark:hover:text-emerald-200 ml-0.5"
                >
                  <Icon name="close" size="xs" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setExcludeVarejo(false);
                setExcludedSectors([]);
                setIncludedSectors([]);
              }}
              className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline ml-1"
            >
              Limpar Setores
            </button>
          </div>
        )}
      </GlassCard>

      {/* 5. Main Results: Top 30 Table / Cards */}
      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Processando cotações e calculando o Top 30 de barganhas...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtrando liquidez, recuperações judiciais, perdas e volatilidade.
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <Icon name="error" size="lg" className="text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => fetchBarganhas(true)}>
              Tentar Novamente
            </Button>
          </div>
        ) : !data?.results || data.results.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Icon name="search_off" size="lg" className="text-gray-400 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              Nenhuma ação encontrada com os filtros atuais
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Tente diminuir a liquidez mínima ou desmarcar a opção de caixa líquido exclusivo.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedSector('Todos');
                setSelectedSegment('Todos');
                setMinLiquidity(200000);
                setOnlyNetCash(false);
                setSearchQuery('');
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-900/75 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3">Ativo / Empresa</th>
                    <th className="py-3 px-3 text-right">Cotação</th>
                    <th className="py-3 px-3 text-center">Índice de Valor</th>
                    <th className="py-3 px-3 text-center">Patrimônio p/ R$ 1</th>
                    <th className="py-3 px-3 text-right">EV/EBIT</th>
                    <th className="py-3 px-3 text-right">P/L</th>
                    <th className="py-3 px-3 text-right">DY</th>
                    <th className="py-3 px-3 text-center">Posição de Caixa</th>
                    <th className="py-3 px-3 text-right">Liq. Diária</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.results.map((stock) => {
                    const isTop3 = stock.rank <= 3;
                    const isEmeraldScore = stock.indiceValor >= 80;

                    return (
                      <tr
                        key={stock.ticker}
                        className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors ${
                          isTop3 ? 'bg-amber-500/[0.02]' : ''
                        }`}
                      >
                        {/* 1. Rank & Monthly evolution */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                stock.rank === 1
                                  ? 'bg-amber-400 text-amber-950 shadow-xs'
                                  : stock.rank === 2
                                  ? 'bg-slate-300 text-slate-900'
                                  : stock.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'text-gray-700 dark:text-gray-300 font-bold'
                              }`}
                            >
                              {stock.rank}
                            </span>
                            {stock.rankChange === 'up' && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center mt-0.5">
                                ▲{stock.rankDiff}
                              </span>
                            )}
                            {stock.rankChange === 'down' && (
                              <span className="text-[10px] text-red-500 font-bold flex items-center mt-0.5">
                                ▼{stock.rankDiff}
                              </span>
                            )}
                            {stock.rankChange === 'new' && (
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase mt-0.5">
                                Nova
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Ticker & Company */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                {stock.ticker}
                                {onOpenStockDetails && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenStockDetails(stock.ticker)}
                                    title="Abrir Análise e Valuation"
                                    className="text-gray-400 hover:text-emerald-500 transition-colors"
                                  >
                                    <Icon name="open_in_new" size="xs" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[170px]" title={stock.name}>
                                {stock.name}
                              </div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                                {stock.sector} • {stock.segment}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Price */}
                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          R$ {stock.price.toFixed(2)}
                        </td>

                        {/* 4. Índice de Valor (Progress bar + score) */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col items-center">
                            <span className={`font-black text-xs ${isEmeraldScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {stock.indiceValor} / 100
                            </span>
                            <div className="w-20 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${isEmeraldScore ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, stock.indiceValor)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[120px]" title={stock.highlightReason}>
                              {stock.highlightReason}
                            </span>
                          </div>
                        </td>

                        {/* 5. Patrimônio p/ Real (1 / P/VP) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-2 py-0.5 rounded-md inline-block">
                            R$ {stock.patrimonioPorReal.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            P/VP: {stock.pvp.toFixed(2)}x
                          </div>
                        </td>

                        {/* 6. EV/EBIT & Margem */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {stock.evEbit.toFixed(1)}x
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            Mrg. {stock.mrgEbit.toFixed(1)}%
                          </div>
                        </td>

                        {/* 7. P/L */}
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {stock.pl.toFixed(1)}x
                        </td>

                        {/* 8. Dividend Yield */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={`font-semibold ${stock.dy >= 6.0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {stock.dy.toFixed(1)}%
                          </span>
                        </td>

                        {/* 9. Posição de Caixa */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {stock.isNetCash ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1">
                              <Icon name="check" size="xs" />
                              Caixa Líquido
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-600 dark:text-gray-300">
                              Dív. {stock.divLiqPatrim.toFixed(2)}x PL
                            </span>
                          )}
                        </td>

                        {/* 10. Liquidez */}
                        <td className="py-3 px-3 text-right text-gray-500 dark:text-gray-400 text-[11px] whitespace-nowrap">
                          {stock.liq2m >= 1000000
                            ? `R$ ${(stock.liq2m / 1000000).toFixed(1)}M/d`
                            : `R$ ${(stock.liq2m / 1000).toFixed(0)}k/d`}
                        </td>

                        {/* 11. Actions */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {onOpenNewInvModal && (
                              <button
                                type="button"
                                onClick={() => onOpenNewInvModal(stock.ticker, stock.price)}
                                title="Fazer Aporte / Adicionar à Carteira"
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <Icon name="add" size="xs" />
                                Aportar
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

            {/* Mobile Cards View */}
            <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {data.results.map((stock) => (
                <div key={stock.ticker} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          stock.rank === 1
                            ? 'bg-amber-400 text-amber-950'
                            : stock.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : stock.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {stock.rank}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                          {stock.ticker}
                          {stock.rankChange === 'up' && (
                            <span className="text-[10px] text-emerald-600 font-bold">▲{stock.rankDiff}</span>
                          )}
                          {stock.rankChange === 'new' && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-600 font-bold px-1 rounded">Nova</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                          {stock.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">
                        R$ {stock.price.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Score: {stock.indiceValor}
                      </div>
                    </div>
                  </div>

                  {/* Compact Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Patrimônio / R$ 1</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        R$ {stock.patrimonioPorReal.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-[10px]">EV/EBIT (Operacional)</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stock.evEbit.toFixed(1)}x
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-[10px]">P/L &amp; DY</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stock.pl.toFixed(1)}x • {stock.dy.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Caixa / Dívida</span>
                      <span className={`font-semibold ${stock.isNetCash ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {stock.isNetCash ? 'Caixa Líquido' : `${stock.divLiqPatrim.toFixed(1)}x PL`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {onOpenStockDetails && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenStockDetails(stock.ticker)}
                        className="flex-1 text-xs py-1"
                      >
                        Ver Detalhes
                      </Button>
                    )}
                    {onOpenNewInvModal && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onOpenNewInvModal(stock.ticker, stock.price)}
                        className="flex-1 text-xs py-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        + Aporte
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Sector Customization Modal */}
      <Modal
        isOpen={isSectorModalOpen}
        onClose={() => setIsSectorModalOpen(false)}
        title="Personalizar &amp; Excluir Setores da B3"
        size="lg"
      >
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Selecione quais setores você quer <strong>bloquear/excluir</strong> (ex: Varejo, Construção Civil) ou filtre <strong>apenas determinados setores</strong> com exclusividade.
          </p>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Atalhos Rápidos:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setExcludeVarejo(true);
                  if (!excludedSectors.includes('Consumo Cíclico')) {
                    setExcludedSectors(prev => [...prev, 'Consumo Cíclico']);
                  }
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all"
              >
                🚫 Excluir Varejo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!excludedSectors.includes('Construção Civil')) {
                    setExcludedSectors(prev => [...prev, 'Construção Civil']);
                  }
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all"
              >
                🚫 Excluir Construção Civil
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncludedSectors(['Financeiro', 'Utilidade Pública', 'Telecomunicações']);
                  setExcludedSectors([]);
                  setExcludeVarejo(false);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all"
              >
                🛡️ Apenas Perenes (BEST)
              </button>
              <button
                type="button"
                onClick={() => {
                  setExcludedSectors([]);
                  setIncludedSectors([]);
                  setExcludeVarejo(false);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                Restaurar Todos
              </button>
            </div>
          </div>

          {/* All Sectors List */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {allB3Sectors.map((sec) => {
              const isExcluded = excludedSectors.includes(sec) || (sec === 'Consumo Cíclico' && excludeVarejo);
              const isIncluded = includedSectors.includes(sec);

              return (
                <div
                  key={sec}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isExcluded
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : isIncluded
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        isExcluded
                          ? 'bg-rose-500 text-white'
                          : isIncluded
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}
                    >
                      <Icon name={isExcluded ? 'block' : isIncluded ? 'check' : 'domain'} size="xs" />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-gray-900 dark:text-white">
                        {sec}
                        {sec === 'Consumo Cíclico' && (
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            (Lojas, Vestuário, Varejo)
                          </span>
                        )}
                      </span>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        {isExcluded ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">Excluído do ranking</span>
                        ) : isIncluded ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Incluído exclusivamente</span>
                        ) : (
                          'Ativo no universo padrão'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (sec === 'Consumo Cíclico') setExcludeVarejo(!isExcluded);
                        if (isExcluded) {
                          setExcludedSectors(prev => prev.filter(s => s !== sec));
                        } else {
                          setExcludedSectors(prev => [...prev, sec]);
                          setIncludedSectors(prev => prev.filter(s => s !== sec));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        isExcluded
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30'
                      }`}
                    >
                      {isExcluded ? 'Excluído ✕' : 'Excluir'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isIncluded) {
                          setIncludedSectors(prev => prev.filter(s => s !== sec));
                        } else {
                          setIncludedSectors(prev => [...prev, sec]);
                          setExcludedSectors(prev => prev.filter(s => s !== sec));
                          if (sec === 'Consumo Cíclico') setExcludeVarejo(false);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        isIncluded
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30'
                      }`}
                    >
                      {isIncluded ? 'Apenas este ✓' : 'Apenas este'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSectorModalOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4"
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
