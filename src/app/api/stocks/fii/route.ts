import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type FIIAnalysisData = {
  ticker: string;
  name: string;
  segment: string;
  currentPrice: number;
  vpCota: number | null;
  pvp: number | null;
  dy12m: number | null;
  lastDividendAmount: number | null;
  lastDividendDate: string | null;
  avgMonthlyDividend: number | null;
  annualDividend1y: number | null;
  annualDividend3yAvg: number | null;
  annualDividend5yAvg: number | null;
  targetYield: number; // e.g. 8.5%
  selectedPeriod: '1y' | '3y' | '5y';
  ceilingPrice: number | null; // Preço Teto = annualDividend / (targetYield / 100)
  pvpDiscountPercent: number | null; // (1 - pvp) * 100
  discountOnCeiling: number | null; // ((ceilingPrice - currentPrice) / ceilingPrice) * 100
  pvpStatus: 'FORTE_DESCONTO' | 'DESCONTO' | 'JUSTO' | 'AGIO' | 'SEM_DADOS';
  pvpStatusLabel: string;
  pvpStatusColor: 'green' | 'emerald' | 'amber' | 'red' | 'gray';
  overallVerdict: string;
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

export async function fetchFIIDataForTicker(
  rawTicker: string,
  period: '1y' | '3y' | '5y' = '5y',
  targetYield: number = 8.5
): Promise<FIIAnalysisData | null> {
  const cleanTicker = rawTicker.trim().toUpperCase().replace('.SA', '');
  if (!cleanTicker) return null;

  try {
    // 1. Fetch Fundamentus FII details
    const fundRes = await fetch(`https://www.fundamentus.com.br/detalhes.php?papel=${cleanTicker}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cache: 'no-store'
    });

    let pvp: number | null = null;
    let vpCota: number | null = null;
    let dy12m: number | null = null;
    let segment = 'Imobiliário';
    let companyName = cleanTicker;
    let fundPrice: number | null = null;

    if (fundRes.ok) {
      const html = await fundRes.text();

      const pvpMatch = html.match(/P\/VP<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const vpMatch = html.match(/VP\/Cota<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const dyMatch = html.match(/Div\. Yield<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)%?<\/span>/i);
      const segmentMatch = html.match(/Segmento dos im[\s\S]*?class="txt">(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/span>/i) ||
                           html.match(/Segmento<\/span><\/td>\s*<td[^>]*><span[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/span>/i);
      const nomeMatch = html.match(/(?:FII|Nome Preg[\s\S]*?)<\/span><\/td>\s*<td[^>]*><span[^>]*>([^<]+)<\/span>/i);
      const cotacaoMatch = html.match(/Cota.+?o<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);

      if (pvpMatch) pvp = parseBrNumber(pvpMatch[1]);
      if (vpMatch) vpCota = parseBrNumber(vpMatch[1]);
      if (dyMatch) dy12m = parseBrNumber(dyMatch[1]);
      if (segmentMatch && segmentMatch[1].trim() && segmentMatch[1].trim() !== '?') segment = segmentMatch[1].trim();
      if (cotacaoMatch) fundPrice = parseBrNumber(cotacaoMatch[1]);
      if (nomeMatch && nomeMatch[1].trim()) companyName = nomeMatch[1].trim();
    }

    // 2. Fetch Live Price & Historical Dividends from Yahoo Finance
    let livePrice = fundPrice || 0;
    let divEvents: Record<string, { amount: number; date: number }> = {};
    let splitEvents: Record<string, { date: number; numerator: number; denominator: number }> = {};

    try {
      const yahooTicker = `${cleanTicker}.SA`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?events=split|div&range=5y&interval=1mo`;
      const yahooRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store'
      });

      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const chartResult = yahooData?.chart?.result?.[0];
        if (chartResult) {
          const meta = chartResult.meta;
          if (meta?.regularMarketPrice) livePrice = Number(meta.regularMarketPrice);
          if (meta?.shortName || meta?.longName) companyName = meta.shortName || meta.longName;
          divEvents = chartResult.events?.dividends || {};
          splitEvents = chartResult.events?.splits || {};
        }
      }
    } catch {
      // Keep livePrice
    }

    // Fallback for P/VP calculation if missing from Fundamentus
    if (pvp === null && livePrice > 0 && vpCota !== null && vpCota > 0) {
      pvp = Number((livePrice / vpCota).toFixed(2));
    }

    // Dividend calculations
    const splits = Object.values(splitEvents).sort((a, b) => a.date - b.date);
    const adjustedDividends = Object.values(divEvents).map((d) => {
      let adjAmount = d.amount;
      splits.forEach((s) => {
        if (s.date > d.date) {
          const factor = (s.numerator || 1) / (s.denominator || 1);
          if (factor > 0) adjAmount /= factor;
        }
      });
      return { date: d.date, amount: adjAmount };
    }).sort((a, b) => a.date - b.date);

    const now = Math.floor(Date.now() / 1000);
    const oneYearAgo = now - 365 * 24 * 3600;
    const threeYearsAgo = now - 3 * 365 * 24 * 3600;
    const fiveYearsAgo = now - 5 * 365 * 24 * 3600;

    let sum1y = 0;
    let sum3y = 0;
    let sum5y = 0;
    let count1y = 0;

    adjustedDividends.forEach((d) => {
      if (d.date >= oneYearAgo) {
        sum1y += d.amount;
        count1y++;
      }
      if (d.date >= threeYearsAgo) sum3y += d.amount;
      if (d.date >= fiveYearsAgo) sum5y += d.amount;
    });

    const annualDividend1y = sum1y > 0 ? Number(sum1y.toFixed(4)) : null;
    const annualDividend3yAvg = sum3y > 0 ? Number((sum3y / 3).toFixed(4)) : null;
    const annualDividend5yAvg = sum5y > 0 ? Number((sum5y / 5).toFixed(4)) : null;
    const avgMonthlyDividend = count1y > 0 ? Number((sum1y / count1y).toFixed(4)) : (annualDividend1y ? Number((annualDividend1y / 12).toFixed(4)) : null);

    const lastDiv = adjustedDividends.length > 0 ? adjustedDividends[adjustedDividends.length - 1] : null;

    // Selected dividend for ceiling price
    let selectedAnnualDividend = annualDividend5yAvg || annualDividend3yAvg || annualDividend1y || 0;
    if (period === '1y') selectedAnnualDividend = annualDividend1y || selectedAnnualDividend;
    else if (period === '3y') selectedAnnualDividend = annualDividend3yAvg || selectedAnnualDividend;
    else if (period === '5y') selectedAnnualDividend = annualDividend5yAvg || annualDividend3yAvg || annualDividend1y || 0;

    // FII Ceiling Price = Annual Dividend / (Target Yield / 100)
    const yieldDecimal = (targetYield || 8.5) / 100;
    let ceilingPrice: number | null = null;
    let discountOnCeiling: number | null = null;

    if (selectedAnnualDividend > 0 && yieldDecimal > 0) {
      ceilingPrice = Number((selectedAnnualDividend / yieldDecimal).toFixed(2));
      if (livePrice > 0) {
        discountOnCeiling = Number((((ceilingPrice - livePrice) / ceilingPrice) * 100).toFixed(1));
      }
    }

    // P/VP Status & Diagnosis
    let pvpStatus: FIIAnalysisData['pvpStatus'] = 'SEM_DADOS';
    let pvpStatusLabel = 'Sem dados de P/VP';
    let pvpStatusColor: FIIAnalysisData['pvpStatusColor'] = 'gray';
    let pvpDiscountPercent: number | null = null;
    let overallVerdict = 'Indicadores insuficientes';

    if (pvp !== null && pvp > 0) {
      pvpDiscountPercent = Number(((1 - pvp) * 100).toFixed(1));

      if (pvp < 0.90) {
        pvpStatus = 'FORTE_DESCONTO';
        pvpStatusLabel = `🟢 Forte Desconto Patrimonial (${Math.abs(pvpDiscountPercent)}% abaixo do VP)`;
        pvpStatusColor = 'green';
        overallVerdict = 'Excelente oportunidade patrimonial. FII sendo negociado bem abaixo do valor justo de seus ativos.';
      } else if (pvp < 1.00) {
        pvpStatus = 'DESCONTO';
        pvpStatusLabel = `🟢 Desconto no P/VP (${Math.abs(pvpDiscountPercent)}% abaixo do VP)`;
        pvpStatusColor = 'emerald';
        overallVerdict = 'Preço atraente com desconto em relação ao valor patrimonial por cota.';
      } else if (pvp <= 1.05) {
        pvpStatus = 'JUSTO';
        pvpStatusLabel = '🟡 Preço Justo / Alinhado ao Patrimônio (P/VP ≈ 1,00)';
        pvpStatusColor = 'amber';
        overallVerdict = 'Cotação em equilíbrio justo com o patrimônio do fundo.';
      } else {
        pvpStatus = 'AGIO';
        pvpStatusLabel = `🔴 Negociando com Ágio (${Math.abs(pvpDiscountPercent)}% acima do VP)`;
        pvpStatusColor = 'red';
        overallVerdict = 'Cotação cara em relação ao valor patrimonial. Risco de desvalorização.';
      }
    }

    return {
      ticker: cleanTicker,
      name: companyName,
      segment,
      currentPrice: Number(livePrice.toFixed(2)),
      vpCota: vpCota !== null ? Number(vpCota.toFixed(2)) : null,
      pvp: pvp !== null ? Number(pvp.toFixed(2)) : null,
      dy12m: dy12m !== null ? Number(dy12m.toFixed(2)) : null,
      lastDividendAmount: lastDiv ? Number(lastDiv.amount.toFixed(4)) : null,
      lastDividendDate: lastDiv ? new Date(lastDiv.date * 1000).toISOString() : null,
      avgMonthlyDividend,
      annualDividend1y,
      annualDividend3yAvg,
      annualDividend5yAvg,
      targetYield,
      selectedPeriod: period,
      ceilingPrice,
      pvpDiscountPercent,
      discountOnCeiling,
      pvpStatus,
      pvpStatusLabel,
      pvpStatusColor,
      overallVerdict,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Erro ao buscar dados de FII para ${cleanTicker}:`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const period = (searchParams.get('period') || '5y') as '1y' | '3y' | '5y';
  const targetYield = parseFloat(searchParams.get('targetYield') || '8.5') || 8.5;

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  if (!ticker) {
    return NextResponse.json({ error: 'Parâmetro ticker é obrigatório' }, { status: 400, headers });
  }

  const result = await fetchFIIDataForTicker(ticker, period, targetYield);
  if (!result) {
    return NextResponse.json({ error: 'FII não encontrado ou sem dados na B3' }, { status: 404, headers });
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
    const targetYield = parseFloat(body.targetYield || '8.5') || 8.5;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ results: {} }, { headers });
    }

    const results: Record<string, FIIAnalysisData> = {};

    await Promise.all(
      tickers.map(async (rawTicker) => {
        try {
          const data = await fetchFIIDataForTicker(rawTicker, period, targetYield);
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
