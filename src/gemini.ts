/**
 * TUTORIA - Módulo de Integração com o Google Gemini
 * Suporta resposta estruturada por etapas didáticas e recursos visuais de lousa (RF02).
 */

import { CONFIG } from './armazenamento';
import { EtapaExplicacao, ItemLousa, RespostaDidatica } from './lousa/tipos';

export * from './lousa/tipos';
export type GeminiResponse = RespostaDidatica;

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
 * Faz o parser e sanitização da resposta do Gemini, aceitando o novo formato de etapas
 * ou o formato legado { texto, imagem_url } ou texto puro (RF02, CA03, CA09, CT03).
 */
export function parseGeminiResponse(rawText: string): RespostaDidatica {
  const respostaPadraoVazia: RespostaDidatica = {
    etapas: [
      {
        fala: 'Não consegui formular uma resposta clara para essa dúvida.',
        lousa: null
      }
    ],
    textoCompleto: 'Não consegui formular uma resposta clara para essa dúvida.',
    itensLousa: [],
    texto: 'Não consegui formular uma resposta clara para essa dúvida.',
    imagem_url: null
  };

  if (!rawText || !rawText.trim()) {
    return respostaPadraoVazia;
  }

  // Remove blocos de código ```json ... ``` se existirem
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    // 1. Novo formato: etapas (RF02)
    if (Array.isArray(parsed.etapas) && parsed.etapas.length > 0) {
      // Limita a no máximo 8 etapas para manter a lousa sucinta (RNF06)
      const etapasLimitadas = parsed.etapas.slice(0, 8);

      const etapas: EtapaExplicacao[] = etapasLimitadas.map((e: any) => {
        const fala = typeof e.fala === 'string' && e.fala.trim() ? e.fala.trim() : '';
        let lousa: ItemLousa | null = null;

        if (e.lousa && typeof e.lousa === 'object' && e.lousa.tipo) {
          lousa = {
            tipo: e.lousa.tipo,
            conteudo: e.lousa.conteudo,
            legenda: e.lousa.legenda
          };
        }

        return { fala, lousa };
      });

      const falasValidas = etapas.map(e => e.fala).filter(Boolean);
      const textoCompleto = falasValidas.length > 0
        ? falasValidas.join(' ')
        : 'Explicação didática da lousa.';

      const itensLousa = etapas.map(e => e.lousa).filter((it): it is ItemLousa => it !== null);

      return {
        etapas,
        textoCompleto,
        itensLousa,
        texto: textoCompleto,
        imagem_url: null
      };
    }

    // 2. Formato legado: { texto, imagem_url } (CA09)
    if (typeof parsed.texto === 'string') {
      const fala = parsed.texto.trim();
      let lousa: ItemLousa | null = null;

      if (typeof parsed.imagem_url === 'string' && parsed.imagem_url.trim().startsWith('http')) {
        lousa = {
          tipo: 'imagem',
          conteudo: {
            termo: fala.slice(0, 30),
            urlReal: parsed.imagem_url.trim(),
            legenda: 'Material visual didático'
          }
        };
      }

      return {
        etapas: [{ fala, lousa }],
        textoCompleto: fala,
        itensLousa: lousa ? [lousa] : [],
        texto: fala,
        imagem_url: lousa ? (lousa.conteudo as any).urlReal : null
      };
    }

    // Se o JSON não tiver etapas nem texto
    return {
      etapas: [{ fala: cleaned, lousa: null }],
      textoCompleto: cleaned,
      itensLousa: [],
      texto: cleaned,
      imagem_url: null
    };
  } catch {
    // 3. Texto puro não-JSON (CA09)
    return {
      etapas: [{ fala: cleaned, lousa: null }],
      textoCompleto: cleaned,
      itensLousa: [],
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
): Promise<RespostaDidatica> {
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
      temperature: 0.5,
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
