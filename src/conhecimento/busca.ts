/**
 * TUTORIA - Mecanismo de Busca Local BM25 para Trechos de Livros
 * (RF04, RF06, RNF01, CT04)
 */

import { detectarTema } from '../espera/temas';
import { normalizarTexto } from './normalizador';
import { IndiceConhecimento, OpcoesBusca, ResultadoBusca, TrechoLivro } from './tipos';

export const CONSTANTES_BM25 = {
  K1: 1.2,
  B: 0.75,
  BOOST_DISCIPLINA: 1.35,
  SCORE_MINIMO_PADRAO: 1.2,
  LIMITE_PADRAO: 3
} as const;

/**
 * Calcula o IDF (Inverse Document Frequency) suavizado e não-negativo.
 */
export function calcularIdf(totalDocumentos: number, docsComTermo: number): number {
  return Math.log(1 + (totalDocumentos - docsComTermo + 0.5) / (docsComTermo + 0.5));
}

/**
 * Realiza busca BM25 local sobre o índice invertido em memória.
 * Executa em < 50ms (RNF01).
 */
export function buscarTrechosRelevantes(
  pergunta: string,
  indice: IndiceConhecimento | null | undefined,
  opcoes: OpcoesBusca = {}
): ResultadoBusca[] {
  if (!indice || !indice.trechos || indice.trechos.length === 0) {
    return [];
  }

  const tokens = normalizarTexto(pergunta);
  if (tokens.length === 0) {
    return [];
  }

  const {
    livrosDesativados = [],
    limite = CONSTANTES_BM25.LIMITE_PADRAO,
    scoreMinimo = CONSTANTES_BM25.SCORE_MINIMO_PADRAO
  } = opcoes;

  // Detecta matéria da pergunta se não informada explicitamente
  let disciplinaAlvo = opcoes.disciplina;
  if (!disciplinaAlvo) {
    const temaDetectado = detectarTema(pergunta);
    if (temaDetectado) {
      disciplinaAlvo = temaDetectado.materia;
    }
  }

  const totalDocumentos = indice.trechos.length;
  const avgDocLength = indice.avgDocLength || 100;
  const desativadosSet = new Set(livrosDesativados);

  // Mapeia trechos por ID para acesso O(1)
  const trechosMap = new Map<string, TrechoLivro>();
  for (const t of indice.trechos) {
    trechosMap.set(t.id, t);
  }

  // Acumulador de pontuação por trechoId
  const scoresPorTrecho = new Map<string, number>();

  // Contagem de termos na consulta para TF da query
  const queryTermCounts: Record<string, number> = {};
  for (const t of tokens) {
    queryTermCounts[t] = (queryTermCounts[t] || 0) + 1;
  }

  for (const token of Object.keys(queryTermCounts)) {
    const postagens = indice.indiceInvertido[token];
    if (!postagens || postagens.length === 0) continue;

    const idf = calcularIdf(totalDocumentos, postagens.length);

    for (const post of postagens) {
      const trecho = trechosMap.get(post.trechoId);
      if (!trecho) continue;

      // Filtra livros desativados nas configurações (RF11, CA11)
      if (desativadosSet.has(trecho.livroId)) continue;

      const docLen = indice.docLengths[trecho.id] || avgDocLength;
      const tf = post.tf;

      // Fórmula BM25
      const numerador = tf * (CONSTANTES_BM25.K1 + 1);
      const denominador =
        tf + CONSTANTES_BM25.K1 * (1 - CONSTANTES_BM25.B + CONSTANTES_BM25.B * (docLen / avgDocLength));
      const termoScore = idf * (numerador / denominador);

      const scoreAtual = scoresPorTrecho.get(trecho.id) || 0;
      scoresPorTrecho.set(trecho.id, scoreAtual + termoScore);
    }
  }

  // Aplica boosts e filtra por score mínimo
  const resultados: ResultadoBusca[] = [];

  for (const [trechoId, scoreBase] of scoresPorTrecho.entries()) {
    const trecho = trechosMap.get(trechoId);
    if (!trecho) continue;

    let scoreFinal = scoreBase;

    // Prioriza trechos com a disciplina detectada na pergunta (RF04)
    if (disciplinaAlvo && trecho.disciplina) {
      const discTrecho = trecho.disciplina.toLowerCase();
      const discAlvo = disciplinaAlvo.toLowerCase();
      if (
        discTrecho === discAlvo ||
        (discAlvo === 'fisica_quimica' && (discTrecho === 'fisica' || discTrecho === 'quimica' || discTrecho === 'ciencias')) ||
        (discAlvo === 'ciencias' && (discTrecho === 'biologia' || discTrecho === 'ciencias'))
      ) {
        scoreFinal *= CONSTANTES_BM25.BOOST_DISCIPLINA;
      }
    }

    if (scoreFinal >= scoreMinimo) {
      resultados.push({ trecho, score: scoreFinal });
    }
  }

  // Ordena por score decrescente
  resultados.sort((a, b) => b.score - a.score);

  return resultados.slice(0, limite);
}
