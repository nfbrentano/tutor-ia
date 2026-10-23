/**
 * TUTORIA - Escolha da Voz da Persona (RF11, CA16)
 */

import { GeneroVoz, Persona } from './tipos';

export interface VozDisponivel {
  id: string;
  name: string;
  lang: string;
}

// Nomes de vozes pt-BR comuns em Windows/Edge, macOS/iOS, Chrome e Android.
const NOMES_FEMININOS = [
  'francisca', 'thalita', 'leila', 'yara', 'brenda', 'elza', 'giovanna', 'leticia', 'manuela',
  'luciana', 'maria', 'vitoria', 'camila', 'raquel', 'fernanda', 'helena', 'joana', 'google'
];
const NOMES_MASCULINOS = [
  'antonio', 'donato', 'fabio', 'humberto', 'julio', 'nicolau', 'valerio', 'macerio', 'daniel',
  'felipe', 'ricardo', 'eduardo', 'heitor', 'tiago', 'paulo'
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function inferirGeneroVoz(nomeVoz: string): GeneroVoz | null {
  const nome = normalizar(nomeVoz);
  if (/\b(male|masculin)/.test(nome) && !/female/.test(nome)) return 'masculino';
  if (/female|feminin/.test(nome)) return 'feminino';
  if (NOMES_MASCULINOS.some(n => nome.includes(n))) return 'masculino';
  if (NOMES_FEMININOS.some(n => nome.includes(n))) return 'feminino';
  return null;
}

function pontuarQualidade(nomeVoz: string): number {
  const nome = normalizar(nomeVoz);
  if (nome.includes('natural') || nome.includes('neural')) return 3;
  if (nome.includes('google') || nome.includes('enhanced') || nome.includes('premium')) return 2;
  return 1;
}

/**
 * Escolhe a voz pt-BR mais adequada ao gênero da persona. Retorna undefined quando
 * não há voz pt-BR, deixando o serviço de voz usar o próprio padrão.
 */
export function escolherVozParaPersona(vozes: VozDisponivel[], persona: Persona): string | undefined {
  const pt = vozes.filter(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
  const candidatas = pt.length > 0 ? pt : vozes.filter(v => v.lang.toLowerCase().startsWith('pt'));
  if (candidatas.length === 0) return undefined;

  const doGenero = candidatas.filter(v => inferirGeneroVoz(v.name) === persona.voz.genero);
  const lista = doGenero.length > 0 ? doGenero : candidatas;
  const melhor = [...lista].sort((a, b) => pontuarQualidade(b.name) - pontuarQualidade(a.name))[0];
  return melhor.id;
}

/**
 * Com uma única voz disponível, o `pitch` é o que diferencia as personas; quando a voz
 * escolhida não é do gênero da persona, o tom é ajustado na direção certa.
 */
export function ajustarPitchPersona(persona: Persona, nomeVozEscolhida?: string): number {
  if (!nomeVozEscolhida) return persona.voz.pitch;
  const generoVoz = inferirGeneroVoz(nomeVozEscolhida);
  if (generoVoz === null || generoVoz === persona.voz.genero) return persona.voz.pitch;
  return persona.voz.genero === 'masculino'
    ? Math.max(0.6, persona.voz.pitch - 0.2)
    : Math.min(1.4, persona.voz.pitch + 0.15);
}
