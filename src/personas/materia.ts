/**
 * TUTORIA - Detecção da Matéria da Pergunta para Escolha da Persona (RF07)
 *
 * Mais ampla que `detectarTema` (que só reconhece temas com frase de eco): cada matéria
 * soma pontos pelas palavras-chave encontradas, e a de maior pontuação vence.
 */

import { detectarTema } from '../espera/temas';
import { MateriaId } from './tipos';

type MateriaDetectavel = Exclude<MateriaId, 'geral'>;

const PALAVRAS_CHAVE: Record<MateriaDetectavel, RegExp[]> = {
  fisica_quimica: [
    /qu[ií]mic/i, /f[ií]sica/i, /[aá]tomo/i, /mol[eé]cula/i, /el[eé]tron/i, /pr[oó]ton/i, /n[eê]utron/i,
    /tabela peri[oó]dica/i, /elemento qu[ií]mico/i, /rea[cç][aãõo]/i, /balancea/i, /estequiometria/i,
    /\bmols?\b/i, /[aá]cido/i, /\bbases?\b/i, /\bph\b/i, /liga[cç][aãõo]+ (i[oô]nica|covalente|met[aá]lica)/i,
    /\bh_?2o\b/i, /\bco_?2\b/i, /oxida[cç]/i, /solu[cç][aã]o (aquosa|saturada)/i, /\bnewton\b/i, /gravidade/i,
    /velocidade/i, /acelera[cç]/i, /for[cç]a (resultante|peso|de atrito)/i, /energia (cin[eé]tica|potencial)/i,
    /eletricidade/i, /circuito/i, /voltagem/i, /\bohm\b/i, /corrente el[eé]trica/i, /termodin[aâ]mica/i,
    /[oó]ptica/i, /\bluz\b/i, /\bonda/i, /magnetismo/i
  ],
  matematica: [
    /matem[aá]tica/i, /equa[cç]/i, /inc[oó]gnita/i, /fra[cç][aãõo]/i, /porcentagem/i, /por cento/i,
    /fun[cç][aã]o (afim|quadr[aá]tica|linear|exponencial)/i, /par[aá]bola/i, /geometria/i, /[aá]rea d/i,
    /per[ií]metro/i, /tri[aâ]ngulo/i, /pit[aá]goras/i, /hipotenusa/i, /cateto/i, /bhaskara/i, /baskhara/i,
    /trigonometria/i, /\bseno\b/i, /cosseno/i, /logaritmo/i, /pot[eê]ncia/i, /raiz quadrada/i, /\bmmc\b/i,
    /\bmdc\b/i, /divis[aã]o/i, /multiplica[cç]/i, /probabilidade/i, /estat[ií]stica/i, /\bmédia\b/i,
    /\d+\s*[x×*+\-\/=]\s*\d+/
  ],
  ciencias: [
    /ci[eê]ncias/i, /biologia/i, /fotoss[ií]ntese/i, /c[eé]lula/i, /organela/i, /mitoc[oô]ndria/i, /\bdna\b/i,
    /gen[eé]tica/i, /\bgenes?\b/i, /hereditariedade/i, /ecossistema/i, /cadeia alimentar/i, /v[ií]rus/i,
    /bact[eé]ria/i, /vacina/i, /sistema (digest[oó]rio|nervoso|respirat[oó]rio|circulat[oó]rio|imunol[oó]gico)/i,
    /[oó]rg[aã]o/i, /evolu[cç][aã]o das esp[eé]cies/i, /darwin/i, /sistema solar/i, /planeta/i, /esp[eé]cie/i,
    /animal|animais/i, /plantas?\b/i, /corpo humano/i, /doen[cç]a/i
  ],
  portugues: [
    /portugu[eê]s/i, /gram[aá]tica/i, /crase/i, /v[ií]rgula/i, /pontua[cç]/i, /substantivo/i, /adjetivo/i,
    /\bverbos?\b/i, /pronome/i, /adv[eé]rbio/i, /concord[aâ]ncia/i, /reg[eê]ncia/i, /ortografia/i,
    /acentua[cç]/i, /sujeito e predicado/i, /ora[cç][aãõ]/i, /figuras? de linguagem/i, /met[aá]fora/i,
    /literatura/i, /machado de assis/i, /\bpoema/i, /reda[cç][aã]o/i, /interpreta[cç][aã]o de texto/i,
    /sin[oô]nimo/i, /ant[oô]nimo/i, /s[ií]laba/i
  ],
  geografia: [
    /geografia/i, /relevo/i, /placas tect[oô]nicas/i, /terremoto/i, /vulc[aã]o/i, /clima/i, /bioma/i,
    /vegeta[cç][aã]o/i, /amaz[oô]nia|amaz[oô]nica/i, /cerrado/i, /caatinga/i, /urbaniza[cç]/i, /demografia/i,
    /migra[cç]/i, /hidrografia/i, /bacia hidrogr[aá]fica/i, /\brios?\b/i, /continente/i, /latitude/i,
    /longitude/i, /fuso hor[aá]rio/i, /mapa/i, /globaliza[cç]/i, /regi[aãõo]e?s? (norte|nordeste|sul|sudeste|centro)/i
  ],
  historia: [
    /hist[oó]ria/i, /guerra/i, /nazismo/i, /holocausto/i, /revolu[cç][aã]o/i, /bastilha/i, /col[oô]nia/i,
    /imp[eé]rio/i, /dom pedro/i, /escravid[aã]o/i, /aboli[cç][aã]o/i, /capitanias/i, /roma antiga/i,
    /gr[eé]cia antiga/i, /atenas/i, /esparta/i, /idade m[eé]dia/i, /feudalismo/i, /independ[eê]ncia/i,
    /rep[uú]blica/i, /ditadura/i, /descobrimento/i, /egito antigo/i, /fara[oó]/i, /renascimento/i
  ]
};

/** Em empate, vence a matéria que aparece antes nesta lista. */
const PRIORIDADE: MateriaDetectavel[] = [
  'fisica_quimica',
  'matematica',
  'ciencias',
  'portugues',
  'geografia',
  'historia'
];

/**
 * Detecta a matéria da pergunta. Retorna null quando não há sinal suficiente (RF07).
 */
export function detectarMateria(pergunta: string): MateriaDetectavel | null {
  if (!pergunta || typeof pergunta !== 'string') return null;
  const texto = pergunta.trim();
  if (texto.length < 3) return null;

  let melhor: MateriaDetectavel | null = null;
  let melhorPontos = 0;

  for (const materia of PRIORIDADE) {
    const pontos = PALAVRAS_CHAVE[materia].reduce((soma, padrao) => soma + (padrao.test(texto) ? 1 : 0), 0);
    if (pontos > melhorPontos) {
      melhor = materia;
      melhorPontos = pontos;
    }
  }

  if (melhor) return melhor;

  const tema = detectarTema(texto);
  return tema ? (tema.materia as MateriaDetectavel) : null;
}

/**
 * Normaliza a matéria informada pelo Gemini (RF13) para uma chave conhecida.
 */
export function normalizarMateria(valor: unknown): MateriaId | null {
  if (typeof valor !== 'string') return null;
  const v = valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  if (/quimica|fisica/.test(v)) return 'fisica_quimica';
  if (/matematica/.test(v)) return 'matematica';
  if (/ciencia|biologia/.test(v)) return 'ciencias';
  if (/portugues|lingua|literatura|gramatica|redacao/.test(v)) return 'portugues';
  if (/geografia/.test(v)) return 'geografia';
  if (/historia/.test(v)) return 'historia';
  if (/geral|outra/.test(v)) return 'geral';
  return null;
}
