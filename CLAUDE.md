# Instruções do projeto

## Git Workflow (Branches e Pull Requests)

Toda nova feature, correção ou tarefa deve utilizar o fluxo de branches e Pull Requests (PR) no Git:

### 1. Branches
- **Nunca** desenvolva diretamente na branch `main`.
- Antes de iniciar, garanta que a branch base esteja atualizada: `git checkout main && git pull`.
- Crie uma nova branch a partir da `main` seguindo o padrão de nomenclatura:
  - `feat/nome-da-feature` para novas funcionalidades.
  - `fix/nome-do-bug` para correções de problemas.
  - `docs/nome-da-tarefa` para documentação e especificações.
  - `chore/nome-da-tarefa` para manutenção, dependências ou tarefas operacionais.
  - `refactor/nome-da-refatoracao` para refatorações de código.
- O nome da branch deve ser sempre em minúsculas e separado por hífens.

### 2. Pull Requests (PR)
- Ao iniciar o desenvolvimento (ou logo após versionar a especificação inicial/primeiro commit), suba a branch para o repositório remoto: `git push -u origin <nome-da-branch>`.
- Abra um Pull Request direcionado para a branch `main`.
  - Pode ser aberto como **Draft PR** enquanto a implementação estiver em andamento.
- Use um título claro e descritivo com prefixo de conventional commit (ex.: `feat: adicionar suporte a X`, `fix: corrigir erro em Y`).
- Na descrição do PR, resuma as alterações e mencione a especificação correspondente em `SDD/`.
- Após a implementação, validação dos testes e aprovação, conclua o PR com o merge na `main`.

## Spec Driven Development (SDD)

Toda nova feature, correção ou atividade deve ter uma especificação escrita **antes** da implementação.

### Regras

1. **Sempre** crie a especificação como um arquivo `.md` **dentro da pasta [`SDD/`](SDD/)**. Nunca crie especificações na raiz ou em outras pastas.
2. **Sempre** use como base o modelo [`SDD/modelo_feature.md`](SDD/modelo_feature.md): copie a estrutura e preencha todas as seções, na mesma ordem:
   - Título da Atividade (com tag, ex.: `[FEAT]`, `[FIX]`, `{SEO}`, `(UI)`)
   - Detalhes da Atividade
   - Requisitos da Atividade
   - Critérios de Aceitação / Entregas
   - O que a atividade não inclui
   - Sugestões de casos de teste
   - URL Complementar
3. **Não altere** o arquivo `SDD/modelo_feature.md`. Ele é o modelo de referência.
4. Os critérios de aceitação devem seguir o formato: _"Dado que [contexto], quando [ação], então [resultado esperado]"_.
5. Se alguma seção não se aplicar, mantenha o título e escreva `N/A` com uma breve justificativa. Não remova seções.
6. A implementação só deve começar depois que a especificação estiver criada e, se possível, revisada.
7. **Sempre** que concluir uma feature (implementada e validada com os casos de teste), **mova** o arquivo `.md` da especificação de `SDD/` para a pasta [`SDD/DONE/`](SDD/DONE/), mantendo o mesmo nome de arquivo. Crie a pasta `SDD/DONE/` caso ela ainda não exista. Na raiz de `SDD/` devem ficar apenas o modelo e as especificações pendentes ou em andamento.

### Nomenclatura dos arquivos

Use o padrão `AAAA-MM-DD_nome-da-feature.md`, em minúsculas e com hífens, por exemplo:

```
SDD/2026-09-23_busca-de-poemas.md
SDD/2026-09-23_modo-escuro.md
```

### Fluxo Completo de Desenvolvimento

1. **Atualizar a base:** `git checkout main && git pull`.
2. **Criar a branch da tarefa:** `git checkout -b <tipo>/<nome-da-tarefa>` a partir de `main`.
3. **Criar a especificação SDD:** copiar `SDD/modelo_feature.md` para `SDD/AAAA-MM-DD_nome-da-feature.md` e preencher todas as seções.
4. **Subir branch e abrir PR:** enviar a branch (`git push -u origin <nome-da-branch>`) e abrir o Pull Request (pode ser Draft) apontando para `main`.
5. **Implementar:** desenvolver o código seguindo os requisitos e critérios de aceitação definidos na especificação.
6. **Validar:** executar os casos de teste sugeridos antes de concluir.
7. **Mover especificação:** mover o arquivo para `SDD/DONE/AAAA-MM-DD_nome-da-feature.md` (ex.: `git mv SDD/AAAA-MM-DD_nome-da-feature.md SDD/DONE/`).
8. **Finalizar PR:** comitar as alterações finais, enviar para a branch remota e finalizar o Pull Request para merge na `main`.

## Next.js

@AGENTS.md

