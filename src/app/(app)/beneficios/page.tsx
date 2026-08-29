'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useBenefitCards, BenefitCard, BenefitTransaction, BenefitTransactionItem } from '@/hooks/useBenefitCards';
import { useShoppingLists } from '@/hooks/useShoppingLists';

export default function BeneficiosPage() {
  const router = useRouter();
  const {
    cards,
    transactions,
    addCard,
    updateCard,
    deleteCard,
    addRecharge,
    updateTransactionItems,
    deleteTransaction,
    clearAllTransactions,
    getCardStats
  } = useBenefitCards();
  
  const { lists, createListWithItems } = useShoppingLists();
  
  const [selectedCardForRecharge, setSelectedCardForRecharge] = useState<BenefitCard | null>(null);
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<BenefitCard | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  
  const [rechargeAmount, setRechargeAmount] = useState('');
  
  // Expanded Transactions State
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({});

  // Item Details Editor State
  const [selectedTxForItems, setSelectedTxForItems] = useState<BenefitTransaction | null>(null);
  const [editItemsList, setEditItemsList] = useState<BenefitTransactionItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('');
  
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

  const toggleExpandTx = (txId: string) => {
    setExpandedTxIds(prev => ({
      ...prev,
      [txId]: !prev[txId]
    }));
  };

  const handleOpenItemEditor = (tx: BenefitTransaction) => {
    setSelectedTxForItems(tx);
    if (tx.items && tx.items.length > 0) {
      setEditItemsList([...tx.items]);
    } else {
      // Check if there's a matching shopping list by title
      const cleanDesc = tx.description.toLowerCase().replace('compra:', '').trim();
      const matchedList = lists.find(l => cleanDesc.includes(l.title.toLowerCase()) || l.title.toLowerCase().includes(cleanDesc));
      if (matchedList && matchedList.items.length > 0) {
        const imported = matchedList.items.map(i => ({
          name: i.name,
          quantity: Number(i.quantity) || 1,
          price: Number(i.actualPrice) > 0 ? Number(i.actualPrice) : Number(i.estimatedPrice)
        }));
        setEditItemsList(imported);
      } else {
        setEditItemsList([]);
      }
    }
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
  };

  const handleImportFromList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list || list.items.length === 0) return;
    const imported = list.items.map(i => ({
      name: i.name,
      quantity: Number(i.quantity) || 1,
      price: Number(i.actualPrice) > 0 ? Number(i.actualPrice) : Number(i.estimatedPrice)
    }));
    setEditItemsList(prev => [...prev, ...imported]);
  };

  const handleAddItemToTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const qty = parseFloat(newItemQty.replace(',', '.')) || 1;
    const price = parseFloat(newItemPrice.replace(',', '.')) || 0;

    setEditItemsList(prev => [
      ...prev,
      { name: newItemName.trim(), quantity: qty, price }
    ]);
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
  };

  const handleRemoveItemFromTx = (index: number) => {
    setEditItemsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveTxItems = async () => {
    if (!selectedTxForItems) return;
    await updateTransactionItems(selectedTxForItems.id, editItemsList);
    setExpandedTxIds(prev => ({ ...prev, [selectedTxForItems.id]: true }));
    setSelectedTxForItems(null);
  };

  const handleReuseTransactionAsList = async (tx: BenefitTransaction) => {
    let listTitle = tx.description
      .replace(/^Compra\s*\([^)]*\)\s*:\s*/i, '')
      .replace(/^Compra\s*:\s*/i, '')
      .trim();
    if (!listTitle) listTitle = 'Lista de Compras Reutilizada';

    let itemsToCopy: {
      name: string;
      category: string;
      quantity: number;
      unit: string;
      estimatedPrice: number;
      actualPrice: number;
      position: number;
    }[] = [];

    if (tx.items && tx.items.length > 0) {
      itemsToCopy = tx.items.map((item, idx) => {
        const match = item.name.match(/^(.*?)(?:\s*\(([\d.,]+)\s*(kg|g|L|ml|pct|cx|dz|un)\))?$/i);
        if (match && match[2] && match[3]) {
          return {
            name: match[1].trim(),
            category: 'Alimentação',
            quantity: parseFloat(match[2].replace(',', '.')) || item.quantity || 1,
            unit: match[3].toLowerCase(),
            estimatedPrice: item.price || 0,
            actualPrice: item.price || 0,
            position: idx
          };
        }
        return {
          name: item.name.trim(),
          category: 'Alimentação',
          quantity: item.quantity || 1,
          unit: 'un',
          estimatedPrice: item.price || 0,
          actualPrice: item.price || 0,
          position: idx
        };
      });
    } else {
      const cleanDesc = tx.description.toLowerCase().replace(/^compra\s*:\s*/i, '').trim();
      const matchedList = lists.find(l => cleanDesc.includes(l.title.toLowerCase()) || l.title.toLowerCase().includes(cleanDesc));
      if (matchedList && matchedList.items.length > 0) {
        itemsToCopy = matchedList.items.map((i, idx) => ({
          name: i.name,
          category: i.category || 'Alimentação',
          quantity: Number(i.quantity) || 1,
          unit: i.unit || 'un',
          estimatedPrice: Number(i.actualPrice) > 0 ? Number(i.actualPrice) : Number(i.estimatedPrice),
          actualPrice: Number(i.actualPrice) > 0 ? Number(i.actualPrice) : Number(i.estimatedPrice),
          position: idx
        }));
      }
    }

    const card = cards.find(c => c.id === tx.cardId);
    const dateFormatted = tx.date ? tx.date.split('-').reverse().join('/') : '';
    const desc = `Reutilizada da compra de ${dateFormatted}${card ? ` (${card.name})` : ''}`;

    const newId = await createListWithItems(listTitle, desc, tx.cardId, itemsToCopy);
    if (newId) {
      router.push('/compras');
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

        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {transactions.length > 0 ? (
            transactions.map(tx => {
              const card = cards.find(c => c.id === tx.cardId);
              const isRecharge = tx.type === 'recarga';
              const hasItems = Array.isArray(tx.items) && tx.items.length > 0;
              const isExpanded = !!expandedTxIds[tx.id];

              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 hover:bg-gray-100/80 dark:hover:bg-gray-800/70 transition-all overflow-hidden"
                >
                  {/* Top Transaction Row */}
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                          isRecharge ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      >
                        <Icon name={isRecharge ? 'add_circle' : 'shopping_bag'} size="sm" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{tx.description}</p>
                          
                          {/* Discreet Details / Items Button */}
                          {!isRecharge && (
                            <>
                              {hasItems ? (
                                <button
                                  onClick={() => toggleExpandTx(tx.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                                    isExpanded
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                      : 'bg-gray-200/70 hover:bg-gray-200 text-gray-600 dark:bg-gray-700/60 dark:hover:bg-gray-700 dark:text-gray-300'
                                  }`}
                                  title="Ver itens comprados nesta transação"
                                >
                                  <Icon name="receipt_long" size="sm" className="text-gray-500 dark:text-gray-400 !text-sm" />
                                  <span>{tx.items!.length} {tx.items!.length === 1 ? 'item' : 'itens'}</span>
                                  <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size="sm" className="!text-sm" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenItemEditor(tx)}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-medium text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                  title="Adicionar lista de itens comprados"
                                >
                                  <Icon name="add" size="sm" className="!text-sm" />
                                  <span>Detalhes</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleReuseTransactionAsList(tx)}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/70 dark:border-emerald-800/50 transition-colors"
                                title="Criar uma nova lista de compras a partir desta compra efetivada"
                              >
                                <Icon name="replay" size="sm" className="!text-sm text-emerald-600 dark:text-emerald-400" />
                                <span>Reutilizar Lista</span>
                              </button>
                            </>
                          )}
                        </div>

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

                  {/* Expandable Items Section (Discreet Accordion) */}
                  {isExpanded && hasItems && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100 dark:border-gray-800/80 bg-black/[0.02] dark:bg-white/[0.02]">
                      <div className="bg-white/80 dark:bg-gray-900/60 rounded-xl p-3 border border-gray-200/60 dark:border-gray-700/50 shadow-xs space-y-2">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800 flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <Icon name="shopping_basket" size="sm" className="text-emerald-500 !text-base" />
                            <span>Itens comprados no mercado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReuseTransactionAsList(tx)}
                              className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition-colors shadow-xs"
                              title="Jogar estes itens com valores e quantidades de volta para a Lista de Compras"
                            >
                              <Icon name="replay" size="sm" className="!text-sm text-emerald-600 dark:text-emerald-400" /> Reutilizar Lista de Compras
                            </button>
                            <button
                              onClick={() => handleOpenItemEditor(tx)}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              <Icon name="edit" size="sm" className="!text-sm" /> Editar itens
                            </button>
                          </div>
                        </div>

                        {/* Items List */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                          {tx.items!.map((item, idx) => {
                            const itemTotal = (item.quantity || 1) * (item.price || 0);
                            return (
                              <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                    ({item.quantity}x {formatCurrency(item.price)})
                                  </span>
                                </div>
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(itemTotal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Total Footer */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
                          <span>Subtotal dos itens</span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(
                              tx.items!.reduce((acc, i) => acc + ((i.quantity || 1) * (i.price || 0)), 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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

      {/* Modal: Edit / View Transaction Items Details */}
      <Modal
        isOpen={!!selectedTxForItems}
        onClose={() => setSelectedTxForItems(null)}
        title={`Itens da Compra: ${selectedTxForItems?.description || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Adicione ou consulte os produtos comprados nesta ida ao mercado.
          </p>

          {/* Quick Import from Shopping Lists if available */}
          {lists.length > 0 && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="playlist_add_check" size="sm" className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Importar de uma Lista Salva</p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">Carregar os itens de uma lista pré-existente</p>
                </div>
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleImportFromList(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="w-full sm:w-auto text-xs bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="" disabled>Selecionar lista para puxar...</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.title} ({l.items.length} itens)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Add Product Form inside modal */}
          <form onSubmit={handleAddItemToTx} className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3 border border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">Adicionar Novo Produto</span>
            
            <div className="space-y-2.5">
              <Input
                label="Nome do Produto"
                placeholder="Ex: Feijão 1kg, Arroz, Detergente..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <Input
                  label="Quantidade"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="1"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                />
                <Input
                  label="Preço Unitário (R$)"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
                <Button type="submit" variant="secondary" className="w-full h-11 flex items-center justify-center gap-1.5 font-semibold text-xs">
                  <Icon name="add" size="sm" className="!text-sm" /> Inserir
                </Button>
              </div>
            </div>
          </form>

          {/* Current Items List in Modal */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Produtos Registrados ({editItemsList.length})
            </span>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {editItemsList.length > 0 ? (
                editItemsList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                      <span className="text-[11px] text-gray-400">
                        {item.quantity}x {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromTx(idx)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                      title="Remover Item"
                    >
                      <Icon name="delete" size="sm" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-gray-400 italic">
                  Nenhum item adicionado ainda.
                </div>
              )}
            </div>
          </div>

          {/* Footer with Subtotal & Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">Total dos Itens: </span>
              <strong className="text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCurrency(editItemsList.reduce((acc, i) => acc + (i.quantity * i.price), 0))}
              </strong>
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Button type="button" variant="ghost" onClick={() => setSelectedTxForItems(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={handleSaveTxItems}>
                Salvar Itens
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
