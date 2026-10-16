/**
 * TUTORIA - Dicionário de Temas e Eco da Pergunta (RF02, CA03)
 * Mapeamento local de matérias e palavras-chave para reconhecer o assunto e repetir o eco.
 */

export interface TemaDetectado {
  materia: string;
  tema: string;
}

interface RegraTema {
  materia: string;
  tema: string;
  padroes: RegExp[];
}

const REGRAS_TEMAS: RegraTema[] = [
  // Ciências e Biologia
  { materia: 'ciencias', tema: 'fotossíntese', padroes: [/fotoss[ií]ntese/i] },
  { materia: 'ciencias', tema: 'célula animal e vegetal', padroes: [/c[eé]lula/i, /organela/i, /mitoc[oô]ndria/i] },
  { materia: 'ciencias', tema: 'genética e DNA', padroes: [/dna/i, /gen[eé]tica/i, /hereditariedade/i, /gene/i] },
  { materia: 'ciencias', tema: 'ecossistema e cadeia alimentar', padroes: [/ecossistema/i, /cadeia alimentar/i, /teia alimentar/i] },
  { materia: 'ciencias', tema: 'sistema solar', padroes: [/sistema solar/i, /planeta/i, /asteroide/i] },
  { materia: 'ciencias', tema: 'vírus e bactérias', padroes: [/v[ií]rus/i, /bact[eé]ria/i, /antibi[oó]tico/i] },

  // Matemática
  { materia: 'matematica', tema: 'equações', padroes: [/equa[cç]/i, /inc[oó]gnita/i, /primeiro grau/i, /segundo grau/i] },
  { materia: 'matematica', tema: 'teorema de Pitágoras', padroes: [/pit[aá]goras/i, /hipotenusa/i, /cateto/i] },
  { materia: 'matematica', tema: 'frações e porcentagem', padroes: [/fra[cç][aã]o/i, /fra[cç][oõ]es/i, /porcentagem/i, /por cento/i] },
  { materia: 'matematica', tema: 'funções matemáticas', padroes: [/fun[cç][aã]o/i, /gr[aá]fico de fun[cç][aã]o/i, /par[aá]bola/i] },
  { materia: 'matematica', tema: 'geometria e áreas', padroes: [/geometria/i, /[aá]rea do/i, /per[ií]metro/i, /tri[aâ]ngulo/i, /volume/i] },
  { materia: 'matematica', tema: 'fórmula de Bhaskara', padroes: [/bhaskara/i, /baskhara/i, /delta/i] },

  // Física e Química
  { materia: 'fisica_quimica', tema: 'gravidade e leis de Newton', padroes: [/gravidade/i, /newton/i, /leis do movimento/i] },
  { materia: 'fisica_quimica', tema: 'velocidade e aceleração', padroes: [/velocidade/i, /acelera[cç][aã]o/i, /cinem[aá]tica/i] },
  { materia: 'fisica_quimica', tema: 'tabela periódica e átomos', padroes: [/tabela peri[oó]dica/i, /[aá]tomo/i, /el[eé]tron/i, /pr[oó]ton/i] },
  { materia: 'fisica_quimica', tema: 'reações químicas', padroes: [/rea[cç][aã]o qu[ií]mica/i, /liga[cç][aã]o qu[ií]mica/i, /mol[eé]cula/i] },
  { materia: 'fisica_quimica', tema: 'eletricidade e circuitos', padroes: [/eletricidade/i, /circuito/i, /voltagem/i, /corrente el[eé]trica/i] },

  // História
  { materia: 'historia', tema: 'Segunda Guerra Mundial', padroes: [/segunda guerra/i, /nazismo/i, /holocausto/i] },
  { materia: 'historia', tema: 'Primeira Guerra Mundial', padroes: [/primeira guerra/i, /trincheiras/i] },
  { materia: 'historia', tema: 'Revolução Francesa', padroes: [/revolu[cç][aã]o francesa/i, /queda da bastilha/i] },
  { materia: 'historia', tema: 'Brasil Colônia e Império', padroes: [/brasil col[oô]nia/i, /dom pedro/i, /escravid[aã]o/i, /capitanias/i] },
  { materia: 'historia', tema: 'Roma Antiga', padroes: [/roma antiga/i, /imp[eé]rio romano/i, /gladiador/i] },
  { materia: 'historia', tema: 'Grécia Antiga', padroes: [/gr[eé]cia antiga/i, /atenas/i, /esparta/i, /mitologia grega/i] },

  // Geografia
  { materia: 'geografia', tema: 'relevo e placas tectônicas', padroes: [/relevo/i, /placas tect[oô]nicas/i, /terremoto/i, /vulc[aã]o/i] },
  { materia: 'geografia', tema: 'clima e biomas', padroes: [/clima/i, /bioma/i, /vegeta[cç][aã]o/i, /floresta amaz[oô]nica/i, /cerrado/i] },
  { materia: 'geografia', tema: 'urbanização e população', padroes: [/urbaniza[cç][aã]o/i, /demografia/i, /popula[cç][aã]o/i, /migra[cç][aã]o/i] },
  { materia: 'geografia', tema: 'hidrografia e bacias', padroes: [/hidrografia/i, /bacia hidrogr[aá]fica/i, /rio amazonas/i] },

  // Português
  { materia: 'portugues', tema: 'crase e pontuação', padroes: [/crase/i, /v[ií]rgula/i, /pontua[cç][aã]o/i] },
  { materia: 'portugues', tema: 'classes de palavras', padroes: [/substantivo/i, /adjetivo/i, /verbo/i, /pronome/i] },
  { materia: 'portugues', tema: 'concordância verbal e nominal', padroes: [/concord[aâ]ncia/i, /reg[eê]ncia/i] },
  { materia: 'portugues', tema: 'figuras de linguagem', padroes: [/figuras? de linguagem/i, /met[aá]fora/i, /ironia/i] }
];

/**
 * Detecta tema e matéria a partir da pergunta do aluno. Retorna null se for genérica (CA03).
 */
export function detectarTema(pergunta: string): TemaDetectado | null {
  if (!pergunta || typeof pergunta !== 'string') return null;
  const textoLimpo = pergunta.trim();

  // Se a pergunta for muito curta ou genérica, não força tema
  if (textoLimpo.length < 5) return null;

  for (const regra of REGRAS_TEMAS) {
    for (const padrao of regra.padroes) {
      if (padrao.test(textoLimpo)) {
        return {
          materia: regra.materia,
          tema: regra.tema
        };
      }
    }
  }

  return null;
}

const TEMPLATES_ECO = [
  (tema: string) => `Hum, você quer saber sobre ${tema}, né? Deixa eu pensar...`,
  (tema: string) => `Ah, ${tema}! Essa é uma dúvida muito interessante. Um instante...`,
  (tema: string) => `Vamos entender ${tema}! Estou organizando os conceitos aqui.`,
  (tema: string) => `Excelente pergunta sobre ${tema}! Já estou esquematizando para você.`,
  (tema: string) => `Legal, ${tema} é uma matéria bem bacana! Deixa eu estruturar a explicação.`
];

/**
 * Gera uma frase de eco com o tema identificado sem repetir a última frase consecutivamente.
 */
export function gerarFraseComEco(tema: string, anterior: string | null): string {
  const opcoes = TEMPLATES_ECO
    .map(template => template(tema))
    .filter(frase => frase !== anterior);

  const lista = opcoes.length > 0 ? opcoes : TEMPLATES_ECO.map(t => t(tema));
  const indice = Math.floor(Math.random() * lista.length);
  return lista[indice];
}
