'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { Doughnut } from 'react-chartjs-2';
import { Investment } from '@/hooks/useInvestments';

interface ProventosModalProps {
  isOpen: boolean;
  onClose: () => void;
  investments: Investment[];
  usdRate?: number;
  onAddDividend: (input: {
    investment_id: string;
    amount: number;
    type?: 'rendimento';
    date: string;
    notes?: string;
  }) => Promise<boolean>;
  onBatchImportDividends: (dividends: {
    ticker?: string;
    name?: string;
    amount: number;
    date?: string;
    notes?: string;
    type?: string;
  }[]) => Promise<{ success: boolean; count: number; error?: string }>;
  onDeleteEntry?: (entryId: string) => Promise<boolean>;
  initialTicker?: string;
}

function parseNumberInput(val: string | number | null | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).replace(/[^0-9,.-]/g, '').trim();
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return parseFloat(str) || 0;
}

export function ProventosModal({
  isOpen,
  onClose,
  investments,
  usdRate = 5.18,
  onAddDividend,
  onBatchImportDividends,
  onDeleteEntry,
  initialTicker
}: ProventosModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'single' | 'import' | 'history'>('overview');

  // Single Dividend Form
  const [singleTicker, setSingleTicker] = useState(initialTicker || '');
  const [singleAmount, setSingleAmount] = useState('');
  const [singleType, setSingleType] = useState('Rendimento');
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [singleNotes, setSingleNotes] = useState('');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [singleFeedback, setSingleFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Batch Import Form
  const [importText, setImportText] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [parsedDividends, setParsedDividends] = useState<{
    id: string;
    ticker: string;
    amount: number;
    date: string;
    type: string;
    matchedInv?: Investment;
  }[]>([]);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Pre-fill initial ticker if provided
  React.useEffect(() => {
    if (initialTicker) {
      setSingleTicker(initialTicker);
      setActiveTab('single');
    }
  }, [initialTicker]);

  const formatCurrency = (val: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'BRL'
    }).format(val);
  };

  // Aggregated Proventos Data
  const stats = useMemo(() => {
    let totalBrl = 0;
    const byCategory: { [key: string]: { name: string; amount: number; color: string } } = {};
    const byAsset: { ticker: string; name: string; amount: number; count: number; category: string }[] = [];
    const allHistory: {
      id: string;
      investmentId: string;
      ticker: string;
      name: string;
      amount: number;
      date: string;
      notes: string | null;
      category: string;
    }[] = [];

    investments.forEach(inv => {
      const isUsd = inv.currency === 'USD' || ['IVV', 'VXUS', 'TFLO', 'VOO', 'QQQ', 'VT', 'SCHD'].includes((inv.ticker || '').toUpperCase());
      const catName = isUsd ? 'ETFs Internacionais' : (inv.investment_type?.name || 'Outros');
      const catColor = isUsd ? '#0ea5e9' : (inv.investment_type?.color || '#3b82f6');
      const earnings = Number(inv.total_earnings) || 0;
      const earningsBrl = isUsd ? earnings * usdRate : earnings;

      if (earningsBrl > 0) {
        totalBrl += earningsBrl;

        if (!byCategory[catName]) {
          byCategory[catName] = { name: catName, amount: 0, color: catColor };
        }
        byCategory[catName].amount += earningsBrl;

        byAsset.push({
          ticker: inv.ticker || inv.name,
          name: inv.name,
          amount: earningsBrl,
          count: inv.entries?.filter(e => e.type === 'rendimento').length || 0,
          category: catName
        });
      }

      // Collect historical entries
      (inv.entries || []).forEach(entry => {
        if (entry.type === 'rendimento') {
          allHistory.push({
            id: entry.id,
            investmentId: inv.id,
            ticker: inv.ticker || inv.name,
            name: inv.name,
            amount: Number(entry.amount) || 0,
            date: entry.date,
            notes: entry.notes,
            category: catName
          });
        }
      });
    });

    byAsset.sort((a, b) => b.amount - a.amount);
    allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const categoriesList = Object.values(byCategory).sort((a, b) => b.amount - a.amount);

    return {
      totalBrl,
      categoriesList,
      byAsset,
      allHistory
    };
  }, [investments, usdRate]);

  // Doughnut Chart Data for Proventos
  const doughnutChartData = {
    labels: stats.categoriesList.map(c => c.name),
    datasets: [
      {
        data: stats.categoriesList.map(c => c.amount),
        backgroundColor: stats.categoriesList.map(c => c.color),
        borderWidth: 0
      }
    ]
  };

  // Handle Single Dividend Save
  const handleSaveSingle = async () => {
    setSingleFeedback(null);
    const targetInv = investments.find(
      i => (i.ticker && i.ticker.toUpperCase() === singleTicker.toUpperCase()) ||
           i.id === singleTicker ||
           i.name.toLowerCase() === singleTicker.toLowerCase()
    );

    if (!targetInv) {
      setSingleFeedback({ type: 'error', msg: 'Selecione um ativo válido da sua carteira.' });
      return;
    }

    const amt = parseNumberInput(singleAmount);
    if (amt <= 0) {
      setSingleFeedback({ type: 'error', msg: 'Informe um valor válido de provento maior que zero.' });
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const ok = await onAddDividend({
        investment_id: targetInv.id,
        amount: amt,
        type: 'rendimento',
        date: singleDate,
        notes: singleNotes ? `${singleType}: ${singleNotes}` : singleType
      });

      if (ok) {
        setSingleFeedback({ type: 'success', msg: `Provento de ${formatCurrency(amt)} lançado com sucesso para ${targetInv.ticker || targetInv.name}!` });
        setSingleAmount('');
        setSingleNotes('');
      } else {
        setSingleFeedback({ type: 'error', msg: 'Não foi possível registrar o provento.' });
      }
    } catch (err: any) {
      setSingleFeedback({ type: 'error', msg: err.message || 'Erro ao salvar provento.' });
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Parse Text / CSV from Investidor 10
  const handleParseImportText = () => {
    setImportFeedback(null);
    if (!importText.trim()) {
      setImportFeedback({ type: 'error', msg: 'Cole os proventos ou envie um arquivo para importar.' });
      return;
    }

    setIsProcessingImport(true);

    try {
      // First attempt CSV parse
      let rows: any[] = [];
      const parsedCsv = Papa.parse(importText.trim(), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
      });

      if (parsedCsv.data && parsedCsv.data.length > 0 && Object.keys(parsedCsv.data[0] as any).length > 1) {
        rows = parsedCsv.data;
      }

      const extracted: {
        id: string;
        ticker: string;
        amount: number;
        date: string;
        type: string;
        matchedInv?: Investment;
      }[] = [];

      if (rows.length > 0) {
        // Table / CSV row format
        rows.forEach((r, idx) => {
          const ticker = (r['Ticker'] || r['Código'] || r['Ativo'] || r['Papel'] || r['Ativo / Código'] || '').toString().trim().toUpperCase();
          const rawAmt = r['Valor Líquido'] || r['Valor Liquido'] || r['Valor'] || r['Total'] || r['Provento'] || r['Rendimento'] || 0;
          const amt = parseNumberInput(rawAmt);
          const rawDate = r['Data Pagamento'] || r['Data de Pagamento'] || r['Pagamento'] || r['Data'] || '';
          const type = r['Tipo'] || r['Evento'] || 'Rendimento';

          if (amt > 0) {
            let cleanDate = new Date().toISOString().split('T')[0];
            if (rawDate) {
              const parts = String(rawDate).trim().split(/[/.-]/);
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  cleanDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                  cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            }

            const matched = investments.find(
              i => (ticker && i.ticker?.toUpperCase() === ticker) ||
                   i.name.toUpperCase().includes(ticker)
            );

            extracted.push({
              id: `div-${idx}-${Date.now()}`,
              ticker: ticker || (matched?.ticker || 'DESCONHECIDO'),
              amount: amt,
              date: cleanDate,
              type: String(type).trim(),
              matchedInv: matched
            });
          }
        });
      } else {
        // Line by line text format (e.g. "XPML11 R$ 4,60 15/10/2026" or "MXRF11 3,80")
        const lines = importText.split('\n');
        lines.forEach((line, idx) => {
          const cleanLine = line.trim();
          if (!cleanLine) return;

          // Match Ticker like XPML11, MXRF11, BTLG11, PETR4, etc.
          const tickerMatch = cleanLine.match(/([A-Z]{4}\d{1,2}[A-Z]?)/i);
          const ticker = tickerMatch ? tickerMatch[1].toUpperCase() : '';

          // Match money/number like 4,60 or 12.74
          const numbers = cleanLine.replace(ticker, '').match(/(\d+[.,]\d{2}|\d+)/g);
          let amount = 0;
          if (numbers && numbers.length > 0) {
            // Pick highest decimal or first reasonable amount
            amount = parseNumberInput(numbers[0]);
          }

          // Match dates like 15/10/2026 or 2026-10-15
          const dateMatch = cleanLine.match(/(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{4}[/.-]\d{2}[/.-]\d{2})/);
          let dateStr = new Date().toISOString().split('T')[0];
          if (dateMatch) {
            const rawDate = dateMatch[1];
            const parts = rawDate.split(/[/.-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parts[2].length === 4) {
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          if (ticker && amount > 0) {
            const matched = investments.find(
              i => i.ticker?.toUpperCase() === ticker || i.name.toUpperCase().includes(ticker)
            );

            extracted.push({
              id: `div-text-${idx}-${Date.now()}`,
              ticker,
              amount,
              date: dateStr,
              type: 'Rendimento',
              matchedInv: matched
            });
          }
        });
      }

      if (extracted.length === 0) {
        throw new Error('Não foram encontrados proventos legíveis. Tente colar no formato: "XPML11 4,60" ou use o CSV do Investidor 10.');
      }

      setParsedDividends(extracted);
      setImportStep('preview');
    } catch (err: any) {
      setImportFeedback({ type: 'error', msg: err.message || 'Erro ao processar texto.' });
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Submit Batch Import
  const handleConfirmBatchImport = async () => {
    setIsProcessingImport(true);
    setImportFeedback(null);
    try {
      const itemsToImport = parsedDividends.map(d => ({
        ticker: d.ticker,
        amount: d.amount,
        date: d.date,
        type: d.type,
        notes: `Importado: ${d.type} (${d.ticker})`
      }));

      const res = await onBatchImportDividends(itemsToImport);
      if (res.success) {
        setImportFeedback({
          type: 'success',
          msg: `${res.count} provento(s) importado(s) com sucesso na sua carteira!`
        });
        setParsedDividends([]);
        setImportText('');
        setImportStep('input');
        setActiveTab('overview');
      } else {
        setImportFeedback({ type: 'error', msg: res.error || 'Erro ao salvar proventos.' });
      }
    } catch (err: any) {
      setImportFeedback({ type: 'error', msg: err.message || 'Erro inesperado ao importar proventos.' });
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Proventos & Dividendos da Carteira"
      size="2xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="monitoring" size="sm" />
            Visão Geral ({formatCurrency(stats.totalBrl)})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'single'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="add_circle" size="sm" />
            + Lançar Provento
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="upload_file" size="sm" />
            Importar Investidor10
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="history" size="sm" />
            Histórico ({stats.allHistory.length})
          </button>
        </div>

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Total de Proventos Recebidos
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(stats.totalBrl)}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {stats.allHistory.length} lançamentos registrados
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  FIIs (Fundos Imobiliários)
                </span>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {formatCurrency(stats.categoriesList.find(c => c.name.toLowerCase().includes('fii'))?.amount || 0)}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  {stats.totalBrl > 0 
                    ? (((stats.categoriesList.find(c => c.name.toLowerCase().includes('fii'))?.amount || 0) / stats.totalBrl) * 100).toFixed(1) + '% do total'
                    : '0%'}
                </p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                  Ações & Outros
                </span>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                  {formatCurrency(
                    stats.categoriesList
                      .filter(c => !c.name.toLowerCase().includes('fii'))
                      .reduce((sum, c) => sum + c.amount, 0)
                  )}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Dividendos e JCPs recebidos
                </p>
              </div>
            </div>

            {/* Distribution and Top Payers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Doughnut Chart */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Distribuição por Categoria
                </h4>
                {stats.totalBrl > 0 ? (
                  <div className="flex items-center justify-center gap-6 py-2">
                    <div className="h-36 w-36 relative">
                      <Doughnut
                        data={doughnutChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } }
                        }}
                      />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {stats.categoriesList.map(cat => (
                        <div key={cat.name} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-gray-600 dark:text-gray-300 font-medium">{cat.name}:</span>
                          <strong className="text-gray-900 dark:text-white font-mono">{formatCurrency(cat.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Nenhum provento recebido ainda. Use a aba <strong>Importar Investidor10</strong> ou <strong>+ Lançar Provento</strong> para cadastrar.
                  </div>
                )}
              </div>

              {/* Top Assets */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Maiores Pagadores
                </h4>
                {stats.byAsset.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {stats.byAsset.slice(0, 6).map(asset => (
                      <div key={asset.ticker} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 dark:border-gray-800/60 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[11px]">
                            {asset.ticker}
                          </span>
                          <span className="text-gray-500 text-[11px] truncate max-w-[120px]">{asset.name}</span>
                        </div>
                        <div className="text-right">
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                            {formatCurrency(asset.amount)}
                          </strong>
                          <span className="text-[10px] text-gray-400 block">
                            {stats.totalBrl > 0 ? ((asset.amount / stats.totalBrl) * 100).toFixed(1) + '%' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Nenhum ativo gerou proventos ainda.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button variant="primary" onClick={() => setActiveTab('import')} className="flex items-center gap-1.5">
                <Icon name="upload_file" size="sm" />
                Importar Proventos do Investidor 10
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: LANÇAR PROVENTO INDIVIDUAL */}
        {activeTab === 'single' && (
          <div className="space-y-4">
            {singleFeedback && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                singleFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-100 text-red-800'
              }`}>
                {singleFeedback.msg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Ativo da Carteira"
                value={singleTicker}
                onChange={(e) => setSingleTicker(e.target.value)}
                options={[
                  { value: '', label: '-- Selecione o Ativo --' },
                  ...investments.map(i => ({
                    value: i.ticker || i.id,
                    label: `${i.ticker || i.name} (${i.investment_type?.name || 'Ativo'})`
                  }))
                ]}
              />

              <Select
                label="Tipo de Provento"
                value={singleType}
                onChange={(e) => setSingleType(e.target.value)}
                options={[
                  { value: 'Rendimento', label: 'Rendimento (FIIs)' },
                  { value: 'Dividendo', label: 'Dividendo (Ações / ETFs)' },
                  { value: 'Juros sobre Capital Próprio (JCP)', label: 'JCP (Juros s/ Capital Próprio)' },
                  { value: 'Amortização', label: 'Amortização de Cotas' }
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Valor Recebido (R$)"
                placeholder="Ex: 4,60 ou 13,41"
                value={singleAmount}
                onChange={(e) => setSingleAmount(e.target.value)}
              />

              <Input
                label="Data do Crédito"
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </div>

            <Input
              label="Observações (Opcional)"
              placeholder="Ex: Rendimento referente a Outubro/2026"
              value={singleNotes}
              onChange={(e) => setSingleNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" onClick={() => setActiveTab('overview')}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={handleSaveSingle}
                loading={isSubmittingSingle}
                className="flex items-center gap-1.5"
              >
                <Icon name="check" size="sm" />
                Salvar Provento
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: IMPORTAR DO INVESTIDOR 10 */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            {importFeedback && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                importFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-100 text-red-800'
              }`}>
                {importFeedback.msg}
              </div>
            )}

            {importStep === 'input' ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Icon name="info" size="sm" /> Como importar os proventos do Investidor 10:
                  </p>
                  <p>
                    Acesse a aba <strong>Proventos</strong> no Investidor 10 (conforme sua imagem), selecione e copie as linhas da tabela, ou simplesmente digite ou cole no formato rápido:
                  </p>
                  <div className="p-2 bg-white/70 dark:bg-gray-900/60 font-mono rounded text-[11px] mt-1 space-y-0.5">
                    <p>XPML11 4,60 15/10/2026</p>
                    <p>MXRF11 3,80 14/10/2026</p>
                    <p>BTLG11 2,43 25/10/2026</p>
                    <p>GARE11 1,91 15/10/2026</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Cole o texto ou CSV de proventos:
                  </label>
                  <textarea
                    rows={6}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Cole aqui o texto dos proventos..."
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" onClick={() => setActiveTab('overview')}>Voltar</Button>
                  <Button
                    variant="primary"
                    onClick={handleParseImportText}
                    loading={isProcessingImport}
                    className="flex items-center gap-1.5"
                  >
                    <Icon name="search" size="sm" />
                    Processar Proventos
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {parsedDividends.length} provento(s) identificados para importação:
                  </span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    Total: {formatCurrency(parsedDividends.reduce((acc, curr) => acc + curr.amount, 0))}
                  </span>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase text-[10px] font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-left">Ativo</th>
                        <th className="py-2 px-3 text-left">Tipo</th>
                        <th className="py-2 px-3 text-left">Data</th>
                        <th className="py-2 px-3 text-right">Valor</th>
                        <th className="py-2 px-3 text-center">Status Carteira</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {parsedDividends.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                          <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                            {item.ticker}
                          </td>
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                            {item.type}
                          </td>
                          <td className="py-2 px-3 text-gray-500 font-mono">
                            {item.date}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.matchedInv ? (
                              <Badge color="green">Vinculado</Badge>
                            ) : (
                              <Badge color="yellow">Não Encontrado</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button variant="ghost" onClick={() => setImportStep('input')}>
                    Voltar e Editar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmBatchImport}
                    loading={isProcessingImport}
                    className="flex items-center gap-1.5"
                  >
                    <Icon name="check" size="sm" />
                    Confirmar e Gravar Proventos
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HISTÓRICO */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Total de lançamentos de proventos: <strong>{stats.allHistory.length}</strong>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600">
                Soma: {formatCurrency(stats.totalBrl)}
              </span>
            </div>

            {stats.allHistory.length > 0 ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase text-[10px] font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3 text-left">Ativo</th>
                      <th className="py-2 px-3 text-left">Categoria</th>
                      <th className="py-2 px-3 text-left">Data</th>
                      <th className="py-2 px-3 text-left">Descrição</th>
                      <th className="py-2 px-3 text-right">Valor</th>
                      {onDeleteEntry && <th className="py-2 px-3 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {stats.allHistory.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="py-2 px-3 font-mono font-bold text-gray-900 dark:text-white">
                          {item.ticker}
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {item.category}
                        </td>
                        <td className="py-2 px-3 text-gray-500 font-mono">
                          {item.date}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                          {item.notes || 'Rendimento'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.amount)}
                        </td>
                        {onDeleteEntry && (
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Deseja excluir o provento de ${formatCurrency(item.amount)} de ${item.ticker}?`)) {
                                  await onDeleteEntry(item.id);
                                }
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Excluir lançamento"
                            >
                              <Icon name="delete" size="xs" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                Nenhum lançamento de provento registrado no histórico.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
