import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithFallback, GEMINI_MODELS } from '@/lib/gemini';

// Aumenta o limite de tempo da rota serverless no Next.js (padrão é 30s)
export const maxDuration = 60;

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
  type?: 'compra' | 'debito' | 'recarga';
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

    // Filter only purchase debits (ignore recharges)
    const purchases = transactions.filter(t => t.type !== 'recarga' && Number(t.amount) > 0);

    if (purchases.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma transação de compra encontrada no histórico para análise.' },
        { status: 400 }
      );
    }

    // 1. Agregação e enriquecimento das compras
    const itemMap: Record<string, {
      nome: string;
      ocorrencias: number;
      quantidadeTotal: number;
      precos: number[];
      subtotalTotal: number;
      datas: string[];
    }> = {};

    const enrichedPurchases = purchases.map(tx => {
      let weekdayName = 'Desconhecido';
      if (tx.date) {
        const parts = tx.date.split('-');
        if (parts.length === 3) {
          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          weekdayName = WEEKDAYS_PT[dateObj.getDay()] || 'Desconhecido';
        }
      }

      const txItems = (tx.items || []).map(i => {
        const qty = Number(i.quantity) > 0 ? Number(i.quantity) : 1;
        const price = Number(i.price) >= 0 ? Number(i.price) : 0;
        const subtotal = Number((qty * price).toFixed(2));

        // Normalização de nome para agregação
        const normalizedName = i.name.trim();
        if (normalizedName) {
          const key = normalizedName.toLowerCase();
          if (!itemMap[key]) {
            itemMap[key] = {
              nome: normalizedName,
              ocorrencias: 0,
              quantidadeTotal: 0,
              precos: [],
              subtotalTotal: 0,
              datas: []
            };
          }
          itemMap[key].ocorrencias += 1;
          itemMap[key].quantidadeTotal += qty;
          if (price > 0) itemMap[key].precos.push(price);
          itemMap[key].subtotalTotal += subtotal;
          if (tx.date) itemMap[key].datas.push(tx.date);
        }

        return {
          produto: i.name,
          quantidade: qty,
          preco_unitario: price,
          subtotal
        };
      });

      return {
        id: tx.id,
        estabelecimento: tx.description,
        data: tx.date,
        dia_da_semana: weekdayName,
        total_pago: tx.amount,
        cartao: tx.cardName || (tx.cardType === 'va' ? 'Vale Alimentação' : 'Vale Refeição'),
        qtd_itens: txItems.length,
        itens: txItems
      };
    });

    // 2. Tabela de consumo consolidado por produto
    const consolidatedItems = Object.values(itemMap).map(it => {
      const avgPrice = it.precos.length > 0
        ? Number((it.precos.reduce((a, b) => a + b, 0) / it.precos.length).toFixed(2))
        : 0;
      const minPrice = it.precos.length > 0 ? Math.min(...it.precos) : 0;
      const maxPrice = it.precos.length > 0 ? Math.max(...it.precos) : 0;

      return {
        nome: it.nome,
        ocorrenciasEmCompras: it.ocorrencias,
        quantidadeCompradaHistorico: Number(it.quantidadeTotal.toFixed(2)),
        precoMedioUnitario: avgPrice,
        faixaPreco: minPrice !== maxPrice ? `R$ ${minPrice.toFixed(2)} a R$ ${maxPrice.toFixed(2)}` : `R$ ${avgPrice.toFixed(2)}`,
        totalGastoNoItem: Number(it.subtotalTotal.toFixed(2))
      };
    });

    const totalGasto = purchases.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
    const totalItensCadastrados = purchases.reduce((acc, tx) => acc + (tx.items?.length || 0), 0);
    const comprasComPoucosItens = purchases.filter(tx => tx.items && tx.items.length > 0 && tx.items.length <= 2);

    // 3. Prompt de Engenharia Avançada com Foco no Começo de Mês & Projeção Realista
    const systemPrompt = `Você é um planejador e analista financeiro sênior especialista em economia doméstica, compras de supermercado e gestão inteligente de Vale Alimentação (VA) e Vale Refeição (VR) no Brasil.

O usuário quer gerar no COMEÇO DO MÊS uma LISTA DE COMPRAS MENSAL INTELIGENTE (Abastecimento de Despensa & Frescos) baseada em todo o seu histórico de consumo e compras anteriores.

SEUS OBJETIVOS PRINCIPAIS:
1. **Validar e analisar todo o consumo do histórico:**
   - Examine todos os produtos que o usuário comprou, quantas vezes comprou, as quantidades e os preços médios pagos.
   - Entenda a rotina familiar (ex: se compram leite toda semana, projeta o mês todo; se compram hortifrúti aos sábados, sugere migrar para a quarta-feira).

2. **Gerar uma Lista de Abastecimento Mensal Completa e Organizada:**
   - A lista deve cobrir as necessidades do mês todo (30 dias) de forma categorizada:
     * **Despensa / Estocáveis (Mês Todo):** Arroz, feijão, café, óleo, caixas de leite, açúcar, massas, molhos, farinhas, etc. Projetar quantidade para 30 dias (ex: se comprou 2 caixas de leite por semana, projetar 8 caixas para o mês todo).
     * **Limpeza & Higiene (Mês Todo):** Papel higiênico, sabão em pó/líquido, detergente, amaciante, creme dental, sabonetes.
     * **Açougue & Proteínas (Carnes/Ovos):** Cortes de carne, frango, ovos, peixes para estocar ou congelar para a quinzena/mês.
     * **Hortifrúti / Feira & Padaria (Ciclo Semanal):** Frutas, verduras, legumes, pães (marcar como 'semanal', com quantidade para a 1ª semana / ciclo de 7-10 dias).
   - Para cada item na lista:
     * 'nome': Nome claro e padronizado do item
     * 'categoria': Uma das categorias exatas: 'Alimentação' | 'Hortifruti' | 'Açougue' | 'Padaria' | 'Bebidas' | 'Limpeza' | 'Higiene' | 'Outros'
     * 'quantidadeSugerida': Número realista projetado para o ciclo
     * 'unidade': 'un' | 'kg' | 'g' | 'L' | 'cx' | 'pct' | 'dz'
     * 'precoUnitarioMedio': Preço médio pago pelo usuário no histórico (se não houver no histórico, use média realista de mercado BR)
     * 'precoTotalEstimado': quantidadeSugerida * precoUnitarioMedio
     * 'tipoItem': 'estocavel' (para compras de despensa do mês todo) | 'semanal' (frescos/feira) | 'quinzenal'
     * 'justificativaConsumo': Ex: "Consumo observado de ~2L/semana. 8 caixas cobrem o mês completo."
     * 'dicaEconomia': Dica prática (ex: "Comprar pacote de 5kg ou fardo fechado", "Aproveitar Quarta da Feira")

3. **Gerar 3 a 4 Insights Práticos com Oportunidades de Economia:**
   - 'timing': Aproveitar Quarta da Feira / Dias promocionais.
   - 'fracionada': Evitar idas picadas ao mercado para comprar 1 ou 2 itens soltos; concentrar na compra de abastecimento mensal.
   - 'fluxo': Dividir o saldo do VA/VR (1 compra grande de começo de mês + reposições semanais de frescos).
   - 'preco': Oportunidades de substituição por marcas equivalentes ou embalagens econômicas.

FORMATO DE RESPOSTA OBRIGATÓRIO:
Retorne EXCLUSIVAMENTE um objeto JSON válido (sem texto antes ou depois, sem crases extras):
{
  "resumoAnalise": "Texto conciso explicando o padrão detectado (ex: 'Avaliamos 12 compras totalizando R$ 680,00 e projetamos sua lista de abastecimento para o mês todo com perspectiva média de preços.')",
  "economiaTotalEstimada": "R$ 60,00 a R$ 110,00/mês",
  "insights": [
    {
      "id": "insight-1",
      "tipo": "timing",
      "titulo": "Quarta da Feira para Hortifrúti e Ovos",
      "descricao": "Concentrar a compra de itens frescos nas quartas-feiras garante descontos de 15% a 25% nas redes de supermercados.",
      "impacto": "Economia de ~R$ 35,00/mês",
      "badge": "Hortifrúti & Frescos",
      "cor": "purple",
      "icone": "calendar_month"
    },
    {
      "id": "insight-2",
      "tipo": "fracionada",
      "titulo": "Concentrar Estocáveis no Começo do Mês",
      "descricao": "Comprar caixas de leite, café e produtos de limpeza em volume único no começo do mês reduz compras picadas de emergência.",
      "impacto": "Economia de ~R$ 40,00/mês",
      "badge": "Despensa Mensal",
      "cor": "emerald",
      "icone": "inventory_2"
    }
  ],
  "itensSugeridosParaLista": ["Arroz Tipo 1 5kg", "Feijão Carioca 1kg", "Leite Integral 1L", "Café em Pó 500g", "Óleo de Soja 900ml", "Detergente 500ml", "Papel Higiênico 12un", "Ovos 30un", "Banana Prata kg", "Peito de Frango kg"],
  "listaMensalSugerida": {
    "titulo": "Abastecimento Mensal Inteligente",
    "custoEstimadoTotal": 420.00,
    "resumoConsumo": "Lista de começo de mês projetando suprimento para 30 dias de estocáveis e 1ª semana de frescos.",
    "itens": [
      {
        "nome": "Leite Integral 1L",
        "categoria": "Alimentação",
        "quantidadeSugerida": 8,
        "unidade": "cx",
        "precoUnitarioMedio": 4.90,
        "precoTotalEstimado": 39.20,
        "justificativaConsumo": "Projetado com base na média semanal de 2 caixas",
        "tipoItem": "estocavel",
        "dicaEconomia": "Comprar caixa fechada de 12 unidades costuma ter 10% de desconto"
      },
      {
        "nome": "Ovos Brancos",
        "categoria": "Alimentação",
        "quantidadeSugerida": 1,
        "unidade": "cx",
        "precoUnitarioMedio": 18.50,
        "precoTotalEstimado": 18.50,
        "justificativaConsumo": "Bandeja com 30 unidades para consumo do mês",
        "tipoItem": "estocavel",
        "dicaEconomia": "Bandejas de 30 unidades saem até 30% mais baratas que caixas de 12"
      }
    ]
  }
}`;

    const userPayload = {
      totalGastoGeral: totalGasto,
      totalComprasRealizadas: purchases.length,
      totalItensHistorico: totalItensCadastrados,
      comprasComApenas1ou2Itens: comprasComPoucosItens.length,
      consumoConsolidadoPorItem: consolidatedItems,
      comprasRecentes: enrichedPurchases.slice(0, 15)
    };

    const promptText = `${systemPrompt}\n\nAqui estão os dados consolidados do histórico de consumo do usuário para a análise e geração da lista do mês:\n\n${JSON.stringify(userPayload, null, 2)}`;

    let parsedResult: any = null;

    try {
      const result = await callGeminiWithFallback(
        apiKey,
        [{ text: promptText }],
        {
          models: [...GEMINI_MODELS.DEFAULT],
          timeoutMs: 25_000,
        }
      );
      parsedResult = result.parsed;
    } catch (geminiErr: any) {
      console.warn('[analyze-purchases] Gemini API encontrou falha, utilizando gerador inteligente de contingência:', geminiErr);
    }

    // 4. Fallback Heurístico Robusto se a IA não responder
    if (!parsedResult || !Array.isArray(parsedResult.insights) || parsedResult.insights.length === 0) {
      // Gera lista e insights baseados diretamente nos dados consolidados
      const fallbackItems = consolidatedItems.length > 0
        ? consolidatedItems.map(it => {
            const isFrescos = /banana|ovo|maçã|tomate|alface|fruta|legume|pão|leite fresco/i.test(it.nome);
            const isEstocavel = /arroz|feijão|óleo|café|açúcar|leite|farinha|molho|macarrão|sabão|detergente|papel/i.test(it.nome);
            const suggestedQty = isEstocavel
              ? Math.max(1, Math.ceil(it.quantidadeCompradaHistorico * 1.5))
              : Math.max(1, it.quantidadeCompradaHistorico);

            return {
              nome: it.nome,
              categoria: /frango|carne|bife|moída|peixe|linguiça/i.test(it.nome) ? 'Açougue'
                : /banana|maçã|tomate|alface|cebola|batata/i.test(it.nome) ? 'Hortifruti'
                : /sabão|detergente|amaciante|limpeza|desinfetante/i.test(it.nome) ? 'Limpeza'
                : /shampoo|sabonete|pasta|dente|papel higiênico/i.test(it.nome) ? 'Higiene'
                : 'Alimentação',
              quantidadeSugerida: suggestedQty,
              unidade: /kg|quilo/i.test(it.nome) ? 'kg' : /litro|L/i.test(it.nome) ? 'L' : 'un',
              precoUnitarioMedio: it.precoMedioUnitario > 0 ? it.precoMedioUnitario : 10.0,
              precoTotalEstimado: Number((suggestedQty * (it.precoMedioUnitario > 0 ? it.precoMedioUnitario : 10.0)).toFixed(2)),
              justificativaConsumo: `Projetado com base no consumo de ${it.quantidadeCompradaHistorico}un registradas no histórico.`,
              tipoItem: isFrescos ? 'semanal' : 'estocavel',
              dicaEconomia: isEstocavel ? 'Comprar no início do mês em embalagem família' : 'Comprar na Quarta da Feira'
            };
          })
        : [
            {
              nome: 'Arroz Tipo 1 5kg',
              categoria: 'Alimentação',
              quantidadeSugerida: 1,
              unidade: 'pct',
              precoUnitarioMedio: 29.90,
              precoTotalEstimado: 29.90,
              justificativaConsumo: 'Consumo mensal essencial para a despensa',
              tipoItem: 'estocavel',
              dicaEconomia: 'Comprar no início do mês'
            },
            {
              nome: 'Feijão Carioca 1kg',
              categoria: 'Alimentação',
              quantidadeSugerida: 2,
              unidade: 'pct',
              precoUnitarioMedio: 8.50,
              precoTotalEstimado: 17.00,
              justificativaConsumo: 'Consumo médio familiar mensal',
              tipoItem: 'estocavel',
              dicaEconomia: 'Comprar pacote fechado'
            },
            {
              nome: 'Leite Integral 1L',
              categoria: 'Alimentação',
              quantidadeSugerida: 8,
              unidade: 'cx',
              precoUnitarioMedio: 4.80,
              precoTotalEstimado: 38.40,
              justificativaConsumo: 'Consumo estimado de 2 caixas por semana',
              tipoItem: 'estocavel',
              dicaEconomia: 'Comprar caixa com 12 unidades para baratear'
            },
            {
              nome: 'Café em Pó 500g',
              categoria: 'Alimentação',
              quantidadeSugerida: 2,
              unidade: 'pct',
              precoUnitarioMedio: 19.90,
              precoTotalEstimado: 39.80,
              justificativaConsumo: 'Consumo matinal diário',
              tipoItem: 'estocavel',
              dicaEconomia: 'Aproveitar promoções no início do mês'
            },
            {
              nome: 'Ovos Brancos 30un',
              categoria: 'Alimentação',
              quantidadeSugerida: 1,
              unidade: 'cx',
              precoUnitarioMedio: 18.90,
              precoTotalEstimado: 18.90,
              justificativaConsumo: 'Bandeja econômica para o mês',
              tipoItem: 'estocavel',
              dicaEconomia: 'Comprar na Quarta da Feira'
            }
          ];

      const fallbackTotal = fallbackItems.reduce((acc, it) => acc + (it.quantidadeSugerida * it.precoUnitarioMedio), 0);

      parsedResult = {
        resumoAnalise: `Consolidamos ${purchases.length} compras (Total R$ ${totalGasto.toFixed(2)}) e geramos sua lista de abastecimento para o começo do mês.`,
        economiaTotalEstimada: 'R$ 45,00 a R$ 90,00/mês',
        insights: [
          {
            id: 'insight-1',
            tipo: 'timing',
            titulo: 'Compre Hortifrúti e Ovos na Quarta da Feira',
            descricao: 'Supermercados costumam oferecer entre 15% e 30% de desconto no setor de hortifrúti às quartas e quintas-feiras.',
            impacto: 'Economia de ~R$ 30,00/mês',
            badge: 'Hortifrúti Promocional',
            cor: 'purple',
            icone: 'calendar_month'
          },
          {
            id: 'insight-2',
            tipo: 'fracionada',
            titulo: 'Compra Grande de Começo de Mês (Despensa)',
            descricao: 'Abastecer todos os itens secos, limpeza e leites logo na recarga do benefício evita compras picadas que custam mais caro.',
            impacto: 'Economia de ~R$ 35,00/mês',
            badge: 'Abastecimento Mensal',
            cor: 'emerald',
            icone: 'shopping_cart'
          }
        ],
        itensSugeridosParaLista: fallbackItems.map(i => i.nome),
        listaMensalSugerida: {
          titulo: 'Abastecimento Mensal Inteligente',
          custoEstimadoTotal: Number(fallbackTotal.toFixed(2)),
          resumoConsumo: 'Projeção de itens essenciais e perspectiva de preços para o mês todo.',
          itens: fallbackItems
        }
      };
    }

    // 5. Garantir consistência dos cálculos
    if (parsedResult.listaMensalSugerida && Array.isArray(parsedResult.listaMensalSugerida.itens)) {
      const calcTotal = parsedResult.listaMensalSugerida.itens.reduce((sum: number, it: any) => {
        const qty = Number(it.quantidadeSugerida) || 1;
        const price = Number(it.precoUnitarioMedio) || 0;
        return sum + (qty * price);
      }, 0);

      parsedResult.listaMensalSugerida.custoEstimadoTotal = Number(calcTotal.toFixed(2));

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
