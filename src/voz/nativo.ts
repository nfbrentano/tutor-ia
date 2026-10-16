/**
 * TUTORIA - Implementação da Camada de Voz Nativa para Android (Capacitor Plugins)
 * Usa @capacitor-community/text-to-speech e @capacitor-community/speech-recognition.
 */

import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { cleanTextForSpeech } from '../gemini';
import { FalaEventos, OpcoesFala, OuvirEventos, ServicoVoz } from './tipos';

export class NativoServicoVoz implements ServicoVoz {
  private isListeningFlag = false;
  private isSpeakingFlag = false;
  private partialListener: any = null;

  async temSuporteReconhecimento(): Promise<boolean> {
    try {
      const result = await SpeechRecognition.available();
      return !!result.available;
    } catch {
      return false;
    }
  }

  async temSuporteSintese(): Promise<boolean> {
    return true;
  }

  async obterVozes(): Promise<Array<{ id: string; name: string; lang: string }>> {
    try {
      const res = await TextToSpeech.getSupportedVoices();
      return (res.voices || []).map((v: any, index: number) => ({
        id: v.voiceURI || String(index),
        name: `${v.name || 'Voz'} (${v.lang || 'pt-BR'})`,
        lang: v.lang || 'pt-BR'
      }));
    } catch {
      return [{ id: 'default', name: 'Padrão do Sistema (pt-BR)', lang: 'pt-BR' }];
    }
  }

  estaFalando(): boolean {
    return this.isSpeakingFlag;
  }

  estaOuvindo(): boolean {
    return this.isListeningFlag;
  }

  async falar(texto: string, eventos?: FalaEventos, opcoes?: OpcoesFala): Promise<void> {
    await this.pararDeFalar();

    const textoLimpo = cleanTextForSpeech(texto);
    if (!textoLimpo) {
      eventos?.onEnd?.();
      return;
    }

    try {
      this.isSpeakingFlag = true;
      eventos?.onStart?.();

      await TextToSpeech.speak({
        text: textoLimpo,
        lang: opcoes?.lang || 'pt-BR',
        rate: opcoes?.rate || 1.0,
        pitch: opcoes?.pitch || 1.0,
        category: 'ambient'
      });

      this.isSpeakingFlag = false;
      eventos?.onEnd?.();
    } catch (err) {
      this.isSpeakingFlag = false;
      eventos?.onError?.(err);
      eventos?.onEnd?.();
    }
  }

  async pararDeFalar(): Promise<void> {
    try {
      await TextToSpeech.stop();
    } catch {
      // Ignora erro ao parar
    }
    this.isSpeakingFlag = false;
  }

  async ouvir(eventos: OuvirEventos): Promise<void> {
    await this.pararDeOuvir();
    await this.pararDeFalar();

    try {
      // Verifica e solicita permissões nativas de áudio se necessário
      const permStatus = await SpeechRecognition.checkPermissions();
      if (permStatus.speechRecognition !== 'granted') {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== 'granted') {
          eventos.onError?.(
            'Permissão de microfone negada no Android. Por favor, libere a permissão de Áudio nas Configurações do dispositivo.'
          );
          return;
        }
      }

      this.isListeningFlag = true;
      eventos.onStart?.();

      // Registra listener de resultados parciais (interim)
      if (this.partialListener) {
        await this.partialListener.remove();
        this.partialListener = null;
      }

      this.partialListener = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (data.matches && data.matches.length > 0) {
          eventos.onInterim?.(data.matches[0]);
        }
      });

      const result = await SpeechRecognition.start({
        language: 'pt-BR',
        maxResults: 1,
        prompt: 'Diga sua dúvida escolar...',
        partialResults: true,
        popup: false
      });

      this.isListeningFlag = false;
      if (result && result.matches && result.matches.length > 0) {
        eventos.onFinal?.(result.matches[0]);
      }
      eventos.onEnd?.();
    } catch (err: any) {
      this.isListeningFlag = false;
      eventos.onError?.(err?.message || 'Falha ao capturar áudio no Android.');
      eventos.onEnd?.();
    } finally {
      if (this.partialListener) {
        try {
          await this.partialListener.remove();
        } catch {
          // Ignora
        }
        this.partialListener = null;
      }
    }
  }

  async pararDeOuvir(): Promise<void> {
    if (this.isListeningFlag) {
      try {
        await SpeechRecognition.stop();
      } catch {
        // Ignora erro ao parar
      }
      this.isListeningFlag = false;
    }
    if (this.partialListener) {
      try {
        await this.partialListener.remove();
      } catch {
        // Ignora
      }
      this.partialListener = null;
    }
  }
}
