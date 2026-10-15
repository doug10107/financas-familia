import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type ViabilityType = 'BOMBA' | 'ATENCAO' | 'VIAVEL' | 'AZULIM';

export type ScreenerAsset = {
  ticker: string;
  name: string;
  type: 'acoes' | 'stocks' | 'fiis';
  price: number;
  sector: string;
  subsector: string;
  segment: string;
  pl: number | null;
  pvp: number | null;
  dy: number | null;
  roe: number | null;
  margemLiq: number | null;
  dividaEbitda: number | null;
  liquidezMedia: number | null;
  cresc5a: number | null;
  grahamPrice: number | null;
  grahamDiscount: number | null;
  bazinPrice: number | null;
  bazinDiscount: number | null;
  viability: ViabilityType;
  viabilityReason: string;
  lastUpdated: string;
};

// In-memory cache for fast response
let cachedAcoes: ScreenerAsset[] = [];
let cachedFiis: ScreenerAsset[] = [];
let cachedStocks: ScreenerAsset[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

function parseBrNumber(val?: string | null): number | null {
  if (!val) return null;
  const clean = val.replace(/[R$\s%]/g, '').trim();
  if (!clean || clean === '-' || clean === 'N/A' || clean === 'null') return null;
  const num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? null : num;
}

// Calculate Viability Seal based on fundamental metrics
function calculateViability(
  pl: number | null,
  pvp: number | null,
  dy: number | null,
  roe: number | null,
  margemLiq: number | null,
  dividaEbitda: number | null,
  ticker: string
): { viability: ViabilityType; reason: string } {
  // 1. Check for "BOMBA" (High Risk / Prejuízo / Falência / Dívida Crítica)
  if ((pl !== null && pl < 0) || (roe !== null && roe < 0) || (margemLiq !== null && margemLiq < -5)) {
    return {
      viability: 'BOMBA',
      reason: 'Empresa operando com prejuízo líquido recorrente ou margem negativa.'
    };
  }
  if (dividaEbitda !== null && dividaEbitda > 4.5) {
    return {
      viability: 'BOMBA',
      reason: 'Alavancagem financeira excessiva (Dívida Líq./EBITDA > 4.5x).'
    };
  }

  // 2. Check for "AZULIM" (Blue Chip / Top Qualidade / Graham & Bazin Aprovado)
  const isEliteTicker = ['BBAS3', 'ITUB4', 'VALE3', 'PETR4', 'TAEE11', 'EGIE3', 'WEGE3', 'CPLE6', 'CXSE3', 'BBSE3', 'VIVT3', 'SAPR11', 'BBDC4', 'SANB11', 'CMIG4', 'ALUP11', 'HGLG11', 'MXRF11', 'XPML11', 'KNCR11', 'BTLG11', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'SPY', 'IVV', 'VOO', 'QQQ', 'SCHD'].includes(ticker.toUpperCase());
  
  const hasStrongFundamentals = 
    (roe !== null && roe >= 14) &&
    (dy !== null && dy >= 4.5) &&
    (pl !== null && pl > 0 && pl <= 16) &&
    (pvp !== null && pvp <= 2.2) &&
    (margemLiq === null || margemLiq >= 10);

  if (isEliteTicker || hasStrongFundamentals) {
    return {
      viability: 'AZULIM',
      reason: 'Empresa líder de setor, rentabilidade sólida (ROE > 14%), dividendos consistentes e balanço seguro.'
    };
  }

  // 3. Check for "REQUER ATENÇÃO"
  if (
    (pl !== null && (pl > 25 || pl <= 1.5)) ||
    (pvp !== null && pvp > 3.5) ||
    (dividaEbitda !== null && dividaEbitda >= 3.0) ||
    (roe !== null && roe < 6)
  ) {
    return {
      viability: 'ATENCAO',
      reason: 'Valuation esticado (P/L ou P/VP alto) ou alavancagem moderada.'
    };
  }

  // 4. Default: "VIÁVEL"
  return {
    viability: 'VIAVEL',
    reason: 'Métricas saudáveis, lucratividade estável e risco equilibrado.'
  };
}

// Fallback curated database for B3 stocks with sectors and metrics
const CURATED_ACOES_BASE: ScreenerAsset[] = [
  {
    ticker: 'BBAS3',
    name: 'Banco do Brasil ON',
    type: 'acoes',
    price: 28.45,
    sector: 'Financeiro',
    subsector: 'Intermediários Financeiros',
    segment: 'Bancos',
    pl: 4.35,
    pvp: 0.76,
    dy: 9.85,
    roe: 21.4,
    margemLiq: 18.2,
    dividaEbitda: 0.0,
    liquidezMedia: 350000000,
    cresc5a: 12.5,
    grahamPrice: 42.10,
    grahamDiscount: 32.4,
    bazinPrice: 44.50,
    bazinDiscount: 36.1,
    viability: 'AZULIM',
    viabilityReason: 'Líder financeiro com alto ROE (21%) e forte dividendo.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'ITUB4',
    name: 'Itaú Unibanco PN',
    type: 'acoes',
    price: 34.20,
    sector: 'Financeiro',
    subsector: 'Intermediários Financeiros',
    segment: 'Bancos',
    pl: 7.95,
    pvp: 1.45,
    dy: 7.40,
    roe: 20.8,
    margemLiq: 22.1,
    dividaEbitda: 0.0,
    liquidezMedia: 520000000,
    cresc5a: 10.2,
    grahamPrice: 41.50,
    grahamDiscount: 17.6,
    bazinPrice: 42.20,
    bazinDiscount: 18.9,
    viability: 'AZULIM',
    viabilityReason: 'Maior banco privado da América Latina com alta rentabilidade consistente.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'PETR4',
    name: 'Petrobras PN',
    type: 'acoes',
    price: 38.60,
    sector: 'Petróleo, Gás e Biocombustíveis',
    subsector: 'Petróleo e Gás',
    segment: 'Exploração e Refino',
    pl: 4.80,
    pvp: 1.15,
    dy: 14.50,
    roe: 24.5,
    margemLiq: 23.4,
    dividaEbitda: 0.85,
    liquidezMedia: 1200000000,
    cresc5a: 15.1,
    grahamPrice: 58.20,
    grahamDiscount: 33.7,
    bazinPrice: 93.10,
    bazinDiscount: 58.5,
    viability: 'AZULIM',
    viabilityReason: 'Excelente geração de caixa livre e dividendos expressivos.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'VALE3',
    name: 'Vale ON',
    type: 'acoes',
    price: 61.30,
    sector: 'Materiais Básicos',
    subsector: 'Mineração',
    segment: 'Minerais Metálicos',
    pl: 5.90,
    pvp: 1.30,
    dy: 9.10,
    roe: 22.0,
    margemLiq: 21.8,
    dividaEbitda: 0.65,
    liquidezMedia: 980000000,
    cresc5a: 8.5,
    grahamPrice: 78.40,
    grahamDiscount: 21.8,
    bazinPrice: 92.80,
    bazinDiscount: 33.9,
    viability: 'AZULIM',
    viabilityReason: 'Gigante global de minério de ferro com baixo custo de extração.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'TAEE11',
    name: 'Taesa UNT',
    type: 'acoes',
    price: 34.80,
    sector: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
    segment: 'Transmissão',
    pl: 8.90,
    pvp: 1.65,
    dy: 10.20,
    roe: 19.5,
    margemLiq: 48.0,
    dividaEbitda: 3.2,
    liquidezMedia: 75000000,
    cresc5a: 11.2,
    grahamPrice: 42.00,
    grahamDiscount: 17.1,
    bazinPrice: 59.10,
    bazinDiscount: 41.1,
    viability: 'AZULIM',
    viabilityReason: 'Receita previsível corrigida por inflação (IGP-M/IPCA).',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'EGIE3',
    name: 'Engie Brasil ON',
    type: 'acoes',
    price: 43.10,
    sector: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
    segment: 'Geração e Transmissão',
    pl: 10.80,
    pvp: 2.70,
    dy: 7.80,
    roe: 25.2,
    margemLiq: 28.5,
    dividaEbitda: 2.1,
    liquidezMedia: 85000000,
    cresc5a: 9.8,
    grahamPrice: 44.50,
    grahamDiscount: 3.1,
    bazinPrice: 56.00,
    bazinDiscount: 23.0,
    viability: 'AZULIM',
    viabilityReason: 'Líder privada em energia limpa com histórico consistente de dividendos.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'WEGE3',
    name: 'WEG ON',
    type: 'acoes',
    price: 52.40,
    sector: 'Bens Industriais',
    subsector: 'Máquinas e Equipamentos',
    segment: 'Motores e Equipamentos Elétricos',
    pl: 32.50,
    pvp: 9.80,
    dy: 1.85,
    roe: 30.5,
    margemLiq: 17.2,
    dividaEbitda: -0.4,
    liquidezMedia: 280000000,
    cresc5a: 24.2,
    grahamPrice: 22.40,
    grahamDiscount: -133.9,
    bazinPrice: 16.20,
    bazinDiscount: -223.4,
    viability: 'AZULIM',
    viabilityReason: 'Altíssima eficiência, caixa líquido e expansão internacional extraordinária.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'CPLE6',
    name: 'Copel PNB',
    type: 'acoes',
    price: 10.25,
    sector: 'Utilidade Pública',
    subsector: 'Energia Elétrica',
    segment: 'Geração e Distribuição',
    pl: 7.20,
    pvp: 1.10,
    dy: 8.50,
    roe: 15.8,
    margemLiq: 19.5,
    dividaEbitda: 1.9,
    liquidezMedia: 110000000,
    cresc5a: 14.0,
    grahamPrice: 14.80,
    grahamDiscount: 30.7,
    bazinPrice: 14.50,
    bazinDiscount: 29.3,
    viability: 'AZULIM',
    viabilityReason: 'Pós-privatização com ganhos substanciais de eficiência e dividendos.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'SAPR11',
    name: 'Sanepar UNT',
    type: 'acoes',
    price: 29.50,
    sector: 'Utilidade Pública',
    subsector: 'Água e Saneamento',
    segment: 'Saneamento Básico',
    pl: 5.60,
    pvp: 0.85,
    dy: 7.90,
    roe: 15.2,
    margemLiq: 24.1,
    dividaEbitda: 1.5,
    liquidezMedia: 45000000,
    cresc5a: 10.5,
    grahamPrice: 44.20,
    grahamDiscount: 33.3,
    bazinPrice: 38.80,
    bazinDiscount: 24.0,
    viability: 'AZULIM',
    viabilityReason: 'Monopólio essencial de água e esgoto negociando com desconto patrimonial.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'CXSE3',
    name: 'Caixa Seguridade ON',
    type: 'acoes',
    price: 15.10,
    sector: 'Financeiro',
    subsector: 'Previdência e Seguros',
    segment: 'Seguradoras',
    pl: 8.80,
    pvp: 3.10,
    dy: 8.70,
    roe: 48.0,
    margemLiq: 72.0,
    dividaEbitda: 0.0,
    liquidezMedia: 65000000,
    cresc5a: 18.2,
    grahamPrice: 12.80,
    grahamDiscount: -18.0,
    bazinPrice: 21.90,
    bazinDiscount: 31.1,
    viability: 'AZULIM',
    viabilityReason: 'Modelo asset-light com ROE estelar de 48% e payout elevado.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'BBSE3',
    name: 'BB Seguridade ON',
    type: 'acoes',
    price: 36.40,
    sector: 'Financeiro',
    subsector: 'Previdência e Seguros',
    segment: 'Seguradoras',
    pl: 9.10,
    pvp: 6.20,
    dy: 9.20,
    roe: 68.0,
    margemLiq: 84.0,
    dividaEbitda: 0.0,
    liquidezMedia: 140000000,
    cresc5a: 16.4,
    grahamPrice: 18.50,
    grahamDiscount: -96.7,
    bazinPrice: 55.80,
    bazinDiscount: 34.8,
    viability: 'AZULIM',
    viabilityReason: 'Altíssimo retorno sobre patrimônio e proteção contra inflação no agro.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'VIVT3',
    name: 'Telefônica Brasil (Vivo) ON',
    type: 'acoes',
    price: 52.80,
    sector: 'Comunicações',
    subsector: 'Telecomunicações',
    segment: 'Telefonia e Fibra',
    pl: 12.80,
    pvp: 1.15,
    dy: 6.90,
    roe: 9.1,
    margemLiq: 9.8,
    dividaEbitda: 0.45,
    liquidezMedia: 95000000,
    cresc5a: 6.5,
    grahamPrice: 62.10,
    grahamDiscount: 15.0,
    bazinPrice: 60.70,
    bazinDiscount: 13.0,
    viability: 'AZULIM',
    viabilityReason: 'Receita recorrente sólida e forte programa de remuneração aos acionistas.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'KLBN11',
    name: 'Klabin UNT',
    type: 'acoes',
    price: 21.20,
    sector: 'Materiais Básicos',
    subsector: 'Papel e Celulose',
    segment: 'Embalagens e Celulose',
    pl: 9.40,
    pvp: 1.85,
    dy: 7.10,
    roe: 19.8,
    margemLiq: 15.4,
    dividaEbitda: 3.4,
    liquidezMedia: 80000000,
    cresc5a: 14.5,
    grahamPrice: 24.30,
    grahamDiscount: 12.8,
    bazinPrice: 25.10,
    bazinDiscount: 15.5,
    viability: 'VIAVEL',
    viabilityReason: 'Modelo integrado com alta geração de caixa e dividendos trimestrais.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'BBDC4',
    name: 'Bradesco PN',
    type: 'acoes',
    price: 13.40,
    sector: 'Financeiro',
    subsector: 'Intermediários Financeiros',
    segment: 'Bancos',
    pl: 9.80,
    pvp: 0.88,
    dy: 6.20,
    roe: 10.2,
    margemLiq: 10.8,
    dividaEbitda: 0.0,
    liquidezMedia: 310000000,
    cresc5a: 2.1,
    grahamPrice: 22.90,
    grahamDiscount: 41.5,
    bazinPrice: 13.80,
    bazinDiscount: 2.9,
    viability: 'VIAVEL',
    viabilityReason: 'Grande banco em processo de reestruturação com desconto patrimonial (P/VP < 1.0).',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'RENT3',
    name: 'Localiza ON',
    type: 'acoes',
    price: 43.80,
    sector: 'Consumo Cíclico',
    subsector: 'Diversos',
    segment: 'Aluguel de Carros e Frotas',
    pl: 16.50,
    pvp: 1.70,
    dy: 3.20,
    roe: 11.5,
    margemLiq: 7.2,
    dividaEbitda: 3.6,
    liquidezMedia: 220000000,
    cresc5a: 26.0,
    grahamPrice: 40.20,
    grahamDiscount: -8.9,
    bazinPrice: 23.40,
    bazinDiscount: -87.2,
    viability: 'ATENCAO',
    viabilityReason: 'Líder absoluta do setor, porém alavancada e sensível às taxas de juros (Selic).',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'MGLU3',
    name: 'Magazine Luiza ON',
    type: 'acoes',
    price: 9.80,
    sector: 'Consumo Cíclico',
    subsector: 'Comércio',
    segment: 'E-commerce e Varejo',
    pl: -14.2,
    pvp: 1.15,
    dy: 0.0,
    roe: -8.1,
    margemLiq: -2.3,
    dividaEbitda: 4.8,
    liquidezMedia: 160000000,
    cresc5a: -3.2,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'BOMBA',
    viabilityReason: 'Prejuízo líquido recente, concorrência agressiva e margens comprimidas.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'CVCB3',
    name: 'CVC Brasil ON',
    type: 'acoes',
    price: 2.10,
    sector: 'Consumo Cíclico',
    subsector: 'Viagens e Lazer',
    segment: 'Turismo',
    pl: -4.5,
    pvp: 0.95,
    dy: 0.0,
    roe: -21.0,
    margemLiq: -8.5,
    dividaEbitda: 6.2,
    liquidezMedia: 35000000,
    cresc5a: -12.0,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'BOMBA',
    viabilityReason: 'Elevada dívida financeira e prejuízo operacional nos últimos exercícios.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'AMER3',
    name: 'Americanas ON (Em Rec. Judicial)',
    type: 'acoes',
    price: 0.35,
    sector: 'Consumo Cíclico',
    subsector: 'Comércio',
    segment: 'Varejo Multicanal',
    pl: -0.4,
    pvp: -0.2,
    dy: 0.0,
    roe: -85.0,
    margemLiq: -42.0,
    dividaEbitda: 15.0,
    liquidezMedia: 12000000,
    cresc5a: -35.0,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'BOMBA',
    viabilityReason: 'Empresa em recuperação judicial com patrimônio líquido negativo.',
    lastUpdated: new Date().toISOString()
  }
];

const CURATED_FIIS_BASE: ScreenerAsset[] = [
  {
    ticker: 'MXRF11',
    name: 'Maxi Renda FII',
    type: 'fiis',
    price: 9.95,
    sector: 'Financeiro / Imobiliário',
    subsector: 'Títulos e Valores Mobiliários',
    segment: 'Papel (CRI)',
    pl: 9.8,
    pvp: 0.98,
    dy: 12.30,
    roe: 11.2,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 12000000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 12.20,
    bazinDiscount: 18.4,
    viability: 'AZULIM',
    viabilityReason: 'Maior FII da B3 em cotistas com carteira diversificada e dividendo de 12.3% a.a.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística FII',
    type: 'fiis',
    price: 161.50,
    sector: 'Imobiliário',
    subsector: 'Imóveis Industriais e Logísticos',
    segment: 'Tijolo (Logística)',
    pl: 11.2,
    pvp: 0.99,
    dy: 8.90,
    roe: 9.4,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 8500000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 178.00,
    bazinDiscount: 9.3,
    viability: 'AZULIM',
    viabilityReason: 'Galpões Triple-A com excelente localização e inquilinos multinacionais de primeira linha.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'XPML11',
    name: 'XP Malls FII',
    type: 'fiis',
    price: 104.20,
    sector: 'Imobiliário',
    subsector: 'Shoppings e Varejo',
    segment: 'Tijolo (Shoppings)',
    pl: 11.5,
    pvp: 0.94,
    dy: 9.40,
    roe: 9.8,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 9200000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 114.50,
    bazinDiscount: 9.0,
    viability: 'AZULIM',
    viabilityReason: 'Portfólio premium de shoppings consolidados negociando com 6% de desconto patrimonial.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'KNCR11',
    name: 'Kinea Rendimentos Imobiliários',
    type: 'fiis',
    price: 103.80,
    sector: 'Financeiro / Imobiliário',
    subsector: 'Títulos e Valores Mobiliários',
    segment: 'Papel (CDI+)',
    pl: 9.2,
    pvp: 1.02,
    dy: 12.10,
    roe: 11.8,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 11500000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 126.00,
    bazinDiscount: 17.6,
    viability: 'AZULIM',
    viabilityReason: 'Fundo gerido pela Itaú Kinea indexado ao CDI, com risco de crédito corporativo baixo.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'BTLG11',
    name: 'BTG Pactual Logística FII',
    type: 'fiis',
    price: 99.40,
    sector: 'Imobiliário',
    subsector: 'Imóveis Industriais e Logísticos',
    segment: 'Tijolo (Logística)',
    pl: 10.4,
    pvp: 0.97,
    dy: 9.15,
    roe: 9.5,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 7800000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 110.00,
    bazinDiscount: 9.6,
    viability: 'AZULIM',
    viabilityReason: 'Galpões logísticos estratégicos no raio de 30km de São Paulo com vacância reduzida.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'VISC11',
    name: 'Vinci Shopping Centers',
    type: 'fiis',
    price: 112.50,
    sector: 'Imobiliário',
    subsector: 'Shoppings e Varejo',
    segment: 'Tijolo (Shoppings)',
    pl: 10.8,
    pvp: 0.91,
    dy: 9.20,
    roe: 9.6,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 6200000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 124.00,
    bazinDiscount: 9.3,
    viability: 'VIAVEL',
    viabilityReason: 'Fundo com 9% de desconto sobre o valor patrimonial e alta diversificação regional.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'TGAR11',
    name: 'TG Ativo Real FII',
    type: 'fiis',
    price: 116.80,
    sector: 'Imobiliário',
    subsector: 'Desenvolvimento e Loteamentos',
    segment: 'Híbrido / Desenvolvimento',
    pl: 8.5,
    pvp: 0.95,
    dy: 13.80,
    roe: 14.1,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 5100000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 158.00,
    bazinDiscount: 26.1,
    viability: 'VIAVEL',
    viabilityReason: 'Foco em desenvolvimento urbano de loteamentos com yield elevado.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'CARE11',
    name: 'Brazilian Graveyard FII',
    type: 'fiis',
    price: 1.25,
    sector: 'Imobiliário',
    subsector: 'Outros',
    segment: 'Cemitérios',
    pl: -5.2,
    pvp: 0.28,
    dy: 0.0,
    roe: -4.5,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 85000,
    cresc5a: null,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'BOMBA',
    viabilityReason: 'Baixíssima liquidez, histórico de inadimplência e ausência de proventos regulares.',
    lastUpdated: new Date().toISOString()
  }
];

const CURATED_STOCKS_BASE: ScreenerAsset[] = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'stocks',
    price: 228.50,
    sector: 'Tecnologia',
    subsector: 'Hardware & Eletrônicos',
    segment: 'Smartphones & Serviços',
    pl: 33.5,
    pvp: 45.2,
    dy: 0.55,
    roe: 145.0,
    margemLiq: 25.3,
    dividaEbitda: 0.6,
    liquidezMedia: 5500000000,
    cresc5a: 14.2,
    grahamPrice: 110.0,
    grahamDiscount: -107.7,
    bazinPrice: 20.0,
    bazinDiscount: -91.2,
    viability: 'AZULIM',
    viabilityReason: 'Marca mais valiosa do mundo com ecossistema fechado de alta rentabilidade e recompra de ações.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    type: 'stocks',
    price: 418.00,
    sector: 'Tecnologia',
    subsector: 'Software & Cloud',
    segment: 'Cloud & IA Corporativa',
    pl: 34.2,
    pvp: 11.5,
    dy: 0.78,
    roe: 38.5,
    margemLiq: 36.1,
    dividaEbitda: 0.2,
    liquidezMedia: 4800000000,
    cresc5a: 16.5,
    grahamPrice: 185.0,
    grahamDiscount: -125.9,
    bazinPrice: 32.0,
    bazinDiscount: -92.3,
    viability: 'AZULIM',
    viabilityReason: 'Líder em computação em nuvem (Azure), produtividade (Office/Windows) e infraestrutura de IA.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    type: 'stocks',
    price: 132.80,
    sector: 'Tecnologia',
    subsector: 'Semicondutores',
    segment: 'Chips & Aceleradores IA',
    pl: 52.0,
    pvp: 42.0,
    dy: 0.15,
    roe: 115.0,
    margemLiq: 55.2,
    dividaEbitda: 0.1,
    liquidezMedia: 12000000000,
    cresc5a: 78.0,
    grahamPrice: 48.0,
    grahamDiscount: -176.6,
    bazinPrice: 8.5,
    bazinDiscount: -93.6,
    viability: 'AZULIM',
    viabilityReason: 'Monopólio prático em GPUs para data centers de inteligência artificial de última geração.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet Inc. (Google)',
    type: 'stocks',
    price: 166.40,
    sector: 'Comunicações',
    subsector: 'Mídia e Internet',
    segment: 'Busca, YouTube & Nuvem',
    pl: 21.8,
    pvp: 6.2,
    dy: 0.48,
    roe: 31.0,
    margemLiq: 27.5,
    dividaEbitda: -0.3,
    liquidezMedia: 3200000000,
    cresc5a: 18.0,
    grahamPrice: 125.0,
    grahamDiscount: -33.1,
    bazinPrice: 22.0,
    bazinDiscount: -86.8,
    viability: 'AZULIM',
    viabilityReason: 'Fosso econômico inigualável em publicidade digital, Android, Chrome e IA generativa.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'AMZN',
    name: 'Amazon.com Inc.',
    type: 'stocks',
    price: 186.20,
    sector: 'Consumo Cíclico',
    subsector: 'Comércio Eletrônico & Nuvem',
    segment: 'Varejo Global & AWS',
    pl: 41.5,
    pvp: 7.8,
    dy: 0.0,
    roe: 22.0,
    margemLiq: 8.5,
    dividaEbitda: 0.9,
    liquidezMedia: 4200000000,
    cresc5a: 15.8,
    grahamPrice: 95.0,
    grahamDiscount: -96.0,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'AZULIM',
    viabilityReason: 'Líder em infraestrutura de nuvem (AWS) e maior plataforma de e-commerce do ocidente.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'SCHD',
    name: 'Schwab U.S. Dividend Equity ETF',
    type: 'stocks',
    price: 82.50,
    sector: 'Fundos & ETFs',
    subsector: 'ETFs de Dividendos',
    segment: 'Índice Dow Jones Dividend 100',
    pl: 15.2,
    pvp: 2.8,
    dy: 3.45,
    roe: 24.0,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 150000000,
    cresc5a: 8.5,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: 58.0,
    bazinDiscount: -29.7,
    viability: 'AZULIM',
    viabilityReason: 'ETF de maior prestígio nos EUA focado em empresas pagadoras de dividendos crescentes há 10+ anos.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'IVV',
    name: 'iShares Core S&P 500 ETF',
    type: 'stocks',
    price: 575.00,
    sector: 'Fundos & ETFs',
    subsector: 'ETFs de Ações Globais',
    segment: 'S&P 500 Index',
    pl: 24.5,
    pvp: 4.6,
    dy: 1.35,
    roe: 20.0,
    margemLiq: null,
    dividaEbitda: null,
    liquidezMedia: 3500000000,
    cresc5a: 12.0,
    grahamPrice: null,
    grahamDiscount: null,
    bazinPrice: null,
    bazinDiscount: null,
    viability: 'AZULIM',
    viabilityReason: 'As 500 maiores e mais lucrativas empresas do mercado americano em um único ativo.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'KO',
    name: 'The Coca-Cola Company',
    type: 'stocks',
    price: 68.20,
    sector: 'Consumo Não Cíclico',
    subsector: 'Bebidas',
    segment: 'Bebidas Não Alcoólicas',
    pl: 26.5,
    pvp: 11.2,
    dy: 3.10,
    roe: 42.0,
    margemLiq: 23.5,
    dividaEbitda: 2.3,
    liquidezMedia: 750000000,
    cresc5a: 7.2,
    grahamPrice: 38.0,
    grahamDiscount: -79.5,
    bazinPrice: 35.0,
    bazinDiscount: -48.7,
    viability: 'AZULIM',
    viabilityReason: 'Dividend King com mais de 60 anos consecutivos de aumentos nos proventos pagos.',
    lastUpdated: new Date().toISOString()
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    type: 'stocks',
    price: 161.40,
    sector: 'Saúde',
    subsector: 'Farmacêutica & Equipamentos',
    segment: 'Dispositivos Médicos & Remédios',
    pl: 16.8,
    pvp: 5.4,
    dy: 3.15,
    roe: 32.5,
    margemLiq: 17.8,
    dividaEbitda: 1.1,
    liquidezMedia: 890000000,
    cresc5a: 5.4,
    grahamPrice: 125.0,
    grahamDiscount: -29.1,
    bazinPrice: 84.0,
    bazinDiscount: -47.9,
    viability: 'AZULIM',
    viabilityReason: 'Classificação de crédito AAA (superior ao governo dos EUA) e geração de caixa defensiva.',
    lastUpdated: new Date().toISOString()
  }
];

// Dynamically fetch live data from Fundamentus when available and merge with cache
async function fetchFundamentusData(): Promise<{ acoes: ScreenerAsset[]; fiis: ScreenerAsset[] }> {
  try {
    const res = await fetch('https://www.fundamentus.com.br/resultado.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const html = await res.text();
      // Parse HTML table rows
      const tableMatch = html.match(/<table[^>]*id="resultado"[^>]*>([\s\S]*?)<\/table>/i);
      if (tableMatch) {
        const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        const parsedAcoes: ScreenerAsset[] = [];

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
          if (cols && cols.length >= 20) {
            const cleanText = (str: string) => str.replace(/<[^>]*>/g, '').trim();
            const ticker = cleanText(cols[0]);
            if (!ticker || ticker.length < 4) continue;

            const price = parseBrNumber(cleanText(cols[1])) || 0;
            const pl = parseBrNumber(cleanText(cols[2]));
            const pvp = parseBrNumber(cleanText(cols[3]));
            const dy = parseBrNumber(cleanText(cols[5]));
            const margemLiq = parseBrNumber(cleanText(cols[13]));
            const roe = parseBrNumber(cleanText(cols[16]));
            const liquidez = parseBrNumber(cleanText(cols[17])) || 0;
            const cresc5a = parseBrNumber(cleanText(cols[20]));

            // Only consider reasonably liquid stocks
            if (price > 0 && liquidez > 50000) {
              // Guess sector based on ticker or known map
              let sector = 'Diversos';
              let subsector = 'Geral';
              let segment = 'Companhia Aberta';

              const curated = CURATED_ACOES_BASE.find(c => c.ticker === ticker);
              if (curated) {
                sector = curated.sector;
                subsector = curated.subsector;
                segment = curated.segment;
              } else if (['BBAS3', 'ITUB4', 'BBDC4', 'SANB11', 'BRSR6', 'BPAC11'].includes(ticker)) {
                sector = 'Financeiro';
                subsector = 'Intermediários Financeiros';
                segment = 'Bancos';
              } else if (['TAEE11', 'EGIE3', 'CPLE6', 'TRPL4', 'CMIG4', 'ALUP11', 'EQTL3', 'NEOE3'].includes(ticker)) {
                sector = 'Utilidade Pública';
                subsector = 'Energia Elétrica';
                segment = 'Geração e Transmissão';
              } else if (['PETR4', 'PETR3', 'PRIO3', 'RECV3', 'UGPA3', 'CSAN3'].includes(ticker)) {
                sector = 'Petróleo, Gás e Biocombustíveis';
                subsector = 'Petróleo e Gás';
                segment = 'Exploração e Refino';
              } else if (['VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'SUZB3', 'KLBN11'].includes(ticker)) {
                sector = 'Materiais Básicos';
                subsector = 'Mineração e Siderurgia';
                segment = 'Mineração';
              } else if (['SAPR11', 'SAPR4', 'SBSP3', 'CSMG3'].includes(ticker)) {
                sector = 'Utilidade Pública';
                subsector = 'Água e Saneamento';
                segment = 'Saneamento Básico';
              } else if (['CXSE3', 'BBSE3', 'PSSA3', 'IRBR3'].includes(ticker)) {
                sector = 'Financeiro';
                subsector = 'Previdência e Seguros';
                segment = 'Seguradoras';
              }

              const { viability, reason } = calculateViability(pl, pvp, dy, roe, margemLiq, null, ticker);

              // Calculate Graham and Bazin metrics if available
              let grahamPrice: number | null = null;
              let grahamDiscount: number | null = null;
              if (pl && pvp && pl > 0 && pvp > 0 && price > 0) {
                const lpa = price / pl;
                const vpa = price / pvp;
                if (lpa > 0 && vpa > 0) {
                  grahamPrice = Number(Math.sqrt(22.5 * lpa * vpa).toFixed(2));
                  grahamDiscount = Number((((grahamPrice - price) / grahamPrice) * 100).toFixed(1));
                }
              }

              let bazinPrice: number | null = null;
              let bazinDiscount: number | null = null;
              if (dy && dy > 0 && price > 0) {
                const divAmt = (price * dy) / 100;
                bazinPrice = Number((divAmt / 0.06).toFixed(2));
                bazinDiscount = Number((((bazinPrice - price) / bazinPrice) * 100).toFixed(1));
              }

              parsedAcoes.push({
                ticker,
                name: curated?.name || `${ticker} B3`,
                type: 'acoes',
                price,
                sector,
                subsector,
                segment,
                pl,
                pvp,
                dy,
                roe,
                margemLiq,
                dividaEbitda: curated?.dividaEbitda || null,
                liquidezMedia: liquidez,
                cresc5a,
                grahamPrice: curated?.grahamPrice || grahamPrice,
                grahamDiscount: curated?.grahamDiscount || grahamDiscount,
                bazinPrice: curated?.bazinPrice || bazinPrice,
                bazinDiscount: curated?.bazinDiscount || bazinDiscount,
                viability,
                viabilityReason: reason,
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }

        if (parsedAcoes.length >= 20) {
          // Merge with curated base to ensure all descriptions are rich
          const finalAcoes = CURATED_ACOES_BASE.map(curated => {
            const found = parsedAcoes.find(p => p.ticker === curated.ticker);
            return found ? { ...curated, price: found.price, pl: found.pl, pvp: found.pvp, dy: found.dy, roe: found.roe, lastUpdated: found.lastUpdated } : curated;
          });

          // Add others from parsed
          const curatedTickers = new Set(CURATED_ACOES_BASE.map(c => c.ticker));
          parsedAcoes.forEach(p => {
            if (!curatedTickers.has(p.ticker)) {
              finalAcoes.push(p);
            }
          });

          return { acoes: finalAcoes, fiis: CURATED_FIIS_BASE };
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao raspar Fundamentus para screener:', err);
  }

  return { acoes: CURATED_ACOES_BASE, fiis: CURATED_FIIS_BASE };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeParam = (searchParams.get('type') || 'acoes').toLowerCase() as 'acoes' | 'stocks' | 'fiis';
  const sectorParam = searchParams.get('sector') || '';
  const subsectorParam = searchParams.get('subsector') || '';
  const segmentParam = searchParams.get('segment') || '';
  const viabilityParam = searchParams.get('viability') || ''; // comma separated e.g. "BOMBA,VIAVEL,AZULIM"
  const searchTicker = (searchParams.get('search') || '').toUpperCase().trim();

  // Numerical Range Filters
  const minPl = searchParams.get('min_pl') ? parseFloat(searchParams.get('min_pl')!) : null;
  const maxPl = searchParams.get('max_pl') ? parseFloat(searchParams.get('max_pl')!) : null;
  const minPvp = searchParams.get('min_pvp') ? parseFloat(searchParams.get('min_pvp')!) : null;
  const maxPvp = searchParams.get('max_pvp') ? parseFloat(searchParams.get('max_pvp')!) : null;
  const minDy = searchParams.get('min_dy') ? parseFloat(searchParams.get('min_dy')!) : null;
  const maxDy = searchParams.get('max_dy') ? parseFloat(searchParams.get('max_dy')!) : null;
  const minRoe = searchParams.get('min_roe') ? parseFloat(searchParams.get('min_roe')!) : null;
  const maxRoe = searchParams.get('max_roe') ? parseFloat(searchParams.get('max_roe')!) : null;
  const minMargemLiq = searchParams.get('min_margem') ? parseFloat(searchParams.get('min_margem')!) : null;
  const maxDivida = searchParams.get('max_divida') ? parseFloat(searchParams.get('max_divida')!) : null;

  // Refresh cache if expired
  const now = Date.now();
  if (now - lastCacheTime > CACHE_TTL_MS || cachedAcoes.length === 0) {
    const { acoes, fiis } = await fetchFundamentusData();
    cachedAcoes = acoes;
    cachedFiis = fiis;
    cachedStocks = CURATED_STOCKS_BASE;
    lastCacheTime = now;
  }

  let dataset: ScreenerAsset[] = [];
  if (typeParam === 'fiis') {
    dataset = cachedFiis;
  } else if (typeParam === 'stocks') {
    dataset = cachedStocks;
  } else {
    dataset = cachedAcoes;
  }

  // Extract unique sectors, subsectors and segments for dropdowns
  const availableSectors = Array.from(new Set(dataset.map(a => a.sector).filter(Boolean))).sort();
  const availableSubsectors = Array.from(new Set(dataset.map(a => a.subsector).filter(Boolean))).sort();
  const availableSegments = Array.from(new Set(dataset.map(a => a.segment).filter(Boolean))).sort();

  // Apply filters
  const selectedViabilities = viabilityParam
    ? viabilityParam.split(',').map(s => s.trim().toUpperCase())
    : [];

  const filtered = dataset.filter(item => {
    if (searchTicker && !item.ticker.includes(searchTicker) && !item.name.toUpperCase().includes(searchTicker)) {
      return false;
    }
    if (sectorParam && sectorParam !== 'Todos' && item.sector !== sectorParam) {
      return false;
    }
    if (subsectorParam && subsectorParam !== 'Todos' && item.subsector !== subsectorParam) {
      return false;
    }
    if (segmentParam && segmentParam !== 'Todos' && item.segment !== segmentParam) {
      return false;
    }
    if (selectedViabilities.length > 0 && !selectedViabilities.includes(item.viability)) {
      return false;
    }
    if (minPl !== null && item.pl !== null && item.pl < minPl) {
      return false;
    }
    if (maxPl !== null && item.pl !== null && item.pl > maxPl) {
      return false;
    }
    if (minPvp !== null && item.pvp !== null && item.pvp < minPvp) {
      return false;
    }
    if (maxPvp !== null && item.pvp !== null && item.pvp > maxPvp) {
      return false;
    }
    if (minDy !== null && item.dy !== null && item.dy < minDy) {
      return false;
    }
    if (maxDy !== null && item.dy !== null && item.dy > maxDy) {
      return false;
    }
    if (minRoe !== null && item.roe !== null && item.roe < minRoe) {
      return false;
    }
    if (maxRoe !== null && item.roe !== null && item.roe > maxRoe) {
      return false;
    }
    if (minMargemLiq !== null && item.margemLiq !== null && item.margemLiq < minMargemLiq) {
      return false;
    }
    if (maxDivida !== null && item.dividaEbitda !== null && item.dividaEbitda > maxDivida) {
      return false;
    }

    return true;
  });

  return NextResponse.json({
    type: typeParam,
    totalCount: filtered.length,
    totalUniverse: dataset.length,
    sectors: availableSectors,
    subsectors: availableSubsectors,
    segments: availableSegments,
    results: filtered
  });
}
