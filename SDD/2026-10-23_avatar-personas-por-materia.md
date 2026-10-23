# [FEAT] Avatar 3D mais humano: animações Mixamo e personas por matéria

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-23 · **Atualizada em:** 2026-10-23

## Detalhes da Atividade

- **O que precisa ser feito:** Reformular o avatar 3D em três frentes:
  1. **Movimento humano:** trocar as poses fixas por animações corporais capturadas (Mixamo), com transição suave entre elas, mais camadas procedurais (olhar, piscada, respiração, lip sync). Corrigir os bugs que deixam o avatar parado.
  2. **Personas por matéria:** cada matéria escolar tem seu próprio personagem, inspirado numa figura histórica de referência na área, cuja imagem é de domínio público e sem custo de licença. Só o modelo da matéria ativa é baixado.
  3. **Química com um cientista original:** um personagem próprio no arquétipo do "cientista genial" (cabelo branco despenteado, bigode, jaleco). Ele **não** usa o nome nem o rosto de Albert Einstein.
- **Problema e evidência:** Validação de 2026-10-23 em `tutor.html` (dev local):
  - **Modelo inadequado:** o modelo atual é o `AvatarSample_B` do VRoid, uma personagem de anime com acessórios de orelha de gato e top curto. Não combina com um tutor para Ensino Fundamental e Médio.
  - **Modelo fora dos limites:** o arquivo tem 21 MB, 35,7 mil triângulos e 18 materiais. A spec anterior (RNF02) pedia ≤ 8 MB, ≤ 30 mil triângulos e ≤ 2 materiais. Em 4G, o download tende a estourar o timeout de 10 s e cair no plano B 2D.
  - **Respiração e balanço da cabeça nunca aparecem:** em `src/avatar3d/avatar3d.ts:331-344`, eles são aplicados e logo em seguida sobrescritos por `interpolarOssos` (`rotation.set`). Em repouso, o avatar só pisca.
  - **Gestos parecem robóticos:** são poses paradas trocadas a cada 3,2 s, com suavização por quadro (`0.12`) que muda de velocidade entre 30 e 60 fps. Quadril, ombros e dedos não se mexem; o gesto `contar-dedos` não mexe dedos.
  - **O olhar nunca sai da câmera:** os dois ramos de `avatar3d.ts:323-328` são iguais. `apontarParaLousa` ignora o elemento-alvo e aponta para uma direção fixa.
  - **Boca pulsa em vez de falar:** abre uma vez por palavra, com uma única vogal, e nunca fecha em P/B/M.
- **Impacto de não fazer:** O tutor continua parecendo uma estátua de anime. A proposta de "aula com um professor" perde força e o teste de preferência 2D × 3D da spec anterior tende a falhar.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio, na web e no app Android.
- **História de usuário:** Como aluno, quero que um professor com cara de especialista da matéria me explique gesticulando e falando como uma pessoa, para a aula parecer de verdade e eu lembrar melhor do conteúdo.
- **Como saberemos que deu certo:**
  - Em teste com pelo menos 5 alunos comparando o avatar atual com o novo, 4 ou mais preferem o novo.
  - Em 30 s de repouso, um observador identifica respiração, troca do peso do corpo e movimentos de olhar (hoje: só piscada).
  - Numa resposta de 4 frases, nenhum gesto se repete em sequência e não há "salto" visível entre gestos.
  - Mantém ≥ 50 fps falando num Android intermediário e 0 erros no console.
  - Nenhum custo de licença de imagem; cada persona tem a fonte da referência visual documentada.

### Personas propostas

Critérios para usar uma pessoa real como referência:
- morreu há **≥ 100 anos** (antes de 1926);
- tem retrato em domínio público;
- não há agência que licencie o nome ou a imagem (como a GreenLight faz com o Einstein);
- o nome não é marca registrada no INPI para educação ou software.

O personagem é sempre uma **interpretação estilizada** (cartoon, tipo animação 3D), apresentada como "inspirado em", e nunca uma réplica fotográfica.

| Matéria (chave em `src/espera/temas.ts`) | Persona | Referência | Por que essa pessoa |
|---|---|---|---|
| `fisica_quimica` | **Prof. Átomo** (original) | Arquétipo do cientista genial: cabelo branco despenteado, bigode, jaleco, óculos na testa | Personagem próprio. Evita o licenciamento da imagem de Einstein (GreenLight / Universidade Hebraica de Jerusalém). |
| `matematica` | **Ada** | Ada Lovelace (1815–1852) | Matemática, autora do primeiro algoritmo publicado. Traz uma referência feminina às exatas. |
| `ciencias` | **Oswaldo** | Oswaldo Cruz (1872–1917) | Cientista brasileiro, referência em saúde pública e microbiologia. |
| `portugues` | **Machado** | Machado de Assis (1839–1908) | Maior referência da literatura brasileira; obra em domínio público. |
| `geografia` | **Humboldt** | Alexander von Humboldt (1769–1859) | Pai da geografia moderna; explorou a América do Sul. |
| `historia` | **Heródoto** | Heródoto (c. 484–425 a.C.) | "Pai da História". Não existe retrato real, então a aparência é livre. |
| `geral` (matéria não detectada) | **Lia** (original) | Educadora jovem e acolhedora | Persona neutra padrão; equilibra as personas masculinas. |

### Abordagem técnica

| Decisão | Motivo |
|---|---|
| **Manter three.js + `@pixiv/three-vrm` e o formato VRM 1.0** | O pipeline, o plano B 2D e a interface `ControladorAvatar` já existem. VRM 1.0 traz esqueleto humanoide e expressões padronizadas. |
| **Animações do Mixamo, convertidas para o esqueleto VRM** | Grátis e com uso comercial permitido quando a animação vai embutida num produto. O three-vrm tem exemplo oficial de conversão de FBX do Mixamo para VRM (`loadMixamoAnimation`). Um único pacote de clipes serve para todas as personas. |
| **`THREE.AnimationMixer` com transição suave (crossfade) + camadas procedurais** | O clipe cuida do corpo; olhar, piscada, respiração, boca e dedos são aplicados por cima, sem um apagar o outro. |
| **Modelos criados em Blender (+ add-on VRM), a partir de base livre ou encomendados** | Base possível: Microsoft Rocketbox (MIT, humanos com visemas e blendshapes ARKit). Alternativa: encomenda a um modelador com cessão de direitos. VRoid fica descartado porque gera estilo anime. |

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Correção de bugs de movimento:** (a) respiração e balanço da cabeça somam à pose, sem ser sobrescritos; (b) suavização independente do fps (`1 - exp(-k·delta)`); (c) o olhar alterna entre câmera e lousa (RF09 da spec anterior); (d) `apontarParaLousa` usa a posição real de `elementoAlvo` na tela. | P0 | CA01, CA02, CA09 |
| RF02 | **Biblioteca de clipes de animação** convertidos do Mixamo para VRM, guardados como `.vrma` (ou JSON de tracks) em `public/avatar/animacoes/`. Conjunto mínimo: 2 de repouso (respirando, troca de peso), 1 de escuta (aceno leve), 2 de pensando (mão no queixo, olhar ao redor), ≥ 5 de fala/explicação, 1 de apontar (lado e frente), 1 de cumprimento. Cada clipe é independente da persona. | P0 | CA03, CA04 |
| RF03 | **Mixer de animação:** cada estado (`idle`, `listening`, `thinking`, `speaking`) tem uma lista de clipes. A troca usa transição suave de 300–500 ms. Na fala, um clipe novo por frase, sorteado sem repetir o anterior (reaproveita `sortearProximoGesto`). Em repouso, variações a cada 6–12 s. Nunca há "salto" de pose. | P0 | CA03, CA04, CA05 |
| RF04 | **Camadas procedurais sobre o clipe:** olhar (`lookAt`), piscada, micro-movimentos de cabeça, respiração extra no peito e dedos de `contar-dedos` (1, 2, 3 conforme o item falado). Essas camadas somam ao clipe nos ossos que ele não usa ou com peso definido, sem apagá-lo. | P0 | CA02, CA06 |
| RF05 | **Lip sync por sílaba:** cada palavra é quebrada em sílabas aproximadas. As formas de boca (`aa`, `ih`, `ou`, `ee`, `oh` e boca fechada para `p`/`b`/`m`) são distribuídas ao longo da duração estimada da palavra, com transição suave. Quando a fala para, a boca fecha em ≤ 150 ms. | P0 | CA07, CA08 |
| RF06 | **Registro de personas** em `src/avatar3d/personas.ts`. Cada persona tem: `id`, nome exibido, matérias, caminho do modelo, ajuste de câmera, preferências de voz (gênero, `pitch`, `rate`), pesos de gestos e texto de crédito ("Inspirado em …"). | P0 | CA10 |
| RF07 | **Escolha automática de persona:** a matéria vem de `detectarTema` (`src/espera/temas.ts`); sem matéria detectada, mantém a persona atual (ou `geral` na primeira pergunta). A troca só acontece **entre** respostas, nunca no meio da fala: a persona atual sai com um gesto de despedida, a nova entra com transição de ≤ 600 ms e cumprimenta. | P0 | CA10, CA11 |
| RF08 | **Carregamento sob demanda:** só o `.vrm` da persona ativa é baixado. A próxima persona provável (mesma matéria da pergunta digitada) pode ser pré-carregada enquanto o tutor pensa. Modelos já carregados ficam em cache (máx. 2 em memória). Se o modelo novo falhar, a persona atual continua. | P0 | CA12, CA13 |
| RF09 | **Cientista original de química (Prof. Átomo):** modelo próprio no arquétipo do cientista genial. Não pode usar o nome, a assinatura nem traços que reproduzam o rosto de Albert Einstein, e precisa passar pela revisão de semelhança do RNF06. Gestos próprios: ajustar os óculos, contar nos dedos, "eureka" com o dedo para cima. | P0 | CA14 |
| RF10 | **Personas inspiradas em pessoas reais** (Ada, Oswaldo, Machado, Humboldt, Heródoto): versão estilizada, apresentada como "Inspirado em <nome> (<anos>)" num crédito discreto. O prompt do Gemini proíbe atribuir falas ou citações inventadas à pessoa real; a persona fala como tutor, não "encarnando" a pessoa. | P0 | CA15 |
| RF11 | **Voz por persona:** dentre as vozes pt-BR disponíveis, escolhe a mais adequada ao gênero da persona e aplica o `pitch`/`rate` dela. Se o aluno fixou uma voz em Configurações, a escolha dele prevalece. | P1 | CA16 |
| RF12 | **Configurações:** a opção "Professor" (Automático por matéria / persona fixa) fica salva no aparelho. A opção atual "Avatar 3D / 2D / Automático" continua igual. | P1 | CA17 |
| RF13 | **Matéria vinda do Gemini:** quando `detectarTema` não reconhece a matéria, o campo `materia` da resposta estruturada do Gemini (novo campo) é usado para a **próxima** troca de persona. | P1 | — |
| RF14 | **Substituir o modelo atual:** `public/avatar/tutor.vrm` (AvatarSample_B) sai do repositório e do APK. A persona `geral` (Lia) assume o papel de modelo padrão. | P0 | CA12 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Cada modelo de persona: ≤ 6 MB, ≤ 30 mil triângulos, ≤ 4 materiais, texturas ≤ 1024×1024, VRM 1.0 com esqueleto humanoide completo (com dedos) e as expressões `blink`, `aa`, `ih`, `ou`, `ee`, `oh`, `happy`, `relaxed`, `surprised`. | P0 | CA18 |
| RNF02 | Pacote de animações compartilhado ≤ 3 MB no total; baixado uma vez e reutilizado por todas as personas. | P0 | CA18 |
| RNF03 | Desempenho igual à spec anterior: ≥ 50 fps falando num Android intermediário, ≤ 30 fps em repouso, renderização parada em segundo plano. A troca de persona não congela a interface por mais de 100 ms (o parse do modelo não pode travar a thread principal de forma perceptível). | P0 | CA19 |
| RNF04 | Android: todos os modelos e animações vão no APK (funciona offline). Acréscimo total ≤ 45 MB em relação ao APK sem avatar. | P0 | CA20 |
| RNF05 | `prefers-reduced-motion: reduce`: mantém a decisão D03 da spec anterior (3D só com piscada e boca, sem clipes corporais amplos) e troca de persona sem animação de saída/entrada. | P0 | CA21 |
| RNF06 | **Direito de imagem e licenças:** cada persona tem em `public/avatar/CREDITOS.md` a referência usada, a licença do retrato de referência (domínio público), a data de morte (≥ 100 anos), o resultado da busca de marca no INPI e a licença do modelo 3D (autoral, MIT ou cessão). Antes de liberar, o Prof. Átomo passa por revisão de semelhança: 3 pessoas que não conhecem o projeto dizem se o personagem "é o Einstein"; se 2 ou mais disserem que sim, ele é redesenhado. | P0 | CA14, CA15 |
| RNF07 | Acessibilidade: o `aria-label` do canvas inclui o nome da persona ativa ("Tutor Machado, inspirado em Machado de Assis"); a troca de persona é anunciada em `#status-text`. | P1 | CA10 |
| RNF08 | Conteúdo adequado ao público escolar: roupas e acessórios sóbrios, sem orelhas de animal, decotes ou estética fetichizada; avaliação feita na revisão de design de cada modelo. | P0 | CA18 |

### Dependências técnicas

- `three`, `@pixiv/three-vrm` (já instalados). Novo: `@pixiv/three-vrm-animation` para clipes `.vrma`.
- Script de build `scripts/converter-mixamo.ts`: FBX do Mixamo → `.vrma`/JSON, usando o mapeamento de ossos Mixamo → VRM do exemplo oficial do three-vrm. Os FBX originais ficam fora do bundle.
- `src/avatar3d/` (mixer, camadas, personas), `src/avatar/gestos.ts` (sorteio sem repetição), `src/espera/temas.ts` (`detectarTema`), `src/voz/` (voz por persona), `src/gemini.ts` (campo `materia` e regra de não inventar citações), `src/configuracoes.ts` e `src/armazenamento.ts`.
- Specs anteriores: [DONE/2026-10-16_avatar-3d.md](DONE/2026-10-16_avatar-3d.md) e [DONE/2026-10-16_avatar-com-movimentos-humanos.md](DONE/2026-10-16_avatar-com-movimentos-humanos.md).

### Recursos necessários

- Conta Adobe gratuita para baixar as animações do Mixamo.
- **7 modelos VRM** (6 matérias + geral): design de personagem (2D, frente e perfil) aprovado pelo PO antes da modelagem, depois modelagem em Blender + add-on VRM a partir de base Rocketbox, ou encomenda com cessão de direitos patrimoniais por escrito.
- Retratos de referência em domínio público no Wikimedia Commons, para o modelador (ver URL Complementar).
- Busca de marca no INPI para os nomes "Ada Lovelace", "Oswaldo Cruz", "Machado de Assis", "Humboldt" e "Heródoto" nas classes 9 e 41.
- Android intermediário físico; 5 alunos para o teste de preferência; 3 pessoas para a revisão de semelhança do Prof. Átomo.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado o avatar em repouso, quando observado por 30 s, então há respiração visível no peito, micro-movimentos de cabeça e pelo menos uma variação de clipe de repouso, além das piscadas.
- [ ] **CA02:** Dado o avatar renderizando a 30 fps e depois a 60 fps, quando a mesma transição de estado acontece, então ela leva o mesmo tempo (± 50 ms) nas duas taxas.
- [ ] **CA03:** Dado uma resposta com 4 frases, quando o tutor fala, então cada frase começa com um clipe de gesto diferente do anterior e não há salto de pose (cada troca tem transição de 300–500 ms).
- [ ] **CA04:** Dado a sequência microfone → pergunta → resposta, quando os estados mudam, então o avatar passa por escuta (aceno) → pensando (clipe de pensar) → falando (clipes de explicação) → repouso, sempre com transição suave.
- [ ] **CA05 (negativo):** Dado que o aluno interrompe a fala, quando a fala é cancelada, então o clipe de fala para em ≤ 500 ms com transição para repouso, e o avatar **não** continua gesticulando.
- [ ] **CA06:** Dado uma frase com enumeração ("primeiro…, segundo…, terceiro…"), quando o tutor fala, então os dedos da mão mostram 1, 2 e 3 em sequência.
- [ ] **CA07:** Dado o tutor dizendo "pão, bola e mapa", quando cada palavra é falada, então a boca fecha visivelmente em P, B e M e abre com formas diferentes nas vogais.
- [ ] **CA08 (negativo):** Dado o fim ou o cancelamento da fala, quando 150 ms se passam, então a boca está fechada.
- [ ] **CA09:** Dado um item novo na lousa, quando ele aparece, então o avatar olha e aponta para a posição real do elemento (desktop: ao lado; mobile: abaixo) e volta a olhar para o aluno depois de ~1,5 s.
- [ ] **CA10:** Dado a pergunta "como balancear uma equação química?", quando o tutor responde, então a persona ativa é o Prof. Átomo, e `#status-text` e o `aria-label` mostram o nome dele.
- [ ] **CA11:** Dado que o Prof. Átomo está falando e o aluno faz uma pergunta de português, quando a nova resposta começa, então a troca para Machado acontece só depois do fim da fala anterior, com saída e entrada animadas em ≤ 600 ms, sem quadro vazio.
- [ ] **CA12:** Dado a página aberta com a aba Rede, quando o aluno faz uma pergunta de geografia, então só o modelo `geral` e o de Humboldt foram baixados, e `tutor.vrm` (AvatarSample_B) **não** existe mais no build.
- [ ] **CA13 (erro):** Dado que o modelo de uma persona retorna 404, quando a troca seria feita, então a persona atual continua respondendo, sem erro visível ao aluno.
- [ ] **CA14:** Dado o modelo do Prof. Átomo, quando passa pela revisão de semelhança do RNF06, então no máximo 1 de 3 pessoas o identifica como Einstein, e nenhum arquivo, texto ou metadado do app usa o nome "Einstein".
- [ ] **CA15:** Dado uma persona inspirada em pessoa real, quando o aluno pede "diga uma frase do Machado de Assis", então o tutor só cita trechos reais da obra (com o título) ou diz que não tem a citação; ele **não** inventa citações.
- [ ] **CA16:** Dado um dispositivo com vozes pt-BR masculina e feminina, quando a persona Ada fala, então a voz é feminina; quando Oswaldo fala, a voz é masculina; com voz fixada pelo aluno, a voz fixada é usada.
- [ ] **CA17:** Dado que o aluno fixa "Machado" em Configurações, quando pergunta sobre matemática, então Machado responde e nenhum outro modelo é baixado.
- [ ] **CA18:** Dado cada `.vrm` em `public/avatar/personas/` e o pacote de animações, quando o script de validação roda, então todos cumprem o RNF01/RNF02 e o `CREDITOS.md` tem uma entrada completa para cada persona.
- [ ] **CA19:** Dado um Android intermediário, quando o tutor fala uma resposta de 4 frases e depois troca de persona, então mantém ≥ 50 fps na fala e nenhuma trava > 100 ms na troca.
- [ ] **CA20:** Dado o app Android em modo avião, quando o aluno pergunta sobre química e depois história, então as duas personas carregam; o APK cresceu ≤ 45 MB.
- [ ] **CA21:** Dado o sistema com "reduzir movimento" ativo, quando o tutor fala e troca de persona, então só piscada e boca se mexem e a troca é imediata (sem animação).

## O que a atividade não inclui

- Usar o nome ou a imagem de Albert Einstein ou de qualquer pessoa morta há menos de 100 anos (ex.: Marie Curie, †1934): motivo: risco de direito de imagem/licenciamento e custo.
- Modelos fotorrealistas ou gerados a partir de foto (Avaturn, MetaHuman): motivo: pesados para celular, "vale da estranheza" e risco maior de parecer uma réplica da pessoa real.
- Lip sync por visemas com tempo exato vindo de TTS em nuvem (Azure, Google): motivo: exige trocar o motor de voz e tem custo por uso; a abordagem por sílaba é a melhor disponível com a Web Speech API.
- Personas separadas para Física e Química: motivo: o app hoje trata as duas como uma matéria (`fisica_quimica`); fica para o futuro.
- Cenário 3D (sala de aula) e câmera livre: motivo: baixo impacto didático (mesmo motivo da spec anterior).
- Aluno criar ou customizar o próprio avatar: motivo: prematuro.

### Considerado para o futuro (P2)

- Separar Física (ex.: persona inspirada em Isaac Newton ou Galileu) de Química.
- Personas alternativas por matéria (escolha entre uma referência feminina e uma masculina).
- Visemas reais com TTS em nuvem que forneça tempos de fonemas.
- Emoção vinda da resposta do Gemini (campo `emocao`) escolhendo clipes e expressões.
- Gestos ligados a palavras-chave (ex.: "aumenta" → mãos subindo).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | As personas da tabela estão aprovadas? Alternativas: História → Dom Pedro II (†1891, mais conhecido dos alunos, porém figura política); Matemática → Pitágoras ou Euler; Química → Lavoisier (†1794) em vez do cientista original. | PO | Sim | |
| D02 | Quem produz os 7 modelos: alguém do time em Blender sobre base Rocketbox, ou encomenda a modelador (custo e prazo)? | PO | Sim | |
| D03 | Estilo visual: cartoon estilizado tipo animação 3D (recomendado) ou semi-realista? | PO / design | Sim | |
| D04 | Entrega em fases? Sugestão: fase 1 = RF01–RF05 + Lia + Prof. Átomo; fase 2 = demais personas. | PO / dev | Não | |
| D05 | O nome "Prof. Átomo" está bom ou o PO prefere outro? | PO | Não | |
| D06 | A busca no INPI encontrou marca registrada para algum dos nomes? Se sim, a persona usa só o primeiro nome ou é trocada. | dev | Sim (para liberar) | |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Respiração não é sobrescrita | unit | CA01 | Atualizar o avatar (VRM falso) em 2 instantes de repouso; ler a rotação do osso `chest` | Rotações diferentes, oscilando em torno da pose |
| CT02 | Suavização independente do fps | unit | CA02 | Simular a mesma transição com delta de 1/30 e 1/60 s | Mesmo valor final no mesmo tempo (± 50 ms) |
| CT03 | Sorteio de clipes sem repetição | unit | CA03 | Pedir 20 clipes de fala em sequência | Nenhum clipe igual ao anterior |
| CT04 | Fluxo de estados | manual | CA04, CA05 | Microfone → pergunta → resposta → interromper | Clipes certos e transição suave; para ao interromper |
| CT05 | Contar nos dedos | manual | CA06 | Pergunta que gere enumeração de 3 itens | Dedos mostram 1, 2, 3 |
| CT06 | Sílabas e boca fechada | unit | CA07 | Quebrar "pão", "bola", "mapa", "fotossíntese" | Sequências de formas de boca com fechamento em P/B/M |
| CT07 | Boca fecha ao parar | unit | CA08 | Chamar `pararFala()` e avançar 150 ms | Todas as expressões de boca em 0 |
| CT08 | Apontar para a posição real | manual | CA09 | Lousa no desktop e em 375 px | Braço e olhar na direção do item |
| CT09 | Matéria → persona | unit | CA10 | `detectarTema` + resolver persona para perguntas de cada matéria e uma sem matéria | Persona esperada; sem matéria mantém a atual |
| CT10 | Troca só entre respostas | e2e | CA11 | Fazer pergunta de português durante a fala do Prof. Átomo | Troca após a fala, ≤ 600 ms, sem quadro vazio |
| CT11 | Download só do necessário | e2e | CA12 | Aba Rede; pergunta de geografia | Só `geral` e Humboldt baixados; sem `tutor.vrm` |
| CT12 | Modelo de persona 404 | e2e | CA13 | Mock 404 no modelo de Machado; pergunta de português | Persona atual responde; sem erro visível |
| CT13 | Revisão de semelhança | manual | CA14 | Mostrar o Prof. Átomo a 3 pessoas sem contexto; `grep -ri einstein` no repo | ≤ 1 identifica; grep vazio no app |
| CT14 | Sem citações inventadas | manual | CA15 | Pedir frases de Machado, Ada e Oswaldo | Só citações reais com fonte, ou recusa educada |
| CT15 | Voz por persona | manual | CA16 | Edge com vozes pt-BR; Ada e Oswaldo; depois voz fixada | Gênero correto; voz fixada prevalece |
| CT16 | Persona fixa | e2e | CA17 | Fixar Machado; pergunta de matemática | Machado responde; nenhum outro modelo baixado |
| CT17 | Validação dos assets | integração | CA18 | Script que lê cada `.vrm`, o pacote de animações e `CREDITOS.md` | Limites do RNF01/RNF02 e créditos completos |
| CT18 | Desempenho Android | manual | CA19 | Android intermediário; contador de fps em debug; resposta + troca | ≥ 50 fps; sem trava > 100 ms |
| CT19 | Offline Android | manual | CA20 | Modo avião; química e história; comparar tamanho do APK | Ambas carregam; APK +≤ 45 MB |
| CT20 | Reduzir movimento | manual | CA21 | Ativar no sistema; fala e troca de persona | Só piscada/boca; troca imediata |
| CT21 | Preferência dos alunos | manual | — | 5 alunos usam o avatar atual e o novo (ordem alternada) | ≥ 4 preferem o novo |

## URL Complementar

- Documentação técnica: [three-vrm](https://github.com/pixiv/three-vrm) (inclui o exemplo de Mixamo → VRM e `three-vrm-animation`) · [Especificação VRM 1.0](https://vrm.dev/en/) · [Mixamo](https://www.mixamo.com) · [Microsoft Rocketbox (MIT)](https://github.com/microsoft/Microsoft-Rocketbox) · [Blender VRM add-on](https://vrm-addon-for-blender.info/)
- Protótipo / mockup: N/A, depende de D01–D03 (design 2D das personas).
- Discussões relacionadas: [DONE/2026-10-16_avatar-3d.md](DONE/2026-10-16_avatar-3d.md) · [DONE/2026-10-16_avatar-com-movimentos-humanos.md](DONE/2026-10-16_avatar-com-movimentos-humanos.md) · [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md)
- Referências de design (retratos em domínio público no Wikimedia Commons, a confirmar a licença de cada arquivo): [Ada Lovelace](https://commons.wikimedia.org/wiki/Category:Ada_Lovelace) · [Oswaldo Cruz](https://commons.wikimedia.org/wiki/Category:Oswaldo_Cruz) · [Machado de Assis](https://commons.wikimedia.org/wiki/Category:Machado_de_Assis) · [Alexander von Humboldt](https://commons.wikimedia.org/wiki/Category:Alexander_von_Humboldt) · [Heródoto](https://commons.wikimedia.org/wiki/Category:Herodotus)
- Direito de imagem: licenciamento de Einstein pela GreenLight / Universidade Hebraica de Jerusalém ([Discover](https://www.discovermagazine.com/the-sciences/in-death-einstein-makes-more-money-than-john-lennon), [Techdirt](https://www.techdirt.com/2010/05/27/university-sues-gm-for-using-einstein-in-an-ad-without-paying-up/)) · Código Civil, art. 20, parágrafo único (proteção da imagem de pessoa falecida).
- Requisitos originais: pedido do PO em 2026-10-23: "queria que ele se movesse mais e fosse mais humano, tipo pra química usar Einstein" e "pegar pessoas referências nas áreas que sejam públicas e sem custo para usar nas outras matérias".
- Issue / PR relacionado: N/A, a ser criado.
