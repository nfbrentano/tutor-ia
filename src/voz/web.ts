/**
 * TUTORIA - Implementação da Camada de Voz para Web (Web Speech API)
 */

import { cleanTextForSpeech } from '../gemini';
import { FalaEventos, OpcoesFala, OuvirEventos, ServicoVoz } from './tipos';

// Declarações globais para compatibilidade com webkit
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export class WebServicoVoz implements ServicoVoz {
  private recognitionInstance: any = null;
  private isListeningFlag = false;
  private isSpeakingFlag = false;
  private voicesCache: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
    }
  }

  private initVoices(): void {
    const load = () => {
      this.voicesCache = window.speechSynthesis.getVoices();
    };
    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  async temSuporteReconhecimento(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  async temSuporteSintese(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  async obterVozes(): Promise<Array<{ id: string; name: string; lang: string }>> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    if (this.voicesCache.length === 0) {
      this.voicesCache = window.speechSynthesis.getVoices();
    }
    return this.voicesCache.map(v => ({
      id: v.voiceURI,
      name: `${v.name} (${v.lang})`,
      lang: v.lang
    }));
  }

  estaFalando(): boolean {
    return this.isSpeakingFlag;
  }

  estaOuvindo(): boolean {
    return this.isListeningFlag;
  }

  async falar(texto: string, eventos?: FalaEventos, opcoes?: OpcoesFala): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      eventos?.onError?.(new Error('Síntese de voz não suportada neste navegador.'));
      eventos?.onEnd?.();
      return;
    }

    await this.pararDeFalar();

    const textoLimpo = cleanTextForSpeech(texto);
    if (!textoLimpo) {
      eventos?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textoLimpo);
    utterance.lang = opcoes?.lang || 'pt-BR';
    utterance.rate = opcoes?.rate || 1.05;
    utterance.pitch = opcoes?.pitch || 1.0;

    // Seleciona voz configurada ou busca a melhor voz pt-BR
    const voices = this.voicesCache.length > 0 ? this.voicesCache : window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (opcoes?.voiceUri) {
      selectedVoice = voices.find(v => v.voiceURI === opcoes.voiceUri);
    }
    if (!selectedVoice) {
      selectedVoice =
        voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Maria'))) ||
        voices.find(v => v.lang === 'pt-BR') ||
        voices.find(v => v.lang.startsWith('pt'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      this.isSpeakingFlag = true;
      eventos?.onStart?.();
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const word = textoLimpo.substring(event.charIndex, event.charIndex + (event.charLength || 5));
        eventos?.onBoundary?.(event.charIndex, word);
      }
    };

    const finaliza = () => {
      this.isSpeakingFlag = false;
      eventos?.onEnd?.();
    };

    utterance.onend = finaliza;
    utterance.onerror = (e) => {
      this.isSpeakingFlag = false;
      eventos?.onError?.(e);
      finaliza();
    };

    window.speechSynthesis.speak(utterance);
  }

  async pararDeFalar(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeakingFlag = false;
    }
  }

  async ouvir(eventos: OuvirEventos): Promise<void> {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      eventos.onError?.('Reconhecimento de fala não suportado neste navegador.');
      return;
    }

    await this.pararDeOuvir();
    await this.pararDeFalar();

    const recognition = new SpeechRecognition();
    this.recognitionInstance = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      this.isListeningFlag = true;
      eventos.onStart?.();
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        eventos.onInterim?.(interim);
      }
      if (final && final.trim()) {
        eventos.onFinal?.(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      this.isListeningFlag = false;
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Permissão do microfone negada. Permita o microfone nas permissões da página ou do sistema.',
        'service-not-allowed': 'Serviço de voz bloqueado pelo navegador.',
        'audio-capture': 'Nenhum microfone detectado no dispositivo.',
        'network': 'Falha de conexão com o serviço de voz. Verifique sua internet.',
        'no-speech': 'Nenhuma fala detectada. Toque no microfone e tente novamente.',
        'aborted': 'Gravação cancelada.'
      };

      const msg = errorMessages[event.error] || `Erro no microfone: ${event.error}`;
      eventos.onError?.(msg);
    };

    recognition.onend = () => {
      this.isListeningFlag = false;
      eventos.onEnd?.();
    };

    try {
      recognition.start();
    } catch (err: any) {
      this.isListeningFlag = false;
      eventos.onError?.(`Não foi possível iniciar o microfone: ${err.message || err}`);
    }
  }

  async pararDeOuvir(): Promise<void> {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // Ignora erros ao parar
      }
      this.recognitionInstance = null;
    }
    this.isListeningFlag = false;
  }
}
