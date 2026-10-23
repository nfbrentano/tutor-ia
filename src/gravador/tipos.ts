/**
 * TUTORIA - Tipos do Gravador de Gestos
 * Spec: SDD/2026-10-23_gravador-de-gestos.md
 */

import type { CategoriaClipe } from '../avatar3d/animacoes';

/** Ponto 3D do MediaPipe (x para a direita da imagem, y para baixo, z negativo = perto da câmera). */
export interface PontoMP {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Quatérnio [x, y, z, w]. */
export type Quat = [number, number, number, number];

/** Ossos humanoides VRM gravados pelo conversor (RF04). */
export const OSSOS_GRAVADOS = [
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  ...(['left', 'right'] as const).flatMap(lado => [
    ...(['Index', 'Middle', 'Ring', 'Little'] as const).flatMap(dedo =>
      (['Proximal', 'Intermediate', 'Distal'] as const).map(f => `${lado}${dedo}${f}`)
    ),
    ...(['Metacarpal', 'Proximal', 'Distal'] as const).map(f => `${lado}Thumb${f}`)
  ])
] as const;

export type OssoGravado = (typeof OSSOS_GRAVADOS)[number];

export type RotacoesQuadro = Partial<Record<OssoGravado, Quat>>;

export interface QuadroGravado {
  /** Segundos desde o início da gravação. */
  t: number;
  rotacoes: RotacoesQuadro;
  /** Corpo não detectado neste quadro: a pose anterior foi mantida (RF05). */
  falha: boolean;
  /** Profundidade incerta corrigida pelo conversor (RF13). */
  baixaConfianca: boolean;
}

/** Formato do arquivo de clipe (RF08). */
export interface ClipeVRMJson {
  formato: 'tutoria-clipe-vrm';
  versao: 1;
  nome: string;
  categoria: CategoriaClipe;
  loop: boolean;
  fps: number;
  duracao: number;
  personas?: string[];
  ossos: Partial<Record<OssoGravado, number[]>>;
}
