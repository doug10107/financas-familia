/**
 * Utilitários para cálculo de datas de fechamento e vencimento de faturas de cartão de crédito.
 */

export interface CreditCardConfig {
  closing_day: number;
  due_day: number;
}

/**
 * Calcula a data exata de vencimento da fatura à qual pertence uma compra.
 * 
 * @param purchaseDate Data em que a compra foi realizada (Date ou string YYYY-MM-DD)
 * @param closingDay Dia do mês em que a fatura fecha (ex: 10)
 * @param dueDay Dia do mês em que a fatura vence (ex: 17)
 * @param installmentOffset Deslocamento de parcela (0 para 1ª parcela, 1 para 2ª, etc.)
 */
export function calculateInvoiceDueDate(
  purchaseDate: Date | string,
  closingDay: number,
  dueDay: number,
  installmentOffset: number = 0
): Date {
  const pDate = typeof purchaseDate === 'string' 
    ? new Date(purchaseDate.includes('T') ? purchaseDate : `${purchaseDate}T12:00:00`)
    : new Date(purchaseDate);

  const pYear = pDate.getFullYear();
  const pMonth = pDate.getMonth(); // 0 a 11
  const pDay = pDate.getDate();

  const safeClosing = Math.max(1, Math.min(31, Number(closingDay) || 1));
  const safeDue = Math.max(1, Math.min(31, Number(dueDay) || 1));

  let invoiceMonth = pMonth;
  let invoiceYear = pYear;

  // Se a compra ocorreu no dia ou após o fechamento, ela entra na fatura do mês seguinte
  if (pDay >= safeClosing) {
    invoiceMonth++;
  }

  // Adiciona o offset da parcela (ex: 2ª parcela = +1 mês, etc.)
  invoiceMonth += installmentOffset;

  // Normaliza o ano se ultrapassar Dezembro
  while (invoiceMonth > 11) {
    invoiceMonth -= 12;
    invoiceYear++;
  }

  // Se o dia de vencimento for menor que o de fechamento (ex: fecha dia 25, vence dia 05),
  // o vencimento ocorre no mês seguinte ao fechamento.
  let finalDueMonth = invoiceMonth;
  if (safeDue < safeClosing) {
    finalDueMonth++;
    if (finalDueMonth > 11) {
      finalDueMonth = 0;
      invoiceYear++;
    }
  }

  const maxDays = new Date(invoiceYear, finalDueMonth + 1, 0).getDate();
  const safeDueDay = Math.min(safeDue, maxDays);

  return new Date(invoiceYear, finalDueMonth, safeDueDay, 12, 0, 0);
}

/**
 * Retorna a chave do mês ("YYYY-MM") no qual a fatura da transação vence.
 */
export function getInvoiceMonthKey(
  purchaseDate: Date | string,
  closingDay: number,
  dueDay: number,
  installmentOffset: number = 0
): string {
  const dueDate = calculateInvoiceDueDate(purchaseDate, closingDay, dueDay, installmentOffset);
  const y = dueDate.getFullYear();
  const m = String(dueDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Retorna a data em formato string ISO ("YYYY-MM-DD") do vencimento da fatura.
 */
export function getInvoiceDueDateString(
  purchaseDate: Date | string,
  closingDay: number,
  dueDay: number,
  installmentOffset: number = 0
): string {
  const dueDate = calculateInvoiceDueDate(purchaseDate, closingDay, dueDay, installmentOffset);
  const y = dueDate.getFullYear();
  const m = String(dueDate.getMonth() + 1).padStart(2, '0');
  const d = String(dueDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
