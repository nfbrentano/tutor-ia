import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callGeminiApi, cleanTextForSpeech, parseGeminiResponse } from '../src/gemini';

describe('Módulo Gemini - parseGeminiResponse e cleanTextForSpeech', () => {
  it('deve sanitizar formatações markdown para a fala', () => {
    const raw = 'A **fotossíntese** é um processo onde a planta usa *luz* e [água](https://exemplo.com) para produzir glicose! Veja `H2O`.';
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).toBe('A fotossíntese é um processo onde a planta usa luz e água para produzir glicose! Veja H2O.');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('https://');
  });

  it('deve fazer o parse correto de JSON puro', () => {
    const jsonStr = JSON.stringify({
      texto: 'O Brasil foi descoberto em 1500.',
      imagem_url: 'https://imagens.exemplo.com/caravela.jpg'
    });
    const parsed = parseGeminiResponse(jsonStr);
    expect(parsed.texto).toBe('O Brasil foi descoberto em 1500.');
    expect(parsed.imagem_url).toBe('https://imagens.exemplo.com/caravela.jpg');
  });

  it('deve remover delimitadores ```json e ``` antes de fazer o parse', () => {
    const fencedJson = '```json\n{"texto": "Triângulos têm 3 lados.", "imagem_url": "https://exemplo.com/triangulo.png"}\n```';
    const parsed = parseGeminiResponse(fencedJson);
    expect(parsed.texto).toBe('Triângulos têm 3 lados.');
    expect(parsed.imagem_url).toBe('https://exemplo.com/triangulo.png');
  });

  it('deve lidar com JSON inválido usando a resposta como texto puro', () => {
    const rawText = 'Explicação direta em texto que o modelo gerou sem JSON.';
    const parsed = parseGeminiResponse(rawText);
    expect(parsed.texto).toBe('Explicação direta em texto que o modelo gerou sem JSON.');
    expect(parsed.imagem_url).toBeNull();
  });

  it('deve ignorar imagem_url se não começar com http', () => {
    const jsonStr = JSON.stringify({
      texto: 'Explicação sobre vulcões.',
      imagem_url: 'nao-e-uma-url'
    });
    const parsed = parseGeminiResponse(jsonStr);
    expect(parsed.texto).toBe('Explicação sobre vulcões.');
    expect(parsed.imagem_url).toBeNull();
  });
});

describe('Módulo Gemini - Fallback de Modelos em callGeminiApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve chamar o modelo principal com sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ texto: 'Resposta do modelo principal', imagem_url: null }) }]
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await callGeminiApi('Qual a raiz quadrada de 9?', 'fake-key', ['model-primary', 'model-fallback']);
    expect(res.texto).toBe('Resposta do modelo principal');
    expect(res.modeloUsado).toBe('model-primary');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('deve acionar o modelo de fallback se o primeiro retornar erro 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Model not found' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ texto: 'Resposta do modelo fallback', imagem_url: null }) }]
              }
            }
          ]
        })
      });
    vi.stubGlobal('fetch', mockFetch);

    const res = await callGeminiApi('Explique a gravidade', 'fake-key', ['model-offline', 'model-fallback']);
    expect(res.texto).toBe('Resposta do modelo fallback');
    expect(res.modeloUsado).toBe('model-fallback');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('não deve fazer loop de fallback quando o erro for de API key inválida', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'API key not valid. Please pass a valid API key.' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      callGeminiApi('Pergunta', 'invalid-key', ['model-1', 'model-2', 'model-3'])
    ).rejects.toThrow('API key');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
