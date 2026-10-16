/**
 * TUTORIA - Script da Página Inicial (index.html)
 */

import { hasApiKey } from './armazenamento';

document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('status-indicator');
  const statusLabel = document.getElementById('status-label');
  const btnStartTutor = document.getElementById('btn-start-tutor');

  const configured = hasApiKey();

  if (statusIndicator && statusLabel) {
    if (configured) {
      statusIndicator.className = 'status-dot-indicator configured';
      statusLabel.textContent = 'IA Pronta';
    } else {
      statusIndicator.className = 'status-dot-indicator unconfigured';
      statusLabel.textContent = 'Configurar Chave';
    }
  }

  if (btnStartTutor) {
    btnStartTutor.addEventListener('click', (e) => {
      if (!hasApiKey()) {
        e.preventDefault();
        window.location.href = './configuracoes.html?origem=inicio';
      }
    });
  }
});
