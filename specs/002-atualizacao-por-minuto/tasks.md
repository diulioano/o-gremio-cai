---

description: "Task list for 002-atualizacao-por-minuto"
---

# Tasks: Atualização de minuto em minuto durante os jogos

**Input**: Design documents from `specs/002-atualizacao-por-minuto/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS. A Constituição (princípio II) exige testes da lógica de domínio. O quickstart.md e os SC-002/SC-003 pedem prova automatizada de que os limites gratuitos são respeitados.

**Organization**:

- **US1**: placar e veredito novos durante o jogo (P1).
- **US2**: ficar dentro do plano grátis (P1).
- **US3**: página parada não gasta à toa (P2).

**Ordem**: US2 vem antes de US1. O servidor precisa conferir a fonte a cada minuto sem estourar o KV antes de a página ter o que buscar. Publicar US1 sem US2 estouraria as 1.000 gravações por dia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1, US2, US3 (ver spec.md)

## Path Conventions

Estrutura da spec 001: `src/domain`, `src/shared`, `src/worker`, `src/client`, `tests/domain`, `tests/worker`. Ver plan.md → Project Structure.

---

## Phase 1: Setup

**Purpose**: partir de uma base limpa.

- [X] T001 Criar a branch `002-atualizacao-por-minuto` a partir de `main` (o repositório está com HEAD solto) e rodar `npm run check` para confirmar que a base está verde antes de mexer.

---

## Phase 2: Foundational (bloqueia todas as stories)

**Purpose**: a regra única de "tem jogo ao vivo" e as constantes de frescor, usadas pelo Worker e pelo cliente (research.md D2, data-model.md).

- [X] T002 [P] Criar `tests/domain/live.test.ts` cobrindo `isLiveWindow(matches, now)`. Os jogos são `SlimMatch` mínimos, e cada caso diz o resultado esperado:
  - `TIMED` com `utc` 16 min no futuro: false;
  - `TIMED` 15 min no futuro: true;
  - `TIMED` 2h59 no passado: true;
  - `TIMED` 3h01 no passado: false;
  - `IN_PLAY`/`PAUSED`/`LIVE` com `utc` de 5 h atrás: true;
  - `FINISHED`/`AWARDED`/`POSTPONED`/`CANCELLED`/`SUSPENDED` dentro da janela de horário: false;
  - lista vazia: false;
  - lista com um jogo fora e um dentro: true.
- [X] T003 Criar `src/domain/live.ts` (puro, sem I/O nem APIs de navegador) até o T002 passar. Exportar:
  - `LIVE_LEAD_MS = 15 * 60_000`, `LIVE_TAIL_MS = 3 * 60 * 60_000`;
  - `HEARTBEAT_LIVE_MS = 5 * 60_000`, `HEARTBEAT_IDLE_MS = 60 * 60_000`;
  - `STALE_LIVE_MS = 15 * 60_000`, `STALE_IDLE_MS = 3 * 60 * 60_000`;
  - `POLL_MS = 60_000`;
  - `isLiveWindow(matches: SlimMatch[], now: number): boolean` com a regra exata do data-model.md. É `true` se algum jogo tem `status ∈ {IN_PLAY, PAUSED, LIVE}`, ou tem `status ∉ {FINISHED, AWARDED, POSTPONED, CANCELLED, SUSPENDED}` e `Date.parse(utc) − LIVE_LEAD_MS ≤ now ≤ Date.parse(utc) + LIVE_TAIL_MS`.

  Tipos importados de `src/shared/api.ts`.
- [X] T004 Em `src/worker/data.ts`, extrair a busca à fonte para `export async function fetchSource(token: string): Promise<DataPayload>`. Ela faz o `fetch` com `X-Auth-Token`, lança `Error('football-data <status>')` se `!r.ok` e devolve `slim(json)`. `getData` passa a usá-la, sem mudar comportamento ainda. `npm run check` deve continuar verde.

**Checkpoint**: `isLiveWindow` testada e `fetchSource` reutilizável. Nada mudou para o visitante.

---

## Phase 3: User Story 2 - Ficar dentro do plano grátis (Priority: P1)

**Goal**: um Cron Trigger de minuto em minuto é o único que consulta a fonte. Ele consulta todo minuto com jogo ao vivo e só no minuto 0 sem jogo. Grava no KV só se os dados mudaram ou se o pulso venceu (contracts/scheduled.md, research.md D1/D3).

**Independent Test**: o teste de simulação de um dia (T007) mostra menos de 700 gravações e no máximo 1 busca por minuto. Os casos unitários (T005) mostram que não há gravação quando nada mudou.

### Tests for User Story 2

- [X] T005 [P] [US2] Criar `tests/worker/scheduled.test.ts`. Reaproveitar o padrão `fakeEnv` de `tests/worker/data.test.ts` (KV em `Map`, contando `put`) e mockar `globalThis.fetch` com `vi.spyOn`. Chamar `refresh(env, t)` (T008) com `t` controlado. Casos:
  - (a) sem token: 0 fetch e 0 put;
  - (b) KV vazio: 1 fetch e 1 put;
  - (c) snapshot sem jogo na janela e `t` no minuto 17 UTC: 0 fetch;
  - (d) igual a (c), mas no minuto 0: 1 fetch;
  - (e) ao vivo, dados iguais e `fetchedAt` de 2 min atrás: 1 fetch e 0 put;
  - (f) ao vivo, dados iguais e `fetchedAt` de 5 min atrás: 1 put;
  - (g) ao vivo, com um placar mudado: 1 put, e o KV passa a ter o placar novo e `fetchedAt = t`;
  - (h) fonte respondendo 429: 0 put e sem exceção para fora (`console.warn` chamado);
  - (i) fora de jogo, dados iguais e `fetchedAt` de 59 min atrás no minuto 0: 0 put;
  - (j) igual a (i), com 60 min: 1 put.
- [X] T006 [P] [US2] Ajustar `tests/worker/data.test.ts` para o `getData` novo, que só lê o KV:
  - com cache e token, `fetch` **não** é chamado;
  - `stale` aparece quando `now − fetchedAt > STALE_LIVE_MS` (ao vivo) ou `> STALE_IDLE_MS` (fora), e não aparece abaixo disso;
  - com KV vazio e token, faz partida a frio (1 fetch e 1 put via `waitUntil`), e se ela falhar responde 502 `{ error }`;
  - o caso demo continua igual.

  Remover os testes que esperavam busca na fonte quando o cache passava de 1 h.
- [X] T007 [P] [US2] Em `tests/worker/scheduled.test.ts`, acrescentar a simulação de um dia de rodada (SC-002, SC-003):
  - **Fixture**: 10 jogos `TIMED` às 16:00, 16:00, 18:30, 18:30, 19:00, 20:00, 21:30, 21:30, 21:30 e 21:30 UTC.
  - **Fonte falsa**: a cada chamada devolve os jogos com status e placar em função do relógio. `IN_PLAY` do início até +45 min, `PAUSED` até +60, `IN_PLAY` até +110 e `FINISHED` depois. Um gol para o mandante aos +20 e aos +80.
  - **Execução**: rodar `refresh` 1.440 vezes, de minuto em minuto, a partir de 00:00 UTC.
  - **Asserções**: `put` < 700, `fetch` ≤ 1 por minuto, e no fim do dia todos os jogos estão `FINISHED` no KV.

### Implementation for User Story 2

- [X] T008 [US2] Criar `src/worker/refresh.ts` com `export async function refresh(env: Env, t: number): Promise<void>`, seguindo contracts/scheduled.md passo a passo:
  1. Sem `env.FOOTBALL_DATA_TOKEN`, retorna.
  2. Lê `snap = await env.CACHE.get<DataPayload>(CACHE_KEY, 'json')`.
  3. `live = snap ? isLiveWindow(snap.matches, t) : true`.
  4. Se `!live && new Date(t).getUTCMinutes() !== 0`, retorna.
  5. Chama `next = await fetchSource(token)` dentro de `try`. Em caso de erro, faz `console.warn` e retorna.
  6. Ajusta `next.fetchedAt = t`.
  7. `changed = !snap || JSON.stringify(snap.matches) !== JSON.stringify(next.matches)`.
  8. `beat = isLiveWindow(next.matches, t) ? HEARTBEAT_LIVE_MS : HEARTBEAT_IDLE_MS`.
  9. Se `changed || t − snap.fetchedAt ≥ beat`, faz `await env.CACHE.put(CACHE_KEY, JSON.stringify(next))`.

  Comentário de cabeçalho no estilo de `data.ts`, citando contracts/scheduled.md. Deve fazer T005 e T007 passarem.
- [X] T009 [US2] Em `src/worker/index.ts`, adicionar `scheduled(controller, env, ctx) { ctx.waitUntil(refresh(env, controller.scheduledTime)); }` ao objeto exportado, que continua com `satisfies ExportedHandler<Env>`.
- [X] T010 [US2] Em `wrangler.jsonc`, acrescentar `"triggers": { "crons": ["* * * * *"] }`, com um comentário curto: "o único que consulta a football-data.org; ver specs/002-atualizacao-por-minuto". Rodar `npm run cf-typegen` se os tipos mudarem.
- [X] T011 [US2] Reescrever `getData` em `src/worker/data.ts` (contracts/api-data.md, research.md D4/D5):
  - **Sem token**: modo demo, igual a hoje.
  - **Lê o KV**: `cached = await env.CACHE.get<DataPayload>(CACHE_KEY, 'json')`.
  - **Com cache**:
    - `live = isLiveWindow(cached.matches, Date.now())`;
    - `stale = Date.now() − cached.fetchedAt > (live ? STALE_LIVE_MS : STALE_IDLE_MS)`;
    - responde `json(stale ? { ...cached, stale: true } : cached, live)`.
  - **Sem cache** (partida a frio): `fetchSource`, `ctx.waitUntil(put)`, responde. Se der erro, `502 { error }`.
  - **Remover**: `TTL_MS`.
- [X] T012 [US2] Atualizar os comentários de `fetchedAt` e `stale` em `src/shared/api.ts` para o significado novo (contracts/api-data.md). Os tipos não mudam.

**Checkpoint**: o servidor confere a fonte a cada minuto durante jogos, com o KV dentro do limite. `/api/data` já entrega dados de ~1 min, e quem recarregar a página vê o placar novo.

---

## Phase 4: User Story 1 - Placar e veredito novos durante o jogo (Priority: P1)

**Goal**: com jogo ao vivo, a página aberta busca de novo a cada 60 s e atualiza placar, tabela, veredito e % de queda sem recarregar. Os palpites são preservados (FR-006, FR-008).

**Independent Test**: quickstart.md §3, passos 1, 2 e 5. Com dados em janela ao vivo, há `GET /api/data` a cada ~60 s, e os palpites e o selo "MODO SIMULAÇÃO" continuam depois de cada busca.

### Tests for User Story 1

- [X] T013 [P] [US1] Em `tests/worker/data.test.ts`, verificar o `cache-control`: `public, max-age=30` quando o snapshot está em janela ao vivo e `public, max-age=300` fora dela (research.md D7). O caso demo continua `max-age=300`.

### Implementation for User Story 1

- [X] T014 [US1] Em `src/worker/data.ts`, a função `json(body, status?, live?)` passa a emitir `cache-control: public, max-age=${live ? 30 : 300}`. Passar `live` a partir de `getData`.
- [X] T015 [US1] Em `src/client/hooks/useMatchData.ts`, extrair a busca para `load()` estável (`useCallback` ou função dentro do efeito):
  - **Sucesso**: igual a hoje (`setRaw`, `setErr(!!d.stale)`, `saveCachedData`).
  - **Falha**: se já existe `raw`, mantém o `raw` e faz `setErr(true)`. Se não existe, usa `loadCachedData()` como hoje.
- [X] T016 [US1] No mesmo `useMatchData.ts`, chamar `load()` dentro do tique de 60 s que já existe (`POLL_MS` de `src/domain/live.ts`) quando `raw` existe, `isLiveWindow(raw.matches, Date.now())` e `document.visibilityState === 'visible'`. Usar uma `ref` para o `raw` atual, para que o intervalo não precise ser recriado. Não tocar em `loadPredictions`/`savePredictions`: os palpites vivem em outro estado e continuam aplicados porque `prepare` roda de novo pelo `useMemo` (FR-008).
- [X] T017 [US1] Conferir na mão (quickstart.md §3) que, com palpites feitos, um jogo que vira `FINISHED` no polling passa a usar o placar real, como já acontece ao recarregar (spec, US1 cenário 3). Se não acontecer, corrigir em `src/domain/predictions.ts` ou `src/domain/prepare.ts` e cobrir com teste em `tests/domain/`.

**Checkpoint**: com um jogo rolando, deixar a página aberta mostra o gol em ~1,5 min em média e ≤ 3 min no pior caso, sem recarregar (SC-001).

---

## Phase 5: User Story 3 - Página parada não gasta à toa (Priority: P2)

**Goal**: aba em segundo plano ou sem jogo não faz polling. Ao voltar a ficar visível, busca uma vez na hora (FR-007, SC-005).

**Independent Test**: quickstart.md §3, passos 3 e 4.

- [X] T018 [US3] Em `src/client/hooks/useMatchData.ts`, registrar `document.addEventListener('visibilitychange', ...)`. Quando passar a `visible` e `raw` estiver em janela ao vivo, chamar `load()` na hora. Remover o listener no cleanup do efeito.
- [X] T019 [US3] Garantir no mesmo hook que o tique de 60 s **não** chama `load()` com a aba oculta ou fora da janela ao vivo (a condição do T016). Revisar se o `setNow` de minuto em minuto continua sem causar requisição.

**Checkpoint**: a aba oculta por 3 min não faz nenhuma requisição, e ao voltar faz 1 requisição imediata. Fora de jogo, não há requisição periódica.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Atualizar `README.md` (seção de dados/cache) e `PRODUCT.md` (se mencionar cache de 1 hora): "~1 min durante jogos, 1 h fora, via Cron Trigger; KV gravado só quando muda". Acrescentar o link para specs/002.
- [ ] T021 [P] Opcional (FR-010), **não feito nesta rodada** (o visual segue idêntico): mostrar "atualizado há N min" discreto a partir de `raw.fetchedAt` e `now`, no rodapé ou na linha de status que já existe (`status(...)` em `HomePage.tsx`/`TeamPage.tsx`). Não pode competir com o veredito (princípio I). Se mudar o visual, atualizar o baseline com `npm run test:visual -- --update-snapshots` só para as telas afetadas, conferindo o diff.
- [X] T022 Rodar `npm run check` (typecheck, lint, format e testes) e `npm run test:visual`. Tudo deve ficar verde, e o visual idêntico se o T021 não for feito.
- [X] T023 Validar o cron localmente (quickstart.md §2): `npx wrangler dev --test-scheduled` + `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"` e conferir o log. **Encerrar o `wrangler dev` no fim** (processos órfãos no Windows).
- [ ] T024 **Pendente: aguardando OK do usuário.** Deploy (`npm run deploy`) só com o OK do usuário. Depois, conferir no dashboard (quickstart.md §4): Cron events a cada minuto sem erro e gravações do KV no dia < 700.

---

## Dependencies & Execution Order

- **Setup (T001)**: não depende de nada.
- **Foundational (T002–T004)**: depende do Setup e bloqueia todas as stories.
- **US2 (T005–T012)**: depende do Foundational. **Vem primeiro**: sem ela, o servidor não tem dados frescos sem estourar o KV.
- **US1 (T013–T017)**: depende de US2, porque o polling só faz sentido com `/api/data` fresco e o `cache-control` depende do `getData` novo.
- **US3 (T018–T019)**: depende de US1 (mesmo hook e mesma condição de polling).
- **Polish (T020–T024)**: depende das stories desejadas. O T024 exige o OK do usuário.

### Within each story

Testes antes da implementação: T005–T007 antes de T008–T011, e T013 antes de T014.

### Parallel Opportunities

- **Foundational**: T002 em paralelo com T004 (arquivos diferentes). O T003 depende do T002.
- **US2**: T005, T006 e T007 em paralelo. O T007 está no mesmo arquivo do T005: escrever em sequência se for o mesmo agente. T009 e T010 em paralelo depois do T008. T011 e T012 em paralelo.
- **Polish**: T020 e T021 em paralelo.

## Parallel Example: User Story 2

```text
Task: "T005 casos unitários do refresh em tests/worker/scheduled.test.ts"
Task: "T006 getData só lê KV em tests/worker/data.test.ts"
# depois de T008:
Task: "T009 export scheduled em src/worker/index.ts"
Task: "T010 cron em wrangler.jsonc"
```

## Implementation Strategy

### MVP

Fazer o Setup, o Foundational e a US2. Isso já resolve o problema principal: quem abre ou recarrega a página durante um jogo vê dados de ~1 min, sem estourar nenhum limite. Dá para publicar aqui.

### Incremental

1. Somar a US1: a página atualiza sozinha.
2. Somar a US3: polling econômico com aba oculta.
3. Polish: README, "atualizado há" opcional, validação e deploy.

Cada passo pode ser publicado sozinho sem quebrar o anterior.
