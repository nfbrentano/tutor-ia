/**
 * TUTORIA - Interfaces e Tipos da Camada Unificada de Voz
 */

export interface FalaEventos {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (erro: any) => void;
  onBoundary?: (charIndex: number, word: string) => void;
}

export interface OuvirEventos {
  onStart?: () => void;
  onInterim?: (texto: string) => void;
  onFinal?: (texto: string) => void;
  onError?: (erro: string) => void;
  onEnd?: () => void;
}

export interface OpcoesFala {
  rate?: number;
  pitch?: number;
  lang?: string;
  voiceUri?: string;
}

export interface ServicoVoz {
  /**
   * Sintetiza o texto em áudio usando o motor disponível (Web ou Nativo).
   */
  falar(texto: string, eventos?: FalaEventos, opcoes?: OpcoesFala): Promise<void>;

  /**
   * Inicia a escuta do microfone para reconhecimento de voz.
   */
  ouvir(eventos: OuvirEventos): Promise<void>;

  /**
   * Interrompe a reprodução da fala imediatamente.
   */
  pararDeFalar(): Promise<void>;

  /**
   * Cancela a escuta ativa do microfone.
   */
  pararDeOuvir(): Promise<void>;

  /**
   * Informa se o sistema está falando no momento.
   */
  estaFalando(): boolean;

  /**
   * Informa se o microfone está escutando no momento.
   */
  estaOuvindo(): boolean;

  /**
   * Verifica se o recurso de reconhecimento está disponível na plataforma.
   */
  temSuporteReconhecimento(): Promise<boolean>;

  /**
   * Verifica se a síntese vocal está disponível na plataforma.
   */
  temSuporteSintese(): Promise<boolean>;

  /**
   * Carrega a lista de vozes disponíveis.
   */
  obterVozes(): Promise<Array<{ id: string; name: string; lang: string }>>;
}
