/**
 * TUTORIA - Módulo de Integração com o Google Gemini
 * Suporta fallback inteligente entre modelos e tratamento didático estruturado.
 */

import { CONFIG } from './armazenamento';

export interface GeminiResponse {
  texto: string;
  imagem_url: string | null;
  modeloUsado?: string;
}

/**
 * Remove formatações markdown e referências textuais antes da síntese de voz.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // Blocos de código
    .replace(/`([^`]+)`/g, '$1') // Código inline
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links markdown
    .replace(/[*_#~>]/g, '') // Caracteres markdown
    .replace(/https?:\/\/\S+/g, '') // URLs
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Faz o parser e sanitização segura da resposta do Gemini.
 */
export function parseGeminiResponse(rawText: string): GeminiResponse {
  if (!rawText || !rawText.trim()) {
    return {
      texto: 'Não consegui formular uma resposta clara para essa dúvida.',
      imagem_url: null
    };
  }

  // Remove marcações de código markdown (```json ... ```) se o modelo adicionar
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const texto = typeof parsed.texto === 'string' && parsed.texto.trim()
      ? parsed.texto.trim()
      : 'Não consegui formular uma resposta clara para essa dúvida.';
    
    let imagem_url: string | null = null;
    if (typeof parsed.imagem_url === 'string' && parsed.imagem_url.trim().startsWith('http')) {
      imagem_url = parsed.imagem_url.trim();
    }

    return { texto, imagem_url };
  } catch {
    // Se o modelo devolver texto puro em vez de JSON estruturado
    return {
      texto: cleaned,
      imagem_url: null
    };
  }
}

/**
 * Dispara requisição para o Gemini com fallback automático entre modelos.
 */
export async function callGeminiApi(
  questionText: string,
  apiKey: string,
  customModels?: string[]
): Promise<GeminiResponse> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error('API Key do Gemini ausente ou inválida.');
  }

  const modelsToTry = customModels && customModels.length > 0
    ? customModels
    : [CONFIG.PRIMARY_MODEL, ...CONFIG.FALLBACK_MODELS];

  let lastError: Error | null = null;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: questionText }]
      }
    ],
    systemInstruction: {
      parts: [{ text: CONFIG.SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.6,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  };

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `Erro HTTP ${response.status} no modelo ${model}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Ignora falha de parse do erro
        }

        lastError = new Error(errorMessage);

        // Se o modelo não estiver disponível ou for 404/503, tenta o próximo no fallback
        if (response.status === 404 || response.status === 503) {
          console.warn(`Modelo ${model} indisponível (${response.status}), tentando fallback...`);
          continue;
        }

        throw lastError;
      }

      const responseData = await response.json();
      const rawContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawContent) {
        throw new Error('A IA retornou uma resposta sem conteúdo legível.');
      }

      const result = parseGeminiResponse(rawContent);
      return {
        ...result,
        modeloUsado: model
      };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Se for erro de permissão ou chave inválida, não adianta tentar outro modelo
      if (
        lastError.message.includes('API key') ||
        lastError.message.includes('permission') ||
        lastError.message.includes('INVALID_ARGUMENT') ||
        lastError.message.includes('API_KEY_INVALID')
      ) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Não foi possível obter resposta dos modelos do Gemini.');
}
