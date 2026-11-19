/**
 * TUTORIA - Tipos das Personas do Tutor por Matéria (RF06)
 */

export type MateriaId =
  | 'fisica_quimica'
  | 'matematica'
  | 'ciencias'
  | 'portugues'
  | 'geografia'
  | 'historia'
  | 'geral';

export type GeneroVoz = 'feminino' | 'masculino';

export interface VozPersona {
  genero: GeneroVoz;
  pitch: number;
  rate: number;
}

export interface CameraPersona {
  /** Deslocamento vertical do ponto de mira em relação à cabeça (metros). */
  alturaMira: number;
  /** Distância da câmera ao personagem (metros). */
  distancia: number;
}

export interface Persona {
  id: string;
  nome: string;
  materias: MateriaId[];
  /**
   * Caminho do modelo `.vrm` da persona. Enquanto o modelo próprio não existe,
   * fica indefinido e o avatar usa o modelo provisório (D04).
   */
  modelo?: string;
  /** Pessoa real que inspirou a persona; ausente nas personas originais (RF10). */
  inspiracao?: { nome: string; anos: string };
  descricao: string;
  /** Cor de destaque para halo, luz secundária 3D e distintivo de matéria (RF05). */
  corTema: string;
  /** Ícone/emblema visual da persona (RF05). */
  emblema: string;
  voz: VozPersona;
  camera?: CameraPersona;
  /** Peso relativo de cada gesto de fala; gestos ausentes têm peso 1. */
  pesosGestos?: Record<string, number>;
}
