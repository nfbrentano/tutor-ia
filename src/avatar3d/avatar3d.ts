/**
 * TUTORIA - Implementação do Avatar 3D com Three.js e VRM
 * Spec base: SDD/DONE/2026-10-16_avatar-3d.md (RF01 - RF10, CA01 - CA17)
 * Movimento humano e personas: SDD/2026-10-23_avatar-personas-por-materia.md
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMHumanBoneName, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

import { sortearProximoGesto, sortearProximoGestoEspera } from '../avatar/gestos';
import { AvatarEstado, ControladorAvatar, GestoEsperaTipo, GestoTipo } from '../avatar/tipos';
import { descreverPersona, MODELO_PROVISORIO, obterModeloPersona, Persona } from '../personas';
import { GerenciadorClipes } from './animacoes';
import { gerarSequenciaBoca, SegmentoBoca } from './lipSync';
import {
  calcularCamadasProcedurais,
  calcularPoseApontar,
  dedosParaPalavra,
  fatorSuavizacao,
  IntensidadeMovimento,
  MolaGesto,
  ruidoSuave
} from './movimento';
import {
  obterPoseApontarLousa,
  POSE_CUMPRIMENTAR,
  POSE_IDLE,
  POSE_LISTENING,
  POSE_THINKING,
  POSES_GESTOS_ESPERA,
  POSES_GESTOS_FALA,
  POSES_REPOUSO
} from './poses';
import { Avatar3DConfig, Avatar3DElementos, CONFIG_AVATAR_3D_PADRAO, PoseVRM, RotacaoOsso } from './tipos';

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

const OSSOS_POSE: Array<keyof PoseVRM> = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand'
];

const EXPRESSOES_BOCA = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;

const DEDOS = ['Index', 'Middle', 'Ring', 'Little'] as const;
const FALANGES = ['Proximal', 'Intermediate', 'Distal'] as const;

/** Expressões faciais por estado (RF10), aplicadas com transição suave. */
const EXPRESSOES_ESTADO: Record<AvatarEstado, { happy: number; relaxed: number; surprised: number }> = {
  idle: { happy: 0.25, relaxed: 0.05, surprised: 0 },
  listening: { happy: 0.15, relaxed: 0.05, surprised: 0.08 },
  thinking: { happy: 0, relaxed: 0.45, surprised: 0 },
  speaking: { happy: 0.3, relaxed: 0, surprised: 0 }
};

const PASTA_ANIMACOES = './avatar/animacoes';
const MAX_MODELOS_EM_CACHE = 2;

export class Avatar3D implements ControladorAvatar {
  private elementos: Avatar3DElementos;
  private config: Avatar3DConfig;
  private estadoAtual: AvatarEstado = 'idle';

  // Three.js Core
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private timer: THREE.Timer | null = null;
  private animFrameId: number | null = null;
  private vrm: VRM | null = null;
  private estaInicializado = false;
  private estaDestruido = false;

  // Personas (RF06 - RF08)
  private persona: Persona | null = null;
  private personaPendente: Persona | null = null;
  private modeloAtualUrl: string | null = null;
  private cacheModelos = new Map<string, VRM>();
  private trocandoPersona = false;

  // Clipes do Mixamo (RF02, RF03) e mistura com a pose procedural
  private clipes: GerenciadorClipes | null = null;
  private pesoClipe = 0;

  // Pose base e camadas
  private poseAlvo: PoseVRM = POSE_IDLE;
  private poseAtual: PoseVRM = JSON.parse(JSON.stringify(POSE_IDLE));
  private molaBatida = new MolaGesto(90, 11);
  private molaAceno = new MolaGesto(70, 10);
  private ladoGesto: 'left' | 'right' = 'right';
  private variacaoGesto: PoseVRM = {};

  // Dedos (CA06): 0 = esticado, 1 = fechado
  private curvaturaDedos = { left: [0.12, 0.15, 0.18, 0.22, 0.1], right: [0.12, 0.15, 0.18, 0.22, 0.1] };
  private dedosMostrando: number | null = null;
  private emEnumeracao = false;
  private timerDedos: ReturnType<typeof setTimeout> | null = null;

  // Olhar (RF01c, RF09)
  private alvoOlhar = new THREE.Object3D();
  private desvioOlhar = new THREE.Vector3();
  private proximaSacadaSeg = 0;
  private pontoLousa: THREE.Vector3 | null = null;
  private olhandoLousaAteSeg = 0;

  // Timers e Animações
  private timerPiscada: ReturnType<typeof setTimeout> | null = null;
  private timerGesto: ReturnType<typeof setInterval> | null = null;
  private timerGestoEspera: ReturnType<typeof setInterval> | null = null;
  private timerApontar: ReturnType<typeof setTimeout> | null = null;
  private timerFallbackBoca: ReturnType<typeof setInterval> | null = null;
  private timerCumprimento: ReturnType<typeof setTimeout> | null = null;
  private timerRepouso: ReturnType<typeof setTimeout> | null = null;
  private estaApontando = false;
  private estaCumprimentando = false;
  private ultimoGesto: GestoTipo | null = null;
  private ultimoGestoEspera: GestoEsperaTipo | null = null;
  private indiceRepouso = 0;
  private ultimoBoundaryTimestamp = 0;

  // Estados Dinâmicos de Renderização
  private blinkAlvo = 0;
  private valorBlink = 0;
  private sequenciaBoca: SegmentoBoca[] = [];
  private inicioPalavraSeg = 0;
  private pesosBoca: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private expressoesAtuais = { happy: 0, relaxed: 0, surprised: 0 };
  private ultimoTempoFrame = 0;
  private tempoAcumulado = 0;

  // Listeners
  private onVisibilityChangeHandler: (() => void) | null = null;
  private onResizeHandler: (() => void) | null = null;

  estaAtivo(): boolean {
    return this.estaInicializado && !this.estaDestruido;
  }

  constructor(elementos: Avatar3DElementos, config?: Partial<Avatar3DConfig>) {
    this.elementos = elementos;
    this.config = { ...CONFIG_AVATAR_3D_PADRAO, ...config };
    this.persona = this.config.persona ?? null;
  }

  /**
   * Inicializa o renderizador WebGL, cena e carrega o modelo VRM.
   */
  async inicializar(): Promise<boolean> {
    if (this.estaDestruido || !this.elementos.canvasElemento) return false;
    if (!isWebGLAvailable()) return false;

    const canvas = this.elementos.canvasElemento;

    try {
      // 1. Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(canvas.clientWidth || 300, canvas.clientHeight || 330, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // RNF03
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      // 2. Cena e câmera (enquadramento da cintura para cima)
      this.scene = new THREE.Scene();
      const aspect = (canvas.clientWidth || 300) / (canvas.clientHeight || 330);
      this.camera = new THREE.PerspectiveCamera(28.0, aspect, 0.1, 20.0);
      this.camera.position.set(0.0, 1.35, 1.5);
      this.camera.lookAt(0.0, 1.3, 0.0);
      this.scene.add(this.alvoOlhar);

      // 3. Iluminação de estúdio (key + ambiente + rim)
      this.scene.add(new THREE.AmbientLight(0xfff8f2, 1.5));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
      keyLight.position.set(0.8, 1.8, 1.8).normalize();
      this.scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.75);
      rimLight.position.set(-1.2, 1.6, -1.2).normalize();
      this.scene.add(rimLight);

      // 4. Modelo da persona, com o provisório como reserva (D04, CA13)
      const urlDesejada = this.persona ? obterModeloPersona(this.persona) : this.config.caminhoModelo;
      let url = urlDesejada;
      let vrmCarregado = await this.carregarModeloComTimeout(url, this.config.tempoLimiteCarregamentoMs).catch(() => null);
      if (!vrmCarregado && urlDesejada !== MODELO_PROVISORIO && !this.estaDestruido) {
        url = MODELO_PROVISORIO;
        vrmCarregado = await this.carregarModeloComTimeout(url, this.config.tempoLimiteCarregamentoMs).catch(() => null);
      }

      if (!vrmCarregado || this.estaDestruido) {
        this.destruir();
        return false;
      }

      this.instalarModelo(vrmCarregado, url);

      // 5. Loops
      this.timer = new THREE.Timer();
      this.configurarEventosJanela();
      this.iniciarLoopPiscadas();
      this.definirEstado(this.estadoAtual);
      this.iniciarLoopRenderizacao();
      this.realizarTransicaoVisualSuave();
      this.atualizarRotuloAcessivel();

      this.estaInicializado = true;

      // 6. Clipes do Mixamo carregam depois, sem atrasar o primeiro quadro (RF02)
      this.carregarClipes();
      return true;
    } catch (err) {
      console.warn('Avatar3D: Não foi possível carregar o modelo 3D. Mantendo plano B (SVG).', err);
      this.destruir();
      return false;
    }
  }

  private async carregarModeloComTimeout(url: string, timeoutMs: number): Promise<VRM | null> {
    const emCache = this.cacheModelos.get(url);
    if (emCache) return emCache;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<null>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timeout ao carregar VRM')), timeoutMs);
    });

    const loadPromise = loader.loadAsync(url).then((gltf) => {
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (!vrm) throw new Error('VRM ausente nos dados do glTF');
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((obj) => {
        obj.frustumCulled = false;
      });
      return vrm;
    });

    try {
      return await Promise.race([loadPromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Coloca o VRM na cena, enquadra a câmera e guarda o modelo no cache (máx. 2, RF08).
   */
  private instalarModelo(vrm: VRM, url: string): void {
    if (!this.scene || !this.camera) return;

    if (this.vrm && this.vrm !== vrm) {
      this.scene.remove(this.vrm.scene);
    }
    this.vrm = vrm;
    this.modeloAtualUrl = url;
    this.scene.add(vrm.scene);

    this.cacheModelos.delete(url);
    this.cacheModelos.set(url, vrm);
    while (this.cacheModelos.size > MAX_MODELOS_EM_CACHE) {
      const [maisAntiga, modelo] = this.cacheModelos.entries().next().value as [string, VRM];
      this.cacheModelos.delete(maisAntiga);
      if (modelo !== this.vrm) VRMUtils.deepDispose(modelo.scene);
    }

    // Pose inicial aplicada antes de medir a cabeça
    this.poseAtual = JSON.parse(JSON.stringify(this.poseAlvo));
    vrm.humanoid?.resetNormalizedPose();
    vrm.update(0);

    const cabeca = vrm.humanoid?.getNormalizedBoneNode('head');
    if (cabeca) {
      const pos = new THREE.Vector3();
      cabeca.getWorldPosition(pos);
      // Enquadra da cabeça até a cintura: as mãos dos gestos precisam aparecer
      const altura = this.persona?.camera?.alturaMira ?? 0.18;
      const distancia = this.persona?.camera?.distancia ?? 1.9;
      this.camera.position.set(0.0, pos.y + 0.1, distancia);
      this.camera.lookAt(0.0, pos.y - altura, 0.0);
    }

    if (vrm.lookAt) {
      vrm.lookAt.target = this.alvoOlhar;
      vrm.lookAt.autoUpdate = true;
    }
    this.alvoOlhar.position.copy(this.camera.position);

    this.clipes?.destruir();
    this.clipes = null;
    this.pesoClipe = 0;
  }

  private async carregarClipes(): Promise<void> {
    if (!this.vrm || this.prefereMovimentoReduzido()) return;
    const vrmAlvo = this.vrm;
    const gerenciador = new GerenciadorClipes(vrmAlvo);
    const total = await gerenciador.carregar(PASTA_ANIMACOES);
    if (this.estaDestruido || this.vrm !== vrmAlvo || total === 0) {
      gerenciador.destruir();
      return;
    }
    this.clipes = gerenciador;
    this.atualizarClipeDoEstado();
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
     LOOP DE RENDERIZAÇÃO
     ========================================================================== */
  private iniciarLoopRenderizacao(): void {
    const loop = (timestamp: number) => {
      if (this.estaDestruido) return;

      this.animFrameId = requestAnimationFrame(loop);

      // RNF03: Pausar completamente em segundo plano
      if (typeof document !== 'undefined' && document.hidden) return;

      const limiteFps =
        this.estadoAtual === 'speaking' || this.estaApontando || this.trocandoPersona
          ? this.config.fpsLimiteFala
          : this.config.fpsLimiteRepouso;

      const intervaloMin = 1000 / limiteFps;
      const deltaMs = timestamp - this.ultimoTempoFrame;
      if (deltaMs < intervaloMin) return;
      this.ultimoTempoFrame = timestamp - (deltaMs % intervaloMin);

      let deltaSeg = 1 / limiteFps;
      if (this.timer) {
        this.timer.update(timestamp);
        deltaSeg = Math.min(this.timer.getDelta(), 0.1);
      }
      this.tempoAcumulado += deltaSeg;

      this.atualizarAnimacoes(deltaSeg);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private atualizarAnimacoes(delta: number): void {
    const vrm = this.vrm;
    if (!vrm) return;

    const reducedMotion = this.prefereMovimentoReduzido();

    this.atualizarBoca(delta);
    this.atualizarExpressoes(delta);

    // 1. Pose base: clipe do Mixamo e/ou pose procedural, misturados por pesoClipe
    const usarClipe = !!this.clipes?.estaAtivo() && !this.estaApontando && !this.estaCumprimentando && !reducedMotion;
    this.pesoClipe += ((usarClipe ? 1 : 0) - this.pesoClipe) * fatorSuavizacao(5, delta);
    if (this.clipes && this.pesoClipe > 0.001) {
      this.clipes.atualizar(delta);
    }

    const fator = fatorSuavizacao(reducedMotion ? 12 : 6, delta);
    this.interpolarPose(fator);
    this.aplicarPoseBase(vrm, reducedMotion);

    // 2. Camadas somadas (respiração, troca de peso, batidas, aceno, olhar)
    if (!reducedMotion) {
      this.aplicarCamadas(vrm, delta);
      this.aplicarDedos(vrm, delta);
    }

    // 3. Olhar
    this.atualizarOlhar(delta, reducedMotion);

    // 4. VRM: copia ossos normalizados para o modelo, expressões, lookAt e física
    vrm.update(delta);
  }

  private interpolarPose(fator: number): void {
    for (const osso of OSSOS_POSE) {
      const alvo = this.poseAlvo[osso] || { x: 0, y: 0, z: 0 };
      const variacao = this.estadoAtual === 'speaking' ? this.variacaoGesto[osso] : undefined;
      if (!this.poseAtual[osso]) this.poseAtual[osso] = { x: 0, y: 0, z: 0 };
      const atual = this.poseAtual[osso]!;
      atual.x += (alvo.x + (variacao?.x ?? 0) - atual.x) * fator;
      atual.y += (alvo.y + (variacao?.y ?? 0) - atual.y) * fator;
      atual.z += (alvo.z + (variacao?.z ?? 0) - atual.z) * fator;
    }
  }

  private readonly _quatPose = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();

  private aplicarPoseBase(vrm: VRM, reducedMotion: boolean): void {
    for (const osso of OSSOS_POSE) {
      const node = vrm.humanoid?.getNormalizedBoneNode(osso as VRMHumanBoneName);
      if (!node) continue;

      // Movimento reduzido: só cabeça e pescoço seguem a pose (D03 da spec do avatar 3D)
      const rot: RotacaoOsso =
        reducedMotion && osso !== 'head' && osso !== 'neck'
          ? POSE_IDLE[osso] || { x: 0, y: 0, z: 0 }
          : this.poseAtual[osso]!;
      this._quatPose.setFromEuler(this._euler.set(rot.x, rot.y, rot.z));

      if (this.pesoClipe > 0.001 && this.clipes) {
        // node.quaternion já tem o valor do clipe (mixer.update)
        node.quaternion.slerp(this._quatPose, 1 - this.pesoClipe);
      } else {
        node.quaternion.copy(this._quatPose);
      }
    }
  }

  private somarRotacao(vrm: VRM, osso: VRMHumanBoneName, x: number, y: number, z: number): void {
    const node = vrm.humanoid?.getNormalizedBoneNode(osso);
    if (!node) return;
    node.rotation.x += x;
    node.rotation.y += y;
    node.rotation.z += z;
  }

  private aplicarCamadas(vrm: VRM, delta: number): void {
    const intensidade: IntensidadeMovimento =
      this.estadoAtual === 'speaking' ? 'falando' : this.estadoAtual === 'listening' ? 'atento' : 'repouso';
    const camadas = calcularCamadasProcedurais(this.tempoAcumulado, intensidade);
    // Com clipe, o corpo já respira e troca o peso: as camadas ficam mais sutis
    const pesoCorpo = 1 - this.pesoClipe * 0.7;

    for (const osso of Object.keys(camadas) as Array<keyof PoseVRM>) {
      const r = camadas[osso]!;
      const peso = osso === 'head' || osso === 'neck' ? 1 : pesoCorpo;
      this.somarRotacao(vrm, osso as VRMHumanBoneName, r.x * peso, r.y * peso, r.z * peso);
    }

    // Batidas do gesto e aceno de cabeça sincronizados com as palavras
    const batida = this.molaBatida.atualizar(delta);
    const aceno = this.molaAceno.atualizar(delta);
    const sinal = this.ladoGesto === 'right' ? 1 : -1;
    this.somarRotacao(vrm, `${this.ladoGesto}LowerArm` as VRMHumanBoneName, 0, batida * 0.35 * sinal, batida * 0.15 * sinal);
    this.somarRotacao(vrm, `${this.ladoGesto}Hand` as VRMHumanBoneName, 0, 0, batida * 0.3 * sinal);
    this.somarRotacao(vrm, 'head', aceno * 0.08, 0, 0);
    this.somarRotacao(vrm, 'chest', aceno * 0.015, 0, 0);

    // Aceno de mão do cumprimento
    if (this.estaCumprimentando) {
      this.somarRotacao(vrm, 'rightHand', 0, 0, Math.sin(this.tempoAcumulado * 11) * 0.35);
      this.somarRotacao(vrm, 'rightLowerArm', 0, 0, Math.sin(this.tempoAcumulado * 11) * 0.12);
    }

    // A cabeça acompanha parte do olhar
    const cabeca = vrm.humanoid?.getNormalizedBoneNode('head');
    if (cabeca && this.camera) {
      const posCabeca = new THREE.Vector3();
      cabeca.getWorldPosition(posCabeca);
      const dir = this.alvoOlhar.position.clone().sub(posCabeca);
      const yaw = Math.atan2(dir.x, Math.max(0.05, dir.z));
      const pitch = Math.atan2(-dir.y, Math.hypot(dir.x, dir.z));
      const desvioCameraYaw = Math.atan2(this.camera.position.x - posCabeca.x, this.camera.position.z - posCabeca.z);
      const desvioCameraPitch = Math.atan2(
        -(this.camera.position.y - posCabeca.y),
        Math.hypot(this.camera.position.x - posCabeca.x, this.camera.position.z - posCabeca.z)
      );
      cabeca.rotation.y += (yaw - desvioCameraYaw) * 0.35;
      cabeca.rotation.x += (pitch - desvioCameraPitch) * 0.3;
    }
  }

  private aplicarDedos(vrm: VRM, delta: number): void {
    const fator = fatorSuavizacao(14, delta);
    for (const lado of ['left', 'right'] as const) {
      const curvas = this.curvaturaDedos[lado];
      const contando = this.dedosMostrando !== null && lado === this.ladoGesto;

      // Ordem de contagem: indicador, médio, anelar, mínimo, polegar
      for (let i = 0; i < 5; i++) {
        let alvo: number;
        if (contando) {
          alvo = i < this.dedosMostrando! || (i === 4 && this.dedosMostrando! >= 5) ? 0 : 1;
          if (i === 4 && this.dedosMostrando! < 5) alvo = 0.8;
        } else {
          // Mão relaxada: curvatura leve e crescente até o mínimo, com respiração sutil
          alvo = [0.12, 0.15, 0.18, 0.22, 0.1][i] + ruidoSuave(this.tempoAcumulado * 0.5, i * 3 + (lado === 'left' ? 1 : 2)) * 0.04;
        }
        curvas[i] += (alvo - curvas[i]) * fator;
      }

      const sinal = lado === 'right' ? 1 : -1;
      DEDOS.forEach((dedo, i) => {
        FALANGES.forEach((falange, j) => {
          const node = vrm.humanoid?.getNormalizedBoneNode(`${lado}${dedo}${falange}` as VRMHumanBoneName);
          if (node) node.rotation.set(0, 0, curvas[i] * (j === 0 ? 1.2 : 1.4) * sinal);
        });
      });
      (['Metacarpal', 'Proximal', 'Distal'] as const).forEach((falange, j) => {
        const node = vrm.humanoid?.getNormalizedBoneNode(`${lado}Thumb${falange}` as VRMHumanBoneName);
        if (node) node.rotation.set(0, curvas[4] * (j === 0 ? 0.5 : 0.8) * sinal, 0);
      });
    }
  }

  private atualizarOlhar(delta: number, reducedMotion: boolean): void {
    if (!this.camera) return;
    const destino = this.camera.position.clone();

    if (!reducedMotion) {
      // Sacadas: pequenos desvios do olhar em intervalos irregulares
      if (this.tempoAcumulado >= this.proximaSacadaSeg) {
        const amplitude = this.estadoAtual === 'listening' ? 0.03 : 0.07;
        this.desvioOlhar.set((Math.random() - 0.5) * amplitude * 2, (Math.random() - 0.5) * amplitude, 0);
        this.proximaSacadaSeg = this.tempoAcumulado + 0.8 + Math.random() * 2.2;

        // Falando, às vezes olha de relance para a lousa (RF09)
        if (this.estadoAtual === 'speaking' && this.pontoLousa && Math.random() < 0.2) {
          this.olhandoLousaAteSeg = this.tempoAcumulado + 0.9;
        }
      }

      if ((this.estaApontando || this.tempoAcumulado < this.olhandoLousaAteSeg) && this.pontoLousa) {
        destino.copy(this.pontoLousa);
      } else if (this.estadoAtual === 'thinking') {
        destino.add(new THREE.Vector3(-0.35, 0.35, 0)).add(this.desvioOlhar);
      } else {
        destino.add(this.desvioOlhar);
      }
    }

    this.alvoOlhar.position.lerp(destino, fatorSuavizacao(reducedMotion ? 20 : 9, delta));
  }

  /* ==========================================================================
     BOCA E EXPRESSÕES (RF05, RF10)
     ========================================================================== */
  private atualizarBoca(delta: number): void {
    const alvo: Record<string, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    const tRelMs = (this.tempoAcumulado - this.inicioPalavraSeg) * 1000;
    const segmento = this.sequenciaBoca.find(s => tRelMs >= s.inicioMs && tRelMs < s.inicioMs + s.duracaoMs);
    if (segmento && segmento.forma !== 'fechada') {
      // VRoid abre muito a boca em 1.0: limita a 0,8
      alvo[segmento.forma] = 0.35 + segmento.intensidade * 0.45;
    }

    const fator = fatorSuavizacao(28, delta);
    for (const exp of EXPRESSOES_BOCA) {
      this.pesosBoca[exp] += (alvo[exp] - this.pesosBoca[exp]) * fator;
      this.vrm?.expressionManager?.setValue(exp, this.pesosBoca[exp]);
    }
  }

  private atualizarExpressoes(delta: number): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;

    this.valorBlink += (this.blinkAlvo - this.valorBlink) * fatorSuavizacao(35, delta);
    em.setValue('blink', this.valorBlink);

    const alvo = EXPRESSOES_ESTADO[this.estadoAtual];
    const fator = fatorSuavizacao(4, delta);
    for (const chave of ['happy', 'relaxed', 'surprised'] as const) {
      this.expressoesAtuais[chave] += (alvo[chave] - this.expressoesAtuais[chave]) * fator;
      // O sorriso cede um pouco enquanto a boca forma vogais
      const valor = chave === 'happy' ? this.expressoesAtuais[chave] * (1 - Math.min(0.6, this.pesosBoca.aa + this.pesosBoca.oh)) : this.expressoesAtuais[chave];
      em.setValue(chave, valor);
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

    this.timerPiscada = setTimeout(() => this.executarPiscada(), intervalo);
  }

  private executarPiscada(): void {
    if (this.estaDestruido) return;
    this.blinkAlvo = 1.0;
    this.timerPiscada = setTimeout(() => {
      this.blinkAlvo = 0.0;

      // Chance de piscada dupla (~10%)
      if (Math.random() < this.config.chancePiscadaDupla) {
        this.timerPiscada = setTimeout(() => {
          this.blinkAlvo = 1.0;
          this.timerPiscada = setTimeout(() => {
            this.blinkAlvo = 0.0;
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
    const estadoAnterior = this.estadoAtual;
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
      this.elementos.micBotaoElemento.classList.toggle('recording', novoEstado === 'listening');
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

    if (novoEstado !== 'speaking') {
      this.emEnumeracao = false;
      this.mostrarDedos(null);
      // Troca de persona adiada até a fala terminar (RF07, CA11)
      if (this.personaPendente) {
        const pendente = this.personaPendente;
        this.personaPendente = null;
        void this.definirPersona(pendente);
      }
    }

    if (this.estaApontando || this.estaCumprimentando) return;

    if (novoEstado === 'idle') {
      this.pararFala();
      this.pararCicloGestosEspera();
      this.iniciarVariacoesRepouso();
    } else if (novoEstado === 'listening') {
      this.pararFala();
      this.pararCicloGestosEspera();
      this.pararVariacoesRepouso();
      this.poseAlvo = POSE_LISTENING;
    } else if (novoEstado === 'thinking') {
      this.pararFala();
      this.pararVariacoesRepouso();
      this.poseAlvo = POSE_THINKING;
      this.iniciarCicloGestosEspera();
    } else if (novoEstado === 'speaking') {
      this.pararCicloGestosEspera();
      this.pararVariacoesRepouso();
      if (estadoAnterior !== 'speaking' || !this.timerGesto) {
        this.iniciarLoopGestos();
      }
      this.iniciarFallbackBocaSeNecessario();
    }

    if (estadoAnterior !== novoEstado) {
      this.atualizarClipeDoEstado();
    }
  }

  private atualizarClipeDoEstado(): void {
    if (!this.clipes) return;
    const categoria = this.estadoAtual;
    // Na fala, o loop de gestos escolhe um clipe por frase
    if (categoria === 'speaking' && this.clipes.temCategoria('speaking')) return;
    if (!this.clipes.tocar(categoria) && categoria !== 'idle') {
      // Sem clipe para o estado: volta ao repouso se houver, ou à pose procedural
      if (!this.clipes.tocar('idle')) this.clipes.parar();
    }
  }

  private iniciarVariacoesRepouso(): void {
    this.pararVariacoesRepouso();
    this.poseAlvo = POSES_REPOUSO[this.indiceRepouso % POSES_REPOUSO.length];

    const agendar = () => {
      this.timerRepouso = setTimeout(() => {
        if (this.estadoAtual !== 'idle' || this.estaApontando || this.estaCumprimentando) return;
        this.indiceRepouso = (this.indiceRepouso + 1 + Math.floor(Math.random() * (POSES_REPOUSO.length - 1))) % POSES_REPOUSO.length;
        this.poseAlvo = POSES_REPOUSO[this.indiceRepouso];
        if (this.clipes?.obterCategoriaAtual() === 'idle') this.clipes.tocar('idle', 0.8);
        agendar();
      }, 6000 + Math.random() * 6000);
    };
    agendar();
  }

  private pararVariacoesRepouso(): void {
    if (this.timerRepouso) {
      clearTimeout(this.timerRepouso);
      this.timerRepouso = null;
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
    this.sequenciaBoca = gerarSequenciaBoca(palavra);
    this.inicioPalavraSeg = this.tempoAcumulado;

    if (this.prefereMovimentoReduzido() || this.estadoAtual !== 'speaking') return;

    // Contagem nos dedos em enumerações (CA06)
    const dedos = dedosParaPalavra(palavra, this.emEnumeracao);
    if (dedos !== null) {
      this.emEnumeracao = true;
      this.mostrarDedos(dedos);
    }

    // Batida do gesto em palavras longas ou acentuadas, como uma pessoa enfatizando
    if (palavra && (palavra.length >= 6 || /[áéíóúâêô]/i.test(palavra) || Math.random() < 0.25)) {
      this.molaBatida.impulsionar(-(2 + Math.random() * 2));
      if (Math.random() < 0.5) this.molaAceno.impulsionar(1.2 + Math.random());
    }
  }

  private mostrarDedos(quantidade: number | null): void {
    if (this.timerDedos) {
      clearTimeout(this.timerDedos);
      this.timerDedos = null;
    }
    this.dedosMostrando = quantidade;
    if (quantidade === null) return;

    if (!this.estaApontando) {
      this.ladoGesto = 'right';
      this.ultimoGesto = 'contar-dedos';
      this.poseAlvo = POSES_GESTOS_FALA['contar-dedos'];
      this.variacaoGesto = {};
    }
    // Mantém os dedos por 2,5 s; a enumeração continua se vier o próximo número
    this.timerDedos = setTimeout(() => {
      this.dedosMostrando = null;
    }, 2500);
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

    // Fecha a boca: a suavização leva a 0 em ~150 ms (CA08)
    this.sequenciaBoca = [];
    this.molaBatida.zerar();
    this.mostrarDedos(null);

    if (!this.estaApontando && this.estadoAtual === 'idle') {
      this.poseAlvo = POSES_REPOUSO[this.indiceRepouso % POSES_REPOUSO.length];
    }
  }

  private iniciarFallbackBocaSeNecessario(): void {
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);

    this.timerFallbackBoca = setInterval(() => {
      if (this.estadoAtual !== 'speaking') return;
      if (Date.now() - this.ultimoBoundaryTimestamp > 400) {
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
        this.timerGesto = null;
        return;
      }
      if (!this.estaApontando && !this.estaCumprimentando && this.dedosMostrando === null) {
        this.aplicarProximoGesto();
      }
    }, this.config.intervaloGestosMs);
  }

  private aplicarProximoGesto(): void {
    if (this.prefereMovimentoReduzido()) return;

    if (this.clipes?.temCategoria('speaking')) {
      this.clipes.tocar('speaking');
    }

    const proximo = sortearProximoGesto(this.ultimoGesto, this.persona?.pesosGestos);
    this.ultimoGesto = proximo;
    this.poseAlvo = POSES_GESTOS_FALA[proximo];

    // Variação aleatória pequena: o mesmo gesto nunca fica idêntico
    const v = () => (Math.random() - 0.5) * 0.16;
    this.variacaoGesto = {
      chest: { x: 0, y: v(), z: 0 },
      head: { x: v() * 0.5, y: v(), z: v() * 0.5 },
      leftUpperArm: { x: v(), y: v(), z: v() },
      rightUpperArm: { x: v(), y: v(), z: v() },
      leftLowerArm: { x: 0, y: v(), z: v() },
      rightLowerArm: { x: 0, y: v(), z: v() }
    };

    // Lado ativo: o braço mais levantado recebe as batidas
    const zEsq = Math.abs(this.poseAlvo.leftUpperArm?.z ?? 1.3);
    const zDir = Math.abs(this.poseAlvo.rightUpperArm?.z ?? 1.3);
    this.ladoGesto = zEsq < zDir ? 'left' : 'right';
  }

  /* ==========================================================================
     APONTAR PARA A LOUSA DIDÁTICA (RF08, CA11; RF01d e CA09 da spec de personas)
     ========================================================================== */
  apontarParaLousa(duracaoMs?: number, elementoAlvo?: HTMLElement | null): void {
    if (this.prefereMovimentoReduzido()) return;

    const tempo = duracaoMs || this.config.duracaoApontarMs;
    if (this.timerApontar) clearTimeout(this.timerApontar);
    this.estaApontando = true;
    this.mostrarDedos(null);

    const pose = this.calcularPoseParaElemento(elementoAlvo);
    if (pose) {
      this.poseAlvo = pose;
    } else {
      const ehMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      this.poseAlvo = obterPoseApontarLousa(ehMobile);
    }

    this.timerApontar = setTimeout(() => {
      this.estaApontando = false;
      if (this.estadoAtual === 'speaking') {
        this.aplicarProximoGesto();
      } else if (this.estadoAtual === 'thinking') {
        this.poseAlvo = POSE_THINKING;
      } else {
        this.poseAlvo = POSES_REPOUSO[this.indiceRepouso % POSES_REPOUSO.length];
      }
    }, tempo);
  }

  /**
   * Converte a posição do elemento na tela num ponto 3D à frente do personagem e calcula
   * a pose para olhar e apontar para ele. Retorna null sem elemento ou sem modelo.
   */
  private calcularPoseParaElemento(elemento?: HTMLElement | null): PoseVRM | null {
    const canvas = this.elementos.canvasElemento;
    if (!elemento || !canvas || !this.camera || !this.vrm) return null;

    const rEl = elemento.getBoundingClientRect();
    const rCanvas = canvas.getBoundingClientRect();
    if (rCanvas.width === 0 || rCanvas.height === 0 || (rEl.width === 0 && rEl.height === 0)) return null;

    const ndcX = ((rEl.left + rEl.width / 2 - rCanvas.left) / rCanvas.width) * 2 - 1;
    const ndcY = -(((rEl.top + rEl.height / 2 - rCanvas.top) / rCanvas.height) * 2 - 1);

    // Interseção do raio da câmera com o plano z = 0,35 (à frente do personagem)
    const ponto = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    const dir = ponto.sub(this.camera.position).normalize();
    const planoZ = 0.35;
    if (Math.abs(dir.z) < 1e-4) return null;
    const t = (planoZ - this.camera.position.z) / dir.z;
    const alvo = this.camera.position.clone().add(dir.multiplyScalar(t));
    // Fora da tela fica longe demais: limita a distância lateral e vertical
    alvo.x = THREE.MathUtils.clamp(alvo.x, -0.9, 0.9);
    alvo.y = THREE.MathUtils.clamp(alvo.y, 0.4, 1.8);
    this.pontoLousa = alvo.clone();

    const lado = alvo.x >= 0 ? 'left' : 'right';
    const ombro = this.vrm.humanoid?.getNormalizedBoneNode(`${lado}UpperArm`);
    const cabeca = this.vrm.humanoid?.getNormalizedBoneNode('head');
    if (!ombro || !cabeca) return null;

    const posOmbro = new THREE.Vector3();
    const posCabeca = new THREE.Vector3();
    ombro.getWorldPosition(posOmbro);
    cabeca.getWorldPosition(posCabeca);

    return calcularPoseApontar(
      { x: alvo.x - posOmbro.x, y: alvo.y - posOmbro.y, z: alvo.z - posOmbro.z },
      { x: alvo.x - posCabeca.x, y: alvo.y - posCabeca.y, z: alvo.z - posCabeca.z },
      alvo.x
    );
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
    if (!this.estaApontando && !this.estaCumprimentando) {
      this.poseAlvo = POSES_GESTOS_ESPERA[proximo];
    }
  }

  /* ==========================================================================
     PERSONAS (RF06 - RF08, CA10 - CA13)
     ========================================================================== */
  obterPersona(): Persona | null {
    return this.persona;
  }

  /**
   * Troca a persona. Durante a fala, a troca fica pendente até o fim (CA11).
   * Se o modelo da nova persona falhar, a atual continua (CA13).
   */
  async definirPersona(persona: Persona): Promise<void> {
    if (this.estaDestruido) return;
    if (this.persona?.id === persona.id && !this.personaPendente) return;

    if (this.estadoAtual === 'speaking' || this.trocandoPersona) {
      this.personaPendente = persona;
      return;
    }

    if (!this.estaInicializado) {
      this.persona = persona;
      return;
    }

    const url = obterModeloPersona(persona);
    const reducedMotion = this.prefereMovimentoReduzido();
    const mudaModelo = url !== this.modeloAtualUrl;

    let novoVrm: VRM | null = null;
    if (mudaModelo) {
      novoVrm = await this.carregarModeloComTimeout(url, this.config.tempoLimiteCarregamentoMs).catch(() => null);
      if (!novoVrm || this.estaDestruido) return;
    }

    this.trocandoPersona = true;
    const canvas = this.elementos.canvasElemento;
    try {
      if (mudaModelo && novoVrm) {
        if (canvas && !reducedMotion) {
          canvas.style.opacity = '0';
          await new Promise(r => setTimeout(r, 250));
        }
        this.persona = persona;
        this.instalarModelo(novoVrm, url);
        if (canvas) canvas.style.opacity = '1';
        void this.carregarClipes();
      } else {
        this.persona = persona;
      }
      this.atualizarRotuloAcessivel();
      if (!reducedMotion) this.cumprimentar();
    } finally {
      this.trocandoPersona = false;
    }

    // O estado pode ter mudado durante o carregamento
    if (this.personaPendente && this.obterEstado() !== 'speaking') {
      const pendente = this.personaPendente;
      this.personaPendente = null;
      await this.definirPersona(pendente);
    }
  }

  private cumprimentar(): void {
    if (this.clipes?.tocar('cumprimentar', 0.3)) {
      this.timerCumprimento = setTimeout(() => this.atualizarClipeDoEstado(), (this.clipes.duracaoAtual() || 1.5) * 1000);
      return;
    }
    if (this.timerCumprimento) clearTimeout(this.timerCumprimento);
    this.estaCumprimentando = true;
    this.poseAlvo = POSE_CUMPRIMENTAR;
    this.timerCumprimento = setTimeout(() => {
      this.estaCumprimentando = false;
      this.definirEstado(this.estadoAtual);
      if (this.estadoAtual === 'speaking') this.aplicarProximoGesto();
    }, 1300);
  }

  private atualizarRotuloAcessivel(): void {
    const canvas = this.elementos.canvasElemento;
    if (!canvas) return;
    canvas.setAttribute('aria-label', this.persona ? `Tutor ${descreverPersona(this.persona)}` : 'Avatar 3D do Tutor');
  }

  private pausarAnimacoes(): void {
    if (this.timerPiscada) clearTimeout(this.timerPiscada);
    if (this.timerGesto) clearInterval(this.timerGesto);
    if (this.timerFallbackBoca) clearInterval(this.timerFallbackBoca);
    if (this.timerGestoEspera) clearInterval(this.timerGestoEspera);
    this.timerGesto = null;
    this.timerFallbackBoca = null;
    this.timerGestoEspera = null;
    this.pararVariacoesRepouso();
  }

  private retomarAnimacoes(): void {
    this.iniciarLoopPiscadas();
    if (this.estadoAtual === 'speaking') {
      this.iniciarLoopGestos();
      this.iniciarFallbackBocaSeNecessario();
    } else if (this.estadoAtual === 'thinking') {
      this.iniciarCicloGestosEspera();
    } else if (this.estadoAtual === 'idle') {
      this.iniciarVariacoesRepouso();
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
    for (const t of [this.timerApontar, this.timerCumprimento, this.timerDedos]) {
      if (t) clearTimeout(t);
    }

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

    this.clipes?.destruir();
    this.clipes = null;

    // Libera geometrias, materiais e texturas de todos os modelos carregados
    for (const modelo of this.cacheModelos.values()) {
      VRMUtils.deepDispose(modelo.scene);
    }
    this.cacheModelos.clear();
    this.scene?.clear();

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
