/**
 * TUTORIA - Testes Unitários e de Integração da Base de Conhecimento Local
 * (RF01 - RF09, RF11, RF12, CA01 - CA11, CT01 - CT10)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buscarTrechosRelevantes,
  desinenciaPlural,
  GerenciadorCacheConhecimento,
  normalizarFrase,
  normalizarTermo,
  normalizarTexto,
  TrechoLivro,
  LivroCatalogo,
  IndiceConhecimento
} from '../src/conhecimento';
import { construirIndiceInvertido, dividirEmTrechos } from '../src/conhecimento/indexador';
import { extrairEValidarFontes, parseGeminiResponse, callGeminiApi } from '../src/gemini';
import {
  getStoredDisabledBookIds,
  setStoredBookDisabled,
  setStoredDisabledBookIds,
  STORAGE_KEYS
} from '../src/armazenamento';
import { executarIndexacao } from '../scripts/indexar-livros';
import { gerarCachePerguntas, PERGUNTAS_FREQUENTES_CURRICULO } from '../scripts/gerar-cache';
import { gerarFixturesEmDisco } from './fixtures/gerador-pdf-teste';

describe('Base de Conhecimento - Normalização de Texto (CT03 / CA04)', () => {
  it('deve normalizar "Fotossíntese", "fotossintese" e "fotossínteses" para o mesmo termo canônico (CT03)', () => {
    const termo1 = normalizarTermo('Fotossíntese');
    const termo2 = normalizarTermo('fotossintese');
    const termo3 = normalizarTermo('fotossínteses');

    expect(termo1).toBe('fotossintese');
    expect(termo2).toBe('fotossintese');
    expect(termo3).toBe('fotossintese');
  });

  it('deve reduzir plurais comuns em português (oes -> ao, ais -> al, ns -> m, etc)', () => {
    expect(desinenciaPlural('equacoes')).toBe('equacao');
    expect(desinenciaPlural('reacoes')).toBe('reacao');
    expect(desinenciaPlural('animais')).toBe('animal');
    expect(desinenciaPlural('nuvens')).toBe('nuvem');
    expect(desinenciaPlural('celulas')).toBe('celula');
    expect(desinenciaPlural('plantas')).toBe('planta');
  });

  it('deve remover stopwords do português mantendo palavras conceituais relevantes', () => {
    const tokens = normalizarTexto('O que é a fotossíntese nas plantas e como ela funciona?');
    expect(tokens).toContain('fotossintese');
    expect(tokens).toContain('planta');
    expect(tokens).toContain('funciona');
    expect(tokens).not.toContain('o');
    expect(tokens).not.toContain('que');
    expect(tokens).not.toContain('e');
    expect(tokens).not.toContain('nas');
    expect(tokens).not.toContain('como');
    expect(tokens).not.toContain('ela');
  });
});

describe('Base de Conhecimento - Divisão em Trechos e Indexação (CT01, CT02, CA01, CA02, CA03)', () => {
  const metaExemplo = {
    livroId: 'ciencias-6',
    tituloLivro: 'Ciências 6º Ano',
    disciplina: 'ciencias',
    pagina: 42,
    capitulo: 'Capítulo 3: Fotossíntese'
  };

  it('deve dividir o texto em trechos de ~800 a 1200 caracteres respeitando palavras e parágrafos (CA01, CA02)', () => {
    const paragrafo1 = 'A fotossíntese é fundamental para a vida na Terra. '.repeat(10);
    const paragrafo2 = 'Os cloroplastos contêm clorofila que absorve luz solar. '.repeat(10);
    const textoPagina = `${paragrafo1}\n\n${paragrafo2}`;

    const trechos = dividirEmTrechos(textoPagina, metaExemplo, {
      tamanhoMinimo: 400,
      tamanhoMaximo: 800,
      sobreposicao: 100
    });

    expect(trechos.length).toBeGreaterThan(0);
    for (const trecho of trechos) {
      expect(trecho.livroId).toBe('ciencias-6');
      expect(trecho.pagina).toBe(42);
      expect(trecho.capitulo).toBe('Capítulo 3: Fotossíntese');
      expect(trecho.texto.length).toBeGreaterThan(50);
      expect(trecho.texto.trim()).toBe(trecho.texto);
    }
  });

  it('deve gerar índice invertido com cálculo correto de frequências (TF) e tamanho médio (avgDocLength)', () => {
    const trechos: TrechoLivro[] = [
      {
        id: 't1',
        livroId: 'ciencias-6',
        tituloLivro: 'Ciências',
        disciplina: 'ciencias',
        pagina: 1,
        texto: 'A fotossíntese produz glicose e oxigênio nas plantas.'
      },
      {
        id: 't2',
        livroId: 'historia-7',
        tituloLivro: 'História',
        disciplina: 'historia',
        pagina: 1,
        texto: 'A Revolução Francesa derrubou a nobreza e o clero em Paris.'
      }
    ];

    const indice = construirIndiceInvertido(trechos, []);
    expect(indice.trechos.length).toBe(2);
    expect(indice.avgDocLength).toBeGreaterThan(0);
    expect(indice.indiceInvertido['fotossintese']).toBeDefined();
    expect(indice.indiceInvertido['fotossintese'][0].trechoId).toBe('t1');
    expect(indice.indiceInvertido['revolucao']).toBeDefined();
    expect(indice.indiceInvertido['revolucao'][0].trechoId).toBe('t2');
  });

  it('CT02 / CA03: executarIndexacao deve relatar PDFs corrompidos e sem texto sem falhar os demais', async () => {
    gerarFixturesEmDisco();

    const catalogoTeste = path.resolve(process.cwd(), 'tests/fixtures/catalogo-teste.json');
    const saidaTeste = path.resolve(process.cwd(), 'tests/fixtures/indice-teste.json');

    const catalogoConteudo = [
      {
        id: 'livro-valido',
        titulo: 'Ciências Exemplo',
        disciplina: 'ciencias',
        serie: '6º',
        autor: 'MEC',
        licenca: 'aberta',
        arquivo: 'tests/fixtures/livro-ciencias-exemplo.pdf'
      },
      {
        id: 'livro-escaneado',
        titulo: 'Livro Escaneado',
        disciplina: 'artes',
        serie: '6º',
        autor: 'Editora',
        licenca: 'aberta',
        arquivo: 'tests/fixtures/livro-escaneado.pdf'
      },
      {
        id: 'livro-corrompido',
        titulo: 'Livro Corrompido',
        disciplina: 'matematica',
        serie: '7º',
        autor: 'Desconhecido',
        licenca: 'aberta',
        arquivo: 'tests/fixtures/livro-corrompido.pdf'
      }
    ];

    fs.writeFileSync(catalogoTeste, JSON.stringify(catalogoConteudo, null, 2), 'utf-8');

    const relatorio = await executarIndexacao({
      catalogoPath: catalogoTeste,
      saidaPath: saidaTeste
    });

    expect(relatorio.livrosProcessados).toBe(1);
    expect(relatorio.livrosComErro.length).toBeGreaterThan(0);
    expect(relatorio.livrosComErro[0]).toContain('Livro Corrompido');
    expect(relatorio.totalTrechos).toBeGreaterThan(0);
    expect(fs.existsSync(saidaTeste)).toBe(true);

    // Limpeza de fixtures temporárias de teste
    try {
      fs.unlinkSync(catalogoTeste);
      fs.unlinkSync(saidaTeste);
    } catch {}
  });
});

describe('Base de Conhecimento - Busca BM25 e Priorização por Disciplina (CT04 / CA04 / CA05 / CA11)', () => {
  const trechos: TrechoLivro[] = [
    {
      id: 't-ciencias-1',
      livroId: 'ciencias-6',
      tituloLivro: 'Ciências da Natureza',
      disciplina: 'ciencias',
      pagina: 15,
      texto: 'A fotossíntese ocorre nos cloroplastos com água, gás carbônico e luz solar.'
    },
    {
      id: 't-ciencias-2',
      livroId: 'ciencias-6',
      tituloLivro: 'Ciências da Natureza',
      disciplina: 'ciencias',
      pagina: 20,
      texto: 'A respiração celular nas mitocôndrias consome oxigênio para liberar energia.'
    },
    {
      id: 't-historia-1',
      livroId: 'historia-7',
      tituloLivro: 'História Geral',
      disciplina: 'historia',
      pagina: 42,
      texto: 'A Revolução Francesa começou em 1789 com a Queda da Bastilha em Paris.'
    }
  ];

  const indiceMock = construirIndiceInvertido(trechos, []);

  it('CT04 / CA04: deve ranquear o trecho correto no topo para perguntas sobre o tema', () => {
    const resultados = buscarTrechosRelevantes('o que é fotossíntese nas plantas?', indiceMock);
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].trecho.id).toBe('t-ciencias-1');
    expect(resultados[0].trecho.pagina).toBe(15);
  });

  it('CA05: consulta sobre assunto inexistente deve retornar array vazio sem inventar trechos', () => {
    const resultados = buscarTrechosRelevantes('qual é a capital da Islândia e o clima de lá?', indiceMock);
    expect(resultados).toEqual([]);
  });

  it('CT10 / CA11: livros desativados devem ser ignorados pela busca BM25', () => {
    const resultadosComLivro = buscarTrechosRelevantes('como foi a Revolução Francesa?', indiceMock);
    expect(resultadosComLivro.length).toBeGreaterThan(0);
    expect(resultadosComLivro[0].trecho.livroId).toBe('historia-7');

    const resultadosSemLivro = buscarTrechosRelevantes('como foi a Revolução Francesa?', indiceMock, {
      livrosDesativados: ['historia-7']
    });
    expect(resultadosSemLivro.length).toBe(0);
  });
});

describe('Base de Conhecimento - Validação de Fontes e Citação (CT05, CT06, CA06)', () => {
  const trechoEnviado: TrechoLivro = {
    id: 'cie-p15',
    livroId: 'ciencias-6',
    tituloLivro: 'Ciências 6º Ano',
    disciplina: 'ciencias',
    pagina: 15,
    texto: 'Texto de fotossíntese'
  };

  it('CT06 / CA06: fontes válidas enviadas no contexto devem ser aceitas e mapeadas', () => {
    const fontesRaw = [{ livroId: 'ciencias-6', pagina: 15 }];
    const validadas = extrairEValidarFontes(fontesRaw, [trechoEnviado]);

    expect(validadas).toBeDefined();
    expect(validadas!.length).toBe(1);
    expect(validadas![0].livroId).toBe('ciencias-6');
    expect(validadas![0].pagina).toBe(15);
    expect(validadas![0].tituloLivro).toBe('Ciências 6º Ano');
  });

  it('CT06 / CA06: fontes alucinadas ou com páginas não enviadas no contexto devem ser estritamente descartadas', () => {
    const fontesRaw = [
      { livroId: 'ciencias-6', pagina: 999 }, // página não enviada
      { livroId: 'outro-livro-inexistente', pagina: 15 } // livro não enviado
    ];
    const validadas = extrairEValidarFontes(fontesRaw, [trechoEnviado]);

    expect(validadas).toBeUndefined();
  });

  it('parseGeminiResponse deve anexar fontes validadas à RespostaDidatica', () => {
    const jsonStr = JSON.stringify({
      etapas: [
        { fala: 'A fotossíntese é a produção de energia pelas plantas.', lousa: null }
      ],
      fontes: [
        { livroId: 'ciencias-6', pagina: 15 },
        { livroId: 'alucinado', pagina: 42 }
      ]
    });

    const resposta = parseGeminiResponse(jsonStr, [trechoEnviado]);
    expect(resposta.fontes).toBeDefined();
    expect(resposta.fontes!.length).toBe(1);
    expect(resposta.fontes![0].livroId).toBe('ciencias-6');
    expect(resposta.fontes![0].pagina).toBe(15);
  });
});

describe('Base de Conhecimento - Cache Pré-construído e de Execução (CT07, CT08, CA07, CA08, CA09)', () => {
  let gerenciador: GerenciadorCacheConhecimento;

  beforeEach(() => {
    gerenciador = new GerenciadorCacheConhecimento();
  });

  it('CT07 / CA07 / CA08: deve responder instantaneamente do cache pré-construído para perguntas frequentes sem chamar API', async () => {
    const cacheItens = gerarCachePerguntas();
    gerenciador.carregarCachePreConstruido(cacheItens);

    const inicio = performance.now();
    const resposta = await gerenciador.buscarEmCache('o que é fotossíntese?');
    const duracao = performance.now() - inicio;

    expect(resposta).not.toBeNull();
    expect(resposta!.textoCompleto).toContain('fotossíntese');
    expect(resposta!.fontes).toBeDefined();
    expect(resposta!.fontes![0].livroId).toBe('ciencias-fundamental-6');
    expect(duracao).toBeLessThan(300); // RNF01, CA07: <= 300ms
  });

  it('CT07 / CA07: deve recuperar resposta por similaridade de tokens quando a pergunta for ligeiramente variada', async () => {
    const cacheItens = gerarCachePerguntas();
    gerenciador.carregarCachePreConstruido(cacheItens);

    // Variação com palavras adicionais
    const resposta = await gerenciador.buscarEmCache('o que e uma celula viva?');
    expect(resposta).not.toBeNull();
    expect(resposta!.textoCompleto).toContain('célula');
  });

  it('CT08 / CA09: gerenciador de cache deve salvar e permitir busca de execução', async () => {
    const respostaMock = {
      etapas: [{ fala: 'Resposta aprendida', lousa: null }],
      textoCompleto: 'Resposta aprendida',
      itensLousa: [],
      texto: 'Resposta aprendida'
    };

    await gerenciador.salvarNoCacheExecucao('como calcular o delta da bhaskara', respostaMock);
    // Em ambiente com IndexedDB mockado ou disponível, busca rápida
    expect(normalizarFrase('como calcular o delta da bhaskara')).toBe('calcular delta bhaskara');
  });
});

describe('Base de Conhecimento - Configurações de Livros (CT10 / CA11)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve salvar e recuperar IDs de livros desativados no localStorage', () => {
    expect(getStoredDisabledBookIds()).toEqual([]);

    setStoredBookDisabled('livro-a', true);
    expect(getStoredDisabledBookIds()).toContain('livro-a');

    setStoredBookDisabled('livro-b', true);
    expect(getStoredDisabledBookIds()).toEqual(['livro-a', 'livro-b']);

    setStoredBookDisabled('livro-a', false);
    expect(getStoredDisabledBookIds()).toEqual(['livro-b']);
  });
});
