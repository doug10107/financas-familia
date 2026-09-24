import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, GEMINI_MODELS } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave de API do Gemini (GEMINI_API_KEY) não configurada no servidor.' },
        { status: 500 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let promptParts: any[] = [];

    const systemPrompt = `Você é um especialista em investimentos, mercado financeiro brasileiro (B3) e análise de relatórios de corretoras (Investidor10, Status Invest, B3 Área do Investidor, XP, NuInvest, BTG, Inter, Avenue, Nomad).
Sua tarefa é analisar o arquivo (foto, PDF ou print de carteira) ou texto colado e extrair TODOS os ativos de investimento contidos no documento, sem deixar nenhum de fora (incluindo Ações, FIIs, ETFs Internacionais, Criptomoedas, Tesouro Direto e Fundos/Previdência).

IMPORTANTE SOBRE MOEDAS E ATIVOS INTERNACIONAIS:
- Se houver ativos cotados em Dólar (US$ / USD), como ETFs Internacionais (ex: 'VXUS', 'IVV', 'TFLO', 'VOO', 'QQQ', 'VT') ou ações americanas:
  Converta os valores (Preço Médio, Cotação e Total) para Reais (BRL) usando a taxa de câmbio USD/BRL indicada no relatório ou uma taxa padrão de R$ 5,20 por dólar.
- Para todos os ativos, todos os valores numéricos ('averagePrice', 'totalInvested', 'currentPrice', 'currentBalance') DEVEM ser retornados em Reais (BRL) como números (float), nunca strings com US$ ou R$.

Para cada ativo encontrado, identifique:
1. 'ticker': Código do ativo se houver (ex: 'PETR4', 'VALE3', 'MXRF11', 'VXUS', 'IVV', 'TFLO', 'BTC', 'ETH', 'AUPO11', 'Tesouro IPCA+ 2032').
2. 'name': Nome legível da empresa, fundo, título ou cripto (ex: 'Petrobras PN', 'Maxi Renda FII', 'Vanguard Total Intl', 'Trend Pós-Fixado Prev').
3. 'type': Categoria do investimento ('Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'ETFs', 'Previdência Privada', 'BDRs', 'Criptomoedas', 'Poupança' ou 'Outros').
4. 'quantity': Quantidade de cotas/ações/frações (número decimal ou inteiro, ex: 100, 3, 0.29667, 0.00025974). Se for título sem quantidade, use 1.
5. 'averagePrice': Preço Médio de compra por cota em R$ (número). Se estava em US$, já convertido para R$.
6. 'totalInvested': Valor total investido / custo total em R$ (número). Se não constar, calcule quantity * averagePrice.
7. 'currentPrice': Cotação atual ou preço de mercado em R$ (opcional, número).
8. 'currentBalance': Saldo atual / valor de mercado em R$ (opcional, número).
9. 'institution': Nome da corretora ou banco (ex: 'XP', 'NuInvest', 'Investidor10', 'Avenue', 'Binance').

Retorne SEMPRE um JSON válido no formato:
{
  "assets": [
    {
      "ticker": "VALE3",
      "name": "Vale ON",
      "type": "Ações",
      "quantity": 1,
      "averagePrice": 78.83,
      "totalInvested": 78.83,
      "currentPrice": 78.46,
      "currentBalance": 78.46,
      "institution": "Investidor10"
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
        const mimeType = file.type || 'image/jpeg';

        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia todos os ativos desta imagem/documento de carteira em formato JSON:`
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
            text: `${systemPrompt}\n\nExtraia todos os ativos a partir do seguinte texto de carteira em formato JSON:\n\n${rawText}`
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
            text: `${systemPrompt}\n\nExtraia todos os ativos a partir do seguinte texto de carteira em formato JSON:\n\n${body.text}`
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
          timeoutMs: 20_000,
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }
      );
      parsedResult = result.parsed;
    } catch (geminiErr: any) {
      console.error('[scan-investments] Gemini falhou:', geminiErr);
    }

    let rawAssets: any[] = [];
    if (Array.isArray(parsedResult)) {
      rawAssets = parsedResult;
    } else if (parsedResult && Array.isArray(parsedResult.assets)) {
      rawAssets = parsedResult.assets;
    }

    if (rawAssets.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível identificar os ativos no documento ou texto fornecido.' },
        { status: 422 }
      );
    }

    const sanitized = rawAssets.map((asset, idx) => {
      const ticker = (asset.ticker || '').toUpperCase().trim();
      const name = (asset.name || ticker || `Ativo ${idx + 1}`).trim();
      const type = asset.type || (ticker.includes('11') ? 'FIIs' : 'Ações');
      const quantity = Number(asset.quantity) > 0 ? Number(asset.quantity) : 1;
      const averagePrice = Number(asset.averagePrice) >= 0 ? Number(asset.averagePrice) : 0;
      const totalInvested = Number(asset.totalInvested) > 0 ? Number(asset.totalInvested) : Number((quantity * averagePrice).toFixed(2));
      const currentPrice = Number(asset.currentPrice) >= 0 ? Number(asset.currentPrice) : averagePrice;
      const currentBalance = Number(asset.currentBalance) > 0 ? Number(asset.currentBalance) : Number((quantity * currentPrice).toFixed(2));

      return {
        id: `extracted-${Date.now()}-${idx}`,
        ticker,
        name,
        type,
        quantity,
        averagePrice: Number(averagePrice.toFixed(2)),
        totalInvested: Number(totalInvested.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2)),
        currentBalance: Number(currentBalance.toFixed(2)),
        institution: asset.institution || ''
      };
    });

    return NextResponse.json({
      success: true,
      count: sanitized.length,
      assets: sanitized
    });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/scan-investments:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no processamento da IA.' }, { status: 500 });
  }
}
