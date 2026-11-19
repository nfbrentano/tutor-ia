/**
 * TUTORIA - Registro leve do Service Worker para PWA offline (RF07, CA11)
 * Só registra em produção sobre HTTP(S) / localhost para não interferir no Vite HMR nem no Capacitor file://.
 */

export function registrarServiceWorkerPwa(): void {
  if (import.meta.env.DEV) return;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const protocolo = window.location?.protocol || '';
  const host = window.location?.hostname || '';
  const permitido = protocolo === 'https:' || host === 'localhost' || host === '127.0.0.1';
  if (!permitido) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ignora silenciosamente se bloqueado por política do navegador
    });
  });
}
