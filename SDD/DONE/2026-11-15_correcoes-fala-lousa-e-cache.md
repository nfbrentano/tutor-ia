# [FIX] Correções de fala por etapas, fórmulas na lousa, cache de livros e transição de espera

> **Status:** Concluído
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-11-15 · **Atualizada em:** 2026-11-17

## Detalhes da Atividade

- **O que precisa ser feito:** Corrigir sete problemas técnicos identificados na revisão do código que afetam diretamente a experiência do aluno na fala por etapas, na exibição de fórmulas na lousa, na transição da espera ativa, no filtro de livros desativados no cache e na acessibilidade dos modais:
  1. **Síntese de voz na Web atropelando etapas:** fazer `WebServicoVoz.falar()` aguardar o término real da fala (`onend`/`onerror`) antes de resolver a `Promise`, igual ao comportamento do `NativoServicoVoz`.
  2. **Corte abrupto da frase de espera no streaming:** aguardar `controladorEspera.notificarPrimeiraEtapaChegou()` antes de iniciar a fala da primeira etapa da explicação.
  3. **Fórmulas LaTeX cruas e numeração duplicada na lousa:** converter comandos LaTeX comuns (`\frac`, `\to`, `\sqrt`, `\times`, etc.) em `formatarFormula()` e evitar prefixar `1.` duplicado nos itens do tipo `passos`.
  4. **Leitura de comandos LaTeX e subscritos pela voz:** limpar e converter notações matemáticas/químicas (`H_2O`, `\frac{1}{2}`, `\to`) em `cleanTextForSpeech()`.
  5. **Cache ignorando livros desativados:** respeitar `getStoredDisabledBookIds()` ao consultar o cache pré-construído e o cache de execução (`IndexedDB`).
  6. **Reprocessamento redundante no streaming SSE:** otimizar `processarBufferIncremental()` para não reprocessar o buffer inteiro a cada token e não descartar etapas legítimas.
  7. **Acessibilidade de modais e fluxo de Configurações:** fechar modais com `Escape`, usar a persona selecionada no teste de voz e retornar para a página de origem após salvar a chave.
- **Problema e evidência:** Auditoria de código em 2026-11-15:
  - **Etapas cortadas na Web (`src/voz/web.ts:68-131` e `src/tutor.ts:380,465`):** `WebServicoVoz.falar()` chama `window.speechSynthesis.speak(utterance)` e resolve a `Promise` imediatamente (em 0 ms), sem esperar `utterance.onend`. Como `tutor.ts` faz `await servicoVoz.falar(etapa.fala)` dentro de um laço `for`/`while`, a etapa 2 começa no mesmo milissegundo e chama `this.pararDeFalar()` (`speechSynthesis.cancel()`), cancelando a fala da etapa 1. Resultado: o aluno só ouve a última etapa e todos os itens da lousa aparecem de uma só vez.
  - **Passagem de vez quebrada (`src/tutor.ts:445-448` e `511-515`):** em `onEtapaRecebida`, `primeiraEtapaIniciada` é marcada como `true` e `controladorEspera.notificarPrimeiraEtapaChegou()` é chamada **sem `await`**. Quando `consumirFilaEtapas()` roda na linha seguinte, `if (!primeiraEtapaIniciada)` dá `false` e a fala da etapa 1 atropela a frase de espera no meio da palavra, violando o RF07/CA08 de `2026-10-16_comportamento-de-espera-e-streaming.md`.
  - **LaTeX cru na lousa (`src/lousa/sanitizer.ts:27-42` e `scripts/gerar-cache.ts:43,250,269`):** o cache pré-construído e o Gemini enviam `\frac{1}{2} + \frac{1}{3} = \frac{?}{?}` e `6 CO_2 + 6 H_2O + Luz \to C_6H_{12}O_6 + 6 O_2`, mas `formatarFormula()` só trata `^` e `_`. O aluno vê literalmente `\frac{1}{2}` e `\to` na lousa. Além disso, `src/lousa/renderer.ts:45` adiciona `<span class="passo-numero">1</span>` mesmo quando a string já começa com `"1. "`, exibindo `1  1. MMC(2, 3) = 6`.
  - **Voz lendo símbolos crus (`src/gemini.ts:118-128`):** `cleanTextForSpeech()` mantém `H_2O`, `x^2`, `\frac{1}{2}` e `\to`, fazendo o sintetizador ler "barra frac" ou "sublinhado".
  - **Livro desativado citado pelo cache (`src/tutor.ts:365` vs `425`):** `gerenciadorCache.buscarEmCache(textoLimpo)` é chamado antes de ler `getStoredDisabledBookIds()`. Se o aluno desativa o livro de Ciências em Configurações e pergunta "o que é fotossíntese?", o cache devolve a resposta citando o livro desativado, violando o RF11/CA11 de `2026-10-16_base-de-conhecimento-livros-pdf.md`.
  - **Streaming ineficiente (`src/gemini.ts:579-672`):** `processarBufferIncremental()` revalida o buffer desde o índice 0 a cada chunk SSE e deduplica etapas por `e.fala === obj.fala.trim()`.
  - **Gravador e Configurações (`src/gravador/pagina.ts:201`, `src/configuracoes.ts:173-192`):** `URL.createObjectURL` em vídeos do gravador nunca é revogado; o teste de voz em Configurações ignora a persona selecionada; e modais (`#lightbox-overlay`, `#modal-fonte-overlay`) não fecham com `Escape`.
- **Impacto de não fazer:** O principal diferencial do TutorIA (explicação falada passo a passo sincronizada com a lousa) falha no navegador porque as etapas iniciais são canceladas pela última; fórmulas básicas de frações e química aparecem com código LaTeX quebrado na lousa; e livros desativados continuam aparecendo nas respostas em cache.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio (web e Android) e time de desenvolvimento.
- **História de usuário:** Como aluno, quero que o tutor fale todas as etapas da explicação até o fim, sincronizadas com fórmulas legíveis na lousa e respeitando minhas configurações de livros e voz, para que eu compreenda a matéria sem cortes na fala nem símbolos estranhos na tela.
- **Como saberemos que deu certo:**
  - Numa resposta de 4 etapas no navegador, as 4 etapas são faladas integralmente em sequência e cada item da lousa surge apenas no início da sua própria etapa.
  - 0 ocorrências de `\frac`, `\to`, `\sqrt` ou numeração duplicada (`1 1.`) visíveis na lousa nas perguntas do cache e nas 20 perguntas de referência.
  - 100% dos testes unitários existentes e novos passando em `npm test` e 0 erros em `npm run typecheck`.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Fala assíncrona real na Web (`src/voz/web.ts`):** `WebServicoVoz.falar()` deve retornar uma `Promise<void>` que só resolve quando `utterance.onend` ou `utterance.onerror` disparar, ou quando `pararDeFalar()` for chamado. Incluir timeout de segurança proporcional ao tamanho do texto (mín. 15 s) para evitar travamento caso uma voz do navegador não dispare `onend`. | P0 | CA01, CA02 |
| RF02 | **Sincronização da passagem de vez (`src/tutor.ts`):** remover a chamada não aguardada de `controladorEspera.notificarPrimeiraEtapaChegou()` dentro de `onEtapaRecebida` e garantir que `consumirFilaEtapas()` sempre faça `await controladorEspera.notificarPrimeiraEtapaChegou()` antes de exibir a lousa e falar a primeira etapa. | P0 | CA03 |
| RF03 | **Formatação de LaTeX e passos na lousa (`src/lousa/sanitizer.ts`, `src/lousa/renderer.ts`):** (a) em `formatarFormula()`, converter `\frac{a}{b}` para fração legível (`<span class="formula-frac"><sup>a</sup>⁄<sub>b</sub></span>` ou `a/b`), `\to` e `\rightarrow` para `→`, `\times` e `\cdot` para `×`, `\div` para `÷`, `\pm` para `±`, `\neq` para `≠`, `\leq` para `≤`, `\geq` para `≥`, `\sqrt{x}` para `√(x)`, e remover `\$` delimitadores; (b) em `renderizarItemLousa` (`tipo === 'passos'`), remover prefixo numérico redundante (`^\d+[\.\)\-]\s*`) do texto de cada passo antes de renderizar a bolinha numerada. | P0 | CA04, CA05 |
| RF04 | **Limpeza de texto para fala (`src/gemini.ts`):** atualizar `cleanTextForSpeech()` para converter notações matemáticas/químicas comuns em leitura natural antes do TTS (ex.: `\frac{a}{b}` → `a sobre b`, `\to` / `->` → `gera` ou `para`, `H_2O` → `H2O`, `CO_2` → `CO2`, `x^2` → `x ao quadrado`, removendo comandos LaTeX residuais `\[a-zA-Z]+`). | P0 | CA06 |
| RF05 | **Filtro de livros desativados no cache (`src/conhecimento/cache.ts`, `src/tutor.ts`):** passar `livrosDesativados` para `gerenciadorCache.buscarEmCache(pergunta, { livrosDesativados })`. Se uma resposta do cache citar qualquer `livroId` que esteja desativado pelo aluno, ignorar o cache e prosseguir com a busca/chamada normal sem aquele livro. | P0 | CA07 |
| RF06 | **Otimização do parser incremental de streaming (`src/gemini.ts`):** em `processarBufferIncremental()`, controlar o índice já processado do buffer e o número de etapas emitidas para não reexecutar `JSON.parse` nas etapas já entregues a cada chunk SSE, permitindo duas etapas com falas distintas mesmo que tenham estruturas semelhantes e preservando o limite de 8 etapas. | P1 | CA08 |
| RF07 | **Acessibilidade de modais, retorno de Configurações e vazamento de URL (`src/tutor.ts`, `src/configuracoes.ts`, `src/gravador/pagina.ts`):** (a) fechar `#lightbox-overlay` e `#modal-fonte-overlay` ao pressionar `Escape`; (b) em `configuracoes.ts`, aplicar a voz/pitch da persona selecionada no botão "Ouvir Demonstração da Voz" quando nenhuma voz fixa estiver travada, e oferecer retorno automático/destacado para `tutor.html` quando aberto via `?origem=tutor` ou `?origem=inicio`; (c) revogar o `ObjectURL` anterior em `selecionarArquivo()` do gravador de gestos. | P1 | CA09, CA10 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Segurança: toda conversão em `formatarFormula()` deve operar **após** `escapeHtml(formula)`, garantindo 0 possibilidade de injeção de HTML/XSS a partir do texto da fórmula. | P0 | CA04 |
| RNF02 | Resiliência de áudio: se `pararDeFalar()` for chamado enquanto uma `Promise` de `WebServicoVoz.falar()` estiver pendente, a `Promise` deve resolver em ≤ 50 ms para não bloquear a fila de etapas nem o cancelamento. | P0 | CA02 |
| RNF03 | Compatibilidade: manter 100% de compatibilidade com a interface `ServicoVoz` e com os testes existentes em Vitest (`happy-dom`). | P0 | CA01 |

### Dependências técnicas

- `src/voz/web.ts`, `src/tutor.ts`, `src/lousa/sanitizer.ts`, `src/lousa/renderer.ts`, `src/gemini.ts`, `src/conhecimento/cache.ts`, `src/configuracoes.ts`, `src/gravador/pagina.ts`.
- Especificações relacionadas já implementadas: [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md), [DONE/2026-10-16_comportamento-de-espera-e-streaming.md](DONE/2026-10-16_comportamento-de-espera-e-streaming.md) e [DONE/2026-10-16_base-de-conhecimento-livros-pdf.md](DONE/2026-10-16_base-de-conhecimento-livros-pdf.md).

### Recursos necessários

- Nenhum recurso externo novo (todas as correções são no código TypeScript/CSS existente).

## Critérios de Aceitação / Entregas

- [x] **CA01:** Dado uma resposta com 3 etapas faladas no navegador (`WebServicoVoz`), quando a etapa 1 começa a ser falada, então a etapa 2 só começa após o evento `onend` da etapa 1, e todas as 3 etapas são faladas até o fim na ordem correta. *(Verificado em `tests/espera.test.ts` — `CT01`.)*
- [x] **CA02 (negativo):** Dado que o tutor está falando a etapa 1 no navegador, quando o aluno clica no microfone ou envia nova pergunta (`pararDeFalar()`), então a `Promise` de `falar()` resolve imediatamente (≤ 50 ms) e as etapas 2 e 3 **não** são faladas. *(Verificado em `tests/espera.test.ts` — `CT02`.)*
- [x] **CA03:** Dado que o tutor está no meio de uma frase de reação da espera ativa e a 1ª etapa chega via streaming (`onEtapaRecebida`), quando `consumirFilaEtapas()` executa, então ele aguarda a conclusão (ou o corte de 1,5 s) da frase de espera antes de iniciar a fala da etapa 1, sem sobrepor duas vozes. *(Verificado em `tests/espera.test.ts` — `CT03` e corrigido em `src/tutor.ts`.)*
- [x] **CA04:** Dado uma fórmula contendo `\frac{1}{2} + \frac{1}{3}`, `6 CO_2 + 6 H_2O \to C_6H_{12}O_6` e `<script>alert(1)</script>`, quando processada por `formatarFormula()`, então as frações, subscritos e seta (`→`) são formatados de forma legível, nenhum comando `\frac` ou `\to` fica cru, e a tag `<script>` permanece escapada. *(Verificado em `tests/lousa.test.ts` — `CT04`.)*
- [x] **CA05:** Dado um item de lousa do tipo `passos` com `["1. Calcular o MMC", "2. Somar numeradores"]`, quando renderizado por `renderizarItemLousa()`, então o texto de cada item não exibe numeração duplicada (`1. ` ao lado do emblema `1`). *(Verificado em `tests/lousa.test.ts` — `CT05`.)*
- [x] **CA06:** Dado o texto `"A fórmula é \\frac{1}{2} e H_2O \\to O_2"`, quando passado para `cleanTextForSpeech()`, então o texto retornado não contém `\frac` nem `\to` nem `_`. *(Verificado em `tests/gemini.test.ts` — `CT06`.)*
- [x] **CA07 (negativo):** Dado que o livro `ciencias-fundamental-6` foi desativado em Configurações, quando o aluno pergunta `"o que é fotossíntese?"`, então `buscarEmCache` **não** retorna a resposta em cache vinculada àquele livro desativado. *(Verificado em `tests/conhecimento.test.ts` — `CT07`.)*
- [x] **CA08:** Dado um stream SSE com 3 etapas no array `"etapas"`, quando os chunks chegam progressivamente, então cada etapa é emitida exatamente 1 vez na ordem correta sem reemitir etapas anteriores. *(Verificado em `tests/espera.test.ts` — `CT08`.)*
- [x] **CA09:** Dado o modal de fonte (`#modal-fonte-overlay`) ou o lightbox (`#lightbox-overlay`) aberto, quando o aluno pressiona a tecla `Escape`, então o modal/lightbox fecha imediatamente. *(Verificado em `tests/lousa.test.ts` — `CT09`.)*
- [x] **CA10:** Dado a página de Configurações com o professor `"Prof. Átomo"` selecionado e voz em modo automático, quando o usuário clica em `"Ouvir Demonstração da Voz"`, então a demonstração utiliza a voz e o `pitch` correspondentes ao Prof. Átomo. *(Resolução de voz e pitch verificada em `tests/personas.test.ts` — `CT10`; reprodução de áudio real no navegador depende de verificação manual.)*

## O que a atividade não inclui

- Adicionar biblioteca externa de LaTeX completa (KaTeX ou MathJax): motivo: adicionaria > 200 KB ao bundle e fontes externas; o parser leve em `formatarFormula` resolve todas as notações do Ensino Fundamental e Médio sem dependências.
- Trocar a Web Speech API por TTS em nuvem pago: motivo: fora do escopo e gera custo por requisição.

### Considerado para o futuro (P2)

- Destaque visual da palavra sendo falada em tempo real na lousa ou no balão do chat (karaokê didático).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Após salvar a chave de API quando o aluno veio redirecionado de `tutor.html?origem=tutor`, redirecionar automaticamente após 1 s ou exibir um botão destacado no banner de sucesso? | PO / design | Não | **Implementado:** exibe link direto `Ir para a Sala de Estudos →` no próprio banner `#key-feedback` quando aberto via `?origem=tutor` ou `?origem=inicio`, mantendo o botão no topo da página. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | `WebServicoVoz.falar` aguarda `onend` | unit | CA01 | Mockar `speechSynthesis.speak`; chamar `falar()` sem disparar `onend` por 100 ms e depois disparar `onend` | A `Promise` continua pendente antes do `onend` e resolve logo após `onend` |
| CT02 | `pararDeFalar` libera `Promise` pendente | unit | CA02 | Chamar `falar()` e em seguida `pararDeFalar()` | A `Promise` de `falar()` resolve sem ficar presa |
| CT03 | Passagem de vez no streaming | unit | CA03 | Simular `ControladorEspera` falando reação quando `onEtapaRecebida` dispara | Etapa 1 só inicia após `notificarPrimeiraEtapaChegou` resolver |
| CT04 | Formatação LaTeX e XSS | unit | CA04 | Chamar `formatarFormula('\\frac{1}{2} + H_2O \\to <script>')` | Sem `\frac` ou `\to` crus; `<sub>2</sub>` presente; `<script>` escapado |
| CT05 | Passos sem número duplicado | unit | CA05 | Renderizar item `passos` com `["1. Passo A", "2) Passo B"]` | `.passo-corpo` contém `"Passo A"` e `"Passo B"` sem `"1."` ou `"2)"` |
| CT06 | Limpeza de fala matemática | unit | CA06 | Chamar `cleanTextForSpeech('H_2O e \\frac{1}{2} \\to x^2')` | Retorno legível sem `\frac`, `\to` ou `_` |
| CT07 | Cache respeita livro desativado | unit | CA07 | Carregar cache com livro `ciencias-fundamental-6` e buscar com `livrosDesativados: ['ciencias-fundamental-6']` | Retorna `null` |
| CT08 | Streaming incremental sem duplicação | unit | CA08 | Enviar 4 chunks SSE formando 3 etapas | Callback chamado 3 vezes na ordem certa |
| CT09 | Fechar modais com `Escape` | unit | CA09 | Abrir modal de fonte e lightbox no DOM e disparar `keydown` com `key: 'Escape'` | Ambos fecham (`hidden` / sem `active`) |
| CT10 | Demonstração de voz com persona | manual | CA10 | Selecionar `Prof. Átomo` em Configurações e clicar em "Ouvir Demonstração da Voz" | Fala com o pitch/voz masculina da persona |

## URL Complementar

- Documentação técnica: [SpeechSynthesisUtterance: end event (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/end_event)
- Protótipo / mockup: N/A, correção de comportamento nos componentes existentes.
- Discussões relacionadas: [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md) · [DONE/2026-10-16_comportamento-de-espera-e-streaming.md](DONE/2026-10-16_comportamento-de-espera-e-streaming.md) · [DONE/2026-10-16_base-de-conhecimento-livros-pdf.md](DONE/2026-10-16_base-de-conhecimento-livros-pdf.md)
- Referências de design: `src/styles/lousa.css` e `src/styles/tutor.css`.
- Requisitos originais: revisão técnica do projeto em 2026-11-15.
- Issue / PR relacionado: N/A, a ser criado.
