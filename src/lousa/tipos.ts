/**
 * TUTORIA - Tipos e Interfaces da Lousa de Apoio Visual
 */

export type TipoItemLousa =
  | 'texto'
  | 'formula'
  | 'passos'
  | 'lista'
  | 'tabela'
  | 'imagem'
  | 'desenho';

export interface TabelaConteudo {
  cabecalho: string[];
  linhas: string[][];
}

export interface ImagemConteudo {
  termo: string;
  legenda?: string;
  urlReal?: string;
  autor?: string;
  licenca?: string;
}

export type ConteudoItemLousa =
  | string // para texto, formula, desenho
  | string[] // para passos, lista
  | TabelaConteudo // para tabela
  | ImagemConteudo; // para imagem

export interface ItemLousa {
  tipo: TipoItemLousa;
  conteudo: ConteudoItemLousa;
  legenda?: string;
}

export interface EtapaExplicacao {
  fala: string;
  lousa?: ItemLousa | null;
}

export interface RespostaDidatica {
  etapas: EtapaExplicacao[];
  textoCompleto: string;
  itensLousa: ItemLousa[];
  modeloUsado?: string;
  texto: string; // retrocompatibilidade com código existente e testes
  imagem_url?: string | null;
  fontes?: Array<{ livroId: string; tituloLivro?: string; pagina: number; trechoId?: string }>;
}

