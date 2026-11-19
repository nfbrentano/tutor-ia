/**
 * TUTORIA - Módulo Controlador da Lousa de Apoio Visual
 * Gerencia ciclo de vida, animação de escrita, histórico e sincronização com o Avatar.
 */

export * from './renderer';
export * from './resumo';
export * from './sanitizer';
export * from './tipos';
export * from './wikimedia';

import { renderizarItemLousa } from './renderer';
import { formatarResumoLousa } from './resumo';
import { DesafioQuiz, ItemLousa, OnResponderQuizCallback } from './tipos';
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
  private onResponderQuiz?: OnResponderQuizCallback;

  constructor(
    elementos: LousaElementos,
    onVerImagem?: (url: string, legenda?: string) => void,
    onResponderQuiz?: OnResponderQuizCallback
  ) {
    this.elementos = elementos;
    this.onVerImagem = onVerImagem;
    this.onResponderQuiz = onResponderQuiz;
    this.vincularEventos();
  }

  definirOnResponderQuiz(callback: OnResponderQuizCallback): void {
    this.onResponderQuiz = callback;
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

  /**
   * Exporta os itens atuais da lousa em Markdown/texto limpo para cópia ou download (RF06b).
   */
  exportarResumo(titulo?: string): string {
    return formatarResumoLousa(this.itensAtuais, titulo);
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

    const elemento = renderizarItemLousa(itemResolvido, this.onVerImagem, this.onResponderQuiz);
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
      if (typeof this.elementos.corpoElemento.scrollTo === 'function') {
        this.elementos.corpoElemento.scrollTo({
          top: this.elementos.corpoElemento.scrollHeight,
          behavior: 'smooth'
        });
      }

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

  /**
   * Adiciona e exibe um card interativo de Desafio Quiz na lousa (RF01, RF02).
   */
  async abrirDesafioQuiz(desafio: DesafioQuiz): Promise<HTMLElement | null> {
    if (!desafio) return null;
    this.abrir();
    return this.adicionarItem({
      tipo: 'quiz',
      conteudo: desafio
    });
  }

  /**
   * Permite que o aluno responda ao quiz ativo falando a letra/opção pelo microfone (RF02).
   */
  responderQuizAtivoPorVoz(falaAluno: string): boolean {
    if (!this.aberta || !this.elementos.corpoElemento) return false;
    const cardAtivo = this.elementos.corpoElemento.querySelector('.lousa-quiz-card[data-quiz-ativo="true"]');
    if (!cardAtivo) return false;

    const texto = falaAluno
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!texto) return false;

    const botoes = Array.from(cardAtivo.querySelectorAll<HTMLButtonElement>('.lousa-quiz-opcao'));
    if (botoes.length === 0) return false;

    const mapaLetras: Array<[RegExp, number]> = [
      [/\b(?:letra|alternativa|opcao|resposta)?\s*a\b|\bprimeir[ao]\b/, 0],
      [/\b(?:letra|alternativa|opcao|resposta)?\s*b\b|\bsegund[ao]\b/, 1],
      [/\b(?:letra|alternativa|opcao|resposta)?\s*c\b|\bterceir[ao]\b/, 2],
      [/\b(?:letra|alternativa|opcao|resposta)?\s*d\b|\bquart[ao]\b/, 3],
      [/\b(?:letra|alternativa|opcao|resposta)?\s*e\b|\bquint[ao]\b/, 4]
    ];

    for (const [padrao, idx] of mapaLetras) {
      if (padrao.test(texto) && botoes[idx] && !botoes[idx].disabled) {
        botoes[idx].click();
        return true;
      }
    }

    for (const btn of botoes) {
      if (btn.disabled) continue;
      const textoOpcao = (btn.querySelector('.lousa-quiz-texto')?.textContent || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (textoOpcao && textoOpcao.length >= 2 && (texto === textoOpcao || texto.includes(textoOpcao))) {
        btn.click();
        return true;
      }
    }

    return false;
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
