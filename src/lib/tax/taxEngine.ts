/**
 * Motor de Cálculo Tributário para Investimentos (B3 / Receita Federal do Brasil)
 * 
 * Regras implementadas:
 * 1. Ações (Operações Comuns / Swing Trade): Alíquota 15%. Isenção de IR se alienações (vendas) <= R$ 20.000,00 no mês civil.
 * 2. Day Trade (Ações / Opções / ETFs): Alíquota 20%. NÃO tem isenção de R$ 20.000.
 * 3. FIIs e FIAGROs: Alíquota 20% sobre o ganho de capital líquido na alienação de cotas. NÃO tem isenção de R$ 20.000.
 * 4. ETFs e BDRs: Alíquota 15% em operações normais, sem isenção de R$ 20.000.
 * 5. Preço Médio Ponderado:
 *    - Na Compra: (Preço * Quantidade) + Custos Operacionais Rateados (aumenta o custo de aquisição).
 *    - Na Venda: (Preço * Quantidade) - Custos Operacionais Rateados (reduz o valor líquido da venda).
 * 6. Compensação de Prejuízos: Prejuízos anteriores abatem lucros futuros da MESMA categoria (Swing Trade com Swing Trade, Day Trade com Day Trade, FIIs com FIIs).
 * 7. Dedução de IRRF ("Dedo-Duro"): Abate o imposto apurado no mês; saldo remanescente acumula para os meses seguintes.
 * 8. DARF Mínima: Não se emite DARF inferior a R$ 10,00. O saldo devido acumula para o próximo mês em que o total atingir R$ 10,00.
 * 9. Vencimento: Último dia útil do mês subsequente ao das operações. Código da Receita: 6015 (Pessoa Física).
 */

export interface RawBrokerageOrder {
  id?: string;
  ticker: string;
  asset_name?: string;
  asset_category?: 'Ações' | 'FIIs' | 'ETFs' | 'BDRs' | 'Opções' | 'Futuros';
  operation_type: 'C' | 'V'; // C = Compra, V = Venda
  market_type?: string; // VISTA, FRACIONARIO, OPCAO, etc.
  quantity: number;
  unit_price: number;
  total_price: number;
  apportioned_costs?: number;
  effective_unit_price?: number;
  effective_total?: number;
  is_day_trade?: boolean;
  trading_date: string; // YYYY-MM-DD
}

export interface RawBrokerageNote {
  id?: string;
  broker_name?: string;
  note_number?: string;
  trading_date: string; // YYYY-MM-DD
  clearing_date?: string;
  total_operations: number;
  net_amount: number;
  settlement_fee?: number; // Taxa de liquidação CBLC
  registration_fee?: number; // Taxa de registro
  emoluments?: number; // Emolumentos B3
  brokerage_fee?: number; // Taxa operacional / corretagem
  taxes?: number; // ISS / PIS / COFINS
  other_expenses?: number;
  irrf_amount?: number; // IRRF retido na fonte
  irrf_base?: number;
  orders: RawBrokerageOrder[];
}

export interface CategorySettlement {
  category: 'swing_trade' | 'day_trade' | 'fiis' | 'etfs';
  categoryLabel: string;
  salesTotal: number;
  costTotal: number;
  grossProfit: number;
  isExempt: boolean;
  lossBroughtForward: number; // Prejuízo anterior disponível
  lossUsed: number; // Prejuízo compensado este mês
  lossCarriedForward: number; // Prejuízo restante para o futuro
  taxableProfit: number; // Base de cálculo do imposto
  taxRate: number; // 0.15 ou 0.20
  taxDue: number; // Imposto apurado antes do dedo-duro
}

export interface MonthlyTaxSettlement {
  periodMonthYear: string; // YYYY-MM
  periodLabel: string; // Ex: Outubro/2026
  swingTrade: CategorySettlement;
  dayTrade: CategorySettlement;
  fiis: CategorySettlement;
  etfs: CategorySettlement;
  totalSales: number;
  totalGrossProfit: number;
  totalTaxDue: number;
  irrfMonth: number;
  irrfAccumulatedBefore: number;
  irrfDeducted: number;
  irrfAccumulatedRemaining: number;
  darfAmount: number;
  darfCarriedOverFromPast: number; // Saldo de DARF < R$ 10 de meses anteriores
  finalDarfToPay: number;
  isUnderMinimum: boolean; // Se DARF < R$ 10,00
  status: 'isento' | 'pendente' | 'pago' | 'prejuizo';
  dueDate: string; // YYYY-MM-DD
  receitaCode: '6015';
}

/**
 * Identifica a categoria do ativo baseado no Ticker e regras da B3
 */
export function inferAssetCategory(ticker: string): 'Ações' | 'FIIs' | 'ETFs' | 'BDRs' | 'Opções' {
  const t = (ticker || '').toUpperCase().trim();
  if (t.endsWith('11') || t.endsWith('11B')) {
    // Pode ser FII, ETF ou Unit de Ação.
    // Conhecidos ETFs da B3 com final 11:
    const knownEtfs = ['BOVA11', 'SMAL11', 'IVVB11', 'SPXI11', 'HASH11', 'XINA11', 'GOLD11', 'NASD11', 'ACWI11', 'BBSD11', 'DIVO11', 'MATB11', 'BRAX11', 'PIBB11', 'TECK11', 'BITH11', 'ETHE11'];
    if (knownEtfs.includes(t)) return 'ETFs';
    
    // Conhecidas Units de Ações (Ação Ordinária + Preferencial):
    const knownUnits = ['TAEE11', 'SANB11', 'SAPR11', 'KLBN11', 'ALUP11', 'BPAC11', 'ENGI11', 'CPLE11', 'SULA11'];
    if (knownUnits.includes(t)) return 'Ações';
    
    // Por padrão na B3, terminação 11 costuma ser FII / FIAGRO
    return 'FIIs';
  }

  if (t.endsWith('32') || t.endsWith('33') || t.endsWith('34') || t.endsWith('35') || t.endsWith('39')) {
    return 'BDRs';
  }

  // Opções de Ações: 4 letras + 1 letra de mês (A-L para call, M-X para put) + números
  if (/^[A-Z]{4}[A-X]\d+$/.test(t)) {
    return 'Opções';
  }

  return 'Ações';
}

/**
 * Rateia proporcionalmente as despesas da nota entre as ordens executadas.
 */
export function apportionNoteCosts(note: RawBrokerageNote): RawBrokerageOrder[] {
  const totalOperations = note.orders.reduce((sum, o) => sum + Math.abs(o.total_price), 0);
  const totalExpenses = (
    (note.settlement_fee || 0) +
    (note.registration_fee || 0) +
    (note.emoluments || 0) +
    (note.brokerage_fee || 0) +
    (note.taxes || 0) +
    (note.other_expenses || 0)
  );

  return note.orders.map(order => {
    const proportion = totalOperations > 0 ? Math.abs(order.total_price) / totalOperations : 0;
    const orderCost = Number((totalExpenses * proportion).toFixed(2));
    
    // Na compra, os custos se somam ao valor gasto (aumentando o custo de aquisição).
    // Na venda, os custos se deduzem do valor apurado (reduzindo o valor líquido de venda).
    const effectiveTotal = order.operation_type === 'C'
      ? Math.abs(order.total_price) + orderCost
      : Math.max(0, Math.abs(order.total_price) - orderCost);

    const effectiveUnitPrice = order.quantity > 0
      ? Number((effectiveTotal / order.quantity).toFixed(4))
      : order.unit_price;

    return {
      ...order,
      apportioned_costs: orderCost,
      effective_total: Number(effectiveTotal.toFixed(2)),
      effective_unit_price: effectiveUnitPrice,
      asset_category: order.asset_category || inferAssetCategory(order.ticker)
    };
  });
}

/**
 * Detecta operações de Day Trade (compra e venda do mesmo ticker no mesmo dia).
 */
export function detectDayTrades(orders: RawBrokerageOrder[]): RawBrokerageOrder[] {
  // Agrupa ordens por ticker e data
  const grouped: { [key: string]: { buys: RawBrokerageOrder[]; sells: RawBrokerageOrder[] } } = {};

  orders.forEach(o => {
    const key = `${o.trading_date}_${o.ticker.toUpperCase()}`;
    if (!grouped[key]) {
      grouped[key] = { buys: [], sells: [] };
    }
    if (o.operation_type === 'C') grouped[key].buys.push(o);
    else grouped[key].sells.push(o);
  });

  return orders.map(o => {
    const key = `${o.trading_date}_${o.ticker.toUpperCase()}`;
    const group = grouped[key];
    const hasBothSides = group && group.buys.length > 0 && group.sells.length > 0;
    return {
      ...o,
      is_day_trade: o.is_day_trade ?? hasBothSides
    };
  });
}

/**
 * Calcula o último dia útil do mês subsequente (vencimento do DARF).
 */
export function calculateDarfDueDate(periodMonthYear: string): string {
  const [yearStr, monthStr] = periodMonthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Mês subsequente:
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  // Pega o último dia do mês subsequente (dia 0 do mês seguinte a nextMonth)
  const lastDayOfMonth = new Date(nextYear, nextMonth, 0);

  // Recua caso caia em sábado ou domingo
  while (lastDayOfMonth.getDay() === 0 || lastDayOfMonth.getDay() === 6) {
    lastDayOfMonth.setDate(lastDayOfMonth.getDate() - 1);
  }

  const y = lastDayOfMonth.getFullYear();
  const m = String(lastDayOfMonth.getMonth() + 1).padStart(2, '0');
  const d = String(lastDayOfMonth.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Histórico de Prejuízos acumulados passados para iniciar o cálculo.
 */
export interface InitialTaxLoss {
  swingTradeLoss: number;
  dayTradeLoss: number;
  fiisLoss: number;
  accumulatedIrrf: number;
  carriedOverDarf: number; // Saldo de DARF < R$ 10 anterior
}

/**
 * Motor central de apuração de IR mensal para um determinado mês.
 * Processa todas as ordens executadas no mês com base na posição prévia de preço médio.
 */
export function calculateMonthlySettlement(
  periodMonthYear: string,
  ordersInMonth: RawBrokerageOrder[],
  previousPositions: Map<string, { quantity: number; averagePrice: number }>,
  initialLosses: InitialTaxLoss = {
    swingTradeLoss: 0,
    dayTradeLoss: 0,
    fiisLoss: 0,
    accumulatedIrrf: 0,
    carriedOverDarf: 0
  },
  irrfRetidoNaNotaMes: number = 0
): {
  settlement: MonthlyTaxSettlement;
  updatedPositions: Map<string, { quantity: number; averagePrice: number }>;
} {
  // Clona as posições para não alterar o mapa original diretamente
  const currentPositions = new Map<string, { quantity: number; averagePrice: number }>();
  previousPositions.forEach((val, key) => currentPositions.set(key, { ...val }));

  // Ordena as ordens cronologicamente no mês (compras antes de vendas se for no mesmo momento)
  const sortedOrders = [...ordersInMonth].sort((a, b) => {
    if (a.trading_date !== b.trading_date) {
      return a.trading_date.localeCompare(b.trading_date);
    }
    return a.operation_type === 'C' ? -1 : 1;
  });

  // Métricas agregadas por categoria
  let salesSwing = 0;
  let costSwing = 0;
  let profitSwing = 0;

  let salesDayTrade = 0;
  let costDayTrade = 0;
  let profitDayTrade = 0;

  let salesFiis = 0;
  let costFiis = 0;
  let profitFiis = 0;

  let salesEtfs = 0;
  let costEtfs = 0;
  let profitEtfs = 0;

  for (const order of sortedOrders) {
    const ticker = order.ticker.toUpperCase().trim();
    const cat = order.asset_category || inferAssetCategory(ticker);
    const pos = currentPositions.get(ticker) || { quantity: 0, averagePrice: 0 };

    if (order.operation_type === 'C') {
      // COMPRA: Atualiza Preço Médio ponderado incluindo custos
      const totalCost = (pos.quantity * pos.averagePrice) + (order.effective_total || order.total_price);
      const newQty = pos.quantity + order.quantity;
      const newAvg = newQty > 0 ? totalCost / newQty : 0;
      currentPositions.set(ticker, { quantity: newQty, averagePrice: newAvg });
    } else {
      // VENDA: Apura Ganho de Capital com base no Preço Médio vigente
      const effectiveSale = order.effective_total || order.total_price;
      const costOfSoldShares = order.quantity * pos.averagePrice;
      const profitOrLoss = effectiveSale - costOfSoldShares;

      // Diminui a quantidade em custódia (o preço médio se mantém igual)
      const remainingQty = Math.max(0, pos.quantity - order.quantity);
      currentPositions.set(ticker, { quantity: remainingQty, averagePrice: pos.averagePrice });

      if (order.is_day_trade) {
        salesDayTrade += effectiveSale;
        costDayTrade += costOfSoldShares;
        profitDayTrade += profitOrLoss;
      } else if (cat === 'FIIs') {
        salesFiis += effectiveSale;
        costFiis += costOfSoldShares;
        profitFiis += profitOrLoss;
      } else if (cat === 'ETFs' || cat === 'BDRs') {
        salesEtfs += effectiveSale;
        costEtfs += costOfSoldShares;
        profitEtfs += profitOrLoss;
      } else {
        // Ações Normais (Swing Trade)
        salesSwing += effectiveSale;
        costSwing += costOfSoldShares;
        profitSwing += profitOrLoss;
      }
    }
  }

  // 1. Ações Swing Trade: regra de isenção de R$ 20.000
  const isSwingExempt = salesSwing <= 20000.0;
  let taxableProfitSwing = 0;
  let lossCarrySwing = initialLosses.swingTradeLoss;
  let lossUsedSwing = 0;

  if (profitSwing < 0) {
    // Teve prejuízo no mês: acumula para o futuro
    lossCarrySwing += Math.abs(profitSwing);
  } else if (profitSwing > 0) {
    if (isSwingExempt) {
      // Vendas <= R$ 20k: Lucro totalmente isento! Não paga IR e não queima prejuízo acumulado.
      taxableProfitSwing = 0;
    } else {
      // Tributável a 15%: compensa prejuízo passado
      if (lossCarrySwing > 0) {
        if (lossCarrySwing >= profitSwing) {
          lossUsedSwing = profitSwing;
          lossCarrySwing -= profitSwing;
          taxableProfitSwing = 0;
        } else {
          lossUsedSwing = lossCarrySwing;
          taxableProfitSwing = profitSwing - lossCarrySwing;
          lossCarrySwing = 0;
        }
      } else {
        taxableProfitSwing = profitSwing;
      }
    }
  }

  // 2. Day Trade (sem isenção, 20%)
  let taxableProfitDayTrade = 0;
  let lossCarryDayTrade = initialLosses.dayTradeLoss;
  let lossUsedDayTrade = 0;

  if (profitDayTrade < 0) {
    lossCarryDayTrade += Math.abs(profitDayTrade);
  } else if (profitDayTrade > 0) {
    if (lossCarryDayTrade > 0) {
      if (lossCarryDayTrade >= profitDayTrade) {
        lossUsedDayTrade = profitDayTrade;
        lossCarryDayTrade -= profitDayTrade;
        taxableProfitDayTrade = 0;
      } else {
        lossUsedDayTrade = lossCarryDayTrade;
        taxableProfitDayTrade = profitDayTrade - lossCarryDayTrade;
        lossCarryDayTrade = 0;
      }
    } else {
      taxableProfitDayTrade = profitDayTrade;
    }
  }

  // 3. FIIs (sem isenção, 20%)
  let taxableProfitFiis = 0;
  let lossCarryFiis = initialLosses.fiisLoss;
  let lossUsedFiis = 0;

  if (profitFiis < 0) {
    lossCarryFiis += Math.abs(profitFiis);
  } else if (profitFiis > 0) {
    if (lossCarryFiis > 0) {
      if (lossCarryFiis >= profitFiis) {
        lossUsedFiis = profitFiis;
        lossCarryFiis -= profitFiis;
        taxableProfitFiis = 0;
      } else {
        lossUsedFiis = lossCarryFiis;
        taxableProfitFiis = profitFiis - lossCarryFiis;
        lossCarryFiis = 0;
      }
    } else {
      taxableProfitFiis = profitFiis;
    }
  }

  // 4. ETFs / BDRs (sem isenção, 15% - compensa com Swing Trade conforme regra geral de operações comuns da RFB)
  let taxableProfitEtfs = Math.max(0, profitEtfs);

  // Cálculo dos Impostos Brutos
  const taxDueSwing = Number((taxableProfitSwing * 0.15).toFixed(2));
  const taxDueDayTrade = Number((taxableProfitDayTrade * 0.20).toFixed(2));
  const taxDueFiis = Number((taxableProfitFiis * 0.20).toFixed(2));
  const taxDueEtfs = Number((taxableProfitEtfs * 0.15).toFixed(2));
  const totalTaxDue = taxDueSwing + taxDueDayTrade + taxDueFiis + taxDueEtfs;

  // Dedução de IRRF ("Dedo-Duro")
  // 0,005% em vendas de swing trade + 1% sobre ganho em day trade retido pela corretora
  const totalAvailableIrrf = initialLosses.accumulatedIrrf + irrfRetidoNaNotaMes;
  let irrfDeducted = 0;
  let irrfRemaining = totalAvailableIrrf;

  if (totalTaxDue > 0 && totalAvailableIrrf > 0) {
    if (totalAvailableIrrf >= totalTaxDue) {
      irrfDeducted = totalTaxDue;
      irrfRemaining = totalAvailableIrrf - totalTaxDue;
    } else {
      irrfDeducted = totalAvailableIrrf;
      irrfRemaining = 0;
    }
  }

  const taxAfterIrrf = Math.max(0, totalTaxDue - irrfDeducted);
  const totalDarfCandidate = taxAfterIrrf + (initialLosses.carriedOverDarf || 0);

  // Regra da DARF Mínima de R$ 10,00
  let finalDarfToPay = 0;
  let isUnderMinimum = false;

  if (totalDarfCandidate > 0) {
    if (totalDarfCandidate < 10.0) {
      isUnderMinimum = true;
      finalDarfToPay = 0; // Não emite DARF abaixo de R$ 10; acumula para o próximo mês
    } else {
      finalDarfToPay = Number(totalDarfCandidate.toFixed(2));
      isUnderMinimum = false;
    }
  }

  // Determinação do Status
  let status: 'isento' | 'pendente' | 'pago' | 'prejuizo' = 'isento';
  if (finalDarfToPay > 0) {
    status = 'pendente';
  } else if (profitSwing < 0 || profitDayTrade < 0 || profitFiis < 0 || profitEtfs < 0) {
    status = 'prejuizo';
  } else if (isSwingExempt && (salesSwing > 0 || profitSwing > 0)) {
    status = 'isento';
  }

  const [yearStr, monthStr] = periodMonthYear.split('-');
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const monthIndex = parseInt(monthStr, 10) - 1;
  const periodLabel = `${monthNames[monthIndex] || monthStr} de ${yearStr}`;

  const settlement: MonthlyTaxSettlement = {
    periodMonthYear,
    periodLabel,
    swingTrade: {
      category: 'swing_trade',
      categoryLabel: 'Ações (Swing Trade)',
      salesTotal: Number(salesSwing.toFixed(2)),
      costTotal: Number(costSwing.toFixed(2)),
      grossProfit: Number(profitSwing.toFixed(2)),
      isExempt: isSwingExempt,
      lossBroughtForward: Number(initialLosses.swingTradeLoss.toFixed(2)),
      lossUsed: Number(lossUsedSwing.toFixed(2)),
      lossCarriedForward: Number(lossCarrySwing.toFixed(2)),
      taxableProfit: Number(taxableProfitSwing.toFixed(2)),
      taxRate: 0.15,
      taxDue: taxDueSwing
    },
    dayTrade: {
      category: 'day_trade',
      categoryLabel: 'Day Trade (20%)',
      salesTotal: Number(salesDayTrade.toFixed(2)),
      costTotal: Number(costDayTrade.toFixed(2)),
      grossProfit: Number(profitDayTrade.toFixed(2)),
      isExempt: false,
      lossBroughtForward: Number(initialLosses.dayTradeLoss.toFixed(2)),
      lossUsed: Number(lossUsedDayTrade.toFixed(2)),
      lossCarriedForward: Number(lossCarryDayTrade.toFixed(2)),
      taxableProfit: Number(taxableProfitDayTrade.toFixed(2)),
      taxRate: 0.20,
      taxDue: taxDueDayTrade
    },
    fiis: {
      category: 'fiis',
      categoryLabel: 'Fundos Imobiliários & FIAGRO (20%)',
      salesTotal: Number(salesFiis.toFixed(2)),
      costTotal: Number(costFiis.toFixed(2)),
      grossProfit: Number(profitFiis.toFixed(2)),
      isExempt: false,
      lossBroughtForward: Number(initialLosses.fiisLoss.toFixed(2)),
      lossUsed: Number(lossUsedFiis.toFixed(2)),
      lossCarriedForward: Number(lossCarryFiis.toFixed(2)),
      taxableProfit: Number(taxableProfitFiis.toFixed(2)),
      taxRate: 0.20,
      taxDue: taxDueFiis
    },
    etfs: {
      category: 'etfs',
      categoryLabel: 'ETFs & BDRs (15%)',
      salesTotal: Number(salesEtfs.toFixed(2)),
      costTotal: Number(costEtfs.toFixed(2)),
      grossProfit: Number(profitEtfs.toFixed(2)),
      isExempt: false,
      lossBroughtForward: 0,
      lossUsed: 0,
      lossCarriedForward: 0,
      taxableProfit: Number(taxableProfitEtfs.toFixed(2)),
      taxRate: 0.15,
      taxDue: taxDueEtfs
    },
    totalSales: Number((salesSwing + salesDayTrade + salesFiis + salesEtfs).toFixed(2)),
    totalGrossProfit: Number((profitSwing + profitDayTrade + profitFiis + profitEtfs).toFixed(2)),
    totalTaxDue: Number(totalTaxDue.toFixed(2)),
    irrfMonth: Number(irrfRetidoNaNotaMes.toFixed(2)),
    irrfAccumulatedBefore: Number(initialLosses.accumulatedIrrf.toFixed(2)),
    irrfDeducted: Number(irrfDeducted.toFixed(2)),
    irrfAccumulatedRemaining: Number(irrfRemaining.toFixed(2)),
    darfAmount: Number(taxAfterIrrf.toFixed(2)),
    darfCarriedOverFromPast: Number((initialLosses.carriedOverDarf || 0).toFixed(2)),
    finalDarfToPay: finalDarfToPay,
    isUnderMinimum: isUnderMinimum,
    status: status,
    dueDate: calculateDarfDueDate(periodMonthYear),
    receitaCode: '6015'
  };

  return {
    settlement,
    updatedPositions: currentPositions
  };
}
