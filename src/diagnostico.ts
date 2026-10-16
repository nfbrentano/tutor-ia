/**
 * TUTORIA - Módulo de Diagnóstico de Microfone e Protocolo
 */

export function verificarProtocolo(): { isFile: boolean; origin: string; texto: string; ok: boolean } {
  if (typeof window === 'undefined') {
    return { isFile: false, origin: '', texto: 'N/A', ok: true };
  }

  const isFile = window.location.protocol === 'file:';
  if (isFile) {
    return {
      isFile: true,
      origin: 'file://',
      texto: 'file:// (Incompatível com Microfone no navegador)',
      ok: false
    };
  }

  return {
    isFile: false,
    origin: window.location.origin,
    texto: `${window.location.origin} (OK)`,
    ok: true
  };
}

export function verificarSuporteReconhecimentoWeb(): { suportado: boolean; texto: string } {
  if (typeof window === 'undefined') {
    return { suportado: false, texto: 'Ambiente não suportado' };
  }

  const has = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return {
    suportado: has,
    texto: has ? 'Disponível no navegador (OK)' : 'Indisponível neste navegador (use Chrome ou app nativo)'
  };
}

export class DiagnosticoAudioVU {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  async iniciar(onNivelVolume: (porcentagem: number) => void): Promise<void> {
    this.parar();

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx();

    const source = this.audioContext.createMediaStreamSource(this.micStream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const percentage = Math.min(100, Math.round((avg / 60) * 100));
      onNivelVolume(percentage);

      this.animFrameId = requestAnimationFrame(tick);
    };

    tick();
  }

  parar(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Ignora
      }
      this.audioContext = null;
    }
  }
}
