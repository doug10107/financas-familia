import { NextRequest, NextResponse } from 'next/server';

// Aumenta o limite de tempo da rota serverless no Next.js (padrão é 30s)
export const maxDuration = 60;
import { callGeminiWithFallback, GEMINI_MODELS } from '@/lib/gemini';

interface PurchaseItem {
  name: string;
  quantity: number;
  price: number;
}

interface PurchaseTx {
  id: string;
  cardId?: string;
  cardName?: string;
  cardType?: 'va' | 'vr';
  description: string;
  date: string;
  amount: number;
  type?: 'compra' | 'recarga';
  items?: PurchaseItem[];
}

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const transactions: PurchaseTx[] = body.transactions || [];

    // Filter only purchases (ignore recharges)
    const purchases = transactions.filter(t => t.type !== 'recarga' && t.amount > 0);

    if (purchases.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma transação de compra encontrada para análise.' },
        { status: 400 }
      );
    }

    // Pre-process metrics & enrich with weekday
    const enrichedPurchases = purchases.map(tx => {
      let weekdayName = 'Desconhecido';
      if (tx.date) {
        const parts = tx.date.split('-');
        if (parts.length === 3) {
          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          weekdayName = WEEKDAYS_PT[dateObj.getDay()] || 'Desconhecido';
        }
      }

      return {
        id: tx.id,
        estabelecimento: tx.description,
        data: tx.date,
        dia_da_semana: weekdayName,
        total_pago: tx.amount,
        cartao: tx.cardName || (tx.cardType === 'va' ? 'Vale Alimentação' : 'Vale Refeição'),
        qtd_itens: tx.items?.length || 0,
        itens: (tx.items || []).map(i => ({
          produto: i.name,
          quantidade: i.quantity,
          preco_unitario: i.price,
          subtotal: Number(((i.quantity || 1) * (i.price || 0)).toFixed(2))
        }))
      };
    });

    const totalGasto = purchases.reduce((acc, tx) => acc + (tx.amount || 0), 0);
    const totalItens = purchases.reduce((acc, tx) => acc + (tx.items?.length || 0), 0);
    const comprasComApenas1ou2Itens = purchases.filter(tx => tx.items && tx.items.length > 0 && tx.items.length <= 2);

    const systemPrompt = `Você é um analista especialista em economia doméstica e compras de supermercado/alimentação com foco em otimizar o uso do Vale Alimentação (VA) e Vale Refeição (VR).

O usuário tem um histórico de compras efetivadas (com itens, valores unitários, estabelecimento e dia da semana).
Sua missão é identificar PADRÕES e OPORTUNIDADES REAIS de economia e melhoria de fluxo.

Gere de 3 a 5 insights ultra-práticos, objetivos e amigáveis baseados nos seguintes pilares fundamentais:
1. **🗓️ Timing / Dia da Semana das Compras (Padrão de Supermercado):**
   - No varejo brasileiro:
     * Quarta e Quinta-feira costumam ser a "Quarta da Feira / Festival de Hortifrúti" (frutas, ovos, verduras com descontos de 15% a 30%).
     * Finais de semana (Sábado/Domingo) costumam ter preços cheios para hortifrúti.
   - Verifique se o usuário comprou itens de feira (banana, ovo, tomate, alface, frutas) em finais de semana ou outros dias e calcule o ganho potencial de comprar na Quarta-feira.
2. **🥛 Compras Fracionadas / "Picadas" vs. Compra de Abastecimento:**
   - Detecte se o usuário fez idas ao mercado para comprar apenas 1 ou 2 itens não perecíveis ou de alto consumo (ex: 2 caixas de leite, pó de café, óleo).
   - Mostre como concentrar esses itens em uma única compra mensal de despensa ou caixa fechada pode baratear o custo unitário em 10% a 20%.
3. **⏱️ Divisão do Fluxo do Mês (Dividir em 4 ciclos):**
   - Se os gastos estiverem muito concentrados em poucos dias ou desordenados, recomende dividir o mês em 4 ciclos: 1 compra grande mensal de estocáveis no dia da recarga + 3 compras semanais menores apenas para frescos/perecíveis.
4. **📉 Variação de Preço Unitário & Itens Mais Recorrentes:**
   - Se houver produtos com variação de preço entre idas ao mercado ou se houver oportunidade clara de economia.
5. **🛒 Projeção de Abastecimento Mensal (Consumo para o Mês Todo):**
   - Analise os itens que o usuário comprou ao longo do período e a sua frequência.
   - Projete as QUANTIDADES necessárias para suprir a família durante o MÊS TODO (30 dias) para itens de despensa/estocáveis (ex: arroz, feijão, café, caixas de leite, óleo, papel higiênico, sabão).
   - Se o usuário comprou por exemplo 2 caixas de leite numa semana, projete de 8 a 10 caixas para o mês todo.
   - Para perecíveis (frutas, hortifrúti, ovos, pães), projete o ciclo semanal (7 a 10 dias) com indicação de compra semanal (ex: na Quarta da Feira).
   - Use os preços unitários reais das compras anteriores para estimar o custo unitário médio.

FORMATO DE RESPOSTA OBRIGATÓRIO:
Retorne EXCLUSIVAMENTE um objeto JSON (sem formatação markdown extra) seguindo rigorosamente esta estrutura:
{
  "resumoAnalise": "Texto curto resumindo a análise (ex: 'Analisamos 8 compras somando R$ 420,00 e detectamos 3 padrões de economia')",
  "economiaTotalEstimada": "R$ 45,00 a R$ 75,00/mês",
  "insights": [
    {
      "id": "insight-1",
      "tipo": "timing",
      "titulo": "Aproveite a Quarta da Feira para Hortifrúti e Ovos",
      "descricao": "Identificamos compras de banana e ovos aos sábados. Mudar essas compras para as quartas-feiras aproveita as promoções temáticas dos mercados, barateando a feira.",
      "impacto": "Economia estimada de ~R$ 25,00/mês",
      "badge": "Hortifrúti & Feira",
      "cor": "purple",
      "icone": "calendar_month"
    }
  ],
  "itensSugeridosParaLista": ["Leite Semidesnatado 1L", "Ovos", "Banana"],
  "listaMensalSugerida": {
    "titulo": "Abastecimento Mensal Sugerido",
    "custoEstimadoTotal": 350.50,
    "resumoConsumo": "Projeção calculada para 30 dias de consumo com base no seu histórico recente.",
    "itens": [
      {
        "nome": "Leite Semidesnatado 1L",
        "categoria": "Alimentação",
        "quantidadeSugerida": 8,
        "unidade": "cx",
        "precoUnitarioMedio": 4.99,
        "justificativaConsumo": "Projetado com base no consumo médio semanal",
        "tipoItem": "estocavel"
      }
    ]
  }
}`;

    const userPayload = {
      totalGastoGeral: totalGasto,
      totalCompras: purchases.length,
      totalItensCadastrados: totalItens,
      totalComprasPicadas1ou2Itens: comprasComApenas1ou2Itens.length,
      compras: enrichedPurchases
    };

    // Prompt completo: system + dados juntos (formato compatível com todos os modelos)
    const promptText = `${systemPrompt}\n\nAqui estão os dados consolidados das compras do usuário para sua análise:\n\n${JSON.stringify(userPayload, null, 2)}`;

    let parsedResult: any = null;

    try {
      const result = await callGeminiWithFallback(
        apiKey,
        [{ text: promptText }],
        {
          models: [...GEMINI_MODELS.DEFAULT],
          timeoutMs: 55_000,
        }
      );
      parsedResult = result.parsed;
    } catch (geminiErr: any) {
      console.error('[analyze-purchases] Gemini falhou:', geminiErr);
    }

    if (!parsedResult || !Array.isArray(parsedResult.insights) || parsedResult.insights.length === 0) {
      return NextResponse.json(
        {
          error: 'Não foi possível gerar os insights com a IA no momento.',
        },
        { status: 500 }
      );
    }

    // Ensure backwards compatibility and total calculations for listaMensalSugerida
    if (parsedResult.listaMensalSugerida && Array.isArray(parsedResult.listaMensalSugerida.itens)) {
      const calcTotal = parsedResult.listaMensalSugerida.itens.reduce((sum: number, it: any) => {
        const qty = Number(it.quantidadeSugerida) || 1;
        const price = Number(it.precoUnitarioMedio) || 0;
        return sum + (qty * price);
      }, 0);

      if (!parsedResult.listaMensalSugerida.custoEstimadoTotal || parsedResult.listaMensalSugerida.custoEstimadoTotal <= 0) {
        parsedResult.listaMensalSugerida.custoEstimadoTotal = Number(calcTotal.toFixed(2));
      }

      if (!Array.isArray(parsedResult.itensSugeridosParaLista) || parsedResult.itensSugeridosParaLista.length === 0) {
        parsedResult.itensSugeridosParaLista = parsedResult.listaMensalSugerida.itens.map((it: any) => it.nome);
      }
    }

    return NextResponse.json({
      success: true,
      ...parsedResult
    });
  } catch (error: any) {
    console.error('Erro na rota /api/ai/analyze-purchases:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar análise.' },
      { status: 500 }
    );
  }
}
