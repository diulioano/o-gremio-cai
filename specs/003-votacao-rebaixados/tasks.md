---

description: "Task list for 003-votacao-rebaixados"
---

# Tasks: Votação "Quem você acha que cai?"

**Input**: Design documents from `specs/003-votacao-rebaixados/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS. A Constituição (princípio II) exige testes da lógica de domínio. O quickstart.md e os SC-002, SC-003, SC-006 e SC-007 pedem prova automatizada: contagem exata, votos inválidos recusados, teto diário e nenhum IP guardado.

**Organization**:

- **US1**: votar nos 3 que vão cair (P1).
- **US2**: ver o que os outros acham (P1).
- **US3**: opinião da torcida na página do time (P2).

**Design primeiro**: os componentes visuais (T021 em diante) só começam depois que o usuário trouxer o design do Claude Design (T019–T020). Até lá, dá para fazer todo o domínio, o banco e o servidor.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1, US2, US3 (ver spec.md)

## Path Conventions

Estrutura das specs 001 e 002: `src/domain`, `src/shared`, `src/worker`, `src/client`, `tests/domain`, `tests/worker`, `tests/types`. Ver plan.md → Project Structure.

---

## Phase 1: Setup

**Purpose**: partir de uma base limpa e com os recursos da Cloudflare declarados.

- [X] T001 (feito sem commitar: a branch `003-votacao-rebaixados` foi criada levando as mudanças do card ainda não commitadas) Commitar o trabalho pendente do card de compartilhar na branch `002-atualizacao-por-minuto` (pedir confirmação ao usuário antes), criar a branch `003-votacao-rebaixados` e rodar `npm run check` para confirmar que a base está verde.
- [X] T002 Criar o banco: `npx wrangler d1 create vaicair-votos`. Adicionar em `wrangler.jsonc` o bloco `"d1_databases": [{ "binding": "DB", "database_name": "vaicair-votos", "database_id": "<id>", "migrations_dir": "migrations" }]` e `"ratelimits": [{ "name": "VOTE_LIMITER", "namespace_id": "3001", "simple": { "limit": 5, "period": 60 } }]`, com comentários citando `specs/003-votacao-rebaixados`. Rodar `npm run cf-typegen` para que `Env` ganhe `DB: D1Database` e `VOTE_LIMITER: RateLimit`.

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Purpose**: regras do domínio, esquema do banco, tipos do contrato e testes com D1. Nenhuma depende de design.

- [X] T003 [P] Criar `migrations/0001_votos.sql` exatamente como em `data-model.md`:
  - `votes(voter TEXT PRIMARY KEY, t1/t2/t3 INTEGER NOT NULL, at INTEGER NOT NULL) WITHOUT ROWID`;
  - `tally(team_id INTEGER PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)`, com `team_id = 0` guardando o total;
  - `daily(day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID`;
  - trigger `count_vote AFTER INSERT ON votes`, que soma 1 em `tally` para 0, t1, t2 e t3 (`ON CONFLICT (team_id) DO UPDATE SET n = n + 1`) e em `daily` para `strftime('%Y-%m-%d', NEW.at / 1000, 'unixepoch')`.
  - Aplicar localmente: `npx wrangler d1 migrations apply vaicair-votos --local`.
- [X] T004 [P] Criar `src/domain/votes.ts` (puro, sem I/O):
  - constantes `PICKS = 3`, `MIN_VOTES = 10` e `DAILY_CAP = 10_000`;
  - `ballotError(picks: unknown): string | null`: `null` só para um array de exatamente 3 inteiros distintos, todos ids de `TEAMS` (`src/shared/teams.ts`); senão, mensagem em pt-BR ("Escolha 3 times", "Times repetidos", "Time fora da lista");
  - `isVoterId(v: unknown): v is string`: formato UUID;
  - `votingClosesAt(matches: readonly SlimMatch[]): number | null`: menor `Date.parse(utc)` entre os jogos do maior `md`; `null` com lista vazia;
  - `crowdResult(counts: Record<number, number>, total: number)`: com `total < MIN_VOTES`, devolve `{ total, warmingUp: true }`; senão, `{ total, rows }` com os 9 times de `TEAMS` (contagem ausente = 0), `pct = Math.round(100 * votes / total)`, ordenado por `votes` decrescente e desempate pelo `name`.
  - Comentário no topo apontando para `specs/003-votacao-rebaixados/data-model.md`.
- [X] T005 [P] Criar `tests/domain/votes.test.ts` com os casos:
  - `ballotError`: 2 times, 4 times, repetido, id da Chapecoense (fora de `TEAMS`), id desconhecido, não inteiro, não array e 3 válidos;
  - `isVoterId`: UUID válido e inválido;
  - `votingClosesAt`: pega a maior rodada, o jogo mais cedo dela, acompanha um jogo remarcado e devolve `null` para lista vazia;
  - `crowdResult`: 150 de 200 dá 75%; ordem e desempate pelo nome; 9 votos dá `warmingUp`; time sem voto aparece com 0%; a soma das porcentagens fica em 300 ± 5.
- [X] T006 [P] Em `src/shared/api.ts`, adicionar `VoteRow`, `VoteState`, `VoteRequest` e `VoteError` exatamente como em `contracts/api-votes.md`, com o comentário "Contrato de /api/votes: ver specs/003-votacao-rebaixados/contracts/api-votes.md".
- [X] T007 Configurar o D1 nos testes do Worker: em `vitest.config.ts`, no projeto `worker`, ler as migrações com `readD1Migrations('./migrations')` (de `@cloudflare/vitest-plugin`), passá-las como binding `TEST_MIGRATIONS` e acrescentar `setupFiles: ['./tests/worker/setup-d1.ts']`. Criar `tests/worker/setup-d1.ts`, que chama `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` de `cloudflare:test`. Rodar `npm test` para confirmar que os testes existentes continuam verdes.

**Checkpoint**: `npm run check` verde, com as regras de votação testadas e o banco disponível nos testes.

---

## Phase 3: User Story 1 - Votar nos 3 que vão cair (Priority: P1) 🎯 MVP

**Goal**: o visitante escolhe 3 times, confirma e o voto fica salvo e contado, um por aparelho, de forma definitiva.

**Independent Test**: num aparelho que nunca votou, escolher 3 times e confirmar. Ao fechar e abrir de novo, o site mostra o voto e o total subiu em 1. Um segundo envio não conta.

### Tests for User Story 1

- [X] T008 [P] [US1] Criar `tests/worker/votes.test.ts` (bloco "POST"), usando `exports.default.fetch` como em `tests/worker/routes.test.ts`:
  - 201 conta +1 em `tally` para os 3 times e para o total (0), e +1 em `daily`;
  - mesmo `voter` → 409 com `mine` = os times **gravados**, sem contar de novo;
  - `picks` com 4 times, repetido, Chapecoense ou `voter` não-UUID → 400 sem gravar nada;
  - corpo > 1 KB → 400;
  - com o KV contendo jogos cuja última rodada já começou → 410 com `state`;
  - `daily` de hoje em `DAILY_CAP` → 503 `daily-cap`;
  - 6 envios do mesmo `CF-Connecting-IP` em 60 s → o 6º recebe 429;
  - nenhuma coluna de `votes` contém o IP (SC-007).

### Implementation for User Story 1

- [X] T009 [US1] Criar `src/worker/votes.ts` com `postVote(req, env)`, seguindo a ordem do contrato:
  1. lê o corpo (≤ 1 KB) e valida com `isVoterId` + `ballotError` (400 `invalid`);
  2. calcula `closesAt` com `votingClosesAt` a partir de `env.CACHE.get(CACHE_KEY)` ou `demoData()` sem token; com `now >= closesAt`, responde 410 `closed`;
  3. chama `env.VOTE_LIMITER.limit({ key: req.headers.get('CF-Connecting-IP') ?? 'anon' })` (429 `rate-limited`);
  4. lê `daily` de hoje; com `n >= DAILY_CAP`, responde 503 `daily-cap`;
  5. faz `INSERT INTO votes`; na violação de chave única, responde 409 com o voto gravado; em outro erro, 503 `unavailable`;
  6. responde 201 com `VoteState` (`mine`, `rows`/`warmingUp` via `crowdResult`).
  - Mensagens de `VoteError` em pt-BR. Nunca registrar o IP em log. `cache-control: no-store`.
- [X] T010 [US1] Em `src/worker/index.ts`, rotear `POST /api/votes` para `postVote`. Outros métodos em `/api/votes` (exceto GET, que vem em US2) → 405.
- [X] T011 [P] [US1] Em `tests/types/worker-contract.ts`, garantir que o corpo de `/api/votes` do Worker é `VoteState | VoteError` (no estilo do `/api/data`).
- [X] T012 [P] [US1] Em `src/client/lib/storage.ts`:
  - chave `VOTE_KEY = 'vaicair-voto-v1'`;
  - `loadVote()`: devolve `{ voter, picks?, at? }`, descartando JSON inválido, `voter` fora de UUID ou `picks` que não passem em `ballotError`; sem `voter` válido, gera `crypto.randomUUID()` e grava;
  - `saveVote(picks, at)`: grava, mantendo o `voter`.
  - Testes em `tests/domain/storage.test.ts`.
- [X] T013 [US1] Criar `src/client/hooks/useVote.ts`:
  - estado `form | sending | voted | closed`, erro atual e seleção (máx. 3);
  - `toggle(id)`, que ignora um 4º time;
  - `submit()`: POST; em 201 ou 409, chama `saveVote` com o `mine` do servidor e passa a `voted`; em 400, 429, 503 ou falha de rede, mantém a seleção e expõe a mensagem; em 410, passa a `closed` com o `state`.
  - Nunca marca como votado sem 201 ou 409 (FR-004).
- [X] T014 [P] [US1] Em `tests/worker/votes.test.ts`, adicionar um teste de corrida: dois POSTs simultâneos com o mesmo `voter` → um 201 e um 409, com o total subindo só 1.

**Checkpoint**: votar funciona de ponta a ponta pelo servidor (testes) e o hook está pronto. A tela vem depois do design (T019–T023).

---

## Phase 4: User Story 2 - Ver o que os outros acham (Priority: P1)

**Goal**: quem votou (ou todo mundo, depois do encerramento) vê a porcentagem de cada time, a ordem e o total.

**Independent Test**: com votos no banco, `GET /api/votes?voter=<quem votou>` traz `rows` e porcentagens que batem com `tally`. Sem `voter`, não traz `rows` enquanto a votação estiver aberta.

### Tests for User Story 2

- [X] T015 [P] [US2] Em `tests/worker/votes.test.ts`, adicionar o bloco "GET":
  - sem `voter` e com a votação aberta → só `open`, `closesAt` e `total`, sem `rows`, `warmingUp` nem `mine`;
  - `voter` desconhecido → o mesmo;
  - `voter` que votou → `rows` (ou `warmingUp` com < 10 votos) e `mine`;
  - votação fechada → `rows` para todos, com `open: false`;
  - `cache-control: no-store`;
  - D1 indisponível (binding que lança erro) → 503 `unavailable`.

### Implementation for User Story 2

- [X] T016 [US2] Em `src/worker/votes.ts`, criar `getVotes(req, env)`:
  - lê `tally` (≤ 10 linhas);
  - se o `voter` da query for UUID, busca a linha dele pela chave (1 leitura);
  - inclui `rows`/`warmingUp` (via `crowdResult`) e `mine` só se ele votou ou se a votação estiver fechada.
  - Extrair um helper compartilhado com o 201/409 do `postVote` para montar o `VoteState`.
- [X] T017 [US2] Em `src/worker/index.ts`, rotear `GET /api/votes` para `getVotes`.
- [X] T018 [US2] Em `src/client/hooks/useVote.ts`, ao montar: chamar `GET /api/votes?voter=<loadVote().voter>` e definir o estado inicial (`voted` se a resposta tiver `mine` ou o `localStorage` tiver `picks`; `closed` se `open === false`; senão, `form`). Expor `state.rows`, `total`, `warmingUp`, `mine` e `closesAt`. Falha do GET: esconde a votação sem quebrar a página.

**Checkpoint**: servidor e hook entregam tudo o que a tela da votação precisa.

---

## Phase 5: Design (bloqueia a interface de US1, US2 e US3)

- [X] T019 (briefing: https://claude.ai/artifact/ABc8uBbtMoxmrESxKzqJW5) Escrever o briefing de design da votação para o Claude Design, no estilo dos briefings anteriores (artifact privado, link para o usuário). Deve cobrir:
  - botão flutuante no canto inferior direito (antes e depois de votar) e gaveta que sobe: lista dos 9 times com nome e escudo pequeno e a Chapecoense fora, com explicação; contador "faltam N"; bloqueio no 3º; aviso "o voto não pode ser mudado"; confirmar; enviando; erro com seleção mantida; votou ("Seu palpite: A, B e C" + resultado com barras ordenadas, os 3 destacados e o total); "votação começando" (< 10); encerrada; fechada por hoje (teto diário);
  - na página do time: a linha da torcida (com porcentagem / convite "Vote para ver o que a torcida acha"), abaixo do veredito.
  - Regras: opinião da torcida nunca em vermelho/verde de SIM/NÃO; celular primeiro; "reduzir movimento"; pt-BR.
- [X] T020 Esperar o design pronto do usuário (Claude Design) antes de seguir para T021. (Recebido: projeto 4f691c06…, `Votacao Torcida.dc.html`.)

---

## Phase 6: Interface (depois do design)

- [X] T021 [US1] (dividido em `VoteSheet` + `VoteForm` + `VoteResult` + `VoteCrest` pela regra de 200 linhas por componente) Criar `src/client/components/common/VoteSheet.tsx` + `VoteSheet.module.css`, seguindo o design e usando `useVote`. É uma gaveta de baixo para cima (reaproveitar o padrão da `ShareSheet`) com:
  - a lista dos 9 times (nome + escudo pequeno) e a Chapecoense à parte, como rebaixada;
  - o contador "faltam N", o aviso "o voto não pode ser mudado" e o botão confirmar fixo no pé;
  - os estados enviando e erro (seleção mantida).
  - Acessibilidade: `role="dialog"` + `aria-modal`, foco preso, fecha com Esc, com o fundo e com o botão fechar, e devolve o foco ao botão de abrir; times com `aria-pressed` e desabilitados no 3º; resultado do envio anunciado (`aria-live`).
  - Animação de subir só sem `prefers-reduced-motion`.
- [X] T022 [US2] Em `VoteSheet.tsx`, adicionar os estados votou (seu palpite + resultado com barras, na ordem do servidor, com os 3 destacados e "N votos"), "votação começando", encerrada e fechada por hoje. O título deixa claro que é opinião da torcida (FR-012).
- [X] T023 [US1] Criar `src/client/components/common/VoteButton.tsx` + `VoteButton.module.css`:
  - botão fixo no canto inferior direito (`env(safe-area-inset-bottom)`); o texto muda de "Quem você acha que cai?" para "O que a torcida acha" quando a fase é `voted` ou `closed`; não aparece em `loading` e `hidden`;
  - abre a `VoteSheet`; `/#votacao` abre a gaveta direto ao carregar;
  - colocar nos dois layouts: `src/client/components/home/HomePage.tsx` e `src/client/components/team/TeamPage.tsx`, com um único `useVote` por página, passado a `VoteButton`/`VoteSheet`/`CrowdLine`;
  - na página do time, subir acima da `PinnedVerdictBar` quando ela estiver presa embaixo (`usePinnedBar`), sem nunca cobrir o SIM/NÃO (FR-001a).
- [X] T024 [US3] Criar `src/client/components/team/CrowdLine.tsx` + `CrowdLine.module.css`:
  - com `rows` disponível: "X% da torcida acha que [art] [time] cai";
  - sem `rows` e votação aberta: "Vote para ver o que a torcida acha", que abre a gaveta;
  - com o GET falhando: não renderiza nada.
- [X] T025 [US3] Em `src/client/components/team/TeamPage.tsx`, colocar `<CrowdLine />` abaixo do veredito e da prova numérica (`VerdictDetails`), sem mudar nada acima dele (SC-005).

**Checkpoint**: roteiro manual do `quickstart.md`, passos 1 a 7, funcionando em `npm run dev`.

---

## Phase 7: Polish & Cross-Cutting

- [X] T026 (votação simulada no teste; 40 capturas regravadas e revisadas) [P] Em `tests/visual/parity.spec.ts`, conferir que as páginas de time continuam iguais acima da linha da torcida. O botão flutuante muda todas as capturas: atualizar os baselines de propósito, depois de revisar cada uma, ou escondê-lo nas capturas de paridade e testá-lo à parte.
- [X] T027 [P] Atualizar `PRODUCT.md` (seção Capabilities: votação, D1, regras) e o `README.md` (como criar o D1 e aplicar as migrações).
- [X] T028 Rodar `npm run check` e o roteiro completo do `quickstart.md` (incluindo o passo 8 com `curl` e o passo 9 com a votação encerrada nos dados de demonstração).
- [X] T029 (publicado: versão ce509cdd) Publicar, com confirmação do usuário:
  1. `npx wrangler d1 migrations apply vaicair-votos --remote`;
  2. `npm run deploy`;
  3. conferir `SELECT * FROM tally` em produção e as métricas de linhas do D1 no painel.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T007)** → US1 servidor (T008–T014) → US2 servidor (T015–T018) → **Design (T019–T020)** → Interface (T021–T025) → Polish (T026–T029).
- US2 depende de US1 para ter votos no banco e reaproveitar o helper de `VoteState`. US3 depende de US2 (usa `rows` do GET) e do design.
- T019 (briefing) pode ser escrito logo depois da Foundational, em paralelo ao servidor. T020 bloqueia toda a interface.
- Dentro do mesmo arquivo, as tarefas são sequenciais: `src/worker/votes.ts` (T009 → T016), `tests/worker/votes.test.ts` (T008 → T014 → T015) e `useVote.ts` (T013 → T018).

## Parallel Example

```text
# Foundational, todos em arquivos diferentes:
T003 migrations/0001_votos.sql
T004 src/domain/votes.ts
T005 tests/domain/votes.test.ts
T006 src/shared/api.ts

# US1, depois do T009:
T011 tests/types/worker-contract.ts
T012 src/client/lib/storage.ts
```

## Implementation Strategy

1. **MVP do servidor**: Setup + Foundational + US1 (servidor) + US2 (servidor). A votação funciona e está testada, ainda sem tela.
2. **Design**: briefing (T019), que pode ser adiantado, e espera do Claude Design (T020).
3. **Botão + gaveta** (T021–T023): é o MVP visível, em todas as páginas. Dá para publicar aqui.
4. **Linha da torcida nas páginas de time** (T024–T025): incremento P2.
5. **Polish e deploy** (T026–T029).
