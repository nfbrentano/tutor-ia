/**
 * TUTORIA - Algoritmo de Divisão em Trechos e Indexação
 * (RF02, RF03, CA01, CA02, CA03, RNF03)
 */

import { normalizarTexto } from './normalizador';
import { IndiceConhecimento, LivroCatalogo, OcorrenciaTermo, TrechoLivro } from './tipos';

export interface ParametrosDivisao {
  tamanhoMinimo?: number; // ~800
  tamanhoMaximo?: number; // ~1200
  sobreposicao?: number;  // ~150
}

export const PARAMETROS_PADRAO_TRECHOS: Required<ParametrosDivisao> = {
  tamanhoMinimo: 800,
  tamanhoMaximo: 1200,
  sobreposicao: 150
};

/**
 * Divide o texto de uma página (ou seção) em trechos de 800-1200 caracteres,
 * respeitando parágrafos e pontuação sem cortar palavras no meio (CA02),
 * com sobreposição de ~150 caracteres.
 */
export function dividirEmTrechos(
  textoPagina: string,
  meta: {
    livroId: string;
    tituloLivro: string;
    disciplina: string;
    pagina: number;
    capitulo?: string;
  },
  parametros: ParametrosDivisao = {}
): TrechoLivro[] {
  const min = parametros.tamanhoMinimo ?? PARAMETROS_PADRAO_TRECHOS.tamanhoMinimo;
  const max = parametros.tamanhoMaximo ?? PARAMETROS_PADRAO_TRECHOS.tamanhoMaximo;
  const sobreposicao = parametros.sobreposicao ?? PARAMETROS_PADRAO_TRECHOS.sobreposicao;

  const textoLimpo = textoPagina.trim();
  if (textoLimpo.length < 50) {
    return [];
  }

  // Se o texto total for menor que o máximo, cria um único trecho íntegro
  if (textoLimpo.length <= max) {
    return [
      {
        id: `${meta.livroId}-p${meta.pagina}-c1`,
        livroId: meta.livroId,
        tituloLivro: meta.tituloLivro,
        disciplina: meta.disciplina,
        pagina: meta.pagina,
        capitulo: meta.capitulo,
        texto: textoLimpo
      }
    ];
  }

  // Divide o texto em blocos de parágrafos preservando quebras
  const blocos = textoLimpo.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const trechos: TrechoLivro[] = [];
  let buffer = '';
  let trechoIndex = 1;

  for (let i = 0; i < blocos.length; i++) {
    const bloco = blocos[i];

    if (!buffer) {
      buffer = bloco;
    } else if (buffer.length + 2 + bloco.length <= max) {
      buffer += '\n\n' + bloco;
    } else {
      // O buffer já tem tamanho suficiente
      if (buffer.length >= min) {
        trechos.push({
          id: `${meta.livroId}-p${meta.pagina}-c${trechoIndex++}`,
          livroId: meta.livroId,
          tituloLivro: meta.tituloLivro,
          disciplina: meta.disciplina,
          pagina: meta.pagina,
          capitulo: meta.capitulo,
          texto: buffer.trim()
        });

        // Calcula sobreposição no final do buffer sem cortar palavras
        const inicioSobreposicao = Math.max(0, buffer.length - sobreposicao);
        const espacoApos = buffer.indexOf(' ', inicioSobreposicao);
        const textoSobreposto = espacoApos !== -1 && espacoApos < buffer.length - 20
          ? buffer.slice(espacoApos + 1).trim()
          : '';

        buffer = textoSobreposto ? textoSobreposto + '\n\n' + bloco : bloco;
      } else {
        // Bloco individual muito grande que excede max: divide em frases
        buffer += '\n\n' + bloco;
      }
    }

    // Se o buffer acumulado ultrapassar max, força recorte em limite de frase/palavra
    while (buffer.length > max) {
      // Procura fim de frase próximo de max
      let pontoCorte = -1;
      const limiteBusca = Math.min(buffer.length, max);
      for (const delimitador of ['. ', '! ', '? ', ';\n', '.\n']) {
        const pos = buffer.lastIndexOf(delimitador, limiteBusca);
        if (pos > min * 0.7 && pos > pontoCorte) {
          pontoCorte = pos + delimitador.length;
        }
      }

      // Se não encontrou fim de frase, busca no último espaço em branco
      if (pontoCorte === -1) {
        pontoCorte = buffer.lastIndexOf(' ', limiteBusca);
      }

      if (pontoCorte <= 0) {
        pontoCorte = limiteBusca;
      }

      const parteTexto = buffer.slice(0, pontoCorte).trim();
      if (parteTexto.length >= 50) {
        trechos.push({
          id: `${meta.livroId}-p${meta.pagina}-c${trechoIndex++}`,
          livroId: meta.livroId,
          tituloLivro: meta.tituloLivro,
          disciplina: meta.disciplina,
          pagina: meta.pagina,
          capitulo: meta.capitulo,
          texto: parteTexto
        });
      }

      // Prepara sobreposição
      const inicioSobreposicao = Math.max(0, pontoCorte - sobreposicao);
      const espacoApos = buffer.indexOf(' ', inicioSobreposicao);
      const inicioResto = espacoApos !== -1 && espacoApos < pontoCorte
        ? espacoApos + 1
        : Math.max(0, pontoCorte - 50);

      buffer = buffer.slice(inicioResto).trim();
    }
  }

  // Se restou algo relevante no buffer
  if (buffer.trim().length >= 80) {
    trechos.push({
      id: `${meta.livroId}-p${meta.pagina}-c${trechoIndex++}`,
      livroId: meta.livroId,
      tituloLivro: meta.tituloLivro,
      disciplina: meta.disciplina,
      pagina: meta.pagina,
      capitulo: meta.capitulo,
      texto: buffer.trim()
    });
  }

  return trechos;
}

/**
 * Constrói o índice invertido e calcula estatísticas para o BM25.
 */
export function construirIndiceInvertido(
  trechos: TrechoLivro[],
  livros: LivroCatalogo[]
): IndiceConhecimento {
  const indiceInvertido: Record<string, OcorrenciaTermo[]> = {};
  const docLengths: Record<string, number> = {};
  let totalPalavras = 0;

  for (const trecho of trechos) {
    const tokens = normalizarTexto(trecho.texto);
    const contagemTermos: Record<string, number> = {};

    for (const token of tokens) {
      contagemTermos[token] = (contagemTermos[token] || 0) + 1;
    }

    const docLen = tokens.length;
    docLengths[trecho.id] = docLen;
    totalPalavras += docLen;

    for (const [token, tf] of Object.entries(contagemTermos)) {
      if (!indiceInvertido[token]) {
        indiceInvertido[token] = [];
      }
      indiceInvertido[token].push({
        trechoId: trecho.id,
        tf
      });
    }
  }

  const avgDocLength = trechos.length > 0 ? totalPalavras / trechos.length : 0;

  return {
    versao: '1.0.0',
    geradoEm: new Date().toISOString(),
    livros,
    trechos,
    docLengths,
    avgDocLength,
    indiceInvertido
  };
}
