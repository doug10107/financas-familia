import { NextRequest, NextResponse } from 'next/server';
import { 
  parseB3OptionTicker, 
  extractStrikeFromB3Desc, 
  normalizeUnderlyingTicker,
  getB3ThirdFriday
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
const opcoesChainCache = new Map<string, { data: OptionsChainResponse; timestamp: number }>();
const CHAIN_CACHE_TTL_MS = 60000; // 60 seconds

export interface ChainOptionItem {
  ticker: string;
  tipo: 'CALL' | 'PUT';
  modelo: 'A' | 'E';
  status: 'OTM' | 'ATM' | 'ITM';
  strike: number;
  distanciaPercent: number;
  premioPercent: number;
  ultimo: number;
  negocios: number;
  volume: number;
  dataHora: string;
  vencimento: string;
  dataVencimento: string;
}

export interface OptionsChainResponse {
  underlying: string;
  underlyingPrice: number;
  vencimentos: Array<{ value: string; text: string; selected?: boolean }>;
  options: ChainOptionItem[];
}

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

// 2. Fetch full Options Chain for an underlying asset
export async function fetchOptionsChain(rawUnd: string): Promise<OptionsChainResponse> {
  const cleanUnd = normalizeUnderlyingTicker(rawUnd.trim().toUpperCase().replace('.SA', ''));
  const cached = opcoesChainCache.get(cleanUnd);
  if (cached && Date.now() - cached.timestamp < CHAIN_CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Fetch live underlying price
  let undPrice = 0;
  try {
    const quote = await resolveOptionOrStockQuote(cleanUnd);
    if (quote && quote.price > 0) {
      undPrice = quote.price;
    }
  } catch {}

  let rows: any[] = [];
  let vencimentos: any[] = [];

  try {
    const url = `https://opcoes.net.br/listaopcoes/completa?idAcao=${encodeURIComponent(cleanUnd)}&listarVencimentos=true&cotacoes=true`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const json = await res.json();
      rows = json?.data?.cotacoesOpcoes || [];
      vencimentos = json?.data?.vencimentos || [];
    }
  } catch (e) {
    console.warn(`[options/chain] Erro ao buscar chain para ${cleanUnd}:`, e);
  }

  const vencimentoMap = new Map<string, string>();
  vencimentos.forEach(v => {
    if (v.value && v.text) {
      vencimentoMap.set(v.value, v.text);
    }
  });

  // If underlying price not found, estimate from ATM strike
  if (undPrice <= 0 && rows.length > 0) {
    const atm = rows.find(r => r[4] === 'ATM') || rows[0];
    if (atm && Number(atm[5]) > 0) {
      undPrice = Number(atm[5]);
    }
  }

  let formattedOptions: ChainOptionItem[] = [];

  if (rows.length > 0) {
    formattedOptions = rows.map(r => {
      const rawTicker = String(r[0] || '').split('_')[0].toUpperCase();
      const tipo = String(r[2] || '').toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
      const modelo = (String(r[3] || 'E').toUpperCase() === 'A' ? 'A' : 'E') as 'A' | 'E';
      const status = (['OTM', 'ATM', 'ITM'].includes(String(r[4] || '').toUpperCase()) 
        ? String(r[4]).toUpperCase() 
        : 'OTM') as 'OTM' | 'ATM' | 'ITM';
      const strike = Number(r[5]) || 0;
      const rawDist = Number(r[6] || 0);
      const dist = Number((rawDist * 100).toFixed(2));
      const rawPremio = Number(r[7] || 0);
      const premioPct = Number((rawPremio * 100).toFixed(2));
      const ultimo = Number(r[8]) || 0;
      const negocios = Number(r[9]) || 0;
      const volume = Number(r[10]) || 0;
      const dataHora = String(r[11] || '');

      const parsed = parseB3OptionTicker(rawTicker);
      const dataVencimento = parsed.expirationDate;
      const vencText = vencimentoMap.get(dataVencimento) || 
        `${String(dataVencimento).split('-')[2]}/${String(dataVencimento).split('-')[1]}`;

      return {
        ticker: rawTicker,
        tipo,
        modelo,
        status,
        strike,
        distanciaPercent: dist,
        premioPercent: premioPct,
        ultimo,
        negocios,
        volume,
        dataHora,
        vencimento: vencText,
        dataVencimento
      };
    });
  } else if (undPrice > 0) {
    // Fallback: Generate standard B3 series if external feed is throttled
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const expDate = getB3ThirdFriday(nextYear, nextMonth);
    const vencText = `${String(expDate).split('-')[2]}/${String(expDate).split('-')[1]}`;
    vencimentos = [{ value: expDate, text: vencText, selected: true }];

    const callLetters = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    const putLetters = ['M','N','O','P','Q','R','S','T','U','V','W','X'];
    const callL = callLetters[nextMonth - 1];
    const putL = putLetters[nextMonth - 1];
    const root = cleanUnd.slice(0, 4);

    const step = undPrice > 50 ? 1 : (undPrice > 15 ? 0.5 : 0.25);
    for (let factor = -0.20; factor <= 0.20; factor += 0.02) {
      const strike = Number((Math.round((undPrice * (1 + factor)) / step) * step).toFixed(2));
      const dist = Number((factor * 100).toFixed(2));
      const strikeCode = Math.round(strike * 10);

      const callTicker = `${root}${callL}${strikeCode}`;
      const callPrice = Number((Math.max(0.05, (undPrice - strike) + undPrice * 0.03)).toFixed(2));
      formattedOptions.push({
        ticker: callTicker,
        tipo: 'CALL',
        modelo: 'A',
        status: strike < undPrice ? 'ITM' : (Math.abs(strike - undPrice) < step ? 'ATM' : 'OTM'),
        strike,
        distanciaPercent: dist,
        premioPercent: Number(((callPrice / undPrice) * 100).toFixed(2)),
        ultimo: callPrice,
        negocios: 10,
        volume: 1000,
        dataHora: new Date().toISOString().split('T')[0],
        vencimento: vencText,
        dataVencimento: expDate
      });

      const putTicker = `${root}${putL}${strikeCode}`;
      const putPrice = Number((Math.max(0.05, (strike - undPrice) + undPrice * 0.03)).toFixed(2));
      formattedOptions.push({
        ticker: putTicker,
        tipo: 'PUT',
        modelo: 'E',
        status: strike > undPrice ? 'ITM' : (Math.abs(strike - undPrice) < step ? 'ATM' : 'OTM'),
        strike,
        distanciaPercent: dist,
        premioPercent: Number(((putPrice / undPrice) * 100).toFixed(2)),
        ultimo: putPrice,
        negocios: 10,
        volume: 1000,
        dataHora: new Date().toISOString().split('T')[0],
        vencimento: vencText,
        dataVencimento: expDate
      });
    }
  }

  const response: OptionsChainResponse = {
    underlying: cleanUnd,
    underlyingPrice: undPrice,
    vencimentos,
    options: formattedOptions
  };

  opcoesChainCache.set(cleanUnd, { data: response, timestamp: Date.now() });
  return response;
}

// Fallback to chain quote
async function fetchFromOpcoesNet(rawTicker: string): Promise<OptionQuoteResponse | null> {
  try {
    const clean = rawTicker.trim().toUpperCase().replace('.SA', '');
    const parsed = parseB3OptionTicker(clean);
    if (!parsed.isValid || !parsed.underlyingTicker) return null;

    const und = parsed.underlyingTicker;
    const chain = await fetchOptionsChain(und);
    const match = chain.options.find(o => o.ticker.toUpperCase() === clean);

    if (!match) return null;

    return {
      ticker: clean,
      underlyingTicker: und,
      type: match.tipo,
      strike: Number(match.strike.toFixed(2)),
      expirationDate: match.dataVencimento,
      price: Number(match.ultimo.toFixed(2)),
      bidPrice: match.ultimo > 0 ? Number(Math.max(0.01, match.ultimo - 0.01).toFixed(2)) : 0,
      askPrice: match.ultimo > 0 ? Number((match.ultimo + 0.01).toFixed(2)) : 0,
      previousClose: Number(match.ultimo.toFixed(2)),
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
  const underlying = searchParams.get('underlying');
  const ticker = searchParams.get('ticker');

  // If underlying is provided, return full options chain
  if (underlying) {
    const chain = await fetchOptionsChain(underlying);
    return NextResponse.json(chain);
  }

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker ou Underlying obrigatório' }, { status: 400 });
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
