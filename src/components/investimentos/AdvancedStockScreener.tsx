'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ScreenerAsset, ViabilityType } from '@/app/api/stocks/screener/route';

interface AdvancedStockScreenerProps {
  onOpenNewInvModal?: (prefilledTicker?: string, prefilledPrice?: number) => void;
  onNavigateToGraham?: (ticker: string) => void;
}

type SavedFilterPreset = {
  id: string;
  name: string;
  isSystem?: boolean;
  type: 'acoes' | 'stocks' | 'fiis';
  sector?: string;
  subsector?: string;
  segment?: string;
  viabilities: ViabilityType[];
  minPl?: number | null;
  maxPl?: number | null;
  minPvp?: number | null;
  maxPvp?: number | null;
  minDy?: number | null;
  maxDy?: number | null;
  minRoe?: number | null;
  maxRoe?: number | null;
  minMargem?: number | null;
  maxDivida?: number | null;
};

const SYSTEM_PRESETS: SavedFilterPreset[] = [
  {
    id: 'graham-barganhas',
    name: '⭐ Graham: Barganhas (P/VP ≤ 1.0 & P/L ≤ 15)',
    isSystem: true,
    type: 'acoes',
    viabilities: ['AZULIM', 'VIAVEL'],
    minPl: 0,
    maxPl: 15,
    minPvp: 0,
    maxPvp: 1.0,
    minRoe: 10
  },
  {
    id: 'bazin-dividendos',
    name: '💰 Décio Bazin: Dividendos Sustentáveis (DY ≥ 6%)',
    isSystem: true,
    type: 'acoes',
    viabilities: ['AZULIM', 'VIAVEL'],
    minDy: 6,
    maxDy: 30,
    minRoe: 12
  },
  {
    id: 'azulim-bluechips',
    name: '🔷 Selo Azulim: Blue Chips de Alta Rentabilidade',
    isSystem: true,
    type: 'acoes',
    viabilities: ['AZULIM'],
    minRoe: 15,
    minDy: 5
  },
  {
    id: 'fiis-descontados',
    name: '🏢 FIIs: Descontados com Alto Rendimento (P/VP ≤ 1.0 & DY ≥ 9%)',
    isSystem: true,
    type: 'fiis',
    viabilities: ['AZULIM', 'VIAVEL'],
    minPvp: 0.5,
    maxPvp: 1.0,
    minDy: 9.0
  },
  {
    id: 'greenblatt-magic',
    name: '🧙 Fórmula Mágica: Baixo P/L + Alto ROE',
    isSystem: true,
    type: 'acoes',
    viabilities: ['AZULIM', 'VIAVEL'],
    minPl: 2,
    maxPl: 10,
    minRoe: 18
  },
  {
    id: 'bomba-risco',
    name: '🚨 Alerta: Ativos de Alto Risco / Em Dificuldade',
    isSystem: true,
    type: 'acoes',
    viabilities: ['BOMBA']
  }
];

const LOCAL_STORAGE_SAVED_FILTERS_KEY = 'minhas_financas_screener_saved_filters_v1';

export function AdvancedStockScreener({
  onOpenNewInvModal,
  onNavigateToGraham
}: AdvancedStockScreenerProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'acoes' | 'stocks' | 'fiis'>('acoes');

  // Search & Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [selectedSubsector, setSelectedSubsector] = useState('Todos');
  const [selectedSegment, setSelectedSegment] = useState('Todos');

  // Viability seals: BOMBA, ATENCAO, VIAVEL, AZULIM
  const [selectedViabilities, setSelectedViabilities] = useState<ViabilityType[]>([
    'AZULIM',
    'VIAVEL'
  ]);

  // Indicator Ranges
  const [minPvp, setMinPvp] = useState<string>('0');
  const [maxPvp, setMaxPvp] = useState<string>('1');

  const [minPl, setMinPl] = useState<string>('0');
  const [maxPl, setMaxPl] = useState<string>('20');

  const [minDy, setMinDy] = useState<string>('0');
  const [maxDy, setMaxDy] = useState<string>('10');

  const [minRoe, setMinRoe] = useState<string>('0');
  const [maxRoe, setMaxRoe] = useState<string>('100');

  // Additional Optional Indicators
  const [visibleIndicators, setVisibleIndicators] = useState({
    pvp: true,
    pl: true,
    dy: true,
    roe: true,
    margem: false,
    divida: false
  });
  const [minMargem, setMinMargem] = useState<string>('0');
  const [maxDivida, setMaxDivida] = useState<string>('3.5');
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);

  // Saved Filters
  const [userPresets, setUserPresets] = useState<SavedFilterPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [copiedLinkSuccess, setCopiedLinkSuccess] = useState(false);

  // Screener Data & Results
  const [results, setResults] = useState<ScreenerAsset[]>([]);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableSubsectors, setAvailableSubsectors] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalUniverse, setTotalUniverse] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState<keyof ScreenerAsset>('dy');
  const [sortAsc, setSortAsc] = useState(false);

  // Load custom saved filters from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVED_FILTERS_KEY);
      if (stored) {
        setUserPresets(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to LocalStorage
  const persistUserPresets = (updated: SavedFilterPreset[]) => {
    setUserPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_SAVED_FILTERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Fetch screener data from API
  const fetchScreenerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      if (selectedSector && selectedSector !== 'Todos') params.set('sector', selectedSector);
      if (selectedSubsector && selectedSubsector !== 'Todos') params.set('subsector', selectedSubsector);
      if (selectedSegment && selectedSegment !== 'Todos') params.set('segment', selectedSegment);
      if (selectedViabilities.length > 0) params.set('viability', selectedViabilities.join(','));
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      if (minPl && !isNaN(Number(minPl))) params.set('min_pl', minPl);
      if (maxPl && !isNaN(Number(maxPl))) params.set('max_pl', maxPl);
      if (minPvp && !isNaN(Number(minPvp))) params.set('min_pvp', minPvp);
      if (maxPvp && !isNaN(Number(maxPvp))) params.set('max_pvp', maxPvp);
      if (minDy && !isNaN(Number(minDy))) params.set('min_dy', minDy);
      if (maxDy && !isNaN(Number(maxDy))) params.set('max_dy', maxDy);
      if (minRoe && !isNaN(Number(minRoe))) params.set('min_roe', minRoe);
      if (maxRoe && !isNaN(Number(maxRoe))) params.set('max_roe', maxRoe);
      if (visibleIndicators.margem && minMargem) params.set('min_margem', minMargem);
      if (visibleIndicators.divida && maxDivida) params.set('max_divida', maxDivida);

      const res = await fetch(`/api/stocks/screener?${params.toString()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAvailableSectors(data.sectors || []);
        setAvailableSubsectors(data.subsectors || []);
        setAvailableSegments(data.segments || []);
        setTotalUniverse(data.totalUniverse || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar screener:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    selectedSector,
    selectedSubsector,
    selectedSegment,
    selectedViabilities,
    searchTerm,
    minPl,
    maxPl,
    minPvp,
    maxPvp,
    minDy,
    maxDy,
    minRoe,
    maxRoe,
    visibleIndicators.margem,
    minMargem,
    visibleIndicators.divida,
    maxDivida
  ]);

  // Initial load or tab change
  useEffect(() => {
    fetchScreenerData();
  }, [fetchScreenerData]);

  // Toggle viability selection
  const toggleViability = (type: ViabilityType) => {
    setSelectedViabilities(prev => {
      if (prev.includes(type)) {
        return prev.filter(v => v !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  // Reset Filters
  const handleClearFilters = () => {
    setSelectedSector('Todos');
    setSelectedSubsector('Todos');
    setSelectedSegment('Todos');
    setSelectedViabilities(['AZULIM', 'VIAVEL']);
    setMinPvp('');
    setMaxPvp('');
    setMinPl('');
    setMaxPl('');
    setMinDy('');
    setMaxDy('');
    setMinRoe('');
    setMaxRoe('');
    setMinMargem('');
    setMaxDivida('');
    setSearchTerm('');
    setActivePresetId('');
  };

  // Apply a Preset
  const handleApplyPreset = (preset: SavedFilterPreset) => {
    setActivePresetId(preset.id);
    setActiveTab(preset.type);
    setSelectedSector(preset.sector || 'Todos');
    setSelectedSubsector(preset.subsector || 'Todos');
    setSelectedSegment(preset.segment || 'Todos');
    setSelectedViabilities(preset.viabilities || ['AZULIM', 'VIAVEL']);
    setMinPvp(preset.minPvp !== undefined && preset.minPvp !== null ? String(preset.minPvp) : '');
    setMaxPvp(preset.maxPvp !== undefined && preset.maxPvp !== null ? String(preset.maxPvp) : '');
    setMinPl(preset.minPl !== undefined && preset.minPl !== null ? String(preset.minPl) : '');
    setMaxPl(preset.maxPl !== undefined && preset.maxPl !== null ? String(preset.maxPl) : '');
    setMinDy(preset.minDy !== undefined && preset.minDy !== null ? String(preset.minDy) : '');
    setMaxDy(preset.maxDy !== undefined && preset.maxDy !== null ? String(preset.maxDy) : '');
    setMinRoe(preset.minRoe !== undefined && preset.minRoe !== null ? String(preset.minRoe) : '');
    setMaxRoe(preset.maxRoe !== undefined && preset.maxRoe !== null ? String(preset.maxRoe) : '');
    setMinMargem(preset.minMargem !== undefined && preset.minMargem !== null ? String(preset.minMargem) : '');
    setMaxDivida(preset.maxDivida !== undefined && preset.maxDivida !== null ? String(preset.maxDivida) : '');
  };

  // Save new user preset
  const handleSaveCurrentFilter = () => {
    if (!newPresetName.trim()) return;
    const newPreset: SavedFilterPreset = {
      id: 'custom-' + Date.now(),
      name: newPresetName.trim(),
      type: activeTab,
      sector: selectedSector,
      subsector: selectedSubsector,
      segment: selectedSegment,
      viabilities: selectedViabilities,
      minPvp: minPvp ? Number(minPvp) : null,
      maxPvp: maxPvp ? Number(maxPvp) : null,
      minPl: minPl ? Number(minPl) : null,
      maxPl: maxPl ? Number(maxPl) : null,
      minDy: minDy ? Number(minDy) : null,
      maxDy: maxDy ? Number(maxDy) : null,
      minRoe: minRoe ? Number(minRoe) : null,
      maxRoe: maxRoe ? Number(maxRoe) : null,
      minMargem: minMargem ? Number(minMargem) : null,
      maxDivida: maxDivida ? Number(maxDivida) : null
    };

    const updated = [...userPresets, newPreset];
    persistUserPresets(updated);
    setActivePresetId(newPreset.id);
    setNewPresetName('');
    setIsSaveModalOpen(false);
  };

  // Delete active user preset
  const handleDeletePreset = () => {
    if (!activePresetId) return;
    const isSys = SYSTEM_PRESETS.some(p => p.id === activePresetId);
    if (isSys) {
      alert('Filtros padrão do sistema não podem ser excluídos.');
      return;
    }
    const updated = userPresets.filter(p => p.id !== activePresetId);
    persistUserPresets(updated);
    setActivePresetId('');
  };

  // Share / Copy filter summary to clipboard
  const handleShareFilter = () => {
    const summary = `🔍 Filtro de Ativos (${activeTab.toUpperCase()}):\nSetor: ${selectedSector}\nSelos: ${selectedViabilities.join(', ')}\nP/L: ${minPl || 0} - ${maxPl || '∞'}\nP/VP: ${minPvp || 0} - ${maxPvp || '∞'}\nDY: ${minDy || 0}% - ${maxDy || '∞'}%\nROE: ${minRoe || 0}% - ${maxRoe || '∞'}%`;
    navigator.clipboard.writeText(summary);
    setCopiedLinkSuccess(true);
    setTimeout(() => setCopiedLinkSuccess(false), 3000);
  };

  // Sort results
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [results, sortField, sortAsc]);

  const handleSort = (field: keyof ScreenerAsset) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Viability styling helpers
  const getViabilityBadge = (v: ViabilityType) => {
    switch (v) {
      case 'AZULIM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-2xs">
            <span className="text-blue-500">🔷</span>
            <span>Azulim</span>
          </span>
        );
      case 'VIAVEL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs">
            <span>🟢</span>
            <span>Viável</span>
          </span>
        );
      case 'ATENCAO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
            <span>🟡</span>
            <span>Atenção</span>
          </span>
        );
      case 'BOMBA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-2xs">
            <span>🔴</span>
            <span>Bomba</span>
          </span>
        );
    }
  };

  const allPresets = [...SYSTEM_PRESETS, ...userPresets];

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Início</span>
        <span>&gt;</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          {activeTab === 'acoes' ? 'Ações' : activeTab === 'stocks' ? 'Stocks' : 'FIIs'}
        </span>
        <span>&gt;</span>
        <span className="font-bold text-blue-600 dark:text-blue-400">Busca avançada</span>
      </div>

      {/* Main Tabs (Ações, Stocks, FIIs) */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          { key: 'acoes', label: 'Ações (B3)', icon: 'show_chart', count: totalUniverse || 0 },
          { key: 'stocks', label: 'Stocks (EUA / ETFs)', icon: 'public', count: 9 },
          { key: 'fiis', label: 'FIIs (Imobiliário)', icon: 'domain', count: 8 }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any);
              setSelectedSector('Todos');
              setSelectedSubsector('Todos');
              setSelectedSegment('Todos');
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 relative ${
              activeTab === tab.key
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border-b-2 border-blue-600 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/40'
            }`}
          >
            <Icon name={tab.icon} size="sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 1. FILTROS SALVOS CARD */}
      <GlassCard className="p-5 space-y-4 border border-blue-100 dark:border-blue-900/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                <Icon name="bookmark" size="sm" />
              </span>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-white border-b-2 border-blue-600 pb-0.5">
                FILTROS SALVOS
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Salve suas buscas e garimpos estratégicos, e carregue sempre que quiser!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Share Button */}
            <button
              onClick={handleShareFilter}
              className="p-2 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-2xs flex items-center gap-1"
              title="Copiar resumo do filtro atual"
            >
              <Icon name="share" size="sm" />
              {copiedLinkSuccess ? <span className="text-[11px] font-bold">Copiado!</span> : null}
            </button>

            {/* Edit / Save Name Button */}
            <button
              onClick={() => setIsSaveModalOpen(true)}
              className="p-2 rounded-xl text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors shadow-2xs flex items-center gap-1"
              title="Salvar ou renomear busca atual"
            >
              <Icon name="edit" size="sm" />
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDeletePreset}
              disabled={!activePresetId || SYSTEM_PRESETS.some(p => p.id === activePresetId)}
              className="p-2 rounded-xl text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
              title="Excluir filtro salvo selecionado"
            >
              <Icon name="delete" size="sm" />
            </button>

            {/* Preset Selector Dropdown */}
            <select
              value={activePresetId}
              onChange={(e) => {
                const pid = e.target.value;
                if (!pid) {
                  setActivePresetId('');
                  return;
                }
                const found = allPresets.find(p => p.id === pid);
                if (found) handleApplyPreset(found);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Nenhum filtro selecionado</option>
              <optgroup label="Estratégias de Fábrica (Padrão)">
                {SYSTEM_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              {userPresets.length > 0 && (
                <optgroup label="Meus Filtros Personalizados">
                  {userPresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* 2. BUSCA AVANÇADA CARD */}
      <GlassCard className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Icon name="search" size="sm" />
            </span>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-white border-b-2 border-blue-600 pb-0.5">
              BUSCA AVANÇADA
            </h2>
          </div>

          {/* Search by Ticker / Name Input */}
          <div className="w-full sm:w-64">
            <Input
              placeholder="Buscar Ticker ou Empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              className="text-xs"
            />
          </div>
        </div>

        {/* Setores, Subsetores, Segmentos Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              SETORES
            </label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-blue-500 focus:outline-hidden"
            >
              <option value="Todos">Todos os Setores</option>
              {availableSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              SUBSETORES
            </label>
            <select
              value={selectedSubsector}
              onChange={(e) => setSelectedSubsector(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-blue-500 focus:outline-hidden"
            >
              <option value="Todos">Todos os Subsetores</option>
              {availableSubsectors.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              SEGMENTOS
            </label>
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-blue-500 focus:outline-hidden"
            >
              <option value="Todos">Todos os Segmentos</option>
              {availableSegments.map(seg => (
                <option key={seg} value={seg}>{seg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* SELO DE VIABILIDADE */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            SELO DE VIABILIDADE
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'BOMBA' as ViabilityType, label: 'Bomba', emoji: '🔴', colorClass: 'border-red-300 text-red-700 dark:text-red-300 bg-red-50/70 dark:bg-red-950/30' },
              { type: 'ATENCAO' as ViabilityType, label: 'Requer atenção', emoji: '🟡', colorClass: 'border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30' },
              { type: 'VIAVEL' as ViabilityType, label: 'Viável', emoji: '🟢', colorClass: 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30' },
              { type: 'AZULIM' as ViabilityType, label: 'Azulim', emoji: '🔷', colorClass: 'border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30' }
            ].map(seal => {
              const isSelected = selectedViabilities.includes(seal.type);
              return (
                <button
                  key={seal.type}
                  type="button"
                  onClick={() => toggleViability(seal.type)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 shadow-2xs ${
                    isSelected
                      ? `${seal.colorClass} ring-2 ring-blue-500/40 font-extrabold`
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                    isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-400'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span>{seal.label}</span>
                  <span>{seal.emoji}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* INDICADORES HEADER & FILTER BUTTON */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              INDICADORES FUNDAMENTALISTAS
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsIndicatorModalOpen(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <Icon name="tune" size="sm" />
              <span>Filtrar indicadores</span>
            </Button>
          </div>

          {/* DUAL SLIDERS & RANGE CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. P/VP */}
            {visibleIndicators.pvp && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">P/VP</span>
                  <span
                    className="cursor-help text-gray-400 hover:text-blue-500"
                    title="Preço sobre Valor Patrimonial. Abaixo de 1.0 indica que a ação negocia com desconto sobre seus ativos líquidos."
                  >
                    ⓘ
                  </span>
                </div>

                {/* Range Bubble Display */}
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-xs">
                    {minPvp || '0'} — {maxPvp || '1.0'}
                  </span>
                </div>

                {/* Dual Slider bar representation */}
                <div className="relative py-1">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={maxPvp || '1'}
                    onChange={(e) => setMaxPvp(e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  />
                </div>

                {/* Min / Max Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Min"
                      value={minPvp}
                      onChange={(e) => setMinPvp(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Max"
                      value={maxPvp}
                      onChange={(e) => setMaxPvp(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. P/L */}
            {visibleIndicators.pl && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">P/L</span>
                  <span
                    className="cursor-help text-gray-400 hover:text-blue-500"
                    title="Preço sobre Lucro. Estima quantos anos seriam necessários para o lucro líquido pagar o preço pago pela ação."
                  >
                    ⓘ
                  </span>
                </div>

                {/* Range Bubble Display */}
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-xs">
                    {minPl || '0'} — {maxPl || '20'}
                  </span>
                </div>

                {/* Slider */}
                <div className="relative py-1">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={maxPl || '20'}
                    onChange={(e) => setMaxPl(e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  />
                </div>

                {/* Min / Max Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      step="1"
                      placeholder="Min"
                      value={minPl}
                      onChange={(e) => setMinPl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="1"
                      placeholder="Max"
                      value={maxPl}
                      onChange={(e) => setMaxPl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. DIVIDEND YIELD */}
            {visibleIndicators.dy && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">DIVIDEND YIELD</span>
                  <span
                    className="cursor-help text-gray-400 hover:text-blue-500"
                    title="Rendimento de dividendos nos últimos 12 meses em relação ao preço atual."
                  >
                    ⓘ
                  </span>
                </div>

                {/* Range Bubble Display */}
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-xs">
                    {minDy || '0'}% — {maxDy || '10'}%
                  </span>
                </div>

                {/* Slider */}
                <div className="relative py-1">
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    value={maxDy || '10'}
                    onChange={(e) => setMaxDy(e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  />
                </div>

                {/* Min / Max Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Min %"
                      value={minDy}
                      onChange={(e) => setMinDy(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Max %"
                      value={maxDy}
                      onChange={(e) => setMaxDy(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. ROE */}
            {visibleIndicators.roe && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">ROE (%)</span>
                  <span
                    className="cursor-help text-gray-400 hover:text-blue-500"
                    title="Retorno sobre Patrimônio Líquido. Mede a eficiência na geração de lucros com os recursos dos sócios."
                  >
                    ⓘ
                  </span>
                </div>

                {/* Range Bubble Display */}
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-xs">
                    {minRoe || '0'}% — {maxRoe || '100'}%
                  </span>
                </div>

                {/* Slider */}
                <div className="relative py-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={maxRoe || '100'}
                    onChange={(e) => setMaxRoe(e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  />
                </div>

                {/* Min / Max Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      step="1"
                      placeholder="Min %"
                      value={minRoe}
                      onChange={(e) => setMinRoe(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="1"
                      placeholder="Max %"
                      value={maxRoe}
                      onChange={(e) => setMaxRoe(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Extra 5: Margem Líquida */}
            {visibleIndicators.margem && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">MARGEM LÍQ. (%)</span>
                  <span className="cursor-help text-gray-400" title="Percentual de cada R$ de receita que sobra como lucro líquido.">ⓘ</span>
                </div>
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
                    Min {minMargem || '0'}%
                  </span>
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Min Margem %"
                    value={minMargem}
                    onChange={(e) => setMinMargem(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            )}

            {/* Extra 6: Dívida Líq./EBITDA */}
            {visibleIndicators.divida && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200">DÍVIDA LÍQ./EBITDA</span>
                  <span className="cursor-help text-gray-400" title="Alavancagem financeira. Valores abaixo de 2.5x são considerados saudáveis.">ⓘ</span>
                </div>
                <div className="flex justify-center">
                  <span className="px-3 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
                    Máx {maxDivida || '3.5'}x
                  </span>
                </div>
                <div>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Máx Alavancagem"
                    value={maxDivida}
                    onChange={(e) => setMaxDivida(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-center text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClearFilters}
            className="w-full sm:w-auto text-xs font-bold text-gray-600 hover:text-red-600"
          >
            <Icon name="clear_all" size="sm" />
            <span>LIMPAR FILTROS</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsSaveModalOpen(true)}
              className="flex-1 sm:flex-initial text-xs font-bold flex items-center gap-1.5"
            >
              <Icon name="save" size="sm" className="text-blue-500" />
              <span>SALVAR FILTROS</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => fetchScreenerData()}
              disabled={isLoading}
              className="flex-1 sm:flex-initial text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white flex items-center justify-center gap-1.5 px-6 shadow-md"
            >
              <Icon name="search" size="sm" className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'FILTRANDO...' : 'APLICAR FILTROS'}</span>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* 3. RESULTADOS DA BUSCA AVANÇADA TABLE */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="format_list_bulleted" className="text-blue-600 dark:text-blue-400" />
              <span>Oportunidades Encontradas</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {sortedResults.length} {sortedResults.length === 1 ? 'ativo' : 'ativos'}
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Resultados ordenáveis por qualquer indicador com atalho para inclusão direta na carteira
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-xs text-gray-400 font-medium">Garimpando ativos na B3 e mercado internacional...</p>
          </div>
        ) : sortedResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/60 dark:text-gray-400 font-extrabold">
                <tr>
                  <th scope="col" className="px-3 py-3 rounded-l-xl cursor-pointer hover:text-blue-600" onClick={() => handleSort('ticker')}>
                    Ativo / Empresa {sortField === 'ticker' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-center cursor-pointer hover:text-blue-600" onClick={() => handleSort('viability')}>
                    Selo de Viabilidade {sortField === 'viability' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => handleSort('sector')}>
                    Setor & Segmento {sortField === 'sector' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('price')}>
                    Cotação {sortField === 'price' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('pvp')}>
                    P/VP {sortField === 'pvp' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('pl')}>
                    P/L {sortField === 'pl' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('dy')}>
                    DY (12M) {sortField === 'dy' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right cursor-pointer hover:text-blue-600" onClick={() => handleSort('roe')}>
                    ROE (%) {sortField === 'roe' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Preço Justo (Graham/Bazin)
                  </th>
                  <th scope="col" className="px-3 py-3 text-center rounded-r-xl">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((asset) => {
                  const curr = asset.type === 'stocks' ? 'USD' : 'BRL';
                  const isDescontado = (asset.grahamDiscount !== null && asset.grahamDiscount > 0) || (asset.bazinDiscount !== null && asset.bazinDiscount > 0);

                  return (
                    <tr
                      key={asset.ticker}
                      className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      {/* Ticker & Name */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigateToGraham?.(asset.ticker)}
                            title={`Abrir Raio-X e Valuations de ${asset.ticker}`}
                            className="px-2 py-0.5 rounded font-mono font-extrabold text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900 hover:scale-105 transition-all cursor-pointer"
                          >
                            {asset.ticker}
                          </button>
                          <div>
                            <p
                              onClick={() => onNavigateToGraham?.(asset.ticker)}
                              className="font-bold text-gray-900 dark:text-white leading-tight hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            >
                              {asset.name}
                            </p>
                            <span className="text-[10px] text-gray-400">{asset.subsector || asset.sector}</span>
                          </div>
                        </div>
                      </td>

                      {/* Viability Seal */}
                      <td className="px-3 py-3 text-center" title={asset.viabilityReason}>
                        {getViabilityBadge(asset.viability)}
                      </td>

                      {/* Sector */}
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {asset.sector}
                        </span>
                      </td>

                      {/* Current Price */}
                      <td className="px-3 py-3 text-right font-extrabold text-gray-900 dark:text-white">
                        {curr === 'USD' ? `$${asset.price.toFixed(2)}` : `R$ ${asset.price.toFixed(2).replace('.', ',')}`}
                      </td>

                      {/* P/VP */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold ${asset.pvp !== null && asset.pvp <= 1.0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                          {asset.pvp !== null ? asset.pvp.toFixed(2) : '-'}
                        </span>
                      </td>

                      {/* P/L */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold ${asset.pl !== null && asset.pl > 0 && asset.pl <= 12 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                          {asset.pl !== null ? asset.pl.toFixed(1) : '-'}
                        </span>
                      </td>

                      {/* DY */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold ${asset.dy !== null && asset.dy >= 6 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                          {asset.dy !== null ? `${asset.dy.toFixed(2)}%` : '-'}
                        </span>
                      </td>

                      {/* ROE */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold ${asset.roe !== null && asset.roe >= 15 ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>
                          {asset.roe !== null ? `${asset.roe.toFixed(1)}%` : '-'}
                        </span>
                      </td>

                      {/* Preço Justo / Margem */}
                      <td className="px-3 py-3 text-right">
                        {asset.grahamPrice ? (
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              Graham: R$ {asset.grahamPrice.toFixed(2).replace('.', ',')}
                            </p>
                            {asset.grahamDiscount !== null && (
                              <span className={`text-[10px] font-bold ${asset.grahamDiscount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                ({asset.grahamDiscount >= 0 ? `+${asset.grahamDiscount}% margem` : `${asset.grahamDiscount}%`})
                              </span>
                            )}
                          </div>
                        ) : asset.bazinPrice ? (
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              Teto: R$ {asset.bazinPrice.toFixed(2).replace('.', ',')}
                            </p>
                            {asset.bazinDiscount !== null && (
                              <span className={`text-[10px] font-bold ${asset.bazinDiscount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                ({asset.bazinDiscount >= 0 ? `+${asset.bazinDiscount}% margem` : `${asset.bazinDiscount}%`})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onNavigateToGraham && (
                            <button
                              onClick={() => onNavigateToGraham(asset.ticker)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors flex items-center gap-1"
                              title="Abrir Raio-X Completo e Valuations desta ação"
                            >
                              <Icon name="query_stats" size="sm" />
                              <span>Detalhes</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenNewInvModal?.(asset.ticker, asset.price)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1"
                            title="Adicionar à minha carteira"
                          >
                            <Icon name="add_circle" size="sm" />
                            <span>Carteira</span>
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
          <div className="py-12 text-center text-xs text-gray-400 italic">
            Nenhum ativo encontrado com a combinação de filtros selecionada. Experimente ajustar os limites ou limpar os filtros.
          </div>
        )}
      </GlassCard>

      {/* MODAL: FILTRAR INDICADORES VISÍVEIS */}
      <Modal
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
        title="Personalizar Indicadores do Screener"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Selecione quais múltiplos e métricas você deseja exibir e filtrar nos cards:
          </p>

          <div className="space-y-2.5">
            {[
              { key: 'pvp', label: 'P/VP (Preço / Valor Patrimonial)' },
              { key: 'pl', label: 'P/L (Preço / Lucro)' },
              { key: 'dy', label: 'Dividend Yield (%)' },
              { key: 'roe', label: 'ROE (% Retorno s/ Patrimônio)' },
              { key: 'margem', label: 'Margem Líquida (%)' },
              { key: 'divida', label: 'Dívida Líquida / EBITDA (Alavancagem)' }
            ].map(item => (
              <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(visibleIndicators as any)[item.key]}
                  onChange={(e) => {
                    setVisibleIndicators(prev => ({
                      ...prev,
                      [item.key]: e.target.checked
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setIsIndicatorModalOpen(false)}>
              Concluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: SALVAR FILTRO PERSONALIZADO */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Salvar Combinação de Filtros"
      >
        <div className="space-y-4">
          <Input
            label="Nome do Filtro Salvo"
            placeholder="Ex: Minhas Ações de Dividendos Favoritas, FIIs de Tijolo Baratos..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            required
          />

          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-800 dark:text-blue-300">
            Este filtro será salvo localmente no seu navegador e você poderá recarregá-lo instantaneamente a qualquer momento.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveCurrentFilter}
              disabled={!newPresetName.trim()}
            >
              Salvar Filtro
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
