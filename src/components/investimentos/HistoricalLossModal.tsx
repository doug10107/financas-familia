'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';

interface HistoricalLossModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLosses: {
    swingTradeLoss: number;
    dayTradeLoss: number;
    fiisLoss: number;
    accumulatedIrrf: number;
  };
  onSaveLosses: (losses: {
    swingTradeLoss: number;
    dayTradeLoss: number;
    fiisLoss: number;
    accumulatedIrrf: number;
  }) => Promise<boolean>;
}

export function HistoricalLossModal({
  isOpen,
  onClose,
  currentLosses,
  onSaveLosses
}: HistoricalLossModalProps) {
  const [swingLoss, setSwingLoss] = useState(String(currentLosses.swingTradeLoss || ''));
  const [dayTradeLoss, setDayTradeLoss] = useState(String(currentLosses.dayTradeLoss || ''));
  const [fiisLoss, setFiisLoss] = useState(String(currentLosses.fiisLoss || ''));
  const [irrf, setIrrf] = useState(String(currentLosses.accumulatedIrrf || ''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSwingLoss(currentLosses.swingTradeLoss ? String(currentLosses.swingTradeLoss) : '');
      setDayTradeLoss(currentLosses.dayTradeLoss ? String(currentLosses.dayTradeLoss) : '');
      setFiisLoss(currentLosses.fiisLoss ? String(currentLosses.fiisLoss) : '');
      setIrrf(currentLosses.accumulatedIrrf ? String(currentLosses.accumulatedIrrf) : '');
      setErrorMessage(null);
    }
  }, [isOpen, currentLosses]);

  const parseNumber = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await onSaveLosses({
        swingTradeLoss: parseNumber(swingLoss),
        dayTradeLoss: parseNumber(dayTradeLoss),
        fiisLoss: parseNumber(fiisLoss),
        accumulatedIrrf: parseNumber(irrf)
      });

      if (ok) {
        onClose();
      } else {
        setErrorMessage('Erro ao salvar os prejuízos acumulados.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Prejuízos & IRRF de Meses/Anos Anteriores"
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Icon name="info" size="sm" />
            <span>Benefício Fiscal Legal da Receita Federal</span>
          </div>
          <p>
            Se você teve prejuízos em operações na bolsa antes de começar a usar este aplicativo, você tem direito garantido por lei de abater esses valores dos seus lucros futuros para <strong>não pagar DARF indevidamente</strong>.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            label="Prejuízo Acumulado em Ações (Operações Comuns / Swing Trade)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={swingLoss}
            onChange={(e) => setSwingLoss(e.target.value)}
            helperText="Abate lucros tributáveis de Ações, ETFs e BDRs normais."
          />

          <Input
            label="Prejuízo Acumulado em Day Trade"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={dayTradeLoss}
            onChange={(e) => setDayTradeLoss(e.target.value)}
            helperText="Pela regra da Receita, prejuízo de Day Trade só abate lucros de Day Trade."
          />

          <Input
            label="Prejuízo Acumulado em Fundos Imobiliários (FIIs / FIAGRO)"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={fiisLoss}
            onChange={(e) => setFiisLoss(e.target.value)}
            helperText="Prejuízo de FII só pode ser compensado com ganhos na venda de cotas de FIIs."
          />

          <Input
            label="Saldo de IRRF Retido na Fonte Acumulado ('Dedo-Duro')"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={irrf}
            onChange={(e) => setIrrf(e.target.value)}
            helperText="Valor já retido pelas corretoras na fonte a ser descontado da DARF."
          />
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-100 text-red-700 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSubmitting ? 'Salvando...' : 'Salvar Prejuízos'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
