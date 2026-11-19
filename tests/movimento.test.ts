/**
 * TUTORIA - Testes do Movimento Humano do Avatar 3D
 * Spec: SDD/2026-10-23_avatar-personas-por-materia.md (CT01 - CT03, CT06, CT07 e RF01 - RF05)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';

import { sortearProximoGesto } from '../src/avatar/gestos';
import {
  Avatar3D,
  calcularCamadasProcedurais,
  calcularRotacaoBracoParaDirecao,
  dedosParaPalavra,
  fatorSuavizacao,
  gerarSequenciaBoca,
  GerenciadorClipes,
  MolaGesto,
  POSE_IDLE,
  quebrarEmSilabas,
  sortearIndiceSemRepetir,
  validarManifestoClipes
} from '../src/avatar3d';
import { obterPersonaPorId } from '../src/personas';

describe('Movimento humano do avatar 3D', () => {
  describe('CT01 / CA01: camadas procedurais', () => {
    it('a respiração e a troca de peso variam com o tempo', () => {
      const t0 = calcularCamadasProcedurais(0, 'repouso');
      const t1 = calcularCamadasProcedurais(1.05, 'repouso');
      expect(t0.chest!.x).not.toBeCloseTo(t1.chest!.x, 3);
      expect(t0.hips!.z).not.toBeCloseTo(t1.hips!.z, 3);
    });

    it('a cabeça se mexe mais falando do que ouvindo', () => {
      let falando = 0;
      let atento = 0;
      for (let t = 0; t < 20; t += 0.1) {
        falando += Math.abs(calcularCamadasProcedurais(t, 'falando').head!.y);
        atento += Math.abs(calcularCamadasProcedurais(t, 'atento').head!.y);
      }
      expect(falando).toBeGreaterThan(atento * 2);
    });
  });

  describe('CT02 / CA02: suavização independente do fps', () => {
    const simular = (fps: number, duracaoSeg: number) => {
      let valor = 0;
      const dt = 1 / fps;
      for (let t = 0; t < duracaoSeg - 1e-9; t += dt) {
        valor += (1 - valor) * fatorSuavizacao(6, dt);
      }
      return valor;
    };

    it('chega ao mesmo ponto em 0,5 s a 30 e a 60 fps', () => {
      expect(simular(30, 0.5)).toBeCloseTo(simular(60, 0.5), 5);
      expect(simular(60, 0.5)).toBeGreaterThan(0.9);
    });

    it('delta zero não move nada', () => {
      expect(fatorSuavizacao(6, 0)).toBe(0);
    });
  });

  describe('CT03 / CA03: gestos e clipes sem repetição', () => {
    it('sorteio ponderado nunca repete o gesto anterior', () => {
      let anterior = sortearProximoGesto(null, { enfatizar: 10 });
      for (let i = 0; i < 50; i++) {
        const proximo = sortearProximoGesto(anterior, { enfatizar: 10, 'contar-dedos': 0.1 });
        expect(proximo).not.toBe(anterior);
        anterior = proximo;
      }
    });

    it('sorteio de clipe nunca repete o índice anterior', () => {
      let anterior: number | null = null;
      for (let i = 0; i < 50; i++) {
        const indice = sortearIndiceSemRepetir(3, anterior);
        expect(indice).toBeGreaterThanOrEqual(0);
        expect(indice).toBeLessThan(3);
        expect(indice).not.toBe(anterior);
        anterior = indice;
      }
      expect(sortearIndiceSemRepetir(1, 0)).toBe(0);
    });

    it('manifesto de clipes descarta entradas inválidas', () => {
      const manifesto = validarManifestoClipes({
        clipes: [
          { arquivo: 'falando-1.fbx', categoria: 'speaking' },
          { arquivo: '../segredo.fbx', categoria: 'idle' },
          { arquivo: 'dança.fbx', categoria: 'dancar' },
          { arquivo: 'idle.glb', categoria: 'idle' },
          null
        ]
      });
      expect(manifesto.clipes).toEqual([{ arquivo: 'falando-1.fbx', categoria: 'speaking' }]);
      expect(validarManifestoClipes(null).clipes).toEqual([]);
    });
  });

  describe('Mola das batidas de gesto', () => {
    it('reage ao impulso e volta ao repouso', () => {
      const mola = new MolaGesto();
      mola.impulsionar(-3);
      let minimo = 0;
      for (let i = 0; i < 6; i++) minimo = Math.min(minimo, mola.atualizar(1 / 60));
      expect(minimo).toBeLessThan(-0.01);
      for (let i = 0; i < 120; i++) mola.atualizar(1 / 60);
      expect(Math.abs(mola.valor())).toBeLessThan(0.005);
    });
  });

  describe('CT08 / CA09: mira do braço', () => {
    it('braço esquerdo apontando para +X fica na pose T', () => {
      const r = calcularRotacaoBracoParaDirecao('left', { x: 1, y: 0, z: 0 });
      expect(r.x).toBeCloseTo(0, 5);
      expect(r.y).toBeCloseTo(0, 5);
      expect(r.z).toBeCloseTo(0, 5);
    });

    it('braço esquerdo apontando para a frente gira -90° em Y', () => {
      const r = calcularRotacaoBracoParaDirecao('left', { x: 0, y: 0, z: 1 });
      expect(r.y).toBeCloseTo(-Math.PI / 2, 4);
    });

    it('braço direito apontando para baixo gira +90° em Z', () => {
      const r = calcularRotacaoBracoParaDirecao('right', { x: 0, y: -1, z: 0 });
      expect(r.z).toBeCloseTo(Math.PI / 2, 4);
    });
  });

  describe('CT06 / CA07: lip sync por sílaba', () => {
    it('quebra palavras em sílabas aproximadas', () => {
      expect(quebrarEmSilabas('bola')).toEqual(['bo', 'la']);
      expect(quebrarEmSilabas('mar')).toEqual(['mar']);
      expect(quebrarEmSilabas('fotossíntese').length).toBeGreaterThanOrEqual(4);
      expect(quebrarEmSilabas('')).toEqual([]);
    });

    it('fecha a boca em P, B e M', () => {
      const pao = gerarSequenciaBoca('pão');
      expect(pao[0].forma).toBe('fechada');
      expect(pao[1].forma).toBe('aa');

      const mapa = gerarSequenciaBoca('mapa');
      expect(mapa.filter(s => s.forma === 'fechada')).toHaveLength(2);

      const bola = gerarSequenciaBoca('bola');
      expect(bola.map(s => s.forma)).toEqual(['fechada', 'oh', 'aa']);
    });

    it('a sílaba tônica abre mais a boca', () => {
      const seq = gerarSequenciaBoca('árvore').filter(s => s.forma !== 'fechada');
      expect(seq[0].intensidade).toBeGreaterThan(seq[1].intensidade);
    });

    it('os segmentos cobrem a duração informada sem sobreposição', () => {
      const seq = gerarSequenciaBoca('fotossíntese', 900);
      let fim = 0;
      for (const s of seq) {
        expect(s.inicioMs).toBeCloseTo(fim, 5);
        fim = s.inicioMs + s.duracaoMs;
      }
      expect(fim).toBeCloseTo(900, 5);
    });

    it('sem palavra, gera uma sílaba genérica', () => {
      expect(gerarSequenciaBoca(undefined, 400)).toHaveLength(2);
    });
  });

  describe('CT05 / CA06: contagem nos dedos', () => {
    it('ordinais iniciam a contagem; numerais só contam dentro dela', () => {
      expect(dedosParaPalavra('Primeiro,', false)).toBe(1);
      expect(dedosParaPalavra('segundo', true)).toBe(2);
      expect(dedosParaPalavra('terceira', true)).toBe(3);
      expect(dedosParaPalavra('dois', false)).toBeNull();
      expect(dedosParaPalavra('dois', true)).toBe(2);
      expect(dedosParaPalavra('um', false)).toBeNull();
      expect(dedosParaPalavra('3', false)).toBe(3);
      expect(dedosParaPalavra('casa', true)).toBeNull();
    });
  });

  describe('RF06: persona no Avatar3D sem WebGL', () => {
    it('guarda a persona inicial e aceita troca antes de inicializar', async () => {
      const canvas = document.createElement('canvas');
      const avatar = new Avatar3D(
        { canvasElemento: canvas, moduloElemento: document.createElement('div'), statusTextoElemento: null },
        { persona: obterPersonaPorId('ada')! }
      );
      expect(avatar.obterPersona()?.id).toBe('ada');
      await avatar.definirPersona(obterPersonaPorId('machado')!);
      expect(avatar.obterPersona()?.id).toBe('machado');
      avatar.destruir();
    });
  });

  describe('RF02 / CA04 / CA05 / CA11 / CA21: biblioteca de clipes, interrupção, troca e movimento reduzido', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    async function carregarVrmLocal(arquivoRelativo: string): Promise<VRM> {
      const buf = fs.readFileSync(path.resolve(__dirname, '../public/avatar', arquivoRelativo));
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await new Promise<{ userData: Record<string, unknown> }>((resolve, reject) => {
        loader.parse(ab, '', resolve, reject);
      });
      return gltf.userData.vrm as VRM;
    }

    function stubFetchAssetsLocais(): void {
      const basePublic = path.resolve(__dirname, '../public/avatar');
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const limpo = url.replace(/^.*\/avatar\//, '').replace(/^\.?\/?avatar\//, '');
        const caminho = path.join(basePublic, limpo);
        if (!fs.existsSync(caminho)) {
          return new Response(null, { status: 404 });
        }
        const dados = fs.readFileSync(caminho);
        return new Response(dados, { status: 200 });
      }));
    }

    async function montarAvatarComCena(personaId: string): Promise<Avatar3D> {
      const canvas = document.createElement('canvas');
      const modulo = document.createElement('div');
      const status = document.createElement('span');
      const persona = obterPersonaPorId(personaId)!;
      const avatar = new Avatar3D(
        { canvasElemento: canvas, moduloElemento: modulo, statusTextoElemento: status },
        { persona }
      );
      const caminhoModelo = persona.modelo!.replace(/^\.\/avatar\//, '');
      const vrm = await carregarVrmLocal(caminhoModelo);
      const interno = avatar as any;
      interno.scene = new THREE.Scene();
      interno.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
      interno.instalarModelo(vrm, persona.modelo!);
      interno.estaInicializado = true;
      interno.atualizarRotuloAcessivel();
      return avatar;
    }

    it('RF02 / CA04: biblioteca de clipes atende mínimos por categoria e transita entre estados sem erros', async () => {
      const pastaAnim = path.resolve(__dirname, '../public/avatar/animacoes');
      const manifestoBruto = JSON.parse(fs.readFileSync(path.join(pastaAnim, 'manifesto.json'), 'utf8'));
      const manifesto = validarManifestoClipes(manifestoBruto);

      const contagem = (cat: string) => manifesto.clipes.filter(c => c.categoria === cat).length;
      expect(contagem('idle')).toBeGreaterThanOrEqual(2);
      expect(contagem('listening')).toBeGreaterThanOrEqual(1);
      expect(contagem('thinking')).toBeGreaterThanOrEqual(2);
      expect(contagem('speaking')).toBeGreaterThanOrEqual(5);
      expect(contagem('apontar')).toBeGreaterThanOrEqual(1);
      expect(contagem('cumprimentar')).toBeGreaterThanOrEqual(1);

      stubFetchAssetsLocais();
      const vrm = await carregarVrmLocal('personas/lia.vrm');
      const gerenciador = new GerenciadorClipes(vrm);
      const carregados = await gerenciador.carregar('./avatar/animacoes');
      expect(carregados).toBe(manifesto.clipes.length);

      gerenciador.definirPersona('lia');
      for (const estado of ['listening', 'thinking', 'speaking', 'idle'] as const) {
        expect(gerenciador.tocar(estado, 0.35)).toBe(true);
        expect(gerenciador.obterCategoriaAtual()).toBe(estado);
        gerenciador.atualizar(1 / 60);
      }

      // Clipe "eureka" só aparece para Prof. Átomo (RF09, CA15 do gravador)
      expect(gerenciador.temCategoria('speaking')).toBe(true);
      gerenciador.definirPersona('prof-atomo');
      expect(gerenciador.tocar('speaking', 0.35)).toBe(true);
      gerenciador.destruir();
    });

    it('CA05: pararFala interrompe imediatamente o clipe de fala, gestos e boca', async () => {
      stubFetchAssetsLocais();
      const avatar = await montarAvatarComCena('lia');
      const interno = avatar as any;
      const gerenciador = new GerenciadorClipes(interno.vrm);
      await gerenciador.carregar('./avatar/animacoes');
      interno.clipes = gerenciador;

      avatar.definirEstado('speaking');
      avatar.notificarPalavraFalada('fotossíntese');
      expect(gerenciador.obterCategoriaAtual()).toBe('speaking');
      expect(interno.timerGesto).not.toBeNull();

      avatar.pararFala();
      expect(interno.timerGesto).toBeNull();
      expect(interno.sequenciaBoca).toEqual([]);
      expect(gerenciador.obterCategoriaAtual()).not.toBe('speaking');

      avatar.definirEstado('idle');
      for (let i = 0; i < 15; i++) {
        interno.atualizarAnimacoes(1 / 60);
      }
      const em = interno.vrm.expressionManager;
      for (const vogal of ['aa', 'ih', 'ou', 'ee', 'oh']) {
        expect(em.getValue(vogal)).toBeLessThan(0.05);
      }
      avatar.destruir();
    });

    it('CA11: troca de persona durante a fala é adiada até a fala terminar', async () => {
      stubFetchAssetsLocais();
      const avatar = await montarAvatarComCena('prof-atomo');
      const machado = obterPersonaPorId('machado')!;

      avatar.definirEstado('speaking');
      await avatar.definirPersona(machado);
      // Continua como Prof. Átomo enquanto fala
      expect(avatar.obterPersona()?.id).toBe('prof-atomo');

      // Ao sair de speaking, aplica a persona pendente e atualiza aria-label
      avatar.definirEstado('idle');
      await new Promise(r => setTimeout(r, 320));
      expect(avatar.obterPersona()?.id).toBe('machado');
      expect((avatar as any).elementos.canvasElemento.getAttribute('aria-label')).toContain('Machado');
      avatar.destruir();
    });

    it('CA21: com prefers-reduced-motion: reduce, corpo fica parado e troca de persona é imediata', async () => {
      stubFetchAssetsLocais();
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      const avatar = await montarAvatarComCena('lia');
      const interno = avatar as any;

      avatar.definirEstado('speaking');
      avatar.notificarPalavraFalada('casa');
      for (let i = 0; i < 10; i++) {
        interno.atualizarAnimacoes(1 / 60);
      }

      // Corpo e braços permanecem na pose de repouso sem clipes corporais
      expect(interno.clipes).toBeNull();
      const bracoDir = interno.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const rotEsperada = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(POSE_IDLE.rightUpperArm!.x, POSE_IDLE.rightUpperArm!.y, POSE_IDLE.rightUpperArm!.z)
      );
      expect(bracoDir.quaternion.angleTo(rotEsperada)).toBeLessThan(0.01);

      // Boca continua se mexendo normalmente
      expect(interno.vrm.expressionManager.getValue('aa')).toBeGreaterThan(0.1);

      // Volta ao repouso e troca de persona sem atraso de animação de saída/entrada (<= 150 ms)
      avatar.definirEstado('idle');
      const inicio = performance.now();
      await avatar.definirPersona(obterPersonaPorId('ada')!);
      expect(performance.now() - inicio).toBeLessThan(150);
      expect(avatar.obterPersona()?.id).toBe('ada');
      avatar.destruir();
    });
  });
});
