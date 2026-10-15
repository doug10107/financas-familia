// Utilitários de cálculo e templates para o módulo de Planejamento e Previsão de Gastos

export type PlanCategoryType = 
  | 'viagem' 
  | 'reforma' 
  | 'evento' 
  | 'veiculo' 
  | 'educacao' 
  | 'bebe' 
  | 'setup' 
  | 'personalizado';

export type CostType = 'fixo' | 'diario' | 'unitario';
export type ItemStatus = 'planejado' | 'reservado' | 'pago';

export interface ExpensePlanItem {
  id: string;
  plan_id?: string;
  category: string;
  name: string;
  cost_type: CostType;
  quantity: number; // dias, unidades ou pessoas
  unit_cost: number;
  original_currency: string;
  original_amount?: number;
  total_brl: number;
  status: ItemStatus;
  payment_method?: string;
  notes?: string;
  position?: number;
}

export interface ExpensePlan {
  id: string;
  family_id?: string;
  created_by?: string;
  title: string;
  description?: string;
  category_type: PlanCategoryType;
  icon: string;
  color: string;
  status: 'planejamento' | 'em_andamento' | 'concluido' | 'arquivado';
  
  // TrabeePocket Multi-moeda & Câmbio
  currency: string;
  exchange_rate: number;
  include_iof: boolean;
  iof_rate: number;
  contingency_percent: number; // Ex: 10%
  
  // Parâmetros do projeto
  days_count: number;
  people_count: number;
  
  // Capacidade de Aporte e Metas
  monthly_contribution_capacity: number;
  current_saved_amount: number;
  target_date?: string | null;
  estimated_completion_date?: string | null;
  goal_id?: string | null;
  
  items?: ExpensePlanItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CategorySummary {
  category: string;
  total: number;
  paid: number;
  percentage: number;
  itemCount: number;
  icon?: string;
  color?: string;
}

export interface PlanTotalsResult {
  subtotal: number;
  contingencyPercent: number;
  contingencyAmount: number;
  grandTotal: number;
  paidAmount: number;
  pendingAmount: number;
  savedAmount: number;
  remainingToSave: number;
  costPerPerson: number;
  costPerDay: number;
  paidPercentage: number;
  savedPercentage: number;
  categories: CategorySummary[];
}

export interface TargetDateResult {
  monthsNeededNoInterest: number;
  estimatedDateNoInterest: string; // YYYY-MM-DD
  formattedDateNoInterest: string; // "Março de 2027"
  monthsNeededWithInterest: number;
  estimatedDateWithInterest: string;
  formattedDateWithInterest: string;
  interestSaved: number;
  monthlyDepositNoInterest: number;
}

/**
 * Converte moeda para Real considerando taxa de câmbio e IOF opcional
 */
export function convertToBrl(
  amount: number,
  currency: string,
  exchangeRate: number,
  includeIof = false,
  iofRate = 4.38
): number {
  if (currency === 'BRL' || !currency) {
    return Number(amount.toFixed(2));
  }
  const base = amount * (exchangeRate || 1);
  const total = includeIof ? base * (1 + (iofRate || 0) / 100) : base;
  return Number(total.toFixed(2));
}

/**
 * Calcula o custo total de um item específico (fixo, diário ou unitário)
 */
export function calculateItemTotalBrl(
  item: Omit<ExpensePlanItem, 'id' | 'total_brl'>,
  exchangeRate: number,
  includeIof = false,
  iofRate = 4.38
): number {
  const qty = Math.max(1, item.quantity || 1);
  const cost = item.unit_cost || 0;
  const rawTotal = item.cost_type === 'fixo' ? cost : cost * qty;
  return convertToBrl(rawTotal, item.original_currency, exchangeRate, includeIof, iofRate);
}

/**
 * Totalização abrangente do plano de gastos
 */
export function calculatePlanTotals(
  plan: Pick<ExpensePlan, 'contingency_percent' | 'current_saved_amount' | 'people_count' | 'days_count'>,
  items: ExpensePlanItem[]
): PlanTotalsResult {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total_brl) || 0), 0);
  const contingencyPercent = Math.max(0, plan.contingency_percent || 0);
  const contingencyAmount = Number(((subtotal * contingencyPercent) / 100).toFixed(2));
  const grandTotal = Number((subtotal + contingencyAmount).toFixed(2));

  const paidAmount = items
    .filter((i) => i.status === 'pago')
    .reduce((sum, item) => sum + (Number(item.total_brl) || 0), 0);

  const pendingAmount = Math.max(0, grandTotal - paidAmount);
  const savedAmount = Math.max(0, Number(plan.current_saved_amount || 0));
  const remainingToSave = Math.max(0, Number((grandTotal - paidAmount - savedAmount).toFixed(2)));

  const people = Math.max(1, plan.people_count || 1);
  const days = Math.max(1, plan.days_count || 1);

  const costPerPerson = Number((grandTotal / people).toFixed(2));
  const costPerDay = Number((grandTotal / days).toFixed(2));

  const paidPercentage = grandTotal > 0 ? Math.min(100, Math.round((paidAmount / grandTotal) * 100)) : 0;
  const savedPercentage = grandTotal > 0 ? Math.min(100, Math.round(((paidAmount + savedAmount) / grandTotal) * 100)) : 0;

  // Agrupamento por categoria
  const categoryMap = new Map<string, { total: number; paid: number; count: number }>();
  for (const item of items) {
    const cat = item.category || 'Outros';
    const curr = categoryMap.get(cat) || { total: 0, paid: 0, count: 0 };
    curr.total += Number(item.total_brl) || 0;
    if (item.status === 'pago') curr.paid += Number(item.total_brl) || 0;
    curr.count += 1;
    categoryMap.set(cat, curr);
  }

  const categories: CategorySummary[] = Array.from(categoryMap.entries()).map(([cat, data]) => ({
    category: cat,
    total: Number(data.total.toFixed(2)),
    paid: Number(data.paid.toFixed(2)),
    percentage: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
    itemCount: data.count
  })).sort((a, b) => b.total - a.total);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    contingencyPercent,
    contingencyAmount,
    grandTotal,
    paidAmount: Number(paidAmount.toFixed(2)),
    pendingAmount: Number(pendingAmount.toFixed(2)),
    savedAmount,
    remainingToSave,
    costPerPerson,
    costPerDay,
    paidPercentage,
    savedPercentage,
    categories
  };
}

/**
 * Formata data no estilo "Outubro de 2027"
 */
function formatMonthYear(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Adiciona meses a uma data
 */
function addMonthsToDate(baseDate: Date, months: number): Date {
  const d = new Date(baseDate.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Calcula a data estimada de conclusão da meta com base no aporte mensal
 */
export function calculateTargetDateFromContribution(
  remainingToSave: number,
  monthlyContribution: number,
  annualYieldRate = 10.5
): TargetDateResult {
  const today = new Date();
  const target = Math.max(0, remainingToSave);
  const pmt = Math.max(1, monthlyContribution);

  if (target <= 0) {
    const todayIso = today.toISOString().split('T')[0];
    return {
      monthsNeededNoInterest: 0,
      estimatedDateNoInterest: todayIso,
      formattedDateNoInterest: 'Já atingido!',
      monthsNeededWithInterest: 0,
      estimatedDateWithInterest: todayIso,
      formattedDateWithInterest: 'Já atingido!',
      interestSaved: 0,
      monthlyDepositNoInterest: 0
    };
  }

  // 1. Sem juros (Poupança simples)
  const monthsNoInterest = Math.ceil(target / pmt);
  const targetDateNoInterest = addMonthsToDate(today, monthsNoInterest);

  // 2. Com juros compostos (100% CDI / Renda Fixa)
  const rate = Math.max(0, annualYieldRate) / 100;
  const monthlyRate = rate > 0 ? Math.pow(1 + rate, 1 / 12) - 1 : 0;

  let monthsWithInterest = monthsNoInterest;
  let accumulated = 0;

  if (monthlyRate > 0) {
    for (let m = 1; m <= 600; m++) {
      accumulated = (accumulated + pmt) * (1 + monthlyRate);
      if (accumulated >= target) {
        monthsWithInterest = m;
        break;
      }
    }
  }

  const targetDateWithInterest = addMonthsToDate(today, monthsWithInterest);
  const totalPaidWithInterest = monthsWithInterest * pmt;
  const interestSaved = Math.max(0, Number((target - totalPaidWithInterest).toFixed(2)));

  return {
    monthsNeededNoInterest: monthsNoInterest,
    estimatedDateNoInterest: targetDateNoInterest.toISOString().split('T')[0],
    formattedDateNoInterest: formatMonthYear(targetDateNoInterest),
    monthsNeededWithInterest: monthsWithInterest,
    estimatedDateWithInterest: targetDateWithInterest.toISOString().split('T')[0],
    formattedDateWithInterest: formatMonthYear(targetDateWithInterest),
    interestSaved,
    monthlyDepositNoInterest: pmt
  };
}

/**
 * Calcula o aporte mensal necessário dado um prazo alvo fixo
 */
export function calculateMonthlyDepositFromTargetDate(
  remainingToSave: number,
  targetDateStr: string,
  annualYieldRate = 10.5
): { monthlyDeposit: number; monthsRemaining: number; isAchievable: boolean } {
  const today = new Date();
  const target = new Date(targetDateStr + 'T23:59:59');

  if (isNaN(target.getTime())) {
    return { monthlyDeposit: remainingToSave, monthsRemaining: 1, isAchievable: true };
  }

  const yearDiff = target.getFullYear() - today.getFullYear();
  const monthDiff = target.getMonth() - today.getMonth();
  const totalMonths = Math.max(1, yearDiff * 12 + monthDiff);

  if (remainingToSave <= 0) {
    return { monthlyDeposit: 0, monthsRemaining: totalMonths, isAchievable: true };
  }

  // Com taxa composta
  const rate = Math.max(0, annualYieldRate) / 100;
  const monthlyRate = rate > 0 ? Math.pow(1 + rate, 1 / 12) - 1 : 0;

  if (monthlyRate <= 0) {
    return {
      monthlyDeposit: Number((remainingToSave / totalMonths).toFixed(2)),
      monthsRemaining: totalMonths,
      isAchievable: true
    };
  }

  // PMT = FV / [ ((1+i)^n - 1) / i ]
  const denominator = (Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate;
  const pmt = remainingToSave / denominator;

  return {
    monthlyDeposit: Number(pmt.toFixed(2)),
    monthsRemaining: totalMonths,
    isAchievable: pmt > 0
  };
}

/**
 * TEMPLATES PRONTOS:
 * Viagem, Reforma, Casamento, Compra de Carro, Intercâmbio, Chegada do Bebê, Setup de Trabalho
 */
export interface PlanTemplate {
  category_type: PlanCategoryType;
  title: string;
  description: string;
  icon: string;
  color: string;
  defaultDays: number;
  defaultPeople: number;
  contingencyPercent: number;
  items: Omit<ExpensePlanItem, 'id' | 'total_brl'>[];
}

export const PLAN_TEMPLATES: Record<PlanCategoryType, PlanTemplate> = {
  viagem: {
    category_type: 'viagem',
    title: 'Férias / Viagem em Família',
    description: 'Planejamento completo com passagens, hospedagem, transporte, alimentação diária e passeios.',
    icon: 'flight_takeoff',
    color: '#0ea5e9',
    defaultDays: 7,
    defaultPeople: 2,
    contingencyPercent: 10,
    items: [
      // Passagens
      { category: 'Passagens & Aéreo', name: 'Passagens Aéreas (Ida e Volta)', cost_type: 'unitario', quantity: 2, unit_cost: 1600, original_currency: 'BRL', original_amount: 1600, status: 'planejado' },
      { category: 'Passagens & Aéreo', name: 'Taxas de Embarque / Bagagens extras', cost_type: 'fixo', quantity: 1, unit_cost: 350, original_currency: 'BRL', original_amount: 350, status: 'planejado' },
      
      // Hospedagem
      { category: 'Hospedagem', name: 'Hotel / Airbnb (Diárias)', cost_type: 'diario', quantity: 7, unit_cost: 420, original_currency: 'BRL', original_amount: 420, status: 'planejado' },
      
      // Transporte Local
      { category: 'Transporte', name: 'Carro Alugado (Locação)', cost_type: 'diario', quantity: 7, unit_cost: 180, original_currency: 'BRL', original_amount: 180, status: 'planejado' },
      { category: 'Transporte', name: 'Gasolina / Combustível estimado', cost_type: 'fixo', quantity: 1, unit_cost: 450, original_currency: 'BRL', original_amount: 450, status: 'planejado' },
      { category: 'Transporte', name: 'Pedágios e Estacionamento', cost_type: 'fixo', quantity: 1, unit_cost: 150, original_currency: 'BRL', original_amount: 150, status: 'planejado' },
      { category: 'Transporte', name: 'Translado / Transfer Aeroporto', cost_type: 'fixo', quantity: 1, unit_cost: 200, original_currency: 'BRL', original_amount: 200, status: 'planejado' },
      { category: 'Transporte', name: 'Táxi / Uber / Ônibus local', cost_type: 'fixo', quantity: 1, unit_cost: 250, original_currency: 'BRL', original_amount: 250, status: 'planejado' },

      // Alimentação Diária (TrabeePocket style)
      { category: 'Alimentação', name: 'Alimentação Diária (Almoço, Jantar e Lanches)', cost_type: 'diario', quantity: 7, unit_cost: 220, original_currency: 'BRL', original_amount: 220, status: 'planejado' },
      { category: 'Alimentação', name: 'Experiência Gastronômica / Restaurante Especial', cost_type: 'fixo', quantity: 1, unit_cost: 500, original_currency: 'BRL', original_amount: 500, status: 'planejado' },

      // Passeios & Ingressos
      { category: 'Passeios & Atrações', name: 'Ingressos de Parques / Museus / Atrações', cost_type: 'unitario', quantity: 2, unit_cost: 450, original_currency: 'BRL', original_amount: 450, status: 'planejado' },
      { category: 'Passeios & Atrações', name: 'Passeio Turístico Guiado / Barco', cost_type: 'unitario', quantity: 2, unit_cost: 200, original_currency: 'BRL', original_amount: 200, status: 'planejado' },

      // Seguros & Documentação
      { category: 'Seguros & Documentos', name: 'Seguro Viagem / Saúde', cost_type: 'unitario', quantity: 2, unit_cost: 190, original_currency: 'BRL', original_amount: 190, status: 'planejado' },
      { category: 'Seguros & Documentos', name: 'Chip Internacional / eSIM de Internet', cost_type: 'unitario', quantity: 2, unit_cost: 120, original_currency: 'BRL', original_amount: 120, status: 'planejado' },

      // Compras
      { category: 'Compras & Lembranças', name: 'Lembrancinhas e Presentes', cost_type: 'fixo', quantity: 1, unit_cost: 400, original_currency: 'BRL', original_amount: 400, status: 'planejado' }
    ]
  },

  reforma: {
    category_type: 'reforma',
    title: 'Reforma da Casa / Apartamento',
    description: 'Previsão de mão de obra, materiais, acabamentos, pisos, móveis planejados e contingência.',
    icon: 'home_repair_service',
    color: '#f59e0b',
    defaultDays: 30,
    defaultPeople: 1,
    contingencyPercent: 15,
    items: [
      { category: 'Mão de Obra', name: 'Empreiteiro / Pedreiro (Mão de Obra Geral)', cost_type: 'fixo', quantity: 1, unit_cost: 8500, original_currency: 'BRL', original_amount: 8500, status: 'planejado' },
      { category: 'Mão de Obra', name: 'Eletricista e Encanador', cost_type: 'fixo', quantity: 1, unit_cost: 2400, original_currency: 'BRL', original_amount: 2400, status: 'planejado' },
      { category: 'Mão de Obra', name: 'Pintor e Acabamentos', cost_type: 'fixo', quantity: 1, unit_cost: 3200, original_currency: 'BRL', original_amount: 3200, status: 'planejado' },
      
      { category: 'Materiais Brutos', name: 'Cimento, Areia, Tubos, Cabos Elétricos', cost_type: 'fixo', quantity: 1, unit_cost: 4000, original_currency: 'BRL', original_amount: 4000, status: 'planejado' },
      { category: 'Acabamentos', name: 'Porcelanato / Pisos e Revestimentos', cost_type: 'fixo', quantity: 1, unit_cost: 5800, original_currency: 'BRL', original_amount: 5800, status: 'planejado' },
      { category: 'Acabamentos', name: 'Louças, Metais e Torneiras', cost_type: 'fixo', quantity: 1, unit_cost: 2600, original_currency: 'BRL', original_amount: 2600, status: 'planejado' },
      { category: 'Acabamentos', name: 'Tintas, Massas e Texturas', cost_type: 'fixo', quantity: 1, unit_cost: 1800, original_currency: 'BRL', original_amount: 1800, status: 'planejado' },

      { category: 'Marcenaria & Móveis', name: 'Armários Planejados (Cozinha/Quarto)', cost_type: 'fixo', quantity: 1, unit_cost: 12000, original_currency: 'BRL', original_amount: 12000, status: 'planejado' },
      { category: 'Iluminação & Decor', name: 'Luminárias, Spots LED e Lustres', cost_type: 'fixo', quantity: 1, unit_cost: 1500, original_currency: 'BRL', original_amount: 1500, status: 'planejado' },
      { category: 'Serviços Extras', name: 'Caçamba de Entulho e Limpeza Pós-Obra', cost_type: 'fixo', quantity: 1, unit_cost: 950, original_currency: 'BRL', original_amount: 950, status: 'planejado' }
    ]
  },

  evento: {
    category_type: 'evento',
    title: 'Casamento / Grande Celebração',
    description: 'Espaço, buffet por convidado, fotografia, decoração, trajes e cerimonial.',
    icon: 'celebration',
    color: '#ec4899',
    defaultDays: 1,
    defaultPeople: 100, // 100 convidados
    contingencyPercent: 10,
    items: [
      { category: 'Espaço & Buffet', name: 'Locação do Espaço / Salão', cost_type: 'fixo', quantity: 1, unit_cost: 8000, original_currency: 'BRL', original_amount: 8000, status: 'planejado' },
      { category: 'Espaço & Buffet', name: 'Buffet Completo por Convidado', cost_type: 'unitario', quantity: 100, unit_cost: 160, original_currency: 'BRL', original_amount: 160, status: 'planejado' },
      { category: 'Espaço & Buffet', name: 'Bolo e Doces Finos', cost_type: 'fixo', quantity: 1, unit_cost: 2500, original_currency: 'BRL', original_amount: 2500, status: 'planejado' },
      
      { category: 'Foto & Vídeo', name: 'Fotografia, Filmagem e Pré-Wedding', cost_type: 'fixo', quantity: 1, unit_cost: 6500, original_currency: 'BRL', original_amount: 6500, status: 'planejado' },
      
      { category: 'Decoração & Som', name: 'Decoração Floral e Cenografia', cost_type: 'fixo', quantity: 1, unit_cost: 7000, original_currency: 'BRL', original_amount: 7000, status: 'planejado' },
      { category: 'Decoração & Som', name: 'DJ, Iluminação de Pista e Sonorização', cost_type: 'fixo', quantity: 1, unit_cost: 3200, original_currency: 'BRL', original_amount: 3200, status: 'planejado' },

      { category: 'Trajes & Beleza', name: 'Vestido de Noiva, Terno e Acessórios', cost_type: 'fixo', quantity: 1, unit_cost: 4500, original_currency: 'BRL', original_amount: 4500, status: 'planejado' },
      { category: 'Trajes & Beleza', name: 'Dia da Noiva / Cabelo e Maquiagem', cost_type: 'fixo', quantity: 1, unit_cost: 1800, original_currency: 'BRL', original_amount: 1800, status: 'planejado' },

      { category: 'Assessoria', name: 'Assessoria Cerimonial do Dia', cost_type: 'fixo', quantity: 1, unit_cost: 2800, original_currency: 'BRL', original_amount: 2800, status: 'planejado' },
      { category: 'Papelaria', name: 'Convites Físicos, Digitais e Lembrancinhas', cost_type: 'fixo', quantity: 1, unit_cost: 1200, original_currency: 'BRL', original_amount: 1200, status: 'planejado' }
    ]
  },

  veiculo: {
    category_type: 'veiculo',
    title: 'Compra ou Troca de Veículo',
    description: 'Entrada, taxas de transferência, IPVA, seguro automotivo e primeira revisão preventiva.',
    icon: 'directions_car',
    color: '#8b5cf6',
    defaultDays: 1,
    defaultPeople: 1,
    contingencyPercent: 5,
    items: [
      { category: 'Aquisição', name: 'Valor da Entrada à Vista do Veículo', cost_type: 'fixo', quantity: 1, unit_cost: 30000, original_currency: 'BRL', original_amount: 30000, status: 'planejado' },
      { category: 'Documentação', name: 'Despachante, Transferência e Laudo Cautelar', cost_type: 'fixo', quantity: 1, unit_cost: 950, original_currency: 'BRL', original_amount: 950, status: 'planejado' },
      { category: 'Documentação', name: 'IPVA e Licenciamento Proporcional', cost_type: 'fixo', quantity: 1, unit_cost: 2200, original_currency: 'BRL', original_amount: 2200, status: 'planejado' },
      { category: 'Seguro', name: 'Seguro Automotivo Completo (Anuidade)', cost_type: 'fixo', quantity: 1, unit_cost: 3200, original_currency: 'BRL', original_amount: 3200, status: 'planejado' },
      { category: 'Manutenção', name: 'Primeira Revisão Preventiva (Óleo, Filtros, Correias)', cost_type: 'fixo', quantity: 1, unit_cost: 1400, original_currency: 'BRL', original_amount: 1400, status: 'planejado' },
      { category: 'Acessórios', name: 'Insulfilm, Tapetes e Proteção de Pintura', cost_type: 'fixo', quantity: 1, unit_cost: 750, original_currency: 'BRL', original_amount: 750, status: 'planejado' }
    ]
  },

  educacao: {
    category_type: 'educacao',
    title: 'Intercâmbio / Pós-Graduação',
    description: 'Matrícula, visto, passagens, acomodação de estudante e custo de vida no exterior.',
    icon: 'school',
    color: '#10b981',
    defaultDays: 90,
    defaultPeople: 1,
    contingencyPercent: 10,
    items: [
      { category: 'Curso & Matrícula', name: 'Matrícula e Curso / Especialização', cost_type: 'fixo', quantity: 1, unit_cost: 15000, original_currency: 'BRL', original_amount: 15000, status: 'planejado' },
      { category: 'Viagem & Visto', name: 'Passagens Aéreas Internacionais (Ida e Volta)', cost_type: 'fixo', quantity: 1, unit_cost: 5200, original_currency: 'BRL', original_amount: 5200, status: 'planejado' },
      { category: 'Viagem & Visto', name: 'Taxa Consular do Visto e Tradução Juramentada', cost_type: 'fixo', quantity: 1, unit_cost: 1800, original_currency: 'BRL', original_amount: 1800, status: 'planejado' },
      { category: 'Acomodação', name: 'Acomodação Estudantil (Aluguel 3 meses)', cost_type: 'unitario', quantity: 3, unit_cost: 3200, original_currency: 'BRL', original_amount: 3200, status: 'planejado' },
      { category: 'Custo de Vida', name: 'Custo de Vida Mensal (Alimentação e Transporte)', cost_type: 'unitario', quantity: 3, unit_cost: 2500, original_currency: 'BRL', original_amount: 2500, status: 'planejado' },
      { category: 'Seguros', name: 'Seguro Saúde Estudantil Obrigatório', cost_type: 'fixo', quantity: 1, unit_cost: 1400, original_currency: 'BRL', original_amount: 1400, status: 'planejado' }
    ]
  },

  bebe: {
    category_type: 'bebe',
    title: 'Chegada do Bebê & Enxoval',
    description: 'Móveis do quartinho, carrinho de bebê, roupinhas, fraldas e custos hospitalares.',
    icon: 'child_care',
    color: '#f43f5e',
    defaultDays: 1,
    defaultPeople: 1,
    contingencyPercent: 10,
    items: [
      { category: 'Quarto & Mobília', name: 'Berço, Colchão e Cômoda Trocador', cost_type: 'fixo', quantity: 1, unit_cost: 2800, original_currency: 'BRL', original_amount: 2800, status: 'planejado' },
      { category: 'Quarto & Mobília', name: 'Poltrona de Amamentação e Decoração', cost_type: 'fixo', quantity: 1, unit_cost: 1500, original_currency: 'BRL', original_amount: 1500, status: 'planejado' },
      { category: 'Passeio', name: 'Carrinho de Bebê com Bebê Conforto Acoplável', cost_type: 'fixo', quantity: 1, unit_cost: 2400, original_currency: 'BRL', original_amount: 2400, status: 'planejado' },
      { category: 'Enxoval & Roupas', name: 'Lote de Roupas (Body, Macacões RN a 6 meses)', cost_type: 'fixo', quantity: 1, unit_cost: 1800, original_currency: 'BRL', original_amount: 1800, status: 'planejado' },
      { category: 'Higiene & Cuidados', name: 'Estoque de Fraldas e Itens de Higiene (3 meses)', cost_type: 'fixo', quantity: 1, unit_cost: 1200, original_currency: 'BRL', original_amount: 1200, status: 'planejado' },
      { category: 'Maternidade', name: 'Taxas Hospitalares / Equipe de Parto / Consultas Extras', cost_type: 'fixo', quantity: 1, unit_cost: 3500, original_currency: 'BRL', original_amount: 3500, status: 'planejado' }
    ]
  },

  setup: {
    category_type: 'setup',
    title: 'Setup Home Office / Tecnologia',
    description: 'Equipamentos de alta performance, ergonomia, monitores e periféricos para produtividade.',
    icon: 'desktop_windows',
    color: '#3b82f6',
    defaultDays: 1,
    defaultPeople: 1,
    contingencyPercent: 5,
    items: [
      { category: 'Computador', name: 'Notebook / Computador de Alta Performance', cost_type: 'fixo', quantity: 1, unit_cost: 6500, original_currency: 'BRL', original_amount: 6500, status: 'planejado' },
      { category: 'Monitores', name: 'Monitor Ultrawide 4K / Duplo Monitor', cost_type: 'fixo', quantity: 1, unit_cost: 2200, original_currency: 'BRL', original_amount: 2200, status: 'planejado' },
      { category: 'Ergonomia', name: 'Cadeira Ergonômica Presidente com NR-17', cost_type: 'fixo', quantity: 1, unit_cost: 1800, original_currency: 'BRL', original_amount: 1800, status: 'planejado' },
      { category: 'Ergonomia', name: 'Mesa com Regulagem Elétrica de Altura (Standing Desk)', cost_type: 'fixo', quantity: 1, unit_cost: 2100, original_currency: 'BRL', original_amount: 2100, status: 'planejado' },
      { category: 'Periféricos', name: 'Teclado Mecânico, Mouse Ergonômico Vertical e Headset', cost_type: 'fixo', quantity: 1, unit_cost: 1200, original_currency: 'BRL', original_amount: 1200, status: 'planejado' },
      { category: 'Iluminação', name: 'Luminária de Monitor (Lightbar) e WebCam Full HD', cost_type: 'fixo', quantity: 1, unit_cost: 650, original_currency: 'BRL', original_amount: 650, status: 'planejado' }
    ]
  },

  personalizado: {
    category_type: 'personalizado',
    title: 'Projeto Personalizado',
    description: 'Crie seu próprio planejamento personalizado com itens e categorias livres.',
    icon: 'draw',
    color: '#64748b',
    defaultDays: 1,
    defaultPeople: 1,
    contingencyPercent: 10,
    items: [
      { category: 'Geral', name: 'Item Principal 1', cost_type: 'fixo', quantity: 1, unit_cost: 1000, original_currency: 'BRL', original_amount: 1000, status: 'planejado' }
    ]
  }
};
