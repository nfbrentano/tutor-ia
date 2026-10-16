/**
 * TUTORIA - Módulo Central de Animação do Avatar (AvatarAnimator)
 * Implementa respiração, piscadas estocásticas, sincronização de boca e gestos humanos.
 */

import { sortearProximoGesto } from './gestos';
import { AvatarConfig, AvatarElementos, AvatarEstado, CONFIG_AVATAR_PADRAO, GestoTipo } from './tipos';

export class AvatarAnimator {
  private estadoAtual: AvatarEstado = 'idle';
  private elementos: AvatarElementos;
  private config: AvatarConfig;

  // Timers e IDs
  private timerPiscada: any = null;
  private timerGesto: any = null;
  private timerApontar: any = null;
  private timerFallbackBoca: any = null;
  private estaApontando = false;
  private ultimoGesto: GestoTipo | null = null;
  private estaPiscando = false;
  private ultimoBoundaryTimestamp = 0;

  // Elementos internos do SVG
  private mouthElement: SVGElement | null = null;

  constructor(elementos: AvatarElementos, config?: Partial<AvatarConfig>) {
    this.elementos = elementos;
    this.config = { ...CONFIG_AVATAR_PADRAO, ...config };

    this.cachearElementosInternos();
    this.definirEstado('idle');
    this.iniciarLoopPiscadas();
    this.configurarVisibilidade();
  }

  private cachearElementosInternos(): void {
    if (!this.elementos.moduloElemento) return;
    this.mouthElement = this.elementos.moduloElemento.querySelector('#avatar-mouth');
  }

  private configurarVisibilidade(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pausarAnimacoes();
      } else {
        this.retomarAnimacoes();
      }
    });
  }

  private pausarAnimacoes(): void {
    if (this.timerPiscada) clearTimeout(this.timerPiscada);
    if (this.timerGesto) clearInterval(this.timerGesto);
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);
  }

  private retomarAnimacoes(): void {
    this.iniciarLoopPiscadas();
    if (this.estadoAtual === 'speaking') {
      this.iniciarLoopGestos();
      this.iniciarFallbackBocaSeNecessario();
    }
  }

  private prefereMovimentoReduzido(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ==========================================================================
     PISCADAS ESTOCÁSTICAS
     ========================================================================== */
  private iniciarLoopPiscadas(): void {
    if (this.timerPiscada) clearTimeout(this.timerPiscada);

    const { piscadaIntervaloMinMs, piscadaIntervaloMaxMs } = this.config;
    const proximoIntervalo =
      Math.floor(Math.random() * (piscadaIntervaloMaxMs - piscadaIntervaloMinMs)) + piscadaIntervaloMinMs;

    this.timerPiscada = setTimeout(() => {
      this.executarPiscada();
    }, proximoIntervalo);
  }

  private executarPiscada(): void {
    if (this.estaPiscando) return;
    this.estaPiscando = true;

    const mod = this.elementos.moduloElemento;
    if (mod) mod.classList.add('blinking');

    // Duração do fechamento dos olhos
    setTimeout(() => {
      if (mod) mod.classList.remove('blinking');
      this.estaPiscando = false;

      // Chance de piscada dupla (~10%)
      const dupla = Math.random() < this.config.chancePiscadaDupla;
      if (dupla) {
        setTimeout(() => {
          if (mod) mod.classList.add('blinking');
          setTimeout(() => {
            if (mod) mod.classList.remove('blinking');
            this.iniciarLoopPiscadas();
          }, 110);
        }, 90);
      } else {
        this.iniciarLoopPiscadas();
      }
    }, 120);
  }

  /* ==========================================================================
     CONTROLE DE ESTADOS E POSES
     ========================================================================== */
  obterEstado(): AvatarEstado {
    return this.estadoAtual;
  }

  definirEstado(novoEstado: AvatarEstado, mensagemCustomizada: string | null = null): void {
    this.estadoAtual = novoEstado;

    const mod = this.elementos.moduloElemento;
    if (mod) {
      // Remove classes de estado e gestos anteriores, mantendo estrutura
      mod.classList.remove(
        'state-idle',
        'state-listening',
        'state-thinking',
        'state-speaking',
        'pose-apontando',
        'gesto-palmas-abertas',
        'gesto-enfatizar',
        'gesto-contar-dedos',
        'gesto-mao-no-peito'
      );
      mod.classList.add(`state-${novoEstado}`);
    }

    const rotulosPadrao: Record<AvatarEstado, string> = {
      idle: 'Aguardando sua dúvida',
      listening: 'Ouvindo sua pergunta...',
      thinking: 'Consultando material didático...',
      speaking: 'Explicando...'
    };

    if (this.elementos.statusTextoElemento) {
      this.elementos.statusTextoElemento.textContent = mensagemCustomizada || rotulosPadrao[novoEstado];
    }

    if (this.elementos.micBotaoElemento) {
      if (novoEstado === 'listening') {
        this.elementos.micBotaoElemento.classList.add('recording');
      } else {
        this.elementos.micBotaoElemento.classList.remove('recording');
      }
    }

    if (this.elementos.micDicaElemento) {
      if (novoEstado === 'listening') {
        this.elementos.micDicaElemento.textContent = 'Gravando... Fale claramente!';
      } else if (novoEstado === 'thinking') {
        this.elementos.micDicaElemento.textContent = 'Pensando na melhor explicação...';
      } else if (novoEstado === 'speaking') {
        this.elementos.micDicaElemento.textContent = 'Tutor respondendo... Toque para interromper.';
      } else {
        this.elementos.micDicaElemento.textContent = 'Clique no microfone para perguntar';
      }
    }

    if (novoEstado === 'speaking') {
      this.iniciarLoopGestos();
      this.iniciarFallbackBocaSeNecessario();
    } else {
      this.pararFala();
    }
  }

  atualizarMensagem(mensagem: string): void {
    if (this.elementos.statusTextoElemento) {
      this.elementos.statusTextoElemento.textContent = mensagem;
    }
  }

  /* ==========================================================================
     GESTICULAÇÃO DURANTE A FALA
     ========================================================================== */
  private iniciarLoopGestos(): void {
    if (this.timerGesto) clearInterval(this.timerGesto);
    if (this.prefereMovimentoReduzido()) return;

    // Dispara o primeiro gesto imediatamente
    this.aplicarProximoGesto();

    this.timerGesto = setInterval(() => {
      if (this.estadoAtual === 'speaking' && !this.estaApontando) {
        this.aplicarProximoGesto();
      }
    }, this.config.intervaloGestosMs);
  }

  private aplicarProximoGesto(): void {
    const mod = this.elementos.moduloElemento;
    if (!mod || this.estaApontando) return;

    const proximo = sortearProximoGesto(this.ultimoGesto);
    this.ultimoGesto = proximo;

    mod.classList.remove(
      'gesto-palmas-abertas',
      'gesto-enfatizar',
      'gesto-contar-dedos',
      'gesto-mao-no-peito'
    );
    mod.classList.add(`gesto-${proximo}`);
  }

  /* ==========================================================================
     SINCRONIZAÇÃO LABIAL (BOCA)
     ========================================================================== */
  notificarPalavraFalada(): void {
    this.ultimoBoundaryTimestamp = Date.now();
    this.abrirBoca(1.0);
    setTimeout(() => {
      if (this.estadoAtual === 'speaking') {
        this.abrirBoca(0.2);
      }
    }, 140);
  }

  private abrirBoca(escala: number): void {
    if (!this.mouthElement) this.cachearElementosInternos();
    if (!this.mouthElement) return;

    if (escala <= 0.05) {
      this.mouthElement.style.transform = 'scaleY(0.15)';
    } else {
      this.mouthElement.style.transform = `scaleY(${escala})`;
    }
  }

  private iniciarFallbackBocaSeNecessario(): void {
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);

    let fase = 0;
    this.timerFallbackBoca = setInterval(() => {
      if (this.estadoAtual !== 'speaking') return;

      // Se faz mais de 400ms sem evento de boundary, o fallback de cadência assume
      const delta = Date.now() - this.ultimoBoundaryTimestamp;
      if (delta > 350) {
        fase++;
        // Padrão orgânico de abertura/fechamento rítmico
        const aberturas = [0.8, 0.4, 0.9, 0.2, 0.7, 0.3];
        const valor = aberturas[fase % aberturas.length];
        this.abrirBoca(valor);
      }
    }, 160);
  }

  pararFala(): void {
    if (this.timerGesto) {
      clearInterval(this.timerGesto);
      this.timerGesto = null;
    }
    if (this.timerFallbackBoca) {
      clearInterval(this.timerFallbackBoca);
      this.timerFallbackBoca = null;
    }

    // Fecha a boca imediatamente (CA13)
    this.abrirBoca(0.1);

    const mod = this.elementos.moduloElemento;
    if (mod) {
      mod.classList.remove(
        'gesto-palmas-abertas',
        'gesto-enfatizar',
        'gesto-contar-dedos',
        'gesto-mao-no-peito'
      );
    }
    this.ultimoGesto = null;
  }

  /* ==========================================================================
     APONTAR PARA A LOUSA / APOIO VISUAL (RF07)
     ========================================================================== */
  apontarParaLousa(duracaoMs?: number): void {
    if (this.prefereMovimentoReduzido()) return;

    const tempo = duracaoMs || this.config.duracaoApontarMs;
    const mod = this.elementos.moduloElemento;
    if (!mod) return;

    if (this.timerApontar) clearTimeout(this.timerApontar);
    this.estaApontando = true;

    mod.classList.add('pose-apontando');

    this.timerApontar = setTimeout(() => {
      this.estaApontando = false;
      if (mod) mod.classList.remove('pose-apontando');
      if (this.estadoAtual === 'speaking') {
        this.aplicarProximoGesto();
      }
    }, tempo);
  }

  destruir(): void {
    this.pausarAnimacoes();
    if (this.timerApontar) clearTimeout(this.timerApontar);
  }
}
