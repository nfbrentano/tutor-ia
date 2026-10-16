/**
 * TUTORIA - Script da Página do Tutor (tutor.html)
 * Orquestra Avatar, Voz, Lousa Didática, Chat, Chamada ao Gemini e Lightbox.
 */

import { getStoredApiKey, getStoredSpeechRate, getStoredVoiceUri, hasApiKey } from './armazenamento';
import { AvatarControlador } from './avatar';
import { ChatGerenciador } from './chat';
import { callGeminiApi } from './gemini';
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

  // Controle de Sequência de Fala (para cancelamento/interrupção)
  let speechSequenceId = 0;

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

  // Fluxo principal de processamento de dúvidas
  async function processarPergunta(pergunta: string): Promise<void> {
    const textoLimpo = pergunta.trim();
    if (!textoLimpo) return;

    const apiKey = getStoredApiKey();
    if (!apiKey) {
      window.location.href = './configuracoes.html?origem=tutor';
      return;
    }

    // Interrompe qualquer fala ou sequência anterior
    const currentSequence = ++speechSequenceId;
    if (servicoVoz.estaFalando()) {
      await servicoVoz.pararDeFalar();
    }
    avatar.pararFala();

    // Limpa a lousa ao chegar uma nova pergunta (RF10, CA14)
    lousa.limpar();

    // 1. Adiciona a mensagem do aluno no chat
    chat.adicionarMensagem('student', textoLimpo);

    // 2. Avatar entra no estado "pensando"
    avatar.definirEstado('thinking');

    try {
      // 3. Chamada ao Gemini com suporte a etapas didáticas
      const resposta = await callGeminiApi(textoLimpo, apiKey);

      if (speechSequenceId !== currentSequence) return;

      // 4. Exibe resposta completa no balão de chat (RF02, CA03, CA12)
      chat.adicionarMensagem(
        'tutor',
        resposta.textoCompleto,
        resposta.itensLousa.length > 0 ? resposta.itensLousa : null,
        resposta.imagem_url
      );

      // 5. Se não houver itens de lousa, garante que a lousa permaneça fechada (CA02)
      if (resposta.itensLousa.length === 0) {
        lousa.fechar();
      }

      // 6. Fala vocalizada sequencial por etapas com sincronização da lousa (RF04, CA03, CA05)
      const voiceUri = getStoredVoiceUri();
      const rate = getStoredSpeechRate();

      for (let i = 0; i < resposta.etapas.length; i++) {
        if (speechSequenceId !== currentSequence) break;
        const etapa = resposta.etapas[i];

        // Se a etapa possui item de lousa, exibe no onstart da etapa (RF04, CA05)
        if (etapa.lousa) {
          await lousa.adicionarItem(etapa.lousa);
        }

        if (speechSequenceId !== currentSequence) break;

        if (etapa.fala && etapa.fala.trim()) {
          avatar.definirEstado('speaking');

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
                // Última etapa concluída
                if (i === resposta.etapas.length - 1 && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              },
              onError: () => {
                if (i === resposta.etapas.length - 1 && speechSequenceId === currentSequence) {
                  avatar.pararFala();
                  avatar.definirEstado('idle');
                }
              }
            },
            { voiceUri, rate }
          );
        }
      }

      if (speechSequenceId === currentSequence) {
        avatar.pararFala();
        avatar.definirEstado('idle');
      }
    } catch (erro: any) {
      if (speechSequenceId !== currentSequence) return;

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

  // Interação do Microfone (voz)
  if (btnMic) {
    btnMic.addEventListener('click', async () => {
      if (!hasApiKey()) {
        window.location.href = './configuracoes.html?origem=tutor';
        return;
      }

      if (servicoVoz.estaFalando()) {
        speechSequenceId++;
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
