# [FEAT] Avatar do tutor com movimentos humanos

> **Status:** Concluído
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-16 · **Atualizada em:** 2026-10-16

## Detalhes da Atividade

- **O que precisa ser feito:** Fazer o avatar do tutor se mover de forma natural, parecida com a de uma pessoa: respirar, piscar, mexer a cabeça e o olhar, gesticular enquanto explica, mexer a boca no ritmo da fala e apontar para a lousa (ver [2026-10-16_lousa-de-apoio-visual.md](2026-10-16_lousa-de-apoio-visual.md)) quando ela mostra algo.
- **Problema e evidência:** Hoje o avatar é um robô em SVG (`index.html:988-1027`) que só troca de cor e de animação em loop conforme o estado (`idle`, `listening`, `thinking`, `speaking`; `setAvatarState` em `index.html:1336`). A "boca" são 5 barras de equalizador com duração fixa (`index.html:330-334`), sem relação com o que está sendo falado. Não há piscadas, olhar, cabeça nem gestos. O avatar parece um indicador de status, não alguém explicando.
- **Impacto de não fazer:** O aluno não sente que está conversando com um tutor; a atenção cai em explicações longas e a lousa fica "solta", sem ninguém conduzindo o olhar até ela.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio que usa o tutor por voz ou texto.
- **História de usuário:** Como aluno, quero que o tutor se mexa e fale como uma pessoa, olhando para mim e apontando para a lousa, para que a explicação pareça uma aula de verdade e eu saiba para onde olhar.
- **Como saberemos que deu certo:** (1) Em teste com pelo menos 5 alunos, 4 ou mais descrevem o tutor como "vivo"/"parecendo uma pessoa" sem serem induzidos. (2) Animações rodam a 60 fps (nenhum quadro acima de 50 ms no painel Performance do Chrome) em um notebook comum. (3) 0 erros no console.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | Redesenhar o avatar em SVG com cabeça, pescoço, tronco e dois braços com mão articulada (ombro, cotovelo, mão como grupos `<g>` animáveis), mantendo a identidade visual atual (cores, halo, olhos com brilho). | P0 | CA01 |
| RF02 | Movimento de repouso contínuo: respiração (tronco sobe/desce ~3–5 s por ciclo) e leve balanço da cabeça, presentes em todos os estados. | P0 | CA02 |
| RF03 | Piscadas em intervalos aleatórios entre 2 s e 6 s, com piscada dupla ocasional (~10%). | P0 | CA03 |
| RF04 | Movimento de boca dirigido pela fala: abrir/fechar a cada palavra usando o evento `boundary` do `SpeechSynthesisUtterance`; se o navegador não emitir `boundary`, usar animação aproximada baseada na duração estimada do texto. Boca fechada em silêncio. | P0 | CA04, CA05 |
| RF05 | Pose e expressão por estado: **ouvindo** (cabeça levemente inclinada, olhar para frente, sobrancelhas levantadas); **pensando** (olhar para cima/lado, mão no queixo); **falando** (gestos de explicação); **repouso** (braços relaxados). Transições suaves entre poses (200–400 ms, com easing), sem "saltos". | P0 | CA06 |
| RF06 | Gestos durante a fala: a cada frase, escolher um gesto de um repertório (mão aberta, contar nos dedos, palmas para cima, mão no peito) sem repetir o mesmo gesto duas vezes seguidas. | P1 | CA07 |
| RF07 | Apontar para a lousa: quando um item da lousa aparece, o avatar vira o olhar e aponta com o braço na direção da lousa por ~1,5 s e depois volta a olhar para o aluno. | P0 | CA08 |
| RF08 | Olhar seguindo o cursor (ou o foco do campo de texto) enquanto ouve ou está em repouso, com limite de rotação para não parecer "vidrado". | P2 | — |
| RF09 | Encapsular toda a animação em um módulo único (ex.: objeto `AvatarAnimator` com `setState()`, `startSpeaking(utterance)`, `pointAt(elemento)`, `gesture(nome)`), chamado por `setAvatarState` e `speakExplanation`, sem espalhar lógica de animação pelo fluxo principal. | P0 | CA09 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Sem bibliotecas de animação: módulo TypeScript `avatar/` (SVG + CSS + `requestAnimationFrame`/Web Animations API) na estrutura definida em [2026-10-16_multipaginas-typescript-e-android.md](2026-10-16_multipaginas-typescript-e-android.md); deve funcionar igual na web e no app Android (Capacitor). | P0 | CA09 |
| RNF02 | 60 fps em notebook comum; uso de CPU da aba em repouso < 10% (só `transform`/`opacity` animados, sem reflow). | P0 | CA10 |
| RNF03 | Respeitar `prefers-reduced-motion: reduce`: manter piscadas e boca, desligar balanço, gestos amplos e respiração. | P0 | CA11 |
| RNF04 | Funcionar no layout de uma coluna (≤ 980 px) sem cortar braços nem gestos. | P1 | CA12 |
| RNF05 | Animações pausadas quando a aba está oculta (`document.hidden`). | P1 | — |

### Dependências técnicas

- [2026-10-16_multipaginas-typescript-e-android.md](2026-10-16_multipaginas-typescript-e-android.md) concluída antes (base TS + Capacitor).
- No Android, os eventos de palavra vêm do plugin de fala do Capacitor (ver D02 daquela especificação), não do `speechSynthesis`.
- `setAvatarState()` (`index.html:1336-1357`) e `speakExplanation()` (`index.html:1379-1418`), onde o módulo de animação será acoplado.
- Evento `boundary` do Web Speech API (suporte varia por navegador e por voz; vozes "Google" no Chrome costumam não emitir `boundary`, daí o fallback do RF04).
- Para o RF07: a especificação [2026-10-16_lousa-de-apoio-visual.md](2026-10-16_lousa-de-apoio-visual.md) precisa expor um evento/callback "item exibido na lousa" com a posição do elemento.

### Recursos necessários

- Esboço do novo personagem (pode ser feito em SVG direto no código; ideal ter um rascunho de design aprovado antes).
- Navegadores para teste: Chrome, Edge, Safari (macOS) e um Android.

## Critérios de Aceitação / Entregas

- [x] **CA01:** Dado que o aluno abre o tutor, quando a página carrega, então o avatar aparece com cabeça, tronco e dois braços visíveis, nas cores atuais do tema.
- [x] **CA02:** Dado que o tutor está em repouso, quando o aluno observa por 10 s, então o avatar respira e balança a cabeça de leve, sem ficar parado.
- [x] **CA03:** Dado que o tutor está em qualquer estado, quando o aluno observa por 30 s, então o avatar pisca entre 5 e 15 vezes, em intervalos irregulares.
- [x] **CA04:** Dado que o tutor está falando em um navegador que emite `boundary`, quando cada palavra é pronunciada, então a boca abre e fecha no ritmo das palavras e fica fechada nas pausas entre frases.
- [x] **CA05:** Dado que o navegador não emite `boundary`, quando o tutor fala, então a boca anima de forma aproximada e para em até 300 ms depois do fim da fala (`onend`).
- [x] **CA06:** Dado que o tutor está em repouso, quando o aluno clica no microfone e depois envia a pergunta, então o avatar passa para a pose "ouvindo" e depois para "pensando" (mão no queixo), com transições suaves, sem saltos visíveis.
- [x] **CA07:** Dado que o tutor fala uma resposta com pelo menos 3 frases, quando cada frase começa, então o avatar faz um gesto diferente do gesto anterior.
- [x] **CA08:** Dado que a resposta tem conteúdo na lousa, quando um item novo aparece nela, então o avatar olha e aponta para a lousa e depois volta a olhar para o aluno.
- [x] **CA09:** Dado o código entregue, quando ele é revisado, então toda a lógica de animação está em um único módulo sem bibliotecas de animação externas.
- [x] **CA10:** Dado o tutor em repouso por 1 minuto, quando o desempenho é medido no Chrome DevTools, então não há quadros acima de 50 ms e a CPU da aba fica abaixo de 10%.
- [x] **CA11:** Dado que o sistema do aluno está com "reduzir movimento" ativado, quando o tutor fala, então só olhos e boca se mexem.
- [x] **CA12:** Dado uma tela de 375 px de largura, quando o avatar gesticula, então nenhuma parte do corpo é cortada e não aparece rolagem horizontal.
- [x] **CA13 (negativo):** Dado que o aluno interrompe a fala clicando no microfone, quando a fala é cancelada, então a boca fecha e os gestos param imediatamente; o avatar **não** continua "falando" sozinho.

## O que a atividade não inclui

- Avatar 3D ou realista (three.js, Ready Player Me, vídeo gerado): motivo: exige dependências externas e assets pesados; complexo demais agora.
- Lip sync por fonemas (visemas): motivo: o Web Speech API não expõe fonemas; só seria viável com outro TTS.
- Troca de voz/TTS: motivo: outra iniciativa.
- Expressões emocionais baseadas no conteúdo (ex.: sorrir ao elogiar): motivo: depende de o modelo retornar emoção; ver futuro.

### Considerado para o futuro (P2)

- Olhar seguindo o cursor (RF08).
- Campo `emocao` no JSON da resposta para escolher expressão facial.
- Lip sync real com TTS que retorne visemas/timestamps (ex.: troca para um TTS em nuvem).
- Personalização do avatar pelo aluno.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | O avatar continua sendo um robô (agora com corpo e braços) ou passa a ser um personagem humano estilizado? | PO / design | Sim | Sugestão: manter o robô com corpo humanoide (preserva a identidade e evita o "vale da estranheza"). |
| D02 | Os gestos devem ser escolhidos pelo modelo (marcações no texto) ou aleatórios por frase? | PO / dev | Não | Sugestão: aleatórios agora; marcações do modelo no futuro. |
| D03 | Em telas pequenas, o avatar diminui ou vira só busto? | design | Não | |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Estrutura do avatar | manual | CA01 | Abrir `index.html` no Chrome | Cabeça, tronco e dois braços visíveis |
| CT02 | Repouso vivo | manual | CA02, CA03 | Deixar em repouso 30 s e contar piscadas | Respiração e balanço visíveis; 5–15 piscadas irregulares |
| CT03 | Boca com `boundary` | manual | CA04 | No Edge com voz "Microsoft ... Natural", perguntar "o que é fotossíntese?" | Boca no ritmo das palavras, fechada nas pausas |
| CT04 | Boca sem `boundary` | manual | CA05 | No Chrome com voz "Google português do Brasil", fazer a mesma pergunta | Boca anima e para até 300 ms após o fim |
| CT05 | Sequência de estados | e2e | CA06 | Microfone → falar → aguardar resposta | Poses ouvindo → pensando → falando, sem saltos |
| CT06 | Gestos sem repetição | unit | CA07 | Chamar o sorteio de gestos 100 vezes | Nunca dois gestos iguais seguidos |
| CT07 | Apontar para a lousa | e2e | CA08 | Perguntar "como resolver 2x + 3 = 7?" | Ao surgir cada passo na lousa, avatar olha e aponta para ela |
| CT08 | Desempenho | manual | CA10 | Gravar 60 s no painel Performance | Sem quadros > 50 ms; CPU < 10% |
| CT09 | Reduzir movimento | manual | CA11 | Ativar "Reduzir movimento" no macOS e perguntar algo | Só olhos e boca se mexem |
| CT10 | Mobile | manual | CA12 | DevTools em 375 px, perguntar algo | Sem cortes nem rolagem horizontal |
| CT11 | Interrupção | e2e | CA13 | Durante a fala, clicar no microfone | Boca fecha e gestos param na hora |

## URL Complementar

- Documentação técnica: [SpeechSynthesisUtterance: boundary event (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event) · [Web Animations API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) · [prefers-reduced-motion (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Protótipo / mockup: N/A, ainda não existe; ver D01.
- Discussões relacionadas: [2026-10-16_lousa-de-apoio-visual.md](2026-10-16_lousa-de-apoio-visual.md) (o gesto de apontar depende dela).
- Referências de design: avatar atual em `tutor-ia/index.html:988-1027` e CSS em `index.html:189-370`.
- Requisitos originais: pedido do PO em 2026-10-16: "que o tutor avatar se mexa como um humano".
- Issue / PR relacionado: N/A, a ser criado.
