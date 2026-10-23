import { GestoEsperaTipo, GestoTipo } from './tipos';

export const GESTOS_DISPONIVEIS: GestoTipo[] = [
  'palmas-abertas',
  'enfatizar',
  'contar-dedos',
  'mao-no-peito'
];

export const GESTOS_ESPERA_DISPONIVEIS: GestoEsperaTipo[] = [
  'olhar-cima',
  'pensativo',
  'postura-atenta'
];

/**
 * Sorteia o próximo gesto do repertório garantindo que nunca repita o mesmo gesto anterior consecutivamente.
 */
export function sortearProximoGesto(
  gestoAnterior: GestoTipo | null,
  pesos?: Partial<Record<string, number>>
): GestoTipo {
  const opcoes = GESTOS_DISPONIVEIS.filter(g => g !== gestoAnterior);
  if (opcoes.length === 0) return GESTOS_DISPONIVEIS[0];
  if (!pesos) {
    const indice = Math.floor(Math.random() * opcoes.length);
    return opcoes[indice];
  }

  // Sorteio ponderado pelo jeito da persona (RF06), sem repetir o anterior
  const total = opcoes.reduce((soma, g) => soma + (pesos[g] ?? 1), 0);
  let sorteio = Math.random() * total;
  for (const gesto of opcoes) {
    sorteio -= pesos[gesto] ?? 1;
    if (sorteio < 0) return gesto;
  }
  return opcoes[opcoes.length - 1];
}

/**
 * Sorteia o próximo gesto de espera garantindo que nunca repita o mesmo gesto anterior consecutivamente (RF05, CA06).
 */
export function sortearProximoGestoEspera(gestoAnterior: GestoEsperaTipo | null): GestoEsperaTipo {
  const opcoes = GESTOS_ESPERA_DISPONIVEIS.filter(g => g !== gestoAnterior);
  if (opcoes.length === 0) return GESTOS_ESPERA_DISPONIVEIS[0];
  const indice = Math.floor(Math.random() * opcoes.length);
  return opcoes[indice];
}
