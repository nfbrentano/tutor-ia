# [FEAT] Lousa de apoio visual ao lado do tutor

> **Status:** Em andamento
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-16 · **Atualizada em:** 2026-10-16

## Detalhes da Atividade

- **O que precisa ser feito:** Criar uma pequena lousa ao lado do avatar que se abre durante a explicação e mostra recursos visuais: imagens, fórmulas, passo a passo, listas, tabelas e desenhos simples. Cada item aparece no momento da fala a que se refere, como um professor escrevendo no quadro.
- **Problema e evidência:** Hoje o único recurso visual é uma imagem opcional (`imagem_url`) mostrada num pop-up (`showMediaPopup`, `index.html:1688`). Problemas:
  - A URL é inventada pelo modelo (`SYSTEM_PROMPT`, `index.html:1214-1220`) e muitas vezes não existe. Nesse caso o pop-up fecha sozinho (`onerror`, `index.html:1694`) e o aluno fica sem nada.
  - Conteúdos que dependem de escrita (contas, equações, etapas, tabelas) só existem no texto falado, e não dá para "ver" a resolução.
  - A imagem aparece de uma vez, sem relação com o momento da fala.
- **Impacto de não fazer:** Explicações de Matemática, Física e Química ficam difíceis de acompanhar só ouvindo, e o aluno que aprende melhor vendo fica para trás.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio, principalmente em conteúdos com cálculo, diagrama ou processo em etapas.
- **História de usuário:** Como aluno, quero que o tutor abra uma lousa ao lado dele e vá escrevendo e mostrando imagens enquanto explica, para entender a matéria vendo, e não só ouvindo.
- **Como saberemos que deu certo:**
  - Em um conjunto de 20 perguntas de referência (5 de Matemática, 5 de Ciências, 5 de História/Geografia e 5 de Português), ≥ 80% das respostas trazem pelo menos 1 item útil na lousa.
  - Nenhuma imagem quebrada fica visível.
  - Os itens aparecem no máximo 1 s antes ou depois do trecho falado correspondente.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | Painel "lousa" na área do avatar (à direita dele no desktop, abaixo no mobile), fechado por padrão. Abre com animação quando a resposta tem conteúdo visual e pode ser fechado/minimizado pelo aluno. | P0 | CA01, CA02, CA10 |
| RF02 | Novo formato de resposta do modelo, com a explicação dividida em **etapas**, cada uma com a fala e, opcionalmente, um item de lousa. Exemplo: `{"etapas":[{"fala":"...","lousa":{"tipo":"formula","conteudo":"2x + 3 = 7"}}]}`. O `SYSTEM_PROMPT` e o parser (`index.html:1581-1595`) são atualizados, e o formato antigo `{texto, imagem_url}` continua aceito. | P0 | CA03, CA09 |
| RF03 | Tipos de item suportados: `texto` (título/destaque), `formula` (expressão em texto, com sobrescrito/subscrito simples, ex.: `x^2`, `H_2O`), `passos` (lista numerada), `lista`, `tabela` (cabeçalho + linhas) e `imagem` (termo de busca + legenda). | P0 | CA04 |
| RF04 | Sincronização com a fala: cada etapa é falada como um `SpeechSynthesisUtterance` separado e o item de lousa daquela etapa aparece no `onstart` da etapa, com efeito de "escrita" (aparecer progressivamente) de até 600 ms. Itens anteriores continuam visíveis (acumulam), com rolagem automática para o mais recente. | P0 | CA05 |
| RF05 | Imagens por busca, não por URL inventada: o modelo envia um **termo de busca** e o app busca uma imagem real em fonte aberta (Wikimedia Commons API, que dispensa chave e aceita CORS), mostrando a legenda e o crédito/licença. Se nada for encontrado ou a imagem falhar, o item é omitido sem deixar espaço quebrado. | P0 | CA06, CA07 |
| RF06 | Tipo `desenho`: SVG simples gerado pelo modelo (retas, círculos, setas, rótulos) para gráficos e esquemas. O SVG é sanitizado (permitir só `svg, g, line, rect, circle, ellipse, path, polyline, polygon, text`; remover `script`, `foreignObject`, atributos `on*` e `href` externo). | P1 | CA08 |
| RF07 | Clicar num item de imagem abre o lightbox existente (`index.html:1115`). | P1 | CA11 |
| RF08 | Cada balão do tutor no chat ganha um botão "Ver na lousa" que reabre a lousa com os itens daquela resposta. Substitui o "Ver Ilustração Didática". | P1 | CA12 |
| RF09 | Expor um evento `lousa:item-exibido` com o elemento exibido, para o avatar apontar (ver [2026-10-16_avatar-com-movimentos-humanos.md](2026-10-16_avatar-com-movimentos-humanos.md), RF07). | P0 | CA13 |
| RF10 | Ao chegar uma nova pergunta, a lousa é limpa ("apagada") antes dos novos itens. | P0 | CA14 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Implementada como módulo TypeScript `lousa/` na estrutura de [2026-10-16_multipaginas-typescript-e-android.md](2026-10-16_multipaginas-typescript-e-android.md), sem bibliotecas de renderização externas; funciona igual na web e no Android. A única chamada externa nova é a API pública da Wikimedia. | P0 | — |
| RNF02 | Segurança: todo conteúdo vindo do modelo é inserido com `textContent` ou SVG sanitizado; nunca via `innerHTML` sem sanitizar. | P0 | CA08 |
| RNF03 | Busca de imagem com tempo limite de 4 s; a fala não espera pela imagem. | P0 | CA07 |
| RNF04 | Acessibilidade: lousa com `role="region"` e `aria-label="Lousa"`, novos itens anunciados via `aria-live="polite"`, imagens com `alt` (a legenda), contraste WCAG AA. | P1 | — |
| RNF05 | Responsivo: em ≤ 980 px a lousa fica abaixo do avatar; em 375 px de largura, sem rolagem horizontal (tabelas largas rolam dentro do próprio item). | P0 | CA10 |
| RNF06 | Máximo de 8 itens por resposta (instrução no prompt + corte no parser), para a lousa não virar um texto longo. | P1 | — |

### Dependências técnicas

- [2026-10-16_multipaginas-typescript-e-android.md](2026-10-16_multipaginas-typescript-e-android.md) concluída antes (base TS + Capacitor).
- `callGeminiApi()` (`index.html:1530-1606`): prompt, `responseMimeType` e parser. Avaliar `responseSchema` do Gemini para garantir o formato.
- `processQuestion()` (`index.html:1611-1644`) e `speakExplanation()` (`index.html:1379-1418`): falar por etapas em vez de um texto único.
- Pop-up atual `#media-popup` (`index.html:1094-1110`): será substituído pela lousa.
- API da Wikimedia Commons (`https://commons.wikimedia.org/w/api.php`, `action=query&generator=search&prop=imageinfo&origin=*`).

### Recursos necessários

- Lista das 20 perguntas de referência para validar a métrica de sucesso.
- Design da lousa (visual de quadro verde/branco ou "cartão" no tema atual). Ver D01.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que o aluno pergunta "como resolver 2x + 3 = 7?", quando a resposta chega, então a lousa abre ao lado do avatar.
- [ ] **CA02:** Dado que a resposta não tem nenhum item de lousa (ex.: "obrigado!"), quando ela chega, então a lousa continua fechada.
- [ ] **CA03:** Dado que o modelo responde no novo formato de etapas, quando a resposta é processada, então cada etapa é falada em ordem e o texto completo aparece no balão do chat.
- [ ] **CA04:** Dado uma resposta com itens dos tipos `texto`, `formula`, `passos`, `lista`, `tabela` e `imagem`, quando eles são exibidos, então cada um aparece com o visual próprio do seu tipo (ex.: `x^2` aparece com o 2 sobrescrito).
- [ ] **CA05:** Dado uma resposta com 3 etapas, cada uma com item de lousa, quando o tutor começa a falar cada etapa, então o item correspondente aparece com efeito de escrita, os itens anteriores continuam visíveis e nada aparece antes da hora.
- [ ] **CA06:** Dado um item `imagem` com termo "célula animal", quando a busca encontra resultado, então a lousa mostra a imagem com legenda e crédito/licença.
- [ ] **CA07:** Dado um item `imagem` sem resultado, ou cuja busca passa de 4 s, quando a etapa é exibida, então o item é omitido sem ícone de imagem quebrada e a fala segue normalmente.
- [ ] **CA08 (negativo):** Dado que o modelo retorna um `desenho` contendo `<script>` ou `onload="..."`, quando o item é exibido, então o código não é executado e só as formas permitidas são desenhadas.
- [ ] **CA09:** Dado que o modelo retorna o formato antigo `{texto, imagem_url}` ou texto não-JSON, quando a resposta é processada, então o tutor fala o texto normalmente e a lousa não quebra a aplicação.
- [ ] **CA10:** Dado uma tela de 375 px, quando a lousa abre, então ela fica abaixo do avatar e sem rolagem horizontal da página.
- [ ] **CA11:** Dado uma imagem na lousa, quando o aluno clica nela, então ela abre em tela cheia no lightbox.
- [ ] **CA12:** Dado que o aluno já fez duas perguntas, quando clica em "Ver na lousa" no balão da primeira, então a lousa mostra os itens da primeira resposta.
- [ ] **CA13:** Dado que um item é exibido na lousa, quando ele aparece, então o evento `lousa:item-exibido` é disparado com o elemento correspondente.
- [ ] **CA14:** Dado que a lousa tem itens de uma resposta anterior, quando o aluno faz uma nova pergunta, então a lousa é apagada antes dos novos itens aparecerem.
- [ ] **CA15:** Dado que o aluno fechou a lousa, quando chega uma nova resposta com conteúdo visual, então a lousa abre de novo.

## O que a atividade não inclui

- Aluno escrever/desenhar na lousa: motivo: outra iniciativa; muda a interação (entrada do aluno).
- Renderização LaTeX completa (KaTeX/MathJax): motivo: exige dependência externa; sobrescrito/subscrito simples cobre o Ensino Fundamental e boa parte do Médio.
- Vídeos, animações e simulações interativas: motivo: complexo demais agora.
- Geração de imagem por IA: motivo: custo, latência e risco de imagens imprecisas em conteúdo didático.
- Histórico de conversa enviado ao modelo: motivo: outra iniciativa (hoje cada pergunta é isolada).

### Considerado para o futuro (P2)

- Fórmulas em LaTeX com KaTeX (manter `formula` como tipo próprio facilita a troca).
- Gráficos de função (`tipo: "grafico"` com expressão e intervalo).
- Exportar a lousa da resposta como imagem/PDF para estudo.
- Outras fontes de imagem (ex.: banco curado por disciplina).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Visual da lousa: quadro verde com "giz", quadro branco ou cartão no tema escuro atual? | design / PO | Não | Sugestão: quadro escuro com traço claro, que combina com o tema atual. |
| D02 | A lousa fica ao lado do avatar (dentro da coluna da esquerda) ou ocupa o lugar do chat enquanto aberta? | PO / design | Sim | Sugestão: dentro da coluna do avatar, avatar à esquerda e lousa à direita. |
| D03 | O modelo `gemini-3.5-flash-lite` segue o formato de etapas de forma confiável, ou é preciso usar `responseSchema`/modelo maior? | dev | Não | Validar com as 20 perguntas de referência. |
| D04 | É aceitável depender da Wikimedia Commons (disponibilidade, imagens nem sempre didáticas)? | PO | Não | |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Abre com conteúdo visual | e2e | CA01 | Perguntar "como resolver 2x + 3 = 7?" | Lousa abre com os passos |
| CT02 | Não abre sem conteúdo | e2e | CA02 | Digitar "obrigado!" | Lousa permanece fechada |
| CT03 | Parser do novo formato | unit | CA03, CA09 | Passar ao parser JSON de etapas, JSON antigo, texto puro e JSON inválido | Etapas corretas nos dois formatos; texto puro e JSON inválido viram uma etapa só de fala |
| CT04 | Renderização por tipo | unit | CA04 | Renderizar um item de cada tipo | Elemento HTML esperado por tipo; `x^2` → `x<sup>2</sup>` |
| CT05 | Sincronização | manual | CA05 | Pergunta de 3 etapas; observar | Cada item surge no início da etapa falada |
| CT06 | Imagem encontrada | integração | CA06 | Item `imagem` "célula animal" | Imagem + legenda + crédito |
| CT07 | Imagem não encontrada / lenta | integração | CA07 | Termo "xqzwv123"; e simular rede lenta (DevTools, Slow 3G) | Item omitido; fala não trava |
| CT08 | SVG malicioso | unit | CA08 | Sanitizar `<svg><script>alert(1)</script><circle onload="alert(1)" r="5"/></svg>` | Sem script nem `onload`; círculo desenhado; nenhum alerta |
| CT09 | Mobile | manual | CA10 | DevTools 375 px, pergunta com tabela | Lousa abaixo do avatar; tabela rola dentro do item |
| CT10 | Lightbox | manual | CA11 | Clicar numa imagem da lousa | Abre em tela cheia |
| CT11 | Reabrir lousa antiga | e2e | CA12 | Duas perguntas; "Ver na lousa" na primeira | Itens da primeira resposta |
| CT12 | Evento para o avatar | unit | CA13 | Escutar `lousa:item-exibido` e exibir item | Evento recebido com o elemento |
| CT13 | Apagar ao perguntar de novo | e2e | CA14, CA15 | Fechar a lousa, fazer nova pergunta visual | Lousa reabre só com os itens novos |
| CT14 | Métrica de cobertura | manual | — | Rodar as 20 perguntas de referência | ≥ 16 com ao menos 1 item útil; 0 imagens quebradas |

## URL Complementar

- Documentação técnica: [Gemini API: structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [MediaWiki API: imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo) · [SpeechSynthesisUtterance (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)
- Protótipo / mockup: N/A, ainda não existe; ver D01/D02.
- Discussões relacionadas: [2026-10-16_avatar-com-movimentos-humanos.md](2026-10-16_avatar-com-movimentos-humanos.md) (gesto de apontar para a lousa).
- Referências de design: pop-up atual `#media-popup` em `tutor-ia/index.html:1094-1110`.
- Requisitos originais: pedido do PO em 2026-10-16: "abra uma pequena lousa do lado para mostrar imagens e outros recursos visuais".
- Issue / PR relacionado: N/A, a ser criado.
