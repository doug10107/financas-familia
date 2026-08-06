'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

// Mock data
const mockGoals = [
  { id: '1', title: 'Reserva de Emergência', targetAmount: 30000, currentAmount: 15500, deadline: '2027-12-31', icon: 'Shield' },
  { id: '2', title: 'Viagem para Europa', targetAmount: 25000, currentAmount: 8000, deadline: '2028-06-15', icon: 'Plane' },
  { id: '3', title: 'Trocar de Carro', targetAmount: 50000, currentAmount: 5000, deadline: '2029-01-01', icon: 'Car' },
];

export default function GoalsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min(Math.round((current / target) * 100), 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Acompanhe seus objetivos financeiros</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Icon name="add" className="w-4 h-4 mr-2" /> 
          Nova Meta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockGoals.length > 0 ? (
          mockGoals.map(goal => {
            const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
            return (
              <GlassCard key={goal.id} className="p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-accent-purple/10 rounded-xl text-accent-purple">
                    <Icon name={goal.icon as any} className="w-6 h-6" />
                  </div>
                  <Badge color={progress >= 100 ? 'green' : 'blue'}>
                    {progress}%
                  </Badge>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{goal.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center">
                  <Icon name="calendar_month" className="w-3 h-3 mr-1" />
                  Até {new Intl.DateTimeFormat('pt-BR').format(new Date(goal.deadline))}
                </p>

                <div className="mt-auto">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(goal.currentAmount)}</span>
                    <span className="text-gray-500">{formatCurrency(goal.targetAmount)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-6">
                    <div className="bg-accent-purple h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 text-xs py-2" onClick={() => setIsContributionModalOpen(true)}>
                      <Icon name="add" className="w-3 h-3 mr-1" /> Aporte
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        ) : (
          <div className="col-span-full">
            <EmptyState 
              title="Nenhuma meta cadastrada" 
              description="Comece a planejar seu futuro criando sua primeira meta financeira." 
              icon="Target"
              actionLabel="Criar Meta"
              onAction={() => setIsModalOpen(true)}
            />
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Nova Meta"
      >
        <div className="space-y-4">
          <Input label="Título da Meta" placeholder="Ex: Reserva de Emergência" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Valor Objetivo (R$)" type="number" placeholder="0,00" />
            <Input label="Valor Atual (Opcional)" type="number" placeholder="0,00" />
          </div>
          <Input label="Data Limite" type="date" />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button variant="primary">Salvar Meta</Button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isContributionModalOpen} 
        onClose={() => setIsContributionModalOpen(false)} 
        title="Novo Aporte"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Adicione fundos à sua meta para acompanhar o progresso.</p>
          <Input label="Valor do Aporte (R$)" type="number" placeholder="0,00" />
          <Input label="Data" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsContributionModalOpen(false)}>Cancelar</Button>
            <Button variant="primary">Confirmar Aporte</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
