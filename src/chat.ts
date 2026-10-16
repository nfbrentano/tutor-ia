/**
 * TUTORIA - Módulo de Gerenciamento do Painel de Chat
 * Renderiza os balões de conversa, botão para reabrir a lousa e rolagem automática (RF08, CA12).
 */

import { ItemLousa } from './lousa/tipos';

export interface ChatMensagem {
  remetente: 'student' | 'tutor';
  texto: string;
  itensLousa?: ItemLousa[];
  imagemUrl?: string | null;
  horario?: string;
}

export class ChatGerenciador {
  private container: HTMLElement;
  private onVerNaLousa?: (itens: ItemLousa[]) => void;
  private onVerImagem?: (url: string, legenda?: string) => void;

  constructor(
    container: HTMLElement,
    onVerNaLousa?: (itens: ItemLousa[]) => void,
    onVerImagem?: (url: string, legenda?: string) => void
  ) {
    this.container = container;
    this.onVerNaLousa = onVerNaLousa;
    this.onVerImagem = onVerImagem;
  }

  adicionarMensagem(
    remetente: 'student' | 'tutor',
    texto: string,
    itensLousa: ItemLousa[] | null = null,
    imagemUrl: string | null = null
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

    this.container.appendChild(bubble);
    this.rolarParaFinal();
  }

  rolarParaFinal(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  limpar(): void {
    this.container.innerHTML = '';
  }
}
