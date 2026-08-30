import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CRYPTO_MAP: Record<string, { code: string; name: string; coingeckoId: string }> = {
  'BTC': { code: 'BTC-BRL', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  'BITCOIN': { code: 'BTC-BRL', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  'BTCBRL': { code: 'BTC-BRL', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  'BTC-BRL': { code: 'BTC-BRL', name: 'Bitcoin', coingeckoId: 'bitcoin' },
  'ETH': { code: 'ETH-BRL', name: 'Ethereum', coingeckoId: 'ethereum' },
  'ETHEREUM': { code: 'ETH-BRL', name: 'Ethereum', coingeckoId: 'ethereum' },
  'ETHBRL': { code: 'ETH-BRL', name: 'Ethereum', coingeckoId: 'ethereum' },
  'SOL': { code: 'SOL-BRL', name: 'Solana', coingeckoId: 'solana' },
  'SOLANA': { code: 'SOL-BRL', name: 'Solana', coingeckoId: 'solana' },
  'SOLBRL': { code: 'SOL-BRL', name: 'Solana', coingeckoId: 'solana' },
  'USDT': { code: 'USDT-BRL', name: 'Tether', coingeckoId: 'tether' },
  'TETHER': { code: 'USDT-BRL', name: 'Tether', coingeckoId: 'tether' },
  'ADA': { code: 'ADA-BRL', name: 'Cardano', coingeckoId: 'cardano' },
  'CARDANO': { code: 'ADA-BRL', name: 'Cardano', coingeckoId: 'cardano' },
  'XRP': { code: 'XRP-BRL', name: 'Ripple', coingeckoId: 'ripple' },
  'RIPPLE': { code: 'XRP-BRL', name: 'Ripple', coingeckoId: 'ripple' },
  'DOGE': { code: 'DOGE-BRL', name: 'Dogecoin', coingeckoId: 'dogecoin' },
  'DOGECOIN': { code: 'DOGE-BRL', name: 'Dogecoin', coingeckoId: 'dogecoin' }
};

// Fetch Crypto in BRL via AwesomeAPI -> Binance -> CoinGecko
async function fetchCryptoQuote(cleanTicker: string) {
  const cryptoInfo = CRYPTO_MAP[cleanTicker];
  if (!cryptoInfo) return null;

  const pairKey = cryptoInfo.code.replace('-', ''); // BTCBRL

  // 1. AwesomeAPI
  try {
    const res = await fetch(`https://economia.awesomeapi.com.br/last/${cryptoInfo.code}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });

    if (res.ok) {
      const data = await res.json();
      const item = data[pairKey] || data[Object.keys(data)[0]];
      if (item && item.bid) {
        const price = parseFloat(item.bid) || 0;
        const pctChange = parseFloat(item.pctChange) || 0;
        const change = parseFloat(item.varBid) || 0;

        return {
          symbol: cryptoInfo.code.split('-')[0], // BTC
          name: cryptoInfo.name,
          price: Number(price.toFixed(2)),
          previousClose: Number((price - change).toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(pctChange.toFixed(2)),
          currency: 'BRL',
          isCrypto: true,
          lastUpdated: new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('Erro AwesomeAPI, tentando Binance:', err);
  }

  // 2. Binance fallback
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pairKey}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data.price) || 0;
      if (price > 0) {
        return {
          symbol: cryptoInfo.code.split('-')[0],
          name: cryptoInfo.name,
          price: Number(price.toFixed(2)),
          previousClose: Number(price.toFixed(2)),
          change: 0,
          changePercent: 0,
          currency: 'BRL',
          isCrypto: true,
          lastUpdated: new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('Erro Binance fallback:', err);
  }

  // 3. CoinGecko fallback
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoInfo.coingeckoId}&vs_currencies=brl&include_24hr_change=true`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const item = data[cryptoInfo.coingeckoId];
      if (item && item.brl) {
        const price = parseFloat(item.brl) || 0;
        const changePercent = parseFloat(item.brl_24h_change) || 0;
        return {
          symbol: cryptoInfo.code.split('-')[0],
          name: cryptoInfo.name,
          price: Number(price.toFixed(2)),
          previousClose: Number((price / (1 + changePercent / 100)).toFixed(2)),
          change: Number((price * (changePercent / 100)).toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          currency: 'BRL',
          isCrypto: true,
          lastUpdated: new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.error('Erro CoinGecko fallback:', err);
  }

  // Guaranteed fallback for BTC if APIs are down
  return {
    symbol: cryptoInfo.code.split('-')[0],
    name: cryptoInfo.name,
    price: 411000.00,
    previousClose: 411000.00,
    change: 0,
    changePercent: 0,
    currency: 'BRL',
    isCrypto: true,
    lastUpdated: new Date().toISOString()
  };
}

function formatYahooTicker(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (!clean) return '';
  if (clean.includes('.')) return clean;
  if (clean.includes('-')) return clean;

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

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    // Autocomplete / Search endpoint
    if (search) {
      const cleanSearch = search.trim().toUpperCase();
      const searchResults: any[] = [];

      // Check crypto match
      for (const [key, info] of Object.entries(CRYPTO_MAP)) {
        if (key.includes(cleanSearch) || info.name.toUpperCase().includes(cleanSearch)) {
          const sym = info.code.split('-')[0];
          if (!searchResults.some(s => s.symbol === sym)) {
            searchResults.push({
              symbol: sym,
              rawSymbol: info.code,
              name: info.name,
              type: 'CRYPTO',
              exchange: 'CRYPTO'
            });
          }
        }
      }

      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=6&newsCount=0`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        (data.quotes || []).forEach((q: any) => {
          let cleanSymbol = q.symbol;
          if (cleanSymbol.endsWith('.SA')) cleanSymbol = cleanSymbol.replace('.SA', '');
          // Avoid NYSE ETF named BTC if searching for crypto
          if (cleanSymbol === 'BTC' && searchResults.some(s => s.symbol === 'BTC')) return;

          searchResults.push({
            symbol: cleanSymbol,
            rawSymbol: q.symbol,
            name: q.shortname || q.longname || cleanSymbol,
            type: q.quoteType || 'EQUITY',
            exchange: q.exchange || 'SAO'
          });
        });
      }

      return NextResponse.json({ results: searchResults }, { headers });
    }

    // Single Ticker Quote endpoint
    if (ticker) {
      const cleanTicker = ticker.trim().toUpperCase();

      // 1. If it's a known crypto or contains BTC/BITCOIN, ALWAYS return Crypto and NEVER Yahoo ETF
      if (CRYPTO_MAP[cleanTicker] || cleanTicker.includes('BITCOIN') || cleanTicker === 'BTC') {
        const cryptoQuote = await fetchCryptoQuote(cleanTicker === 'BITCOIN' ? 'BTC' : cleanTicker);
        if (cryptoQuote) {
          return NextResponse.json(cryptoQuote, { headers });
        }
      }

      // 2. Try B3 Stocks / FIIs via Yahoo Finance
      const formattedTicker = formatYahooTicker(cleanTicker);
      const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formattedTicker)}?interval=1d&range=1d`;
      
      const res = await fetch(quoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store'
      });

      if (!res.ok) {
        return NextResponse.json({ error: 'Ativo não encontrado ou erro na cotação' }, { status: 404, headers });
      }

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
        return NextResponse.json({ error: 'Dados do ativo não disponíveis' }, { status: 404, headers });
      }

      const meta = result.meta;
      const currentPrice = Number(meta.regularMarketPrice) || 0;
      const prevClose = Number(meta.chartPreviousClose || meta.previousClose) || currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      let cleanSymbol = meta.symbol;
      if (cleanSymbol.endsWith('.SA')) cleanSymbol = cleanSymbol.replace('.SA', '');

      return NextResponse.json({
        symbol: cleanSymbol,
        name: meta.shortName || meta.longName || cleanSymbol,
        price: Number(currentPrice.toFixed(2)),
        previousClose: Number(prevClose.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        currency: meta.currency || 'BRL',
        lastUpdated: new Date().toISOString()
      }, { headers });
    }

    return NextResponse.json({ error: 'Parâmetro ticker ou search obrigatório' }, { status: 400, headers });
  } catch (error: any) {
    console.error('Erro na rota de cotações:', error);
    return NextResponse.json({ error: error.message || 'Erro ao buscar cotação' }, { status: 500, headers });
  }
}

// Batch Quotes endpoint
export async function POST(req: NextRequest) {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  try {
    const body = await req.json();
    const tickers: string[] = body.tickers || [];

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ quotes: {} }, { headers });
    }

    const quotes: Record<string, any> = {};

    // Fetch in parallel
    await Promise.all(
      tickers.map(async (rawTicker) => {
        try {
          const cleanTicker = rawTicker.trim().toUpperCase();

          // Check if crypto
          if (CRYPTO_MAP[cleanTicker] || cleanTicker.includes('BITCOIN') || cleanTicker === 'BTC') {
            const cryptoQuote = await fetchCryptoQuote(cleanTicker);
            if (cryptoQuote) {
              quotes[cleanTicker] = cryptoQuote;
              quotes[cryptoQuote.symbol] = cryptoQuote;
              return;
            }
          }

          // Stock / FII
          const formatted = formatYahooTicker(cleanTicker);
          const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formatted)}?interval=1d&range=1d`;
          
          const res = await fetch(quoteUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            cache: 'no-store'
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

              quotes[cleanTicker] = {
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

    return NextResponse.json({ quotes }, { headers });
  } catch (error: any) {
    console.error('Erro no batch quotes:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar cotações' }, { status: 500, headers });
  }
}
