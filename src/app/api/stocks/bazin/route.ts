import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type BazinStockData = {
  ticker: string;
  name: string;
  currentPrice: number;
  selectedPeriod: '1y' | '3y' | '5y';
  targetYield: number; // e.g. 6 for 6%
  dividend1y: number;
  dividend3yAvg: number;
  dividend5yAvg: number;
  selectedDividend: number; // The dividend value for the active period
  ceilingPrice: number | null; // Preço Teto = selectedDividend / (targetYield / 100)
  otimoPrice: number | null; // Preço Teto * 0.8 (20% margem de segurança)
  discountPercent: number | null; // ((ceilingPrice - currentPrice) / ceilingPrice) * 100
  dyCurrent: number | null; // (dividend1y / currentPrice) * 100
  status: 'OTIMO_PRECO' | 'ABAIXO_DO_TETO' | 'ACIMA_DO_TETO' | 'SEM_DIVIDENDOS';
  statusLabel: string;
  statusColor: 'green' | 'amber' | 'red' | 'gray';
  splitsCount: number;
  lastDividendAmount: number | null;
  lastDividendDate: string | null;
  lastUpdated: string;
};

// Parse Brazilian number strings
function parseBrNumber(val?: string | null): number | null {
  if (!val) return null;
  const clean = val.replace(/[R$\s%]/g, '').trim();
  if (!clean || clean === '-' || clean === 'N/A') return null;
  const num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

// Fetch historical dividend data from Yahoo Finance and adjust for corporate actions (splits)
export async function fetchBazinDataForTicker(
  rawTicker: string,
  period: '1y' | '3y' | '5y' = '5y',
  targetYield: number = 6
): Promise<BazinStockData | null> {
  const cleanTicker = rawTicker.trim().toUpperCase().replace('.SA', '');
  if (!cleanTicker) return null;

  try {
    const yahooTicker = `${cleanTicker}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?events=split|div&range=5y&interval=1mo`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    let currentPrice = 0;
    let companyName = cleanTicker;
    let divEvents: Record<string, { amount: number; date: number }> = {};
    let splitEvents: Record<string, { date: number; numerator: number; denominator: number }> = {};

    if (res.ok) {
      const data = await res.json();
      const chartResult = data?.chart?.result?.[0];
      if (chartResult) {
        const meta = chartResult.meta;
        currentPrice = Number(meta?.regularMarketPrice) || 0;
        if (meta?.shortName || meta?.longName) {
          companyName = meta.shortName || meta.longName;
        }
        divEvents = chartResult.events?.dividends || {};
        splitEvents = chartResult.events?.splits || {};
      }
    }

    // Fallback: If price not found via Yahoo chart, try Fundamentus
    if (currentPrice === 0) {
      try {
        const fundRes = await fetch(`https://www.fundamentus.com.br/detalhes.php?papel=${cleanTicker}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          cache: 'no-store'
        });
        if (fundRes.ok) {
          const html = await fundRes.text();
          const cotacaoMatch = html.match(/Cota.+?o<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
          const nomeMatch = html.match(/(?:Empresa|FII)<\/span><\/td>\s*<td[^>]*><span[^>]*>([^<]+)<\/span>/i);
          if (cotacaoMatch) currentPrice = parseBrNumber(cotacaoMatch[1]) || 0;
          if (nomeMatch && nomeMatch[1].trim()) companyName = nomeMatch[1].trim();
        }
      } catch {
        // ignore
      }
    }

    // Sort splits chronologically
    const splits = Object.values(splitEvents).sort((a, b) => a.date - b.date);

    // Adjust past dividends for subsequent stock splits
    const adjustedDividends = Object.values(divEvents).map((d) => {
      let adjAmount = d.amount;
      splits.forEach((s) => {
        if (s.date > d.date) {
          const factor = (s.numerator || 1) / (s.denominator || 1);
          if (factor > 0) adjAmount /= factor;
        }
      });
      return {
        date: d.date,
        rawAmount: d.amount,
        amount: adjAmount
      };
    }).sort((a, b) => a.date - b.date);

    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 365 * 24 * 3600;
    const threeYearsAgo = now - 3 * 365 * 24 * 3600;
    const fiveYearsAgo = now - 5 * 365 * 24 * 3600;

    let sum1y = 0;
    let sum3y = 0;
    let sum5y = 0;

    adjustedDividends.forEach((d) => {
      if (d.date >= oneYearAgo) sum1y += d.amount;
      if (d.date >= threeYearsAgo) sum3y += d.amount;
      if (d.date >= fiveYearsAgo) sum5y += d.amount;
    });

    const dividend1y = Number(sum1y.toFixed(4));
    const dividend3yAvg = Number((sum3y / 3).toFixed(4));
    const dividend5yAvg = Number((sum5y / 5).toFixed(4));

    // Determine selected dividend based on requested period
    let selectedDividend = dividend5yAvg;
    if (period === '1y') selectedDividend = dividend1y;
    else if (period === '3y') selectedDividend = dividend3yAvg;
    else selectedDividend = dividend5yAvg;

    // Décio Bazin Ceiling Price: Preço Teto = Dividendo / (Yield / 100)
    const yieldDecimal = (targetYield || 6) / 100;
    let ceilingPrice: number | null = null;
    let otimoPrice: number | null = null;
    let discountPercent: number | null = null;
    let status: BazinStockData['status'] = 'SEM_DIVIDENDOS';
    let statusLabel = 'Sem Histórico de Proventos';
    let statusColor: BazinStockData['statusColor'] = 'gray';

    if (selectedDividend > 0 && yieldDecimal > 0) {
      ceilingPrice = Number((selectedDividend / yieldDecimal).toFixed(2));
      otimoPrice = Number((ceilingPrice * 0.8).toFixed(2)); // 20% discount on ceiling

      if (currentPrice > 0) {
        discountPercent = Number((((ceilingPrice - currentPrice) / ceilingPrice) * 100).toFixed(1));

        if (currentPrice <= otimoPrice) {
          status = 'OTIMO_PRECO';
          statusLabel = '🟢 Ótimo Preço (Desconto ≥ 20%)';
          statusColor = 'green';
        } else if (currentPrice <= ceilingPrice) {
          status = 'ABAIXO_DO_TETO';
          statusLabel = '🟡 Abaixo do Preço Teto (Comprar)';
          statusColor = 'amber';
        } else {
          status = 'ACIMA_DO_TETO';
          statusLabel = '🔴 Acima do Preço Teto (Não Comprar)';
          statusColor = 'red';
        }
      } else {
        status = 'ABAIXO_DO_TETO';
        statusLabel = 'Preço Teto Calculado';
        statusColor = 'amber';
      }
    }

    const lastDiv = adjustedDividends.length > 0 ? adjustedDividends[adjustedDividends.length - 1] : null;
    const dyCurrent = currentPrice > 0 && dividend1y > 0 ? Number(((dividend1y / currentPrice) * 100).toFixed(2)) : null;

    return {
      ticker: cleanTicker,
      name: companyName,
      currentPrice: Number(currentPrice.toFixed(2)),
      selectedPeriod: period,
      targetYield,
      dividend1y,
      dividend3yAvg,
      dividend5yAvg,
      selectedDividend,
      ceilingPrice,
      otimoPrice,
      discountPercent,
      dyCurrent,
      status,
      statusLabel,
      statusColor,
      splitsCount: splits.length,
      lastDividendAmount: lastDiv ? Number(lastDiv.amount.toFixed(4)) : null,
      lastDividendDate: lastDiv ? new Date(lastDiv.date * 1000).toISOString() : null,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Erro ao buscar dados Bazin para ${cleanTicker}:`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const period = (searchParams.get('period') || '5y') as '1y' | '3y' | '5y';
  const targetYield = parseFloat(searchParams.get('targetYield') || '6') || 6;
  const customDiv = searchParams.get('customDiv');
  const customPrice = searchParams.get('customPrice');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  if (!ticker) {
    return NextResponse.json({ error: 'Parâmetro ticker é obrigatório' }, { status: 400, headers });
  }

  // Simulation mode with custom dividend & price
  if (customDiv) {
    const div = parseBrNumber(customDiv) || 0;
    const price = parseBrNumber(customPrice) || 0;
    const yieldDecimal = targetYield / 100;

    if (div > 0 && yieldDecimal > 0) {
      const ceilingPrice = Number((div / yieldDecimal).toFixed(2));
      const otimoPrice = Number((ceilingPrice * 0.8).toFixed(2));
      const discountPercent = price > 0 ? Number((((ceilingPrice - price) / ceilingPrice) * 100).toFixed(1)) : null;

      let status: BazinStockData['status'] = 'ABAIXO_DO_TETO';
      let statusLabel = 'Abaixo do Preço Teto';
      let statusColor: BazinStockData['statusColor'] = 'amber';

      if (price > 0) {
        if (price <= otimoPrice) {
          status = 'OTIMO_PRECO';
          statusLabel = '🟢 Ótimo Preço (Desconto ≥ 20%)';
          statusColor = 'green';
        } else if (price <= ceilingPrice) {
          status = 'ABAIXO_DO_TETO';
          statusLabel = '🟡 Abaixo do Preço Teto';
          statusColor = 'amber';
        } else {
          status = 'ACIMA_DO_TETO';
          statusLabel = '🔴 Acima do Preço Teto';
          statusColor = 'red';
        }
      }

      return NextResponse.json({
        ticker: ticker.toUpperCase(),
        name: 'Simulação Personalizada (Bazin)',
        currentPrice: price,
        selectedPeriod: period,
        targetYield,
        dividend1y: div,
        dividend3yAvg: div,
        dividend5yAvg: div,
        selectedDividend: div,
        ceilingPrice,
        otimoPrice,
        discountPercent,
        dyCurrent: price > 0 ? Number(((div / price) * 100).toFixed(2)) : null,
        status,
        statusLabel,
        statusColor,
        splitsCount: 0,
        lastDividendAmount: div,
        lastDividendDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }, { headers });
    }
  }

  const result = await fetchBazinDataForTicker(ticker, period, targetYield);
  if (!result) {
    return NextResponse.json({ error: 'Não foi possível obter dados para o ativo informado' }, { status: 404, headers });
  }

  return NextResponse.json(result, { headers });
}

export async function POST(req: NextRequest) {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  try {
    const body = await req.json();
    const tickers: string[] = body.tickers || [];
    const period = (body.period || '5y') as '1y' | '3y' | '5y';
    const targetYield = parseFloat(body.targetYield || '6') || 6;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ results: {} }, { headers });
    }

    const results: Record<string, BazinStockData> = {};

    await Promise.all(
      tickers.map(async (rawTicker) => {
        try {
          const data = await fetchBazinDataForTicker(rawTicker, period, targetYield);
          if (data) {
            results[data.ticker] = data;
          }
        } catch {
          // ignore individual ticker failure
        }
      })
    );

    return NextResponse.json({ results }, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao processar' }, { status: 500, headers });
  }
}
