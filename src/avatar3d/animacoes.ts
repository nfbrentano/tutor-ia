/**
 * TUTORIA - Clipes de Animação do Mixamo no Avatar VRM (RF02, RF03 da spec de personas)
 *
 * Os FBX do Mixamo ("Without Skin", 30 fps) e os clipes JSON do gravador de gestos
 * (SDD/2026-10-23_gravador-de-gestos.md) ficam em public/avatar/animacoes/ e são listados em
 * manifesto.json. A conversão de ossos Mixamo → VRM segue o exemplo oficial do three-vrm
 * (humanoidAnimation/loadMixamoAnimation.js). Sem manifesto, o avatar usa só o movimento procedural.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export type CategoriaClipe = 'idle' | 'listening' | 'thinking' | 'speaking' | 'apontar' | 'cumprimentar';

export interface ItemManifestoClipe {
  arquivo: string;
  categoria: CategoriaClipe;
  /** Clipes de um disparo (cumprimentar, apontar) não repetem. Padrão: true. */
  loop?: boolean;
  /** Só toca nestas personas; ausente = todas (RF10 do gravador). */
  personas?: string[];
}

export interface ManifestoClipes {
  clipes: ItemManifestoClipe[];
}

// FBX baixados uma vez e reaproveitados por todas as personas (RNF02)
const cacheFbx = new Map<string, Promise<THREE.Group>>();

function carregarFbx(url: string): Promise<THREE.Group> {
  let promessa = cacheFbx.get(url);
  if (!promessa) {
    promessa = new FBXLoader().loadAsync(url);
    promessa.catch(() => cacheFbx.delete(url));
    cacheFbx.set(url, promessa);
  }
  return promessa;
}

const CATEGORIAS_VALIDAS: CategoriaClipe[] = ['idle', 'listening', 'thinking', 'speaking', 'apontar', 'cumprimentar'];

/**
 * Valida o manifesto, descartando entradas inválidas em vez de falhar.
 */
export function validarManifestoClipes(dados: unknown): ManifestoClipes {
  const lista = (dados as ManifestoClipes | null)?.clipes;
  if (!Array.isArray(lista)) return { clipes: [] };
  return {
    clipes: lista.filter(
      (c): c is ItemManifestoClipe =>
        !!c &&
        typeof c.arquivo === 'string' &&
        /\.(fbx|json)$/i.test(c.arquivo) &&
        !c.arquivo.includes('..') &&
        !c.arquivo.includes('/') &&
        CATEGORIAS_VALIDAS.includes(c.categoria) &&
        (c.personas === undefined || (Array.isArray(c.personas) && c.personas.every(p => typeof p === 'string')))
    )
  };
}

/**
 * Itens que podem tocar na persona ativa: sem `personas` valem para todas (CA15 do gravador).
 */
export function filtrarClipesPorPersona<T extends { item: ItemManifestoClipe }>(clipes: T[], personaId: string | null): T[] {
  return clipes.filter(c => !c.item.personas || c.item.personas.length === 0 || (!!personaId && c.item.personas.includes(personaId)));
}

/** Arquivo de clipe gravado pelo gravador de gestos (RF08 do gravador). */
interface ClipeJson {
  formato: string;
  versao: number;
  fps: number;
  duracao: number;
  ossos: Record<string, number[]>;
}

/**
 * Monta um clipe do formato `tutoria-clipe-vrm` para os ossos normalizados deste VRM.
 * Retorna null se o arquivo não for desse formato ou não tiver ossos conhecidos.
 */
export function converterClipeJson(dados: unknown, vrm: VRM, nome: string): THREE.AnimationClip | null {
  const clipe = dados as ClipeJson | null;
  if (!clipe || clipe.formato !== 'tutoria-clipe-vrm' || clipe.versao !== 1 || !(clipe.fps > 0) || !clipe.ossos) {
    return null;
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const [osso, valores] of Object.entries(clipe.ossos)) {
    const no = vrm.humanoid?.getNormalizedBoneNode(osso as VRMHumanBoneName);
    if (!no || !Array.isArray(valores) || valores.length < 8 || valores.length % 4 !== 0) continue;
    const tempos = Array.from({ length: valores.length / 4 }, (_, i) => i / clipe.fps);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${no.name}.quaternion`, tempos, valores));
  }

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(nome, clipe.duracao, tracks);
}

/**
 * Sorteia um índice diferente do anterior quando há mais de uma opção (CA03).
 */
export function sortearIndiceSemRepetir(total: number, anterior: number | null): number {
  if (total <= 1) return 0;
  let indice = Math.floor(Math.random() * (total - 1));
  if (anterior !== null && indice >= anterior) indice++;
  return indice;
}

const MAPA_MIXAMO_VRM: Record<string, VRMHumanBoneName> = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes'
};

/**
 * Converte um FBX do Mixamo já carregado num clipe para os ossos normalizados do VRM.
 * Só as rotações são convertidas: o personagem fica parado no lugar (sem deslocar o quadril).
 */
export function converterClipeMixamo(asset: THREE.Group, vrm: VRM, nome: string): THREE.AnimationClip | null {
  const clipeOriginal =
    THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
  if (!clipeOriginal) return null;

  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const quat = new THREE.Quaternion();
  const ehVRM0 = vrm.meta?.metaVersion === '0';

  for (const track of clipeOriginal.tracks) {
    const [nomeOssoMixamo, propriedade] = track.name.split('.');
    if (propriedade !== 'quaternion' || !(track instanceof THREE.QuaternionKeyframeTrack)) continue;

    const ossoVRM = MAPA_MIXAMO_VRM[nomeOssoMixamo];
    const noVRM = ossoVRM ? vrm.humanoid?.getNormalizedBoneNode(ossoVRM) : null;
    const noMixamo = asset.getObjectByName(nomeOssoMixamo);
    if (!noVRM || !noMixamo || !noMixamo.parent) continue;

    noMixamo.getWorldQuaternion(restRotationInverse).invert();
    noMixamo.parent.getWorldQuaternion(parentRestWorldRotation);

    const valores = new Float32Array(track.values.length);
    for (let i = 0; i < track.values.length; i += 4) {
      quat.fromArray(track.values, i);
      quat.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
      quat.toArray(valores, i);
      if (ehVRM0) {
        valores[i] = -valores[i];
        valores[i + 2] = -valores[i + 2];
      }
    }

    tracks.push(new THREE.QuaternionKeyframeTrack(`${noVRM.name}.quaternion`, Array.from(track.times), Array.from(valores)));
  }

  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(nome, clipeOriginal.duration, tracks);
}

interface ClipeCarregado {
  item: ItemManifestoClipe;
  clipe: THREE.AnimationClip;
}

/**
 * Gerencia o AnimationMixer: um clipe por vez, com transição suave entre eles (RF03).
 */
export class GerenciadorClipes {
  private mixer: THREE.AnimationMixer;
  private clipes: ClipeCarregado[] = [];
  private acaoAtual: THREE.AnimationAction | null = null;
  private categoriaAtual: CategoriaClipe | null = null;
  private ultimoIndicePorCategoria = new Map<CategoriaClipe, number>();
  private personaId: string | null = null;

  constructor(private vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  /**
   * Carrega o manifesto e os FBX. Retorna quantos clipes ficaram disponíveis.
   * Erros (manifesto ausente, FBX inválido) só reduzem o número de clipes.
   */
  async carregar(pastaBase: string): Promise<number> {
    let manifesto: ManifestoClipes;
    try {
      const resposta = await fetch(`${pastaBase}/manifesto.json`, { cache: 'no-cache' });
      if (!resposta.ok) return 0;
      manifesto = validarManifestoClipes(await resposta.json());
    } catch {
      return 0;
    }

    const resultados = await Promise.allSettled(
      manifesto.clipes.map(async item => {
        const url = `${pastaBase}/${item.arquivo}`;
        let clipe: THREE.AnimationClip | null;
        if (/\.json$/i.test(item.arquivo)) {
          const resposta = await fetch(url, { cache: 'no-cache' });
          clipe = resposta.ok ? converterClipeJson(await resposta.json(), this.vrm, item.arquivo) : null;
        } else {
          clipe = converterClipeMixamo(await carregarFbx(url), this.vrm, item.arquivo);
        }
        return clipe ? { item, clipe } : null;
      })
    );

    for (const r of resultados) {
      if (r.status === 'fulfilled' && r.value) this.clipes.push(r.value);
    }
    return this.clipes.length;
  }

  /** Persona ativa: clipes gravados só para outras personas deixam de tocar (RF10 do gravador). */
  definirPersona(personaId: string | null): void {
    this.personaId = personaId;
  }

  private clipesDaPersona(): ClipeCarregado[] {
    return filtrarClipesPorPersona(this.clipes, this.personaId);
  }

  temCategoria(categoria: CategoriaClipe): boolean {
    return this.clipesDaPersona().some(c => c.item.categoria === categoria);
  }

  estaAtivo(): boolean {
    return this.acaoAtual !== null;
  }

  obterCategoriaAtual(): CategoriaClipe | null {
    return this.categoriaAtual;
  }

  /**
   * Toca um clipe da categoria, diferente do último tocado nela, com crossfade.
   * Retorna false se não há clipe da categoria.
   */
  tocar(categoria: CategoriaClipe, duracaoTransicaoSeg = 0.4): boolean {
    const opcoes = this.clipesDaPersona().filter(c => c.item.categoria === categoria);
    if (opcoes.length === 0) return false;

    const anterior = this.ultimoIndicePorCategoria.get(categoria) ?? null;
    const indice = sortearIndiceSemRepetir(opcoes.length, anterior);
    this.ultimoIndicePorCategoria.set(categoria, indice);

    const { item, clipe } = opcoes[indice];
    const novaAcao = this.mixer.clipAction(clipe);
    novaAcao.reset();
    novaAcao.setLoop(item.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    novaAcao.clampWhenFinished = item.loop === false;
    novaAcao.enabled = true;
    novaAcao.setEffectiveWeight(1);

    if (this.acaoAtual && this.acaoAtual !== novaAcao) {
      novaAcao.crossFadeFrom(this.acaoAtual, duracaoTransicaoSeg, true);
    } else {
      novaAcao.fadeIn(duracaoTransicaoSeg);
    }
    novaAcao.play();

    this.acaoAtual = novaAcao;
    this.categoriaAtual = categoria;
    return true;
  }

  /** Duração do clipe atual em segundos (0 se nenhum). */
  duracaoAtual(): number {
    return this.acaoAtual?.getClip().duration ?? 0;
  }

  parar(duracaoTransicaoSeg = 0.4): void {
    if (this.acaoAtual) {
      this.acaoAtual.fadeOut(duracaoTransicaoSeg);
      const acao = this.acaoAtual;
      setTimeout(() => acao.stop(), duracaoTransicaoSeg * 1000);
    }
    this.acaoAtual = null;
    this.categoriaAtual = null;
  }

  atualizar(deltaSeg: number): void {
    this.mixer.update(deltaSeg);
  }

  destruir(): void {
    this.mixer.stopAllAction();
    for (const { clipe } of this.clipes) {
      this.mixer.uncacheClip(clipe);
    }
    this.clipes = [];
    this.acaoAtual = null;
  }
}
