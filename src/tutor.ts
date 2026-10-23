/**
 * TUTORIA - Script da Página do Tutor (tutor.html)
 * Orquestra Avatar, Voz, Lousa Didática, Chat, Espera Ativa, Chamada ao Gemini com Streaming e Lightbox.
 */

import {
  getStoredApiKey,
  getStoredAvatarMode,
  getStoredDisabledBookIds,
  getStoredPersonaFixa,
  getStoredSpeechRate,
  getStoredVoiceUri,
  hasApiKey
} from './armazenamento';
import { AvatarControlador, ControladorAvatar } from './avatar';
import { ChatGerenciador } from './chat';
import {
  buscarTrechosRelevantes,
  FonteCitada,
  GerenciadorCacheConhecimento,
  IndiceConhecimento,
  TrechoLivro
} from './conhecimento';
import { ControladorEspera } from './espera';
import { callGeminiApi, EtapaExplicacao } from './gemini';
import { LousaControlador } from './lousa';
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
import { obterServicoVoz } from './voz';

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

  // Lousa Didática e Lightbox (RF01, RF07, RNF04)
  const lousaPanel = document.getElementById('lousa-board');
  const lousaBody = document.getElementById('lousa-body');
  const btnCloseLousa = document.getElementById('btn-close-lousa');
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement | null;

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
      .catch(() => {});
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
  }
  exibirCreditoPersona();

  function aplicarPersona(nova: Persona): void {
    if (nova.id === personaAtual.id) return;
    personaAtual = nova;
    exibirCreditoPersona();
    avatar.definirPersona?.(nova);
  }

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

  // Inicializa Chat com suporte ao botão "Ver na Lousa" (RF08, CA12)
  const chat = new ChatGerenciador(
    chatStream!,
    (itens) => {
      lousa.carregarItens(itens);
    },
    (url, legenda) => {
      abrirLightbox(url, legenda);
    }
  );

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

    return pronta;
  }

  atualizarStatusChave();

  // Fluxo principal de processamento de dúvidas com Espera Ativa e Streaming
  async function processarPergunta(pergunta: string): Promise<void> {
    const textoLimpo = pergunta.trim();
    if (!textoLimpo) return;

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

    // Limpa a lousa ao chegar uma nova pergunta (RF10, CA14)
    lousa.limpar();

    // Escolhe a persona antes de responder: a fala anterior já foi interrompida (RF07)
    const materiaDetectada = detectarMateria(textoLimpo);
    const personaFixaId = getStoredPersonaFixa();
    aplicarPersona(
      materiaDetectada || personaFixaId
        ? resolverPersona(materiaDetectada, personaAtual, personaFixaId)
        : personaSugeridaPeloGemini || personaAtual
    );
    personaSugeridaPeloGemini = null;

    // 1. Adiciona a mensagem do aluno no chat
    chat.adicionarMensagem('student', textoLimpo);

    // 2. Inicia comportamento de espera ativa imediata (RF01 - RF05, CA01 - CA06)
    // Funciona inclusive offline (RNF01)
    controladorEspera.iniciarEspera(textoLimpo);

    // 3. Consulta ao Cache (Pré-construído e IndexedDB) (RF07, RF08, RNF06, CA07, CA08, CA09)
    try {
      const respostaEmCache = await gerenciadorCache.buscarEmCache(textoLimpo);
      if (respostaEmCache) {
        if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

        // Resposta imediata do cache (<= 300ms, offline)
        await controladorEspera.notificarPrimeiraEtapaChegou();

        for (const etapa of respostaEmCache.etapas) {
          if (speechSequenceId !== currentSequence || currentSignal.aborted) break;
          if (etapa.lousa) {
            await lousa.adicionarItem(etapa.lousa);
          }
          if (etapa.fala && etapa.fala.trim()) {
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

        chat.adicionarMensagem(
          'tutor',
          respostaEmCache.textoCompleto,
          respostaEmCache.itensLousa.length > 0 ? respostaEmCache.itensLousa : null,
          respostaEmCache.imagem_url,
          respostaEmCache.fontes
        );

        avatar.definirEstado('idle');
        return;
      }
    } catch (cacheErr) {
      console.warn('Erro ao consultar cache de conhecimento:', cacheErr);
    }

    // 4. Busca trechos relevantes nos livros escolares via BM25 (RF04, RF05, RF06, CA04, CA05, CA11)
    const livrosDesativados = getStoredDisabledBookIds();
    const resultadosBusca = buscarTrechosRelevantes(textoLimpo, indiceConhecimento, { livrosDesativados });
    const trechosContexto = resultadosBusca.map(r => r.trecho);

    // 5. Fila de etapas para streaming e reprodução sequencial sem travamentos (RF04, RF08, CA09, CA10)
    const filaEtapas: EtapaExplicacao[] = [];
    let primeiraEtapaIniciada = false;
    let processandoFila = false;
    let bolhaChatCriada = false;
    let streamFinalizado = false;

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

        // Se a etapa tiver lousa, exibe no início da etapa (RF04, CA05, CA10)
        if (etapa.lousa) {
          await lousa.adicionarItem(etapa.lousa);
        }

        if (speechSequenceId !== currentSequence || currentSignal.aborted) break;

        // Fala vocalizada da etapa
        if (etapa.fala && etapa.fala.trim()) {
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
    }

    try {
      // 6. Chamada à API com Streaming SSE e contexto dos livros escolares (RF05, RF08, CA04, CA09)
      const resposta = await callGeminiApi(textoLimpo, apiKey, {
        signal: currentSignal,
        trechosContexto: trechosContexto.length > 0 ? trechosContexto : undefined,
        onEtapaRecebida: (novaEtapa) => {
          if (speechSequenceId !== currentSequence || currentSignal.aborted) return;
          if (!primeiraEtapaIniciada) {
            primeiraEtapaIniciada = true;
            controladorEspera.notificarPrimeiraEtapaChegou();
          }
          filaEtapas.push(novaEtapa);
          consumirFilaEtapas();
        }
      });

      streamFinalizado = true;

      if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

      // Salva a resposta gerada no cache de execução (IndexedDB) para reaproveitamento (RF08, CA09)
      gerenciadorCache.salvarNoCacheExecucao(textoLimpo, resposta);

      // Matéria vinda do Gemini vale para a próxima pergunta sem matéria detectada (RF13)
      if (!materiaDetectada) {
        personaSugeridaPeloGemini = obterPersonaPorMateria(normalizarMateria(resposta.materia));
      }

      // Se nenhuma etapa foi emitida via stream (fallback de formato único RF09 / CA11)
      if (!primeiraEtapaIniciada) {
        primeiraEtapaIniciada = true;
        await controladorEspera.notificarPrimeiraEtapaChegou();
        resposta.etapas.forEach(e => filaEtapas.push(e));
        consumirFilaEtapas();
      } else if (filaEtapas.length > 0) {
        consumirFilaEtapas();
      } else if (!servicoVoz.estaFalando() && speechSequenceId === currentSequence) {
        avatar.pararFala();
        avatar.definirEstado('idle');
      }

      // 7. Exibe a resposta completa no chat com fontes (RF02, RF09, CA06, CA10, CA12)
      if (!bolhaChatCriada) {
        bolhaChatCriada = true;
        chat.adicionarMensagem(
          'tutor',
          resposta.textoCompleto,
          resposta.itensLousa.length > 0 ? resposta.itensLousa : null,
          resposta.imagem_url,
          resposta.fontes
        );
      }

      // Se a resposta final não contiver itens de lousa e nada estiver aberto, fecha
      if (resposta.itensLousa.length === 0 && lousa.obterItensAtuais().length === 0) {
        lousa.fechar();
      }
    } catch (erro: any) {
      if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

      controladorEspera.notificarErro();

      console.error('Erro ao processar dúvida escolar:', erro);
      const mensagemErro =
        'Desculpe, ocorreu uma instabilidade ao buscar sua resposta. Por favor, verifique sua API Key nas Configurações.';
      chat.adicionarMensagem('tutor', mensagemErro);
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
    if (!textInput) return;
    const val = textInput.value.trim();
    if (val) {
      textInput.value = '';
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

  // Lightbox overlay para fechar ao clicar
  if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', () => {
      lightboxOverlay.classList.remove('active');
    });
  }
});
