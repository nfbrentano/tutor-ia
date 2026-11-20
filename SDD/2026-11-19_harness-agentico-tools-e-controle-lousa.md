# [FEAT] Harness Agêntico (ReAct): Tool Calling, Busca Sob Demanda nos Livros e Controle Dinâmico da Lousa

> **Status:** Em revisão
> **Autor:** Natanael Brentano (com apoio de IA — curadoria curso Asimov) · **Revisor:** · **Criada em:** 2026-11-19 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Evoluir a integração com o Gemini (`src/gemini.ts`, `src/tutor.ts`), hoje uma chamada única, para **Agente = Modelo + Harness** com ciclo **ReAct** em TypeScript puro, dando ao tutor três capacidades:
  1. **Consulta sob demanda à base de conhecimento e ao Caderno:** via `tools.functionDeclarations` da Gemini REST API, o modelo decide quando listar livros ativos, refinar a busca BM25, ler uma página do índice (`public/conhecimento/indice.json`) ou consultar anotações do `GerenciadorCaderno`.
  2. **Controle seguro da lousa (`controlar_interface`, inspirado no `ui_focus` do *Langclean*):** focar/destacar um item ou passo já exibido, abrir o quiz atual ou sugerir salvar no Caderno, sem regenerar a explicação.
  3. **Progresso visível e autocorreção:** status curto enquanto uma ferramenta roda, erros estruturados em `functionResponse` para o modelo se corrigir e tratamento de vários `parts[]` (`functionCall`, `thoughtSignature`, `text`).
- **Problema e evidência** (código verificado em 2026-11-20):
  - **RAG em passo único (`src/tutor.ts:963-970`):** `buscarTrechosRelevantes()` roda uma vez, antes da chamada, com `textoLimpo`. Pergunta só com foto (`textoLimpo === ""`) não consulta livro nenhum; follow-ups curtos (*"me dá outro exemplo disso"*) não têm termos do livro e o modelo não pode buscar por conta própria. Além disso, `extrairEValidarFontes` (`src/gemini.ts:308-348`) só aceita fontes que estejam entre os `trechosContexto` enviados no prompt.
  - **Lousa sempre apagada (`src/tutor.ts:837` e `src/espera/controlador.ts:96-110`):** toda pergunta chama `lousa.limpar()` no início e, se a resposta demorar mais que `tempoLousaPreparacaoMs` (3.500 ms, `src/espera/config.ts:23`), a espera ativa limpa de novo para escrever o título de preparação. Em *"não entendi o passo 2"* o modelo precisa reescrever tudo, porque não há como apontar para um item existente (o `LousaControlador` só tem `abrir`, `fechar`, `limpar`, `adicionarItem`, `abrirDesafioQuiz` e `carregarItens`).
  - **Leitura de `parts[0]` (`src/gemini.ts:976`, `:1037`):** `functionCall` e `thoughtSignature` em outros `parts` são ignorados. A correção do parser pertence à spec de roteamento (RF03) e é pré-requisito desta.
- **Impacto de não fazer:** citações omitidas em perguntas com foto e follow-ups, tokens gastos regenerando lousas já exibidas e nenhuma base para fluxos agênticos.
- **Para quem é destinado:** alunos do 6º ano EF ao 3º ano EM, na Web e no Android (Capacitor), e o time de engenharia.
- **História de usuário:** Como aluno estudando com fotos do caderno ou fazendo várias perguntas seguidas sobre um tema, quero que o tutor consulte as páginas certas dos livros didáticos e destaque os passos relevantes direto na minha lousa, para que eu entenda sem perder o contexto nem esperar explicações repetidas.
- **Como saberemos que deu certo:**
  - No máximo 5 chamadas HTTP por pergunta (4 rodadas de ferramentas + 1 síntese) em 100% dos casos, com streaming de etapas preservado em `onEtapaRecebida`.
  - Em follow-ups sobre a lousa atual (*"não entendi o passo 2"*), a lousa não é apagada e o item é destacado.
  - JS inicial de `tutor.html` cresce ≤ 8 KB gzip e continua ≤ 100 KB gzip (hoje ≈ 41 KB: `tutor` 24,8 + `index` 13,7 + `pwa` 2,6 no build de 2026-11-18).
  - Todos os testes do loop agêntico passam em `npm test` sem rede.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Loop ReAct (`src/harness/`):** `executarLoopAgentico` envia `tools: [{ functionDeclarations }]`, usa o parser de `parts[]` da spec de roteamento (RF03) e, enquanto houver `functionCall`, executa as ferramentas e reenvia o turno `model` **com os `parts` originais intactos** (incluindo `thoughtSignature`) seguido do turno com os `functionResponse`. Sem `functionCall`, entrega as etapas por `onEtapaRecebida`. `usoTokens` da resposta é a soma de todas as iterações. | P0 | CA01, CA02, CA03 |
| RF02 | **Ferramentas de leitura (`src/harness/ferramentas.ts`):** (a) `listar_livros_disponiveis()` — `id`, `titulo`, `disciplina`, `serie` do catálogo, sem os desativados (`getStoredDisabledBookIds()`); (b) `buscar_no_livro(consulta, livroId?, limite?)` — `buscarTrechosRelevantes()` sobre o índice em memória, `limite` ≤ 5 (padrão `CONSTANTES_BM25.LIMITE_PADRAO` = 3); (c) `ler_pagina_livro(livroId, pagina)` — trechos com aquele `livroId` e `pagina` em `indiceConhecimento.trechos`; (d) `consultar_caderno(materia?, consulta?)` — `GerenciadorCaderno.listarNotas(materia)` filtrado localmente pela consulta, no máximo 3 notas. Ferramentas de livro só são declaradas se o índice estiver carregado e houver ao menos 1 livro ativo. | P0 | CA02, CA04, CA07 |
| RF03 | **Fontes vindas de ferramentas:** `extrairEValidarFontes` passa a aceitar a união de `trechosContexto` com os trechos devolvidos por `buscar_no_livro`/`ler_pagina_livro` naquela pergunta; fontes fora desse conjunto continuam descartadas. | P0 | CA02 |
| RF04 | **Controle da lousa (`controlar_interface`):** ações não destrutivas: `focar_item_lousa({ indiceItem, numeroPasso? })` — novo `LousaControlador.focarItem()` que rola até o item, aplica classe de destaque (removida no próximo foco ou nova resposta) e dispara `lousa:item-exibido`, fazendo o avatar **olhar** para o item (na cabeça holográfica não há braço, ver RF06 de `2026-11-20_avatar-cabeca-holografica.md`); no mobile, troca para a aba `Lousa` (RF05 da spec de design system). `abrir_quiz_lousa()` — usa `lousa.abrirDesafioQuiz()` (`src/lousa/index.ts:169`) com `chat.obterUltimoDesafio()` (`src/chat.ts:115`). `sugerir_salvar_caderno()` — só destaca o botão "⭐ Salvar no Caderno" já existente; salvar continua exigindo clique. Os índices que o modelo usa vêm de `resumoLousaAtual` (RF04b da spec de prompt). | P0 | CA05, CA06, CA11 |
| RF05 | **Não apagar a lousa em follow-up:** `ehPerguntaDeAcompanhamento(texto, historico)` local e determinística (ex.: *"passo N"*, *"não entendi"*, *"isso"*, *"anterior"*, *"de novo"*, com histórico não vazio e lousa com itens). Quando verdadeira: não chamar `lousa.limpar()` em `src/tutor.ts:837` e não escrever a lousa de preparação de `src/espera/controlador.ts:96-110`; se a resposta trouxer itens novos de lousa, limpar só antes do primeiro item novo. Quando falsa: comportamento atual. | P0 | CA05, CA12 |
| RF06 | **Várias `functionCall` e erros recuperáveis:** N chamadas no mesmo turno executam via `Record<string, ToolHandler>` e devolvem N `functionResponse` juntos. Ferramenta inexistente, parâmetro inválido, índice fora da lousa ou `livroId` desativado/inexistente → `{ ok: false, erro: "..." }`, sem derrubar a requisição. | P1 | CA03, CA07 |
| RF07 | **Progresso visível:** `onToolProgresso(nomeTool, resumoCurto)` atualiza `#status-text` (`tutor.html:230`) com texto curto (ex.: *"Consultando o livro didático..."*), coordenado com `ControladorEspera`, sem disparar fala nem interromper a fala em curso. | P1 | CA08 |
| RF08 | **Sem framework no cliente:** harness em TypeScript modular, sem novas dependências em `package.json`. | P0 | CA01 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | **Teto de iterações:** `MAX_ITERACOES_AGENTE = 4` rodadas de ferramentas; ao atingir, 1 chamada final sem `tools` pedindo síntese com o que já foi reunido (≤ 5 chamadas HTTP por pergunta). | P0 | CA09 |
| RNF02 | **Orçamento e privacidade:** cada `functionResponse` ≤ 4.000 caracteres (truncado em fronteira de trecho); só o resultado pedido trafega para a API — nunca o Caderno inteiro nem o livro inteiro. | P0 | CA04 |
| RNF03 | **Segurança e HITL:** nenhuma ferramenta apaga ou altera notas, configurações, chave ou livros; nenhuma injeta HTML/SVG (conteúdo visual continua passando por `src/lousa/sanitizer.ts`); ação persistente só com clique do aluno. | P0 | CA06 |
| RNF04 | **Offline e cache:** com acerto em `gerenciadorCache.buscarEmCache()` (só consultado sem foto, no modo completo e sem histórico na conversa, `src/tutor.ts:874-961`), a resposta sai em ≤ 300 ms sem iniciar o harness; offline sem cache, falha com a mensagem `rede_offline` da spec de roteamento. | P0 | CA10 |
| RNF05 | **Cancelamento:** `signal.aborted` é verificado antes de cada iteração e de cada ferramenta; após o cancelamento, 0 novas chamadas HTTP. | P0 | CA13 |

### Dependências técnicas

- `src/gemini.ts`, `src/tutor.ts`, `src/conhecimento/busca.ts`, `src/conhecimento/tipos.ts`, `src/caderno/index.ts`, `src/lousa/index.ts`, `src/lousa/renderer.ts`, `src/espera/controlador.ts`, `src/chat.ts`, `src/armazenamento.ts`.
- **Ordem de implementação: 3 de 5 (trilha de IA).** Pré-requisitos: RF03 (parser de `parts[]`) e RF05 (classificação de erros) de `2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md`; RF01 (`montarSystemPrompt`) e RF04b (`resumoLousaAtual`) de `2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md`. Se RF04b ainda não existir, o harness injeta o mesmo resumo da lousa em `# Contexto Ativo`.
- Avatar: "apontar para a lousa" virou "olhar para o item" em `2026-11-20_avatar-cabeca-holografica.md` (RF06).
- Mobile: a troca para a aba `Lousa` ao focar item depende de RF04/RF05 de `2026-11-19_vibe-design-system-e-ux-mobile-first.md`; sem essa spec, `focarItem` apenas rola e destaca.
- Modo proxy (`2026-11-19_gateway-proxy-opcional-e-modo-turma.md`): cada iteração é uma chamada ao proxy e conta na cota da turma (até 5 por pergunta).

### Recursos necessários

- Nenhuma dependência npm nova (`fetch` nativo + Gemini REST API `v1beta`).

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que a API (mock) responde à primeira chamada sem `functionCall`, quando o harness processa *"Quanto é 2 + 2?"*, então há exatamente 1 chamada HTTP e as etapas chegam a `onEtapaRecebida` no formato JSON atual.
- [ ] **CA02:** Dado que o aluno envia só uma foto e a API (mock) pede `buscar_no_livro` e depois responde citando a página devolvida pela ferramenta, quando o loop termina, então a 2ª requisição contém o `functionResponse` com o trecho e a fonte citada aparece no balão (não é descartada pela validação).
- [ ] **CA03:** Dado que a API (mock) devolve duas `functionCall` (`listar_livros_disponiveis` e `consultar_caderno`) com `thoughtSignature`, quando o harness processa o turno, então as duas executam, a próxima requisição reenvia o turno `model` com o `thoughtSignature` intacto e os dois `functionResponse` vão juntos.
- [ ] **CA04:** Dado que o agente chama `ler_pagina_livro` para uma página com 6.000 caracteres de trechos, quando a ferramenta responde, então só trechos daquela página são devolvidos, com ≤ 4.000 caracteres.
- [ ] **CA05:** Dado que a lousa exibe 3 passos de uma equação e o aluno pergunta *"Não entendi o passo 2"*, quando o agente chama `controlar_interface('focar_item_lousa', { indiceItem: 0, numeroPasso: 2 })`, então os itens existentes continuam na lousa (nem `tutor.ts` nem a espera ativa os apagam), o passo 2 recebe a classe de destaque e rolagem, e o avatar olha para ele.
- [ ] **CA06 (negativo / HITL):** Dado que o modelo pede `sugerir_salvar_caderno` ou uma ação não declarada (ex.: `apagar_nota`), quando o harness processa, então nenhum registro do IndexedDB é criado, alterado ou apagado; a ação não declarada recebe `{ ok: false }`.
- [ ] **CA07 (erro recuperável):** Dado que o livro `ciencias-fundamental-6` está desativado em Configurações, quando o agente chama `ler_pagina_livro('ciencias-fundamental-6', 1)`, então recebe `{ ok: false, erro: "Livro desativado pelo aluno." }` sem nenhum texto do livro e o loop continua.
- [ ] **CA08:** Dado que uma ferramenta leva 1 s para responder, quando ela executa, então `#status-text` mostra o texto de progresso durante a execução e nenhuma fala é iniciada ou cortada por isso.
- [ ] **CA09 (caso-limite):** Dado que a API (mock) devolve `functionCall` em toda resposta com `tools`, quando o harness atinge 4 rodadas, então faz 1 chamada final sem `tools` e para, totalizando 5 chamadas.
- [ ] **CA10 (offline):** Dado que o app está sem conexão e a primeira pergunta da sessão (sem foto, modo completo) está no cache, quando `processarPergunta` roda, então responde em ≤ 300 ms sem nenhuma chamada `fetch`.
- [ ] **CA11 (erro recuperável):** Dado que a lousa tem 2 itens, quando o agente chama `focar_item_lousa({ indiceItem: 5 })`, então recebe `{ ok: false, erro: ... }` e nada muda na lousa.
- [ ] **CA12 (negativo):** Dado que a lousa tem itens e o aluno faz uma pergunta nova sem relação (*"O que é fotossíntese?"*), quando a pergunta é enviada, então a lousa é limpa como hoje (comportamento atual preservado).
- [ ] **CA13:** Dado que o loop está na 2ª rodada de ferramentas, quando o aluno toca no microfone para cancelar, então nenhuma ferramenta nova executa e nenhuma chamada HTTP nova é feita.

## O que a atividade não inclui

- Migrar o cliente para LangChain.js / LangGraph: motivo: dezenas de KB a mais no bundle e adaptadores desnecessários no WebView; as aulas `17` e `21` validam o harness próprio quando se quer controle leve.
- `web_search` ou servidores MCP externos: motivo: exigem proxy/chaves de busca e fogem do foco curricular offline-first.
- Ações destrutivas no Caderno ou nas Configurações via chat: motivo: segurança e *human-in-the-loop* (RNF03).
- Ferramentas com `PROVIDER=openrouter` no proxy: motivo: tradução de tool calling entre formatos fica para depois; nesse modo o cliente cai para a chamada única atual.

### Considerado para o futuro (P2)

- Adaptador **MCP** caso o TutorIA se conecte a bibliotecas escolares via proxy (`2026-11-19_gateway-proxy-opcional-e-modo-turma.md`).
- Ferramenta `gerar_desenho_geometrico` com primitivas validadas no lugar de SVG livre.
- Casos de evals medindo chamadas de ferramenta desnecessárias.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|----|--------|-----------------------------|-------------|----------|
| D01 | Usar `streamGenerateContent?alt=sse` em todas as iterações ou só na final? | dev | Não | **Recomendação:** SSE desde a 1ª chamada, detectando `functionCall` ou texto no stream (economiza 1 ida e volta quando não há ferramenta, CA01). Validar o formato de `functionCall` no SSE durante a implementação. |
| D02 | O cancelamento pelo microfone aborta ferramentas pendentes? | dev | Não | **Sim**, virou RNF05/CA13. |
| D03 | A API aceita `tools` junto com `responseMimeType: 'application/json'` (`src/gemini.ts:889`) em todos os modelos da fila? | dev | Sim (para o desenho do payload) | Verificar no início da implementação. Se algum modelo responder `400 INVALID_ARGUMENT` — que hoje aborta a fila inteira (`naoRepetir`, `src/gemini.ts:933-936`) —, omitir `responseMimeType` nas iterações com `tools` e mantê-lo na chamada final sem `tools`. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|----|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Resposta direta | unit | CA01 | `fetch` mockado com JSON de etapas sem `functionCall` | 1 chamada; etapas entregues |
| CT02 | Foto + `buscar_no_livro` + fonte | unit | CA02 | 1ª resposta `functionCall` com `thoughtSignature`; 2ª cita a página devolvida | 2ª requisição com `parts` preservados e `functionResponse`; fonte exibida |
| CT03 | Duas chamadas no mesmo turno | unit | CA03 | Resposta com 2 `functionCall` | 2 `functionResponse` na mesma requisição seguinte |
| CT04 | Leitura de página com teto | unit | CA04, RNF02 | Índice com 3 páginas, uma com 6.000 caracteres | Só a página pedida, ≤ 4.000 caracteres |
| CT05 | Foco sem apagar | unit | CA05 | 3 itens na lousa; follow-up "não entendi o passo 2"; avançar timers da espera além de 3.500 ms; `focar_item_lousa` | 3 itens mantidos; classe de destaque no passo 2; evento `lousa:item-exibido` disparado |
| CT06 | HITL no Caderno | unit | CA06, RNF03 | `sugerir_salvar_caderno` e `apagar_nota` com `GerenciadorCaderno` espionado | Nenhuma escrita; `apagar_nota` → `{ ok: false }` |
| CT07 | Livro desativado e índice inválido | unit | CA07, CA11 | Desativar o livro; chamar `ler_pagina_livro` e `focar_item_lousa` com índice 5 | `{ ok: false }` sem vazar texto; lousa intacta |
| CT08 | Teto de iterações | unit | CA09, RNF01 | Mock sempre com `functionCall` quando há `tools` | 4 rodadas + 1 final; total 5 |
| CT09 | Progresso e cache offline | integração | CA08, CA10 | Ferramenta lenta; depois pergunta em cache com `fetch` que lança | Status atualizado; cache responde sem `fetch` |
| CT10 | Pergunta nova limpa a lousa | unit | CA12 | Lousa com itens; enviar pergunta sem marcador de acompanhamento | `lousa.limpar()` chamado como hoje |
| CT11 | Cancelamento no meio do loop | unit | CA13, RNF05 | Abortar o `AbortController` durante a 2ª rodada | Nenhum `fetch` nem ferramenta após o abort |

## URL Complementar

- Documentação técnica: [Gemini API: Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) · [Gemini REST Reference: Tool & FunctionCall](https://ai.google.dev/api/generate-content#tool)
- Protótipo / mockup: N/A (destaque na lousa descrito em RF04; layout mobile em [2026-11-19_vibe-design-system-e-ux-mobile-first.md](2026-11-19_vibe-design-system-e-ux-mobile-first.md)).
- Discussões relacionadas: [DONE/2026-10-16_base-de-conhecimento-livros-pdf.md](DONE/2026-10-16_base-de-conhecimento-livros-pdf.md) · [DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md](DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md) · [2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md](2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md) · [2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md](2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md) · [2026-11-20_avatar-cabeca-holografica.md](2026-11-20_avatar-cabeca-holografica.md)
- Referências de design: `src/lousa/index.ts`, `src/lousa/renderer.ts`, `src/styles/lousa.css`.
- Requisitos originais: adaptação dos módulos do curso *Asimov - Aplicações Inteligentes com IA* (`12_Agente_Modelo_Harness`, `15_Como_fazer_a_LLM_usar_ferramentas`, `17_Usar_ou_não_frameworks`, `20_Mensagens_e_Ferramentas`, `21_Implementando_nosso_primeiro_agente_ReAct`, `28_Conectando_ferramentas`, `35/37_Langclean_ui_focus`).
- Issue / PR relacionado: N/A, a ser criado após revisão da especificação.
