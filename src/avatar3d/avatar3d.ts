/**
 * TUTORIA - Implementação do Avatar 3D com Three.js e VRM (RF01 - RF10, CA01 - CA17)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

import { sortearProximoGesto, sortearProximoGestoEspera } from '../avatar/gestos';
import { AvatarEstado, ControladorAvatar, GestoEsperaTipo, GestoTipo } from '../avatar/tipos';
import { mapearPalavraParaVogalVRM } from './lipSync';
import {
  obterPoseApontarLousa,
  POSE_IDLE,
  POSE_LISTENING,
  POSE_THINKING,
  POSES_GESTOS_ESPERA,
  POSES_GESTOS_FALA
} from './poses';
import { Avatar3DConfig, Avatar3DElementos, CONFIG_AVATAR_3D_PADRAO, PoseVRM } from './tipos';

/**
 * Verifica se o contexto WebGL está disponível no navegador atual (RF03, CA04).
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export class Avatar3D implements ControladorAvatar {
  private elementos: Avatar3DElementos;
  private config: Avatar3DConfig;
  private estadoAtual: AvatarEstado = 'idle';

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private clock: THREE.Clock | null = null;
  private animFrameId: number | null = null;
  private vrm: VRM | null = null;
  private estaInicializado = false;
  private estaDestruido = false;

  estaAtivo(): boolean {
    return this.estaInicializado && !this.estaDestruido;
  }

  // Interpolação de Poses e Ossos
  private poseAlvo: PoseVRM = POSE_IDLE;
  private poseAtual: PoseVRM = JSON.parse(JSON.stringify(POSE_IDLE));
  private fatorInterpolação = 0.12;

  // Timers e Animações
  private timerPiscada: any = null;
  private timerGesto: any = null;
  private timerGestoEspera: any = null;
  private timerApontar: any = null;
  private timerFallbackBoca: any = null;
  private estaApontando = false;
  private ultimoGesto: GestoTipo | null = null;
  private ultimoGestoEspera: GestoEsperaTipo | null = null;
  private ultimoBoundaryTimestamp = 0;

  // Estados Dinâmicos de Renderização
  private valorBlink = 0;
  private valorBoca = 0;
  private expressaoBocaAtual: string = 'aa';
  private ultimoTempoFrame = 0;
  private tempoAcumulado = 0;

  // Listeners
  private onVisibilityChangeHandler: (() => void) | null = null;
  private onResizeHandler: (() => void) | null = null;

  constructor(elementos: Avatar3DElementos, config?: Partial<Avatar3DConfig>) {
    this.elementos = elementos;
    this.config = { ...CONFIG_AVATAR_3D_PADRAO, ...config };
  }

  /**
   * Inicializa o renderizador WebGL, cena e carrega o modelo VRM.
   */
  async inicializar(): Promise<boolean> {
    if (this.estaDestruido || !this.elementos.canvasElemento) return false;
    if (!isWebGLAvailable()) return false;

    const canvas = this.elementos.canvasElemento;

    try {
      // 1. Cria Renderer Three.js
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(canvas.clientWidth || 300, canvas.clientHeight || 330, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // RNF03
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      // 2. Cena
      this.scene = new THREE.Scene();

      // 3. Câmera focada da cintura/peitoral para a cabeça (enquadramento didático)
      const aspect = (canvas.clientWidth || 300) / (canvas.clientHeight || 330);
      this.camera = new THREE.PerspectiveCamera(28.0, aspect, 0.1, 20.0);
      this.camera.position.set(0.0, 1.35, 1.5);
      this.camera.lookAt(0.0, 1.3, 0.0);

      // 4. Iluminação de estúdio tridimensional (Key Light frontal suave + Fill Light + Rim Light ciano)
      const lightAmbient = new THREE.AmbientLight(0xfff8f2, 1.5);
      this.scene.add(lightAmbient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
      keyLight.position.set(0.8, 1.8, 1.8).normalize();
      this.scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.75);
      rimLight.position.set(-1.2, 1.6, -1.2).normalize();
      this.scene.add(rimLight);

      // 5. Carregamento do VRM com timeout de 10s (RF03, CA04)
      const vrmCarregado = await this.carregarModeloComTimeout(
        this.config.caminhoModelo,
        this.config.tempoLimiteCarregamentoMs
      );

      if (!vrmCarregado || this.estaDestruido) {
        this.destruir();
        return false;
      }

      this.vrm = vrmCarregado;
      this.scene.add(this.vrm.scene);

      // Normalização de orientação
      VRMUtils.rotateVRM0(this.vrm);

      // Configuração da câmera olhando para o peitoral/cabeça do VRM com enquadramento amigável
      const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head');
      if (headBone) {
        const headPos = new THREE.Vector3();
        headBone.getWorldPosition(headPos);
        this.camera.position.set(0.0, headPos.y + 0.03, 1.35);
        this.camera.lookAt(0.0, headPos.y - 0.07, 0.0);
      }

      // 6. Inicia Loops
      this.clock = new THREE.Clock();
      this.configurarEventosJanela();
      this.iniciarLoopPiscadas();
      this.definirEstado(this.estadoAtual);

      // 7. Loop de Renderização
      this.iniciarLoopRenderizacao();

      // 8. Transição suave do SVG para o Canvas (RF02, CA02)
      this.realizarTransicaoVisualSuave();

      this.estaInicializado = true;
      return true;
    } catch (err) {
      console.warn('Avatar3D: Não foi possível carregar o modelo 3D. Mantendo plano B (SVG).', err);
      this.destruir();
      return false;
    }
  }

  private async carregarModeloComTimeout(url: string, timeoutMs: number): Promise<VRM | null> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao carregar VRM')), timeoutMs);
    });

    const loadPromise = new Promise<VRM>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (vrm) {
            resolve(vrm);
          } else {
            reject(new Error('VRM ausente nos dados do glTF'));
          }
        },
        undefined,
        (error) => reject(error)
      );
    });

    return Promise.race([loadPromise, timeoutPromise]);
  }

  private realizarTransicaoVisualSuave(): void {
    if (!this.elementos.canvasElemento) return;
    const canvas = this.elementos.canvasElemento;
    const mod = this.elementos.moduloElemento;
    const svg = mod?.querySelector('.avatar-svg') as SVGElement | null;

    canvas.style.display = 'block';
    requestAnimationFrame(() => {
      canvas.style.opacity = '1';
      if (svg) {
        svg.style.transition = 'opacity 0.4s ease';
        svg.style.opacity = '0';
      }
    });
  }

  private configurarEventosJanela(): void {
    if (typeof document === 'undefined') return;

    this.onVisibilityChangeHandler = () => {
      if (document.hidden) {
        this.pausarAnimacoes();
      } else {
        this.retomarAnimacoes();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChangeHandler);

    this.onResizeHandler = () => {
      if (!this.renderer || !this.camera || !this.elementos.canvasElemento) return;
      const c = this.elementos.canvasElemento;
      const w = c.clientWidth || 300;
      const h = c.clientHeight || 330;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', this.onResizeHandler);
  }

  private prefereMovimentoReduzido(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ==========================================================================
     LOOP DE RENDERIZAÇÃO E ANIMAÇÃO DOS OSSOS
     ========================================================================== */
  private iniciarLoopRenderizacao(): void {
    const loop = (timestamp: number) => {
      if (this.estaDestruido) return;

      this.animFrameId = requestAnimationFrame(loop);

      // RNF03: Pausar completamente em segundo plano
      if (typeof document !== 'undefined' && document.hidden) return;

      const limiteFps = this.estadoAtual === 'speaking' || this.estaApontando
        ? this.config.fpsLimiteFala
        : this.config.fpsLimiteRepouso;

      const intervaloMin = 1000 / limiteFps;
      const deltaMs = timestamp - this.ultimoTempoFrame;

      if (deltaMs < intervaloMin) return;
      this.ultimoTempoFrame = timestamp - (deltaMs % intervaloMin);

      const deltaSeg = this.clock ? this.clock.getDelta() : 0.016;
      this.tempoAcumulado += deltaSeg;

      this.atualizarAnimacoes(deltaSeg);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private atualizarAnimacoes(delta: number): void {
    if (!this.vrm) return;

    const reducedMotion = this.prefereMovimentoReduzido();

    // 1. Atualização do VRM Core
    this.vrm.update(delta);

    // 2. Decaimento suave de Lip Sync
    if (this.valorBoca > 0) {
      this.valorBoca = Math.max(0, this.valorBoca - delta * 5.0);
    }
    const expressoesBoca = ['aa', 'ih', 'ou', 'ee', 'oh'];
    for (const exp of expressoesBoca) {
      const targetVal = exp === this.expressaoBocaAtual ? this.valorBoca : 0;
      this.vrm.expressionManager?.setValue(exp, targetVal);
    }

    // 3. Piscadas
    this.vrm.expressionManager?.setValue('blink', this.valorBlink);

    // 4. Expressões Faciais por Estado (RF10)
    if (this.estadoAtual === 'speaking') {
      this.vrm.expressionManager?.setValue('happy', 0.35);
      this.vrm.expressionManager?.setValue('relaxed', 0.0);
    } else if (this.estadoAtual === 'idle') {
      this.vrm.expressionManager?.setValue('happy', 0.25);
      this.vrm.expressionManager?.setValue('relaxed', 0.05);
    } else if (this.estadoAtual === 'thinking') {
      this.vrm.expressionManager?.setValue('happy', 0.0);
      this.vrm.expressionManager?.setValue('relaxed', 0.5);
    } else if (this.estadoAtual === 'listening') {
      this.vrm.expressionManager?.setValue('happy', 0.15);
      this.vrm.expressionManager?.setValue('relaxed', 0.1);
    }
    this.vrm.expressionManager?.update();

    // 5. Olhar para a Câmera (lookAt) (RF09, CA12)
    if (this.vrm.lookAt && this.camera) {
      if (this.estaApontando) {
        // Durante o apontar para a lousa, olha ligeiramente na direção apontada
        this.vrm.lookAt.target = this.camera;
      } else {
        this.vrm.lookAt.target = this.camera;
      }
    }

    // 6. Respiração (RF04)
    if (!reducedMotion) {
      const oscResp = Math.sin(this.tempoAcumulado * 2.2) * 0.02;
      const oscCabeca = Math.sin(this.tempoAcumulado * 1.4) * 0.015;

      const chestBone = this.vrm.humanoid?.getNormalizedBoneNode('chest');
      if (chestBone) chestBone.rotation.x = this.poseAtual.chest ? this.poseAtual.chest.x + oscResp : oscResp;

      const headBone = this.vrm.humanoid?.getNormalizedBoneNode('head');
      if (headBone) headBone.rotation.z = this.poseAtual.head ? this.poseAtual.head.z + oscCabeca : oscCabeca;
    }

    // 7. Interpolação suave de Poses de Ossos (RF06, CA09)
    this.interpolarOssos(reducedMotion);

    // 8. Atualização de física de cabelos e roupas (SpringBone)
    if (!reducedMotion) {
      this.vrm.springBoneManager?.update(delta);
    }
  }

  private interpolarOssos(reducedMotion: boolean): void {
    if (!this.vrm) return;

    const ossosChave: Array<keyof PoseVRM> = [
      'chest',
      'spine',
      'neck',
      'head',
      'leftUpperArm',
      'leftLowerArm',
      'leftHand',
      'rightUpperArm',
      'rightLowerArm',
      'rightHand'
    ];

    for (const ossoNome of ossosChave) {
      const boneNode = this.vrm.humanoid?.getNormalizedBoneNode(ossoNome as any);
      if (!boneNode) continue;

      const rotAlvo = this.poseAlvo[ossoNome] || { x: 0, y: 0, z: 0 };
      if (!this.poseAtual[ossoNome]) {
        this.poseAtual[ossoNome] = { x: 0, y: 0, z: 0 };
      }
      const rotAtual = this.poseAtual[ossoNome]!;

      // Se movimento reduzido, atenua ou anula movimentos amplos de braços
      const fator = reducedMotion ? 0.3 : this.fatorInterpolação;

      rotAtual.x += (rotAlvo.x - rotAtual.x) * fator;
      rotAtual.y += (rotAlvo.y - rotAtual.y) * fator;
      rotAtual.z += (rotAlvo.z - rotAtual.z) * fator;

      if (!reducedMotion || ossoNome === 'head' || ossoNome === 'neck') {
        boneNode.rotation.set(rotAtual.x, rotAtual.y, rotAtual.z);
      }
    }
  }

  /* ==========================================================================
     PISCADAS ESTOCÁSTICAS (RF04, CA06)
     ========================================================================== */
  private iniciarLoopPiscadas(): void {
    if (this.timerPiscada) clearTimeout(this.timerPiscada);

    const { piscadaIntervaloMinMs, piscadaIntervaloMaxMs } = this.config;
    const intervalo =
      Math.floor(Math.random() * (piscadaIntervaloMaxMs - piscadaIntervaloMinMs)) + piscadaIntervaloMinMs;

    this.timerPiscada = setTimeout(() => {
      this.executarPiscada();
    }, intervalo);
  }

  private executarPiscada(): void {
    this.valorBlink = 1.0;
    setTimeout(() => {
      this.valorBlink = 0.0;

      // Chance de piscada dupla (~10%)
      const dupla = Math.random() < this.config.chancePiscadaDupla;
      if (dupla) {
        setTimeout(() => {
          this.valorBlink = 1.0;
          setTimeout(() => {
            this.valorBlink = 0.0;
            this.iniciarLoopPiscadas();
          }, 110);
        }, 90);
      } else {
        this.iniciarLoopPiscadas();
      }
    }, 120);
  }

  /* ==========================================================================
     CONTROLE DE ESTADO E POSES (RF01, RF06)
     ========================================================================== */
  obterEstado(): AvatarEstado {
    return this.estadoAtual;
  }

  definirEstado(novoEstado: AvatarEstado, mensagemCustomizada: string | null = null): void {
    this.estadoAtual = novoEstado;

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

    if (this.estaApontando) return;

    if (novoEstado === 'idle') {
      this.pararFala();
      this.pararCicloGestosEspera();
      this.poseAlvo = POSE_IDLE;
    } else if (novoEstado === 'listening') {
      this.pararFala();
      this.pararCicloGestosEspera();
      this.poseAlvo = POSE_LISTENING;
    } else if (novoEstado === 'thinking') {
      this.pararFala();
      this.poseAlvo = POSE_THINKING;
      this.iniciarCicloGestosEspera();
    } else if (novoEstado === 'speaking') {
      this.pararCicloGestosEspera();
      this.iniciarLoopGestos();
      this.iniciarFallbackBocaSeNecessario();
    }
  }

  atualizarMensagem(mensagem: string): void {
    if (this.elementos.statusTextoElemento) {
      this.elementos.statusTextoElemento.textContent = mensagem;
    }
  }

  /* ==========================================================================
     SINCRONIZAÇÃO LABIAL E GESTOS NA FALA (RF05, RF07, CA07, CA08, CA10)
     ========================================================================== */
  notificarPalavraFalada(palavra?: string): void {
    this.ultimoBoundaryTimestamp = Date.now();
    this.expressaoBocaAtual = mapearPalavraParaVogalVRM(palavra);
    this.valorBoca = 0.95;
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

    // Fecha a boca imediatamente (CA08)
    this.valorBoca = 0;
    if (this.vrm?.expressionManager) {
      for (const exp of ['aa', 'ih', 'ou', 'ee', 'oh']) {
        this.vrm.expressionManager.setValue(exp, 0);
      }
    }

    if (!this.estaApontando && this.estadoAtual === 'idle') {
      this.poseAlvo = POSE_IDLE;
    }
  }

  private iniciarFallbackBocaSeNecessario(): void {
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);

    this.timerFallbackBoca = setInterval(() => {
      if (this.estadoAtual !== 'speaking') return;
      const delta = Date.now() - this.ultimoBoundaryTimestamp;
      if (delta > 400) {
        this.notificarPalavraFalada();
      }
    }, 280);
  }

  private iniciarLoopGestos(): void {
    if (this.timerGesto) clearInterval(this.timerGesto);

    this.aplicarProximoGesto();

    this.timerGesto = setInterval(() => {
      if (this.estadoAtual !== 'speaking') {
        if (this.timerGesto) clearInterval(this.timerGesto);
        return;
      }
      if (!this.estaApontando) {
        this.aplicarProximoGesto();
      }
    }, this.config.intervaloGestosMs);
  }

  private aplicarProximoGesto(): void {
    if (this.prefereMovimentoReduzido()) return;
    const proximo = sortearProximoGesto(this.ultimoGesto);
    this.ultimoGesto = proximo;
    this.poseAlvo = POSES_GESTOS_FALA[proximo];
  }

  /* ==========================================================================
     APONTAR PARA A LOUSA DIDÁTICA (RF08, CA11)
     ========================================================================== */
  apontarParaLousa(duracaoMs?: number, _elementoAlvo?: HTMLElement | null): void {
    if (this.prefereMovimentoReduzido()) return;

    const tempo = duracaoMs || this.config.duracaoApontarMs;
    const ehMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    if (this.timerApontar) clearTimeout(this.timerApontar);
    this.estaApontando = true;

    this.poseAlvo = obterPoseApontarLousa(ehMobile);

    this.timerApontar = setTimeout(() => {
      this.estaApontando = false;
      if (this.estadoAtual === 'speaking') {
        this.aplicarProximoGesto();
      } else if (this.estadoAtual === 'thinking') {
        this.poseAlvo = POSE_THINKING;
      } else {
        this.poseAlvo = POSE_IDLE;
      }
    }, tempo);
  }

  /* ==========================================================================
     GESTOS DE ESPERA ATIVA (RF07)
     ========================================================================== */
  iniciarCicloGestosEspera(intervaloMs = 2500): void {
    this.pararCicloGestosEspera();
    if (this.prefereMovimentoReduzido()) return;

    this.aplicarProximoGestoEspera();

    this.timerGestoEspera = setInterval(() => {
      if (this.estadoAtual !== 'thinking') {
        this.pararCicloGestosEspera();
        return;
      }
      this.aplicarProximoGestoEspera();
    }, intervaloMs);
  }

  pararCicloGestosEspera(): void {
    if (this.timerGestoEspera) {
      clearInterval(this.timerGestoEspera);
      this.timerGestoEspera = null;
    }
    this.ultimoGestoEspera = null;
  }

  aplicarProximoGestoEspera(): void {
    if (this.prefereMovimentoReduzido()) return;
    const proximo = sortearProximoGestoEspera(this.ultimoGestoEspera);
    this.ultimoGestoEspera = proximo;
    this.poseAlvo = POSES_GESTOS_ESPERA[proximo];
  }

  private pausarAnimacoes(): void {
    if (this.timerPiscada) clearTimeout(this.timerPiscada);
    if (this.timerGesto) clearInterval(this.timerGesto);
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);
    if (this.timerGestoEspera) clearInterval(this.timerGestoEspera);
  }

  private retomarAnimacoes(): void {
    this.iniciarLoopPiscadas();
    if (this.estadoAtual === 'speaking') {
      this.iniciarLoopGestos();
      this.iniciarFallbackBocaSeNecessario();
    } else if (this.estadoAtual === 'thinking') {
      this.iniciarCicloGestosEspera();
    }
  }

  /* ==========================================================================
     DESCARTE E LIMPEZA DE RECURSOS (RNF04, CA15)
     ========================================================================== */
  destruir(): void {
    this.estaDestruido = true;
    this.pausarAnimacoes();
    this.pararFala();
    this.pararCicloGestosEspera();
    if (this.timerApontar) clearTimeout(this.timerApontar);

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.onVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler);
    }
    if (this.onResizeHandler) {
      window.removeEventListener('resize', this.onResizeHandler);
    }

    // Libera geometrias e materiais da cena
    if (this.scene) {
      this.scene.traverse((obj: any) => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      this.scene.clear();
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    // Retorna visualmente para o SVG se o canvas ainda existir
    if (this.elementos.canvasElemento) {
      this.elementos.canvasElemento.style.opacity = '0';
      this.elementos.canvasElemento.style.display = 'none';
    }
    const svg = this.elementos.moduloElemento?.querySelector('.avatar-svg') as SVGElement | null;
    if (svg) {
      svg.style.opacity = '1';
    }

    this.vrm = null;
    this.scene = null;
    this.camera = null;
  }
}
