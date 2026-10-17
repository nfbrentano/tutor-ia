/**
 * TUTORIA - Ponto de Entrada do Módulo Avatar 3D
 */

export * from './avatar3d';
export * from './lipSync';
export * from './poses';
export * from './tipos';

import { Avatar3D, isWebGLAvailable } from './avatar3d';
import { Avatar3DConfig, Avatar3DElementos } from './tipos';

/**
 * Função utilitária para inicialização assíncrona sob demanda do Avatar 3D.
 * Retorna a instância do Avatar3D se inicializada com sucesso, ou null se WebGL
 * ou o modelo não estiverem disponíveis (plano B ativo).
 */
export async function carregarAvatar3D(
  elementos: Avatar3DElementos,
  config?: Partial<Avatar3DConfig>
): Promise<Avatar3D | null> {
  if (!isWebGLAvailable()) {
    return null;
  }

  const avatar = new Avatar3D(elementos, config);
  const sucesso = await avatar.inicializar();
  if (!sucesso) {
    return null;
  }
  return avatar;
}
