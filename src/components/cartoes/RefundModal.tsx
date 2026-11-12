'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { CreditCard } from '@/hooks/useCreditCards';
import { Transaction, Category, calculateInvoiceDueDate } from '@/hooks/useTransactions';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCards: CreditCard[];
  categories: Category[];
  originalTransaction?: Transaction | null;
  onSuccess?: () => void;
  onRefund: (params: {
    creditCardId: string;
    amount: number;
    description: string;
    targetInvoiceDueDate: string;
    categoryId?: string | null;
    originalTransactionId?: string;
    notes?: string;
  }) => Promise<boolean>;
}

export function RefundModal({
  isOpen,
  onClose,
  creditCards,
  categories,
  originalTransaction,
  onSuccess,
  onRefund
}: RefundModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [invoiceOption, setInvoiceOption] = useState<'next' | 'current' | 'custom'>('next');
  const [customDueDate, setCustomDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const selectedCard = useMemo(() => {
    return creditCards.find(c => c.id === selectedCardId) || null;
  }, [creditCards, selectedCardId]);

  // Data base da compra (ou data de hoje caso não haja transação original)
  const basePurchaseDate = useMemo(() => {
    if (originalTransaction?.date) {
      return new Date(originalTransaction.date + 'T12:00:00');
    }
    return new Date();
  }, [originalTransaction]);

  // Cálculo das datas das faturas
  const { currentInvoiceDateStr, nextInvoiceDateStr } = useMemo(() => {
    if (!selectedCard) {
      const todayStr = new Date().toISOString().split('T')[0];
      return { currentInvoiceDateStr: todayStr, nextInvoiceDateStr: todayStr };
    }

    // Fatura da compra (offset 0)
    const currentInv = calculateInvoiceDueDate(
      basePurchaseDate,
      selectedCard.closing_day,
      selectedCard.due_day,
      0
    );
    // Próxima fatura (offset 1)
    const nextInv = calculateInvoiceDueDate(
      basePurchaseDate,
      selectedCard.closing_day,
      selectedCard.due_day,
      1
    );

    return {
      currentInvoiceDateStr: currentInv.toISOString().split('T')[0],
      nextInvoiceDateStr: nextInv.toISOString().split('T')[0]
    };
  }, [selectedCard, basePurchaseDate]);

  // Data efetiva de vencimento que será gravada
  const targetDueDate = useMemo(() => {
    if (invoiceOption === 'current') return currentInvoiceDateStr;
    if (invoiceOption === 'next') return nextInvoiceDateStr;
    return customDueDate || nextInvoiceDateStr;
  }, [invoiceOption, currentInvoiceDateStr, nextInvoiceDateStr, customDueDate]);

  // Inicialização do formulário ao abrir
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setIsSubmitting(false);

    if (originalTransaction) {
      setSelectedCardId(originalTransaction.credit_card_id || (creditCards[0]?.id ?? ''));
      setAmount(originalTransaction.amount.toString());
      setDescription(`Estorno: ${originalTransaction.description.replace(/^Estorno:\s*/i, '')}`);
      setCategoryId(originalTransaction.category_id || '');
      // Se a compra foi feita no cartão e está perto do fechamento, sugerimos a próxima fatura por padrão
      setInvoiceOption('next');
      setCustomDueDate('');
      setNotes(`Estorno referente ao lançamento original de R$ ${originalTransaction.amount.toFixed(2)}`);
    } else {
      setSelectedCardId(creditCards[0]?.id || '');
      setAmount('');
      setDescription('Estorno no Cartão');
      setCategoryId('');
      setInvoiceOption('next');
      setCustomDueDate('');
      setNotes('');
    }
  }, [isOpen, originalTransaction, creditCards]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) {
      setError('Por favor, selecione um cartão de crédito.');
      return;
    }

    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor, informe um valor de estorno válido maior que zero.');
      return;
    }

    if (!description.trim()) {
      setError('Por favor, informe a descrição do estorno.');
      return;
    }

    if (!targetDueDate) {
      setError('Por favor, informe a data de vencimento da fatura de destino.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const success = await onRefund({
        creditCardId: selectedCardId,
        amount: numAmount,
        description: description.trim(),
        targetInvoiceDueDate: targetDueDate,
        categoryId: categoryId || null,
        originalTransactionId: originalTransaction?.id,
        notes: notes.trim() || undefined
      });

      if (success) {
        onSuccess?.();
        onClose();
      } else {
        setError('Ocorreu um erro ao salvar o estorno. Tente novamente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao registrar estorno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Registrar Estorno / Crédito no Cartão"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <Icon name="error" className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resumo da Compra Original (caso exista) */}
        {originalTransaction && (
          <div className="p-3.5 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-2xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 tracking-wider">
                Compra Original
              </span>
              <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                {originalTransaction.description}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Data: {formatDateDisplay(originalTransaction.date)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                {formatCurrency(originalTransaction.amount)}
              </span>
            </div>
          </div>
        )}

        {/* Seletor do Cartão */}
        <div>
          <Select
            label="Cartão de Crédito"
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            options={
              creditCards.length > 0
                ? creditCards.map(c => ({ value: c.id, label: `${c.name} (Fecha dia ${c.closing_day} / Vence dia ${c.due_day})` }))
                : [{ value: '', label: 'Nenhum cartão cadastrado' }]
            }
          />
        </div>

        {/* Valor e Descrição */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Valor a Estornar (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input
            label="Descrição do Estorno"
            placeholder="Ex: Estorno Mercado Livre"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {/* Categoria */}
        <div>
          <Select
            label="Categoria (para abater no relatório)"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: '', label: 'Selecione uma categoria (opcional)...' },
              ...categories.map(c => ({ value: c.id, label: c.name }))
            ]}
          />
        </div>

        {/* Onde aplicar o crédito: Escolha da Fatura */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Em qual fatura o estorno vai entrar?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Opção Próxima Fatura */}
            <button
              type="button"
              onClick={() => setInvoiceOption('next')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                invoiceOption === 'next'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 ring-1 ring-purple-500'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Icon name="event_upcoming" className="text-purple-600 dark:text-purple-400 text-sm" />
                  Próxima Fatura
                </span>
                <span className="text-[9px] bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded-full font-bold">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Vence em: <strong className="text-gray-800 dark:text-gray-200">{formatDateDisplay(nextInvoiceDateStr)}</strong>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Ideal se a fatura atual já fechou ou fecha em breve.
              </p>
            </button>

            {/* Opção Mesma Fatura */}
            <button
              type="button"
              onClick={() => setInvoiceOption('current')}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                invoiceOption === 'current'
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 ring-1 ring-purple-500'
                  : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Icon name="event" className="text-gray-600 dark:text-gray-400 text-sm" />
                  Mesma Fatura (Atual)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Vence em: <strong className="text-gray-800 dark:text-gray-200">{formatDateDisplay(currentInvoiceDateStr)}</strong>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Se o cancelamento entrou antes do fechamento.
              </p>
            </button>
          </div>

          {/* Opção personalizada de data */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setInvoiceOption(prev => prev === 'custom' ? 'next' : 'custom')}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Icon name={invoiceOption === 'custom' ? 'keyboard_arrow_up' : 'calendar_month'} className="text-xs" />
              {invoiceOption === 'custom' ? 'Usar cálculo automático da fatura' : 'Ou selecionar outra data de fatura manualmente'}
            </button>

            {invoiceOption === 'custom' && (
              <div className="mt-2">
                <Input
                  label="Data de Vencimento da Fatura Destino"
                  type="date"
                  value={customDueDate || nextInvoiceDateStr}
                  onChange={(e) => setCustomDueDate(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Box explicativo do impacto */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <Icon name="check_circle" className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Este estorno entrará como um <strong>crédito de {amount ? formatCurrency(parseFloat(amount.replace(',', '.')) || 0) : 'R$ 0,00'}</strong> abatendo diretamente o valor da fatura com vencimento em <strong>{formatDateDisplay(targetDueDate)}</strong>.
          </span>
        </div>

        {/* Observações */}
        <div>
          <Input
            label="Observação (opcional)"
            placeholder="Ex: Cancelado pelo vendedor no Mercado Livre"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            <Icon name="replay" className="w-4 h-4 mr-1.5" />
            Confirmar Estorno
          </Button>
        </div>
      </form>
    </Modal>
  );
}
