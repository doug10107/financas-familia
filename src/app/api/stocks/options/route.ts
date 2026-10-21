import { NextRequest, NextResponse } from 'next/server';
import { 
  parseB3OptionTicker, 
  extractStrikeFromB3Desc, 
  normalizeUnderlyingTicker 
} from '@/lib/options/optionsEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface OptionQuoteResponse {
  ticker: string;
  underlyingTicker: string;
  underlyingPrice?: number;
  type: 'CALL' | 'PUT' | 'STOCK';
  strike: number;
  expirationDate: string;
  price: number;
  bidPrice: number;
  askPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  source: 'b3_official' | 'opcoes_net' | 'market_api' | 'profit_bridge' | 'cache_estimate';
  lastUpdated: string;
}

// In-memory cache for recent quotes
const quoteCache = new Map<string, { data: OptionQuoteResponse; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds cache

// Cache for opcoes.net.br chains per underlying asset
const opcoesChainCache = new Map<string, { rows: any[]; timestamp: number }>();
const CHAIN_CACHE_TTL_MS = 60000; // 60 seconds

// 1. Official B3 Real-Time Quotation API (works for Stocks, ETFs, FIIs, and Options!)
async function fetchFromB3Official(rawTicker: string): Promise<OptionQuoteResponse | null> {
  try {
    const clean = rawTicker.trim().toUpperCase().replace('.SA', '');
    // If user typed a 4-letter root like BOVA or PETR, normalize to BOVA11 / PETR4
    const queryTicker = /^[A-Z]{4}$/.test(clean) ? normalizeUnderlyingTicker(clean) : clean;

    const url = `https://cotacao.b3.com.br/mds/api/v1/InstrumentQuotation/${encodeURIComponent(queryTicker)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) return null;

    const data = await res.json();
    const scty = data?.Trad?.[0]?.scty;
    if (!scty) return null;

    const qtn = scty.SctyQtn || {};
    const mktName = (scty.mkt?.nm || '').toUpperCase();
    const isOption = mktName.includes('OPCOES') || mktName.includes('OPÇÕES') || mktName.includes('OPCAO');

    const curPrc = Number(qtn.curPrc || qtn.avrgPric || qtn.opngPric || 0);
    const prcFlcn = Number(qtn.prcFlcn || 0);

    // Calculate previousClose from curPrc and prcFlcn (%)
    let prevClose = curPrc;
    if (curPrc > 0 && prcFlcn !== 0 && prcFlcn > -100) {
      prevClose = curPrc / (1 + prcFlcn / 100);
    }
    const change = curPrc - prevClose;

    const parsed = parseB3OptionTicker(queryTicker);
    const officialStrike = extractStrikeFromB3Desc(scty.desc);
    const strike = officialStrike > 0 ? officialStrike : parsed.estimatedStrike;

    // Even if curPrc is 0 (illiquid option with no trade yet today), B3 still gives official strike in desc
    if (curPrc <= 0 && officialStrike <= 0) {
      return null;
    }

    const minPric = Number(qtn.minPric || curPrc);
    const maxPric = Number(qtn.maxPric || curPrc);
    const bidPrice = curPrc > 0 ? Number(Math.max(0.01, curPrc - 0.01).toFixed(2)) : minPric;
    const askPrice = curPrc > 0 ? Number((curPrc + 0.01).toFixed(2)) : maxPric;

    return {
      ticker: queryTicker,
      underlyingTicker: isOption ? parsed.underlyingTicker : queryTicker,
      type: isOption ? parsed.type : 'STOCK',
      strike: Number(strike.toFixed(2)),
      expirationDate: parsed.expirationDate,
      price: Number(curPrc.toFixed(2)),
      bidPrice: Number(bidPrice.toFixed(2)),
      askPrice: Number(askPrice.toFixed(2)),
      previousClose: Number(prevClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(prcFlcn.toFixed(2)),
      source: 'b3_official',
      lastUpdated: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

// 2. Fallback to Opcoes.net.br for options without trades on B3 feed today
async function fetchFromOpcoesNet(rawTicker: string): Promise<OptionQuoteResponse | null> {
  try {
    const clean = rawTicker.trim().toUpperCase().replace('.SA', '');
    const parsed = parseB3OptionTicker(clean);
    if (!parsed.isValid || !parsed.underlyingTicker) return null;

    const und = parsed.underlyingTicker;
    let rows: any[] = [];

    const cachedChain = opcoesChainCache.get(und);
    if (cachedChain && Date.now() - cachedChain.timestamp < CHAIN_CACHE_TTL_MS) {
      rows = cachedChain.rows;
    } else {
      const url = `https://opcoes.net.br/listaopcoes/completa?idAcao=${encodeURIComponent(und)}&listarVencimentos=true&cotacoes=true`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        rows = json?.data?.cotacoesOpcoes || [];
        if (rows.length > 0) {
          opcoesChainCache.set(und, { rows, timestamp: Date.now() });
        }
      }
    }

    if (rows.length === 0) return null;

    const match = rows.find((r: any) => {
      const t = String(r[0] || '').split('_')[0].toUpperCase();
      return t === clean;
    });

    if (!match) return null;

    const optType = String(match[2] || '').toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
    const strike = Number(match[5]) || parsed.estimatedStrike;
    const price = Number(match[8]) || 0;

    return {
      ticker: clean,
      underlyingTicker: und,
      type: optType,
      strike: Number(strike.toFixed(2)),
      expirationDate: parsed.expirationDate,
      price: Number(price.toFixed(2)),
      bidPrice: price > 0 ? Number(Math.max(0.01, price - 0.01).toFixed(2)) : 0,
      askPrice: price > 0 ? Number((price + 0.01).toFixed(2)) : 0,
      previousClose: Number(price.toFixed(2)),
      change: 0,
      changePercent: 0,
      source: 'opcoes_net',
      lastUpdated: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

// 3. Yahoo Finance fallback (for stocks/ETFs)
async function fetchFromYahooFinance(ticker: string): Promise<OptionQuoteResponse | null> {
  try {
    const clean = ticker.trim().toUpperCase().replace('.SA', '');
    const queryTicker = /^[A-Z]{4}$/.test(clean) ? normalizeUnderlyingTicker(clean) : clean;
    const formatted = `${queryTicker}.SA`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(formatted)}?interval=1d&range=1d`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;

    const price = Number(meta.regularMarketPrice) || 0;
    const prevClose = Number(meta.chartPreviousClose || meta.previousClose) || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const parsed = parseB3OptionTicker(queryTicker);

    return {
      ticker: queryTicker,
      underlyingTicker: parsed.underlyingTicker,
      type: parsed.type,
      strike: parsed.estimatedStrike,
      expirationDate: parsed.expirationDate,
      price: Number(price.toFixed(2)),
      bidPrice: Number((price * 0.99).toFixed(2)),
      askPrice: Number((price * 1.01).toFixed(2)),
      previousClose: Number(prevClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      source: 'market_api',
      lastUpdated: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

// 4. Try local Profit Bridge if running (HTTP port 5001)
async function fetchFromProfitBridge(ticker: string): Promise<OptionQuoteResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 350); // Fast 350ms abort if not running

    const res = await fetch(`http://127.0.0.1:5001/quote?ticker=${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.price > 0) {
        return {
          ticker: ticker.toUpperCase(),
          underlyingTicker: data.underlying || ticker,
          type: data.type || 'CALL',
          strike: data.strike || 0,
          expirationDate: data.expirationDate || '',
          price: Number(data.price.toFixed(2)),
          bidPrice: Number((data.bid || data.price).toFixed(2)),
          askPrice: Number((data.ask || data.price).toFixed(2)),
          previousClose: Number((data.previousClose || data.price).toFixed(2)),
          change: Number((data.change || 0).toFixed(2)),
          changePercent: Number((data.changePercent || 0).toFixed(2)),
          source: 'profit_bridge',
          lastUpdated: new Date().toISOString()
        };
      }
    }
  } catch {
    // Profit bridge not active, continue with B3 official fallback
  }
  return null;
}

// Unified resolver for any single ticker (Option or Underlying Stock/ETF)
async function resolveOptionOrStockQuote(rawTicker: string): Promise<OptionQuoteResponse> {
  const clean = rawTicker.trim().toUpperCase().replace('.SA', '');

  const cached = quoteCache.get(clean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Try Profit Bridge first (if running locally)
  const profitQuote = await fetchFromProfitBridge(clean);
  if (profitQuote && profitQuote.price > 0) {
    quoteCache.set(clean, { data: profitQuote, timestamp: Date.now() });
    return profitQuote;
  }

  // 2. Try Official B3 Real-Time API (best for B3 Options, ETFs like BOVA11, and Stocks like PETR4)
  const b3Quote = await fetchFromB3Official(clean);
  if (b3Quote && b3Quote.price > 0) {
    quoteCache.set(clean, { data: b3Quote, timestamp: Date.now() });
    return b3Quote;
  }

  // 3. Try Opcoes.net.br if it's an option that hasn't traded today on B3 or needs strike + closing price
  const opcoesQuote = await fetchFromOpcoesNet(clean);
  if (opcoesQuote && (opcoesQuote.price > 0 || opcoesQuote.strike > 0)) {
    // Merge B3 official strike if B3 had strike but 0 price
    if (b3Quote && b3Quote.strike > 0) {
      opcoesQuote.strike = b3Quote.strike;
    }
    quoteCache.set(clean, { data: opcoesQuote, timestamp: Date.now() });
    return opcoesQuote;
  }

  // If B3 returned a valid strike even with price 0
  if (b3Quote && b3Quote.strike > 0) {
    quoteCache.set(clean, { data: b3Quote, timestamp: Date.now() });
    return b3Quote;
  }

  // 4. Try Yahoo Finance (fallback for stocks/ETFs)
  const yahooQuote = await fetchFromYahooFinance(clean);
  if (yahooQuote) {
    quoteCache.set(clean, { data: yahooQuote, timestamp: Date.now() });
    return yahooQuote;
  }

  // 5. Fallback contract parser
  const parsed = parseB3OptionTicker(clean);
  return {
    ticker: clean,
    underlyingTicker: parsed.underlyingTicker,
    type: parsed.type,
    strike: parsed.estimatedStrike,
    expirationDate: parsed.expirationDate,
    price: 0,
    bidPrice: 0,
    askPrice: 0,
    previousClose: 0,
    change: 0,
    changePercent: 0,
    source: 'cache_estimate',
    lastUpdated: new Date().toISOString()
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker obrigatório' }, { status: 400 });
  }

  const clean = ticker.trim().toUpperCase().replace('.SA', '');
  const quote = await resolveOptionOrStockQuote(clean);

  // Also fetch live underlying price if this is an option so the UI can update the underlying price automatically
  if (quote.underlyingTicker && quote.underlyingTicker !== quote.ticker) {
    const undQuote = await resolveOptionOrStockQuote(quote.underlyingTicker);
    if (undQuote && undQuote.price > 0) {
      quote.underlyingPrice = undQuote.price;
    }
  } else if (quote.price > 0) {
    quote.underlyingPrice = quote.price;
  }

  return NextResponse.json(quote);
}

// Batch Quotes endpoint for entire strategy portfolio
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tickers: string[] = body.tickers || [];

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ quotes: {} });
    }

    const quotes: Record<string, OptionQuoteResponse> = {};

    await Promise.all(
      tickers.map(async (raw) => {
        const clean = raw.trim().toUpperCase().replace('.SA', '');
        if (!clean) return;
        const resolved = await resolveOptionOrStockQuote(clean);
        quotes[clean] = resolved;
        quotes[resolved.ticker] = resolved;
      })
    );

    return NextResponse.json({ quotes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar cotações de opções' }, { status: 500 });
  }
}
