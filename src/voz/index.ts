/**
 * TUTORIA - Fábrica e Ponto de Acesso da Camada de Voz
 * Alterna automaticamente entre implementação nativa (Android) e Web (navegador).
 */

import { Capacitor } from '@capacitor/core';
import { NativoServicoVoz } from './nativo';
import { ServicoVoz } from './tipos';
import { WebServicoVoz } from './web';

export * from './tipos';

let instanciaServicoVoz: ServicoVoz | null = null;

export function obterServicoVoz(): ServicoVoz {
  if (!instanciaServicoVoz) {
    if (Capacitor.isNativePlatform()) {
      instanciaServicoVoz = new NativoServicoVoz();
    } else {
      instanciaServicoVoz = new WebServicoVoz();
    }
  }
  return instanciaServicoVoz;
}
