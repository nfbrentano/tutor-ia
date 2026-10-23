/**
 * TUTORIA - Controlador de Espera Ativa (RF01 - RF07, CA01 - CA08, CA13, CA14)
 * Orquestra reação inicial, eco de tema, lousa de preparação, curiosidades e transição sem sobreposição.
 */

import { ControladorAvatar } from '../avatar/tipos';
import { LousaControlador } from '../lousa';
import { ServicoVoz } from '../voz/tipos';
import { CONFIG_ESPERA, ConfigEspera } from './config';
import { obterCuriosidade } from './curiosidades';
import { sortearFraseReacao } from './frases';
import { detectarTema, gerarFraseComEco, TemaDetectado } from './temas';

export interface EsperaCallbacks {
  avatar: ControladorAvatar;
  lousa: LousaControlador;
  servicoVoz: ServicoVoz;
  obterConfigVoz: () => { voiceUri?: string; rate?: number; pitch?: number };
}

export class ControladorEspera {
  private callbacks: EsperaCallbacks;
  private config: ConfigEspera;

  definirAvatar(novoAvatar: ControladorAvatar): void {
    this.callbacks.avatar = novoAvatar;
  }

  // Estado da espera atual
  private ativa = false;
  private perguntaAtual = '';
  private temaAtual: TemaDetectado | null = null;
  private curiosidadeFalada = false;
  private lousaPreparada = false;
  private estaFalandoReacao = false;

  // Timers
  private timerReacao: any = null;
  private timerLousa: any = null;
  private timerCuriosidade: any = null;
  private timerCorteFrase: any = null;

  // Histórico para evitar repetições consecutivas (CA02)
  private ultimaFraseReacao: string | null = null;
  private curiosidadesUsadas = new Set<string>();

  // Promessa de conclusão da fala de espera (para transição limpa RF07/CA08)
  private resolverFalaReacao: (() => void) | null = null;

  constructor(callbacks: EsperaCallbacks, config?: Partial<ConfigEspera>) {
    this.callbacks = callbacks;
    this.config = { ...CONFIG_ESPERA, ...config };
  }

  estaAtiva(): boolean {
    return this.ativa;
  }

  obterTemaAtual(): TemaDetectado | null {
    return this.temaAtual;
  }

  /**
   * Inicia o comportamento de espera ativa imediatamente ao enviar a pergunta (RF01, CA01, RNF01).
   */
  async iniciarEspera(pergunta: string): Promise<void> {
    this.cancelarEspera();

    this.ativa = true;
    this.perguntaAtual = pergunta;
    this.curiosidadeFalada = false;
    this.lousaPreparada = false;
    this.estaFalandoReacao = false;

    // 1. Avatar entra imediatamente em 'thinking' (≤ 500 ms) com gestos de espera (CA01, CA06)
    this.callbacks.avatar.definirEstado('thinking');

    // 2. Detecta tema da pergunta para eco (RF02, CA03)
    this.temaAtual = detectarTema(pergunta);

    const frase = this.temaAtual
      ? gerarFraseComEco(this.temaAtual.tema, this.ultimaFraseReacao)
      : sortearFraseReacao(this.ultimaFraseReacao);

    this.ultimaFraseReacao = frase;

    // 3. Agenda fala da reação apenas se a IA demorar para responder (estilo Alexa)
    this.timerReacao = setTimeout(async () => {
      if (!this.ativa) return;
      await this.falarFraseEspera(frase);
    }, this.config.tempoReacaoInicialMs);

    // 4. Temporizador de Lousa de Preparação (RF03, CA04: 1.5s)
    this.timerLousa = setTimeout(async () => {
      if (!this.ativa || this.lousaPreparada) return;
      this.lousaPreparada = true;

      const tituloLousa = this.temaAtual
        ? `Tema: ${this.temaAtual.tema}`
        : `Dúvida: ${this.resumirPergunta(this.perguntaAtual)}`;

      this.callbacks.lousa.limpar();
      await this.callbacks.lousa.adicionarItem({
        tipo: 'texto',
        conteudo: tituloLousa
      });
      this.callbacks.avatar.apontarParaLousa(1800);
    }, this.config.tempoLousaPreparacaoMs);

    // 5. Temporizador de Curiosidade de Espera (RF04, CA05: 4.0s)
    this.timerCuriosidade = setTimeout(async () => {
      if (!this.ativa || this.curiosidadeFalada) return;
      this.curiosidadeFalada = true;

      const curiosidade = obterCuriosidade(
        this.temaAtual ? this.temaAtual.materia : null,
        this.curiosidadesUsadas
      );
      this.curiosidadesUsadas.add(curiosidade);

      if (!this.estaFalandoReacao && this.ativa) {
        await this.falarFraseEspera(curiosidade);
      }
    }, this.config.tempoCuriosidadeMs);
  }

  private async falarFraseEspera(texto: string): Promise<void> {
    if (!this.ativa) return;

    this.estaFalandoReacao = true;
    const { voiceUri, rate, pitch } = this.callbacks.obterConfigVoz();

    const falaPromise = new Promise<void>((resolve) => {
      this.resolverFalaReacao = resolve;

      this.callbacks.servicoVoz.falar(
        texto,
        {
          onStart: () => {
            if (this.ativa) {
              this.callbacks.avatar.definirEstado('thinking');
            }
          },
          onBoundary: () => {
            if (this.ativa) {
              this.callbacks.avatar.notificarPalavraFalada();
            }
          },
          onEnd: () => {
            this.estaFalandoReacao = false;
            resolve();
          },
          onError: () => {
            this.estaFalandoReacao = false;
            resolve();
          }
        },
        { voiceUri, rate, pitch }
      );
    });

    await falaPromise;
    this.resolverFalaReacao = null;
  }

  /**
   * Chamado quando a primeira etapa da resposta chega (RF06, RF07, CA07, CA08).
   * Retorna uma Promise resolvida quando a passagem de vez estiver limpa para a explicação.
   */
  async notificarPrimeiraEtapaChegou(): Promise<void> {
    if (!this.ativa) return;

    // Cancela temporizadores pendentes de lousa e curiosidade
    if (this.timerLousa) {
      clearTimeout(this.timerLousa);
      this.timerLousa = null;
    }
    if (this.timerCuriosidade) {
      clearTimeout(this.timerCuriosidade);
      this.timerCuriosidade = null;
    }

    // Cancela temporizador de fala de espera se ainda não disparou
    if (this.timerReacao) {
      clearTimeout(this.timerReacao);
      this.timerReacao = null;
    }

    // Se não chegou a falar nenhuma frase de espera, transiciona imediatamente
    if (!this.estaFalandoReacao) {
      this.ativa = false;
      return;
    }

    // RF07 / CA08: Se o tutor está no meio de uma frase de espera, espera terminar (máx 1.5s)
    if (this.estaFalandoReacao) {
      await Promise.race([
        new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.estaFalandoReacao) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 50);
        }),
        new Promise<void>((resolve) => {
          this.timerCorteFrase = setTimeout(async () => {
            if (this.estaFalandoReacao) {
              await this.callbacks.servicoVoz.pararDeFalar();
              this.estaFalandoReacao = false;
              if (this.resolverFalaReacao) this.resolverFalaReacao();
            }
            resolve();
          }, this.config.tempoMaximoTransicaoFraseMs);
        })
      ]);
    }

    this.ativa = false;
  }

  /**
   * Notifica falha na API ou conexão (RF12, CA14).
   * Para imediatamente a espera sem lousa nem curiosidade pendentes.
   */
  notificarErro(): void {
    this.cancelarEspera();
  }

  /**
   * Cancela completamente qualquer espera ativa por clique ou nova pergunta (RF11, CA13).
   */
  cancelarEspera(): void {
    this.ativa = false;

    if (this.timerReacao) {
      clearTimeout(this.timerReacao);
      this.timerReacao = null;
    }
    if (this.timerLousa) {
      clearTimeout(this.timerLousa);
      this.timerLousa = null;
    }
    if (this.timerCuriosidade) {
      clearTimeout(this.timerCuriosidade);
      this.timerCuriosidade = null;
    }
    if (this.timerCorteFrase) {
      clearTimeout(this.timerCorteFrase);
      this.timerCorteFrase = null;
    }

    if (this.estaFalandoReacao) {
      this.callbacks.servicoVoz.pararDeFalar();
      this.estaFalandoReacao = false;
      if (this.resolverFalaReacao) this.resolverFalaReacao();
    }

    this.callbacks.avatar.pararCicloGestosEspera();
  }

  private resumirPergunta(pergunta: string): string {
    const limpo = pergunta.trim();
    if (limpo.length <= 40) return limpo;
    return `${limpo.slice(0, 37)}...`;
  }
}
