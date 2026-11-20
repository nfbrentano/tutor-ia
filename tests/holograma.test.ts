/**
 * Testes da cabeça holográfica (SDD/2026-11-20_avatar-cabeca-holografica.md)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  calcularEnquadramentoCabeca,
  calcularFlutuacao,
  calcularVarredura,
  criarUniformsHolograma,
  injetarShaderHolografico,
  ShaderEditavel
} from '../src/avatar3d/holograma';
import { CONFIG_AVATAR_3D_PADRAO } from '../src/avatar3d/tipos';

function shaderPadrao(): ShaderEditavel {
  return {
    vertexShader: 'varying vec3 vViewPosition;\nvoid main() {\n#include <skinning_vertex>\n#include <project_vertex>\n}',
    fragmentShader:
      'varying vec3 vViewPosition;\nvoid main() {\n#include <clipping_planes_fragment>\n#include <normal_fragment_begin>\n#include <opaque_fragment>\n#include <tonemapping_fragment>\n}',
    uniforms: {}
  };
}

describe('Cabeça holográfica', () => {
  it('CT01: o modo cabeça é o padrão do avatar 3D', () => {
    expect(CONFIG_AVATAR_3D_PADRAO.apenasCabeca).toBe(true);
  });

  it('injeta dissolução, acabamento e uniforms num shader padrão do three', () => {
    const shader = shaderPadrao();
    const uniforms = criarUniformsHolograma('#a855f7');
    expect(injetarShaderHolografico(shader, uniforms)).toBe(true);

    expect(shader.vertexShader).toContain('vPosMundoHolo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    // A posição de mundo é calculada depois da pele (project_vertex), senão o corte não acompanha a pose
    expect(shader.vertexShader.indexOf('vPosMundoHolo =')).toBeGreaterThan(shader.vertexShader.indexOf('#include <project_vertex>'));
    // O descarte vem logo no início do fragment, antes da iluminação
    expect(shader.fragmentShader.indexOf('discard')).toBeLessThan(shader.fragmentShader.indexOf('#include <normal_fragment_begin>'));
    expect(shader.fragmentShader.indexOf('gl_FragColor.rgb = corHolo')).toBeGreaterThan(
      shader.fragmentShader.indexOf('#include <opaque_fragment>')
    );
    expect(shader.uniforms.uCorHolo).toBe(uniforms.uCorHolo);
    expect(shader.uniforms.uCorteY).toBe(uniforms.uCorteY);
  });

  it('não altera shaders sem os trechos esperados (ex.: MToon) nem injeta duas vezes', () => {
    const mtoon: ShaderEditavel = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}', uniforms: {} };
    expect(injetarShaderHolografico(mtoon, criarUniformsHolograma('#fff'))).toBe(false);
    expect(mtoon.fragmentShader).toBe('void main() {}');

    const shader = shaderPadrao();
    const uniforms = criarUniformsHolograma('#fff');
    injetarShaderHolografico(shader, uniforms);
    const primeiraVez = shader.fragmentShader;
    expect(injetarShaderHolografico(shader, uniforms)).toBe(false);
    expect(shader.fragmentShader).toBe(primeiraVez);
  });

  it('CA01: o enquadramento faz a cabeça caber no quadro com margem, em qualquer proporção', () => {
    const min = { x: -0.12, y: 1.38, z: -0.12 };
    const max = { x: 0.12, y: 1.68, z: 0.12 };
    for (const aspecto of [0.6, 0.88, 1.5]) {
      const { posicao, alvo } = calcularEnquadramentoCabeca(min, max, 24, aspecto);
      const distancia = posicao.z - alvo.z;
      const meiaAlturaVisivel = Math.tan((24 * Math.PI) / 360) * (distancia - 0.12);
      const meiaLarguraVisivel = meiaAlturaVisivel * aspecto;
      expect(meiaAlturaVisivel).toBeGreaterThan((max.y - min.y) / 2);
      expect(meiaLarguraVisivel).toBeGreaterThan((max.x - min.x) / 2);
      expect(alvo.x).toBeCloseTo(0);
    }
  });

  it('enquadramento é seguro com aspecto inválido', () => {
    const r = calcularEnquadramentoCabeca({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 24, NaN);
    expect(Number.isFinite(r.posicao.z)).toBe(true);
  });

  it('RF04: flutuação é sutil (≤ 2 cm, ≤ 2°)', () => {
    for (let t = 0; t < 30; t += 0.37) {
      const { y, rolagem } = calcularFlutuacao(t);
      expect(Math.abs(y)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(rolagem)).toBeLessThanOrEqual(0.035);
    }
  });

  it('a varredura desce do topo à base e some fora da janela do ciclo', () => {
    expect(calcularVarredura(0, 1.7, 1.4)).toBeCloseTo(1.7);
    expect(calcularVarredura(1.1, 1.7, 1.4)).toBeCloseTo(1.55);
    expect(calcularVarredura(5, 1.7, 1.4)).toBe(-100);
  });

  it('CT06 / CA08: o SVG do plano B tem só a cabeça (sem tronco nem braços) e mantém boca e olhos', () => {
    const html = readFileSync(resolve(__dirname, '../tutor.html'), 'utf-8');
    const svg = html.slice(html.indexOf('<svg class="avatar-svg"'), html.indexOf('</svg>', html.indexOf('<svg class="avatar-svg"')));
    expect(svg).not.toMatch(/avatar-torso|arm-left|arm-right|avatar-neck|chest-core/);
    expect(svg).toContain('id="avatar-mouth"');
    expect(svg).toContain('avatar-eye');
    expect(html).toMatch(/class="holo-tubo" aria-hidden="true"/);
    expect(html).toMatch(/class="holo-tubo-vidro" aria-hidden="true"/);
  });
});
