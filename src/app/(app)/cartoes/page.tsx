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
import { useTransactions } from '@/hooks/useTransactions';
import { CreditCardEvolutionChart } from '@/components/cartoes/CreditCardEvolutionChart';

export default function CreditCardsPage() {
  const { creditCards, loading, error, addCreditCard, updateCreditCard, deleteCreditCard, payInvoice } = useCreditCards();
  const { transactions, refreshData: refreshTransactions } = useTransactions();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

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
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie seus cartões e limites</p>
        </div>
        <Button variant="primary" onClick={() => handleOpenModal()}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Novo Cartão
        </Button>
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
            const currentMonth = new Date().toISOString().substring(0, 7);
            const pendingTransactions = transactions.filter(
              t => t.credit_card_id === card.id && t.status === 'pendente' && t.date.startsWith(currentMonth)
            );
            const totalDue = pendingTransactions.reduce((acc, t) => acc + Number(t.amount), 0);

            return (
              <div 
                key={card.id} 
                className="relative p-6 rounded-2xl overflow-hidden shadow-lg border border-white/20 flex flex-col"
                style={{ backgroundColor: card.color }}
              >
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                  <button 
                    onClick={() => handleOpenModal(card)}
                    className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                  >
                    <Icon name="edit" size="sm" />
                  </button>
                  <button 
                    onClick={() => handleDelete(card.id)}
                    className="p-1.5 bg-white/20 hover:bg-red-500/80 rounded-lg text-white transition-colors"
                  >
                    <Icon name="delete" size="sm" />
                  </button>
                </div>
                
                <Icon name={card.icon} className="w-8 h-8 text-white/80 mb-4" />
                
                <h3 className="text-xl font-bold text-white mb-6">{card.name}</h3>
                
                <div className="grid grid-cols-2 gap-4 text-white/90 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/70">Limite</p>
                    <p className="font-semibold">{formatCurrency(card.limit_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/70">Fatura (Atual)</p>
                    <p className="font-semibold">{formatCurrency(totalDue)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/70">Fechamento</p>
                    <p className="font-semibold">Dia {card.closing_day}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/70">Vencimento</p>
                    <p className="font-semibold">Dia {card.due_day}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/20">
                  <button 
                    onClick={() => handlePayInvoice(card.id, currentMonth)}
                    disabled={totalDue === 0}
                    className={`w-full py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${totalDue > 0 ? 'bg-white text-gray-900 hover:bg-gray-50' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}
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
    </div>
  );
}
