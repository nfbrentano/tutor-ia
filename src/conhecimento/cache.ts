/**
 * TUTORIA - Gerenciador de Cache de Respostas (Pré-construído e IndexedDB)
 * (RF07, RF08, RNF06, CA07, CA08, CA09)
 */

import { RespostaDidatica } from '../lousa/tipos';
import { normalizarFrase, normalizarTexto } from './normalizador';
import { ItemCacheResposta } from './tipos';

const DB_NAME = 'tutoria_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'respostas_execucao';
export const LIMITE_MAX_CACHE_EXECUCAO = 200;
export const LIMIAR_SIMILARIDADE_CACHE = 0.65;

/**
 * Calcula índice de similaridade entre duas listas de tokens combinando Jaccard e cobertura.
 */
export function calcularSimilaridadeTokens(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersecao = 0;
  for (const t of setA) {
    if (setB.has(t)) intersecao++;
  }

  const uniao = setA.size + setB.size - intersecao;
  if (uniao === 0) return 0;

  const jaccard = intersecao / uniao;
  const cobertura = intersecao / Math.min(setA.size, setB.size);
  return (jaccard * 0.4) + (cobertura * 0.6);
}

export class GerenciadorCacheConhecimento {
  private cachePreConstruido: Map<string, ItemCacheResposta> = new Map();
  private itensPreConstruidos: ItemCacheResposta[] = [];
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    this.iniciarDb();
  }

  /**
   * Inicializa o IndexedDB para o cache de execução.
   */
  private iniciarDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (event: any) => {
            const db: IDBDatabase = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, { keyPath: 'perguntaNormalizada' });
              store.createIndex('criadoEm', 'criadoEm', { unique: false });
            }
          };
          request.onsuccess = (event: any) => {
            resolve(event.target.result);
          };
          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  /**
   * Alimenta a memória com o cache pré-construído (RF07).
   */
  carregarCachePreConstruido(itens: ItemCacheResposta[]): void {
    this.itensPreConstruidos = itens || [];
    this.cachePreConstruido.clear();
    for (const item of this.itensPreConstruidos) {
      const chave = item.perguntaNormalizada || normalizarFrase(item.pergunta);
      this.cachePreConstruido.set(chave, item);
    }
  }

  /**
   * Procura uma resposta compatível no cache pré-construído ou no IndexedDB.
   * Responde em <= 300ms offline (RF07, RF08, RNF06, CA07, CA08, CA09).
   */
  async buscarEmCache(pergunta: string): Promise<RespostaDidatica | null> {
    const limpa = pergunta.trim();
    if (!limpa) return null;

    const chaveNormalizada = normalizarFrase(limpa);
    if (!chaveNormalizada) return null;

    // 1. Busca exata no cache pré-construído
    const exataPre = this.cachePreConstruido.get(chaveNormalizada);
    if (exataPre) {
      return exataPre.resposta;
    }

    // 2. Busca por similaridade semântica/tokens no cache pré-construído (RF07, CA07)
    const tokensConsulta = normalizarTexto(limpa);
    if (tokensConsulta.length > 0) {
      let melhorItem: ItemCacheResposta | null = null;
      let melhorScore = 0;

      for (const item of this.itensPreConstruidos) {
        const tokensItem = normalizarTexto(item.pergunta);
        const score = calcularSimilaridadeTokens(tokensConsulta, tokensItem);
        if (score > melhorScore) {
          melhorScore = score;
          melhorItem = item;
        }
      }

      if (melhorItem && melhorScore >= LIMIAR_SIMILARIDADE_CACHE) {
        return melhorItem.resposta;
      }
    }

    // 3. Busca no cache de execução (IndexedDB)
    try {
      const db = await this.iniciarDb();
      if (db) {
        const itemExecucao = await new Promise<ItemCacheResposta | null>((resolve) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(chaveNormalizada);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => resolve(null);
        });

        if (itemExecucao && itemExecucao.resposta) {
          return itemExecucao.resposta;
        }
      }
    } catch {
      // Ignora falhas de IndexedDB (ex: modo anônimo restritivo)
    }

    return null;
  }

  /**
   * Salva a resposta no cache de execução (IndexedDB) respeitando limite de 200 entradas (RF08, CA09).
   */
  async salvarNoCacheExecucao(pergunta: string, resposta: RespostaDidatica): Promise<void> {
    const chaveNormalizada = normalizarFrase(pergunta);
    if (!chaveNormalizada) return;

    try {
      const db = await this.iniciarDb();
      if (!db) return;

      const item: ItemCacheResposta = {
        id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pergunta,
        perguntaNormalizada: chaveNormalizada,
        resposta,
        origem: 'execucao',
        criadoEm: Date.now()
      };

      await new Promise<void>((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Adiciona/atualiza item
        store.put(item);

        // Monitora contagem para descartar as mais antigas se ultrapassar 200
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          if (countRequest.result > LIMITE_MAX_CACHE_EXECUCAO) {
            const index = store.index('criadoEm');
            const excesso = countRequest.result - LIMITE_MAX_CACHE_EXECUCAO;
            let deletados = 0;
            const cursorRequest = index.openCursor();
            cursorRequest.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor && deletados < excesso) {
                store.delete(cursor.primaryKey);
                deletados++;
                cursor.continue();
              }
            };
          }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } catch {
      // Falha silenciosa em IndexedDB
    }
  }
}
