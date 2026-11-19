import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';

import {
  getStoredSerieEscolar,
  setStoredSerieEscolar
} from '../src/armazenamento';
import { AvatarControlador } from '../src/avatar';
import { CHAVE_CHAT_SESSAO, ChatGerenciador } from '../src/chat';
import { buscarTrechosRelevantes, TrechoLivro } from '../src/conhecimento';
import { construirIndiceInvertido } from '../src/conhecimento/indexador';
import {
  callGeminiApi,
  LIMITE_CARACTERES_HISTORICO,
  limparCacheModelos,
  montarHistoricoContents,
  TurnoHistorico
} from '../src/gemini';
import { converterQuadro } from '../src/gravador/conversor';
import { formatarResumoLousa, ItemLousa, LousaControlador, renderizarItemLousa } from '../src/lousa';
import { detectarMateria, obterPersonaPorMateria, PERSONAS, resolverPersona } from '../src/personas';

describe('Melhorias: Memória Multi-turno, Série Escolar, Chat Progressivo, Visual Persona, Gráficos e PWA', () => {
  beforeEach(() => {
    limparCacheModelos();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('CT01: callGeminiApi inclui até os últimos 5 turnos no histórico respeitando limite de 4.800 caracteres (CA01, RNF01)', async () => {
    const historicoLongo: TurnoHistorico[] = [];
    for (let i = 1; i <= 8; i++) {
      historicoLongo.push({
        role: 'user',
        texto: `Pergunta número ${i}: ` + 'x'.repeat(450),
        materia: 'ciencias'
      });
      historicoLongo.push({
        role: 'model',
        texto: `Resposta número ${i} sobre fotossíntese: ` + 'y'.repeat(500),
        materia: 'ciencias'
      });
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    materia: 'ciencias',
                    etapas: [{ fala: 'Ela acontece nos cloroplastos das folhas.', lousa: null }]
                  })
                }
              ]
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiApi('Onde ela acontece?', 'fake-key-123', {
      historico: historicoLongo,
      customModels: ['gemini-3.5-flash-lite']
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const contents = body.contents as Array<{ role: string; parts: Array<{ text?: string }> }>;

    // Último item deve ser sempre a pergunta atual intacta
    const ultimo = contents[contents.length - 1];
    expect(ultimo.role).toBe('user');
    expect(ultimo.parts[0].text).toBe('Onde ela acontece?');

    // Histórico anterior tem no máximo 10 mensagens (5 turnos) e <= 4.800 caracteres
    const historicoEnviado = contents.slice(0, -1);
    expect(historicoEnviado.length).toBeGreaterThan(0);
    expect(historicoEnviado.length).toBeLessThanOrEqual(10);

    const totalChars = historicoEnviado.reduce((acc, c) => acc + (c.parts[0].text?.length || 0), 0);
    expect(totalChars).toBeLessThanOrEqual(LIMITE_CARACTERES_HISTORICO);

    // Respostas do modelo enviam texto compacto sem lousa
    const primeiroModel = historicoEnviado.find((c) => c.role === 'model');
    expect(primeiroModel?.parts[0].text).toContain('textoCompleto');
    expect(primeiroModel?.parts[0].text).not.toContain('"itensLousa"');
    expect(montarHistoricoContents(historicoLongo).length).toBeLessThanOrEqual(10);
  });

  it('CT02: resolverPersona mantém Ada em pergunta de acompanhamento sem palavras-chave após Matemática (CA02)', () => {
    const ada = obterPersonaPorMateria('matematica')!;
    const materiaFollowUp = detectarMateria('Pode dar outro exemplo?');
    expect(materiaFollowUp).toBeNull();

    const resolvida = resolverPersona(materiaFollowUp, ada, '');
    expect(resolvida.id).toBe('ada');
  });

  it('CT03: ChatGerenciador persiste mensagens em sessionStorage, restaura ao recriar e limpa no Nova conversa (CA03)', () => {
    const container1 = document.createElement('div');
    const itensLousa: ItemLousa[] = [{ tipo: 'formula', conteudo: 'a^2 + b^2 = c^2' }];
    const chat1 = new ChatGerenciador(container1);

    chat1.adicionarMensagem('student', 'O que é Pitágoras?');
    chat1.adicionarMensagem('tutor', 'É a relação nos triângulos retângulos.', itensLousa, null, null, {
      materia: 'matematica',
      personaId: 'ada',
      personaNome: 'Ada'
    });

    expect(sessionStorage.getItem(CHAVE_CHAT_SESSAO)).toBeTruthy();

    // Recria instância simulando retorno de configuracoes.html
    const container2 = document.createElement('div');
    const chat2 = new ChatGerenciador(container2);
    expect(chat2.obterMensagens()).toHaveLength(2);
    expect(chat2.obterUltimaLousa()).toEqual(itensLousa);
    expect(container2.querySelectorAll('.chat-bubble')).toHaveLength(2);
    expect(chat2.obterHistoricoParaGemini()).toEqual([
      { role: 'user', texto: 'O que é Pitágoras?' },
      { role: 'model', texto: 'É a relação nos triângulos retângulos.', materia: 'matematica' }
    ]);

    // Limpar remove DOM e sessionStorage ("Nova conversa")
    chat2.limpar();
    expect(container2.innerHTML).toBe('');
    expect(chat2.obterMensagens()).toHaveLength(0);
    expect(sessionStorage.getItem(CHAVE_CHAT_SESSAO)).toBeNull();
  });

  it('CT04: iniciarMensagemProgressiva exibe etapas em tempo real no balão e anexa Ver na Lousa e Fontes ao final (CA04)', () => {
    const container = document.createElement('div');
    const onVerLousa = vi.fn();
    const onVerFonte = vi.fn();
    const chat = new ChatGerenciador(container, onVerLousa, undefined, onVerFonte);

    const controle = chat.iniciarMensagemProgressiva({ personaNome: 'Oswaldo', materia: 'ciencias' });
    expect(container.querySelectorAll('.chat-bubble.tutor')).toHaveLength(1);

    // Etapa 1 inicia
    controle.acrescentarEtapa('Primeira etapa da explicação.');
    expect(controle.elemento.querySelector('.bubble-text')?.textContent).toBe('Primeira etapa da explicação.');
    expect(controle.elemento.querySelector('.bubble-lousa-btn')).toBeNull();

    // Etapa 2 inicia
    controle.acrescentarEtapa('Segunda etapa nos cloroplastos.');
    expect(controle.elemento.querySelector('.bubble-text')?.textContent).toBe(
      'Primeira etapa da explicação. Segunda etapa nos cloroplastos.'
    );

    // Etapa 3 inicia e finaliza
    controle.acrescentarEtapa('Terceira etapa liberando oxigênio.');
    const itensLousa: ItemLousa[] = [{ tipo: 'formula', conteudo: '6 CO_2 + 6 H_2O \\to C_6H_{12}O_6 + 6 O_2' }];
    const fontes = [{ livroId: 'ciencias-6', tituloLivro: 'Ciências 6º Ano', pagina: 12 }];

    controle.finalizar({
      itensLousa,
      fontes
    });

    const btnLousa = controle.elemento.querySelector<HTMLButtonElement>('.bubble-lousa-btn');
    const btnFonte = controle.elemento.querySelector<HTMLButtonElement>('.bubble-fonte-btn');
    expect(btnLousa?.textContent).toContain('Ver na Lousa (1)');
    expect(btnFonte?.textContent).toContain('Ciências 6º Ano');

    btnLousa?.click();
    btnFonte?.click();
    expect(onVerLousa).toHaveBeenCalledWith(itensLousa);
    expect(onVerFonte).toHaveBeenCalledWith(fontes[0]);
  });

  it('CT05: série escolar aplica boost 1.25x no BM25 e adapta o prompt do Gemini (CA05, CA06)', async () => {
    setStoredSerieEscolar('6º ano EF');
    expect(getStoredSerieEscolar()).toBe('6º ano EF');

    const trechos: TrechoLivro[] = [
      {
        id: 't-2em',
        livroId: 'bio-2em',
        tituloLivro: 'Biologia Ensino Médio',
        disciplina: 'ciencias',
        serie: '2º ano EM',
        pagina: 40,
        texto: 'A fotossíntese ocorre nos cloroplastos das plantas utilizando luz solar e gás carbônico.'
      },
      {
        id: 't-6ef',
        livroId: 'cie-6ef',
        tituloLivro: 'Ciências 6º Ano',
        disciplina: 'ciencias',
        serie: '6º ano EF',
        pagina: 10,
        texto: 'A fotossíntese ocorre nos cloroplastos das plantas utilizando luz solar e gás carbônico.'
      },
      {
        id: 't-hist',
        livroId: 'hist-7ef',
        tituloLivro: 'História 7º Ano',
        disciplina: 'historia',
        serie: '7º ano EF',
        pagina: 12,
        texto: 'A Revolução Francesa começou em Paris em 1789 com a Queda da Bastilha.'
      },
      {
        id: 't-geo',
        livroId: 'geo-8ef',
        tituloLivro: 'Geografia 8º Ano',
        disciplina: 'geografia',
        serie: '8º ano EF',
        pagina: 18,
        texto: 'O clima tropical predomina na região centro-oeste e apresenta duas estações.'
      }
    ];

    const indice = construirIndiceInvertido(trechos, []);
    const resultados = buscarTrechosRelevantes('fotossíntese nas plantas cloroplastos', indice, {
      serie: '6º ano EF'
    });

    expect(resultados).toHaveLength(2);
    expect(resultados[0].trecho.id).toBe('t-6ef');
    expect(resultados[0].score / resultados[1].score).toBeCloseTo(1.25, 4);

    // Prompt enviado ao Gemini inclui série escolar escolhida
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ texto: 'Explicação para o 6º ano.' }) }] } }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    await callGeminiApi('O que é fotossíntese?', 'fake-key-123', {
      serieEscolar: getStoredSerieEscolar(),
      customModels: ['gemini-3.5-flash-lite']
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain('6º ano EF');
    expect(body.systemInstruction.parts[0].text).toContain('6º ano EF');
  });

  it('CT06: todas as personas possuem corTema/emblema e atualizam atributo e variável CSS no palco (CA07)', () => {
    const mod = document.createElement('div');
    const status = document.createElement('span');
    const avatar = new AvatarControlador({ moduloElemento: mod, statusTextoElemento: status });

    for (const p of PERSONAS) {
      expect(p.corTema).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.emblema.length).toBeGreaterThan(0);

      avatar.definirPersona(p);
      expect(mod.getAttribute('data-persona')).toBe(p.id);
      expect(mod.style.getPropertyValue('--persona-cor')).toBe(p.corTema);
    }

    avatar.destruir();
  });

  it('CT07: matriz facial 4x4 gira cabeça e pescoço no sentido esperado em converterQuadro (CA08)', () => {
    const pose: Array<{ x: number; y: number; z: number; visibility: number }> = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 1
    }));
    pose[11] = { x: 0.2, y: -0.5, z: 0, visibility: 1 };
    pose[12] = { x: -0.2, y: -0.5, z: 0, visibility: 1 };
    pose[13] = { x: 0.2, y: -0.2, z: 0, visibility: 1 };
    pose[14] = { x: -0.2, y: -0.2, z: 0, visibility: 1 };
    pose[15] = { x: 0.2, y: 0.1, z: 0, visibility: 1 };
    pose[16] = { x: -0.2, y: 0.1, z: 0, visibility: 1 };
    pose[23] = { x: 0.1, y: 0, z: 0, visibility: 1 };
    pose[24] = { x: -0.1, y: 0, z: 0, visibility: 1 };

    const yaw = THREE.MathUtils.degToRad(20);
    const matrizRosto = new THREE.Matrix4().makeRotationY(yaw).toArray();
    const res = converterQuadro(pose, pose, [], { matrizRosto });

    expect(res.rotacoes.neck).toBeDefined();
    expect(res.rotacoes.head).toBeDefined();
    const qTotal = new THREE.Quaternion(...res.rotacoes.neck!).multiply(new THREE.Quaternion(...res.rotacoes.head!));
    const euler = new THREE.Euler().setFromQuaternion(qTotal, 'YXZ');
    expect(euler.y).toBeCloseTo(yaw, 3);
  });

  it('CT08: renderizarItemLousa para grafico gera SVG cartesiano seguro ignorando NaN e escapando título XSS (CA09, RNF02)', () => {
    const el = renderizarItemLousa({
      tipo: 'grafico',
      conteudo: {
        titulo: 'Parábola <script>alert("xss")</script>',
        expressao: 'y = x^2',
        eixoX: 'x',
        eixoY: 'y',
        pontos: [
          { x: -2, y: 4 },
          { x: -1, y: 1 },
          { x: 0, y: 0 },
          { x: Number.NaN, y: 99 },
          { x: 1, y: 1 },
          { x: 2, y: 4 }
        ]
      }
    });

    expect(el).not.toBeNull();
    expect(el!.querySelector('svg.lousa-grafico-svg')).not.toBeNull();
    expect(el!.querySelector('path.grafico-curva')).not.toBeNull();
    // 5 pontos finitos válidos (NaN ignorado)
    expect(el!.querySelectorAll('circle.grafico-ponto')).toHaveLength(5);
    expect(el!.querySelector('script')).toBeNull();
    expect(el!.innerHTML).not.toContain('<script>');
    expect(el!.querySelector('.lousa-grafico-titulo')?.textContent).toContain('<script>alert("xss")</script>');
  });

  it('CT09: formatarResumoLousa e LousaControlador.exportarResumo geram resumo estruturado limpo (CA10)', async () => {
    const itens: ItemLousa[] = [
      { tipo: 'formula', conteudo: 'x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}' },
      { tipo: 'passos', conteudo: ['1. Calcular o delta', '2. Aplicar na fórmula de Bhaskara'] },
      { tipo: 'lista', conteudo: ['Concavidade para cima quando a > 0', 'Raízes reais quando Δ ≥ 0'] },
      {
        tipo: 'grafico',
        conteudo: {
          titulo: 'Parábola simples',
          expressao: 'y = x^2',
          pontos: [
            { x: -1, y: 1 },
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ]
        }
      }
    ];

    const resumo = formatarResumoLousa(itens, 'Função Quadrática');
    expect(resumo).toContain('# Função Quadrática');
    expect(resumo).toContain('**Fórmula:**');
    expect(resumo).toContain('1. Calcular o delta');
    expect(resumo).not.toContain('1. 1.');
    expect(resumo).toContain('- Concavidade para cima quando a > 0');
    expect(resumo).toContain('Parábola simples');
    expect(resumo).toContain('(-1, 1), (0, 0), (1, 1)');

    const painel = document.createElement('div');
    const corpo = document.createElement('div');
    const lousa = new LousaControlador({ painelElemento: painel, corpoElemento: corpo });
    await lousa.carregarItens(itens);
    expect(lousa.exportarResumo()).toContain('**Fórmula:**');
  });

  it('CT10 (estrutura PWA): sw.js, manifest.json e ícones PNG válidos 192x192 e 512x512 presentes (RF07, CA11)', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');
    const manifestPath = path.resolve(__dirname, '../public/manifest.json');
    const icon192Path = path.resolve(__dirname, '../public/icons/icon-192.png');
    const icon512Path = path.resolve(__dirname, '../public/icons/icon-512.png');

    expect(fs.existsSync(swPath)).toBe(true);
    const swCode = fs.readFileSync(swPath, 'utf8');
    expect(swCode).toContain('caches.open');
    expect(swCode).toContain('estrategiaNetworkFirst');
    expect(swCode).toContain('estrategiaCacheFirst');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png', src: './icons/icon-192.png' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png', src: './icons/icon-512.png' })
      ])
    );

    for (const [iconPath, expectedSize] of [
      [icon192Path, 192],
      [icon512Path, 512]
    ] as const) {
      const buf = fs.readFileSync(iconPath);
      expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
      expect(buf.readUInt32BE(16)).toBe(expectedSize);
      expect(buf.readUInt32BE(20)).toBe(expectedSize);
    }

    const pwaSrc = fs.readFileSync(path.resolve(__dirname, '../src/pwa.ts'), 'utf8');
    expect(pwaSrc).toContain('import.meta.env.DEV');
    expect(pwaSrc).toContain("./sw.js");
  });
});
