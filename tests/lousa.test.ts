import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseGeminiResponse } from '../src/gemini';
import {
  formatarFormula,
  ItemLousa,
  LousaControlador,
  renderizarItemLousa,
  sanitizarSvg
} from '../src/lousa';

describe('Lousa - Sanitização e Formatação', () => {
  it('CT04: deve formatar fórmulas com sobrescritos e subscritos', () => {
    expect(formatarFormula('x^2 + y^2 = r^2')).toBe('x<sup>2</sup> + y<sup>2</sup> = r<sup>2</sup>');
    expect(formatarFormula('H_2O + CO_2')).toBe('H<sub>2</sub>O + CO<sub>2</sub>');
    expect(formatarFormula('E = mc^2')).toBe('E = mc<sup>2</sup>');
    expect(formatarFormula('a_n = a_1 + (n - 1)r')).toBe('a<sub>n</sub> = a<sub>1</sub> + (n - 1)r');
  });

  it('CT08: deve sanitizar SVG contra XSS (script e onload) mantendo elementos válidos', () => {
    const svgMalicioso = `
      <svg viewBox="0 0 100 100">
        <script>alert("XSS")</script>
        <circle cx="50" cy="50" r="40" onload="alert('owned')" fill="#38bdf8" />
        <foreignObject width="100" height="100">
          <iframe src="evil.com"></iframe>
        </foreignObject>
        <a href="javascript:alert(1)"><line x1="0" y1="0" x2="10" y2="10" stroke="white" /></a>
      </svg>
    `;

    const svgLimpo = sanitizarSvg(svgMalicioso);

    expect(svgLimpo).not.toContain('<script');
    expect(svgLimpo).not.toContain('onload');
    expect(svgLimpo).not.toContain('foreignObject');
    expect(svgLimpo).not.toContain('javascript:');
    expect(svgLimpo).toContain('<circle');
    expect(svgLimpo).toContain('cx="50"');
  });
});

describe('Lousa - Renderização de Tipos de Item (RF03, RF06, CA04, CA08)', () => {
  it('deve renderizar item do tipo texto', () => {
    const item: ItemLousa = { tipo: 'texto', conteudo: 'Equação de 2º Grau' };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-texto');
    expect(el?.textContent).toBe('Equação de 2º Grau');
  });

  it('deve renderizar item do tipo formula com formatação', () => {
    const item: ItemLousa = { tipo: 'formula', conteudo: '2x^2 + 4x = 0' };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-formula');
    expect(el?.innerHTML).toContain('<sup>2</sup>');
  });

  it('deve renderizar item do tipo passos', () => {
    const item: ItemLousa = {
      tipo: 'passos',
      conteudo: ['Isole o x', 'Divida ambos os lados por 2', 'x = 2']
    };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-passos');
    const lis = el?.querySelectorAll('li');
    expect(lis?.length).toBe(3);
    expect(lis?.[0].querySelector('.passo-corpo')?.textContent).toBe('Isole o x');
    expect(lis?.[0].querySelector('.passo-numero')?.textContent).toBe('1');
  });

  it('deve renderizar item do tipo lista', () => {
    const item: ItemLousa = {
      tipo: 'lista',
      conteudo: ['Mercúrio', 'Vênus', 'Terra', 'Marte']
    };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-lista');
    const lis = el?.querySelectorAll('li');
    expect(lis?.length).toBe(4);
  });

  it('deve renderizar item do tipo tabela com container de scroll horizontal (RNF05)', () => {
    const item: ItemLousa = {
      tipo: 'tabela',
      conteudo: {
        colunas: ['Elemento', 'Símbolo', 'Nº Atômico'],
        linhas: [
          ['Hidrogênio', 'H', '1'],
          ['Hélio', 'He', '2']
        ]
      }
    };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-tabela');
    const ths = el?.querySelectorAll('th');
    expect(ths?.length).toBe(3);
    const tds = el?.querySelectorAll('td');
    expect(tds?.length).toBe(6);
  });

  it('deve renderizar item do tipo desenho com SVG seguro', () => {
    const item: ItemLousa = {
      tipo: 'desenho',
      conteudo: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="cyan"/></svg>',
      legenda: 'Círculo trigonométrico'
    };
    const el = renderizarItemLousa(item);
    expect(el).not.toBeNull();
    expect(el?.className).toContain('lousa-item-desenho');
    expect(el?.querySelector('svg')).not.toBeNull();
    expect(el?.querySelector('.lousa-item-legenda')?.textContent).toBe('Círculo trigonométrico');
  });
});

describe('Lousa - Parser de Resposta Estruturada (CT03, RF02, CA03, CA09)', () => {
  it('deve fazer o parse correto de resposta com etapas e lousa', () => {
    const jsonStr = JSON.stringify({
      etapas: [
        {
          fala: 'Primeiro, identificamos a equação.',
          lousa: { tipo: 'formula', conteudo: '2x + 3 = 7' }
        },
        {
          fala: 'Agora subtraímos 3 de ambos os lados.',
          lousa: { tipo: 'formula', conteudo: '2x = 4' }
        },
        {
          fala: 'Por fim, dividimos por 2.',
          lousa: { tipo: 'texto', conteudo: 'x = 2' }
        }
      ]
    });

    const resposta = parseGeminiResponse(jsonStr);
    expect(resposta.etapas.length).toBe(3);
    expect(resposta.itensLousa.length).toBe(3);
    expect(resposta.textoCompleto).toContain('Primeiro, identificamos a equação.');
    expect(resposta.textoCompleto).toContain('Por fim, dividimos por 2.');
    expect(resposta.itensLousa[0].tipo).toBe('formula');
    expect(resposta.itensLousa[2].conteudo).toBe('x = 2');
  });

  it('deve limitar a no máximo 8 etapas para manter a lousa sucinta (RNF06)', () => {
    const etapasExcesso = Array.from({ length: 12 }, (_, i) => ({
      fala: `Passo ${i + 1}`,
      lousa: { tipo: 'texto', conteudo: `Passo ${i + 1}` }
    }));
    const jsonStr = JSON.stringify({ etapas: etapasExcesso });
    const resposta = parseGeminiResponse(jsonStr);
    expect(resposta.etapas.length).toBe(8);
  });

  it('deve manter compatibilidade com formato legado { texto, imagem_url }', () => {
    const jsonStr = JSON.stringify({
      texto: 'Esta é a bandeira do Brasil.',
      imagem_url: 'https://upload.wikimedia.org/flag.png'
    });
    const resposta = parseGeminiResponse(jsonStr);
    expect(resposta.etapas.length).toBe(1);
    expect(resposta.etapas[0].fala).toBe('Esta é a bandeira do Brasil.');
    expect(resposta.itensLousa.length).toBe(1);
    expect(resposta.itensLousa[0].tipo).toBe('imagem');
  });
});

describe('LousaControlador - Ciclo de Vida e Eventos (RF01, RF09, RF10, CA13, CA14)', () => {
  let painel: HTMLElement;
  let corpo: HTMLElement;
  let btnFechar: HTMLButtonElement;
  let controlador: LousaControlador;

  beforeEach(() => {
    painel = document.createElement('div');
    corpo = document.createElement('div');
    btnFechar = document.createElement('button');

    controlador = new LousaControlador({
      painelElemento: painel,
      corpoElemento: corpo,
      btnFecharElemento: btnFechar
    });
  });

  it('deve iniciar fechada e abrir/fechar corretamente', () => {
    expect(controlador.estaAberta()).toBe(false);
    expect(painel.classList.contains('visible')).toBe(false);

    controlador.abrir();
    expect(controlador.estaAberta()).toBe(true);
    expect(painel.classList.contains('visible')).toBe(true);

    controlador.fechar();
    expect(controlador.estaAberta()).toBe(false);
    expect(painel.classList.contains('visible')).toBe(false);
  });

  it('deve fechar ao clicar no botão de fechar', () => {
    controlador.abrir();
    expect(controlador.estaAberta()).toBe(true);

    btnFechar.click();
    expect(controlador.estaAberta()).toBe(false);
  });

  it('CT12 / CA13: deve disparar evento lousa:item-exibido ao adicionar item', async () => {
    let eventoRecebido: any = null;
    const listener = (e: any) => {
      eventoRecebido = e.detail;
    };
    document.addEventListener('lousa:item-exibido', listener);

    await controlador.adicionarItem({
      tipo: 'texto',
      conteudo: 'Equação de 1º Grau'
    });

    expect(eventoRecebido).not.toBeNull();
    expect(eventoRecebido.item.conteudo).toBe('Equação de 1º Grau');
    expect(controlador.obterItensAtuais().length).toBe(1);
    expect(corpo.children.length).toBe(1);

    document.removeEventListener('lousa:item-exibido', listener);
  });

  it('CT13 / CA14: deve limpar os itens anteriores com limpar()', async () => {
    await controlador.adicionarItem({ tipo: 'texto', conteudo: 'Item 1' });
    await controlador.adicionarItem({ tipo: 'texto', conteudo: 'Item 2' });
    expect(corpo.children.length).toBe(2);

    controlador.limpar();
    expect(controlador.obterItensAtuais().length).toBe(0);
    expect(corpo.children.length).toBe(0);
  });

  it('CA12: deve carregar itens de uma resposta anterior com carregarItens', async () => {
    const itensAntigos: ItemLousa[] = [
      { tipo: 'formula', conteudo: 'x + 1 = 2' },
      { tipo: 'texto', conteudo: 'x = 1' }
    ];

    await controlador.carregarItens(itensAntigos);
    expect(controlador.estaAberta()).toBe(true);
    expect(controlador.obterItensAtuais().length).toBe(2);
    expect(corpo.children.length).toBe(2);
  });
});
