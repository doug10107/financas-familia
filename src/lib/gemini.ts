/**
 * Helper centralizado para chamadas à API Gemini.
 * - Fallback automático por lista de modelos
 * - Timeout configurável (padrão: 20s) via AbortController
 * - Modelos válidos atualizados (Gemini 2.x)
 */

export const GEMINI_MODELS = {
  /** Modelos disponíveis para análise (atualizados set/2026) */
  DEFAULT: [
    'gemini-3.6-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ] as const,

  /** Modelos com suporte a visão (imagens/PDFs) */
  VISION: [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
  ] as const,
} as const;

export interface GeminiCallOptions {
  /** Lista de modelos a tentar em sequência. Padrão: GEMINI_MODELS.DEFAULT */
  models?: string[];
  /** Timeout em ms por modelo. Padrão: 20000ms (20s) */
  timeoutMs?: number;
  /** Configurações de geração passadas diretamente à API */
  generationConfig?: Record<string, unknown>;
}

export interface GeminiCallResult {
  /** Texto bruto retornado pela IA */
  rawText: string;
  /** Objeto JSON parseado, se response_mime_type for application/json */
  parsed?: unknown;
  /** Modelo que obteve sucesso */
  modelUsed: string;
}

/**
 * Chama a API Gemini com fallback automático entre modelos e timeout por tentativa.
 *
 * @param apiKey - Chave da API Gemini (GEMINI_API_KEY)
 * @param promptParts - Array de parts do Gemini (text, inline_data, etc.)
 * @param options - Opções de chamada (modelos, timeout, generationConfig, systemInstruction)
 * @returns Resultado com rawText, parsed (se JSON) e modelUsed
 * @throws Error se todos os modelos falharem
 */
export async function callGeminiWithFallback(
  apiKey: string,
  promptParts: unknown[],
  options: GeminiCallOptions = {}
): Promise<GeminiCallResult> {
  const {
    models = [...GEMINI_MODELS.DEFAULT],
    timeoutMs = 20_000,
    generationConfig = { response_mime_type: 'application/json' },
  } = options;

  let lastError: unknown = null;

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Formato simples e compatível com todos os modelos Gemini v1beta
      const body: Record<string, unknown> = {
        contents: [{ parts: promptParts }],
        generationConfig: {
          response_mime_type: (generationConfig as Record<string, unknown>)['response_mime_type'] ?? 'application/json',
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini] Modelo ${model} retornou status ${response.status}: ${errText}`);
        lastError = errText;
        continue;
      }

      const data = await response.json();
      const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.warn(`[Gemini] Modelo ${model} retornou resposta vazia.`);
        lastError = 'Resposta vazia';
        continue;
      }

      // Tentar parsear JSON automaticamente
      let parsed: unknown | undefined;
      try {
        parsed = JSON.parse(rawText);
      } catch (jsonErr) {
        console.warn(`[Gemini] Falha no parse JSON do modelo ${model}:`, jsonErr);
        lastError = jsonErr;
        continue;
      }

      console.info(`[Gemini] Sucesso com modelo: ${model}`);
      return { rawText, parsed, modelUsed: model };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      console.warn(`[Gemini] ${isAbort ? `Timeout (${timeoutMs}ms)` : 'Erro'} no modelo ${model}:`, err);
      lastError = err;
    }
  }

  throw new Error(`[Gemini] Todos os modelos falharam. Último erro: ${String(lastError)}`);
}
