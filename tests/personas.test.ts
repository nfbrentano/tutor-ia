/**
 * TUTORIA - Testes das Personas por Matéria
 * Spec: SDD/2026-10-23_avatar-personas-por-materia.md (CT09, CT13, CT15, CT16 e RF06, RF07, RF10 - RF13)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

import { getStoredPersonaFixa, setStoredPersonaFixa, CONFIG } from '../src/armazenamento';
import { obterOpcoesDemonstracaoVoz } from '../src/configuracoes';
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

    it('CT10 / CA10: demonstração em Configurações usa voz e pitch da persona selecionada no modo automático', () => {
      const profAtomo = obterPersonaPorId('prof-atomo')!;
      const opcoesAuto = obterOpcoesDemonstracaoVoz(vozes, '', 1.0, 'prof-atomo');
      expect(opcoesAuto.voiceUri).toBe('m1');
      expect(opcoesAuto.pitch).toBe(profAtomo.voz.pitch);
      expect(opcoesAuto.rate).toBeCloseTo(profAtomo.voz.rate);

      // Com voz fixa escolhida, a escolha do usuário prevalece
      const opcoesFixa = obterOpcoesDemonstracaoVoz(vozes, 'f1', 1.1, 'prof-atomo');
      expect(opcoesFixa.voiceUri).toBe('f1');
      expect(opcoesFixa.pitch).toBeLessThan(profAtomo.voz.pitch);
    });
  });

  describe('CT17 / CA18 / RNF01 / RNF02 / RNF06: validação dos assets das personas e créditos', () => {
    const OSSOS_OBRIGATORIOS = [
      'hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftEye', 'rightEye',
      'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
      'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
      'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
      'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand'
    ];
    const OSSOS_DEDOS = [
      'ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal',
      'IndexProximal', 'IndexIntermediate', 'IndexDistal',
      'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal',
      'RingProximal', 'RingIntermediate', 'RingDistal',
      'LittleProximal', 'LittleIntermediate', 'LittleDistal'
    ].flatMap(sufixo => [`left${sufixo}`, `right${sufixo}`]);
    const EXPRESSOES_OBRIGATORIAS = ['blink', 'aa', 'ih', 'ou', 'ee', 'oh', 'happy', 'relaxed', 'surprised'];

    it('cada persona aponta para seu .vrm exclusivo e tutor.vrm foi removido (RF14, CA12)', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../public/avatar/tutor.vrm'))).toBe(false);
      for (const persona of PERSONAS) {
        expect(persona.modelo).toBe(`./avatar/personas/${persona.id}.vrm`);
        const arquivo = path.resolve(__dirname, `../public/avatar/personas/${persona.id}.vrm`);
        expect(fs.existsSync(arquivo)).toBe(true);
      }
    });

    it('todos os 7 arquivos .vrm cumprem RNF01, CA14 e carregam no VRMLoaderPlugin', async () => {
      for (const persona of PERSONAS) {
        const arquivo = path.resolve(__dirname, `../public/avatar/personas/${persona.id}.vrm`);
        const stats = fs.statSync(arquivo);
        expect(stats.size).toBeLessThanOrEqual(6 * 1024 * 1024);

        const buf = fs.readFileSync(arquivo);
        expect(buf.readUInt32LE(0)).toBe(0x46546c67);
        const jsonLen = buf.readUInt32LE(12);
        const jsonStr = buf.subarray(20, 20 + jsonLen).toString('utf8');
        expect(jsonStr.toLowerCase()).not.toContain('einstein');

        const gltf = JSON.parse(jsonStr);
        let triangulos = 0;
        for (const mesh of gltf.meshes || []) {
          for (const prim of mesh.primitives || []) {
            if (prim.indices !== undefined) {
              triangulos += gltf.accessors[prim.indices].count / 3;
            }
          }
        }
        expect(triangulos).toBeGreaterThan(500);
        expect(triangulos).toBeLessThanOrEqual(30000);
        expect((gltf.materials || []).length).toBeLessThanOrEqual(4);

        const vrmExt = gltf.extensions?.VRMC_vrm;
        expect(vrmExt?.specVersion).toBe('1.0');

        const humanBones = vrmExt?.humanoid?.humanBones || {};
        for (const osso of [...OSSOS_OBRIGATORIOS, ...OSSOS_DEDOS]) {
          expect(humanBones[osso]?.node).toBeTypeOf('number');
        }

        const presets = vrmExt?.expressions?.preset || {};
        const targets = gltf.meshes?.[0]?.primitives?.[0]?.targets || [];
        for (const expr of EXPRESSOES_OBRIGATORIAS) {
          const binds = presets[expr]?.morphTargetBinds;
          expect(Array.isArray(binds) && binds.length > 0).toBe(true);
          expect(binds[0].index).toBeLessThan(targets.length);
        }

        // Carregamento real com GLTFLoader + VRMLoaderPlugin (@pixiv/three-vrm)
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const parsed = await new Promise<{ userData: Record<string, unknown> }>((resolve, reject) => {
          loader.parse(ab, '', resolve, reject);
        });
        const vrm = parsed.userData.vrm as {
          humanoid?: { getNormalizedBoneNode: (n: string) => unknown };
          expressionManager?: { getExpression: (n: string) => unknown };
          lookAt?: unknown;
        };
        expect(vrm).toBeDefined();
        expect(vrm.humanoid?.getNormalizedBoneNode('head')).toBeTruthy();
        expect(vrm.humanoid?.getNormalizedBoneNode('leftIndexDistal')).toBeTruthy();
        expect(vrm.lookAt).toBeDefined();
        for (const expr of EXPRESSOES_OBRIGATORIAS) {
          expect(vrm.expressionManager?.getExpression(expr)).toBeTruthy();
        }
      }
    });

    it('pacote de animações em public/avatar/animacoes ocupa ≤ 3 MB (RNF02)', () => {
      const dirAnim = path.resolve(__dirname, '../public/avatar/animacoes');
      const totalBytes = fs
        .readdirSync(dirAnim)
        .reduce((acc, nome) => acc + fs.statSync(path.join(dirAnim, nome)).size, 0);
      expect(totalBytes).toBeLessThanOrEqual(3 * 1024 * 1024);
    });

    it('CREDITOS.md documenta todas as 7 personas e seus arquivos sem entradas pendentes (RNF06, CA18)', () => {
      const creditosPath = path.resolve(__dirname, '../public/avatar/CREDITOS.md');
      const creditos = fs.readFileSync(creditosPath, 'utf8');
      expect(creditos.toLowerCase()).not.toContain('pendente');
      for (const persona of PERSONAS) {
        expect(creditos).toContain(persona.nome);
        expect(creditos).toContain(`personas/${persona.id}.vrm`);
      }
    });
  });
});
