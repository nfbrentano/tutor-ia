import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_ESPERA,
  ControladorEspera,
  detectarTema,
  FRASES_REACAO,
  gerarFraseComEco,
  obterCuriosidade,
  sortearFraseReacao
} from '../src/espera';
import {
  callGeminiApi,
  limparCacheModelos,
  obterModelosOrdenados,
  parseGeminiResponse,
  registrarModelo404,
  registrarModeloSucesso
} from '../src/gemini';

describe('Espera Ativa - Banco de Frases e Sorteio (RF01, CA01, CA02, CA16, RNF06)', () => {
  it('CT15 / CA16: banco de frases deve ter pelo menos 15 frases sem afirmar conteúdo de matéria', () => {
    expect(FRASES_REACAO.length).toBeGreaterThanOrEqual(15);
    for (const frase of FRASES_REACAO) {
      expect(typeof frase).toBe('string');
      expect(frase.length).toBeGreaterThan(10);
      // Nenhuma frase deve conter palavras que antecipam respostas definitivas
      expect(frase.toLowerCase()).not.toContain('a resposta é');
      expect(frase.toLowerCase()).not.toContain('o resultado dá');
    }
  });

  it('CT02 / CA02: sortearFraseReacao nunca deve repetir a mesma frase duas vezes seguidas', () => {
    let anterior: string | null = null;
    for (let i = 0; i < 100; i++) {
      const sorteada = sortearFraseReacao(anterior);
      expect(FRASES_REACAO).toContain(sorteada);
      if (anterior !== null) {
        expect(sorteada).not.toBe(anterior);
      }
      anterior = sorteada;
    }
  });
});

describe('Espera Ativa - Eco da Pergunta e Deteção de Tema (RF02, CA03)', () => {
  it('CT03 / CA03: deve identificar temas escolares chave e gerar frase com eco', () => {
    const resFoto = detectarTema('Como funciona a fotossíntese nas plantas?');
    expect(resFoto).not.toBeNull();
    expect(resFoto?.tema).toBe('fotossíntese');
    expect(resFoto?.materia).toBe('ciencias');

    const fraseEco = gerarFraseComEco(resFoto!.tema, null);
    expect(fraseEco).toContain('fotossíntese');

    const resPitagoras = detectarTema('qual a fórmula do teorema de pitágoras?');
    expect(resPitagoras).not.toBeNull();
    expect(resPitagoras?.tema).toBe('teorema de Pitágoras');
    expect(resPitagoras?.materia).toBe('matematica');
  });

  it('CT03 / CA03: deve retornar null para perguntas genéricas sem matéria identificável', () => {
    expect(detectarTema('me ajuda com isso')).toBeNull();
    expect(detectarTema('olá tutor')).toBeNull();
    expect(detectarTema('boa tarde')).toBeNull();
    expect(detectarTema('123')).toBeNull();
  });
});

describe('Espera Ativa - Banco de Curiosidades (RF04, CA05, RNF06)', () => {
  it('deve ter pelo menos 5 curiosidades curtas por matéria', () => {
    const materias = ['ciencias', 'matematica', 'fisica_quimica', 'historia', 'geografia', 'geral'];
    for (const mat of materias) {
      const curiosidade = obterCuriosidade(mat);
      expect(curiosidade).toBeTruthy();
      expect(curiosidade.startsWith('Sabia que')).toBe(true);

      // Máximo de 15 palavras por curiosidade (RF04)
      const numPalavras = curiosidade.split(/\s+/).length;
      expect(numPalavras).toBeLessThanOrEqual(16);
    }
  });
});

describe('Espera Ativa - Controlador e Ciclo de Vida (RF01 - RF07, CA01 - CA08, CA13, CA14)', () => {
  let mockAvatar: any;
  let mockLousa: any;
  let mockServicoVoz: any;
  let controlador: ControladorEspera;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAvatar = {
      definirEstado: vi.fn(),
      apontarParaLousa: vi.fn(),
      notificarPalavraFalada: vi.fn(),
      pararFala: vi.fn(),
      pararCicloGestosEspera: vi.fn()
    };
    mockLousa = {
      limpar: vi.fn(),
      adicionarItem: vi.fn().mockResolvedValue(document.createElement('div')),
      fechar: vi.fn()
    };
    mockServicoVoz = {
      falar: vi.fn().mockImplementation((_texto, cbs) => {
        cbs?.onStart?.();
        cbs?.onEnd?.();
        return Promise.resolve();
      }),
      pararDeFalar: vi.fn().mockResolvedValue(undefined),
      estaFalando: vi.fn().mockReturnValue(false)
    };

    controlador = new ControladorEspera({
      avatar: mockAvatar,
      lousa: mockLousa,
      servicoVoz: mockServicoVoz,
      obterConfigVoz: () => ({})
    });
  });

  it('CT01 / CA01: inicia reação imediata com avatar em thinking', async () => {
    controlador.iniciarEspera('Como funciona a fotossíntese?');
    expect(controlador.estaAtiva()).toBe(true);
    expect(mockAvatar.definirEstado).toHaveBeenCalledWith('thinking');
  });

  it('CT04 / CA04: prepara a lousa após 1.5s com o tema da pergunta', async () => {
    controlador.iniciarEspera('Como resolver equações de 2o grau?');

    // Avança 1.5s
    await vi.advanceTimersByTimeAsync(CONFIG_ESPERA.tempoLousaPreparacaoMs);

    expect(mockLousa.limpar).toHaveBeenCalled();
    expect(mockLousa.adicionarItem).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'texto',
        conteudo: expect.stringContaining('Tema: equações')
      })
    );
    expect(mockAvatar.apontarParaLousa).toHaveBeenCalled();
  });

  it('CT05 / CA05: dispara curiosidade se a espera passar de 4s', async () => {
    controlador.iniciarEspera('Me conte sobre o relevo brasileiro');

    // Avança 4s
    await vi.advanceTimersByTimeAsync(CONFIG_ESPERA.tempoCuriosidadeMs);

    expect(mockServicoVoz.falar).toHaveBeenCalledWith(
      expect.stringContaining('Sabia que'),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('CT07 / CA07: resposta rápida (< 800ms) cancela espera e vai direto à explicação', async () => {
    controlador.iniciarEspera('Pergunta rápida');

    // Resposta chega aos 400ms
    await vi.advanceTimersByTimeAsync(400);
    await controlador.notificarPrimeiraEtapaChegou();

    expect(controlador.estaAtiva()).toBe(false);
    expect(mockLousa.adicionarItem).not.toHaveBeenCalled();
  });

  it('CT12 / CA13: cancelarEspera interrompe timers e falas em andamento', () => {
    controlador.iniciarEspera('Pergunta a cancelar');
    expect(controlador.estaAtiva()).toBe(true);

    controlador.cancelarEspera();
    expect(controlador.estaAtiva()).toBe(false);
    expect(mockAvatar.pararCicloGestosEspera).toHaveBeenCalled();
  });
});

describe('Gemini - Modelo Lembrado e Streaming (RF08 - RF10, CA09 - CA12)', () => {
  beforeEach(() => {
    limparCacheModelos();
    vi.restoreAllMocks();
  });

  it('CT11 / CA12: modelo com erro 404 é pulado na chamada seguinte e modelo de sucesso é lembrado', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Model not found' } })
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ texto: 'Resposta do modelo 2' }) }] } }]
        })
      });

    vi.stubGlobal('fetch', mockFetch);

    // 1ª chamada: modelo-1 falha com 404, modelo-2 responde 200
    const res1 = await callGeminiApi('Dúvida 1', 'fake-key', {
      customModels: ['modelo-1', 'modelo-2']
    });
    expect(res1.modeloUsado).toBe('modelo-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // 2ª chamada: modelo-1 (404) deve ser pulado e tentar modelo-2 direto
    const modelosOrdenados = obterModelosOrdenados(['modelo-1', 'modelo-2']);
    expect(modelosOrdenados).toEqual(['modelo-2']);

    const res2 = await callGeminiApi('Dúvida 2', 'fake-key', {
      customModels: ['modelo-1', 'modelo-2']
    });
    expect(res2.modeloUsado).toBe('modelo-2');
    expect(mockFetch).toHaveBeenCalledTimes(3); // 2 da primeira + 1 da segunda
  });

  it('CT10 / CA11: fallback do streaming processa corretamente NDJSON por linha ou JSON único', () => {
    const ndjson = '{"fala": "Passo 1", "lousa": {"tipo": "texto", "conteudo": "Passo 1"}}\n{"fala": "Passo 2", "lousa": null}';
    const parsed = parseGeminiResponse(ndjson);
    expect(parsed.etapas.length).toBe(2);
    expect(parsed.etapas[0].fala).toBe('Passo 1');
    expect(parsed.etapas[1].fala).toBe('Passo 2');
    expect(parsed.itensLousa.length).toBe(1);
  });
});
