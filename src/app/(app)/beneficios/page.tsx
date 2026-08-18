'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useBenefitCards, BenefitCard } from '@/hooks/useBenefitCards';

export default function BeneficiosPage() {
  const { cards, transactions, addCard, updateCard, deleteCard, addRecharge, deleteTransaction, clearAllTransactions, getCardStats } = useBenefitCards();
  
  const [selectedCardForRecharge, setSelectedCardForRecharge] = useState<BenefitCard | null>(null);
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<BenefitCard | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  
  const [rechargeAmount, setRechargeAmount] = useState('');
  
  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editRechargeAmount, setEditRechargeAmount] = useState('');
  const [editRechargeDay, setEditRechargeDay] = useState('');

  // New Card Form State
  const [newCardName, setNewCardName] = useState('');
  const [newCardType, setNewCardType] = useState<'va' | 'vr'>('va');
  const [newCardBalance, setNewCardBalance] = useState('');
  const [newCardRechargeAmount, setNewCardRechargeAmount] = useState('');
  const [newCardRechargeDay, setNewCardRechargeDay] = useState('1');
  const [newCardColor, setNewCardColor] = useState('#10b981');
  const [newCardIcon, setNewCardIcon] = useState('restaurant');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleOpenRecharge = (card: BenefitCard) => {
    setSelectedCardForRecharge(card);
    setRechargeAmount(String(card.rechargeAmount));
  };

  const handleConfirmRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForRecharge) return;
    const numericAmount = parseFloat(rechargeAmount.replace(',', '.')) || 0;
    if (numericAmount > 0) {
      addRecharge(selectedCardForRecharge.id, numericAmount);
      setSelectedCardForRecharge(null);
    }
  };

  const handleOpenEdit = (card: BenefitCard) => {
    setSelectedCardForEdit(card);
    setEditName(card.name);
    setEditBalance(String(card.balance));
    setEditRechargeAmount(String(card.rechargeAmount));
    setEditRechargeDay(String(card.rechargeDay));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForEdit) return;

    updateCard(selectedCardForEdit.id, {
      name: editName,
      balance: parseFloat(editBalance.replace(',', '.')) || 0,
      rechargeAmount: parseFloat(editRechargeAmount.replace(',', '.')) || 0,
      rechargeDay: parseInt(editRechargeDay) || 1
    });

    setSelectedCardForEdit(null);
  };

  const handleCreateNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName) return;

    addCard({
      name: newCardName,
      type: newCardType,
      balance: parseFloat(newCardBalance.replace(',', '.')) || 0,
      rechargeAmount: parseFloat(newCardRechargeAmount.replace(',', '.')) || 0,
      rechargeDay: parseInt(newCardRechargeDay) || 1,
      color: newCardColor,
      icon: newCardIcon
    });

    setNewCardName('');
    setNewCardBalance('');
    setNewCardRechargeAmount('');
    setIsNewCardModalOpen(false);
  };

  const handleDeleteCard = (card: BenefitCard) => {
    if (window.confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?`)) {
      deleteCard(card.id);
    }
  };

  const totalVABalance = cards.filter(c => c.type === 'va').reduce((acc, c) => acc + c.balance, 0);
  const totalVRBalance = cards.filter(c => c.type === 'vr').reduce((acc, c) => acc + c.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="restaurant" className="text-emerald-500" /> Benefícios (VA & VR)
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Controle os saldos dos seus vales alimentação e refeição
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewCardModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Icon name="add" size="sm" /> Novo Cartão
          </Button>

          {/* Global Summary Badges */}
          <div className="flex gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Total VA</span>
              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalVABalance)}</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Total VR</span>
              <span className="text-base font-extrabold text-amber-700 dark:text-amber-300">{formatCurrency(totalVRBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Benefit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(card => {
          const stats = getCardStats(card.id);
          const isVA = card.type === 'va';

          return (
            <div
              key={card.id}
              className={`rounded-2xl p-6 shadow-xl relative overflow-hidden text-white transition-transform hover:-translate-y-1 ${
                isVA
                  ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 shadow-emerald-950/20'
                  : 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-800 shadow-amber-950/20'
              }`}
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm inline-block mb-1">
                    {isVA ? 'Vale Alimentação' : 'Vale Refeição'}
                  </span>
                  <h2 className="text-lg font-bold text-white">{card.name}</h2>
                </div>

                <div className="flex items-center gap-1">
                  <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                    <Icon name={card.icon} size="md" className="text-white" />
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 transition-colors text-white"
                    title="Excluir Cartão"
                  >
                    <Icon name="delete" size="sm" />
                  </button>
                </div>
              </div>

              {/* Balance & Daily Allowance */}
              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-xs text-white/70 block">Saldo Disponível</span>
                  <span className="text-3xl font-extrabold tracking-tight">{formatCurrency(card.balance)}</span>
                </div>

                <div className="bg-black/20 backdrop-blur-sm p-3 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-white/70 block">Média Diária Recomendada</span>
                    <span className="font-bold text-white text-sm">{formatCurrency(stats.dailyAllowance)} / dia</span>
                  </div>
                  <span className="px-2 py-1 bg-white/20 rounded-md font-semibold text-[11px]">
                    {stats.daysRemaining} dias restantes
                  </span>
                </div>
              </div>

              {/* Card Footer: Recharge Info & Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
                <div className="text-white/80">
                  <span>Recarga dia {card.rechargeDay.toString().padStart(2, '0')}: </span>
                  <span className="font-bold">{formatCurrency(card.rechargeAmount)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(card)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                    title="Editar Cartão"
                  >
                    <Icon name="edit" size="sm" />
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenRecharge(card)}
                    className="bg-white text-gray-900 hover:bg-gray-100 font-semibold text-xs px-3 py-1"
                  >
                    Recarregar
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Benefit Transactions Extrato */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="history" className="text-gray-400" /> Extrato de Uso dos Vales
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Histórico de compras e recargas nos cartões de benefício
            </p>
          </div>

          {transactions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm('Deseja realmente limpar todo o histórico do extrato?')) {
                  clearAllTransactions();
                }
              }}
              className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-1"
            >
              <Icon name="delete_sweep" size="sm" /> Limpar Extrato
            </Button>
          )}
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {transactions.length > 0 ? (
            transactions.map(tx => {
              const card = cards.find(c => c.id === tx.cardId);
              const isRecharge = tx.type === 'recarga';

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 bg-gray-50/70 dark:bg-gray-800/40 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                        isRecharge ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    >
                      <Icon name={isRecharge ? 'add_circle' : 'shopping_bag'} size="sm" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{tx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {card?.name || 'Vale'}
                        </span>
                        <span>•</span>
                        <span>{tx.date.split('-').reverse().join('/')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`font-extrabold text-sm ${isRecharge ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                      {isRecharge ? `+ ${formatCurrency(tx.amount)}` : `- ${formatCurrency(tx.amount)}`}
                    </span>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-gray-400 hover:text-red-500 p-1 opacity-80 hover:opacity-100 transition-opacity"
                      title="Excluir Transação"
                    >
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-gray-400 italic">
              Nenhuma transação registrada com vales.
            </div>
          )}
        </div>
      </GlassCard>

      {/* New Card Modal */}
      <Modal
        isOpen={isNewCardModalOpen}
        onClose={() => setIsNewCardModalOpen(false)}
        title="Cadastrar Novo Cartão de Benefício"
      >
        <form onSubmit={handleCreateNewCard} className="space-y-4">
          <Input
            label="Nome do Cartão"
            placeholder="Ex: Sodexo Pass, Caju Alimentação"
            value={newCardName}
            onChange={(e) => setNewCardName(e.target.value)}
            required
          />

          <Select
            label="Tipo do Vale"
            value={newCardType}
            onChange={(e) => {
              const val = e.target.value as 'va' | 'vr';
              setNewCardType(val);
              if (val === 'va') {
                setNewCardColor('#10b981');
                setNewCardIcon('restaurant');
              } else {
                setNewCardColor('#f59e0b');
                setNewCardIcon('flatware');
              }
            }}
            options={[
              { value: 'va', label: 'VA (Vale Alimentação - Mercado/Açougue)' },
              { value: 'vr', label: 'VR (Vale Refeição - Restaurante/Lanchonete)' }
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Saldo Inicial (R$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newCardBalance}
              onChange={(e) => setNewCardBalance(e.target.value)}
            />
            <Input
              label="Recarga Mensal (R$)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newCardRechargeAmount}
              onChange={(e) => setNewCardRechargeAmount(e.target.value)}
            />
          </div>

          <Input
            label="Dia do Mês da Recarga (1 a 31)"
            type="number"
            min="1"
            max="31"
            value={newCardRechargeDay}
            onChange={(e) => setNewCardRechargeDay(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewCardModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Cadastrar Cartão
            </Button>
          </div>
        </form>
      </Modal>

      {/* Recharge Modal */}
      <Modal
        isOpen={!!selectedCardForRecharge}
        onClose={() => setSelectedCardForRecharge(null)}
        title={`Registrar Recarga: ${selectedCardForRecharge?.name || ''}`}
      >
        <form onSubmit={handleConfirmRecharge} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Informe o valor a ser creditado no saldo do cartão de benefício.
          </p>
          <Input
            label="Valor da Recarga (R$)"
            type="number"
            step="0.01"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setSelectedCardForRecharge(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Confirmar Recarga
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Card Modal */}
      <Modal
        isOpen={!!selectedCardForEdit}
        onClose={() => setSelectedCardForEdit(null)}
        title="Editar Cartão de Benefício"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Nome do Cartão"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Saldo Atual (R$)"
            type="number"
            step="0.01"
            value={editBalance}
            onChange={(e) => setEditBalance(e.target.value)}
            required
          />
          <Input
            label="Valor da Recarga Mensal (R$)"
            type="number"
            step="0.01"
            value={editRechargeAmount}
            onChange={(e) => setEditRechargeAmount(e.target.value)}
            required
          />
          <Input
            label="Dia da Recarga (1 a 31)"
            type="number"
            min="1"
            max="31"
            value={editRechargeDay}
            onChange={(e) => setEditRechargeDay(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setSelectedCardForEdit(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
