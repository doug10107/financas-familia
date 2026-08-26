'use client';

import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { BenefitCard } from '@/hooks/useBenefitCards';
import { ShoppingList, ShoppingItem } from '@/hooks/useShoppingLists';

interface ExtractedAIItem {
  tempId: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  category: string;
  selected: boolean;
}

interface ImportShoppingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: BenefitCard[];
  lists: ShoppingList[];
  activeListId: string | null;
  onImportToExistingList: (listId: string, items: Omit<ShoppingItem, 'id' | 'isChecked'>[]) => Promise<any>;
  onCreateNewListWithItems: (title: string, description: string, benefitCardId?: string, items?: Omit<ShoppingItem, 'id' | 'isChecked'>[]) => Promise<any>;
}

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

export function ImportShoppingListModal({
  isOpen,
  onClose,
  cards,
  lists,
  activeListId,
  onImportToExistingList,
  onCreateNewListWithItems
}: ImportShoppingListModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review step state
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [extractedItems, setExtractedItems] = useState<ExtractedAIItem[]>([]);

  // Destination options
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new');
  const [newListTitle, setNewListTitle] = useState('Compras de Mercado');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListCardId, setNewListCardId] = useState(cards[0]?.id || '');
  const [targetExistingListId, setTargetExistingListId] = useState(activeListId || lists[0]?.id || '');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setFile(null);
    setFilePreview(null);
    setRawText('');
    setIsProcessing(false);
    setErrorMessage(null);
    setStep('input');
    setExtractedItems([]);
    setDestinationMode(lists.length > 0 ? 'existing' : 'new');
    setNewListTitle('Compras de Mercado');
    setNewListDesc('');
    if (cards.length > 0) setNewListCardId(cards[0].id);
    if (activeListId) setTargetExistingListId(activeListId);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setErrorMessage(null);

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFilePreview(event.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleProcessAI = async () => {
    setErrorMessage(null);

    if (activeTab === 'upload' && !file) {
      setErrorMessage('Por favor, selecione uma foto, imagem ou arquivo PDF da lista.');
      return;
    }

    if (activeTab === 'text' && !rawText.trim()) {
      setErrorMessage('Por favor, digite ou cole o texto da lista de compras.');
      return;
    }

    setIsProcessing(true);

    try {
      let response: Response;

      if (activeTab === 'upload' && file) {
        const formData = new FormData();
        formData.append('file', file);

        response = await fetch('/api/ai/scan-list', {
          method: 'POST',
          body: formData
        });
      } else {
        response = await fetch('/api/ai/scan-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawText })
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar a lista com IA.');
      }

      if (!data.items || data.items.length === 0) {
        throw new Error('Nenhum item foi identificado. Tente enviar uma foto mais nítida ou digitar a lista.');
      }

      const formatted: ExtractedAIItem[] = data.items.map((item: any, idx: number) => ({
        tempId: `item-${Date.now()}-${idx}`,
        name: item.name || `Produto ${idx + 1}`,
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unit: item.unit || 'un',
        estimatedPrice: Number(item.estimatedPrice) >= 0 ? Number(item.estimatedPrice) : 0,
        category: item.category || 'Alimentação',
        selected: true
      }));

      setExtractedItems(formatted);
      setStep('review');
    } catch (err: any) {
      console.error('Erro na extração IA:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao comunicar com a IA.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemFieldChange = (tempId: string, field: keyof ExtractedAIItem, value: any) => {
    setExtractedItems(prev =>
      prev.map(i => (i.tempId === tempId ? { ...i, [field]: value } : i))
    );
  };

  const handleToggleSelectItem = (tempId: string) => {
    setExtractedItems(prev =>
      prev.map(i => (i.tempId === tempId ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = extractedItems.every(i => i.selected);
    setExtractedItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
  };

  const handleDeleteItem = (tempId: string) => {
    setExtractedItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleSaveToShoppingList = async () => {
    const selectedItems = extractedItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Selecione ao menos 1 item para importar.');
      return;
    }

    const payloadItems = selectedItems.map(i => ({
      name: i.name.trim(),
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      unit: i.unit || 'un',
      category: i.category || 'Alimentação',
      estimatedPrice: Number(i.estimatedPrice) >= 0 ? Number(i.estimatedPrice) : 0,
      actualPrice: Number(i.estimatedPrice) >= 0 ? Number(i.estimatedPrice) : 0
    }));

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (destinationMode === 'new') {
        await onCreateNewListWithItems(
          newListTitle || 'Compras de Mercado',
          newListDesc,
          newListCardId || undefined,
          payloadItems
        );
      } else {
        const targetId = targetExistingListId || (lists.length > 0 ? lists[0].id : null);
        if (!targetId) {
          throw new Error('Nenhuma lista de compras selecionada.');
        }
        await onImportToExistingList(targetId, payloadItems);
      }

      handleClose();
    } catch (err: any) {
      console.error('Erro ao salvar itens na lista:', err);
      setErrorMessage(err.message || 'Erro ao salvar itens.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;
  const totalEstimated = extractedItems
    .filter(i => i.selected)
    .reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'input' ? 'Importar Lista com Inteligência Artificial' : 'Conferir Itens Extraídos pela IA'}
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <Icon name="error" size="sm" className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* STEP 1: INPUT METHOD (PHOTO / FILE / TEXT) */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* Tab navigation */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'upload'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon name="photo_camera" size="sm" /> Foto ou PDF
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
                <Icon name="notes" size="sm" /> Colar Texto
              </button>
            </div>

            {/* TAB: UPLOAD PHOTO / PDF */}
            {activeTab === 'upload' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-800/30 group"
                >
                  {file ? (
                    <div className="space-y-3">
                      {filePreview ? (
                        <div className="relative max-h-48 mx-auto overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 inline-block shadow-sm">
                          <img
                            src={filePreview}
                            alt="Pré-visualização"
                            className="max-h-48 object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
                          <Icon name="picture_as_pdf" size="lg" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{file.name}</p>
                        <p className="text-[11px] text-gray-500">{(file.size / 1024).toFixed(1)} KB • Clique para trocar de arquivo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Icon name="add_a_photo" size="md" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          Tirar Foto ou Escolher Arquivo
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Foto da lista de papel, cupom do mercado ou PDF
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                  <Icon name="auto_awesome" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                    <strong>Dica IA:</strong> A IA identifica automaticamente quantidades, preços unitários (Vl.Un), itens por peso (kg) e valores totais da sua compra.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: TEXT INPUT */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Cole sua lista em texto:
                  </label>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Exemplo:&#10;2 Arroz 5kg R$ 32,00&#10;0.378 kg Buffet a Peso R$ 86,00&#10;1 un Coca-Cola Zero R$ 7,00&#10;4 un Detergente R$ 3,50"
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Pode colar mensagens do WhatsApp, anotações rápidas ou listas geradas por IA.
                </p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleProcessAI}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" size="sm" /> Analisar & Extrair Itens
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & EDIT EXTRACTED ITEMS */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Header / Summary Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Icon name="select_all" size="sm" />
                  {selectedCount === extractedItems.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
                <Badge color="blue" className="text-[11px]">
                  {selectedCount} de {extractedItems.length} selecionados
                </Badge>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Total da Compra</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalEstimated)}
                </span>
              </div>
            </div>

            {/* Items List (Editable table/cards) */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {extractedItems.map((item) => {
                const subtotal = item.quantity * item.estimatedPrice;

                return (
                  <div
                    key={item.tempId}
                    className={`p-3 rounded-xl border transition-all ${
                      item.selected
                        ? 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-sm'
                        : 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => handleToggleSelectItem(item.tempId)}
                        className="mt-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        {/* Name */}
                        <div className="sm:col-span-4">
                          <Input
                            placeholder="Nome do Produto"
                            value={item.name}
                            onChange={(e) => handleItemFieldChange(item.tempId, 'name', e.target.value)}
                            className="text-xs py-1.5 font-medium"
                          />
                        </div>

                        {/* Quantity & Unit (supports kg, g, un, etc) */}
                        <div className="sm:col-span-3 flex gap-1 items-center">
                          <div className="w-16">
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              placeholder="Qtd"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  item.tempId,
                                  'quantity',
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              className="text-xs py-1.5 text-center"
                            />
                          </div>
                          <div className="flex-1 min-w-[70px]">
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemFieldChange(item.tempId, 'unit', e.target.value)}
                              className="w-full text-xs py-1.5 px-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                              {UNIT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Unit Price (Vl.Un) */}
                        <div className="sm:col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="R$ Unit"
                            value={item.estimatedPrice || ''}
                            onChange={(e) =>
                              handleItemFieldChange(
                                item.tempId,
                                'estimatedPrice',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-xs py-1.5 text-right"
                          />
                        </div>

                        {/* Line Subtotal */}
                        <div className="sm:col-span-2 text-right pr-1">
                          <span className="text-[10px] text-gray-400 block font-medium">Subtotal</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>

                        {/* Delete */}
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.tempId)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                          >
                            <Icon name="delete" size="sm" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Destination Configuration */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <label className="block text-xs font-bold text-gray-800 dark:text-gray-200">
                Onde deseja salvar estes itens?
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestinationMode('new')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    destinationMode === 'new'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon name="add" size="sm" /> Criar Nova Lista
                </button>

                <button
                  type="button"
                  disabled={lists.length === 0}
                  onClick={() => setDestinationMode('existing')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    destinationMode === 'existing'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon name="playlist_add" size="sm" /> Adicionar à Existente
                </button>
              </div>

              {destinationMode === 'new' ? (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                  <Input
                    label="Título da Lista"
                    placeholder="Ex: Restaurante 14 Bis, Supermercado"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    required
                  />
                  <Select
                    label="Cartão de Benefício Preferencial (VA/VR)"
                    value={newListCardId}
                    onChange={(e) => setNewListCardId(e.target.value)}
                    options={[
                      { value: '', label: 'Nenhum (selecionar no caixa)' },
                      ...cards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))
                    ]}
                  />
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl">
                  <Select
                    label="Selecione a Lista de Destino"
                    value={targetExistingListId}
                    onChange={(e) => setTargetExistingListId(e.target.value)}
                    options={lists.map(l => ({ value: l.id, label: l.title }))}
                  />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('input')}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                <Icon name="arrow_back" size="sm" /> Voltar
              </Button>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveToShoppingList}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size="sm" /> Importar ({formatCurrency(totalEstimated)})
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
