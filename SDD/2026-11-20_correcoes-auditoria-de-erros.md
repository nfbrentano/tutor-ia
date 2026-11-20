# [FIX] Correções da Auditoria de Erros (voz no Android, XSS na lousa, cache, histórico e Gemini)

> **Status:** Em andamento
> **Autor:** Natanael Brentano (com apoio de IA) · **Revisor:** · **Criada em:** 2026-11-20 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Corrigir os defeitos confirmados na auditoria de código de 2026-11-20 que afetam o aluno (voz, segurança, respostas erradas) e a confiabilidade do projeto (testes alterando arquivos versionados, specs duplicadas).
- **Problema e evidência:** Achados verificados lendo o código, o código-fonte dos plugins e com provas executadas no navegador:
  1. **Voz no APK nunca envia a pergunta:** em `@capacitor-community/speech-recognition` 7.0.1, `start({ partialResults: true })` resolve na hora sem texto e os erros nunca chegam ao JS (`SpeechRecognition.java`, `beginListening`/`onError`). `src/voz/nativo.ts` tratava essa resolução como fim da escuta.
  2. **XSS no SVG da lousa:** `sanitizarSvg` percorria só `el.children`; instruções de processamento (`<?x ...?>`) sobreviviam, o `outerHTML` as reescrevia e o `innerHTML` as interpretava como HTML. Payload `<svg><?x ><img src=x onerror=…>?></svg>` executou no Chromium.
  3. **Um item inválido da lousa travava a explicação:** `formatarFormula(5)` lançava erro em tabelas com números; `imagem` com `conteudo: null` lançava; a fila de etapas ficava com `processandoFila = true` e o avatar preso em "falando".
  4. **Cache respondia perguntas diferentes:** "Por que a fotossíntese não acontece à noite?" recebia a resposta pronta de "o que é fotossíntese?" (similaridade 0,73), inclusive em perguntas de acompanhamento.
  5. **Falhas eram gravadas no cache:** respostas vazias/bloqueadas ("Não consegui formular…") e streams cortados iam para o IndexedDB e se repetiam offline.
  6. **Imagens da Wikimedia quase nunca apareciam:** a busca não restringia ao namespace de arquivos (`gsrnamespace=6`) e retornava páginas de galeria sem `imageinfo`.
  7. **Imagem atrasada caía na lousa da pergunta seguinte** (sem verificação após o `await` da busca).
  8. **Chave da API na URL** (`?key=`), visível em DevTools/HAR, logs de proxy e inspetor do WebView.
  9. **Histórico cortava a pergunta do aluno** e partia palavras/JSON no meio (`montarHistoricoContents`).
  10. **Erros 400/401/403 eram repetidos em até 4 modelos**, gastando cota e tempo.
  11. **Avisos do microfone entravam no histórico** enviado ao Gemini como se fossem respostas do tutor.
  12. **"R$ 12,50" era lido e exibido como "R 12,50"** (remoção de `$` do LaTeX).
  13. **`npm test` sobrescrevia `public/conhecimento/cache.json`** (timestamps), sujando o git a cada execução.
  14. **Specs duplicadas:** `SDD/2026-10-23_avatar-personas-por-materia.md` e `SDD/2026-10-23_gravador-de-gestos.md` existiam idênticas em `SDD/` e `SDD/DONE/`, contrariando a regra 7 do `CLAUDE.md`.
  15. **Vazamento no avatar 2D:** o listener de `visibilitychange` não era removido em `destruir()` e a piscada continuava agendada depois que o 3D assumia.
  16. **Rolagem horizontal no celular:** em 375 px, `.header-actions` do `tutor.html` passava 77 px da tela (`scrollWidth` 452 > 375) e cortava o selo "Chave Ausente".
- **Impacto de não fazer:** pergunta por voz inutilizável no Android; risco de execução de script com acesso à chave salva; respostas erradas apresentadas com confiança; custo de API desperdiçado.
- **Para quem é destinado:** Estudantes (web e APK) e a equipe que mantém o projeto.
- **História de usuário:** Como estudante, quero que o tutor ouça minha pergunta no celular e responda a ela, não a uma pergunta parecida, para confiar no que aprendo.
- **Como saberemos que deu certo:** todos os CAs abaixo cobertos por `tests/correcoes-auditoria.test.ts`; `npm test` e `npm run typecheck` verdes; `git status` limpo após `npm test`.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | `sanitizarSvg` reconstrói um SVG novo copiando apenas elementos permitidos, atributos seguros e nós de texto; links só para `#âncoras`; `url()` só para ids internos. | P0 | CA01 |
| RF02 | Item malformado da lousa é ignorado sem interromper a fala; a fila de etapas sempre libera `processandoFila` e volta o avatar ao repouso. | P0 | CA02 |
| RF03 | `LousaControlador` descarta itens assíncronos de uma geração anterior a `limpar()`. | P1 | CA03 |
| RF04 | Cache só responde quando no máximo 1 termo da pergunta do aluno está fora da pergunta em cache, e não é consultado quando há conversa em andamento. | P0 | CA04 |
| RF05 | Só respostas completas (`completa !== false`, com ao menos uma fala) são gravadas no cache. | P0 | CA05 |
| RF06 | Histórico encurta primeiro as respostas do modelo, nunca esvazia perguntas do aluno e corta em limite de palavra. | P1 | CA05 |
| RF07 | Chave da API no cabeçalho `x-goog-api-key`; erros 400/401/403 não são repetidos em outros modelos. | P0 | CA06 |
| RF08 | "R$"/"US$" preservados na fala e na lousa. | P2→feito | CA07 |
| RF09 | Busca na Wikimedia restrita a arquivos de imagem e ao CDN `upload`/`thumb.wikimedia.org`. | P1 | CA08 |
| RF10 | Reconhecimento nativo usa `partialResults: false` (resolve com o texto final ou rejeita com erro traduzido) e ignora resultados de escutas antigas; síntese nativa ignora fim de falas interrompidas. | P0 | CA09 |
| RF11 | Avisos do microfone ficam fora do histórico do Gemini. | P2→feito | CA10 |
| RF12 | Cabeçalho quebra em linhas abaixo de 520 px, sem rolagem horizontal. | P1 | CA12 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | `npm test` não altera nenhum arquivo versionado. | P0 | CA11 |
| RNF02 | Nenhuma dependência nova. | P0 | — |

### Dependências técnicas

- `src/lousa/{sanitizer,renderer,index,wikimedia,tipos}.ts`, `src/conhecimento/cache.ts`, `src/gemini.ts`, `src/tutor.ts`, `src/voz/nativo.ts`, `src/avatar/animator.ts`, `scripts/gerar-cache.ts`.

### Recursos necessários

- Aparelho Android para validar o CA09 de ponta a ponta (o comportamento do plugin foi verificado no código-fonte, não em aparelho).

## Critérios de Aceitação / Entregas

- [x] **CA01:** Dado um SVG com instrução de processamento, CDATA, `onload` ou `url()` externo, quando é sanitizado e inserido na lousa, então nenhum script executa e nenhum recurso externo é referenciado; um desenho legítimo continua visível.
- [x] **CA02:** Dado um item de tabela com células numéricas ou uma imagem com `conteudo: null`, quando a etapa é apresentada, então a tabela aparece (ou o item é ignorado) e as etapas seguintes continuam sendo faladas.
- [x] **CA03:** Dado que uma imagem ainda está sendo buscada, quando o aluno faz outra pergunta (a lousa é limpa), então a imagem antiga não aparece na lousa nova nem no caderno.
- [x] **CA04:** Dado o cache pré-construído, quando o aluno pergunta "Por que a fotossíntese não acontece à noite?", então a pergunta vai para o Gemini; "o que é uma célula viva?" ainda usa a resposta pronta de "o que é uma célula?".
- [x] **CA05:** Dado um stream cortado ou resposta vazia, quando a resposta termina, então ela não é gravada no cache; dado um histórico acima do orçamento, então as perguntas do aluno são preservadas e nada é cortado no meio de palavra.
- [x] **CA06:** Dado qualquer chamada ao Gemini, quando ela é feita, então a chave não aparece na URL; dado um erro 400, então só uma requisição é feita.
- [x] **CA07:** Dado o texto "Custa R$ 12,50", quando é falado e exibido, então "R$" é mantido.
- [x] **CA08:** Dado o termo "sistema solar", quando a imagem é buscada, então a busca usa `gsrnamespace=6` e retorna o primeiro arquivo `image/*` hospedado na Wikimedia.
- [ ] **CA09:** Dado o APK no Android, quando o aluno toca no microfone e fala, então a pergunta transcrita é enviada; se ficar em silêncio, aparece "Nenhuma fala detectada". *(validação em aparelho pendente)*
- [x] **CA10:** Dado um erro de microfone, quando a próxima pergunta é enviada, então o aviso não faz parte do histórico.
- [x] **CA11 (negativo):** Dado o repositório limpo, quando `npm test` roda, então `git status` continua sem alterações em `public/`.
- [x] **CA12:** Dada uma tela de 375×812 px, quando `index.html`, `tutor.html` ou `configuracoes.html` é aberta, então `scrollWidth` é igual à largura da tela.

## O que a atividade não inclui

- Finalizar a bolha quando o aluno interrompe a resposta (fica com texto parcial e sem ações): motivo: exige redesenhar o ciclo de vida da bolha; baixo impacto.
- Versionar o cache do Service Worker por hash de build (`public/sw.js` usa nome fixo e cache-first para `.vrm`/ícones): motivo: precisa de passo de build; tratar junto da spec de design system/PWA.
- Lista de vozes em Configurações vazia até `voiceschanged` no Chrome: motivo: baixo impacto, só desktop.
- Gerenciamento de foco nos diálogos (`aria-modal` sem trap/retorno de foco) e botão de fechar no lightbox: motivo: entra na spec `SDD/2026-11-19_vibe-design-system-e-ux-mobile-first.md`.
- Download do resumo `.md` via `<a download>` no WebView do Capacitor: motivo: precisa do plugin Filesystem/Share; avaliar com a equipe.
- Aceitar `textoCompleto` como formato de resposta no parser e usar `responseSchema` do Gemini: motivo: depende da spec `SDD/2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md`.

### Considerado para o futuro (P2)

- Rodar os testes de sanitização e voz no modo navegador do Vitest (o happy-dom não reproduz o parser XML do Chromium).
- Texto parcial ("interim") no Android usando o evento `listeningState` com timeout de segurança.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Perder o texto parcial durante a fala no Android é aceitável? | PO | Não | Sim por ora: confiabilidade antes do texto parcial (ver P2). |
| D02 | Erro 429 (cota) deve tentar outro modelo? | dev | Não | Sim: no Gemini a cota gratuita é por modelo, então o fallback pode funcionar. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Payloads de XSS no SVG | unit + manual (Chromium) | CA01 | `sanitizarSvg` com PI/CDATA/onload/url externo; inserir no DOM | Nenhum script, desenho legítimo preservado |
| CT02 | Tabela numérica e imagem nula | unit | CA02 | `renderizarItemLousa` / `adicionarItem` | Sem exceção |
| CT03 | Imagem atrasada | unit | CA03 | `fetch` pendente → `limpar()` → resolver | Lousa vazia |
| CT04 | Falso positivo do cache | unit | CA04 | `buscarEmCache` com perguntas da auditoria | `null` para perguntas diferentes |
| CT05 | Resposta vazia/stream cortado | unit | CA05 | `callGeminiApi` com texto vazio | `completa === false` |
| CT06 | Histórico longo | unit | CA05 | `montarHistoricoContents` com resposta de 7 mil caracteres | Pergunta intacta, total ≤ orçamento |
| CT07 | Chave no cabeçalho / 400 sem repetição | unit | CA06 | `fetch` simulado | URL sem `key=`; 1 chamada |
| CT08 | R$ | unit | CA07 | `cleanTextForSpeech`, `formatarFormula` | "R$" mantido |
| CT09 | Wikimedia | unit + manual | CA08 | `fetch` simulado; consulta real "sistema solar" | Arquivo `image/*` |
| CT10 | Voz no Android | manual (aparelho) | CA09 | Falar e ficar em silêncio no APK | Pergunta enviada / aviso de silêncio |
| CT11 | Testes sem efeito colateral | manual | CA11 | `npm test` e `git status` | Sem alterações |
| CT12 | Celular sem rolagem lateral | manual | CA12 | Viewport 375×812 nas 3 páginas | `scrollWidth === clientWidth` |

## URL Complementar

- Documentação técnica: [Gemini API — autenticação por `x-goog-api-key`](https://ai.google.dev/api), [MediaWiki API `generator=search`](https://www.mediawiki.org/wiki/API:Search)
- Protótipo / mockup: N/A — correções sem mudança de interface.
- Discussões relacionadas: auditoria de código de 2026-11-20.
- Referências de design: N/A.
- Requisitos originais: `SDD/DONE/2026-10-16_lousa-de-apoio-visual.md`, `SDD/DONE/2026-10-16_base-de-conhecimento-livros-pdf.md`, `SDD/DONE/2026-11-15_correcoes-fala-lousa-e-cache.md`, `SDD/DONE/2026-10-16_multipaginas-typescript-e-android.md`.
- Issue / PR relacionado: branch `feat/avatar-cabeca-holografica`.
