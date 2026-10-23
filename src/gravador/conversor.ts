/**
 * TUTORIA - Conversor Vetorial: pontos do MediaPipe → rotações dos ossos VRM (RF04, RF13)
 *
 * Decisão D01 da spec: em vez do Kalidokit, calcula a direção real de cada segmento e mira o
 * osso com `calcularRotacaoBracoParaDirecao`, a mesma função do apontar para a lousa.
 * Espaço do avatar: olha para +Z (para a câmera), direita da tela = +X, cima = +Y.
 */

import * as THREE from 'three';

import { calcularRotacaoBracoParaDirecao } from '../avatar3d/movimento';
import { OssoGravado, PontoMP, Quat, RotacoesQuadro } from './tipos';

// Índices do MediaPipe Pose
const NARIZ = 0;
const ORELHA_E = 7;
const ORELHA_D = 8;
const OMBRO_E = 11;
const OMBRO_D = 12;
const COTOVELO_E = 13;
const COTOVELO_D = 14;
const PUNHO_E = 15;
const PUNHO_D = 16;
const QUADRIL_E = 23;
const QUADRIL_D = 24;

/** Índices dos pontos da mão (MediaPipe Hand): base, articulações e ponta de cada dedo. */
const DEDOS_MAO: Record<'Index' | 'Middle' | 'Ring' | 'Little', number[]> = {
  Index: [5, 6, 7, 8],
  Middle: [9, 10, 11, 12],
  Ring: [13, 14, 15, 16],
  Little: [17, 18, 19, 20]
};
const POLEGAR = [1, 2, 3, 4];

export const VISIBILIDADE_MINIMA = 0.5;

/** Inclinação natural do nariz abaixo da linha das orelhas, descontada da cabeça. */
const PITCH_NEUTRO_CABECA = 0.3;

export interface OpcoesConversor {
  /** A mão direita da pessoa move a mão esquerda do avatar (RF06). */
  espelhar?: boolean;
  /** Rotação neutra da cabeça medida pelo botão "Calibrar" (substitui PITCH_NEUTRO_CABECA). */
  cabecaNeutra?: Quat;
}

export interface MaoDetectada {
  /** Pontos 3D da mão (worldLandmarks do Hand Landmarker). */
  mundo: PontoMP[];
  /** Pontos 2D normalizados, usados para ligar a mão ao punho do corpo. */
  imagem: PontoMP[];
}

export interface ResultadoConversao {
  rotacoes: RotacoesQuadro;
  /** Braços e tronco detectados com visibilidade suficiente. */
  corpoValido: boolean;
  baixaConfianca: boolean;
  /** Rotação da cabeça antes de descontar o neutro (para calibrar). */
  cabecaBruta?: Quat;
}

/** Converte um ponto do MediaPipe para o espaço do avatar. */
export function pontoParaAvatar(p: PontoMP, espelhar = false): THREE.Vector3 {
  return new THREE.Vector3(espelhar ? -p.x : p.x, -p.y, -p.z);
}

function quat(q: THREE.Quaternion): Quat {
  return [q.x, q.y, q.z, q.w];
}

function eulerParaQuat(r: { x: number; y: number; z: number }): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x, r.y, r.z, 'XYZ'));
}

/** Rotação que leva os eixos padrão (X, Y, Z) à base ortonormal (direita, cima, frente). */
function rotacaoDeBase(direita: THREE.Vector3, cima: THREE.Vector3): THREE.Quaternion {
  const x = direita.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, cima).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * Corrige a profundidade do antebraço muito encurtado na imagem (RF13): com uma câmera só,
 * apontar para a frente e para trás parecem iguais; o gesto de explicação é para a frente.
 */
export function corrigirProfundidade(
  dir: THREE.Vector3,
  comprimento2D: number,
  comprimentoReferencia2D: number
): { dir: THREE.Vector3; corrigido: boolean } {
  const encurtado = comprimentoReferencia2D > 0 && comprimento2D < comprimentoReferencia2D * 0.45;
  if (encurtado && dir.z < 0) {
    return { dir: new THREE.Vector3(dir.x, dir.y, -dir.z), corrigido: true };
  }
  return { dir, corrigido: encurtado };
}

/**
 * Curvatura de cada falange a partir dos pontos de um dedo: ângulo entre segmentos seguidos.
 */
export function curvaturasDedo(pontos: THREE.Vector3[], base: THREE.Vector3): number[] {
  const segs = [pontos[0].clone().sub(base), ...pontos.slice(1).map((p, i) => p.clone().sub(pontos[i]))];
  const curvas: number[] = [];
  for (let i = 1; i < segs.length; i++) {
    curvas.push(segs[i - 1].angleTo(segs[i]));
  }
  return curvas;
}

/**
 * Converte um quadro do MediaPipe em rotações locais dos ossos normalizados VRM.
 * `poseMundo`/`poseImagem`: worldLandmarks/landmarks do Pose Landmarker.
 */
export function converterQuadro(
  poseMundo: PontoMP[] | undefined,
  poseImagem: PontoMP[] | undefined,
  maos: MaoDetectada[] = [],
  opcoes: OpcoesConversor = {}
): ResultadoConversao {
  const rotacoes: RotacoesQuadro = {};
  if (!poseMundo || poseMundo.length < 25 || !poseImagem) {
    return { rotacoes, corpoValido: false, baixaConfianca: false };
  }

  const espelhar = !!opcoes.espelhar;
  // Sem espelho, o ombro esquerdo da pessoa (11) aparece à direita da imagem = lado esquerdo do avatar
  const idx = (esquerdo: number, direito: number) => (espelhar ? direito : esquerdo);
  const p = (i: number) => pontoParaAvatar(poseMundo[i], espelhar);
  const vis = (i: number) => poseMundo[i].visibility ?? 1;

  const essenciais = [OMBRO_E, OMBRO_D, COTOVELO_E, COTOVELO_D, PUNHO_E, PUNHO_D];
  const corpoValido = essenciais.every(i => vis(i) >= VISIBILIDADE_MINIMA);
  if (!corpoValido) {
    return { rotacoes, corpoValido: false, baixaConfianca: false };
  }

  // 1. Tronco: linha dos ombros e eixo quadril → ombros, repartido entre spine e chest
  const ombroE = p(idx(OMBRO_E, OMBRO_D));
  const ombroD = p(idx(OMBRO_D, OMBRO_E));
  const quadrilE = p(idx(QUADRIL_E, QUADRIL_D));
  const quadrilD = p(idx(QUADRIL_D, QUADRIL_E));
  const meioOmbros = ombroE.clone().add(ombroD).multiplyScalar(0.5);
  const meioQuadris = quadrilE.clone().add(quadrilD).multiplyScalar(0.5);
  const temQuadril = vis(QUADRIL_E) >= VISIBILIDADE_MINIMA && vis(QUADRIL_D) >= VISIBILIDADE_MINIMA;
  const cimaTronco = temQuadril ? meioOmbros.clone().sub(meioQuadris) : new THREE.Vector3(0, 1, 0);
  const qTronco = rotacaoDeBase(ombroE.clone().sub(ombroD), cimaTronco);
  // O MediaPipe vê o tronco ~10° inclinado para a frente mesmo com a pessoa reta, e a linha dos
  // ombros entorta quando um braço sobe (autoteste): braços e cabeça usam o tronco medido, mas o
  // avatar só recebe o giro do tronco
  // avatar só recebe o giro do tronco. A referência dos braços desconta giro e inclinação para a
  // frente (viés), mas não o tombo lateral (ruído do ombro levantado).
  const eulerTronco = new THREE.Euler().setFromQuaternion(qTronco, 'YXZ');
  const qTroncoAplicado = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), eulerTronco.y);
  const qReferencia = new THREE.Quaternion().setFromEuler(new THREE.Euler(eulerTronco.x, eulerTronco.y, 0, 'YXZ'));
  const qMeioTronco = new THREE.Quaternion().slerp(qTroncoAplicado, 0.5);
  rotacoes.spine = quat(qMeioTronco);
  rotacoes.chest = quat(qMeioTronco);
  const qTroncoInv = qReferencia.clone().invert();

  // 2. Braços e antebraços, no espaço do tronco
  let baixaConfianca = false;
  const img = (i: number) => new THREE.Vector2(espelhar ? 1 - poseImagem[i].x : poseImagem[i].x, poseImagem[i].y);
  const lados = [
    { lado: 'left' as const, ombro: idx(OMBRO_E, OMBRO_D), cotovelo: idx(COTOVELO_E, COTOVELO_D), punho: idx(PUNHO_E, PUNHO_D) },
    { lado: 'right' as const, ombro: idx(OMBRO_D, OMBRO_E), cotovelo: idx(COTOVELO_D, COTOVELO_E), punho: idx(PUNHO_D, PUNHO_E) }
  ];
  const qAntebracoMundo: Record<'left' | 'right', THREE.Quaternion> = {
    left: new THREE.Quaternion(),
    right: new THREE.Quaternion()
  };

  for (const { lado, ombro, cotovelo, punho } of lados) {
    const dirBraco = p(cotovelo).sub(p(ombro)).normalize().applyQuaternion(qTroncoInv);
    const qBraco = eulerParaQuat(calcularRotacaoBracoParaDirecao(lado, dirBraco));
    rotacoes[`${lado}UpperArm`] = quat(qBraco);

    const correcao = corrigirProfundidade(
      p(punho).sub(p(cotovelo)).normalize(),
      img(punho).distanceTo(img(cotovelo)),
      img(cotovelo).distanceTo(img(ombro))
    );
    if (correcao.corrigido) baixaConfianca = true;
    const qBracoMundo = qReferencia.clone().multiply(qBraco);
    const dirAnte = correcao.dir.clone().applyQuaternion(qBracoMundo.clone().invert());
    const qAnte = eulerParaQuat(calcularRotacaoBracoParaDirecao(lado, dirAnte));
    rotacoes[`${lado}LowerArm`] = quat(qAnte);
    qAntebracoMundo[lado] = qBracoMundo.multiply(qAnte);
  }

  // 3. Cabeça: base formada pelas orelhas (direita) e pelo nariz (frente)
  let cabecaBruta: Quat | undefined;
  if ([NARIZ, ORELHA_E, ORELHA_D].every(i => vis(i) >= VISIBILIDADE_MINIMA)) {
    const orelhaE = p(idx(ORELHA_E, ORELHA_D));
    const orelhaD = p(idx(ORELHA_D, ORELHA_E));
    const direita = orelhaE.clone().sub(orelhaD).normalize();
    const frente = p(NARIZ).sub(orelhaE.clone().add(orelhaD).multiplyScalar(0.5));
    const cima = new THREE.Vector3().crossVectors(frente, direita);
    const qCabecaMundo = rotacaoDeBase(direita, cima);
    const qCabecaLocal = qTroncoInv.clone().multiply(qCabecaMundo);
    cabecaBruta = quat(qCabecaLocal);

    const neutra = opcoes.cabecaNeutra
      ? new THREE.Quaternion(...opcoes.cabecaNeutra)
      : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PITCH_NEUTRO_CABECA);
    const qRel = neutra.clone().invert().multiply(qCabecaLocal);
    const qPescoco = new THREE.Quaternion().slerp(qRel, 0.4);
    rotacoes.neck = quat(qPescoco);
    rotacoes.head = quat(qPescoco.clone().invert().multiply(qRel));
  }

  // 4. Mãos e dedos: cada mão é ligada ao punho do corpo mais próximo na imagem
  for (const mao of maos) {
    if (!mao.mundo?.length || !mao.imagem?.length) continue;
    const punhoMao = new THREE.Vector2(espelhar ? 1 - mao.imagem[0].x : mao.imagem[0].x, mao.imagem[0].y);
    const distE = punhoMao.distanceTo(img(idx(PUNHO_E, PUNHO_D)));
    const distD = punhoMao.distanceTo(img(idx(PUNHO_D, PUNHO_E)));
    const lado: 'left' | 'right' = distE <= distD ? 'left' : 'right';
    const m = (i: number) => pontoParaAvatar(mao.mundo[i], espelhar);

    // Punho: direção punho → base do dedo médio, no espaço do antebraço
    const dirMao = m(9).sub(m(0)).normalize().applyQuaternion(qAntebracoMundo[lado].clone().invert());
    rotacoes[`${lado}Hand`] = quat(eulerParaQuat(calcularRotacaoBracoParaDirecao(lado, dirMao)));

    // Dedos: curvatura de cada falange no mesmo eixo de aplicarDedos do avatar
    const sinal = lado === 'right' ? 1 : -1;
    for (const [dedo, indices] of Object.entries(DEDOS_MAO)) {
      const curvas = curvaturasDedo(indices.map(m), m(0));
      (['Proximal', 'Intermediate', 'Distal'] as const).forEach((falange, j) => {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), curvas[j] * sinal);
        rotacoes[`${lado}${dedo}${falange}` as OssoGravado] = quat(q);
      });
    }
    const curvasPolegar = curvaturasDedo(POLEGAR.map(m), m(0));
    (['Metacarpal', 'Proximal', 'Distal'] as const).forEach((falange, j) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), curvasPolegar[j] * 0.6 * sinal);
      rotacoes[`${lado}Thumb${falange}` as OssoGravado] = quat(q);
    });
  }

  return { rotacoes, corpoValido: true, baixaConfianca, cabecaBruta };
}
