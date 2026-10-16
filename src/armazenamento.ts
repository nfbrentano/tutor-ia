/**
 * TUTORIA - Módulo de Armazenamento Local e Configurações
 * Garante que nenhuma chave sensível vá para o código nem para o APK (RNF04).
 */

export const STORAGE_KEYS = {
  API_KEY: 'gemini_api_key',
  SELECTED_VOICE_URI: 'tutoria_selected_voice_uri',
  SPEECH_RATE: 'tutoria_speech_rate',
  DISABLED_BOOKS: 'tutoria_livros_desativados'
} as const;

export const CONFIG = {
  PRIMARY_MODEL: 'gemini-3.5-flash-lite',
  FALLBACK_MODELS: [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash'
  ],
  VOICE_LANG: 'pt-BR',
  SYSTEM_PROMPT:
    'Aja como um tutor escolar paciente, encorajador e didático para alunos do Ensino Fundamental e Médio. ' +
    'Responda exclusivamente dúvidas de matérias escolares. ' +
    'Divida sua resposta em etapas progressivas de raciocínio (máximo 6 etapas). ' +
    'Para cada etapa, forneça o texto falado acolhedor ("fala") e, quando relevante para o aprendizado visual, um recurso para a lousa ("lousa"). ' +
    'Tipos de lousa permitidos: ' +
    '- "formula": equações ou fórmulas matemáticas/químicas (ex: "2x + 3 = 7", "H_2O", "x^2 + y^2 = r^2"). ' +
    '- "passos": passos numerados da resolução (array de strings). ' +
    '- "lista": tópicos ou resumo em tópicos (array de strings). ' +
    '- "tabela": dados organizados com {"cabecalho": ["..."], "linhas": [["..."]]}. ' +
    '- "imagem": termo de busca para a Wikimedia Commons com {"termo": "...", "legenda": "..."}. ' +
    '- "desenho": código SVG limpo direto para diagramas simples (usando rect, circle, line, path, text). ' +
    '- "texto": destaque ou título didático. ' +
    'Se uma etapa não precisar de apoio visual, use "lousa": null. ' +
    'Se forem fornecidos "Trechos do livro didático para consulta", explique a dúvida com base estritamente nesses trechos, use os termos do livro sem contradizê-los e preencha o campo "fontes": [{"livroId": "...", "pagina": X}]. Se nenhum trecho for fornecido, não invente fontes e omita o campo fontes. ' +
    'Retorne ESTRITAMENTE em formato JSON puro válido: ' +
    '{"etapas": [{"fala": "...", "lousa": {"tipo": "formula", "conteudo": "..."}}], "fontes": [{"livroId": "...", "pagina": 1}]}'
};

export function getStoredApiKey(): string {
  try {
    return (localStorage.getItem(STORAGE_KEYS.API_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
}

export function removeStoredApiKey(): void {
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
}

export function hasApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

export function getStoredVoiceUri(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_VOICE_URI) || '';
  } catch {
    return '';
  }
}

export function setStoredVoiceUri(uri: string): void {
  localStorage.setItem(STORAGE_KEYS.SELECTED_VOICE_URI, uri);
}

export function getStoredSpeechRate(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.SPEECH_RATE);
    return val ? parseFloat(val) : 1.05;
  } catch {
    return 1.05;
  }
}

export function setStoredSpeechRate(rate: number): void {
  localStorage.setItem(STORAGE_KEYS.SPEECH_RATE, rate.toString());
}

export function getStoredDisabledBookIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISABLED_BOOKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStoredDisabledBookIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DISABLED_BOOKS, JSON.stringify(ids));
  } catch {}
}

export function setStoredBookDisabled(bookId: string, disabled: boolean): void {
  const current = new Set(getStoredDisabledBookIds());
  if (disabled) {
    current.add(bookId);
  } else {
    current.delete(bookId);
  }
  setStoredDisabledBookIds(Array.from(current));
}

