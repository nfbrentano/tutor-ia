/**
 * TUTORIA - Controlador do Avatar do Tutor
 * Gerencia os estados visuais ('idle' | 'listening' | 'thinking' | 'speaking')
 * e sincroniza animações dos olhos, boca e halos.
 */

export type AvatarEstado = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface AvatarElementos {
  moduloElemento: HTMLElement | null;
  statusTextoElemento: HTMLElement | null;
  micBotaoElemento?: HTMLElement | null;
  micDicaElemento?: HTMLElement | null;
}

export class AvatarControlador {
  private estadoAtual: AvatarEstado = 'idle';
  private elementos: AvatarElementos;

  constructor(elementos: AvatarElementos) {
    this.elementos = elementos;
    this.definirEstado('idle');
  }

  obterEstado(): AvatarEstado {
    return this.estadoAtual;
  }

  definirEstado(novoEstado: AvatarEstado, mensagemCustomizada: string | null = null): void {
    this.estadoAtual = novoEstado;

    const { moduloElemento, statusTextoElemento, micBotaoElemento, micDicaElemento } = this.elementos;

    if (moduloElemento) {
      moduloElemento.className = '';
      moduloElemento.classList.add(`state-${novoEstado}`);
    }

    const rotulosPadrao: Record<AvatarEstado, string> = {
      idle: 'Aguardando sua dúvida',
      listening: 'Ouvindo sua pergunta...',
      thinking: 'Consultando material didático...',
      speaking: 'Explicando...'
    };

    if (statusTextoElemento) {
      statusTextoElemento.textContent = mensagemCustomizada || rotulosPadrao[novoEstado];
    }

    if (micBotaoElemento) {
      if (novoEstado === 'listening') {
        micBotaoElemento.classList.add('recording');
      } else {
        micBotaoElemento.classList.remove('recording');
      }
    }

    if (micDicaElemento) {
      if (novoEstado === 'listening') {
        micDicaElemento.textContent = 'Gravando... Fale claramente!';
      } else if (novoEstado === 'thinking') {
        micDicaElemento.textContent = 'Pensando na melhor explicação...';
      } else if (novoEstado === 'speaking') {
        micDicaElemento.textContent = 'Tutor respondendo... Toque para interromper.';
      } else {
        micDicaElemento.textContent = 'Clique no microfone para perguntar';
      }
    }
  }

  atualizarMensagem(mensagem: string): void {
    if (this.elementos.statusTextoElemento) {
      this.elementos.statusTextoElemento.textContent = mensagem;
    }
  }
}
