/**
 * TUTORIA - Sincronização Labial (Lip Sync) para Avatar 3D VRM (RF05, CT08, CA07)
 * Mapeia palavras em português para expressões padrão VRM ('aa', 'ih', 'ou', 'ee', 'oh').
 */

import { VogalVRM } from './tipos';

const MAPA_VOGAL_VRM: Record<string, VogalVRM> = {
  a: 'aa',
  á: 'aa',
  à: 'aa',
  ã: 'aa',
  â: 'aa',
  e: 'ee',
  é: 'ee',
  ê: 'ee',
  i: 'ih',
  í: 'ih',
  o: 'oh',
  ó: 'oh',
  ô: 'oh',
  õ: 'oh',
  u: 'ou',
  ú: 'ou'
};

const CICLO_FALLBACK: VogalVRM[] = ['aa', 'oh', 'ee', 'ih', 'ou'];
let indiceCiclo = 0;

/**
 * Identifica a vogal tônica ou mais expressiva da palavra em português.
 * Regras:
 * 1. Vogal com acento gráfico explícito (ex.: "fotossíntese" -> "í" -> "ih", "órgão" -> "ó" -> "oh").
 * 2. Se não houver acento, aplica regra padrão de oxítona/paroxítona para encontrar a tônica.
 */
export function mapearPalavraParaVogalVRM(palavra?: string): VogalVRM {
  if (!palavra || typeof palavra !== 'string') {
    const proxima = CICLO_FALLBACK[indiceCiclo % CICLO_FALLBACK.length];
    indiceCiclo++;
    return proxima;
  }

  const termo = palavra.trim().toLowerCase();
  if (termo.length === 0) {
    const proxima = CICLO_FALLBACK[indiceCiclo % CICLO_FALLBACK.length];
    indiceCiclo++;
    return proxima;
  }

  // 1. Procura por vogal com acento gráfico
  const vogaisAcentuadas = /[áàãâéêíóôõú]/g;
  const acentuadas = termo.match(vogaisAcentuadas);
  if (acentuadas && acentuadas.length > 0) {
    const primeiraAcentuada = acentuadas[0];
    if (MAPA_VOGAL_VRM[primeiraAcentuada]) {
      return MAPA_VOGAL_VRM[primeiraAcentuada];
    }
  }

  // 2. Extrai todas as vogais da palavra
  const todasVogais: string[] = [];
  for (const c of termo) {
    if (MAPA_VOGAL_VRM[c]) {
      todasVogais.push(c);
    }
  }

  if (todasVogais.length === 0) {
    const proxima = CICLO_FALLBACK[indiceCiclo % CICLO_FALLBACK.length];
    indiceCiclo++;
    return proxima;
  }

  if (todasVogais.length === 1) {
    return MAPA_VOGAL_VRM[todasVogais[0]];
  }

  // Regra padrão de acentuação tônica natural do português sem acento gráfico:
  // - Oxítonas: terminam em r, l, z, x, i, u, is, us -> última vogal é tônica.
  // - Paroxítonas: terminam em a, e, o, em, ens -> penúltima vogal é tônica.
  const terminacaoOxitona = /[rlzxiu]$|is$|us$/;
  if (terminacaoOxitona.test(termo)) {
    const ultimaVogal = todasVogais[todasVogais.length - 1];
    return MAPA_VOGAL_VRM[ultimaVogal];
  } else {
    // Paroxítona: penúltima vogal
    const penultimaVogal = todasVogais[todasVogais.length - 2];
    return MAPA_VOGAL_VRM[penultimaVogal];
  }
}
