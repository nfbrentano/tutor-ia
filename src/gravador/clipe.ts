/**
 * TUTORIA - Montagem do clipe gravado: recorte, loop suave, reamostragem e JSON (RF07, RF08)
 */

import type { CategoriaClipe } from '../avatar3d/animacoes';
import { slerpQuat } from './filtro';
import { ClipeVRMJson, OSSOS_GRAVADOS, OssoGravado, Quat, QuadroGravado } from './tipos';

export const FPS_CLIPE = 20;
export const DURACAO_MAXIMA_SEG = 15;
export const TAMANHO_MAXIMO_BYTES = 250 * 1024;
export const DURACAO_LOOP_SUAVE_SEG = 0.3;

export interface OpcoesClipe {
  nome: string;
  categoria: CategoriaClipe;
  loop: boolean;
  loopSuave: boolean;
  personas?: string[];
}

/** Rotação de um osso no instante `t`, interpolando entre os quadros vizinhos. */
function amostrar(quadros: QuadroGravado[], osso: OssoGravado, t: number): Quat | undefined {
  let i = quadros.findIndex(q => q.t >= t);
  if (i === -1) i = quadros.length - 1;
  const depois = quadros[i];
  const antes = quadros[Math.max(0, i - 1)];
  const qa = antes.rotacoes[osso];
  const qb = depois.rotacoes[osso];
  if (!qa || !qb) return qb || qa;
  const intervalo = depois.t - antes.t;
  const f = intervalo > 0 ? Math.min(1, Math.max(0, (t - antes.t) / intervalo)) : 0;
  return slerpQuat(qa, qb, f);
}

/**
 * Mistura o fim do trecho com o começo para o loop não dar salto (CA09):
 * o último quadro fica igual ao primeiro.
 */
export function aplicarLoopSuave(amostras: Quat[], fps: number, duracaoSeg = DURACAO_LOOP_SUAVE_SEG): Quat[] {
  const n = Math.min(amostras.length - 1, Math.max(1, Math.round(duracaoSeg * fps)));
  if (amostras.length < 3) return amostras;
  const inicio = amostras[0];
  return amostras.map((q, i) => {
    const k = i - (amostras.length - 1 - n);
    if (k <= 0) return q;
    return slerpQuat(q, inicio, k / n);
  });
}

function arredondar(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Monta o clipe a partir dos quadros gravados entre `inicioSeg` e `fimSeg`.
 */
export function montarClipe(quadros: QuadroGravado[], inicioSeg: number, fimSeg: number, opcoes: OpcoesClipe): ClipeVRMJson {
  const trecho = quadros.filter(q => q.t >= inicioSeg && q.t <= fimSeg);
  if (trecho.length < 2) throw new Error('O trecho escolhido é curto demais.');
  const t0 = trecho[0].t;
  const duracao = Math.min(DURACAO_MAXIMA_SEG, trecho[trecho.length - 1].t - t0);
  const total = Math.max(2, Math.round(duracao * FPS_CLIPE) + 1);

  const ossos: ClipeVRMJson['ossos'] = {};
  for (const osso of OSSOS_GRAVADOS) {
    if (!trecho.some(q => q.rotacoes[osso])) continue;
    let amostras: Quat[] = [];
    let anterior: Quat | undefined;
    for (let i = 0; i < total; i++) {
      const q = amostrar(trecho, osso, t0 + i / FPS_CLIPE) || anterior || [0, 0, 0, 1];
      amostras.push(q);
      anterior = q;
    }
    if (opcoes.loopSuave && opcoes.loop) amostras = aplicarLoopSuave(amostras, FPS_CLIPE);
    ossos[osso] = amostras.flatMap(q => q.map(arredondar));
  }

  return {
    formato: 'tutoria-clipe-vrm',
    versao: 1,
    nome: opcoes.nome,
    categoria: opcoes.categoria,
    loop: opcoes.loop,
    fps: FPS_CLIPE,
    duracao: arredondar((total - 1) / FPS_CLIPE),
    ...(opcoes.personas && opcoes.personas.length > 0 ? { personas: opcoes.personas } : {}),
    ossos
  };
}

export function serializarClipe(clipe: ClipeVRMJson): string {
  const texto = JSON.stringify(clipe);
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO_BYTES) {
    throw new Error('O clipe passou de 250 KB. Escolha um trecho mais curto.');
  }
  return texto;
}

/** Nome de arquivo aceito pelo plugin de desenvolvimento (RF09). */
export function nomeClipeValido(nome: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(nome) && nome.length <= 60;
}
