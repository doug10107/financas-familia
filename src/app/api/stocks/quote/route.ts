import { NextRequest, NextResponse } from 'next/server';

function formatYahooTicker(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (!clean) return '';
  if (clean.includes('.')) return clean;
  if (clean.includes('-')) return clean;

  // Crypto in BRL (Reais)
  if (['BTC', 'BITCOIN'].includes(clean)) return 'BTC-BRL';
  if (['ETH', 'ETHEREUM'].includes(clean)) return 'ETH-BRL';
  if (['SOL', 'SOLANA'].includes(clean)) return 'SOL-BRL';
  if (['USDT', 'TETHER'].includes(clean)) return 'USDT-BRL';
  if (['ADA', 'CARDANO'].includes(clean)) return 'ADA-BRL';
  if (['XRP', 'RIPPLE'].includes(clean)) return 'XRP-BRL';

  // If it's a Brazilian stock/FII/ETF (e.g. PETR4, MXRF11, BOVA11, VALE3, SMAL11)
  if (/^[A-Z]{4}\d{1,2}[A-Z]?$/.test(clean)) {
    return `${clean}.SA`;
  }

  return clean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const search = searchParams.get('search');

  try {
    // Autocomplete / Search endpoint
    if (search) {
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=6&newsCount=0`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 300 } // Cache 5 min
      });

      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }

      const data = await res.json();
      const results = (data.quotes || []).map((q: any) => {
        let cleanSymbol = q.symbol;
        if (cleanSymbol.endsWith('.SA')) {
          cleanSymbol = cleanSymbol.replace('.SA', '');
        } else if (cleanSymbol.endsWith('-BRL')) {
          cleanSymbol = cleanSymbol.replace('-BRL', '');
        }
        return {
          symbol: cleanSymbol,
          rawSymbol: q.symbol,
          name: q.shortname || q.longname || cleanSymbol,
          type: q.quoteType || 'EQUITY',
          exchange: q.exchange || 'SAO'
        };
      });

      return NextResponse.json({ results });
    }

    // Single Ticker Quote endpoint
    if (ticker) {
      const formattedTicker = formatYahooTicker(ticker);
      const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formattedTicker)}?interval=1d&range=1d`;
      
      const res = await fetch(quoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 60 } // Cache 1 min
      });

      if (!res.ok) {
        return NextResponse.json({ error: 'Ativo não encontrado ou erro na cotação' }, { status: 404 });
      }

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
        return NextResponse.json({ error: 'Dados do ativo não disponíveis' }, { status: 404 });
      }

      const meta = result.meta;
      const currentPrice = Number(meta.regularMarketPrice) || 0;
      const prevClose = Number(meta.chartPreviousClose || meta.previousClose) || currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      let cleanSymbol = meta.symbol;
      if (cleanSymbol.endsWith('.SA')) cleanSymbol = cleanSymbol.replace('.SA', '');
      if (cleanSymbol.endsWith('-BRL')) cleanSymbol = cleanSymbol.replace('-BRL', '');

      return NextResponse.json({
        symbol: cleanSymbol,
        name: meta.shortName || meta.longName || cleanSymbol,
        price: Number(currentPrice.toFixed(2)),
        previousClose: Number(prevClose.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        currency: meta.currency || 'BRL',
        lastUpdated: new Date().toISOString()
      });
    }

    return NextResponse.json({ error: 'Parâmetro ticker ou search obrigatório' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro na rota de cotações:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar cotação' }, { status: 500 });
  }
}

// Batch Quotes endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tickers: string[] = body.tickers || [];

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ quotes: {} });
    }

    const quotes: Record<string, any> = {};

    // Fetch in parallel
    await Promise.all(
      tickers.map(async (rawTicker) => {
        try {
          const formatted = formatYahooTicker(rawTicker);
          const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formatted)}?interval=1d&range=1d`;
          
          const res = await fetch(quoteUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 60 }
          });

          if (res.ok) {
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
              const currentPrice = Number(meta.regularMarketPrice) || 0;
              const prevClose = Number(meta.chartPreviousClose || meta.previousClose) || currentPrice;
              const change = currentPrice - prevClose;
              const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
              
              let clean = meta.symbol;
              if (clean.endsWith('.SA')) clean = clean.replace('.SA', '');
              if (clean.endsWith('-BRL')) clean = clean.replace('-BRL', '');

              quotes[rawTicker.toUpperCase()] = {
                symbol: clean,
                name: meta.shortName || clean,
                price: Number(currentPrice.toFixed(2)),
                change: Number(change.toFixed(2)),
                changePercent: Number(changePercent.toFixed(2)),
                currency: meta.currency || 'BRL'
              };
            }
          }
        } catch (e) {
          // ignore single quote errors
        }
      })
    );

    return NextResponse.json({ quotes });
  } catch (error: any) {
    console.error('Erro no batch quotes:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar cotações' }, { status: 500 });
  }
}
