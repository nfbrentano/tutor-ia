/**
 * TUTORIA - Tipos e Interfaces do Avatar com Movimentos Humanos
 */

export type AvatarEstado = 'idle' | 'listening' | 'thinking' | 'speaking';

export type GestoTipo = 'palmas-abertas' | 'enfatizar' | 'contar-dedos' | 'mao-no-peito';

export interface AvatarElementos {
  moduloElemento: HTMLElement | null;
  statusTextoElemento: HTMLElement | null;
  micBotaoElemento?: HTMLElement | null;
  micDicaElemento?: HTMLElement | null;
}

export interface AvatarConfig {
  piscadaIntervaloMinMs: number;
  piscadaIntervaloMaxMs: number;
  chancePiscadaDupla: number;
  duracaoApontarMs: number;
  intervaloGestosMs: number;
}

export const CONFIG_AVATAR_PADRAO: AvatarConfig = {
  piscadaIntervaloMinMs: 2000,
  piscadaIntervaloMaxMs: 6000,
  chancePiscadaDupla: 0.1,
  duracaoApontarMs: 1500,
  intervaloGestosMs: 3200
};
