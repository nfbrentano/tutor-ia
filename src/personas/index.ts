/**
 * TUTORIA - Ponto de Entrada do Módulo de Personas (RF06, RF07, RF11)
 * Não importa three.js: fica no JS inicial da página do tutor (RNF01 da spec do avatar 3D).
 */

export * from './catalogo';
export * from './materia';
export * from './tipos';
export * from './voz';

import { obterPersonaPadrao, obterPersonaPorId, obterPersonaPorMateria } from './catalogo';
import { MateriaId, Persona } from './tipos';

/**
 * Decide qual persona responde à próxima pergunta (RF07, RF12).
 * - Persona fixada pelo aluno sempre vence.
 * - Sem matéria detectada, mantém a persona atual.
 */
export function resolverPersona(
  materia: MateriaId | null,
  personaAtual: Persona | null,
  personaFixaId?: string | null
): Persona {
  const fixa = obterPersonaPorId(personaFixaId);
  if (fixa) return fixa;

  const daMateria = obterPersonaPorMateria(materia);
  if (daMateria) return daMateria;

  return personaAtual || obterPersonaPadrao();
}
