'use client';

import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useInvestments, Investment } from '@/hooks/useInvestments';
import { ImportInvestmentsModal } from '@/components/investimentos/ImportInvestmentsModal';
import { GrahamAnalysisTable } from '@/components/investimentos/GrahamAnalysisTable';
import { AdvancedStockScreener } from '@/components/investimentos/AdvancedStockScreener';
import { StockDetailDashboard } from '@/components/investimentos/StockDetailDashboard';
import { TaxCalculatorDashboard } from '@/components/investimentos/TaxCalculatorDashboard';
import { useOptionsStrategies } from '@/hooks/useOptionsStrategies';
import { OptionsStrategyDashboard } from '@/components/investimentos/OptionsStrategyDashboard';
import { NewOptionStrategyModal } from '@/components/investimentos/NewOptionStrategyModal';
import { StrategyCategory } from '@/lib/options/optionsEngine';

ChartJS.register(ArcElement, Tooltip, Legend);

// Robust Brazilian currency and fractional number parser
function parseNumberInput(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let str = String(val).replace(/[R$\s]/g, '').trim();
  if (str.includes('.') && str.includes(',')) {
    // Brazilian format with dot as thousand and comma as decimal (ex: 397.484,01)
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return parseFloat(str) || 0;
}

export default function InvestmentsPage() {
  const {
    investments,
    types,
    loading,
    error: loadError,
    isSyncingQuotes,
    usdRate,
    syncLiveQuotes,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    clearAllInvestments,
    addInvestmentEntry,
    batchImportInvestments
  } = useInvestments();

  // Options & Strategies Hook
  const {
    strategies: optionsStrategies,
    isSyncing: isSyncingOptions,
    autoRefresh: autoRefreshOptions,
    setAutoRefresh: setAutoRefreshOptions,
    lastSyncTime: optionsLastSyncTime,
    notificationPermission: optionsNotificationPermission,
    requestNotificationPermission: requestOptionsNotifications,
    syncQuotes: syncOptionsQuotes,
    addStrategy: addOptionStrategy,
    updateStrategy: updateOptionStrategy,
    deleteStrategy: deleteOptionStrategy,
    closeStrategy: closeOptionStrategy,
    updateLegPrice: updateOptionLegPrice,
    resetLegOverride: resetOptionLegOverride
  } = useOptionsStrategies(investments);

  // Main Section Navigation: 'carteira' | 'screener' | 'detalhes' | 'analise' | 'ir' | 'opcoes'
  const [activeMainTab, setActiveMainTab] = useState<'carteira' | 'screener' | 'detalhes' | 'analise' | 'ir' | 'opcoes'>('carteira');
  const [selectedGrahamTicker, setSelectedGrahamTicker] = useState<string | undefined>(undefined);
  const [selectedDetailTicker, setSelectedDetailTicker] = useState<string>('CMIG4');
  const [filterText, setFilterText] = useState('');

  const handleOpenStockDetails = (ticker: string) => {
    setSelectedDetailTicker(ticker.trim().toUpperCase());
    setActiveMainTab('detalhes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modals state
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [optionModalInitialConfig, setOptionModalInitialConfig] = useState<{
    underlying?: string;
    optionTicker?: string;
    strike?: number;
    category?: StrategyCategory;
  } | null>(null);
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [selectedInv, setSelectedInv] = useState<Investment | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSearchingQuote, setIsSearchingQuote] = useState(false);

  // Investment Form (with Auto Calculator: Qtd * Price = Total)
  const [calcMode, setCalcMode] = useState<'shares' | 'total'>('shares');
  const [invForm, setInvForm] = useState({
    name: '',
    ticker: '',
    type_id: '',
    currency: 'BRL' as 'BRL' | 'USD',
    institution: '',
    plan_type: 'PGBL' as 'PGBL' | 'VGBL' | '',
    tax_regime: 'Regressivo' as 'Regressivo' | 'Progressivo' | '',
    quantity: '',
    unit_price: '',
    fees: '',
    total_amount: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: ''
  });

  // Entry / Aporte Form (with Auto Calculator)
  const [entryCalcMode, setEntryCalcMode] = useState<'shares' | 'total'>('shares');
  const [entryForm, setEntryForm] = useState({
    type: 'aporte' as 'aporte' | 'resgate' | 'rendimento',
    quantity: '',
    unit_price: '',
    fees: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Search quotes when typing ticker or asset name
  const handleFetchTickerQuote = async (rawTickerSymbol?: string) => {
    let clean = (rawTickerSymbol || invForm.ticker || invForm.name).trim().toUpperCase();
    if (!clean) return;

    // Normalizations
    if (clean === 'BITCOIN' || clean.includes('BITCOIN')) clean = 'BTC';
    if (clean === 'ETHEREUM' || clean.includes('ETHEREUM')) clean = 'ETH';
    if (clean === 'SOLANA' || clean.includes('SOLANA')) clean = 'SOL';
    if (clean === 'TETHER' || clean.includes('TETHER')) clean = 'USDT';

    setIsSearchingQuote(true);
    try {
      const res = await fetch(`/api/stocks/quote?ticker=${encodeURIComponent(clean)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.price) {
          setInvForm(prev => {
            const qty = parseNumberInput(prev.quantity) || 1;
            const price = data.price;
            const fees = parseNumberInput(prev.fees) || 0;
            const total = (qty * price) + fees;

            const isUsd = data.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD', 'SPY', 'AAPL', 'MSFT', 'TSLA', 'NVDA'].includes(clean);

            // Auto-select type for crypto / fii / ações / etfs internacionais
            let autoTypeId = prev.type_id;
            if (data.isCrypto || ['BTC', 'ETH', 'SOL', 'USDT', 'ADA', 'XRP', 'DOGE'].includes(clean)) {
              const cryptoType = types.find(t => t.name.toLowerCase().includes('cripto'));
              if (cryptoType) autoTypeId = cryptoType.id;
            } else if (isUsd) {
              const etfInternType = types.find(t => t.name.toLowerCase().includes('intern') || t.name.toLowerCase().includes('etf'));
              if (etfInternType) autoTypeId = etfInternType.id;
            } else if (clean.endsWith('11')) {
              const fiiType = types.find(t => t.name.toLowerCase().includes('fii'));
              if (fiiType) autoTypeId = fiiType.id;
            } else if (/^[A-Z]{4}\d[A-Z]?$/.test(clean)) {
              const acoesType = types.find(t => t.name.toLowerCase().includes('ações') || t.name.toLowerCase().includes('acoes'));
              if (acoesType) autoTypeId = acoesType.id;
            }

            return {
              ...prev,
              ticker: data.symbol || clean,
              name: data.name || clean,
              currency: isUsd ? 'USD' : 'BRL',
              type_id: autoTypeId,
              unit_price: String(price),
              quantity: prev.quantity || '1',
              total_amount: String(total.toFixed(2))
            };
          });
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar cotação:', e);
    } finally {
      setIsSearchingQuote(false);
    }
  };

  // Sync quotes automatically on load
  useEffect(() => {
    if (investments.length > 0) {
      syncLiveQuotes(investments);
    }
  }, [investments.length]);

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatQuantity = (qty?: number | null) => {
    if (!qty || qty === 0) return '-';
    if (qty < 1) {
      // High precision for crypto like 0.00025974
      return qty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }
    return qty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  // Calculations in BRL for total portfolio balance
  const totalInvested = investments.reduce((acc, curr) => {
    const invested = Number(curr.total_invested) || 0;
    const isUsd = curr.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((curr.ticker || '').toUpperCase());
    return acc + (isUsd ? invested * usdRate : invested);
  }, 0);

  const totalCurrent = investments.reduce((acc, curr) => {
    const balance = Number(curr.current_balance) || 0;
    const isUsd = curr.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((curr.ticker || '').toUpperCase());
    return acc + (isUsd ? balance * usdRate : balance);
  }, 0);

  const totalProfit = totalCurrent - totalInvested;
  const totalYield = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const lockedInvestments = investments.filter(i => i.due_date && i.due_date > todayStr);
  const totalLocked = lockedInvestments.reduce((acc, curr) => {
    const balance = Number(curr.current_balance) || 0;
    const isUsd = curr.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((curr.ticker || '').toUpperCase());
    return acc + (isUsd ? balance * usdRate : balance);
  }, 0);
  const totalLiquid = totalCurrent - totalLocked;

  // Breakdown by Type
  const activeOptions = optionsStrategies.filter(s => s.status !== 'closed');
  const totalOptionsAllocated = activeOptions.reduce((sum, s) => sum + (s.totalEntryCost || (s.entryCostPerUnit * s.quantity)), 0);
  const totalCurrentWithDerivatives = totalCurrent + totalOptionsAllocated;

  const typeAgg: { [key: string]: { name: string; icon: string; color: string; total: number; count: number } } = {};
  investments.forEach(inv => {
    const isUsd = inv.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((inv.ticker || '').toUpperCase());
    const typeName = isUsd ? (inv.investment_type?.name?.includes('Intern') ? inv.investment_type.name : 'ETFs Internacionais') : (inv.investment_type?.name || 'Outros');
    const color = isUsd ? '#0ea5e9' : (inv.investment_type?.color || '#3b82f6');
    const icon = isUsd ? 'public' : (inv.investment_type?.icon || 'account_balance_wallet');
    const balanceBrl = isUsd ? (Number(inv.current_balance) || 0) * usdRate : (Number(inv.current_balance) || 0);

    if (!typeAgg[typeName]) {
      typeAgg[typeName] = { name: typeName, icon, color, total: 0, count: 0 };
    }
    typeAgg[typeName].total += balanceBrl;
    typeAgg[typeName].count += 1;
  });

  if (totalOptionsAllocated > 0) {
    typeAgg['Derivativos / Opções'] = {
      name: 'Derivativos / Opções',
      icon: 'candlestick_chart',
      color: '#8b5cf6',
      total: totalOptionsAllocated,
      count: activeOptions.length
    };
  }

  const typeList = Object.values(typeAgg).map(t => ({
    ...t,
    percentage: totalCurrentWithDerivatives > 0 ? Number(((t.total / totalCurrentWithDerivatives) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  const doughnutChartData = {
    labels: typeList.map(t => t.name),
    datasets: [
      {
        data: typeList.map(t => t.total),
        backgroundColor: typeList.map(t => t.color),
        borderWidth: 0,
      }
    ]
  };

  // Breakdown by Institution
  const instAgg: { [key: string]: { name: string; total: number; count: number } } = {};
  investments.forEach(inv => {
    const isUsd = inv.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((inv.ticker || '').toUpperCase());
    const instName = inv.institution?.trim() || (isUsd ? 'Internacional' : 'Sem Instituição');
    const balanceBrl = isUsd ? (Number(inv.current_balance) || 0) * usdRate : (Number(inv.current_balance) || 0);

    if (!instAgg[instName]) {
      instAgg[instName] = { name: instName, total: 0, count: 0 };
    }
    instAgg[instName].total += balanceBrl;
    instAgg[instName].count += 1;
  });

  const instList = Object.values(instAgg).map(i => ({
    ...i,
    percentage: totalCurrent > 0 ? Number(((i.total / totalCurrent) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  const filteredInvestments = investments.filter(inv => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      inv.name.toLowerCase().includes(q) ||
      (inv.ticker && inv.ticker.toLowerCase().includes(q)) ||
      (inv.institution && inv.institution.toLowerCase().includes(q)) ||
      (inv.investment_type?.name && inv.investment_type.name.toLowerCase().includes(q))
    );
  });


  // Modal Open Handlers
  const handleOpenInvModal = (invToEdit?: Investment, prefilledTicker?: string, prefilledPrice?: number) => {
    setFormError('');
    if (invToEdit) {
      setEditingInvId(invToEdit.id);
      const isUsd = invToEdit.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((invToEdit.ticker || '').toUpperCase());
      setInvForm({
        name: invToEdit.name,
        ticker: invToEdit.ticker || '',
        type_id: invToEdit.type_id || (types.length > 0 ? types[0].id : ''),
        currency: isUsd ? 'USD' : 'BRL',
        institution: invToEdit.institution || '',
        plan_type: (invToEdit.plan_type as any) || 'PGBL',
        tax_regime: (invToEdit.tax_regime as any) || 'Regressivo',
        quantity: invToEdit.quantity ? String(invToEdit.quantity) : '',
        unit_price: invToEdit.average_price ? String(invToEdit.average_price) : '',
        fees: '',
        total_amount: String(invToEdit.total_invested || ''),
        date: new Date().toISOString().split('T')[0],
        due_date: invToEdit.due_date || '',
        notes: invToEdit.notes || ''
      });
    } else {
      setEditingInvId(null);
      const cleanTicker = (prefilledTicker || '').toUpperCase().trim();
      const isUsd = ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD', 'SPY', 'AAPL', 'MSFT', 'TSLA', 'NVDA'].includes(cleanTicker);
      const targetType = isUsd
        ? types.find(t => t.name.toLowerCase().includes('intern') || t.name.toLowerCase().includes('etf'))
        : types.find(t => t.name.toLowerCase().includes('ações') || t.name.toLowerCase().includes('acoes'));
      
      setInvForm({
        name: cleanTicker || '',
        ticker: cleanTicker,
        currency: isUsd ? 'USD' : 'BRL',
        type_id: targetType ? targetType.id : (types.length > 0 ? types[0].id : ''),
        institution: isUsd ? 'Internacional' : '',
        plan_type: 'PGBL',
        tax_regime: 'Regressivo',
        quantity: '1',
        unit_price: prefilledPrice ? String(prefilledPrice) : '',
        fees: '',
        total_amount: prefilledPrice ? String(prefilledPrice) : '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: cleanTicker ? `Ativo: ${cleanTicker}` : ''
      });

      if (cleanTicker) {
        handleFetchTickerQuote(cleanTicker);
      }
    }
    setIsInvModalOpen(true);
  };

  const handleOpenEntryModal = (inv: Investment) => {
    setFormError('');
    setSelectedInv(inv);
    setEntryForm({
      type: 'aporte',
      quantity: '1',
      unit_price: inv.current_price || inv.average_price ? String(inv.current_price || inv.average_price) : '',
      fees: '',
      amount: inv.current_price || inv.average_price ? String(inv.current_price || inv.average_price) : '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsEntryModalOpen(true);
  };

  // Quantity / Unit Price change handlers for New Investment
  const handleInvQtyChange = (qtyStr: string) => {
    const qty = parseNumberInput(qtyStr);
    const price = parseNumberInput(invForm.unit_price);
    const fees = parseNumberInput(invForm.fees);
    const total = (qty * price) + fees;

    setInvForm(prev => ({
      ...prev,
      quantity: qtyStr,
      total_amount: total > 0 ? String(total.toFixed(2)) : prev.total_amount
    }));
  };

  const handleInvPriceChange = (priceStr: string) => {
    const qty = parseNumberInput(invForm.quantity) || 1;
    const price = parseNumberInput(priceStr);
    const fees = parseNumberInput(invForm.fees);
    const total = (qty * price) + fees;

    setInvForm(prev => ({
      ...prev,
      unit_price: priceStr,
      total_amount: total > 0 ? String(total.toFixed(2)) : prev.total_amount
    }));
  };

  const handleInvFeesChange = (feesStr: string) => {
    const qty = parseNumberInput(invForm.quantity);
    const price = parseNumberInput(invForm.unit_price);
    const fees = parseNumberInput(feesStr);
    const total = (qty * price) + fees;

    setInvForm(prev => ({
      ...prev,
      fees: feesStr,
      total_amount: total > 0 ? String(total.toFixed(2)) : prev.total_amount
    }));
  };

  // Quantity / Unit Price change handlers for Entry Modal
  const handleEntryQtyChange = (qtyStr: string) => {
    const qty = parseNumberInput(qtyStr);
    const price = parseNumberInput(entryForm.unit_price);
    const fees = parseNumberInput(entryForm.fees);
    const total = (qty * price) + fees;

    setEntryForm(prev => ({
      ...prev,
      quantity: qtyStr,
      amount: total > 0 ? String(total.toFixed(2)) : prev.amount
    }));
  };

  const handleEntryPriceChange = (priceStr: string) => {
    const qty = parseNumberInput(entryForm.quantity) || 1;
    const price = parseNumberInput(priceStr);
    const fees = parseNumberInput(entryForm.fees);
    const total = (qty * price) + fees;

    setEntryForm(prev => ({
      ...prev,
      unit_price: priceStr,
      amount: total > 0 ? String(total.toFixed(2)) : prev.amount
    }));
  };

  // Form Submission Handlers
  const handleSaveInvestment = async () => {
    if (!invForm.name || !invForm.type_id) {
      setFormError('Por favor, preencha o nome do ativo e selecione o tipo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const qty = parseNumberInput(invForm.quantity);
    const unitPrice = parseNumberInput(invForm.unit_price);
    const fees = parseNumberInput(invForm.fees);
    const rawTotal = parseNumberInput(invForm.total_amount) || (qty * unitPrice + fees);

    const selectedType = types.find(t => t.id === invForm.type_id);
    const isPrevidencia = selectedType?.name.toLowerCase().includes('previd') || false;

    let success = false;
    if (editingInvId) {
      success = await updateInvestment(editingInvId, {
        name: invForm.name,
        ticker: invForm.ticker,
        type_id: invForm.type_id,
        currency: invForm.currency,
        institution: invForm.institution,
        due_date: invForm.due_date || null,
        plan_type: isPrevidencia ? invForm.plan_type : null,
        tax_regime: isPrevidencia ? invForm.tax_regime : null,
        notes: invForm.notes
      });
    } else {
      success = await addInvestment({
        name: invForm.name,
        ticker: invForm.ticker,
        type_id: invForm.type_id,
        currency: invForm.currency,
        institution: invForm.institution,
        plan_type: isPrevidencia ? invForm.plan_type : undefined,
        tax_regime: isPrevidencia ? invForm.tax_regime : undefined,
        quantity: qty > 0 ? qty : undefined,
        unit_price: unitPrice > 0 ? unitPrice : undefined,
        fees: fees > 0 ? fees : undefined,
        initial_amount: rawTotal > 0 ? rawTotal : undefined,
        date: invForm.date,
        due_date: invForm.due_date || undefined,
        notes: invForm.notes
      });
    }

    setIsSubmitting(false);
    if (success) {
      setIsInvModalOpen(false);
    } else {
      setFormError('Erro ao salvar investimento. Tente novamente.');
    }
  };

  const handleDeleteInvestment = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o ativo "${name}" e todo o histórico?`)) {
      await deleteInvestment(id);
    }
  };

  const handleClearAllInvestments = async () => {
    if (window.confirm('Atenção: Deseja realmente excluir TODOS os investimentos da sua carteira e zerar o histórico? Essa ação não pode ser desfeita.')) {
      await clearAllInvestments();
    }
  };

  const handleAddEntry = async () => {
    if (!selectedInv) return;

    const qty = parseNumberInput(entryForm.quantity);
    const unitPrice = parseNumberInput(entryForm.unit_price);
    const fees = parseNumberInput(entryForm.fees);
    const finalAmount = parseNumberInput(entryForm.amount) || (qty * unitPrice + fees);

    if (finalAmount <= 0) {
      setFormError('Por favor, preencha o valor da movimentação.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addInvestmentEntry({
      investment_id: selectedInv.id,
      type: entryForm.type,
      amount: finalAmount,
      currency: selectedInv.currency || 'BRL',
      quantity: qty > 0 ? qty : undefined,
      unit_price: unitPrice > 0 ? unitPrice : undefined,
      fees: fees > 0 ? fees : undefined,
      date: entryForm.date,
      notes: entryForm.notes
    });

    setIsSubmitting(false);
    if (success) {
      setIsEntryModalOpen(false);
    } else {
      setFormError('Erro ao registrar movimentação. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Investimentos
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Acompanhamento de carteira e cotações em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* USD Rate Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/50 text-xs text-gray-600 dark:text-gray-300" title="Cotação comercial USD/BRL">
            <span className="font-semibold text-gray-400 text-[10px] uppercase">USD</span>
            <span className="font-mono font-medium">{formatCurrency(usdRate, 'BRL')}</span>
          </div>

          {/* Live Quote Sync Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              syncLiveQuotes();
              syncOptionsQuotes();
            }}
            disabled={isSyncingQuotes || isSyncingOptions || (investments.length === 0 && optionsStrategies.length === 0)}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            title="Atualizar cotações atuais de mercado na B3 e mercado internacional"
          >
            <Icon name="refresh" size="sm" className={isSyncingQuotes || isSyncingOptions ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isSyncingQuotes || isSyncingOptions ? 'Atualizando...' : 'Atualizar'}</span>
          </Button>

          {/* Import Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Importar
          </Button>

          {/* New Option / Strategy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOptionModalOpen(true)}
            className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            + Opção
          </Button>

          {/* Clear Portfolio Button */}
          {investments.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllInvestments}
              className="p-1.5 text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg"
              title="Excluir todos os ativos da carteira"
            >
              <Icon name="delete_sweep" size="sm" />
            </button>
          )}

          {/* New Investment Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenInvModal()}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <Icon name="add" size="sm" /> 
            <span>Novo Ativo</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs">
          {loadError}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div 
        className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-gray-800/50 rounded-xl w-full sm:w-fit max-w-full overflow-x-auto hide-scrollbar no-scrollbar border border-gray-200/60 dark:border-gray-700/40"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          type="button"
          onClick={() => setActiveMainTab('carteira')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeMainTab === 'carteira'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>Carteira</span>
          {investments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200/60 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
              {investments.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('detalhes')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeMainTab === 'detalhes'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">Raio-X & Comparador</span>
          <span className="sm:hidden">Raio-X</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('screener')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeMainTab === 'screener'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Screener
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('analise')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeMainTab === 'analise'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Análise
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('ir')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            activeMainTab === 'ir'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span className="hidden sm:inline">Calculadora IR</span>
          <span className="sm:hidden">IR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('opcoes')}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeMainTab === 'opcoes'
              ? 'bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 shadow-xs font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>Opções</span>
          {optionsStrategies.filter(s => s.status !== 'closed').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold">
              {optionsStrategies.filter(s => s.status !== 'closed').length}
            </span>
          )}
        </button>
      </div>

      {activeMainTab === 'carteira' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Patrimony */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Patrimônio Total</span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{formatCurrency(totalCurrent, 'BRL')}</h2>
                <p className="text-xs mt-1">
                  <span className={`font-medium ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, 'BRL')} ({totalYield.toFixed(2)}%)
                  </span>
                </p>
              </div>
            </GlassCard>

            {/* Total Invested */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Aplicado</span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{formatCurrency(totalInvested, 'BRL')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {investments.length} {investments.length === 1 ? 'ativo' : 'ativos'}
                </p>
              </div>
            </GlassCard>

            {/* Total Profit */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Rentabilidade Geral</span>
              <div>
                <h2 className={`text-2xl font-bold tracking-tight ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, 'BRL')}
                </h2>
                <p className="text-xs mt-1">
                  <span className={`font-medium ${totalYield >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {totalYield >= 0 ? '+' : ''}{totalYield.toFixed(2)}% acumulado
                  </span>
                </p>
              </div>
            </GlassCard>

            {/* Liquidity Breakdown */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Disponibilidade</span>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Imediata</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totalLiquid, 'BRL')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 dark:text-gray-400">A Prazo</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(totalLocked, 'BRL')}</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Main Charts & Allocation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Allocation by Type (Donut Chart & Clean Rows) */}
            <GlassCard className="p-5 lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Alocação por Categoria</h3>
                <span className="text-xs text-gray-400 font-medium">{typeList.length} categorias</span>
              </div>

              {investments.length > 0 && totalCurrent > 0 ? (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-full md:w-5/12 flex items-center justify-center">
                    <div className="h-44 w-44 relative flex items-center justify-center">
                      <Doughnut 
                        data={doughnutChartData} 
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              callbacks: {
                                label: function(context: any) {
                                  const value = context.raw;
                                  const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                                  const percentage = totalCurrent > 0 ? ((value / totalCurrent) * 100).toFixed(1) : '0';
                                  return ` ${context.label}: ${formattedValue} (${percentage}%)`;
                                }
                              }
                            }
                          },
                          cutout: '80%'
                        }} 
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                        <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase">
                          Total
                        </span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          {formatCurrency(totalCurrent, 'BRL')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-7/12 space-y-2.5">
                    {typeList.map((type, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0" 
                              style={{ backgroundColor: type.color }}
                            />
                            <span className="font-medium">{type.name}</span>
                          </span>
                          <span className="font-mono text-gray-900 dark:text-white font-medium">
                            {formatCurrency(type.total, 'BRL')} <span className="text-gray-400 text-[11px] font-normal">({type.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${Math.max(2, type.percentage)}%`, backgroundColor: type.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-gray-400">
                  Nenhum investimento com saldo cadastrado.
                </div>
              )}
            </GlassCard>

            {/* Allocation by Financial Institution */}
            <GlassCard className="p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custódia</h3>
                  <span className="text-xs text-gray-400 font-medium">{instList.length} instituições</span>
                </div>

                {instList.length > 0 && totalCurrent > 0 ? (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {instList.map((inst, idx) => (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{inst.name}</span>
                          <div className="text-right">
                            <span className="font-mono font-medium text-gray-900 dark:text-white">{formatCurrency(inst.total, 'BRL')}</span>
                            <span className="text-[11px] text-gray-400 ml-1.5">({inst.percentage}%)</span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500/80 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.max(2, inst.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-gray-400">
                    Nenhuma instituição registrada.
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Detailed Assets Table */}
          <GlassCard className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ativos na Carteira</h3>
                <span className="text-xs text-gray-400 font-normal">
                  {investments.length} {investments.length === 1 ? 'ativo cadastrado' : 'ativos cadastrados'}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {investments.length > 3 && (
                  <div className="relative flex-1 sm:w-48">
                    <input
                      type="text"
                      placeholder="Filtrar ativos..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:inline">
                  Saldo: <strong className="text-gray-900 dark:text-white font-mono">{formatCurrency(totalCurrent, 'BRL')}</strong>
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredInvestments.length > 0 ? (
              <div 
                className="overflow-x-auto no-scrollbar hide-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="text-[11px] text-gray-400 uppercase font-medium border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th scope="col" className="py-2.5 pr-3">Ativo</th>
                      <th scope="col" className="py-2.5 px-3">Categoria</th>
                      <th scope="col" className="py-2.5 px-2 text-center">Qtd</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Preço Médio</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Cotação</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Total Aplicado</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Saldo Atual</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Rentabilidade</th>
                      <th scope="col" className="py-2.5 pl-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {filteredInvestments.map((inv) => {
                      const isUsd = inv.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((inv.ticker || '').toUpperCase());
                      const curr = isUsd ? 'USD' : 'BRL';
                      
                      const invYield = inv.total_invested > 0 
                        ? ((inv.current_balance - inv.total_invested) / inv.total_invested) * 100 
                        : (inv.average_price && inv.average_price > 0 && inv.current_price ? ((inv.current_price - inv.average_price) / inv.average_price) * 100 : 0);
                      
                      const isPositive = invYield >= 0;
                      const profitAmt = inv.current_balance - inv.total_invested;
                      const hasQty = inv.quantity && inv.quantity > 0;
                      const isNameIdentical = inv.ticker && inv.name.trim().toUpperCase() === inv.ticker.trim().toUpperCase();

                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                          <td className="py-3 pr-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                {inv.ticker ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenStockDetails(inv.ticker!)}
                                    title={`Ver detalhes e valuations de ${inv.ticker}`}
                                    className="font-mono font-semibold text-xs text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left cursor-pointer"
                                  >
                                    {inv.ticker}
                                  </button>
                                ) : (
                                  <span className="font-semibold text-gray-900 dark:text-white text-xs">
                                    {inv.name}
                                  </span>
                                )}

                                {isUsd && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500">
                                    USD
                                  </span>
                                )}
                                {inv.plan_type && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">
                                    {inv.plan_type}
                                  </span>
                                )}
                              </div>

                              {inv.ticker && !isNameIdentical && (
                                <p className="text-gray-400 text-[11px] truncate max-w-[140px] mt-0.5">
                                  {inv.name}
                                </p>
                              )}

                              {inv.due_date && (
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  Venc: {formatDate(inv.due_date)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                                <span 
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: isUsd ? '#0ea5e9' : (inv.investment_type?.color || '#0058be') }}
                                />
                                <span>{isUsd ? 'Internacional' : (inv.investment_type?.name || 'Outro')}</span>
                              </div>
                              {inv.institution && (
                                <span className="text-[10px] text-gray-400 mt-0.5">{inv.institution}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-2 text-center font-mono text-gray-700 dark:text-gray-300 text-xs">
                            {hasQty ? formatQuantity(inv.quantity) : '-'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                            {inv.average_price && inv.average_price > 0 ? formatCurrency(inv.average_price, curr) : '-'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap text-xs">
                            {inv.current_price && inv.current_price > 0 ? formatCurrency(inv.current_price, curr) : '-'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-xs">
                            <p className="text-gray-700 dark:text-gray-300">{formatCurrency(inv.total_invested, curr)}</p>
                            {isUsd && (
                              <p className="text-[10px] text-gray-400">≈ {formatCurrency(inv.total_invested * usdRate, 'BRL')}</p>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-xs">
                            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.current_balance, curr)}</p>
                            {isUsd && (
                              <p className="text-[10px] text-gray-400">≈ {formatCurrency(inv.current_balance * usdRate, 'BRL')}</p>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap text-xs">
                            <p className={`font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                              {isPositive ? '+' : ''}{formatCurrency(profitAmt, curr)}
                            </p>
                            <p className={`text-[10px] ${isPositive ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-rose-500/80'}`}>
                              {isPositive ? '+' : ''}{invYield.toFixed(2)}%
                            </p>
                          </td>

                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleOpenEntryModal(inv)}
                                className="px-2 py-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors text-[11px] font-medium"
                                title="Registrar aporte ou movimentação"
                              >
                                + Aporte
                              </button>
                              <button 
                                onClick={() => handleOpenInvModal(inv)}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors"
                                title="Editar"
                              >
                                <Icon name="edit" size="sm" />
                              </button>
                              <button 
                                onClick={() => handleDeleteInvestment(inv.id, inv.name)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                                title="Excluir"
                              >
                                <Icon name="delete" size="sm" />
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
              <div className="py-12">
                <EmptyState 
                  title="Nenhum investimento encontrado" 
                  description={filterText ? "Tente buscar com outro termo." : "Cadastre seus ativos para começar."} 
                  icon="account_balance"
                />
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* 2. Detalhes da Ação & Valuations (Bazin, Graham, Peter Lynch, Preço Teto Projetivo, Indicadores) */}
      {activeMainTab === 'detalhes' && (
        <StockDetailDashboard
          initialTicker={selectedDetailTicker}
          investments={investments}
          onOpenNewInvModal={(ticker, price) => handleOpenInvModal(undefined, ticker, price)}
          onOpenNewOptionModal={(underlying, optionTicker, strike, category) => {
            setOptionModalInitialConfig({
              underlying,
              optionTicker,
              strike,
              category
            });
            setIsOptionModalOpen(true);
          }}
        />
      )}

      {/* 3. Busca Avançada / Screener de Ativos (Ações, Stocks & FIIs) */}
      {activeMainTab === 'screener' && (
        <AdvancedStockScreener
          onOpenNewInvModal={(ticker, price) => handleOpenInvModal(undefined, ticker, price)}
          onNavigateToGraham={(ticker) => handleOpenStockDetails(ticker)}
        />
      )}

      {/* 4. Tabela & Análise Fundamentalista de Graham, Bazin e FIIs */}
      {activeMainTab === 'analise' && (
        <GrahamAnalysisTable
          investments={investments}
          initialTicker={selectedGrahamTicker}
          onOpenEntryModal={handleOpenEntryModal}
          onOpenNewInvModal={(ticker, price) => handleOpenInvModal(undefined, ticker, price)}
        />
      )}

      {/* 5. Calculadora de IR & DARF (íon Itaú / B3) */}
      {activeMainTab === 'ir' && (
        <TaxCalculatorDashboard />
      )}

      {/* 6. Opções & Estratégias (Travas de Baixa/Alta B3, Spread & Alertas) */}
      {activeMainTab === 'opcoes' && (
        <OptionsStrategyDashboard
          strategies={optionsStrategies}
          investments={investments}
          totalPortfolioValue={totalCurrentWithDerivatives > 0 ? totalCurrentWithDerivatives : 18200}
          isSyncing={isSyncingOptions}
          autoRefresh={autoRefreshOptions}
          lastSyncTime={optionsLastSyncTime}
          onToggleAutoRefresh={() => setAutoRefreshOptions(!autoRefreshOptions)}
          onSyncQuotes={syncOptionsQuotes}
          onOpenNewStrategyModal={() => setIsOptionModalOpen(true)}
          onUpdateStrategy={updateOptionStrategy}
          onDeleteStrategy={deleteOptionStrategy}
          onCloseStrategy={closeOptionStrategy}
          onUpdateLegPrice={updateOptionLegPrice}
          onResetLegOverride={resetOptionLegOverride}
          notificationPermission={optionsNotificationPermission}
          onRequestNotifications={requestOptionsNotifications}
        />
      )}

      {/* Modal - Novo / Editar Investimento (com Calculadora Qtd * Preço) */}
      <Modal 
        isOpen={isInvModalOpen} 
        onClose={() => !isSubmitting && setIsInvModalOpen(false)} 
        title={editingInvId ? "Editar Investimento" : "Nova Compra / Cadastro de Ativo"}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          {/* Currency Toggle */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Moeda do Investimento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInvForm(prev => ({ ...prev, currency: 'BRL' }))}
                className={`p-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                  invForm.currency === 'BRL'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                <span>Real Brasileiro (R$)</span>
              </button>
              <button
                type="button"
                onClick={() => setInvForm(prev => ({ ...prev, currency: 'USD' }))}
                className={`p-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                  invForm.currency === 'USD'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                <span>Dólar Americano (US$)</span>
              </button>
            </div>
          </div>

          {/* Ticker Search & Auto Complete */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Ticker / Código do Ativo
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  placeholder="Ex: IVV, PETR4, MXRF11, BTC" 
                  value={invForm.ticker}
                  onChange={(e) => setInvForm({...invForm, ticker: e.target.value.toUpperCase()})}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchTickerQuote(invForm.ticker);
                    }
                  }}
                  className="font-mono font-bold"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleFetchTickerQuote(invForm.ticker)}
                disabled={isSearchingQuote || !invForm.ticker.trim()}
                className="shrink-0 text-xs flex items-center gap-1"
              >
                <Icon name="search" size="sm" className={isSearchingQuote ? 'animate-spin' : ''} />
                <span>{isSearchingQuote ? 'Buscando...' : 'Buscar'}</span>
              </Button>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { symbol: 'IVV', label: 'IVV (S&P 500)' },
                { symbol: 'VXUS', label: 'VXUS (Total Intl)' },
                { symbol: 'TFLO', label: 'TFLO' },
                { symbol: 'BTC', label: 'Bitcoin' },
                { symbol: 'PETR4', label: 'Petrobras' },
                { symbol: 'VALE3', label: 'Vale' },
                { symbol: 'MXRF11', label: 'Maxi Renda' }
              ].map(chip => (
                <button
                  key={chip.symbol}
                  type="button"
                  onClick={() => {
                    setInvForm(prev => ({ ...prev, ticker: chip.symbol }));
                    handleFetchTickerQuote(chip.symbol);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 rounded-md transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <Input 
            label="Nome do Ativo" 
            placeholder="Ex: iShares Core S&P 500 ETF, Vanguard Total Intl, Bitcoin, Petrobras" 
            value={invForm.name}
            onChange={(e) => setInvForm({...invForm, name: e.target.value})}
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo de Investimento" 
              value={invForm.type_id}
              onChange={(e) => {
                const newTypeId = e.target.value;
                const isPrev = types.find(t => t.id === newTypeId)?.name.toLowerCase().includes('previd');
                setInvForm({
                  ...invForm, 
                  type_id: newTypeId,
                  plan_type: isPrev ? (invForm.plan_type || 'PGBL') : invForm.plan_type,
                  tax_regime: isPrev ? (invForm.tax_regime || 'Regressivo') : invForm.tax_regime
                });
                if (isPrev) {
                  setCalcMode('total');
                }
              }}
              options={types.map(t => ({ value: t.id, label: t.name }))}
            />
            <Input 
              label="Instituição / Seguradora / Corretora" 
              placeholder={invForm.currency === 'USD' ? "Ex: Avenue, Nomad, Interactive Brokers, XP" : "Ex: XP, BTG, Itaú, Binance"} 
              value={invForm.institution}
              onChange={(e) => setInvForm({...invForm, institution: e.target.value})}
            />
          </div>

          {/* Previdência Privada Specific Fields */}
          {types.find(t => t.id === invForm.type_id)?.name.toLowerCase().includes('previd') && (
            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl space-y-3 border border-emerald-200 dark:border-emerald-800/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Icon name="shield" size="sm" className="text-emerald-600 dark:text-emerald-400" />
                <span>Configurações do Plano de Previdência</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Modalidade do Plano
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInvForm({ ...invForm, plan_type: 'PGBL' })}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center justify-center ${
                        invForm.plan_type === 'PGBL'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>PGBL</span>
                      <span className="text-[10px] font-normal opacity-80">Abate até 12% IRPF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvForm({ ...invForm, plan_type: 'VGBL' })}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center justify-center ${
                        invForm.plan_type === 'VGBL'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>VGBL</span>
                      <span className="text-[10px] font-normal opacity-80">IR só no rendimento</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Regime de Tributação
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInvForm({ ...invForm, tax_regime: 'Regressivo' })}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center justify-center ${
                        invForm.tax_regime === 'Regressivo'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>Regressivo</span>
                      <span className="text-[10px] font-normal opacity-80">10% a 35% por tempo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvForm({ ...invForm, tax_regime: 'Progressivo' })}
                      className={`p-2 rounded-lg text-xs font-bold border transition-all flex flex-col items-center justify-center ${
                        invForm.tax_regime === 'Progressivo'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                      }`}
                    >
                      <span>Progressivo</span>
                      <span className="text-[10px] font-normal opacity-80">Tabela Geral do IR</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Automatic Calculator: Qtd * Preço Unitário */}
          {!editingInvId && (
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Icon name="calculate" size="sm" className="text-emerald-500" /> Calculadora de Compra ({invForm.currency === 'USD' ? 'Dólar US$' : 'Reais R$'})
                </span>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCalcMode('shares')}
                    className={`px-2 py-1 rounded font-bold transition-colors ${
                      calcMode === 'shares' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Por Cotas/Frações
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalcMode('total')}
                    className={`px-2 py-1 rounded font-bold transition-colors ${
                      calcMode === 'total' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Valor Direto
                  </button>
                </div>
              </div>

              {calcMode === 'shares' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input 
                      label="Quantidade / Fração" 
                      type="text" 
                      placeholder={invForm.currency === 'USD' ? "Ex: 0.05597 ou 10" : "Ex: 100"} 
                      value={invForm.quantity}
                      onChange={(e) => handleInvQtyChange(e.target.value)}
                    />
                    <Input 
                      label={`Preço Unitário (${invForm.currency === 'USD' ? 'US$' : 'R$'})`} 
                      type="text" 
                      placeholder={invForm.currency === 'USD' ? "Ex: 769.54" : "Ex: 35,80"} 
                      value={invForm.unit_price}
                      onChange={(e) => handleInvPriceChange(e.target.value)}
                    />
                    <Input 
                      label={`Taxas (${invForm.currency === 'USD' ? 'US$' : 'R$'})`} 
                      type="text" 
                      placeholder="0,00" 
                      value={invForm.fees}
                      onChange={(e) => handleInvFeesChange(e.target.value)}
                    />
                  </div>

                  {/* Calculated total display banner */}
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Total ({invForm.quantity || 0} x {formatCurrency(parseNumberInput(invForm.unit_price), invForm.currency)}):
                    </span>
                    <div className="text-right">
                      <strong className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 block">
                        {formatCurrency(parseNumberInput(invForm.total_amount), invForm.currency)}
                      </strong>
                      {invForm.currency === 'USD' && (
                        <span className="text-[10px] text-gray-500">
                          ≈ {formatCurrency(parseNumberInput(invForm.total_amount) * usdRate, 'BRL')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <Input 
                  label={`Valor Total da Aplicação (${invForm.currency === 'USD' ? 'US$' : 'R$'})`} 
                  type="text" 
                  placeholder="0,00" 
                  value={invForm.total_amount}
                  onChange={(e) => setInvForm({...invForm, total_amount: e.target.value})}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Data da Operação" 
              type="date" 
              value={invForm.date}
              onChange={(e) => setInvForm({...invForm, date: e.target.value})}
            />
            <Input 
              label={
                types.find(t => t.id === invForm.type_id)?.name.toLowerCase().includes('previd')
                  ? "Previsão de Aposentadoria / Resgate (Opcional)"
                  : "Data de Vencimento / Carência (Opcional)"
              } 
              type="date" 
              value={invForm.due_date}
              onChange={(e) => setInvForm({...invForm, due_date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Ex: Compra fracionário, ETF americano, aporte mensal..." 
            value={invForm.notes}
            onChange={(e) => setInvForm({...invForm, notes: e.target.value})}
          />
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            {editingInvId ? (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  const invToDelete = investments.find(i => i.id === editingInvId);
                  setIsInvModalOpen(false);
                  if (invToDelete) {
                    handleDeleteInvestment(invToDelete.id, invToDelete.name);
                  }
                }} 
                disabled={isSubmitting}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs flex items-center gap-1"
              >
                <Icon name="delete" size="sm" /> Excluir Ativo
              </Button>
            ) : <div />}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsInvModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button variant="primary" onClick={handleSaveInvestment} loading={isSubmitting}>
                {editingInvId ? "Salvar Alterações" : "Adicionar à Carteira"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal - Registrar Aporte / Movimentação (com Calculadora) */}
      <Modal 
        isOpen={isEntryModalOpen} 
        onClose={() => !isSubmitting && setIsEntryModalOpen(false)} 
        title={`Nova Movimentação: ${selectedInv?.name || ''} ${selectedInv?.currency === 'USD' ? '(US$)' : '(R$)'}`}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Select 
            label="Tipo de Operação" 
            value={entryForm.type}
            onChange={(e) => setEntryForm({...entryForm, type: e.target.value as any})}
            options={[
              { value: 'aporte', label: 'Aporte (Comprar mais)' },
              { value: 'resgate', label: 'Resgate (Vender / Retirar)' },
              { value: 'rendimento', label: 'Rendimento (Juros / Dividendos)' }
            ]}
          />

          {entryForm.type === 'aporte' ? (
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Calculadora de Compra ({selectedInv?.currency === 'USD' ? 'US$' : 'R$'})
                </span>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEntryCalcMode('shares')}
                    className={`px-2 py-1 rounded font-bold transition-colors ${
                      entryCalcMode === 'shares' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Por Cotas/Frações
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryCalcMode('total')}
                    className={`px-2 py-1 rounded font-bold transition-colors ${
                      entryCalcMode === 'total' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    Valor Direto
                  </button>
                </div>
              </div>

              {entryCalcMode === 'shares' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input 
                      label="Quantidade / Fração" 
                      type="text" 
                      placeholder="Ex: 0.05597 ou 3" 
                      value={entryForm.quantity}
                      onChange={(e) => handleEntryQtyChange(e.target.value)}
                    />
                    <Input 
                      label={`Preço Unitário (${selectedInv?.currency === 'USD' ? 'US$' : 'R$'})`} 
                      type="text" 
                      placeholder="0,00" 
                      value={entryForm.unit_price}
                      onChange={(e) => handleEntryPriceChange(e.target.value)}
                    />
                  </div>

                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">Total do Aporte:</span>
                    <div className="text-right">
                      <strong className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 block">
                        {formatCurrency(parseNumberInput(entryForm.amount), selectedInv?.currency || 'BRL')}
                      </strong>
                      {selectedInv?.currency === 'USD' && (
                        <span className="text-[10px] text-gray-500">
                          ≈ {formatCurrency(parseNumberInput(entryForm.amount) * usdRate, 'BRL')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <Input 
                  label={`Valor Total (${selectedInv?.currency === 'USD' ? 'US$' : 'R$'})`} 
                  type="text" 
                  placeholder="0,00" 
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
                />
              )}
            </div>
          ) : (
            <Input 
              label={`Valor (${selectedInv?.currency === 'USD' ? 'US$' : 'R$'})`} 
              type="text" 
              placeholder="0,00" 
              value={entryForm.amount}
              onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Data da Operação" 
              type="date" 
              value={entryForm.date}
              onChange={(e) => setEntryForm({...entryForm, date: e.target.value})}
            />
            <Input 
              label="Observações" 
              placeholder="Ex: Reinvestimento de dividendos, aporte fracionário" 
              value={entryForm.notes}
              onChange={(e) => setEntryForm({...entryForm, notes: e.target.value})}
            />
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsEntryModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddEntry} loading={isSubmitting}>Salvar Movimentação</Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Importador Investidor10 / CSV / IA */}
      <ImportInvestmentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        types={types}
        onImportAssets={async (assets) => {
          return await batchImportInvestments(assets);
        }}
      />

      {/* Modal - Nova Trava / Estratégia de Opções */}
      <NewOptionStrategyModal
        isOpen={isOptionModalOpen}
        onClose={() => {
          setIsOptionModalOpen(false);
          setOptionModalInitialConfig(null);
        }}
        initialUnderlying={optionModalInitialConfig?.underlying}
        initialOptionTicker={optionModalInitialConfig?.optionTicker}
        initialStrike={optionModalInitialConfig?.strike}
        initialCategory={optionModalInitialConfig?.category}
        onSave={(newStrat) => {
          addOptionStrategy(newStrat);
          setActiveMainTab('opcoes');
          setOptionModalInitialConfig(null);
        }}
      />
    </div>
  );
}
