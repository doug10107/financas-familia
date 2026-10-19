'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { MonthlyTaxSettlement } from '@/lib/tax/taxEngine';

interface DarfSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlement: MonthlyTaxSettlement | null;
  contributorName?: string;
  contributorCpf?: string;
}

export function DarfSlipModal({
  isOpen,
  onClose,
  settlement,
  contributorName = 'Titular da Conta íon / B3',
  contributorCpf = '000.000.000-00'
}: DarfSlipModalProps) {
  if (!settlement) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleCopyPaymentInfo = () => {
    const textToCopy = `PAGAMENTO DARF - RECEITA FEDERAL
Código da Receita: 6015
Período de Apuração: ${settlement.periodMonthYear}
Vencimento: ${formatDate(settlement.dueDate)}
Valor Principal: ${formatCurrency(settlement.finalDarfToPay)}
Valor Total a Pagar: ${formatCurrency(settlement.finalDarfToPay)}`;

    navigator.clipboard.writeText(textToCopy);
    alert('Dados do DARF copiados para a área de transferência! Você pode colar no app do seu banco.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Guia Oficial de Recolhimento - DARF (Código 6015)"
      size="lg"
    >
      <div className="space-y-5">
        {/* Banner instrução */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="verified" size="sm" className="text-emerald-600" />
            <span>
              Pague via Internet Banking ou App do <strong>Itaú / íon</strong> na opção <strong>"Pagamentos &gt; DARF Comum (sem código de barras)"</strong>.
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleCopyPaymentInfo} className="text-xs">
            <Icon name="content_copy" size="sm" /> Copiar Dados
          </Button>
        </div>

        {/* DARF Carnet Sheet (Estilo Carnê Oficial da Receita Federal) */}
        <div className="border-2 border-black bg-white text-black p-4 rounded-lg font-sans text-xs shadow-md print:border-black print:p-0">
          {/* Header */}
          <div className="grid grid-cols-12 border-b-2 border-black pb-2 items-center">
            <div className="col-span-8 pr-2">
              <p className="font-extrabold text-[11px] uppercase tracking-wider">Ministério da Fazenda</p>
              <p className="font-bold text-[10px] text-gray-700">Secretaria da Receita Federal do Brasil</p>
              <p className="text-[10px] text-gray-600">Documento de Arrecadação de Receitas Federais</p>
              <h3 className="text-base font-extrabold mt-1">DARF</h3>
            </div>
            <div className="col-span-4 border-l-2 border-black pl-3 text-right">
              <span className="text-[10px] font-bold block text-gray-500">02 PERÍODO DE APURAÇÃO</span>
              <span className="text-sm font-extrabold font-mono">{settlement.periodMonthYear}</span>
            </div>
          </div>

          {/* Grid de Campos da DARF */}
          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-7 p-2 border-r border-black">
              <span className="text-[9px] font-bold block text-gray-500">01 NOME / TELEFONE DO CONTRIBUINTE</span>
              <p className="font-bold text-xs mt-0.5">{contributorName}</p>
              <p className="text-[10px] text-gray-600">Operações em Bolsa de Valores (B3 / íon Itaú)</p>
            </div>
            <div className="col-span-5 p-2 bg-gray-50">
              <span className="text-[9px] font-bold block text-gray-500">03 NÚMERO DO CPF / CNPJ</span>
              <p className="font-bold font-mono text-xs mt-0.5">{contributorCpf}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-7 p-2 border-r border-black">
              <span className="text-[9px] font-bold block text-gray-500">INSTRUÇÕES DE PREENCHIMENTO</span>
              <p className="text-[10px] text-gray-700 leading-relaxed mt-0.5">
                Ganhos líquidos auferidos em operações de Renda Variável no mercado à vista da B3 (Ações, Day Trade, FIIs).
                A apuração é mensal e o pagamento deve ser realizado até o último dia útil do mês subsequente.
              </p>
            </div>
            <div className="col-span-5 divide-y divide-black">
              <div className="p-1.5 flex justify-between items-center bg-yellow-50/50">
                <span className="text-[9px] font-extrabold">04 CÓDIGO DA RECEITA</span>
                <span className="font-extrabold font-mono text-sm text-blue-900">{settlement.receitaCode}</span>
              </div>
              <div className="p-1.5 flex justify-between items-center">
                <span className="text-[9px] font-bold">05 NÚMERO DE REFERÊNCIA</span>
                <span className="font-mono text-xs text-gray-400">-</span>
              </div>
              <div className="p-1.5 flex justify-between items-center bg-red-50/40">
                <span className="text-[9px] font-extrabold">06 DATA DE VENCIMENTO</span>
                <span className="font-extrabold font-mono text-xs text-red-600">{formatDate(settlement.dueDate)}</span>
              </div>
              <div className="p-1.5 flex justify-between items-center">
                <span className="text-[9px] font-bold">07 VALOR DO PRINCIPAL</span>
                <span className="font-extrabold font-mono text-xs">{formatCurrency(settlement.finalDarfToPay)}</span>
              </div>
              <div className="p-1.5 flex justify-between items-center">
                <span className="text-[9px] font-bold">08 VALOR DA MULTA</span>
                <span className="font-mono text-xs text-gray-500">R$ 0,00</span>
              </div>
              <div className="p-1.5 flex justify-between items-center">
                <span className="text-[9px] font-bold">09 VALOR DOS JUROS</span>
                <span className="font-mono text-xs text-gray-500">R$ 0,00</span>
              </div>
              <div className="p-2 flex justify-between items-center bg-gray-100 font-extrabold">
                <span className="text-[10px]">10 VALOR TOTAL</span>
                <span className="text-base text-emerald-800 font-mono">{formatCurrency(settlement.finalDarfToPay)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-2 flex items-center justify-between text-[9px] text-gray-500">
            <span>Autenticação Mecânica / Via Eletrônica</span>
            <span>Finanças Família Menezes - Módulo de Inteligência Tributária</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center pt-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-1.5">
              <Icon name="print" size="sm" /> Imprimir / Salvar PDF
            </Button>
            <Button variant="primary" onClick={handleCopyPaymentInfo} className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
              <Icon name="content_copy" size="sm" /> Copiar Código e Dados
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
