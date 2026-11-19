/**
 * TUTORIA - Plugin do Vite (só em `npm run dev`) para o gravador de gestos salvar clipes (RF09)
 * Spec: SDD/2026-10-23_gravador-de-gestos.md
 *
 * POST /__gravador/salvar { nome, clipe } grava public/avatar/animacoes/<nome>.json e acrescenta
 * a entrada no manifesto.json. Nada é escrito fora dessa pasta.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';

const PASTA_ANIMACOES = path.join('public', 'avatar', 'animacoes');
const CATEGORIAS = ['idle', 'listening', 'thinking', 'speaking', 'apontar', 'cumprimentar'];
const TAMANHO_MAXIMO_CORPO = 1024 * 1024;

export class ErroGravador extends Error {}

interface ClipeRecebido {
  formato?: unknown;
  categoria?: unknown;
  loop?: unknown;
  personas?: unknown;
}

/**
 * Grava o clipe e atualiza o manifesto. Lança ErroGravador para nomes ou conteúdos inválidos (CA13).
 */
export function salvarClipeNoProjeto(raizProjeto: string, nome: unknown, clipe: unknown): string {
  if (typeof nome !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nome) || nome.length > 60) {
    throw new ErroGravador('Nome inválido: use só letras minúsculas, números e hífens.');
  }
  const c = clipe as ClipeRecebido | null;
  if (!c || c.formato !== 'tutoria-clipe-vrm' || typeof c.categoria !== 'string' || !CATEGORIAS.includes(c.categoria)) {
    throw new ErroGravador('Clipe inválido.');
  }

  const pasta = path.resolve(raizProjeto, PASTA_ANIMACOES);
  const arquivo = `${nome}.json`;
  const destino = path.resolve(pasta, arquivo);
  if (path.dirname(destino) !== pasta) {
    throw new ErroGravador('Caminho inválido.');
  }

  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(clipe));

  const caminhoManifesto = path.join(pasta, 'manifesto.json');
  let manifesto: { clipes: Array<Record<string, unknown>> } = { clipes: [] };
  if (fs.existsSync(caminhoManifesto)) {
    const lido = JSON.parse(fs.readFileSync(caminhoManifesto, 'utf8'));
    if (Array.isArray(lido?.clipes)) manifesto = lido;
  }

  const entrada: Record<string, unknown> = { arquivo, categoria: c.categoria };
  if (c.loop === false) entrada.loop = false;
  if (Array.isArray(c.personas) && c.personas.length > 0) entrada.personas = c.personas;

  manifesto.clipes = [...manifesto.clipes.filter(item => item.arquivo !== arquivo), entrada];
  fs.writeFileSync(caminhoManifesto, JSON.stringify(manifesto, null, 2) + '\n');
  return path.join(PASTA_ANIMACOES, arquivo);
}

export function pluginGravador(): Plugin {
  return {
    name: 'tutoria-gravador',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__gravador/salvar', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let corpo = '';
        let excedeu = false;
        req.on('data', (parte: Buffer) => {
          corpo += parte.toString('utf8');
          if (corpo.length > TAMANHO_MAXIMO_CORPO) {
            excedeu = true;
            req.destroy();
          }
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          if (excedeu) {
            res.statusCode = 413;
            res.end(JSON.stringify({ erro: 'Clipe grande demais.' }));
            return;
          }
          try {
            const { nome, clipe } = JSON.parse(corpo);
            const salvo = salvarClipeNoProjeto(server.config.root, nome, clipe);
            res.end(JSON.stringify({ salvo }));
          } catch (err) {
            res.statusCode = err instanceof ErroGravador ? 400 : 500;
            res.end(JSON.stringify({ erro: err instanceof Error ? err.message : 'Erro ao salvar.' }));
          }
        });
      });
    }
  };
}
