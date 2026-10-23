/**
 * TUTORIA - Tipos e Interfaces do Avatar com Movimentos Humanos
 */

export type AvatarEstado = 'idle' | 'listening' | 'thinking' | 'speaking';

export type GestoTipo = 'palmas-abertas' | 'enfatizar' | 'contar-dedos' | 'mao-no-peito';

export type GestoEsperaTipo = 'olhar-cima' | 'pensativo' | 'postura-atenta';

export interface AvatarElementos {
  moduloElemento: HTMLElement | null;
  statusTextoElemento: HTMLElement | null;
  micBotaoElemento?: HTMLElement | null;
  micDicaElemento?: HTMLElement | null;
}

/**
 * Interface unificada para controladores de Avatar (2D SVG e 3D VRM/WebGL).
 * Permite que a tela do Tutor seja desacoplada da implementação visual específica (RF01, CA01).
 */
import type { Persona } from '../personas/tipos';

export interface ControladorAvatar {
  definirEstado(novoEstado: AvatarEstado, mensagemCustomizada?: string | null): void;
  obterEstado(): AvatarEstado;
  atualizarMensagem(mensagem: string): void;
  notificarPalavraFalada(palavra?: string): void;
  pararFala(): void;
  apontarParaLousa(duracaoMs?: number, elementoAlvo?: HTMLElement | null): void;
  iniciarCicloGestosEspera(intervaloMs?: number): void;
  pararCicloGestosEspera(): void;
  aplicarProximoGestoEspera(): void;
  destruir(): void;
  /** Troca o personagem (só o 3D tem personas; o 2D ignora). */
  definirPersona?(persona: Persona): Promise<void> | void;
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
