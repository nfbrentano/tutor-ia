/**
 * TUTORIA - Script de Geração de Cache de Perguntas Frequentes (Offline RAG)
 * (RF07, RNF06, CA07, CA08)
 * Uso: npm run gerar-cache
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizarFrase } from '../src/conhecimento/normalizador';
import { ItemCacheResposta } from '../src/conhecimento/tipos';

const CAMINHO_INDICE = path.resolve(process.cwd(), 'public/conhecimento/indice.json');
const CAMINHO_CACHE = path.resolve(process.cwd(), 'public/conhecimento/cache.json');

export const PERGUNTAS_FREQUENTES_CURRICULO: Array<Omit<ItemCacheResposta, 'id' | 'perguntaNormalizada' | 'origem' | 'criadoEm'>> = [
  {
    pergunta: 'o que é fotossíntese?',
    disciplina: 'ciencias',
    resposta: {
      etapas: [
        {
          fala: 'A fotossíntese é o processo biológico pelo qual as plantas, algas e algumas bactérias produzem o seu próprio alimento utilizando a luz do Sol.',
          lousa: {
            tipo: 'texto',
            conteudo: '🌱 Fotossíntese: Produção de alimento e oxigênio'
          }
        },
        {
          fala: 'Ela acontece principalmente nas folhas das plantas, dentro de estruturas celulares chamadas cloroplastos, onde fica a clorofila, o pigmento verde que absorve a luz solar.',
          lousa: {
            tipo: 'lista',
            conteudo: [
              'Ocorre nos cloroplastos',
              'Pigmento responsável: Clorofila',
              'Reagentes: Luz solar + Água (H2O) + Gás Carbônico (CO2)'
            ]
          }
        },
        {
          fala: 'A planta absorve água do solo pelas raízes e gás carbônico do ar pelas folhas. Com a energia da luz, ela transforma esses elementos em glicose para se nutrir.',
          lousa: {
            tipo: 'formula',
            conteudo: '6 CO_2 + 6 H_2O + Luz \\to C_6H_{12}O_6 + 6 O_2'
          }
        },
        {
          fala: 'E o melhor de tudo para nós: como resultado desse processo, a planta libera gás oxigênio na atmosfera, que é essencial para a nossa respiração!',
          lousa: {
            tipo: 'imagem',
            conteudo: {
              termo: 'fotossintese vegetal',
              legenda: 'Esquema didático da fotossíntese'
            }
          }
        }
      ],
      textoCompleto: 'A fotossíntese é o processo pelo qual as plantas transformam luz solar, água e gás carbônico em glicose (energia) e liberam oxigênio para a atmosfera.',
      itensLousa: [
        {
          tipo: 'texto',
          conteudo: '🌱 Fotossíntese: Produção de alimento e oxigênio'
        },
        {
          tipo: 'lista',
          conteudo: [
            'Ocorre nos cloroplastos',
            'Pigmento responsável: Clorofila',
            'Reagentes: Luz solar + Água (H2O) + Gás Carbônico (CO2)'
          ]
        },
        {
          tipo: 'formula',
          conteudo: '6 CO_2 + 6 H_2O + Luz \\to C_6H_{12}O_6 + 6 O_2'
        }
      ],
      texto: 'A fotossíntese é o processo biológico pelo qual as plantas produzem seu próprio alimento utilizando luz solar, água e gás carbônico, liberando oxigênio.',
      fontes: [
        {
          livroId: 'ciencias-fundamental-6',
          tituloLivro: 'Ciências da Natureza - 6º Ano',
          pagina: 1
        }
      ]
    }
  },
  {
    pergunta: 'como funciona a fotossíntese?',
    disciplina: 'ciencias',
    resposta: {
      etapas: [
        {
          fala: 'A fotossíntese funciona em etapas fundamentais. A planta captura a luz solar através da clorofila presente nos cloroplastos.',
          lousa: {
            tipo: 'texto',
            conteudo: '☀️ Etapas da Fotossíntese'
          }
        },
        {
          fala: 'As raízes absorvem água e sais minerais do solo, enquanto os estômatos nas folhas absorvem o gás carbônico do ar.',
          lousa: {
            tipo: 'passos',
            conteudo: [
              '1. Absorção de água pelas raízes e CO2 pelas folhas',
              '2. Captação de fótons de luz pela clorofila',
              '3. Síntese de glicose nos cloroplastos',
              '4. Liberação de oxigênio (O2) no ar'
            ]
          }
        },
        {
          fala: 'Com a energia luminosa, a planta sintetiza açúcares como a glicose e devolve o oxigênio puro para o meio ambiente.',
          lousa: null
        }
      ],
      textoCompleto: 'A fotossíntese funciona capturando luz com a clorofila, unindo água e gás carbônico para produzir glicose e liberar oxigênio.',
      itensLousa: [
        {
          tipo: 'texto',
          conteudo: '☀️ Etapas da Fotossíntese'
        },
        {
          tipo: 'passos',
          conteudo: [
            '1. Absorção de água pelas raízes e CO2 pelas folhas',
            '2. Captação de fótons de luz pela clorofila',
            '3. Síntese de glicose nos cloroplastos',
            '4. Liberação de oxigênio (O2) no ar'
          ]
        }
      ],
      texto: 'A fotossíntese funciona absorvendo água, gás carbônico e luz solar para sintetizar glicose e oxigênio.',
      fontes: [
        {
          livroId: 'ciencias-fundamental-6',
          tituloLivro: 'Ciências da Natureza - 6º Ano',
          pagina: 1
        }
      ]
    }
  },
  {
    pergunta: 'o que é uma célula?',
    disciplina: 'ciencias',
    resposta: {
      etapas: [
        {
          fala: 'A célula é a menor unidade viva, estrutural e funcional de todos os seres vivos do planeta.',
          lousa: {
            tipo: 'texto',
            conteudo: '🔬 A Célula: Unidade Fundamental da Vida'
          }
        },
        {
          fala: 'Em uma célula típica, encontramos a membrana plasmática que a envolve, o citoplasma onde estão as organelas, e o núcleo onde fica o DNA.',
          lousa: {
            tipo: 'lista',
            conteudo: [
              'Membrana Plasmática: Proteção e troca de substâncias',
              'Citoplasma: Meio com organelas celulares',
              'Núcleo: Abrigo do material genético (DNA)',
              'Mitocôndrias: Respiração e produção de energia (ATP)'
            ]
          }
        }
      ],
      textoCompleto: 'A célula é a unidade básica da vida, composta por membrana plasmática, citoplasma e material genético.',
      itensLousa: [
        {
          tipo: 'texto',
          conteudo: '🔬 A Célula: Unidade Fundamental da Vida'
        },
        {
          tipo: 'lista',
          conteudo: [
            'Membrana Plasmática: Proteção e troca de substâncias',
            'Citoplasma: Meio com organelas celulares',
            'Núcleo: Abrigo do material genético (DNA)',
            'Mitocôndrias: Respiração e produção de energia (ATP)'
          ]
        }
      ],
      texto: 'A célula é a unidade fundamental dos seres vivos, abrigando organelas e o material genético.',
      fontes: [
        {
          livroId: 'ciencias-fundamental-6',
          tituloLivro: 'Ciências da Natureza - 6º Ano',
          pagina: 2
        }
      ]
    }
  },
  {
    pergunta: 'o que foi a Revolução Francesa?',
    disciplina: 'historia',
    resposta: {
      etapas: [
        {
          fala: 'A Revolução Francesa foi um movimento social e político iniciado em 1789 que pôs fim ao absolutismo e ao Antigo Regime na França.',
          lousa: {
            tipo: 'texto',
            conteudo: '🇫🇷 Revolução Francesa (1789)'
          }
        },
        {
          fala: 'Inspirada nos ideais iluministas de Liberdade, Igualdade e Fraternidade, teve como marco emblemático a Queda da Bastilha pelo povo de Paris.',
          lousa: {
            tipo: 'lista',
            conteudo: [
              'Lema: Liberdade, Igualdade, Fraternidade',
              'Marco inicial: Queda da Bastilha (14 de julho de 1789)',
              'Conquista: Declaração dos Direitos do Homem e do Cidadão'
            ]
          }
        }
      ],
      textoCompleto: 'A Revolução Francesa de 1789 transformou a França e o mundo ao derrubar o absolutismo sob os ideais de liberdade, igualdade e fraternidade.',
      itensLousa: [
        {
          tipo: 'texto',
          conteudo: '🇫🇷 Revolução Francesa (1789)'
        },
        {
          tipo: 'lista',
          conteudo: [
            'Lema: Liberdade, Igualdade, Fraternidade',
            'Marco inicial: Queda da Bastilha (14 de julho de 1789)',
            'Conquista: Declaração dos Direitos do Homem e do Cidadão'
          ]
        }
      ],
      texto: 'A Revolução Francesa foi um marco histórico de 1789 que aboliu os privilégios da nobreza e instaurou princípios de cidadania.',
      fontes: [
        {
          livroId: 'historia-fundamental-7',
          tituloLivro: 'História do Brasil e Geral - 7º Ano',
          pagina: 1
        }
      ]
    }
  },
  {
    pergunta: 'como somar frações com denominadores diferentes?',
    disciplina: 'matematica',
    resposta: {
      etapas: [
        {
          fala: 'Para somar frações com denominadores diferentes, primeiro precisamos encontrar um denominador comum através do MMC.',
          lousa: {
            tipo: 'formula',
            conteudo: '\\frac{1}{2} + \\frac{1}{3} = \\frac{?}{?}'
          }
        },
        {
          fala: 'Por exemplo, para somar um meio mais um terço, o MMC entre 2 e 3 é 6. Dividimos pelo de baixo e multiplicamos pelo de cima.',
          lousa: {
            tipo: 'passos',
            conteudo: [
              '1. MMC(2, 3) = 6',
              '2. 6 / 2 * 1 = 3 -> 3/6',
              '3. 6 / 3 * 1 = 2 -> 2/6',
              '4. 3/6 + 2/6 = 5/6'
            ]
          }
        },
        {
          fala: 'Com o mesmo denominador, somamos os numeradores: três mais dois dá cinco. Portanto, o resultado é cinco sextos!',
          lousa: {
            tipo: 'formula',
            conteudo: '\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}'
          }
        }
      ],
      textoCompleto: 'Para somar frações com denominadores diferentes, calcula-se o MMC para igualar os denominadores e depois somam-se os numeradores.',
      itensLousa: [
        {
          tipo: 'formula',
          conteudo: '\\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}'
        },
        {
          tipo: 'passos',
          conteudo: [
            '1. MMC(2, 3) = 6',
            '2. 6 / 2 * 1 = 3 -> 3/6',
            '3. 6 / 3 * 1 = 2 -> 2/6',
            '4. 3/6 + 2/6 = 5/6'
          ]
        }
      ],
      texto: 'Para somar frações com denominadores distintos, calcula-se o MMC para encontrar o denominador comum e somam-se os numeradores equivalentes.',
      fontes: [
        {
          livroId: 'matematica-fundamental-6',
          tituloLivro: 'Matemática Prática e Geometria - 6º Ano',
          pagina: 1
        }
      ]
    }
  }
];

export function gerarCachePerguntas(): ItemCacheResposta[] {
  console.log('\n======================================================');
  console.log('   TutorIA - Gerador de Cache de Respostas Prontas');
  console.log('======================================================\n');

  const itensCache: ItemCacheResposta[] = [];

  for (let i = 0; i < PERGUNTAS_FREQUENTES_CURRICULO.length; i++) {
    const item = PERGUNTAS_FREQUENTES_CURRICULO[i];
    const normalizada = normalizarFrase(item.pergunta);

    itensCache.push({
      id: `cache_pre_${i + 1}`,
      pergunta: item.pergunta,
      perguntaNormalizada: normalizada,
      disciplina: item.disciplina,
      resposta: item.resposta,
      origem: 'pre_construido',
      criadoEm: Date.now()
    });
  }

  fs.mkdirSync(path.dirname(CAMINHO_CACHE), { recursive: true });
  fs.writeFileSync(CAMINHO_CACHE, JSON.stringify(itensCache, null, 2), 'utf-8');

  console.log(`✅ Geradas ${itensCache.length} respostas prontas em cache.`);
  console.log(`📁 Cache salvo em: ${CAMINHO_CACHE}\n`);

  return itensCache;
}

if (process.argv[1] && process.argv[1].endsWith('gerar-cache.ts')) {
  gerarCachePerguntas();
}
