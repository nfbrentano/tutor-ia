/**
 * TUTORIA - Gerador de Ícones PNG para PWA (192x192 e 512x512)
 * Gera PNGs RGBA válidos com fundo escuro, aro ciano e emblema minimalista do TutorIA.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function criarChunkPng(tipo: string, dados: Buffer): Buffer {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dados.length, 0);
  const crcInput = Buffer.concat([tipoBuf, dados]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, tipoBuf, dados, crcBuf]);
}

function dentroRoundedRect(x: number, y: number, rx0: number, ry0: number, rw: number, rh: number, r: number): boolean {
  if (x < rx0 || x > rx0 + rw || y < ry0 || y > ry0 + rh) return false;
  const cx = Math.min(Math.max(x, rx0 + r), rx0 + rw - r);
  const cy = Math.min(Math.max(y, ry0 + r), ry0 + rh - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function renderizarIconePng(tamanho: number): Buffer {
  const stride = 1 + tamanho * 4;
  const raw = Buffer.alloc(stride * tamanho);
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const raio = tamanho * 0.42;

  for (let y = 0; y < tamanho; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter none

    for (let x = 0; x < tamanho; x++) {
      const px = rowStart + 1 + x * 4;
      const nx = x / tamanho;
      const ny = y / tamanho;

      // Fundo arredondado #0f172a -> gradiente sutil #1e293b
      const dentroBase = dentroRoundedRect(x, y, 0, 0, tamanho - 1, tamanho - 1, tamanho * 0.22);
      if (!dentroBase) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      let r = Math.round(15 + (nx + ny) * 8);
      let g = Math.round(23 + (nx + ny) * 10);
      let b = Math.round(42 + (nx + ny) * 14);

      const distCentro = Math.hypot(x - cx, y - cy);

      // Aro luminoso #38bdf8
      if (Math.abs(distCentro - raio) <= tamanho * 0.028) {
        r = 56;
        g = 189;
        b = 248;
      }

      // Cabeça estilizada do tutor
      const dentroCabeca = dentroRoundedRect(
        x,
        y,
        tamanho * 0.25,
        tamanho * 0.28,
        tamanho * 0.5,
        tamanho * 0.46,
        tamanho * 0.12
      );
      if (dentroCabeca) {
        r = 30;
        g = 41;
        b = 59;
      }

      // Visor interno #080d1a
      const dentroVisor = dentroRoundedRect(
        x,
        y,
        tamanho * 0.3,
        tamanho * 0.34,
        tamanho * 0.4,
        tamanho * 0.34,
        tamanho * 0.08
      );
      if (dentroVisor) {
        r = 8;
        g = 13;
        b = 26;
      }

      // Antena superior
      if (
        (Math.abs(x - cx) <= tamanho * 0.018 && y >= tamanho * 0.18 && y <= tamanho * 0.28) ||
        Math.hypot(x - cx, y - tamanho * 0.16) <= tamanho * 0.036
      ) {
        r = 56;
        g = 189;
        b = 248;
      }

      // Olhos ciano #38bdf8
      const olhoEsq = Math.hypot(x - tamanho * 0.41, y - tamanho * 0.46) <= tamanho * 0.042;
      const olhoDir = Math.hypot(x - tamanho * 0.59, y - tamanho * 0.46) <= tamanho * 0.042;
      if (olhoEsq || olhoDir) {
        r = 56;
        g = 189;
        b = 248;
      }

      // Barra de sorriso / voz
      if (dentroRoundedRect(x, y, tamanho * 0.39, tamanho * 0.57, tamanho * 0.22, tamanho * 0.045, tamanho * 0.02)) {
        r = 125;
        g = 211;
        b = 252;
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    assinatura,
    criarChunkPng('IHDR', ihdr),
    criarChunkPng('IDAT', compressed),
    criarChunkPng('IEND', Buffer.alloc(0))
  ]);
}

const dirIcons = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(dirIcons, { recursive: true });
for (const size of [192, 512]) {
  const destino = path.join(dirIcons, `icon-${size}.png`);
  fs.writeFileSync(destino, renderizarIconePng(size));
  console.log(`✅ Ícone PWA criado: ${destino}`);
}
