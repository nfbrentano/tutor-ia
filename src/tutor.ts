/**
 * TUTORIA - Script da Página do Tutor (tutor.html)
 * Orquestra Avatar, Voz, Chat, Chamada ao Gemini e Mídia Didática.
 */

import { getStoredApiKey, getStoredSpeechRate, getStoredVoiceUri, hasApiKey } from './armazenamento';
import { AvatarControlador } from './avatar';
import { ChatGerenciador } from './chat';
import { callGeminiApi } from './gemini';
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

  // Pop-up e Lightbox
  const mediaPopup = document.getElementById('media-popup');
  const mediaPopupImg = document.getElementById('media-popup-img') as HTMLImageElement | null;
  const mediaPopupCaption = document.getElementById('media-popup-caption');
  const btnClosePopup = document.getElementById('btn-close-popup');
  const lightboxOverlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement | null;

  // Inicializa Controladores
  const avatar = new AvatarControlador({
    moduloElemento: avatarModule,
    statusTextoElemento: statusText,
    micBotaoElemento: btnMic,
    micDicaElemento: micTip
  });

  const servicoVoz = obterServicoVoz();

  function showMediaPopup(url: string, caption = ''): void {
    if (!mediaPopup || !mediaPopupImg) return;
    mediaPopupImg.src = url;
    if (mediaPopupCaption) {
      mediaPopupCaption.textContent = caption || 'Material visual didático complementar.';
    }
    mediaPopup.classList.add('visible');

    mediaPopupImg.onerror = () => {
      hideMediaPopup();
    };
  }

  function hideMediaPopup(): void {
    if (mediaPopup) mediaPopup.classList.remove('visible');
  }

  const chat = new ChatGerenciador(chatStream!, (url, caption) => {
    showMediaPopup(url, caption);
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

  // Fluxo principal de processamento
  async function processarPergunta(pergunta: string): Promise<void> {
    const textoLimpo = pergunta.trim();
    if (!textoLimpo) return;

    const apiKey = getStoredApiKey();
    if (!apiKey) {
      window.location.href = './configuracoes.html?origem=tutor';
      return;
    }

    // 1. Mensagem no chat
    chat.adicionarMensagem('student', textoLimpo);

    // 2. Avatar pensando
    avatar.definirEstado('thinking');

    try {
      // 3. Chamada à API
      const resposta = await callGeminiApi(textoLimpo, apiKey);

      // 4. Exibe resposta
      chat.adicionarMensagem('tutor', resposta.texto, resposta.imagem_url);

      // 5. Mídia didática
      if (resposta.imagem_url) {
        showMediaPopup(resposta.imagem_url, `Ilustração sobre: "${textoLimpo}"`);
      } else {
        hideMediaPopup();
      }

      // 6. Fala vocalizada sincronizada com o Avatar
      avatar.definirEstado('speaking');
      const voiceUri = getStoredVoiceUri();
      const rate = getStoredSpeechRate();

      await servicoVoz.falar(
        resposta.texto,
        {
          onEnd: () => {
            avatar.definirEstado('idle');
          },
          onError: () => {
            avatar.definirEstado('idle');
          }
        },
        { voiceUri, rate }
      );
    } catch (erro: any) {
      console.error('Erro ao processar dúvida escolar:', erro);
      const mensagemErro =
        'Desculpe, ocorreu uma instabilidade ao buscar sua resposta. Por favor, verifique sua API Key nas Configurações.';
      chat.adicionarMensagem('tutor', mensagemErro);
      avatar.definirEstado('idle', 'Ocorreu um erro.');

      await servicoVoz.falar(mensagemErro, {
        onEnd: () => avatar.definirEstado('idle'),
        onError: () => avatar.definirEstado('idle')
      });
    }
  }

  // Interação do Microfone
  if (btnMic) {
    btnMic.addEventListener('click', async () => {
      if (!hasApiKey()) {
        window.location.href = './configuracoes.html?origem=tutor';
        return;
      }

      if (servicoVoz.estaFalando()) {
        await servicoVoz.pararDeFalar();
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

  // Pop-up e Lightbox
  if (btnClosePopup) {
    btnClosePopup.addEventListener('click', hideMediaPopup);
  }

  if (mediaPopupImg && lightboxOverlay && lightboxImg) {
    mediaPopupImg.addEventListener('click', () => {
      lightboxImg.src = mediaPopupImg.src;
      lightboxOverlay.classList.add('active');
    });

    lightboxOverlay.addEventListener('click', () => {
      lightboxOverlay.classList.remove('active');
    });
  }
});
