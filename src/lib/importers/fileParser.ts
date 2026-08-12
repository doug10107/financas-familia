import Papa from 'papaparse';
import { Category, Transaction } from '@/hooks/useTransactions';

export type ExtractedItem = {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'receita' | 'despesa';
  suggestedCategoryId: string | null;
  selected: boolean;
  isDuplicate?: boolean;
};

// Categorization helper
export function suggestCategory(description: string, categories: Category[], type: 'receita' | 'despesa'): string | null {
  const descUpper = description.toUpperCase();

  const rules: { keywords: string[]; categoryName: string }[] = [
    { keywords: ['UBER', '99APP', 'POSTO', 'SHELL', 'IPVA', 'MECANICO', 'PEDAGIO', 'ESTACIONAMENTO'], categoryName: 'Transporte' },
    { keywords: ['IFOOD', 'RAPPI', 'RESTAURANTE', 'MERCADO', 'SUPERMERCADO', 'PADARIA', 'CARREFOUR', 'EXTRA', 'ASSAI', 'ATACADAO', 'OUTBACK', 'MC DONALD', 'BURGER KING', 'CAFETERIA'], categoryName: 'Alimentação' },
    { keywords: ['NETFLIX', 'SPOTIFY', 'AMAZON', 'PRIME', 'STEAM', 'CINEMA', 'INGRESSO', 'DISNEY', 'HBO', 'BAR', 'PUB'], categoryName: 'Lazer' },
    { keywords: ['ALUGUEL', 'CONDOMINIO', 'ENERGIA', 'LUZ', 'AGUA', 'SABESP', 'ENEL', 'CLARO', 'VIVO', 'TIM', 'INTERNET'], categoryName: 'Moradia' },
    { keywords: ['FARMACIA', 'DROGARIA', 'DROGASIL', 'MEDICO', 'CONSULTA', 'EXAME', 'HOSPITAL', 'DENTISTA'], categoryName: 'Saúde' },
    { keywords: ['FACULDADE', 'ESCOLA', 'CURSO', 'UDEMY', 'LIVRARIA', 'EDUCACAO'], categoryName: 'Educação' },
    { keywords: ['SALARIO', 'PROVENTO', 'FOLHA', 'PIX RECEBIDO', 'DEPOSITO', 'RENDIMENTO', 'TRANSFERENCIA RECEBIDA'], categoryName: 'Salário' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => descUpper.includes(k))) {
      const found = categories.find(c => c.name.toLowerCase() === rule.categoryName.toLowerCase());
      if (found) return found.id;
    }
  }

  // Fallback to first matching type
  const fallback = categories.find(c => c.type === type || c.type === 'ambos');
  return fallback ? fallback.id : (categories[0]?.id || null);
}

// Check duplicates against existing transactions
export function detectDuplicates(newItems: ExtractedItem[], existingTransactions: Transaction[]): ExtractedItem[] {
  return newItems.map(item => {
    const isDup = existingTransactions.some(existing => {
      const sameDate = existing.date === item.date;
      const sameAmount = Math.abs(Number(existing.amount) - Math.abs(item.amount)) < 0.01;
      const descSimilarity = existing.description.toLowerCase().includes(item.description.toLowerCase().slice(0, 8)) ||
                             item.description.toLowerCase().includes(existing.description.toLowerCase().slice(0, 8));
      return sameDate && sameAmount && descSimilarity;
    });

    return {
      ...item,
      isDuplicate: isDup,
      selected: !isDup // Uncheck duplicates by default
    };
  });
}

// 1. OFX Parser
export function parseOFXText(ofxContent: string, categories: Category[]): ExtractedItem[] {
  const items: ExtractedItem[] = [];

  // Standard OFX Regex for STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  let count = 0;
  while ((match = trnRegex.exec(ofxContent)) !== null) {
    count++;
    const block = match[1];

    const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/i);
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i) || block.match(/<NAME>([^<\r\n]+)/i);

    if (amountMatch && dateMatch) {
      const rawAmount = parseFloat(amountMatch[1].replace(',', '.'));
      const rawDate = dateMatch[1]; // YYYYMMDD
      const year = rawDate.substring(0, 4);
      const month = rawDate.substring(4, 6);
      const day = rawDate.substring(6, 8);
      const dateStr = `${year}-${month}-${day}`;

      const rawMemo = memoMatch ? memoMatch[1].trim() : `Lançamento ${count}`;
      const isExpense = rawAmount < 0;
      const absAmount = Math.abs(rawAmount);
      const type: 'receita' | 'despesa' = isExpense ? 'despesa' : 'receita';

      items.push({
        id: `ofx-${count}-${Date.now()}`,
        date: dateStr,
        description: rawMemo,
        amount: absAmount,
        type,
        suggestedCategoryId: suggestCategory(rawMemo, categories, type),
        selected: true
      });
    }
  }

  // Fallback for SGML non-closing tags in older OFX formats
  if (items.length === 0) {
    const lines = ofxContent.split('\n');
    let currentDate = '';
    let currentAmount = 0;
    let currentMemo = '';

    lines.forEach((line, index) => {
      if (line.includes('<DTPOSTED>')) {
        const val = line.replace(/<DTPOSTED>/i, '').trim().substring(0, 8);
        if (val.length === 8) {
          currentDate = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
        }
      } else if (line.includes('<TRNAMT>')) {
        const val = line.replace(/<TRNAMT>/i, '').trim();
        currentAmount = parseFloat(val.replace(',', '.'));
      } else if (line.includes('<MEMO>') || line.includes('<NAME>')) {
        currentMemo = line.replace(/<MEMO>|<NAME>/gi, '').trim();
      }

      if (currentDate && currentAmount !== 0 && currentMemo && (line.includes('</STMTTRN>') || line.includes('<STMTTRN>') || index === lines.length - 1)) {
        const isExpense = currentAmount < 0;
        const absAmount = Math.abs(currentAmount);
        const type: 'receita' | 'despesa' = isExpense ? 'despesa' : 'receita';

        items.push({
          id: `ofx-sgml-${items.length + 1}-${Date.now()}`,
          date: currentDate,
          description: currentMemo,
          amount: absAmount,
          type,
          suggestedCategoryId: suggestCategory(currentMemo, categories, type),
          selected: true
        });

        currentDate = '';
        currentAmount = 0;
        currentMemo = '';
      }
    });
  }

  return items;
}

// 2. CSV Parser
export function parseCSVText(csvContent: string, categories: Category[]): ExtractedItem[] {
  const items: ExtractedItem[] = [];

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  const rows = parsed.data as any[];

  rows.forEach((row, index) => {
    // Find date, description, and amount keys regardless of exact column title
    const keys = Object.keys(row);
    const dateKey = keys.find(k => /data|date|dia/i.test(k));
    const descKey = keys.find(k => /descri|historico|memo|estabelecimento|title|detalhes/i.test(k));
    const amountKey = keys.find(k => /valor|amount|val/i.test(k));

    if (dateKey && descKey && amountKey && row[dateKey] && row[amountKey]) {
      let rawDate = String(row[dateKey]).trim();
      // Format DD/MM/YYYY to YYYY-MM-DD
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          rawDate = `${year}-${month}-${day}`;
        }
      }

      let rawAmountStr = String(row[amountKey]).replace('R$', '').replace(/\s/g, '').trim();
      // Replace Brazilian decimal separator
      if (rawAmountStr.includes(',') && rawAmountStr.includes('.')) {
        rawAmountStr = rawAmountStr.replace(/\./g, '').replace(',', '.');
      } else if (rawAmountStr.includes(',')) {
        rawAmountStr = rawAmountStr.replace(',', '.');
      }

      const numVal = parseFloat(rawAmountStr);

      if (!isNaN(numVal) && numVal !== 0) {
        const isExpense = numVal < 0 || (row['Tipo'] && /saida|despesa|debito/i.test(row['Tipo']));
        const absAmount = Math.abs(numVal);
        const type: 'receita' | 'despesa' = isExpense ? 'despesa' : 'receita';
        const desc = String(row[descKey]).trim();

        items.push({
          id: `csv-${index + 1}-${Date.now()}`,
          date: rawDate,
          description: desc,
          amount: absAmount,
          type,
          suggestedCategoryId: suggestCategory(desc, categories, type),
          selected: true
        });
      }
    }
  });

  return items;
}

// 3. PDF Parser (Dynamic Import of pdfjs-dist)
export async function parsePDFFile(file: File, categories: Category[]): Promise<ExtractedItem[]> {
  const items: ExtractedItem[] = [];

  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Set worker src
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    let fullTextLines: string[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let lineText = '';

      textContent.items.forEach((item: any) => {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          if (lineText.trim()) fullTextLines.push(lineText.trim());
          lineText = '';
        }
        lineText += ' ' + item.str;
        lastY = item.transform[5];
      });

      if (lineText.trim()) fullTextLines.push(lineText.trim());
    }

    // Regex patterns for transaction lines in Brazilian bank PDFs
    // Example: 15/08 Supermercado Extra R$ 150,00 or 15/08/2026 - R$ 89,90 - IFOOD
    const lineRegex = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*?)\s+(?:R\$\s*)?(-?\s*\d{1,3}(?:\.\d{3})*,\d{2})|(\d{2}\/\d{2})\s+(.*?)\s+(-?\d+[.,]\d{2})/i;
    const currentYear = new Date().getFullYear();

    fullTextLines.forEach((line, index) => {
      const match = line.match(lineRegex);
      if (match) {
        const rawDate = match[1] || match[4];
        const rawDesc = (match[2] || match[5] || '').trim();
        const rawAmountStr = match[3] || match[6];

        if (rawDate && rawDesc && rawAmountStr && !/saldo|pagamento efetuado|subtotal|total/i.test(rawDesc)) {
          let dateStr = '';
          const dateParts = rawDate.split('/');
          const day = dateParts[0].padStart(2, '0');
          const month = dateParts[1].padStart(2, '0');
          const year = dateParts[2] ? (dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2]) : String(currentYear);
          dateStr = `${year}-${month}-${day}`;

          const cleanAmountStr = rawAmountStr.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
          const numVal = parseFloat(cleanAmountStr);

          if (!isNaN(numVal) && numVal !== 0) {
            const isExpense = numVal < 0 || !/pix recebido|deposito|credito/i.test(rawDesc);
            const absAmount = Math.abs(numVal);
            const type: 'receita' | 'despesa' = isExpense ? 'despesa' : 'receita';

            items.push({
              id: `pdf-${index + 1}-${Date.now()}`,
              date: dateStr,
              description: rawDesc,
              amount: absAmount,
              type,
              suggestedCategoryId: suggestCategory(rawDesc, categories, type),
              selected: true
            });
          }
        }
      }
    });
  } catch (err) {
    console.error('Error parsing PDF:', err);
  }

  return items;
}
