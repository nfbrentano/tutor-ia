# TutorIA - Instruções e Diretrizes do Projeto

## Stack Tecnológica
- **Linguagem:** TypeScript (modo `strict`)
- **Bundler / Dev Server:** Vite (arquitetura Multi-Page Application - MPA)
- **Mobile Runtime:** Capacitor (Android)
- **Testes Unitários:** Vitest
- **Estilos:** CSS Vanilla com variáveis/design tokens e layout responsivo

## Estrutura Multi-páginas (MPA)
- `index.html`: Boas-vindas, apresentação do Tutor e navegação inicial.
- `tutor.html`: Interface principal de interação (Avatar, lousa, chat, controles de voz e texto).
- `configuracoes.html`: Gerenciamento de chave de API, seleção de voz e testes de áudio/microfone.

## Princípios de Código
1. Sem lógica de negócio dentro dos arquivos HTML. Todo o comportamento é orquestrado via TypeScript modular (`src/`).
2. Nenhuma chave de API ou credencial sensível deve ser colocada no código ou embutida no build do app/APK.
3. Compatibilidade híbrida: abstrair APIs de voz (reconhecimento e síntese) para funcionar nativamente no navegador (Web Speech API) e no Android (Capacitor plugins).
