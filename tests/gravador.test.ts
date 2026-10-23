/**
 * TUTORIA - Testes do Gravador de Gestos
 * Spec: SDD/2026-10-23_gravador-de-gestos.md (CT05 - CT08, CT10 - CT13, CT15)
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as THREE from 'three';

import { converterClipeJson, filtrarClipesPorPersona, validarManifestoClipes } from '../src/avatar3d/animacoes';
import { aplicarLoopSuave, montarClipe, nomeClipeValido, serializarClipe, TAMANHO_MAXIMO_BYTES } from '../src/gravador/clipe';
import { converterQuadro, corrigirProfundidade, curvaturasDedo, PontoMP } from '../src/gravador/conversor';
import { anguloEntre, SuavizadorRotacoes, trechosDeFalha } from '../src/gravador/filtro';
import { OSSOS_GRAVADOS, Quat, QuadroGravado } from '../src/gravador/tipos';
import { ErroGravador, salvarClipeNoProjeto } from '../scripts/vite-plugin-gravador';

type V = [number, number, number];

/**
 * Monta pontos do MediaPipe a partir de posições no espaço do avatar (olha para +Z,
 * direita da tela = +X). `esq`/`dir` são os lados DA PESSOA: o esquerdo aparece em +X.
 */
function montarPose(direcoes: { esqBraco: V; esqAnte: V; dirBraco: V; dirAnte: V }, visibilidade = 1) {
  const avatar: Record<number, V> = {};
  const soma = (a: V, b: V, k: number): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  avatar[11] = [0.18, 0.5, 0];
  avatar[12] = [-0.18, 0.5, 0];
  avatar[13] = soma(avatar[11], direcoes.esqBraco, 0.28);
  avatar[14] = soma(avatar[12], direcoes.dirBraco, 0.28);
  avatar[15] = soma(avatar[13], direcoes.esqAnte, 0.25);
  avatar[16] = soma(avatar[14], direcoes.dirAnte, 0.25);
  avatar[23] = [0.1, 0, 0];
  avatar[24] = [-0.1, 0, 0];
  avatar[0] = [0, 0.66, 0.1];
  avatar[7] = [0.07, 0.69, 0];
  avatar[8] = [-0.07, 0.69, 0];

  const mundo: PontoMP[] = [];
  const imagem: PontoMP[] = [];
  for (let i = 0; i < 33; i++) {
    const [x, y, z] = avatar[i] ?? [0, 0.3, 0];
    mundo.push({ x, y: -y, z: -z, visibility: visibilidade });
    imagem.push({ x: 0.5 + x, y: 0.5 - y * 0.8, z: 0, visibility: visibilidade });
  }
  return { mundo, imagem };
}

/** Direção no mundo de um osso a partir das rotações (cadeia tronco → braço → antebraço). */
function direcaoMundo(cadeia: Array<Quat | undefined>, lado: 'left' | 'right'): THREE.Vector3 {
  const total = new THREE.Quaternion();
  for (const q of cadeia) if (q) total.multiply(new THREE.Quaternion(...q));
  return new THREE.Vector3(lado === 'left' ? 1 : -1, 0, 0).applyQuaternion(total);
}

const BAIXO: V = [0, -1, 0];
const FRENTE: V = [0, 0, 1];

describe('Gravador de gestos', () => {
  describe('CT05 / CA05: conversor vetorial', () => {
    it('braço direito da pessoa à frente → braço direito do avatar à frente', () => {
      const { mundo, imagem } = montarPose({ esqBraco: BAIXO, esqAnte: BAIXO, dirBraco: FRENTE, dirAnte: FRENTE });
      const { rotacoes, corpoValido } = converterQuadro(mundo, imagem);
      expect(corpoValido).toBe(true);
      const tronco = [rotacoes.spine, rotacoes.chest];
      const braco = direcaoMundo([...tronco, rotacoes.rightUpperArm], 'right');
      expect(braco.z).toBeGreaterThan(0.95);
      const esquerdo = direcaoMundo([...tronco, rotacoes.leftUpperArm], 'left');
      expect(esquerdo.y).toBeLessThan(-0.95);
    });

    it('antebraço dobrado para a frente com o braço caído', () => {
      const { mundo, imagem } = montarPose({ esqBraco: BAIXO, esqAnte: FRENTE, dirBraco: BAIXO, dirAnte: BAIXO });
      const { rotacoes } = converterQuadro(mundo, imagem);
      const ante = direcaoMundo([rotacoes.spine, rotacoes.chest, rotacoes.leftUpperArm, rotacoes.leftLowerArm], 'left');
      expect(ante.z).toBeGreaterThan(0.95);
    });

    it('tronco reto vira rotação nula na coluna', () => {
      const { mundo, imagem } = montarPose({ esqBraco: BAIXO, esqAnte: BAIXO, dirBraco: BAIXO, dirAnte: BAIXO });
      const { rotacoes } = converterQuadro(mundo, imagem);
      expect(anguloEntre(rotacoes.spine!, [0, 0, 0, 1])).toBeLessThan(1);
      expect(rotacoes.head).toBeDefined();
    });

    it('CT06: com Espelhar, o braço direito da pessoa move o braço esquerdo do avatar', () => {
      const { mundo, imagem } = montarPose({ esqBraco: BAIXO, esqAnte: BAIXO, dirBraco: FRENTE, dirAnte: FRENTE });
      const { rotacoes } = converterQuadro(mundo, imagem, [], { espelhar: true });
      const esquerdo = direcaoMundo([rotacoes.spine, rotacoes.chest, rotacoes.leftUpperArm], 'left');
      const direito = direcaoMundo([rotacoes.spine, rotacoes.chest, rotacoes.rightUpperArm], 'right');
      expect(esquerdo.z).toBeGreaterThan(0.95);
      expect(direito.y).toBeLessThan(-0.95);
    });

    it('CT08: corpo com visibilidade baixa não gera rotações', () => {
      const { mundo, imagem } = montarPose({ esqBraco: BAIXO, esqAnte: BAIXO, dirBraco: BAIXO, dirAnte: BAIXO }, 0.2);
      const resultado = converterQuadro(mundo, imagem);
      expect(resultado.corpoValido).toBe(false);
      expect(resultado.rotacoes).toEqual({});
      expect(converterQuadro(undefined, undefined).corpoValido).toBe(false);
    });

    it('RF13: antebraço encurtado apontando para trás é virado para a frente', () => {
      const corrigido = corrigirProfundidade(new THREE.Vector3(0, -0.2, -0.9), 0.02, 0.1);
      expect(corrigido.corrigido).toBe(true);
      expect(corrigido.dir.z).toBeGreaterThan(0);
      const normal = corrigirProfundidade(new THREE.Vector3(0, -1, 0), 0.1, 0.1);
      expect(normal.corrigido).toBe(false);
      expect(normal.dir.y).toBe(-1);
    });

    it('curvatura dos dedos: reto = 0, dobrado em ângulo reto = 90°', () => {
      const base = new THREE.Vector3(0, 0, 0);
      const reto = curvaturasDedo([1, 2, 3, 4].map(i => new THREE.Vector3(i, 0, 0)), base);
      reto.forEach(c => expect(c).toBeCloseTo(0, 5));
      const dobrado = curvaturasDedo(
        [new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, -1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0)],
        base
      );
      dobrado.forEach(c => expect(c).toBeCloseTo(Math.PI / 2, 5));
    });
  });

  describe('CT07 / CT08: suavização e falhas', () => {
    it('reduz tremores: nenhum salto acima de 25° entre quadros', () => {
      const suavizador = new SuavizadorRotacoes(0.5);
      let anterior: Quat | null = null;
      let maiorSaltoBruto = 0;
      let maiorSalto = 0;
      let brutoAnterior: Quat | null = null;
      for (let i = 0; i < 90; i++) {
        const ruido = (i % 2 === 0 ? 1 : -1) * 0.25; // ±14° alternando a cada quadro
        const bruto = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5 + ruido);
        const q: Quat = [bruto.x, bruto.y, bruto.z, bruto.w];
        if (brutoAnterior) maiorSaltoBruto = Math.max(maiorSaltoBruto, anguloEntre(brutoAnterior, q));
        brutoAnterior = q;
        const filtrado = suavizador.filtrar({ rightUpperArm: q }, 1 / 30).rightUpperArm!;
        if (anterior && i > 5) maiorSalto = Math.max(maiorSalto, anguloEntre(anterior, filtrado));
        anterior = filtrado;
      }
      expect(maiorSaltoBruto).toBeGreaterThan(25);
      expect(maiorSalto).toBeLessThan(25);
    });

    it('mantém a última rotação dos ossos que somem do quadro', () => {
      const suavizador = new SuavizadorRotacoes(0.5);
      const q: Quat = [0, 0, 0.3826834, 0.9238795];
      suavizador.filtrar({ head: q }, 1 / 30);
      const seguinte = suavizador.filtrar({}, 1 / 30);
      expect(anguloEntre(seguinte.head!, q)).toBeLessThan(0.1);
    });

    it('marca trechos de falha maiores que 0,5 s', () => {
      const quadros: QuadroGravado[] = Array.from({ length: 120 }, (_, i) => ({
        t: i / 30,
        rotacoes: {},
        falha: i >= 30 && i < 90,
        baixaConfianca: false
      }));
      const trechos = trechosDeFalha(quadros);
      expect(trechos).toHaveLength(1);
      expect(trechos[0][0]).toBeCloseTo(1, 5);
      expect(trechos[0][1]).toBeCloseTo(89 / 30, 5);
      expect(trechosDeFalha(quadros.map(q => ({ ...q, falha: q.t < 0.2 })))).toHaveLength(0);
    });
  });

  describe('CT10 / CT11: montagem do clipe', () => {
    const giro = (angulo: number): Quat => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angulo);
      return [q.x, q.y, q.z, q.w];
    };
    const gravacao = (segundos: number, todosOsOssos = false): QuadroGravado[] =>
      Array.from({ length: Math.round(segundos * 30) + 1 }, (_, i) => {
        const t = i / 30;
        const rotacoes = todosOsOssos
          ? Object.fromEntries(OSSOS_GRAVADOS.map((o, k) => [o, giro(Math.sin(t * 3 + k) * 0.8)]))
          : { rightUpperArm: giro(t * 0.5), head: giro(-t * 0.2) };
        return { t, rotacoes, falha: false, baixaConfianca: false };
      });

    it('loop suave deixa o último quadro igual ao primeiro', () => {
      const amostras = Array.from({ length: 40 }, (_, i) => giro(i * 0.05));
      const suave = aplicarLoopSuave(amostras, 20);
      expect(anguloEntre(suave[0], suave[suave.length - 1])).toBeLessThan(2);
      expect(anguloEntre(suave[10], amostras[10])).toBeLessThan(0.01);
    });

    it('gera o formato tutoria-clipe-vrm com categoria e personas (CA10, CA11)', () => {
      const clipe = montarClipe(gravacao(4), 0.5, 3.5, {
        nome: 'pensando-1',
        categoria: 'thinking',
        loop: true,
        loopSuave: true,
        personas: ['machado', 'ada']
      });
      expect(clipe.formato).toBe('tutoria-clipe-vrm');
      expect(clipe.versao).toBe(1);
      expect(clipe.categoria).toBe('thinking');
      expect(clipe.personas).toEqual(['machado', 'ada']);
      expect(clipe.fps).toBe(20);
      expect(clipe.duracao).toBeCloseTo(3, 1);
      expect(Object.keys(clipe.ossos).sort()).toEqual(['head', 'rightUpperArm']);
      expect(clipe.ossos.rightUpperArm!.length).toBe(61 * 4);
      expect(clipe.ossos.rightUpperArm!.every(v => Math.round(v * 1000) === v * 1000)).toBe(true);
    });

    it('sem personas, o campo fica de fora', () => {
      const clipe = montarClipe(gravacao(2), 0, 2, { nome: 'a', categoria: 'idle', loop: true, loopSuave: false });
      expect(clipe.personas).toBeUndefined();
    });

    it('clipe de 10 s com todos os ossos fica dentro de 250 KB', () => {
      const clipe = montarClipe(gravacao(10, true), 0, 10, { nome: 'longo', categoria: 'speaking', loop: true, loopSuave: true });
      const texto = serializarClipe(clipe);
      expect(texto.length).toBeLessThanOrEqual(TAMANHO_MAXIMO_BYTES);
    });

    it('recusa trecho curto demais e limita a duração a 15 s', () => {
      expect(() => montarClipe(gravacao(2), 1, 1, { nome: 'a', categoria: 'idle', loop: true, loopSuave: false })).toThrow();
      const longo = montarClipe(gravacao(20), 0, 20, { nome: 'a', categoria: 'idle', loop: false, loopSuave: false });
      expect(longo.duracao).toBeLessThanOrEqual(15);
    });

    it('valida nomes de clipe', () => {
      expect(nomeClipeValido('explicando-1')).toBe(true);
      expect(nomeClipeValido('Explicando')).toBe(false);
      expect(nomeClipeValido('../x')).toBe(false);
      expect(nomeClipeValido('a b')).toBe(false);
      expect(nomeClipeValido('')).toBe(false);
    });
  });

  describe('CT12 / CT13: plugin de desenvolvimento', () => {
    let raiz: string;
    const clipe = { formato: 'tutoria-clipe-vrm', categoria: 'speaking', loop: true, personas: ['ada'], ossos: {} };

    afterEach(() => {
      if (raiz) fs.rmSync(raiz, { recursive: true, force: true });
    });

    it('grava o arquivo e acrescenta ao manifesto sem apagar entradas', () => {
      raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gravador-'));
      const pasta = path.join(raiz, 'public', 'avatar', 'animacoes');
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify({ clipes: [{ arquivo: 'idle-1.fbx', categoria: 'idle' }] }));

      salvarClipeNoProjeto(raiz, 'explicando-1', clipe);
      salvarClipeNoProjeto(raiz, 'explicando-1', { ...clipe, categoria: 'thinking' });

      expect(fs.existsSync(path.join(pasta, 'explicando-1.json'))).toBe(true);
      const manifesto = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
      expect(manifesto.clipes).toEqual([
        { arquivo: 'idle-1.fbx', categoria: 'idle' },
        { arquivo: 'explicando-1.json', categoria: 'thinking', personas: ['ada'] }
      ]);
    });

    it('recusa nomes que escapariam da pasta e clipes inválidos', () => {
      raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'gravador-'));
      for (const nome of ['../../src/tutor', '/etc/x', 'a b', 'A', '', 42]) {
        expect(() => salvarClipeNoProjeto(raiz, nome, clipe)).toThrow(ErroGravador);
      }
      expect(() => salvarClipeNoProjeto(raiz, 'ok', { formato: 'outro', categoria: 'speaking' })).toThrow(ErroGravador);
      expect(() => salvarClipeNoProjeto(raiz, 'ok', { ...clipe, categoria: 'dancar' })).toThrow(ErroGravador);
      expect(fs.readdirSync(raiz)).toEqual([]);
    });
  });

  describe('CT15 / CA14 / CA15: clipes gravados no tutor', () => {
    it('o manifesto aceita clipes .json com personas', () => {
      const manifesto = validarManifestoClipes({
        clipes: [
          { arquivo: 'explicando-1.json', categoria: 'speaking', personas: ['machado'] },
          { arquivo: 'sub/x.json', categoria: 'speaking' },
          { arquivo: 'y.json', categoria: 'speaking', personas: 'ada' }
        ]
      });
      expect(manifesto.clipes).toEqual([{ arquivo: 'explicando-1.json', categoria: 'speaking', personas: ['machado'] }]);
    });

    it('clipe só de Machado não toca com Ada', () => {
      const clipes = [
        { item: { arquivo: 'geral.json', categoria: 'speaking' as const } },
        { item: { arquivo: 'machado.json', categoria: 'speaking' as const, personas: ['machado'] } }
      ];
      expect(filtrarClipesPorPersona(clipes, 'ada').map(c => c.item.arquivo)).toEqual(['geral.json']);
      expect(filtrarClipesPorPersona(clipes, 'machado').map(c => c.item.arquivo)).toEqual(['geral.json', 'machado.json']);
      expect(filtrarClipesPorPersona(clipes, null).map(c => c.item.arquivo)).toEqual(['geral.json']);
    });

    it('converte o JSON em AnimationClip nos ossos normalizados do VRM', () => {
      const vrmFalso = {
        humanoid: { getNormalizedBoneNode: (osso: string) => (osso === 'head' ? { name: 'Normalized_Head' } : null) }
      } as any;
      const clipe = converterClipeJson(
        { formato: 'tutoria-clipe-vrm', versao: 1, fps: 20, duracao: 0.05, ossos: { head: [0, 0, 0, 1, 0, 0.1, 0, 0.995], dedao: [0, 0, 0, 1, 0, 0, 0, 1] } },
        vrmFalso,
        'teste'
      );
      expect(clipe).not.toBeNull();
      expect(clipe!.tracks).toHaveLength(1);
      expect(clipe!.tracks[0].name).toBe('Normalized_Head.quaternion');
      const tempos = Array.from(clipe!.tracks[0].times);
      expect(tempos[0]).toBe(0);
      expect(tempos[1]).toBeCloseTo(0.05, 6);
      expect(converterClipeJson({ formato: 'outro' }, vrmFalso, 'x')).toBeNull();
    });
  });
});
