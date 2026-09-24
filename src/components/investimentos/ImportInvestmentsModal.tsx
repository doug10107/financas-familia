'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { InvestmentType } from '@/hooks/useInvestments';

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

// Check if string contains USD currency indicator (never match Brazilian Real R$)
function isUsdCurrency(val: string | number | null | undefined): boolean {
  if (!val) return false;
  const str = String(val).toUpperCase();
  return str.includes('US$') || str.includes('USD') || str.includes('U$') || (str.includes('$') && !str.includes('R$'));
}

interface ExtractedAsset {
  tempId: string;
  ticker: string;
  name: string;
  type: string;
  quantity: number;
  averagePrice: number;
  totalInvested: number;
  currentPrice?: number;
  currentBalance?: number;
  institution?: string;
  currency?: 'BRL' | 'USD';
  selected: boolean;
}

interface ImportInvestmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  types: InvestmentType[];
  onImportAssets: (assets: any[]) => Promise<boolean>;
}

export function ImportInvestmentsModal({
  isOpen,
  onClose,
  types,
  onImportAssets
}: ImportInvestmentsModalProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'text'>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review state
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [extractedAssets, setExtractedAssets] = useState<ExtractedAsset[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setFile(null);
    setRawText('');
    setIsProcessing(false);
    setErrorMessage(null);
    setStep('input');
    setExtractedAssets([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatQuantity = (qty: number) => {
    if (!qty) return '0';
    if (qty < 1) {
      return qty.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }
    return qty.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  // Generic Row Parser for Investidor10 / B3 / StatusInvest
  const processParsedRows = (rows: any[], estimatedUsdRate: number = 5.122146): ExtractedAsset[] => {
    if (!rows || rows.length === 0) return [];

    const parsed: ExtractedAsset[] = [];

    rows.forEach((row, idx) => {
      const ticker = (
        row['Ticker'] ||
        row['Código'] ||
        row['Codigo'] ||
        row['Ativo'] ||
        row['Código de Negociação'] ||
        row['Papel'] ||
        ''
      ).toString().toUpperCase().trim();

      const name = (
        row['Nome'] ||
        row['Empresa'] ||
        row['Razão Social'] ||
        row['Produto'] ||
        ticker ||
        `Ativo ${idx + 1}`
      ).toString().trim();

      // Skip invalid header / empty rows
      if (!ticker && !name) return;
      if (ticker === 'ATIVO' || ticker === 'TICKER' || name === 'Ativo' || name === 'Nome') return;

      const rawQty = row['Quantidade'] || row['Qtd'] || row['Qtd.'] || row['Quant.'] || row['Quant'] || 1;
      const quantity = parseNumberInput(rawQty) || 1;

      const rawPrice =
        row['Preço Médio'] ||
        row['Preco Medio'] ||
        row['Preço'] ||
        row['Preco'] ||
        row['Preço de Compra'] ||
        row['Valor Unitário'] ||
        0;

      const rawCurPrice =
        row['Preço Atual'] ||
        row['Preco Atual'] ||
        row['Cotação'] ||
        row['Cotacao'] ||
        0;

      const rawTotal =
        row['Total Investido'] ||
        row['Valor Total'] ||
        row['Total'] ||
        row['Valor da Operação'] ||
        row['Custo Total'] ||
        0;

      const rawSaldo =
        row['Saldo'] ||
        row['Posição'] ||
        row['Valor Atual'] ||
        0;

      const rawType = row['Tipo de ativo'] || row['Tipo'] || row['Categoria'] || row['Classe'] || '';
      let typeStr = String(rawType).trim();

      // Check if this row is in USD (e.g. ETFs Intern., Stocks, US$)
      const isUsd = (
        isUsdCurrency(rawPrice) ||
        isUsdCurrency(rawCurPrice) ||
        isUsdCurrency(rawTotal) ||
        isUsdCurrency(rawSaldo) ||
        typeStr.toLowerCase().includes('intern') ||
        typeStr.toLowerCase().includes('eua') ||
        typeStr.toLowerCase().includes('exterior') ||
        ['VXUS', 'IVV', 'TFLO', 'VOO', 'QQQ', 'VTI', 'VT', 'SCHD'].includes(ticker)
      );

      let averagePrice = parseNumberInput(rawPrice);
      let currentPrice = parseNumberInput(rawCurPrice);
      let currentBalance = parseNumberInput(rawSaldo);
      let totalInvested = parseNumberInput(rawTotal);

      // If average price is missing (e.g. Tesouro Direto), fallback to current price or saldo/qty
      if (averagePrice === 0) {
        if (currentPrice > 0) {
          averagePrice = currentPrice;
        } else if (currentBalance > 0 && quantity > 0) {
          averagePrice = currentBalance / quantity;
        }
      }

      // If in USD, convert to BRL using USD rate
      if (isUsd) {
        if (averagePrice > 0) {
          averagePrice = Number((averagePrice * estimatedUsdRate).toFixed(2));
        }
        if (currentPrice > 0) {
          currentPrice = Number((currentPrice * estimatedUsdRate).toFixed(2));
        }
        if (currentBalance > 0) {
          currentBalance = Number((currentBalance * estimatedUsdRate).toFixed(2));
        }
        if (totalInvested > 0) {
          totalInvested = Number((totalInvested * estimatedUsdRate).toFixed(2));
        } else if (quantity > 0 && averagePrice > 0) {
          totalInvested = Number((quantity * averagePrice).toFixed(2));
        }
      } else {
        if (!totalInvested && quantity > 0 && averagePrice > 0) {
          totalInvested = Number((quantity * averagePrice).toFixed(2));
        }
      }

      const rawInst = row['Instituição'] || row['Instituicao'] || row['Corretora'] || row['Banco'] || '';
      const institution = String(rawInst).trim() || (isUsd ? 'Internacional' : 'Investidor10');

      // Normalize Type Classification
      let type = typeStr;
      if (!type) {
        if (['BTC', 'ETH', 'SOL', 'USDT'].includes(ticker)) type = 'Criptomoedas';
        else if (ticker.endsWith('11')) type = 'FIIs';
        else if (/^[A-Z]{4}\d[A-Z]?$/.test(ticker)) type = 'Ações';
        else if (isUsd) type = 'ETFs';
        else if (name.toLowerCase().includes('prev') || name.toLowerCase().includes('pgbl') || name.toLowerCase().includes('vgbl')) type = 'Previdência Privada';
        else if (name.toLowerCase().includes('tesouro')) type = 'Tesouro Direto';
        else type = 'Renda Fixa';
      } else {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('ação') || lowerType.includes('acoes') || lowerType.includes('ações')) type = 'Ações';
        else if (lowerType.includes('fii')) type = 'FIIs';
        else if (lowerType.includes('etf')) type = 'ETFs';
        else if (lowerType.includes('cripto')) type = 'Criptomoedas';
        else if (lowerType.includes('tesouro')) type = 'Tesouro Direto';
        else if (lowerType.includes('prev') || lowerType.includes('pgbl') || lowerType.includes('vgbl')) type = 'Previdência Privada';
        else if (lowerType.includes('fundo')) type = 'Renda Fixa';
        else if (lowerType.includes('renda fixa')) type = 'Renda Fixa';
      }

      parsed.push({
        tempId: `asset-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        ticker,
        name,
        type,
        quantity,
        averagePrice: Number(averagePrice.toFixed(2)),
        totalInvested: Number((totalInvested || quantity * averagePrice).toFixed(2)),
        currentPrice: currentPrice > 0 ? Number(currentPrice.toFixed(2)) : undefined,
        currentBalance: currentBalance > 0 ? Number(currentBalance.toFixed(2)) : undefined,
        institution,
        currency: isUsd ? 'USD' : 'BRL',
        selected: true
      });
    });

    return parsed;
  };

  // CSV Parser for Files or Text
  const parseCSVString = (csvContent: string) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado no texto / CSV.');
          }

          const parsed = processParsedRows(rows);
          if (parsed.length === 0) {
            throw new Error('Não foi possível identificar as colunas de ativos.');
          }

          setExtractedAssets(parsed);
          setStep('review');
          setIsProcessing(false);
        } catch (err: any) {
          console.error('Erro no parse CSV:', err);
          setErrorMessage(err.message || 'Erro ao ler arquivo CSV.');
          setIsProcessing(false);
        }
      },
      error: (err: any) => {
        console.error('Erro PapaParse:', err);
        setErrorMessage('Erro ao processar o arquivo CSV.');
        setIsProcessing(false);
      }
    });
  };

  const parseCSV = (csvFile: File) => {
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            throw new Error('Nenhum dado encontrado no arquivo CSV.');
          }

          const parsed = processParsedRows(rows);
          if (parsed.length === 0) {
            throw new Error('Não foi possível identificar as colunas de ativos no arquivo CSV.');
          }

          setExtractedAssets(parsed);
          setStep('review');
          setIsProcessing(false);
        } catch (err: any) {
          console.error('Erro no parse do CSV:', err);
          setErrorMessage(err.message || 'Erro ao ler arquivo CSV.');
          setIsProcessing(false);
        }
      },
      error: (err) => {
        console.error('Erro PapaParse:', err);
        setErrorMessage('Erro ao processar o arquivo CSV.');
        setIsProcessing(false);
      }
    });
  };

  const handleProcess = async () => {
    setErrorMessage(null);

    if (activeTab === 'csv') {
      if (!file) {
        setErrorMessage('Por favor, selecione um arquivo CSV exportado do Investidor10 ou da sua corretora.');
        return;
      }

      setIsProcessing(true);
      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        parseCSV(file);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await fetch('/api/ai/scan-investments', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro na análise com IA');
          if (!data.assets || data.assets.length === 0) throw new Error('Nenhum ativo encontrado no arquivo.');

          setExtractedAssets(data.assets.map((a: any) => ({ ...a, tempId: a.id || `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, selected: true })));
          setStep('review');
        } catch (err: any) {
          setErrorMessage(err.message || 'Erro ao processar com IA.');
        } finally {
          setIsProcessing(false);
        }
      }
    } else {
      if (!rawText.trim()) {
        setErrorMessage('Por favor, cole o texto da tabela do Investidor10 ou do seu relatório.');
        return;
      }

      setIsProcessing(true);

      // First try deterministic CSV/TSV table parsing if text contains delimiters (; or \t or ,)
      const trimmed = rawText.trim();
      const firstLine = trimmed.split('\n')[0] || '';
      const isDelimitedTable = (
        (firstLine.includes(';') || firstLine.includes('\t') || firstLine.includes(',')) &&
        (firstLine.toLowerCase().includes('ativo') || firstLine.toLowerCase().includes('ticker') || firstLine.toLowerCase().includes('preço') || firstLine.toLowerCase().includes('quant'))
      );

      if (isDelimitedTable) {
        try {
          parseCSVString(rawText);
          return;
        } catch (e) {
          console.warn('Falha no parse direto de texto delimitado, tentando IA...', e);
        }
      }

      // Fallback to AI Scan
      try {
        const res = await fetch('/api/ai/scan-investments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro na análise com IA');
        if (!data.assets || data.assets.length === 0) throw new Error('Nenhum ativo encontrado no texto.');

        setExtractedAssets(data.assets.map((a: any) => ({ ...a, tempId: a.id || `ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, selected: true })));
        setStep('review');
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao processar texto com IA.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleToggleSelectAll = () => {
    const all = extractedAssets.every(a => a.selected);
    setExtractedAssets(prev => prev.map(a => ({ ...a, selected: !all })));
  };

  const handleAssetFieldChange = (tempId: string, field: keyof ExtractedAsset, value: any) => {
    setExtractedAssets(prev =>
      prev.map(a => {
        if (a.tempId === tempId) {
          let updated = { ...a };
          if (field === 'quantity') {
            const q = parseNumberInput(value);
            updated.quantity = q;
            updated.totalInvested = Number((q * a.averagePrice).toFixed(2));
          } else if (field === 'averagePrice') {
            const p = parseNumberInput(value);
            updated.averagePrice = p;
            updated.totalInvested = Number((a.quantity * p).toFixed(2));
          } else {
            updated = { ...a, [field]: value };
          }
          return updated;
        }
        return a;
      })
    );
  };

  const handleDeleteAsset = (tempId: string) => {
    setExtractedAssets(prev => prev.filter(a => a.tempId !== tempId));
  };

  const handleConfirmImport = async () => {
    const selected = extractedAssets.filter(a => a.selected);
    if (selected.length === 0) {
      setErrorMessage('Selecione ao menos 1 ativo para importar.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const success = await onImportAssets(selected);
    setIsProcessing(false);

    if (success) {
      handleClose();
    } else {
      setErrorMessage('Erro ao salvar os investimentos no banco de dados.');
    }
  };

  const selectedCount = extractedAssets.filter(a => a.selected).length;
  const totalImportSum = extractedAssets
    .filter(a => a.selected)
    .reduce((acc, a) => acc + (a.totalInvested || a.quantity * a.averagePrice), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      title={step === 'input' ? 'Importar Carteira (Investidor10 / B3 / Corretora)' : 'Conferir Ativos Extraídos'}
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <Icon name="error" size="sm" className="text-red-500 shrink-0 mt-0.5" />
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('csv')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'csv'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="table_chart" size="sm" /> Planilha / CSV (Investidor10)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="auto_awesome" size="sm" /> Colar Texto / IA
              </button>
            </div>

            {/* TAB CSV */}
            {activeTab === 'csv' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                      setErrorMessage(null);
                    }
                  }}
                  accept=".csv,.xlsx,.xls,text/csv,text/plain"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-800/30 group"
                >
                  {file ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                        <Icon name="description" size="md" />
                      </div>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{file.name}</p>
                      <p className="text-[11px] text-gray-500">{(file.size / 1024).toFixed(1)} KB • Clique para trocar</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Icon name="upload_file" size="md" />
                      </div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        Carregar Arquivo CSV do Investidor10
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Exporte sua carteira ou negociações no Investidor10, B3 ou corretora e solte aqui
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                  <Icon name="info" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                    <strong>Como exportar no Investidor10:</strong> Acesse sua carteira no Investidor10 &gt; Extrato ou Carteira &gt; Exportar CSV.
                  </p>
                </div>
              </div>
            )}

            {/* TAB TEXT */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Copie e cole a tabela ou relatório de ativos:
                  </label>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Exemplo:&#10;BTC Bitcoin 0,00025974 cotas Preço Médio R$ 397.484,01&#10;PETR4 Petrobras PN 100 cotas Preço Médio R$ 35,80&#10;MXRF11 Maxi Renda 250 cotas Preço Médio R$ 10,20"
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleProcess}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" size="sm" /> Analisar e Extrair Ativos
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW ASSETS */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Icon name="select_all" size="sm" />
                  {selectedCount === extractedAssets.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
                <Badge color="blue" className="text-[11px]">
                  {selectedCount} de {extractedAssets.length} ativos
                </Badge>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Total a Importar</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalImportSum)}
                </span>
              </div>
            </div>

            {/* List of extracted assets */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {extractedAssets.map((asset) => (
                <div
                  key={asset.tempId}
                  className={`p-3 rounded-xl border transition-all ${
                    asset.selected
                      ? 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-sm'
                      : 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={asset.selected}
                      onChange={() =>
                        setExtractedAssets(prev =>
                          prev.map(a => (a.tempId === asset.tempId ? { ...a, selected: !a.selected } : a))
                        )
                      }
                      className="mt-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      {/* Ticker */}
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Ticker (BTC)"
                          value={asset.ticker}
                          onChange={(e) => handleAssetFieldChange(asset.tempId, 'ticker', e.target.value.toUpperCase())}
                          className="text-xs py-1 font-bold text-blue-600 dark:text-blue-400 font-mono"
                        />
                      </div>

                      {/* Name */}
                      <div className="sm:col-span-4">
                        <Input
                          placeholder="Nome / Empresa"
                          value={asset.name}
                          onChange={(e) => handleAssetFieldChange(asset.tempId, 'name', e.target.value)}
                          className="text-xs py-1 font-medium"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2">
                        <Input
                          type="text"
                          placeholder="Qtd (0.00025974)"
                          value={String(asset.quantity)}
                          onChange={(e) => handleAssetFieldChange(asset.tempId, 'quantity', e.target.value)}
                          className="text-xs py-1 text-center font-mono"
                        />
                      </div>

                      {/* Average Price */}
                      <div className="sm:col-span-2">
                        <Input
                          type="text"
                          placeholder="Preço Médio"
                          value={String(asset.averagePrice)}
                          onChange={(e) => handleAssetFieldChange(asset.tempId, 'averagePrice', e.target.value)}
                          className="text-xs py-1 text-right"
                        />
                      </div>

                      {/* Total */}
                      <div className="sm:col-span-1 text-right pr-1">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                          {formatCurrency(asset.totalInvested || asset.quantity * asset.averagePrice)}
                        </span>
                      </div>

                      {/* Delete */}
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset.tempId)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Icon name="delete" size="sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="ghost" onClick={() => setStep('input')}>
                <Icon name="arrow_back" size="sm" /> Voltar
              </Button>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirmImport}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size="sm" /> Confirmar Importação ({formatCurrency(totalImportSum)})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
