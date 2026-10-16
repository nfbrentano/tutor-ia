# [CHORE] Estrutura multipáginas em TypeScript, pronta para virar app Android

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-16 · **Atualizada em:** 2026-10-16

## Detalhes da Atividade

- **O que precisa ser feito:** Tirar o tutor de um único `index.html` e passar para um projeto com várias páginas HTML, código em TypeScript dividido em módulos e build com Vite, já preparado para gerar um app Android com Capacitor a partir do mesmo código.
- **Problema e evidência:** Hoje todo o app está num arquivo de 1870 linhas (`tutor-ia/index.html`), com CSS, HTML e JS juntos e sem tipos. As features novas (avatar com movimentos humanos e lousa) somam centenas de linhas de animação, parser e renderização. No arquivo único ficam difíceis de manter e de testar. Também não existe caminho para Android: no WebView do Android, `webkitSpeechRecognition` e `speechSynthesis` não são confiáveis. Por isso o reconhecimento de voz e a fala precisam de plugins nativos.
- **Impacto de não fazer:** As duas features novas pioram o arquivo único, não há testes automatizados, e levar o app ao Android depois exige reescrever tudo.
- **Para quem é destinado:** Time de desenvolvimento (diretamente) e alunos que usam celular Android (indiretamente).
- **História de usuário:** Como desenvolvedor, quero o tutor organizado em páginas e módulos TypeScript com um build que gere web e Android, para evoluir as features sem medo de quebrar e publicar no Android sem reescrever o app.
- **Como saberemos que deu certo:**
  - `npm run build` gera o site.
  - `npx cap run android` abre o app num emulador com voz funcionando.
  - O fluxo pergunta → resposta → fala funciona igual ao atual nas duas plataformas.
  - `npm run typecheck` e `npm test` passam sem erros.

### Decisão de tecnologia (validação)

Pedido: "linguagem performática, que rode na web e depois vire app Android". Alternativas avaliadas:

| Opção | Web | Android | Reaproveita o código atual | Desempenho para este app | Veredito |
|-------|-----|---------|----------------------------|--------------------------|----------|
| **TypeScript + Vite + Capacitor** | Nativo (HTML/CSS/JS), várias páginas HTML | Mesmo código num WebView + plugins nativos de voz | Sim: SVG, CSS e lógica migram quase direto | Suficiente: o gargalo é a rede (Gemini) e a fala, não a CPU; animações via `transform` rodam na GPU | **Recomendado** |
| Flutter (Dart) | Sim, mas desenha em canvas (não gera páginas HTML) e o primeiro carregamento é pesado | Nativo compilado, muito bom | Não: reescrita total; avatar SVG precisaria virar Rive/CustomPainter | Melhor no Android, pior na web | Alternativa se o foco virar só mobile |
| React Native + Expo (web via react-native-web) | Sim | Nativo | Parcial: SVG via `react-native-svg`, CSS precisa ser refeito | Bom | Mais complexo que o necessário |
| Kotlin/Compose Multiplatform | Web (Wasm) ainda amadurecendo | Nativo, excelente | Não | Bom | Prematuro para a web |
| Rust/C++ → WebAssembly | Sim, só para cálculo pesado | Precisa de outra camada para a interface | Não | Ótimo para cálculo, irrelevante aqui | Não se aplica: não há processamento pesado |

**Conclusão:** TypeScript é a escolha. Ele é JavaScript com tipos, então roda nativamente na web, gera páginas HTML de verdade, aproveita o código atual e vira Android com Capacitor. Uma linguagem compilada (Rust/Wasm, Dart) não deixaria este app mais rápido, porque o tempo de resposta depende da API do Gemini e da síntese de voz.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | Projeto Vite + TypeScript (modo `strict`) com várias páginas HTML (`build.rollupOptions.input`): `index.html` (início/boas-vindas), `tutor.html` (avatar + lousa + chat), `configuracoes.html` (chave da API, voz, teste de microfone). | P0 | CA01, CA02 |
| RF02 | Código separado em módulos: `gemini.ts` (chamada e fallback de modelos), `voz/` (fala e reconhecimento), `avatar/` (SVG + animação), `lousa/` (render + sanitização), `chat.ts`, `armazenamento.ts` (chave e preferências). CSS em arquivos próprios, com tokens de cor compartilhados. | P0 | CA03 |
| RF03 | Camada de voz com interface única (`falar(texto, eventos)`, `ouvir(eventos)`, `pararDeFalar()`) e duas implementações: Web Speech API no navegador e plugins Capacitor (text-to-speech e speech-recognition) no Android. A troca é feita por `Capacitor.isNativePlatform()`. | P0 | CA04, CA05 |
| RF04 | Projeto Android gerado com Capacitor (`npx cap add android`), com permissão de microfone (`RECORD_AUDIO`) e ícone/nome do app. | P0 | CA05, CA06 |
| RF05 | Migrar o comportamento atual sem perder funções: estados do avatar, fallback de modelos do Gemini, pop-up/lightbox (até a lousa substituí-lo), modal de configurações, teste de microfone e entrada por texto. | P0 | CA07 |
| RF06 | Scripts npm: `dev`, `build`, `preview`, `typecheck`, `test`, `android` (build + `cap sync` + `cap run android`). | P0 | CA01, CA08 |
| RF07 | Testes unitários com Vitest para parser de resposta, fallback de modelos e sanitização. | P1 | CA08 |
| RF08 | PWA (manifest + service worker) para instalar pelo navegador antes do app Android. | P2 | — |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | JS inicial da página `tutor.html` ≤ 100 KB gzip; primeira renderização < 2 s em 4G simulado (Lighthouse mobile). | P0 | CA09 |
| RNF02 | Animações a 60 fps no navegador e em um Android intermediário (ex.: 4 GB de RAM, Android 12+). | P0 | CA10 |
| RNF03 | Android mínimo e SDK alvo conforme a versão estável atual do Capacitor (v8 na data desta especificação). | P0 | CA06 |
| RNF04 | A chave da API continua digitada pelo aluno e salva só no aparelho; nenhuma chave vai no código nem no APK. | P0 | CA11 |
| RNF05 | `tsc --noEmit` sem erros e sem `any` implícito. | P0 | CA08 |

### Dependências técnicas

- Node.js LTS, Vite, TypeScript, Vitest.
- Capacitor v8 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).
- Plugins de voz para Capacitor: text-to-speech e speech-recognition (opções: capacitor-community ou Capawesome; ver D02).
- Android Studio + Android SDK para gerar e rodar o app.
- Esta tarefa deve vir **antes** de [2026-10-16_avatar-com-movimentos-humanos.md](2026-10-16_avatar-com-movimentos-humanos.md) e [2026-10-16_lousa-de-apoio-visual.md](2026-10-16_lousa-de-apoio-visual.md), que passam a ser implementadas como módulos (`avatar/`, `lousa/`).
- O repositório git (`tutor-ia/`) ainda não tem commits; o código atual precisa de um commit inicial na `main` antes da branch `chore/multipaginas-typescript-android`.

### Recursos necessários

- Máquina com Android Studio, um emulador e, de preferência, um aparelho Android físico para testar o microfone.
- Ícone do app (512×512) e nome definitivo.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado o repositório clonado, quando rodo `npm install && npm run dev`, então o app abre em `http://localhost:5173` e navego entre início, tutor e configurações.
- [ ] **CA02:** Dado o build (`npm run build`), quando inspeciono `dist/`, então existem `index.html`, `tutor.html` e `configuracoes.html`, cada um carregando só o JS de que precisa.
- [ ] **CA03:** Dado o código entregue, quando ele é revisado, então não há lógica de negócio dentro dos arquivos HTML; ela está nos módulos TS do RF02.
- [ ] **CA04:** Dado o app no Chrome desktop, quando pergunto por voz, então o reconhecimento e a fala funcionam como na versão atual.
- [ ] **CA05:** Dado o app instalado no Android, quando toco no microfone pela primeira vez, então o sistema pede permissão; depois de aceitar, a pergunta falada é reconhecida e a resposta é lida em voz alta em pt-BR.
- [ ] **CA06:** Dado o projeto, quando rodo `npm run android`, então o app abre no emulador com o nome e o ícone definidos.
- [ ] **CA07:** Dado o checklist das funções atuais (RF05), quando testo cada item na web e no Android, então todos se comportam como no `index.html` original.
- [ ] **CA08:** Dado o projeto, quando rodo `npm run typecheck && npm test`, então tudo passa sem erros.
- [ ] **CA09:** Dado o Lighthouse mobile em `tutor.html`, quando rodo a auditoria, então o JS inicial fica ≤ 100 KB gzip e a primeira renderização < 2 s.
- [ ] **CA10:** Dado um Android intermediário, quando o avatar anima durante a fala, então não há travamentos visíveis (perfil de GPU sem quadros acima de 32 ms de forma contínua).
- [ ] **CA11 (negativo):** Dado o APK gerado, quando inspeciono seu conteúdo, então **não** há nenhuma chave de API embutida.
- [ ] **CA12 (erro):** Dado o Android sem permissão de microfone (negada), quando toco no microfone, então aparece uma mensagem explicando como liberar e a entrada por texto continua funcionando.

## O que a atividade não inclui

- Implementar o avatar humanoide e a lousa: motivo: especificações próprias; esta tarefa só prepara a base.
- Publicar na Google Play: motivo: exige conta de desenvolvedor, política de privacidade e revisão; outra iniciativa.
- App iOS: motivo: fora do pedido; Capacitor permite adicionar depois (`npx cap add ios`).
- Backend para esconder a chave da API: motivo: outra iniciativa; o modelo atual (aluno informa a própria chave) continua.
- Frameworks de interface (React, Vue, etc.): motivo: o app é pequeno; TypeScript puro mantém o JS enxuto (RNF01). Reavaliar se a interface crescer muito.

### Considerado para o futuro (P2)

- PWA instalável (RF08).
- Build iOS com o mesmo código.
- Backend próprio (proxy do Gemini) com login, histórico e chave centralizada.
- Publicação automatizada na Play Store via CI.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Quais páginas além de início, tutor e configurações (ex.: histórico, escolha de matéria, sobre)? | PO | Não | Sugestão: começar com as 3 e adicionar depois. |
| D02 | Qual plugin de voz usar? O de fala precisa emitir eventos de palavra (`boundary`) para o lip sync do avatar. | dev | Sim | Validar numa prova de conceito; o plugin da Capawesome informa suporte a eventos de `boundary`. |
| D03 | Mover `SDD/`, `CLAUDE.md` e `AGENTS.md` para dentro do repositório git? | PO / dev | Não | Sugestão: sim, para versionar as especificações junto do código. |
| D04 | Remover o bloco de Next.js do `AGENTS.md`, que não se aplica ao projeto? | dev | Não | Sugestão: sim; substituir por instruções de Vite/TS/Capacitor. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Dev server multipáginas | manual | CA01 | `npm run dev`; navegar pelos links | As 3 páginas abrem sem erro no console |
| CT02 | Saída do build | integração | CA02 | `npm run build`; listar `dist/` | 3 HTMLs; chunks separados por página |
| CT03 | Revisão de estrutura | manual | CA03 | Revisar HTMLs | Só marcação e `<script type="module">` |
| CT04 | Voz na web | e2e | CA04 | Chrome: perguntar por voz "o que é fotossíntese?" | Reconhece, responde e fala |
| CT05 | Voz no Android | manual | CA05, CA12 | Instalar no aparelho; negar e depois aceitar a permissão | Mensagem ao negar; voz funciona ao aceitar |
| CT06 | Build Android | manual | CA06 | `npm run android` | App abre no emulador com nome/ícone |
| CT07 | Paridade de funções | manual | CA07 | Percorrer o checklist do RF05 na web e no Android | Todos os itens iguais ao original |
| CT08 | Qualidade | unit | CA08 | `npm run typecheck && npm test` | 0 erros |
| CT09 | Desempenho web | manual | CA09 | Lighthouse mobile em `tutor.html` | ≤ 100 KB gzip; < 2 s |
| CT10 | Desempenho Android | manual | CA10 | "Profile GPU rendering" ligado durante uma resposta | Sem travamentos contínuos |
| CT11 | Chave fora do APK | manual | CA11 | `unzip -p app-debug.apk \| strings \| grep -i AIza` | Nenhum resultado |

## URL Complementar

- Documentação técnica: [Vite: multi-page app](https://vite.dev/guide/build.html#multi-page-app) · [Capacitor: política de suporte (v8 ativa)](https://capacitorjs.com/docs/next/main/reference/support-policy) · [Plugin speech-recognition (capacitor-community)](https://github.com/capacitor-community/speech-recognition) · [Plugin speech-synthesis (Capawesome)](https://capawesome.io/plugins/speech-synthesis)
- Protótipo / mockup: N/A, mudança de estrutura sem nova interface.
- Discussões relacionadas: [2026-10-16_avatar-com-movimentos-humanos.md](2026-10-16_avatar-com-movimentos-humanos.md), [2026-10-16_lousa-de-apoio-visual.md](2026-10-16_lousa-de-apoio-visual.md).
- Referências de design: N/A.
- Requisitos originais: pedido do PO em 2026-10-16: "criar mais que uma página HTML e usar uma linguagem performática que possa ser usada na web e depois convertida para uma aplicação Android".
- Issue / PR relacionado: N/A, a ser criado.
