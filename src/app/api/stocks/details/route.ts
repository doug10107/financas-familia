import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface StockFullDetails {
  ticker: string;
  name: string;
  type: string;
  sector: string;
  subsector: string;
  currentPrice: number;
  min52w: number | null;
  max52w: number | null;
  volumeAvg2m: number | null;
  lastBalanceDate: string | null;
  totalShares: number | null;

  // Top Highlights
  vpa: number | null;
  lpa: number | null;
  payout: number | null;
  dy: number | null;
  dpa1y: number;
  dpa3yAvg: number;
  dpa5yAvg: number;

  // Valuation Indicators
  marketCap: number | null;
  enterpriseValue: number | null;
  pl: number | null;
  pvp: number | null;
  pebit: number | null;
  pebitda: number | null;
  evebit: number | null;
  evebitda: number | null;
  psr: number | null;
  pativos: number | null;
  pcapGiro: number | null;

  // Profitability Indicators
  roe: number | null;
  roa: number | null;
  roic: number | null;
  margemLiquida: number | null;
  margemEbitda: number | null;
  margemEbit: number | null;
  margemBruta: number | null;
  giroAtivos: number | null;
  crescRec5a: number | null;

  // Indebtedness & Balance Sheet
  dividaLiquida: number | null;
  dividaBruta: number | null;
  disponibilidades: number | null;
  dividaLiquidaEbitda: number | null;
  dividaLiquidaPatrimonio: number | null;
  liquidezCorrente: number | null;
  patrimonioLiquido: number | null;
  ativoTotal: number | null;
  ativoCirculante: number | null;

  // Income Statement (12m)
  receitaLiquida12m: number | null;
  ebit12m: number | null;
  ebitda12m: number | null;
  lucroLiquido12m: number | null;

  // Dividend History by Year
  yearlyDividends: { year: number; total: number }[];
  lastUpdated: string;
}

function parseBrNumber(val?: string | null): number | null {
  if (!val) return null;
  const clean = val
    .replace(/<[^>]*>/g, '')
    .replace(/[R$\s%]/g, '')
    .trim();
  if (!clean || clean === '-' || clean === 'N/A' || clean === 'null') return null;
  const num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

function extractField(html: string, labelPattern: string): string | null {
  const regex = new RegExp(
    `>${labelPattern}<\\/span><\\/td>\\s*<td[^>]*><span[^>]*>([\\s\\S]*?)<\\/span>`,
    'i'
  );
  const match = html.match(regex);
  if (!match) return null;
  return match[1].replace(/<[^>]*>/g, '').trim();
}

// Curated fallback in case Fundamentus is unreachable or rate-limited
const FALLBACK_DETAILS: Record<string, Partial<StockFullDetails>> = {
  CMIG4: {
    name: 'CEMIG PN N1',
    sector: 'Energia Elétrica',
    subsector: 'Energia Elétrica',
    currentPrice: 11.83,
    vpa: 10.2,
    lpa: 1.61,
    dy: 8.6,
    payout: 63.4,
    marketCap: 33854900000,
    enterpriseValue: 53125500000,
    totalShares: 2861780000,
    pl: 7.37,
    pvp: 1.16,
    pebit: 5.63,
    pebitda: 4.44,
    evebit: 8.84,
    evebitda: 6.97,
    roe: 15.7,
    roa: 6.48,
    roic: 9.3,
    margemLiquida: 10.5,
    margemEbitda: 17.4,
    margemEbit: 13.7,
    margemBruta: 15.8,
    dividaLiquida: 19270600000,
    dividaBruta: 22352700000,
    disponibilidades: 3082110000,
    dividaLiquidaEbitda: 2.53,
    dividaLiquidaPatrimonio: 0.66,
    liquidezCorrente: 1.17,
    lucroLiquido12m: 4595100000,
    receitaLiquida12m: 43739500000,
    ebit12m: 6009850000
  },
  BBAS3: {
    name: 'Banco do Brasil ON',
    sector: 'Financeiro',
    subsector: 'Bancos',
    currentPrice: 28.45,
    vpa: 37.4,
    lpa: 6.54,
    dy: 9.85,
    payout: 42.8,
    marketCap: 162800000000,
    enterpriseValue: 162800000000,
    totalShares: 5730800000,
    pl: 4.35,
    pvp: 0.76,
    pebit: 3.8,
    pebitda: 3.5,
    evebit: 3.8,
    evebitda: 3.5,
    roe: 21.4,
    roa: 1.85,
    roic: 18.2,
    margemLiquida: 18.2,
    margemEbitda: 28.5,
    margemBruta: 42.1,
    dividaLiquida: 0,
    dividaBruta: 0,
    disponibilidades: 85000000000,
    dividaLiquidaEbitda: 0,
    lucroLiquido12m: 37480000000
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawTicker = searchParams.get('ticker');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  if (!rawTicker) {
    return NextResponse.json({ error: 'Parâmetro ticker é obrigatório' }, { status: 400, headers });
  }

  const cleanTicker = rawTicker.trim().toUpperCase().replace('.SA', '');

  try {
    // 1. Fetch Fundamentus Details HTML and Yahoo Finance 5y Chart + Dividends in parallel
    const yahooTicker = `${cleanTicker}.SA`;
    const [fundRes, yahooRes] = await Promise.allSettled([
      fetch(`https://www.fundamentus.com.br/detalhes.php?papel=${encodeURIComponent(cleanTicker)}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        cache: 'no-store'
      }),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?events=split|div&range=5y&interval=1mo`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          cache: 'no-store'
        }
      )
    ]);

    let html = '';
    if (fundRes.status === 'fulfilled' && fundRes.value.ok) {
      const buffer = await fundRes.value.arrayBuffer();
      html = new TextDecoder('iso-8859-1').decode(buffer);
    }

    // Parse Yahoo Finance price & historical dividends
    let yahooPrice = 0;
    let yahooName = '';
    let divEvents: Record<string, { amount: number; date: number }> = {};
    let splitEvents: Record<string, { date: number; numerator: number; denominator: number }> = {};

    if (yahooRes.status === 'fulfilled' && yahooRes.value.ok) {
      const yData = await yahooRes.value.json();
      const chartResult = yData?.chart?.result?.[0];
      if (chartResult) {
        yahooPrice = Number(chartResult.meta?.regularMarketPrice) || 0;
        yahooName = chartResult.meta?.longName || chartResult.meta?.shortName || '';
        divEvents = chartResult.events?.dividends || {};
        splitEvents = chartResult.events?.splits || {};
      }
    }

    // Parse Fundamentus fields
    const fundPrice = parseBrNumber(extractField(html, 'Cota[^<]*o'));
    const currentPrice = yahooPrice > 0 ? yahooPrice : fundPrice || FALLBACK_DETAILS[cleanTicker]?.currentPrice || 0;

    const name =
      extractField(html, 'Empresa') ||
      extractField(html, 'FII') ||
      yahooName ||
      FALLBACK_DETAILS[cleanTicker]?.name ||
      cleanTicker;

    const type = extractField(html, 'Tipo') || 'ON/PN';
    const sector = extractField(html, 'Setor') || FALLBACK_DETAILS[cleanTicker]?.sector || 'B3 / Ações';
    const subsector = extractField(html, 'Subsetor') || FALLBACK_DETAILS[cleanTicker]?.subsector || sector;
    const min52w = parseBrNumber(extractField(html, 'Min 52 sem'));
    const max52w = parseBrNumber(extractField(html, 'Max 52 sem'));
    const volumeAvg2m = parseBrNumber(extractField(html, 'Vol \\$ m[^<]*d \\(2m\\)'));
    const lastBalanceDate = extractField(html, '[^<]*lt balan[^<]*o processado');
    const totalShares =
      parseBrNumber(extractField(html, 'Nro\\. A[^<]*es')) ??
      FALLBACK_DETAILS[cleanTicker]?.totalShares ??
      null;

    // Valuation
    const marketCap =
      parseBrNumber(extractField(html, 'Valor de mercado')) ??
      (currentPrice > 0 && totalShares ? currentPrice * totalShares : FALLBACK_DETAILS[cleanTicker]?.marketCap ?? null);

    const enterpriseValue =
      parseBrNumber(extractField(html, 'Valor da firma')) ??
      FALLBACK_DETAILS[cleanTicker]?.enterpriseValue ??
      marketCap;

    const pl = parseBrNumber(extractField(html, 'P\\/L')) ?? FALLBACK_DETAILS[cleanTicker]?.pl ?? null;
    const lpa = parseBrNumber(extractField(html, 'LPA')) ?? FALLBACK_DETAILS[cleanTicker]?.lpa ?? null;
    const pvp = parseBrNumber(extractField(html, 'P\\/VP')) ?? FALLBACK_DETAILS[cleanTicker]?.pvp ?? null;
    const vpa = parseBrNumber(extractField(html, 'VPA')) ?? FALLBACK_DETAILS[cleanTicker]?.vpa ?? null;
    const pebit = parseBrNumber(extractField(html, 'P\\/EBIT')) ?? FALLBACK_DETAILS[cleanTicker]?.pebit ?? null;
    const psr = parseBrNumber(extractField(html, 'PSR'));
    const pativos = parseBrNumber(extractField(html, 'P\\/Ativos'));
    const pcapGiro = parseBrNumber(extractField(html, 'P\\/Cap\\. Giro'));
    const evebitda =
      parseBrNumber(extractField(html, 'EV \\/ EBITDA')) ?? FALLBACK_DETAILS[cleanTicker]?.evebitda ?? null;
    const evebit = parseBrNumber(extractField(html, 'EV \\/ EBIT')) ?? FALLBACK_DETAILS[cleanTicker]?.evebit ?? null;
    const dy = parseBrNumber(extractField(html, 'Div\\. Yield')) ?? FALLBACK_DETAILS[cleanTicker]?.dy ?? null;

    // Profitability
    const roe = parseBrNumber(extractField(html, 'ROE')) ?? FALLBACK_DETAILS[cleanTicker]?.roe ?? null;
    const roic = parseBrNumber(extractField(html, 'ROIC')) ?? FALLBACK_DETAILS[cleanTicker]?.roic ?? null;
    const margemBruta =
      parseBrNumber(extractField(html, 'Marg\\. Bruta')) ?? FALLBACK_DETAILS[cleanTicker]?.margemBruta ?? null;
    const margemEbit =
      parseBrNumber(extractField(html, 'Marg\\. EBIT')) ?? FALLBACK_DETAILS[cleanTicker]?.margemEbit ?? null;
    const margemLiquida =
      parseBrNumber(extractField(html, 'Marg\\. L[^<]*quida')) ??
      FALLBACK_DETAILS[cleanTicker]?.margemLiquida ??
      null;
    const giroAtivos = parseBrNumber(extractField(html, 'Giro Ativos'));
    const crescRec5a = parseBrNumber(extractField(html, 'Cres\\. Rec \\(5a\\)'));

    // Balance Sheet & Indebtedness
    const ativoTotal = parseBrNumber(extractField(html, 'Ativo'));
    const ativoCirculante = parseBrNumber(extractField(html, 'Ativo Circulante'));
    const dividaBruta =
      parseBrNumber(extractField(html, 'D[^<]*v\\. Bruta')) ?? FALLBACK_DETAILS[cleanTicker]?.dividaBruta ?? null;
    const disponibilidades =
      parseBrNumber(extractField(html, 'Disponibilidades')) ??
      FALLBACK_DETAILS[cleanTicker]?.disponibilidades ??
      null;
    const dividaLiquida =
      parseBrNumber(extractField(html, 'D[^<]*v\\. L[^<]*quida')) ??
      (dividaBruta !== null && disponibilidades !== null ? dividaBruta - disponibilidades : null) ??
      FALLBACK_DETAILS[cleanTicker]?.dividaLiquida ??
      null;
    const patrimonioLiquido = parseBrNumber(extractField(html, 'Patrim\\. L[^<]*q'));
    const dividaLiquidaPatrimonio =
      parseBrNumber(extractField(html, 'D[^<]*v L[^<]*q \\/ Patrim')) ??
      FALLBACK_DETAILS[cleanTicker]?.dividaLiquidaPatrimonio ??
      null;
    const liquidezCorrente =
      parseBrNumber(extractField(html, 'Liquidez Corr')) ?? FALLBACK_DETAILS[cleanTicker]?.liquidezCorrente ?? null;

    // DRE 12m (first occurrence of Receita Líquida, EBIT, Lucro Líquido in table)
    const receitaLiquida12m =
      parseBrNumber(extractField(html, 'Receita L[^<]*quida')) ??
      FALLBACK_DETAILS[cleanTicker]?.receitaLiquida12m ??
      null;
    const ebit12m = parseBrNumber(extractField(html, 'EBIT')) ?? FALLBACK_DETAILS[cleanTicker]?.ebit12m ?? null;
    const lucroLiquido12m =
      parseBrNumber(extractField(html, 'Lucro L[^<]*quido')) ??
      (lpa !== null && totalShares !== null ? lpa * totalShares : null) ??
      FALLBACK_DETAILS[cleanTicker]?.lucroLiquido12m ??
      null;

    // Derived metrics: EBITDA, P/EBITDA, Margem EBITDA, Dívida Líquida/EBITDA, ROA
    let ebitda12m: number | null = null;
    if (enterpriseValue && evebitda && evebitda > 0) {
      ebitda12m = enterpriseValue / evebitda;
    } else if (ebit12m) {
      ebitda12m = ebit12m * 1.18; // conservative D&A proxy when EV/EBITDA is absent
    }

    const pebitda =
      marketCap && ebitda12m && ebitda12m > 0
        ? Number((marketCap / ebitda12m).toFixed(3))
        : FALLBACK_DETAILS[cleanTicker]?.pebitda ?? null;

    const margemEbitda =
      ebitda12m && receitaLiquida12m && receitaLiquida12m > 0
        ? Number(((ebitda12m / receitaLiquida12m) * 100).toFixed(2))
        : FALLBACK_DETAILS[cleanTicker]?.margemEbitda ?? margemEbit;

    const dividaLiquidaEbitda =
      dividaLiquida !== null && ebitda12m && ebitda12m > 0
        ? Number((dividaLiquida / ebitda12m).toFixed(3))
        : FALLBACK_DETAILS[cleanTicker]?.dividaLiquidaEbitda ?? null;

    const roa =
      lucroLiquido12m !== null && ativoTotal && ativoTotal > 0
        ? Number(((lucroLiquido12m / ativoTotal) * 100).toFixed(3))
        : parseBrNumber(extractField(html, 'EBIT \\/ Ativo')) ?? FALLBACK_DETAILS[cleanTicker]?.roa ?? null;

    // Dividends calculation (adjusting for splits)
    const splits = Object.values(splitEvents).sort((a, b) => a.date - b.date);
    const adjustedDividends = Object.values(divEvents)
      .map((d) => {
        let adjAmount = d.amount;
        splits.forEach((s) => {
          if (s.date > d.date) {
            const factor = (s.numerator || 1) / (s.denominator || 1);
            if (factor > 0) adjAmount /= factor;
          }
        });
        return { date: d.date, amount: adjAmount };
      })
      .sort((a, b) => a.date - b.date);

    const nowSec = Math.floor(Date.now() / 1000);
    const oneYearAgo = nowSec - 365 * 24 * 3600;
    const threeYearsAgo = nowSec - 3 * 365 * 24 * 3600;
    const fiveYearsAgo = nowSec - 5 * 365 * 24 * 3600;

    let sum1y = 0;
    let sum3y = 0;
    let sum5y = 0;
    const byYear: Record<number, number> = {};

    adjustedDividends.forEach((d) => {
      if (d.date >= oneYearAgo) sum1y += d.amount;
      if (d.date >= threeYearsAgo) sum3y += d.amount;
      if (d.date >= fiveYearsAgo) sum5y += d.amount;
      const yr = new Date(d.date * 1000).getFullYear();
      byYear[yr] = (byYear[yr] || 0) + d.amount;
    });

    // Fallback DPA if Yahoo had no dividend events but Fundamentus has DY
    const fallbackDpa = dy && currentPrice > 0 ? (dy / 100) * currentPrice : 0;
    const dpa1y = sum1y > 0 ? Number(sum1y.toFixed(4)) : Number(fallbackDpa.toFixed(4));
    const dpa3yAvg = sum3y > 0 ? Number((sum3y / 3).toFixed(4)) : dpa1y;
    const dpa5yAvg = sum5y > 0 ? Number((sum5y / 5).toFixed(4)) : dpa1y;

    // Payout (%) = (DPA / LPA) * 100 or (DY * P/L)
    let payout: number | null = null;
    if (lpa && lpa > 0 && dpa1y > 0) {
      payout = Number(((dpa1y / lpa) * 100).toFixed(2));
    } else if (dy && pl && pl > 0) {
      payout = Number(((dy / 100) * pl * 100).toFixed(2));
    } else {
      payout = FALLBACK_DETAILS[cleanTicker]?.payout ?? null;
    }

    const yearlyDividends = Object.entries(byYear)
      .map(([yr, total]) => ({ year: Number(yr), total: Number(total.toFixed(4)) }))
      .sort((a, b) => a.year - b.year)
      .slice(-6);

    const result: StockFullDetails = {
      ticker: cleanTicker,
      name,
      type,
      sector,
      subsector,
      currentPrice: Number(currentPrice.toFixed(2)),
      min52w,
      max52w,
      volumeAvg2m,
      lastBalanceDate,
      totalShares,
      vpa,
      lpa,
      payout,
      dy,
      dpa1y,
      dpa3yAvg,
      dpa5yAvg,
      marketCap,
      enterpriseValue,
      pl,
      pvp,
      pebit,
      pebitda,
      evebit,
      evebitda,
      psr,
      pativos,
      pcapGiro,
      roe,
      roa,
      roic,
      margemLiquida,
      margemEbitda,
      margemEbit,
      margemBruta,
      giroAtivos,
      crescRec5a,
      dividaLiquida,
      dividaBruta,
      disponibilidades,
      dividaLiquidaEbitda,
      dividaLiquidaPatrimonio,
      liquidezCorrente,
      patrimonioLiquido,
      ativoTotal,
      ativoCirculante,
      receitaLiquida12m,
      ebit12m,
      ebitda12m: ebitda12m ? Math.round(ebitda12m) : null,
      lucroLiquido12m,
      yearlyDividends,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(result, { headers });
  } catch (err: any) {
    console.error(`Error fetching stock details for ${cleanTicker}:`, err);
    return NextResponse.json(
      { error: 'Não foi possível carregar os detalhes fundamentalistas deste ativo.' },
      { status: 500, headers }
    );
  }
}
