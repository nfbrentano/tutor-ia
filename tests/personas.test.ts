/**
 * TUTORIA - Testes das Personas por Matéria
 * Spec: SDD/2026-10-23_avatar-personas-por-materia.md (CT09, CT13, CT15, CT16 e RF06, RF07, RF10 - RF13)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { getStoredPersonaFixa, setStoredPersonaFixa, CONFIG } from '../src/armazenamento';
import { extrairMateria } from '../src/gemini';
import {
  ajustarPitchPersona,
  descreverPersona,
  detectarMateria,
  escolherVozParaPersona,
  inferirGeneroVoz,
  MODELO_PROVISORIO,
  normalizarMateria,
  obterModeloPersona,
  obterPersonaPadrao,
  obterPersonaPorId,
  obterPersonaPorMateria,
  PERSONAS,
  resolverPersona,
  VozDisponivel
} from '../src/personas';

describe('Personas por matéria', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('CT09 / CA10: detecção da matéria da pergunta', () => {
    it('reconhece cada matéria pelas palavras-chave', () => {
      expect(detectarMateria('como balancear uma equação química?')).toBe('fisica_quimica');
      expect(detectarMateria('o que é a tabela periódica')).toBe('fisica_quimica');
      expect(detectarMateria('qual a segunda lei de Newton?')).toBe('fisica_quimica');
      expect(detectarMateria('como usar o teorema de Pitágoras')).toBe('matematica');
      expect(detectarMateria('quanto é 12 x 8?')).toBe('matematica');
      expect(detectarMateria('explica a fotossíntese')).toBe('ciencias');
      expect(detectarMateria('quando usar crase?')).toBe('portugues');
      expect(detectarMateria('quem foi Machado de Assis')).toBe('portugues');
      expect(detectarMateria('como é o clima do cerrado?')).toBe('geografia');
      expect(detectarMateria('o que foi a Revolução Francesa')).toBe('historia');
    });

    it('retorna null para perguntas sem matéria reconhecível', () => {
      expect(detectarMateria('oi')).toBeNull();
      expect(detectarMateria('pode me ajudar com uma dúvida?')).toBeNull();
      expect(detectarMateria('')).toBeNull();
    });

    it('normaliza a matéria informada pelo Gemini (RF13)', () => {
      expect(normalizarMateria('fisica_quimica')).toBe('fisica_quimica');
      expect(normalizarMateria('Química')).toBe('fisica_quimica');
      expect(normalizarMateria('Matemática')).toBe('matematica');
      expect(normalizarMateria('Língua Portuguesa')).toBe('portugues');
      expect(normalizarMateria('Biologia')).toBe('ciencias');
      expect(normalizarMateria('geral')).toBe('geral');
      expect(normalizarMateria('astrologia')).toBeNull();
      expect(normalizarMateria(42)).toBeNull();
    });

    it('extrai o campo materia da resposta do Gemini, mesmo com JSON incompleto', () => {
      expect(extrairMateria('{"materia": "historia", "etapas": [{"fala": "Ol')).toBe('historia');
      expect(extrairMateria('{"etapas": []}')).toBeUndefined();
    });

    it('o prompt do Gemini pede o campo materia e proíbe citações inventadas (RF10, RF13)', () => {
      expect(CONFIG.SYSTEM_PROMPT).toContain('"materia"');
      expect(CONFIG.SYSTEM_PROMPT).toMatch(/nunca atribua a pessoas reais/);
    });
  });

  describe('RF06 / RNF06: catálogo de personas', () => {
    it('tem uma persona para cada matéria e a persona geral padrão', () => {
      for (const materia of ['fisica_quimica', 'matematica', 'ciencias', 'portugues', 'geografia', 'historia', 'geral']) {
        expect(obterPersonaPorMateria(materia)).not.toBeNull();
      }
      expect(obterPersonaPadrao().id).toBe('lia');
      expect(obterPersonaPorMateria('fisica_quimica')?.id).toBe('prof-atomo');
    });

    it('CT13 / CA14: nenhuma persona usa o nome Einstein', () => {
      expect(JSON.stringify(PERSONAS).toLowerCase()).not.toContain('einstein');
      expect(obterPersonaPorId('prof-atomo')?.inspiracao).toBeUndefined();
    });

    it('personas inspiradas em pessoas reais têm crédito com nome e anos (RF10)', () => {
      const inspiradas = PERSONAS.filter(p => p.inspiracao);
      expect(inspiradas.map(p => p.id).sort()).toEqual(['ada', 'herodoto', 'humboldt', 'machado', 'oswaldo']);
      for (const p of inspiradas) {
        expect(descreverPersona(p)).toContain(p.inspiracao!.nome);
        expect(descreverPersona(p)).toContain(p.inspiracao!.anos);
      }
      expect(descreverPersona(obterPersonaPorId('ada')!)).toBe('Ada, inspirada em Ada Lovelace (1815–1852)');
      expect(descreverPersona(obterPersonaPorId('lia')!)).toBe('Lia');
    });

    it('usa o modelo provisório enquanto a persona não tem .vrm próprio (D04)', () => {
      const lia = obterPersonaPadrao();
      expect(obterModeloPersona({ ...lia, modelo: undefined })).toBe(MODELO_PROVISORIO);
      expect(obterModeloPersona({ ...lia, modelo: './avatar/personas/lia.vrm' })).toBe('./avatar/personas/lia.vrm');
    });
  });

  describe('RF07 / RF12 / CA17: escolha da persona', () => {
    it('a persona fixada pelo aluno sempre vence', () => {
      const atual = obterPersonaPadrao();
      expect(resolverPersona('matematica', atual, 'machado').id).toBe('machado');
    });

    it('sem persona fixa, escolhe pela matéria', () => {
      expect(resolverPersona('historia', obterPersonaPadrao(), '').id).toBe('herodoto');
    });

    it('sem matéria detectada, mantém a persona atual', () => {
      const ada = obterPersonaPorId('ada')!;
      expect(resolverPersona(null, ada, '').id).toBe('ada');
      expect(resolverPersona(null, null, '').id).toBe('lia');
    });

    it('persona fixa inválida é ignorada', () => {
      expect(resolverPersona('ciencias', null, 'inexistente').id).toBe('oswaldo');
    });

    it('persiste a persona fixa e volta ao automático com valor vazio', () => {
      expect(getStoredPersonaFixa()).toBe('');
      setStoredPersonaFixa('ada');
      expect(getStoredPersonaFixa()).toBe('ada');
      setStoredPersonaFixa('');
      expect(getStoredPersonaFixa()).toBe('');
    });
  });

  describe('CT15 / CA16: voz por persona', () => {
    const vozes: VozDisponivel[] = [
      { id: 'f1', name: 'Microsoft Francisca Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR' },
      { id: 'm1', name: 'Microsoft Antonio Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR' },
      { id: 'en', name: 'Microsoft Guy Online (Natural) - English', lang: 'en-US' }
    ];

    it('infere o gênero pelos nomes de vozes comuns', () => {
      expect(inferirGeneroVoz('Luciana')).toBe('feminino');
      expect(inferirGeneroVoz('Microsoft Antonio Online')).toBe('masculino');
      expect(inferirGeneroVoz('Voz desconhecida')).toBeNull();
    });

    it('escolhe voz feminina para Ada e masculina para Oswaldo', () => {
      expect(escolherVozParaPersona(vozes, obterPersonaPorId('ada')!)).toBe('f1');
      expect(escolherVozParaPersona(vozes, obterPersonaPorId('oswaldo')!)).toBe('m1');
    });

    it('sem voz do gênero, usa outra voz pt-BR e ajusta o tom', () => {
      const soFeminina = [vozes[0]];
      const oswaldo = obterPersonaPorId('oswaldo')!;
      expect(escolherVozParaPersona(soFeminina, oswaldo)).toBe('f1');
      expect(ajustarPitchPersona(oswaldo, soFeminina[0].name)).toBeLessThan(oswaldo.voz.pitch);
      expect(ajustarPitchPersona(oswaldo, vozes[1].name)).toBe(oswaldo.voz.pitch);
    });

    it('sem vozes em português, deixa o serviço usar o padrão', () => {
      expect(escolherVozParaPersona([vozes[2]], obterPersonaPadrao())).toBeUndefined();
      expect(escolherVozParaPersona([], obterPersonaPadrao())).toBeUndefined();
    });
  });
});
