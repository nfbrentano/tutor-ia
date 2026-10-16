/**
 * TUTORIA - Módulo de Repertório de Gestos Didáticos
 */

import { GestoTipo } from './tipos';

export const GESTOS_DISPONIVEIS: GestoTipo[] = [
  'palmas-abertas',
  'enfatizar',
  'contar-dedos',
  'mao-no-peito'
];

/**
 * Sorteia o próximo gesto do repertório garantindo que nunca repita o mesmo gesto anterior consecutivamente.
 */
export function sortearProximoGesto(gestoAnterior: GestoTipo | null): GestoTipo {
  const opcoes = GESTOS_DISPONIVEIS.filter(g => g !== gestoAnterior);
  if (opcoes.length === 0) return GESTOS_DISPONIVEIS[0];
  const indice = Math.floor(Math.random() * opcoes.length);
  return opcoes[indice];
}
