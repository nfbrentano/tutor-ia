/**
 * TUTORIA - Tipos da Base de Conhecimento Local (Livros em PDF, BM25, Cache)
 * (RF01 - RF09, RNF01 - RNF06)
 */

import { RespostaDidatica } from '../lousa/tipos';

export interface LivroCatalogo {
  id: string;
  titulo: string;
  disciplina: string;
  serie: string;
  autor: string;
  licenca: 'aberta' | 'restrita' | 'cc' | string;
  arquivo: string;
}

export interface TrechoLivro {
  id: string;
  livroId: string;
  tituloLivro: string;
  disciplina: string;
  pagina: number;
  capitulo?: string;
  texto: string;
}

export interface FonteCitada {
  livroId: string;
  tituloLivro?: string;
  pagina: number;
  trechoId?: string;
}

export interface OcorrenciaTermo {
  trechoId: string;
  tf: number;
}

export interface IndiceConhecimento {
  versao: string;
  geradoEm: string;
  livros: LivroCatalogo[];
  trechos: TrechoLivro[];
  docLengths: Record<string, number>;
  avgDocLength: number;
  indiceInvertido: Record<string, OcorrenciaTermo[]>;
}

export interface ResultadoBusca {
  trecho: TrechoLivro;
  score: number;
}

export interface OpcoesBusca {
  disciplina?: string;
  livrosDesativados?: string[];
  limite?: number;
  scoreMinimo?: number;
}

export interface ItemCacheResposta {
  id: string;
  pergunta: string;
  perguntaNormalizada: string;
  disciplina?: string;
  resposta: RespostaDidatica;
  origem: 'pre_construido' | 'execucao';
  criadoEm: number;
}
