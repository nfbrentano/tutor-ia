/**
 * TUTORIA - Módulo de Integração com o Google Gemini
 * Suporta resposta estruturada por etapas didáticas, lousa, streaming SSE e modelo lembrado.
 * (RF02, RF08, RF09, RF10, RF11, CA09, CA10, CA11, CA12, CA13)
 */

import { CONFIG } from './armazenamento';
import { EtapaExplicacao, ItemLousa, RespostaDidatica } from './lousa/tipos';
import { TrechoLivro } from './conhecimento/tipos';

export * from './lousa/tipos';
export type GeminiResponse = RespostaDidatica;

/* ==========================================================================
   MODELO LEMBRADO E GESTÃO DE FALHAS 404 (RF10, CA12)
   ========================================================================== */
export const CHAVE_MODELO_SUCESSO = 'tutoria_modelo_sucesso';
export const CHAVE_MODELOS_404 = 'tutoria_modelos_404';
export const VALIDADE_24H_MS = 24 * 60 * 60 * 1000;

let memoriaModeloSucesso: { modelo: string; timestamp: number } | null = null;
let memoriaModelos404: Record<string, number> = {};

export function limparCacheModelos(): void {
  memoriaModeloSucesso = null;
  memoriaModelos404 = {};
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CHAVE_MODELO_SUCESSO);
      localStorage.removeItem(CHAVE_MODELOS_404);
    }
  } catch {}
}

export function registrarModeloSucesso(modelo: string): void {
  const agora = Date.now();
  memoriaModeloSucesso = { modelo, timestamp: agora };
  delete memoriaModelos404[modelo];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_MODELO_SUCESSO, JSON.stringify(memoriaModeloSucesso));
      localStorage.setItem(CHAVE_MODELOS_404, JSON.stringify(memoriaModelos404));
    }
  } catch {}
}

export function registrarModelo404(modelo: string): void {
  const agora = Date.now();
  memoriaModelos404[modelo] = agora;
  if (memoriaModeloSucesso?.modelo === modelo) {
    memoriaModeloSucesso = null;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_MODELOS_404, JSON.stringify(memoriaModelos404));
      localStorage.removeItem(CHAVE_MODELO_SUCESSO);
    }
  } catch {}
}

export function obterModelosOrdenados(customModels?: string[]): string[] {
  const agora = Date.now();
  const modelosBase = customModels && customModels.length > 0
    ? customModels
    : [CONFIG.PRIMARY_MODEL, ...CONFIG.FALLBACK_MODELS];

  // Recupera do localStorage se a memória estiver vazia
  try {
    if (typeof localStorage !== 'undefined') {
      if (!memoriaModeloSucesso) {
        const stored = localStorage.getItem(CHAVE_MODELO_SUCESSO);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (agora - parsed.timestamp < VALIDADE_24H_MS) {
            memoriaModeloSucesso = parsed;
          } else {
            localStorage.removeItem(CHAVE_MODELO_SUCESSO);
          }
        }
      }

      if (Object.keys(memoriaModelos404).length === 0) {
        const stored404 = localStorage.getItem(CHAVE_MODELOS_404);
        if (stored404) {
          memoriaModelos404 = JSON.parse(stored404);
        }
      }
    }
  } catch {}

  // Pula modelos que deram 404 dentro do período de 24h
  const modelosDisponiveis = modelosBase.filter(m => {
    const timestamp404 = memoriaModelos404[m];
    if (timestamp404 && agora - timestamp404 < VALIDADE_24H_MS) {
      return false;
    }
    return true;
  });

  const listaFinal = modelosDisponiveis.length > 0 ? modelosDisponiveis : modelosBase;

  // Se houver modelo lembrado bem-sucedido nas últimas 24h, tenta-o primeiro
  if (
    memoriaModeloSucesso &&
    agora - memoriaModeloSucesso.timestamp < VALIDADE_24H_MS &&
    listaFinal.includes(memoriaModeloSucesso.modelo)
  ) {
    const lembrado = memoriaModeloSucesso.modelo;
    return [lembrado, ...listaFinal.filter(m => m !== lembrado)];
  }

  return listaFinal;
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
 * Valida fontes retornadas pelo modelo contra os trechos realmente enviados no prompt (RF05, RF06, CA06).
 * Fontes alucinadas ou de páginas não enviadas são estritamente descartadas.
 */
export function extrairEValidarFontes(
  fontesRaw: any,
  trechosContexto?: TrechoLivro[]
): Array<{ livroId: string; tituloLivro?: string; pagina: number; trechoId?: string }> | undefined {
  if (!Array.isArray(fontesRaw) || fontesRaw.length === 0) {
    return undefined;
  }
  if (!trechosContexto || trechosContexto.length === 0) {
    return undefined;
  }

  const fontesValidadas: Array<{ livroId: string; tituloLivro?: string; pagina: number; trechoId?: string }> = [];
  const chavesAdicionadas = new Set<string>();

  for (const item of fontesRaw) {
    if (!item || typeof item !== 'object') continue;
    const livroId = String(item.livroId || '').trim();
    const pagina = Number(item.pagina);
    if (!livroId || isNaN(pagina)) continue;

    // CA06: O app NÃO mostra fontes que não vieram de trechos enviados
    const trechoEncontrado = trechosContexto.find(
      t => t.livroId === livroId && Number(t.pagina) === pagina
    );

    if (trechoEncontrado) {
      const chave = `${livroId}-p${pagina}`;
      if (!chavesAdicionadas.has(chave)) {
        chavesAdicionadas.add(chave);
        fontesValidadas.push({
          livroId,
          tituloLivro: trechoEncontrado.tituloLivro,
          pagina,
          trechoId: trechoEncontrado.id
        });
      }
    }
  }

  return fontesValidadas.length > 0 ? fontesValidadas : undefined;
}

/**
 * Faz o parser e sanitização da resposta do Gemini, aceitando o novo formato de etapas,
 * NDJSON por linha, formato legado { texto, imagem_url } ou texto puro (RF02, RF09, CA03, CA09, CA11, CT03).
 */
export function parseGeminiResponse(rawText: string, trechosContexto?: TrechoLivro[]): RespostaDidatica {
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

  // Remove delimitadores markdown ```json ... ``` se existirem
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Tentativa 1: NDJSON (uma etapa por linha)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const etapasNdjson: EtapaExplicacao[] = [];
    let todosValidos = true;
    for (const line of lines) {
      try {
        const item = JSON.parse(line.replace(/^,|,$/g, ''));
        if (item && typeof item.fala === 'string') {
          etapasNdjson.push({
            fala: item.fala.trim(),
            lousa: item.lousa || null
          });
        } else {
          todosValidos = false;
          break;
        }
      } catch {
        todosValidos = false;
        break;
      }
    }
    if (todosValidos && etapasNdjson.length > 0) {
      const falasValidas = etapasNdjson.map(e => e.fala).filter(Boolean);
      const textoCompleto = falasValidas.join(' ');
      const itensLousa = etapasNdjson.map(e => e.lousa).filter((it): it is ItemLousa => it !== null);
      return {
        etapas: etapasNdjson.slice(0, 8),
        textoCompleto,
        itensLousa,
        texto: textoCompleto,
        imagem_url: null
      };
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    const fontes = extrairEValidarFontes(parsed.fontes, trechosContexto);

    // Tentativa 2: Formato com array etapas: [{ fala, lousa }] (RF02)
    if (Array.isArray(parsed.etapas) && parsed.etapas.length > 0) {
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
        imagem_url: null,
        fontes
      };
    }

    // Tentativa 3: Objeto único de etapa { fala, lousa }
    if (typeof parsed.fala === 'string') {
      const fala = parsed.fala.trim();
      const lousa = parsed.lousa || null;
      return {
        etapas: [{ fala, lousa }],
        textoCompleto: fala,
        itensLousa: lousa ? [lousa] : [],
        texto: fala,
        imagem_url: null,
        fontes
      };
    }

    // Tentativa 4: Formato legado: { texto, imagem_url } (CA09)
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
        imagem_url: lousa ? (lousa.conteudo as any).urlReal : null,
        fontes
      };
    }

    // Fallback para JSON genérico
    return {
      etapas: [{ fala: cleaned, lousa: null }],
      textoCompleto: cleaned,
      itensLousa: [],
      texto: cleaned,
      imagem_url: null,
      fontes
    };
  } catch {
    // Tentativa 5: Texto puro não-JSON (CA09, CA11)
    return {
      etapas: [{ fala: cleaned, lousa: null }],
      textoCompleto: cleaned,
      itensLousa: [],
      texto: cleaned,
      imagem_url: null
    };
  }
}

export interface OpcoesChamadaGemini {
  customModels?: string[];
  signal?: AbortSignal;
  onEtapaRecebida?: (etapa: EtapaExplicacao) => void;
  ignorarStreaming?: boolean;
  trechosContexto?: TrechoLivro[];
}

/**
 * Dispara requisição para o Gemini com streaming SSE e fallback automático entre modelos.
 * (RF08, RF09, RF10, RF11, CA09 - CA14)
 */
export async function callGeminiApi(
  questionText: string,
  apiKey: string,
  opcoesOuModelos?: OpcoesChamadaGemini | string[]
): Promise<RespostaDidatica> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    throw new Error('API Key do Gemini ausente ou inválida.');
  }

  // Compatibilidade: se for array, trata como customModels
  const opcoes: OpcoesChamadaGemini = Array.isArray(opcoesOuModelos)
    ? { customModels: opcoesOuModelos }
    : (opcoesOuModelos || {});

  // Obtém modelos com ordenação do modelo lembrado (RF10, CA12)
  const modelsToTry = obterModelosOrdenados(opcoes.customModels);

  let lastError: Error | null = null;

  // Monta prompt com bloco de trechos se houver trechos relevantes (RF05, RF06)
  let textoPromptFinal = questionText;
  if (opcoes.trechosContexto && opcoes.trechosContexto.length > 0) {
    const trechosFormatados = opcoes.trechosContexto.map((t, idx) => {
      return `[Trecho ${idx + 1}] Livro: "${t.tituloLivro}" (ID: ${t.livroId}), Página ${t.pagina}:\n"${t.texto}"`;
    }).join('\n\n');

    // Limite de ~1500 tokens / ~6000 caracteres para os trechos de referência (RF05)
    const trechosTruncados = trechosFormatados.length > 6000
      ? trechosFormatados.slice(0, 6000) + '...'
      : trechosFormatados;

    textoPromptFinal = `${questionText}\n\n--- Trechos do livro didático para consulta ---\n${trechosTruncados}\n-----------------------------------------------`;
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: textoPromptFinal }]
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

  const querStreaming = Boolean(opcoes.onEtapaRecebida && !opcoes.ignorarStreaming);

  for (const model of modelsToTry) {
    try {
      if (opcoes.signal?.aborted) {
        throw new DOMException('Requisição cancelada pelo usuário.', 'AbortError');
      }

      const method = querStreaming ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}key=${trimmedKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: opcoes.signal
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
          if (response.status === 404) {
            registrarModelo404(model);
          }
          continue;
        }

        throw lastError;
      }

      // SUCESSO: Registra o modelo como lembrado para as próximas requisições (RF10, CA12)
      registrarModeloSucesso(model);

      // 1. Processamento via streaming SSE (RF08, CA09, CA10)
      if (querStreaming && response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const decoder = new TextDecoder();
        let rawBuffer = '';
        let sseLineBuffer = '';
        const etapasEmitidas: EtapaExplicacao[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            sseLineBuffer += chunkText;

            // Processa linhas SSE (data: {...})
            const sseLines = sseLineBuffer.split('\n');
            sseLineBuffer = sseLines.pop() || ''; // mantém linha incompleta no buffer

            for (const line of sseLines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;
                try {
                  const sseData = JSON.parse(jsonStr);
                  const parte = sseData.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (parte) {
                    rawBuffer += parte;
                    // Verifica se linhas completas de etapa surgiram no buffer
                    processarBufferIncremental(rawBuffer, etapasEmitidas, opcoes.onEtapaRecebida);
                  }
                } catch {
                  // Linha sse parcial, aguarda próximo chunk
                }
              }
            }
          }
        } catch (streamErr: any) {
          if (streamErr?.name === 'AbortError') throw streamErr;
          console.warn('Conexão de streaming interrompida, processando dados acumulados:', streamErr);
        }

        // Fim do stream: se emitiu etapas incrementais, retorna a resposta completa
        if (etapasEmitidas.length > 0) {
          const falas = etapasEmitidas.map(e => e.fala).filter(Boolean);
          const textoCompleto = falas.join(' ');
          const itensLousa = etapasEmitidas.map(e => e.lousa).filter((it): it is ItemLousa => it !== null);

          let fontesValidadas: any = undefined;
          try {
            const parsedBuffer = JSON.parse(rawBuffer);
            fontesValidadas = extrairEValidarFontes(parsedBuffer.fontes, opcoes.trechosContexto);
          } catch {}

          return {
            etapas: etapasEmitidas,
            textoCompleto,
            itensLousa,
            modeloUsado: model,
            texto: textoCompleto,
            imagem_url: null,
            fontes: fontesValidadas
          };
        }

        // Fallback do streaming (RF09, CA11): se não emitiu linha a linha, processa o texto acumulado
        const parsedFinal = parseGeminiResponse(rawBuffer, opcoes.trechosContexto);
        if (opcoes.onEtapaRecebida) {
          parsedFinal.etapas.forEach(e => opcoes.onEtapaRecebida!(e));
        }
        return {
          ...parsedFinal,
          modeloUsado: model
        };
      }

      // 2. Processamento regular sem streaming (ou fallback se body reader não existir)
      const responseData = await response.json();
      const rawContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawContent) {
        throw new Error('A IA retornou uma resposta sem conteúdo legível.');
      }

      const result = parseGeminiResponse(rawContent, opcoes.trechosContexto);

      if (opcoes.onEtapaRecebida) {
        result.etapas.forEach(e => opcoes.onEtapaRecebida!(e));
      }

      return {
        ...result,
        modeloUsado: model
      };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        lastError.name === 'AbortError' ||
        lastError.message.includes('cancelada') ||
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

/**
 * Extrai etapas completas do buffer acumulado conforme chegam durante o streaming (RF08, CA09, CA10).
 * Utiliza balanceamento de chaves e strings para suportar estruturas aninhadas sem quebrar (tabelas, listas, fórmulas).
 */
function processarBufferIncremental(
  buffer: string,
  etapasEmitidas: EtapaExplicacao[],
  callback?: (etapa: EtapaExplicacao) => void
): void {
  if (!callback) return;

  // 1. Tenta extrair linhas completas NDJSON
  const lines = buffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim().replace(/^,|,$/g, '');
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.fala === 'string' && obj.fala.trim()) {
        const jaEmitida = etapasEmitidas.some(e => e.fala === obj.fala.trim());
        if (!jaEmitida) {
          const novaEtapa: EtapaExplicacao = {
            fala: obj.fala.trim(),
            lousa: obj.lousa || null
          };
          etapasEmitidas.push(novaEtapa);
          callback(novaEtapa);
        }
      }
    } catch {
      // Linha parcial, continua
    }
  }

  // 2. Parser robusto de objetos no array "etapas": [ ... ]
  const etapasIndex = buffer.indexOf('"etapas"');
  if (etapasIndex !== -1) {
    const startIndex = buffer.indexOf('[', etapasIndex);
    if (startIndex !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let objStart = -1;

      for (let i = startIndex + 1; i < buffer.length; i++) {
        const char = buffer[i];

        if (escape) {
          escape = false;
          continue;
        }

        if (char === '\\') {
          escape = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (char === '{') {
          if (depth === 0) {
            objStart = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && objStart !== -1) {
            const jsonStr = buffer.slice(objStart, i + 1);
            try {
              const obj = JSON.parse(jsonStr);
              if (obj && typeof obj.fala === 'string' && obj.fala.trim()) {
                const jaEmitida = etapasEmitidas.some(e => e.fala === obj.fala.trim());
                if (!jaEmitida) {
                  const novaEtapa: EtapaExplicacao = {
                    fala: obj.fala.trim(),
                    lousa: obj.lousa || null
                  };
                  etapasEmitidas.push(novaEtapa);
                  callback(novaEtapa);
                }
              }
            } catch {
              // Objeto com erro sintático parcial
            }
            objStart = -1;
          }
        } else if (char === ']' && depth === 0) {
          break;
        }
      }
    }
  }
}
