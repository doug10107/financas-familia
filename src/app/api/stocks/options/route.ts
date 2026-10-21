import { NextRequest, NextResponse } from 'next/server';
import { parseB3OptionTicker } from '@/lib/options/optionsEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OptionQuoteResponse {
  ticker: string;
  underlyingTicker: string;
  type: 'CALL' | 'PUT' | 'STOCK';
  strike: number;
  expirationDate: string;
  price: number;
  bidPrice: number;
  askPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  source: 'market_api' | 'profit_bridge' | 'cache_estimate';
  lastUpdated: string;
}

// In-memory cache for recent quotes
const quoteCache = new Map<string, { data: OptionQuoteResponse; timestamp: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds cache

async function fetchFromYahooFinance(ticker: string): Promise<OptionQuoteResponse | null> {
  try {
    const formatted = ticker.endsWith('.SA') ? ticker : `${ticker}.SA`;
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

    const parsed = parseB3OptionTicker(ticker);

    return {
      ticker: ticker.toUpperCase(),
      underlyingTicker: parsed.underlyingTicker,
      type: parsed.type,
      strike: parsed.estimatedStrike,
      expirationDate: parsed.expirationDate,
      price: Number(price.toFixed(2)),
      bidPrice: Number((price * 0.98).toFixed(2)),
      askPrice: Number((price * 1.02).toFixed(2)),
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

// Try local Profit Bridge if running (HTTP port 5001)
async function fetchFromProfitBridge(ticker: string): Promise<OptionQuoteResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600); // Fast 600ms abort if not running

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
    // Profit bridge not active, continue with market fallback
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker obrigatório' }, { status: 400 });
  }

  const clean = ticker.trim().toUpperCase();

  // Check cache
  const cached = quoteCache.get(clean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // 1. Try Profit Bridge first (true 0-delay if running locally)
  const profitQuote = await fetchFromProfitBridge(clean);
  if (profitQuote) {
    quoteCache.set(clean, { data: profitQuote, timestamp: Date.now() });
    return NextResponse.json(profitQuote);
  }

  // 2. Try Market API (Yahoo Finance / Brapi)
  const marketQuote = await fetchFromYahooFinance(clean);
  if (marketQuote) {
    quoteCache.set(clean, { data: marketQuote, timestamp: Date.now() });
    return NextResponse.json(marketQuote);
  }

  // 3. Fallback: Parse contract details and provide baseline
  const parsed = parseB3OptionTicker(clean);
  const fallbackQuote: OptionQuoteResponse = {
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

  return NextResponse.json(fallbackQuote);
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
        const clean = raw.trim().toUpperCase();
        if (!clean) return;

        // Check cache
        const cached = quoteCache.get(clean);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          quotes[clean] = cached.data;
          return;
        }

        // Try profit bridge
        const profit = await fetchFromProfitBridge(clean);
        if (profit) {
          quoteCache.set(clean, { data: profit, timestamp: Date.now() });
          quotes[clean] = profit;
          return;
        }

        // Try market api
        const market = await fetchFromYahooFinance(clean);
        if (market) {
          quoteCache.set(clean, { data: market, timestamp: Date.now() });
          quotes[clean] = market;
          return;
        }

        // Fallback info
        const parsed = parseB3OptionTicker(clean);
        const fallback: OptionQuoteResponse = {
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
        quotes[clean] = fallback;
      })
    );

    return NextResponse.json({ quotes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar cotações de opções' }, { status: 500 });
  }
}
