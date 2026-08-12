'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { useTransactions } from '@/hooks/useTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { createClient } from '@/lib/supabase/client';
import {
  ExtractedItem,
  parseOFXText,
  parseCSVText,
  parsePDFFile,
  detectDuplicates
} from '@/lib/importers/fileParser';

export default function ImportPage() {
  const { transactions: existingTransactions, categories, refreshData: refreshTransactions } = useTransactions();
  const { creditCards } = useCreditCards();
  const supabase = createClient();

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('conta_corrente');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const fileName = selectedFile.name.toLowerCase();

    try {
      let rawItems: ExtractedItem[] = [];

      if (fileName.endsWith('.ofx')) {
        const text = await selectedFile.text();
        rawItems = parseOFXText(text, categories);
      } else if (fileName.endsWith('.csv')) {
        const text = await selectedFile.text();
        rawItems = parseCSVText(text, categories);
      } else if (fileName.endsWith('.pdf')) {
        rawItems = await parsePDFFile(selectedFile, categories);
      } else {
        throw new Error('Formato não suportado. Utilize arquivos .OFX, .CSV ou .PDF');
      }

      // Check duplicates against existing transactions
      const processed = detectDuplicates(rawItems, existingTransactions);
      setPreviewData(processed);
    } catch (err: any) {
      console.error('Error parsing file:', err);
      setErrorMessage(err.message || 'Erro ao ler o arquivo. Verifique o formato.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData([]);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Toggle single item
  const handleToggleSelect = (id: string) => {
    setPreviewData(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  // Toggle all items
  const handleToggleSelectAll = () => {
    const allSelected = previewData.every(item => item.selected);
    setPreviewData(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  // Remove single item from list
  const handleRemoveItem = (id: string) => {
    setPreviewData(prev => prev.filter(item => item.id !== id));
  };

  // Change category for single item
  const handleCategoryChange = (id: string, categoryId: string) => {
    setPreviewData(prev => prev.map(item => item.id === id ? { ...item, suggestedCategoryId: categoryId } : item));
  };

  // Batch save selected transactions
  const handleSaveImport = async () => {
    const selectedItems = previewData.filter(item => item.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Nenhum lançamento selecionado para importar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as any;

      if (!profile) throw new Error('Perfil não encontrado');

      const isCreditCardTarget = selectedAccount !== 'conta_corrente';
      const creditCardId = isCreditCardTarget ? selectedAccount : null;

      const payload = selectedItems.map(item => ({
        family_id: profile.family_id,
        user_id: user.id,
        type: item.type,
        description: item.description,
        amount: item.amount,
        date: item.date,
        status: isCreditCardTarget ? 'pendente' : 'pago',
        category_id: item.suggestedCategoryId || null,
        credit_card_id: creditCardId
      }));

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(payload as any);

      if (insertError) throw insertError;

      const totalValue = selectedItems.reduce((acc, curr) => acc + curr.amount, 0);

      setSuccessMessage(`${selectedItems.length} lançamentos importados com sucesso! Total: ${formatCurrency(totalValue)}`);
      await refreshTransactions();
      
      // Clear file after successful save
      setFile(null);
      setPreviewData([]);
    } catch (err: any) {
      console.error('Error saving imported transactions:', err);
      setErrorMessage(err.message || 'Erro ao salvar os lançamentos no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = previewData.filter(i => i.selected).length;
  const selectedTotal = previewData.filter(i => i.selected).reduce((acc, curr) => acc + (curr.type === 'receita' ? curr.amount : -curr.amount), 0);

  const accountOptions = [
    { value: 'conta_corrente', label: 'Conta Corrente / Carteira' },
    ...creditCards.map(card => ({ value: card.id, label: `Cartão de Crédito - ${card.name}` }))
  ];

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importar Extratos & Faturas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Importe arquivos em .PDF, .OFX ou .CSV com pré-visualização e seleção inteligente
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="check_circle" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="error" className="w-5 h-5 text-red-600 dark:text-red-400" />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-1 h-fit space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conta ou Cartão Destino</h3>

          <Select
            label="Destino das Transações"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            options={accountOptions}
          />

          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full w-fit mx-auto mb-4">
                <Icon name="upload_file" className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Arraste seu extrato ou fatura aqui
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Suporta arquivos .PDF, .OFX ou .CSV (Faturas e Extratos)
              </p>

              <div className="relative inline-block w-full">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".ofx,.csv,.pdf"
                  onChange={handleFileChange}
                />
                <Button variant="secondary" size="sm" className="w-full pointer-events-none">
                  Selecionar Arquivo
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/40">
              <div className="flex items-center overflow-hidden">
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg mr-3 shrink-0">
                  <Icon name="description" className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Remover arquivo"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pré-visualização dos Lançamentos</h3>
              {previewData.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Selecione ou remova itens antes de confirmar
                </p>
              )}
            </div>

            {previewData.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveImport}
                loading={isSaving}
                disabled={selectedCount === 0}
              >
                Importar {selectedCount} {selectedCount === 1 ? 'Lançamento' : 'Lançamentos'}
              </Button>
            )}
          </div>

          {isParsing ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lendo e categorizando lançamentos do arquivo...</p>
            </div>
          ) : previewData.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex flex-wrap justify-between items-center bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl text-xs font-semibold">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={previewData.every(i => i.selected)}
                      onChange={handleToggleSelectAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Marcar Todos</span>
                  </label>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {selectedCount} de {previewData.length} selecionados
                  </span>
                </div>

                <div className="text-gray-900 dark:text-white font-bold">
                  Balanço Selecionado: <span className={selectedTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{formatCurrency(selectedTotal)}</span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-3 py-3 w-10 text-center">Importar</th>
                      <th scope="col" className="px-3 py-3">Data</th>
                      <th scope="col" className="px-3 py-3">Descrição Extraída</th>
                      <th scope="col" className="px-3 py-3">Categoria Sugerida</th>
                      <th scope="col" className="px-3 py-3 text-right">Valor</th>
                      <th scope="col" className="px-3 py-3 text-center w-12">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {previewData.map((item) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          !item.selected ? 'opacity-50 bg-gray-50/50 dark:bg-gray-900/20' : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {formatDate(item.date)}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.description}</span>
                            {item.isDuplicate && (
                              <Badge color="yellow" className="text-[10px] px-1.5 py-0 inline-flex items-center gap-0.5">
                                <Icon name="warning" className="w-3 h-3" /> Duplicado?
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 w-48">
                          <Select
                            value={item.suggestedCategoryId || ''}
                            onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                            options={categoryOptions}
                          />
                        </td>
                        <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${item.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                          {item.type === 'receita' ? '+' : '-'} {formatCurrency(item.amount)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Remover este lançamento"
                          >
                            <Icon name="delete" size="sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16">
              <EmptyState
                title={file ? "Nenhum lançamento válido encontrado" : "Nenhum arquivo carregado"}
                description={
                  file
                    ? "O arquivo selecionado não contém lançamentos legíveis. Tente outro extrato .PDF, .OFX ou .CSV."
                    : "Arraste ou escolha um relatório em .PDF, .OFX ou .CSV para visualizar as transações antes de confirmar."
                }
                icon={file ? "error_outline" : "file_upload"}
              />
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
