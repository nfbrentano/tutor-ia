/**
 * TUTORIA - Movimento Procedural do Avatar 3D (RF01, RF04 da spec de personas)
 *
 * Funções puras (sem three.js) para poder testar sem WebGL:
 * - suavização independente do fps;
 * - camadas somadas à pose (respiração, troca de peso, micro-movimentos de cabeça);
 * - mola para os "batimentos" de gesto sincronizados com as palavras;
 * - mira do braço e do olhar para um ponto (apontar para a lousa).
 */

import { PoseVRM, RotacaoOsso } from './tipos';

/**
 * Fator de aproximação exponencial: o mesmo tempo de transição a 30 ou 60 fps (CA02).
 * `velocidade` em 1/s: com 6, ~95% da transição em 0,5 s.
 */
export function fatorSuavizacao(velocidade: number, deltaSeg: number): number {
  if (deltaSeg <= 0) return 0;
  return 1 - Math.exp(-velocidade * deltaSeg);
}

/** Ruído suave e determinístico (soma de senoides incomensuráveis), entre -1 e 1. */
export function ruidoSuave(t: number, semente: number): number {
  return (
    Math.sin(t * 0.73 + semente) * 0.5 +
    Math.sin(t * 1.61 + semente * 1.7) * 0.3 +
    Math.sin(t * 3.07 + semente * 2.9) * 0.2
  );
}

export type IntensidadeMovimento = 'repouso' | 'atento' | 'falando';

const AMPLITUDE_CABECA: Record<IntensidadeMovimento, number> = {
  repouso: 0.035,
  atento: 0.02,
  falando: 0.06
};

/**
 * Deslocamentos procedurais somados à pose base em cada quadro (RF04).
 */
export function calcularCamadasProcedurais(t: number, intensidade: IntensidadeMovimento): PoseVRM {
  // Respiração ~15 ciclos por minuto
  const respiracao = Math.sin((t * Math.PI * 2) / 4.2);
  // Troca de peso lenta entre as pernas (~9 s)
  const pesoCorpo = ruidoSuave(t * 0.35, 11);
  const ampCabeca = AMPLITUDE_CABECA[intensidade];

  return {
    hips: { x: 0, y: pesoCorpo * 0.03, z: pesoCorpo * 0.035 },
    spine: { x: respiracao * 0.008, y: -pesoCorpo * 0.02, z: -pesoCorpo * 0.025 },
    chest: { x: respiracao * 0.025, y: 0, z: -pesoCorpo * 0.01 },
    leftShoulder: { x: 0, y: 0, z: -respiracao * 0.015 },
    rightShoulder: { x: 0, y: 0, z: respiracao * 0.015 },
    neck: { x: ruidoSuave(t, 3) * ampCabeca * 0.4, y: ruidoSuave(t, 5) * ampCabeca * 0.4, z: 0 },
    head: {
      x: ruidoSuave(t * 1.1, 7) * ampCabeca,
      y: ruidoSuave(t * 0.9, 13) * ampCabeca * 1.3,
      z: ruidoSuave(t * 0.8, 17) * ampCabeca * 0.7
    },
    // Braços nunca ficam 100% parados
    leftUpperArm: { x: ruidoSuave(t * 0.6, 19) * 0.02, y: 0, z: -respiracao * 0.01 },
    rightUpperArm: { x: ruidoSuave(t * 0.6, 23) * 0.02, y: 0, z: respiracao * 0.01 }
  };
}

/**
 * Mola amortecida usada nos "batimentos" do gesto e no aceno de cabeça a cada palavra
 * enfatizada. `impulsionar` dá um empurrão; `atualizar` devolve o deslocamento atual.
 */
export class MolaGesto {
  private posicao = 0;
  private velocidade = 0;

  constructor(
    private rigidez = 90,
    private amortecimento = 11
  ) {}

  impulsionar(forca: number): void {
    this.velocidade += forca;
  }

  atualizar(deltaSeg: number): number {
    // Passos de no máximo 1/120 s mantêm a integração estável em quadros longos
    let restante = Math.min(deltaSeg, 0.1);
    while (restante > 0) {
      const dt = Math.min(restante, 1 / 120);
      const aceleracao = -this.rigidez * this.posicao - this.amortecimento * this.velocidade;
      this.velocidade += aceleracao * dt;
      this.posicao += this.velocidade * dt;
      restante -= dt;
    }
    return this.posicao;
  }

  valor(): number {
    return this.posicao;
  }

  zerar(): void {
    this.posicao = 0;
    this.velocidade = 0;
  }
}

export interface Vetor3 {
  x: number;
  y: number;
  z: number;
}

function normalizar(v: Vetor3): Vetor3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Rotação (Euler XYZ) que leva o braço da pose T até apontar para `direcao`, no espaço
 * do osso pai. Ossos normalizados do VRM: braço esquerdo em repouso aponta para +X e
 * o direito para -X; o personagem olha para +Z.
 */
export function calcularRotacaoBracoParaDirecao(lado: 'left' | 'right', direcao: Vetor3): RotacaoOsso {
  const de = lado === 'left' ? { x: 1, y: 0, z: 0 } : { x: -1, y: 0, z: 0 };
  const para = normalizar(direcao);

  // Quatérnio mínimo entre dois vetores unitários
  let w = 1 + de.x * para.x + de.y * para.y + de.z * para.z;
  let qx: number;
  let qy: number;
  let qz: number;
  if (w < 1e-6) {
    // Vetores opostos: gira 180° em torno de Y
    w = 0;
    qx = 0;
    qy = 1;
    qz = 0;
  } else {
    qx = de.y * para.z - de.z * para.y;
    qy = de.z * para.x - de.x * para.z;
    qz = de.x * para.y - de.y * para.x;
  }
  const len = Math.hypot(w, qx, qy, qz);
  w /= len;
  qx /= len;
  qy /= len;
  qz /= len;

  // Quatérnio → Euler na ordem XYZ (mesma conversão do THREE.Euler)
  const m11 = 1 - 2 * (qy * qy + qz * qz);
  const m12 = 2 * (qx * qy - qz * w);
  const m13 = 2 * (qx * qz + qy * w);
  const m23 = 2 * (qy * qz - qx * w);
  const m33 = 1 - 2 * (qx * qx + qy * qy);
  const m22 = 1 - 2 * (qx * qx + qz * qz);
  const m32 = 2 * (qy * qz + qx * w);

  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  let x: number;
  let z: number;
  if (Math.abs(m13) < 0.9999999) {
    x = Math.atan2(-m23, m33);
    z = Math.atan2(-m12, m11);
  } else {
    x = Math.atan2(m32, m22);
    z = 0;
  }
  return { x, y, z };
}

/**
 * Pose completa para apontar para um ponto no espaço do personagem (RF01d, CA09).
 * `alvo` é relativo ao ombro do braço que aponta; `alvoCabeca` é relativo à cabeça.
 */
export function calcularPoseApontar(alvoOmbro: Vetor3, alvoCabeca: Vetor3, ladoAlvoX: number): PoseVRM {
  const lado: 'left' | 'right' = ladoAlvoX >= 0 ? 'left' : 'right';
  const outro = lado === 'left' ? 'right' : 'left';

  const yaw = Math.atan2(alvoCabeca.x, Math.max(0.05, alvoCabeca.z));
  const pitch = Math.atan2(-alvoCabeca.y, Math.hypot(alvoCabeca.x, alvoCabeca.z));
  const limitar = (v: number, max: number) => Math.max(-max, Math.min(max, v));

  const pose: PoseVRM = {
    spine: { x: 0, y: limitar(yaw * 0.15, 0.2), z: 0 },
    chest: { x: 0, y: limitar(yaw * 0.25, 0.3), z: 0 },
    neck: { x: limitar(pitch * 0.3, 0.25), y: limitar(yaw * 0.25, 0.35), z: 0 },
    head: { x: limitar(pitch * 0.4, 0.3), y: limitar(yaw * 0.35, 0.45), z: 0 },
    leftUpperArm: { x: 0.05, y: 0.05, z: -1.25 },
    leftLowerArm: { x: 0, y: -0.25, z: 0 },
    leftHand: { x: 0, y: 0, z: 0 },
    rightUpperArm: { x: 0.05, y: -0.05, z: 1.25 },
    rightLowerArm: { x: 0, y: 0.25, z: 0 },
    rightHand: { x: 0, y: 0, z: 0 }
  };

  // O braço fica no espaço do tronco, que já girou: desconta esse giro da direção
  const giroTronco = pose.spine!.y + pose.chest!.y;
  const cos = Math.cos(-giroTronco);
  const sin = Math.sin(-giroTronco);
  const direcaoNoTronco = {
    x: alvoOmbro.x * cos + alvoOmbro.z * sin,
    y: alvoOmbro.y,
    z: -alvoOmbro.x * sin + alvoOmbro.z * cos
  };
  pose[`${lado}UpperArm`] = calcularRotacaoBracoParaDirecao(lado, direcaoNoTronco);
  pose[`${lado}LowerArm`] = { x: 0, y: lado === 'left' ? -0.12 : 0.12, z: 0 };
  pose[`${lado}Hand`] = { x: 0, y: 0, z: 0 };
  // Braço livre relaxado e levemente atrás para não cruzar o corpo
  pose[`${outro}UpperArm`] = outro === 'left' ? { x: 0.08, y: 0.05, z: -1.25 } : { x: 0.08, y: -0.05, z: 1.25 };

  return pose;
}

/**
 * Soma duas poses osso a osso (a base não é alterada).
 */
export function somarPoses(base: PoseVRM, extra: PoseVRM, peso = 1): PoseVRM {
  const resultado: PoseVRM = { ...base };
  for (const chave of Object.keys(extra) as Array<keyof PoseVRM>) {
    const b = base[chave] || { x: 0, y: 0, z: 0 };
    const e = extra[chave]!;
    resultado[chave] = { x: b.x + e.x * peso, y: b.y + e.y * peso, z: b.z + e.z * peso };
  }
  return resultado;
}

/** Palavras que disparam a contagem nos dedos (CA06). */
const ORDINAIS: Record<string, number> = {
  primeiro: 1, primeira: 1, um: 1, uma: 1,
  segundo: 2, segunda: 2, dois: 2, duas: 2,
  terceiro: 3, terceira: 3, tres: 3,
  quarto: 4, quarta: 4, quatro: 4,
  quinto: 5, quinta: 5, cinco: 5
};

/**
 * Número de dedos a mostrar para uma palavra falada, ou null se ela não é contagem.
 * "um/uma" só contam quando `emEnumeracao` (evita contar o artigo indefinido).
 */
export function dedosParaPalavra(palavra: string | undefined, emEnumeracao: boolean): number | null {
  if (!palavra) return null;
  const termo = palavra
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (/^[1-5]$/.test(termo)) return Number(termo);
  const n = ORDINAIS[termo];
  if (n === undefined) return null;
  if (n === 1 && (termo === 'um' || termo === 'uma') && !emEnumeracao) return null;
  if (!emEnumeracao && ['dois', 'duas', 'tres', 'quatro', 'cinco', 'quarta', 'quinta', 'segunda'].includes(termo)) {
    // Numerais cardinais e dias da semana só contam dentro de uma enumeração já iniciada
    return null;
  }
  return n;
}
