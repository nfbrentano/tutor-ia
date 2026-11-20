/**
 * TUTORIA - Módulo de Integração com o Google Gemini
 * Suporta resposta estruturada por etapas didáticas, lousa, streaming SSE e modelo lembrado.
 * (RF02, RF08, RF09, RF10, RF11, CA09, CA10, CA11, CA12, CA13)
 */

import { CONFIG } from './armazenamento';
import { DesafioQuiz, EtapaExplicacao, ItemLousa, RespostaDidatica } from './lousa/tipos';
import { TrechoLivro } from './conhecimento/tipos';

export * from './lousa/tipos';
export type GeminiResponse = RespostaDidatica;

export type ModoPedagogico = 'completo' | 'dica';

export interface ImagemPergunta {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
  dataUrl?: string;
}

export const FORMATOS_IMAGEM_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TAMANHO_MAX_ARQUIVO_BYTES = 10 * 1024 * 1024;
export const DIMENSAO_MAX_IMAGEM_PX = 1280;
export const TAMANHO_MAX_BASE64_BYTES = Math.floor(1.5 * 1024 * 1024);

export const MAX_TURNOS_HISTORICO = 5;
export const MAX_MENSAGENS_HISTORICO = MAX_TURNOS_HISTORICO * 2;
export const LIMITE_CARACTERES_HISTORICO = 4800;

export interface TurnoHistorico {
  role: 'user' | 'model';
  texto: string;
  materia?: string;
}

export interface ContentGemini {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

/** Corta o texto em até `limite` caracteres sem partir palavras, terminando com reticências. */
export function cortarEmPalavra(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  if (limite <= 1) return '';
  const corte = texto.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(' ');
  const base = ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte;
  return base.trimEnd() + '…';
}

/**
 * Monta o histórico multi-turno compacto para `contents`, mantendo até os últimos
 * 5 turnos (10 mensagens) dentro do orçamento de 4.800 caracteres (~1.200 tokens) (RF01, RNF01, CT01).
 */
export function montarHistoricoContents(
  historico?: TurnoHistorico[],
  maxMensagens = MAX_MENSAGENS_HISTORICO,
  maxChars = LIMITE_CARACTERES_HISTORICO
): ContentGemini[] {
  if (!Array.isArray(historico) || historico.length === 0) {
    return [];
  }

  // Normaliza apenas entradas válidas e limita às últimas `maxMensagens`
  const recentes = historico
    .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.texto === 'string' && h.texto.trim())
    .slice(-maxMensagens);

  if (recentes.length === 0) return [];

  // Compacta respostas do modelo enviando apenas materia e textoCompleto (sem JSON de lousa).
  // O texto bruto fica guardado para que um corte por orçamento refaça o JSON, em vez de
  // partir o JSON já montado (que viraria JSON inválido no histórico)
  const dadosModelo = new Map<ContentGemini, { materia?: string; texto: string }>();
  const formatarModelo = (d: { materia?: string; texto: string }) =>
    JSON.stringify({ ...(d.materia ? { materia: d.materia } : {}), textoCompleto: d.texto });

  const formatados: ContentGemini[] = recentes.map((item) => {
    if (item.role === 'model') {
      const dados = { materia: item.materia, texto: item.texto.trim() };
      const conteudo: ContentGemini = { role: 'model', parts: [{ text: formatarModelo(dados) }] };
      dadosModelo.set(conteudo, dados);
      return conteudo;
    }
    return { role: item.role, parts: [{ text: item.texto.trim() }] };
  });

  // Garante alternância válida começando em 'user' e terminando em 'model' (pois a pergunta atual será 'user')
  while (formatados.length > 0 && formatados[0].role !== 'user') {
    formatados.shift();
  }
  while (formatados.length > 0 && formatados[formatados.length - 1].role === 'user') {
    formatados.pop();
  }

  const tamanhoTotal = (lista: ContentGemini[]) =>
    lista.reduce((acc, c) => acc + c.parts.reduce((s, p) => s + ('text' in p ? p.text.length : 0), 0), 0);

  // Remove turnos mais antigos (pares user+model quando possível) até caber no orçamento
  while (tamanhoTotal(formatados) > maxChars && formatados.length > 2) {
    if (formatados[0].role === 'user' && formatados[1]?.role === 'model') {
      formatados.splice(0, 2);
    } else {
      formatados.shift();
    }
  }

  // Ainda acima do orçamento: encurta primeiro as respostas do modelo (as mais longas) e só depois
  // as perguntas, sem nunca esvaziar uma pergunta do aluno e sempre em limite de palavra
  let excesso = tamanhoTotal(formatados) - maxChars;
  if (excesso > 0) {
    const ordem = formatados
      .map((entry, indice) => ({ entry, indice }))
      .sort((x, y) => {
        if (x.entry.role !== y.entry.role) return x.entry.role === 'model' ? -1 : 1;
        const tx = x.entry.parts[0] && 'text' in x.entry.parts[0] ? x.entry.parts[0].text.length : 0;
        const ty = y.entry.parts[0] && 'text' in y.entry.parts[0] ? y.entry.parts[0].text.length : 0;
        return ty - tx;
      });
    for (const { entry } of ordem) {
      if (excesso <= 0) break;
      const part = entry.parts[0];
      if (!part || !('text' in part)) continue;
      const antes = part.text.length;
      const dados = dadosModelo.get(entry);

      if (dados) {
        const minimo = Math.min(dados.texto.length, 60);
        const alvo = Math.max(minimo, dados.texto.length - excesso);
        if (alvo >= dados.texto.length) continue;
        dados.texto = cortarEmPalavra(dados.texto, alvo);
        part.text = formatarModelo(dados);
        // O escape do JSON pode deixar o turno um pouco maior que o corte do texto: ajusta
        while (part.text.length > antes - excesso && dados.texto.length > minimo) {
          dados.texto = cortarEmPalavra(dados.texto, Math.max(minimo, dados.texto.length - 10));
          part.text = formatarModelo(dados);
        }
      } else {
        const minimo = Math.min(part.text.length, 120);
        const remover = Math.min(excesso, part.text.length - minimo);
        if (remover <= 0) continue;
        part.text = cortarEmPalavra(part.text, antes - remover);
      }
      excesso -= antes - part.text.length;
    }
  }

  return formatados.filter((e) => {
    const p = e.parts[0];
    return p && 'text' in p && p.text.length > 0;
  });
}

export const INSTRUCAO_MODO_DICA =
  '[MODO DICA SOCRÁTICA ATIVO]: O aluno escolheu aprender passo a passo sem receber a resposta pronta. ' +
  'NÃO entregue o resultado final nem a resolução completa nesta resposta. ' +
  'Explique apenas o conceito inicial e o primeiro passo do raciocínio, mostre na lousa só o 1º passo, dê uma pista construtiva e termine com uma pergunta orientadora para o aluno tentar descobrir o próximo passo sozinho.';

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
  } catch { }
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
  } catch { }
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
  } catch { }
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
  } catch { }

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
 * Remove formatações markdown, comandos LaTeX e referências textuais antes da síntese de voz (RF04, CA06).
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  let limpo = text
    .replace(/```[\s\S]*?```/g, '') // Blocos de código
    .replace(/`([^`]+)`/g, '$1') // Código inline
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links markdown
    .replace(/https?:\/\/\S+/g, ''); // URLs

  // Remove delimitadores LaTeX e modificadores de tamanho
  limpo = limpo
    .replace(/(?<![A-Z])\$\$?/g, '') // preserva "R$" e "US$"
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, '')
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, '$1');

  // Frações e raízes em leitura natural
  for (let i = 0; i < 2; i++) {
    limpo = limpo.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 sobre $2');
  }
  limpo = limpo
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, 'raiz $1 de $2')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'raiz quadrada de $1');

  // Setas, operadores e comparações matemáticas/químicas
  limpo = limpo
    .replace(/\\(?:to|rightarrow|longrightarrow)(?![a-zA-Z])/g, ' gera ')
    .replace(/\\(?:leftarrow|longleftarrow)(?![a-zA-Z])/g, ' vem de ')
    .replace(/\\(?:leftrightarrow|rightleftharpoons)(?![a-zA-Z])/g, ' em equilíbrio com ')
    .replace(/\s*->\s*/g, ' gera ')
    .replace(/→/g, ' gera ')
    .replace(/\\(?:times|cdot)(?![a-zA-Z])/g, ' vezes ')
    .replace(/\\div(?![a-zA-Z])/g, ' dividido por ')
    .replace(/\\pm(?![a-zA-Z])/g, ' mais ou menos ')
    .replace(/\\(?:neq|ne)(?![a-zA-Z])/g, ' diferente de ')
    .replace(/\\(?:leq|le)(?![a-zA-Z])/g, ' menor ou igual a ')
    .replace(/\\(?:geq|ge)(?![a-zA-Z])/g, ' maior ou igual a ')
    .replace(/\\approx(?![a-zA-Z])/g, ' aproximadamente ')
    .replace(/\\pi(?![a-zA-Z])/g, ' pi ')
    .replace(/\\Delta(?![a-zA-Z])/g, ' delta ');

  // Subscritos (ex.: H_2O -> H2O, C_6H_{12}O_6 -> C6H12O6) e sobrescritos (ex.: x^2 -> x ao quadrado)
  limpo = limpo
    .replace(/_\{([^{}]+)\}/g, '$1')
    .replace(/_([0-9a-zA-Z]+)/g, '$1')
    .replace(/\^\{?2\}?(?![0-9a-zA-Z])/g, ' ao quadrado')
    .replace(/\^\{?3\}?(?![0-9a-zA-Z])/g, ' ao cubo')
    .replace(/\^\{([^{}]+)\}/g, ' elevado a $1')
    .replace(/\^([0-9a-zA-Z]+)/g, ' elevado a $1');

  // Remove comandos LaTeX residuais, chaves e caracteres markdown
  return limpo
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/[*_#~>]/g, '')
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
 * Extrai o campo "materia" da resposta (RF13 da spec de personas), mesmo de JSON incompleto.
 */
export function extrairMateria(rawText: string): string | undefined {
  const match = /"materia"\s*:\s*"([^"]{1,40})"/.exec(rawText || '');
  return match ? match[1].trim() : undefined;
}

/**
 * Extrai e valida o campo opcional "desafio" (RF01, CT01).
 */
export function extrairEValidarDesafio(desafioRaw: any): DesafioQuiz | null {
  if (!desafioRaw || typeof desafioRaw !== 'object') return null;

  const pergunta = typeof desafioRaw.pergunta === 'string' ? desafioRaw.pergunta.trim() : '';
  if (!pergunta) return null;

  if (!Array.isArray(desafioRaw.opcoes)) return null;
  const opcoes = desafioRaw.opcoes
    .map((o: any) => (typeof o === 'string' ? o.trim() : String(o ?? '').trim()))
    .filter(Boolean);
  if (opcoes.length < 2) return null;

  const corretaNum = Number(desafioRaw.correta);
  if (!Number.isInteger(corretaNum) || corretaNum < 0 || corretaNum >= opcoes.length) {
    return null;
  }

  const dica = typeof desafioRaw.dica === 'string' && desafioRaw.dica.trim()
    ? desafioRaw.dica.trim()
    : 'Releia os passos na lousa e tente novamente.';

  const explicacao = typeof desafioRaw.explicacao === 'string' && desafioRaw.explicacao.trim()
    ? desafioRaw.explicacao.trim()
    : `A alternativa correta é "${opcoes[corretaNum]}".`;

  return {
    pergunta,
    opcoes,
    correta: corretaNum,
    dica,
    explicacao
  };
}

function limparFencesJson(raw: string): string {
  return (raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export interface ResultadoValidacaoImagem {
  valido: boolean;
  mimeType?: ImagemPergunta['mimeType'];
  erro?: string;
}

/**
 * Valida formato e tamanho de um arquivo de imagem antes do redimensionamento (RF04, RNF02, CA07, CT06).
 */
export function validarArquivoImagem(
  arquivo: { type?: string; size?: number; name?: string } | null | undefined
): ResultadoValidacaoImagem {
  if (!arquivo) {
    return { valido: false, erro: 'Nenhum arquivo de imagem selecionado.' };
  }

  let mime = (arquivo.type || '').trim().toLowerCase();
  if (!mime && arquivo.name) {
    const lowerName = arquivo.name.toLowerCase();
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lowerName.endsWith('.png')) mime = 'image/png';
    else if (lowerName.endsWith('.webp')) mime = 'image/webp';
  }

  if (!FORMATOS_IMAGEM_ACEITOS.includes(mime as ImagemPergunta['mimeType'])) {
    return {
      valido: false,
      erro: 'Formato não suportado. Escolha uma foto ou imagem JPG, PNG ou WebP.'
    };
  }

  const size = typeof arquivo.size === 'number' ? arquivo.size : 0;
  if (size <= 0) {
    return {
      valido: false,
      erro: 'O arquivo de imagem está vazio ou corrompido.'
    };
  }

  if (size > TAMANHO_MAX_ARQUIVO_BYTES) {
    return {
      valido: false,
      erro: 'A imagem é muito grande (máximo de 10 MB). Tente outra foto.'
    };
  }

  return { valido: true, mimeType: mime as ImagemPergunta['mimeType'] };
}

/**
 * Calcula dimensões proporcionais respeitando o limite no maior lado (RNF02, CA06).
 */
export function calcularDimensoesRedimensionadas(
  largura: number,
  altura: number,
  maxLado = DIMENSAO_MAX_IMAGEM_PX
): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) {
    return { largura: maxLado, altura: maxLado };
  }
  const maiorLado = Math.max(largura, altura);
  if (maiorLado <= maxLado) {
    return { largura: Math.round(largura), altura: Math.round(altura) };
  }
  const escala = maxLado / maiorLado;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala))
  };
}

function arrayBufferParaBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function blobParaBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    return arrayBufferParaBase64(buffer);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(blob);
  });
}

async function redimensionarViaCanvas(
  blob: Blob,
  maxLado: number,
  qualidadeInicial: number
): Promise<ImagemPergunta | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;

  let fonte: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl = '';
  try {
    let larguraOrig = 0;
    let alturaOrig = 0;

    if (typeof createImageBitmap === 'function') {
      fonte = await createImageBitmap(blob);
      larguraOrig = fonte.width;
      alturaOrig = fonte.height;
    } else if (typeof Image !== 'undefined' && typeof URL?.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imageEl = new Image();
        const timer = setTimeout(() => reject(new Error('Timeout ao decodificar imagem')), 1500);
        imageEl.onload = () => {
          clearTimeout(timer);
          resolve(imageEl);
        };
        imageEl.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Imagem inválida ou corrompida'));
        };
        imageEl.src = objectUrl;
      });
      fonte = img;
      larguraOrig = img.naturalWidth || img.width;
      alturaOrig = img.naturalHeight || img.height;
    }

    if (!fonte || larguraOrig <= 0 || alturaOrig <= 0) {
      return null;
    }

    const { largura, altura } = calcularDimensoesRedimensionadas(larguraOrig, alturaOrig, maxLado);
    canvas.width = largura;
    canvas.height = altura;
    ctx.drawImage(fonte, 0, 0, largura, altura);

    let dataUrl = '';
    let base64 = '';
    for (const q of [qualidadeInicial, 0.65, 0.5]) {
      dataUrl = canvas.toDataURL('image/jpeg', q);
      base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      if (base64.length <= TAMANHO_MAX_BASE64_BYTES) break;
    }

    if (!base64) return null;
    return {
      mimeType: 'image/jpeg',
      data: base64,
      dataUrl
    };
  } catch {
    return null;
  } finally {
    if (objectUrl && typeof URL?.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
    if (fonte && 'close' in fonte && typeof (fonte as ImageBitmap).close === 'function') {
      (fonte as ImageBitmap).close();
    }
  }
}

/**
 * Valida, redimensiona (máx. 1280px, JPEG 0,8) e codifica a imagem em memória para envio multimodal (RF04, RNF01, RNF02, CT05, CT06).
 */
export async function prepararImagemParaEnvio(
  arquivo: Blob & { name?: string },
  opcoes?: { maxLado?: number; qualidade?: number }
): Promise<ImagemPergunta> {
  const validacao = validarArquivoImagem(arquivo);
  if (!validacao.valido || !validacao.mimeType) {
    throw new Error(validacao.erro || 'Arquivo de imagem inválido.');
  }

  const maxLado = opcoes?.maxLado ?? DIMENSAO_MAX_IMAGEM_PX;
  const qualidade = opcoes?.qualidade ?? 0.8;

  const redimensionada = await redimensionarViaCanvas(arquivo, maxLado, qualidade);
  if (redimensionada) {
    if (redimensionada.data.length > TAMANHO_MAX_BASE64_BYTES) {
      throw new Error('Mesmo após reduzir a resolução, a imagem ultrapassou 1,5 MB. Tente recortar apenas o exercício.');
    }
    return redimensionada;
  }

  // Fallback seguro para ambientes sem decodificador gráfico de canvas (ex: happy-dom em testes unitários)
  const base64Direto = await blobParaBase64(arquivo);
  if (!base64Direto) {
    throw new Error('Não foi possível ler os dados da imagem selecionada.');
  }
  if (base64Direto.length > TAMANHO_MAX_BASE64_BYTES) {
    throw new Error('A imagem codificada excede o limite de 1,5 MB para envio.');
  }

  return {
    mimeType: validacao.mimeType,
    data: base64Direto,
    dataUrl: `data:${validacao.mimeType};base64,${base64Direto}`
  };
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
    imagem_url: null,
    completa: false
  };

  if (!rawText || !rawText.trim()) {
    return respostaPadraoVazia;
  }

  // Remove delimitadores markdown ```json ... ``` se existirem
  const cleaned = limparFencesJson(rawText);

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
    const desafio = extrairEValidarDesafio(parsed.desafio);
    const materia = typeof parsed.materia === 'string' && parsed.materia.trim()
      ? parsed.materia.trim()
      : undefined;

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
        fontes,
        materia,
        ...(desafio ? { desafio } : {})
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
        fontes,
        materia,
        ...(desafio ? { desafio } : {})
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
        fontes,
        materia,
        ...(desafio ? { desafio } : {})
      };
    }

    // Fallback para JSON genérico
    return {
      etapas: [{ fala: cleaned, lousa: null }],
      textoCompleto: cleaned,
      itensLousa: [],
      texto: cleaned,
      imagem_url: null,
      fontes,
      materia,
      ...(desafio ? { desafio } : {})
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
  modoPedagogico?: ModoPedagogico;
  imagem?: ImagemPergunta;
  historico?: TurnoHistorico[];
  serieEscolar?: string;
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
  let textoPromptFinal = (questionText || '').trim();
  if (!textoPromptFinal && opcoes.imagem) {
    textoPromptFinal = 'Analise a imagem deste exercício escolar e ajude o aluno a compreender e resolver.';
  }

  if (opcoes.trechosContexto && opcoes.trechosContexto.length > 0) {
    const trechosFormatados = opcoes.trechosContexto.map((t, idx) => {
      return `[Trecho ${idx + 1}] Livro: "${t.tituloLivro}" (ID: ${t.livroId}), Página ${t.pagina}:\n"${t.texto}"`;
    }).join('\n\n');

    // Limite de ~1500 tokens / ~6000 caracteres para os trechos de referência (RF05)
    const trechosTruncados = trechosFormatados.length > 6000
      ? trechosFormatados.slice(0, 6000) + '...'
      : trechosFormatados;

    textoPromptFinal = `${textoPromptFinal}\n\n--- Trechos do livro didático para consulta ---\n${trechosTruncados}\n-----------------------------------------------`;
  }

  // Adaptação por Série Escolar (RF04a, CA05) e Modo Socrático (RF03, CA05, CT04)
  let systemPromptFinal = CONFIG.SYSTEM_PROMPT;
  const serieLimpa = (opcoes.serieEscolar || '').trim();
  if (serieLimpa) {
    const instrucaoSerie =
      `[NÍVEL ESCOLAR DO ALUNO: ${serieLimpa}]: Adapte a linguagem, o nível de profundidade e os exemplos para um estudante do ${serieLimpa}.`;
    textoPromptFinal = `${textoPromptFinal}\n\n${instrucaoSerie}`;
    systemPromptFinal = `${systemPromptFinal}\n${instrucaoSerie}`;
  }

  if (opcoes.modoPedagogico === 'dica') {
    textoPromptFinal = `${textoPromptFinal}\n\n${INSTRUCAO_MODO_DICA}`;
    systemPromptFinal = `${systemPromptFinal}\n${INSTRUCAO_MODO_DICA}`;
  }

  const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: textoPromptFinal }
  ];

  // Payload multimodal com imagem inlineData em memória (RF04, RNF01, CA06, CT05)
  if (opcoes.imagem && opcoes.imagem.data && opcoes.imagem.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: opcoes.imagem.mimeType,
        data: opcoes.imagem.data
      }
    });
  }

  const historicoContents = montarHistoricoContents(opcoes.historico);

  const payload = {
    contents: [
      ...historicoContents,
      {
        role: 'user',
        parts: userParts
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPromptFinal }]
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

      const method = querStreaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`;

      // A chave vai no cabeçalho, não na URL: URLs aparecem em logs, DevTools/HAR e proxies
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': trimmedKey },
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

        // Requisição inválida ou chave sem permissão: repetir em outro modelo só gasta cota e tempo
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          (lastError as Error & { naoRepetir?: boolean }).naoRepetir = true;
        }
        throw lastError;
      }

      // SUCESSO: Registra o modelo como lembrado para as próximas requisições (RF10, CA12)
      registrarModeloSucesso(model);

      // 1. Processamento via streaming SSE (RF08, CA09, CA10)
      if (querStreaming && response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const decoder = new TextDecoder();
        const rawBufferState = {
          cursorNdjson: 0,
          cursorArrayEtapas: 0,
          objetosProcessadosNoArray: 0
        };
        let rawBuffer = '';
        let sseLineBuffer = '';
        const etapasEmitidas: EtapaExplicacao[] = [];
        let streamInterrompido = false;

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
                    processarBufferIncremental(rawBuffer, etapasEmitidas, opcoes.onEtapaRecebida, rawBufferState);
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
          streamInterrompido = true;
        }

        // Fim do stream: se emitiu etapas incrementais, retorna a resposta completa
        if (etapasEmitidas.length > 0) {
          const falas = etapasEmitidas.map(e => e.fala).filter(Boolean);
          const textoCompleto = falas.join(' ');
          const itensLousa = etapasEmitidas.map(e => e.lousa).filter((it): it is ItemLousa => it !== null);

          let fontesValidadas: any = undefined;
          let desafioValidado: DesafioQuiz | null = null;
          try {
            const parsedBuffer = JSON.parse(limparFencesJson(rawBuffer));
            fontesValidadas = extrairEValidarFontes(parsedBuffer.fontes, opcoes.trechosContexto);
            desafioValidado = extrairEValidarDesafio(parsedBuffer.desafio);
          } catch { }

          return {
            etapas: etapasEmitidas,
            textoCompleto,
            itensLousa,
            modeloUsado: model,
            texto: textoCompleto,
            imagem_url: null,
            fontes: fontesValidadas,
            materia: extrairMateria(rawBuffer),
            completa: !streamInterrompido,
            ...(desafioValidado ? { desafio: desafioValidado } : {})
          };
        }

        // Fallback do streaming (RF09, CA11): se não emitiu linha a linha, processa o texto acumulado
        const parsedFinal = parseGeminiResponse(rawBuffer, opcoes.trechosContexto);
        if (opcoes.onEtapaRecebida) {
          parsedFinal.etapas.forEach(e => opcoes.onEtapaRecebida!(e));
        }
        return {
          ...parsedFinal,
          modeloUsado: model,
          materia: extrairMateria(rawBuffer),
          completa: parsedFinal.completa !== false && !streamInterrompido
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
        modeloUsado: model,
        materia: extrairMateria(rawContent)
      };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (
        (lastError as Error & { naoRepetir?: boolean }).naoRepetir ||
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

export interface EstadoParserIncremental {
  cursorNdjson: number;
  cursorArrayEtapas: number;
  objetosProcessadosNoArray: number;
}

const MAX_ETAPAS_EXPLICACAO = 8;

/**
 * Extrai etapas completas do buffer acumulado conforme chegam durante o streaming (RF06, RF08, CA08, CA09, CA10).
 * Usa cursores incrementais no estado para não reprocessar etapas já entregues a cada chunk SSE.
 */
  export function processarBufferIncremental(
    buffer: string,
    etapasEmitidas: EtapaExplicacao[],
  callback?: (etapa: EtapaExplicacao) => void,
    estado?: EstadoParserIncremental
  ): void {
  if (!callback || etapasEmitidas.length >= MAX_ETAPAS_EXPLICACAO) return;

      // 1. Parser incremental no array "etapas": [ ... ]
      const matchEtapas = /"etapas"\s*:\s*\[/.exec(buffer);
      if (matchEtapas) {
        const startIndex = matchEtapas.index + matchEtapas[0].length - 1;
        const inicioVarredura = Math.max(startIndex + 1, estado?.cursorArrayEtapas ?? 0);
        let depth = 0;
        let inString = false;
        let escape = false;
        let objStart = -1;
        let indiceObjeto = estado ? estado.objetosProcessadosNoArray : 0;

          for (let i = inicioVarredura; i < buffer.length; i++) {
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
                      const deveProcessar = estado ? true : indiceObjeto >= etapasEmitidas.length;
                      indiceObjeto++;
                      if (estado) {
                        estado.cursorArrayEtapas = i + 1;
                        estado.objetosProcessadosNoArray = indiceObjeto;
                      }
                      if (deveProcessar && etapasEmitidas.length < MAX_ETAPAS_EXPLICACAO) {
                        const jsonStr = buffer.slice(objStart, i + 1);
                        try {
                          const obj = JSON.parse(jsonStr);
                          if (obj && typeof obj.fala === 'string' && obj.fala.trim()) {
                            const novaEtapa: EtapaExplicacao = {
                              fala: obj.fala.trim(),
                              lousa: obj.lousa || null
                            };
                            etapasEmitidas.push(novaEtapa);
                            callback(novaEtapa);
                          }
                        } catch {
                          // Objeto com erro sintático parcial
                        }
                      }
                      objStart = -1;
                      if (etapasEmitidas.length >= MAX_ETAPAS_EXPLICACAO) break;
                    }
                  } else if (char === ']' && depth === 0) {
                    if (estado) {
                      estado.cursorArrayEtapas = i + 1;
                    }
                    break;
                  }
                }
    return;
              }

              // 2. Fallback para formato NDJSON (uma etapa por linha) enquanto não houver chave "etapas"
              let cursor = estado?.cursorNdjson ?? 0;
              let novaLinhaIdx = buffer.indexOf('\n', cursor);
              while (novaLinhaIdx !== -1 && etapasEmitidas.length < MAX_ETAPAS_EXPLICACAO) {
                const line = buffer.slice(cursor, novaLinhaIdx).trim().replace(/^,|,$/g, '');
                cursor = novaLinhaIdx + 1;
                if (estado) estado.cursorNdjson = cursor;

                if (line) {
                  try {
                    const obj = JSON.parse(line);
                    if (obj && typeof obj.fala === 'string' && obj.fala.trim()) {
                      const novaEtapa: EtapaExplicacao = {
                        fala: obj.fala.trim(),
                        lousa: obj.lousa || null
                      };
                      etapasEmitidas.push(novaEtapa);
                      callback(novaEtapa);
                    }
                  } catch {
                    // Linha parcial ou cabeçalho não-etapa
                  }
                }
                novaLinhaIdx = buffer.indexOf('\n', cursor);
              }
            }
