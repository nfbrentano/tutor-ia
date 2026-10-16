/**
 * TUTORIA - Banco de Curiosidades de Espera (RF04, CA05, RNF06)
 * Fatos curtos (máximo 15 palavras) disparados se a espera passar de 4 segundos.
 * No máximo 1 curiosidade por pergunta.
 */

export const CURIOSIDADES_POR_MATERIA: Record<string, string[]> = {
  ciencias: [
    'Sabia que as árvores se comunicam pelo solo através de fungos?',
    'Sabia que seu corpo produz cerca de 25 milhões de células por segundo?',
    'Sabia que as plantas usam a luz verde com menor intensidade?',
    'Sabia que a água morna pode congelar mais rápido que a fria?',
    'Sabia que o DNA humano esticado teria cerca de dois metros de comprimento?'
  ],
  matematica: [
    'Sabia que o número zero foi criado na Índia antiga pelos matemáticos?',
    'Sabia que um círculo tem infinitos eixos de simetria?',
    'Sabia que a palavra cálculo vem de pedrinhas usadas para contar antigamente?',
    'Sabia que o número pi tem infinitas casas decimais sem repetição periódica?',
    'Sabia que triângulos são as figuras geométricas mais rígidas da natureza?'
  ],
  fisica_quimica: [
    'Sabia que a luz do Sol demora cerca de oito minutos para chegar aqui?',
    'Sabia que um relâmpago é cinco vezes mais quente que o Sol?',
    'Sabia que o som viaja quatro vezes mais rápido na água que no ar?',
    'Sabia que quase todo o átomo é espaço completamente vazio?',
    'Sabia que o diamante e o grafite são feitos do mesmo elemento carbono?'
  ],
  historia: [
    'Sabia que a escrita mais antiga conhecida foi criada pelos sumérios há 5.000 anos?',
    'Sabia que os maias já tinham calendários astronômicos muito precisos?',
    'Sabia que as Olimpíadas surgiram na Grécia antiga como homenagem a Zeus?',
    'Sabia que a prensa de Gutenberg revolucionou o acesso aos livros no mundo?',
    'Sabia que o primeiro relógio mecânico surgiu em mosteiros medievais na Europa?'
  ],
  geografia: [
    'Sabia que o Brasil faz fronteira com quase todos os países da América do Sul?',
    'Sabia que o Oceano Pacífico é maior que todas as massas de terra juntas?',
    'Sabia que o deserto da Antártica é o mais seco e frio do mundo?',
    'Sabia que o ponto mais alto do Brasil é o Pico da Neblina?',
    'Sabia que o Rio Amazonas despeja mais água no mar que qualquer outro?'
  ],
  geral: [
    'Sabia que aprender coisas novas cria conexões físicas entre os seus neurônios?',
    'Sabia que ensinar alguém é uma das formas mais eficientes de fixar conteúdo?',
    'Sabia que uma boa noite de sono ajuda o cérebro a memorizar estudos?',
    'Sabia que fazer pausas regulares melhora a concentração durante os exercícios?',
    'Sabia que a curiosidade é o primeiro motor de qualquer grande descoberta científica?'
  ]
};

/**
 * Obtém uma curiosidade curta da matéria especificada (ou geral).
 */
export function obterCuriosidade(materia: string | null, jaUsadas?: Set<string>): string {
  const chave = materia && CURIOSIDADES_POR_MATERIA[materia] ? materia : 'geral';
  const lista = CURIOSIDADES_POR_MATERIA[chave] || CURIOSIDADES_POR_MATERIA.geral;

  const naoUsadas = jaUsadas ? lista.filter(c => !jaUsadas.has(c)) : lista;
  const opcoes = naoUsadas.length > 0 ? naoUsadas : lista;

  const indice = Math.floor(Math.random() * opcoes.length);
  return opcoes[indice];
}
