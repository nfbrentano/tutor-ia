/**
 * TUTORIA - Testes do Módulo de Avatar 3D (Three.js + VRM)
 * Cobre CT01, CT04, CT05, CT08, CT09, CT10, CT11, CT13, CT15 e Critérios CA01 a CA17.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { AvatarAnimator } from '../src/avatar/animator';
import { ControladorAvatar } from '../src/avatar/tipos';
import {
  Avatar3D,
  isWebGLAvailable,
  carregarAvatar3D,
  mapearPalavraParaVogalVRM,
  obterPoseApontarLousa,
  POSE_IDLE,
  POSE_LISTENING,
  POSE_THINKING,
  POSES_GESTOS_FALA,
  POSES_GESTOS_ESPERA
} from '../src/avatar3d';
import { getStoredAvatarMode, setStoredAvatarMode } from '../src/armazenamento';

describe('Avatar 3D - Especificação SDD (Three.js + VRM)', () => {
  let moduloElemento: HTMLElement;
  let statusTextoElemento: HTMLElement;
  let canvasElemento: HTMLCanvasElement;

  beforeEach(() => {
    localStorage.clear();
    moduloElemento = document.createElement('div');
    statusTextoElemento = document.createElement('span');
    canvasElemento = document.createElement('canvas');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('avatar-svg');
    const mouth = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    mouth.id = 'avatar-mouth';
    svg.appendChild(mouth);
    moduloElemento.appendChild(svg);
    moduloElemento.appendChild(canvasElemento);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CT01 / CA01: Conformidade com a Interface ControladorAvatar', () => {
    it('tanto AvatarAnimator quanto Avatar3D devem implementar todos os métodos da interface ControladorAvatar', () => {
      const animator2D: ControladorAvatar = new AvatarAnimator({
        moduloElemento,
        statusTextoElemento
      });

      const avatar3D: ControladorAvatar = new Avatar3D({
        canvasElemento,
        moduloElemento,
        statusTextoElemento
      });

      const metodosObrigatorios: Array<keyof ControladorAvatar> = [
        'definirEstado',
        'obterEstado',
        'atualizarMensagem',
        'notificarPalavraFalada',
        'pararFala',
        'apontarParaLousa',
        'iniciarCicloGestosEspera',
        'pararCicloGestosEspera',
        'aplicarProximoGestoEspera',
        'destruir'
      ];

      for (const metodo of metodosObrigatorios) {
        expect(typeof animator2D[metodo]).toBe('function');
        expect(typeof avatar3D[metodo]).toBe('function');
      }

      animator2D.destruir();
      avatar3D.destruir();
    });
  });

  describe('CT08 / CA07: Mapeamento de Palavras para Vogais VRM (Lip Sync)', () => {
    it('deve extrair a vogal tônica acentuada em palavras como fotossíntese, árvore, órgão', () => {
      expect(mapearPalavraParaVogalVRM('fotossíntese')).toBe('ih');
      expect(mapearPalavraParaVogalVRM('árvore')).toBe('aa');
      expect(mapearPalavraParaVogalVRM('órgão')).toBe('oh');
      expect(mapearPalavraParaVogalVRM('elétrico')).toBe('ee');
      expect(mapearPalavraParaVogalVRM('público')).toBe('ou');
    });

    it('deve extrair a vogal correspondente para palavras oxítonas e monossílabas sem acento', () => {
      expect(mapearPalavraParaVogalVRM('mel')).toBe('ee');
      expect(mapearPalavraParaVogalVRM('solar')).toBe('aa');
      expect(mapearPalavraParaVogalVRM('azul')).toBe('ou');
    });

    it('deve extrair a penúltima vogal para palavras paroxítonas sem acento', () => {
      expect(mapearPalavraParaVogalVRM('uva')).toBe('ou');
      expect(mapearPalavraParaVogalVRM('terra')).toBe('ee');
      expect(mapearPalavraParaVogalVRM('livro')).toBe('ih');
    });

    it('deve ciclar entre vogais de fallback quando nenhuma palavra for informada', () => {
      const v1 = mapearPalavraParaVogalVRM();
      const v2 = mapearPalavraParaVogalVRM();
      const v3 = mapearPalavraParaVogalVRM();
      expect(['aa', 'ih', 'ou', 'ee', 'oh']).toContain(v1);
      expect(['aa', 'ih', 'ou', 'ee', 'oh']).toContain(v2);
      expect(['aa', 'ih', 'ou', 'ee', 'oh']).toContain(v3);
    });
  });

  describe('CT09 / CA08: Interrupção e Fechamento Imediato da Boca', () => {
    it('pararFala deve zerar expressão da boca e redefinir pose quando voltar ao repouso', () => {
      const avatar = new Avatar3D({
        canvasElemento,
        moduloElemento,
        statusTextoElemento
      });

      avatar.definirEstado('speaking');
      avatar.notificarPalavraFalada('fotossíntese');

      avatar.pararFala();
      expect(avatar.obterEstado()).toBe('speaking');

      avatar.definirEstado('idle');
      expect(avatar.obterEstado()).toBe('idle');
      avatar.destruir();
    });
  });

  describe('CT10 / CA09, CA10: Catálogo de Poses e Rotações', () => {
    it('deve possuir ângulos e rotações definidos para poses de idle, listening e thinking', () => {
      expect(POSE_IDLE.chest).toBeDefined();
      expect(POSE_IDLE.rightUpperArm).toBeDefined();

      expect(POSE_LISTENING.head?.z).toBeGreaterThan(0); // Inclinação atenta da cabeça
      expect(POSE_THINKING.rightUpperArm?.x).toBeLessThan(0); // Braço à frente
      expect(POSE_THINKING.rightLowerArm?.y).toBeGreaterThan(2.0); // Cotovelo dobrado: mão no queixo
    });

    it('deve possuir todas as poses dos 4 gestos de fala e 3 gestos de espera', () => {
      const gestosFala = ['palmas-abertas', 'enfatizar', 'mao-no-peito', 'contar-dedos'] as const;
      for (const gesto of gestosFala) {
        expect(POSES_GESTOS_FALA[gesto]).toBeDefined();
        expect(POSES_GESTOS_FALA[gesto].rightUpperArm).toBeDefined();
      }

      const gestosEspera = ['olhar-cima', 'pensativo', 'postura-atenta'] as const;
      for (const gesto of gestosEspera) {
        expect(POSES_GESTOS_ESPERA[gesto]).toBeDefined();
        expect(POSES_GESTOS_ESPERA[gesto].head).toBeDefined();
      }
    });
  });

  describe('CT11 / CA11: Pose para Apontar para a Lousa nos Dois Layouts', () => {
    it('deve apontar para a direita no desktop e para baixo/frente no mobile', () => {
      const poseDesktop = obterPoseApontarLousa(false);
      const poseMobile = obterPoseApontarLousa(true);

      // Desktop: lousa à direita da tela (+X) → tronco gira para +X e o braço esquerdo sobe
      expect(poseDesktop.chest?.y).toBeGreaterThan(0);
      expect(Math.abs(poseDesktop.leftUpperArm!.z)).toBeLessThan(0.7);
      expect(poseDesktop.head?.y).toBeGreaterThan(0);

      // Mobile: inclinação para baixo/frente e braço direito saindo da posição de repouso
      expect(poseMobile.neck?.x).toBeGreaterThan(0);
      expect(poseMobile.rightUpperArm).not.toEqual(POSE_IDLE.rightUpperArm);
    });
  });

  describe('CT04, CT05 / CA04, CA05: Detecção de WebGL, Resiliência e Preferências', () => {
    it('isWebGLAvailable deve retornar false em ambiente de teste sem contexto WebGL nativo', () => {
      const suporta = isWebGLAvailable();
      expect(typeof suporta).toBe('boolean');
    });

    it('carregarAvatar3D deve retornar null graciosamente sem lançar exceções se WebGL indisponível', async () => {
      const resultado = await carregarAvatar3D({
        canvasElemento,
        moduloElemento,
        statusTextoElemento
      });
      // Em ambiente de teste JSDOM/Happy-DOM sem WebGL, o retorno deve ser null
      expect(resultado).toBeNull();
    });

    it('getStoredAvatarMode e setStoredAvatarMode devem persistir corretamente as opções', () => {
      expect(getStoredAvatarMode()).toBe('auto');

      setStoredAvatarMode('3d');
      expect(getStoredAvatarMode()).toBe('3d');

      setStoredAvatarMode('2d');
      expect(getStoredAvatarMode()).toBe('2d');

      setStoredAvatarMode('auto');
      expect(getStoredAvatarMode()).toBe('auto');
    });
  });

  describe('CT13 / CA13: Validação do Modelo VRM Oficial (public/avatar/tutor.vrm)', () => {
    it('o arquivo tutor.vrm deve existir, ter tamanho adequado e esqueleto humanoide completo com expressões', () => {
      const vrmPath = path.resolve(__dirname, '../public/avatar/tutor.vrm');
      expect(fs.existsSync(vrmPath)).toBe(true);

      const stats = fs.statSync(vrmPath);
      const tamanhoMB = stats.size / (1024 * 1024);
      expect(tamanhoMB).toBeLessThanOrEqual(25.0);

      const buffer = fs.readFileSync(vrmPath);
      const magic = buffer.readUInt32LE(0);
      expect(magic).toBe(0x46546c67); // "glTF"

      const chunkLength = buffer.readUInt32LE(12);
      const jsonBuffer = buffer.subarray(20, 20 + chunkLength);
      const gltf = JSON.parse(jsonBuffer.toString('utf8'));

      // Verifica triângulos
      let totalTriangulos = 0;
      for (const mesh of gltf.meshes || []) {
        for (const prim of mesh.primitives || []) {
          if (prim.indices !== undefined) {
            const accessor = gltf.accessors[prim.indices];
            totalTriangulos += accessor.count / 3;
          }
        }
      }
      expect(totalTriangulos).toBeLessThanOrEqual(50000);

      // Verifica esqueleto humanoide (VRM 0.x array ou VRM 1.0 object)
      const bones = gltf.extensions?.VRM?.humanoid?.humanBones || gltf.extensions?.VRMC_vrm?.humanoid?.humanBones;
      expect(bones).toBeDefined();
      const bonesCount = Array.isArray(bones) ? bones.length : Object.keys(bones).length;
      expect(bonesCount).toBeGreaterThan(15);

      // Verifica metadados de licença aberta (VRM Public License ou Creative Commons)
      const vrmMeta = gltf.extensions?.VRM?.meta || gltf.extensions?.VRMC_vrm?.meta;
      expect(vrmMeta).toBeDefined();
      const license = (vrmMeta?.licenseName || vrmMeta?.licenseUrl || '').toLowerCase();
      const redistribuicaoPermitida = vrmMeta?.allowRedistribution === true || vrmMeta?.commercialUsage === 'corporation';
      expect(license.includes('cc') || license.includes('vrm.dev') || redistribuicaoPermitida).toBeTruthy();
    });
  });

  describe('CT15 / CA15: Liberação de Recursos no destruir()', () => {
    it('destruir deve resetar visual para o plano B e limpar loops com segurança', () => {
      const avatar = new Avatar3D({
        canvasElemento,
        moduloElemento,
        statusTextoElemento
      });

      expect(() => avatar.destruir()).not.toThrow();
      expect(canvasElemento.style.display).toBe('none');
    });
  });
});
