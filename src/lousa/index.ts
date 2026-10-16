/**
 * TUTORIA - Módulo Controlador da Lousa de Apoio Visual
 * Gerencia ciclo de vida, animação de escrita, histórico e sincronização com o Avatar.
 */

export * from './renderer';
export * from './sanitizer';
export * from './tipos';
export * from './wikimedia';

import { renderizarItemLousa } from './renderer';
import { ItemLousa } from './tipos';
import { buscarImagemWikimedia } from './wikimedia';

export interface LousaElementos {
  painelElemento: HTMLElement | null;
  corpoElemento: HTMLElement | null;
  btnFecharElemento?: HTMLElement | null;
}

export class LousaControlador {
  private elementos: LousaElementos;
  private aberta = false;
  private itensAtuais: ItemLousa[] = [];
  private onVerImagem?: (url: string, legenda?: string) => void;

  constructor(elementos: LousaElementos, onVerImagem?: (url: string, legenda?: string) => void) {
    this.elementos = elementos;
    this.onVerImagem = onVerImagem;
    this.vincularEventos();
  }

  private vincularEventos(): void {
    if (this.elementos.btnFecharElemento) {
      this.elementos.btnFecharElemento.addEventListener('click', () => {
        this.fechar();
      });
    }
  }

  estaAberta(): boolean {
    return this.aberta;
  }

  obterItensAtuais(): ItemLousa[] {
    return [...this.itensAtuais];
  }

  abrir(): void {
    if (!this.elementos.painelElemento) return;
    this.aberta = true;
    this.elementos.painelElemento.classList.add('visible');
    this.elementos.painelElemento.setAttribute('aria-hidden', 'false');
  }

  fechar(): void {
    if (!this.elementos.painelElemento) return;
    this.aberta = false;
    this.elementos.painelElemento.classList.remove('visible');
    this.elementos.painelElemento.setAttribute('aria-hidden', 'true');
  }

  limpar(): void {
    this.itensAtuais = [];
    if (this.elementos.corpoElemento) {
      this.elementos.corpoElemento.innerHTML = '';
    }
  }

  async adicionarItem(item: ItemLousa): Promise<HTMLElement | null> {
    if (!item) return null;

    // Se for imagem, resolve a busca na Wikimedia se ainda não tiver URL real
    let itemResolvido = item;
    if (item.tipo === 'imagem') {
      const imgData = typeof item.conteudo === 'string'
        ? { termo: item.conteudo, legenda: item.legenda }
        : (item.conteudo as any);

      if (!imgData.urlReal) {
        const busca = await buscarImagemWikimedia(imgData.termo || imgData.url || '', imgData.legenda);
        if (!busca) {
          // Se falhar a busca ou estourar timeout, omite sem deixar quebrado (CA07)
          return null;
        }
        itemResolvido = {
          ...item,
          conteudo: busca
        };
      }
    }

    const elemento = renderizarItemLousa(itemResolvido, this.onVerImagem);
    if (!elemento) return null;

    this.itensAtuais.push(itemResolvido);

    if (this.elementos.corpoElemento) {
      // Abre a lousa caso esteja fechada
      if (!this.aberta) {
        this.abrir();
      }

      // Aplica efeito de escrita progressiva (RF04)
      elemento.classList.add('lousa-item-aparecendo');
      this.elementos.corpoElemento.appendChild(elemento);

      // Rolagem suave para o novo item
      this.elementos.corpoElemento.scrollTo({
        top: this.elementos.corpoElemento.scrollHeight,
        behavior: 'smooth'
      });

      // Dispara evento para o avatar ou outros ouvintes (RF09, CA13)
      const eventoExibido = new CustomEvent('lousa:item-exibido', {
        bubbles: true,
        detail: { elemento, item: itemResolvido }
      });
      elemento.dispatchEvent(eventoExibido);
      if (typeof document !== 'undefined') {
        document.dispatchEvent(eventoExibido);
      }
    }

    return elemento;
  }

  async carregarItens(itens: ItemLousa[]): Promise<void> {
    this.limpar();
    if (!itens || itens.length === 0) {
      this.fechar();
      return;
    }

    this.abrir();
    for (const it of itens) {
      await this.adicionarItem(it);
    }
  }
}
