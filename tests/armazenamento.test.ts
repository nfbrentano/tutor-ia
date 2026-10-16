import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStoredApiKey,
  getStoredSpeechRate,
  getStoredVoiceUri,
  hasApiKey,
  removeStoredApiKey,
  setStoredApiKey,
  setStoredSpeechRate,
  setStoredVoiceUri
} from '../src/armazenamento';

describe('Módulo Armazenamento', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    });
  });

  it('deve armazenar e recuperar a chave da API do Gemini', () => {
    expect(hasApiKey()).toBe(false);
    expect(getStoredApiKey()).toBe('');

    setStoredApiKey('AIzaSy12345TestKey');
    expect(hasApiKey()).toBe(true);
    expect(getStoredApiKey()).toBe('AIzaSy12345TestKey');

    removeStoredApiKey();
    expect(hasApiKey()).toBe(false);
    expect(getStoredApiKey()).toBe('');
  });

  it('deve armazenar e recuperar preferências de voz e velocidade', () => {
    expect(getStoredSpeechRate()).toBe(1.05);

    setStoredSpeechRate(1.2);
    expect(getStoredSpeechRate()).toBe(1.2);

    expect(getStoredVoiceUri()).toBe('');
    setStoredVoiceUri('pt-br-voice-uri');
    expect(getStoredVoiceUri()).toBe('pt-br-voice-uri');
  });
});
