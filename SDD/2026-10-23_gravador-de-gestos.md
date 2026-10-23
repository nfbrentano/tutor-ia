# [FEAT] Gravador de gestos: vídeo do professor → clipe de animação do avatar (MediaPipe + Kalidokit)

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-23 · **Atualizada em:** 2026-10-23

## Detalhes da Atividade

- **O que precisa ser feito:** Uma ferramenta de desenvolvimento, dentro do repositório, para:
  1. **Gravar:** filmar uma pessoa (o PO ou um professor) gesticulando como numa aula, pela webcam ou a partir de um vídeo gravado no iPhone.
  2. **Converter:** transformar o movimento em rotações dos ossos do avatar VRM.
  3. **Revisar:** ver o resultado no próprio avatar e cortar o trecho bom.
  4. **Salvar:** gravar como **clipe de animação** do tutor (categorias `idle`, `listening`, `thinking`, `speaking`, `apontar`, `cumprimentar`).

  O clipe salvo é tocado pelo `GerenciadorClipes` que já existe (`src/avatar3d/animacoes.ts`), por todas as personas, do mesmo jeito que os clipes do Mixamo. Tudo roda no navegador, com ferramentas open source (MediaPipe e Kalidokit), sem servidor e sem custo.
- **Problema e evidência:**
  - A spec [2026-10-23_avatar-personas-por-materia.md](2026-10-23_avatar-personas-por-materia.md) deixou o avatar pronto para receber clipes (RF02/RF03), mas o manifesto `public/avatar/animacoes/manifesto.json` está vazio.
  - **Mixamo:** exige conta Adobe e só tem gestos genéricos, sem a cara de "professor explicando".
  - **Apps pagos de captura** (Move One, Rokoko Vision): têm custo e licença a verificar.
  - **Hoje:** o avatar usa só poses procedurais. Elas melhoraram, mas ainda não têm a naturalidade de um movimento humano capturado.
- **Impacto de não fazer:** O avatar continua sem animações capturadas, ou o time depende de conta Adobe e gestos genéricos. O ganho de "parecer humano" fica limitado.
- **Para quem é destinado:** Time do TutorIA (PO e devs) que produz os gestos; indiretamente, o aluno, que vê o resultado.
- **História de usuário:** Como PO do TutorIA, quero gravar a mim mesmo explicando uma matéria e transformar meus gestos em animações do avatar, para que o tutor gesticule como um professor de verdade sem depender de ferramentas pagas.
- **Como saberemos que deu certo:**
  - O PO produz **pelo menos 6 clipes** (2 `speaking`, 1 `thinking`, 1 `idle`, 1 `listening`, 1 `cumprimentar`) em **≤ 45 min**, da gravação até o clipe tocando no tutor.
  - Nenhum quadro do clipe salvo tem salto de rotação acima de 25° em relação ao anterior (sem tremores visíveis).
  - Em teste com pelo menos 5 alunos comparando o avatar com e sem os clipes gravados, 4 ou mais preferem com os clipes.
  - **0 bytes** de vídeo enviados pela rede (verificável na aba Rede).

### Por que MediaPipe + Kalidokit

| Opção | Motivo da escolha ou descarte |
|---|---|
| **MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) + Kalidokit (`kalidokit`)** | **Escolhida.** A licença do MediaPipe (Apache 2.0) e a do Kalidokit (MIT) permitem uso comercial. Rodam no navegador. O Kalidokit converte pontos do corpo, das mãos e do rosto em rotações de ossos VRM, e foi feito para o `three-vrm`, que o app já usa. |
| Modelos de pesquisa (WHAM, 4D-Humans, GVHMR, VIBE) | Mais precisos, mas exigem Python e GPU, e dependem do modelo de corpo **SMPL**, cuja licença **proíbe uso comercial**. |
| FreeMoCap | Open source (AGPL), mas pede 2 ou mais câmeras calibradas. |
| BlendArMocap (Blender) | Open source (GPL), mas exige o Blender instalado e um fluxo fora do app. Fica como alternativa. |
| Move One, Rokoko Vision, DeepMotion | Bons resultados, mas pagos ou freemium e não open source. |

### Riscos conhecidos

- **Kalidokit sem atualizações:** a última versão (1.1.5) é de 2022 e foi pensada para o MediaPipe Holistic antigo e para VRM 0.x. O app usa VRM 1.0 e o MediaPipe Tasks atual. Pode ser preciso inverter sinais de eixos ou adaptar o formato dos pontos detectados. Ver D01.
- **Precisão dos dedos e da profundidade:** com uma câmera só, a profundidade (braço para a frente ou para trás) e os dedos são imprecisos. Por isso há filtro de suavização e revisão no próprio avatar antes de salvar.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Página de desenvolvimento** `gravador.html` na raiz, com script em `src/gravador/`. Acessível só com `npm run dev`: fica **fora** de `build.rollupOptions.input`, do `dist/` e do APK. Não há link para ela no app. | P0 | CA01, CA02 |
| RF02 | **Duas entradas de vídeo:** (a) webcam ao vivo (`getUserMedia`), com contagem regressiva de 3 s e botão gravar/parar; (b) arquivo de vídeo (`.mp4`/`.mov` H.264, por exemplo do iPhone em Ajustes > Câmera > Formatos > "Mais Compatível"). O vídeo é processado quadro a quadro a 30 fps fixos, independente da velocidade da máquina. | P0 | CA03, CA04 |
| RF03 | **Detecção:** MediaPipe Tasks Vision (corpo com coordenadas 3D, as duas mãos e o rosto) em modo VIDEO, com os modelos carregados sob demanda. Cada quadro gera pontos do corpo, das mãos e do rosto com índice de confiança. | P0 | CA03 |
| RF04 | **Conversão para VRM:** o Kalidokit (`Pose.solve`, `Hand.solve`, `Face.solve`) gera as rotações de `hips` (só rotação), `spine`, `chest`, `upperChest`, `neck`, `head`, ombros, braços, antebraços, mãos e as 3 falanges de cada dedo. Pernas ficam em repouso e o quadril não se desloca. Os eixos são adaptados para os ossos normalizados VRM 1.0 do app (guia de eixos em `src/avatar3d/poses.ts`). | P0 | CA05 |
| RF05 | **Suavização e falhas de detecção:** filtro One Euro (ou equivalente) nas rotações, ajustável em "suave ↔ responsivo". Ossos com confiança < 0,5 mantêm a última rotação válida; mais de 0,5 s sem detecção marca o trecho como "falha" na linha do tempo. | P0 | CA06, CA07 |
| RF06 | **Pré-visualização ao vivo:** o avatar atual (persona escolhida numa lista) repete o movimento em tempo real ao lado do vídeo. Opção **Espelhar** (padrão desligado: a mão direita da pessoa move a mão direita do avatar). | P0 | CA05, CA08 |
| RF07 | **Edição antes de salvar:** linha do tempo com recorte de início e fim, reprodução em loop no avatar, escolha da categoria, nome do clipe e, opcionalmente, as personas a que o clipe se aplica. Opção **Loop suave** (padrão ligado em `idle`, `listening`, `thinking` e `speaking`): mistura os últimos 0,3 s com os primeiros para o loop não dar salto. | P0 | CA09, CA10 |
| RF08 | **Formato do clipe** `tutoria-clipe-vrm` (JSON): `{ formato, versao: 1, nome, categoria, loop, fps, duracao, personas?, ossos: { <VRMHumanBoneName>: [x,y,z,w, ...] } }`. Quatérnios por osso humanoide, com 3 casas decimais e amostrados a 20 fps. Não depende de um modelo específico. | P0 | CA11 |
| RF09 | **Salvar:** (a) botão **Baixar** gera o `.json` para colocar manualmente em `public/avatar/animacoes/`; (b) no `npm run dev`, botão **Salvar no projeto** chama um plugin do Vite só de desenvolvimento (`apply: 'serve'`), que grava o arquivo e acrescenta a entrada no `manifesto.json`. O plugin valida o nome (`[a-z0-9-]+`), recusa `..` e caminhos absolutos e só escreve dentro de `public/avatar/animacoes/`. | P0 (a) / P1 (b) | CA12, CA13 |
| RF10 | **Tocar no tutor:** `GerenciadorClipes` e `validarManifestoClipes` aceitam arquivos `.json` no formato do RF08, além de `.fbx`. O clipe é montado com `QuaternionKeyframeTrack` nos ossos normalizados de cada persona. Entradas com `personas` só tocam nessas personas. | P0 | CA14, CA15 |
| RF11 | **Privacidade:** o vídeo e as imagens da câmera **nunca** saem do navegador e **não** são salvos; só as rotações dos ossos vão para o clipe. A câmera é desligada ao sair da página ou ao trocar para arquivo. | P0 | CA16 |
| RF12 | **Expressões do rosto no clipe** (`happy`, `surprised`, sobrancelhas) a partir do `Face.solve`, guardadas em `expressoes` no JSON. A boca **não** é gravada: ela continua sendo do lip sync. | P2 | — |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | `kalidokit` e `@mediapipe/tasks-vision` entram como **devDependencies**, com versão exata. Nenhum dos dois aparece no bundle de produção nem no APK. | P0 | CA02 |
| RNF02 | Cada clipe salvo ocupa ≤ 250 KB e dura ≤ 15 s. O pacote total de animações continua ≤ 3 MB (RNF02 da spec de personas). | P0 | CA11 |
| RNF03 | A pré-visualização ao vivo fica ≥ 20 fps num MacBook com Apple Silicon. Processar um vídeo de 30 s leva ≤ 60 s. | P1 | CA03 |
| RNF04 | O clipe tocado no tutor mantém o desempenho da spec de personas (≥ 50 fps falando num Android intermediário). | P0 | CA14 |
| RNF05 | A página explica, num aviso curto, que o vídeo é processado só no navegador e não é salvo (RF11). | P1 | CA16 |

### Dependências técnicas

- `src/avatar3d/animacoes.ts` (`GerenciadorClipes`, `validarManifestoClipes`), `src/avatar3d/avatar3d.ts` (reaproveitado para a pré-visualização), `src/personas/` (lista de personas) e `vite.config.ts` (plugin de desenvolvimento).
- Novas devDependencies: `kalidokit` (MIT, 1.1.5) e `@mediapipe/tasks-vision` (Apache 2.0; versão exata a fixar na implementação).
- Arquivos de modelo do MediaPipe (`.task`) e o WASM: baixados do CDN oficial do Google na primeira vez que o gravador é usado, só em desenvolvimento.
- Spec anterior: [2026-10-23_avatar-personas-por-materia.md](2026-10-23_avatar-personas-por-materia.md) (RF02, RF03 e RNF02).

### Recursos necessários

- Webcam ou iPhone; ambiente bem iluminado, fundo liso, enquadramento da cintura para cima, roupa que contraste com o fundo.
- Roteiro curto de gravação: explicar um conceito com as duas mãos (`speaking`), pensar com a mão no queixo (`thinking`), ouvir com aceno (`listening`), parado relaxado (`idle`), acenar (`cumprimentar`).
- Navegador Chrome ou Edge atualizado (MediaPipe Tasks com WebGL/WASM).

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado o projeto rodando com `npm run dev`, quando acesso `/gravador.html`, então a página abre com as opções de webcam e arquivo, a lista de personas e o aviso de privacidade.
- [ ] **CA02 (negativo):** Dado `npm run build`, quando inspeciono `dist/` e o bundle, então não há `gravador.html`, nem código do Kalidokit, nem do MediaPipe.
- [ ] **CA03:** Dado um vídeo `.mp4` de 30 s com uma pessoa gesticulando, quando o envio ao gravador, então ele processa em ≤ 60 s, a 30 quadros por segundo de vídeo, e mostra a linha do tempo com o movimento.
- [ ] **CA04:** Dado a webcam liberada, quando clico em gravar, então há contagem regressiva de 3 s, a gravação começa e o botão parar encerra; com a permissão negada, aparece uma mensagem clara e a opção de arquivo continua disponível.
- [ ] **CA05:** Dado que a pessoa levanta o braço direito para a frente, quando a pré-visualização é exibida, então o braço direito do avatar sobe para a frente (não para trás nem para o lado); com "Espelhar" ligado, quem sobe é o braço esquerdo.
- [ ] **CA06:** Dado um clipe processado com o filtro padrão, quando analiso as rotações, então nenhum osso varia mais de 25° entre dois quadros seguidos.
- [ ] **CA07 (erro):** Dado um vídeo em que a pessoa sai do quadro por 2 s, quando é processado, então o avatar mantém a última pose válida nesse trecho e a linha do tempo marca a falha.
- [ ] **CA08:** Dado a pré-visualização ao vivo pela webcam, quando a pessoa se mexe, então o avatar acompanha a ≥ 20 fps, com atraso perceptível ≤ 200 ms.
- [ ] **CA09:** Dado um trecho recortado de 4 s em loop com "Loop suave", quando ele reinicia, então não há salto visível entre o fim e o começo.
- [ ] **CA10:** Dado que escolho a categoria `thinking` e as personas `machado` e `ada`, quando salvo, então o JSON tem `"categoria": "thinking"` e `"personas": ["machado", "ada"]`.
- [ ] **CA11:** Dado um clipe salvo de 10 s, quando inspeciono o arquivo, então ele segue o formato do RF08, tem ≤ 250 KB e só traz ossos humanoides VRM válidos.
- [ ] **CA12:** Dado o botão "Salvar no projeto" em `npm run dev`, quando salvo `explicando-1`, então `public/avatar/animacoes/explicando-1.json` é criado e o `manifesto.json` ganha a entrada, sem apagar as existentes.
- [ ] **CA13 (negativo):** Dado uma requisição ao plugin com nome `../../src/tutor` ou caminho absoluto, quando processada, então é recusada com erro e nenhum arquivo é escrito fora de `public/avatar/animacoes/`.
- [ ] **CA14:** Dado um clipe `speaking` gravado no manifesto, quando o tutor responde uma pergunta, então o avatar toca o clipe com transição suave e continua com lip sync, piscadas e olhar procedurais.
- [ ] **CA15:** Dado um clipe com `"personas": ["machado"]`, quando a persona ativa é Ada, então esse clipe **não** é tocado; com Machado ativo, ele entra no sorteio.
- [ ] **CA16 (negativo):** Dado o gravador em uso com a aba Rede aberta, quando gravo e processo um vídeo, então nenhuma requisição envia imagem ou vídeo (só os downloads dos modelos do MediaPipe), e nenhum arquivo de vídeo é criado no projeto.

## O que a atividade não inclui

- Animar o avatar ao vivo na frente do aluno (o professor "controlando" o tutor em tempo real): motivo: outra iniciativa, com outras exigências de privacidade e latência.
- Captura das pernas e deslocamento pelo espaço: motivo: o enquadramento do tutor é da cintura para cima.
- Gravar a boca ou fazer lip sync a partir do vídeo: motivo: a boca é controlada pelo lip sync da fala sintetizada.
- Modelos de pesquisa com SMPL (WHAM, 4D-Humans etc.): motivo: licença não comercial.
- Criar ou escanear o modelo 3D das personas: motivo: tratado separadamente (D02 da spec de personas).
- Disponibilizar o gravador para alunos ou no app Android: motivo: é uma ferramenta interna de produção de conteúdo.

### Considerado para o futuro (P2)

- Expressões faciais gravadas no clipe (RF12).
- Exportar também em `.vrma` (formato padrão de animação VRM) para uso em outras ferramentas.
- Dois ângulos de câmera (webcam + iPhone) para melhorar a profundidade.
- Biblioteca de clipes por persona com pré-visualização em Configurações.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | O Kalidokit 1.1.5 funciona direto com a saída do MediaPipe Tasks e com VRM 1.0, ou é melhor portar só as funções de cálculo para `src/gravador/` (licença MIT permite)? Decidir num protótipo de 1 dia. | dev | Sim | |
| D02 | Quem grava os gestos: o PO, um professor convidado ou os dois? Se for professor convidado, é preciso um termo simples de autorização de uso do movimento (mesmo sem guardar o vídeo). | PO | Não | |
| D03 | Clipes por persona: gravar gestos diferentes para cada persona (ex.: Machado mais contido) ou um pacote único para todas no começo? | PO | Não | |
| D04 | Os modelos do MediaPipe (`.task`, alguns MB) ficam baixando do CDN do Google ou são guardados numa pasta local ignorada pelo git? | dev | Não | |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Página de dev | manual | CA01 | `npm run dev`; abrir `/gravador.html` | Webcam, arquivo, personas e aviso visíveis |
| CT02 | Fora do build | integração | CA02 | `npm run build`; procurar "kalidokit", "tasks-vision" e `gravador.html` em `dist/` | Nada encontrado |
| CT03 | Vídeo do iPhone | manual | CA03 | Enviar `.mp4` H.264 de 30 s; cronometrar | ≤ 60 s; linha do tempo completa |
| CT04 | Webcam e permissão negada | manual | CA04 | Gravar com webcam; depois negar a permissão | Contagem e gravação; mensagem clara ao negar |
| CT05 | Conversão de eixos | unit | CA05 | Pontos do MediaPipe salvos (fixture JSON) de "braço direito à frente" → conversão | Rotação do `rightUpperArm` com `x` negativo (à frente), segundo o guia de eixos |
| CT06 | Espelhar | unit | CA05 | Mesma fixture com espelho ligado | Movimento vai para o `leftUpperArm` |
| CT07 | Filtro de tremor | unit | CA06 | Série de rotações com ruído → filtro | Nenhum salto > 25° entre quadros |
| CT08 | Falha de detecção | unit | CA07 | Série com 2 s de confiança 0 | Última pose mantida; trecho marcado como falha |
| CT09 | Pré-visualização ao vivo | manual | CA08 | Webcam; medir fps no contador de debug | ≥ 20 fps; atraso ≤ 200 ms |
| CT10 | Loop suave | unit | CA09 | Clipe com fim ≠ começo → loop suave | Diferença entre o último e o primeiro quadro ≤ 2° |
| CT11 | Formato e tamanho | unit | CA10, CA11 | Serializar clipe de 10 s com categoria e personas | JSON válido, ≤ 250 KB, ossos válidos, campos corretos |
| CT12 | Plugin salva | integração | CA12 | Chamar o plugin com `explicando-1` num diretório temporário | Arquivo criado; manifesto com as entradas antigas e a nova |
| CT13 | Plugin recusa caminho inválido | unit | CA13 | Nomes `../../src/tutor`, `/etc/x`, `a b` | Todos recusados; nada escrito |
| CT14 | Clipe no tutor | manual | CA14 | Adicionar um clipe `speaking` e fazer uma pergunta | Clipe com transição; lip sync e piscadas continuam |
| CT15 | Filtro por persona | unit | CA15 | `GerenciadorClipes` com clipe `personas: ["machado"]`, persona Ada e depois Machado | Não toca com Ada; entra no sorteio com Machado |
| CT16 | Privacidade | manual | CA16 | Aba Rede durante gravação e processamento | Só downloads dos modelos; nenhum envio de mídia |
| CT17 | Preferência dos alunos | manual | — | 5 alunos veem o avatar com e sem os clipes gravados | ≥ 4 preferem com os clipes |

## URL Complementar

- Documentação técnica: [MediaPipe Tasks Vision para web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) · [Kalidokit](https://github.com/yeemachine/kalidokit) · [three-vrm](https://github.com/pixiv/three-vrm) · [Especificação VRM 1.0](https://vrm.dev/en/)
- Protótipo / mockup: N/A, a página de desenvolvimento pode seguir o visual de `configuracoes.html`.
- Discussões relacionadas: [2026-10-23_avatar-personas-por-materia.md](2026-10-23_avatar-personas-por-materia.md) (clipes, manifesto e personas).
- Referências de design: guia de eixos dos ossos em `src/avatar3d/poses.ts`.
- Requisitos originais: pedido do PO em 2026-10-23: "eu poderia fazer um 3D com meu celular gravando um vídeo de mim mesmo" e "tenho como fazer isso usando ferramentas open source?".
- Issue / PR relacionado: N/A, a ser criado.
