/**
 * TUTORIA - Cabeça holográfica flutuante (SDD/2026-11-20_avatar-cabeca-holografica.md)
 *
 * Reaproveita os VRM das personas mostrando só a cabeça:
 * - o shader do material existente ganha brilho de borda, linhas de varredura e a dissolução
 *   pontilhada do pescoço (RF02, RF03), injetados via `onBeforeCompile` (RNF01);
 * - os braços são recolhidos pela escala dos ossos crus, que o rig do VRM não sobrescreve,
 *   então nenhuma mão aparece mesmo quando um clipe leva a mão ao rosto (CA03);
 * - a câmera enquadra a caixa real dos vértices da cabeça (RF01).
 */

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/** Uniforms compartilhados por todos os materiais do modelo (mesma referência = atualização única). */
export interface UniformsHolograma {
  uCorHolo: { value: THREE.Color };
  uTempoHolo: { value: number };
  /** Altura (mundo) da base do pescoço: abaixo dela nada é desenhado. */
  uCorteY: { value: number };
  /** Altura da faixa de dissolução acima do corte. */
  uFaixaCorte: { value: number };
  /** Altura (mundo) da faixa de luz que varre a cabeça de cima para baixo. */
  uVarreduraY: { value: number };
  /** Multiplicador de brilho (cintilação ocasional). */
  uBrilhoHolo: { value: number };
}

export function criarUniformsHolograma(corHex: string): UniformsHolograma {
  return {
    uCorHolo: { value: new THREE.Color(corHex) },
    uTempoHolo: { value: 0 },
    uCorteY: { value: -100 },
    uFaixaCorte: { value: 0.05 },
    uVarreduraY: { value: -100 },
    uBrilhoHolo: { value: 1 }
  };
}

const MARCA_SHADER = 'TUTORIA_HOLOGRAMA';

const DECLARACOES_VERTEX = /* glsl */ `
varying vec3 vPosMundoHolo;`;

const CALCULO_VERTEX = /* glsl */ `
vPosMundoHolo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`;

const DECLARACOES_FRAGMENT = /* glsl */ `
// ${MARCA_SHADER}
varying vec3 vPosMundoHolo;
uniform vec3 uCorHolo;
uniform float uTempoHolo;
uniform float uCorteY;
uniform float uFaixaCorte;
uniform float uVarreduraY;
uniform float uBrilhoHolo;
float ruidoHolo( vec2 p ) {
  return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}`;

/** Descarta o corpo e dissolve o pescoço em pontos que cintilam (efeito de projeção). */
const DISSOLUCAO_FRAGMENT = /* glsl */ `
float presencaHolo = smoothstep( uCorteY, uCorteY + uFaixaCorte, vPosMundoHolo.y );
if ( presencaHolo < 0.999 ) {
  float sorteioHolo = ruidoHolo( floor( gl_FragCoord.xy ) + floor( uTempoHolo * 18.0 ) );
  if ( presencaHolo <= sorteioHolo ) discard;
}`;

/** Tinge com a cor da persona preservando a luminância do rosto, soma borda e varredura. */
const ACABAMENTO_FRAGMENT = /* glsl */ `
{
  vec3 baseHolo = gl_FragColor.rgb;
  float lumaHolo = dot( baseHolo, vec3( 0.299, 0.587, 0.114 ) );
  vec3 corHolo = mix( baseHolo, uCorHolo * ( lumaHolo * 2.2 + 0.04 ), 0.28 );
  vec3 dirVistaHolo = normalize( vViewPosition );
  float bordaHolo = pow( 1.0 - clamp( abs( dot( normalize( normal ), dirVistaHolo ) ), 0.0, 1.0 ), 2.2 );
  float linhasHolo = smoothstep( 0.55, 1.0, 0.5 + 0.5 * sin( vPosMundoHolo.y * 1400.0 - uTempoHolo * 3.0 ) );
  float varreduraHolo = exp( -pow( ( vPosMundoHolo.y - uVarreduraY ) * 38.0, 2.0 ) );
  float baseBrilhoHolo = 1.0 - smoothstep( uCorteY, uCorteY + uFaixaCorte * 1.6, vPosMundoHolo.y );
  corHolo += uCorHolo * ( bordaHolo * 0.65 + linhasHolo * 0.05 + varreduraHolo * 0.3 + baseBrilhoHolo * 0.6 );
  gl_FragColor.rgb = corHolo * uBrilhoHolo;
}`;

export interface ShaderEditavel {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
}

/**
 * Injeta o efeito holográfico num shader de MeshStandardMaterial/MeshPhysicalMaterial.
 * Retorna false (e não altera nada) se o shader não tiver os trechos esperados, por exemplo
 * num material MToon: o modelo continua visível, só sem o efeito.
 */
export function injetarShaderHolografico(shader: ShaderEditavel, uniforms: UniformsHolograma): boolean {
  const { vertexShader, fragmentShader } = shader;
  const temTrechos =
    vertexShader.includes('#include <project_vertex>') &&
    vertexShader.includes('void main() {') &&
    fragmentShader.includes('#include <clipping_planes_fragment>') &&
    fragmentShader.includes('#include <opaque_fragment>') &&
    fragmentShader.includes('vViewPosition') &&
    fragmentShader.includes('#include <normal_fragment_begin>');
  if (!temTrechos || fragmentShader.includes(MARCA_SHADER)) return false;

  shader.vertexShader = vertexShader
    .replace('void main() {', `${DECLARACOES_VERTEX}\nvoid main() {`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${CALCULO_VERTEX}`);

  shader.fragmentShader = fragmentShader
    .replace('void main() {', `${DECLARACOES_FRAGMENT}\nvoid main() {`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DISSOLUCAO_FRAGMENT}`)
    .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${ACABAMENTO_FRAGMENT}`);

  Object.assign(shader.uniforms, uniforms);
  return true;
}

/** Aplica o shader holográfico a todos os materiais do modelo (uma vez por material). */
export function aplicarMaterialHolografico(raiz: THREE.Object3D, uniforms: UniformsHolograma): void {
  raiz.traverse(obj => {
    const malha = obj as THREE.Mesh;
    if (!malha.isMesh || !malha.material) return;
    const materiais = Array.isArray(malha.material) ? malha.material : [malha.material];
    for (const material of materiais) {
      // Modelos em cache já foram preparados; só atualiza a referência dos uniforms
      material.userData.uniformsHolograma = uniforms;
      if (material.userData.holografico) continue;
      material.userData.holografico = true;
      material.onBeforeCompile = shader => {
        injetarShaderHolografico(shader as unknown as ShaderEditavel, material.userData.uniformsHolograma);
      };
      material.customProgramCacheKey = () => MARCA_SHADER;
      material.needsUpdate = true;
    }
  });
}

const OSSOS_BRACO = ['leftUpperArm', 'rightUpperArm'] as const;
const ESCALA_RECOLHIDA = 1e-4;

/**
 * Recolhe os braços no ombro (abaixo do corte do pescoço). O rig normalizado do VRM só
 * copia rotações para os ossos crus, então a escala persiste mesmo com clipes tocando.
 */
export function recolherBracos(vrm: VRM, recolher = true): void {
  for (const osso of OSSOS_BRACO) {
    const no = vrm.humanoid?.getRawBoneNode(osso);
    if (no) no.scale.setScalar(recolher ? ESCALA_RECOLHIDA : 1);
  }
}

export interface MedidasPescoco {
  /** Altura (mundo) da base do pescoço. */
  baseY: number;
  /** Distância vertical entre a base do pescoço e a base do crânio. */
  comprimento: number;
}

export function medirPescoco(vrm: VRM): MedidasPescoco | null {
  const pescoco = vrm.humanoid?.getRawBoneNode('neck');
  const cabeca = vrm.humanoid?.getRawBoneNode('head');
  if (!pescoco || !cabeca) return null;
  const pP = pescoco.getWorldPosition(new THREE.Vector3());
  const pC = cabeca.getWorldPosition(new THREE.Vector3());
  return { baseY: pP.y, comprimento: Math.max(0.02, pC.y - pP.y) };
}

/**
 * Caixa (mundo) dos vértices acima de `corteY`, já com a pose de pele aplicada.
 * Retorna null se não houver vértices acima do corte.
 */
export function medirCaixaCabeca(raiz: THREE.Object3D, corteY: number): THREE.Box3 | null {
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3();
  const v = new THREE.Vector3();
  raiz.traverse(obj => {
    const malha = obj as THREE.Mesh;
    const posicoes = malha.isMesh ? malha.geometry?.getAttribute('position') : undefined;
    if (!posicoes) return;
    for (let i = 0; i < posicoes.count; i++) {
      malha.getVertexPosition(i, v);
      malha.localToWorld(v);
      if (v.y >= corteY) caixa.expandByPoint(v);
    }
  });
  return caixa.isEmpty() ? null : caixa;
}

export interface Enquadramento {
  posicao: { x: number; y: number; z: number };
  alvo: { x: number; y: number; z: number };
}

/**
 * Posiciona a câmera para que a caixa caiba no quadro com margem (RF01). A mira fica levemente
 * acima do centro: a cabeça desce um pouco e o pescoço dissolvido aponta para a base emissora.
 */
export function calcularEnquadramentoCabeca(
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  fovVerticalGraus: number,
  aspecto: number,
  margem = 1.45
): Enquadramento {
  const centro = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const altura = Math.max(0.01, max.y - min.y);
  const largura = Math.max(0.01, max.x - min.x);
  const profundidade = Math.max(0, max.z - min.z);
  const tanMeioFov = Math.tan(THREE.MathUtils.degToRad(fovVerticalGraus) / 2);
  const aspectoSeguro = aspecto > 0 && Number.isFinite(aspecto) ? aspecto : 1;

  const distPorAltura = altura / 2 / tanMeioFov;
  const distPorLargura = largura / 2 / (tanMeioFov * aspectoSeguro);
  const distancia = Math.max(distPorAltura, distPorLargura) * margem + profundidade / 2;

  const alvoY = centro.y + altura * 0.02;
  return {
    posicao: { x: centro.x, y: alvoY + altura * 0.04, z: centro.z + distancia },
    alvo: { x: centro.x, y: alvoY, z: centro.z }
  };
}

/** Deslocamento de flutuação (m) e rolagem (rad) da cabeça no tempo t (s). */
export function calcularFlutuacao(t: number): { y: number; rolagem: number } {
  return {
    y: Math.sin(t * 0.9) * 0.012 + Math.sin(t * 2.3) * 0.003,
    rolagem: Math.sin(t * 0.55) * 0.02
  };
}

/** Posição da faixa de varredura: desce pela cabeça em 2,2 s a cada ciclo de 7 s. */
export function calcularVarredura(t: number, topoY: number, baseY: number): number {
  const ciclo = 7;
  const duracao = 2.2;
  const fase = t % ciclo;
  if (fase > duracao) return -100;
  return topoY - (topoY - baseY) * (fase / duracao);
}
