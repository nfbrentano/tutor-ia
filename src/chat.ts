/**
 * TUTORIA - Módulo de Gerenciamento do Painel de Chat
 * Renderiza os balões de conversa, botão para reabrir a lousa e rolagem automática (RF08, CA12).
 */

import { FonteCitada } from './conhecimento/tipos';
import { ItemLousa } from './lousa/tipos';

export interface ChatMensagem {
  remetente: 'student' | 'tutor';
  texto: string;
  itensLousa?: ItemLousa[];
  imagemUrl?: string | null;
  fontes?: FonteCitada[];
  horario?: string;
}

export class ChatGerenciador {
  private container: HTMLElement;
  private onVerNaLousa?: (itens: ItemLousa[]) => void;
  private onVerImagem?: (url: string, legenda?: string) => void;
  private onVerFonte?: (fonte: FonteCitada) => void;

  constructor(
    container: HTMLElement,
    onVerNaLousa?: (itens: ItemLousa[]) => void,
    onVerImagem?: (url: string, legenda?: string) => void,
    onVerFonte?: (fonte: FonteCitada) => void
  ) {
    this.container = container;
    this.onVerNaLousa = onVerNaLousa;
    this.onVerImagem = onVerImagem;
    this.onVerFonte = onVerFonte;
  }

  definirOnVerFonte(callback: (fonte: FonteCitada) => void): void {
    this.onVerFonte = callback;
  }

  adicionarMensagem(
    remetente: 'student' | 'tutor',
    texto: string,
    itensLousa: ItemLousa[] | null = null,
    imagemUrl: string | null = null,
    fontes: FonteCitada[] | null = null
  ): void {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${remetente}`;

    const label = document.createElement('div');
    label.className = 'bubble-label';

    if (remetente === 'student') {
      label.textContent = 'Você (Aluno)';
    } else {
      label.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Tutor Virtual
      `;
    }
    bubble.appendChild(label);

    const bodyText = document.createElement('div');
    bodyText.className = 'bubble-text';
    bodyText.textContent = texto;
    bubble.appendChild(bodyText);

    // Botão "Ver na lousa" para reabrir os itens daquela resposta (RF08, CA12)
    if (itensLousa && itensLousa.length > 0 && this.onVerNaLousa) {
      const lousaBtn = document.createElement('button');
      lousaBtn.className = 'bubble-media-btn bubble-lousa-btn';
      lousaBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Ver na Lousa (${itensLousa.length})
      `;
      lousaBtn.addEventListener('click', () => {
        this.onVerNaLousa!(itensLousa);
      });
      bubble.appendChild(lousaBtn);
    } else if (imagemUrl && this.onVerImagem) {
      const mediaBtn = document.createElement('button');
      mediaBtn.className = 'bubble-media-btn';
      mediaBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        Ver Imagem
      `;
      mediaBtn.addEventListener('click', () => {
        this.onVerImagem!(imagemUrl, 'Ilustração complementar');
      });
      bubble.appendChild(mediaBtn);
    }

    // Citações de fontes de livros didáticos (RF09, CA06, CA10)
    if (fontes && fontes.length > 0) {
      const fontesContainer = document.createElement('div');
      fontesContainer.className = 'bubble-fontes-container';

      for (const fonte of fontes) {
        const fonteBtn = document.createElement('button');
        fonteBtn.type = 'button';
        fonteBtn.className = 'bubble-fonte-btn';
        fonteBtn.setAttribute('aria-label', `Abrir página ${fonte.pagina} do livro ${fonte.tituloLivro || fonte.livroId}`);

        const tituloExibicao = fonte.tituloLivro || fonte.livroId;
        fonteBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>📖 <em>${this.escaparHtml(tituloExibicao)}</em>, p. ${fonte.pagina}</span>
        `;

        fonteBtn.addEventListener('click', () => {
          if (this.onVerFonte) {
            this.onVerFonte(fonte);
          }
        });
        fontesContainer.appendChild(fonteBtn);
      }
      bubble.appendChild(fontesContainer);
    }

    this.container.appendChild(bubble);
    this.rolarParaFinal();
  }

  private escaparHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  rolarParaFinal(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  limpar(): void {
    this.container.innerHTML = '';
  }
}
