/**
 * TUTORIA - Gerador da Biblioteca de Clipes de Animação (RF02, RF03, RF09, RNF02)
 *
 * Gera os clipes compartilhados (e o clipe exclusivo de "eureka" do Prof. Átomo)
 * no formato `tutoria-clipe-vrm` em `public/avatar/animacoes/` e atualiza `manifesto.json`.
 *
 * Uso: npx tsx scripts/gerar-clipes-animacao.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';

import { CategoriaClipe, ItemManifestoClipe, validarManifestoClipes } from '../src/avatar3d/animacoes';
import {
  POSE_CUMPRIMENTAR,
  POSE_IDLE,
  POSE_LISTENING,
  POSE_THINKING,
  POSES_GESTOS_ESPERA,
  POSES_GESTOS_FALA,
  POSES_REPOUSO,
  obterPoseApontarLousa
} from '../src/avatar3d/poses';
import { PoseVRM, RotacaoOsso } from '../src/avatar3d/tipos';
import { montarClipe, serializarClipe } from '../src/gravador/clipe';
import { anguloEntre } from '../src/gravador/filtro';
import { OssoGravado, Quat, QuadroGravado, RotacoesQuadro } from '../src/gravador/tipos';

interface DefinicaoClipe {
  nome: string;
  categoria: CategoriaClipe;
  duracaoSeg: number;
  loop: boolean;
  personas?: string[];
  /** Gera a pose (ângulos Euler XYZ) e curvatura dos dedos (0..1) no tempo normalizado u ∈ [0, 1]. */
  amostrar: (u: number, tSeg: number) => {
    pose: PoseVRM;
    dedosEsq?: [number, number, number, number, number];
    dedosDir?: [number, number, number, number, number];
  };
}

const DEDOS = ['Index', 'Middle', 'Ring', 'Little'] as const;
const FALANGES = ['Proximal', 'Intermediate', 'Distal'] as const;
const DEDOS_RELAXADOS: [number, number, number, number, number] = [0.14, 0.17, 0.21, 0.25, 0.12];

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function eulerParaQuat(rot?: RotacaoOsso): Quat {
  if (!rot) return [0, 0, 0, 1];
  _euler.set(rot.x, rot.y, rot.z, 'XYZ');
  _quat.setFromEuler(_euler);
  return [_quat.x, _quat.y, _quat.z, _quat.w];
}

function somarPose(base: PoseVRM, delta: PoseVRM): PoseVRM {
  const resultado: PoseVRM = {};
  const chaves = new Set([...Object.keys(base), ...Object.keys(delta)]) as Set<keyof PoseVRM>;
  for (const chave of chaves) {
    const a = base[chave];
    const b = delta[chave];
    if (a || b) {
      resultado[chave] = {
        x: (a?.x ?? 0) + (b?.x ?? 0),
        y: (a?.y ?? 0) + (b?.y ?? 0),
        z: (a?.z ?? 0) + (b?.z ?? 0)
      };
    }
  }
  return resultado;
}

function interpolarPose(a: PoseVRM, b: PoseVRM, t: number): PoseVRM {
  const resultado: PoseVRM = {};
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof PoseVRM>;
  for (const chave of chaves) {
    const ra = a[chave] ?? { x: 0, y: 0, z: 0 };
    const rb = b[chave] ?? { x: 0, y: 0, z: 0 };
    resultado[chave] = {
      x: ra.x + (rb.x - ra.x) * t,
      y: ra.y + (rb.y - ra.y) * t,
      z: ra.z + (rb.z - ra.z) * t
    };
  }
  return resultado;
}

function aplicarCurvaturaDedos(
  rotacoes: RotacoesQuadro,
  lado: 'left' | 'right',
  curvas: [number, number, number, number, number]
): void {
  const sinal = lado === 'right' ? 1 : -1;
  DEDOS.forEach((dedo, i) => {
    FALANGES.forEach((falange, j) => {
      const osso = `${lado}${dedo}${falange}` as OssoGravado;
      rotacoes[osso] = eulerParaQuat({ x: 0, y: 0, z: curvas[i] * (j === 0 ? 1.2 : 1.4) * sinal });
    });
  });
  (['Metacarpal', 'Proximal', 'Distal'] as const).forEach((falange, j) => {
    const osso = `${lado}Thumb${falange}` as OssoGravado;
    rotacoes[osso] = eulerParaQuat({ x: 0, y: curvas[4] * (j === 0 ? 0.5 : 0.8) * sinal, z: 0 });
  });
}

function quadroParaRotacoes(
  pose: PoseVRM,
  dedosEsq: [number, number, number, number, number] = DEDOS_RELAXADOS,
  dedosDir: [number, number, number, number, number] = DEDOS_RELAXADOS
): RotacoesQuadro {
  const ossosCorpo: Array<keyof PoseVRM & OssoGravado> = [
    'spine',
    'chest',
    'neck',
    'head',
    'leftUpperArm',
    'leftLowerArm',
    'leftHand',
    'rightUpperArm',
    'rightLowerArm',
    'rightHand'
  ];
  const rotacoes: RotacoesQuadro = {};
  for (const osso of ossosCorpo) {
    rotacoes[osso] = eulerParaQuat(pose[osso]);
  }
  aplicarCurvaturaDedos(rotacoes, 'left', dedosEsq);
  aplicarCurvaturaDedos(rotacoes, 'right', dedosDir);
  return rotacoes;
}

function onda(u: number, ciclos = 1): number {
  return Math.sin(u * Math.PI * 2 * ciclos);
}

function pulsoSuave(u: number, inicio: number, fim: number): number {
  if (u <= inicio || u >= fim) return 0;
  const local = (u - inicio) / (fim - inicio);
  return 0.5 - 0.5 * Math.cos(local * Math.PI * 2);
}

function suave(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function interpolarDedos(
  a: [number, number, number, number, number],
  b: [number, number, number, number, number],
  t: number
): [number, number, number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
    a[4] + (b[4] - a[4]) * t
  ];
}

const DEFINICOES_CLIPES: DefinicaoClipe[] = [
  // ================= IDLE (2 clipes) =================
  {
    nome: 'repouso-respirando',
    categoria: 'idle',
    duracaoSeg: 4.0,
    loop: true,
    amostrar: (u) => {
      const resp = onda(u, 1);
      const micro = onda(u, 2);
      return {
        pose: somarPose(POSE_IDLE, {
          spine: { x: resp * 0.014, y: 0, z: micro * 0.008 },
          chest: { x: resp * 0.024, y: micro * 0.01, z: 0 },
          neck: { x: -resp * 0.01, y: micro * 0.015, z: 0 },
          head: { x: -resp * 0.015, y: onda(u, 1) * 0.035, z: micro * 0.018 },
          leftUpperArm: { x: 0, y: 0, z: -resp * 0.022 },
          rightUpperArm: { x: 0, y: 0, z: resp * 0.022 }
        })
      };
    }
  },
  {
    nome: 'repouso-troca-peso',
    categoria: 'idle',
    duracaoSeg: 5.0,
    loop: true,
    amostrar: (u) => {
      const balanco = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
      const base = interpolarPose(POSES_REPOUSO[1], POSES_REPOUSO[2], balanco);
      const s = onda(u, 2);
      return {
        pose: somarPose(base, {
          chest: { x: s * 0.014, y: 0, z: 0 },
          head: { x: s * 0.018, y: onda(u, 1) * 0.04, z: 0 }
        }),
        dedosEsq: [0.22, 0.25, 0.28, 0.3, 0.16],
        dedosDir: [0.2, 0.24, 0.27, 0.29, 0.15]
      };
    }
  },

  // ================= LISTENING (1 clipe) =================
  {
    nome: 'escuta-aceno',
    categoria: 'listening',
    duracaoSeg: 3.5,
    loop: true,
    amostrar: (u) => {
      const aceno1 = pulsoSuave(u, 0.15, 0.45);
      const aceno2 = pulsoSuave(u, 0.55, 0.85);
      const incl = aceno1 * 0.09 + aceno2 * 0.065;
      return {
        pose: somarPose(POSE_LISTENING, {
          chest: { x: onda(u, 1) * 0.015, y: 0, z: 0 },
          neck: { x: incl * 0.45, y: 0, z: 0 },
          head: { x: incl, y: onda(u, 1) * 0.03, z: onda(u, 1) * 0.02 },
          leftLowerArm: { x: 0, y: -onda(u, 1) * 0.04, z: 0 },
          rightLowerArm: { x: 0, y: onda(u, 1) * 0.04, z: 0 }
        }),
        dedosEsq: [0.24, 0.28, 0.3, 0.32, 0.18],
        dedosDir: [0.24, 0.28, 0.3, 0.32, 0.18]
      };
    }
  },

  // ================= THINKING (2 clipes) =================
  {
    nome: 'pensando-queixo',
    categoria: 'thinking',
    duracaoSeg: 4.0,
    loop: true,
    amostrar: (u) => {
      const pulso = onda(u, 1);
      const aceno = onda(u, 2);
      return {
        pose: somarPose(POSE_THINKING, {
          chest: { x: pulso * 0.018, y: 0, z: 0 },
          head: { x: aceno * 0.03, y: pulso * 0.05, z: 0.02 },
          rightHand: { x: aceno * 0.04, y: 0, z: pulso * 0.05 }
        }),
        dedosEsq: [0.3, 0.34, 0.36, 0.38, 0.2],
        dedosDir: [0.12, 0.35, 0.55, 0.6, 0.25]
      };
    }
  },
  {
    nome: 'pensando-olhar',
    categoria: 'thinking',
    duracaoSeg: 4.0,
    loop: true,
    amostrar: (u) => {
      const s = onda(u, 1);
      const base = interpolarPose(POSES_GESTOS_ESPERA['olhar-cima'], POSES_GESTOS_ESPERA['postura-atenta'], 0.35 + 0.25 * s);
      return {
        pose: somarPose(base, {
          head: { x: -0.04 * s, y: 0.12 * Math.sin(u * Math.PI * 2), z: 0.04 * s },
          rightUpperArm: { x: -0.1 * (0.5 + 0.5 * s), y: 0.1, z: 0 },
          rightLowerArm: { x: 0, y: 0.3 * (0.5 + 0.5 * s), z: 0 }
        })
      };
    }
  },

  // ================= SPEAKING (6 clipes, incluindo "eureka" do Prof. Átomo) =================
  {
    nome: 'falando-palmas-abertas',
    categoria: 'speaking',
    duracaoSeg: 3.5,
    loop: true,
    amostrar: (u) => {
      const batida = onda(u, 2);
      const balanco = onda(u, 1);
      return {
        pose: somarPose(POSES_GESTOS_FALA['palmas-abertas'], {
          chest: { x: batida * 0.025, y: balanco * 0.05, z: 0 },
          head: { x: batida * 0.05, y: balanco * 0.06, z: balanco * 0.025 },
          leftUpperArm: { x: -batida * 0.08, y: balanco * 0.06, z: batida * 0.05 },
          leftLowerArm: { x: 0, y: -batida * 0.16, z: 0 },
          leftHand: { x: 0, y: 0, z: -batida * 0.12 },
          rightUpperArm: { x: -batida * 0.08, y: balanco * 0.06, z: -batida * 0.05 },
          rightLowerArm: { x: 0, y: batida * 0.16, z: 0 },
          rightHand: { x: 0, y: 0, z: batida * 0.12 }
        }),
        dedosEsq: [0.06, 0.08, 0.1, 0.12, 0.08],
        dedosDir: [0.06, 0.08, 0.1, 0.12, 0.08]
      };
    }
  },
  {
    nome: 'falando-enfatizar',
    categoria: 'speaking',
    duracaoSeg: 3.2,
    loop: true,
    amostrar: (u) => {
      const enfase = onda(u, 2);
      const retorno = onda(u, 1);
      return {
        pose: somarPose(POSES_GESTOS_FALA.enfatizar, {
          chest: { x: enfase * 0.03, y: retorno * 0.06, z: 0 },
          head: { x: enfase * 0.06, y: retorno * 0.05, z: 0 },
          rightUpperArm: { x: -enfase * 0.12, y: retorno * 0.05, z: -enfase * 0.08 },
          rightLowerArm: { x: 0, y: enfase * 0.24, z: 0 },
          rightHand: { x: 0, y: 0, z: enfase * 0.18 },
          leftUpperArm: { x: -retorno * 0.05, y: 0, z: 0 }
        }),
        dedosEsq: DEDOS_RELAXADOS,
        dedosDir: [0.08, 0.12, 0.16, 0.2, 0.1]
      };
    }
  },
  {
    nome: 'falando-mao-no-peito',
    categoria: 'speaking',
    duracaoSeg: 3.6,
    loop: true,
    amostrar: (u) => {
      const s1 = onda(u, 1);
      const s2 = onda(u, 2);
      return {
        pose: somarPose(POSES_GESTOS_FALA['mao-no-peito'], {
          chest: { x: s1 * 0.025, y: s1 * 0.04, z: 0 },
          head: { x: s2 * 0.04, y: s1 * 0.05, z: 0.02 },
          leftUpperArm: { x: -s1 * 0.06, y: 0, z: 0 },
          leftLowerArm: { x: 0, y: -s2 * 0.08, z: 0 },
          rightUpperArm: { x: -s2 * 0.1, y: s1 * 0.08, z: -s2 * 0.06 },
          rightLowerArm: { x: 0, y: s2 * 0.18, z: 0 }
        }),
        dedosEsq: [0.08, 0.1, 0.12, 0.15, 0.1],
        dedosDir: [0.1, 0.14, 0.18, 0.2, 0.1]
      };
    }
  },
  {
    nome: 'falando-comparar',
    categoria: 'speaking',
    duracaoSeg: 3.8,
    loop: true,
    amostrar: (u) => {
      // Alterna foco entre esquerda e direita como quem compara duas opções
      const lado = onda(u, 1);
      const ritmo = onda(u, 2);
      const poseLadoEsq: PoseVRM = {
        chest: { x: -0.03, y: 0.08, z: 0 },
        neck: { x: 0.02, y: 0.05, z: 0 },
        head: { x: 0.04, y: 0.08, z: 0.02 },
        leftUpperArm: { x: -0.5, y: 0, z: -1.05 },
        leftLowerArm: { x: 0, y: -1.45, z: 0 },
        leftHand: { x: -0.4, y: 0, z: 0 },
        rightUpperArm: { x: -0.2, y: 0, z: 1.25 },
        rightLowerArm: { x: 0, y: 1.0, z: 0 },
        rightHand: { x: 0, y: 0, z: 0 }
      };
      const poseLadoDir: PoseVRM = {
        chest: { x: -0.03, y: -0.08, z: 0 },
        neck: { x: 0.02, y: -0.05, z: 0 },
        head: { x: 0.04, y: -0.08, z: -0.02 },
        leftUpperArm: { x: -0.2, y: 0, z: -1.25 },
        leftLowerArm: { x: 0, y: -1.0, z: 0 },
        leftHand: { x: 0, y: 0, z: 0 },
        rightUpperArm: { x: -0.5, y: 0, z: 1.05 },
        rightLowerArm: { x: 0, y: 1.45, z: 0 },
        rightHand: { x: -0.4, y: 0, z: 0 }
      };
      const base = interpolarPose(poseLadoEsq, poseLadoDir, 0.5 + 0.5 * lado);
      return {
        pose: somarPose(base, {
          head: { x: ritmo * 0.035, y: 0, z: 0 }
        }),
        dedosEsq: [0.08, 0.1, 0.12, 0.14, 0.08],
        dedosDir: [0.08, 0.1, 0.12, 0.14, 0.08]
      };
    }
  },
  {
    nome: 'falando-contar-dedos',
    categoria: 'speaking',
    duracaoSeg: 3.6,
    loop: true,
    amostrar: (u) => {
      const s = onda(u, 3);
      const retorno = 1 - suave(0.84, 0.98, u);
      const abre2 = suave(0.22, 0.34, u) * retorno;
      const abre3 = suave(0.52, 0.64, u) * retorno;
      const d1 = 0.05;
      const d2 = 0.9 - 0.85 * abre2;
      const d3 = 0.9 - 0.85 * abre3;
      return {
        pose: somarPose(POSES_GESTOS_FALA['contar-dedos'], {
          chest: { x: s * 0.015, y: 0, z: 0 },
          head: { x: s * 0.04, y: onda(u, 1) * 0.04, z: 0 },
          rightUpperArm: { x: -s * 0.05, y: 0, z: 0 },
          rightLowerArm: { x: 0, y: s * 0.12, z: 0 }
        }),
        dedosEsq: DEDOS_RELAXADOS,
        dedosDir: [d1, d2, d3, 0.92, 0.78]
      };
    }
  },
  {
    nome: 'falando-eureka-atomo',
    categoria: 'speaking',
    duracaoSeg: 3.4,
    loop: true,
    personas: ['prof-atomo'],
    amostrar: (u) => {
      // Gestos característicos do Prof. Átomo: dedo indicador erguido ("eureka!") e leve ajuste próximo aos óculos
      const eureka = pulsoSuave(u, 0.1, 0.65);
      const ajuste = pulsoSuave(u, 0.6, 0.95);
      return {
        pose: somarPose(POSES_GESTOS_FALA.enfatizar, {
          chest: { x: -eureka * 0.05, y: -eureka * 0.06, z: 0 },
          head: { x: -eureka * 0.08 + ajuste * 0.05, y: (eureka - ajuste) * 0.07, z: eureka * 0.04 },
          rightUpperArm: { x: -eureka * 0.45 - ajuste * 0.35, y: ajuste * 0.18, z: -eureka * 0.32 - ajuste * 0.15 },
          rightLowerArm: { x: 0, y: eureka * 0.45 + ajuste * 0.7, z: -eureka * 0.3 },
          rightHand: { x: 0, y: 0, z: eureka * 0.2 },
          leftUpperArm: { x: -0.15, y: 0, z: 0 },
          leftLowerArm: { x: 0, y: -0.4, z: 0 }
        }),
        dedosEsq: DEDOS_RELAXADOS,
        dedosDir: [0.04, 0.9, 0.92, 0.95, 0.75]
      };
    }
  },

  // ================= APONTAR (2 clipes de disparo único, loop: false) =================
  {
    nome: 'apontar-lado',
    categoria: 'apontar',
    duracaoSeg: 2.0,
    loop: false,
    amostrar: (u) => {
      const f = Math.sin(u * Math.PI);
      const alvo = obterPoseApontarLousa(false);
      return {
        pose: interpolarPose(POSE_IDLE, alvo, f),
        dedosEsq: interpolarDedos(DEDOS_RELAXADOS, [0.02, 0.9, 0.92, 0.94, 0.7], suave(0.05, 0.4, f)),
        dedosDir: DEDOS_RELAXADOS
      };
    }
  },
  {
    nome: 'apontar-frente',
    categoria: 'apontar',
    duracaoSeg: 2.0,
    loop: false,
    amostrar: (u) => {
      const f = Math.sin(u * Math.PI);
      const alvo = obterPoseApontarLousa(true);
      return {
        pose: interpolarPose(POSE_IDLE, alvo, f),
        dedosEsq: DEDOS_RELAXADOS,
        dedosDir: interpolarDedos(DEDOS_RELAXADOS, [0.02, 0.9, 0.92, 0.94, 0.7], suave(0.05, 0.4, f))
      };
    }
  },

  // ================= CUMPRIMENTAR (1 clipe de disparo único, loop: false) =================
  {
    nome: 'cumprimentar-aceno',
    categoria: 'cumprimentar',
    duracaoSeg: 1.8,
    loop: false,
    amostrar: (u) => {
      const erguer = Math.sin(u * Math.PI);
      const aceno = Math.sin(u * Math.PI * 5) * erguer;
      const base = interpolarPose(POSE_IDLE, POSE_CUMPRIMENTAR, Math.min(1, erguer * 1.35));
      return {
        pose: somarPose(base, {
          rightLowerArm: { x: 0, y: 0, z: aceno * 0.14 },
          rightHand: { x: 0, y: 0, z: aceno * 0.35 },
          head: { x: 0.02 * erguer, y: 0, z: 0.04 * erguer }
        }),
        dedosEsq: DEDOS_RELAXADOS,
        dedosDir: [0.05, 0.05, 0.06, 0.08, 0.05]
      };
    }
  }
];

function gerarClipes(): void {
  const pasta = path.resolve(process.cwd(), 'public/avatar/animacoes');
  fs.mkdirSync(pasta, { recursive: true });

  const itensManifesto: ItemManifestoClipe[] = [];
  let bytesTotais = 0;

  for (const def of DEFINICOES_CLIPES) {
    const fpsGravacao = 30;
    const totalQuadros = Math.round(def.duracaoSeg * fpsGravacao) + 1;
    const quadros: QuadroGravado[] = [];

    for (let i = 0; i < totalQuadros; i++) {
      const t = i / fpsGravacao;
      const u = Math.min(1, t / def.duracaoSeg);
      const { pose, dedosEsq, dedosDir } = def.amostrar(u, t);
      quadros.push({
        t,
        rotacoes: quadroParaRotacoes(pose, dedosEsq, dedosDir),
        falha: false,
        baixaConfianca: false
      });
    }

    const clipe = montarClipe(quadros, 0, def.duracaoSeg, {
      nome: def.nome,
      categoria: def.categoria,
      loop: def.loop,
      loopSuave: def.loop,
      personas: def.personas
    });

    // Validação interna de suavidade (< 25° por quadro)
    let maiorSaltoGraus = 0;
    for (const [osso, valores] of Object.entries(clipe.ossos)) {
      if (!valores) continue;
      for (let i = 4; i < valores.length; i += 4) {
        const qa: Quat = [valores[i - 4], valores[i - 3], valores[i - 2], valores[i - 1]];
        const qb: Quat = [valores[i], valores[i + 1], valores[i + 2], valores[i + 3]];
        const ang = anguloEntre(qa, qb);
        if (ang > maiorSaltoGraus) maiorSaltoGraus = ang;
        if (ang >= 25) {
          throw new Error(`Clipe "${def.nome}" excedeu salto de 25° no osso ${osso}: ${ang.toFixed(1)}°`);
        }
      }
    }

    const conteudo = serializarClipe(clipe);
    const arquivo = `${def.nome}.json`;
    const destino = path.join(pasta, arquivo);
    fs.writeFileSync(destino, conteudo, 'utf8');
    const tamanhoBytes = Buffer.byteLength(conteudo, 'utf8');
    bytesTotais += tamanhoBytes;

    const item: ItemManifestoClipe = {
      arquivo,
      categoria: def.categoria,
      ...(def.loop ? {} : { loop: false }),
      ...(def.personas && def.personas.length > 0 ? { personas: def.personas } : {})
    };
    itensManifesto.push(item);

    console.log(
      `Gerado ${arquivo} (${(tamanhoBytes / 1024).toFixed(1)} KB, ${def.duracaoSeg}s, salto máx ${maiorSaltoGraus.toFixed(1)}°)`
    );
  }

  const manifesto = validarManifestoClipes({ clipes: itensManifesto });
  const manifestoStr = JSON.stringify(manifesto, null, 2) + '\n';
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), manifestoStr, 'utf8');
  bytesTotais += Buffer.byteLength(manifestoStr, 'utf8');

  console.log(`\nManifesto salvo com ${manifesto.clipes.length} clipes (${(bytesTotais / 1024).toFixed(1)} KB no total).`);
}

gerarClipes();
