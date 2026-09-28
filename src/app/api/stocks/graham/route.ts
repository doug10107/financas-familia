import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type GrahamStockData = {
  ticker: string;
  name: string;
  currentPrice: number;
  lpa: number | null;
  vpa: number | null;
  pl: number | null;
  pvp: number | null;
  dy: number | null;
  grahamPrice: number | null;
  otimoPrice: number | null;
  discountPercent: number | null;
  status: 'OTIMO_PRECO' | 'PRECO_JUSTO' | 'PRECO_ACIMA' | 'PREJUIZO_OU_PL_NEGATIVO' | 'SEM_DADOS';
  statusLabel: string;
  statusColor: 'green' | 'amber' | 'red' | 'gray';
  lastUpdated: string;
};

// Robust parser for Brazilian decimal numbers
function parseBrNumber(val?: string | null): number | null {
  if (!val) return null;
  const clean = val.replace(/[R$\s%]/g, '').trim();
  if (!clean || clean === '-' || clean === 'N/A') return null;
  const num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

// Fetch fundamental data from Fundamentus & Yahoo Finance
async function fetchGrahamDataForTicker(rawTicker: string): Promise<GrahamStockData | null> {
  const cleanTicker = rawTicker.trim().toUpperCase().replace('.SA', '');
  if (!cleanTicker) return null;

  try {
    // 1. Fetch Fundamentals from Fundamentus
    const fundRes = await fetch(`https://www.fundamentus.com.br/detalhes.php?papel=${cleanTicker}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cache: 'no-store'
    });

    let lpa: number | null = null;
    let vpa: number | null = null;
    let pl: number | null = null;
    let pvp: number | null = null;
    let dy: number | null = null;
    let fundPrice: number | null = null;
    let companyName = cleanTicker;

    if (fundRes.ok) {
      const html = await fundRes.text();

      const lpaMatch = html.match(/LPA<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const vpaMatch = html.match(/VPA<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const plMatch = html.match(/P\/L<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const pvpMatch = html.match(/P\/VP<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);
      const dyMatch = html.match(/Div\. Yield<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)%?<\/span>/i);
      const nomeMatch = html.match(/Empresa<\/span><\/td>\s*<td[^>]*><span[^>]*>([^<]+)<\/span>/i);
      const cotacaoMatch = html.match(/Cota.+?o<\/span><\/td>\s*<td[^>]*><span[^>]*>([0-9,.-]+)<\/span>/i);

      if (lpaMatch) lpa = parseBrNumber(lpaMatch[1]);
      if (vpaMatch) vpa = parseBrNumber(vpaMatch[1]);
      if (plMatch) pl = parseBrNumber(plMatch[1]);
      if (pvpMatch) pvp = parseBrNumber(pvpMatch[1]);
      if (dyMatch) dy = parseBrNumber(dyMatch[1]);
      if (cotacaoMatch) fundPrice = parseBrNumber(cotacaoMatch[1]);
      if (nomeMatch && nomeMatch[1].trim()) companyName = nomeMatch[1].trim();
    }

    // 2. Fetch Live Price from Yahoo Finance (or fallback to Fundamentus price)
    let livePrice = fundPrice || 0;
    try {
      const yahooTicker = `${cleanTicker}.SA`;
      const yahooRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cache: 'no-store'
      });
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const meta = yahooData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          livePrice = Number(meta.regularMarketPrice);
          if (meta.shortName || meta.longName) {
            companyName = meta.shortName || meta.longName;
          }
        }
      }
    } catch {
      // Keep fundPrice
    }

    // 3. Graham Price Calculation
    // Formula: Preço Justo de Graham = sqrt(22.5 * LPA * VPA)
    // Multiplier 22.5 comes from Graham's criteria (P/L <= 15 and P/VP <= 1.5 -> 15 * 1.5 = 22.5)
    let grahamPrice: number | null = null;
    let otimoPrice: number | null = null; // Margem de segurança de 20% (80% do Preço Justo)
    let discountPercent: number | null = null;
    let status: GrahamStockData['status'] = 'SEM_DADOS';
    let statusLabel = 'Dados Indisponíveis';
    let statusColor: GrahamStockData['statusColor'] = 'gray';

    if (lpa !== null && vpa !== null) {
      if (lpa > 0 && vpa > 0) {
        grahamPrice = Math.sqrt(22.5 * lpa * vpa);
        otimoPrice = grahamPrice * 0.8; // 20% margin of safety

        if (livePrice > 0) {
          discountPercent = ((grahamPrice - livePrice) / grahamPrice) * 100;

          if (livePrice <= otimoPrice) {
            status = 'OTIMO_PRECO';
            statusLabel = 'Ótimo Preço (Desconto ≥ 20%)';
            statusColor = 'green';
          } else if (livePrice <= grahamPrice) {
            status = 'PRECO_JUSTO';
            statusLabel = 'Preço Justo (Abaixo do Teto)';
            statusColor = 'amber';
          } else {
            status = 'PRECO_ACIMA';
            statusLabel = 'Preço Acima (Caro / Sem Margem)';
            statusColor = 'red';
          }
        } else {
          status = 'PRECO_JUSTO';
          statusLabel = 'Preço Justo Calculado';
          statusColor = 'amber';
        }
      } else {
        status = 'PREJUIZO_OU_PL_NEGATIVO';
        statusLabel = lpa <= 0 ? 'Prejuízo Recente (LPA ≤ 0)' : 'Patrimônio Negativo (VPA ≤ 0)';
        statusColor = 'gray';
      }
    }

    return {
      ticker: cleanTicker,
      name: companyName,
      currentPrice: Number(livePrice.toFixed(2)),
      lpa: lpa !== null ? Number(lpa.toFixed(2)) : null,
      vpa: vpa !== null ? Number(vpa.toFixed(2)) : null,
      pl: pl !== null ? Number(pl.toFixed(2)) : null,
      pvp: pvp !== null ? Number(pvp.toFixed(2)) : null,
      dy: dy !== null ? Number(dy.toFixed(2)) : null,
      grahamPrice: grahamPrice !== null ? Number(grahamPrice.toFixed(2)) : null,
      otimoPrice: otimoPrice !== null ? Number(otimoPrice.toFixed(2)) : null,
      discountPercent: discountPercent !== null ? Number(discountPercent.toFixed(1)) : null,
      status,
      statusLabel,
      statusColor,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Erro ao buscar dados Graham para ${cleanTicker}:`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const customLpa = searchParams.get('lpa');
  const customVpa = searchParams.get('vpa');
  const customPrice = searchParams.get('price');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  if (!ticker) {
    return NextResponse.json({ error: 'Parâmetro ticker é obrigatório' }, { status: 400, headers });
  }

  // Custom simulation mode (user provides LPA / VPA directly)
  if (customLpa && customVpa) {
    const lpa = parseBrNumber(customLpa) || 0;
    const vpa = parseBrNumber(customVpa) || 0;
    const price = parseBrNumber(customPrice) || 0;

    if (lpa > 0 && vpa > 0) {
      const grahamPrice = Math.sqrt(22.5 * lpa * vpa);
      const otimoPrice = grahamPrice * 0.8;
      const discountPercent = price > 0 ? ((grahamPrice - price) / grahamPrice) * 100 : 0;

      let status: GrahamStockData['status'] = 'PRECO_JUSTO';
      let statusLabel = 'Preço Justo';
      let statusColor: GrahamStockData['statusColor'] = 'amber';

      if (price > 0) {
        if (price <= otimoPrice) {
          status = 'OTIMO_PRECO';
          statusLabel = 'Ótimo Preço (Desconto ≥ 20%)';
          statusColor = 'green';
        } else if (price <= grahamPrice) {
          status = 'PRECO_JUSTO';
          statusLabel = 'Preço Justo (Abaixo do Teto)';
          statusColor = 'amber';
        } else {
          status = 'PRECO_ACIMA';
          statusLabel = 'Preço Acima (Caro / Sem Margem)';
          statusColor = 'red';
        }
      }

      return NextResponse.json({
        ticker: ticker.toUpperCase(),
        name: 'Simulação Personalizada',
        currentPrice: price,
        lpa,
        vpa,
        pl: null,
        pvp: null,
        dy: null,
        grahamPrice: Number(grahamPrice.toFixed(2)),
        otimoPrice: Number(otimoPrice.toFixed(2)),
        discountPercent: Number(discountPercent.toFixed(1)),
        status,
        statusLabel,
        statusColor,
        lastUpdated: new Date().toISOString()
      }, { headers });
    }
  }

  const result = await fetchGrahamDataForTicker(ticker);
  if (!result) {
    return NextResponse.json({ error: 'Não foi possível obter dados para o ticker informado' }, { status: 404, headers });
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

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ results: {} }, { headers });
    }

    const results: Record<string, GrahamStockData> = {};

    await Promise.all(
      tickers.map(async (rawTicker) => {
        try {
          const data = await fetchGrahamDataForTicker(rawTicker);
          if (data) {
            results[data.ticker] = data;
          }
        } catch {
          // ignore individual failures
        }
      })
    );

    return NextResponse.json({ results }, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao processar' }, { status: 500, headers });
  }
}
