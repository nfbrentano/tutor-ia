/**
 * TUTORIA - Suavização das rotações gravadas (RF05)
 * Filtro One Euro (Casiez et al., 2012) aplicado às componentes do quatérnio.
 */

import { OssoGravado, Quat, QuadroGravado, RotacoesQuadro } from './tipos';

class FiltroOneEuro {
  private valorAnterior: number | null = null;
  private derivadaAnterior = 0;

  constructor(
    private minCorte: number,
    private beta: number,
    private corteDerivada = 1
  ) {}

  private static alfa(corte: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * corte);
    return 1 / (1 + tau / dt);
  }

  filtrar(valor: number, dt: number): number {
    if (this.valorAnterior === null || dt <= 0) {
      this.valorAnterior = valor;
      return valor;
    }
    const derivada = (valor - this.valorAnterior) / dt;
    const aD = FiltroOneEuro.alfa(this.corteDerivada, dt);
    this.derivadaAnterior = aD * derivada + (1 - aD) * this.derivadaAnterior;
    const corte = this.minCorte + this.beta * Math.abs(this.derivadaAnterior);
    const a = FiltroOneEuro.alfa(corte, dt);
    this.valorAnterior = a * valor + (1 - a) * this.valorAnterior;
    return this.valorAnterior;
  }
}

function normalizar(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

/** Ângulo em graus entre dois quatérnios. */
export function anguloEntre(a: Quat, b: Quat): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

export function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (dot > 0.9995) {
    return normalizar([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
  }
  const theta = Math.acos(dot);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
}

/**
 * Suaviza rotações quadro a quadro. `suavidade` de 0 (responsivo) a 1 (suave).
 * Mantém a última rotação válida dos ossos ausentes no quadro (RF05).
 */
export class SuavizadorRotacoes {
  private filtros = new Map<string, FiltroOneEuro[]>();
  private anteriores: RotacoesQuadro = {};
  private minCorte: number;
  private beta: number;

  constructor(suavidade = 0.5) {
    const s = Math.max(0, Math.min(1, suavidade));
    this.minCorte = 3 - s * 2.6; // 3 Hz (responsivo) a 0,4 Hz (suave)
    this.beta = 0.6 - s * 0.5;
  }

  filtrar(rotacoes: RotacoesQuadro, dt: number): RotacoesQuadro {
    const saida: RotacoesQuadro = { ...this.anteriores };
    for (const [osso, q] of Object.entries(rotacoes) as Array<[OssoGravado, Quat]>) {
      const anterior = this.anteriores[osso];
      // Mesmo hemisfério do quadro anterior: q e -q são a mesma rotação
      let alvo = q;
      if (anterior && anterior[0] * q[0] + anterior[1] * q[1] + anterior[2] * q[2] + anterior[3] * q[3] < 0) {
        alvo = [-q[0], -q[1], -q[2], -q[3]];
      }
      let filtros = this.filtros.get(osso);
      if (!filtros) {
        filtros = [0, 1, 2, 3].map(() => new FiltroOneEuro(this.minCorte, this.beta));
        this.filtros.set(osso, filtros);
      }
      saida[osso] = normalizar(alvo.map((v, i) => filtros![i].filtrar(v, dt)) as Quat);
    }
    this.anteriores = saida;
    return saida;
  }
}

/**
 * Marca falhas longas: trechos com mais de `limiteSeg` sem corpo detectado (CA07).
 */
export function trechosDeFalha(quadros: QuadroGravado[], limiteSeg = 0.5): Array<[number, number]> {
  const trechos: Array<[number, number]> = [];
  let inicio: number | null = null;
  quadros.forEach((q, i) => {
    if (q.falha && inicio === null) inicio = q.t;
    const fim = !q.falha || i === quadros.length - 1;
    if (fim && inicio !== null) {
      const t = q.falha ? q.t : quadros[i - 1].t;
      if (t - inicio >= limiteSeg) trechos.push([inicio, t]);
      inicio = null;
    }
  });
  return trechos;
}
