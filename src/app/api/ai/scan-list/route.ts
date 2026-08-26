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

    const systemPrompt = `Você é um assistente especialista em compras de supermercado, restaurantes e finanças.
Sua tarefa é analisar o conteúdo fornecido (foto de cupom fiscal, nota fiscal DANFE, foto de lista de papel ou texto) e extrair com máxima fidelidade todos os itens comprados ou consumidos.

INSTRUÇÕES CRUCIAIS DE CÁLCULO E PREÇO:
1. 'name': Nome limpo e claro do produto (ex: 'Buffet a Peso', 'Coca-Cola Zero 350ml', 'Arroz 5kg', 'Banana Prata'). Remova códigos numéricos de barras/referência iniciais se houver.
2. 'quantity': Quantidade numérica (ex: 1, 2, 0.378, 1.5).
3. 'unit': Unidade de medida ('un', 'kg', 'g', 'L', 'ml', 'pct', 'cx' ou 'dz'). Se for item por peso (comida a peso, frutas, verduras, carne), use 'kg' ou 'g'. Padrão: 'un'.
4. 'unitPrice': O PREÇO UNITÁRIO / PREÇO POR KG (ou Vl.Un no cupom). Exemplo: se no cupom constar 'Vl.Un: 86.00' e 'Vl.Tot: 32.50', o 'unitPrice' DEVE SER 86.00.
5. 'totalPrice': O VALOR TOTAL DO ITEM (ou Vl.Tot no cupom). Exemplo: 32.50. Se houver apenas o valor total e quantidade for 2, calcule unitPrice = totalPrice / quantity.
6. 'category': 'Alimentação', 'Bebidas', 'Hortifruti', 'Açougue', 'Padaria', 'Limpeza', 'Higiene' ou 'Outros'.
7. Ignore linhas como CNPJ, cabeçalhos, rodapés, total geral do cupom ou formas de pagamento (cartão de crédito).`;

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
            text: `${systemPrompt}\n\nExtraia todos os itens da imagem/documento anexo em formato JSON:`
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
            text: `${systemPrompt}\n\nExtraia os itens a partir do seguinte texto de lista em formato JSON:\n\n${rawText}`
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
            text: `${systemPrompt}\n\nExtraia os itens a partir do seguinte texto de lista em formato JSON:\n\n${body.text}`
          }
        ];
      } else if (body.imageBase64 && body.mimeType) {
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia todos os itens da imagem enviada em formato JSON:`
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
    let itemsResult: any[] | null = null;

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
            itemsResult = JSON.parse(candidate);
            if (Array.isArray(itemsResult) && itemsResult.length > 0) {
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

    if (!itemsResult || !Array.isArray(itemsResult) || itemsResult.length === 0) {
      return NextResponse.json(
        {
          error: 'Não foi possível extrair os itens da imagem ou texto. Tente novamente com uma foto mais nítida.',
          details: lastError
        },
        { status: 422 }
      );
    }

    // Sanitize and format results
    const sanitizedItems = itemsResult.map((item, idx) => {
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

    return NextResponse.json({
      success: true,
      count: sanitizedItems.length,
      items: sanitizedItems
    });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/scan-list:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no processamento da IA.' },
      { status: 500 }
    );
  }
}
