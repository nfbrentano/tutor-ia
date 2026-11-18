# [FEAT] Melhorias: memória de conversa, série escolar, visual por persona, gráficos na lousa e PWA offline

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-11-15 · **Atualizada em:** 2026-11-15

## Detalhes da Atividade

- **O que precisa ser feito:** Evoluir os módulos existentes do TutorIA em seis melhorias de alto impacto pedagógico e de experiência de uso:
  1. **Memória de conversa multi-turno:** enviar o histórico recente da sessão ao Gemini e manter a conversa salva na sessão do navegador, permitindo perguntas de acompanhamento ("não entendi o segundo passo", "pode dar outro exemplo?") e um botão "Nova conversa".
  2. **Adaptação por Série / Ano Escolar:** permitir que o aluno escolha sua série (6º ao 9º ano do Ensino Fundamental ou 1º ao 3º ano do Ensino Médio), ajustando a linguagem do tutor e priorizando os livros daquela série na busca local BM25.
  3. **Texto progressivo no chat sincronizado com as etapas:** criar o balão da resposta assim que a primeira etapa começa a ser falada e acrescentar cada etapa no balão em tempo real, em vez de só mostrar o texto no chat quando toda a fala termina.
  4. **Identidade visual das personas e melhorias no Gravador de Gestos:** enquanto todas as personas compartilham o mesmo arquivo `.vrm` provisório (`D04` de `2026-10-23_avatar-personas-por-materia.md`), diferenciar visualmente cada professor por paleta de luz/halo/distintivo no palco (3D e 2D), e completar a detecção de cabeça com `FaceLandmarker` no gravador de gestos (`RF04c` de `2026-10-23_gravador-de-gestos.md`).
  5. **Gráficos de funções e exportação da lousa:** adicionar o tipo `grafico` na lousa (desenhando funções matemáticas no plano cartesiano em SVG seguro) e um botão para copiar/baixar o resumo da lousa.
  6. **PWA instalável com Service Worker:** adicionar Service Worker para cache offline dos arquivos estáticos e ícones compatíveis no `manifest.json`, permitindo instalar o TutorIA direto pelo navegador no celular ou computador.
- **Problema e evidência:**
  - **Sem memória de conversa (`src/gemini.ts:396-402`):** `callGeminiApi()` envia apenas `contents: [{ role: 'user', parts: [{ text: textoPromptFinal }] }]`. Se o aluno pergunta *"O que é uma equação de 1º grau?"* e em seguida *"Me dá um exemplo mais fácil?"*, o Gemini não sabe sobre o que é o exemplo. Além disso, se o aluno vai até `configuracoes.html` ajustar a velocidade da voz e volta para `tutor.html`, todo o histórico do chat é perdido.
  - **Sem série escolar (`src/armazenamento.ts`, `src/conhecimento/busca.ts`):** um aluno do 6º ano (11 anos) e um do 3º ano do Ensino Médio (17 anos) recebem a mesma explicação e o mesmo peso nos livros do catálogo (`livros/catalogo.json` já possui o campo `"serie"`, mas ele nunca é usado na busca nem no prompt).
  - **Chat atrasado (`src/tutor.ts:409-415, 546-555`):** em respostas vindas do cache ou via streaming lento, o balão do tutor no chat só aparece **depois** que todas as etapas terminam de chegar/falar, dificultando o acompanhamento por leitura simultânea (importante para alunos com deficiência auditiva ou em ambientes barulhentos).
  - **Personas com aparência idêntica (`src/personas/catalogo.ts:13`):** como todas as 7 personas apontam para `./avatar/tutor.vrm` até a chegada dos modelos próprios, trocar de Lia para Machado ou Prof. Átomo só muda o texto discreto `#persona-credito` e a voz. No gravador (`src/gravador/pagina.ts`), o `FaceLandmarker` especificado no `RF04c` ainda não foi ligado, usando apenas nariz e orelhas do Pose Landmarker.
  - **Falta de gráficos e PWA (`SDD/DONE/2026-10-16_lousa-de-apoio-visual.md` e `2026-10-16_multipaginas-typescript-e-android.md`):** ambos foram previstos como P2 nas specs anteriores; `public/manifest.json` já existe, mas sem Service Worker a página não abre offline no navegador.
- **Impacto de não fazer:** O aluno não consegue manter um diálogo natural de dúvidas consecutivas, explicações podem ficar infantis demais para o Ensino Médio ou difíceis demais para o 6º ano, e o estudante não consegue acompanhar o texto no chat enquanto o tutor fala cada etapa.
- **Para quem é destinado:** Aluno do Ensino Fundamental (6º ao 9º ano) e Ensino Médio (1º ao 3º ano), na web e no Android.
- **História de usuário:** Como aluno, quero conversar com o tutor fazendo perguntas de continuação, com explicações adequadas ao meu ano escolar, lendo o texto à medida que ele fala e podendo guardar o resumo da lousa ou usar o app instalado offline.
- **Como saberemos que deu certo:**
  - Em sequência de 3 perguntas dependentes (*"O que é fotossíntese?"* → *"Onde ela acontece?"* → *"E por que ela é importante?"*), 100% das respostas mantêm o assunto sem o aluno precisar repetir a palavra "fotossíntese".
  - O balão do chat exibe a 1ª etapa em ≤ 100 ms após o início da fala da 1ª etapa.
  - O app passa nos critérios de instalabilidade PWA do Chrome/Edge e abre `index.html`, `tutor.html` e `configuracoes.html` em modo offline após o primeiro acesso.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Histórico de conversa multi-turno (`src/gemini.ts`, `src/tutor.ts`):** enviar até os últimos 5 turnos (10 mensagens `user`/`model`) no array `contents` de `callGeminiApi()`. Para economizar tokens, as respostas anteriores do modelo no histórico enviam apenas `textoCompleto` e `materia` (sem repetir o JSON completo de `lousa` de turnos passados). Quando a pergunta é de continuação curta (ex.: *"não entendi"*, *"dá outro exemplo"*), manter a matéria e a persona do turno anterior. | P0 | CA01, CA02 |
| RF02 | **Persistência da sessão no chat e botão "Nova conversa" (`src/chat.ts`, `tutor.html`):** salvar as mensagens da sessão atual em `sessionStorage` (`tutoria_chat_sessao`) para restaurar o chat e a última lousa ao navegar entre `tutor.html` e `configuracoes.html`. Adicionar botão `"Nova conversa"` no cabeçalho do painel de chat que limpa a sessão, fecha a lousa e reinicia o contexto enviado ao Gemini. | P0 | CA03 |
| RF03 | **Exibição progressiva das etapas no balão do chat (`src/chat.ts`, `src/tutor.ts`):** criar o balão do tutor assim que a 1ª etapa começa a ser falada e atualizar seu texto progressivamente a cada nova etapa iniciada. Ao final da resposta, anexar no mesmo balão o botão `"Ver na Lousa (N)"` e os botões de `"📖 Fonte"`. | P0 | CA04 |
| RF04 | **Seletor de Série / Ano Escolar (`src/armazenamento.ts`, `configuracoes.html`, `tutor.html`, `src/conhecimento/busca.ts`):** permitir selecionar a série (`6º ano EF`, `7º ano EF`, `8º ano EF`, `9º ano EF`, `1º ano EM`, `2º ano EM`, `3º ano EM` ou `Todas`). A série escolhida: (a) é incluída no prompt para ajustar vocabulário e exemplos; (b) aplica um boost (`1.25x`) nos trechos de livros da mesma série em `buscarTrechosRelevantes()`; (c) aparece como badge clicável no cabeçalho de `tutor.html`. | P0 | CA05, CA06 |
| RF05 | **Identidade visual por persona e `FaceLandmarker` no gravador (`src/personas/`, `src/avatar3d/`, `src/gravador/`):** (a) adicionar em cada `Persona` uma cor de destaque (`corTema`) e ícone/emblema da matéria, aplicando ao halo do avatar, à iluminação secundária (`rimLight` no 3D) e a um badge de matéria visível no palco; (b) no gravador de gestos (`src/gravador/pagina.ts` e `conversor.ts`), integrar o `FaceLandmarker` do MediaPipe com `outputFacialTransformationMatrixes: true` para extrair a rotação 3D real da cabeça quando o rosto for detectado, mantendo a estimativa por nariz/orelhas como fallback. | P1 | CA07, CA08 |
| RF06 | **Gráficos de função na lousa e exportar lousa (`src/lousa/`):** (a) adicionar o tipo `grafico` em `ItemLousa` (`{ expressao?: string, pontos: Array<{x: number, y: number}>, titulo?: string, eixoX?: string, eixoY?: string }`) que gera localmente um gráfico cartesiano em SVG responsivo com eixos, grade e curva suave; (b) adicionar no cabeçalho da lousa o botão `"Copiar / Baixar resumo"`, que copia os itens em texto formatado para a área de transferência ou baixa um `.txt`/`.md` de revisão. | P1 | CA09, CA10 |
| RF07 | **PWA instalável e funcionamento offline (`public/sw.js`, `public/manifest.json`):** criar um Service Worker leve com estratégia *Network First* para páginas/JSON de conhecimento e *Cache First* para assets versionados (CSS, JS, modelo VRM), além de ícones 192×192 e 512×512 válidos no `manifest.json`. Registrar o Service Worker apenas em produção (`!import.meta.env.DEV`) para não interferir no Vite HMR. | P1 | CA11 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Orçamento de tokens: o histórico de conversa enviado ao Gemini nunca deve ultrapassar ~1.200 tokens (~4.800 caracteres); turnos antigos excedentes são truncados automaticamente mantendo sempre a pergunta atual e os trechos do livro. | P0 | CA01 |
| RNF02 | Segurança no tipo `grafico`: o gráfico é desenhado por código próprio gerando elementos SVG a partir de coordenadas numéricas validadas (`Number.isFinite`), sem nunca usar `eval()` ou `new Function()` em expressões vindas do modelo. | P0 | CA09 |
| RNF03 | O JS inicial de `tutor.html` deve permanecer ≤ 100 KB gzip após todas as melhorias. | P0 | CA11 |

### Dependências técnicas

- `src/gemini.ts`, `src/tutor.ts`, `src/chat.ts`, `src/armazenamento.ts`, `src/conhecimento/busca.ts`, `src/lousa/renderer.ts`, `src/lousa/tipos.ts`, `src/personas/catalogo.ts`, `src/avatar3d/avatar3d.ts`, `src/gravador/pagina.ts`, `src/gravador/conversor.ts`.
- Especificações anteriores: [2026-10-23_avatar-personas-por-materia.md](2026-10-23_avatar-personas-por-materia.md), [2026-10-23_gravador-de-gestos.md](2026-10-23_gravador-de-gestos.md), [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md) e [DONE/2026-10-16_multipaginas-typescript-e-android.md](DONE/2026-10-16_multipaginas-typescript-e-android.md).

### Recursos necessários

- Ícones PNG 192×192 e 512×512 em `public/icons/` para o manifesto PWA.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que o aluno perguntou *"O que é fotossíntese?"* e recebeu resposta, quando pergunta em seguida *"Onde ela acontece?"*, então `callGeminiApi` envia o turno anterior em `contents` e o histórico enviado não ultrapassa 4.800 caracteres.
- [ ] **CA02:** Dado que o professor ativo é `"Ada"` (Matemática) e o aluno faz uma pergunta de acompanhamento sem palavras-chave (*"Pode dar outro exemplo?"*), quando a resposta começa, então a persona `"Ada"` é mantida sem voltar para `"Lia"`.
- [ ] **CA03:** Dado uma conversa com 2 perguntas no chat, quando o aluno navega para `configuracoes.html` e volta para `tutor.html`, então as mensagens continuam no chat; e quando clica em `"Nova conversa"`, o chat e o contexto são limpos.
- [ ] **CA04:** Dado uma resposta com 3 etapas, quando a etapa 1 começa a ser falada, então o balão do tutor já está visível no chat com o texto da etapa 1, acrescentando as etapas 2 e 3 conforme cada uma começa.
- [ ] **CA05:** Dado que o aluno seleciona `"6º ano EF"` nas Configurações, quando pergunta algo ao tutor, então o prompt enviado ao Gemini instrui o nível `"6º ano EF"` e o badge no topo da sala de estudos mostra `"6º ano EF"`.
- [ ] **CA06:** Dado dois trechos sobre o mesmo tema no índice BM25 (um do `"6º ano EF"` e outro do `"2º ano EM"`), quando o aluno com série `"6º ano EF"` faz a busca, então o trecho do `"6º ano EF"` recebe boost de pontuação e fica acima do outro.
- [ ] **CA07:** Dado a troca de persona de `"Lia"` para `"Prof. Átomo"` e depois para `"Machado"`, quando a persona muda, então a cor do halo/iluminação do palco e o badge visual do professor mudam imediatamente para refletir a persona ativa.
- [ ] **CA08:** Dado uma matriz 4×4 de transformação facial do `FaceLandmarker`, quando passada para `converterQuadro()` no gravador de gestos, então `neck` e `head` refletem a rotação extraída da matriz facial.
- [ ] **CA09:** Dado um item de lousa do tipo `grafico` com pontos de uma parábola (`y = x^2` de `-2` a `2`), quando renderizado na lousa, então um SVG com eixos X/Y, pontos e curva é exibido sem usar `eval`.
- [ ] **CA10:** Dado a lousa aberta com 3 itens, quando o aluno clica no botão de copiar/baixar resumo da lousa, então o conteúdo estruturado das etapas da lousa é copiado/exportado com sucesso.
- [ ] **CA11:** Dado o build de produção (`npm run build && npm run preview`), quando a página é carregada uma vez e a rede é desligada no DevTools, então recarregar `tutor.html` funciona offline via Service Worker e uma pergunta do cache é respondida normalmente.

## O que a atividade não inclui

- Sincronizar o histórico de conversa na nuvem entre dispositivos diferentes: motivo: exigiria backend e login de usuário, fora do modelo local atual.
- Interpretador simbólico de expressões arbitrárias no cliente para o tipo `grafico`: motivo: o próprio modelo Gemini já envia os pares `{x, y}` calculados junto com o título da função, mantendo o cliente simples, exato e seguro (RNF02).

### Considerado para o futuro (P2)

- Exportar a lousa em PDF ilustrado com as imagens e desenhos SVG embutidos.
- Perfis múltiplos de alunos no mesmo aparelho (ex.: irmãos de séries diferentes usando o mesmo tablet).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Se o aluno nunca escolheu a série escolar, mostramos um seletor rápido na primeira visita à Sala de Estudos ou deixamos padrão "Ensino Fundamental e Médio (Geral)"? | PO / design | Não | Sugestão: padrão geral sem bloquear o uso, com seletor rápido clicável no badge do cabeçalho e nas Configurações. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Payload multi-turno e limite de tokens | unit | CA01, RNF01 | Chamar `callGeminiApi` passando histórico de 8 turnos longos | `contents` inclui até os últimos 5 turnos truncados a ≤ 4.800 caracteres |
| CT02 | Manutenção da persona em follow-up | unit | CA02 | `resolverPersona` com pergunta `"e outro exemplo?"` após matéria `"matematica"` | Mantém persona `"ada"` |
| CT03 | Persistência e limpeza do chat | unit | CA03 | Adicionar mensagens no `ChatGerenciador`, recriar instância lendo `sessionStorage` e depois chamar `limpar()` | Mensagens restauradas na recriação e removidas ao limpar |
| CT04 | Balão progressivo por etapa | unit | CA04 | Iniciar resposta de 3 etapas e verificar DOM a cada etapa | Balão atualizado etapa a etapa; botões de lousa e fonte ao final |
| CT05 | Boost de série escolar no BM25 | unit | CA05, CA06 | Buscar termo em índice com 2 trechos idênticos de séries diferentes passando `serie: '6º ano EF'` | Trecho do 6º ano obtém score 1,25× maior |
| CT06 | Tema visual por persona | unit | CA07 | Verificar catálogo de personas e aplicar persona no avatar | Todas as personas têm `corTema` e atualizam o atributo/variável CSS do palco |
| CT07 | Matriz facial no conversor | unit | CA08 | Passar matriz de rotação de 20° em Y para `converterQuadro` | Quatérnios `neck`/`head` giram na direção esperada |
| CT08 | Renderização segura de `grafico` | unit | CA09, RNF02 | Chamar `renderizarItemLousa` com `tipo: 'grafico'` e lista de pontos (incluindo `NaN` e `<script>` no título) | Gera `<svg>` com `<polyline>`/`<path>`, ignora `NaN` e escapa o título |
| CT09 | Exportação de resumo da lousa | unit | CA10 | Chamar formatador de resumo da lousa com fórmula, lista e passos | Retorna texto limpo e organizado com todos os itens |
| CT10 | Funcionamento offline PWA | manual | CA11 | `npm run build && npm run preview`, abrir página, ativar Offline no DevTools e recarregar | Página abre sem erro de rede |

## URL Complementar

- Documentação técnica: [Gemini API: Multi-turn conversations (chat)](https://ai.google.dev/gemini-api/docs/text-generation#chat) · [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) · [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)
- Protótipo / mockup: N/A.
- Discussões relacionadas: [2026-10-23_avatar-personas-por-materia.md](2026-10-23_avatar-personas-por-materia.md) · [2026-10-23_gravador-de-gestos.md](2026-10-23_gravador-de-gestos.md) · [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md)
- Referências de design: `src/styles/tutor.css` e `src/styles/lousa.css`.
- Requisitos originais: levantamento de melhorias do projeto em 2026-11-15.
- Issue / PR relacionado: N/A, a ser criado.
