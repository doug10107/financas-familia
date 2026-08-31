import { NextRequest, NextResponse } from 'next/server';

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

    const systemPrompt = `Você é um especialista em investimentos, mercado financeiro brasileiro (B3) e análise de relatórios de corretoras (Investidor10, Status Invest, B3 Área do Investidor, XP, NuInvest, BTG, Inter).
Sua tarefa é analisar o arquivo (foto, PDF ou print de carteira) ou texto colado e extrair todos os ativos de investimento contidos no documento.

Para cada ativo encontrado, identifique:
1. 'ticker': Código do ativo se houver (ex: 'PETR4', 'VALE3', 'MXRF11', 'HGLG11', 'IVVB11', 'BTC', 'CDB Inter', 'Tesouro Selic 2029').
2. 'name': Nome legível da empresa, fundo ou título (ex: 'Petrobras PN', 'Maxi Renda FII', 'CDB 110% CDI', 'Vale ON').
3. 'type': Categoria do investimento ('Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'ETFs', 'Previdência Privada', 'BDRs', 'Criptomoedas', 'Poupança' ou 'Outros').
4. 'quantity': Quantidade de cotas/ações (número decimal ou inteiro, ex: 100, 3, 15.5). Se for Renda Fixa sem quantidade, use 1.
5. 'averagePrice': Preço Médio de compra por cota/ação em R$ (ex: 35.80, 10.15).
6. 'totalInvested': Valor total investido / custo total em R$ (ex: 3580.00). Se não constar, calcule quantity * averagePrice.
7. 'currentPrice': Cotação atual ou preço de mercado em R$ (opcional, se constar no relatório).
8. 'currentBalance': Saldo atual / valor de mercado em R$ (opcional).
9. 'institution': Nome da corretora ou banco (ex: 'XP', 'NuInvest', 'Inter', 'Clear', 'BTG').

Retorne SEMPRE um JSON válido no formato:
{
  "assets": [
    {
      "ticker": "PETR4",
      "name": "Petrobras PN",
      "type": "Ações",
      "quantity": 100,
      "averagePrice": 35.80,
      "totalInvested": 3580.00,
      "currentPrice": 38.50,
      "currentBalance": 3850.00,
      "institution": "XP Investimentos"
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

    const payload = {
      contents: [{ parts: promptParts }],
      generationConfig: { response_mime_type: 'application/json' }
    };

    const models = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-2.5-flash'];
    let lastError: any = null;
    let parsedResult: any = null;

    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

        if (!res.ok) {
          lastError = await res.text();
          continue;
        }

        const data = await res.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          try {
            parsedResult = JSON.parse(candidate);
            if (parsedResult && (Array.isArray(parsedResult) || (Array.isArray(parsedResult.assets) && parsedResult.assets.length > 0))) {
              break;
            }
          } catch (jsonErr) {
            console.error('Erro no parse JSON:', jsonErr);
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    let rawAssets: any[] = [];
    if (Array.isArray(parsedResult)) {
      rawAssets = parsedResult;
    } else if (parsedResult && Array.isArray(parsedResult.assets)) {
      rawAssets = parsedResult.assets;
    }

    if (rawAssets.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível identificar os ativos no documento ou texto fornecido.', details: lastError },
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
