/**
 * TUTORIA - Script da Página do Tutor (tutor.html)
 * Orquestra Avatar, Voz, Lousa Didática, Chat, Espera Ativa, Chamada ao Gemini com Streaming e Lightbox.
 */

import {
  getStoredApiKey,
  getStoredAvatarMode,
  getStoredDisabledBookIds,
  getStoredPersonaFixa,
  getStoredSerieEscolar,
  getStoredSpeechRate,
  getStoredVoiceUri,
  hasApiKey,
  setStoredSerieEscolar
} from './armazenamento';
import { AvatarControlador, ControladorAvatar } from './avatar';
import { formatarRotuloMateria, GerenciadorCaderno, NotaCaderno } from './caderno';
import { ChatGerenciador, ControleBolhaProgressiva } from './chat';
import {
  buscarTrechosRelevantes,
  FonteCitada,
  GerenciadorCacheConhecimento,
  IndiceConhecimento,
  TrechoLivro
} from './conhecimento';
import { ControladorEspera } from './espera';
import {
  callGeminiApi,
  EtapaExplicacao,
  ImagemPergunta,
  ModoPedagogico,
  prepararImagemParaEnvio,
  RespostaDidatica
} from './gemini';
import { DesafioQuiz, LousaControlador } from './lousa';
import {
  ajustarPitchPersona,
  descreverPersona,
  detectarMateria,
  escolherVozParaPersona,
  normalizarMateria,
  obterPersonaPorMateria,
  Persona,
  resolverPersona,
  VozDisponivel
} from './personas';
import { registrarServiceWorkerPwa } from './pwa';
import { obterServicoVoz } from './voz';

/**
 * Fecha o lightbox de imagem ampliada, modal de trecho de livro ou Meu Caderno ao pressionar Escape (RF07a, CA09).
 */
export function configurarFechamentoModaisEscape(
  lightboxOverlay: HTMLElement | null,
  modalFonteOverlay: HTMLElement | null,
  fecharFonte?: () => void,
  modalCadernoOverlay?: HTMLElement | null,
  fecharCaderno?: () => void
): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (lightboxOverlay?.classList.contains('active')) {
      lightboxOverlay.classList.remove('active');
    }
    if (modalFonteOverlay && !modalFonteOverlay.classList.contains('hidden')) {
      if (fecharFonte) {
        fecharFonte();
      } else {
        modalFonteOverlay.classList.add('hidden');
      }
    }
    if (modalCadernoOverlay && !modalCadernoOverlay.classList.contains('hidden')) {
      if (fecharCaderno) {
        fecharCaderno();
      } else {
        modalCadernoOverlay.classList.add('hidden');
      }
    }
  };
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const avatarModule = document.getElementById('avatar-module');
  const statusText = document.getElementById('status-text');
  const btnMic = document.getElementById('btn-mic') as HTMLButtonElement | null;
  const micTip = document.getElementById('mic-tip');
  const chatStream = document.getElementById('chat-stream');
  const textInput = document.getElementById('text-fallback-input') as HTMLInputElement | null;
  const btnSendText = document.getElementById('btn-send-text') as HTMLButtonElement | null;
  const blockingBanner = document.getElementById('blocking-banner');
  const personaCredito = document.getElementById('persona-credito');

  // Status no Header
  const statusIndicator = document.getElementById('status-indicator');
  const statusLabel = document.getElementById('status-label');

  // Lousa Didática e Lightbox (RF01, RF06, RF07, RNF04)
  const lousaPanel = document.getElementById('lousa-board');
  const lousaBody = document.getElementById('lousa-body');
  const btnCloseLousa = document.getElementById('btn-close-lousa');
  const btnCopiarLousa = document.getElementById('btn-copiar-lousa') as HTMLButtonElement | null;
  const btnBaixarLousa = document.getElementById('btn-baixar-lousa') as HTMLButtonElement | null;
  const lousaFooter = document.getElementById('lousa-footer');
  const btnLousaTestarEntendi = document.getElementById('btn-lousa-testar-entendi') as HTMLButtonElement | null;
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement | null;

  // Série Escolar, Nova Conversa e Badge da Persona no Palco (RF02, RF04, RF05)
  const badgeSerieTutor = document.getElementById('badge-serie-tutor');
  const selectSerieTutor = document.getElementById('select-serie-tutor') as HTMLSelectElement | null;
  const btnNovaConversa = document.getElementById('btn-nova-conversa') as HTMLButtonElement | null;
  const personaPalcoBadge = document.getElementById('persona-palco-badge');
  const personaPalcoEmblema = document.getElementById('persona-palco-emblema');
  const personaPalcoNome = document.getElementById('persona-palco-nome');
  const personaPalcoMateria = document.getElementById('persona-palco-materia');

  // Prática, Foto Socrática e Caderno de Estudos (RF01 - RF06)
  const caderno = new GerenciadorCaderno();
  const practiceCounterBadge = document.getElementById('practice-counter-badge');
  const btnAbrirCaderno = document.getElementById('btn-abrir-caderno') as HTMLButtonElement | null;
  const modalCadernoOverlay = document.getElementById('modal-caderno-overlay');
  const btnFecharModalCaderno = document.getElementById('btn-fechar-modal-caderno') as HTMLButtonElement | null;
  const btnOkModalCaderno = document.getElementById('btn-ok-modal-caderno') as HTMLButtonElement | null;
  const selectFiltroCaderno = document.getElementById('select-filtro-caderno') as HTMLSelectElement | null;
  const cadernoListaContainer = document.getElementById('caderno-lista-container');
  const cadernoEstatisticasResumo = document.getElementById('caderno-estatisticas-resumo');
  const selectModoPedagogico = document.getElementById('select-modo-pedagogico') as HTMLSelectElement | null;
  const btnFotoExercicio = document.getElementById('btn-foto-exercicio') as HTMLButtonElement | null;
  const inputFotoExercicio = document.getElementById('input-foto-exercicio') as HTMLInputElement | null;
  const fotoPreviewBar = document.getElementById('foto-preview-bar');
  const fotoPreviewImg = document.getElementById('foto-preview-img') as HTMLImageElement | null;
  const fotoPreviewNome = document.getElementById('foto-preview-nome');
  const btnRemoverFoto = document.getElementById('btn-remover-foto') as HTMLButtonElement | null;
  const fotoErroMsg = document.getElementById('foto-erro-msg');

  let desafioAtualLousa: DesafioQuiz | null = null;
  let imagemAnexadaAtual: ImagemPergunta | null = null;

  // Controle de Sequência e Cancelamento (RF11, CA13)
  let speechSequenceId = 0;
  let activeAbortController: AbortController | null = null;

  // Inicializa Avatar 2D Inicial (Plano B e Carregamento Instantâneo - RF02, RF03)
  const avatar2D = new AvatarControlador({
    moduloElemento: avatarModule,
    statusTextoElemento: statusText,
    micBotaoElemento: btnMic,
    micDicaElemento: micTip
  });

  // Interface desacoplada de controle do avatar (RF01, CA01)
  let avatar: ControladorAvatar = avatar2D;

  const servicoVoz = obterServicoVoz();

  // Persona do tutor por matéria (RF06, RF07, RF11, RF12 da spec de personas)
  let personaAtual: Persona = resolverPersona(null, null, getStoredPersonaFixa());
  let personaSugeridaPeloGemini: Persona | null = null;
  let vozesDisponiveis: VozDisponivel[] = [];

  function atualizarListaVozes(): void {
    servicoVoz
      .obterVozes()
      .then(vozes => {
        if (vozes.length > 0) vozesDisponiveis = vozes;
      })
      .catch(() => { });
  }
  atualizarListaVozes();

  function obterOpcoesVoz(): { voiceUri?: string; rate: number; pitch: number } {
    if (vozesDisponiveis.length === 0) atualizarListaVozes();
    const vozFixa = getStoredVoiceUri();
    const voiceUri = vozFixa || escolherVozParaPersona(vozesDisponiveis, personaAtual);
    const nomeVoz = vozesDisponiveis.find(v => v.id === voiceUri)?.name;
    return {
      voiceUri: voiceUri || undefined,
      rate: getStoredSpeechRate() * personaAtual.voz.rate,
      pitch: ajustarPitchPersona(personaAtual, nomeVoz)
    };
  }

  function exibirCreditoPersona(): void {
    if (personaCredito) personaCredito.textContent = descreverPersona(personaAtual);
    if (personaPalcoEmblema) personaPalcoEmblema.textContent = personaAtual.emblema || '🤖';
    if (personaPalcoNome) personaPalcoNome.textContent = personaAtual.nome;
    if (personaPalcoMateria) personaPalcoMateria.textContent = formatarRotuloMateria(personaAtual.materias[0]);
    if (personaAtual.corTema) {
      avatarModule?.style.setProperty('--persona-cor', personaAtual.corTema);
      personaPalcoBadge?.style.setProperty('--persona-cor', personaAtual.corTema);
    }
    avatarModule?.setAttribute('data-persona', personaAtual.id);
    avatar.definirPersona?.(personaAtual);
  }
  exibirCreditoPersona();

  function aplicarPersona(nova: Persona): void {
    if (nova.id === personaAtual.id) return;
    personaAtual = nova;
    exibirCreditoPersona();
  }

  // Série Escolar no cabeçalho (RF04, D01, CA05)
  function atualizarBadgeSerie(): void {
    const serie = getStoredSerieEscolar();
    if (badgeSerieTutor) {
      badgeSerieTutor.textContent = serie || 'Ensino Geral';
    }
    if (selectSerieTutor && selectSerieTutor.value !== serie) {
      selectSerieTutor.value = serie;
    }
  }
  atualizarBadgeSerie();
  selectSerieTutor?.addEventListener('change', () => {
    setStoredSerieEscolar(selectSerieTutor.value);
    atualizarBadgeSerie();
  });

  // Função para abrir imagem no lightbox em tela cheia (RF07, CA11)
  function abrirLightbox(url: string, legenda?: string): void {
    if (!lightboxOverlay || !lightboxImg) return;
    lightboxImg.src = url;
    lightboxImg.alt = legenda || 'Ilustração didática ampliada';
    lightboxOverlay.classList.add('active');
  }

  // Inicializa Controlador da Lousa (RF01, RF03, RF04)
  const lousa = new LousaControlador(
    {
      painelElemento: lousaPanel,
      corpoElemento: lousaBody,
      btnFecharElemento: btnCloseLousa
    },
    (url, legenda) => {
      abrirLightbox(url, legenda);
    }
  );

  // Inicializa Controlador de Espera Ativa (RF01 - RF07, CA01 - CA08, CA13, CA14)
  const controladorEspera = new ControladorEspera({
    avatar,
    lousa,
    servicoVoz,
    obterConfigVoz: () => obterOpcoesVoz()
  });

  // Carregamento Progressivo do Avatar 3D sob demanda (RF02, RF03, CA02, CA03, CA04, CA05, RNF01)
  const modoAvatar = getStoredAvatarMode();
  if (modoAvatar !== '2d') {
    const canvas3D = document.getElementById('avatar-3d-canvas') as HTMLCanvasElement | null;
    if (canvas3D) {
      import('./avatar3d')
        .then(async ({ carregarAvatar3D }) => {
          const avatar3DInstancia = await carregarAvatar3D(
            {
              canvasElemento: canvas3D,
              moduloElemento: avatarModule,
              statusTextoElemento: statusText,
              micBotaoElemento: btnMic,
              micDicaElemento: micTip
            },
            { persona: personaAtual }
          );

          if (avatar3DInstancia) {
            // Preserva estado atual da interação (ouvindo, falando, etc.)
            const estadoAtual = avatar.obterEstado();
            avatar = avatar3DInstancia;
            avatar.definirEstado(estadoAtual);
            controladorEspera.definirAvatar(avatar);
            avatar2D.destruir();
            // A persona pode ter mudado enquanto o modelo carregava
            avatar.definirPersona?.(personaAtual);
            if (import.meta.env.DEV) {
              (window as any).__tutorAvatar = avatar3DInstancia;
            }
          }
        })
        .catch((err) => {
          console.warn('Avatar3D: Falha ao inicializar 3D, plano B (SVG) ativo.', err);
        });
    }
  }

  // Inicializa Chat com suporte a sessão em sessionStorage e botão "Ver na Lousa" (RF02, RF08, CA03, CA12)
  const chat = new ChatGerenciador(
    chatStream!,
    (itens) => {
      lousa.carregarItens(itens);
    },
    (url, legenda) => {
      abrirLightbox(url, legenda);
    }
  );

  // Restaura última lousa e persona da sessão quando retorna de Configurações (RF02, CA03)
  const lousaRestaurada = chat.obterUltimaLousa();
  if (lousaRestaurada && lousaRestaurada.length > 0) {
    void lousa.carregarItens(lousaRestaurada);
  }
  const materiaRestaurada = chat.obterUltimaMateria();
  if (materiaRestaurada && !getStoredPersonaFixa()) {
    const personaRestaurada = obterPersonaPorMateria(normalizarMateria(materiaRestaurada));
    if (personaRestaurada) {
      aplicarPersona(personaRestaurada);
    }
  }
  const desafioRestaurado = chat.obterUltimoDesafio();
  if (desafioRestaurado) {
    desafioAtualLousa = desafioRestaurado;
    lousaFooter?.classList.remove('hidden');
  }

  // Botões Copiar / Baixar resumo da lousa (RF06b, CA10)
  btnCopiarLousa?.addEventListener('click', async () => {
    const resumo = lousa.exportarResumo();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resumo);
      } else {
        const ta = document.createElement('textarea');
        ta.value = resumo;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const textoOriginal = btnCopiarLousa.textContent;
      btnCopiarLousa.textContent = '✓ Copiado!';
      setTimeout(() => {
        btnCopiarLousa.textContent = textoOriginal || '📋 Copiar';
      }, 1800);
    } catch {
      // Silencioso se permissão negada
    }
  });

  btnBaixarLousa?.addEventListener('click', () => {
    const resumo = lousa.exportarResumo();
    const blob = new Blob([resumo], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumo-lousa-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Botão "Nova conversa" limpa sessão, fecha lousa e reinicia contexto (RF02, CA03)
  btnNovaConversa?.addEventListener('click', async () => {
    speechSequenceId++;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    controladorEspera.cancelarEspera();
    if (servicoVoz.estaFalando()) {
      await servicoVoz.pararDeFalar();
    }
    avatar.pararFala();
    avatar.definirEstado('idle');

    chat.limpar();
    lousa.limpar();
    lousa.fechar();
    desafioAtualLousa = null;
    lousaFooter?.classList.add('hidden');
    personaSugeridaPeloGemini = null;
    aplicarPersona(resolverPersona(null, null, getStoredPersonaFixa()));

    if (chatStream) {
      chatStream.innerHTML = `
        <div class="chat-bubble tutor">
          <div class="bubble-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Tutor Virtual
          </div>
          <div class="bubble-text">
            Nova conversa iniciada! Clique no microfone ou digite sua próxima dúvida escolar abaixo.
          </div>
        </div>
      `;
    }
  });

  registrarServiceWorkerPwa();

  // Modal para Visualização de Trecho de Livro Didático (RF09, CA10, RNF05)
  const modalFonteOverlay = document.getElementById('modal-fonte-overlay');
  const modalFonteTitulo = document.getElementById('modal-fonte-titulo');
  const modalFontePagina = document.getElementById('modal-fonte-pagina');
  const modalFonteTexto = document.getElementById('modal-fonte-texto');
  const btnFecharModalFonte = document.getElementById('btn-fechar-modal-fonte');
  const btnEntendidoModalFonte = document.getElementById('btn-entendido-modal-fonte');

  function fecharModalFonte(): void {
    if (modalFonteOverlay) {
      modalFonteOverlay.classList.add('hidden');
    }
  }

  if (btnFecharModalFonte) btnFecharModalFonte.addEventListener('click', fecharModalFonte);
  if (btnEntendidoModalFonte) btnEntendidoModalFonte.addEventListener('click', fecharModalFonte);
  if (modalFonteOverlay) {
    modalFonteOverlay.addEventListener('click', (e) => {
      if (e.target === modalFonteOverlay) fecharModalFonte();
    });
  }

  function abrirModalFonte(fonte: FonteCitada): void {
    if (!modalFonteOverlay || !modalFonteTitulo || !modalFontePagina || !modalFonteTexto) return;

    // RNF05: O texto dos trechos é sempre inserido na tela com textContent (nunca innerHTML)
    modalFonteTitulo.textContent = fonte.tituloLivro || `Livro ${fonte.livroId}`;
    modalFontePagina.textContent = `Página ${fonte.pagina}`;

    let trechoEncontrado: TrechoLivro | undefined;
    if (indiceConhecimento) {
      if (fonte.trechoId) {
        trechoEncontrado = indiceConhecimento.trechos.find(t => t.id === fonte.trechoId);
      }
      if (!trechoEncontrado) {
        trechoEncontrado = indiceConhecimento.trechos.find(
          t => t.livroId === fonte.livroId && Number(t.pagina) === Number(fonte.pagina)
        );
      }
    }

    if (trechoEncontrado) {
      modalFonteTexto.textContent = trechoEncontrado.texto;
      if (trechoEncontrado.capitulo) {
        modalFontePagina.textContent = `Página ${fonte.pagina} • ${trechoEncontrado.capitulo}`;
      }
    } else {
      modalFonteTexto.textContent = `Trecho original citado da página ${fonte.pagina} da obra "${fonte.tituloLivro || fonte.livroId}".`;
    }

    modalFonteOverlay.classList.remove('hidden');
  }

  chat.definirOnVerFonte(abrirModalFonte);

  // Contadores de prática da sessão (RF06)
  function atualizarContadoresPratica(): void {
    const stats = caderno.obterEstatisticasSessao();
    if (practiceCounterBadge) {
      practiceCounterBadge.textContent = `📚 ${stats.duvidasRespondidas} • 🎯 ${stats.desafiosAcertados}`;
    }
    if (cadernoEstatisticasResumo) {
      cadernoEstatisticasResumo.textContent = `${stats.duvidasRespondidas} dúvidas tiradas • ${stats.desafiosAcertados} desafios acertados nesta sessão`;
    }
  }
  atualizarContadoresPratica();

  // Fala auxiliar para enunciados, feedback de Quiz e leitura do Caderno (RF01, RF02, RF05)
  async function falarTextoCurto(texto: string, mensagemStatus?: string | null): Promise<void> {
    if (!texto || !texto.trim()) return;
    const seq = ++speechSequenceId;
    controladorEspera.cancelarEspera();
    if (servicoVoz.estaFalando()) {
      await servicoVoz.pararDeFalar();
    }
    avatar.pararFala();
    avatar.definirEstado('speaking', mensagemStatus ?? null);

    await servicoVoz.falar(
      texto,
      {
        onStart: () => {
          if (speechSequenceId === seq) avatar.definirEstado('speaking', mensagemStatus ?? null);
        },
        onBoundary: (_charIndex, word) => {
          if (speechSequenceId === seq) avatar.notificarPalavraFalada(word);
        },
        onEnd: () => {
          if (speechSequenceId === seq) {
            avatarModule?.removeAttribute('data-expressao');
            avatar.pararFala();
            avatar.definirEstado('idle');
          }
        },
        onError: () => {
          if (speechSequenceId === seq) {
            avatarModule?.removeAttribute('data-expressao');
            avatar.pararFala();
            avatar.definirEstado('idle');
          }
        }
      },
      obterOpcoesVoz()
    );
  }

  function atualizarBotaoDesafioLousa(desafio: DesafioQuiz | null): void {
    desafioAtualLousa = desafio;
    if (!lousaFooter) return;
    if (desafio) {
      lousaFooter.classList.remove('hidden');
    } else {
      lousaFooter.classList.add('hidden');
    }
  }

  async function iniciarDesafioNaLousa(desafio: DesafioQuiz): Promise<void> {
    atualizarBotaoDesafioLousa(null);
    await lousa.abrirDesafioQuiz(desafio);
    await falarTextoCurto(`Vamos testar se você entendeu: ${desafio.pergunta}`, '🎯 Desafio na lousa!');
  }

  chat.definirOnIniciarDesafio((desafio) => {
    void iniciarDesafioNaLousa(desafio);
  });

  if (btnLousaTestarEntendi) {
    btnLousaTestarEntendi.addEventListener('click', () => {
      if (desafioAtualLousa) {
        void iniciarDesafioNaLousa(desafioAtualLousa);
      }
    });
  }

  // Reações pedagógicas às respostas do Quiz na lousa (RF02, CA02, CA03, CA04)
  lousa.definirOnResponderQuiz((evento) => {
    if (evento.acertou) {
      caderno.registrarDesafioConcluido(true);
      atualizarContadoresPratica();
      avatarModule?.setAttribute('data-expressao', 'happy');
      void falarTextoCurto(
        `Parabéns, você acertou! ${evento.desafio.explicacao}`,
        '🎉 Muito bem! Você acertou!'
      );
      return;
    }

    if (evento.tentativa === 1 && !evento.revelado) {
      void falarTextoCurto(
        `Quase lá! Dica: ${evento.desafio.dica}. Tente escolher outra alternativa!`,
        '💡 Dica na lousa! Tente de novo.'
      );
      return;
    }

    caderno.registrarDesafioConcluido(false);
    atualizarContadoresPratica();
    const alternativaCorreta = evento.desafio.opcoes[evento.desafio.correta] || '';
    void falarTextoCurto(
      `A resposta correta é ${alternativaCorreta}. ${evento.desafio.explicacao}`,
      'Veja a explicação na lousa.'
    );
  });

  // Gerenciamento do Modal "Meu Caderno" offline (RF05, RF06, RNF04, CA08, CA09)
  function criarCardNotaCaderno(nota: NotaCaderno): HTMLElement {
    const card = document.createElement('div');
    card.className = 'caderno-nota-card';

    const topo = document.createElement('div');
    topo.className = 'caderno-nota-topo';

    const badgeMateria = document.createElement('span');
    badgeMateria.className = 'caderno-nota-materia';
    badgeMateria.textContent = formatarRotuloMateria(nota.materia);

    const dataSpan = document.createElement('span');
    dataSpan.textContent = `${nota.personaNome} • ${new Date(nota.criadoEm).toLocaleDateString('pt-BR')}`;

    topo.appendChild(badgeMateria);
    topo.appendChild(dataSpan);
    card.appendChild(topo);

    const perguntaEl = document.createElement('div');
    perguntaEl.className = 'caderno-nota-pergunta';
    perguntaEl.textContent = nota.pergunta;
    card.appendChild(perguntaEl);

    const textoEl = document.createElement('div');
    textoEl.className = 'caderno-nota-texto';
    textoEl.textContent = nota.textoCompleto;
    card.appendChild(textoEl);

    const acoes = document.createElement('div');
    acoes.className = 'caderno-nota-acoes';

    if (nota.itensLousa && nota.itensLousa.length > 0) {
      const btnAbrirLousa = document.createElement('button');
      btnAbrirLousa.type = 'button';
      btnAbrirLousa.className = 'caderno-btn';
      btnAbrirLousa.textContent = `Abrir na Lousa (${nota.itensLousa.length})`;
      btnAbrirLousa.addEventListener('click', async () => {
        fecharModalCaderno();
        await lousa.carregarItens(nota.itensLousa);
        atualizarBotaoDesafioLousa(nota.desafio ?? null);
      });
      acoes.appendChild(btnAbrirLousa);
    }

    const btnOuvir = document.createElement('button');
    btnOuvir.type = 'button';
    btnOuvir.className = 'caderno-btn';
    btnOuvir.textContent = '🔊 Ouvir novamente';
    btnOuvir.addEventListener('click', () => {
      fecharModalCaderno();
      void falarTextoCurto(nota.textoCompleto, `Lendo anotação: ${formatarRotuloMateria(nota.materia)}`);
    });
    acoes.appendChild(btnOuvir);

    const btnExcluir = document.createElement('button');
    btnExcluir.type = 'button';
    btnExcluir.className = 'caderno-btn caderno-btn-excluir';
    btnExcluir.textContent = 'Excluir';
    btnExcluir.addEventListener('click', async () => {
      await caderno.excluirNota(nota.id);
      await renderizarListaCaderno();
    });
    acoes.appendChild(btnExcluir);

    card.appendChild(acoes);
    return card;
  }

  async function renderizarListaCaderno(): Promise<void> {
    if (!cadernoListaContainer) return;
    const filtro = selectFiltroCaderno?.value || 'todas';
    const notas = await caderno.listarNotas(filtro);
    cadernoListaContainer.innerHTML = '';

    if (notas.length === 0) {
      const vazio = document.createElement('p');
      vazio.className = 'caderno-vazio';
      vazio.textContent = filtro === 'todas'
        ? 'Nenhuma anotação salva ainda. Clique em "⭐ Salvar no Caderno" após uma explicação para revisar offline.'
        : `Nenhuma anotação salva em ${formatarRotuloMateria(filtro)}.`;
      cadernoListaContainer.appendChild(vazio);
      return;
    }

    for (const nota of notas) {
      cadernoListaContainer.appendChild(criarCardNotaCaderno(nota));
    }
  }

  function fecharModalCaderno(): void {
    modalCadernoOverlay?.classList.add('hidden');
  }

  async function abrirModalCaderno(): Promise<void> {
    atualizarContadoresPratica();
    await renderizarListaCaderno();
    modalCadernoOverlay?.classList.remove('hidden');
  }

  btnAbrirCaderno?.addEventListener('click', () => {
    void abrirModalCaderno();
  });
  btnFecharModalCaderno?.addEventListener('click', fecharModalCaderno);
  btnOkModalCaderno?.addEventListener('click', fecharModalCaderno);
  modalCadernoOverlay?.addEventListener('click', (e) => {
    if (e.target === modalCadernoOverlay) fecharModalCaderno();
  });
  selectFiltroCaderno?.addEventListener('change', () => {
    void renderizarListaCaderno();
  });

  chat.definirOnSalvarNoCaderno(async (dados) => {
    await caderno.salvarNota({
      pergunta: dados.perguntaOriginal || 'Dúvida escolar salva',
      materia: dados.materia || personaAtual.materias[0] || 'geral',
      personaId: dados.personaId || personaAtual.id,
      personaNome: dados.personaNome || personaAtual.nome,
      textoCompleto: dados.texto,
      itensLousa: dados.itensLousa,
      fontes: dados.fontes,
      desafio: dados.desafio ?? null
    });
    if (modalCadernoOverlay && !modalCadernoOverlay.classList.contains('hidden')) {
      await renderizarListaCaderno();
    }
  });

  // Anexo e validação de foto do exercício (RF04, RNF01, RNF02, CA06, CA07)
  function limparFotoAnexada(): void {
    imagemAnexadaAtual = null;
    if (inputFotoExercicio) inputFotoExercicio.value = '';
    if (fotoPreviewImg) fotoPreviewImg.src = '';
    fotoPreviewBar?.classList.add('hidden');
  }

  function exibirErroFoto(mensagem?: string): void {
    if (!fotoErroMsg) return;
    if (mensagem) {
      fotoErroMsg.textContent = `⚠️ ${mensagem}`;
      fotoErroMsg.classList.remove('hidden');
    } else {
      fotoErroMsg.textContent = '';
      fotoErroMsg.classList.add('hidden');
    }
  }

  btnFotoExercicio?.addEventListener('click', () => {
    exibirErroFoto();
    inputFotoExercicio?.click();
  });

  btnRemoverFoto?.addEventListener('click', () => {
    limparFotoAnexada();
    exibirErroFoto();
  });

  inputFotoExercicio?.addEventListener('change', async () => {
    exibirErroFoto();
    const arquivo = inputFotoExercicio.files?.[0];
    if (!arquivo) return;

    try {
      const imagemPreparada = await prepararImagemParaEnvio(arquivo);
      imagemAnexadaAtual = imagemPreparada;
      if (fotoPreviewImg && imagemPreparada.dataUrl) {
        fotoPreviewImg.src = imagemPreparada.dataUrl;
      }
      if (fotoPreviewNome) {
        fotoPreviewNome.textContent = arquivo.name || 'Foto do exercício';
      }
      fotoPreviewBar?.classList.remove('hidden');
    } catch (erro: any) {
      limparFotoAnexada();
      exibirErroFoto(erro?.message || 'Arquivo inválido. Selecione uma foto JPG, PNG ou WebP.');
    }
  });

  // Base de Conhecimento e Cache - Carregamento sob demanda sem bloquear renderização (RF12, CA12)
  let indiceConhecimento: IndiceConhecimento | null = null;
  const gerenciadorCache = new GerenciadorCacheConhecimento();

  async function carregarConhecimentoAssincrono(): Promise<void> {
    try {
      const respCache = await fetch('./conhecimento/cache.json');
      if (respCache.ok) {
        const itensCache = await respCache.json();
        gerenciadorCache.carregarCachePreConstruido(itensCache);
      }
    } catch {
      // Ignora falha de cache se offline ou ausente
    }

    try {
      const respIndice = await fetch('./conhecimento/indice.json');
      if (respIndice.ok) {
        indiceConhecimento = await respIndice.json();
      }
    } catch {
      // Ignora falha de índice
    }
  }

  setTimeout(() => {
    carregarConhecimentoAssincrono();
  }, 100);

  // Ouve evento disparado pela lousa para fazer o avatar apontar (RF09, CA13)
  document.addEventListener('lousa:item-exibido', (evento) => {
    const elemento = (evento as CustomEvent<{ elemento?: HTMLElement }>).detail?.elemento ?? null;
    avatar.apontarParaLousa(1800, elemento);
  });

  // Atualiza estado visual da chave
  function atualizarStatusChave(): boolean {
    const key = getStoredApiKey();
    const pronta = key.length > 0;

    if (statusIndicator && statusLabel) {
      if (pronta) {
        statusIndicator.className = 'status-dot-indicator configured';
        statusLabel.textContent = 'IA Pronta';
      } else {
        statusIndicator.className = 'status-dot-indicator unconfigured';
        statusLabel.textContent = 'Chave Ausente';
      }
    }

    if (blockingBanner) {
      if (pronta) {
        blockingBanner.classList.remove('active');
      } else {
        blockingBanner.classList.add('active');
      }
    }

    if (btnMic) btnMic.disabled = !pronta;
    if (textInput) textInput.disabled = !pronta;
    if (btnSendText) btnSendText.disabled = !pronta;
    if (btnFotoExercicio) btnFotoExercicio.disabled = !pronta;

    return pronta;
  }

  atualizarStatusChave();

  // Fluxo principal de processamento de dúvidas com Espera Ativa e Streaming
  async function processarPergunta(pergunta: string): Promise<void> {
    const textoLimpo = pergunta.trim();
    if (!textoLimpo && !imagemAnexadaAtual) return;

    const apiKey = getStoredApiKey();
    if (!apiKey) {
      window.location.href = './configuracoes.html?origem=tutor';
      return;
    }

    // Interrompe qualquer espera, fala ou requisição anterior (RF11, CA13)
    const currentSequence = ++speechSequenceId;
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const currentSignal = activeAbortController.signal;

    controladorEspera.cancelarEspera();
    if (servicoVoz.estaFalando()) {
      await servicoVoz.pararDeFalar();
    }
    avatar.pararFala();
    avatarModule?.removeAttribute('data-expressao');

    // Limpa a lousa e o rodapé de desafio ao chegar uma nova pergunta (RF10, CA14)
    lousa.limpar();
    atualizarBotaoDesafioLousa(null);

    const fotoParaEnvio = imagemAnexadaAtual;
    const miniaturaParaChat = fotoParaEnvio?.dataUrl;
    limparFotoAnexada();
    exibirErroFoto();

    const modoPedagogico: ModoPedagogico =
      selectModoPedagogico?.value === 'dica' ? 'dica' : 'completo';
    const textoParaEnviar =
      textoLimpo || 'Analise a imagem deste exercício escolar e ajude a resolver.';
    const textoExibidoAluno = textoLimpo || '📷 Foto do exercício';

    // Escolhe a persona antes de responder: mantém a atual em perguntas de acompanhamento (RF01, RF07)
    const materiaDetectada = detectarMateria(textoExibidoAluno);
    const personaFixaId = getStoredPersonaFixa();
    aplicarPersona(
      materiaDetectada || personaFixaId
        ? resolverPersona(materiaDetectada, personaAtual, personaFixaId)
        : personaSugeridaPeloGemini || personaAtual
    );
    personaSugeridaPeloGemini = null;

    const serieAtual = getStoredSerieEscolar();
    const historicoParaEnvio = chat.obterHistoricoParaGemini();

    // 1. Adiciona a mensagem do aluno no chat (com miniatura se houver foto - RF04)
    chat.adicionarMensagem('student', textoExibidoAluno, null, null, null, {
      miniaturaUsuarioUrl: miniaturaParaChat,
      materia: materiaDetectada || personaAtual.materias[0] || undefined
    });

    // 2. Inicia comportamento de espera ativa imediata (RF01 - RF05, CA01 - CA06)
    // Funciona inclusive offline (RNF01)
    controladorEspera.iniciarEspera(textoParaEnviar);

    // 3. Consulta ao Cache (apenas quando não houver foto nem modo Dica Socrática)
    const livrosDesativados = getStoredDisabledBookIds();
    if (!fotoParaEnvio && modoPedagogico === 'completo') {
      try {
        const respostaEmCache = await gerenciadorCache.buscarEmCache(textoParaEnviar, { livrosDesativados });
        if (respostaEmCache) {
          if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

          // Resposta imediata do cache (<= 300ms, offline) com balão progressivo (RF03, CA04)
          await controladorEspera.notificarPrimeiraEtapaChegou();

          const materiaCache = respostaEmCache.materia || materiaDetectada || personaAtual.materias[0] || 'geral';
          const controleBolhaCache = chat.iniciarMensagemProgressiva({
            desafio: respostaEmCache.desafio ?? null,
            perguntaOriginal: textoExibidoAluno,
            materia: materiaCache,
            personaId: personaAtual.id,
            personaNome: personaAtual.nome
          });

          for (const etapa of respostaEmCache.etapas) {
            if (speechSequenceId !== currentSequence || currentSignal.aborted) break;
            if (etapa.lousa) {
              await lousa.adicionarItem(etapa.lousa);
            }
            if (etapa.fala && etapa.fala.trim()) {
              controleBolhaCache.acrescentarEtapa(etapa.fala);
              avatar.definirEstado('speaking');
              const opcoesVoz = obterOpcoesVoz();
              await servicoVoz.falar(
                etapa.fala,
                {
                  onStart: () => {
                    if (speechSequenceId === currentSequence) avatar.definirEstado('speaking');
                  },
                  onBoundary: (_charIndex, word) => {
                    if (speechSequenceId === currentSequence) avatar.notificarPalavraFalada(word);
                  },
                  onEnd: () => {
                    if (speechSequenceId === currentSequence) {
                      avatar.pararFala();
                      avatar.definirEstado('idle');
                    }
                  },
                  onError: () => {
                    if (speechSequenceId === currentSequence) {
                      avatar.pararFala();
                      avatar.definirEstado('idle');
                    }
                  }
                },
                opcoesVoz
              );
            }
          }

          if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

          const itensLousaCache = respostaEmCache.itensLousa.length > 0
            ? respostaEmCache.itensLousa
            : lousa.obterItensAtuais();

          atualizarBotaoDesafioLousa(respostaEmCache.desafio ?? null);
          caderno.registrarDuvidaRespondida();
          atualizarContadoresPratica();

          controleBolhaCache.finalizar({
            textoCompleto: respostaEmCache.textoCompleto,
            itensLousa: itensLousaCache.length > 0 ? itensLousaCache : null,
            imagemUrl: respostaEmCache.imagem_url,
            fontes: respostaEmCache.fontes,
            opcoes: {
              desafio: respostaEmCache.desafio ?? null,
              perguntaOriginal: textoExibidoAluno,
              materia: materiaCache,
              personaId: personaAtual.id,
              personaNome: personaAtual.nome
            }
          });

          avatar.definirEstado('idle');
          return;
        }
      } catch (cacheErr) {
        console.warn('Erro ao consultar cache de conhecimento:', cacheErr);
      }
    }

    // 4. Busca trechos relevantes nos livros escolares via BM25 com boost de série (RF04, RF05)
    const resultadosBusca = textoLimpo
      ? buscarTrechosRelevantes(textoLimpo, indiceConhecimento, {
          livrosDesativados,
          serie: serieAtual || undefined
        })
      : [];
    const trechosContexto = resultadosBusca.map(r => r.trecho);

    // 5. Fila de etapas com balão progressivo sincronizado com a fala (RF03, CA04)
    const filaEtapas: EtapaExplicacao[] = [];
    let primeiraEtapaIniciada = false;
    let processandoFila = false;
    let streamFinalizado = false;
    let bolhaFinalizada = false;
    let controleBolhaGemini: ControleBolhaProgressiva | null = null;
    let respostaFinalGemini: RespostaDidatica | null = null;

    function finalizarBolhaGeminiSePronta(): void {
      if (bolhaFinalizada || !streamFinalizado || !respostaFinalGemini) return;
      if (processandoFila || filaEtapas.length > 0) return;
      if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

      bolhaFinalizada = true;
      const resp = respostaFinalGemini;
      const materiaNormalizada = normalizarMateria(resp.materia);
      const materiaFinal = materiaNormalizada || materiaDetectada || personaAtual.materias[0] || 'geral';

      if (!controleBolhaGemini) {
        controleBolhaGemini = chat.iniciarMensagemProgressiva({
          perguntaOriginal: textoExibidoAluno,
          materia: materiaFinal,
          personaId: personaAtual.id,
          personaNome: personaAtual.nome
        });
      }

      const itensLousaFinais = resp.itensLousa.length > 0 ? resp.itensLousa : lousa.obterItensAtuais();
      controleBolhaGemini.finalizar({
        textoCompleto: resp.textoCompleto,
        itensLousa: itensLousaFinais.length > 0 ? itensLousaFinais : null,
        imagemUrl: resp.imagem_url,
        fontes: resp.fontes,
        opcoes: {
          desafio: resp.desafio ?? null,
          perguntaOriginal: textoExibidoAluno,
          materia: materiaFinal,
          personaId: personaAtual.id,
          personaNome: personaAtual.nome
        }
      });

      if (itensLousaFinais.length === 0) {
        lousa.fechar();
      }
    }

    async function consumirFilaEtapas(): Promise<void> {
      if (processandoFila) return;
      processandoFila = true;

      while (filaEtapas.length > 0) {
        if (speechSequenceId !== currentSequence || currentSignal.aborted) break;
        const etapa = filaEtapas.shift()!;

        // Passagem de vez da espera para a explicação (RF06, RF07, CA07, CA08)
        if (!primeiraEtapaIniciada) {
          primeiraEtapaIniciada = true;
          await controladorEspera.notificarPrimeiraEtapaChegou();
        }

        if (speechSequenceId !== currentSequence || currentSignal.aborted) break;

        if (!controleBolhaGemini) {
          controleBolhaGemini = chat.iniciarMensagemProgressiva({
            perguntaOriginal: textoExibidoAluno,
            materia: materiaDetectada || personaAtual.materias[0] || 'geral',
            personaId: personaAtual.id,
            personaNome: personaAtual.nome
          });
        }

        // Se a etapa tiver lousa, exibe no início da etapa (RF04, CA05, CA10)
        if (etapa.lousa) {
          await lousa.adicionarItem(etapa.lousa);
        }

        if (speechSequenceId !== currentSequence || currentSignal.aborted) break;

        // Atualiza texto do balão assim que a etapa começa a ser falada (RF03, CA04)
        if (etapa.fala && etapa.fala.trim()) {
          controleBolhaGemini.acrescentarEtapa(etapa.fala);
          avatar.definirEstado('speaking');

          const opcoesVoz = obterOpcoesVoz();

          await servicoVoz.falar(
            etapa.fala,
            {
              onStart: () => {
                if (speechSequenceId === currentSequence) {
                  avatar.definirEstado('speaking');
                }
              },
              onBoundary: (_charIndex, word) => {
                if (speechSequenceId === currentSequence) {
                  avatar.notificarPalavraFalada(word);
                }
              },
              onEnd: () => {
                if (filaEtapas.length === 0 && streamFinalizado && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              },
              onError: () => {
                if (filaEtapas.length === 0 && streamFinalizado && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              }
            },
            opcoesVoz
          );
        }
      }

      processandoFila = false;

      if (streamFinalizado && filaEtapas.length === 0 && speechSequenceId === currentSequence) {
        avatar.pararFala();
        avatar.definirEstado('idle');
      }
      finalizarBolhaGeminiSePronta();
    }

    try {
      // 6. Chamada à API com Histórico Multi-turno, Série Escolar, Streaming SSE, Modo Dica e Imagem
      const resposta = await callGeminiApi(textoParaEnviar, apiKey, {
        signal: currentSignal,
        trechosContexto: trechosContexto.length > 0 ? trechosContexto : undefined,
        modoPedagogico,
        imagem: fotoParaEnvio || undefined,
        historico: historicoParaEnvio.length > 0 ? historicoParaEnvio : undefined,
        serieEscolar: serieAtual || undefined,
        onEtapaRecebida: (novaEtapa) => {
          if (speechSequenceId !== currentSequence || currentSignal.aborted) return;
          filaEtapas.push(novaEtapa);
          void consumirFilaEtapas();
        }
      });

      streamFinalizado = true;
      respostaFinalGemini = resposta;

      if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

      // Salva no cache apenas perguntas de texto no modo completo sem histórico anterior
      if (!fotoParaEnvio && modoPedagogico === 'completo' && textoLimpo && historicoParaEnvio.length === 0) {
        gerenciadorCache.salvarNoCacheExecucao(textoLimpo, resposta);
      }

      // Matéria vinda do Gemini vale para a próxima pergunta sem matéria detectada (RF13)
      const materiaNormalizada = normalizarMateria(resposta.materia);
      if (!materiaDetectada) {
        personaSugeridaPeloGemini = obterPersonaPorMateria(materiaNormalizada);
      }

      atualizarBotaoDesafioLousa(resposta.desafio ?? null);
      caderno.registrarDuvidaRespondida();
      atualizarContadoresPratica();

      // Se nenhuma etapa foi emitida via stream (fallback de formato único RF09 / CA11)
      if (!primeiraEtapaIniciada && filaEtapas.length === 0) {
        resposta.etapas.forEach(e => filaEtapas.push(e));
        void consumirFilaEtapas();
      } else if (filaEtapas.length > 0) {
        void consumirFilaEtapas();
      } else if (!processandoFila && !servicoVoz.estaFalando() && speechSequenceId === currentSequence) {
        avatar.pararFala();
        avatar.definirEstado('idle');
      }

      finalizarBolhaGeminiSePronta();
    } catch (erro: any) {
        if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

        controladorEspera.notificarErro();

        console.error('Erro ao processar dúvida escolar:', erro);
        const mensagemErro =
          'Desculpe, ocorreu uma instabilidade ao buscar sua resposta. Por favor, verifique sua API Key nas Configurações.';
        chat.adicionarMensagem('tutor', mensagemErro, null, null, null, { omitirHistorico: true });
        avatar.definirEstado('idle', 'Ocorreu um erro.');

        await servicoVoz.falar(mensagemErro, {
          onBoundary: (_charIndex, word) => avatar.notificarPalavraFalada(word),
          onEnd: () => {
            avatar.pararFala();
            avatar.definirEstado('idle');
          },
          onError: () => {
            avatar.pararFala();
            avatar.definirEstado('idle');
          }
        }, obterOpcoesVoz());
      }
    }

  // Interrupção e Controle do Microfone (voz) (RF11, CA13)
  if (btnMic) {
      btnMic.addEventListener('click', async () => {
        if (!hasApiKey()) {
          window.location.href = './configuracoes.html?origem=tutor';
          return;
        }

        // Se estiver falando ou esperando, cancela imediatamente (RF11, CA13)
        if (servicoVoz.estaFalando() || controladorEspera.estaAtiva()) {
          speechSequenceId++;
          if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
          }
          controladorEspera.cancelarEspera();
          await servicoVoz.pararDeFalar();
          avatar.pararFala();
          avatar.definirEstado('idle');
          return;
        }

        if (servicoVoz.estaOuvindo()) {
          await servicoVoz.pararDeOuvir();
          avatar.definirEstado('idle');
          return;
        }

        await servicoVoz.ouvir({
          onStart: () => {
            avatar.definirEstado('listening', 'Estou ouvindo... pode falar!');
          },
          onInterim: (interimTexto) => {
            avatar.atualizarMensagem(`"${interimTexto}..."`);
          },
          onFinal: (finalTexto) => {
            avatar.atualizarMensagem(`"${finalTexto}"`);
            if (lousa.responderQuizAtivoPorVoz(finalTexto)) {
              return;
            }
            processarPergunta(finalTexto);
          },
          onError: (erroMsg) => {
            avatar.definirEstado('idle', erroMsg);
            chat.adicionarMensagem('tutor', `⚠️ ${erroMsg}`);
          },
          onEnd: () => {
            if (avatar.obterEstado() === 'listening') {
              avatar.definirEstado('idle');
            }
          }
        });
      });
    }

    // Interação do Fallback de Texto
    function dispararEnvioTexto(): void {
      const val = textInput ? textInput.value.trim() : '';
      if (val || imagemAnexadaAtual) {
        if (textInput) textInput.value = '';
        processarPergunta(val);
      }
    }

    if (btnSendText) {
      btnSendText.addEventListener('click', dispararEnvioTexto);
    }

    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          dispararEnvioTexto();
        }
      });
    }

    // Lightbox overlay para fechar ao clicar e modais fecham com Escape (RF07a, CA09)
    if (lightboxOverlay) {
      lightboxOverlay.addEventListener('click', () => {
        lightboxOverlay.classList.remove('active');
      });
    }
    configurarFechamentoModaisEscape(
      lightboxOverlay,
      modalFonteOverlay,
      fecharModalFonte,
      modalCadernoOverlay,
      fecharModalCaderno
    );
  });
