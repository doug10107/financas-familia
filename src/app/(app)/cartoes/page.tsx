'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCreditCards, CreditCard } from '@/hooks/useCreditCards';
import { useTransactions, isRefundTransaction, Transaction } from '@/hooks/useTransactions';
import { CreditCardEvolutionChart } from '@/components/cartoes/CreditCardEvolutionChart';
import { RefundModal } from '@/components/cartoes/RefundModal';
import { Badge } from '@/components/ui/Badge';

export default function CreditCardsPage() {
  const { creditCards, loading, error, addCreditCard, updateCreditCard, deleteCreditCard, payInvoice, updateInvoiceDueDate } = useCreditCards();
  const { transactions, categories, refreshData: refreshTransactions, refundTransaction } = useTransactions();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal para registro de estorno / crédito
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [targetTxForRefund, setTargetTxForRefund] = useState<Transaction | null>(null);

  // Modal para detalhar lançamentos da fatura
  const [invoiceDetailsState, setInvoiceDetailsState] = useState<{
    isOpen: boolean;
    card: CreditCard | null;
    month: string;
    monthLabel: string;
  }>({
    isOpen: false,
    card: null,
    month: '',
    monthLabel: ''
  });

  // Modal para ajuste de vencimento da fatura do mês atual
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [targetCardForDueDate, setTargetCardForDueDate] = useState<CreditCard | null>(null);
  const [customDueDate, setCustomDueDate] = useState('');
  const [isSubmittingDueDate, setIsSubmittingDueDate] = useState(false);
  const [dueDateError, setDueDateError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    limit_amount: '',
    closing_day: '25',
    due_day: '5',
    color: '#8b5cf6'
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleOpenModal = (card?: CreditCard) => {
    setFormError('');
    if (card) {
      setEditingId(card.id);
      setFormData({
        name: card.name,
        limit_amount: card.limit_amount.toString(),
        closing_day: card.closing_day.toString(),
        due_day: card.due_day.toString(),
        color: card.color
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        limit_amount: '',
        closing_day: '25',
        due_day: '5',
        color: '#8b5cf6'
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cartão? Histórico de lançamentos vinculados pode ser afetado.')) {
      await deleteCreditCard(id);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.limit_amount || !formData.closing_day || !formData.due_day) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setIsSubmitting(true);
    setFormError('');
    
    let success = false;
    const payload = {
      name: formData.name,
      limit_amount: parseFloat(formData.limit_amount.replace(',', '.')),
      closing_day: parseInt(formData.closing_day),
      due_day: parseInt(formData.due_day),
      color: formData.color,
      icon: 'credit_card' // default
    };

    if (editingId) {
      success = await updateCreditCard(editingId, payload);
    } else {
      success = await addCreditCard(payload);
    }

    setIsSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    } else {
      setFormError('Erro ao salvar cartão. Tente novamente.');
    }
  };

  const handlePayInvoice = async (cardId: string, month: string) => {
    if (window.confirm('Deseja dar baixa em todos os lançamentos pendentes desta fatura?')) {
      const success = await payInvoice(cardId, month);
      if (success) {
        alert('Fatura paga com sucesso! Lançamentos atualizados.');
        refreshTransactions();
      }
    }
  };

  const handleOpenDueDateModal = (card: CreditCard, currentDate?: string) => {
    setTargetCardForDueDate(card);
    setDueDateError('');
    const currentMonth = new Date().toISOString().substring(0, 7);
    const defaultDate = currentDate || `${currentMonth}-${String(card.due_day).padStart(2, '0')}`;
    setCustomDueDate(defaultDate);
    setIsDueDateModalOpen(true);
  };

  const handleSaveDueDate = async () => {
    if (!targetCardForDueDate || !customDueDate) return;
    setIsSubmittingDueDate(true);
    setDueDateError('');
    const currentMonth = new Date().toISOString().substring(0, 7);
    const success = await updateInvoiceDueDate(targetCardForDueDate.id, currentMonth, customDueDate);
    setIsSubmittingDueDate(false);
    if (success) {
      await refreshTransactions();
      setIsDueDateModalOpen(false);
    } else {
      setDueDateError('Erro ao atualizar data de vencimento da fatura.');
    }
  };

  const handleOpenRefundModal = (tx?: Transaction) => {
    setTargetTxForRefund(tx || null);
    setIsRefundModalOpen(true);
  };

  const handleOpenInvoiceDetails = (card: CreditCard, month: string, monthLabel: string) => {
    setInvoiceDetailsState({
      isOpen: true,
      card,
      month,
      monthLabel
    });
  };

  const colorOptions = [
    { label: 'Roxo', value: '#8b5cf6' },
    { label: 'Azul', value: '#3b82f6' },
    { label: 'Verde', value: '#10b981' },
    { label: 'Vermelho', value: '#ef4444' },
    { label: 'Laranja', value: '#f97316' },
    { label: 'Preto', value: '#1f2937' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cartões de Crédito</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie seus cartões, faturas e estornos</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <Button variant="secondary" onClick={() => handleOpenRefundModal()} className="flex-1 sm:flex-none">
            <Icon name="replay" className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" /> 
            Novo Estorno / Crédito
          </Button>
          <Button variant="primary" onClick={() => handleOpenModal()} className="flex-1 sm:flex-none">
            <Icon name="add" className="w-4 h-4 mr-2" /> 
            Novo Cartão
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Gráfico de Evolução de Gastos X/Y */}
      {!loading && (
        <CreditCardEvolutionChart creditCards={creditCards} transactions={transactions} />
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : creditCards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards.map(card => {
            const today = new Date();
            const currentMonth = today.toISOString().substring(0, 7);
            const currentMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(today);
            
            const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const nextMonth = nextMonthDate.toISOString().substring(0, 7);
            const nextMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(nextMonthDate);

            // Transações Fatura Atual
            const currentPendingTxs = transactions.filter(
              t => t.credit_card_id === card.id && t.status === 'pendente' && t.date.startsWith(currentMonth)
            );
            const currentExpenses = currentPendingTxs
              .filter(t => !isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const currentRefunds = currentPendingTxs
              .filter(t => isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const totalDue = Math.max(0, currentExpenses - currentRefunds);
            const currentInvoiceDueDate = currentPendingTxs.length > 0 ? currentPendingTxs[0].date : '';
            const isCustomDate = currentInvoiceDueDate && currentInvoiceDueDate.split('-')[2] !== String(card.due_day).padStart(2, '0');

            // Transações Próxima Fatura
            const nextPendingTxs = transactions.filter(
              t => t.credit_card_id === card.id && t.status === 'pendente' && t.date.startsWith(nextMonth)
            );
            const nextExpenses = nextPendingTxs
              .filter(t => !isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const nextRefunds = nextPendingTxs
              .filter(t => isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const nextTotalDue = Math.max(0, nextExpenses - nextRefunds);

            return (
              <div 
                key={card.id} 
                className="relative p-6 rounded-2xl overflow-hidden shadow-lg border border-white/20 flex flex-col justify-between"
                style={{ backgroundColor: card.color }}
              >
                <div>
                  <div className="absolute top-0 right-0 p-4 flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(card)}
                      className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                      title="Editar Cartão"
                    >
                      <Icon name="edit" size="sm" />
                    </button>
                    <button 
                      onClick={() => handleDelete(card.id)}
                      className="p-1.5 bg-white/20 hover:bg-red-500/80 rounded-lg text-white transition-colors"
                      title="Excluir Cartão"
                    >
                      <Icon name="delete" size="sm" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                      <Icon name={card.icon || 'credit_card'} className="text-[22px]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white leading-tight">{card.name}</h3>
                      <p className="text-xs text-white/70">Fecha dia {card.closing_day} • Vence dia {card.due_day}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3.5 text-white/90 mb-5 bg-black/10 p-3.5 rounded-xl border border-white/10">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-white/70">Limite Total</p>
                      <p className="font-semibold text-sm">{formatCurrency(card.limit_amount)}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-white/70">Vencimento</p>
                        {totalDue > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenDueDateModal(card, currentInvoiceDueDate)}
                            className="text-[9px] bg-white/20 hover:bg-white/30 text-white px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 font-medium"
                            title="Ajustar vencimento desta fatura"
                          >
                            <Icon name="event" size="sm" className="text-[10px]" />
                            Ajustar
                          </button>
                        )}
                      </div>
                      <p className="font-semibold text-sm flex items-baseline gap-1 flex-wrap">
                        <span>Dia {card.due_day}</span>
                        {isCustomDate && (
                          <span className="text-[10px] font-normal text-amber-200">
                            ({currentInvoiceDueDate.split('-')[2]}/{currentInvoiceDueDate.split('-')[1]})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-white/80">Fatura Atual</p>
                        {currentPendingTxs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceDetails(card, currentMonth, `Fatura Atual (${currentMonthName})`)}
                            className="text-[9px] text-white/80 hover:text-white underline font-medium"
                          >
                            Ver itens
                          </button>
                        )}
                      </div>
                      <p className="font-bold text-base text-white">{formatCurrency(totalDue)}</p>
                      {currentRefunds > 0 && (
                        <p className="text-[10px] text-emerald-200 font-medium">
                          (-{formatCurrency(currentRefunds)} estornos)
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-white/80">Próx. Fatura</p>
                        {nextPendingTxs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceDetails(card, nextMonth, `Próxima Fatura (${nextMonthName})`)}
                            className="text-[9px] text-white/80 hover:text-white underline font-medium"
                          >
                            Ver itens
                          </button>
                        )}
                      </div>
                      <p className="font-bold text-base text-white/95">{formatCurrency(nextTotalDue)}</p>
                      {nextRefunds > 0 && (
                        <p className="text-[10px] text-emerald-200 font-semibold flex items-center gap-0.5">
                          <Icon name="replay" className="text-[10px]" />
                          -{formatCurrency(nextRefunds)} estorno
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/20">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceDetails(card, currentMonth, `Fatura Atual (${currentMonthName})`)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Icon name="receipt_long" size="sm" />
                      Ver Fatura
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenRefundModal()}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors flex items-center justify-center gap-1"
                      title="Registrar Estorno no Cartão"
                    >
                      <Icon name="replay" size="sm" />
                      Estornar
                    </button>
                  </div>
                  <button 
                    onClick={() => handlePayInvoice(card.id, currentMonth)}
                    disabled={totalDue === 0}
                    className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${totalDue > 0 ? 'bg-white text-gray-900 hover:bg-gray-50 shadow-sm' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}
                  >
                    <Icon name="check_circle" size="sm" />
                    Pagar Fatura
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <GlassCard className="p-12">
          <EmptyState 
            title="Nenhum cartão cadastrado" 
            description="Adicione seus cartões de crédito para conseguir lançar despesas parceladas." 
            icon="credit_card"
          />
        </GlassCard>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !isSubmitting && setIsModalOpen(false)} 
        title={editingId ? "Editar Cartão" : "Novo Cartão"}
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Input 
            label="Nome do Cartão" 
            placeholder="Ex: Nubank, Itaú" 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          
          <Input 
            label="Limite Total (R$)" 
            type="number" 
            step="0.01"
            placeholder="0,00" 
            value={formData.limit_amount}
            onChange={(e) => setFormData({...formData, limit_amount: e.target.value})}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Dia de Fechamento" 
              value={formData.closing_day}
              onChange={(e) => setFormData({...formData, closing_day: e.target.value})}
              options={Array.from({length: 31}, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }))}
            />
            <Select 
              label="Dia de Vencimento" 
              value={formData.due_day}
              onChange={(e) => setFormData({...formData, due_day: e.target.value})}
              options={Array.from({length: 31}, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }))}
            />
          </div>

          <Select 
            label="Cor Principal" 
            value={formData.color}
            onChange={(e) => setFormData({...formData, color: e.target.value})}
            options={colorOptions}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              {editingId ? "Salvar Alterações" : "Salvar Cartão"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para Ajustar Data da Fatura deste mês */}
      <Modal
        isOpen={isDueDateModalOpen}
        onClose={() => !isSubmittingDueDate && setIsDueDateModalOpen(false)}
        title={`Ajustar Vencimento da Fatura - ${targetCardForDueDate?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Altere a data de vencimento da fatura deste mês específico (por exemplo, quando cai em fim de semana ou feriado bancário).
          </p>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs rounded-xl border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <Icon name="info" className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Isso atualizará a data de pagamento de todos os lançamentos desta fatura de uma vez só, corrigindo o alerta no Dashboard sem alterar o dia oficial cadastrado no cartão para os próximos meses.
            </span>
          </div>

          {dueDateError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {dueDateError}
            </div>
          )}

          <Input
            label="Nova Data de Vencimento"
            type="date"
            value={customDueDate}
            onChange={(e) => setCustomDueDate(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsDueDateModalOpen(false)} disabled={isSubmittingDueDate}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveDueDate} loading={isSubmittingDueDate}>
              Salvar Data da Fatura
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes dos Lançamentos da Fatura */}
      <Modal
        isOpen={invoiceDetailsState.isOpen}
        onClose={() => setInvoiceDetailsState(prev => ({ ...prev, isOpen: false }))}
        title={`${invoiceDetailsState.card?.name || 'Cartão'} - ${invoiceDetailsState.monthLabel}`}
      >
        <div className="space-y-4">
          {(() => {
            if (!invoiceDetailsState.card) return null;
            const cardId = invoiceDetailsState.card.id;
            const month = invoiceDetailsState.month;
            const items = transactions.filter(
              t => t.credit_card_id === cardId && t.date.startsWith(month)
            );

            const expenses = items
              .filter(t => !isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const refunds = items
              .filter(t => isRefundTransaction(t))
              .reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const netTotal = Math.max(0, expenses - refunds);

            return (
              <>
                {/* Resumo da Fatura */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Compras</span>
                    <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                      {formatCurrency(expenses)}
                    </p>
                  </div>
                  <div className="border-x border-gray-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Estornos</span>
                    <p className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                      -{formatCurrency(refunds)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">Fatura Líquida</span>
                    <p className="font-bold text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                      {formatCurrency(netTotal)}
                    </p>
                  </div>
                </div>

                {/* Lista de Itens */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {items.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      Nenhum lançamento encontrado para esta fatura.
                    </div>
                  ) : (
                    items.map(item => {
                      const isRefund = isRefundTransaction(item);
                      const [y, m, d] = item.date.split('-');
                      const dateDisplay = `${d}/${m}`;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition-colors gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isRefund ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : 'bg-purple-100 dark:bg-purple-950/60 text-purple-600'
                            }`}>
                              <Icon name={isRefund ? 'replay' : 'shopping_bag'} size="sm" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                                  {item.description}
                                </p>
                                {isRefund && (
                                  <Badge color="green">Estorno</Badge>
                                )}
                                {item.notes?.includes('[Compra Estornada]') && (
                                  <Badge color="yellow">Estornada</Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Venc: {dateDisplay} • {item.category?.name || 'Sem Categoria'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold tabular-nums ${
                              isRefund ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                            }`}>
                              {isRefund ? '+' : '-'} {formatCurrency(item.amount)}
                            </span>

                            {!isRefund && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceDetailsState(prev => ({ ...prev, isOpen: false }));
                                  handleOpenRefundModal(item);
                                }}
                                className="p-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 rounded hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                                title="Estornar esta compra"
                              >
                                <Icon name="replay" size="sm" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    onClick={() => setInvoiceDetailsState(prev => ({ ...prev, isOpen: false }))}
                  >
                    Fechar
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Modal de Registro de Estorno / Crédito */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        creditCards={creditCards}
        categories={categories}
        originalTransaction={targetTxForRefund}
        onRefund={refundTransaction}
      />
    </div>
  );
}
