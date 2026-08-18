'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { useShoppingLists, ShoppingList, ShoppingItem } from '@/hooks/useShoppingLists';
import { useBenefitCards } from '@/hooks/useBenefitCards';

export default function ComprasPage() {
  const { lists, createList, updateList, addItem, toggleItem, updateItemPrice, deleteItem, deleteList, completeList } = useShoppingLists();
  const { cards, debitBalance } = useBenefitCards();

  const [activeListId, setActiveListId] = useState<string | null>(lists.length > 0 ? lists[0].id : null);
  
  // Modals
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);

  // New List Form State
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCardId, setNewListCardId] = useState('va-1');

  // Edit List Form State
  const [editListTitle, setEditListTitle] = useState('');
  const [editListDesc, setEditListDesc] = useState('');
  const [editListCardId, setEditListCardId] = useState('va-1');

  // New Item Form State
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Alimentação');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemEstPrice, setItemEstPrice] = useState('');

  // Finalize Form State (Single & Split Payment)
  const [selectedCardForPayment, setSelectedCardForPayment] = useState('va-1');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  
  const [card1Id, setCard1Id] = useState('va-1');
  const [card1Amount, setCard1Amount] = useState('');
  const [card2Id, setCard2Id] = useState('va-2');
  const [card2Amount, setCard2Amount] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const activeList = lists.find(l => l.id === activeListId) || lists[0];

  // Totals calculations
  const totalEstimated = activeList?.items.reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0) || 0;
  const totalInCart = activeList?.items.filter(i => i.isChecked).reduce((acc, i) => acc + (i.quantity * i.actualPrice), 0) || 0;
  
  const selectedPaymentCard = cards.find(c => c.id === selectedCardForPayment);
  const card1 = cards.find(c => c.id === card1Id);
  const card2 = cards.find(c => c.id === card2Id);

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle) return;
    createList(newListTitle, newListDesc, newListCardId);
    setNewListTitle('');
    setNewListDesc('');
    setIsNewListOpen(false);
  };

  const handleOpenEditList = () => {
    if (!activeList) return;
    setEditListTitle(activeList.title);
    setEditListDesc(activeList.description || '');
    setEditListCardId(activeList.benefitCardId || 'va-1');
    setIsEditListOpen(true);
  };

  const handleSaveEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !editListTitle) return;

    updateList(activeList.id, {
      title: editListTitle,
      description: editListDesc,
      benefitCardId: editListCardId
    });

    setIsEditListOpen(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !itemName) return;

    const qty = parseInt(itemQuantity) || 1;
    const est = parseFloat(itemEstPrice.replace(',', '.')) || 0;

    addItem(activeList.id, {
      name: itemName,
      category: itemCategory,
      quantity: qty,
      estimatedPrice: est,
      actualPrice: est
    });

    setItemName('');
    setItemEstPrice('');
    setIsAddItemOpen(false);
  };

  const handleOpenFinalizeModal = () => {
    if (!activeList) return;
    const defaultCardId = activeList.benefitCardId || 'va-1';
    setSelectedCardForPayment(defaultCardId);
    setIsSplitPayment(false);

    // Default Split values
    setCard1Id(defaultCardId);
    const defaultCardObj = cards.find(c => c.id === defaultCardId);
    const initialCard1Val = defaultCardObj ? Math.min(totalInCart, defaultCardObj.balance) : Math.floor(totalInCart / 2);
    setCard1Amount(String(initialCard1Val));

    const secondCardObj = cards.find(c => c.id !== defaultCardId) || cards[0];
    if (secondCardObj) {
      setCard2Id(secondCardObj.id);
    }
    const initialCard2Val = Math.max(0, totalInCart - initialCard1Val);
    setCard2Amount(String(initialCard2Val));

    setIsFinalizeOpen(true);
  };

  const handleCard1AmountChange = (val: string) => {
    setCard1Amount(val);
    const c1Val = parseFloat(val.replace(',', '.')) || 0;
    const remaining = Math.max(0, totalInCart - c1Val);
    setCard2Amount(String(Number(remaining.toFixed(2))));
  };

  const handleFinalizePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList) return;

    if (totalInCart > 0) {
      if (isSplitPayment) {
        const amt1 = parseFloat(card1Amount.replace(',', '.')) || 0;
        const amt2 = parseFloat(card2Amount.replace(',', '.')) || 0;

        if (amt1 > 0 && card1) {
          debitBalance(card1.id, amt1, `Compra (Parte 1/2): ${activeList.title}`, 'Alimentação');
        }
        if (amt2 > 0 && card2) {
          debitBalance(card2.id, amt2, `Compra (Parte 2/2): ${activeList.title}`, 'Alimentação');
        }
      } else {
        if (selectedPaymentCard) {
          debitBalance(selectedPaymentCard.id, totalInCart, `Compra: ${activeList.title}`, 'Alimentação');
        }
      }
    }

    completeList(activeList.id);
    setIsFinalizeOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="shopping_cart" className="text-blue-500" /> Lista de Compras Inteligente
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Monte suas listas, acompanhe os preços no mercado e deduza do seu VA/VR com 1 clique
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsNewListOpen(true)}
          className="flex items-center gap-1.5"
        >
          <Icon name="add" size="sm" /> Criar Nova Lista
        </Button>
      </div>

      {/* Main Content Layout: Sidebar Lists + Active List Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: All Shopping Lists */}
        <GlassCard className="p-6 space-y-4 lg:col-span-1">
          <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <Icon name="format_list_bulleted" size="sm" /> Suas Listas
          </h3>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {lists.length > 0 ? (
              lists.map(list => {
                const isSelected = list.id === activeListId;
                const itemsCount = list.items.length;
                const checkedCount = list.items.filter(i => i.isChecked).length;
                const card = cards.find(c => c.id === list.benefitCardId);

                return (
                  <div
                    key={list.id}
                    onClick={() => setActiveListId(list.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 shadow-sm'
                        : 'bg-gray-50/60 dark:bg-gray-800/40 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{list.title}</h4>
                      {list.isCompleted ? (
                        <Badge color="green" className="text-[10px]">Concluída</Badge>
                      ) : (
                        <Badge color="blue" className="text-[10px]">{checkedCount}/{itemsCount} itens</Badge>
                      )}
                    </div>

                    {list.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
                        {list.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100/50 dark:border-gray-800/50">
                      <span>{list.createdAt.split('-').reverse().join('/')}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {card?.name || 'Vale'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-gray-400 italic">
                Nenhuma lista de compras criada.
              </div>
            )}
          </div>
        </GlassCard>

        {/* Right Column: Selected List Interactive Workspace */}
        {activeList ? (
          <GlassCard className="p-6 lg:col-span-2 space-y-6 flex flex-col justify-between">
            <div>
              {/* Active List Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeList.title}</h2>
                    {activeList.isCompleted && <Badge color="green">Finalizada</Badge>}
                  </div>
                  {activeList.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeList.description}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenEditList}
                    className="text-xs font-semibold flex items-center gap-1"
                  >
                    <Icon name="edit" size="sm" /> Editar Lista
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteList(activeList.id)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs"
                  >
                    <Icon name="delete" size="sm" /> Excluir
                  </Button>

                  {!activeList.isCompleted && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddItemOpen(true)}
                      className="text-xs font-semibold flex items-center gap-1"
                    >
                      <Icon name="add" size="sm" /> Adicionar Item
                    </Button>
                  )}
                </div>
              </div>

              {/* Total Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-4">
                <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Estimado Total</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(totalEstimated)}</span>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block">No Carrinho</span>
                  <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalInCart)}</span>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider block">Forma de Pagamento</span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    {cards.find(c => c.id === activeList.benefitCardId)?.name || 'VA / VR'}
                  </span>
                </div>
              </div>

              {/* Interactive Items Checklist */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {activeList.items.length > 0 ? (
                  activeList.items.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${
                        item.isChecked
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-90'
                          : 'bg-gray-50/60 dark:bg-gray-800/40 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={() => toggleItem(activeList.id, item.id)}
                          className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div>
                          <p className={`font-semibold text-sm ${item.isChecked ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            {item.name}
                          </p>
                          <span className="text-[11px] text-gray-400">
                            Qtd: {item.quantity} • Est: {formatCurrency(item.estimatedPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Actual Price Input & Delete Button */}
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-right">
                          <Input
                            type="number"
                            step="0.10"
                            placeholder="Valor R$"
                            value={item.actualPrice}
                            onChange={(e) => updateItemPrice(activeList.id, item.id, parseFloat(e.target.value) || 0)}
                            className="text-right text-xs py-1"
                          />
                        </div>

                        <button
                          onClick={() => deleteItem(activeList.id, item.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Icon name="close" size="sm" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-gray-400 italic">
                    Nenhum item adicionado a esta lista. Clique em "Adicionar Item" acima!
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Finalize Bar */}
            {!activeList.isCompleted && activeList.items.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Total a ser debitado do VA/VR:</span>
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalInCart)}</p>
                </div>

                <Button
                  variant="primary"
                  onClick={handleOpenFinalizeModal}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Icon name="check_circle" size="sm" /> Finalizar Compra & Abater VA
                </Button>
              </div>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="p-12 lg:col-span-2 flex items-center justify-center text-gray-400 text-sm">
            Nenhuma lista selecionada.
          </GlassCard>
        )}
      </div>

      {/* Modal: New List */}
      <Modal isOpen={isNewListOpen} onClose={() => setIsNewListOpen(false)} title="Criar Nova Lista de Compras">
        <form onSubmit={handleCreateList} className="space-y-4">
          <Input
            label="Título da Lista"
            placeholder="Ex: Supermercado Semanal, Açougue"
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            required
          />
          <Input
            label="Descrição (Opcional)"
            placeholder="Ex: Compras para o churrasco de domingo"
            value={newListDesc}
            onChange={(e) => setNewListDesc(e.target.value)}
          />
          <Select
            label="Cartão de Benefício Preferencial"
            value={newListCardId}
            onChange={(e) => setNewListCardId(e.target.value)}
            options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))}
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsNewListOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Criar Lista</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit List */}
      <Modal isOpen={isEditListOpen} onClose={() => setIsEditListOpen(false)} title="Editar Lista de Compras">
        <form onSubmit={handleSaveEditList} className="space-y-4">
          <Input
            label="Título da Lista"
            value={editListTitle}
            onChange={(e) => setEditListTitle(e.target.value)}
            required
          />
          <Input
            label="Descrição (Opcional)"
            value={editListDesc}
            onChange={(e) => setEditListDesc(e.target.value)}
          />
          <Select
            label="Cartão de Benefício Preferencial"
            value={editListCardId}
            onChange={(e) => setEditListCardId(e.target.value)}
            options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))}
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsEditListOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Salvar Alterações</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Item */}
      <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title="Adicionar Item à Lista">
        <form onSubmit={handleAddItem} className="space-y-4">
          <Input
            label="Nome do Produto"
            placeholder="Ex: Arroz 5kg, Azeite, Leite"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantidade"
              type="number"
              min="1"
              value={itemQuantity}
              onChange={(e) => setItemQuantity(e.target.value)}
              required
            />
            <Input
              label="Preço Estimado (R$)"
              type="number"
              step="0.10"
              placeholder="0.00"
              value={itemEstPrice}
              onChange={(e) => setItemEstPrice(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddItemOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Adicionar Item</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Finalize Purchase (Supports Split Payment) */}
      <Modal isOpen={isFinalizeOpen} onClose={() => setIsFinalizeOpen(false)} title="Finalizar Compra no Mercado">
        <form onSubmit={handleFinalizePurchase} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Você está prestes a finalizar a compra <strong>"{activeList?.title}"</strong> no valor total de <strong className="text-emerald-600">{formatCurrency(totalInCart)}</strong>.
          </p>

          {/* Toggle Split Payment Option */}
          <div className="flex items-center gap-2 p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <input
              type="checkbox"
              id="split_payment"
              checked={isSplitPayment}
              onChange={(e) => setIsSplitPayment(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="split_payment" className="text-xs font-bold text-blue-900 dark:text-blue-200 select-none cursor-pointer">
              Dividir pagamento entre 2 cartões de benefício?
            </label>
          </div>

          {!isSplitPayment ? (
            /* Single Card Payment */
            <div className="space-y-3">
              <Select
                label="Selecione o Cartão para Debitar"
                value={selectedCardForPayment}
                onChange={(e) => setSelectedCardForPayment(e.target.value)}
                options={cards.map(c => ({ value: c.id, label: `${c.name} - Saldo: ${formatCurrency(c.balance)}` }))}
              />

              {selectedPaymentCard && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Saldo Atual:</span>
                    <span className="font-bold">{formatCurrency(selectedPaymentCard.balance)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Saldo Pós-Compra:</span>
                    <span className="font-bold">{formatCurrency(Math.max(0, selectedPaymentCard.balance - totalInCart))}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Split Payment between 2 Cards */
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">1º Cartão (Parte 1)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    value={card1Id}
                    onChange={(e) => setCard1Id(e.target.value)}
                    options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))}
                  />
                  <Input
                    label="Valor (R$)"
                    type="number"
                    step="0.01"
                    value={card1Amount}
                    onChange={(e) => handleCard1AmountChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-3">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">2º Cartão (Parte 2)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    value={card2Id}
                    onChange={(e) => setCard2Id(e.target.value)}
                    options={cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))}
                  />
                  <Input
                    label="Valor Restante (R$)"
                    type="number"
                    step="0.01"
                    value={card2Amount}
                    onChange={(e) => setCard2Amount(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsFinalizeOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Confirmar & Debitar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
