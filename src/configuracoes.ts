/**
 * TUTORIA - Script da Página de Configurações (configuracoes.html)
 * Gerenciamento de chave do Gemini, seleção de vozes e diagnóstico de áudio.
 */

import {
  getStoredApiKey,
  getStoredSpeechRate,
  getStoredVoiceUri,
  removeStoredApiKey,
  setStoredApiKey,
  setStoredSpeechRate,
  setStoredVoiceUri
} from './armazenamento';
import { DiagnosticoAudioVU, verificarProtocolo, verificarSuporteReconhecimentoWeb } from './diagnostico';
import { callGeminiApi } from './gemini';
import { obterServicoVoz } from './voz';

document.addEventListener('DOMContentLoaded', async () => {
  const servicoVoz = obterServicoVoz();
  const diagnosticoAudio = new DiagnosticoAudioVU();

  // Elementos do DOM - Chave
  const inputApiKey = document.getElementById('input-api-key') as HTMLInputElement | null;
  const btnToggleApiKey = document.getElementById('btn-toggle-api-key') as HTMLButtonElement | null;
  const btnSaveKey = document.getElementById('btn-save-key') as HTMLButtonElement | null;
  const btnTestKey = document.getElementById('btn-test-key') as HTMLButtonElement | null;
  const btnRemoveKey = document.getElementById('btn-remove-key') as HTMLButtonElement | null;
  const keyFeedback = document.getElementById('key-feedback');

  // Elementos do DOM - Voz
  const selectVoice = document.getElementById('select-voice') as HTMLSelectElement | null;
  const rangeRate = document.getElementById('range-rate') as HTMLInputElement | null;
  const labelRate = document.getElementById('label-rate');
  const btnTestVoice = document.getElementById('btn-test-voice') as HTMLButtonElement | null;

  // Elementos do DOM - Diagnóstico
  const diagProtocolVal = document.getElementById('diag-protocol-val');
  const diagSpeechVal = document.getElementById('diag-speech-val');
  const diagAudioVal = document.getElementById('diag-audio-val');
  const diagMeterBar = document.getElementById('diag-meter-bar');
  const btnRunMicTest = document.getElementById('btn-run-mic-test') as HTMLButtonElement | null;
  const diagInstructions = document.getElementById('diag-instructions');

  // Carrega chave atual
  if (inputApiKey) {
    inputApiKey.value = getStoredApiKey();
  }

  // Toggle visibilidade da chave
  if (btnToggleApiKey && inputApiKey) {
    btnToggleApiKey.addEventListener('click', () => {
      if (inputApiKey.type === 'password') {
        inputApiKey.type = 'text';
        btnToggleApiKey.textContent = 'Ocultar';
      } else {
        inputApiKey.type = 'password';
        btnToggleApiKey.textContent = 'Exibir';
      }
    });
  }

  function mostrarFeedback(msg: string, tipo: 'success' | 'error' | 'warning'): void {
    if (!keyFeedback) return;
    keyFeedback.textContent = msg;
    keyFeedback.className = `alert-banner active ${tipo}`;
  }

  // Salvar Chave
  if (btnSaveKey && inputApiKey) {
    btnSaveKey.addEventListener('click', () => {
      const val = inputApiKey.value.trim();
      if (!val) {
        mostrarFeedback('Por favor, informe uma chave de API válida.', 'warning');
        return;
      }
      setStoredApiKey(val);
      mostrarFeedback('✓ Chave salva com segurança no seu dispositivo!', 'success');
    });
  }

  // Testar Chave
  if (btnTestKey && inputApiKey) {
    btnTestKey.addEventListener('click', async () => {
      const val = inputApiKey.value.trim();
      if (!val) {
        mostrarFeedback('Insira uma chave antes de testar.', 'warning');
        return;
      }

      mostrarFeedback('Conectando ao Google Gemini...', 'warning');
      btnTestKey.disabled = true;

      try {
        const res = await callGeminiApi('Responda apenas com a palavra CONECTADO.', val);
        if (res.texto) {
          mostrarFeedback('✓ Conexão bem-sucedida com o Gemini!', 'success');
        }
      } catch (err: any) {
        mostrarFeedback(`Falha na conexão: ${err.message || err}`, 'error');
      } finally {
        btnTestKey.disabled = false;
      }
    });
  }

  // Remover Chave
  if (btnRemoveKey && inputApiKey) {
    btnRemoveKey.addEventListener('click', () => {
      if (confirm('Deseja realmente remover a chave salva neste dispositivo?')) {
        removeStoredApiKey();
        inputApiKey.value = '';
        mostrarFeedback('Chave removida.', 'warning');
      }
    });
  }

  // Carrega vozes
  if (selectVoice) {
    try {
      const vozes = await servicoVoz.obterVozes();
      const storedUri = getStoredVoiceUri();

      selectVoice.innerHTML = '';
      if (vozes.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Voz padrão do sistema (pt-BR)';
        selectVoice.appendChild(opt);
      } else {
        vozes.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.name;
          if (v.id === storedUri) {
            opt.selected = true;
          }
          selectVoice.appendChild(opt);
        });
      }

      selectVoice.addEventListener('change', () => {
        setStoredVoiceUri(selectVoice.value);
      });
    } catch (e) {
      console.warn('Erro ao listar vozes:', e);
    }
  }

  // Velocidade de fala
  if (rangeRate && labelRate) {
    const rateAtual = getStoredSpeechRate();
    rangeRate.value = rateAtual.toString();
    labelRate.textContent = `${rateAtual.toFixed(2)}x`;

    rangeRate.addEventListener('input', () => {
      const novoRate = parseFloat(rangeRate.value);
      labelRate.textContent = `${novoRate.toFixed(2)}x`;
      setStoredSpeechRate(novoRate);
    });
  }

  // Testar Voz
  if (btnTestVoice) {
    btnTestVoice.addEventListener('click', async () => {
      btnTestVoice.disabled = true;
      const voiceUri = selectVoice?.value || '';
      const rate = rangeRate ? parseFloat(rangeRate.value) : 1.05;

      await servicoVoz.falar(
        'Olá! Eu sou o TutorIA, seu assistente educacional inteligente.',
        {
          onEnd: () => {
            btnTestVoice.disabled = false;
          },
          onError: () => {
            btnTestVoice.disabled = false;
          }
        },
        { voiceUri, rate }
      );
    });
  }

  // Diagnóstico
  const proto = verificarProtocolo();
  if (diagProtocolVal) {
    diagProtocolVal.textContent = proto.texto;
    diagProtocolVal.className = `diag-badge ${proto.ok ? 'ok' : 'error'}`;
  }

  const speechStatus = verificarSuporteReconhecimentoWeb();
  if (diagSpeechVal) {
    diagSpeechVal.textContent = speechStatus.texto;
    diagSpeechVal.className = `diag-badge ${speechStatus.suportado ? 'ok' : 'error'}`;
  }

  let testandoAudio = false;

  if (btnRunMicTest && diagAudioVal && diagMeterBar) {
    btnRunMicTest.addEventListener('click', async () => {
      if (testandoAudio) {
        diagnosticoAudio.parar();
        testandoAudio = false;
        btnRunMicTest.textContent = 'Testar Áudio Agora';
        diagAudioVal.textContent = 'Parado';
        diagAudioVal.className = 'diag-badge';
        diagMeterBar.style.width = '0%';
        return;
      }

      diagAudioVal.textContent = 'Solicitando acesso...';
      diagAudioVal.className = 'diag-badge pending';
      if (diagInstructions) diagInstructions.style.display = 'none';

      try {
        await diagnosticoAudio.iniciar((porcentagem) => {
          diagMeterBar.style.width = `${porcentagem}%`;
        });

        testandoAudio = true;
        btnRunMicTest.textContent = 'Parar Teste';
        diagAudioVal.textContent = '● Microfone Captando! Fale algo...';
        diagAudioVal.className = 'diag-badge ok';
      } catch (err: any) {
        diagAudioVal.textContent = 'Bloqueado ou Não Encontrado';
        diagAudioVal.className = 'diag-badge error';

        if (diagInstructions) {
          diagInstructions.style.display = 'block';
          if (err.name === 'NotAllowedError') {
            diagInstructions.innerHTML =
              '<strong>Como liberar o microfone:</strong><br>' +
              '• No Chrome: clique no ícone de ajustes/cadeado na barra de endereço e ative o Microfone.<br>' +
              '• No macOS: acesse Ajustes do Sistema → Privacidade e Segurança → Microfone e marque seu navegador.<br>' +
              '• No Android: acesse Configurações → Aplicativos → TutorIA → Permissões → Microfone.';
          } else {
            diagInstructions.innerHTML = `<strong>Falha na captura:</strong> ${err.name || 'Erro'} - ${err.message || err}`;
          }
        }
      }
    });
  }
});
