/**
 * TUTORIA - Catálogo de Poses e Rotações de Ossos para VRM (RF06, RF07, RF08)
 * Define os ângulos de rotação (Euler XYZ em radianos) para os ossos humanoides VRM normalizados.
 *
 * Guia de eixos (validado no navegador; o personagem olha para +Z):
 * - upperArm.z: braço direito +1.3 / esquerdo -1.3 = braço caído; perto de 0 = braço na horizontal.
 * - upperArm.x: negativo leva o braço para a frente.
 * - lowerArm.y: dobra o cotovelo para a frente (direito positivo, esquerdo negativo).
 * - lowerArm.x: gira o antebraço em torno do braço (desloca a mão para dentro/fora); evitar.
 * - lowerArm.z: com o braço na horizontal, levanta o antebraço (direito negativo).
 * - head/neck.x positivo olha para baixo; y positivo vira para a esquerda do personagem (+X).
 */

import { GestoEsperaTipo, GestoTipo } from '../avatar/tipos';
import { calcularPoseApontar } from './movimento';
import { PoseVRM } from './tipos';

const ZERO = { x: 0, y: 0, z: 0 };

/** Braços caídos e relaxados, cotovelos levemente dobrados. */
const BRACOS_RELAXADOS: PoseVRM = {
  leftUpperArm: { x: 0.02, y: 0, z: -1.28 },
  leftLowerArm: { x: 0, y: -0.25, z: 0 },
  leftHand: { x: 0, y: 0, z: -0.1 },
  rightUpperArm: { x: 0.02, y: 0, z: 1.28 },
  rightLowerArm: { x: 0, y: 0.25, z: 0 },
  rightHand: { x: 0, y: 0, z: 0.1 }
};

/**
 * Pose padrão de repouso (idle vivo e amigável)
 */
export const POSE_IDLE: PoseVRM = {
  hips: ZERO,
  chest: ZERO,
  spine: ZERO,
  neck: ZERO,
  head: ZERO,
  ...BRACOS_RELAXADOS
};

/**
 * Variações de repouso, alternadas a cada 6–12 s para o personagem não congelar (RF03).
 */
export const POSES_REPOUSO: PoseVRM[] = [
  POSE_IDLE,
  {
    // Mãos juntas à frente da barriga
    hips: ZERO,
    chest: { x: 0.02, y: 0, z: 0 },
    spine: ZERO,
    neck: ZERO,
    head: { x: 0.03, y: 0, z: 0 },
    leftUpperArm: { x: -0.05, y: -0.3, z: -1.3 },
    leftLowerArm: { x: 0, y: -1.45, z: 0 },
    leftHand: ZERO,
    rightUpperArm: { x: -0.05, y: 0.3, z: 1.3 },
    rightLowerArm: { x: 0, y: 1.45, z: 0 },
    rightHand: ZERO
  },
  {
    // Peso numa perna, uma mão relaxada à frente
    hips: { x: 0, y: 0.04, z: 0.05 },
    chest: { x: 0, y: -0.04, z: -0.03 },
    spine: { x: 0, y: -0.02, z: -0.03 },
    neck: { x: 0, y: 0, z: 0.02 },
    head: { x: 0, y: 0.04, z: 0.03 },
    leftUpperArm: { x: 0.02, y: 0, z: -1.28 },
    leftLowerArm: { x: 0, y: -0.2, z: 0 },
    leftHand: { x: 0, y: 0, z: -0.1 },
    rightUpperArm: { x: -0.15, y: 0.2, z: 1.28 },
    rightLowerArm: { x: 0, y: 1.2, z: 0 },
    rightHand: ZERO
  }
];

/**
 * Cumprimento ao trocar de persona (RF07): mão direita levantada; o aceno é procedural.
 */
export const POSE_CUMPRIMENTAR: PoseVRM = {
  chest: { x: 0, y: 0.05, z: 0 },
  neck: ZERO,
  head: { x: 0.04, y: 0, z: 0.06 },
  leftUpperArm: { x: 0.02, y: 0, z: -1.28 },
  leftLowerArm: { x: 0, y: -0.25, z: 0 },
  leftHand: ZERO,
  rightUpperArm: { x: -0.35, y: 0.5, z: 0.8 },
  rightLowerArm: { x: 0, y: 0, z: -2.0 },
  rightHand: ZERO
};

/**
 * Pose de escuta atenta (listening): cabeça inclinada, mãos juntas à frente
 */
export const POSE_LISTENING: PoseVRM = {
  hips: ZERO,
  chest: { x: -0.04, y: 0, z: 0 },
  spine: { x: -0.03, y: 0, z: 0 },
  neck: { x: 0.04, y: -0.04, z: 0.06 },
  head: { x: 0.06, y: -0.06, z: 0.08 },
  leftUpperArm: { x: -0.05, y: -0.3, z: -1.3 },
  leftLowerArm: { x: 0, y: -1.4, z: 0 },
  leftHand: ZERO,
  rightUpperArm: { x: -0.05, y: 0.3, z: 1.3 },
  rightLowerArm: { x: 0, y: 1.4, z: 0 },
  rightHand: ZERO
};

/**
 * Pose de reflexão / pensando (thinking): mão direita no queixo, outro braço apoiando
 */
export const POSE_THINKING: PoseVRM = {
  hips: ZERO,
  chest: { x: -0.04, y: 0.05, z: 0 },
  spine: { x: -0.02, y: 0.04, z: 0 },
  neck: { x: -0.06, y: 0.1, z: 0.05 },
  head: { x: -0.08, y: 0.12, z: 0.06 },
  leftUpperArm: { x: -0.3, y: 0, z: -1.2 },
  leftLowerArm: { x: 0, y: -1.55, z: 0 },
  leftHand: ZERO,
  rightUpperArm: { x: -0.75, y: 0.2, z: 1.35 },
  rightLowerArm: { x: 0, y: 2.5, z: 0 },
  rightHand: { x: 0, y: 0, z: 0.4 }
};

/**
 * Poses dos Gestos durante a fala (speaking): mãos à frente do corpo, visíveis no enquadramento
 */
export const POSES_GESTOS_FALA: Record<GestoTipo, PoseVRM> = {
  'palmas-abertas': {
    chest: { x: -0.02, y: 0, z: 0 },
    neck: { x: 0.02, y: 0, z: 0 },
    head: { x: 0.04, y: 0, z: 0 },
    leftUpperArm: { x: -0.35, y: 0, z: -1.15 },
    leftLowerArm: { x: 0, y: -1.3, z: 0 },
    leftHand: { x: -0.6, y: 0, z: 0 },
    rightUpperArm: { x: -0.35, y: 0, z: 1.15 },
    rightLowerArm: { x: 0, y: 1.3, z: 0 },
    rightHand: { x: -0.6, y: 0, z: 0 }
  },
  'enfatizar': {
    chest: { x: -0.05, y: -0.08, z: 0 },
    neck: { x: 0.02, y: -0.05, z: 0 },
    head: { x: 0.05, y: -0.08, z: 0 },
    leftUpperArm: { x: 0.02, y: 0, z: -1.25 },
    leftLowerArm: { x: 0, y: -0.4, z: 0 },
    leftHand: ZERO,
    rightUpperArm: { x: -0.55, y: 0, z: 1.05 },
    rightLowerArm: { x: 0, y: 1.5, z: 0 },
    rightHand: { x: 0, y: 0, z: 0.2 }
  },
  'mao-no-peito': {
    chest: { x: -0.03, y: 0.04, z: 0 },
    neck: { x: 0.04, y: 0.04, z: 0 },
    head: { x: 0.06, y: 0.05, z: 0.04 },
    leftUpperArm: { x: -0.45, y: 0, z: -1.2 },
    leftLowerArm: { x: 0, y: -2.0, z: 0 },
    leftHand: ZERO,
    rightUpperArm: { x: -0.2, y: 0, z: 1.2 },
    rightLowerArm: { x: 0, y: 0.9, z: 0 },
    rightHand: ZERO
  },
  'contar-dedos': {
    chest: { x: -0.02, y: -0.05, z: 0 },
    neck: { x: 0.02, y: -0.03, z: 0 },
    head: { x: 0.03, y: -0.04, z: 0 },
    leftUpperArm: { x: -0.2, y: 0, z: -1.2 },
    leftLowerArm: { x: 0, y: -1.0, z: 0 },
    leftHand: ZERO,
    rightUpperArm: { x: -0.4, y: 0, z: 1.1 },
    rightLowerArm: { x: 0, y: 1.5, z: 0 },
    rightHand: ZERO
  }
};

/**
 * Poses dos Gestos de Espera Ativa
 */
export const POSES_GESTOS_ESPERA: Record<GestoEsperaTipo, PoseVRM> = {
  'olhar-cima': {
    chest: { x: -0.06, y: 0, z: 0 },
    neck: { x: -0.18, y: 0.12, z: 0 },
    head: { x: -0.22, y: 0.15, z: 0 },
    ...BRACOS_RELAXADOS
  },
  'pensativo': POSE_THINKING,
  'postura-atenta': {
    chest: { x: -0.08, y: -0.04, z: 0 },
    spine: { x: -0.04, y: -0.02, z: 0 },
    neck: { x: 0.06, y: -0.04, z: 0 },
    head: { x: 0.08, y: -0.05, z: 0 },
    leftUpperArm: { x: -0.05, y: -0.3, z: -1.3 },
    leftLowerArm: { x: 0, y: -1.45, z: 0 },
    leftHand: ZERO,
    rightUpperArm: { x: -0.05, y: 0.3, z: 1.3 },
    rightLowerArm: { x: 0, y: 1.45, z: 0 },
    rightHand: ZERO
  }
};

/**
 * Pose de apontar sem posição real do elemento (plano B do CA09).
 * Desktop: lousa à direita da tela (+X, lado esquerdo do personagem) → aponta com o braço esquerdo.
 * Mobile: lousa abaixo → aponta para baixo e para a frente com o braço direito.
 */
export function obterPoseApontarLousa(ehMobile: boolean): PoseVRM {
  if (ehMobile) {
    return calcularPoseApontar({ x: 0.1, y: -0.5, z: 0.6 }, { x: 0, y: -0.7, z: 0.8 }, -0.01);
  }
  return calcularPoseApontar({ x: 0.7, y: 0.05, z: 0.5 }, { x: 0.8, y: -0.1, z: 0.6 }, 1);
}
