'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Doughnut } from 'react-chartjs-2';

// Mock data
const mockInvestments = [
  { id: '1', name: 'Tesouro Selic 2027', type: 'Renda Fixa', invested: 10000, current: 11200, yield: 12.0 },
  { id: '2', name: 'Fundo Imobiliário HGLG11', type: 'Renda Variável', invested: 5000, current: 5250, yield: 5.0 },
  { id: '3', name: 'CDB Banco Inter 110% CDI', type: 'Renda Fixa', invested: 8000, current: 8400, yield: 5.0 },
];

const portfolioData = {
  labels: ['Renda Fixa', 'Renda Variável'],
  datasets: [
    {
      data: [78.8, 21.2],
      backgroundColor: ['#0058be', '#10b981'],
      borderWidth: 0,
    }
  ]
};

export default function InvestmentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalInvested = mockInvestments.reduce((acc, curr) => acc + curr.invested, 0);
  const totalCurrent = mockInvestments.reduce((acc, curr) => acc + curr.current, 0);
  const totalYield = ((totalCurrent - totalInvested) / totalInvested) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investimentos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie seu portfólio</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Novo Investimento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Patrimônio Total</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</h2>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Valor Investido</p>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(totalInvested)}</h2>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Rendimento Global</p>
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-semibold ${totalYield >= 0 ? 'text-wealth-green' : 'text-red-500'}`}>
                  {totalYield >= 0 ? '+' : ''}{totalYield.toFixed(2)}%
                </h2>
                <Badge color={totalYield >= 0 ? 'green' : 'red'}>
                  {formatCurrency(totalCurrent - totalInvested)}
                </Badge>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Composição da Carteira</h3>
          <div className="h-32 relative">
            <Doughnut 
              data={portfolioData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
                },
                cutout: '75%'
              }} 
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Meus Ativos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th scope="col" className="px-4 py-3 rounded-l-lg">Ativo</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3 text-right">Investido</th>
                <th scope="col" className="px-4 py-3 text-right">Saldo Atual</th>
                <th scope="col" className="px-4 py-3 text-right rounded-r-lg">Rentabilidade</th>
              </tr>
            </thead>
            <tbody>
              {mockInvestments.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                    {inv.name}
                  </td>
                  <td className="px-4 py-4">
                    <Badge color={inv.type === 'Renda Fixa' ? 'blue' : 'yellow'}>{inv.type}</Badge>
                  </td>
                  <td className="px-4 py-4 text-right text-gray-500 dark:text-gray-400">
                    {formatCurrency(inv.invested)}
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(inv.current)}
                  </td>
                  <td className={`px-4 py-4 text-right font-semibold ${inv.yield >= 0 ? 'text-wealth-green dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {inv.yield >= 0 ? '+' : ''}{inv.yield.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Novo Investimento"
      >
        <div className="space-y-4">
          <Input label="Nome do Ativo" placeholder="Ex: Tesouro IPCA+ 2035" />
          <Select 
            label="Tipo de Investimento" 
            options={[
              {value: 'renda_fixa', label: 'Renda Fixa'}, 
              {value: 'renda_variavel', label: 'Renda Variável'},
              {value: 'cripto', label: 'Criptomoedas'}
            ]} 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Valor Inicial (R$)" type="number" placeholder="0,00" />
            <Input label="Data da Aplicação" type="date" />
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary">Adicionar Investimento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
