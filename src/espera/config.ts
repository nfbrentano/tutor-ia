/**
 * TUTORIA - Configuração dos Tempos de Espera Ativa (RNF02)
 */

export interface ConfigEspera {
  /** Tempo para disparar frase de reação se a IA demorar para responder (estilo Alexa) */
  tempoReacaoInicialMs: number;
  /** Tempo limite para cancelar frase de reação se resposta chegar rápido */
  tempoCancelamentoReacaoRapidaMs: number;
  /** Tempo para abrir lousa de preparação com o título/tema (RF03, CA04) */
  tempoLousaPreparacaoMs: number;
  /** Tempo para disparar curiosidade curta da matéria (RF04, CA05) */
  tempoCuriosidadeMs: number;
  /** Intervalo entre alternância de gestos de espera no avatar (RF05, CA06) */
  tempoCicloGestosEsperaMs: number;
  /** Tempo máximo para transição/corte de frase ao chegar a 1ª etapa (RF07, CA08) */
  tempoMaximoTransicaoFraseMs: number;
}

export const CONFIG_ESPERA: ConfigEspera = {
  tempoReacaoInicialMs: 2800,
  tempoCancelamentoReacaoRapidaMs: 2500,
  tempoLousaPreparacaoMs: 3500,
  tempoCuriosidadeMs: 6000,
  tempoCicloGestosEsperaMs: 2500,
  tempoMaximoTransicaoFraseMs: 1500
};
