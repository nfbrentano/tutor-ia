# [UI] Vibe Design System, Prototipagem Incremental e UX Mobile-First para TutorIA

> **Status:** Em revisão
> **Autor:** Antigravity (Engenharia + UX) · **Revisor:** Natanael · **Criada em:** 2026-11-19 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Dar acabamento visual consistente e usabilidade mobile ao TutorIA aplicando a metodologia da Masterclass *Criando Interfaces Absurdas com IA* e do módulo *Langclean* (aulas `03` e `04`) em cinco frentes:
  1. **Design System como fonte da verdade:** documento `src/styles/DESIGN_SYSTEM.md` (ao lado dos tokens; a raiz de `SDD/` é reservada a especificações pelo `CLAUDE.md`) e expansão de `src/styles/tokens.css` com os 4 pilares da Masterclass: **Tipografia**, **Cores e Superfícies**, **Botões e Controles**, **Animações e Efeitos** (sempre respeitando `prefers-reduced-motion`).
  2. **Higiene de HTML/CSS:** zero `style="..."` estático nos HTMLs e zero cores hexadecimais fora de `tokens.css`.
  3. **UX mobile-first em `tutor.html` (≤ 980px e Android):** palco compacto no topo com a cabeça holográfica, abas `Lousa` \| `Chat` e uma barra fixa de ações na zona do polegar.
  4. **Componentes de interação:** controle segmentado para o modo pedagógico, diálogo de confirmação do próprio app no lugar de `confirm()` e ícones SVG no lugar de emojis na home.
  5. **Configurações escaneáveis e protótipo ASCII prévio:** categorias/acordeões em `configuracoes.html`, prévia da persona e wireframe ASCII (ver URL Complementar) antes de qualquer tela nova.
- **Problema e evidência** (código verificado em 2026-11-20; `tutor.html` e `src/styles/tutor.css` estão sendo alterados pela spec da cabeça holográfica, por isso as referências abaixo usam seletores e IDs em vez de linhas):
  - **Tokens incompletos e quebrados:** `src/styles/tokens.css` tem 33 linhas, sem escala tipográfica, espaçamento, elevação, `z-index` nem motion. `--text-main` é usado em `configuracoes.html` (`#select-avatar-mode`, `#select-persona`, `#select-serie-escolar`) e `--font-sans` em `src/styles/tutor.css`, mas nenhum dos dois está definido.
  - **Estilos inline:** 4 em `tutor.html` (link de `#blocking-banner`, `#avatar-3d-canvas`, `#persona-credito`, `#session-tag`), 23 em `configuracoes.html` (da linha 24 à 218) e 0 em `index.html`. O `display`/`opacity` inicial de `#avatar-3d-canvas` é alterado em runtime por `src/avatar3d/avatar3d.ts` (`canvas.style.*`), então só o estado inicial sai do HTML.
  - **Cores avulsas:** ≈ 116 hexadecimais e ≈ 134 `rgba()` literais fora de `tokens.css` (`tutor.css` 56/71, `lousa.css` 35/39, `base.css` 10/12, `configuracoes.css` 12/8, `home.css` 3/4).
  - **Mobile empilhado:** abaixo de 980px (`@media (max-width: 980px)` em `tutor.css` e `lousa.css:54-59`) a `.avatar-section` (`min-height: 520px`) e a `.lousa-panel` (`height: 420px`) ficam acima de `#chat-stream` e do rodapé, empurrando chat, envio e foto para longe da primeira dobra.
  - **Fonte de fórmulas e emojis:** `'Courier New'` em `src/styles/lousa.css:194` e `:639`; emojis `🎙️`, `🤖`, `📚` nos cards de `index.html` (linhas 93, 99, 105), que mudam de aparência entre sistemas e no WebView.
  - **Diálogo nativo:** `confirm('Deseja realmente remover a chave salva neste dispositivo?')` em `src/configuracoes.ts:170`.
  - **Modo pedagógico:** `<select id="select-modo-pedagogico">` é lido só no envio (`src/tutor.ts:131`, `:846`) e não é salvo em lugar nenhum.
- **Impacto de não fazer:** aparência fragmentada entre páginas e entre desktop e Android, uso cansativo com uma mão no celular e novas telas (consumo de tokens, modo de conexão) feitas sem padrão.
- **Para quem é destinado:** alunos no celular (Android/Capacitor ou navegador) que alternam entre ouvir o tutor, ler a lousa e responder por voz, texto ou foto; alunos em desktop/tablet; desenvolvedores e agentes de IA que criam telas novas.
- **História de usuário:** Como estudante usando o TutorIA no celular, quero ver o tutor, alternar com um toque entre a lousa e o chat e usar o microfone ou o modo dica na altura do polegar sem rolar telas enormes, para me concentrar no exercício com a sensação de um app nativo.
- **Como saberemos que deu certo:**
  - `grep 'style="'` nos 3 HTMLs principais retorna 0; hexadecimais fora de `tokens.css` = 0; `'Courier New'` = 0.
  - Em `360x780`, `375x812` e `390x844`: cabeçalho, palco compacto, abas e barra de ações visíveis sem rolar a página, 0 rolagem horizontal e todos os alvos de toque ≥ 44x44 px.
  - Lighthouse (Acessibilidade) sem falhas de `color-contrast` em `index.html`, `tutor.html` e `configuracoes.html` para as 7 personas.
  - Build offline íntegro (nenhuma fonte ou ícone de CDN) e `npm test` + `npm run build` passando.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | Criar `src/styles/DESIGN_SYSTEM.md` com tipografia, paleta/superfícies, catálogo de botões, motion, padrões de componentes (incluindo o diálogo de confirmação e o controle segmentado), regras desktop × mobile e a exigência de wireframe ASCII antes de tela nova. Os tokens `--holo-*` da cabeça holográfica são documentados, não redefinidos. | P0 | CA01 |
| RF02 | Expandir `tokens.css`: escala tipográfica (`--text-xs` a `--text-2xl`), fonte de corpo e de fórmula sem rede, superfícies (`--surface-0` a `--surface-glass`), bordas, raios, sombras, espaçamentos, camadas de `z-index`, durações/curvas de transição; definir `--text-main` e `--font-sans` (hoje usados sem definição) ou trocar seus usos por tokens existentes. | P0 | CA01, CA02 |
| RF03 | Remover todo `style="..."` estático de `tutor.html` e `configuracoes.html` para classes, e trocar os hexadecimais de `src/styles/*.css` por tokens. Estilos aplicados por JS em runtime (`--persona-cor` em `src/tutor.ts:193-194`, `canvas.style.*` em `avatar3d.ts`, `style.display` em `src/configuracoes.ts:288`/`:304`) continuam permitidos. | P0 | CA02 |
| RF04 | Layout mobile de `tutor.html` (≤ 980px): palco compacto com a cabeça holográfica no tubo (`.holo-tubo`, spec `2026-11-20_avatar-cabeca-holografica.md`) em altura reduzida, com nome da persona e estado; abas `Lousa` \| `Chat` com indicador de novidade na aba oculta; barra fixa inferior com `env(safe-area-inset-bottom)` contendo `#btn-mic`, `#text-fallback-input`, `#btn-send-text` e `#btn-foto-exercicio`. O indicador de estado (ouvindo/pensando/falando) é o próprio tubo (RF05 da spec da cabeça), sem anel extra. | P0 | CA03, CA04, CA11, CA13 |
| RF05 | Troca de aba no mobile: por padrão a aba `Lousa` só ganha o indicador quando chega item novo; a troca automática acontece apenas por ação explícita — botão "Ver na lousa" de um balão, abertura do quiz ou ferramenta `focar_item_lousa` do harness. Voltar ao `Chat` preserva a posição de rolagem. | P1 | CA04 |
| RF06 | Trocar `<select id="select-modo-pedagogico">` por controle segmentado (`Explicação` \| `Modo Dica`, `role="radiogroup"`, setas do teclado), mantendo uma única leitura do modo no envio (`src/tutor.ts:846`) por um getter, sem depender do elemento `<select>`. | P1 | CA05 |
| RF07 | Trocar `confirm(...)` de `src/configuracoes.ts:170` por diálogo do app (`role="alertdialog"`, foco preso no diálogo, `Escape` cancela, foco volta ao botão de origem). O mesmo componente atende o "Zerar estatísticas" da spec de roteamento. | P1 | CA06 |
| RF08 | Reorganizar os 5 `.settings-card` de `configuracoes.html` em categorias com acordeão no mobile: **Conexão e IA** (chave; reservada ao modo de conexão do gateway e ao perfil/consumo da spec de roteamento), **Voz e Microfone** (voz + diagnóstico), **Livros**, **Tutor e Série** (avatar, persona, série), com prévia da persona selecionada (nome, matéria, `corTema`). | P1 | CA07 |
| RF09 | Trocar os emojis dos 3 cards de `index.html` por SVG inline (`stroke-width: 1.75`, `aria-hidden="true"`) e aplicar profundidade em camadas + entrada escalonada na home. | P1 | CA08 |
| RF10 | Fonte de fórmulas em `lousa.css:194` e `:639`: `ui-monospace, 'SFMono-Regular', 'Cascadia Mono', 'Roboto Mono', Menlo, Consolas, monospace` com `font-variant-numeric: tabular-nums`. | P1 | CA02 |
| RF11 | Generalizar o uso de `color-mix()` com `--persona-cor` que já existe em `tutor.css` (badge do palco e tokens `--holo-*`) para tokens de realce por persona (`--persona-realce`, `--persona-borda`), com valor de fallback para WebViews sem `color-mix`. | P1 | CA10 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | **Offline:** nenhuma fonte ou ícone por CDN; se houver fonte própria, `.woff2` em `public/fonts/` com `font-display: swap`; senão, pilha de sistema. | P0 | CA08, CA12 |
| RNF02 | **Acessibilidade:** alvos ≥ 44x44 px no mobile; `:focus-visible` com contraste ≥ 3:1; texto ≥ 4.5:1 (WCAG AA); com `prefers-reduced-motion: reduce`, 0 animações contínuas ou escalonadas. | P0 | CA03, CA05, CA09 |
| RNF03 | **Contratos de DOM:** continuam existindo `#btn-mic`, `#lousa-board`, `#chat-stream`, `#text-fallback-input`, `#btn-send-text`, `#btn-foto-exercicio`, `#avatar-3d-canvas`, `#modal-fonte-overlay`, `#modal-caderno-overlay`, `#blocking-banner` e `#status-text`. | P0 | CA12 |
| RNF04 | **Desempenho no Android intermediário:** no máximo 3 elementos com `backdrop-filter` visíveis ao mesmo tempo, `blur` ≤ 8px abaixo de 980px; rolagem do chat sem quadros acima de 50 ms no DevTools Performance (CPU 4x mais lenta) com o avatar 3D ativo. | P1 | CA11 |
| RNF05 | **`AGENTS.md`:** nenhuma lógica em HTML; CSS por página sobre `base.css` + `tokens.css`; JS inicial de `tutor.html` não cresce mais que 3 KB gzip. | P0 | CA12 |

### Dependências técnicas

- Sem dependência npm nova (CSS nativo + SVG inline).
- Módulos que manipulam DOM/classes: `src/tutor.ts`, `src/chat.ts`, `src/configuracoes.ts`, `src/home.ts`, `src/lousa/renderer.ts`, `src/avatar3d/avatar3d.ts`.
- **`2026-11-20_avatar-cabeca-holografica.md` (em andamento):** define o visual do palco (cabeça no tubo, `--holo-*`, "olhar" no lugar de "apontar", layout ≥ 360 px). Esta spec só dimensiona o contêiner do palco e não altera o avatar. O canvas 3D hoje só se redimensiona em `window.resize` (`onResizeHandler` em `avatar3d.ts`); o palco compacto exige redimensionar também quando o contêiner muda de tamanho — combinar com a spec da cabeça quem implementa.
- **Ordem de implementação: trilha de UI, paralela à trilha de IA.** Começar depois do merge da spec da cabeça holográfica (as duas mexem em `tutor.html` e `tutor.css`). RF01–RF03 (tokens e limpeza) antes das telas novas de `2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md` (painel de consumo) e `2026-11-19_gateway-proxy-opcional-e-modo-turma.md` (modo de conexão). A troca de aba por `focar_item_lousa` (RF05) liga com `2026-11-19_harness-agentico-tools-e-controle-lousa.md`, seja qual for implementada por último.

### Recursos necessários

- Viewports desktop `1440x900`, tablet `820x1180` e mobile `390x844`, `375x812`, `360x780`; um Android real ou emulado com teclado virtual aberto.
- Ícones SVG lineares embutidos (estilo Lucide/Feather, licença permissiva), sem biblioteca em runtime.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que um desenvolvedor abre `src/styles/DESIGN_SYSTEM.md` e `tokens.css`, quando procura tipografia, cores/elevação, variantes de botão, motion e regras desktop × mobile, então encontra cada item documentado com o token correspondente, e todo `var(--x)` usado em `src/styles/*.css` e nos HTMLs está definido.
- [ ] **CA02:** Dado que existem `index.html`, `tutor.html`, `configuracoes.html` e `src/styles/*.css`, quando se busca `style="` nos HTMLs, `'Courier New'` e hexadecimais fora de `tokens.css`, então as três buscas retornam 0.
- [ ] **CA03:** Dado que `tutor.html` é aberto em `360x780`, `375x812` e `390x844`, quando a página carrega, então cabeçalho, palco compacto, abas e barra de ações (`#btn-mic`, campo, envio, foto) ficam visíveis sem rolar a página, sem rolagem horizontal e com alvos ≥ 44x44 px.
- [ ] **CA04:** Dado que o aluno está na aba `Chat` no mobile, quando o tutor adiciona um item à lousa, então a aba `Lousa` mostra o indicador sem trocar sozinha; ao tocar "Ver na lousa" a aba troca, e ao voltar ao `Chat` a rolagem é a mesma de antes.
- [ ] **CA05:** Dado que o controle segmentado do modo pedagógico está na tela, quando o aluno escolhe `Modo Dica` por toque ou com `ArrowRight` e envia uma pergunta, então o envio usa `modoPedagogico: 'dica'` e o botão ativo tem `aria-checked="true"`.
- [ ] **CA06:** Dado que há chave salva, quando o aluno clica para removê-la, então abre o diálogo do app (`window.confirm` nunca é chamado); `Cancelar` ou `Escape` mantém a chave e devolve o foco ao botão; `Confirmar` remove a chave e mostra o aviso.
- [ ] **CA07:** Dado que `configuracoes.html` está aberto em `390x844`, quando o aluno abre a categoria **Tutor e Série** e troca a persona, então só aquela categoria fica expandida e a prévia mostra nome, matéria e `corTema` da nova persona.
- [ ] **CA08:** Dado que `index.html` é carregado sem rede (Service Worker com cache), quando a página renderiza, então os 3 cards mostram ícones SVG, não há emojis neles e nenhuma requisição externa de fonte ou ícone falha.
- [ ] **CA09:** Dado que o sistema está com `prefers-reduced-motion: reduce`, quando qualquer página é aberta, então nenhuma animação decorativa contínua ou escalonada roda.
- [ ] **CA10:** Dado que cada uma das 7 personas do catálogo é ativada por vez, quando o palco e os badges são renderizados com os tokens derivados de `--persona-cor`, então texto e bordas atingem os contrastes de RNF02.
- [ ] **CA11 (caso-limite):** Dado que o teclado virtual do Android está aberto no `#text-fallback-input`, quando o aluno digita, então o campo e o botão de envio continuam visíveis acima do teclado e o palco compacto não cobre o campo.
- [ ] **CA12 (negativo / regressão):** Dado que as mudanças visuais terminaram, quando rodam `npm run build` e `npm test`, então ambos terminam com código 0 e nenhum ID de RNF03 some do DOM.
- [ ] **CA13 (caso-limite):** Dado que a aba `Chat` está ativa (lousa oculta), quando chega um item de lousa durante a fala, então não há erro no console e a cabeça não tenta olhar para um elemento invisível.

## O que a atividade não inclui

- Tema claro: motivo: dobraria a matriz de contraste; o foco é polir o tema escuro.
- Biblioteca de UI (Tailwind, shadcn, Material, Bootstrap): motivo: o projeto é MPA com CSS vanilla e tokens (`AGENTS.md`).
- Visual do avatar (cabeça, tubo, shader, "olhar"): motivo: pertence a `2026-11-20_avatar-cabeca-holografica.md`; aqui só o contêiner do palco.
- Converter os ≈ 134 `rgba()` literais: motivo: volume alto; fazer depois que os tokens de superfície existirem (ver P2).

### Considerado para o futuro (P2)

- Tema claro ("Modo Caderno Claro") com tokens semânticos invertidos.
- Deslizar entre as abas `Lousa` e `Chat` no Android.
- Layout de tablet em paisagem entre 768px e 980px.
- Trocar `rgba()` literais por tokens com `color-mix()`.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|----|--------|-----------------------------|-------------|----------|
| D01 | Quando o tutor desenha na lousa e o aluno está no chat, trocar de aba sozinho ou só indicar? | PO / Design | Não | **Proposta adotada em RF05:** só indicar; troca automática apenas por ação explícita. PO confirmar. |
| D02 | Empacotar fontes `.woff2` (ex.: Plus Jakarta Sans + JetBrains Mono) ou usar pilha de sistema? | Dev / PO | Não | — |
| D03 | No mobile, tocar no palco compacto expande a cabeça holográfica em sobreposição? | Design / Dev | Não | Decidir junto com a spec da cabeça holográfica, que define o enquadramento. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|----|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Auditoria estática | unit | CA01, CA02 | Teste que lê os HTMLs e `src/styles/*.css`: conta `style="`, `Courier New`, hex fora de `tokens.css` e `var(--x)` sem definição | Todas as contagens = 0 |
| CT02 | Primeira dobra no mobile | manual | CA03 | Abrir `tutor.html` nos 3 viewports e medir caixas de cabeçalho, palco, abas e barra | Tudo visível; sem rolagem horizontal; alvos ≥ 44x44 |
| CT03 | Abas e indicador | unit | CA04 | Aba `Chat` ativa; disparar `lousa:item-exibido`; tocar "Ver na lousa"; voltar | Indicador sem troca automática; troca no toque; rolagem preservada |
| CT04 | Controle segmentado | unit | CA05 | Selecionar `Modo Dica` com `ArrowRight`; enviar com `fetch` mockado | Payload com modo dica; `aria-checked` correto |
| CT05 | Diálogo de remoção | unit | CA06 | Espiar `window.confirm`; cancelar, `Escape`, confirmar | `confirm` não chamado; chave mantida/removida conforme a escolha; foco devolvido |
| CT06 | Categorias e prévia | manual | CA07 | `configuracoes.html` em `390x844`; trocar persona | Uma categoria aberta; prévia atualizada |
| CT07 | Home offline | manual | CA08 | DevTools offline; recarregar `index.html` | SVGs nos 3 cards; 0 requisições externas falhando |
| CT08 | Movimento reduzido e contraste | manual | CA09, CA10 | Emular `prefers-reduced-motion`; Lighthouse com cada persona | 0 animações contínuas; 0 falhas de contraste |
| CT09 | Teclado virtual | manual | CA11 | Android real/emulado; focar o campo de texto | Campo e envio visíveis acima do teclado |
| CT10 | Regressão | unit | CA12 | `npm test` e `npm run build`; checar IDs de RNF03 no `dist/tutor.html` | Exit 0; todos os IDs presentes |
| CT11 | Lousa oculta | manual | CA13 | Aba `Chat`; pergunta que gera lousa | Sem erro no console; cabeça não vira para elemento oculto |

## URL Complementar

- Documentação técnica: `src/styles/DESIGN_SYSTEM.md` (entrega do RF01); `src/styles/tokens.css`; [AGENTS.md](../AGENTS.md)
- Protótipo / mockup: wireframes ASCII abaixo (padrão *Langclean* `plan-screen-with-ascii`; Desktop ≠ Mobile).

  **Desktop (> 980px) — `tutor.html`, estudo lado a lado:**
  ```text
  +----------------------------------------------------------------------------------+
  | [TutorIA]  [Lia | 7º ano]                  (IA Pronta)  [Caderno] [Config]      |
  +---------------------------------------------------+------------------------------+
  | PALCO                                             | CONVERSA (440px)             |
  |  +--------------------+  +---------------------+  | [● Ativa]   [+ Nova sessão]  |
  |  | Tubo de energia    |  |  LOUSA (fórmula,    |  +------------------------------+
  |  | + cabeça holográf. |  |  gráfico, passos)   |  | (balão do tutor + ações)     |
  |  | Crédito da persona |  |  [Zoom] [Limpar]    |  | (balão do aluno + foto)      |
  |  +--------------------+  +---------------------+  | ...                          |
  |                                                   +------------------------------+
  |               ( [mic] Falar )                     | [Explicação | Dica]  [Foto]  |
  |      Status: Ouvindo / Pensando / Falando         | [Digite sua dúvida...]  [>]  |
  +---------------------------------------------------+------------------------------+
  ```

  **Mobile (≤ 980px / Android) — `tutor.html`, zona do polegar:**
  ```text
  +------------------------------------------+
  | [TutorIA]  [7º ano]  [Caderno]  [Config] |  <- cabeçalho compacto + safe-area-top
  +------------------------------------------+
  | [tubo mini] Lia · Pensando...   [+ Nova] |  <- palco compacto (cabeça no tubo;
  +------------------------------------------+     o tubo indica o estado)
  |   [  Lousa (•)  ]   |   [    Chat    ]   |  <- abas com indicador de novidade
  +------------------------------------------+
  |                                          |
  |   Conteúdo da aba ativa ocupa o meio     |  <- lousa ampliável OU chat rolável
  |                                          |
  +------------------------------------------+
  |  [Explicação | Dica]            [Foto]   |  <- controles acima do campo
  |  ( mic )  [Digite sua dúvida...]   [ > ] |  <- barra fixa + safe-area-bottom
  +------------------------------------------+
  ```
- Discussões relacionadas: [2026-11-20_avatar-cabeca-holografica.md](2026-11-20_avatar-cabeca-holografica.md) · [2026-11-19_harness-agentico-tools-e-controle-lousa.md](2026-11-19_harness-agentico-tools-e-controle-lousa.md) (`focar_item_lousa` troca para a aba `Lousa`) · [2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md](2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md) · [2026-11-19_gateway-proxy-opcional-e-modo-turma.md](2026-11-19_gateway-proxy-opcional-e-modo-turma.md)
- Referências de design: *Masterclass - Criando Interfaces Absurdas com IA* (Nível 4: Code Reference + Design System; Desktop ≠ Mobile; revisão de UX pós-geração) e *Langclean* aulas `03` e `04` (`plan-screen-with-ascii`, `ascii-to-image`).
- Requisitos originais: pedido de aproveitamento do curso *Asimov - Aplicações Inteligentes com IA* para o TutorIA (2026-11-19).
- Issue / PR relacionado: a criar na branch `feat/vibe-design-system-ux-mobile`, conforme [CLAUDE.md](../CLAUDE.md).
