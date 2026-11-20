# [FEAT] Roteamento Dinâmico de Modelos Gemini, Controle de Thinking, Telemetria de Custos e Evals

> **Status:** Em revisão
> **Autor:** Natanael Brentano (com apoio de IA — curadoria curso Asimov) · **Revisor:** · **Criada em:** 2026-11-19 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Otimizar custo, latência, assertividade e observabilidade das chamadas ao Gemini em `src/gemini.ts`, `src/armazenamento.ts`, `src/tutor.ts`, `configuracoes.html` e numa suíte CLI de avaliação (`scripts/evals.ts`):
  1. **Roteamento por complexidade + `thinkingConfig`:** classificar cada dúvida em `rapido`, `equilibrado` ou `raciocinio` para escolher a fila de modelos e o nível de raciocínio, e acabar com a trava global de 24h no último modelo bem-sucedido.
  2. **Parser de `parts[]` e captura de `usageMetadata`:** ler todos os `parts` da resposta (texto, `functionCall`, `thoughtSignature`, ignorando `thought: true`) e extrair contagens de tokens e latências. Este parser é **a base compartilhada** usada pelo harness agêntico.
  3. **Diagnóstico de erros e telemetria local:** classificar falhas por causa (chave inválida, cota, offline, filtro de segurança, servidor) e mostrar contadores agregados de consumo em `configuracoes.html`.
  4. **Suíte de Evals (`npm run evals`):** comparar modelos/prompts contra casos escolares reais e casos adversariais anti-alucinação; serve de linha de base para as specs de prompt e harness.
- **Problema e evidência** (código verificado em 2026-11-20):
  - **Fila única e trava de 24h (`src/armazenamento.ts:28-35`, `src/gemini.ts:190-242`):** toda pergunta usa a mesma fila (`gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-flash-latest` → `gemini-2.5-flash-lite` → `gemini-1.5-flash`) sem `thinkingConfig` (o `generationConfig` em `:886-890` só tem `temperature`, `topP` e `responseMimeType`). `registrarModeloSucesso` (`:164-174`) grava o último modelo que respondeu e `obterModelosOrdenados` (`:231-239`) o coloca na frente por 24h: se um fallback como `gemini-1.5-flash` responder uma vez, ele vira o primeiro para tudo durante um dia.
  - **Leitura só de `parts[0]` e `usageMetadata` descartado (`src/gemini.ts:976` no SSE e `:1037` no REST):** respostas com vários `parts` (ex.: `functionCall` do harness, parte vazia com `thoughtSignature`) perdem conteúdo, e não há nenhuma visibilidade de tokens de input/output/thinking. Partes `thought: true` só vêm quando `includeThoughts` é pedido (hoje não é), então ignorá-las é uma proteção preventiva.
  - **Fallback por acaso e mensagem genérica:** `404`/`503` fazem `continue` explícito (`src/gemini.ts:925-931`) e, desde `SDD/2026-11-20_correcoes-auditoria-de-erros.md`, `400`/`401`/`403` recebem `naoRepetir` e abortam a fila (`:933-936`). Os demais status (inclusive `429` e `5xx`) são lançados em `:937` e o `catch` de `:1054-1067` só relança por `naoRepetir`, `AbortError` ou se a mensagem contiver `cancelada`, `API key`, `permission`, `INVALID_ARGUMENT` ou `API_KEY_INVALID`. Ou seja, `429` cai no próximo modelo por acaso da comparação de strings (confirmado com `fetch` mockado em 2026-11-20: 1º `429`, 2º `200` → responde o 2º, que vira o modelo lembrado por 24h), sem espera nem registro. Um `400` por `thinkingConfig` incompatível também abortaria a fila inteira. No fim, `src/tutor.ts:1170-1172` mostra sempre *"verifique sua API Key nas Configurações"*, mesmo em cota esgotada ou sem internet.
  - **Sem avaliação empírica:** nenhum script mede JSON válido, recusa de premissa falsa, tokens ou latência entre modelos/prompts.
- **Impacto de não fazer:** alunos esgotam a cota gratuita com input/thinking mal calibrado, fotos e exercícios difíceis recebem menos raciocínio, erros reais ficam mascarados pela mensagem genérica e as specs irmãs (prompt e harness) não têm como provar que melhoraram algo.
- **Para quem é destinado:** alunos e responsáveis que usam a própria chave do Gemini (BYOK) e desenvolvedores do TutorIA.
- **História de usuário:** Como aluno ou responsável usando minha chave do Gemini, quero que o tutor responda rápido em perguntas simples, pense com mais cuidado em fotos e exercícios difíceis, me avise exatamente quando a cota acabou ou estou sem internet e me mostre quanto estou consumindo, para ter melhor ensino gastando menos.
- **Como saberemos que deu certo:**
  - Classificador: 100% dos casos rotulados do dataset de evals caem no perfil esperado (`rapido`/`equilibrado`/`raciocinio`).
  - 100% das respostas com `usageMetadata` registram `usoTokens` e `modeloUsado`, visíveis no painel de `configuracoes.html`.
  - 0 ocorrências da mensagem genérica de `tutor.ts:1170-1172` nos cenários de erro classificados (chave inválida, cota, offline, segurança, servidor).
  - `npm run evals` gera tabela reproduzível com taxa de JSON válido, aderência às fontes, taxa de correção de premissas falsas, latência (TTFT/total) e tokens por caso e por perfil.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Classificador determinístico de perfil (`src/gemini/roteador.ts` ou `src/gemini.ts`):** função pura `classificarPerfil({ texto, imagem, modoPedagogico, historico })` em < 1 ms: (a) `raciocinio` se houver `imagem`, `modoPedagogico === 'dica'`, ou matéria `matematica`/`fisica_quimica` com pedido de resolução/cálculo/gráfico; (b) `rapido` para mensagens curtas (≤ 60 caracteres) sem imagem, sem matéria detectada e sem verbos de resolução; (c) `equilibrado` no resto. A matéria vem de `detectarMateria()` (`src/personas/materia.ts:72`), a mesma usada pelas personas e pela seleção de skills da spec de prompt — nada de lista de palavras-chave paralela. Preferência do usuário em `configuracoes.html` (`auto` \| `economico` \| `precisao`, salva em `localStorage`): `economico` força `rapido`, `precisao` força `raciocinio`. | P0 | CA01, CA09 |
| RF02 | **`thinkingConfig` seguro e memória de modelo por perfil:** manter uma tabela `CAPACIDADES_MODELO` (modelo → campo de thinking suportado e níveis aceitos) e enviar `generationConfig.thinkingConfig` só quando o modelo estiver na tabela: `thinkingLevel` para a série que o aceita, `thinkingBudget` para `gemini-2.5*`, nada para `gemini-1.5*` e para modelos fora da tabela (ex.: alias `gemini-flash-latest`). Nunca enviar `thinkingLevel` e `thinkingBudget` juntos. Separar `CHAVE_MODELO_SUCESSO` por perfil (`tutoria_modelo_sucesso:<perfil>`) com validade de 4h, e nunca lembrar `gemini-1.5-flash` para `raciocinio`. | P0 | CA02, CA03 |
| RF03 | **Parser único de `parts[]` e `usageMetadata` (`src/gemini.ts`):** função `extrairPartesResposta(candidate)` usada no SSE e no REST que (a) concatena todo `p.text` onde `!p.thought`; (b) devolve `functionCall[]` e preserva os `parts` originais (com `thoughtSignature`) para o harness reenviar; (c) lê `usageMetadata` de qualquer chunk (o último vence) e devolve `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, `cachedContentTokenCount`, `totalTokenCount`; (d) mede `latenciaPrimeiraEtapaMs` e `latenciaTotalMs`. Resultado exposto em `RespostaDidatica.usoTokens` (`src/lousa/tipos.ts:80-97`, ao lado do `completa` já existente); ausência de `usageMetadata` não é erro. | P0 | CA04, CA05 |
| RF04 | **Painel local de consumo (`src/armazenamento.ts`, `src/configuracoes.ts`, `configuracoes.html`):** acumular em `localStorage` só números e nomes de modelo: `totalPerguntas`, `totalChamadasHttp` (o harness pode fazer várias por pergunta), `totalCacheHits`, `tokensInput`, `tokensOutput`, `tokensThinking`, `tokensCached`, `contagemPorModelo`, `errosPorTipo`. Exibir proporção input × output × thinking e economia por cache; botão `"Zerar estatísticas"` com o diálogo de confirmação do app (RF07 da spec de design system, sem `window.confirm`). | P1 | CA05, CA10 |
| RF05 | **Fallback e diagnóstico por status, não por texto (`src/gemini.ts`, `src/tutor.ts`):** estender o `naoRepetir` por status (`:933-936`) e trocar a comparação de substrings de `:1056-1063` por classificação via status HTTP + `error.status` da API em `ErroGeminiTipo` (`'chave_invalida' \| 'cota_excedida' \| 'rede_offline' \| 'filtro_seguranca' \| 'servidor_indisponivel' \| 'requisicao_invalida' \| 'cancelado' \| 'desconhecido'`). Regras: `429`/`5xx` → próximo modelo por regra explícita, sem registrar como 404; `401`/`403`/`API_KEY_INVALID` → aborta a fila (já é assim); `400` cuja mensagem cite o campo de thinking → repete o mesmo modelo 1 vez sem `thinkingConfig`, demais `400` abortam; `TypeError` de `fetch` **ou** `navigator.onLine === false` → `rede_offline` (o `onLine` sozinho não basta no Android, onde fica `true` em Wi-Fi sem internet). `tutor.ts` troca a mensagem fixa de `:1170-1172` por uma por tipo (ex.: *"Você está sem internet — abra o Meu Caderno ou pergunte algo que já está salvo"*; *"Limite temporário da API atingido; tente de novo em alguns segundos"*). | P0 | CA06, CA07, CA08 |
| RF06 | **Suíte de Evals (`scripts/evals.ts`, script `"evals": "tsx scripts/evals.ts"` no `package.json`):** dataset de 12–15 casos com pelo menos: 3 adversariais de premissa falsa (no estilo *Cachoeirinha 1904* da aula `30`), 1 Modo Dica (resposta final **não** pode aparecer), 1 RAG com trechos (fontes só das páginas enviadas), 1 com imagem e 3 rotulados por perfil esperado. Mede JSON válido, aderência às fontes, correção de premissa falsa, TTFT/latência total e tokens por modelo/perfil. `--dry-run` roda com respostas gravadas (sem rede); execução real exige `GEMINI_API_KEY` no ambiente, mostra o número de chamadas antes de começar e aceita `--max-chamadas`. | P1 | CA11 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | **Testes 100% offline:** `npm test` (Vitest) não faz nenhuma chamada externa; a variável chama-se `GEMINI_API_KEY` (sem prefixo `VITE_`, portanto nunca entra no bundle do Vite) e só é lida por `scripts/evals.ts`. | P0 | CA11 |
| RNF02 | **Compatibilidade REST:** nenhum payload leva campo de thinking a modelo fora de `CAPACIDADES_MODELO`; ausência de `usageMetadata` ou de `parts` não lança exceção. | P0 | CA03, CA04 |
| RNF03 | **Privacidade da telemetria:** o acumulador local guarda apenas totais numéricos, nomes de modelo e tipos de erro, nunca texto de pergunta, resposta ou imagem. | P0 | CA05 |
| RNF04 | **Custo de classificação:** `classificarPerfil` executa em < 1 ms (média de 1.000 chamadas) sem rede nem LLM. | P1 | CA01 |

### Dependências técnicas

- `src/gemini.ts`, `src/armazenamento.ts`, `src/tutor.ts`, `src/configuracoes.ts`, `configuracoes.html`, `src/lousa/tipos.ts`, `src/personas/materia.ts`, `package.json`.
- **Ordem de implementação: 1 de 5 (trilha de IA).** Vem primeiro porque entrega o parser de `parts[]` exigido pelo harness, a classificação de erros reutilizada pelo gateway e a linha de base de evals que as specs de prompt e harness usam para provar ganho. Fazer RF03, RF05 e RF06 antes de RF01/RF02.
- Consumida por: `2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md` (evals como regressão; `detectarMateria` compartilhado), `2026-11-19_harness-agentico-tools-e-controle-lousa.md` (RF03 é pré-requisito; `usoTokens` somado por iteração), `2026-11-19_gateway-proxy-opcional-e-modo-turma.md` (o proxy devolve `usageMetadata` no formato do Gemini e o cliente usa o mesmo parser; perfil escolhido aqui é enviado ao proxy).
- UI do painel (RF04) segue os tokens e a categoria "Conexão e IA" de `2026-11-19_vibe-design-system-e-ux-mobile-first.md`.

### Recursos necessários

- Chave de teste em `GEMINI_API_KEY` apenas para quem rodar `npm run evals` sem `--dry-run`.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que a preferência é `auto`, quando o aluno envia *"Oi, tudo bem?"* sem imagem e, depois, uma foto de exercício no Modo Dica, então a primeira chamada usa o perfil `rapido` e a segunda o perfil `raciocinio`.
- [ ] **CA02:** Dado que `gemini-1.5-flash` respondeu no perfil `rapido`, quando o aluno envia em seguida uma foto no Modo Dica, então a fila do perfil `raciocinio` não começa por `gemini-1.5-flash`.
- [ ] **CA03 (compatibilidade):** Dado que a fila do perfil `raciocinio` chega a `gemini-2.5-flash-lite`, `gemini-1.5-flash` ou `gemini-flash-latest`, quando o payload é montado, então `generationConfig` não contém `thinkingLevel` (e, nos dois últimos, não contém `thinkingConfig` nenhum).
- [ ] **CA04:** Dado que uma resposta SSE ou REST traz `parts[0] = { thought: true, text: "pensando..." }` e `parts[1] = { text: "{\"etapas\":[...]}" }`, quando o parser processa, então o texto de `thought` não aparece na fala nem no chat e as etapas de `parts[1]` são entregues integralmente.
- [ ] **CA05:** Dado que a resposta traz `usageMetadata` (`promptTokenCount: 1200`, `candidatesTokenCount: 250`, `thoughtsTokenCount: 80`), quando a chamada termina, então `RespostaDidatica.usoTokens` tem esses valores, o acumulador local soma exatamente esses números sem gravar texto e o painel de `configuracoes.html` mostra os totais.
- [ ] **CA06:** Dado que o 1º modelo retorna `429` e o 2º retorna `200`, quando `callGeminiApi` executa, então a resposta do 2º é entregue, o 1º não entra em `tutoria_modelos_404` e o erro é contado como `cota_excedida` (teste de regressão: o fallback já ocorre hoje por acaso e deve passar a ocorrer por regra).
- [ ] **CA07 (negativo):** Dado que todos os modelos retornam `401`/`API_KEY_INVALID`, quando `processarPergunta` trata o erro, então só 1 chamada HTTP é feita (regressão do `naoRepetir` atual) e o chat mostra a mensagem de chave inválida com link para Configurações, não a mensagem genérica atual.
- [ ] **CA08 (offline):** Dado que o `fetch` lança `TypeError` (mesmo com `navigator.onLine === true`) e a pergunta não está no cache, quando `processarPergunta` trata o erro, então a mensagem é a de "sem internet" com atalho para o Meu Caderno.
- [ ] **CA09:** Dado que a preferência salva é `economico`, quando o aluno envia uma foto no Modo Dica, então o perfil usado é `rapido`; e dado `precisao`, quando envia *"Oi"*, então o perfil é `raciocinio`.
- [ ] **CA10:** Dado que o painel mostra contadores diferentes de zero, quando o aluno clica em `"Zerar estatísticas"` e confirma no diálogo do app, então todos os contadores voltam a 0; se cancelar, nada muda.
- [ ] **CA11:** Dado que o dataset de `scripts/evals.ts` está versionado, quando `npm run evals -- --dry-run` é executado sem rede e sem `GEMINI_API_KEY`, então todos os casos (incluindo ≥ 3 adversariais) são carregados, as métricas são calculadas a partir das respostas gravadas e o processo termina com código 0.

## O que a atividade não inclui

- Custo em reais/dólares na interface: motivo: preços por milhão de tokens mudam com frequência (aulas `18`/`27`); a UI mostra só tokens e o CLI de evals pode estimar custo com tabela informada por parâmetro.
- Agregadores pagos (OpenRouter etc.) chamados direto do front-end: motivo: exigiria chave de terceiros no cliente; tratado no backend de `2026-11-19_gateway-proxy-opcional-e-modo-turma.md`.
- Roteamento por LLM (um modelo decidindo qual modelo usar): motivo: dobra latência e custo; o classificador local resolve os casos do dataset.

### Considerado para o futuro (P2)

- **Context Caching explícito** do Gemini caso o índice de livros cresça para dezenas de livros grandes.
- **Batch API** para gerar novos `cache.json` de perguntas frequentes no build (`scripts/gerar-cache.ts`).
- Casos de evals para uso de ferramentas do harness (taxa de chamadas desnecessárias).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|----|--------|-----------------------------|-------------|----------|
| D01 | Os nomes em `CONFIG.FALLBACK_MODELS` e a tabela `CAPACIDADES_MODELO` (quais níveis de thinking cada modelo aceita) devem ser fixos no código ou configuráveis? | dev / PO | Não | Fixos no código, revisados a cada mudança de modelo: rodar `npm run evals` com a chave de teste e registrar quais modelos respondem `200` e quais níveis de thinking são aceitos. |
| D02 | Os contadores ficam num card próprio ou dentro do card da chave? | design / PO | Não | Dentro da categoria "Conexão e IA" definida na spec de design system, em bloco colapsável para não alongar a página no mobile. |
| D03 | O teste de chave em `src/configuracoes.ts:155` (que chama `callGeminiApi`) deve contar na telemetria e atualizar o modelo lembrado? | dev | Não | Não: passar uma flag `semTelemetria` e não registrar modelo lembrado nessa chamada. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|----|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Perfis por entrada | unit | CA01, CA09, RNF04 | Chamar `classificarPerfil` para saudação, pergunta de História, foto + Dica e as 2 preferências forçadas; medir 1.000 execuções | Perfis `rapido`/`equilibrado`/`raciocinio` corretos; média < 1 ms |
| CT02 | Memória por perfil | unit | CA02 | Registrar sucesso de `gemini-1.5-flash` em `rapido` e pedir a fila de `raciocinio` | `raciocinio` mantém seu próprio primeiro modelo |
| CT03 | Guarda de `thinkingConfig` | unit | CA03, RNF02 | Montar payload para cada modelo de `CONFIG` no perfil `raciocinio` | Só modelos da tabela recebem thinking; nunca os dois campos juntos |
| CT04 | Parser de `parts[]` | unit | CA04 | Stream SSE mockado com parte `thought` + parte JSON; resposta REST com 2 `parts` de texto e 1 `functionCall` | `thought` ignorado; textos concatenados; `functionCall` exposto com `thoughtSignature` |
| CT05 | Acumulador e reset | unit | CA05, CA10, RNF03 | Registrar 2 chamadas + 1 cache hit; inspecionar `localStorage`; zerar | Somas exatas; nenhuma string de pergunta salva; reset zera |
| CT06 | `429` → próximo modelo | unit | CA06 | 1º mock `429`, 2º `200`; depois ler `tutoria_modelos_404` | Resposta do 2º; 1º fora da lista de 404 |
| CT07 | Diagnóstico por tipo | unit | CA07, CA08 | Simular `401`, `403`, `400` com `SAFETY`, `503` em todos, `TypeError` de rede com `onLine = true` | Tipo e mensagem corretos; `401` faz 1 só chamada |
| CT08 | Evals em dry-run | unit | CA11, RNF01 | Rodar o runner com `--dry-run` sem `GEMINI_API_KEY` | Todos os casos carregados; métricas calculadas; exit 0 |
| CT09 | Evals com API real | manual | RF06 | `GEMINI_API_KEY=... npm run evals -- --max-chamadas 30` | Tabela por modelo/perfil com JSON válido, fontes, premissas falsas, TTFT e tokens |

## URL Complementar

- Documentação técnica: [Gemini API: Thinking](https://ai.google.dev/gemini-api/docs/thinking) · [Gemini REST Reference: UsageMetadata & ThinkingConfig](https://ai.google.dev/api/generate-content#usagemetadata)
- Protótipo / mockup: N/A, o painel de consumo segue os tokens e a categoria "Conexão e IA" de [2026-11-19_vibe-design-system-e-ux-mobile-first.md](2026-11-19_vibe-design-system-e-ux-mobile-first.md).
- Discussões relacionadas: [2026-11-20_correcoes-auditoria-de-erros.md](2026-11-20_correcoes-auditoria-de-erros.md) (chave no cabeçalho, `naoRepetir` em 400/401/403, campo `completa`) · [2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md](2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md) · [2026-11-19_harness-agentico-tools-e-controle-lousa.md](2026-11-19_harness-agentico-tools-e-controle-lousa.md) · [2026-11-19_gateway-proxy-opcional-e-modo-turma.md](2026-11-19_gateway-proxy-opcional-e-modo-turma.md)
- Referências de design: `src/gemini.ts`, `src/armazenamento.ts`, `src/configuracoes.ts`, `configuracoes.html`.
- Requisitos originais: adaptação das aulas do curso *Asimov* (`27_Explorando_diferentes_modelos`, `30_Alucinação_e_como_evitá-las`, `31_Skills_Evaluation`, `13_Primeiros_passos_LLM_metadados`, `18_Custo_dos_modelos`, `02_Coder_Toolbox_logs_tokens`).
- Issue / PR relacionado: N/A, a ser criado após revisão da especificação.
