/**
 * TUTORIA - Script da Página do Tutor (tutor.html)
 * Orquestra Avatar, Voz, Lousa Didática, Chat, Espera Ativa, Chamada ao Gemini com Streaming e Lightbox.
 */

import { getStoredApiKey, getStoredSpeechRate, getStoredVoiceUri, hasApiKey } from './armazenamento';
import { AvatarControlador } from './avatar';
import { ChatGerenciador } from './chat';
import { ControladorEspera } from './espera';
import { callGeminiApi, EtapaExplicacao } from './gemini';
import { LousaControlador } from './lousa';
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

  // Inicializa Avatar
  const avatar = new AvatarControlador({
    moduloElemento: avatarModule,
    statusTextoElemento: statusText,
    micBotaoElemento: btnMic,
    micDicaElemento: micTip
  });

  const servicoVoz = obterServicoVoz();

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
    obterConfigVoz: () => ({
      voiceUri: getStoredVoiceUri(),
      rate: getStoredSpeechRate()
    })
  });

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

  // Ouve evento disparado pela lousa para fazer o avatar apontar (RF09, CA13)
  document.addEventListener('lousa:item-exibido', () => {
    avatar.apontarParaLousa(1800);
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

    // 1. Adiciona a mensagem do aluno no chat
    chat.adicionarMensagem('student', textoLimpo);

    // 2. Inicia comportamento de espera ativa imediata (RF01 - RF05, CA01 - CA06)
    // Funciona inclusive offline (RNF01)
    controladorEspera.iniciarEspera(textoLimpo);

    // 3. Fila de etapas para streaming e reprodução sequencial sem travamentos (RF04, RF08, CA09, CA10)
    const filaEtapas: EtapaExplicacao[] = [];
    let primeiraEtapaIniciada = false;
    let processandoFila = false;
    let bolhaChatCriada = false;

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

          const voiceUri = getStoredVoiceUri();
          const rate = getStoredSpeechRate();

          await servicoVoz.falar(
            etapa.fala,
            {
              onStart: () => {
                if (speechSequenceId === currentSequence) {
                  avatar.definirEstado('speaking');
                }
              },
              onBoundary: () => {
                if (speechSequenceId === currentSequence) {
                  avatar.notificarPalavraFalada();
                }
              },
              onEnd: () => {
                if (filaEtapas.length === 0 && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              },
              onError: () => {
                if (filaEtapas.length === 0 && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              }
            },
            { voiceUri, rate }
          );
        }
      }

      processandoFila = false;
    }

    try {
      // 4. Chamada à API com Streaming SSE e fallback incremental (RF08, RF09, RF10, CA09 - CA12)
      const resposta = await callGeminiApi(textoLimpo, apiKey, {
        signal: currentSignal,
        onEtapaRecebida: (novaEtapa) => {
          if (speechSequenceId !== currentSequence || currentSignal.aborted) return;
          filaEtapas.push(novaEtapa);
          consumirFilaEtapas();
        }
      });

      if (speechSequenceId !== currentSequence || currentSignal.aborted) return;

      // Se nenhuma etapa foi emitida via stream (fallback de formato único RF09 / CA11)
      if (!primeiraEtapaIniciada) {
        resposta.etapas.forEach(e => filaEtapas.push(e));
        consumirFilaEtapas();
      }

      // 5. Exibe a resposta completa no chat (RF02, CA03, CA12)
      if (!bolhaChatCriada) {
        bolhaChatCriada = true;
        chat.adicionarMensagem(
          'tutor',
          resposta.textoCompleto,
          resposta.itensLousa.length > 0 ? resposta.itensLousa : null,
          resposta.imagem_url
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
        onBoundary: () => avatar.notificarPalavraFalada(),
        onEnd: () => {
          avatar.pararFala();
          avatar.definirEstado('idle');
        },
        onError: () => {
          avatar.pararFala();
          avatar.definirEstado('idle');
        }
      });
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
