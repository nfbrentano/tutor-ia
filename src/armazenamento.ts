/**
 * TUTORIA - Módulo de Armazenamento Local e Configurações
 * Garante que nenhuma chave sensível vá para o código nem para o APK (RNF04).
 */

export const STORAGE_KEYS = {
  API_KEY: 'gemini_api_key',
  SELECTED_VOICE_URI: 'tutoria_selected_voice_uri',
  SPEECH_RATE: 'tutoria_speech_rate'
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
    'Aja como um tutor escolar paciente, encorajador, acolhedor e didático para alunos do Ensino Fundamental e Médio. ' +
    'Responda apenas dúvidas de disciplinas escolares (como Matemática, Português, História, Geografia, Ciências, Física, Química, Biologia, Filosofia, etc). ' +
    'Use uma linguagem clara, acessível e pedagógica. ' +
    'Se o aluno fizer perguntas alheias aos estudos ou inadequadas, redirecione-o com muita gentileza de volta aos estudos. ' +
    'Retorne a resposta ESTRITAMENTE em formato JSON puro (sem marcações markdown extras fora do json, sem ```json, apenas o JSON válido): ' +
    '{"texto": "Sua explicação didática aqui...", "imagem_url": "URL direta de uma imagem ilustrativa real da web sobre o tema (deixe string vazia se não houver imagem aplicável)"}'
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
