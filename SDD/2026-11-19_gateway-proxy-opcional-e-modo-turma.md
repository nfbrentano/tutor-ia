# [FEAT] Gateway Proxy Opcional, Modo Turma e Suporte Multi-Provedor Desacoplado

> **Status:** Rascunho
> **Autor:** Antigravity (Arquitetura) · **Revisor:** Natanael · **Criada em:** 2026-11-19 · **Atualizada em:** 2026-11-20

## Detalhes da Atividade

- **O que precisa ser feito:** Adicionar um modo **opcional** "Servidor da Escola/Turma" em que o app fala com um backend proxy *self-hosted* que guarda a chave do provedor, autentica alunos e controla cota, preservando o BYOK (*Bring Your Own Key*) local como padrão:
  1. **Modo de conexão no frontend (`src/armazenamento.ts`, `src/configuracoes.ts`, `configuracoes.html`, `src/tutor.ts`, `src/home.ts`):** escolher entre `Chave Pessoal (BYOK)` (atual) e `Servidor da Escola` (URL + login/senha ou código de convite), liberando a aula com qualquer um dos dois.
  2. **Transporte unificado em `src/gemini.ts`:** em modo proxy, mesma montagem de payload, enviada a `POST <serverUrl>/api/tutor/chat` com `Authorization: Bearer <token>`, recebendo SSE no mesmo formato do Gemini, para o parser atual funcionar sem mudança.
  3. **Backend opcional (`backend/`, FastAPI + Pydantic + SQLAlchemy):** segredos só em `.env`, autenticação PBKDF2 + JWT, cota diária por aluno, adaptador Gemini (padrão) e OpenRouter, SQLite local → PostgreSQL via `DATABASE_URL`.
- **Problema e evidência** (código verificado em 2026-11-20):
  - **Chave obrigatória em 5 pontos:** `atualizarStatusChave` (`src/tutor.ts:778-806`) desabilita `#btn-mic`, `#text-fallback-input`, `#btn-send-text` e `#btn-foto-exercicio` e mostra `#blocking-banner` (`tutor.html:59-69`); `processarPergunta` redireciona para Configurações sem chave (`src/tutor.ts:815-819`); o clique no microfone também (`:1192-1195`); a home faz o mesmo (`src/home.ts:14`, `:28`). `callGeminiApi` lança *"API Key do Gemini ausente ou inválida."* sem chave (`src/gemini.ts:810-813`).
  - **Chamada direta do aparelho:** `src/gemini.ts:901-910` chama `generativelanguage.googleapis.com` com a chave pessoal (já no cabeçalho `x-goog-api-key`, não mais na URL, desde `SDD/2026-11-20_correcoes-auditoria-de-erros.md`); não há outro caminho de transporte.
  - **Barreira escolar:** exigir que cada aluno do EF II crie conta e chave no Google AI Studio inviabiliza o uso em turma, e `AGENTS.md` (princípio 2) proíbe embutir chave mestre no build/APK. O curso *Coder Toolbox — Módulo 2* (aulas `02`–`07`) mostra o padrão de proxy com `.env`, PBKDF2 + JWT, OpenRouter, `DATABASE_URL` e deploy em Render/Railway.
- **Impacto de não fazer:** o TutorIA fica restrito a quem consegue gerar e colar uma chave pessoal; turmas não têm como usá-lo sem expor a chave da escola; não há controle de cota por aluno.
- **Para quem é destinado:** professores, escolas e projetos sociais que distribuem o app (Web ou APK) para uma turma; alunos sem conta no Google AI Studio; desenvolvedores que querem testar outro provedor no servidor.
- **História de usuário:** Como professor que quer usar o TutorIA com minha turma do 7º ano, quero hospedar um pequeno servidor proxy com nossa chave em `.env` e cotas diárias por aluno, para que meus estudantes abram o app no celular com login da turma sem precisar criar chaves individuais e sem risco de vazamento da chave da escola no APK.
- **Como saberemos que deu certo:**
  - Modo BYOK: 0 testes existentes quebrados e 0 requisições ao proxy quando o modo é `byok`.
  - Modo proxy: texto, foto e voz transcrita funcionam com streaming e 0 ocorrências de chave do provedor em `localStorage`, `dist/` ou APK.
  - Sem token/JWT inválido → `401`; cota esgotada → `429`; em ambos, 0 chamadas ao provedor pago e mensagem específica no app.
  - `PROVIDER=openrouter` funciona sem rebuild do frontend.

## Requisitos da Atividade

### Requisitos funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RF01 | **Modo de conexão (`src/armazenamento.ts`, `configuracoes.html`):** `modoConexao: 'byok' \| 'proxy'` (padrão `byok`), com `serverUrl`, `sessionToken` e `apelido` no modo proxy; botões "Testar servidor" (`GET <serverUrl>/health`), entrar, cadastrar (com código de convite) e sair (apaga o token). Fica na categoria "Conexão e IA" da spec de design system. | P0 | CA01, CA02 |
| RF02 | **Prontidão única:** criar `conexaoPronta()` em `src/armazenamento.ts` (BYOK com chave **ou** proxy com `serverUrl` + token não expirado) e usá-la nos 5 pontos que hoje chamam `hasApiKey`/`getStoredApiKey` (`src/tutor.ts:779`, `:815`, `:1192`; `src/home.ts:14`, `:28`). | P0 | CA02, CA03 |
| RF03 | **Transporte (`src/gemini.ts`):** `callGeminiApi` recebe uma credencial `{ tipo: 'byok', apiKey } \| { tipo: 'proxy', serverUrl, token }` (aceitando ainda a `string` atual para não quebrar testes). Em proxy, envia o corpo definido em D04 a `POST <serverUrl>/api/tutor/chat` com `Authorization: Bearer`, mais o perfil de roteamento (spec de roteamento RF01) em vez do nome do modelo. Em BYOK, nada muda (a chave continua no cabeçalho `x-goog-api-key`). | P0 | CA03, CA04 |
| RF04 | **Backend base (`backend/`):** FastAPI + Pydantic v2 + SQLAlchemy 2, `backend/.env.example` com placeholders vazios, `GET /health`, CORS por `ALLOWED_ORIGINS` e `backend/README.md` com deploy em Render/Railway e as obrigações de LGPD (RNF03). | P0 | CA01, CA07 |
| RF05 | **Autenticação:** `POST /api/auth/register` (exige `CLASS_INVITE_CODE` quando definido, ver D02) e `POST /api/auth/login`; senha com PBKDF2-HMAC-SHA256 e salt por usuário; JWT HS256 com `JWT_SECRET` e expiração `JWT_EXPIRES_HOURS` (padrão 12). Login por apelido, sem e-mail nem nome real. | P0 | CA05, CA07 |
| RF06 | **Chat via proxy com Gemini:** `POST /api/tutor/chat` valida o JWT e a cota **antes** de chamar o provedor e repassa o SSE no formato de `streamGenerateContent?alt=sse` (linhas `data:` com `candidates[].content.parts[]` e `usageMetadata` no fim), para o parser do cliente (spec de roteamento RF03) funcionar igual nos dois modos. O modelo é escolhido no servidor a partir do perfil, por lista permitida. | P0 | CA04, CA05 |
| RF07 | **Cota e registro de consumo:** por requisição, gravar `usuario_id`, `model`, `prompt_tokens`, `completion_tokens` e `created_at` (sem conteúdo); bloquear com `429` + `detail` amigável quando `DAILY_REQUEST_LIMIT` ou `DAILY_TOKEN_LIMIT` for atingido. Cada iteração do harness é uma requisição. | P0 | CA05, CA07 |
| RF08 | **Adaptador OpenRouter:** com `PROVIDER=openrouter` e `OPENROUTER_MODEL_ID`, traduzir o streaming no formato OpenAI para o mesmo SSE de RF06 (texto e `usageMetadata`; ferramentas do harness fora desta entrega). | P1 | CA06 |
| RF09 | **Erros do proxy no app (`src/tutor.ts`):** `401` → tipo `sessao_expirada` (mensagem para entrar de novo em Configurações); `429` → `cota_excedida` com texto de cota da turma; reutiliza `ErroGeminiTipo` da spec de roteamento (RF05), acrescentando só o tipo `sessao_expirada`, sem travar a interface. | P1 | CA05, CA08 |
| RF10 | **Service Worker:** em `public/sw.js`, GETs da mesma origem para `/api/*` e `/health` passam direto pela rede (hoje só não-GET, `:85`, e outras origens, `:88`, são ignorados; um GET `/api/*` da mesma origem cairia no cache-first de `:101`). Só tem efeito quando app e proxy dividem a origem. | P1 | CA09 |

### Requisitos não-funcionais

| ID | Descrição | Prioridade | CAs |
|----|-----------|------------|-----|
| RNF01 | **Credenciais (`AGENTS.md`):** `dist/` e o APK não contêm `GEMINI_API_KEY`, `OPENROUTER_API_KEY` nem `JWT_SECRET`; `backend/.env` já é ignorado pela regra `.env` do `.gitignore` (não criar exceções além de `!.env.example`). | P0 | CA01 |
| RNF02 | **Zero regressão no BYOK:** `npm run dev`, `npm run build`, `npm test` e o APK funcionam sem Python nem servidor; nenhuma chamada extra no modo `byok`. | P0 | CA03 |
| RNF03 | **Dados de menores (LGPD, art. 14):** o backend guarda só apelido, hash da senha e métricas numéricas; não guarda texto, foto nem áudio; logs de consumo apagados após `LOG_RETENTION_DAYS` (padrão 90); exclusão de aluno por comando de CLI. O `README` deixa claro que a escola é a controladora dos dados e precisa do consentimento dos responsáveis. | P0 | CA07 |
| RNF04 | **HTTPS e CORS no Android:** o WebView do Capacitor roda em `https://localhost` (`androidScheme: 'https'` em `capacitor.config.ts`), então o app só aceita `serverUrl` `https://` (exceto `http://localhost` e `http://10.0.2.2` em desenvolvimento) e o proxy responde ao preflight `OPTIONS` para as origens de `ALLOWED_ORIGINS` (`http://localhost:5173`, `https://localhost` e o domínio web de produção). | P0 | CA04, CA10 |
| RNF05 | **Portabilidade de banco:** modelos ORM sem SQL de dialeto específico; mesma suíte `pytest` passa em SQLite e PostgreSQL. | P1 | CA07 |
| RNF06 | **Token no aparelho:** o JWT fica em `localStorage` (mesma exposição da chave BYOK hoje), por isso expira em ≤ 12 h por padrão e "Sair" o apaga. | P1 | CA02 |

### Dependências técnicas

- Frontend: `src/armazenamento.ts`, `src/gemini.ts`, `src/configuracoes.ts`, `src/tutor.ts`, `src/home.ts`, `public/sw.js`, `configuracoes.html`.
- Backend opcional em `backend/`: Python 3.11+, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2, PyJWT, `httpx`, `python-dotenv`, `pytest`. O `pytest` roda à parte do `npm test`.
- **Ordem de implementação: 4 de 5 (trilha de IA), a última.** O proxy embrulha o payload já estabilizado pelas specs `2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md` (parser, `usageMetadata`, `ErroGeminiTipo`, perfil), `2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md` (prompt montado no cliente, sem cópia no backend) e `2026-11-19_harness-agentico-tools-e-controle-lousa.md` (iterações com ferramentas passam pelo proxy). Depende ainda das respostas de D02, D04 e D05.
- A tela de modo de conexão usa a categoria "Conexão e IA" de `2026-11-19_vibe-design-system-e-ux-mobile-first.md`.

### Recursos necessários

- Ambiente Python local ou PaaS (Render/Railway) só para quem for rodar o `backend/`.
- Chave de teste do Gemini (e, opcionalmente, do OpenRouter) apenas em `backend/.env`.
- Certificado HTTPS para o servidor (incluso nas PaaS citadas).

## Critérios de Aceitação / Entregas

- [ ] **CA01:** Dado que um professor clona o projeto, quando abre `backend/.env.example` e roda `npm run build`, então o exemplo lista `PROVIDER`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_ID`, `JWT_SECRET`, `JWT_EXPIRES_HOURS`, `DATABASE_URL`, `CLASS_INVITE_CODE`, `DAILY_REQUEST_LIMIT`, `DAILY_TOKEN_LIMIT`, `LOG_RETENTION_DAYS` e `ALLOWED_ORIGINS` com valores vazios, e uma busca por esses nomes com valor em `dist/` não encontra nada.
- [ ] **CA02:** Dado que o aluno escolheu `Servidor da Escola`, informou a URL e fez login válido, quando abre `tutor.html` com `gemini_api_key` vazia, então `#blocking-banner` fica oculto e `#btn-mic`, `#text-fallback-input`, `#btn-send-text` e `#btn-foto-exercicio` ficam habilitados; depois de "Sair", voltam a ficar bloqueados.
- [ ] **CA03:** Dado que o modo é `byok` com chave válida e não há servidor rodando, quando o aluno usa `tutor.html`, então as requisições vão só para `generativelanguage.googleapis.com` e nenhuma para o proxy.
- [ ] **CA04:** Dado que o modo é proxy com JWT válido, quando o aluno envia uma pergunta com ou sem foto, então o backend chama o provedor com a chave do `.env` e o app mostra fala, lousa e fontes em streaming exatamente como no BYOK.
- [ ] **CA05 (negativo):** Dado que a requisição a `/api/tutor/chat` vem sem token, com JWT adulterado ou expirado, ou depois de esgotada a cota diária, quando o backend processa, então responde `401` (autenticação) ou `429` (cota) sem chamar o provedor, e o app mostra a mensagem do tipo correspondente sem travar.
- [ ] **CA06:** Dado que o servidor está com `PROVIDER=openrouter` e `OPENROUTER_MODEL_ID` válido, quando o app envia a mesma pergunta, então a resposta chega no mesmo formato SSE, sem rebuild do frontend.
- [ ] **CA07:** Dado que o backend roda em SQLite e depois em PostgreSQL, quando um aluno se cadastra e faz perguntas, então ficam gravados só apelido, hash PBKDF2 (nunca a senha) e registros de consumo sem texto; registros mais antigos que `LOG_RETENTION_DAYS` são apagados pela rotina de limpeza.
- [ ] **CA08:** Dado que o token expirou no meio da aula, quando o aluno envia a próxima pergunta, então o chat mostra a orientação para entrar de novo e nenhum dado da sessão local (chat, caderno) é perdido.
- [ ] **CA09:** Dado que o app e o proxy estão na mesma origem com o Service Worker ativo, quando o app faz `GET /health` ou `GET /api/...` duas vezes, a segunda com o servidor fora do ar, então a segunda falha pela rede em vez de devolver a resposta anterior do cache.
- [ ] **CA10 (negativo):** Dado que o app roda no APK Android, quando o aluno informa `serverUrl` começando com `http://` (fora de localhost), então o app recusa salvar e explica que o servidor precisa de HTTPS.

## O que a atividade não inclui

- Servidor central mantido pelo autor para todos: motivo: entrega é *self-hostable*, sem custo obrigatório de manutenção para o projeto.
- Histórico de conversas ou Caderno no servidor: motivo: privacidade (LGPD, alunos menores); continuam só no aparelho.
- Painel administrativo (cadastro em lote, notas): motivo: fora do escopo inicial; gestão por código de convite, CLI e `.env`.
- Ferramentas do harness com `PROVIDER=openrouter`: motivo: tradução de tool calling entre formatos fica para depois.

### Considerado para o futuro (P2)

- Painel do professor com estatísticas anônimas por disciplina/série e ajuste de cota pela web.
- Sincronização opcional e criptografada de sessões e Caderno entre aparelhos.
- Login federado (Google Classroom / OAuth institucional).

## Dúvidas em aberto

| # | Dúvida | Responsável (PO/dev/design) | Bloqueante? | Resposta |
|----|--------|-----------------------------|-------------|----------|
| D01 | O proxy deve ter endpoints além de geração (ex.: síntese de voz ou validação)? | dev / PO | Não | Não nesta entrega: voz continua no aparelho. |
| D02 | `CLASS_INVITE_CODE` deve ser obrigatório para cadastrar? | PO / dev | Sim (antes de deploy público) | **Proposta:** obrigatório; o servidor não inicia com `ENV=production` sem ele. |
| D03 | Valores iniciais de `DAILY_REQUEST_LIMIT` e `DAILY_TOKEN_LIMIT`? | PO | Não | **Proposta:** 200 requisições (≈ 40 perguntas com até 5 chamadas do harness) e 150 mil tokens por aluno/dia; ajustar com a telemetria. |
| D04 | O cliente envia o payload já montado (`systemInstruction`, `contents`, `tools`, `generationConfig`) ou campos soltos para o servidor montar o prompt? | dev | Sim | **Proposta:** payload montado no cliente (uma única fonte do prompt em `src/prompts/`); o servidor limita o tamanho (≤ 2 MB), aceita só chaves conhecidas de `generationConfig` e escolhe o modelo. O risco de uso fora do escopo escolar fica limitado por convite + cota. |
| D05 | Os termos de uso da Gemini API (idade mínima, uso por/para menores e uso dos dados no nível gratuito) permitem o Modo Turma com alunos de EF II e EM? | PO | Sim (antes de qualquer uso com turma) | A verificar nos termos vigentes; se o nível gratuito usar os dados para melhoria do produto, recomendar conta paga no servidor da escola. Vale também revisar o BYOK. |

## Sugestões de casos de teste

| # | Cenário | Tipo (unit/integração/e2e/manual) | Cobre | Passos | Resultado esperado |
|----|---------|-----------------------------------|-------|--------|--------------------|
| CT01 | BYOK preservado | unit | CA03 | Modo `byok`, chave válida, `fetch` mockado | Só `generativelanguage.googleapis.com`; 0 chamadas ao proxy |
| CT02 | Desbloqueio e saída no modo proxy | unit | CA02 | Salvar `proxy` + `serverUrl` + token; inicializar `tutor.ts`; depois "Sair" | Controles habilitados e depois bloqueados |
| CT03 | Cadastro, convite e hash | integração (`pytest`) | CA05, CA07 | `register` com e sem `invite_code`; ler o banco; `login` | Sem convite → `403`; hash com salt; login devolve JWT |
| CT04 | `401` sem chamar provedor | integração (`pytest`) | CA05 | `/api/tutor/chat` sem `Authorization` e com token expirado; adaptador espionado | `401`; adaptador não chamado |
| CT05 | SSE ponta a ponta | integração | CA04 | Backend com Gemini mockado emitindo SSE; cliente em modo proxy | Cabeçalho `Bearer` enviado; fala, lousa e `usageMetadata` processados |
| CT06 | Cota `429` | integração (`pytest`) + unit | CA05 | `DAILY_REQUEST_LIMIT=2`; 3 chamadas | 3ª → `429` sem chamar provedor; app mostra mensagem de cota |
| CT07 | OpenRouter | integração (`pytest`) | CA06 | `PROVIDER=openrouter` com cliente HTTP mockado no formato OpenAI | SSE no formato Gemini |
| CT08 | Segredos e `.env.example` | build | CA01 | `npm run build`; buscar nomes de variáveis com valor em `dist/`; ler `.env.example` | 0 ocorrências; todos os nomes presentes e vazios |
| CT09 | Retenção de logs | integração (`pytest`) | CA07 | Inserir registros com 91 dias; rodar limpeza | Registros antigos apagados; nenhuma coluna de texto existe |
| CT10 | Token expirado na aula | unit | CA08 | Proxy mockado devolvendo `401` | Mensagem `sessao_expirada`; chat e caderno intactos |
| CT11 | SW e HTTPS | unit / manual | CA09, CA10 | Handler `fetch` do SW com `GET /health`; salvar `http://192.168.0.10` no APK | Rede sem cache; URL recusada |

## URL Complementar

- Documentação técnica: `src/armazenamento.ts`, `src/gemini.ts`, `public/sw.js`, `capacitor.config.ts`, [AGENTS.md](../AGENTS.md); [Gemini API: chaves de API](https://ai.google.dev/gemini-api/docs/api-key)
- Protótipo / mockup: contratos `POST /api/auth/register`, `POST /api/auth/login` e `POST /api/tutor/chat` descritos em RF05–RF07.
- Discussões relacionadas: [2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md](2026-11-19_roteamento-modelos-telemetria-custos-e-evals.md) · [2026-11-19_harness-agentico-tools-e-controle-lousa.md](2026-11-19_harness-agentico-tools-e-controle-lousa.md) · [2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md](2026-11-19_engenharia-prompt-skills-contexto-e-anti-alucinacao.md)
- Referências de design: *Coder Toolbox — Módulo 2* (aulas `02`–`07`) e *LangChain — Módulo 1* (`18`: persistência em banco).
- Requisitos originais: pedido de aproveitamento do curso *Asimov - Aplicações Inteligentes com IA* para o TutorIA (2026-11-19).
- Issue / PR relacionado: a criar na branch `feat/gateway-proxy-modo-turma`, conforme [CLAUDE.md](../CLAUDE.md).
