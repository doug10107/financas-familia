import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, GEMINI_MODELS } from '@/lib/gemini';

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

    let inputType: 'file' | 'qrUrl' | 'text' = 'file';
    let rawQrUrl: string | null = null;
    let isUrlFetchSuccessful = false;
    let isBlockedByWaf = false;

    // Helper para verificar se a página retornada pela SEFAZ é um bloqueio de segurança/WAF
    const checkIsSefazBlocked = (html: string) => {
      const lower = html.toLowerCase();
      return (
        lower.includes('request rejected') ||
        lower.includes('requested url was rejected') ||
        lower.includes('acesso negado') ||
        lower.includes('access denied') ||
        lower.includes('bloqueio de seguran') ||
        lower.includes('challenge-platform') ||
        lower.includes('cf-browser-verification') ||
        lower.includes('hcaptcha') ||
        lower.includes('recaptcha') ||
        lower.includes('support id is:') ||
        html.length < 400
      );
    };

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('text') as string | null;
      const qrUrl = formData.get('qrUrl') as string | null;

      if (qrUrl) {
        inputType = 'qrUrl';
        rawQrUrl = qrUrl.trim();
        let fetchedContent = rawQrUrl;
        try {
          if (rawQrUrl.startsWith('http://') || rawQrUrl.startsWith('https://')) {
            const pageRes = await fetch(rawQrUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
              },
              redirect: 'follow',
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              if (checkIsSefazBlocked(html)) {
                console.warn('[scan-list] Consulta ao QR Code foi bloqueada pelo portal da SEFAZ (WAF / Request Rejected).');
                isBlockedByWaf = true;
                isUrlFetchSuccessful = false;
              } else {
                fetchedContent = `CONTEÚDO DA PÁGINA DO CUPOM FISCAL / NFC-E:\n${html.slice(0, 50000)}`;
                isUrlFetchSuccessful = true;
              }
            } else {
              isBlockedByWaf = true;
            }
          }
        } catch (fetchErr) {
          console.warn('Erro ao consultar URL do QR Code diretamente:', fetchErr);
          isBlockedByWaf = true;
        }

        promptParts = [
          {
            text: `${systemPrompt}\n\nAnalise os dados desta consulta de cupom fiscal / QR Code NFC-e e extraia todos os itens e totais:\n\n${fetchedContent}`
          }
        ];
      } else if (file) {
        inputType = 'file';
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
        inputType = 'text';
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
        inputType = 'qrUrl';
        const targetUrl = (body.qrUrl || body.url || '').trim();
        rawQrUrl = targetUrl;
        let fetchedContent = targetUrl;
        try {
          if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            const pageRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
              },
              redirect: 'follow',
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              if (checkIsSefazBlocked(html)) {
                console.warn('[scan-list] Consulta ao QR Code foi bloqueada pelo portal da SEFAZ (WAF / Request Rejected).');
                isBlockedByWaf = true;
                isUrlFetchSuccessful = false;
              } else {
                fetchedContent = `CONTEÚDO DA PÁGINA DO CUPOM FISCAL / NFC-E:\n${html.slice(0, 50000)}`;
                isUrlFetchSuccessful = true;
              }
            } else {
              isBlockedByWaf = true;
            }
          }
        } catch (fetchErr) {
          console.warn('Erro ao consultar URL do QR Code diretamente:', fetchErr);
          isBlockedByWaf = true;
        }

        promptParts = [
          {
            text: `${systemPrompt}\n\nAnalise os dados desta consulta de cupom fiscal / QR Code NFC-e e extraia todos os itens e totais:\n\n${fetchedContent}`
          }
        ];
      } else if (body.text) {
        inputType = 'text';
        promptParts = [
          {
            text: `${systemPrompt}\n\nExtraia os itens, valores e eventuais descontos a partir do seguinte texto de cupom/lista em formato JSON:\n\n${body.text}`
          }
        ];
      } else if (body.imageBase64 && body.mimeType) {
        inputType = 'file';
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

    // Chamar API Gemini com fallback automático de modelos e timeout
    let parsedData: any = null;
    let geminiErrorMessage: string | null = null;

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
      parsedData = result.parsed;
    } catch (geminiErr: any) {
      console.error('[scan-list] Gemini falhou:', geminiErr);
      geminiErrorMessage = geminiErr?.message || String(geminiErr);
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
      let customError = 'Não foi possível extrair os itens da imagem, texto ou QR Code. Tente novamente.';

      if (inputType === 'qrUrl') {
        const cleanDigits = (rawQrUrl || '').replace(/\D/g, '');
        if (cleanDigits.length === 44 && !rawQrUrl?.startsWith('http')) {
          customError = 'A chave numérica de 44 dígitos não contém os nomes e valores dos produtos. Aponte a câmera para o QR Code impresso no cupom ou fotografe o cupom na aba "Foto ou PDF".';
        } else if (!isUrlFetchSuccessful || isBlockedByWaf) {
          customError = 'O portal da SEFAZ (Secretaria da Fazenda de SP / Estado) bloqueou a consulta automática deste QR Code com proteção de segurança governamental (F5 WAF). Por favor, use a aba "Foto ou PDF" para fotografar o cupom fiscal impresso — a IA lê todos os produtos na hora!';
        } else {
          customError = 'A consulta ao link do cupom não retornou a lista de produtos (o portal estadual pode exigir verificação interativa). Fotografe o cupom fiscal impresso na aba "Foto ou PDF".';
        }
      } else if (inputType === 'text') {
        customError = 'Não foi possível identificar os produtos e preços no texto informado. Certifique-se de que o texto inclui nomes dos produtos e valores.';
      } else if (geminiErrorMessage) {
        customError = `Falha na comunicação com a IA: ${geminiErrorMessage}`;
      }

      return NextResponse.json(
        { 
          error: customError,
          isSefazBlocked: inputType === 'qrUrl'
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
