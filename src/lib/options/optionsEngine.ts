// B3 Options Calculation & Helper Engine

export type OptionType = 'CALL' | 'PUT';
export type PositionSide = 'buy' | 'sell';

export type StrategyCategory = 
  | 'trava_baixa'
  | 'trava_alta'
  | 'venda_put'
  | 'venda_coberta'
  | 'compra_seco_call'
  | 'compra_seco_put'
  | 'compra_seco'
  | 'personalizada';

export interface OptionLeg {
  id: string;
  ticker: string; // e.g. BOVAW205
  type: OptionType;
  side: PositionSide; // buy (comprada) or sell (vendida)
  strike: number;
  entryPrice: number; // premium paid or received
  currentPrice: number;
  bidPrice?: number;
  askPrice?: number;
  quantity: number;
  expirationDate: string; // YYYY-MM-DD
}

export interface OptionStrategy {
  id: string;
  name: string; // e.g. Trava de Baixa - BOVA11 (205 x 199)
  underlyingTicker: string; // e.g. BOVA11
  underlyingPrice: number;
  strategyCategory: StrategyCategory;
  legs: OptionLeg[];
  quantity: number; // e.g. 100
  entryCostPerUnit: number; // e.g. 2.13
  totalEntryCost: number; // e.g. 213.00
  entryDate: string; // YYYY-MM-DD
  targetProfit50: number; // e.g. 3.20 (+50%)
  targetProfit80: number; // e.g. 3.83 (+80%)
  stopLossPrice: number; // e.g. 1.06 (-50%)
  maxProfitPerUnit?: number; // difference in strikes - cost
  status: 'active' | 'closed' | 'target_hit' | 'stop_hit';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// B3 Expiration Month mapping:
// Calls: A=Jan, B=Feb, C=Mar, D=Apr, E=May, F=Jun, G=Jul, H=Aug, I=Sep, J=Oct, K=Nov, L=Dec
// Puts:  M=Jan, N=Feb, O=Mar, P=Apr, Q=May, R=Jun, S=Jul, T=Aug, U=Sep, V=Oct, W=Nov, X=Dec
const CALL_LETTERS: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12
};

const PUT_LETTERS: Record<string, number> = {
  M: 1, N: 2, O: 3, P: 4, Q: 5, R: 6, S: 7, T: 8, U: 9, V: 10, W: 11, X: 12
};

// Common Brazilian Underlying Tickers
const UNDERLYING_MAP: Record<string, string> = {
  'BOVA': 'BOVA11',
  'SMAL': 'SMAL11',
  'PETR': 'PETR4',
  'VALE': 'VALE3',
  'ITUB': 'ITUB4',
  'BBDC': 'BBDC4',
  'BBAS': 'BBAS3',
  'MGLU': 'MGLU3',
  'WEGE': 'WEGE3',
  'RENT': 'RENT3',
  'SUZB': 'SUZB3',
  'JBSS': 'JBSS3',
  'PRIO': 'PRIO3',
  'ABEV': 'ABEV3',
  'ELET': 'ELET3',
  'CSNA': 'CSNA3',
  'GGBR': 'GGBR4',
  'USIM': 'USIM5',
  'VIIA': 'BHIA3',
  'BHIA': 'BHIA3',
  'COGN': 'COGN3',
  'RADL': 'RADL3',
  'VBBR': 'VBBR3',
  'RAIZ': 'RAIZ4',
  'HAPV': 'HAPV3',
  'LREN': 'LREN3',
  'B3SA': 'B3SA3'
};

// Calculates the third Friday of a given year and month (official B3 expiration rule)
export function getB3ThirdFriday(year: number, month: number): string {
  // Month is 1-indexed (1 = Jan, 12 = Dec)
  const date = new Date(year, month - 1, 1);
  let fridayCount = 0;
  
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 5) { // 5 = Friday
      fridayCount++;
      if (fridayCount === 3) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    date.setDate(date.getDate() + 1);
  }
  return `${year}-${String(month).padStart(2, '0')}-19`;
}

// Intelligent decoder for B3 option tickers
export function parseB3OptionTicker(rawTicker: string): {
  isValid: boolean;
  underlyingTicker: string;
  type: OptionType;
  expirationMonth: number;
  expirationDate: string;
  estimatedStrike: number;
} {
  const clean = rawTicker.trim().toUpperCase().replace('.SA', '');
  
  // Format typically: 4 letters (root) + 1 letter (month/type) + numbers/letters
  const match = clean.match(/^([A-Z]{4})([A-Z])([0-9A-Z]+)$/);
  
  if (!match) {
    return {
      isValid: false,
      underlyingTicker: clean.slice(0, 4) || clean,
      type: 'CALL',
      expirationMonth: new Date().getMonth() + 1,
      expirationDate: new Date().toISOString().split('T')[0],
      estimatedStrike: 0
    };
  }

  const root = match[1];
  const letter = match[2];
  const strikeCode = match[3];

  const underlying = UNDERLYING_MAP[root] || `${root}4`;

  let type: OptionType = 'CALL';
  let expirationMonth = 1;

  if (CALL_LETTERS[letter]) {
    type = 'CALL';
    expirationMonth = CALL_LETTERS[letter];
  } else if (PUT_LETTERS[letter]) {
    type = 'PUT';
    expirationMonth = PUT_LETTERS[letter];
  }

  // Determine expiration year (if month is past, assume next year)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const expYear = expirationMonth < currentMonth ? currentYear + 1 : currentYear;
  const expirationDate = getB3ThirdFriday(expYear, expirationMonth);

  // Parse estimated strike from code (e.g. 205 -> 205, 199 -> 199, 19 -> 19 or 190)
  let estimatedStrike = parseFloat(strikeCode) || 0;
  if (estimatedStrike > 1000) {
    estimatedStrike = estimatedStrike / 100;
  }

  return {
    isValid: true,
    underlyingTicker: underlying,
    type,
    expirationMonth,
    expirationDate,
    estimatedStrike
  };
}

// Calculate DTE (Days to Expiration)
export function calculateDTE(expirationDate: string): {
  calendarDays: number;
  businessDays: number;
  isExpired: boolean;
} {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const [y, m, d] = expirationDate.split('-').map(Number);
  const exp = new Date(y, m - 1, d);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - now.getTime();
  const calendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Business days approximation (excluding weekends)
  let businessDays = 0;
  const cur = new Date(now);
  while (cur < exp) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      businessDays++;
    }
  }

  return {
    calendarDays: Math.max(0, calendarDays),
    businessDays: Math.max(0, businessDays),
    isExpired: calendarDays <= 0
  };
}

// Spread & Metric Calculations
export interface StrategyAnalysis {
  currentSpread: number;
  entryCost: number;
  totalEntryCost: number;
  currentValue: number;
  pnlTotal: number;
  pnlPercent: number;
  progressPercent: number; // 0 to 100 towards 50% target, or beyond
  dte: { calendarDays: number; businessDays: number; isExpired: boolean };
  statusBadge: {
    label: string;
    color: 'emerald' | 'amber' | 'red' | 'gray';
    actionRecommendation?: string;
  };
  distanceToShortStrikePercent?: number;
  distanceToLongStrikePercent?: number;
}

export function analyzeStrategy(strategy: OptionStrategy): StrategyAnalysis {
  const buyLeg = strategy.legs.find(l => l.side === 'buy');
  const sellLeg = strategy.legs.find(l => l.side === 'sell');

  const isShortSingle = 
    strategy.strategyCategory === 'venda_put' || 
    strategy.strategyCategory === 'venda_coberta' || 
    (!buyLeg && !!sellLeg);

  const isLongSingle =
    strategy.strategyCategory === 'compra_seco_call' ||
    strategy.strategyCategory === 'compra_seco_put' ||
    strategy.strategyCategory === 'compra_seco' ||
    (!!buyLeg && !sellLeg);

  let currentSpread = 0;
  let entryCost = strategy.entryCostPerUnit || 0.01;
  let totalCost = strategy.totalEntryCost || (entryCost * strategy.quantity);
  let currentValue = 0;
  let pnlTotal = 0;
  let pnlPercent = 0;

  if (isShortSingle && sellLeg) {
    // Operação Vendida de Perna Única (ex: Venda de Put, Venda Coberta)
    // entryCost é o prêmio recebido por ação (crédito)
    currentSpread = sellLeg.currentPrice; // Cotação atual da opção no mercado
    currentValue = Number((sellLeg.currentPrice * strategy.quantity).toFixed(2)); // Custo para recompra/zeragem hoje
    pnlTotal = Number(((entryCost - sellLeg.currentPrice) * strategy.quantity).toFixed(2));
    pnlPercent = Number((((entryCost - sellLeg.currentPrice) / (entryCost || 1)) * 100).toFixed(2));
  } else if (isLongSingle && buyLeg) {
    // Operação Comprada a Seco (ex: Compra de Call ou Put)
    currentSpread = buyLeg.currentPrice;
    currentValue = Number((buyLeg.currentPrice * strategy.quantity).toFixed(2));
    pnlTotal = Number((currentValue - totalCost).toFixed(2));
    pnlPercent = Number((((buyLeg.currentPrice - entryCost) / (entryCost || 1)) * 100).toFixed(2));
  } else if (buyLeg && sellLeg) {
    // Trava de Spread (Débito): Cotação da ponta comprada - ponta vendida
    currentSpread = Number((buyLeg.currentPrice - sellLeg.currentPrice).toFixed(2));
    currentValue = Number((currentSpread * strategy.quantity).toFixed(2));
    pnlTotal = Number((currentValue - totalCost).toFixed(2));
    pnlPercent = Number((((currentSpread - entryCost) / (entryCost || 1)) * 100).toFixed(2));
  } else {
    currentSpread = buyLeg ? buyLeg.currentPrice : (sellLeg ? sellLeg.currentPrice : 0);
    currentValue = Number((currentSpread * strategy.quantity).toFixed(2));
    pnlTotal = Number((currentValue - totalCost).toFixed(2));
    pnlPercent = Number((((currentSpread - entryCost) / (entryCost || 1)) * 100).toFixed(2));
  }

  // Determine DTE
  const nearestExp = strategy.legs.reduce((earliest, leg) => {
    return !earliest || leg.expirationDate < earliest ? leg.expirationDate : earliest;
  }, strategy.legs[0]?.expirationDate || new Date().toISOString().split('T')[0]);

  const dte = calculateDTE(nearestExp);

  // Status & Recommendations
  let statusBadge: StrategyAnalysis['statusBadge'] = {
    label: 'Operação em Andamento',
    color: 'amber'
  };

  if (isShortSingle) {
    // Para operações vendidas: lucro acontece com a queda do preço da opção (desvalorização em direção a 0)
    const target50 = strategy.targetProfit50 || (entryCost * 0.5); // recompra a 50%
    const target80 = strategy.targetProfit80 || (entryCost * 0.2); // recompra a 20%
    const stopLoss = strategy.stopLossPrice || (entryCost * 1.5); // stop se subir 50% acima do prêmio recebido

    if (dte.isExpired) {
      if (sellLeg && strategy.underlyingPrice > 0 && sellLeg.strike > 0) {
        const isITM = sellLeg.type === 'PUT' 
          ? strategy.underlyingPrice < sellLeg.strike 
          : strategy.underlyingPrice > sellLeg.strike;
        
        if (isITM) {
          statusBadge = {
            label: '⚠️ Exercício no Vencimento (ITM)',
            color: 'red',
            actionRecommendation: sellLeg.type === 'PUT' 
              ? 'Ação abaixo do Strike: você assumirá a compra das ações pelo preço de Strike.'
              : 'Ação acima do Strike: suas ações serão entregues pelo preço de Strike.'
          };
        } else {
          statusBadge = {
            label: '🟢 Virou Pó! Lucro Máximo (100%)',
            color: 'emerald',
            actionRecommendation: 'Opção expirou OTM fora do dinheiro. O prêmio recebido foi 100% retido!'
          };
        }
      } else {
        statusBadge = {
          label: 'Opção Vencida',
          color: 'gray',
          actionRecommendation: 'Operação expirou no vencimento.'
        };
      }
    } else if (pnlPercent >= 80 || (sellLeg && sellLeg.currentPrice <= target80)) {
      statusBadge = {
        label: '🟢 Super Meta (+80% do Prêmio Retido)!',
        color: 'emerald',
        actionRecommendation: 'A opção desvalorizou fortemente. Excelente momento para recomprar barato e encerrar o risco!'
      };
    } else if (pnlPercent >= 50 || (sellLeg && sellLeg.currentPrice <= target50)) {
      statusBadge = {
        label: '🟢 Alvo (+50% do Prêmio no Bolso)!',
        color: 'emerald',
        actionRecommendation: 'Recomende recomprar por metade do valor vendido para embolsar o ganho.'
      };
    } else if (pnlPercent <= -50 || (sellLeg && sellLeg.currentPrice >= stopLoss)) {
      statusBadge = {
        label: '🔴 Stop Loss Atingido (-50%)',
        color: 'red',
        actionRecommendation: 'Atenção: A opção valorizou contra sua venda. Considere zerar ou rolar para estancar risco.'
      };
    } else if (pnlPercent > 20) {
      statusBadge = {
        label: '🟡 Lucro Parcial (>20%)',
        color: 'amber',
        actionRecommendation: 'A opção está desvalorizando conforme esperado.'
      };
    }
  } else {
    // Operações a Débito / Travas / Compras a Seco
    const target50 = strategy.targetProfit50 || (entryCost * 1.5);
    const target80 = strategy.targetProfit80 || (entryCost * 1.8);
    const stopLoss = strategy.stopLossPrice || (entryCost * 0.5);

    if (dte.isExpired) {
      statusBadge = {
        label: 'Opção Vencida',
        color: 'gray',
        actionRecommendation: 'Operação expirou no vencimento.'
      };
    } else if (currentSpread >= target80 || pnlPercent >= 80) {
      statusBadge = {
        label: '🟢 Super Meta (+80%) Atingida!',
        color: 'emerald',
        actionRecommendation: 'Desmonte agora para embolsar o ganho máximo seguro!'
      };
    } else if (currentSpread >= target50 || pnlPercent >= 50) {
      statusBadge = {
        label: '🟢 Alvo (+50%) Atingido!',
        color: 'emerald',
        actionRecommendation: 'Momento recomendado para desmontar a trava com lucro.'
      };
    } else if (currentSpread <= stopLoss || pnlPercent <= -50) {
      statusBadge = {
        label: '🔴 Stop Loss Atingido (-50%)',
        color: 'red',
        actionRecommendation: 'Atenção: Considere desmontar para estancar perdas adicionais.'
      };
    } else if (pnlPercent > 20) {
      statusBadge = {
        label: '🟡 Lucro Parcial (>20%)',
        color: 'amber',
        actionRecommendation: 'Aproximando-se da faixa de realização.'
      };
    }
  }

  // Calculate progress toward target 50%
  // 0% = cost, 100% = target50, >100% = above
  let progressPercent = 0;
  if (isShortSingle) {
    progressPercent = (pnlPercent / 50) * 100;
  } else {
    const target50 = strategy.targetProfit50 || (entryCost * 1.5);
    if (target50 > entryCost) {
      progressPercent = ((currentSpread - entryCost) / (target50 - entryCost)) * 100;
    }
  }

  // Distance of underlying price to strikes
  let distanceToShortStrikePercent: number | undefined;
  let distanceToLongStrikePercent: number | undefined;

  if (strategy.underlyingPrice > 0) {
    if (sellLeg && sellLeg.strike > 0) {
      distanceToShortStrikePercent = Number((((strategy.underlyingPrice - sellLeg.strike) / strategy.underlyingPrice) * 100).toFixed(2));
    }
    if (buyLeg && buyLeg.strike > 0) {
      distanceToLongStrikePercent = Number((((strategy.underlyingPrice - buyLeg.strike) / strategy.underlyingPrice) * 100).toFixed(2));
    }
  }

  return {
    currentSpread,
    entryCost,
    totalEntryCost: totalCost,
    currentValue,
    pnlTotal,
    pnlPercent,
    progressPercent: Math.max(-100, Math.min(200, progressPercent)),
    dte,
    statusBadge,
    distanceToShortStrikePercent,
    distanceToLongStrikePercent
  };
}
