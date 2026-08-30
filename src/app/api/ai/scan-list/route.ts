import { NextRequest, NextResponse } from 'next/server';

function normalizeUnit(rawUnit: string, qty: number, name: string): string {
  const u = (rawUnit || '').toLowerCase().trim();
  if (['kg', 'quilo', 'quilos', 'kilo', 'kilos'].includes(u)) return 'kg';
  if (['g', 'gr', 'grama', 'gramas'].includes(u)) return 'g';
  if (['l', 'lt', 'litro', 'litros'].includes(u)) return 'L';
  if (['ml', 'mls', 'mililitro', 'mililitros'].includes(u)) return 'ml';
  if (['pct', 'pacote', 'pacotes'].includes(u)) return 'pct';
  if (['cx', 'caixa', 'caixas'].includes(u)) return 'cx';
  if (['dz', 'duzia', 'dúzia'].includes(u)) return 'dz';
  
  // If unit was printed as UNID on receipt but quantity is fractional (e.g. 0.378 kg buffet or fruit)
  if (qty > 0 && qty < 1 && (name.toLowerCase().includes('peso') || name.toLowerCase().includes('buffet') || name.toLowerCase().includes('kg'))) {
    return 'kg';
  }

  return 'un';
}

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

    const systemPrompt = `Você é um assistente especialista em análise de compras de supermercado, cupons fiscais (NFC-e / SAT / DANFE) e finanças familiares.
Sua tarefa é analisar o conteúdo fornecido (foto de cupom fiscal, nota fiscal, link de QR Code NFC-e/SAT, foto de lista manuscrita ou texto) e extrair com máxima precisão todos os itens comprados, os preços, quantidades e descontos do cupom.

REGRAS DE EXTRAÇÃO:
1. 'name': Nome limpo e legível do produto (ex: 'MARG DORIANA 1KG', 'ARROZ NAMORADO 5KG', 'BANANA CATURRA', 'Buffet a Peso'). Remova prefixos numéricos inúteis ou códigos como '(Código: 213352)'.
2. 'quantity': Quantidade numérica precisa (ex: 1, 2, 3, 0.378, 1.17, 3.986).
3. 'unit': Unidade de medida ('un', 'kg', 'g', 'L', 'ml', 'pct', 'cx' ou 'dz').
4. 'unitPrice': O PREÇO UNITÁRIO / PREÇO POR KG (Vl. Unit / Vl.Un). Ex: se no cupom constar 'Qtde: 3,986 UN: Kg Vl. Unit: 38,901154 Vl. Total: 155,06', o 'unitPrice' DEVE SER 38.90 e 'quantity' 3.986.
5. 'totalPrice': O VALOR TOTAL DO ITEM (Vl. Total / Vl.Tot).
6. 'category': Escolha entre: 'Alimentação', 'Hortifruti', 'Açougue', 'Padaria', 'Bebidas', 'Limpeza', 'Higiene' ou 'Outros'.

INSTRUÇÃO FUNDAMENTAL DE DESCONTOS E TOTAIS:
- 'totalGross': A soma bruta dos itens antes de desconto (ex: 624.39).
- 'discount': Se o cupom/lista contiver desconto geral ou desconto no final (ex: 'Descontos R$: 7,20', 'Desconto: R$ 7,20', 'Desconto Subtotal', 'Abatimento'), informe o valor positivo do desconto (ex: 7.20). Caso não haja, retorne 0.
- 'totalNet': O valor líquido total a pagar após desconto (ex: 617.19).

FORMATO DE RESPOSTA OBRIGATÓRIO (JSON):
Retorne SEMPRE um objeto JSON válido com a seguinte estrutura:
{
  "items": [
    {
      "name": "MARG DORIANA 1KG",
      "quantity": 1,
      "unit": "un",
      "unitPrice": 12.98,
      "totalPrice": 12.98,
      "category": "Alimentação"
    }
  ],
  "totalGross": 624.39,
  "discount": 7.20,
  "totalNet": 617.19
}`;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('text') as string | null;
      const qrUrl = formData.get('qrUrl') as string | null;

      if (qrUrl) {
        let fetchedContent = qrUrl;
        try {
          if (qrUrl.startsWith('http://') || qrUrl.startsWith('https://')) {
            const pageRes = await fetch(qrUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              }
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              fetchedContent = `CONTEÚDO DA PÁGINA DO CUPOM FISCAL / NFC-E:\n${html.slice(0, 50000)}`;
            }
          }
        } catch (fetchErr) {
          console.warn('Erro ao consultar URL do QR Code diretamente:', fetchErr);
        }

        promptParts = [
          {
            text: `${systemPrompt}\n\nAnalise os dados desta consulta de cupom fiscal / QR Code NFC-e e extraia todos os itens e totais:\n\n${fetchedContent}`
          }
        ];
      } else if (file) {
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = file.type || 'image/jpeg';

        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia todos os itens, preços e eventuais descontos da imagem/documento anexo em formato JSON:`
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
            text: `${systemPrompt}\n\nExtraia os itens, valores e eventuais descontos a partir do seguinte texto de cupom/lista em formato JSON:\n\n${rawText}`
          }
        ];
      } else {
        return NextResponse.json({ error: 'Nenhum arquivo, texto ou QR Code foi enviado.' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      if (body.qrUrl || body.url) {
        const targetUrl = body.qrUrl || body.url;
        let fetchedContent = targetUrl;
        try {
          if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            const pageRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              }
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              fetchedContent = `CONTEÚDO DA PÁGINA DO CUPOM FISCAL / NFC-E:\n${html.slice(0, 50000)}`;
            }
          }
        } catch (fetchErr) {
          console.warn('Erro ao consultar URL do QR Code diretamente:', fetchErr);
        }

        promptParts = [
          {
            text: `${systemPrompt}\n\nAnalise os dados desta consulta de cupom fiscal / QR Code NFC-e e extraia todos os itens e totais:\n\n${fetchedContent}`
          }
        ];
      } else if (body.text) {
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia os itens, valores e eventuais descontos a partir do seguinte texto de cupom/lista em formato JSON:\n\n${body.text}`
          }
        ];
      } else if (body.imageBase64 && body.mimeType) {
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia todos os itens, preços e eventuais descontos da imagem enviada em formato JSON:`
          },
          {
            inline_data: {
              mime_type: body.mimeType,
              data: body.imageBase64
            }
          }
        ];
      } else {
        return NextResponse.json({ error: 'Formato de requisição inválido.' }, { status: 400 });
      }
    }

    const payload = {
      contents: [
        {
          parts: promptParts
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json'
      }
    };

    // Use available Gemini models
    const models = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-2.5-flash'
    ];

    let lastError: any = null;
    let parsedData: any = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Tentativa com modelo ${model} retornou status ${response.status}: ${errText}`);
          lastError = errText;
          continue;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          try {
            parsedData = JSON.parse(candidate);
            if (parsedData && (Array.isArray(parsedData) || (Array.isArray(parsedData.items) && parsedData.items.length > 0))) {
              break;
            }
          } catch (jsonErr) {
            console.error(`Erro no parse JSON de ${model}:`, jsonErr, candidate);
          }
        }
      } catch (callErr) {
        console.warn(`Erro na chamada ao modelo ${model}:`, callErr);
        lastError = callErr;
      }
    }

    // Extract raw items and discount from parsedData
    let rawItems: any[] = [];
    let detectedDiscount = 0;
    let detectedTotalGross = 0;
    let detectedTotalNet = 0;

    if (Array.isArray(parsedData)) {
      rawItems = parsedData;
    } else if (parsedData && typeof parsedData === 'object') {
      if (Array.isArray(parsedData.items)) {
        rawItems = parsedData.items;
      }
      if (typeof parsedData.discount === 'number' && !isNaN(parsedData.discount)) {
        detectedDiscount = Math.abs(parsedData.discount);
      }
      if (typeof parsedData.totalGross === 'number' && !isNaN(parsedData.totalGross)) {
        detectedTotalGross = parsedData.totalGross;
      }
      if (typeof parsedData.totalNet === 'number' && !isNaN(parsedData.totalNet)) {
        detectedTotalNet = parsedData.totalNet;
      }
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          error: 'Não foi possível extrair os itens da imagem, texto ou QR Code. Tente novamente.',
          details: lastError
        },
        { status: 422 }
      );
    }

    // Sanitize and format results
    const sanitizedItems = rawItems.map((item, idx) => {
      const name = String(item.name || `Item ${idx + 1}`).trim();
      const rawQty = Number(item.quantity);
      const qty = isNaN(rawQty) || rawQty <= 0 ? 1 : Number(rawQty.toFixed(3));
      const unit = normalizeUnit(item.unit, qty, name);

      // Determine correct unit price
      const rawUnitPrice = Number(item.unitPrice || item.estimatedPrice);
      const rawTotalPrice = Number(item.totalPrice);

      let unitPrice = 0;
      if (!isNaN(rawUnitPrice) && rawUnitPrice > 0) {
        unitPrice = rawUnitPrice;
      } else if (!isNaN(rawTotalPrice) && rawTotalPrice > 0 && qty > 0) {
        unitPrice = rawTotalPrice / qty;
      }

      unitPrice = Number(unitPrice.toFixed(2));
      const category = item.category ? String(item.category).trim() : 'Alimentação';

      return {
        id: `ai-item-${Date.now()}-${idx}`,
        name,
        quantity: qty,
        unit,
        estimatedPrice: unitPrice,
        actualPrice: unitPrice,
        category,
        isChecked: false
      };
    });

    const calculatedSum = sanitizedItems.reduce((acc, i) => acc + (i.quantity * i.estimatedPrice), 0);
    const totalGross = detectedTotalGross > 0 ? detectedTotalGross : Number(calculatedSum.toFixed(2));
    const discount = Number(detectedDiscount.toFixed(2));
    const totalNet = detectedTotalNet > 0 ? detectedTotalNet : Number(Math.max(0, totalGross - discount).toFixed(2));

    return NextResponse.json({
      success: true,
      count: sanitizedItems.length,
      items: sanitizedItems,
      totalGross,
      discount,
      totalNet
    });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/scan-list:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no processamento da IA.' },
      { status: 500 }
    );
  }
}
