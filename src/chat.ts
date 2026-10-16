/**
 * TUTORIA - Módulo de Gerenciamento do Painel de Chat
 * Renderiza os balões de conversa, links didáticos e rolagem automática.
 */

export interface ChatMensagem {
  remetente: 'student' | 'tutor';
  texto: string;
  imagemUrl?: string | null;
  horario?: string;
}

export class ChatGerenciador {
  private container: HTMLElement;
  private onVerImagem?: (url: string, legenda?: string) => void;

  constructor(container: HTMLElement, onVerImagem?: (url: string, legenda?: string) => void) {
    this.container = container;
    this.onVerImagem = onVerImagem;
  }

  adicionarMensagem(remetente: 'student' | 'tutor', texto: string, imagemUrl: string | null = null): void {
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

    if (imagemUrl && this.onVerImagem) {
      const mediaBtn = document.createElement('button');
      mediaBtn.className = 'bubble-media-btn';
      mediaBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        Ver Ilustração Didática
      `;
      mediaBtn.addEventListener('click', () => {
        this.onVerImagem!(imagemUrl, 'Ilustração didática complementar');
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
