/**
 * TUTORIA - Módulo de Armazenamento Local e Configurações
 * Garante que nenhuma chave sensível vá para o código nem para o APK (RNF04).
 */

export const STORAGE_KEYS = {
  API_KEY: 'gemini_api_key',
  SELECTED_VOICE_URI: 'tutoria_selected_voice_uri',
  SPEECH_RATE: 'tutoria_speech_rate',
  DISABLED_BOOKS: 'tutoria_livros_desativados',
  AVATAR_MODE: 'tutoria_avatar_mode',
  PERSONA_FIXA: 'tutoria_persona_fixa'
} as const;

export type AvatarModoConfig = 'auto' | '3d' | '2d';

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
    'Aja como um tutor escolar inteligente, acolhedor e direto ao ponto, com tom conversacional natural como uma assistente de voz moderna (estilo Alexa). ' +
    'Responda exclusivamente dúvidas de matérias escolares para alunos do Ensino Fundamental e Médio. ' +
    'Explique com clareza e ritmo natural, sem enrolação. ' +
    'Divida sua resposta em etapas progressivas de raciocínio (entre 1 e 5 etapas). ' +
    'Para cada etapa, forneça uma fala completa, bem articulada e fluida ("fala") e, quando útil visualmente, um apoio na lousa ("lousa"). ' +
    'Tipos de lousa permitidos: ' +
    '- "formula": equações ou fórmulas matemáticas/químicas (ex: "2x + 3 = 7", "H_2O"). ' +
    '- "passos": passos numerados da resolução (array de strings). ' +
    '- "lista": tópicos ou resumo em tópicos (array de strings). ' +
    '- "tabela": dados organizados com {"cabecalho": ["..."], "linhas": [["..."]]}. ' +
    '- "imagem": termo de busca para a Wikimedia Commons com {"termo": "...", "legenda": "..."}. ' +
    '- "desenho": código SVG limpo direto para diagramas simples. ' +
    '- "texto": destaque conceitual ou título didático. ' +
    'Se uma etapa não precisar de apoio visual, defina "lousa": null. ' +
    'Você pode aparecer como um professor inspirado em uma pessoa histórica: nunca atribua a pessoas reais falas, opiniões ou citações inventadas. Só cite trechos reais, com o título da obra; se não tiver certeza da citação, diga que não tem. ' +
    'Classifique a matéria da pergunta no campo "materia" com um destes valores: "fisica_quimica", "matematica", "ciencias", "portugues", "geografia", "historia" ou "geral". ' +
    'Se forem fornecidos "Trechos do livro didático para consulta", explique a dúvida com base estritamente nesses trechos, use os termos do livro sem contradizê-los e preencha o campo "fontes": [{"livroId": "...", "pagina": X}]. Se nenhum trecho for fornecido, não invente fontes e omita o campo fontes. ' +
    'Retorne ESTRITAMENTE em formato JSON puro válido: ' +
    '{"materia": "matematica", "etapas": [{"fala": "...", "lousa": {"tipo": "formula", "conteudo": "..."}}], "fontes": [{"livroId": "...", "pagina": 1}]}'
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

export function getStoredAvatarMode(): AvatarModoConfig {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.AVATAR_MODE) as AvatarModoConfig | null;
    if (val === '3d' || val === '2d' || val === 'auto') {
      return val;
    }
    return 'auto';
  } catch {
    return 'auto';
  }
}

export function setStoredAvatarMode(mode: AvatarModoConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AVATAR_MODE, mode);
  } catch {}
}

/**
 * Persona fixada pelo aluno; vazio = automático por matéria (RF12 da spec de personas).
 */
export function getStoredPersonaFixa(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.PERSONA_FIXA) || '';
  } catch {
    return '';
  }
}

export function setStoredPersonaFixa(personaId: string): void {
  try {
    if (personaId) {
      localStorage.setItem(STORAGE_KEYS.PERSONA_FIXA, personaId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.PERSONA_FIXA);
    }
  } catch {}
}

