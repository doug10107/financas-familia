// Formatação de valores monetários em Real Brasileiro
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatação de datas no padrão brasileiro
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateLong(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatMonthYear(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

// Formatação de porcentagem
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

// Dias relativos ("hoje", "amanhã", "em 3 dias")
export function formatRelativeDays(days: number): string {
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''} atrás`;
  return `Em ${days} dia${days > 1 ? 's' : ''}`;
}
