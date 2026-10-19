import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, GEMINI_MODELS } from '@/lib/gemini';
import { apportionNoteCosts, detectDayTrades, inferAssetCategory, RawBrokerageNote } from '@/lib/tax/taxEngine';

// Dicionário de mapeamento de nomes comuns de empresas para Tickers da B3
const COMMON_B3_NAMES: { [key: string]: string } = {
  'ITAUUNIBANCO': 'ITUB4',
  'ITAU UNIBANCO': 'ITUB4',
  'ITAUSA': 'ITSA4',
  'PETROBRAS': 'PETR4',
  'VALE': 'VALE3',
  'BRADESCO': 'BBDC4',
  'BANCO DO BRASIL': 'BBAS3',
  'B3': 'B3SA3',
  'WEG': 'WEGE3',
  'AMBEV': 'ABEV3',
  'GERDAU': 'GGBR4',
  'SUZANO': 'SUZB3',
  'KLABIN': 'KLBN11',
  'TAESA': 'TAEE11',
  'SANEPAR': 'SAPR11',
  'COPEL': 'CPLE6',
  'CEMIG': 'CMIG4',
  'ENGIE': 'EGIE3',
  'EQUATORIAL': 'EQTL3',
  'SABESP': 'SBSP3',
  'LOCALIZA': 'RENT3',
  'MAGAZINE LUIZA': 'MGLU3',
  'LOJAS RENNER': 'LREN3',
  'TOTVS': 'TOTS3',
  'PRIO': 'PRIO3',
  'PETRORIO': 'PRIO3',
  'VIBRA': 'VBBR3',
  'CSN': 'CSNA3',
  'USIMINAS': 'USIM5',
  'JBS': 'JBSS3',
  'MARFRIG': 'MRFG3',
  'MINERVA': 'BEEF3',
  'COSAN': 'CSAN3',
  'RAIZEN': 'RAIZ4',
  'CYRELA': 'CYRE3',
  'EZTEC': 'EZTC3',
  'MRV': 'MRVE3',
  'HAPVIDA': 'HAPV3',
  'REDE D OR': 'RDOR3',
  'FLEURY': 'FLRY3',
  'HYPERA': 'HYPE3',
  'RAIA DROGASIL': 'RADL3',
  'VIVARA': 'VIVA3',
  'ASSAL': 'ASAI3',
  'CARREFOUR': 'CRFB3',
  'AREZZO': 'ARZZ3',
  'VAMO': 'VAMO3',
  'SIMPAR': 'SIMH3',
  'CCR': 'CCRO3',
  'ECORODOVIAS': 'ECOR3',
  'RUMO': 'RAIL3',
  'AZUL': 'AZUL4',
  'GOL': 'GOLL4',
  'EMBRAER': 'EMBR3',
  'CPFL': 'CPFE3',
  'NEOENERGIA': 'NEOE3',
  'ALUPAR': 'ALUP11',
  'TRANSMISSAO PAULISTA': 'TRPL4',
  'ISA CTEEP': 'TRPL4',
  'EDP': 'ENBR3',
  'ELETROBRAS': 'ELET3',
  'MAXI RENDA': 'MXRF11',
  'XP MALLS': 'XPML11',
  'KNIP': 'KNIP11',
  'KNCR': 'KNCR11',
  'HGLG': 'HGLG11',
  'XPLG': 'XPLG11',
  'BBRC': 'BBRC11',
  'VISC': 'VISC11',
  'VGHF': 'VGHF11',
  'TGAR': 'TGAR11',
  'CPTS': 'CPTS11',
  'IRDM': 'IRDM11',
  'RBRR': 'RBRR11',
  'BTLG': 'BTLG11',
  'HSML': 'HSML11',
  'MALL': 'MALL11',
  'RECT': 'RECT11',
  'ALZR': 'ALZR11',
  'VGIR': 'VGIR11',
  'RZTR': 'RZTR11',
  'SNCI': 'SNCI11',
  'SNAG': 'SNAG11',
  'XPCA': 'XPCA11',
  'RURA': 'RURA11',
  'VGIA': 'VGIA11'
};

function normalizeTicker(rawTicker: string, assetName: string = ''): string {
  let ticker = (rawTicker || '').toUpperCase().trim();
  
  // Se já parecer um ticker da B3 (ex: ITUB4, PETR4, MXRF11, BOVA11)
  const b3Match = ticker.match(/[A-Z]{4}(?:3|4|5|6|11|12|32|33|34|35|39|B)\b/i);
  if (b3Match) return b3Match[0].toUpperCase();

  // Verifica no nome do ativo se contém o ticker
  const nameMatch = assetName.toUpperCase().match(/[A-Z]{4}(?:3|4|5|6|11|12|32|33|34|35|39|B)\b/);
  if (nameMatch) return nameMatch[0].toUpperCase();

  // Tenta pelo dicionário de nomes
  const nameClean = assetName.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
  for (const [key, val] of Object.entries(COMMON_B3_NAMES)) {
    if (nameClean.includes(key)) {
      if (nameClean.includes(' ON') && !val.endsWith('11')) return val.slice(0, 4) + '3';
      if (nameClean.includes(' PN') && !val.endsWith('11')) return val.slice(0, 4) + '4';
      if (nameClean.includes(' UNT') || nameClean.includes(' UNIT')) return val.slice(0, 4) + '11';
      return val;
    }
  }

  // Remove sufixos como 'F' de fracionário (ex: PETR4F -> PETR4)
  if (ticker.endsWith('F') && ticker.length === 6) {
    return ticker.slice(0, 5);
  }

  return ticker || 'ATIVO';
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave de API do Gemini não configurada no servidor.' },
        { status: 500 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let promptParts: any[] = [];

    const systemPrompt = `Você é um perito contábil e tributário especializado em análise e conciliação de Notas de Corretagem da B3 (padrão SINACOR) emitidas por corretoras brasileiras, com ênfase especial no íon Itaú (Itaú Corretora de Valores S.A.), XP, Clear, BTG Pactual, NuInvest, Inter e Toro.

Sua missão é extrair com precisão cirúrgica e exatidão contábil todos os dados da Nota de Corretagem (PDF, foto, print do celular ou texto), incluindo o cabeçalho, a lista completa de negócios realizados e o resumo financeiro com todas as taxas da B3.

Regras de Extração e Padronização:
1. 'broker_name': Nome da corretora (ex: 'íon Itaú', 'Itaú Corretora', 'XP Investimentos', 'Clear Corretora', etc.). Se for do Itaú, defina 'íon Itaú'.
2. 'note_number': Número da nota de corretagem (string/número).
3. 'trading_date': Data do Pregão no formato ISO 'YYYY-MM-DD' (ex: '2026-10-15').
4. 'clearing_date': Data de Liquidação / Líquido para no formato ISO 'YYYY-MM-DD'.
5. 'orders': Lista com CADA negócio/ordem executada na nota:
   - 'ticker': Código do ativo na B3 (ex: 'ITUB4', 'PETR4', 'VALE3', 'MXRF11', 'XPML11', 'BOVA11'). Se na nota constar apenas a especificação (ex: 'ITAUUNIBANCO PN', 'PETROBRAS PN N2', 'MAXI RENDA FII'), deduza o ticker oficial exato. Se for mercado fracionário (ex: 'ITUB4F'), retorne o ticker padrão 'ITUB4' e 'market_type': 'FRACIONARIO'.
   - 'asset_name': Especificação do título conforme consta na nota.
   - 'operation_type': 'C' para Compra ou 'V' para Venda.
   - 'market_type': 'VISTA', 'FRACIONARIO', 'OPCAO', 'TERMO' ou 'FUTURO'.
   - 'quantity': Quantidade negociada (número positivo, ex: 100, 50, 10).
   - 'unit_price': Preço / Ajuste unitário em Reais (número, ex: 35.40).
   - 'total_price': Valor da operação (quantity * unit_price).
   - 'is_day_trade': booleano. Se houver indicação de Day Trade ('D') na nota ou se o mesmo ativo tiver compra e venda no mesmo pregão, marque true.
6. 'Resumo Financeiro' (Taxas e Custos):
   - 'settlement_fee': Taxa de Liquidação (CBLC).
   - 'registration_fee': Taxa de Registro.
   - 'emoluments': Emolumentos (B3 / Bolsa).
   - 'brokerage_fee': Taxa Operacional / Corretagem.
   - 'taxes': Impostos (ISS, PIS, COFINS).
   - 'other_expenses': Outros custos / despesas.
   - 'irrf_amount': I.R.R.F. retido na fonte (valor do "dedo-duro").
   - 'irrf_base': Base de cálculo do I.R.R.F.
   - 'net_amount': Valor Líquido da Nota (débito ou crédito final).
   - 'total_operations': Total das operações (soma bruta dos negócios).

Retorne OBRIGATORIAMENTE um JSON estritamente válido no seguinte formato:
{
  "broker_name": "íon Itaú",
  "note_number": "123456",
  "trading_date": "2026-10-15",
  "clearing_date": "2026-10-17",
  "total_operations": 3540.00,
  "net_amount": 3541.25,
  "settlement_fee": 0.88,
  "registration_fee": 0.00,
  "emoluments": 0.25,
  "brokerage_fee": 0.00,
  "taxes": 0.00,
  "other_expenses": 0.12,
  "irrf_amount": 0.00,
  "irrf_base": 0.00,
  "orders": [
    {
      "ticker": "ITUB4",
      "asset_name": "ITAUUNIBANCO PN N1",
      "operation_type": "C",
      "market_type": "VISTA",
      "quantity": 100,
      "unit_price": 35.40,
      "total_price": 3540.00,
      "is_day_trade": false
    }
  ]
}`;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('text') as string | null;

      if (file) {
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'application/pdf';

        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia com precisão os dados desta nota de corretagem / ordem (íon Itaú / B3):`
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ];
      } else if (rawText) {
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia os dados a partir do seguinte texto / extrato da nota de corretagem:\n\n${rawText}`
          }
        ];
      } else {
        return NextResponse.json({ error: 'Nenhum arquivo ou texto foi enviado.' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      if (body.text) {
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia os dados a partir do seguinte texto / extrato da nota de corretagem:\n\n${body.text}`
          }
        ];
      } else {
        return NextResponse.json({ error: 'Formato de requisição inválido.' }, { status: 400 });
      }
    }

    let parsedResult: any = null;

    try {
      const result = await callGeminiWithFallback(
        apiKey,
        promptParts,
        {
          models: [...GEMINI_MODELS.VISION],
          timeoutMs: 25_000,
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }
      );
      parsedResult = result.parsed;
    } catch (geminiErr: any) {
      console.error('[parse-note] Erro ao chamar IA Gemini:', geminiErr);
      return NextResponse.json(
        { error: 'Falha ao processar o arquivo da nota com IA: ' + (geminiErr?.message || 'Timeout') },
        { status: 500 }
      );
    }

    if (!parsedResult || (!parsedResult.orders && !Array.isArray(parsedResult))) {
      return NextResponse.json(
        { error: 'Não foi possível identificar ordens ou operações no documento enviado.' },
        { status: 422 }
      );
    }

    const rawNote = Array.isArray(parsedResult) ? parsedResult[0] : parsedResult;
    const rawOrders = Array.isArray(rawNote.orders) ? rawNote.orders : [];

    if (rawOrders.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma ordem de compra ou venda identificada na nota.' },
        { status: 422 }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const tradingDate = rawNote.trading_date || todayStr;

    // Normaliza ordens e tickers
    const sanitizedOrders = rawOrders.map((o: any, idx: number) => {
      const normalizedTicker = normalizeTicker(o.ticker, o.asset_name);
      const qty = Math.abs(Number(o.quantity)) || 1;
      const unitPrice = Math.abs(Number(o.unit_price)) || 0;
      const totalPrice = Number(o.total_price) > 0 ? Number(o.total_price) : Number((qty * unitPrice).toFixed(2));
      const opType = (o.operation_type || 'C').toUpperCase().startsWith('V') ? 'V' : 'C';

      return {
        id: `order-temp-${idx}`,
        ticker: normalizedTicker,
        asset_name: o.asset_name || normalizedTicker,
        asset_category: o.asset_category || inferAssetCategory(normalizedTicker),
        operation_type: opType,
        market_type: (o.market_type || 'VISTA').toUpperCase(),
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        is_day_trade: Boolean(o.is_day_trade),
        trading_date: tradingDate
      };
    });

    const parsedNote: RawBrokerageNote = {
      broker_name: rawNote.broker_name || 'íon Itaú',
      note_number: String(rawNote.note_number || ''),
      trading_date: tradingDate,
      clearing_date: rawNote.clearing_date || tradingDate,
      total_operations: Number(rawNote.total_operations) || sanitizedOrders.reduce((s: number, o: any) => s + o.total_price, 0),
      net_amount: Number(rawNote.net_amount) || 0,
      settlement_fee: Number(rawNote.settlement_fee) || 0,
      registration_fee: Number(rawNote.registration_fee) || 0,
      emoluments: Number(rawNote.emoluments) || 0,
      brokerage_fee: Number(rawNote.brokerage_fee) || 0,
      taxes: Number(rawNote.taxes) || 0,
      other_expenses: Number(rawNote.other_expenses) || 0,
      irrf_amount: Number(rawNote.irrf_amount) || 0,
      irrf_base: Number(rawNote.irrf_base) || 0,
      orders: sanitizedOrders
    };

    // Aplica rateio de custos e detecção automática de Day Trade
    const ordersWithCosts = apportionNoteCosts(parsedNote);
    const finalizedOrders = detectDayTrades(ordersWithCosts);

    return NextResponse.json({
      success: true,
      note: {
        ...parsedNote,
        orders: finalizedOrders
      }
    });
  } catch (error: any) {
    console.error('Erro na rota /api/tax/parse-note:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no processamento da nota.' },
      { status: 500 }
    );
  }
}
