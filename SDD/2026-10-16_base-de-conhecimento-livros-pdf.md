# [FEAT] Base de conhecimento local a partir de livros em PDF

> **Status:** Rascunho
> **Autor:** Natanael Brentano · **Revisor:** · **Criada em:** 2026-10-16 · **Atualizada em:** 2026-10-16

## Detalhes da Atividade

- **O que precisa ser feito:** Usar livros didáticos em PDF, guardados no projeto, como base para o tutor:
  1. Antes do build, um script lê os PDFs, divide em trechos e gera um índice de busca local.
  2. A cada pergunta, o app busca no próprio aparelho os trechos mais relevantes e manda só esses trechos ao Gemini. Assim o modelo explica conforme o livro e cita a página.
  3. Perguntas frequentes de cada capítulo têm resposta pronta em cache e são respondidas na hora, sem chamar a API.
  4. Figuras dos livros podem aparecer na lousa.
- **Problema e evidência:** Hoje `callGeminiApi()` (`src/gemini.ts`) manda só a pergunta. A resposta depende inteiramente do conhecimento geral do modelo e pode usar termos, ordem e exemplos diferentes dos do livro da escola, ou inventar detalhes. Toda pergunta, mesmo uma repetida, faz uma chamada completa à API.
- **Impacto de não fazer:** Explicações desalinhadas com o material das aulas, risco de informação errada sem fonte para conferir, e espera e custo de API em perguntas que se repetem.
- **Para quem é destinado:** Aluno do Ensino Fundamental e Médio. Indiretamente, também o PO/professor que escolhe os livros.
- **História de usuário:** Como aluno, quero que o tutor explique usando o mesmo livro que uso na escola e me diga a página, para estudar com o material certo e conferir a explicação.
- **Como saberemos que deu certo:**
  - Nas 20 perguntas de referência sobre conteúdos dos livros indexados, ≥ 85% das respostas citam uma página correta (conferida manualmente).
  - Respostas vindas do cache começam a ser faladas em ≤ 300 ms.
  - A busca local leva ≤ 50 ms por pergunta num Android intermediário.
  - O tempo até a primeira fala das respostas que não vêm do cache aumenta no máximo 10% em relação a sem a base.

### Por que não mandar o PDF inteiro

Mandar o livro inteiro em toda pergunta deixaria a resposta **mais lenta e mais cara**, porque o modelo lê centenas de milhares de tokens a cada vez. A abordagem desta especificação, busca local antes da pergunta (RAG), manda só 2–3 trechos (~1.500 tokens). Isso mantém a latência próxima da atual e ganha precisão. O ganho de **velocidade** vem do cache de respostas (RF07).

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | Pasta `livros/` na raiz do projeto para os PDFs, com um `livros/catalogo.json` por livro: `id`, título, disciplina, série/ano, autor/editora, licença e caminho do arquivo. | P0 | CA01 |
| RF02 | Script `npm run indexar-livros` (Node, `pdfjs-dist`) que extrai o texto por página e divide em trechos de ~800–1.200 caracteres. Os cortes respeitam parágrafos e há sobreposição de ~150 caracteres. Cada trecho guarda `livroId`, página, capítulo/seção (pelos títulos detectados ou pelo sumário do PDF) e texto. | P0 | CA01, CA02 |
| RF03 | O script gera `public/conhecimento/indice.json` (trechos + índice invertido para busca por palavras) e um relatório no terminal: livros, páginas, trechos e páginas sem texto. | P0 | CA02, CA03 |
| RF04 | Busca local por relevância (BM25) em `src/conhecimento/busca.ts`. Normaliza o texto: minúsculas, sem acentos, sem palavras vazias do português e com redução simples de plural. Retorna os 3 melhores trechos acima de uma nota mínima e prioriza a disciplina detectada na pergunta. | P0 | CA04, CA05 |
| RF05 | Na pergunta, se houver trechos relevantes, `callGeminiApi()` inclui um bloco "Trechos do livro" (máx. ~1.500 tokens) e o `SYSTEM_PROMPT` instrui: explicar com base nos trechos, usar os termos do livro, não contradizê-los e preencher um campo `fontes: [{livroId, pagina}]` no JSON. | P0 | CA04, CA06 |
| RF06 | Sem trecho relevante (abaixo da nota mínima), a pergunta segue como hoje, sem bloco de trechos e sem citar fonte. | P0 | CA05 |
| RF07 | **Cache de respostas prontas:** script `npm run gerar-cache` que, para cada capítulo, gera as perguntas frequentes (ex.: 10 por capítulo, revisáveis) e suas respostas já no formato de etapas, salvando em `public/conhecimento/cache.json`. Na pergunta do aluno, se a busca encontrar uma pergunta do cache parecida acima de um limite alto, a resposta pronta é usada sem chamar a API. | P1 | CA07, CA08 |
| RF08 | **Cache de execução:** respostas da API para perguntas iguais (após normalização) ficam salvas no aparelho (IndexedDB, máx. 200 entradas, as mais antigas são descartadas) e são reaproveitadas. | P1 | CA09 |
| RF09 | **Fonte visível:** o balão do chat mostra "📖 *Título do livro*, p. 42" para cada fonte. Tocar na fonte abre o trecho original num painel/modal. | P0 | CA06, CA10 |
| RF10 | **Figuras do livro na lousa:** o script extrai figuras com legenda (quando o PDF permitir) para `public/conhecimento/figuras/` com metadados (página e legenda). O item de lousa `imagem` procura primeiro nas figuras do livro e só depois na Wikimedia. | P2 | — |
| RF11 | Página **Configurações** ganha a seção "Livros", que lista os livros indexados e permite ligar ou desligar cada um. A escolha fica salva no aparelho. | P1 | CA11 |
| RF12 | O índice e o cache são carregados sob demanda na página do tutor (fetch após a primeira renderização), sem bloquear a abertura. | P0 | CA12 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | Busca local ≤ 50 ms por pergunta num Android intermediário com 3 livros (~1.000 páginas) indexados. | P0 | CA13 |
| RNF02 | O JS inicial de `tutor.html` continua ≤ 100 KB gzip (o índice não entra no bundle; é carregado à parte). | P0 | CA12 |
| RNF03 | Tamanho do índice ≤ 3 MB gzip por livro de 300 páginas; o relatório do script avisa se passar. | P1 | CA03 |
| RNF04 | **Direitos autorais:** a pasta `livros/` e os arquivos gerados a partir de livros com licença "restrita" no catálogo ficam fora do git (`.gitignore`) e o build Android **não** os inclui, a não ser que a licença seja aberta (domínio público, Creative Commons, material aberto do MEC) ou haja autorização registrada no catálogo. | P0 | CA14 |
| RNF05 | O texto dos trechos é sempre inserido na tela com `textContent` (nunca `innerHTML`). | P0 | — |
| RNF06 | A busca e o cache funcionam offline. Uma resposta vinda do cache não precisa de rede. | P0 | CA08 |

### Dependências técnicas

- `pdfjs-dist` (só no script de indexação, `devDependency`; não vai para o bundle do app).
- `src/gemini.ts` (montagem do payload, novo campo `fontes`), `src/armazenamento.ts` (`SYSTEM_PROMPT`), `src/chat.ts` (exibir fontes), `src/configuracoes.ts` (seção Livros).
- [2026-10-16_comportamento-de-espera-e-streaming.md](2026-10-16_comportamento-de-espera-e-streaming.md): o detector de disciplina/tema pode ser compartilhado (`src/espera/temas.ts`), e as respostas do cache entram no mesmo fluxo de fala por etapas.
- Lousa (PR #3) para o RF10.
- Chave da API do Gemini do desenvolvedor para rodar `npm run gerar-cache` localmente (a chave não fica no projeto; é passada por variável de ambiente em `.env.local`, já ignorado no git).

### Recursos necessários

- Os livros em PDF **com texto selecionável** e a informação de licença de cada um.
- As 20 perguntas de referência sobre os conteúdos desses livros, com a página esperada (gabarito).
- Revisão humana das perguntas e respostas do cache antes de publicar.

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado um PDF e sua entrada em `livros/catalogo.json`, quando rodo `npm run indexar-livros`, então o índice é gerado com trechos que trazem livro, página e capítulo.
- [ ] **CA02:** Dado um trecho do índice, quando comparo com o PDF, então o texto confere com a página indicada (sem cortes no meio de palavras).
- [ ] **CA03 (erro):** Dado um PDF escaneado (sem texto) ou corrompido, quando o script roda, então o relatório aponta o arquivo e as páginas sem texto e o script continua com os outros livros.
- [ ] **CA04:** Dado um livro de Ciências indexado, quando pergunto "o que é fotossíntese?", então a resposta usa os termos do livro e cita a página certa no balão.
- [ ] **CA05:** Dado uma pergunta sobre assunto que não está em nenhum livro indexado, quando ela é enviada, então o tutor responde como hoje, sem citar fonte e sem inventar página.
- [ ] **CA06 (negativo):** Dado uma resposta com fonte, quando confiro a página citada, então ela existe no livro; o app **não** mostra fontes que não vieram de trechos enviados (fontes do modelo sem correspondência são descartadas).
- [ ] **CA07:** Dado uma pergunta igual ou muito parecida com uma do cache, quando ela é enviada, então a resposta começa a ser falada em ≤ 300 ms, sem chamada à API (conferido na aba Rede).
- [ ] **CA08:** Dado o aparelho offline, quando faço uma pergunta que está no cache, então o tutor responde normalmente.
- [ ] **CA09:** Dado que fiz uma pergunta que veio da API, quando repito a mesma pergunta, então a resposta vem do cache do aparelho.
- [ ] **CA10:** Dado uma resposta com fonte, quando toco em "📖 ..., p. 42", então vejo o trecho original daquela página.
- [ ] **CA11:** Dado dois livros indexados, quando desligo um nas Configurações, então as respostas deixam de citar e usar aquele livro.
- [ ] **CA12:** Dado a página do tutor, quando ela abre, então o JS inicial continua ≤ 100 KB gzip e o índice é baixado depois da primeira renderização.
- [ ] **CA13:** Dado 3 livros indexados num Android intermediário, quando faço 20 perguntas, então a busca local leva ≤ 50 ms em cada.
- [ ] **CA14 (negativo):** Dado um livro com licença "restrita" no catálogo, quando gero o build Android e confiro o git, então nem o PDF nem os trechos dele estão no APK ou no repositório.

## O que a atividade não inclui

- Aluno enviar PDFs pelo app: motivo: precisaria processar PDF no aparelho (pesado no celular); fica para o futuro.
- Busca por significado (embeddings): motivo: exigiria chamada extra à API em cada pergunta ou um modelo local pesado; a busca por palavras (BM25) é instantânea e offline. Reavaliar se a precisão ficar abaixo da meta.
- Leitura de texto em PDF escaneado (OCR): motivo: complexo demais agora; o relatório só aponta esses arquivos.
- Mandar o PDF inteiro ao modelo ou usar o cache de contexto do Gemini: motivo: mais lento e mais caro por pergunta (ver "Por que não mandar o PDF inteiro").
- Escolher e licenciar livros: motivo: decisão do PO/escola, fora do código.

### Considerado para o futuro (P2)

- Figuras do livro na lousa (RF10).
- Envio de PDF pelo aluno, processado no aparelho ou num backend.
- Busca híbrida (palavras + significado).
- Leitor de PDF embutido abrindo direto na página citada.
- Atualização dos livros sem novo build (baixar o índice de um servidor).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|---|--------|-----------------------------|-------------|----------|
| D01 | Quais livros serão usados e qual a licença de cada um (abertos ou comerciais)? | PO | Sim | Define o que pode ir para o repositório e para o APK (RNF04). |
| D02 | Os PDFs têm texto selecionável ou são escaneados? | PO / dev | Sim | Escaneados exigem OCR, que está fora do escopo. |
| D03 | O cache de respostas prontas (RF07) precisa de revisão humana de todas as respostas antes de publicar? | PO | Não | Sugestão: sim, pelo menos por amostragem. |
| D04 | Limite de similaridade para usar o cache: preferir errar para o lado de chamar a API? | PO / dev | Não | Sugestão: limite alto; na dúvida, chamar a API. |
| D05 | Com vários livros da mesma matéria (anos diferentes), o aluno escolhe a série nas Configurações? | PO | Não | |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|---|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | Indexação | integração | CA01, CA02 | Rodar o script com um PDF de exemplo aberto (fixture em `tests/fixtures/`) | Trechos com página/capítulo corretos |
| CT02 | PDF sem texto | integração | CA03 | Incluir um PDF escaneado e um corrompido | Relatório aponta ambos; demais indexados |
| CT03 | Normalização | unit | CA04 | Normalizar "Fotossíntese", "fotossintese", "fotossínteses" | Mesmo termo |
| CT04 | Ranking BM25 | unit | CA04, CA05 | Índice de 20 trechos conhecidos; consultas com gabarito | Trecho certo no top 3; consulta fora do assunto retorna vazio |
| CT05 | Prompt com trechos | unit | CA04 | Montar payload com 3 trechos | Bloco presente e ≤ ~1.500 tokens |
| CT06 | Fontes inválidas | unit | CA06 | Resposta com `fontes` com uma página não enviada | Fonte descartada |
| CT07 | Resposta do cache | e2e | CA07, CA08 | Offline; pergunta do cache | Fala em ≤ 300 ms; 0 requisições ao Gemini |
| CT08 | Cache de execução | e2e | CA09 | Mesma pergunta duas vezes | 2ª sem requisição |
| CT09 | Ver trecho | e2e | CA10 | Tocar na fonte | Modal com trecho original |
| CT10 | Desligar livro | e2e | CA11 | Desligar livro A e perguntar sobre ele | Sem citação do livro A |
| CT11 | Carregamento sob demanda | manual | CA12 | Lighthouse + aba Rede | JS ≤ 100 KB; `indice.json` após a renderização |
| CT12 | Desempenho | manual | CA13 | Android intermediário, 20 perguntas, medir com `performance.now()` | ≤ 50 ms cada |
| CT13 | Licença restrita | manual | CA14 | Marcar livro como restrito; `git status`; `unzip -l app-debug.apk` | Nenhum arquivo do livro |
| CT14 | Métrica de precisão | manual | — | 20 perguntas de referência com gabarito | ≥ 85% com página correta |

## URL Complementar

- Documentação técnica: [PDF.js (pdfjs-dist)](https://mozilla.github.io/pdf.js/) · [Okapi BM25 (Wikipedia)](https://en.wikipedia.org/wiki/Okapi_BM25) · [IndexedDB (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- Protótipo / mockup: N/A; balão com fonte descrito no RF09.
- Discussões relacionadas: [2026-10-16_comportamento-de-espera-e-streaming.md](2026-10-16_comportamento-de-espera-e-streaming.md) · [DONE/2026-10-16_lousa-de-apoio-visual.md](DONE/2026-10-16_lousa-de-apoio-visual.md)
- Referências de design: N/A.
- Requisitos originais: pedido do PO em 2026-10-16: "eu poderia ter livros em PDF no ambiente local que serviriam de base para melhorar a agilidade da resposta?".
- Issue / PR relacionado: N/A, a ser criado.
