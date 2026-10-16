/**
 * TUTORIA - Banco de Frases de Reação Imediata (RF01, CA01, CA02, CA16, RNF06)
 * Frases curtas e naturais para reagir de pronto à pergunta do aluno.
 * Regra crítica (RNF06 / CA16): nenhuma frase deve antecipar ou afirmar conteúdo de matéria escolar.
 */

export const FRASES_REACAO: string[] = [
  'Boa pergunta! Deixa eu pensar um pouquinho...',
  'Interessante! Vamos analisar essa questão com calma.',
  'Ótima dúvida! Deixa eu organizar a explicação para você.',
  'Muito bem lembrado! Estou preparando os passos aqui.',
  'Legal! Vamos entender isso ponto a ponto.',
  'Excelente pergunta! Deixa eu colocar as ideias no quadro.',
  'Deixa eu estruturar esse raciocínio para te explicar melhor.',
  'Com certeza! Essa é uma matéria bem importante. Um instante...',
  'Bela questão! Vou montar um passo a passo para ficar claro.',
  'Hum, muito boa essa dúvida! Já estou esquematizando.',
  'Gostei da pergunta! Deixa eu puxar os pontos principais aqui.',
  'Perfeito! Vamos resolver essa dúvida juntos agora.',
  'Deixa comigo! Estou preparando a explicação.',
  'Entendi! Deixa eu organizar aqui na lousa para você.',
  'Maravilha! Vamos destrinchar esse conceito agora mesmo.',
  'Uma pergunta muito pertinente! Deixa eu estruturar os detalhes.',
  'Show! Vamos ver como funciona isso na prática.'
];

/**
 * Sorteia uma frase de reação garantindo que nunca repita a última usada consecutivamente (CA02).
 */
export function sortearFraseReacao(anterior: string | null): string {
  const opcoes = FRASES_REACAO.filter(f => f !== anterior);
  if (opcoes.length === 0) return FRASES_REACAO[0];
  const indice = Math.floor(Math.random() * opcoes.length);
  return opcoes[indice];
}
