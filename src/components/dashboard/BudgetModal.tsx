'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { name: string; icon: string; color: string }[];
  currentBudgets: Record<string, number>;
  onSaveBudgets: (newBudgets: Record<string, number>) => void;
}

export function BudgetModal({
  isOpen,
  onClose,
  categories,
  currentBudgets,
  onSaveBudgets
}: BudgetModalProps) {
  const [formValues, setFormValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setFormValues({ ...currentBudgets });
    }
  }, [isOpen, currentBudgets]);

  const handleChange = (categoryName: string, val: string) => {
    const numeric = parseFloat(val.replace(',', '.')) || 0;
    setFormValues(prev => ({ ...prev, [categoryName]: numeric }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBudgets(formValues);
    onClose();
  };

  // Ensure default categories list is complete even if user hasn't created transactions in all of them yet
  const defaultExpenseCategories = [
    { name: 'Alimentação', icon: 'restaurant', color: '#f59e0b' },
    { name: 'Moradia', icon: 'home', color: '#8b5cf6' },
    { name: 'Transporte', icon: 'directions_car', color: '#3b82f6' },
    { name: 'Saúde', icon: 'health_and_safety', color: '#ef4444' },
    { name: 'Educação', icon: 'school', color: '#06b6d4' },
    { name: 'Lazer', icon: 'sports_esports', color: '#ec4899' },
    { name: 'Vestuário', icon: 'checkroom', color: '#f97316' },
    { name: 'Contas Fixas', icon: 'electric_bolt', color: '#dc2626' },
    { name: 'Assinaturas', icon: 'subscriptions', color: '#7c3aed' },
    { name: 'Outros (Despesa)', icon: 'more_horiz', color: '#6c7a71' }
  ];

  // Merge unique categories
  const categoryMap = new Map<string, { name: string; icon: string; color: string }>();
  defaultExpenseCategories.forEach(c => categoryMap.set(c.name, c));
  categories.forEach(c => {
    if (c.name) categoryMap.set(c.name, c);
  });
  const allCategories = Array.from(categoryMap.values());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Definir Limites de Gastos">
      <form onSubmit={handleSave} className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Configure os orçamentos teto mensais para cada categoria de despesa. As alterações serão salvas localmente.
        </p>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {allCategories.map(cat => {
            const val = formValues[cat.name] !== undefined ? formValues[cat.name] : (currentBudgets[cat.name] || 0);
            return (
              <div key={cat.name} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  >
                    <Icon name={cat.icon || 'category'} size="sm" />
                  </div>
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{cat.name}</span>
                </div>

                <div className="w-36">
                  <Input
                    type="number"
                    step="50"
                    min="0"
                    placeholder="R$ 0"
                    value={val === 0 ? '' : val}
                    onChange={(e) => handleChange(cat.name, e.target.value)}
                    className="text-right text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            Salvar Limites
          </Button>
        </div>
      </form>
    </Modal>
  );
}
