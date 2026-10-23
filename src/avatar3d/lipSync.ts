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

/* ==========================================================================
   LIP SYNC POR SÍLABA (RF05, CA07, CA08 da spec de personas)
   ========================================================================== */

export type FormaBoca = VogalVRM | 'fechada';

export interface SegmentoBoca {
  forma: FormaBoca;
  inicioMs: number;
  duracaoMs: number;
  /** Abertura de 0 a 1: sílaba tônica abre mais. */
  intensidade: number;
}

const VOGAIS = 'aeiouáàãâéêíóôõúy';
const REGEX_SILABA = new RegExp(`[^${VOGAIS}]*[${VOGAIS}]+`, 'gi');
const CONSOANTES_BILABIAIS = /^[pbm]/i;

/** Duração média de uma sílaba falada em pt-BR com rate 1.0. */
const DURACAO_SILABA_MS = 185;

/**
 * Quebra a palavra em sílabas aproximadas (grupo de consoantes + vogais).
 * Não segue a divisão silábica gramatical; basta para o ritmo da boca.
 */
export function quebrarEmSilabas(palavra: string): string[] {
  const termo = (palavra || '').trim().toLowerCase().replace(/[^a-záàãâéêíóôõúçy]/gi, '');
  if (!termo) return [];
  const silabas = termo.match(REGEX_SILABA) || [];
  if (silabas.length === 0) return [termo];

  // Consoantes finais (ex.: "mar", "luz") ficam na última sílaba
  const consumido = silabas.join('').length;
  if (consumido < termo.length) {
    silabas[silabas.length - 1] += termo.slice(consumido);
  }
  return silabas;
}

export function estimarDuracaoPalavraMs(palavra: string | undefined, rate = 1): number {
  const silabas = palavra ? Math.max(1, quebrarEmSilabas(palavra).length) : 2;
  return Math.max(140, (silabas * DURACAO_SILABA_MS) / Math.max(0.5, rate));
}

function indiceSilabaTonica(silabas: string[]): number {
  const acentuada = silabas.findIndex(s => /[áàãâéêíóôõú]/.test(s));
  if (acentuada !== -1) return acentuada;
  if (silabas.length === 1) return 0;
  const ultima = silabas[silabas.length - 1];
  return /[rlzxiu]$|is$|us$/.test(ultima) ? silabas.length - 1 : silabas.length - 2;
}

/**
 * Gera a sequência de formas de boca de uma palavra ao longo da duração estimada.
 * Sílabas iniciadas em P, B ou M começam com a boca fechada.
 */
export function gerarSequenciaBoca(palavra: string | undefined, duracaoMs?: number): SegmentoBoca[] {
  const silabas = palavra ? quebrarEmSilabas(palavra) : [];
  if (silabas.length === 0) {
    // Sem palavra (voz sem boundary): sílaba genérica com vogal do ciclo
    const total = duracaoMs ?? DURACAO_SILABA_MS * 2;
    return [
      { forma: mapearPalavraParaVogalVRM(), inicioMs: 0, duracaoMs: total * 0.5, intensidade: 0.8 },
      { forma: mapearPalavraParaVogalVRM(), inicioMs: total * 0.5, duracaoMs: total * 0.5, intensidade: 0.6 }
    ];
  }

  const total = duracaoMs ?? estimarDuracaoPalavraMs(palavra);
  const porSilaba = total / silabas.length;
  const tonica = indiceSilabaTonica(silabas);
  const segmentos: SegmentoBoca[] = [];

  silabas.forEach((silaba, i) => {
    const inicio = i * porSilaba;
    const vogal = silaba.match(new RegExp(`[${VOGAIS}]`, 'i'))?.[0] || 'a';
    const forma = MAPA_VOGAL_VRM[vogal] || 'aa';
    const intensidade = i === tonica ? 1 : 0.7;

    if (CONSOANTES_BILABIAIS.test(silaba)) {
      const fechada = porSilaba * 0.3;
      segmentos.push({ forma: 'fechada', inicioMs: inicio, duracaoMs: fechada, intensidade: 0 });
      segmentos.push({ forma, inicioMs: inicio + fechada, duracaoMs: porSilaba - fechada, intensidade });
    } else {
      segmentos.push({ forma, inicioMs: inicio, duracaoMs: porSilaba, intensidade });
    }
  });

  return segmentos;
}
