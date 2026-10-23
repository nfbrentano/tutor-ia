/**
 * TUTORIA - Catálogo de Personas por Matéria (RF06, RF09, RF10)
 *
 * Critério para personas inspiradas em pessoas reais: morte há ≥ 100 anos, retrato em
 * domínio público, sem licenciamento ativo da imagem (RNF06). Créditos em public/avatar/CREDITOS.md.
 */

import { MateriaId, Persona } from './tipos';

export const PERSONA_PADRAO_ID = 'lia';

/** Modelo usado por toda persona que ainda não tem `.vrm` próprio (D04). */
export const MODELO_PROVISORIO = './avatar/tutor.vrm';

export const PERSONAS: Persona[] = [
  {
    id: 'lia',
    nome: 'Lia',
    materias: ['geral'],
    descricao: 'Educadora jovem e acolhedora',
    voz: { genero: 'feminino', pitch: 1.05, rate: 1.05 }
  },
  {
    id: 'prof-atomo',
    nome: 'Prof. Átomo',
    materias: ['fisica_quimica'],
    descricao: 'Cientista original, curioso e animado',
    voz: { genero: 'masculino', pitch: 0.95, rate: 1.0 },
    pesosGestos: { enfatizar: 2, 'contar-dedos': 1.5 }
  },
  {
    id: 'ada',
    nome: 'Ada',
    materias: ['matematica'],
    inspiracao: { nome: 'Ada Lovelace', anos: '1815–1852' },
    descricao: 'Matemática precisa e paciente',
    voz: { genero: 'feminino', pitch: 1.0, rate: 1.0 },
    pesosGestos: { 'contar-dedos': 2 }
  },
  {
    id: 'oswaldo',
    nome: 'Oswaldo',
    materias: ['ciencias'],
    inspiracao: { nome: 'Oswaldo Cruz', anos: '1872–1917' },
    descricao: 'Cientista e médico sanitarista',
    voz: { genero: 'masculino', pitch: 0.9, rate: 1.0 }
  },
  {
    id: 'machado',
    nome: 'Machado',
    materias: ['portugues'],
    inspiracao: { nome: 'Machado de Assis', anos: '1839–1908' },
    descricao: 'Escritor elegante e contido',
    voz: { genero: 'masculino', pitch: 0.9, rate: 0.95 },
    pesosGestos: { 'mao-no-peito': 2, 'palmas-abertas': 0.5 }
  },
  {
    id: 'humboldt',
    nome: 'Humboldt',
    materias: ['geografia'],
    inspiracao: { nome: 'Alexander von Humboldt', anos: '1769–1859' },
    descricao: 'Explorador entusiasmado',
    voz: { genero: 'masculino', pitch: 1.0, rate: 1.05 },
    pesosGestos: { 'palmas-abertas': 2 }
  },
  {
    id: 'herodoto',
    nome: 'Heródoto',
    materias: ['historia'],
    inspiracao: { nome: 'Heródoto', anos: 'c. 484–425 a.C.' },
    descricao: 'Contador de histórias',
    voz: { genero: 'masculino', pitch: 0.85, rate: 0.95 },
    pesosGestos: { 'palmas-abertas': 1.5 }
  }
];

export function obterPersonaPorId(id: string | null | undefined): Persona | null {
  if (!id) return null;
  return PERSONAS.find(p => p.id === id) || null;
}

export function obterPersonaPadrao(): Persona {
  return obterPersonaPorId(PERSONA_PADRAO_ID)!;
}

export function obterPersonaPorMateria(materia: MateriaId | string | null | undefined): Persona | null {
  if (!materia) return null;
  return PERSONAS.find(p => p.materias.includes(materia as MateriaId)) || null;
}

export function obterModeloPersona(persona: Persona): string {
  return persona.modelo || MODELO_PROVISORIO;
}

/**
 * Texto de crédito exibido junto ao avatar (RF10, RNF07).
 */
export function descreverPersona(persona: Persona): string {
  if (persona.inspiracao) {
    const inspirado = persona.voz.genero === 'feminino' ? 'inspirada' : 'inspirado';
    return `${persona.nome}, ${inspirado} em ${persona.inspiracao.nome} (${persona.inspiracao.anos})`;
  }
  return persona.nome;
}
