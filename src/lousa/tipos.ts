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
  | 'desenho'
  | 'quiz'
  | 'grafico';

export interface PontoGrafico {
  x: number;
  y: number;
}

export interface GraficoConteudo {
  expressao?: string;
  pontos: PontoGrafico[];
  titulo?: string;
  eixoX?: string;
  eixoY?: string;
}

export interface DesafioQuiz {
  pergunta: string;
  opcoes: string[];
  correta: number;
  dica: string;
  explicacao: string;
}

export interface EventoRespostaQuiz {
  acertou: boolean;
  tentativa: number;
  revelado?: boolean;
  indiceEscolhido: number;
  desafio: DesafioQuiz;
  mensagemFeedback: string;
}

export type OnResponderQuizCallback = (evento: EventoRespostaQuiz) => void;

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
  | ImagemConteudo // para imagem
  | DesafioQuiz // para quiz
  | GraficoConteudo; // para grafico

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
  /** Matéria classificada pelo Gemini, usada na próxima escolha de persona (RF13). */
  materia?: string;
  /** Desafio de fixação opcional para modo prática na lousa (RF01). */
  desafio?: DesafioQuiz | null;
  /**
   * `false` quando a resposta é um fallback (resposta vazia/bloqueada) ou o streaming caiu no meio.
   * Respostas incompletas não podem ir para o cache, senão a falha se repete offline.
   */
  completa?: boolean;
}

