/**
 * TUTORIA - Tipos e Interfaces do Avatar 3D (Three.js + VRM)
 */

import { AvatarConfig, AvatarElementos, CONFIG_AVATAR_PADRAO } from '../avatar/tipos';

export type VogalVRM = 'aa' | 'ih' | 'ou' | 'ee' | 'oh';

export interface Avatar3DConfig extends AvatarConfig {
  caminhoModelo: string;
  tempoLimiteCarregamentoMs: number;
  duracaoTransicaoMs: number;
  fpsLimiteRepouso: number;
  fpsLimiteFala: number;
}

export const CONFIG_AVATAR_3D_PADRAO: Avatar3DConfig = {
  ...CONFIG_AVATAR_PADRAO,
  caminhoModelo: './avatar/tutor.vrm',
  tempoLimiteCarregamentoMs: 10000,
  duracaoTransicaoMs: 350,
  fpsLimiteRepouso: 30,
  fpsLimiteFala: 60
};

export interface RotacaoOsso {
  x: number;
  y: number;
  z: number;
}

export interface PoseVRM {
  chest?: RotacaoOsso;
  spine?: RotacaoOsso;
  neck?: RotacaoOsso;
  head?: RotacaoOsso;
  leftUpperArm?: RotacaoOsso;
  leftLowerArm?: RotacaoOsso;
  leftHand?: RotacaoOsso;
  rightUpperArm?: RotacaoOsso;
  rightLowerArm?: RotacaoOsso;
  rightHand?: RotacaoOsso;
}

export interface Avatar3DElementos extends AvatarElementos {
  canvasElemento: HTMLCanvasElement | null;
}
