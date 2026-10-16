import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GESTOS_DISPONIVEIS, sortearProximoGesto } from '../src/avatar/gestos';
import { AvatarControlador } from '../src/avatar/index';
import { GestoTipo } from '../src/avatar/tipos';

describe('Avatar - Sorteio de Gestos Didáticos (RF06 / CT06 / CA07)', () => {
  it('deve retornar um gesto válido do repertório', () => {
    const gesto = sortearProximoGesto(null);
    expect(GESTOS_DISPONIVEIS).toContain(gesto);
  });

  it('nunca deve sortear o mesmo gesto duas vezes seguidas em 100 iterações consecutivas', () => {
    let anterior: GestoTipo | null = null;
    for (let i = 0; i < 100; i++) {
      const proximo = sortearProximoGesto(anterior);
      expect(GESTOS_DISPONIVEIS).toContain(proximo);
      if (anterior !== null) {
        expect(proximo).not.toBe(anterior);
      }
      anterior = proximo;
    }
  });
});

describe('Avatar - Controlador e Poses (RF05 / RF07 / CA06 / CA13)', () => {
  let moduloElement: HTMLElement;
  let statusTextElement: HTMLElement;
  let micBtnElement: HTMLElement;
  let micTipElement: HTMLElement;
  let controlador: AvatarControlador;

  beforeEach(() => {
    moduloElement = {
      className: '',
      classList: {
        classes: new Set<string>(),
        add(c: string) { this.classes.add(c); },
        remove(...cs: string[]) { cs.forEach(c => this.classes.delete(c)); },
        contains(c: string) { return this.classes.has(c); }
      },
      querySelector: vi.fn().mockReturnValue({
        style: {}
      })
    } as any;

    statusTextElement = { textContent: '' } as any;
    micBtnElement = {
      classList: {
        classes: new Set<string>(),
        add(c: string) { this.classes.add(c); },
        remove(c: string) { this.classes.delete(c); },
        contains(c: string) { return this.classes.has(c); }
      }
    } as any;
    micTipElement = { textContent: '' } as any;

    controlador = new AvatarControlador({
      moduloElemento: moduloElement,
      statusTextoElemento: statusTextElement,
      micBotaoElemento: micBtnElement,
      micDicaElemento: micTipElement
    });
  });

  it('deve inicializar no estado idle com braços relaxados e aguardando dúvida', () => {
    expect(controlador.obterEstado()).toBe('idle');
    expect(moduloElement.classList.contains('state-idle')).toBe(true);
    expect(statusTextElement.textContent).toBe('Aguardando sua dúvida');
  });

  it('deve transicionar suavemente para pose listening (ouvindo)', () => {
    controlador.definirEstado('listening');
    expect(controlador.obterEstado()).toBe('listening');
    expect(moduloElement.classList.contains('state-listening')).toBe(true);
    expect(micBtnElement.classList.contains('recording')).toBe(true);
  });

  it('deve transicionar para pose thinking (pensando / mão no queixo)', () => {
    controlador.definirEstado('thinking');
    expect(controlador.obterEstado()).toBe('thinking');
    expect(moduloElement.classList.contains('state-thinking')).toBe(true);
    expect(micBtnElement.classList.contains('recording')).toBe(false);
  });

  it('deve transicionar para speaking e aplicar gestos didáticos', () => {
    controlador.definirEstado('speaking');
    expect(controlador.obterEstado()).toBe('speaking');
    expect(moduloElement.classList.contains('state-speaking')).toBe(true);

    const temAlgumGesto = GESTOS_DISPONIVEIS.some(g =>
      moduloElement.classList.contains(`gesto-${g}`)
    );
    expect(temAlgumGesto).toBe(true);
  });

  it('ao parar a fala ou voltar para idle, deve remover gestos e fechar a boca (CA13)', () => {
    controlador.definirEstado('speaking');
    controlador.pararFala();

    GESTOS_DISPONIVEIS.forEach(g => {
      expect(moduloElement.classList.contains(`gesto-${g}`)).toBe(false);
    });
  });

  it('deve permitir apontar para a lousa de apoio visual (RF07 / CA08)', () => {
    controlador.apontarParaLousa(1000);
    expect(moduloElement.classList.contains('pose-apontando')).toBe(true);
  });
});
