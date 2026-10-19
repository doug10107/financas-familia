'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { MonthlyTaxSettlement } from '@/lib/tax/taxEngine';
import { BrokerageOrderRecord } from '@/hooks/useTaxCalculator';

interface AnnualTaxReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlements: MonthlyTaxSettlement[];
  orders: BrokerageOrderRecord[];
  year?: string;
}

export function AnnualTaxReportModal({
  isOpen,
  onClose,
  settlements,
  orders,
  year = '2026'
}: AnnualTaxReportModalProps) {
  const [activeFicha, setActiveFicha] = useState<'renda_variavel' | 'fiis' | 'isentos' | 'bens'>('renda_variavel');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Filtra apurações do ano selecionado
  const settlementsOfYear = settlements.filter(s => s.periodMonthYear.startsWith(year));

  // Soma de lucros isentos de ações no ano (vendas <= 20k)
  const totalExemptProfitYear = settlementsOfYear.reduce((sum, s) => {
    if (s.swingTrade.isExempt && s.swingTrade.grossProfit > 0) {
      return sum + s.swingTrade.grossProfit;
    }
    return sum;
  }, 0);

  // Posições de custódia consolidadas
  const positionsMap: { [ticker: string]: { ticker: string; name: string; category: string; qty: number; avgPrice: number; totalCost: number } } = {};
  
  orders.forEach(o => {
    const sym = o.ticker.toUpperCase().trim();
    if (!positionsMap[sym]) {
      positionsMap[sym] = {
        ticker: sym,
        name: o.asset_name || sym,
        category: o.asset_category || 'Ações',
        qty: 0,
        avgPrice: 0,
        totalCost: 0
      };
    }

    const cur = positionsMap[sym];
    if (o.operation_type === 'C') {
      const newTotal = (cur.qty * cur.avgPrice) + (o.effective_total || o.total_price);
      const newQty = cur.qty + o.quantity;
      cur.qty = newQty;
      cur.avgPrice = newQty > 0 ? newTotal / newQty : 0;
      cur.totalCost = newTotal;
    } else {
      cur.qty = Math.max(0, cur.qty - o.quantity);
      cur.totalCost = cur.qty * cur.avgPrice;
    }
  });

  const activeHoldings = Object.values(positionsMap).filter(p => p.qty > 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Informe Anual de IRPF (${year}) - Declaração de Ajuste Anual`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs (Fichas da Receita Federal) */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveFicha('renda_variavel')}
            className={`px-3 py-2 font-bold rounded-lg transition-all shrink-0 ${
              activeFicha === 'renda_variavel'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Ficha Renda Variável (Ações / Day Trade)
          </button>
          <button
            type="button"
            onClick={() => setActiveFicha('fiis')}
            className={`px-3 py-2 font-bold rounded-lg transition-all shrink-0 ${
              activeFicha === 'fiis'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Ficha Operações em FIIs / FIAGRO
          </button>
          <button
            type="button"
            onClick={() => setActiveFicha('isentos')}
            className={`px-3 py-2 font-bold rounded-lg transition-all shrink-0 ${
              activeFicha === 'isentos'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Rendimentos Isentos (Vendas &lt; R$ 20k)
          </button>
          <button
            type="button"
            onClick={() => setActiveFicha('bens')}
            className={`px-3 py-2 font-bold rounded-lg transition-all shrink-0 ${
              activeFicha === 'bens'
                ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Ficha Bens e Direitos (Custódia em 31/12)
          </button>
        </div>

        {/* 1. Ficha Renda Variável */}
        {activeFicha === 'renda_variavel' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Copie estes valores exatamente para a aba <strong>Renda Variável &gt; Operações Comuns / Day-Trade</strong> do programa IRPF da Receita Federal:
            </p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto max-h-80 no-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5">Mês</th>
                    <th className="p-2.5 text-right">Swing Trade (Lucro/Prej)</th>
                    <th className="p-2.5 text-right">Day Trade (Lucro/Prej)</th>
                    <th className="p-2.5 text-right">Prejuízo a Compensar</th>
                    <th className="p-2.5 text-right">Imposto Devido</th>
                    <th className="p-2.5 text-right">IRRF Retido (Fonte)</th>
                    <th className="p-2.5 text-right">Imposto Pago (DARF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-[11px]">
                  {settlementsOfYear.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-400">
                        Nenhuma operação registrada no ano {year}.
                      </td>
                    </tr>
                  ) : (
                    settlementsOfYear.map((s, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2.5 font-bold">{s.periodLabel}</td>
                        <td className={`p-2.5 text-right font-medium ${s.swingTrade.grossProfit < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {s.swingTrade.isExempt && s.swingTrade.grossProfit > 0 ? 'Isento (R$ 0,00)' : formatCurrency(s.swingTrade.grossProfit)}
                        </td>
                        <td className={`p-2.5 text-right font-medium ${s.dayTrade.grossProfit < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {formatCurrency(s.dayTrade.grossProfit)}
                        </td>
                        <td className="p-2.5 text-right text-orange-600 dark:text-orange-400 font-semibold">
                          {formatCurrency(s.swingTrade.lossCarriedForward + s.dayTrade.lossCarriedForward)}
                        </td>
                        <td className="p-2.5 text-right font-bold">
                          {formatCurrency(s.totalTaxDue)}
                        </td>
                        <td className="p-2.5 text-right text-gray-500">
                          {formatCurrency(s.irrfMonth)}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(s.finalDarfToPay)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Ficha FIIs */}
        {activeFicha === 'fiis' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Copie para a aba <strong>Renda Variável &gt; Operações Fundos de Investimento Imobiliário</strong>:
            </p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto max-h-80 no-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-2.5">Mês</th>
                    <th className="p-2.5 text-right">Alienação de Cotas (Venda)</th>
                    <th className="p-2.5 text-right">Resultado Líquido do Mês</th>
                    <th className="p-2.5 text-right">Prejuízo a Compensar</th>
                    <th className="p-2.5 text-right">Base de Cálculo</th>
                    <th className="p-2.5 text-right">Alíquota</th>
                    <th className="p-2.5 text-right">Imposto Pago (DARF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-[11px]">
                  {settlementsOfYear.map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="p-2.5 font-bold">{s.periodLabel}</td>
                      <td className="p-2.5 text-right">{formatCurrency(s.fiis.salesTotal)}</td>
                      <td className={`p-2.5 text-right font-medium ${s.fiis.grossProfit < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                        {formatCurrency(s.fiis.grossProfit)}
                      </td>
                      <td className="p-2.5 text-right text-orange-600">{formatCurrency(s.fiis.lossCarriedForward)}</td>
                      <td className="p-2.5 text-right">{formatCurrency(s.fiis.taxableProfit)}</td>
                      <td className="p-2.5 text-right font-bold">20%</td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-600">{formatCurrency(s.fiis.taxDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Rendimentos Isentos */}
        {activeFicha === 'isentos' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
              <span className="text-xs uppercase font-extrabold text-emerald-700 dark:text-emerald-300 tracking-wider">
                Ficha: Rendimentos Isentos e Não Tributáveis (Item 20)
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Ganhos líquidos em operações no mercado à vista de ações negociadas em bolsas de valores nas alienações realizadas até R$ 20.000,00 em cada mês, para o conjunto de ações.
              </p>
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-xs text-gray-500">Valor Total no Ano:</span>
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalExemptProfitYear)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Bens e Direitos */}
        {activeFicha === 'bens' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Posição de custódia e <strong>Custo de Aquisição (Preço Médio Ponderado)</strong> para preenchimento da ficha <strong>Bens e Direitos</strong> em 31/12:
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar">
              {activeHoldings.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 border rounded-xl">
                  Nenhum ativo em custódia no momento.
                </div>
              ) : (
                activeHoldings.map((h, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-900 dark:text-white font-extrabold flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-mono">
                          {h.category === 'FIIs' ? 'Grupo 07 - Código 03' : 'Grupo 03 - Código 01'}
                        </span>
                        {h.ticker} - {h.name}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm font-extrabold">
                        {formatCurrency(h.totalCost)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      Discriminação sugerida: {h.qty} cotas/ações de {h.name} ({h.ticker}) adquiridas pela corretora íon Itaú com custo médio unitário de {formatCurrency(h.avgPrice)}, totalizando {formatCurrency(h.totalCost)}.
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Fechar Relatório
          </Button>
        </div>
      </div>
    </Modal>
  );
}
