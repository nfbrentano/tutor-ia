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
  private falaSeq = 0;
  private escutaSeq = 0;

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
    // Uma fala interrompida pode resolver depois que a próxima começou: só a mais recente
    // atualiza o estado e dispara eventos
    const seq = ++this.falaSeq;

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

      if (seq !== this.falaSeq) return;
      this.isSpeakingFlag = false;
      eventos?.onEnd?.();
    } catch (err) {
      if (seq !== this.falaSeq) return;
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
    const seq = ++this.escutaSeq;

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

      // Sem resultados parciais: no plugin v7, com `partialResults: true` o start() resolve na hora,
      // sem texto, e os erros (silêncio, sem correspondência) nunca chegam ao JS. Assim o start()
      // só resolve com a transcrição final, ou rejeita com o erro do reconhecedor.
      const result = await SpeechRecognition.start({
        language: 'pt-BR',
        maxResults: 1,
        prompt: 'Diga sua dúvida escolar...',
        partialResults: false,
        popup: false
      });

      if (seq !== this.escutaSeq) return;
      this.isListeningFlag = false;
      const texto = result?.matches?.[0]?.trim();
      if (texto) {
        eventos.onFinal?.(texto);
      } else {
        eventos.onError?.('Nenhuma fala detectada. Toque no microfone e tente de novo.');
      }
      eventos.onEnd?.();
    } catch (err: any) {
      if (seq !== this.escutaSeq) return;
      this.isListeningFlag = false;
      eventos.onError?.(traduzirErroReconhecimento(err?.message));
      eventos.onEnd?.();
    }
  }

  async pararDeOuvir(): Promise<void> {
    if (this.isListeningFlag) {
      try {
        // Encerra a captura; o reconhecedor ainda entrega o que ouviu até aqui pelo start()
        await SpeechRecognition.stop();
      } catch {
        // Ignora erro ao parar
      }
      this.isListeningFlag = false;
    }
  }
}

/** Mensagens do SpeechRecognizer do Android em português, para o aluno entender o que houve. */
export function traduzirErroReconhecimento(mensagem?: string): string {
  const m = (mensagem || '').toLowerCase();
  if (m.includes('no match') || m.includes('speech timeout') || m.includes('no speech')) {
    return 'Nenhuma fala detectada. Toque no microfone e tente de novo.';
  }
  if (m.includes('permission')) return 'Sem permissão para usar o microfone.';
  if (m.includes('network')) return 'Sem conexão para reconhecer a fala. Tente digitar a pergunta.';
  if (m.includes('busy')) return 'O reconhecimento de voz está ocupado. Tente de novo em instantes.';
  if (m.includes('audio')) return 'Não foi possível gravar o áudio do microfone.';
  return 'Falha ao capturar áudio no Android.';
}
