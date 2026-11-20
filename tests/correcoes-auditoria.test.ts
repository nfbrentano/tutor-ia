/**
 * Regressões da auditoria de erros (SDD/2026-11-20_correcoes-auditoria-de-erros.md)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GerenciadorCacheConhecimento, normalizarTexto, perguntaCobertaPeloCache } from '../src/conhecimento';
import { callGeminiApi, cleanTextForSpeech, cortarEmPalavra, montarHistoricoContents } from '../src/gemini';
import {
  buscarImagemWikimedia,
  formatarFormula,
  ItemLousa,
  LousaControlador,
  renderizarItemLousa,
  sanitizarSvg
} from '../src/lousa';
import { traduzirErroReconhecimento } from '../src/voz/nativo';
import { montarItensCache } from '../scripts/gerar-cache';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CA01: sanitização de SVG reconstrói só o que é permitido', () => {
  it('descarta instruções de processamento, comentários, CDATA, links e url() externos', () => {
    const saidas = [
      '<svg xmlns="http://www.w3.org/2000/svg"><?x ><img src=x onerror="alert(1)">?><circle cx="5" cy="5" r="3"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[<img src=x onerror="alert(1)">]]><rect width="2" height="2"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect style="fill:url(https://evil.example/x)" width="5" height="5"/><path d="M0 0" marker-end="url(#seta)"/></svg>'
    ].map(sanitizarSvg);

    for (const saida of saidas) {
      expect(saida).not.toMatch(/<img|onerror|onload|<\?|CDATA|evil\.example/i);
    }
    expect(saidas[2]).toContain('url(#seta)');

    // Desenho legítimo com comentário: o desenho fica, o comentário some
    const limpo = sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><!-- nota --><circle cx="5" cy="5" r="3"/><text>H₂O</text></svg>');
    expect(limpo).toContain('<circle');
    expect(limpo).toContain('H₂O');
    expect(limpo).not.toContain('nota');
  });
});

describe('CA02: item malformado da lousa não derruba a explicação', () => {
  it('formatarFormula aceita números e nulos', () => {
    expect(formatarFormula(5 as unknown as string)).toBe('5');
    expect(formatarFormula(null as unknown as string)).toBe('');
  });

  it('tabela com células numéricas é renderizada', () => {
    const el = renderizarItemLousa({
      tipo: 'tabela',
      conteudo: { cabecalho: ['x', 2], linhas: [[1, 2], [3, null]] }
    } as unknown as ItemLousa);
    expect(el?.querySelectorAll('td')).toHaveLength(4);
    expect(el?.querySelector('th:last-child')?.textContent).toBe('2');
  });

  it('imagem com conteúdo nulo é ignorada sem lançar erro', async () => {
    const lousa = new LousaControlador({ painelElemento: document.createElement('div'), corpoElemento: document.createElement('div') });
    await expect(lousa.adicionarItem({ tipo: 'imagem', conteudo: null } as unknown as ItemLousa)).resolves.toBeNull();
  });

  it('CA03: imagem que chega depois de limpar() não entra na lousa nova', async () => {
    let liberar: (v: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(r => { liberar = r; }))
    );
    const corpo = document.createElement('div');
    const lousa = new LousaControlador({ painelElemento: document.createElement('div'), corpoElemento: corpo });
    const pendente = lousa.adicionarItem({ tipo: 'imagem', conteudo: 'sistema solar' } as ItemLousa);
    lousa.limpar();
    liberar({
      ok: true,
      json: async () => ({
        query: { pages: { '1': { index: 1, imageinfo: [{ mime: 'image/png', thumburl: 'https://upload.wikimedia.org/a.png' }] } } }
      })
    });
    await expect(pendente).resolves.toBeNull();
    expect(lousa.obterItensAtuais()).toHaveLength(0);
    expect(corpo.children).toHaveLength(0);
  });
});

describe('CA04: cache não responde perguntas diferentes que só compartilham o tema', () => {
  it('exige que os termos da pergunta estejam na pergunta em cache', () => {
    expect(perguntaCobertaPeloCache(normalizarTexto('o que é uma célula viva?'), normalizarTexto('o que é uma célula?'))).toBe(true);
    expect(
      perguntaCobertaPeloCache(normalizarTexto('Diferença entre célula animal e vegetal'), normalizarTexto('o que é uma célula?'))
    ).toBe(false);
  });

  it('buscarEmCache não devolve "o que é fotossíntese" para uma pergunta sobre a noite', async () => {
    const g = new GerenciadorCacheConhecimento();
    g.carregarCachePreConstruido(montarItensCache());
    expect(await g.buscarEmCache('Por que a fotossíntese não acontece à noite?')).toBeNull();
    expect(await g.buscarEmCache('Diferença entre célula animal e vegetal')).toBeNull();
    expect(await g.buscarEmCache('o que é fotossíntese?')).not.toBeNull();
  });
});

describe('CA05: histórico enviado ao Gemini preserva as perguntas do aluno', () => {
  it('corta a resposta longa do modelo, não a pergunta, e sem partir palavras', () => {
    const resposta = 'palavra '.repeat(900).trim();
    const contents = montarHistoricoContents(
      [
        { role: 'user', texto: 'O que é fotossíntese?' },
        { role: 'model', texto: resposta }
      ],
      10,
      1200
    );
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'O que é fotossíntese?' }] });
    // O turno do modelo continua JSON válido depois do corte
    const modelo = JSON.parse((contents[1].parts[0] as { text: string }).text);
    expect(modelo.textoCompleto.endsWith('…')).toBe(true);
    const total = contents.reduce((n, c) => n + ('text' in c.parts[0] ? c.parts[0].text.length : 0), 0);
    expect(total).toBeLessThanOrEqual(1200);
  });

  it('cortarEmPalavra termina em palavra inteira com reticências', () => {
    expect(cortarEmPalavra('o rato roeu a roupa do rei', 14)).toBe('o rato roeu…');
    expect(cortarEmPalavra('curto', 10)).toBe('curto');
  });
});

describe('CA06: chamada ao Gemini', () => {
  it('envia a chave no cabeçalho x-goog-api-key, nunca na URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"texto":"ok"}' }] } }] })
    });
    vi.stubGlobal('fetch', mockFetch);
    await callGeminiApi('Pergunta', 'chave-secreta', ['modelo-a']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).not.toContain('chave-secreta');
    expect(String(url)).not.toContain('key=');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'chave-secreta' });
  });

  it('não repete em outros modelos quando a requisição é inválida (400)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Imagem inválida' } })
    });
    vi.stubGlobal('fetch', mockFetch);
    await expect(callGeminiApi('Pergunta', 'k', ['m1', 'm2', 'm3'])).rejects.toThrow('Imagem inválida');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resposta vazia vem marcada como incompleta (não vai para o cache)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '   ' }] } }] }) })
    );
    const resposta = await callGeminiApi('Pergunta', 'k', ['m1']);
    expect(resposta.completa).toBe(false);
  });
});

describe('CA07: valores em reais são lidos e exibidos corretamente', () => {
  it('preserva R$ na fala e na lousa, mas remove delimitadores LaTeX', () => {
    expect(cleanTextForSpeech('Custa R$ 12,50')).toContain('R$');
    expect(formatarFormula('R$ 3,00 e $x^2$')).toBe('R$ 3,00 e x<sup>2</sup>');
  });
});

describe('CA08: imagens da Wikimedia', () => {
  it('busca só arquivos (namespace 6) e fica com o primeiro que é imagem', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            '9': { index: 2, imageinfo: [{ mime: 'image/png', thumburl: 'https://thumb.wikimedia.org/b.png' }] },
            '5': { index: 1, imageinfo: [{ mime: 'application/pdf', url: 'https://upload.wikimedia.org/a.pdf' }] }
          }
        }
      })
    });
    vi.stubGlobal('fetch', mockFetch);
    const img = await buscarImagemWikimedia('sistema solar');
    expect(String(mockFetch.mock.calls[0][0])).toContain('gsrnamespace=6');
    expect(img?.urlReal).toBe('https://thumb.wikimedia.org/b.png');
  });

  it('recusa URLs fora do CDN da Wikimedia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ query: { pages: { '1': { index: 1, imageinfo: [{ mime: 'image/png', url: 'https://evil.example/x.png' }] } } } })
      })
    );
    expect(await buscarImagemWikimedia('x')).toBeNull();
  });
});

describe('CA09: voz no Android', () => {
  it('traduz erros do reconhecedor para mensagens em português', () => {
    expect(traduzirErroReconhecimento('No match')).toMatch(/Nenhuma fala/);
    expect(traduzirErroReconhecimento('Network error')).toMatch(/conexão/);
    expect(traduzirErroReconhecimento(undefined)).toMatch(/Falha/);
  });
});
