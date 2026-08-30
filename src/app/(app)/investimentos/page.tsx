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
    syncLiveQuotes,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addInvestmentEntry,
    batchImportInvestments
  } = useInvestments();

  // Modals state
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
    institution: '',
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

  // Search quotes when typing ticker
  const handleFetchTickerQuote = async (tickerSymbol: string) => {
    const clean = tickerSymbol.trim().toUpperCase();
    if (!clean) return;

    setIsSearchingQuote(true);
    try {
      const res = await fetch(`/api/stocks/quote?ticker=${encodeURIComponent(clean)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) {
          setInvForm(prev => {
            const qty = parseNumberInput(prev.quantity) || 1;
            const price = data.price;
            const fees = parseNumberInput(prev.fees) || 0;
            const total = (qty * price) + fees;

            // Auto-select type for crypto / fii
            let autoTypeId = prev.type_id;
            if (['BTC', 'ETH', 'SOL', 'USDT'].includes(clean)) {
              const cryptoType = types.find(t => t.name.toLowerCase().includes('cripto'));
              if (cryptoType) autoTypeId = cryptoType.id;
            } else if (clean.endsWith('11')) {
              const fiiType = types.find(t => t.name.toLowerCase().includes('fii'));
              if (fiiType) autoTypeId = fiiType.id;
            }

            return {
              ...prev,
              ticker: clean,
              name: prev.name || data.name || clean,
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

  const formatCurrency = (value: number) => {
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

  // Calculations
  const totalInvested = investments.reduce((acc, curr) => acc + Number(curr.total_invested), 0);
  const totalCurrent = investments.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  const totalProfit = totalCurrent - totalInvested;
  const totalYield = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const lockedInvestments = investments.filter(i => i.due_date && i.due_date > todayStr);
  const totalLocked = lockedInvestments.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  const totalLiquid = totalCurrent - totalLocked;

  // Breakdown by Type
  const typeAgg: { [key: string]: { name: string; icon: string; color: string; total: number; count: number } } = {};
  investments.forEach(inv => {
    const typeName = inv.investment_type?.name || 'Outros';
    const color = inv.investment_type?.color || '#3b82f6';
    const icon = inv.investment_type?.icon || 'account_balance_wallet';
    const balance = Number(inv.current_balance) || 0;

    if (!typeAgg[typeName]) {
      typeAgg[typeName] = { name: typeName, icon, color, total: 0, count: 0 };
    }
    typeAgg[typeName].total += balance;
    typeAgg[typeName].count += 1;
  });

  const typeList = Object.values(typeAgg).map(t => ({
    ...t,
    percentage: totalCurrent > 0 ? Number(((t.total / totalCurrent) * 100).toFixed(1)) : 0
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
    const instName = inv.institution?.trim() || 'Sem Instituição';
    const balance = Number(inv.current_balance) || 0;

    if (!instAgg[instName]) {
      instAgg[instName] = { name: instName, total: 0, count: 0 };
    }
    instAgg[instName].total += balance;
    instAgg[instName].count += 1;
  });

  const instList = Object.values(instAgg).map(i => ({
    ...i,
    percentage: totalCurrent > 0 ? Number(((i.total / totalCurrent) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  // Modal Open Handlers
  const handleOpenInvModal = (invToEdit?: Investment) => {
    setFormError('');
    if (invToEdit) {
      setEditingInvId(invToEdit.id);
      setInvForm({
        name: invToEdit.name,
        ticker: invToEdit.ticker || '',
        type_id: invToEdit.type_id || (types.length > 0 ? types[0].id : ''),
        institution: invToEdit.institution || '',
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
      setInvForm({
        name: '',
        ticker: '',
        type_id: types.length > 0 ? types[0].id : '',
        institution: '',
        quantity: '1',
        unit_price: '',
        fees: '',
        total_amount: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: ''
      });
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

    let success = false;
    if (editingInvId) {
      success = await updateInvestment(editingInvId, {
        name: invForm.name,
        ticker: invForm.ticker,
        type_id: invForm.type_id,
        institution: invForm.institution,
        due_date: invForm.due_date || null,
        notes: invForm.notes
      });
    } else {
      success = await addInvestment({
        name: invForm.name,
        ticker: invForm.ticker,
        type_id: invForm.type_id,
        institution: invForm.institution,
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="trending_up" className="text-emerald-500" /> Carteira de Investimentos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Controle de ações, FIIs, criptomoedas e renda fixa com cotações em tempo real da B3 e integração com Investidor10
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live Quote Sync Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncLiveQuotes()}
            disabled={isSyncingQuotes || investments.length === 0}
            className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40"
            title="Atualizar cotações atuais de mercado na B3"
          >
            <Icon name="refresh" size="sm" className={isSyncingQuotes ? 'animate-spin' : ''} />
            <span>{isSyncingQuotes ? 'Atualizando...' : 'Cotações B3'}</span>
          </Button>

          {/* Investidor10 / CSV Import Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100"
          >
            <Icon name="file_download" size="sm" className="text-purple-500" />
            <span>Importar Investidor10</span>
          </Button>

          {/* New Investment Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenInvModal()}
            className="flex items-center gap-1.5"
          >
            <Icon name="add" size="sm" /> 
            <span>Novo Ativo / Compra</span>
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {loadError}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Patrimony */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Patrimônio Atual (Mercado)</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Icon name="account_balance_wallet" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <span className={`font-semibold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)} ({totalYield.toFixed(2)}%)
              </span>
            </p>
          </div>
        </GlassCard>

        {/* Total Invested */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Investido (Custo)</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Icon name="savings" className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalInvested)}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {investments.length} {investments.length === 1 ? 'ativo na carteira' : 'ativos na carteira'}
            </p>
          </div>
        </GlassCard>

        {/* Total Profit */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lucro / Rentabilidade</span>
            <div className={`p-2 rounded-xl ${totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
              <Icon name={totalProfit >= 0 ? 'trending_up' : 'trending_down'} className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
            </h2>
            <Badge color={totalProfit >= 0 ? 'green' : 'red'} className="mt-1">
              {totalYield >= 0 ? '+' : ''}{totalYield.toFixed(2)}% de retorno
            </Badge>
          </div>
        </GlassCard>

        {/* Liquidity Breakdown */}
        <GlassCard className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Liquidez & Prazos</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Icon name="schedule" className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Icon name="check_circle" className="text-emerald-500 w-3.5 h-3.5" /> Imediata:
              </span>
              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalLiquid)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Icon name="lock" className="text-amber-500 w-3.5 h-3.5" /> Com Prazo/Carência:
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalLocked)}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Charts & Allocation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation by Type (Donut Chart & Detailed Rows) */}
        <GlassCard className="p-6 lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Alocação por Tipo de Ativo</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distribuição do seu patrimônio entre categorias de investimentos</p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs font-bold flex items-center gap-1">
              <Icon name="pie_chart" size="sm" /> {typeList.length} Tipos
            </span>
          </div>

          {investments.length > 0 && totalCurrent > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-1/2 flex items-center justify-center">
                <div className="h-56 w-56 relative flex items-center justify-center">
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
                      cutout: '78%'
                    }} 
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
                      PATRIMÔNIO
                    </span>
                    <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {formatCurrency(totalCurrent)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-1/2 space-y-3.5">
                {typeList.map((type, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name} ({type.count})
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(type.total)} ({type.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.max(2, type.percentage)}%`, backgroundColor: type.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400 italic">
              Nenhum investimento com saldo cadastrado para exibir a composição da carteira.
            </div>
          )}
        </GlassCard>

        {/* Allocation by Financial Institution */}
        <GlassCard className="p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Por Instituição</h3>
              <span className="text-xs text-gray-400 font-medium">{instList.length} Bancos/Corretoras</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Onde o seu dinheiro está custodiado
            </p>

            {instList.length > 0 && totalCurrent > 0 ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {instList.map((inst, idx) => (
                  <div key={idx} className="bg-gray-50/80 dark:bg-gray-800/40 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                          <Icon name="account_balance" size="sm" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-xs">{inst.name}</p>
                          <p className="text-[10px] text-gray-400">{inst.count} {inst.count === 1 ? 'ativo' : 'ativos'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-gray-900 dark:text-white text-xs">{formatCurrency(inst.total)}</p>
                        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{inst.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-700" 
                        style={{ width: `${Math.max(2, inst.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                Nenhuma instituição registrada.
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Detailed Assets Table */}
      <GlassCard className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Meus Ativos, Ações & Criptomoedas</h3>
            <p className="text-xs text-gray-400">Posição, Preço Médio, Cotação Atual e Rentabilidade da Carteira</p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Total em Carteira: <strong className="text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</strong>
          </span>
        </div>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : investments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-lg">Ativo / Ticker</th>
                  <th scope="col" className="px-4 py-3">Tipo & Corretora</th>
                  <th scope="col" className="px-4 py-3 text-center">Posição (Qtd)</th>
                  <th scope="col" className="px-4 py-3 text-right">Preço Médio</th>
                  <th scope="col" className="px-4 py-3 text-right">Cotação Atual</th>
                  <th scope="col" className="px-4 py-3 text-right">Total Investido</th>
                  <th scope="col" className="px-4 py-3 text-right">Saldo Atual</th>
                  <th scope="col" className="px-4 py-3 text-right">Rentabilidade</th>
                  <th scope="col" className="px-4 py-3 text-center rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const invYield = inv.total_invested > 0 ? ((inv.current_balance - inv.total_invested) / inv.total_invested) * 100 : 0;
                  const isPositive = inv.current_balance >= inv.total_invested;
                  const profitAmt = inv.current_balance - inv.total_invested;
                  const hasQty = inv.quantity && inv.quantity > 0;
                  
                  return (
                    <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {inv.ticker ? (
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs">
                              {inv.ticker}
                            </span>
                          ) : null}
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{inv.name}</p>
                            {inv.due_date && (
                              <span className="text-[10px] text-gray-400">Venc: {formatDate(inv.due_date)}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span 
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-xs inline-flex items-center gap-1"
                            style={{ backgroundColor: inv.investment_type?.color || '#0058be' }}
                          >
                            <Icon name={inv.investment_type?.icon || 'account_balance_wallet'} className="w-3 h-3" />
                            {inv.investment_type?.name || 'Outro'}
                          </span>
                          <p className="text-[11px] text-gray-400">{inv.institution || '-'}</p>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        {hasQty ? (
                          <span className="font-bold text-gray-900 dark:text-white text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                            {formatQuantity(inv.quantity)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">
                        {inv.average_price && inv.average_price > 0 ? formatCurrency(inv.average_price) : '-'}
                      </td>

                      <td className="px-4 py-4 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap text-xs">
                        {inv.current_price && inv.current_price > 0 ? formatCurrency(inv.current_price) : '-'}
                      </td>

                      <td className="px-4 py-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {formatCurrency(inv.total_invested)}
                      </td>

                      <td className="px-4 py-4 text-right font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(inv.current_balance)}
                      </td>

                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className={`font-bold text-xs ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          <span>{isPositive ? '+' : ''}{formatCurrency(profitAmt)}</span>
                          <span className="text-[10px] block opacity-80">({isPositive ? '+' : ''}{invYield.toFixed(2)}%)</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => handleOpenEntryModal(inv)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors rounded-lg flex items-center gap-0.5 text-xs font-bold"
                            title="Comprar mais / Nova movimentação"
                          >
                            <Icon name="add_circle" size="sm" /> Aporte
                          </button>
                          <button 
                            onClick={() => handleOpenInvModal(inv)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded-lg"
                            title="Editar Ativo"
                          >
                            <Icon name="edit" size="sm" />
                          </button>
                          <button 
                            onClick={() => handleDeleteInvestment(inv.id, inv.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg"
                            title="Excluir Ativo"
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
              title="Nenhum investimento cadastrado" 
              description="Cadastre seus ativos ou importe sua carteira do Investidor10 para acompanhar suas ações e rendimentos." 
              icon="account_balance"
            />
          </div>
        )}
      </GlassCard>

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

          {/* Ticker Search & Auto Complete */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Ticker / Código do Ativo (B3 ou Cripto) (Opcional)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  placeholder="Ex: BTC, PETR4, MXRF11, VALE3, ETH" 
                  value={invForm.ticker}
                  onChange={(e) => setInvForm({...invForm, ticker: e.target.value.toUpperCase()})}
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
                <span>{isSearchingQuote ? 'Buscando...' : 'Buscar Cotação'}</span>
              </Button>
            </div>
          </div>

          <Input 
            label="Nome do Ativo" 
            placeholder="Ex: Bitcoin, Petrobras PN, Maxi Renda FII, CDB Inter" 
            value={invForm.name}
            onChange={(e) => setInvForm({...invForm, name: e.target.value})}
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo de Investimento" 
              value={invForm.type_id}
              onChange={(e) => setInvForm({...invForm, type_id: e.target.value})}
              options={types.map(t => ({ value: t.id, label: t.name }))}
            />
            <Input 
              label="Instituição / Corretora" 
              placeholder="Ex: Binance, Mercado Bitcoin, XP, NuInvest" 
              value={invForm.institution}
              onChange={(e) => setInvForm({...invForm, institution: e.target.value})}
            />
          </div>

          {/* Automatic Calculator: Qtd * Preço Unitário */}
          {!editingInvId && (
            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  <Icon name="calculate" size="sm" className="text-emerald-500" /> Calculadora de Compra
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
                      placeholder="Ex: 0,00025974 ou 10" 
                      value={invForm.quantity}
                      onChange={(e) => handleInvQtyChange(e.target.value)}
                    />
                    <Input 
                      label="Preço Unitário / Cotação (R$)" 
                      type="text" 
                      placeholder="Ex: 397.484,01" 
                      value={invForm.unit_price}
                      onChange={(e) => handleInvPriceChange(e.target.value)}
                    />
                    <Input 
                      label="Taxas (R$)" 
                      type="text" 
                      placeholder="0,00" 
                      value={invForm.fees}
                      onChange={(e) => handleInvFeesChange(e.target.value)}
                    />
                  </div>

                  {/* Calculated total display banner */}
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      Total da Operação ({invForm.quantity || 0} x {formatCurrency(parseNumberInput(invForm.unit_price))}):
                    </span>
                    <strong className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(parseNumberInput(invForm.total_amount))}
                    </strong>
                  </div>
                </div>
              ) : (
                <Input 
                  label="Valor Total da Aplicação (R$)" 
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
              label="Data de Vencimento / Carência (Opcional)" 
              type="date" 
              value={invForm.due_date}
              onChange={(e) => setInvForm({...invForm, due_date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Ex: Compra fracionário, aporte mensal, objetivo..." 
            value={invForm.notes}
            onChange={(e) => setInvForm({...invForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsInvModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveInvestment} loading={isSubmitting}>
              {editingInvId ? "Salvar Alterações" : "Adicionar à Carteira"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Registrar Aporte / Movimentação (com Calculadora) */}
      <Modal 
        isOpen={isEntryModalOpen} 
        onClose={() => !isSubmitting && setIsEntryModalOpen(false)} 
        title={`Nova Movimentação: ${selectedInv?.name || ''}`}
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
                  Calculadora de Compra
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
                      placeholder="Ex: 0,00025974 ou 3" 
                      value={entryForm.quantity}
                      onChange={(e) => handleEntryQtyChange(e.target.value)}
                    />
                    <Input 
                      label="Preço Unitário (R$)" 
                      type="text" 
                      placeholder="Ex: 397.484,01" 
                      value={entryForm.unit_price}
                      onChange={(e) => handleEntryPriceChange(e.target.value)}
                    />
                  </div>

                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">Total do Aporte:</span>
                    <strong className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(parseNumberInput(entryForm.amount))}
                    </strong>
                  </div>
                </div>
              ) : (
                <Input 
                  label="Valor Total (R$)" 
                  type="text" 
                  placeholder="0,00" 
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
                />
              )}
            </div>
          ) : (
            <Input 
              label="Valor (R$)" 
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
    </div>
  );
}
