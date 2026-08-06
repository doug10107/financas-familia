export const APP_NAME = 'Finanças Família Menezes';
export const APP_DESCRIPTION = 'Controle financeiro familiar inteligente';

export const TRANSACTION_TYPES = {
  receita: { label: 'Receita', color: 'text-emerald-600 dark:text-emerald-400' },
  despesa: { label: 'Despesa', color: 'text-red-600 dark:text-red-400' },
} as const;

export const TRANSACTION_STATUS = {
  pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
} as const;

export const GOAL_STATUS = {
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
} as const;

export const INVESTMENT_ENTRY_TYPES = {
  aporte: { label: 'Aporte', color: 'text-emerald-600 dark:text-emerald-400' },
  resgate: { label: 'Resgate', color: 'text-red-600 dark:text-red-400' },
  rendimento: { label: 'Rendimento', color: 'text-blue-600 dark:text-blue-400' },
} as const;

export const ITEMS_PER_PAGE = 20;
