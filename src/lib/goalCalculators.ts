// Utilitários de cálculo financeiro e inteligência de metas

export interface GoalCalculationResult {
  months: number;
  monthlyDeposit: number;
  totalOutOfPocket: number;
  totalInterestEarned: number;
  monthlyDepositNoInterest: number;
  interestSavings: number;
}

export interface RequiredRateResult {
  requiredAnnualRate: number;
  isAchievable: boolean;
  diagnosis: 'low' | 'moderate' | 'high' | 'unrealistic';
  badgeColor: 'green' | 'blue' | 'yellow' | 'red';
  title: string;
  message: string;
}

export interface InvestmentRecommendation {
  horizon: 'curto' | 'medio' | 'longo';
  title: string;
  description: string;
  suggestions: string[];
}

/**
 * Calcula a quantidade de meses restantes até a data limite
 */
export function calculateMonthsRemaining(deadline: string | null | undefined): number {
  if (!deadline) return 12; // Padrão de 12 meses caso não definido
  const today = new Date();
  const target = new Date(deadline + 'T23:59:59');
  
  if (isNaN(target.getTime())) return 12;

  const yearDiff = target.getFullYear() - today.getFullYear();
  const monthDiff = target.getMonth() - today.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;

  // Se a meta é no mesmo mês mas dias à frente, ou vencida
  if (totalMonths <= 0) {
    const dayDiff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return dayDiff > 0 ? 1 : 0;
  }

  return totalMonths;
}

/**
 * Calcula o aporte mensal necessário dado o valor alvo, saldo inicial, meses e taxa anual
 */
export function calculateMonthlyDepositNeeded({
  targetAmount,
  currentAmount = 0,
  months = 12,
  annualRate = 10.5
}: {
  targetAmount: number;
  currentAmount?: number;
  months?: number;
  annualRate?: number;
}): GoalCalculationResult {
  const n = Math.max(1, months);
  const target = Math.max(0, targetAmount);
  const current = Math.max(0, currentAmount);

  // Sem juros
  const monthlyDepositNoInterest = Math.max(0, (target - current) / n);

  if (target <= current) {
    return {
      months: n,
      monthlyDeposit: 0,
      totalOutOfPocket: current,
      totalInterestEarned: 0,
      monthlyDepositNoInterest: 0,
      interestSavings: 0
    };
  }

  const rate = Math.max(0, annualRate) / 100;
  // Taxa mensal composta equivalente: i = (1 + r)^(1/12) - 1
  const monthlyRate = rate > 0 ? Math.pow(1 + rate, 1 / 12) - 1 : 0;

  if (monthlyRate <= 0) {
    const total = current + (monthlyDepositNoInterest * n);
    return {
      months: n,
      monthlyDeposit: Number(monthlyDepositNoInterest.toFixed(2)),
      totalOutOfPocket: Number(total.toFixed(2)),
      totalInterestEarned: 0,
      monthlyDepositNoInterest: Number(monthlyDepositNoInterest.toFixed(2)),
      interestSavings: 0
    };
  }

  // Valor futuro do saldo atual já investido: PV * (1 + i)^n
  const futureCurrent = current * Math.pow(1 + monthlyRate, n);

  if (futureCurrent >= target) {
    return {
      months: n,
      monthlyDeposit: 0,
      totalOutOfPocket: Number(current.toFixed(2)),
      totalInterestEarned: Number((futureCurrent - current).toFixed(2)),
      monthlyDepositNoInterest: Number(monthlyDepositNoInterest.toFixed(2)),
      interestSavings: Number((target - current).toFixed(2))
    };
  }

  // PMT = (FV - PV*(1+i)^n) / [ ((1+i)^n - 1) / i ]
  const numerator = target - futureCurrent;
  const denominator = (Math.pow(1 + monthlyRate, n) - 1) / monthlyRate;
  const pmt = numerator / denominator;

  const totalOutOfPocket = current + (pmt * n);
  const totalInterestEarned = Math.max(0, target - totalOutOfPocket);
  const interestSavings = Math.max(0, (monthlyDepositNoInterest * n) - (pmt * n));

  return {
    months: n,
    monthlyDeposit: Number(pmt.toFixed(2)),
    totalOutOfPocket: Number(totalOutOfPocket.toFixed(2)),
    totalInterestEarned: Number(totalInterestEarned.toFixed(2)),
    monthlyDepositNoInterest: Number(monthlyDepositNoInterest.toFixed(2)),
    interestSavings: Number(interestSavings.toFixed(2))
  };
}

/**
 * Calcula a taxa anual de rentabilidade necessária dado um aporte mensal que o usuário tem disponível
 */
export function calculateRequiredAnnualRate({
  targetAmount,
  currentAmount = 0,
  months = 12,
  monthlyDeposit
}: {
  targetAmount: number;
  currentAmount?: number;
  months?: number;
  monthlyDeposit: number;
}): RequiredRateResult {
  const n = Math.max(1, months);
  const target = Math.max(0, targetAmount);
  const current = Math.max(0, currentAmount);
  const pmt = Math.max(0, monthlyDeposit);

  // Se o aporte puro já atinge ou supera a meta
  if (current + (pmt * n) >= target) {
    return {
      requiredAnnualRate: 0,
      isAchievable: true,
      diagnosis: 'low',
      badgeColor: 'green',
      title: 'Aporte Suficiente Sem Depender de Juros',
      message: 'Com esse valor de aporte, você atingirá a meta mesmo sem depender de rentabilidade de investimentos!'
    };
  }

  if (pmt <= 0 && current <= 0) {
    return {
      requiredAnnualRate: 0,
      isAchievable: false,
      diagnosis: 'unrealistic',
      badgeColor: 'red',
      title: 'Aporte Necessário',
      message: 'Informe um valor de aporte mensal para calcular a taxa necessária.'
    };
  }

  // Busca binária para encontrar a taxa mensal composta i
  // Onde PV * (1 + i)^n + PMT * [((1 + i)^n - 1) / i] = target
  let low = 0;
  let high = 0.20; // até 20% ao mês
  let foundMonthlyRate = 0;

  for (let iter = 0; iter < 40; iter++) {
    const mid = (low + high) / 2;
    const fvCurrent = current * Math.pow(1 + mid, n);
    const fvDeposits = mid > 0 ? pmt * ((Math.pow(1 + mid, n) - 1) / mid) : pmt * n;
    const totalFv = fvCurrent + fvDeposits;

    if (totalFv < target) {
      low = mid;
    } else {
      high = mid;
    }
    foundMonthlyRate = mid;
  }

  // Converte a taxa mensal composta para anual: (1 + i)^12 - 1
  const annualRate = (Math.pow(1 + foundMonthlyRate, 12) - 1) * 100;
  const roundedAnnualRate = Number(annualRate.toFixed(2));

  if (roundedAnnualRate <= 11.5) {
    return {
      requiredAnnualRate: roundedAnnualRate,
      isAchievable: true,
      diagnosis: 'low',
      badgeColor: 'green',
      title: 'Meta Altamente Segura (CDI / Selic)',
      message: `Taxa de ${roundedAnnualRate}% a.a. é facilmente alcançável em investimentos conservadores de Renda Fixa (100% CDI, Tesouro Selic, CDBs com garantia FGC).`
    };
  }

  if (roundedAnnualRate <= 16) {
    return {
      requiredAnnualRate: roundedAnnualRate,
      isAchievable: true,
      diagnosis: 'moderate',
      badgeColor: 'blue',
      title: 'Carteira Moderada / Balanceada',
      message: `Taxa de ${roundedAnnualRate}% a.a. exige uma carteira bem balanceada, incluindo Fundos Imobiliários (FIIs), Renda Fixa IPCA+ e Ações de dividendos.`
    };
  }

  if (roundedAnnualRate <= 25) {
    return {
      requiredAnnualRate: roundedAnnualRate,
      isAchievable: false,
      diagnosis: 'high',
      badgeColor: 'yellow',
      title: 'Rentabilidade Agressiva',
      message: `Taxa de ${roundedAnnualRate}% a.a. é desafiadora no cenário atual. Exige alta exposição em Renda Variável ou recomenda-se aumentar o aporte mensal.`
    };
  }

  return {
    requiredAnnualRate: roundedAnnualRate,
    isAchievable: false,
    diagnosis: 'unrealistic',
    badgeColor: 'red',
    title: 'Prazo ou Aporte Muito Apertados',
    message: `Taxa exigida (${roundedAnnualRate}% a.a.) está fora de parâmetros seguros de mercado. Sugerimos ampliar o prazo da meta ou aumentar o aporte.`
  };
}

/**
 * Recomenda tipos de investimentos e estratégias com base no horizonte de tempo da meta
 */
export function getInvestmentRecommendation(months: number): InvestmentRecommendation {
  if (months <= 12) {
    return {
      horizon: 'curto',
      title: 'Curto Prazo (até 1 ano)',
      description: 'Priorize alta liquidez e segurança absoluta para garantir que seu dinheiro estará disponível sem risco de oscilações.',
      suggestions: [
        'CDB com liquidez diária (100% a 110% do CDI)',
        'Tesouro Selic (rendimento diário pós-fixado)',
        'LCI / LCA com carência curta (isentas de IR)',
        'Caixinha de Reserva de Emergência'
      ]
    };
  }

  if (months <= 36) {
    return {
      horizon: 'medio',
      title: 'Médio Prazo (1 a 3 anos)',
      description: 'Proteja o poder de compra da inflação e busque rentabilidades prefixadas vantajosas.',
      suggestions: [
        'Tesouro IPCA+ com vencimento no ano da meta',
        'CDBs prefixados com garantia FGC',
        'LCI / LCA de 2 a 3 anos isentas de IR',
        'CRIs / CRAs com boa classificação de risco'
      ]
    };
  }

  return {
    horizon: 'longo',
    title: 'Longo Prazo (acima de 3 anos)',
    description: 'Aproveite o poder exponencial dos juros compostos com ativos geradores de renda e crescimento.',
    suggestions: [
      'Fundos Imobiliários (FIIs) para proventos mensais reinvestidos',
      'Ações de empresas sólidas pagadoras de dividendos (B3)',
      'ETFs Globais / S&P 500 (IVV, VOO, VT)',
      'Tesouro IPCA+ longo ou Tesouro Renda+'
    ]
  };
}
