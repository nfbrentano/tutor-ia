/**
 * TUTORIA - Gerador Determinístico de Modelos VRM 1.0 das Personas
 *
 * Constrói os 7 avatares 3D estilizados em `public/avatar/personas/<id>.vrm`,
 * compatíveis com `@pixiv/three-vrm` (VRM 1.0), com esqueleto humanoide completo
 * (55 ossos incluindo todos os dedos), lookAt por osso e as 9 expressões exigidas
 * pelo RNF01 (`blink`, `aa`, `ih`, `ou`, `ee`, `oh`, `happy`, `relaxed`, `surprised`).
 *
 * Uso: npx tsx scripts/gerar-personas-vrm.ts
 */

import * as fs from 'fs';
import * as path from 'path';

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

interface BoneDef {
  name: string;
  parent: string | null;
  localTranslation: Vec3;
}

type FaceTag =
  | 'upperLidL'
  | 'upperLidR'
  | 'lowerLidL'
  | 'lowerLidR'
  | 'browL'
  | 'browR'
  | 'cheekL'
  | 'cheekR'
  | 'upperLip'
  | 'lowerLip'
  | 'chin';

interface TaggedVertex {
  tag: FaceTag;
  /** Coordenada horizontal normalizada no elemento (-1 esquerda do rosto .. +1 direita) */
  u: number;
  /** Intensidade da deformação (0 = ancorado na borda, 1 = centro móvel) */
  v: number;
}

export interface PersonaVisualSpec {
  id: string;
  nomeExibido: string;
  skinHex: string;
  lipHex: string;
  irisHex: string;
  hairHex: string;
  hairSecondaryHex?: string;
  coatHex: string;
  vestHex: string;
  shirtHex: string;
  tieHex?: string;
  pantsHex: string;
  shoeHex: string;
  accentHex?: string;
  /** Largura relativa dos ombros e torso */
  torsoScale: number;
  /** Estilo de cabelo */
  hairStyle: 'wavy-bob' | 'wild-tufts' | 'victorian-bun' | 'swept-back' | 'short-curly' | 'explorer-waves' | 'classical-headband';
  /** Barba / bigode estilizado */
  facialHair?: 'goatee-mustache' | 'handlebar' | 'trimmed-beard' | 'full-classical-beard';
  /** Óculos / acessório facial */
  eyewear?: 'forehead-goggles' | 'pince-nez';
  /** Detalhe de vestuário */
  outfitDetail: 'cardigan' | 'lab-coat' | 'victorian-collar' | 'frock-coat' | 'suit-chain' | 'explorer-coat' | 'chiton-himation';
}

const PERSONA_SPECS: PersonaVisualSpec[] = [
  {
    id: 'lia',
    nomeExibido: 'Lia',
    skinHex: '#edc4a6',
    lipHex: '#c66d68',
    irisHex: '#462c1c',
    hairHex: '#5a3622',
    hairSecondaryHex: '#6c432c',
    coatHex: '#188887',
    vestHex: '#f4f1ea',
    shirtHex: '#f8f6f0',
    pantsHex: '#253149',
    shoeHex: '#22242c',
    accentHex: '#e6b85c',
    torsoScale: 0.92,
    hairStyle: 'wavy-bob',
    outfitDetail: 'cardigan'
  },
  {
    id: 'prof-atomo',
    nomeExibido: 'Prof. Átomo',
    skinHex: '#f1c7aa',
    lipHex: '#c77a6e',
    irisHex: '#2d6ea3',
    hairHex: '#e7ebf0',
    hairSecondaryHex: '#cfd6df',
    coatHex: '#f4f6f9',
    vestHex: '#1f7a56',
    shirtHex: '#ffffff',
    tieHex: '#6a3f9c',
    pantsHex: '#2d343e',
    shoeHex: '#232328',
    accentHex: '#249ea0',
    torsoScale: 1.04,
    hairStyle: 'wild-tufts',
    facialHair: 'goatee-mustache',
    eyewear: 'forehead-goggles',
    outfitDetail: 'lab-coat'
  },
  {
    id: 'ada',
    nomeExibido: 'Ada',
    skinHex: '#f3cfbc',
    lipHex: '#b85c62',
    irisHex: '#4f3823',
    hairHex: '#352119',
    hairSecondaryHex: '#482e23',
    coatHex: '#6d2344',
    vestHex: '#521832',
    shirtHex: '#f5efe6',
    pantsHex: '#3d1527',
    shoeHex: '#251a20',
    accentHex: '#d8aa3e',
    torsoScale: 0.9,
    hairStyle: 'victorian-bun',
    outfitDetail: 'victorian-collar'
  },
  {
    id: 'oswaldo',
    nomeExibido: 'Oswaldo',
    skinHex: '#e0b394',
    lipHex: '#b46f64',
    irisHex: '#3a2a1e',
    hairHex: '#333135',
    hairSecondaryHex: '#8d9299',
    coatHex: '#252932',
    vestHex: '#393f4d',
    shirtHex: '#f5f5f2',
    tieHex: '#7c2231',
    pantsHex: '#22262e',
    shoeHex: '#1a1b20',
    accentHex: '#c8a248',
    torsoScale: 1.0,
    hairStyle: 'swept-back',
    facialHair: 'handlebar',
    eyewear: 'pince-nez',
    outfitDetail: 'frock-coat'
  },
  {
    id: 'machado',
    nomeExibido: 'Machado',
    skinHex: '#9d6b4c',
    lipHex: '#7d4a3c',
    irisHex: '#2d1e15',
    hairHex: '#3c3a3e',
    hairSecondaryHex: '#90949a',
    coatHex: '#2e333c',
    vestHex: '#3e444f',
    shirtHex: '#f6f5f0',
    tieHex: '#191b21',
    pantsHex: '#262a32',
    shoeHex: '#1a1b1f',
    accentHex: '#c0a25a',
    torsoScale: 0.96,
    hairStyle: 'short-curly',
    facialHair: 'trimmed-beard',
    eyewear: 'pince-nez',
    outfitDetail: 'suit-chain'
  },
  {
    id: 'humboldt',
    nomeExibido: 'Humboldt',
    skinHex: '#ecc0a5',
    lipHex: '#c17368',
    irisHex: '#3b6485',
    hairHex: '#7a4b2f',
    hairSecondaryHex: '#94613f',
    coatHex: '#1d3b66',
    vestHex: '#b98944',
    shirtHex: '#f5f2ea',
    tieHex: '#ebe6d8',
    pantsHex: '#29303b',
    shoeHex: '#29221d',
    accentHex: '#d5a738',
    torsoScale: 0.98,
    hairStyle: 'explorer-waves',
    outfitDetail: 'explorer-coat'
  },
  {
    id: 'herodoto',
    nomeExibido: 'Heródoto',
    skinHex: '#d0a07c',
    lipHex: '#a56355',
    irisHex: '#3e2b1d',
    hairHex: '#3c2a21',
    hairSecondaryHex: '#523b2f',
    coatHex: '#285e7d',
    vestHex: '#eee7d6',
    shirtHex: '#eee7d6',
    pantsHex: '#e2dac6',
    shoeHex: '#6c4930',
    accentHex: '#b04b35',
    torsoScale: 1.02,
    hairStyle: 'classical-headband',
    facialHair: 'full-classical-beard',
    outfitDetail: 'chiton-himation'
  }
];

/** Definição dos 55 ossos humanoides VRM 1.0 em T-pose padrão (personagem olha para +Z). */
const BONE_DEFS: BoneDef[] = [
  { name: 'hips', parent: null, localTranslation: [0, 0.88, 0] },
  { name: 'spine', parent: 'hips', localTranslation: [0, 0.1, 0] },
  { name: 'chest', parent: 'spine', localTranslation: [0, 0.14, 0] },
  { name: 'upperChest', parent: 'chest', localTranslation: [0, 0.14, 0] },
  { name: 'neck', parent: 'upperChest', localTranslation: [0, 0.12, 0] },
  { name: 'head', parent: 'neck', localTranslation: [0, 0.08, 0] },
  { name: 'leftEye', parent: 'head', localTranslation: [0.034, 0.075, 0.082] },
  { name: 'rightEye', parent: 'head', localTranslation: [-0.034, 0.075, 0.082] },

  { name: 'leftShoulder', parent: 'upperChest', localTranslation: [0.05, 0.09, 0] },
  { name: 'leftUpperArm', parent: 'leftShoulder', localTranslation: [0.11, 0, 0] },
  { name: 'leftLowerArm', parent: 'leftUpperArm', localTranslation: [0.24, 0, 0] },
  { name: 'leftHand', parent: 'leftLowerArm', localTranslation: [0.22, 0, 0] },

  { name: 'rightShoulder', parent: 'upperChest', localTranslation: [-0.05, 0.09, 0] },
  { name: 'rightUpperArm', parent: 'rightShoulder', localTranslation: [-0.11, 0, 0] },
  { name: 'rightLowerArm', parent: 'rightUpperArm', localTranslation: [-0.24, 0, 0] },
  { name: 'rightHand', parent: 'rightLowerArm', localTranslation: [-0.22, 0, 0] },

  { name: 'leftUpperLeg', parent: 'hips', localTranslation: [0.09, -0.04, 0] },
  { name: 'leftLowerLeg', parent: 'leftUpperLeg', localTranslation: [0, -0.4, 0] },
  { name: 'leftFoot', parent: 'leftLowerLeg', localTranslation: [0, -0.38, 0] },
  { name: 'leftToes', parent: 'leftFoot', localTranslation: [0, -0.04, 0.1] },

  { name: 'rightUpperLeg', parent: 'hips', localTranslation: [-0.09, -0.04, 0] },
  { name: 'rightLowerLeg', parent: 'rightUpperLeg', localTranslation: [0, -0.4, 0] },
  { name: 'rightFoot', parent: 'rightLowerLeg', localTranslation: [0, -0.38, 0] },
  { name: 'rightToes', parent: 'rightFoot', localTranslation: [0, -0.04, 0.1] },

  // Dedos da mão esquerda (+X)
  { name: 'leftThumbMetacarpal', parent: 'leftHand', localTranslation: [0.02, -0.008, 0.022] },
  { name: 'leftThumbProximal', parent: 'leftThumbMetacarpal', localTranslation: [0.02, -0.004, 0.016] },
  { name: 'leftThumbDistal', parent: 'leftThumbProximal', localTranslation: [0.018, -0.002, 0.012] },

  { name: 'leftIndexProximal', parent: 'leftHand', localTranslation: [0.068, 0.004, 0.022] },
  { name: 'leftIndexIntermediate', parent: 'leftIndexProximal', localTranslation: [0.028, 0, 0] },
  { name: 'leftIndexDistal', parent: 'leftIndexIntermediate', localTranslation: [0.02, 0, 0] },

  { name: 'leftMiddleProximal', parent: 'leftHand', localTranslation: [0.071, 0.004, 0.006] },
  { name: 'leftMiddleIntermediate', parent: 'leftMiddleProximal', localTranslation: [0.031, 0, 0] },
  { name: 'leftMiddleDistal', parent: 'leftMiddleIntermediate', localTranslation: [0.022, 0, 0] },

  { name: 'leftRingProximal', parent: 'leftHand', localTranslation: [0.068, 0.004, -0.01] },
  { name: 'leftRingIntermediate', parent: 'leftRingProximal', localTranslation: [0.028, 0, 0] },
  { name: 'leftRingDistal', parent: 'leftRingIntermediate', localTranslation: [0.02, 0, 0] },

  { name: 'leftLittleProximal', parent: 'leftHand', localTranslation: [0.063, 0.004, -0.025] },
  { name: 'leftLittleIntermediate', parent: 'leftLittleProximal', localTranslation: [0.023, 0, 0] },
  { name: 'leftLittleDistal', parent: 'leftLittleIntermediate', localTranslation: [0.017, 0, 0] },

  // Dedos da mão direita (-X)
  { name: 'rightThumbMetacarpal', parent: 'rightHand', localTranslation: [-0.02, -0.008, 0.022] },
  { name: 'rightThumbProximal', parent: 'rightThumbMetacarpal', localTranslation: [-0.02, -0.004, 0.016] },
  { name: 'rightThumbDistal', parent: 'rightThumbProximal', localTranslation: [-0.018, -0.002, 0.012] },

  { name: 'rightIndexProximal', parent: 'rightHand', localTranslation: [-0.068, 0.004, 0.022] },
  { name: 'rightIndexIntermediate', parent: 'rightIndexProximal', localTranslation: [-0.028, 0, 0] },
  { name: 'rightIndexDistal', parent: 'rightIndexIntermediate', localTranslation: [-0.02, 0, 0] },

  { name: 'rightMiddleProximal', parent: 'rightHand', localTranslation: [-0.071, 0.004, 0.006] },
  { name: 'rightMiddleIntermediate', parent: 'rightMiddleProximal', localTranslation: [-0.031, 0, 0] },
  { name: 'rightMiddleDistal', parent: 'rightMiddleIntermediate', localTranslation: [-0.022, 0, 0] },

  { name: 'rightRingProximal', parent: 'rightHand', localTranslation: [-0.068, 0.004, -0.01] },
  { name: 'rightRingIntermediate', parent: 'rightRingProximal', localTranslation: [-0.028, 0, 0] },
  { name: 'rightRingDistal', parent: 'rightRingIntermediate', localTranslation: [-0.02, 0, 0] },

  { name: 'rightLittleProximal', parent: 'rightHand', localTranslation: [-0.063, 0.004, -0.025] },
  { name: 'rightLittleIntermediate', parent: 'rightLittleProximal', localTranslation: [-0.023, 0, 0] },
  { name: 'rightLittleDistal', parent: 'rightLittleIntermediate', localTranslation: [-0.017, 0, 0] }
];

const BONE_INDEX_BY_NAME = new Map<string, number>(BONE_DEFS.map((b, i) => [b.name, i]));

function calcularPosicoesGlobais(): Map<string, Vec3> {
  const globais = new Map<string, Vec3>();
  for (const b of BONE_DEFS) {
    if (!b.parent) {
      globais.set(b.name, [...b.localTranslation]);
    } else {
      const p = globais.get(b.parent)!;
      globais.set(b.name, [
        p[0] + b.localTranslation[0],
        p[1] + b.localTranslation[1],
        p[2] + b.localTranslation[2]
      ]);
    }
  }
  return globais;
}

const WORLD_BONES = calcularPosicoesGlobais();

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinear(hex: string, factor = 1): Vec3 {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Math.min(1, srgbToLinearChannel(r) * factor),
    Math.min(1, srgbToLinearChannel(g) * factor),
    Math.min(1, srgbToLinearChannel(b) * factor)
  ];
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function normVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  joints: number[] = [];
  weights: number[] = [];
  indices: number[] = [];
  tags = new Map<number, TaggedVertex>();

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  addVertex(
    pos: Vec3,
    normal: Vec3,
    color: Vec3,
    boneWeights: Array<[string, number]>,
    tag?: TaggedVertex
  ): number {
    const idx = this.vertexCount;
    const n = normVec3(normal);
    this.positions.push(pos[0], pos[1], pos[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.colors.push(color[0], color[1], color[2]);

    const j: Vec4 = [0, 0, 0, 0];
    const w: Vec4 = [0, 0, 0, 0];
    let sum = 0;
    const limited = boneWeights.slice(0, 4);
    for (let i = 0; i < limited.length; i++) {
      const [bName, bWeight] = limited[i];
      const bIdx = BONE_INDEX_BY_NAME.get(bName);
      if (bIdx === undefined) throw new Error(`Osso desconhecido: ${bName}`);
      j[i] = bIdx;
      w[i] = bWeight;
      sum += bWeight;
    }
    if (sum > 0) {
      w[0] /= sum;
      w[1] /= sum;
      w[2] /= sum;
      w[3] /= sum;
    } else {
      w[0] = 1;
    }
    this.joints.push(j[0], j[1], j[2], j[3]);
    this.weights.push(w[0], w[1], w[2], w[3]);
    if (tag) this.tags.set(idx, tag);
    return idx;
  }

  addTriangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  addQuad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d);
  }

  /** Elipsoide fechado com centro, raios e pesos opcionais de osso. */
  addEllipsoid(
    center: Vec3,
    radii: Vec3,
    color: Vec3,
    bones: Array<[string, number]>,
    segU = 16,
    segV = 12,
    deform?: (p: Vec3, u: number, v: number) => Vec3
  ): void {
    const startIdx = this.vertexCount;
    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const phi = v * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        const theta = u * Math.PI * 2;
        const lx = Math.sin(theta) * sinPhi;
        const ly = cosPhi;
        const lz = Math.cos(theta) * sinPhi;
        let p: Vec3 = [
          center[0] + lx * radii[0],
          center[1] + ly * radii[1],
          center[2] + lz * radii[2]
        ];
        if (deform) p = deform(p, u, v);
        const n: Vec3 = [lx / (radii[0] || 1), ly / (radii[1] || 1), lz / (radii[2] || 1)];
        this.addVertex(p, n, color, bones);
      }
    }
    const stride = segU + 1;
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = startIdx + iv * stride + iu;
        const b = a + stride;
        const c = b + 1;
        const d = a + 1;
        if (iv !== 0) this.addTriangle(a, b, c);
        if (iv !== segV - 1) this.addTriangle(a, c, d);
      }
    }
  }

  /** Tubo fechado entre dois pontos com interpolação suave de raio e de pesos entre ossos. */
  addLimbSegment(
    p0: Vec3,
    p1: Vec3,
    r0: [number, number],
    r1: [number, number],
    color0: Vec3,
    color1: Vec3,
    bone0: string,
    bone1: string,
    rings = 6,
    radialSegs = 12,
    capStart = true,
    capEnd = true
  ): void {
    const axis = normVec3(subVec3(p1, p0));
    const upRef: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
    const side = normVec3(crossVec3(upRef, axis));
    const ortho = normVec3(crossVec3(axis, side));

    const startIdx = this.vertexCount;
    for (let ir = 0; ir <= rings; ir++) {
      const t = ir / rings;
      const center = lerpVec3(p0, p1, t);
      const rx = r0[0] + (r1[0] - r0[0]) * t;
      const rz = r0[1] + (r1[1] - r0[1]) * t;
      const col = lerpVec3(color0, color1, t);
      const w1 = bone0 === bone1 ? 0 : t;
      const w0 = 1 - w1;
      const bw: Array<[string, number]> = w1 > 0.001 && w0 > 0.001 ? [[bone0, w0], [bone1, w1]] : w1 >= 0.5 ? [[bone1, 1]] : [[bone0, 1]];

      for (let is = 0; is <= radialSegs; is++) {
        const ang = (is / radialSegs) * Math.PI * 2;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const offset = addVec3(scaleVec3(side, ca * rx), scaleVec3(ortho, sa * rz));
        const pos = addVec3(center, offset);
        const n = addVec3(scaleVec3(side, ca / (rx || 1)), scaleVec3(ortho, sa / (rz || 1)));
        this.addVertex(pos, n, col, bw);
      }
    }

    const stride = radialSegs + 1;
    for (let ir = 0; ir < rings; ir++) {
      for (let is = 0; is < radialSegs; is++) {
        const a = startIdx + ir * stride + is;
        const b = a + stride;
        const c = b + 1;
        const d = a + 1;
        this.addQuad(a, d, c, b);
      }
    }

    if (capStart) {
      const cIdx = this.addVertex(p0, scaleVec3(axis, -1), color0, [[bone0, 1]]);
      for (let is = 0; is < radialSegs; is++) {
        const a = startIdx + is;
        const d = a + 1;
        this.addTriangle(cIdx, d, a);
      }
    }
    if (capEnd) {
      const topOffset = startIdx + rings * stride;
      const cIdx = this.addVertex(p1, axis, color1, [[bone1, 1]]);
      for (let is = 0; is < radialSegs; is++) {
        const b = topOffset + is;
        const c = b + 1;
        this.addTriangle(cIdx, b, c);
      }
    }
  }

  /** Caixa chanfrada simples orientada no espaço global. */
  addBox(center: Vec3, half: Vec3, color: Vec3, bones: Array<[string, number]>): void {
    const [cx, cy, cz] = center;
    const [hx, hy, hz] = half;
    const faces: Array<{ n: Vec3; verts: Vec3[] }> = [
      { n: [0, 0, 1], verts: [[cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]] },
      { n: [0, 0, -1], verts: [[cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz]] },
      { n: [1, 0, 0], verts: [[cx + hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz]] },
      { n: [-1, 0, 0], verts: [[cx - hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz + hz], [cx - hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz - hz]] },
      { n: [0, 1, 0], verts: [[cx - hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz]] },
      { n: [0, -1, 0], verts: [[cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz + hz], [cx - hx, cy - hy, cz + hz]] }
    ];
    for (const f of faces) {
      const i0 = this.addVertex(f.verts[0], f.n, color, bones);
      const i1 = this.addVertex(f.verts[1], f.n, color, bones);
      const i2 = this.addVertex(f.verts[2], f.n, color, bones);
      const i3 = this.addVertex(f.verts[3], f.n, color, bones);
      this.addQuad(i0, i1, i2, i3);
    }
  }

  /**
   * Faixa curva para pálpebra ou sobrancelha sobre o rosto (com tag semântica para morph targets).
   */
  addFaceArcStrip(
    center: Vec3,
    halfWidth: number,
    height: number,
    depthCurve: number,
    tiltZ: number,
    color: Vec3,
    tag: FaceTag,
    cols = 6,
    rows = 3,
    invertVerticalWeight = false
  ): void {
    const startIdx = this.vertexCount;
    for (let ir = 0; ir <= rows; ir++) {
      const rv = ir / rows; // 0 = base, 1 = topo
      const weightV = invertVerticalWeight ? 1 - rv : rv;
      for (let ic = 0; ic <= cols; ic++) {
        const u = (ic / cols) * 2 - 1; // -1 .. +1
        const x = center[0] + u * halfWidth;
        const arch = (1 - u * u) * 0.004;
        const y = center[1] + (rv - 0.5) * height + u * tiltZ + arch;
        const z = center[2] + (1 - u * u) * depthCurve;
        const n: Vec3 = [u * 0.3, (rv - 0.5) * 0.25, 0.9];
        this.addVertex([x, y, z], n, color, [['head', 1]], {
          tag,
          u,
          v: weightV * (1 - 0.25 * u * u)
        });
      }
    }
    const stride = cols + 1;
    for (let ir = 0; ir < rows; ir++) {
      for (let ic = 0; ic < cols; ic++) {
        const a = startIdx + ir * stride + ic;
        const b = a + 1;
        const c = b + stride;
        const d = a + stride;
        this.addQuad(a, b, c, d);
      }
    }
  }
}

function construirCorpoBase(mb: MeshBuilder, spec: PersonaVisualSpec): void {
  const skin = hexToLinear(spec.skinHex);
  const skinShade = hexToLinear(spec.skinHex, 0.88);
  const lip = hexToLinear(spec.lipHex);
  const iris = hexToLinear(spec.irisHex);
  const hair = hexToLinear(spec.hairHex);
  const hair2 = hexToLinear(spec.hairSecondaryHex ?? spec.hairHex);
  const coat = hexToLinear(spec.coatHex);
  const vest = hexToLinear(spec.vestHex);
  const shirt = hexToLinear(spec.shirtHex);
  const tie = spec.tieHex ? hexToLinear(spec.tieHex) : coat;
  const pants = hexToLinear(spec.pantsHex);
  const shoe = hexToLinear(spec.shoeHex);
  const accent = hexToLinear(spec.accentHex ?? spec.coatHex);
  const sclera: Vec3 = [0.95, 0.95, 0.96];
  const pupil: Vec3 = [0.02, 0.02, 0.025];
  const mouthInterior: Vec3 = [0.12, 0.02, 0.025];

  const s = spec.torsoScale;

  // 1. Pernas, pés e dedos dos pés (garante skinning válido em todos os ossos inferiores)
  for (const lado of ['left', 'right'] as const) {
    const sign = lado === 'left' ? 1 : -1;
    const hip = WORLD_BONES.get(`${lado}UpperLeg`)!;
    const knee = WORLD_BONES.get(`${lado}LowerLeg`)!;
    const ankle = WORLD_BONES.get(`${lado}Foot`)!;
    const toes = WORLD_BONES.get(`${lado}Toes`)!;

    const legColor = spec.outfitDetail === 'chiton-himation' || spec.outfitDetail === 'victorian-collar' ? pants : pants;
    mb.addLimbSegment(
      hip,
      knee,
      [0.068 * s, 0.072],
      [0.052, 0.055],
      legColor,
      legColor,
      `${lado}UpperLeg`,
      `${lado}LowerLeg`,
      5,
      10
    );
    mb.addLimbSegment(
      knee,
      ankle,
      [0.05, 0.052],
      [0.038, 0.04],
      spec.outfitDetail === 'chiton-himation' ? skin : legColor,
      spec.outfitDetail === 'chiton-himation' ? skin : legColor,
      `${lado}LowerLeg`,
      `${lado}Foot`,
      5,
      10
    );
    // Sapato/sandália
    mb.addEllipsoid(
      [ankle[0], ankle[1] - 0.025, ankle[2] + 0.03],
      [0.044, 0.032, 0.075],
      shoe,
      [[`${lado}Foot`, 0.75], [`${lado}Toes`, 0.25]],
      10,
      8
    );
    mb.addEllipsoid(
      [toes[0] + sign * 0.002, toes[1], toes[2] + 0.02],
      [0.04, 0.022, 0.04],
      shoe,
      [[`${lado}Toes`, 1]],
      8,
      6
    );
  }

  // 2. Quadril, tronco, colete, casaco e gola
  const hipsPos = WORLD_BONES.get('hips')!;
  const spinePos = WORLD_BONES.get('spine')!;
  const chestPos = WORLD_BONES.get('chest')!;
  const upperChestPos = WORLD_BONES.get('upperChest')!;
  const neckPos = WORLD_BONES.get('neck')!;
  const headPos = WORLD_BONES.get('head')!;

  // Pelve/cintura
  mb.addEllipsoid(
    [hipsPos[0], hipsPos[1] + 0.01, hipsPos[2]],
    [0.14 * s, 0.09, 0.1],
    spec.outfitDetail === 'victorian-collar' ? coat : pants,
    [['hips', 0.8], ['spine', 0.2]],
    16,
    10
  );

  // Túnica/saia estilizada abaixo do quadril para Ada e Heródoto (modesta e contínua)
  if (spec.outfitDetail === 'victorian-collar' || spec.outfitDetail === 'chiton-himation') {
    mb.addLimbSegment(
      [0, 0.88, 0],
      [0, 0.56, 0],
      [0.14 * s, 0.105],
      [0.18 * s, 0.135],
      spec.outfitDetail === 'victorian-collar' ? coat : pants,
      spec.outfitDetail === 'victorian-collar' ? coat : pants,
      'hips',
      'hips',
      4,
      14
    );
  }

  // Torso (spine -> chest -> upperChest)
  mb.addLimbSegment(
    [hipsPos[0], hipsPos[1] + 0.04, 0],
    [chestPos[0], chestPos[1] + 0.02, 0],
    [0.125 * s, 0.088],
    [0.145 * s, 0.098],
    vest,
    vest,
    'spine',
    'chest',
    5,
    16
  );
  mb.addLimbSegment(
    chestPos,
    [upperChestPos[0], upperChestPos[1] + 0.08, 0],
    [0.145 * s, 0.098],
    [0.155 * s, 0.095],
    vest,
    shirt,
    'chest',
    'upperChest',
    5,
    16
  );

  // Peça externa (casaco / jaleco / cardigã / himátion) sobre o torso
  if (spec.outfitDetail === 'chiton-himation') {
    // Manto inclinado sobre o ombro esquerdo
    mb.addLimbSegment(
      [-0.12 * s, 0.94, 0.01],
      [0.1 * s, 1.33, 0.01],
      [0.09, 0.105],
      [0.075, 0.1],
      coat,
      coat,
      'chest',
      'upperChest',
      4,
      12
    );
    // Faixa decorativa terracota no ombro
    mb.addBox([0.08 * s, 1.32, 0.07], [0.022, 0.06, 0.025], accent, [['upperChest', 1]]);
  } else {
    // Casaco aberto na frente (laterais esquerda/direita e costas) para revelar colete/camisa/gravata
    for (const sideSign of [-1, 1]) {
      mb.addEllipsoid(
        [sideSign * 0.098 * s, 1.19, 0.005],
        [0.068 * s, 0.15, 0.096],
        coat,
        [['chest', 0.45], ['upperChest', 0.45], ['spine', 0.1]],
        10,
        8
      );
      // Lapela do casaco/jaleco
      mb.addBox(
        [sideSign * 0.048 * s, 1.26, 0.082],
        [0.024, 0.075, 0.016],
        hexToLinear(spec.coatHex, 0.92),
        [['upperChest', 1]]
      );
    }
    // Costas contínuas do casaco
    mb.addEllipsoid(
      [0, 1.18, -0.045],
      [0.148 * s, 0.16, 0.062],
      coat,
      [['chest', 0.5], ['upperChest', 0.4], ['spine', 0.1]],
      12,
      8
    );
  }

  // Detalhes específicos de vestuário
  if (spec.outfitDetail === 'lab-coat') {
    // Barra inferior do jaleco branco
    mb.addLimbSegment(
      [0, 0.96, -0.01],
      [0, 0.74, -0.01],
      [0.142 * s, 0.102],
      [0.165 * s, 0.115],
      coat,
      coat,
      'hips',
      'hips',
      3,
      14
    );
    // Bolso do jaleco com duas canetas
    mb.addBox([0.075 * s, 1.2, 0.094], [0.022, 0.026, 0.008], hexToLinear(spec.coatHex, 0.9), [['chest', 1]]);
    mb.addBox([0.068 * s, 1.23, 0.095], [0.004, 0.018, 0.004], accent, [['chest', 1]]);
    mb.addBox([0.08 * s, 1.228, 0.095], [0.004, 0.016, 0.004], tie, [['chest', 1]]);
  }
  if (spec.tieHex && (spec.outfitDetail === 'lab-coat' || spec.outfitDetail === 'suit-chain')) {
    // Gravata borboleta estilizada (Prof. Átomo e Machado)
    mb.addBox([-0.022, 1.335, 0.088], [0.018, 0.011, 0.01], tie, [['upperChest', 1]]);
    mb.addBox([0.022, 1.335, 0.088], [0.018, 0.011, 0.01], tie, [['upperChest', 1]]);
    mb.addBox([0, 1.335, 0.091], [0.008, 0.008, 0.01], hexToLinear(spec.tieHex, 0.85), [['upperChest', 1]]);
  } else if (spec.tieHex && (spec.outfitDetail === 'frock-coat' || spec.outfitDetail === 'explorer-coat')) {
    // Gravata vertical / cravat (Oswaldo e Humboldt)
    mb.addBox([0, 1.33, 0.092], [0.015, 0.014, 0.012], tie, [['upperChest', 1]]);
    mb.addBox([0, 1.255, 0.091], [0.016, 0.068, 0.008], tie, [['upperChest', 0.6], ['chest', 0.4]]);
  }
  if (spec.outfitDetail === 'victorian-collar') {
    // Gola alta clara e broche dourado da Ada
    mb.addEllipsoid([0, 1.355, 0.02], [0.056, 0.03, 0.055], shirt, [['upperChest', 0.5], ['neck', 0.5]], 12, 8);
    mb.addEllipsoid([0, 1.33, 0.088], [0.015, 0.015, 0.008], accent, [['upperChest', 1]], 10, 6);
  }
  if (spec.outfitDetail === 'suit-chain') {
    // Corrente de relógio discreta no colete do Machado
    mb.addBox([-0.032, 1.13, 0.096], [0.025, 0.004, 0.005], accent, [['chest', 1]]);
  }
  if (spec.outfitDetail === 'explorer-coat') {
    // Botões dourados do casaco de Humboldt
    for (const by of [1.14, 1.2, 1.26]) {
      mb.addEllipsoid([-0.038 * s, by, 0.094], [0.006, 0.006, 0.004], accent, [['chest', 1]], 6, 4);
      mb.addEllipsoid([0.038 * s, by, 0.094], [0.006, 0.006, 0.004], accent, [['chest', 1]], 6, 4);
    }
  }

  // 3. Braços, antebraços, mãos e TODOS OS 30 OSSOS DOS DEDOS
  for (const lado of ['left', 'right'] as const) {
    const sign = lado === 'left' ? 1 : -1;
    const sh = WORLD_BONES.get(`${lado}Shoulder`)!;
    const ua = WORLD_BONES.get(`${lado}UpperArm`)!;
    const la = WORLD_BONES.get(`${lado}LowerArm`)!;
    const ha = WORLD_BONES.get(`${lado}Hand`)!;

    const sleeveColor = spec.outfitDetail === 'chiton-himation' ? shirt : coat;
    const armLowerColor = spec.outfitDetail === 'chiton-himation' ? skin : coat;

    // Ombro -> braço superior
    mb.addLimbSegment(
      sh,
      ua,
      [0.055, 0.058],
      [0.044, 0.046],
      sleeveColor,
      sleeveColor,
      `${lado}Shoulder`,
      `${lado}UpperArm`,
      3,
      10
    );
    // Braço superior -> cotovelo
    mb.addLimbSegment(
      ua,
      la,
      [0.043, 0.045],
      [0.036, 0.038],
      sleeveColor,
      armLowerColor,
      `${lado}UpperArm`,
      `${lado}LowerArm`,
      5,
      10
    );
    // Antebraço -> pulso (com punho da camisa no final)
    const wristEdge = lerpVec3(la, ha, 0.88);
    mb.addLimbSegment(
      la,
      wristEdge,
      [0.035, 0.037],
      [0.027, 0.029],
      armLowerColor,
      armLowerColor,
      `${lado}LowerArm`,
      `${lado}LowerArm`,
      4,
      10
    );
    mb.addLimbSegment(
      wristEdge,
      ha,
      [0.028, 0.03],
      [0.024, 0.026],
      spec.outfitDetail === 'chiton-himation' ? skin : shirt,
      skin,
      `${lado}LowerArm`,
      `${lado}Hand`,
      2,
      10
    );

    // Palma da mão
    mb.addEllipsoid(
      [ha[0] + sign * 0.036, ha[1], ha[2]],
      [0.04, 0.015, 0.035],
      skin,
      [[`${lado}Hand`, 1]],
      10,
      8
    );

    // Polegar (3 ossos)
    const tm = WORLD_BONES.get(`${lado}ThumbMetacarpal`)!;
    const tp = WORLD_BONES.get(`${lado}ThumbProximal`)!;
    const td = WORLD_BONES.get(`${lado}ThumbDistal`)!;
    const tTip: Vec3 = [td[0] + sign * 0.016, td[1] - 0.002, td[2] + 0.01];
    mb.addLimbSegment(tm, tp, [0.009, 0.009], [0.008, 0.008], skin, skin, `${lado}ThumbMetacarpal`, `${lado}ThumbProximal`, 2, 6);
    mb.addLimbSegment(tp, td, [0.008, 0.008], [0.007, 0.007], skin, skin, `${lado}ThumbProximal`, `${lado}ThumbDistal`, 2, 6);
    mb.addLimbSegment(td, tTip, [0.007, 0.007], [0.0055, 0.0055], skin, skinShade, `${lado}ThumbDistal`, `${lado}ThumbDistal`, 2, 6);

    // 4 dedos principais (3 falanges cada = 12 ossos por mão)
    const fingerSpec: Array<{ name: string; lenDistal: number; radius: number }> = [
      { name: 'Index', lenDistal: 0.018, radius: 0.0075 },
      { name: 'Middle', lenDistal: 0.02, radius: 0.008 },
      { name: 'Ring', lenDistal: 0.018, radius: 0.0073 },
      { name: 'Little', lenDistal: 0.015, radius: 0.0063 }
    ];
    for (const f of fingerSpec) {
      const p1 = WORLD_BONES.get(`${lado}${f.name}Proximal`)!;
      const p2 = WORLD_BONES.get(`${lado}${f.name}Intermediate`)!;
      const p3 = WORLD_BONES.get(`${lado}${f.name}Distal`)!;
      const tip: Vec3 = [p3[0] + sign * f.lenDistal, p3[1], p3[2]];
      mb.addLimbSegment(p1, p2, [f.radius, f.radius], [f.radius * 0.9, f.radius * 0.9], skin, skin, `${lado}${f.name}Proximal`, `${lado}${f.name}Intermediate`, 2, 6);
      mb.addLimbSegment(p2, p3, [f.radius * 0.9, f.radius * 0.9], [f.radius * 0.8, f.radius * 0.8], skin, skin, `${lado}${f.name}Intermediate`, `${lado}${f.name}Distal`, 2, 6);
      mb.addLimbSegment(p3, tip, [f.radius * 0.8, f.radius * 0.8], [f.radius * 0.65, f.radius * 0.65], skin, skinShade, `${lado}${f.name}Distal`, `${lado}${f.name}Distal`, 2, 6);
    }
  }

  // 4. Pescoço e Cabeça estilizada
  mb.addLimbSegment(
    [neckPos[0], neckPos[1] - 0.03, 0],
    [headPos[0], headPos[1] + 0.03, 0],
    [0.044, 0.046],
    [0.04, 0.042],
    skinShade,
    skin,
    'neck',
    'head',
    4,
    12
  );

  // Crânio / Rosto base (com queixo/bochechas levemente definidos para morph targets)
  const headCenter: Vec3 = [headPos[0], headPos[1] + 0.078, headPos[2] - 0.004];
  mb.addEllipsoid(
    headCenter,
    [0.088, 0.106, 0.098],
    skin,
    [['head', 1]],
    20,
    16,
    (p) => {
      // Afina suavemente o queixo e projeta a parte frontal do rosto
      const relY = (p[1] - headCenter[1]) / 0.106;
      const out = [...p] as Vec3;
      if (relY < -0.3) {
        const chinFactor = Math.min(1, (-relY - 0.3) / 0.7);
        out[0] *= 1 - 0.24 * chinFactor;
      }
      return out;
    }
  );

  // Orelhas discretas
  for (const sign of [-1, 1]) {
    mb.addEllipsoid(
      [sign * 0.088, headPos[1] + 0.072, -0.006],
      [0.015, 0.025, 0.012],
      skinShade,
      [['head', 1]],
      8,
      6
    );
  }

  // Nariz estilizado
  mb.addEllipsoid(
    [0, headPos[1] + 0.062, 0.1],
    [0.013, 0.018, 0.017],
    skinShade,
    [['head', 1]],
    8,
    8
  );

  // Bochechas com leve rubor e tag semântica para sorriso (`happy`)
  for (const [sign, tag] of [
    [1, 'cheekL'],
    [-1, 'cheekR']
  ] as Array<[number, FaceTag]>) {
    mb.addFaceArcStrip(
      [sign * 0.048, headPos[1] + 0.048, 0.082],
      0.018,
      0.016,
      0.004,
      0,
      lerpVec3(skin, lip, 0.24),
      tag,
      4,
      2
    );
  }

  // 5. Olhos (vinculados a leftEye / rightEye para lookAt funcionar!) + Pálpebras e Sobrancelhas
  for (const lado of ['left', 'right'] as const) {
    const eyeCenter = WORLD_BONES.get(`${lado}Eye`)!;
    const boneName = `${lado}Eye`;

    // Globo ocular (esclera)
    mb.addEllipsoid(eyeCenter, [0.015, 0.015, 0.015], sclera, [[boneName, 1]], 10, 8);
    // Íris colorida à frente
    mb.addEllipsoid([eyeCenter[0], eyeCenter[1], eyeCenter[2] + 0.011], [0.0085, 0.0085, 0.005], iris, [[boneName, 1]], 10, 6);
    // Pupila escura
    mb.addEllipsoid([eyeCenter[0], eyeCenter[1], eyeCenter[2] + 0.0145], [0.0045, 0.0045, 0.003], pupil, [[boneName, 1]], 8, 4);
    // Brilho especular nos olhos (dá vida imediata!)
    mb.addEllipsoid(
      [eyeCenter[0] + 0.0035, eyeCenter[1] + 0.0035, eyeCenter[2] + 0.0165],
      [0.0022, 0.0022, 0.0015],
      [1, 1, 1],
      [[boneName, 1]],
      6,
      4
    );

    const lidTagU: FaceTag = lado === 'left' ? 'upperLidL' : 'upperLidR';
    const lidTagL: FaceTag = lado === 'left' ? 'lowerLidL' : 'lowerLidR';
    const browTag: FaceTag = lado === 'left' ? 'browL' : 'browR';
    const browColor = hexToLinear(spec.hairHex, 0.85);

    // Pálpebra superior (desce no morph 'blink')
    mb.addFaceArcStrip(
      [eyeCenter[0], eyeCenter[1] + 0.016, eyeCenter[2] + 0.015],
      0.017,
      0.007,
      0.004,
      0,
      skinShade,
      lidTagU,
      6,
      3,
      true
    );
    // Pálpebra inferior sutil
    mb.addFaceArcStrip(
      [eyeCenter[0], eyeCenter[1] - 0.014, eyeCenter[2] + 0.014],
      0.016,
      0.005,
      0.003,
      0,
      skinShade,
      lidTagL,
      6,
      2
    );
    // Sobrancelha expressiva
    mb.addFaceArcStrip(
      [eyeCenter[0], eyeCenter[1] + 0.027, eyeCenter[2] + 0.015],
      0.018,
      0.005,
      0.003,
      lado === 'left' ? -0.0015 : 0.0015,
      browColor,
      browTag,
      5,
      2
    );
  }

  // 6. Boca articulada (interior escuro + lábio superior + lábio inferior + queixo)
  const mouthY = headPos[1] + 0.03;
  const mouthZ = 0.091;
  // Interior da boca (fica visível quando a boca abre)
  mb.addEllipsoid([0, mouthY - 0.001, mouthZ - 0.006], [0.02, 0.014, 0.005], mouthInterior, [['head', 1]], 10, 6);
  // Lábio superior (fechado no repouso, sobre o interior)
  mb.addFaceArcStrip([0, mouthY + 0.0025, mouthZ + 0.001], 0.022, 0.007, 0.006, 0, lip, 'upperLip', 8, 3, true);
  // Lábio inferior
  mb.addFaceArcStrip([0, mouthY - 0.003, mouthZ + 0.001], 0.021, 0.007, 0.006, 0, lip, 'lowerLip', 8, 3, false);
  // Região do queixo (acompanha abertura 'aa'/'oh')
  mb.addFaceArcStrip([0, headPos[1] + 0.006, 0.081], 0.028, 0.018, 0.008, 0, skin, 'chin', 6, 3, false);

  // 7. Cabelo por persona
  construirCabelo(mb, spec, headPos, hair, hair2, accent);

  // 8. Barba / Bigode estilizado
  if (spec.facialHair) {
    construirBarba(mb, spec.facialHair, headPos, hair, hair2);
  }

  // 9. Óculos / Acessórios faciais
  if (spec.eyewear) {
    construirOculos(mb, spec.eyewear, headPos, accent);
  }
}

function construirCabelo(
  mb: MeshBuilder,
  spec: PersonaVisualSpec,
  headPos: Vec3,
  hair: Vec3,
  hair2: Vec3,
  accent: Vec3
): void {
  const hy = headPos[1] + 0.088;
  // Calota craniana base
  mb.addEllipsoid([0, hy + 0.022, -0.014], [0.094, 0.086, 0.096], hair, [['head', 1]], 16, 12);

  switch (spec.hairStyle) {
    case 'wavy-bob': {
      // Franja lateral suave + mechas até os ombros (Lia)
      mb.addEllipsoid([-0.036, hy + 0.068, 0.044], [0.056, 0.034, 0.046], hair2, [['head', 1]], 10, 8);
      mb.addEllipsoid([0.044, hy + 0.065, 0.042], [0.048, 0.032, 0.044], hair, [['head', 1]], 10, 8);
      mb.addEllipsoid([0, hy - 0.02, -0.064], [0.095, 0.115, 0.058], hair, [['head', 0.75], ['neck', 0.25]], 12, 10);
      for (const s of [-1, 1]) {
        mb.addEllipsoid([s * 0.082, hy - 0.03, -0.012], [0.032, 0.105, 0.052], hair2, [['head', 0.8], ['neck', 0.2]], 10, 8);
      }
      break;
    }
    case 'wild-tufts': {
      // Tufos divertidos e volumosos no topo e laterais (Prof. Átomo)
      const tufts: Array<{ pos: Vec3; rad: Vec3; col: Vec3 }> = [
        { pos: [0, hy + 0.105, -0.005], rad: [0.065, 0.045, 0.062], col: hair },
        { pos: [-0.085, hy + 0.06, -0.01], rad: [0.045, 0.048, 0.045], col: hair2 },
        { pos: [0.085, hy + 0.06, -0.01], rad: [0.045, 0.048, 0.045], col: hair2 },
        { pos: [-0.105, hy + 0.005, -0.02], rad: [0.04, 0.055, 0.046], col: hair },
        { pos: [0.105, hy + 0.005, -0.02], rad: [0.04, 0.055, 0.046], col: hair },
        { pos: [0, hy + 0.015, -0.082], rad: [0.088, 0.075, 0.046], col: hair2 }
      ];
      for (const t of tufts) {
        mb.addEllipsoid(t.pos, t.rad, t.col, [['head', 1]], 10, 8);
      }
      break;
    }
    case 'victorian-bun': {
      // Coque alto e cachos laterais clássicos (Ada)
      mb.addEllipsoid([0, hy + 0.105, -0.052], [0.054, 0.05, 0.052], hair2, [['head', 1]], 12, 10);
      mb.addEllipsoid([0, hy + 0.01, -0.068], [0.078, 0.07, 0.045], hair, [['head', 1]], 10, 8);
      for (const s of [-1, 1]) {
        mb.addEllipsoid([s * 0.052, hy + 0.062, 0.04], [0.042, 0.032, 0.044], hair, [['head', 1]], 10, 8);
        mb.addEllipsoid([s * 0.086, hy - 0.018, 0.008], [0.028, 0.062, 0.034], hair2, [['head', 1]], 8, 8);
      }
      break;
    }
    case 'swept-back': {
      // Cabelo penteado para trás com têmporas grisalhas (Oswaldo)
      mb.addEllipsoid([0, hy + 0.072, 0.008], [0.084, 0.042, 0.08], hair, [['head', 1]], 12, 8);
      mb.addEllipsoid([0, hy + 0.01, -0.066], [0.082, 0.072, 0.045], hair, [['head', 1]], 10, 8);
      for (const s of [-1, 1]) {
        mb.addEllipsoid([s * 0.085, hy + 0.005, -0.005], [0.022, 0.045, 0.042], hair2, [['head', 1]], 8, 6);
      }
      break;
    }
    case 'short-curly': {
      // Cabelo curto crespo grisalho (Machado)
      mb.addEllipsoid([0, hy + 0.058, 0.002], [0.09, 0.052, 0.086], hair, [['head', 1]], 14, 10);
      for (const s of [-1, 1]) {
        mb.addEllipsoid([s * 0.084, hy + 0.015, -0.005], [0.022, 0.044, 0.045], hair2, [['head', 1]], 8, 6);
      }
      break;
    }
    case 'explorer-waves': {
      // Ondas espessas e costeletas (Humboldt)
      mb.addEllipsoid([0, hy + 0.07, 0.018], [0.09, 0.046, 0.082], hair, [['head', 1]], 12, 8);
      mb.addEllipsoid([0, hy + 0.008, -0.065], [0.088, 0.078, 0.048], hair2, [['head', 1]], 10, 8);
      for (const s of [-1, 1]) {
        mb.addEllipsoid([s * 0.085, hy - 0.015, 0.01], [0.024, 0.052, 0.036], hair, [['head', 1]], 8, 6);
      }
      break;
    }
    case 'classical-headband': {
      // Cabelo ondulado com faixa grega (Heródoto)
      mb.addEllipsoid([0, hy + 0.065, -0.005], [0.094, 0.052, 0.092], hair, [['head', 1]], 12, 10);
      mb.addEllipsoid([0, hy - 0.01, -0.068], [0.09, 0.085, 0.05], hair2, [['head', 1]], 10, 8);
      mb.addEllipsoid([0, hy + 0.042, 0.005], [0.097, 0.014, 0.1], accent, [['head', 1]], 16, 6);
      break;
    }
  }
}

function construirBarba(
  mb: MeshBuilder,
  style: NonNullable<PersonaVisualSpec['facialHair']>,
  headPos: Vec3,
  hair: Vec3,
  hair2: Vec3
): void {
  const cy = headPos[1];
  if (style === 'goatee-mustache') {
    // Bigode volumoso + cavanhaque amigável do Prof. Átomo (diferencia o contorno do queixo)
    for (const s of [-1, 1]) {
      mb.addEllipsoid([s * 0.018, cy + 0.042, 0.096], [0.02, 0.009, 0.01], hair, [['head', 1]], 8, 6);
    }
    mb.addEllipsoid([0, cy - 0.004, 0.076], [0.032, 0.024, 0.024], hair2, [['head', 1]], 10, 8);
  } else if (style === 'handlebar') {
    // Bigode marcante com pontas curvadas de Oswaldo Cruz
    for (const s of [-1, 1]) {
      mb.addEllipsoid([s * 0.02, cy + 0.042, 0.096], [0.022, 0.009, 0.011], hair, [['head', 1]], 8, 6);
      mb.addEllipsoid([s * 0.042, cy + 0.045, 0.088], [0.012, 0.006, 0.007], hair, [['head', 1]], 6, 4);
    }
  } else if (style === 'trimmed-beard') {
    // Barba curta e bigode grisalhos aparados (Machado de Assis)
    for (const s of [-1, 1]) {
      mb.addEllipsoid([s * 0.017, cy + 0.042, 0.095], [0.018, 0.008, 0.009], hair2, [['head', 1]], 8, 6);
    }
    mb.addEllipsoid([0, cy + 0.002, 0.068], [0.056, 0.032, 0.034], hair2, [['head', 1]], 10, 8);
  } else if (style === 'full-classical-beard') {
    // Barba cheia clássica de filósofo/historiador (Heródoto)
    for (const s of [-1, 1]) {
      mb.addEllipsoid([s * 0.019, cy + 0.042, 0.096], [0.021, 0.009, 0.011], hair, [['head', 1]], 8, 6);
    }
    mb.addEllipsoid([0, cy - 0.012, 0.062], [0.068, 0.054, 0.048], hair, [['head', 1]], 12, 10);
    mb.addEllipsoid([0, cy - 0.046, 0.06], [0.046, 0.036, 0.034], hair2, [['head', 1]], 10, 8);
  }
}

function construirOculos(
  mb: MeshBuilder,
  eyewear: NonNullable<PersonaVisualSpec['eyewear']>,
  headPos: Vec3,
  accent: Vec3
): void {
  if (eyewear === 'forehead-goggles') {
    // Óculos de laboratório na testa do Prof. Átomo (aro metálico + lente azulada)
    const gy = headPos[1] + 0.125;
    const gz = 0.086;
    const metal: Vec3 = [0.55, 0.48, 0.25];
    for (const s of [-1, 1]) {
      mb.addEllipsoid([s * 0.036, gy, gz], [0.026, 0.02, 0.014], metal, [['head', 1]], 10, 8);
      mb.addEllipsoid([s * 0.036, gy, gz + 0.006], [0.019, 0.014, 0.01], accent, [['head', 1]], 10, 6);
    }
    mb.addBox([0, gy, gz + 0.003], [0.014, 0.005, 0.006], metal, [['head', 1]]);
    mb.addBox([0, gy, 0], [0.095, 0.008, 0.088], [0.15, 0.12, 0.1], [['head', 1]]);
  } else if (eyewear === 'pince-nez') {
    // Óculos redondos pince-nez sobre os olhos (Oswaldo e Machado)
    const eyeY = headPos[1] + 0.075;
    const eyeZ = 0.108;
    const r = 0.022;
    const thickness = 0.0028;
    for (const s of [-1, 1]) {
      const cx = s * 0.034;
      const segs = 14;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const p0: Vec3 = [cx + Math.cos(a0) * r, eyeY + Math.sin(a0) * r, eyeZ];
        const p1: Vec3 = [cx + Math.cos(a1) * r, eyeY + Math.sin(a1) * r, eyeZ];
        mb.addLimbSegment(p0, p1, [thickness, thickness], [thickness, thickness], accent, accent, 'head', 'head', 1, 5, false, false);
      }
    }
    // Ponte nasal
    mb.addBox([0, eyeY + 0.005, eyeZ], [0.013, 0.0025, 0.0025], accent, [['head', 1]]);
  }
}

/**
 * Gera os deltas `POSITION` (VEC3 FLOAT) para cada uma das 10 expressões VRM 1.0
 * usando as tags semânticas registradas durante a construção do rosto.
 */
function gerarMorphTargets(mb: MeshBuilder): Array<{ name: string; deltas: Float32Array }> {
  const nVerts = mb.vertexCount;
  const zero = () => new Float32Array(nVerts * 3);

  const presets: Array<{ name: string; deltas: Float32Array }> = [
    { name: 'blink', deltas: zero() },
    { name: 'aa', deltas: zero() },
    { name: 'ih', deltas: zero() },
    { name: 'ou', deltas: zero() },
    { name: 'ee', deltas: zero() },
    { name: 'oh', deltas: zero() },
    { name: 'happy', deltas: zero() },
    { name: 'relaxed', deltas: zero() },
    { name: 'surprised', deltas: zero() },
    { name: 'neutral', deltas: zero() }
  ];

  const byName = new Map(presets.map(p => [p.name, p.deltas]));
  const addDelta = (expr: string, idx: number, dx: number, dy: number, dz: number) => {
    const arr = byName.get(expr)!;
    arr[idx * 3] += dx;
    arr[idx * 3 + 1] += dy;
    arr[idx * 3 + 2] += dz;
  };

  for (const [idx, info] of mb.tags.entries()) {
    const { tag, u, v } = info;
    const arch = Math.cos(u * Math.PI * 0.5);

    // blink: fecha as pálpebras sobre os olhos
    if (tag === 'upperLidL' || tag === 'upperLidR') {
      addDelta('blink', idx, 0, -0.023 * v, 0.004 * Math.sin(v * Math.PI));
      addDelta('relaxed', idx, 0, -0.009 * v, 0.002 * v);
      addDelta('happy', idx, 0, -0.004 * v, 0.001 * v);
      addDelta('surprised', idx, 0, 0.004 * v, 0);
    }
    if (tag === 'lowerLidL' || tag === 'lowerLidR') {
      addDelta('blink', idx, 0, 0.005 * v, 0.001 * v);
      addDelta('happy', idx, 0, 0.004 * v, 0.001 * v);
    }

    // Sobrancelhas
    if (tag === 'browL' || tag === 'browR') {
      addDelta('happy', idx, 0, 0.004 * v, 0);
      addDelta('relaxed', idx, 0, -0.003 * v, 0);
      addDelta('surprised', idx, 0, 0.011 * v, 0);
    }

    // Bochechas
    if (tag === 'cheekL' || tag === 'cheekR') {
      addDelta('happy', idx, 0, 0.005 * v, 0.003 * v);
    }

    // Lábio superior
    if (tag === 'upperLip') {
      addDelta('aa', idx, 0, 0.005 * arch * v, 0.002 * v);
      addDelta('ih', idx, u * 0.008 * v, 0.004 * arch * v, 0.001 * v);
      addDelta('ou', idx, -u * 0.009 * v, 0.004 * arch * v, 0.007 * arch * v);
      addDelta('ee', idx, u * 0.01 * v, 0.004 * arch * v + u * u * 0.002 * v, 0.001 * v);
      addDelta('oh', idx, -u * 0.005 * v, 0.005 * arch * v, 0.005 * arch * v);
      addDelta('happy', idx, u * 0.005 * v, u * u * 0.006 * v, 0.002 * v);
      addDelta('relaxed', idx, u * 0.003 * v, u * u * 0.003 * v, 0.001 * v);
      addDelta('surprised', idx, -u * 0.004 * v, 0.004 * arch * v, 0.004 * arch * v);
    }

    // Lábio inferior
    if (tag === 'lowerLip') {
      addDelta('aa', idx, 0, -0.018 * arch * v, -0.001 * v);
      addDelta('ih', idx, u * 0.008 * v, -0.008 * arch * v, 0.001 * v);
      addDelta('ou', idx, -u * 0.009 * v, -0.009 * arch * v, 0.007 * arch * v);
      addDelta('ee', idx, u * 0.01 * v, -0.007 * arch * v + u * u * 0.002 * v, 0.001 * v);
      addDelta('oh', idx, -u * 0.005 * v, -0.014 * arch * v, 0.005 * arch * v);
      addDelta('happy', idx, u * 0.005 * v, u * u * 0.005 * v - 0.002 * arch * v, 0.002 * v);
      addDelta('relaxed', idx, u * 0.003 * v, u * u * 0.002 * v, 0.001 * v);
      addDelta('surprised', idx, -u * 0.004 * v, -0.012 * arch * v, 0.004 * arch * v);
    }

    // Queixo
    if (tag === 'chin') {
      addDelta('aa', idx, 0, -0.01 * arch * v, 0);
      addDelta('oh', idx, 0, -0.007 * arch * v, 0);
      addDelta('surprised', idx, 0, -0.006 * arch * v, 0);
    }
  }

  return presets;
}

function padTo4(n: number): number {
  return (n + 3) & ~3;
}

function construirGlbVrm(spec: PersonaVisualSpec): Buffer {
  const mb = new MeshBuilder();
  construirCorpoBase(mb, spec);
  const morphs = gerarMorphTargets(mb);

  // Construção do buffer BIN único com alinhamento de 4 bytes
  const chunks: Buffer[] = [];
  const bufferViews: Array<{ buffer: number; byteOffset: number; byteLength: number; target?: number }> = [];
  const accessors: Array<Record<string, unknown>> = [];
  let offset = 0;

  const appendView = (data: Buffer, target?: number): number => {
    const viewIdx = bufferViews.length;
    const paddedLen = padTo4(data.byteLength);
    const out = paddedLen === data.byteLength ? data : Buffer.concat([data, Buffer.alloc(paddedLen - data.byteLength)]);
    chunks.push(out);
    const view: { buffer: number; byteOffset: number; byteLength: number; target?: number } = {
      buffer: 0,
      byteOffset: offset,
      byteLength: data.byteLength
    };
    if (target !== undefined) view.target = target;
    bufferViews.push(view);
    offset += paddedLen;
    return viewIdx;
  };

  const computeMinMaxVec3 = (arr: Float32Array): { min: Vec3; max: Vec3 } => {
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (arr[i + k] < min[k]) min[k] = arr[i + k];
        if (arr[i + k] > max[k]) max[k] = arr[i + k];
      }
    }
    return { min, max };
  };

  // Accessors da malha
  const posF32 = new Float32Array(mb.positions);
  const posMM = computeMinMaxVec3(posF32);
  const posView = appendView(Buffer.from(posF32.buffer, posF32.byteOffset, posF32.byteLength), 34962);
  const posAccessor = accessors.length;
  accessors.push({ bufferView: posView, componentType: 5126, count: mb.vertexCount, type: 'VEC3', min: posMM.min, max: posMM.max });

  const normF32 = new Float32Array(mb.normals);
  const normView = appendView(Buffer.from(normF32.buffer, normF32.byteOffset, normF32.byteLength), 34962);
  const normAccessor = accessors.length;
  accessors.push({ bufferView: normView, componentType: 5126, count: mb.vertexCount, type: 'VEC3' });

  const colF32 = new Float32Array(mb.colors);
  const colView = appendView(Buffer.from(colF32.buffer, colF32.byteOffset, colF32.byteLength), 34962);
  const colAccessor = accessors.length;
  accessors.push({ bufferView: colView, componentType: 5126, count: mb.vertexCount, type: 'VEC3' });

  const jntU16 = new Uint16Array(mb.joints);
  const jntView = appendView(Buffer.from(jntU16.buffer, jntU16.byteOffset, jntU16.byteLength), 34962);
  const jntAccessor = accessors.length;
  accessors.push({ bufferView: jntView, componentType: 5123, count: mb.vertexCount, type: 'VEC4' });

  const wgtF32 = new Float32Array(mb.weights);
  const wgtView = appendView(Buffer.from(wgtF32.buffer, wgtF32.byteOffset, wgtF32.byteLength), 34962);
  const wgtAccessor = accessors.length;
  accessors.push({ bufferView: wgtView, componentType: 5126, count: mb.vertexCount, type: 'VEC4' });

  const indU16 = new Uint16Array(mb.indices);
  const indView = appendView(Buffer.from(indU16.buffer, indU16.byteOffset, indU16.byteLength), 34963);
  const indAccessor = accessors.length;
  accessors.push({ bufferView: indView, componentType: 5123, count: mb.indices.length, type: 'SCALAR' });

  // Morph targets
  const targets: Array<{ POSITION: number }> = [];
  for (const m of morphs) {
    const mm = computeMinMaxVec3(m.deltas);
    const mView = appendView(Buffer.from(m.deltas.buffer, m.deltas.byteOffset, m.deltas.byteLength), 34962);
    const mAccessor = accessors.length;
    accessors.push({ bufferView: mView, componentType: 5126, count: mb.vertexCount, type: 'VEC3', min: mm.min, max: mm.max });
    targets.push({ POSITION: mAccessor });
  }

  // Inverse Bind Matrices (55 matrizes MAT4)
  const ibmF32 = new Float32Array(BONE_DEFS.length * 16);
  BONE_DEFS.forEach((b, i) => {
    const wp = WORLD_BONES.get(b.name)!;
    const base = i * 16;
    ibmF32[base + 0] = 1;
    ibmF32[base + 5] = 1;
    ibmF32[base + 10] = 1;
    ibmF32[base + 12] = -wp[0];
    ibmF32[base + 13] = -wp[1];
    ibmF32[base + 14] = -wp[2];
    ibmF32[base + 15] = 1;
  });
  const ibmView = appendView(Buffer.from(ibmF32.buffer, ibmF32.byteOffset, ibmF32.byteLength));
  const ibmAccessor = accessors.length;
  accessors.push({ bufferView: ibmView, componentType: 5126, count: BONE_DEFS.length, type: 'MAT4' });

  // Nós glTF: Node 0 = Root, Nodes 1..55 = Bones, Node 56 = SkinnedMesh
  const boneOffset = 1;
  const meshNodeIndex = boneOffset + BONE_DEFS.length;
  const childrenByParent = new Map<string, number[]>();
  BONE_DEFS.forEach((b, i) => {
    if (b.parent) {
      const list = childrenByParent.get(b.parent) ?? [];
      list.push(boneOffset + i);
      childrenByParent.set(b.parent, list);
    }
  });

  const nodes: Array<Record<string, unknown>> = [
    { name: 'Root', children: [boneOffset, meshNodeIndex] }
  ];

  const humanBones: Record<string, { node: number }> = {};
  BONE_DEFS.forEach((b, i) => {
    const nodeIdx = boneOffset + i;
    humanBones[b.name] = { node: nodeIdx };
    const nodeObj: Record<string, unknown> = {
      name: b.name,
      translation: b.localTranslation
    };
    const kids = childrenByParent.get(b.name);
    if (kids && kids.length > 0) nodeObj.children = kids;
    nodes.push(nodeObj);
  });

  nodes.push({
    name: 'AvatarBody',
    mesh: 0,
    skin: 0
  });

  const presetExpressions: Record<string, unknown> = {};
  morphs.forEach((m, morphIdx) => {
    presetExpressions[m.name] = {
      morphTargetBinds: [{ node: meshNodeIndex, index: morphIdx, weight: 1 }],
      isBinary: false,
      overrideBlink: 'none',
      overrideLookAt: 'none',
      overrideMouth: 'none'
    };
  });

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'TutorIA VRM Generator 1.0'
    },
    extensionsUsed: ['VRMC_vrm'],
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes,
    skins: [
      {
        name: 'AvatarSkin',
        joints: BONE_DEFS.map((_, i) => boneOffset + i),
        inverseBindMatrices: ibmAccessor,
        skeleton: boneOffset
      }
    ],
    materials: [
      {
        name: 'StylizedMaterial',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.04,
          roughnessFactor: 0.68
        }
      }
    ],
    meshes: [
      {
        name: 'AvatarMesh',
        primitives: [
          {
            attributes: {
              POSITION: posAccessor,
              NORMAL: normAccessor,
              COLOR_0: colAccessor,
              JOINTS_0: jntAccessor,
              WEIGHTS_0: wgtAccessor
            },
            indices: indAccessor,
            material: 0,
            targets
          }
        ],
        extras: {
          targetNames: morphs.map(m => m.name)
        }
      }
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
    extensions: {
      VRMC_vrm: {
        specVersion: '1.0',
        meta: {
          name: spec.nomeExibido,
          version: '1.0',
          authors: ['TutorIA'],
          copyrightInformation: 'TutorIA (Projeto Educacional)',
          licenseUrl: 'https://vrm.dev/licenses/1.0/',
          avatarPermission: 'everyone',
          allowExcessivelyViolentUsage: false,
          allowExcessivelySexualUsage: false,
          commercialUsage: 'corporation',
          allowPoliticalOrReligiousUsage: false,
          allowAntisocialOrHateUsage: false,
          creditNotation: 'optional',
          allowRedistribution: true,
          modification: 'allowModificationRedistribution'
        },
        humanoid: {
          humanBones
        },
        lookAt: {
          offsetFromHeadBone: [0, 0.075, 0],
          type: 'bone',
          rangeMapHorizontalInner: { inputMaxValue: 90, outputScale: 10 },
          rangeMapHorizontalOuter: { inputMaxValue: 90, outputScale: 12 },
          rangeMapVerticalDown: { inputMaxValue: 90, outputScale: 10 },
          rangeMapVerticalUp: { inputMaxValue: 90, outputScale: 10 }
        },
        expressions: {
          preset: presetExpressions
        }
      }
    }
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPaddedLen = padTo4(jsonRaw.byteLength);
  const jsonBuf =
    jsonPaddedLen === jsonRaw.byteLength
      ? jsonRaw
      : Buffer.concat([jsonRaw, Buffer.from(' '.repeat(jsonPaddedLen - jsonRaw.byteLength), 'utf8')]);

  const binBuf = Buffer.concat(chunks);
  const totalLen = 12 + 8 + jsonBuf.byteLength + 8 + binBuf.byteLength;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuf.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuf.byteLength, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

  return Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuf]);
}

function main(): void {
  const outDir = path.resolve(process.cwd(), 'public/avatar/personas');
  fs.mkdirSync(outDir, { recursive: true });

  for (const spec of PERSONA_SPECS) {
    const glb = construirGlbVrm(spec);
    const destino = path.join(outDir, `${spec.id}.vrm`);
    fs.writeFileSync(destino, glb);

    const jsonLen = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
    const triCount = json.accessors[json.meshes[0].primitives[0].indices].count / 3;
    const kb = (glb.byteLength / 1024).toFixed(1);
    console.log(`Gerado ${spec.id}.vrm (${kb} KB, ${triCount} triângulos)`);
  }
}

main();
