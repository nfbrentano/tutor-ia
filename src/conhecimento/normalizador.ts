/**
 * TUTORIA - Normalizador de Texto em Português para Busca BM25
 * (RF04, CT03)
 * Remove acentos, pontuação, stopwords e reduz plurais básicos para termos canônicos.
 */

export const STOPWORDS_PT = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'ate',
  'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'do', 'dos',
  'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'eram', 'essa', 'essas',
  'esse', 'esses', 'esta', 'estao', 'estas', 'este', 'estes', 'eu', 'foi', 'fomos',
  'foram', 'ha', 'isso', 'isto', 'ja', 'la', 'lhe', 'lhes', 'mais', 'mas', 'me',
  'mesmo', 'meu', 'meus', 'minha', 'minhas', 'muito', 'na', 'nas', 'nao', 'no',
  'nos', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os', 'ou',
  'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando', 'que', 'quem',
  'se', 'sem', 'seu', 'seus', 'so', 'sua', 'suas', 'tambem', 'te', 'tem', 'teus',
  'tua', 'tuas', 'um', 'uma', 'umas', 'uns', 'voce', 'voces'
]);

/**
 * Remove acentuação e diacríticos de uma string.
 */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Redução simples de plural para português (stemming morfológico básico).
 */
export function desinenciaPlural(termo: string): string {
  if (termo.length <= 3) return termo;

  // equacoes -> equacao, reacoes -> reacao
  if (termo.endsWith('oes') && termo.length > 4) {
    return termo.slice(0, -3) + 'ao';
  }
  // caes, paes -> cao, pao
  if (termo.endsWith('aes') && termo.length > 4) {
    return termo.slice(0, -3) + 'ao';
  }
  // capitais -> capital, animais -> animal
  if (termo.endsWith('ais') && termo.length > 4) {
    return termo.slice(0, -3) + 'al';
  }
  // papeis -> papel, fosseis -> fossil
  if (termo.endsWith('eis') && termo.length > 4) {
    return termo.slice(0, -3) + 'el';
  }
  // lençois -> lencol
  if (termo.endsWith('ois') && termo.length > 4) {
    return termo.slice(0, -3) + 'ol';
  }
  // nuvens -> nuvem, jardins -> jardim
  if (termo.endsWith('ns') && termo.length > 3) {
    return termo.slice(0, -2) + 'm';
  }
  // flores -> flor, cores -> cor, autores -> autor
  if (termo.endsWith('res') && termo.length > 4) {
    return termo.slice(0, -2);
  }
  // vozes -> voz, luzes -> luz
  if (termo.endsWith('zes') && termo.length > 4) {
    return termo.slice(0, -2);
  }
  // fotossínteses -> fotossíntese, celulas -> celula, plantas -> planta
  if (termo.endsWith('s') && termo.length > 3) {
    const semS = termo.slice(0, -1);
    // Preserva palavras onde 's' é fonema intrínseco (lápis, vírus, país, ônibus, etc)
    if (['virus', 'lapis', 'pais', 'onibus', 'cosmos', 'atlas', 'gas'].includes(termo)) {
      return termo;
    }
    return semS;
  }

  return termo;
}

/**
 * Normaliza um termo individual para indexação e busca.
 */
export function normalizarTermo(termo: string): string {
  const limpo = removerAcentos(termo.toLowerCase().trim()).replace(/[^\w]/g, '');
  if (!limpo) return '';
  return desinenciaPlural(limpo);
}

/**
 * Normaliza uma string de texto, retornando a lista de tokens canônicos (sem stopwords).
 */
export function normalizarTexto(texto: string): string[] {
  if (!texto) return [];
  const semAcentos = removerAcentos(texto.toLowerCase());
  const palavras = semAcentos.split(/[^\w]+/).filter(Boolean);

  const tokens: string[] = [];
  for (const palavra of palavras) {
    if (STOPWORDS_PT.has(palavra) || palavra.length < 2) {
      continue;
    }
    const token = desinenciaPlural(palavra);
    if (token && !STOPWORDS_PT.has(token)) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Normaliza uma frase completa para comparação de chaves de cache.
 */
export function normalizarFrase(frase: string): string {
  return normalizarTexto(frase).join(' ');
}
