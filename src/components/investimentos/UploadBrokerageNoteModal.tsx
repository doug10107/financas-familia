'use client';

import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { RawBrokerageNote, RawBrokerageOrder } from '@/lib/tax/taxEngine';

interface UploadBrokerageNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveNote: (note: RawBrokerageNote, syncPortfolio: boolean) => Promise<boolean>;
}

export function UploadBrokerageNoteModal({
  isOpen,
  onClose,
  onSaveNote
}: UploadBrokerageNoteModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review step state
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [parsedNote, setParsedNote] = useState<RawBrokerageNote | null>(null);
  const [syncWithPortfolio, setSyncWithPortfolio] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setFile(null);
    setRawText('');
    setIsProcessing(false);
    setErrorMessage(null);
    setStep('input');
    setParsedNote(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const handleProcessFileOrText = async () => {
    if (activeTab === 'upload' && !file) {
      setErrorMessage('Por favor, selecione um arquivo de nota de corretagem (PDF, foto ou print).');
      return;
    }
    if (activeTab === 'text' && !rawText.trim()) {
      setErrorMessage('Por favor, cole o texto da nota ou extrato de ordens.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let res: Response;
      if (activeTab === 'upload' && file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/tax/parse-note', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('/api/tax/parse-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível extrair os dados da nota.');
      }

      setParsedNote(data.note);
      setStep('review');
    } catch (err: any) {
      console.error('Erro ao analisar nota:', err);
      setErrorMessage(err.message || 'Erro ao processar arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!parsedNote) return;
    setIsSubmitting(true);
    try {
      const ok = await onSaveNote(parsedNote, syncWithPortfolio);
      if (ok) {
        handleClose();
      } else {
        setErrorMessage('Não foi possível salvar a nota no banco de dados.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderChange = (index: number, field: keyof RawBrokerageOrder, val: any) => {
    if (!parsedNote) return;
    const updatedOrders = [...parsedNote.orders];
    updatedOrders[index] = { ...updatedOrders[index], [field]: val };
    setParsedNote({ ...parsedNote, orders: updatedOrders });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'input' ? 'Subir Nota de Corretagem (íon Itaú / B3)' : 'Conferência da Nota de Corretagem'}
      size="xl"
    >
      <div className="space-y-5">
        {step === 'input' && (
          <>
            {/* Guide Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-emerald-500/10 border border-orange-500/20 text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-orange-600 dark:text-orange-400">
                <Icon name="receipt_long" size="sm" />
                <span>Compatibilidade Total com o íon Itaú & Padrão B3 SINACOR</span>
              </div>
              <p>
                Suba o <strong>PDF original da Nota de Corretagem</strong> emitido pelo <strong>íon Itaú</strong>,
                ou envie fotos/prints e extratos de negociação. A IA identificará automaticamente os ativos, compras, vendas, taxas da B3, corretagem e o IRRF retido na fonte.
              </p>
            </div>

            {/* Tab selector */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="upload_file" size="sm" />
                <span>Arquivo (PDF, Imagem, Print)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="content_paste" size="sm" />
                <span>Colar Texto da Nota / Extrato</span>
              </button>
            </div>

            {/* Upload Area */}
            {activeTab === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  file
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-orange-500 hover:bg-orange-50/20 dark:hover:bg-orange-950/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setFile(e.target.files[0]);
                      setErrorMessage(null);
                    }
                  }}
                />

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  file ? 'bg-emerald-500 text-white' : 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400'
                }`}>
                  <Icon name={file ? 'check_circle' : 'cloud_upload'} className="w-8 h-8" />
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {file ? file.name : 'Clique para selecionar a Nota ou arraste aqui'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB pronto para análise`
                      : 'Suporta PDF do íon Itaú, fotos de notas, prints de tela ou planilhas CSV'}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Cole o conteúdo da nota de corretagem:
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  placeholder="Cole aqui o texto copiado do PDF da nota ou do portal da corretora com os negócios realizados..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-900">
                <Icon name="error" size="sm" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleProcessFileOrText}
                disabled={isProcessing}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Icon name="sync" size="sm" className="animate-spin" />
                    <span>Lendo com IA Fiscal...</span>
                  </>
                ) : (
                  <>
                    <Icon name="bolt" size="sm" />
                    <span>Processar Nota Automaticamente</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === 'review' && parsedNote && (
          <div className="space-y-5">
            {/* Note Header Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
              <div>
                <span className="text-gray-400 font-bold block">Corretora</span>
                <span className="font-extrabold text-gray-900 dark:text-white text-sm flex items-center gap-1">
                  🏛️ {parsedNote.broker_name || 'íon Itaú'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Nº da Nota</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {parsedNote.note_number || 'Sem número'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Data do Pregão</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {parsedNote.trading_date}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-bold block">Valor Líquido</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(parsedNote.net_amount || parsedNote.total_operations)}
                </span>
              </div>
            </div>

            {/* Financial Breakdown (Fees & IRRF) */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-1">
                  <Icon name="payments" size="sm" /> Taxas B3 & Custos Rateados
                </span>
                <span>
                  Total Custos: {formatCurrency(
                    (parsedNote.settlement_fee || 0) +
                    (parsedNote.emoluments || 0) +
                    (parsedNote.brokerage_fee || 0) +
                    (parsedNote.taxes || 0) +
                    (parsedNote.other_expenses || 0)
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                <div>Taxa Liquidação: {formatCurrency(parsedNote.settlement_fee || 0)}</div>
                <div>Emolumentos: {formatCurrency(parsedNote.emoluments || 0)}</div>
                <div>Corretagem/ISS: {formatCurrency((parsedNote.brokerage_fee || 0) + (parsedNote.taxes || 0))}</div>
                <div className="font-bold text-orange-600 dark:text-orange-400">
                  IRRF Dedo-Duro: {formatCurrency(parsedNote.irrf_amount || 0)}
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Negócios Realizados ({parsedNote.orders.length})
                </h4>
                <span className="text-[11px] text-gray-400">
                  Custos foram rateados proporcionalmente no preço efetivo de cada ativo.
                </span>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto max-h-72 no-scrollbar">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Operação</th>
                      <th className="p-2.5">Ticker / Ativo</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5 text-right">Qtd</th>
                      <th className="p-2.5 text-right">Preço Bruto</th>
                      <th className="p-2.5 text-right">Taxa Rateada</th>
                      <th className="p-2.5 text-right">Custo Efetivo</th>
                      <th className="p-2.5 text-center">Day Trade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {parsedNote.orders.map((ord, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                            ord.operation_type === 'C'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          }`}>
                            {ord.operation_type === 'C' ? 'COMPRA' : 'VENDA'}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-gray-900 dark:text-white">
                          <input
                            type="text"
                            value={ord.ticker}
                            onChange={(e) => handleOrderChange(idx, 'ticker', e.target.value.toUpperCase())}
                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 font-extrabold uppercase w-20 outline-none"
                          />
                          <span className="text-[10px] text-gray-400 block truncate max-w-[140px]">
                            {ord.asset_name}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-gray-600 dark:text-gray-300 text-[11px]">
                            {ord.asset_category}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {ord.quantity}
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {formatCurrency(ord.unit_price)}
                        </td>
                        <td className="p-2.5 text-right text-gray-500 text-[11px]">
                          +{formatCurrency(ord.apportioned_costs || 0)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(ord.effective_total || ord.total_price)}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(ord.is_day_trade)}
                            onChange={(e) => handleOrderChange(idx, 'is_day_trade', e.target.checked)}
                            className="rounded text-orange-600 focus:ring-orange-500"
                            title="Marque se for operação de Day Trade"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sync with Portfolio Checkbox */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
              <input
                id="syncPortfolio"
                type="checkbox"
                checked={syncWithPortfolio}
                onChange={(e) => setSyncWithPortfolio(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="syncPortfolio" className="cursor-pointer text-gray-700 dark:text-gray-300 font-medium">
                <strong>Sincronizar com minha Carteira de Investimentos:</strong> atualiza automaticamente o saldo e preço médio dos ativos na tela principal.
              </label>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
                <Icon name="error" size="sm" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="secondary" onClick={() => setStep('input')} disabled={isSubmitting}>
                ← Voltar / Escolher outro arquivo
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSave}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Icon name="sync" size="sm" className="animate-spin" />
                    <span>Consolidando e Calculando IR...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" size="sm" />
                    <span>Confirmar e Apurar Impostos</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
