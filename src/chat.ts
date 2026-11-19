/**
 * TUTORIA - Módulo de Gerenciamento do Painel de Chat
 * Renderiza balões (completos ou progressivos por etapa), persiste sessão em sessionStorage,
 * fornece histórico multi-turno e integra Lousa, Fontes, Quiz e Caderno (RF01-RF03).
 */

import { FonteCitada } from './conhecimento/tipos';
import type { TurnoHistorico } from './gemini';
import { DesafioQuiz, ItemLousa } from './lousa/tipos';

export const CHAVE_CHAT_SESSAO = 'tutoria_chat_sessao';

export interface ChatMensagem {
  remetente: 'student' | 'tutor';
  texto: string;
  itensLousa?: ItemLousa[];
  imagemUrl?: string | null;
  fontes?: FonteCitada[];
  desafio?: DesafioQuiz | null;
  perguntaOriginal?: string;
  materia?: string;
  personaId?: string;
  personaNome?: string;
  omitirHistorico?: boolean;
  horario?: string;
}

export interface OpcoesMensagemChat {
  desafio?: DesafioQuiz | null;
  perguntaOriginal?: string;
  materia?: string;
  personaId?: string;
  personaNome?: string;
  miniaturaUsuarioUrl?: string;
  omitirHistorico?: boolean;
}

export interface DadosSalvarCaderno extends OpcoesMensagemChat {
  texto: string;
  itensLousa: ItemLousa[];
  fontes?: FonteCitada[];
}

export interface DadosFinalizacaoBolha {
  textoCompleto?: string;
  itensLousa?: ItemLousa[] | null;
  imagemUrl?: string | null;
  fontes?: FonteCitada[] | null;
  opcoes?: OpcoesMensagemChat;
}

export interface ControleBolhaProgressiva {
  elemento: HTMLElement;
  acrescentarEtapa(fala: string): void;
  finalizar(dados?: DadosFinalizacaoBolha): void;
}

interface EstadoSessaoPersistido {
  mensagens: ChatMensagem[];
  ultimaLousa?: ItemLousa[] | null;
  ultimaMateria?: string | null;
  ultimoDesafio?: DesafioQuiz | null;
}

export class ChatGerenciador {
  private container: HTMLElement;
  private onVerNaLousa?: (itens: ItemLousa[]) => void;
  private onVerImagem?: (url: string, legenda?: string) => void;
  private onVerFonte?: (fonte: FonteCitada) => void;
  private onIniciarDesafio?: (desafio: DesafioQuiz) => void;
  private onSalvarNoCaderno?: (dados: DadosSalvarCaderno) => Promise<void> | void;

  private mensagens: ChatMensagem[] = [];
  private ultimaLousa: ItemLousa[] | null = null;
  private ultimaMateria: string | null = null;
  private ultimoDesafio: DesafioQuiz | null = null;

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
    this.restaurarSessao();
  }

  definirOnVerFonte(callback: (fonte: FonteCitada) => void): void {
    this.onVerFonte = callback;
  }

  definirOnIniciarDesafio(callback: (desafio: DesafioQuiz) => void): void {
    this.onIniciarDesafio = callback;
  }

  definirOnSalvarNoCaderno(callback: (dados: DadosSalvarCaderno) => Promise<void> | void): void {
    this.onSalvarNoCaderno = callback;
  }

  obterMensagens(): ChatMensagem[] {
    return [...this.mensagens];
  }

  obterUltimaLousa(): ItemLousa[] | null {
    return this.ultimaLousa ? [...this.ultimaLousa] : null;
  }

  obterUltimaMateria(): string | null {
    return this.ultimaMateria;
  }

  obterUltimoDesafio(): DesafioQuiz | null {
    return this.ultimoDesafio;
  }

  /**
   * Converte as mensagens da sessão em histórico compacto para o Gemini (RF01).
   */
  obterHistoricoParaGemini(): TurnoHistorico[] {
    return this.mensagens
      .filter((m) => !m.omitirHistorico && typeof m.texto === 'string' && m.texto.trim().length > 0)
      .map((m) => ({
        role: m.remetente === 'student' ? 'user' : 'model',
        texto: m.texto.trim(),
        ...(m.materia ? { materia: m.materia } : {})
      }));
  }

  private persistirSessao(): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const estado: EstadoSessaoPersistido = {
        mensagens: this.mensagens,
        ultimaLousa: this.ultimaLousa,
        ultimaMateria: this.ultimaMateria,
        ultimoDesafio: this.ultimoDesafio
      };
      sessionStorage.setItem(CHAVE_CHAT_SESSAO, JSON.stringify(estado));
    } catch {
      // Ignora erro de quota ou ambiente sem sessionStorage
    }
  }

  restaurarSessao(): boolean {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      const raw = sessionStorage.getItem(CHAVE_CHAT_SESSAO);
      if (!raw) return false;
      const estado = JSON.parse(raw) as EstadoSessaoPersistido;
      if (!estado || !Array.isArray(estado.mensagens) || estado.mensagens.length === 0) {
        return false;
      }

      this.mensagens = estado.mensagens;
      this.ultimaLousa = Array.isArray(estado.ultimaLousa) && estado.ultimaLousa.length > 0 ? estado.ultimaLousa : null;
      this.ultimaMateria = estado.ultimaMateria || null;
      this.ultimoDesafio = estado.ultimoDesafio || null;

      for (const msg of this.mensagens) {
        const { bubble, bodyText } = this.criarEstruturaBolha(msg.remetente, msg);
        bodyText.textContent = msg.texto;
        this.anexarAcoesEFontes(
          bubble,
          msg.remetente,
          msg.texto,
          msg.itensLousa || null,
          msg.imagemUrl || null,
          msg.fontes || null,
          msg
        );
        this.container.appendChild(bubble);
      }

      this.rolarParaFinal();
      return true;
    } catch {
      return false;
    }
  }

  private criarEstruturaBolha(
    remetente: 'student' | 'tutor',
    opcoes?: OpcoesMensagemChat
  ): { bubble: HTMLElement; bodyText: HTMLElement } {
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
        ${this.escaparHtml(opcoes?.personaNome || 'Tutor Virtual')}
      `;
    }
    bubble.appendChild(label);

    if (remetente === 'student' && opcoes?.miniaturaUsuarioUrl) {
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'bubble-student-photo-wrap';
      const thumbImg = document.createElement('img');
      thumbImg.src = opcoes.miniaturaUsuarioUrl;
      thumbImg.alt = 'Foto do exercício enviada';
      thumbImg.className = 'bubble-student-photo';
      thumbImg.addEventListener('click', () => {
        this.onVerImagem?.(opcoes.miniaturaUsuarioUrl!, 'Foto do exercício');
      });
      thumbWrap.appendChild(thumbImg);
      bubble.appendChild(thumbWrap);
    }

    const bodyText = document.createElement('div');
    bodyText.className = 'bubble-text';
    bubble.appendChild(bodyText);

    return { bubble, bodyText };
  }

  private anexarAcoesEFontes(
    bubble: HTMLElement,
    remetente: 'student' | 'tutor',
    texto: string,
    itensLousa: ItemLousa[] | null,
    imagemUrl: string | null,
    fontes: FonteCitada[] | null,
    opcoes?: OpcoesMensagemChat
  ): void {
    // Evita duplicar ações caso finalizar seja chamado mais de uma vez
    bubble.querySelector('.bubble-actions-row')?.remove();
    bubble.querySelector('.bubble-fontes-container')?.remove();

    const acoesContainer = document.createElement('div');
    acoesContainer.className = 'bubble-actions-row';

    // Botão "Ver na lousa" para reabrir os itens daquela resposta (RF08, CA12)
    if (itensLousa && itensLousa.length > 0 && this.onVerNaLousa) {
      const lousaBtn = document.createElement('button');
      lousaBtn.type = 'button';
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
      acoesContainer.appendChild(lousaBtn);
    } else if (imagemUrl && this.onVerImagem) {
      const mediaBtn = document.createElement('button');
      mediaBtn.type = 'button';
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
      acoesContainer.appendChild(mediaBtn);
    }

    // Botão "🎯 Testar se entendi" (RF01, CA01)
    if (remetente === 'tutor' && opcoes?.desafio) {
      const desafio = opcoes.desafio;
      const quizBtn = document.createElement('button');
      quizBtn.type = 'button';
      quizBtn.className = 'bubble-media-btn bubble-quiz-btn';
      quizBtn.textContent = '🎯 Testar se entendi';
      quizBtn.addEventListener('click', () => {
        this.onIniciarDesafio?.(desafio);
      });
      acoesContainer.appendChild(quizBtn);
    }

    // Botão "⭐ Salvar no Caderno" (RF05a, CA08)
    if (remetente === 'tutor' && !opcoes?.omitirHistorico) {
      const salvarBtn = document.createElement('button');
      salvarBtn.type = 'button';
      salvarBtn.className = 'bubble-media-btn btn-salvar-caderno';
      salvarBtn.textContent = '⭐ Salvar no Caderno';
      let jaSalvo = false;

      salvarBtn.addEventListener('click', async () => {
        if (jaSalvo) return;
        jaSalvo = true;
        salvarBtn.disabled = true;
        try {
          await this.onSalvarNoCaderno?.({
            texto,
            itensLousa: itensLousa ? [...itensLousa] : [],
            fontes: fontes ? [...fontes] : undefined,
            desafio: opcoes?.desafio ?? null,
            perguntaOriginal: opcoes?.perguntaOriginal,
            materia: opcoes?.materia,
            personaId: opcoes?.personaId,
            personaNome: opcoes?.personaNome
          });
          salvarBtn.classList.add('salvo');
          salvarBtn.textContent = '✓ Salvo no Caderno';
        } catch {
          jaSalvo = false;
          salvarBtn.disabled = false;
        }
      });
      acoesContainer.appendChild(salvarBtn);
    }

    if (acoesContainer.childElementCount > 0) {
      bubble.appendChild(acoesContainer);
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
  }

  private registrarMensagemNaSessao(
    remetente: 'student' | 'tutor',
    texto: string,
    itensLousa: ItemLousa[] | null,
    imagemUrl: string | null,
    fontes: FonteCitada[] | null,
    opcoes?: OpcoesMensagemChat
  ): void {
    const registro: ChatMensagem = {
      remetente,
      texto,
      ...(itensLousa && itensLousa.length > 0 ? { itensLousa } : {}),
      ...(imagemUrl ? { imagemUrl } : {}),
      ...(fontes && fontes.length > 0 ? { fontes } : {}),
      ...(opcoes?.desafio ? { desafio: opcoes.desafio } : {}),
      ...(opcoes?.perguntaOriginal ? { perguntaOriginal: opcoes.perguntaOriginal } : {}),
      ...(opcoes?.materia ? { materia: opcoes.materia } : {}),
      ...(opcoes?.personaId ? { personaId: opcoes.personaId } : {}),
      ...(opcoes?.personaNome ? { personaNome: opcoes.personaNome } : {}),
      ...(opcoes?.omitirHistorico ? { omitirHistorico: true } : {})
    };

    this.mensagens.push(registro);
    if (itensLousa && itensLousa.length > 0) {
      this.ultimaLousa = [...itensLousa];
    }
    if (opcoes?.materia) {
      this.ultimaMateria = opcoes.materia;
    }
    if (remetente === 'tutor') {
      this.ultimoDesafio = opcoes?.desafio ?? null;
    }
    this.persistirSessao();
  }

  adicionarMensagem(
    remetente: 'student' | 'tutor',
    texto: string,
    itensLousa: ItemLousa[] | null = null,
    imagemUrl: string | null = null,
    fontes: FonteCitada[] | null = null,
    opcoes?: OpcoesMensagemChat
  ): void {
    const { bubble, bodyText } = this.criarEstruturaBolha(remetente, opcoes);
    bodyText.textContent = texto;
    this.anexarAcoesEFontes(bubble, remetente, texto, itensLousa, imagemUrl, fontes, opcoes);

    this.container.appendChild(bubble);
    this.rolarParaFinal();

    this.registrarMensagemNaSessao(remetente, texto, itensLousa, imagemUrl, fontes, opcoes);
  }

  /**
   * Cria imediatamente o balão do tutor e retorna controle para acrescentar etapas em tempo real
   * e anexar botões ("Ver na Lousa", "📖 Fonte", Quiz, Caderno) ao término da resposta (RF03, CA04, CT04).
   */
  iniciarMensagemProgressiva(opcoesIniciais?: OpcoesMensagemChat): ControleBolhaProgressiva {
    const { bubble, bodyText } = this.criarEstruturaBolha('tutor', opcoesIniciais);
    const partes: string[] = [];
    let finalizada = false;

    this.container.appendChild(bubble);
    this.rolarParaFinal();

    return {
      elemento: bubble,
      acrescentarEtapa: (fala: string) => {
        const falaLimpa = (fala || '').trim();
        if (!falaLimpa) return;
        partes.push(falaLimpa);
        bodyText.textContent = partes.join(' ');
        this.rolarParaFinal();
      },
      finalizar: (dados?: DadosFinalizacaoBolha) => {
        if (finalizada) return;
        finalizada = true;

        const opcoesFinais: OpcoesMensagemChat | undefined = dados?.opcoes
          ? { ...opcoesIniciais, ...dados.opcoes }
          : opcoesIniciais;
        const textoFinal = dados?.textoCompleto?.trim() || partes.join(' ').trim();
        bodyText.textContent = textoFinal;

        // Atualiza rótulo caso persona tenha sido refinada
        const label = bubble.querySelector('.bubble-label');
        if (label && opcoesFinais?.personaNome) {
          label.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            ${this.escaparHtml(opcoesFinais.personaNome)}
          `;
        }

        const itens = dados?.itensLousa ?? null;
        const imagem = dados?.imagemUrl ?? null;
        const fontes = dados?.fontes ?? null;

        this.anexarAcoesEFontes(bubble, 'tutor', textoFinal, itens, imagem, fontes, opcoesFinais);
        this.rolarParaFinal();

        if (textoFinal) {
          this.registrarMensagemNaSessao('tutor', textoFinal, itens, imagem, fontes, opcoesFinais);
        }
      }
    };
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

  /**
   * Limpa o DOM do chat e apaga os dados persistidos da sessão atual (RF02, CA03, CT03).
   */
  limpar(): void {
    this.mensagens = [];
    this.ultimaLousa = null;
    this.ultimaMateria = null;
    this.ultimoDesafio = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(CHAVE_CHAT_SESSAO);
      }
    } catch {}
    this.container.innerHTML = '';
  }
}
