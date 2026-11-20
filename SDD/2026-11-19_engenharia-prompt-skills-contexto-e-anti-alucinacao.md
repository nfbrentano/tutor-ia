# [FEAT] Engenharia de Prompt Estruturada, Skills Pedagógicas sob Demanda, Higiene de Contexto e Anti-Alucinação

> **Status:** Em revisão
> **Autor:** Natanael Brentano (com apoio de IA — curadoria curso Asimov) · **Revisor:** · **Criada em:** 2026-11-19 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Reestruturar a engenharia de prompt, a gestão de contexto e as garantias anti-alucinação do TutorIA aplicando quatro técnicas do curso *Asimov*:
  1. **System Prompt estruturado com delimitadores Markdown:** trocar o prompt monolítico de `src/armazenamento.ts` por blocos `# Papel e Persona`, `# Tarefa e Formato de Resposta`, `# Limitações e Anti-Alucinação`, `# Contexto Ativo`, `# Skills Aplicáveis` e `# Exemplos`, com lista explícita anti-clichês e limite de fala por etapa.
  2. **Skills Pedagógicas sob demanda (*just-in-time*, padrão aula 31):** separar instruções detalhadas por especialidade (`formulas-e-graficos`, `modo-socratico`, `fontes-livros-didaticos`, `desenho-tabela-multimidia`) e injetar só as pertinentes à pergunta, encolhendo o núcleo fixo em ≥ 35%.
  3. **Higiene de contexto e memória pedagógica compacta:** remover instruções duplicadas entre `systemInstruction` e a mensagem `user`, nunca enviar JSON quebrado no histórico e manter um **resumo pedagógico** da sessão (tópico, conceitos, último quiz, itens da lousa) para conversas além dos 5 turnos do histórico.
  4. **Política e exemplos *few-shot* anti-alucinação:** instruir correção acolhedora de premissas falsas, recusa de citações incertas e proibição de `fontes` sem trecho, com exemplo curado.
- **Problema e evidência** (código verificado em 2026-11-20):
  - **Prompt corrido e inchado (`src/armazenamento.ts:37-59`):** `CONFIG.SYSTEM_PROMPT` tem **2.516 caracteres** numa string única, sem delimitadores nem exemplos, e descreve em toda chamada os 8 tipos de lousa gerados pelo modelo (`formula`, `passos`, `lista`, `tabela`, `imagem`, `desenho`, `grafico`, `texto`; o 9º tipo, `quiz`, vem do campo `desafio`), além das regras de persona histórica, citação de livros e quiz — inclusive em dúvidas simples sem livro.
  - **Duplicação em toda requisição (`src/gemini.ts:844-857`):** `instrucaoSerie` e `INSTRUCAO_MODO_DICA` (390 caracteres) entram **tanto** em `systemPromptFinal` (`:851`, `:856`) **quanto** em `textoPromptFinal`, a mensagem do usuário (`:850`, `:855`). Os testes `tests/pratica.test.ts:161` e `tests/melhorias.test.ts:250` hoje exigem essa duplicação no texto do usuário.
  - **Corte de histórico (`montarHistoricoContents()`, `src/gemini.ts:56-136`):** os pares `user+model` mais antigos são descartados inteiros (`:98-105`) e, desde `SDD/2026-11-20_correcoes-auditoria-de-erros.md`, o excedente é cortado em fronteira de palavra por `cortarEmPalavra()` (`:43-50`), começando pelas respostas do modelo e sem esvaziar perguntas (`:107-130`). Restam dois problemas: (1) o corte é aplicado à string **já serializada** `{"materia":…,"textoCompleto":…}`, então a parte `model` sai com JSON inválido (confirmado em 2026-11-20 com 1 par de ~8.000 caracteres: `JSON.parse` falha); (2) os turnos descartados não deixam nenhum resumo.
  - **Alucinação em premissas falsas:** o prompt só proíbe citações inventadas de pessoas reais (`:53`) e `fontes` sem trechos (`:55`); não há regra nem exemplo para corrigir premissas impossíveis (ex.: *"fale sobre a batalha espacial de 1822"*).
- **Impacto de não fazer:** custo de input alto em toda pergunta, instruções concorrentes no mesmo prompt, perda do fio da aula após 5 turnos e risco de o tutor confirmar premissas erradas para o aluno.
- **Para quem é destinado:** alunos do Ensino Fundamental II e Médio (sequências longas de estudo e Modo Dica) e responsáveis pela curadoria pedagógica.
- **História de usuário:** Como aluno fazendo várias perguntas em sequência sobre uma matéria, quero que o tutor lembre o fio da nossa aula, explique com naturalidade sem clichês robóticos e seja honesto quando algo não fizer sentido ou não estiver no livro, para estudar com confiança e clareza.
- **Como saberemos que deu certo:**
  - Núcleo fixo do prompt ≤ 1.600 caracteres (≥ 35% menor que os 2.516 atuais) e `systemInstruction` completo de uma pergunta simples sem livro ≤ 2.000 caracteres.
  - 0 ocorrências de `instrucaoSerie`/`INSTRUCAO_MODO_DICA` fora do `systemInstruction`; 0 partes `model` do histórico com JSON inválido.
  - Em `npm run evals` (spec de roteamento, RF06): nenhum caso piora em relação à linha de base do prompt atual; ≥ 90% dos casos adversariais corrigem a premissa falsa (média de 3 execuções); 0 `fontes` sem trecho enviado; o caso Modo Dica continua sem entregar a resposta final.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **System Prompt estruturado (`src/prompts/sistema.ts`):** `montarSystemPrompt(contexto)` gera os blocos `# Papel e Persona`, `# Tarefa e Formato de Resposta`, `# Limitações e Anti-Alucinação`, `# Contexto Ativo` (série, modo, resumo pedagógico), `# Skills Aplicáveis` e `# Exemplos`. `callGeminiApi` passa a usá-lo e deixa de acrescentar `instrucaoSerie` e `INSTRUCAO_MODO_DICA` ao texto do usuário (`src/gemini.ts:850`, `:855`); os trechos de livro continuam na mensagem do usuário como hoje (`:831-842`). | P0 | CA01, CA02 |
| RF02 | **Skills modulares (`src/prompts/skills.ts`):** catálogo com `id`, `gatilhos`, `prioridade`, `instrucoes` (≤ 600 caracteres incluindo exemplo) e `exemploFewShot?`: (a) `formulas-e-graficos` — matéria `matematica`/`fisica_quimica` ou termos de equação/função/gráfico; (b) `modo-socratico` — só com `modoPedagogico === 'dica'`; (c) `fontes-livros-didaticos` — só com `trechosContexto.length > 0` ou quando o harness oferecer a ferramenta `buscar_no_livro`; (d) `desenho-tabela-multimidia` — matéria `ciencias`/`geografia`/`historia` ou imagem anexada. A matéria vem de `detectarMateria()` (`src/personas/materia.ts:72`), compartilhada com o classificador de perfil da spec de roteamento. Máximo de 2 skills por turno; empate resolvido por `prioridade` e, depois, pela ordem do catálogo (determinístico). | P0 | CA02, CA03, CA08, CA10 |
| RF03 | **Anti-clichê, fala para TTS e anti-alucinação:** o bloco `# Limitações e Anti-Alucinação` (a) proíbe jargões de IA (*"jornada transformadora"*, *"revolucionar"*, *"no mundo atual"*, *"não é sobre X, é sobre Y"*); (b) pede `fala` oral, sem Markdown, com no máximo 60 palavras por etapa; (c) manda verificar premissas impossíveis e corrigir com gentileza sem inventar fatos; (d) proíbe citações literais incertas de figuras históricas; (e) proíbe `fontes` sem trecho enviado. `# Exemplos` traz sempre 1 exemplo de correção de premissa falsa (≤ 400 caracteres); o exemplo de explicação com lousa vem dentro da skill pertinente. | P0 | CA05 |
| RF04 | **Histórico íntegro e resumo pedagógico (`src/gemini.ts`, `src/chat.ts`, `src/tutor.ts`):** (a) manter o descarte por pares (`src/gemini.ts:98-105`) e o corte por palavra que já existem, mas aplicar `cortarEmPalavra()` ao `textoCompleto` **antes** de serializar o JSON da parte `model`, para que ela continue válida; (b) manter em `EstadoSessaoPersistido` (`src/chat.ts:58-63`, `sessionStorage`) um `resumoPedagogico` atualizado localmente, sem chamada extra à API: `topicoAtual`, `conceitosAbordados[]` (máx. 5), `ultimoDesafioStatus: 'acertou' \| 'errou' \| null` (vindo de `EventoRespostaQuiz.acertou`, `src/lousa/tipos.ts:37-44`) e `resumoLousaAtual[]` (índice, tipo e título curto de cada item de `lousa.obterItensAtuais()`), total ≤ 400 caracteres, enviado em `# Contexto Ativo`. O `resumoLousaAtual` é o que permite ao harness focar um item da lousa pelo índice. | P1 | CA06, CA07, CA09 |
| RF05 | **Balões do chat sem Markdown cru:** além da instrução no prompt, `ChatGerenciador` aplica `limparMarkdownParaChat()` (remove `**`, `__`, `#` de título e cercas ` ``` `) no texto exibido e salvo dos balões do tutor. Não reaproveitar `cleanTextForSpeech` (`src/gemini.ts:247-302`), que converte LaTeX em palavras; o conteúdo da lousa (fórmulas, passos) não é alterado. | P1 | CA04 |
| RF06 | **Compatibilidade de `CONFIG.SYSTEM_PROMPT`:** continuar exportando a constante (montada por `montarSystemPrompt` com contexto vazio) para chamadas legadas, preservando as frases checadas em `tests/personas.test.ts:74-78` (`"materia"`, *nunca atribua a pessoas reais*, *citações inventadas*, *título da obra*, *diga que não tem*). | P0 | CA01 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | **Orçamento de prompt:** núcleo fixo (Papel + Tarefa/Formato + Limitações, sem série/modo/skills/exemplos) ≤ 1.600 caracteres; `# Exemplos` base ≤ 400; cada skill ≤ 600; `resumoPedagogico` ≤ 400; histórico em `contents` ≤ 4.800 (mantido de `SDD/DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md`, RNF01). | P0 | CA02, CA06 |
| RNF02 | **Seleção de skills local:** `selecionarSkillsAtivas` é pura, sem rede nem LLM, e executa em ≤ 2 ms (média de 1.000 chamadas). | P0 | CA03 |
| RNF03 | **Segurança de renderização:** texto vindo do modelo ou do `resumoPedagogico` continua exibido só com `textContent` (como hoje em `src/chat.ts:164`, `:407`, `:434`, `:445`); a limpeza de Markdown nunca introduz `innerHTML`. | P0 | CA04 |

### Dependências técnicas

- `src/armazenamento.ts`, `src/gemini.ts`, `src/chat.ts`, `src/tutor.ts`, `src/personas/materia.ts`, `src/lousa/index.ts`; novos `src/prompts/sistema.ts` e `src/prompts/skills.ts`.
- **Ordem de implementação: 2 de 5 (trilha de IA).** Depois de `2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md`, cujo `npm run evals` mede a linha de base antes da troca do prompt e serve de regressão. Antes de `2026-11-19_harness-agentico-tools-e-controle-lousa.md`, que depende de `montarSystemPrompt` (para declarar instruções de ferramentas como skill/bloco) e de `resumoLousaAtual` (RF04b).
- O gateway (`2026-11-19_gateway-proxy-opcional-e-modo-turma.md`) reutiliza o prompt montado no cliente; não deve existir uma cópia do prompt no backend.
- Specs relacionadas: `SDD/DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md`; `SDD/2026-11-20_correcoes-auditoria-de-erros.md` (já entregou `cortarEmPalavra()` e o corte por palavra no histórico; RF04a só completa a integridade do JSON).

### Recursos necessários

- Curadoria de 1 exemplo de correção de premissa falsa e 1 exemplo por skill, em português brasileiro, para EF II e EM.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que `callGeminiApi('O que é fotossíntese?', key, { serieEscolar: '6º ano EF', modoPedagogico: 'dica' })` é chamado, quando o payload HTTP é montado, então `systemInstruction` contém os cabeçalhos `#` com a série e a skill `modo-socratico`, e a parte de texto do usuário contém só a pergunta (sem `[NÍVEL ESCOLAR DO ALUNO]` nem `[MODO DICA SOCRÁTICA ATIVO]`).
- [ ] **CA02:** Dado que a pergunta é *"Qual a diferença entre mas e mais?"*, sem livros, sem imagem e sem Modo Dica, quando `montarSystemPrompt` é chamado, então não há instruções de `grafico`, `desenho` SVG nem `fontes`, o núcleo tem ≤ 1.600 caracteres e o `systemInstruction` total tem ≤ 2.000.
- [ ] **CA03:** Dado que a pergunta é *"Como fica o gráfico de y = x^2?"*, quando `selecionarSkillsAtivas` executa, então a skill `formulas-e-graficos` é ativada com suas regras de coordenadas numéricas e seu exemplo.
- [ ] **CA04:** Dado que uma etapa chega com `fala` = `**A fotossíntese** é...` e a lousa traz a fórmula `6CO_2 + 6H_2O`, quando o balão é exibido, então o texto do balão não contém `**`, `###` nem cercas de código, a fórmula na lousa permanece idêntica e um `<script>` vindo do modelo aparece como texto, nunca como elemento.
- [ ] **CA05:** Dado que `montarSystemPrompt` é chamado com qualquer contexto, quando o prompt é gerado, então o bloco `# Limitações e Anti-Alucinação` contém as 5 regras de RF03 e `# Exemplos` contém o exemplo de correção de premissa falsa com ≤ 400 caracteres.
- [ ] **CA06 (caso-limite):** Dado que o histórico tem 8 turnos totalizando > 6.500 caracteres, quando `montarHistoricoContents()` processa, então o total enviado é ≤ 4.800, os pares mais antigos são removidos inteiros e toda parte `model` passa em `JSON.parse`.
- [ ] **CA07:** Dado que, numa sessão de 7 interações, o aluno errou o quiz no turno 2, quando pergunta no turno 7 *"Agora testa outra coisa parecida"*, então `# Contexto Ativo` traz o tópico e `ultimoDesafioStatus: 'errou'` em ≤ 400 caracteres, sem reenviar os 7 turnos.
- [ ] **CA08 (negativo):** Dado que `trechosContexto` está vazio e o harness não oferece `buscar_no_livro`, quando o prompt é montado, então a skill `fontes-livros-didaticos` não é injetada e o prompt orienta a omitir `fontes`.
- [ ] **CA09 (caso-limite):** Dado que resta um único par cujo `textoCompleto` do modelo tem 6.000 caracteres, quando `montarHistoricoContents()` processa, então o total é ≤ 4.800, a parte `model` passa em `JSON.parse` e o texto truncado termina em fronteira de palavra seguida de `…`.
- [ ] **CA10 (caso-limite):** Dado que uma pergunta de Matemática com foto no Modo Dica casa com 3 skills, quando `selecionarSkillsAtivas` executa duas vezes, então as mesmas 2 skills de maior prioridade são escolhidas nas duas vezes.

## O que a atividade não inclui

- Resumidor via chamada extra ao Gemini a cada turno: motivo: dobraria latência e custo; o `resumoPedagogico` é atualizado localmente com dados que o app já tem (matéria, quiz, lousa).
- Fine-tuning de modelo: motivo: complexo e desnecessário; *in-context learning* com skills e exemplos atende o domínio escolar.
- Mudar o lugar dos trechos de livro (continuam na mensagem do usuário): motivo: não é a causa do problema e mexer nisso afetaria a validação de fontes do harness.

### Considerado para o futuro (P2)

- Exemplos *few-shot* por série (6º ano EF × 3º ano EM) calibrados por `npm run evals`.
- Importação de "Skills de Matéria" escritas por professores em Markdown.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|----|--------|-----------------------------|-------------|----------|
| D01 | Os exemplos *few-shot* devem usar JSON compacto para economizar tokens? | dev | Não | **Sim:** cada exemplo em JSON de 1–2 linhas, ≤ 400 caracteres. |
| D02 | Há testes que verificam a duplicação no texto do usuário? | dev | Não | **Sim, verificado:** `tests/pratica.test.ts:161` (`MODO DICA SOCRÁTICA` no texto do usuário) e `tests/melhorias.test.ts:250` (`6º ano EF` no texto do usuário). Mudar esses asserts para `systemInstruction` e acrescentar a verificação de ausência no texto do usuário. |
| D03 | A repetição do Modo Dica na mensagem do usuário era um reforço intencional (o modelo tende a obedecer mais o último turno)? | dev / PO | Não | Remover, mas comparar o caso Modo Dica do `npm run evals` antes e depois; se a taxa de "não entregou a resposta final" cair, manter uma frase curta (≤ 80 caracteres) no turno do usuário e registrar a decisão aqui. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|----|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Estrutura e não duplicação | unit | CA01 | `callGeminiApi` com `serieEscolar` e `modoPedagogico: 'dica'` e `fetch` mockado | `systemInstruction` com cabeçalhos `#`; texto do usuário só com a pergunta |
| CT02 | Prompt enxuto | unit | CA02, CA08, RNF01 | `montarSystemPrompt` para pergunta simples de Português sem livros | Núcleo ≤ 1.600; total ≤ 2.000; sem `grafico`/`desenho`/`fontes` |
| CT03 | Skill de fórmulas e determinismo | unit | CA03, CA10, RNF02 | `selecionarSkillsAtivas` com a pergunta do gráfico e com o caso de 3 skills, 1.000 vezes | Skills corretas, sempre as mesmas, média ≤ 2 ms |
| CT04 | Limpeza de Markdown | unit | CA04, RNF03 | Adicionar resposta com `**negrito**`, `### Título` e `<script>` ao `ChatGerenciador` | Balão sem marcadores; `<script>` como texto; lousa intacta |
| CT05 | Bloco anti-alucinação | unit | CA05 | Gerar prompt com contexto vazio e com contexto cheio | 5 regras e exemplo presentes nos dois |
| CT06 | Histórico com 8 turnos | unit | CA06 | 8 turnos JSON longos em `montarHistoricoContents` | ≤ 4.800; `JSON.parse` válido em todas as partes `model` |
| CT07 | Resumo pedagógico | unit | CA07 | Simular 7 turnos e 1 erro de quiz; montar prompt | `resumoPedagogico` com tópico e `'errou'`, ≤ 400 caracteres |
| CT08 | Par único gigante | unit | CA09 | 1 par com `textoCompleto` de 6.000 caracteres | JSON válido; termina em palavra inteira + `…` |
| CT09 | Regressão de testes legados | unit | RF06 | `npm test` após atualizar os asserts de D02 | `tests/personas.test.ts:74-78` passa sem alteração |
| CT10 | Comportamento anti-alucinação | manual (evals) | RF03 | `npm run evals` antes e depois da troca de prompt | Métricas de "Como saberemos" atingidas |

## URL Complementar

- Documentação técnica: [Gemini API: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) · [Gemini API: System Instructions](https://ai.google.dev/gemini-api/docs/text-generation#system-instructions)
- Protótipo / mockup: N/A, mudança estrutural de prompt e memória.
- Discussões relacionadas: [DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md](DONE/2026-11-15_melhorias-contexto-serie-e-lousa.md) · [DONE/2026-11-15_modo-pratica-quiz-e-caderno.md](DONE/2026-11-15_modo-pratica-quiz-e-caderno.md) · [2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md](2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md) · [2026-11-19_harness-agentico-tools-e-controle-lousa.md](2026-11-19_harness-agentico-tools-e-controle-lousa.md)
- Referências de design: `src/armazenamento.ts`, `src/gemini.ts`, `src/chat.ts`.
- Requisitos originais: adaptação das aulas do curso *Asimov - Fundamentos da IA Generativa* e *LangChain* (`26_Engenharia_de_Prompts`, `29_Janela_de_contexto`, `30_Alucinação_e_como_evitá-las`, `31_Skills_MCPs`, `14_Adicionando_memória`, `16_O_System_Prompt`, `18_Custo_dos_modelos`).
- Issue / PR relacionado: N/A, a ser criado após revisão da especificação.
