# [FEAT] Comportamento de espera do tutor e resposta em streaming

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-16 · **Atualizada em:** 2026-10-16

## Detalhes da Atividade

- **O que precisa ser feito:** Reduzir a espera, real e percebida, entre a pergunta do aluno e o início da explicação:
  1. **Espera ativa:** enquanto a API não responde, o tutor age como um professor. Ele repete a pergunta, fala uma frase de reação, vai até a lousa e escreve o tema, e conta uma curiosidade se a espera se alongar.
  2. **Streaming:** o tutor começa a falar a primeira etapa assim que ela chega, sem esperar a resposta inteira.
  3. **Modelo lembrado:** depois de uma falha de modelo, as próximas perguntas não perdem tempo tentando o mesmo modelo de novo.
- **Problema e evidência:**
  - `processarPergunta()` (`src/tutor.ts`) só coloca o avatar em `thinking` e espera `callGeminiApi()` (`src/gemini.ts`) terminar.
  - A chamada usa `generateContent`, que só devolve a resposta completa. Com respostas em etapas, o aluno fica alguns segundos olhando o robô parado em "pensando" e em silêncio.
  - Quando o modelo principal responde 404/503, cada pergunta tenta ele de novo antes do fallback, somando uma ida e volta inteira à espera.
- **Impacto de não fazer:** A espera em silêncio parece travamento. O aluno repete a pergunta ou desiste, principalmente no celular com 4G.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio que conversa com o tutor por voz ou texto.
- **História de usuário:** Como aluno, quero que o tutor reaja na hora à minha pergunta e comece a explicar o quanto antes, para sentir que estou conversando com um professor e não esperando uma página carregar.
- **Como saberemos que deu certo:**
  - Primeira reação audível ou visível do tutor em ≤ 500 ms após a pergunta, em 100% dos casos.
  - Início da fala da explicação (primeira etapa) com mediana pelo menos 40% menor que a atual, nas 20 perguntas de referência, em 4G simulado.
  - 0 casos de enrolação falada por cima da explicação.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Reação imediata local** (sem API), disparada junto com a chamada ao Gemini: o avatar entra em `thinking` e fala uma frase curta de um banco local (`src/espera/frases.ts`), por exemplo "Boa pergunta! Deixa eu pensar...". O banco tem pelo menos 15 frases e nunca repete a última usada. | P0 | CA01, CA02 |
| RF02 | **Eco da pergunta:** se a pergunta tiver um tema identificável por palavras-chave locais (dicionário por matéria em `src/espera/temas.ts`), a reação inclui o tema: "Hum, você quer saber sobre **fotossíntese**, né?". Sem tema identificado, usa uma frase genérica. | P1 | CA03 |
| RF03 | **Lousa de preparação:** se a resposta não começar a chegar em 1,5 s, o avatar vai até a lousa (gesto de apontar ou escrever), apaga o quadro e escreve o título do tema (ou "Sua pergunta" + texto resumido). O título continua como primeiro item da resposta. | P1 | CA04 |
| RF04 | **Curiosidade de espera:** se a primeira etapa não chegar em 4 s, o tutor fala um "Sabia que...?" curto (≤ 15 palavras) da matéria detectada, de um arquivo local (`src/espera/curiosidades.ts`, pelo menos 5 por matéria). No máximo 1 curiosidade por pergunta. | P1 | CA05 |
| RF05 | **Gestos de espera:** enquanto pensa, o avatar alterna a cada 2–3 s gestos de espera (olhar para cima, tamborilar os dedos, ajustar a postura), usando o `AvatarAnimator`, sem repetir o anterior. | P1 | CA06 |
| RF06 | **Resposta rápida não enrola:** se a primeira etapa chegar em < 800 ms, a reação imediata é cancelada (ou não começa) e o tutor vai direto à explicação. | P0 | CA07 |
| RF07 | **Passagem de vez:** quando a primeira etapa chega e o tutor está no meio de uma frase de espera, ele termina a frase atual (máx. 1,5 s restantes; se passar disso, a frase é cortada) e emenda na explicação, sem duas falas ao mesmo tempo. | P0 | CA08 |
| RF08 | **Streaming de etapas:** trocar `generateContent` por `streamGenerateContent?alt=sse` e pedir no `SYSTEM_PROMPT` uma etapa por linha (JSON por linha, NDJSON: `{"fala":"...","lousa":{...}}`). Cada linha completa vira uma etapa: o item de lousa aparece e a fala começa enquanto as próximas etapas ainda estão chegando. | P0 | CA09, CA10 |
| RF09 | **Fallback do streaming:** se o modelo não respeitar o formato por linha ou a conexão de streaming falhar, juntar o texto recebido e usar o `parseGeminiResponse()` atual (formatos de etapas, legado e texto puro continuam aceitos). | P0 | CA11 |
| RF10 | **Modelo lembrado:** guardar em memória (e em `localStorage`, com validade de 24 h) o último modelo que respondeu com sucesso e tentá-lo primeiro; modelos que deram 404 são pulados até a validade expirar. | P1 | CA12 |
| RF11 | **Interrupção:** se o aluno clicar no microfone ou mandar outra pergunta durante a espera ou o streaming, cancelar a fala de espera, os temporizadores e a requisição (`AbortController`). | P0 | CA13 |
| RF12 | **Erro durante a espera:** se a API falhar, a espera para e o tutor fala a mensagem de erro atual, sem curiosidade nem lousa de preparação pendentes. | P0 | CA14 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | A reação imediata não depende de rede: funciona com o aparelho offline. | P0 | CA01 |
| RNF02 | Os tempos de 0,8 s, 1,5 s e 4 s ficam num único objeto de configuração (`CONFIG_ESPERA`), para ajustes sem mexer na lógica. | P0 | — |
| RNF03 | O módulo novo `src/espera/` fica abaixo de 8 KB gzip (frases, temas e curiosidades incluídos). | P1 | — |
| RNF04 | A fala de espera respeita a velocidade e a voz escolhidas nas configurações e funciona na web e no Android (camada `src/voz/`). | P0 | CA15 |
| RNF05 | Com "reduzir movimento" ativo, os gestos de espera (RF05) são desligados; as falas continuam. | P1 | — |
| RNF06 | As frases de espera nunca afirmam conteúdo da matéria (nada de antecipar a resposta); só reagem à pergunta. As curiosidades são fixas e revisadas. | P0 | CA16 |

### Dependências técnicas

- Lousa de apoio visual (PR #3, `feat/lousa-apoio-visual`, ainda não mergeado) para o RF03. Sem ela, o RF03 fica de fora e o resto continua válido.
- `src/tutor.ts` (`processarPergunta`), `src/gemini.ts` (`callGeminiApi`, `parseGeminiResponse`), `src/armazenamento.ts` (`CONFIG.SYSTEM_PROMPT`), `src/avatar/animator.ts` (novos gestos de espera), `src/voz/` (falar e cancelar).
- API Gemini `streamGenerateContent` com `alt=sse`. Precisa funcionar no WebView do Android (validar leitura de `ReadableStream` no `fetch`).

### Recursos necessários

- Lista revisada de frases de reação (≥ 15), dicionário de temas por matéria e curiosidades (≥ 5 por matéria), revisados pelo PO.
- As 20 perguntas de referência (as mesmas da especificação da lousa) para medir o tempo até a primeira fala antes e depois.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que o aluno envia uma pergunta, quando ela é enviada (mesmo offline), então em até 500 ms o avatar entra em "pensando" e começa a falar uma frase de reação.
- [ ] **CA02:** Dado 10 perguntas seguidas, quando o tutor reage a cada uma, então nunca usa a mesma frase duas vezes seguidas.
- [ ] **CA03:** Dado a pergunta "como funciona a fotossíntese?", quando o tutor reage, então a frase menciona "fotossíntese"; dado "me ajuda com isso", então usa uma frase genérica.
- [ ] **CA04:** Dado que a primeira etapa demora mais de 1,5 s, quando esse tempo passa, então o avatar vai até a lousa e escreve o título do tema.
- [ ] **CA05:** Dado que a primeira etapa demora mais de 4 s, quando esse tempo passa, então o tutor fala uma curiosidade da matéria detectada, e só uma por pergunta.
- [ ] **CA06:** Dado que o tutor está pensando por 6 s, quando observado, então faz pelo menos 2 gestos de espera diferentes.
- [ ] **CA07:** Dado que a primeira etapa chega em menos de 800 ms, quando ela chega, então o tutor começa direto a explicação, sem frase de reação.
- [ ] **CA08 (negativo):** Dado que a primeira etapa chega no meio de uma frase de espera, quando ela chega, então o tutor **não** fala duas coisas ao mesmo tempo: termina a frase (ou corta após 1,5 s) e emenda na explicação.
- [ ] **CA09:** Dado uma resposta de 4 etapas em streaming, quando a primeira linha completa chega, então a fala da etapa 1 começa antes de a etapa 4 ter chegado.
- [ ] **CA10:** Dado o streaming em andamento, quando cada etapa chega, então o item de lousa dela aparece na ordem certa e sincronizado com a fala, como na especificação da lousa.
- [ ] **CA11 (erro):** Dado que o modelo responde num formato que não é uma etapa por linha (JSON único, legado ou texto puro), quando o streaming termina, então a resposta é interpretada pelo parser atual e falada normalmente.
- [ ] **CA12:** Dado que o modelo principal deu 404 na primeira pergunta, quando o aluno faz a segunda pergunta, então a requisição vai direto para o modelo que funcionou.
- [ ] **CA13:** Dado que o tutor está na espera ou no meio do streaming, quando o aluno toca no microfone ou envia nova pergunta, então a fala de espera para, a requisição anterior é cancelada e nada da resposta antiga aparece depois.
- [ ] **CA14 (erro):** Dado que a API retorna erro durante a espera, quando o erro chega, então não aparece curiosidade nem lousa de preparação e o tutor fala a mensagem de erro.
- [ ] **CA15:** Dado o app no Android, quando o aluno pergunta, então a reação imediata e o streaming funcionam como na web.
- [ ] **CA16 (negativo):** Dado o banco de frases de espera, quando revisado, então nenhuma frase contém conteúdo da matéria ou uma "resposta" à pergunta.

## O que a atividade não inclui

- Respostas prontas para perguntas frequentes (cache): motivo: está na especificação [2026-10-16_base-de-conhecimento-livros-pdf.md](2026-10-16_base-de-conhecimento-livros-pdf.md).
- Frases de espera geradas por IA: motivo: dependeriam da rede, o que contradiz o objetivo; risco de conteúdo errado.
- Detecção de tema por IA ou embeddings: motivo: um dicionário de palavras-chave basta para o eco; complexo demais agora.
- Histórico de conversa enviado ao modelo: motivo: outra iniciativa.

### Considerado para o futuro (P2)

- Personalizar frases pelo nome do aluno ("Boa, Ana!").
- Medir e exibir no diagnóstico o tempo até a primeira fala por modelo.
- Frases de espera com variação por horário ou humor do avatar.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Os modelos da lista seguem com confiança o formato de "uma etapa por linha" no streaming? | dev | Não | Validar com as 20 perguntas; o RF09 cobre a falha. |
| D02 | O WebView do Android lê `ReadableStream` do `fetch` com SSE sem buffer (sem esperar tudo chegar)? | dev | Sim | Testar numa prova de conceito no início; se falhar, usar `CapacitorHttp` ou cair no modo não-streaming no Android. |
| D03 | Quem escreve e revisa as frases e curiosidades? | PO | Não | |
| D04 | A voz de espera deve ter tom diferente (ex.: mais baixa/rápida) da explicação? | PO / design | Não | Sugestão: mesma voz, para não parecer outra pessoa. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Reação offline | e2e | CA01 | DevTools offline; enviar pergunta | Reação em ≤ 500 ms; depois mensagem de erro |
| CT02 | Sem repetição | unit | CA02 | Sortear 100 frases | Nunca duas iguais seguidas |
| CT03 | Eco do tema | unit | CA03 | Detectar tema em "como funciona a fotossíntese?" e "me ajuda com isso" | "fotossíntese" e `null` |
| CT04 | Lousa de preparação | e2e | CA04 | Simular atraso de 3 s na API (mock) | Título na lousa em ~1,5 s |
| CT05 | Curiosidade única | e2e | CA05 | Simular atraso de 8 s | Exatamente 1 curiosidade |
| CT06 | Gestos de espera | manual | CA06 | Atraso de 6 s; observar avatar | ≥ 2 gestos diferentes |
| CT07 | Resposta rápida | e2e | CA07 | Mock responde em 300 ms | Sem frase de reação |
| CT08 | Passagem de vez | e2e | CA08 | Mock entrega etapa 1 a 1 s (no meio da frase) | Uma fala por vez; transição ≤ 1,5 s |
| CT09 | Streaming por etapas | integração | CA09, CA10 | Mock SSE com 4 linhas espaçadas em 1 s | Fala 1 começa antes da linha 4; lousa em ordem |
| CT10 | Fallback do formato | unit | CA11 | Alimentar o leitor de stream com JSON único, legado e texto puro | Mesmo resultado do `parseGeminiResponse` |
| CT11 | Modelo lembrado | unit | CA12 | Mock: 404 no principal, 200 no 2º; duas chamadas | 2ª chamada vai direto ao 2º modelo |
| CT12 | Cancelamento | e2e | CA13 | Nova pergunta durante o streaming | Requisição antiga abortada; nenhum resto dela na tela |
| CT13 | Erro na espera | e2e | CA14 | Mock retorna 500 após 5 s | Sem curiosidade/lousa; fala de erro |
| CT14 | Android | manual | CA15 | `npm run android`; perguntar em 4G | Reação imediata e streaming funcionando |
| CT15 | Revisão de frases | manual | CA16 | Ler `src/espera/frases.ts` | Nenhum conteúdo de matéria |
| CT16 | Métrica | manual | — | 20 perguntas de referência antes/depois, Slow 4G | Mediana até a 1ª fala ≥ 40% menor |

## URL Complementar

- Documentação técnica: [Gemini API: streaming (streamGenerateContent)](https://ai.google.dev/gemini-api/docs/text-generation#streaming) · [AbortController (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) · [Streams API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
- Protótipo / mockup: N/A, comportamento descrito nos RFs.
- Discussões relacionadas: [2026-10-16_base-de-conhecimento-livros-pdf.md](2026-10-16_base-de-conhecimento-livros-pdf.md) · [DONE/2026-10-16_avatar-com-movimentos-humanos.md](DONE/2026-10-16_avatar-com-movimentos-humanos.md) · [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md)
- Referências de design: N/A.
- Requisitos originais: pedido do PO em 2026-10-16: "pensa em alguma coisa que o robô possa fazer enquanto pede via API a resposta, para enrolar um pouco".
- Issue / PR relacionado: PR #3 (lousa), dependência do RF03.
