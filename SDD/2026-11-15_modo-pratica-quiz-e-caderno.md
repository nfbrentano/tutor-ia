# [FEAT] Modo Prática Interativa (Quiz na Lousa), Ajuda Socrática por Foto e Caderno de Estudos

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-11-15 · **Atualizada em:** 2026-11-15

## Detalhes da Atividade

- **O que precisa ser feito:** Transformar o TutorIA de um assistente apenas expositivo (pergunta → resposta) em um tutor ativo de aprendizagem com quatro novas funcionalidades pedagógicas:
  1. **Quiz Interativo de Fixação na Lousa ("Testar se entendi"):** ao final de uma explicação (ou quando o aluno pede *"me faz uma pergunta"* / *"quero praticar"*), o tutor apresenta um desafio rápido na lousa com alternativas clicáveis ou resposta por voz.
  2. **Feedback Pedagógico com Dica Construtora:** se o aluno errar na primeira tentativa do desafio, o tutor **não** entrega a resposta de imediato: ele dá uma dica pontual na lousa e incentiva uma segunda tentativa; ao acertar, o avatar comemora e explica por que aquela é a resposta certa.
  3. **Modo Socrático e Dúvida por Foto do Caderno/Livro (Multimodal):** permitir que o aluno envie uma foto/imagem de um exercício do caderno ou livro didático (via câmera ou galeria) e escolha entre *"Me explique passo a passo"* ou *"Me dê uma dica para eu tentar resolver"* (guiando o raciocínio sem dar a resposta pronta de cara).
  4. **Caderno de Estudos Local (Favoritos Offline):** permitir salvar explicações, fórmulas e itens da lousa em um `"Meu Caderno"` salvo no aparelho (`IndexedDB`), organizado por matéria, para o aluno revisar antes da prova mesmo sem internet.
- **Problema e evidência:**
  - **Aprendizagem apenas passiva:** hoje (`src/tutor.ts`), o fluxo termina assim que o tutor acaba de falar a explicação. Não há verificação se o aluno realmente entendeu o conteúdo explicado, embora a prática ativa (*active recall*) seja comprovadamente o método mais eficaz de fixação escolar.
  - **Risco de "cola" em exercícios:** quando um aluno digita uma conta ou questão de dever de casa, o `SYSTEM_PROMPT` atual (`src/armazenamento.ts:26-45`) entrega toda a resolução pronta de imediato, sem estimular o aluno a pensar no primeiro passo.
  - **Dificuldade de digitar fórmulas e enunciados longos:** alunos do Ensino Fundamental e Médio frequentemente têm dúvidas em exercícios impressos no livro ou copiados no caderno que contêm frações, figuras geométricas ou enunciados grandes difíceis de ditar ou digitar no celular.
  - **Sem revisão pós-aula:** se o aluno gostou de um resumo ou tabela gerada na lousa, ele perde o material quando fecha o aplicativo, pois o cache de execução (`src/conhecimento/cache.ts`) não tem interface de consulta para o estudante.
- **Impacto de não fazer:** O aluno usa o app apenas como buscador de respostas prontas, retém menos conteúdo para as provas e abandona o app quando precisa tirar dúvida sobre um exercício visual do livro ou caderno.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio estudando para tarefas de casa, trabalhos e provas escolares.
- **História de usuário:** Como aluno estudando para uma prova ou fazendo dever de casa, quero fotografar um exercício do meu caderno, receber dicas para pensar, testar se entendi com desafios rápidos na lousa e salvar os melhores resumos no meu caderno digital, para aprender de verdade e revisar mesmo sem internet.
- **Como saberemos que deu certo:**
  - Ao clicar em `"🎯 Praticar na Lousa"` após uma explicação, um desafio interativo do mesmo tema abre na lousa em ≤ 2,5 s (ou ≤ 100 ms quando o desafio já vier pré-incluído na resposta).
  - Na 1ª tentativa incorreta de um desafio, 100% das interações exibem a dica pedagógica sem revelar o gabarito; na 2ª tentativa ou acerto, exibem a explicação completa.
  - O aluno consegue salvar uma resposta no `"Meu Caderno"`, fechar a aba, ficar offline e reabrir a explicação com toda a lousa correspondente em ≤ 200 ms.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Desafio de fixação na resposta e na lousa (`src/lousa/`, `src/gemini.ts`, `src/chat.ts`):** incluir no formato estruturado do Gemini um campo opcional `desafio: { pergunta: string, opcoes: string[], correta: number, dica: string, explicacao: string }` (e gerar desafios também para as perguntas do cache pré-construído). No balão do chat e no rodapé da lousa, exibir o botão `"🎯 Testar se entendi"`, que renderiza o card interativo do tipo `quiz` na lousa e lê o enunciado em voz alta. | P0 | CA01, CA02 |
| RF02 | **Interação no Quiz com dica na 1ª tentativa (`src/lousa/renderer.ts`, `src/tutor.ts`):** o aluno pode responder clicando numa das alternativas na lousa ou falando a letra/resposta no microfone: (a) se acertar, destaca a opção em verde, o avatar faz gesto/expressão de alegria (`happy`) e o tutor fala um elogio curto + `explicacao`; (b) se errar na 1ª tentativa, marca a opção tentada, exibe a `dica` na lousa e o tutor incentiva a tentar mais uma vez; (c) se errar na 2ª tentativa (ou clicar em `"Ver resposta"`), mostra a alternativa correta e explica o motivo. | P0 | CA02, CA03, CA04 |
| RF03 | **Modo Socrático ("Me dê uma dica primeiro") (`src/tutor.ts`, `src/gemini.ts`):** adicionar um seletor/toggle rápido próximo ao campo de pergunta: `"Explicação completa"` (padrão) vs. `"Modo Dica (Passo a Passo)"`. No Modo Dica, o prompt instrui o tutor a não entregar o resultado final do exercício na 1ª resposta: ele explica o conceito, mostra o 1º passo na lousa e faz uma pergunta norteadora ao aluno para ele completar o próximo passo. | P1 | CA05 |
| RF04 | **Dúvida por Foto / Imagem Multimodal (`tutor.html`, `src/tutor.ts`, `src/gemini.ts`):** adicionar botão `"📷 Foto do exercício"` ao lado do campo de texto que aceita câmera ou arquivo de imagem (`image/jpeg`, `image/png`, `image/webp`). Antes do envio, redimensionar a imagem no cliente (máx. 1280 px no maior lado, JPEG qualidade 0,8, ≤ 1 MB) e enviar como `inlineData` (`mimeType`, `data` em base64) junto com a pergunta para o Gemini analisar o enunciado/diagrama. Mostrar miniatura da foto enviada no balão do aluno. | P1 | CA06, CA07 |
| RF05 | **Caderno de Estudos Local (`src/caderno/`, `tutor.html`):** (a) em cada balão de resposta do tutor no chat, adicionar o botão `"⭐ Salvar no Caderno"`; (b) persistir os itens salvos em uma object store própria no `IndexedDB` (`tutoria_caderno_db`), guardando pergunta, matéria, persona, data, `textoCompleto`, `itensLousa` e `fontes`; (c) adicionar botão `"📒 Meu Caderno"` no cabeçalho de `tutor.html` que abre uma gaveta/modal filtrável por matéria, permitindo reler o resumo, clicar em `"Abrir na Lousa"`, `"Ouvir novamente"` ou remover a anotação, funcionando 100% offline. | P0 | CA08, CA09 |
| RF06 | **Contador de prática na sessão:** exibir no painel do Caderno / cabeçalho o total de dúvidas tiradas e desafios acertados pelo aluno, reforçando o engajamento de forma positiva (sem punir erros). | P2 | — |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Privacidade de imagens (RF04): a foto do exercício é processada em memória para redimensionamento e enviada exclusivamente na requisição HTTPS direta à API do Gemini com a chave do usuário; **não** é salva em servidores intermediários nem enviada sem ação explícita do aluno. | P0 | CA06, CA07 |
| RNF02 | Limite de tamanho de imagem: imagens > 10 MB ou de formatos não suportados são recusadas antes do processamento com mensagem clara; após o redimensionamento via `<canvas>`, o payload base64 não pode passar de 1,5 MB. | P0 | CA07 |
| RNF03 | Acessibilidade do Quiz: as alternativas na lousa devem ser `<button>` navegáveis por teclado (`Tab`/`Enter`), com `aria-pressed` e anúncio do feedback (dica ou acerto) em região `aria-live="polite"`. | P0 | CA02 |
| RNF04 | Funcionamento offline do Caderno: abrir, filtrar, visualizar na lousa e ouvir com a voz local qualquer item salvo no `"Meu Caderno"` deve funcionar sem conexão com a internet e em ≤ 200 ms. | P0 | CA09 |

### Dependências técnicas

- `src/gemini.ts` (suporte a `inlineData` multimodal em `parts` e campo `desafio`), `src/lousa/` (novo tipo `quiz`), `src/chat.ts` (botões `"🎯 Testar se entendi"` e `"⭐ Salvar no Caderno"`), `src/tutor.ts` (orquestração de foto, quiz e caderno), novo módulo `src/caderno/index.ts`.
- Recomenda-se implementar junto ou após [2026-11-15_melhorias-contexto-serie-e-lousa.md](2026-11-15_melhorias-contexto-serie-e-lousa.md) (o Modo Socrático do RF03 aproveita diretamente a memória de conversa multi-turno).

### Recursos necessários

- Nenhum pacote npm adicional obrigatório (redimensionamento de imagem via HTML5 `<canvas>` nativo e persistência via `IndexedDB` nativo).

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado uma explicação do tutor que inclui um `desafio`, quando a resposta aparece no chat, então o botão `"🎯 Testar se entendi"` fica disponível e, ao clicar nele, a lousa exibe a pergunta do desafio com suas alternativas como botões acessíveis.
- [ ] **CA02:** Dado um desafio aberto na lousa, quando o aluno seleciona a alternativa correta na 1ª tentativa, então a alternativa fica destacada como correta, o tutor fala o elogio com a explicação e o avatar exibe expressão positiva.
- [ ] **CA03:** Dado um desafio aberto na lousa, quando o aluno seleciona uma alternativa incorreta na 1ª tentativa, então a resposta certa **não** é revelada ainda, o painel mostra a `dica` construtiva e o aluno pode tentar novamente.
- [ ] **CA04:** Dado que o aluno já errou a 1ª tentativa do desafio, quando erra a 2ª tentativa (ou clica em `"Ver resposta"`), então a alternativa correta é destacada e a explicação completa é exibida e falada.
- [ ] **CA05:** Dado o `"Modo Dica (Passo a Passo)"` ativado, quando o aluno envia `"Como resolver 2x + 4 = 10?"`, então o tutor explica como começar (ex.: isolar o termo com `x`) e pergunta ao aluno o próximo passo sem entregar `x = 3` de imediato.
- [ ] **CA06:** Dado uma imagem `.jpg` ou `.png` de um exercício selecionada pelo aluno, quando ele envia a pergunta com a foto, então a imagem é redimensionada para ≤ 1280 px, a miniatura aparece no balão do aluno e `callGeminiApi` envia o bloco `inlineData` junto ao texto.
- [ ] **CA07 (negativo):** Dado um arquivo que não é imagem (ex.: `.exe` ou `.pdf`) ou uma imagem corrompida, quando selecionado no botão de foto, então o app exibe um aviso claro, não trava e não faz chamada à API.
- [ ] **CA08:** Dado uma resposta do tutor no chat, quando o aluno clica em `"⭐ Salvar no Caderno"`, então o botão muda para `"✓ Salvo no Caderno"` e a explicação (com seus itens de lousa e fontes) passa a aparecer na lista do `"Meu Caderno"` filtrável por matéria.
- [ ] **CA09:** Dado o navegador ou app Android sem internet (offline), quando o aluno abre `"Meu Caderno"` e clica em `"Abrir na Lousa"` e `"Ouvir"` em um resumo salvo, então a lousa renderiza os itens salvos e o tutor lê a explicação normalmente em ≤ 200 ms.

## O que a atividade não inclui

- Ranking competitivo entre alunos ou gamificação com placar público: motivo: foco pedagógico acolhedor e sem ansiedade de comparação, além de não haver servidor central.
- OCR local de página inteira de livro: motivo: o envio da imagem direto ao modelo multimodal Gemini (RF04) interpreta tanto texto manuscrito quanto diagramas e fórmulas com muito mais precisão e zero peso no bundle.
- Sincronização do Caderno de Estudos na nuvem: motivo: armazenamento 100% local nesta fase.

### Considerado para o futuro (P2)

- Revisão espaçada (*spaced repetition*): o Caderno sugerir ao aluno revisar os tópicos salvos há mais de 7 dias.
- Gerar uma lista de 5 exercícios de revisão a partir de todos os itens salvos no Caderno antes da semana de provas.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | O desafio (`desafio`) já deve vir embutido no mesmo JSON da explicação inicial (0 latência ao clicar em "Testar se entendi") ou ser pedido em uma chamada separada só quando o aluno clicar? | dev / PO | Não | Sugestão: já pedir o campo `desafio` no JSON da explicação inicial (adiciona ~80 tokens à saída e torna a abertura do quiz instantânea e disponível inclusive offline no cache). |
| D02 | No envio de foto no Android (Capacitor), usar `<input type="file" accept="image/*" capture="environment">` do WebView ou adicionar `@capacitor/camera`? | dev | Não | Sugestão: começar com `<input type="file" accept="image/*">` (funciona na web e no WebView Android sem permissão extra no manifesto além da galeria/câmera do sistema). |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Parser e renderização do `desafio` | unit | CA01, RNF03 | Passar JSON com campo `desafio` para `parseGeminiResponse` e renderizar item `quiz` na lousa | Desafio extraído; botões renderizados com `aria-pressed="false"` |
| CT02 | Fluxo de acerto na 1ª tentativa | unit | CA02 | Clicar na alternativa `correta` do item `quiz` | Classe `.correta` aplicada; callback de acerto chamado com a explicação |
| CT03 | Dica na 1ª tentativa errada e resolução na 2ª | unit | CA03, CA04 | Clicar em alternativa errada 1 vez e depois errar de novo | No 1º erro exibe `dica` sem mostrar `.correta`; no 2º erro revela a correta e a explicação |
| CT04 | Prompt do Modo Dica (Socrático) | unit | CA05 | Chamar `callGeminiApi` com `modoPedagogico: 'dica'` | Payload inclui instrução socrática para guiar o passo a passo sem dar a resposta final |
| CT05 | Redimensionamento e payload de imagem | unit | CA06 | Passar imagem simulada para o utilitário de preparo e chamar `callGeminiApi` | `parts` contém `{ inlineData: { mimeType: 'image/jpeg', data: '...' } }` |
| CT06 | Recusa de arquivo inválido na foto | unit | CA07 | Passar arquivo `application/pdf` ou > 10 MB para o validador de foto | Lança erro amigável e não chama `fetch` |
| CT07 | Salvar, listar, filtrar e excluir no Caderno | unit | CA08, CA09 | Salvar 2 itens de matérias diferentes no `GerenciadorCaderno`, filtrar por matéria e remover 1 | Listagem e filtro retornam os itens certos do `IndexedDB` |
| CT08 | Reabrir item do Caderno offline | e2e | CA09, RNF04 | Salvar resposta no Caderno, ficar offline e clicar em "Abrir na Lousa" | Lousa abre com todos os itens salvos em ≤ 200 ms |

## URL Complementar

- Documentação técnica: [Gemini API: Image understanding (multimodal)](https://ai.google.dev/gemini-api/docs/vision) · [IndexedDB API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- Protótipo / mockup: N/A.
- Discussões relacionadas: [2026-11-15_melhorias-contexto-serie-e-lousa.md](2026-11-15_melhorias-contexto-serie-e-lousa.md) · [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md) · [DONE/2026-10-16_base-de-conhecimento-livros-pdf.md](DONE/2026-10-16_base-de-conhecimento-livros-pdf.md)
- Referências de design: `src/styles/lousa.css` e `src/styles/tutor.css`.
- Requisitos originais: levantamento de novas features pedagógicas em 2026-11-15.
- Issue / PR relacionado: N/A, a ser criado.
