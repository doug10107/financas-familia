'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useInvestments } from '@/hooks/useInvestments';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function InvestmentsPage() {
  const {
    investments,
    types,
    loading,
    error: loadError,
    addInvestment,
    addInvestmentEntry
  } = useInvestments();

  // Modals state
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [invForm, setInvForm] = useState({
    name: '',
    type_id: '',
    institution: '',
    initial_amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [entryForm, setEntryForm] = useState({
    type: 'aporte' as 'aporte' | 'resgate' | 'rendimento',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Calculations
  const totalInvested = investments.reduce((acc, curr) => acc + Number(curr.total_invested), 0);
  const totalCurrent = investments.reduce((acc, curr) => acc + Number(curr.current_balance), 0);
  const totalYield = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  // Chart preparation
  const typeBalances: { [key: string]: number } = {};
  const typeColors: { [key: string]: string } = {};

  investments.forEach(inv => {
    const typeName = inv.investment_type?.name || 'Outros';
    const balance = Number(inv.current_balance) || 0;
    typeBalances[typeName] = (typeBalances[typeName] || 0) + balance;
    typeColors[typeName] = inv.investment_type?.color || '#cccccc';
  });

  const chartData = {
    labels: Object.keys(typeBalances),
    datasets: [
      {
        data: Object.values(typeBalances),
        backgroundColor: Object.values(typeColors),
        borderWidth: 0,
      }
    ]
  };

  const handleOpenInvModal = () => {
    setFormError('');
    setInvForm({
      name: '',
      type_id: types.length > 0 ? types[0].id : '',
      institution: '',
      initial_amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsInvModalOpen(true);
  };

  const handleOpenEntryModal = (investmentId: string) => {
    setFormError('');
    setSelectedInvId(investmentId);
    setEntryForm({
      type: 'aporte',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsEntryModalOpen(true);
  };

  const handleAddInvestment = async () => {
    if (!invForm.name || !invForm.type_id) {
      setFormError('Por favor, preencha o nome do ativo e selecione o tipo.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addInvestment({
      name: invForm.name,
      type_id: invForm.type_id,
      institution: invForm.institution,
      initial_amount: invForm.initial_amount ? parseFloat(invForm.initial_amount.replace(',', '.')) : 0,
      date: invForm.date,
      notes: invForm.notes
    });

    setIsSubmitting(false);
    if (success) {
      setIsInvModalOpen(false);
    } else {
      setFormError('Erro ao adicionar investimento. Tente novamente.');
    }
  };

  const handleAddEntry = async () => {
    if (!selectedInvId || !entryForm.amount) {
      setFormError('Por favor, preencha o valor da movimentação.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const success = await addInvestmentEntry({
      investment_id: selectedInvId,
      type: entryForm.type,
      amount: parseFloat(entryForm.amount.replace(',', '.')),
      date: entryForm.date,
      notes: entryForm.notes
    });

    setIsSubmitting(false);
    if (success) {
      setIsEntryModalOpen(false);
    } else {
      setFormError('Erro ao registrar movimentação. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investimentos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie seu portfólio de ativos</p>
        </div>
        <Button variant="primary" onClick={handleOpenInvModal}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Novo Investimento
        </Button>
      </div>

      {loadError && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 md:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 h-full flex items-center">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Patrimônio Atual</p>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCurrent)}</h2>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Valor Total Investido</p>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(totalInvested)}</h2>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Rendimento Global</p>
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-semibold ${totalCurrent >= totalInvested ? 'text-wealth-green' : 'text-red-500'}`}>
                  {totalCurrent >= totalInvested ? '+' : ''}{totalYield.toFixed(2)}%
                </h2>
                <Badge color={totalCurrent >= totalInvested ? 'green' : 'red'}>
                  {formatCurrency(totalCurrent - totalInvested)}
                </Badge>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Composição da Carteira</h3>
          {investments.length > 0 && totalCurrent > 0 ? (
            <div className="h-32 relative flex items-center justify-center">
              <Doughnut 
                data={chartData} 
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
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400 italic">
              Nenhum ativo com saldo para exibir no gráfico
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Meus Ativos</h3>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : investments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-lg">Ativo</th>
                  <th scope="col" className="px-4 py-3">Instituição</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3 text-right">Total Investido</th>
                  <th scope="col" className="px-4 py-3 text-right">Saldo Atual</th>
                  <th scope="col" className="px-4 py-3 text-right">Rendimento</th>
                  <th scope="col" className="px-4 py-3 text-center rounded-r-lg">Movimentar</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const invYield = inv.total_invested > 0 ? ((inv.current_balance - inv.total_invested) / inv.total_invested) * 100 : 0;
                  const isPositive = inv.current_balance >= inv.total_invested;
                  
                  return (
                    <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                        {inv.name}
                      </td>
                      <td className="px-4 py-4 text-gray-500 dark:text-gray-400">
                        {inv.institution || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: inv.investment_type?.color || '#0058be' }}
                        >
                          {inv.investment_type?.name || 'Outro'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatCurrency(inv.total_invested)}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(inv.current_balance)}
                      </td>
                      <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap ${isPositive ? 'text-wealth-green dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {isPositive ? '+' : ''}{invYield.toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => handleOpenEntryModal(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-[#adc6ff] transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Registrar Movimentação (Aporte, Resgate ou Rendimento)"
                        >
                          <Icon name="swap_horiz" size="sm" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12">
            <EmptyState 
              title="Nenhum investimento encontrado" 
              description="Cadastre seus ativos para começar a monitorar a rentabilidade da sua carteira." 
              icon="account_balance"
            />
          </div>
        )}
      </GlassCard>

      {/* Modal - Novo Investimento */}
      <Modal 
        isOpen={isInvModalOpen} 
        onClose={() => !isSubmitting && setIsInvModalOpen(false)} 
        title="Novo Investimento"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Input 
            label="Nome do Ativo" 
            placeholder="Ex: Tesouro IPCA+ 2035, CDB Banco X" 
            value={invForm.name}
            onChange={(e) => setInvForm({...invForm, name: e.target.value})}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo de Investimento" 
              value={invForm.type_id}
              onChange={(e) => setInvForm({...invForm, type_id: e.target.value})}
              options={types.map(t => ({ value: t.id, label: t.name }))}
            />
            <Input 
              label="Instituição Financeira" 
              placeholder="Ex: XP, Inter, NuInvest" 
              value={invForm.institution}
              onChange={(e) => setInvForm({...invForm, institution: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Aporte Inicial (R$)" 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={invForm.initial_amount}
              onChange={(e) => setInvForm({...invForm, initial_amount: e.target.value})}
            />
            <Input 
              label="Data da Aplicação" 
              type="date" 
              value={invForm.date}
              onChange={(e) => setInvForm({...invForm, date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Alguma nota importante sobre este ativo" 
            value={invForm.notes}
            onChange={(e) => setInvForm({...invForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsInvModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddInvestment} loading={isSubmitting}>Adicionar Investimento</Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Registrar Movimentação */}
      <Modal 
        isOpen={isEntryModalOpen} 
        onClose={() => !isSubmitting && setIsEntryModalOpen(false)} 
        title="Registrar Movimentação"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <Select 
            label="Tipo de Operação" 
            value={entryForm.type}
            onChange={(e) => setEntryForm({...entryForm, type: e.target.value as any})}
            options={[
              { value: 'aporte', label: 'Aporte (Comprar mais)' },
              { value: 'resgate', label: 'Resgate (Vender / Retirar)' },
              { value: 'rendimento', label: 'Rendimento (Juros / Dividendos)' }
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Valor (R$)" 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={entryForm.amount}
              onChange={(e) => setEntryForm({...entryForm, amount: e.target.value})}
            />
            <Input 
              label="Data da Operação" 
              type="date" 
              value={entryForm.date}
              onChange={(e) => setEntryForm({...entryForm, date: e.target.value})}
            />
          </div>

          <Input 
            label="Observações" 
            placeholder="Ex: Dividendos recebidos, Aporte mensal" 
            value={entryForm.notes}
            onChange={(e) => setEntryForm({...entryForm, notes: e.target.value})}
          />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsEntryModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleAddEntry} loading={isSubmitting}>Salvar Movimentação</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
