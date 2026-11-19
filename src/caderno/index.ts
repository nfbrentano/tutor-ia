/**
 * TUTORIA - Módulo do Caderno de Estudos Local e Contador de Prática (RF05, RF06, RNF04, CA08, CA09)
 * Persiste explicações, itens da lousa e fontes em IndexedDB (100% offline),
 * com espelho/fallback em memória para ambientes restritos ou testes.
 */

import { FonteCitada } from '../conhecimento/tipos';
import { DesafioQuiz, ItemLousa } from '../lousa/tipos';
import { normalizarMateria } from '../personas/materia';

const CADERNO_DB_NAME = 'tutoria_caderno_db';
const CADERNO_DB_VERSION = 1;
const CADERNO_STORE_NAME = 'notas_estudo';

export interface NotaCaderno {
  id: string;
  pergunta: string;
  materia: string;
  personaId: string;
  personaNome: string;
  criadoEm: number;
  textoCompleto: string;
  itensLousa: ItemLousa[];
  fontes?: FonteCitada[];
  desafio?: DesafioQuiz | null;
}

export type EntradaNovaNota = Omit<NotaCaderno, 'id' | 'criadoEm'> & {
  id?: string;
  criadoEm?: number;
};

export interface EstatisticasSessao {
  duvidasRespondidas: number;
  desafiosConcluidos: number;
  desafiosAcertados: number;
}

const ROTULOS_MATERIA: Record<string, string> = {
  matematica: 'Matemática',
  ciencias: 'Ciências',
  fisica_quimica: 'Física e Química',
  portugues: 'Português',
  geografia: 'Geografia',
  historia: 'História',
  geral: 'Geral'
};

export function formatarRotuloMateria(materia?: string): string {
  if (!materia) return 'Geral';
  const norm = normalizarMateria(materia) || materia.trim().toLowerCase();
  return ROTULOS_MATERIA[norm] || materia;
}

export class GerenciadorCaderno {
  private memoriaNotas: Map<string, NotaCaderno> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private estatisticas: EstatisticasSessao = {
    duvidasRespondidas: 0,
    desafiosConcluidos: 0,
    desafiosAcertados: 0
  };

  constructor() {
    this.iniciarDb();
  }

  private iniciarDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = indexedDB.open(CADERNO_DB_NAME, CADERNO_DB_VERSION);
          request.onupgradeneeded = (event: any) => {
            const db: IDBDatabase = event.target.result;
            if (!db.objectStoreNames.contains(CADERNO_STORE_NAME)) {
              const store = db.createObjectStore(CADERNO_STORE_NAME, { keyPath: 'id' });
              store.createIndex('materia', 'materia', { unique: false });
              store.createIndex('criadoEm', 'criadoEm', { unique: false });
            }
          };
          request.onsuccess = (event: any) => resolve(event.target.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  private normalizarChaveMateria(materia?: string): string {
    if (!materia) return 'geral';
    return normalizarMateria(materia) || materia.trim().toLowerCase() || 'geral';
  }

  /**
   * Salva uma explicação e sua lousa no Caderno de Estudos (RF05a, RF05b, CA08).
   */
  async salvarNota(entrada: EntradaNovaNota): Promise<NotaCaderno> {
    const nota: NotaCaderno = {
      id: entrada.id || `nota_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pergunta: (entrada.pergunta || '').trim() || 'Dúvida escolar salva',
      materia: this.normalizarChaveMateria(entrada.materia),
      personaId: entrada.personaId || 'lia',
      personaNome: entrada.personaNome || 'Lia',
      criadoEm: entrada.criadoEm ?? Date.now(),
      textoCompleto: entrada.textoCompleto || '',
      itensLousa: Array.isArray(entrada.itensLousa) ? [...entrada.itensLousa] : [],
      ...(entrada.fontes && entrada.fontes.length > 0 ? { fontes: [...entrada.fontes] } : {}),
      ...(entrada.desafio ? { desafio: entrada.desafio } : {})
    };

    this.memoriaNotas.set(nota.id, nota);

    try {
      const db = await this.iniciarDb();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(CADERNO_STORE_NAME, 'readwrite');
          tx.objectStore(CADERNO_STORE_NAME).put(nota);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Espelho em memória já atualizado
    }

    return nota;
  }

  /**
   * Lista as anotações salvas, opcionalmente filtradas por matéria (RF05c, CA08, CT07).
   */
  async listarNotas(filtroMateria?: string): Promise<NotaCaderno[]> {
    let todasNotas: NotaCaderno[] = Array.from(this.memoriaNotas.values());

    try {
      const db = await this.iniciarDb();
      if (db) {
        const notasDb = await new Promise<NotaCaderno[] | null>((resolve) => {
          const tx = db.transaction(CADERNO_STORE_NAME, 'readonly');
          const req = tx.objectStore(CADERNO_STORE_NAME).getAll();
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => resolve(null);
        });

        if (notasDb !== null) {
          this.memoriaNotas.clear();
          notasDb.forEach((n) => this.memoriaNotas.set(n.id, n));
          todasNotas = notasDb;
        }
      }
    } catch {
      // Mantém leitura em memória
    }

    todasNotas.sort((a, b) => b.criadoEm - a.criadoEm);

    if (!filtroMateria || filtroMateria === 'todas') {
      return todasNotas;
    }

    const alvo = this.normalizarChaveMateria(filtroMateria);
    return todasNotas.filter((nota) => this.normalizarChaveMateria(nota.materia) === alvo);
  }

  /**
   * Recupera uma anotação específica pelo ID (CA09, CT08).
   */
  async obterNota(id: string): Promise<NotaCaderno | null> {
    if (!id) return null;

    try {
      const db = await this.iniciarDb();
      if (db) {
        const doDb = await new Promise<NotaCaderno | null>((resolve) => {
          const tx = db.transaction(CADERNO_STORE_NAME, 'readonly');
          const req = tx.objectStore(CADERNO_STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (doDb) {
          this.memoriaNotas.set(doDb.id, doDb);
          return doDb;
        }
      }
    } catch {
      // Fallback para memória
    }

    return this.memoriaNotas.get(id) || null;
  }

  /**
   * Remove uma anotação do Caderno de Estudos (RF05c, CT07).
   */
  async excluirNota(id: string): Promise<boolean> {
    if (!id) return false;
    const existiaMemoria = this.memoriaNotas.delete(id);
    let removidoDb = false;

    try {
      const db = await this.iniciarDb();
      if (db) {
        removidoDb = await new Promise<boolean>((resolve) => {
          const tx = db.transaction(CADERNO_STORE_NAME, 'readwrite');
          tx.objectStore(CADERNO_STORE_NAME).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      }
    } catch {
      // Ignora erro se IndexedDB indisponível
    }

    return existiaMemoria || removidoDb;
  }

  async limparTudo(): Promise<void> {
    this.memoriaNotas.clear();
    try {
      const db = await this.iniciarDb();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(CADERNO_STORE_NAME, 'readwrite');
          tx.objectStore(CADERNO_STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {}
  }

  registrarDuvidaRespondida(): EstatisticasSessao {
    this.estatisticas.duvidasRespondidas++;
    return { ...this.estatisticas };
  }

  registrarDesafioConcluido(acertou: boolean): EstatisticasSessao {
    this.estatisticas.desafiosConcluidos++;
    if (acertou) {
      this.estatisticas.desafiosAcertados++;
    }
    return { ...this.estatisticas };
  }

  obterEstatisticasSessao(): EstatisticasSessao {
    return { ...this.estatisticas };
  }
}
