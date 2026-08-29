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
import { ImportShoppingListModal } from '@/components/compras/ImportShoppingListModal';

const UNIT_OPTIONS = [
  { value: 'un', label: 'un (unidade)' },
  { value: 'kg', label: 'kg (quilo)' },
  { value: 'g', label: 'g (gramas)' },
  { value: 'L', label: 'L (litros)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'pct', label: 'pct (pacote)' },
  { value: 'cx', label: 'cx (caixa)' },
  { value: 'dz', label: 'dz (dúzia)' }
];

const CATEGORY_OPTIONS = [
  { value: 'Alimentação', label: 'Alimentação' },
  { value: 'Hortifruti', label: 'Hortifruti' },
  { value: 'Açougue', label: 'Açougue' },
  { value: 'Padaria', label: 'Padaria' },
  { value: 'Bebidas', label: 'Bebidas' },
  { value: 'Limpeza', label: 'Limpeza' },
  { value: 'Higiene', label: 'Higiene' },
  { value: 'Outros', label: 'Outros' }
];

export default function ComprasPage() {
  const {
    lists,
    createList,
    createListWithItems,
    updateList,
    addItem,
    addMultipleItems,
    moveItem,
    reorderListByAisle,
    toggleItem,
    updateItemPrice,
    deleteItem,
    deleteList,
    completeList,
    reuseList
  } = useShoppingLists();

  const { cards, debitBalance } = useBenefitCards();

  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Synchronize activeListId with lists
  React.useEffect(() => {
    if (lists.length > 0) {
      if (!activeListId || !lists.some(l => l.id === activeListId)) {
        setActiveListId(lists[0].id);
      }
    }
  }, [lists, activeListId]);
  
  // Modals
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [isImportAiOpen, setIsImportAiOpen] = useState(false);

  // New List Form State
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCardId, setNewListCardId] = useState('');

  // Edit List Form State
  const [editListTitle, setEditListTitle] = useState('');
  const [editListDesc, setEditListDesc] = useState('');
  const [editListCardId, setEditListCardId] = useState('');

  // New Item Form State
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Alimentação');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnit, setItemUnit] = useState('un');
  const [itemEstPrice, setItemEstPrice] = useState('');

  // Finalize Form State (Single & Split Payment)
  const [selectedCardForPayment, setSelectedCardForPayment] = useState('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  
  const [card1Id, setCard1Id] = useState('');
  const [card1Amount, setCard1Amount] = useState('');
  const [card2Id, setCard2Id] = useState('');
  const [card2Amount, setCard2Amount] = useState('');

  React.useEffect(() => {
    if (cards.length > 0) {
      if (!newListCardId) setNewListCardId(cards[0].id);
      if (!card1Id) setCard1Id(cards[0].id);
      if (!card2Id) setCard2Id(cards[1]?.id || cards[0].id);
      if (!selectedCardForPayment) setSelectedCardForPayment(cards[0].id);
    }
  }, [cards]);

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

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle) return;
    const newId = await createList(newListTitle, newListDesc, newListCardId || undefined);
    if (newId) setActiveListId(newId);
    setNewListTitle('');
    setNewListDesc('');
    setIsNewListOpen(false);
  };

  const handleOpenEditList = () => {
    if (!activeList) return;
    setEditListTitle(activeList.title);
    setEditListDesc(activeList.description || '');
    setEditListCardId(activeList.benefitCardId || (cards.length > 0 ? cards[0].id : ''));
    setIsEditListOpen(true);
  };

  const handleSaveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !editListTitle) return;

    await updateList(activeList.id, {
      title: editListTitle,
      description: editListDesc,
      benefitCardId: editListCardId || undefined
    });

    setIsEditListOpen(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !itemName) return;

    const qty = parseFloat(itemQuantity.replace(',', '.')) || 1;
    const est = parseFloat(itemEstPrice.replace(',', '.')) || 0;

    addItem(activeList.id, {
      name: itemName,
      category: itemCategory,
      quantity: qty,
      unit: itemUnit || 'un',
      estimatedPrice: est,
      actualPrice: est
    });

    setItemName('');
    setItemQuantity('1');
    setItemUnit('un');
    setItemEstPrice('');
    setIsAddItemOpen(false);
  };

  const handleOpenFinalizeModal = () => {
    if (!activeList) return;
    const defaultCardId = activeList.benefitCardId || (cards.length > 0 ? cards[0].id : '');
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

    const checkedItems = activeList.items.filter(i => i.isChecked);
    const itemsToSave = (checkedItems.length > 0 ? checkedItems : activeList.items).map(item => ({
      name: `${item.name}${item.unit && item.unit !== 'un' ? ` (${item.quantity} ${item.unit})` : ''}`,
      quantity: Number(item.quantity) || 1,
      price: Number(item.actualPrice) > 0 ? Number(item.actualPrice) : Number(item.estimatedPrice)
    }));

    if (totalInCart > 0) {
      if (isSplitPayment) {
        const amt1 = parseFloat(card1Amount.replace(',', '.')) || 0;
        const amt2 = parseFloat(card2Amount.replace(',', '.')) || 0;

        if (amt1 > 0 && card1) {
          debitBalance(card1.id, amt1, `Compra (Parte 1/2): ${activeList.title}`, 'Alimentação', itemsToSave);
        }
        if (amt2 > 0 && card2) {
          debitBalance(card2.id, amt2, `Compra (Parte 2/2): ${activeList.title}`, 'Alimentação', itemsToSave);
        }
      } else {
        if (selectedPaymentCard) {
          debitBalance(selectedPaymentCard.id, totalInCart, `Compra: ${activeList.title}`, 'Alimentação', itemsToSave);
        }
      }
    }

    completeList(activeList.id);
    setIsFinalizeOpen(false);
  };

  const handleReuseList = async (listId: string) => {
    const newId = await reuseList(listId);
    if (newId) setActiveListId(newId);
  };

  const cardSelectOptions = [
    { value: '', label: 'Nenhum (ou selecionar depois)' },
    ...cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="shopping_cart" className="text-blue-500" /> Lista de Compras Inteligente
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Monte suas listas com IA, acompanhe preços no mercado e deduza do seu VA/VR com 1 clique
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Import Button */}
          <Button
            variant="secondary"
            onClick={() => setIsImportAiOpen(true)}
            className="flex items-center gap-1.5 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-sm"
          >
            <Icon name="auto_awesome" size="sm" className="text-blue-500" />
            <span>Importar com IA</span>
          </Button>

          {/* New List Button */}
          <Button
            variant="primary"
            onClick={() => setIsNewListOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Icon name="add" size="sm" /> Criar Nova Lista
          </Button>
        </div>
      </div>

      {/* Main Content Layout: Sidebar Lists + Active List Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: All Shopping Lists */}
        <GlassCard className="p-6 space-y-4 lg:col-span-1">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Icon name="format_list_bulleted" size="sm" /> Suas Listas
            </h3>
            <span className="text-xs font-semibold text-gray-400">
              {lists.length} {lists.length === 1 ? 'lista' : 'listas'}
            </span>
          </div>

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
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {card?.name || 'Vale'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReuseList(list.id);
                          }}
                          className="p-1 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Reutilizar esta lista (criar cópia)"
                        >
                          <Icon name="replay" size="sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-gray-400 italic space-y-2">
                <p>Nenhuma lista de compras criada.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsImportAiOpen(true)}
                  className="text-xs text-blue-600"
                >
                  <Icon name="auto_awesome" size="sm" /> Importar com Foto ou Texto
                </Button>
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleReuseList(activeList.id)}
                    className="text-xs font-semibold flex items-center gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Icon name="replay" size="sm" /> Reutilizar Lista
                  </Button>

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
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => reorderListByAisle(activeList.id)}
                        className="text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                        title="Organizar itens automaticamente pela sequência dos corredores (Hortifruti -> Padaria -> Açougue -> etc)"
                      >
                        <Icon name="sort" size="sm" /> Corredores
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsImportAiOpen(true)}
                        className="text-xs font-semibold flex items-center gap-1 text-blue-600 dark:text-blue-400"
                      >
                        <Icon name="auto_awesome" size="sm" /> IA
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAddItemOpen(true)}
                        className="text-xs font-semibold flex items-center gap-1"
                      >
                        <Icon name="add" size="sm" /> Adicionar Item
                      </Button>
                    </>
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
                  activeList.items.map((item, index) => {
                    const currentPrice = Number(item.actualPrice) > 0 ? Number(item.actualPrice) : Number(item.estimatedPrice);
                    const itemSubtotal = item.quantity * currentPrice;

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-xl transition-colors border ${
                          item.isChecked
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 opacity-90'
                            : 'bg-gray-50/60 dark:bg-gray-800/40 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2">
                          {/* Reorder Buttons (Up / Down) */}
                          {!activeList.isCompleted && (
                            <div className="flex flex-col items-center justify-center -my-1 -ml-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveItem(activeList.id, item.id, 'up');
                                }}
                                disabled={index === 0}
                                className="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:hover:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                title="Subir item (corredor anterior)"
                              >
                                <Icon name="keyboard_arrow_up" size="sm" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveItem(activeList.id, item.id, 'down');
                                }}
                                disabled={index === activeList.items.length - 1}
                                className="p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-20 disabled:hover:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                title="Descer item (próximo corredor)"
                              >
                                <Icon name="keyboard_arrow_down" size="sm" />
                              </button>
                            </div>
                          )}

                          <input
                            type="checkbox"
                            checked={item.isChecked}
                            onChange={() => toggleItem(activeList.id, item.id)}
                            className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm truncate ${item.isChecked ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                              {item.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                {item.quantity} {item.unit || 'un'}
                              </span>
                              <span>•</span>
                              <span>{formatCurrency(currentPrice)}/{item.unit || 'un'}</span>
                              {item.quantity !== 1 && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    Subtotal: {formatCurrency(itemSubtotal)}
                                  </span>
                                </>
                              )}
                              {item.category && item.category !== 'Alimentação' && (
                                <>
                                  <span>•</span>
                                  <span className="text-[10px] text-blue-500 dark:text-blue-400">{item.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actual Unit Price Input & Subtotal */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="w-24">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="R$/un"
                                value={item.actualPrice || ''}
                                onChange={(e) => updateItemPrice(activeList.id, item.id, parseFloat(e.target.value) || 0)}
                                className="text-right text-xs py-1"
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">
                              = {formatCurrency(itemSubtotal)}
                            </span>
                          </div>

                          <button
                            onClick={() => deleteItem(activeList.id, item.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Icon name="close" size="sm" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-gray-400 italic space-y-2">
                    <p>Nenhum item adicionado a esta lista.</p>
                    <div className="flex justify-center gap-2 pt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsImportAiOpen(true)}
                        className="text-xs text-blue-600 flex items-center gap-1"
                      >
                        <Icon name="auto_awesome" size="sm" /> Importar com IA
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsAddItemOpen(true)}
                        className="text-xs flex items-center gap-1"
                      >
                        <Icon name="add" size="sm" /> Adicionar Manual
                      </Button>
                    </div>
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
            options={cardSelectOptions}
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
            options={cardSelectOptions}
          />
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsEditListOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Salvar Alterações</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Item (Supports kg, g, un, etc and decimals) */}
      <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title="Adicionar Item à Lista">
        <form onSubmit={handleAddItem} className="space-y-4">
          <Input
            label="Nome do Produto"
            placeholder="Ex: Alcatra Bife, Banana Prata, Leite"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Categoria"
              value={itemCategory}
              onChange={(e) => setItemCategory(e.target.value)}
              options={CATEGORY_OPTIONS}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Quantidade"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                required
              />
              <Select
                label="Unidade"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                options={UNIT_OPTIONS}
              />
            </div>
          </div>

          <Input
            label="Preço Unitário (R$)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={itemEstPrice}
            onChange={(e) => setItemEstPrice(e.target.value)}
          />

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

      {/* Modal: AI Import */}
      <ImportShoppingListModal
        isOpen={isImportAiOpen}
        onClose={() => setIsImportAiOpen(false)}
        cards={cards}
        lists={lists}
        activeListId={activeListId}
        onImportToExistingList={async (listId, items) => {
          await addMultipleItems(listId, items);
          setActiveListId(listId);
        }}
        onCreateNewListWithItems={async (title, description, benefitCardId, items) => {
          const newId = await createListWithItems(title, description, benefitCardId, items);
          if (newId) setActiveListId(newId);
        }}
      />
    </div>
  );
}
