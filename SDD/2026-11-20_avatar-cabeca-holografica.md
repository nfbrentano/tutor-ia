# [UI] Avatar como Cabeça Holográfica Flutuante num Tubo de Energia

> **Status:** Em andamento
> **Autor:** Natanael Brentano (com apoio de IA) · **Revisor:** · **Criada em:** 2026-11-20 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Trocar a apresentação do tutor de "personagem de meio corpo com braços" para **apenas uma cabeça grande, flutuando dentro de um tubo de luz**, no visual clássico de "mentor holográfico" de séries de ficção científica dos anos 90 (cabeça gigante translúcida que orienta a equipe). Vale para o avatar 3D (VRM) e para o plano B em SVG.
- **Problema e evidência:** Os modelos VRM das personas são gerados por script (`scripts/gerar-personas-vrm.ts`) e o corpo low-poly (braços, mãos, dedos) é a parte que mais denuncia o acabamento simples; gestos de braço competem visualmente com a lousa. No SVG, o robô de corpo inteiro ocupa o palco sem ajudar na conversa. O pedido do produto é um tutor que seja "só uma cabeça", no estilo do mentor holográfico.
- **Impacto de não fazer:** O avatar continua com aparência de boneco genérico; o foco da criança se divide entre rosto, braços e lousa.
- **Para quem é destinado:** Estudantes do ensino fundamental e médio que usam `tutor.html` (desktop e celular).
- **História de usuário:** Como estudante, quero conversar com um mentor holográfico expressivo, para sentir que tenho um guia "de outro mundo" me ajudando sem distrações.
- **Como saberemos que deu certo:** Em todas as 7 personas e no SVG, nenhum pixel de tronco, braço ou mão aparece em nenhum estado (repouso, ouvindo, pensando, falando, apontando, cumprimentando); boca, piscadas e expressões continuam sincronizadas; 0 erros no console; testes existentes continuam passando.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | O avatar 3D enquadra apenas a cabeça (queixo ao topo do cabelo), ocupando a maior parte da largura do tubo. | P0 | CA01 |
| RF02 | Nada abaixo do pescoço é renderizado: o pescoço se dissolve num degradê pontilhado (efeito de projeção) e braços/mãos nunca aparecem, mesmo quando um clipe ou gesto levanta a mão até o rosto. | P0 | CA02, CA03 |
| RF03 | Material holográfico na cabeça: brilho de borda (fresnel) e linhas de varredura tingidos com `corTema` da persona, preservando as cores do rosto o suficiente para reconhecer a persona. | P0 | CA04 |
| RF04 | A cabeça flutua (sobe/desce suave) e oscila levemente; com `prefers-reduced-motion: reduce`, fica parada e sem cintilação. | P1 | CA05 |
| RF05 | Tubo de energia em CSS atrás e na frente do canvas (coluna de luz, reflexo de vidro, anéis de base e topo), com intensidade por estado: ouvindo, pensando e falando têm aparência distinta. | P0 | CA06 |
| RF06 | "Apontar para a lousa" vira **olhar/virar a cabeça** para o item da lousa (sem braço). | P0 | CA07 |
| RF07 | O plano B (SVG) também é só uma cabeça flutuante dentro do mesmo tubo, mantendo boca, olhos, sobrancelhas e piscadas. | P0 | CA08 |
| RF08 | Troca de persona, lip sync, piscadas e expressões (RF05–RF10 da spec do avatar 3D) continuam funcionando. | P0 | CA09 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Sem custo extra perceptível: o shader holográfico é injetado via `onBeforeCompile` no material existente (sem passes de pós-processamento); FPS-alvo do avatar 3D inalterado (30 repouso / 60 fala). | P0 | CA10 |
| RNF02 | Sem assets novos: os `.vrm` atuais são reaproveitados; nenhuma dependência nova. | P0 | — |
| RNF03 | Contraste do texto de status e dos controles inalterado (WCAG AA); o tubo é decorativo (`aria-hidden`). | P1 | CA06 |
| RNF04 | Layout mobile (largura ≥ 360 px) sem rolagem horizontal; tubo e cabeça cabem no palco. | P0 | CA11 |

### Dependências técnicas

- `src/avatar3d/avatar3d.ts` (enquadramento, material, ocultação do corpo, olhar).
- `tutor.html` (SVG do plano B e elementos do tubo) e `src/styles/tutor.css`.
- Specs concluídas: `SDD/DONE/2026-10-16_avatar-3d.md`, `SDD/DONE/2026-10-23_avatar-personas-por-materia.md`.

### Recursos necessários

- Nenhum asset novo; navegador com WebGL para validar o 3D e um sem WebGL (ou `modo 2D` em Configurações) para validar o SVG.

## Critérios de Aceitação / Entregas

- [x] **CA01:** Dado que o avatar 3D carregou, quando a tela do tutor é exibida, então só a cabeça da persona aparece, centralizada no tubo, ocupando ≥ 60% da largura do palco do avatar.
- [x] **CA02:** Dado qualquer persona, quando o avatar está em repouso, então nenhum vértice de tronco, ombro ou braço é visível e o pescoço termina num degradê pontilhado.
- [x] **CA03:** Dado que a persona toca um clipe que leva a mão ao queixo (`pensando-queixo`) ou acena (`cumprimentar-aceno`), quando o clipe está no ponto máximo, então nenhuma mão ou dedo aparece na tela.
- [x] **CA04:** Dado que a persona ativa é o Prof. Átomo (`#a855f7`), quando a cabeça é renderizada, então a borda e as linhas de varredura têm tom roxo; ao trocar para Oswaldo (`#10b981`), passam a verde.
- [x] **CA05:** Dado `prefers-reduced-motion: reduce`, quando o avatar está em qualquer estado, então a cabeça não flutua, não oscila e não cintila.
- [x] **CA06:** Dado que o estado muda para ouvindo/pensando/falando, quando o tubo é exibido, então a cor/intensidade do tubo muda de acordo com o estado e o tubo não recebe foco nem é lido por leitor de tela.
- [x] **CA07:** Dado que a lousa destaca um item durante a fala, quando o tutor "aponta" para ele, então a cabeça vira e os olhos olham na direção do item, sem nenhum braço aparecer.
- [x] **CA08:** Dado o modo 2D (ou WebGL indisponível), quando o tutor é exibido, então o SVG mostra apenas a cabeça flutuante no tubo, com boca sincronizada à fala e piscadas.
- [x] **CA09:** Dado que o tutor está falando, quando a fala termina e a matéria muda, então a persona é trocada após a fala (comportamento atual preservado) e o novo rosto aparece no mesmo enquadramento.
- [x] **CA10:** Dado o avatar 3D em repouso por 30 s, quando o console é inspecionado, então não há erros nem avisos de shader/WebGL.
- [x] **CA11:** Dado uma tela de 375×812 px, quando o tutor é aberto, então tubo, cabeça, status e microfone cabem sem rolagem horizontal.
- [x] **CA12 (negativo):** Dado o avatar 3D, quando qualquer gesto de fala é sorteado, então não deve surgir nenhuma parte do corpo além de cabeça e pescoço.

## O que a atividade não inclui

- Gerar novos `.vrm` só de cabeça: motivo: os modelos atuais funcionam com o corte por shader; regenerar fica para quando houver modelagem dedicada.
- Remover o código de gestos de braço, dedos e clipes de corpo: motivo: os clipes continuam movendo pescoço/tronco (balanço natural da cabeça) e o gravador de gestos depende deles; o corpo apenas não é desenhado.
- Distorção/"ondulação" de vídeo em tempo real na cabeça (pós-processamento): motivo: custo de GPU em celulares de entrada.

### Considerado para o futuro (P2)

- Opção em Configurações para voltar ao avatar de meio corpo (a ocultação está isolada numa flag `apenasCabeca` do `Avatar3DConfig`).
- Partículas subindo dentro do tubo em WebGL.

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | A cabeça deve ser totalmente translúcida (mais "fantasma") ou opaca com brilho? | PO | Não | Opaca com brilho de borda e varredura: preserva leitura de expressões para crianças. |
| D02 | O gravador de gestos (dev) continua útil sem braços visíveis? | PO/dev | Não | Mantido; os clipes ainda movem cabeça e pescoço. Reavaliar depois. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Config padrão do avatar 3D | unit | CA01, CA02 | Ler `CONFIG_AVATAR_3D_PADRAO` | `apenasCabeca === true` |
| CT02 | Enquadramento da cabeça | manual/e2e | CA01 | Abrir `tutor.html` com WebGL | Só a cabeça aparece, centralizada |
| CT03 | Clipes com mão no rosto | manual | CA03, CA12 | Forçar `pensando` e trocar persona (dispara cumprimento) | Nenhuma mão visível |
| CT04 | Cor por persona | manual | CA04 | Trocar matéria para Física e depois Ciências | Brilho roxo → verde |
| CT05 | Movimento reduzido | manual | CA05 | Emular `prefers-reduced-motion` | Cabeça parada, sem cintilação |
| CT06 | SVG só cabeça | unit + manual | CA08 | Verificar que `tutor.html` não tem tronco/braços no SVG; abrir em modo 2D | Apenas cabeça; boca anima |
| CT07 | Mobile | manual | CA11 | Viewport 375×812 | Sem rolagem horizontal |
| CT08 | Apontar = olhar | manual | CA07 | Pergunta que gera lousa com etapas | Cabeça vira para a lousa |
| CT09 | Regressão | unit | CA09, CA10 | `npm test` e `npm run typecheck` | Tudo passa |

## URL Complementar

- Documentação técnica: [three.js `Material.onBeforeCompile`](https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile), [three-vrm](https://github.com/pixiv/three-vrm)
- Protótipo / mockup: N/A — validado direto no navegador.
- Discussões relacionadas: pedido do produto em 2026-11-20 ("avatar só uma cabeça, estilo mentor holográfico").
- Referências de design: arquétipo do "mentor holográfico em tubo de energia" (sem reproduzir personagem, marca ou arte de terceiros).
- Requisitos originais: `SDD/DONE/2026-10-16_avatar-3d.md`, `SDD/DONE/2026-10-23_avatar-personas-por-materia.md`.
- Issue / PR relacionado: branch `feat/avatar-cabeca-holografica`.
