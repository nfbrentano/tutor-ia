/**
 * TUTORIA - Ponto de Entrada do Módulo do Avatar
 */

export * from './animator';
export * from './gestos';
export * from './tipos';

import { AvatarAnimator } from './animator';
import { AvatarConfig, AvatarElementos } from './tipos';

/**
 * AvatarControlador: Controlador completo do Avatar com suporte a animações humanas.
 */
export class AvatarControlador extends AvatarAnimator {
  constructor(elementos: AvatarElementos, config?: Partial<AvatarConfig>) {
    super(elementos, config);
  }
}
