/**
 * TUTORIA - Catálogo de Poses e Rotações de Ossos para VRM (RF06, RF07, RF08)
 * Define os ângulos de rotação (Euler em radianos) para os ossos humanoides VRM.
 */

import { GestoEsperaTipo, GestoTipo } from '../avatar/tipos';
import { PoseVRM } from './tipos';

/**
 * Pose padrão de repouso (idle vivo e amigável)
 */
export const POSE_IDLE: PoseVRM = {
  chest: { x: 0, y: 0, z: 0 },
  spine: { x: 0, y: 0, z: 0 },
  neck: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 0, z: 0 },
  leftUpperArm: { x: 0.05, y: 0.05, z: -1.3 },
  leftLowerArm: { x: 0.25, y: 0, z: -0.15 },
  leftHand: { x: 0, y: 0, z: 0 },
  rightUpperArm: { x: 0.05, y: -0.05, z: 1.3 },
  rightLowerArm: { x: 0.25, y: 0, z: 0.15 },
  rightHand: { x: 0, y: 0, z: 0 }
};

/**
 * Pose de escuta atenta (listening)
 */
export const POSE_LISTENING: PoseVRM = {
  chest: { x: -0.04, y: 0, z: 0 },
  spine: { x: -0.03, y: 0, z: 0 },
  neck: { x: 0.04, y: -0.04, z: 0.06 },
  head: { x: 0.06, y: -0.06, z: 0.08 },
  leftUpperArm: { x: 0.08, y: 0.05, z: -1.2 },
  leftLowerArm: { x: 0.25, y: 0, z: -0.15 },
  leftHand: { x: 0, y: 0, z: 0 },
  rightUpperArm: { x: 0.08, y: -0.05, z: 1.2 },
  rightLowerArm: { x: 0.25, y: 0, z: 0.15 },
  rightHand: { x: 0, y: 0, z: 0 }
};

/**
 * Pose de reflexão / pensando (thinking - mão suave no queixo)
 */
export const POSE_THINKING: PoseVRM = {
  chest: { x: -0.04, y: 0.05, z: 0 },
  spine: { x: -0.02, y: 0.04, z: 0 },
  neck: { x: -0.06, y: 0.1, z: 0.05 },
  head: { x: -0.08, y: 0.12, z: 0.06 },
  leftUpperArm: { x: 0.08, y: 0.05, z: -1.25 },
  leftLowerArm: { x: 0.3, y: 0, z: -0.15 },
  leftHand: { x: 0, y: 0, z: 0 },
  rightUpperArm: { x: -0.65, y: -0.35, z: 0.65 },
  rightLowerArm: { x: 1.25, y: 0.2, z: 0.75 },
  rightHand: { x: 0.1, y: 0.2, z: 0.1 }
};

/**
 * Poses dos Gestos durante a fala (speaking)
 */
export const POSES_GESTOS_FALA: Record<GestoTipo, PoseVRM> = {
  'palmas-abertas': {
    chest: { x: -0.02, y: 0, z: 0 },
    neck: { x: 0.02, y: 0, z: 0 },
    head: { x: 0.04, y: 0, z: 0 },
    leftUpperArm: { x: -0.3, y: 0.25, z: -0.75 },
    leftLowerArm: { x: 0.85, y: 0, z: -0.4 },
    leftHand: { x: 0.1, y: 0.3, z: 0 },
    rightUpperArm: { x: -0.3, y: -0.25, z: 0.75 },
    rightLowerArm: { x: 0.85, y: 0, z: 0.4 },
    rightHand: { x: 0.1, y: -0.3, z: 0 }
  },
  'enfatizar': {
    chest: { x: -0.05, y: -0.08, z: 0 },
    neck: { x: 0.02, y: -0.05, z: 0 },
    head: { x: 0.05, y: -0.08, z: 0 },
    leftUpperArm: { x: 0.1, y: 0, z: -1.15 },
    leftLowerArm: { x: 0.3, y: 0, z: -0.15 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: -0.55, y: -0.15, z: 0.6 },
    rightLowerArm: { x: 1.05, y: 0.1, z: 0.2 },
    rightHand: { x: 0.2, y: 0.1, z: 0 }
  },
  'mao-no-peito': {
    chest: { x: -0.03, y: 0.04, z: 0 },
    neck: { x: 0.04, y: 0.04, z: 0 },
    head: { x: 0.06, y: 0.05, z: 0.04 },
    leftUpperArm: { x: -0.4, y: 0.4, z: -0.55 },
    leftLowerArm: { x: 1.25, y: -0.1, z: -0.6 },
    leftHand: { x: 0.1, y: 0.2, z: 0 },
    rightUpperArm: { x: 0.15, y: 0, z: 1.15 },
    rightLowerArm: { x: 0.3, y: 0, z: 0.15 },
    rightHand: { x: 0, y: 0, z: 0 }
  },
  'contar-dedos': {
    chest: { x: -0.02, y: -0.05, z: 0 },
    neck: { x: 0.02, y: -0.03, z: 0 },
    head: { x: 0.03, y: -0.04, z: 0 },
    leftUpperArm: { x: 0.1, y: 0, z: -1.15 },
    leftLowerArm: { x: 0.35, y: 0, z: -0.15 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: -0.5, y: -0.2, z: 0.65 },
    rightLowerArm: { x: 1.25, y: 0.15, z: 0.35 },
    rightHand: { x: 0.15, y: 0.1, z: 0.05 }
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
    leftUpperArm: { x: 0.1, y: 0, z: -1.2 },
    leftLowerArm: { x: 0.25, y: 0, z: -0.1 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: 0.15, y: 0, z: 1.15 },
    rightLowerArm: { x: 0.45, y: 0, z: 0.2 },
    rightHand: { x: 0, y: 0, z: 0 }
  },
  'pensativo': {
    chest: { x: -0.04, y: 0.08, z: 0 },
    neck: { x: -0.05, y: 0.1, z: 0.06 },
    head: { x: -0.1, y: 0.12, z: 0.08 },
    leftUpperArm: { x: 0.15, y: 0, z: -1.15 },
    leftLowerArm: { x: 0.35, y: 0, z: -0.2 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: -0.55, y: -0.35, z: 0.5 },
    rightLowerArm: { x: 1.2, y: 0.15, z: 0.65 },
    rightHand: { x: 0.1, y: 0.15, z: 0.05 }
  },
  'postura-atenta': {
    chest: { x: -0.08, y: -0.04, z: 0 },
    spine: { x: -0.04, y: -0.02, z: 0 },
    neck: { x: 0.06, y: -0.04, z: 0 },
    head: { x: 0.08, y: -0.05, z: 0 },
    leftUpperArm: { x: 0.1, y: 0, z: -1.1 },
    leftLowerArm: { x: 0.4, y: 0, z: -0.2 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: 0.1, y: 0, z: 1.1 },
    rightLowerArm: { x: 0.4, y: 0, z: 0.2 },
    rightHand: { x: 0, y: 0, z: 0 }
  }
};

/**
 * Retorna a pose para apontar na direção da lousa escolar.
 * Se a tela for mobile (lousa abaixo), aponta para baixo/frente.
 * Se desktop (lousa ao lado direito), aponta estendendo o braço para a direita.
 */
export function obterPoseApontarLousa(ehMobile: boolean): PoseVRM {
  if (ehMobile) {
    return {
      chest: { x: -0.08, y: 0, z: 0 },
      spine: { x: -0.04, y: 0, z: 0 },
      neck: { x: 0.12, y: 0, z: 0 },
      head: { x: 0.15, y: 0, z: 0 },
      leftUpperArm: { x: 0.1, y: 0, z: -1.2 },
      leftLowerArm: { x: 0.2, y: 0, z: -0.1 },
      leftHand: { x: 0, y: 0, z: 0 },
      rightUpperArm: { x: -0.4, y: 0, z: 0.6 },
      rightLowerArm: { x: 0.6, y: 0, z: 0.15 },
      rightHand: { x: 0.25, y: 0, z: 0 }
    };
  } else {
    // Desktop: aponta para a direita (onde fica a lousa)
    return {
      chest: { x: 0, y: -0.25, z: 0 },
      spine: { x: 0, y: -0.15, z: 0 },
      neck: { x: 0, y: -0.2, z: 0 },
      head: { x: 0, y: -0.15, z: 0 },
      leftUpperArm: { x: 0.1, y: 0, z: -1.2 },
      leftLowerArm: { x: 0.2, y: 0, z: -0.1 },
      leftHand: { x: 0, y: 0, z: 0 },
      rightUpperArm: { x: -0.7, y: -0.3, z: 0.9 },
      rightLowerArm: { x: 0.25, y: 0, z: 0.05 },
      rightHand: { x: 0.15, y: -0.1, z: 0 }
    };
  }
}
