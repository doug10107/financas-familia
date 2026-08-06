'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';

// Mock data for preview
const mockPreview = [
  { id: '1', date: '2026-08-01', description: 'UBER *TRIP', amount: 35.50, type: 'expense', status: 'pending' },
  { id: '2', date: '2026-08-02', description: 'IFOOD *DELIVERY', amount: 89.90, type: 'expense', status: 'pending' },
  { id: '3', date: '2026-08-05', description: 'PIX RECEBIDO JOAO', amount: 150.00, type: 'income', status: 'pending' },
];

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
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
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setFile(selectedFile);
    // Simulate parsing delay
    setTimeout(() => {
      setPreviewData(mockPreview);
    }, 1000);
  };

  const handleClear = () => {
    setFile(null);
    setPreviewData([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importar Dados</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Importe extratos OFX ou CSV do seu banco</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-1 h-fit">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Arquivo</h3>
          
          <Select 
            label="Conta Destino" 
            options={[
              {value: 'conta_corrente', label: 'Conta Corrente'}, 
              {value: 'cartao', label: 'Cartão de Crédito'}
            ]} 
            className="mb-4"
          />

          {!file ? (
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-trust-blue bg-blue-50 dark:bg-blue-900/10' 
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4 text-gray-500 dark:text-gray-400">
                <Icon name="upload" className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Arraste seu arquivo aqui
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Suporta .OFX, .CSV (Máx 5MB)
              </p>
              
              <div className="relative">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  accept=".ofx,.csv"
                  onChange={handleFileChange}
                />
                <Button variant="secondary" size="sm" className="w-full pointer-events-none">
                  Selecionar Arquivo
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
              <div className="flex items-center overflow-hidden">
                <Icon name="description" className="w-5 h-5 text-trust-blue mr-3 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button onClick={handleClear} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pré-visualização</h3>
            {previewData.length > 0 && (
              <Button variant="primary" size="sm">
                Salvar {previewData.length} Lançamentos
              </Button>
            )}
          </div>
          
          {previewData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 rounded-l-lg">Data</th>
                    <th scope="col" className="px-4 py-3">Descrição Original</th>
                    <th scope="col" className="px-4 py-3">Categoria Sugerida</th>
                    <th scope="col" className="px-4 py-3 text-right rounded-r-lg">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">
                        <Select 
                          options={[
                            {value: 'transporte', label: 'Transporte'}, 
                            {value: 'alimentacao', label: 'Alimentação'},
                            {value: 'outros', label: 'Outros'}
                          ]} 
                          defaultValue={item.description.includes('UBER') ? 'transporte' : item.description.includes('IFOOD') ? 'alimentacao' : 'outros'}
                        />
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${item.type === 'income' ? 'text-wealth-green dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {item.type === 'expense' ? '-' : '+'} {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12">
              <EmptyState 
                title={file ? "Analisando arquivo..." : "Nenhum dado para visualizar"} 
                description={file ? "Aguarde enquanto processamos os lançamentos." : "Selecione um arquivo OFX ou CSV para ver a pré-visualização das transações aqui."}
                icon={file ? "Loader" : "FileText"}
              />
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
