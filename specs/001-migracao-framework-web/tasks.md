---

description: "Task list for 001-migracao-framework-web"
---

# Tasks: Migração para framework web componentizado

**Input**: Design documents from `specs/001-migracao-framework-web/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUÍDOS. A spec exige testes do domínio (FR-013, SC-006), paridade visual (SC-001) e rotas do Worker (FR-002).

**Organization**: tarefas agrupadas por user story. Linhas citadas como `public/app.js:N-M` e `src/index.js:N-M` se referem à versão antiga (tag `pre-migracao`; a partir de T026/T028 os arquivos saem da árvore, então ler com `git show pre-migracao:<arquivo>`) e são a fonte do port. **Regra geral do port: não mudar texto, cor, tamanho, ordem nem algoritmo.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 = paridade para o visitante, US2 = estrutura para o desenvolvedor, US3 = testes do domínio

## Path Conventions

Projeto único na raiz: `src/shared`, `src/domain`, `src/worker`, `src/client`, `tests/`. Ver plan.md → Project Structure.

---

## Phase 1: Setup (baseline + tooling)

**Purpose**: congelar a versão atual como referência e montar o esqueleto do projeto novo.

- [ ] T001 Iniciar o repositório: `git init`. Acrescentar `dist/`, `test-results/`, `playwright-report/` e `.vite/` em `.gitignore`. Commitar o estado atual como "versão antiga", criar a tag `pre-migracao` e a branch `001-migracao-framework-web`. Conferir que `.dev.vars` NÃO entra no commit.
- [ ] T002 Instalar o Playwright na versão antiga (`npm i -D @playwright/test@^1.64` e `npx playwright install chromium`) e criar `tests/visual/fixtures/palpites.json` com um conjunto fixo de palpites para os jogos futuros da rodada 31 e 32 dos dados demo (ids 305–320; ex.: `{"305":{"h":2,"a":0},"306":{"h":1,"a":1},...}`, só placares 0–9, sem `auto`).
- [ ] T003 Criar `tests/visual/capture-fixtures.mjs`: em Node, importar `demoData()` de `src/demo.js` e gravar `tests/domain/fixtures/demo-payload.json` com `{ ...demoData(), demo: true, fetchedAt: 0 }`. Depois, com Playwright contra a versão antiga (`npx wrangler dev --port 8787`), abrir `/gremio` e, via `page.evaluate`, chamar as funções globais `prepare(payload)` e `compute(P, {})` / `compute(P, palpites)` do `public/app.js`. Gravar `tests/domain/fixtures/demo-expected.json` com `{ real: {table:[ids em ordem], pts, pct, dec}, comPalpites: {...} }`. Rodar o script e commitar as fixtures.
- [ ] T004 Criar `tests/visual/parity.spec.ts` e `playwright.config.ts`:
  - **Config**: `baseURL` vem de `process.env.BASE_URL` (padrão `http://localhost:8787`); `snapshotPathTemplate: 'tests/visual/__baseline__/{arg}{ext}'`; `reducedMotion: 'reduce'`; projetos `mobile` (390×844, `isMobile`) e `desktop` (1440×900).
  - **Interceptação de dados**: `page.route('**/api/data')` responde com `tests/domain/fixtures/demo-payload.json`, para que os dados não dependam do token.
  - **Telas**: para cada página (`/` + os 9 slugs) × estado (sem palpites; com `palpites.json` injetado via `addInitScript` em `localStorage['gremiocai-palpites-v1']`), esperar `document.fonts.ready` e o texto "Dados de demonstração" e tirar `toHaveScreenshot('<slug|home>-<estado>-<projeto>.png', { fullPage: true, maxDiffPixelRatio: 0.01 })`.
- [ ] T005 Gerar o baseline contra a versão antiga: `npx wrangler dev --port 8787` + `npx playwright test tests/visual/parity.spec.ts --update-snapshots`. Conferir os 40 PNGs em `tests/visual/__baseline__/` e commitar.
- [ ] T006 Instalar as dependências novas em `package.json` (versões de research.md):
  - **runtime**: `preact@^10`
  - **dev**: `vite@^8`, `@preact/preset-vite`, `@cloudflare/vite-plugin@^1.66`, `wrangler@^4.154`, `typescript@~6.0`, `@cloudflare/workers-types`, `vitest@^4.1`, `@cloudflare/vitest-pool-workers@^0.23`, `eslint@^10`, `typescript-eslint@^8.72`, `eslint-plugin-react-hooks@^7`, `prettier@^3`
  - **scripts**: `dev: vite`, `build: vite build`, `preview: vite preview`, `deploy: npm run build && wrangler deploy`, `typecheck: tsc -b`, `lint: eslint .`, `format: prettier -w .`, `format:check: prettier -c .`, `test: vite build && vitest run` (os testes do Worker precisam de `dist/client` para o binding `ASSETS`), `test:visual: playwright test tests/visual/parity.spec.ts`, `check: npm run typecheck && npm run lint && npm run format:check && npm test`, `cf-typegen: wrangler types`
- [ ] T007 [P] Criar `tsconfig.json` (solution, com `references`) e `tsconfig.client.json`, `tsconfig.worker.json` e `tsconfig.node.json`:
  - **Em todos**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, `module: ESNext`, `moduleResolution: Bundler`, `verbatimModuleSyntax`.
  - **client**: `jsx: react-jsx`, `jsxImportSource: preact`, `lib: DOM`, include `src/client`, `src/domain`, `src/shared` e `tests/types/client-contract.ts`.
  - **worker**: types `@cloudflare/workers-types` + `worker-configuration.d.ts`, include `src/worker`, `src/shared`, `tests/worker` e `tests/types/worker-contract.ts`. Sem `lib: DOM`: por isso nada em `src/shared` pode usar APIs de navegador.
  - **node**: os arquivos de config, `tests/domain`, `tests/structure.test.ts` e `tests/visual`, com `lib: ["ES2023", "DOM"]` (o `storage.test.ts` importa `src/client/lib/storage.ts`, que usa `localStorage`).
- [ ] T008 [P] Criar `eslint.config.js` (flat):
  - **Base**: `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` com `parserOptions.projectService`, e `eslint-plugin-react-hooks` `recommended` em `src/client/**`.
  - **Fronteiras com `no-restricted-imports`**: `src/domain/**` não pode importar `preact*`, `src/client/**` nem `src/worker/**`; `src/shared/**` não pode importar nada de `src/client`, `src/worker` nem `src/domain`, nem usar `localStorage`/`window`/`document` (`no-restricted-globals`).
  - **Ignorar**: `dist`, `tests/visual/__baseline__` e `public`.
- [ ] T009 [P] Criar `.prettierrc` (`{"singleQuote":true,"semi":true,"printWidth":110,"trailingComma":"all"}`) e `.prettierignore` (`dist`, `public/*.svg`, `specs`, `.specify`, `package-lock.json`, `tests/**/fixtures/*.json`).
- [ ] T010 Criar `vite.config.ts` com `plugins: [preact(), cloudflare()]` e atualizar `wrangler.jsonc`:
  - **Mudanças**: `main: "src/worker/index.ts"`; `assets.directory` passa de `./public` para `./dist/client` (a saída do build do cliente). O plugin usa essa pasta no deploy, e o `vitest-pool-workers` precisa dela para criar o binding `ASSETS` nos testes.
  - **Manter iguais**: `assets.binding: "ASSETS"`, `assets.run_worker_first: ["/*", "!/*.*"]`, `routes`, `kv_namespaces`, `workers_dev` e `compatibility_date`.
  - **Depois**: rodar `npm run cf-typegen` para gerar `worker-configuration.d.ts` (Env com `ASSETS`, `CACHE` e `FOOTBALL_DATA_TOKEN`).
- [ ] T011 [P] Criar `vitest.config.ts` com `test.projects`: `domain` (environment node, `tests/domain/**/*.test.ts`) e `worker` (`defineWorkersProject` de `@cloudflare/vitest-pool-workers`, `wrangler.configPath: ./wrangler.jsonc`, `tests/worker/**/*.test.ts`, miniflare com binding `FOOTBALL_DATA_TOKEN` vazio). A checagem de tipos do contrato fica com o `tsc -b` (T061), não com o Vitest.

**Checkpoint**: baseline visual e fixtures commitados na tag/branch. `npm install` funciona. A versão antiga continua intacta e no ar.

---

## Phase 2: Foundational (shared + domínio + Worker)

**Purpose**: a base que toda a UI usa. Nenhum componente começa antes desta fase.

### Shared e armazenamento

- [ ] T012 [P] Criar `src/shared/teams.ts` portando `TEAMS` de `public/app.js:12-32`:
  - **Tipo**: `TeamSlug` = união literal dos 9 slugs. `Team = { id: number; code: string; art: 'O' | 'A'; name: string; accent: string; halo: string; bg: string }`. Declarar `TEAMS` com `as const satisfies Record<TeamSlug, Team>`, na ordem atual (gremio, inter, corinthians, vasco, botafogo, coritiba, vitoria, mirassol, remo).
  - **Exportar**: `ask(t) => \`${t.art} ${t.name} cai?\`` e `isTeamSlug(s): s is TeamSlug`.
  - **Comentários**: preservar os de `public/app.js:5-11` (identificar por id, accent nunca vermelho nem verde).
- [ ] T013 [P] Criar `src/shared/api.ts` com os tipos exatos de `contracts/api-data.md`: `ApiStatus`, `SlimTeam`, `SlimMatch`, `DataPayload` (`fetchedAt`, `matches`, `demo?: true`, `stale?: true`) e `DataError`.
- [ ] T014 [P] Criar `src/client/lib/storage.ts` (fica no cliente, e não em `shared`, porque usa `localStorage` e `shared` também é compilado no Worker):
  - **Chaves**: `PREDICTIONS_KEY = 'gremiocai-palpites-v1'` e `DATA_KEY = 'gremiocai-dados-v1'`.
  - **Tipos**: `Prediction = { h: number; a: number; auto?: 1 }`, `Predictions = Record<string, Prediction>`.
  - **Funções**: `loadPredictions()`, `savePredictions(p)`, `loadCachedData(): DataPayload | null` e `saveCachedData(d)`, seguindo as regras de `contracts/browser-storage.md`:
    - JSON inválido vira vazio.
    - Uma entrada com "`h`/`a` que não é inteiro entre 0 e 9" é descartada sozinha.
    - `auto` diferente de `1` é ignorado.
    - Dados "sem `matches` em array" contam como ausentes.
    - Toda exceção do `localStorage` é engolida.

### Domínio (puro; mesma ordem de operações do código antigo)

- [ ] T015 [P] Criar `src/domain/rng.ts`: `mulberry(seed): () => number` (cópia exata de `public/app.js:61-68`) e `drawGoals(lambda, rng = Math.random)` (de `public/app.js:163`, limite 9).
- [ ] T016 [P] Criar `src/domain/format.ts`:
  - **Funções portadas**: `when(utc)` e `roundRange(games)` (de `public/app.js:38-59`, fuso `America/Sao_Paulo`, mantendo o truque `dtf` en-US → `WD`/`MO` pt-BR); `pctLabel(p, dec)` (de `:158`: `salvo`→`0%`, `reb`→`100%`, `<0.01`→`<1%`, `>0.99`→`>99%`); `signed(n)` (de `:415`, com o sinal `−` U+2212); `hm(ts)` (de `:160`).
  - **Funções novas**: `timeAgo(mins)` e `games(n)`. A primeira gera os textos "agora" / "há N min" / "há N h" de `:207`; a segunda gera "N jogo(s)" de `:440`.
- [ ] T017 [P] Criar `src/domain/standings.ts`: tipo `StandingRow` (`id, name, code, crest, pts, j, v, e, d, gp, gc, sg`), `play(h, a, x, y)` (de `public/app.js:73-76`) e `compareStandings` (de `:71`; ordem "pontos ↓, vitórias ↓, saldo ↓, gols pró ↓, nome (localeCompare) ↑").
- [ ] T018 Criar `src/domain/prepare.ts` portando `prepare` de `public/app.js:41,78-104` como `prepare(payload: DataPayload, team: Team | null): Prepared`:
  - **Tipos**: `Match` e `Prepared` conforme data-model.md. O `team` deixa de vir de global e passa a ser parâmetro.
  - **Mapa `STATUS`**: igual ao de `:41`; "FINISHED/AWARDED → `fin` (vira `fut` se não tiver placar)". Status desconhecido ou time sem id: o jogo é descartado.
  - **`findId`**: porta de `:37`; procura pelo id e, na falta, pela sigla.
  - **Força**: `K = 5`, médias padrão 1.4/1.0.
  - **`current`**: a primeira rodada com algum jogo não encerrado e não adiado. Se não houver, a última rodada.
  - **Nomes**: os campos do jogo podem ganhar nomes legíveis (`round`, `home`, `away`, `homeGoals`, `awayGoals`), desde que todos os consumidores sejam atualizados.
- [ ] T019 Criar `src/domain/simulate.ts` portando `compute` de `public/app.js:106-156` como `simulate(P, predictions, rng = mulberry(42)): SimulationResult`, separando internamente `computeTable(P, predictions)` (tabela com palpites, só para jogos `fut`) e `decide(...)` (salvo/reb). Constante exportada `N_SIM = 5000`.
  - **CRÍTICO**: manter exatamente a ordem de consumo do RNG para os % não mudarem:
    1. Um único `rng` por chamada.
    2. Em cada iteração, primeiro `pois` para cada jogo restante (mandante, depois visitante).
    3. Depois `n` sorteios de `tie`, na ordem de `ids`.
  - **Sem jogos restantes**: aplicar a regra de `:141-145`.
- [ ] T020 [P] Criar `src/domain/verdict.ts`: `verdict(result, gid)` → `{ yes, pos, row, pctLabel, ctxRest, badge }`, com os textos exatos de `public/app.js:381-391`:
  - `"de chance de cair · {pos}º lugar · {gap} pt(s) para sair do Z4"`, ou `"fora do Z4 só no desempate"` quando o gap é 0.
  - `"... {gap} pt(s) acima do Z4"`, ou `"à frente do Z4 no desempate"` quando o gap é 0.
  - O selo é `'SALVO MATEMATICAMENTE' | 'REBAIXADO' | null`.
  - **Exportar também** `homeCards(P, result)`, a montagem e ordenação dos cartões da home de `:247-255`: ordem por `p` decrescente, depois `pos` decrescente; `yes = pos > n-4`.
- [ ] T021 [P] Criar `src/domain/predictions.ts` com funções imutáveis (recebem `Predictions` e devolvem uma cópia nova) portadas de `public/app.js:416-438`:
  - `pick(p, id, 'V'|'E'|'D')` → `{1,0}`/`{1,1}`/`{0,1}`.
  - `step(p, id, side, ±1)` e `setValue(p, id, side, text)`: limitam o placar entre 0 e 9, usam o último dígito digitado e removem `auto`.
  - `fill(p, games, lambda, rng?)`: sorteia só os jogos `fut` sem palpite ou com `auto`.
  - `clear(p, id)`, `clearRound(p, games)`.
  - `missingIn(games, p)` e `incompleteRounds(P, p)`.
  - `outcome(pred)` → `'V'|'E'|'D'`.
- [ ] T022 Criar `tests/domain/parity.test.ts`. Ele carrega `fixtures/demo-payload.json`, roda `simulate(prepare(payload, null), {})` e `simulate(..., palpites.json)` e compara com `fixtures/demo-expected.json`: ordem da tabela, pontos, `pct` **exatamente iguais** e `dec`. Rodar `npm test` até passar. Este é o portão da fase.

### Worker

- [ ] T023 [P] Portar `src/demo.js` para `src/worker/demo.ts` tipado (retorna `DataPayload` sem `demo`). Não pode haver mudança no algoritmo nem nas sementes.
- [ ] T024 [P] Criar `src/worker/data.ts` portando `data`, `slim` e `json` de `src/index.js:39-80`:
  - **Assinatura**: `getData(env: Env, ctx: ExecutionContext): Promise<Response>`.
  - **Tipos**: `slim(raw): DataPayload`, com tipo mínimo da resposta da football-data.
  - **Constantes**: as mesmas `API`, `TTL_MS` (1h) e `KEY = 'bsa-matches-v1'`.
  - **Headers**: os mesmos `content-type` e `cache-control: public, max-age=300`.
- [ ] T025 [P] Criar `src/worker/team-page.ts` portando `teamPage` de `src/index.js:28-37`. O título vem de `ask(TEAMS[slug])` de `src/shared/teams.ts`. O resto do HTMLRewriter não muda: `html[data-team]`, `title`, `meta[property="og:title"]` e `link[rel="icon"]` → `/<slug>.svg`.
- [ ] T026 Criar `src/worker/index.ts` portando o roteamento de `src/index.js:16-26` (redirect 301 dos subdomínios `^[oa]-([a-z-]+)-cai\.` → `SITE/<slug|''>`, `/api/data`, `/<slug>` com trim de barras e minúsculas, senão `env.ASSETS.fetch`) usando `isTeamSlug`. `export default { fetch } satisfies ExportedHandler<Env>`. Ao terminar, apagar `src/index.js` e `src/demo.js` (o original fica na tag `pre-migracao`).

### Entrada e estilos globais

- [ ] T027 [P] Criar `src/client/styles/tokens.css`, `global.css` e `animations.css` movendo **sem alterar** o `<style>` de `public/index.html:16-40`:
  - **tokens.css**: `[data-theme="dark"]` e `[data-font="archivo"]`.
  - **global.css**: reset, links, botões, `:focus-visible`, `::selection`, scrollbar, `.sr`, `.ico`, `.card` e os inputs number.
  - **animations.css**: os keyframes `stamp`, `glowpulse`, `livedot` e `shimmer`, e o bloco `prefers-reduced-motion`.
- [ ] T028 Criar `index.html` na raiz (entrada do Vite) copiando o `<head>` de `public/index.html:1-14` (lang, meta, og, theme-color, favicon inline e preconnect/link da fonte Archivo), sem o `<style>` e sem os `<script>` do unpkg. O body fica com `<div id="app"></div>` + `<script type="module" src="/src/client/main.tsx"></script>`. **Na mesma tarefa**, apagar `public/index.html` e `public/app.js`: o Vite copia tudo de `public/` para o build e para o `vite dev`, e a página antiga conflitaria com a nova. O original fica na tag `pre-migracao` e é a fonte do port (`git show pre-migracao:public/app.js`).

**Checkpoint**: `npm run typecheck` passa para shared, domain e worker. `parity.test.ts` está verde. O Worker novo sobe com `npm run dev` e responde `/api/data`.

---

## Phase 3: User Story 1 — Visitante usa o site exatamente como antes (P1) 🎯 MVP

**Goal**: a versão nova, componentizada, é visualmente e funcionalmente idêntica à antiga.

**Independent Test**: `npm run test:visual` (40 comparações com o baseline) + as checagens manuais do quickstart §5.

### Tests for User Story 1 ⚠️ (escrever primeiro; devem falhar até a UI existir)

- [ ] T029 [P] [US1] Criar `tests/worker/routes.test.ts` (pool de workers, `SELF.fetch`), cobrindo a tabela "rotas HTML" de `contracts/api-data.md`:
  - host `o-inter-cai.diuliano.com` → 301 para `https://vaicair.diuliano.com/inter`
  - `a-xyz-cai.diuliano.com` → 301 para `/`
  - `/Gremio/` → 200 com `data-team="gremio"`, `<title>O Grêmio cai?</title>`, `og:title` e favicon `/gremio.svg`
  - `/` → sem `data-team`
  - `/flamengo` → mesmo status da versão antiga (conferir antes com `npx wrangler dev` na tag `pre-migracao` e anotar no teste; hoje deve ser 404)
- [ ] T030 [P] [US1] Criar `tests/worker/data.test.ts`:
  - sem token → 200 e `demo: true`
  - headers `content-type` e `cache-control: public, max-age=300`
  - com token e cópia no KV de menos de 1h → devolve a cópia sem `fetch` (mock com `fetchMock`)
  - fetch falha com cópia no KV → `stale: true`
  - fetch falha sem cópia → 502 `{ error }`
  - `slim` mapeia `shortName || name` e `score.fullTime`
- [ ] T031 [US1] Apontar `playwright.config.ts` para a versão nova: `webServer: { command: 'npm run build && npm run preview -- --port 8787', url: 'http://localhost:8787', reuseExistingServer: true }`. Não atualizar snapshots: a versão nova é comparada com o baseline da antiga.

### Hooks

- [ ] T032 [P] [US1] Criar `src/client/hooks/useViewport.ts` → `{ width, mobile: width < 768, wide: width >= 1100 }`, com listener de `resize` (de `public/app.js:185,196-197,348`).
- [ ] T033 [P] [US1] Criar `src/client/hooks/useMatchData.ts` portando `useData` de `public/app.js:182-203`: fetch `/api/data`, `saveCachedData`/`loadCachedData` na falha, `err` (incluindo `stale`), `now` atualizado a cada 60 s e `P = useMemo(prepare(raw, team))`. Recebe `team: Team | null`.
- [ ] T034 [P] [US1] Criar `src/client/hooks/usePredictions.ts`: estado inicial `loadPredictions()`, `update(fn)` que aplica uma função pura de `src/domain/predictions.ts`, salva com `savePredictions` e chama um callback `beforeChange` (usado pelo FLIP). Expõe `predictions`, `isSim` e as ações `pick`, `step`, `setValue`, `fill`, `clear`, `clearRound` e `clearAll`.
- [ ] T035 [P] [US1] Criar `src/client/hooks/useFlipRows.ts` portando o FLIP de `public/app.js:335-346` e `:370-371`: `capture()` grava o `top` de cada `[data-team]`; `useLayoutEffect` anima `translateY` com 320 ms e `cubic-bezier(.2,.8,.2,1)`, e respeita `prefers-reduced-motion`.
- [ ] T036 [P] [US1] Criar `src/client/hooks/usePinnedBar.ts` portando `public/app.js:350-367`. Retorna `{ pin: 'top' | 'bottom' | null, bandOut }` a partir de `heroRef`, `rootRef`, `gid` e `mobile`.

### Componentes comuns (`src/client/components/common/`, cada um `X.tsx` + `X.module.css`)

- [ ] T037 [P] [US1] `Icon.tsx`: paths `prev`/`next`/`close`/`warn`/`dice` e props `name`, `size` e `strokeWidth`, de `public/app.js:165-170`.
- [ ] T038 [P] [US1] `Crest.tsx`: escudo com fallback de sigla quando a imagem falha (`hideImg`), de `public/app.js:159,442-446`. Props: `team` e `size`.
- [ ] T039 [P] [US1] `StatusBar.tsx` + `src/client/lib/status.ts`. `status()` vem de `public/app.js:205-214`, com os textos "Dados de demonstração", "Sem conexão · dados de HH:MM", "Carregando dados…", "Atualizado …" e " · Rodada X de Y". A barra vem de `:229-236`, com um slot `right`.
- [ ] T040 [P] [US1] `Footer.tsx`: nav de times a partir de `TEAMS` (com `aria-current`), avisos e o texto de `N_SIM.toLocaleString('pt-BR')` simulações, de `public/app.js:216-227`. Prop: `currentSlug`.
- [ ] T041 [P] [US1] `LoadFailed.tsx` (de `public/app.js:173-177`, com o botão "Tentar de novo") e `Skeleton.tsx` (bloco com `shimmer`, com props `height`, `width` e `delay`).

### Home (`src/client/components/home/`)

- [ ] T042 [P] [US1] `TeamCard.tsx`: as 3 variações (`tall`/`big`/`small`) com as medidas de `public/app.js:263-285`, `aria-label` igual, SIM/NÃO usando `--danger`/`--safe` e listras `team.bg`/halo via custom properties.
- [ ] T043 [P] [US1] `Z4Divider.tsx`: a linha tracejada "Z4 Linha da queda" de `public/app.js:288-295`.
- [ ] T044 [US1] `HomePage.tsx`: hero "Quem vai cair?" + subtítulo, "Na briga" + "Tabela atual" / "Tabela real, sem os seus palpites", skeletons, grade dos SIM (colunas só se `cw / sims.length >= 320`), `Z4Divider`, grade dos NÃO, "Nenhum time da lista está no Z4 hoje." e `Footer`. Fonte: `public/app.js:240-321`; dados de `homeCards()`.

### Página do time (`src/client/components/team/`)

- [ ] T045 [P] [US1] `VerdictHero.tsx`: escudo HD + halo, pergunta `ask(team)`, palavra SIM/NÃO/? com `stamp` + `glowpulse` (só no SIM), glows vermelho/verde, selo rotacionado, texto `aria-live` e contexto (% + `ctxRest`), skeleton/`LoadFailed` ("Não achamos …" quando falta `gid`) e o link "ver tabela ↓". Layouts celular e desktop de `public/app.js:392-394` e `:497-563`. Recebe `heroRef`.
- [ ] T046 [P] [US1] `SimulationBanner.tsx` + `IncompleteRoundsAlert.tsx`: a faixa amarela "MODO SIMULAÇÃO / resposta baseada nos seus palpites / Voltar ao real" e o alerta de rodadas incompletas com o botão "Ver rodada N", de `public/app.js:525-535`.
- [ ] T047 [P] [US1] `StandingsRow.tsx`: grade `cols` celular/desktop, faixa de zona (Libertadores/Pré/Z4), fundo do time da página ou do Z4 ou zebrado, borda tracejada na linha 17, setas ▲/▼ com `aria-label`, % + barra e rótulo "Z4". Usa `data-team={id}` para o FLIP. Fonte: `public/app.js:399-412` e `:583-602`.
- [ ] T048 [US1] `StandingsTable.tsx` + `StandingsLegend.tsx`: cabeçalho "Classificação" / "Tabela simulada|atual", `role="table"`, linha de cabeçalho (Pos, Clube, P, J/V/E/D só no desktop, SG, % queda), 8 skeletons e a legenda. Fonte: `public/app.js:567-609`.
- [ ] T049 [P] [US1] `ScoreInput.tsx`: input number 0–9, `inputMode="numeric"`, placeholder "–", borda `--warn` quando há palpite, botões −/+ de 44×40 só no celular, mesmos `aria-label`. Fonte: `public/app.js:448-454`.
- [ ] T050 [P] [US1] `OutcomePicker.tsx`: os 3 botões (mandante, "Empate" e visitante) com `aria-pressed` e o estilo ativo/inativo de `public/app.js:419-420,482-487`.
- [ ] T051 [US1] `MatchCard.tsx`: meta (Encerrado/Em andamento/Adiado/data), AO VIVO com `livedot`, rótulo "Palpite"/"Sorteado" + botão apagar, linhas mandante/visitante com `Crest` e o placar ou `ScoreInput`, `OutcomePicker`, e borda tracejada/`--warn` quando a rodada está incompleta. Fonte: `public/app.js:456-489`.
- [ ] T052 [P] [US1] `RoundNav.tsx`: botões anterior/próxima (44×44, desabilitados nas pontas com opacidade .35), "Rodada N" e `roundRange`. Fonte: `public/app.js:617-624`.
- [ ] T053 [US1] `MatchesPanel.tsx`: título "Jogos" / "Palpite = simule o resultado", `RoundNav`, o botão "Simular até o fim"/"Sortear de novo" + o texto de ajuda, o alerta "Falta(m) N jogo(s) nesta rodada" + "Sortear os que faltam", "Limpar palpites desta rodada" e a lista ordenada (jogos do time da página primeiro, depois por horário). Sticky no `wide`, com `id="jogos"`. Fonte: `public/app.js:421-440` e `:611-643`.
- [ ] T054 [P] [US1] `PinnedVerdictBar.tsx`: a barra fixa no topo ou no rodapé com posição, escudo, nome (se `width >= 360`), pts, % e o botão "Cai? SIM/NÃO" que rola para o topo. Mesmo `aria-label` de `public/app.js:648-659`.
- [ ] T055 [US1] `TeamPage.tsx`: compõe `StatusBar` (com o selo e o "Voltar ao real" à direita quando `isSim && bandOut`, e o texto escondido no celular nesse caso), `VerdictHero`, `SimulationBanner`, `<main>` com grade `3fr/2fr` no `wide`, `StandingsTable`, `MatchesPanel`, `Footer` e `PinnedVerdictBar`. Usa `--accent: team.accent` no root. Liga `useMatchData`, `usePredictions` (com `beforeChange = flip.capture`), `useFlipRows`, `usePinnedBar` e `useMemo` de `simulate` (real e com palpites). Fonte: `public/app.js:323-333,375-396,491-495,510-519,644-661`.
- [ ] T056 [US1] Criar `src/client/main.tsx`: importa os 3 CSS globais, lê `document.documentElement.dataset.team`, valida com `isTeamSlug` e faz `render(<TeamPage team=... slug=... />)` ou `render(<HomePage />)` em `#app`.

### Paridade

- [ ] T057 [US1] Rodar `npm run build` e `npm run test:visual`. Para cada diferença acima de 1%, corrigir o CSS Module ou o componente até as 40 comparações passarem. **Não** atualizar o baseline.
- [ ] T058 [US1] Fazer as checagens manuais de `quickstart.md` §5:
  1. Palpites feitos na versão antiga continuam na nova, na mesma origem `localhost:8787`.
  2. Com "reduzir movimento" ligado, não há animação.
  3. A barra fixa aparece embaixo no desktop e em cima no celular.
  4. Com Fast 4G, o veredito aparece em tempo igual ou menor que na versão antiga.

  Anotar os resultados em `specs/001-migracao-framework-web/checklists/parity.md`.

**Checkpoint**: US1 completa. O site novo é indistinguível do antigo, mas **ainda não é publicado**: a publicação espera o lint zerado (US2) e os testes do domínio (US3).

---

## Phase 4: User Story 2 — Desenvolvedor altera uma parte sem mexer no resto (P2)

**Goal**: garantir e documentar a fonte única, o contrato tipado e o tamanho e responsabilidade dos componentes.

**Independent Test**: `npm run check` passa. `tests/structure.test.ts` passa. Seguindo o README, alguém consegue adicionar um time editando só `src/shared/teams.ts` + o SVG.

### Tests for User Story 2 ⚠️

- [ ] T059 [P] [US2] Criar `tests/domain/teams.test.ts`:
  - **Unicidade**: slugs, ids e códigos únicos.
  - **Formato**: `art ∈ {'O','A'}`; `ask()` gera "O Grêmio cai?".
  - **Cor**: nenhum `accent` pode ser vermelho ou verde (converter hex→HSL e falhar se a saturação passar de 0.35 e a matiz estiver em [345°,15°] ou [90°,160°]).
  - **Escudo**: cada slug tem `public/<slug>.svg`.
- [ ] T060 [P] [US2] Criar `tests/structure.test.ts` (projeto `domain`):
  - **Tamanho**: nenhum arquivo em `src/client/**/*.tsx` passa de 200 linhas (SC-004).
  - **Fonte única**: a string `'Grêmio'` e o id `1767` aparecem como dado só em `src/shared/teams.ts`, desconsiderando testes, fixtures e `src/worker/demo.ts` (SC-005).
  - **Arquivos antigos**: `public/app.js`, `public/index.html`, `src/index.js` e `src/demo.js` não existem (apagados em T026 e T028).
- [ ] T061 [P] [US2] Criar as checagens de tipo do contrato (FR-011), verificadas pelo `npm run typecheck` (`tsc -b`):
  - `tests/types/worker-contract.ts` (no tsconfig do Worker): com um helper `type Equal<A, B>`, afirmar que `ReturnType<typeof slim>` é igual a `DataPayload` e que o corpo de `getData` é `DataPayload | DataError`.
  - `tests/types/client-contract.ts` (no tsconfig do cliente): afirmar que o `raw` de `useMatchData` e o retorno de `loadCachedData` são `DataPayload | null`.
  - **Prova**: mudar temporariamente um campo em `src/shared/api.ts` e confirmar que o `typecheck` falha; desfazer.

### Implementation for User Story 2

- [ ] T062 [US2] Conferir que o Worker (`src/worker/index.ts`, `team-page.ts`) e o cliente (`main.tsx`, `Footer.tsx`, `HomePage.tsx`) leem os times **só** de `src/shared/teams.ts`. Remover qualquer mapa local de slugs que tenha sobrado do port.
- [ ] T063 [US2] Rodar `npm run lint` e corrigir todas as violações (inclusive `react-hooks/exhaustive-deps`: a dependência `palKey` de `public/app.js:331-333` vira dependência direta de `predictions`). Rodar `npm run format` e commitar.
- [ ] T064 [US2] Criar `README.md`. Seções:
  - **Visão geral**: o que é o site, com link para `PRODUCT.md`.
  - **Comandos**: `dev`, `build`, `check`, `test`, `test:visual` e `deploy`.
  - **Estrutura de pastas**: `shared`, `domain`, `worker` e `client`, com a regra de fronteira de cada um.
  - **Como adicionar ou remover um time**: editar `src/shared/teams.ts` e o SVG em `public/`.
  - **Como atualizar o baseline visual**: só quando a mudança visual for intencional.
  - **Aviso de `workerd` órfão no Windows**.

**Checkpoint**: US2 completa. Estrutura e fronteiras são garantidas por testes e pelo lint.

---

## Phase 5: User Story 3 — A lógica de simulação tem testes automatizados (P3)

**Goal**: cobertura do domínio além do teste de paridade.

**Independent Test**: `npx vitest run --project domain` verde, cobrindo classificação, desempate, palpites, veredito e simulação com semente fixa.

- [ ] T065 [P] [US3] `tests/domain/standings.test.ts`:
  - **`play`**: vitória, empate e derrota atualizam `pts/j/v/e/d/gp/gc/sg`.
  - **`compareStandings`**: desempata na ordem "pontos ↓, vitórias ↓, saldo ↓, gols pró ↓, nome (localeCompare) ↑", com um caso para cada critério.
- [ ] T066 [P] [US3] `tests/domain/prepare.test.ts`: mapeamento de status, incluindo FINISHED sem placar → `fut` e status desconhecido descartado; jogo com time sem id descartado; `current` ignora rodada antiga com jogo adiado; `gid` por id e, na falta, por `code` (Coritiba demo 90002 vs `TEAMS.coritiba.id` 4241); `lambda` > 0.
- [ ] T067 [P] [US3] `tests/domain/simulate.test.ts`:
  - **Determinismo**: a mesma entrada com `mulberry(42)` dá resultado idêntico duas vezes.
  - **Fim do campeonato**: sem jogos restantes, `pct ∈ {0,1}` e `dec` sai da posição.
  - **`salvo`**: o caso em que menos de 4 times conseguem alcançar.
  - **`reb`**: o caso em que 4 ou mais times já passaram do máximo possível.
  - **Palpites**: só valem em jogos `fut`; em jogo `fin` são ignorados.
- [ ] T068 [P] [US3] `tests/domain/verdict.test.ts` e `format.test.ts`:
  - **Veredito**: 17º → SIM, 16º → NÃO; textos de gap no singular e no plural e os casos de desempate; selos.
  - **`pctLabel`**: os 6 casos.
  - **Outros formatos**: `signed`, com o sinal `−`; `roundRange` no mesmo dia, mesmo mês e entre meses; `timeAgo`.
  - **`homeCards`**: ordenação.
- [ ] T069 [P] [US3] `tests/domain/predictions.test.ts`:
  - **`pick`**: V/E/D dão os placares padrão.
  - **`step`**: limita entre 0 e 9 e remove `auto`.
  - **`setValue`**: usa o último dígito, e vazio vira 0.
  - **`fill`** (com rng fixo): mantém palpite manual, refaz `auto` e preenche os vazios; ignora jogos não `fut`.
  - **Funções puras**: nenhuma muta a entrada.
  - **Contagem**: `missingIn` e `incompleteRounds`.
- [ ] T070 [P] [US3] `tests/domain/storage.test.ts` (testa `src/client/lib/storage.ts` com `localStorage` falso) e `tests/worker/demo.test.ts`.
  - **storage.test.ts**:
    - JSON inválido → `{}`.
    - Entrada com `h: 12` ou `"a": "x"` → descartada, e as outras ficam.
    - `auto: 2` → campo removido.
    - `localStorage` que lança erro → leitura vazia e escrita sem erro.
  - **demo.test.ts**: `demoData().matches` é idêntico a `fixtures/demo-payload.json` `.matches` (o port não mudou os dados demo).

**Checkpoint**: as 3 user stories estão completas.

---

## Phase 6: Polish & publicação

- [ ] T071 Conferir que não sobrou nada da versão antiga (`public/` só com os 9 SVGs; `src/` só com `shared`, `domain`, `worker` e `client`). Rodar `npm run check` e `npm run test:visual`, que precisam passar sem erro. **Portão da publicação.**
- [ ] T072 [P] Medir o bundle (`npm run build`, tamanho gzip de `dist/client/assets/*.js`). A meta é ≤ ~25 KB. Anotar em `checklists/parity.md`.
- [ ] T073 [P] Atualizar `PRODUCT.md` → "Capabilities and Constraints":
  - "Front-end em JS puro" passa a "Preact + TypeScript, componentizado (`src/client`)".
  - A frase sobre a lista de times em dois lugares passa a "lista única em `src/shared/teams.ts`".
  - Os caminhos `src/index.js`/`src/demo.js` passam a `src/worker/`.
- [ ] T074 Publicar sem indisponibilidade. **Pré-requisito**: T071 verde, ou seja, US1, US2 e US3 completas, `npm run check` e `npm run test:visual` passando (constituição II e IV: nada vai para produção com lint ou testes do domínio pendentes).
  1. `npm run build && npx wrangler versions upload`.
  2. No URL de preview, validar quickstart §5 e os subdomínios antigos (via `curl -I -H "Host: o-gremio-cai.diuliano.com"` no preview, ou direto em produção logo após o deploy).
  3. `npx wrangler versions deploy` para 100%.
  4. Conferir `vaicair.diuliano.com`, `/gremio` e `o-inter-cai.diuliano.com` (301).

  Se der problema, `npx wrangler rollback`.
- [ ] T075 Commitar e criar a tag `pos-migracao`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003 → T004 → T005, nesta ordem, porque o baseline usa a versão antiga e as fixtures. T006 vem depois de T005. T007–T011 dependem de T006 e podem rodar em paralelo entre si (T010 depois de T006).
- **Foundational (Phase 2)**: depende da Setup. T018 depende de T012, T013 e T017. T019 depende de T015, T017 e T018. T022 depende de T019 e é o **portão**. T024, T025 e T026 dependem de T012 e T013. T026 depende de T024 e T025.
- **US1 (Phase 3)**: depende da Phase 2 inteira. É o MVP.
- **US2 (Phase 4)**: depende da US1, porque verifica a estrutura final da UI. T059 e T061 podem começar logo após a Phase 2.
- **US3 (Phase 5)**: depende **só** da Phase 2. Pode rodar em paralelo com a US1.
- **Polish (Phase 6)**: depende da US1, da US2 e da US3. T071 é o portão; T074 (deploy) só depois dele.

### Within User Story 1

Testes T029–T031 → hooks T032–T036 → comuns T037–T041 → home T042–T044 → time T045–T055 → T056 → paridade T057–T058. Na página do time: T047 → T048; T049 e T050 → T051; T051 e T052 → T053; tudo isso → T055.

### Parallel Opportunities

- Setup: T007, T008, T009 e T011.
- Foundational: T012–T017 todas [P]. T020, T021, T023, T025 e T027 também.
- US1: os 5 hooks em paralelo, os 5 comuns em paralelo, T042/T043 e T045/T046/T047/T049/T050/T052/T054.
- US3 inteira (T065–T070) em paralelo com a US1.

## Parallel Example: User Story 1

```text
# Depois da Phase 2, num lote só:
T032 useViewport.ts   T033 useMatchData.ts   T034 usePredictions.ts   T035 useFlipRows.ts   T036 usePinnedBar.ts
# Depois, num lote só:
T037 Icon  T038 Crest  T039 StatusBar  T040 Footer  T041 LoadFailed/Skeleton
# Folhas da página do time, num lote só:
T045 VerdictHero  T046 SimulationBanner  T047 StandingsRow  T049 ScoreInput  T050 OutcomePicker  T052 RoundNav  T054 PinnedVerdictBar
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: baseline congelado (sem isso, não dá para provar a paridade).
2. Phase 2 até `parity.test.ts` ficar verde: os números estão garantidos antes de qualquer pixel.
3. Phase 3 até `test:visual` passar. **Parar e validar** localmente.

### Entrega

A US1 é o MVP para validar, mas a publicação é uma só, no fim:

1. US1 validada localmente.
2. US2 (lint 100%, testes de estrutura, contrato de tipos, README) e US3 (testes do domínio). São poucas tarefas, e a US3 pode correr em paralelo com a US1.
3. T071 (portão: `check` + `test:visual`) → T074 (deploy com preview e rollback).
4. Base pronta para a próxima spec (votador "quem vai cair").

## Notes

- Commitar ao fim de cada tarefa ou grupo lógico.
- Nunca usar `--update-snapshots` depois de T005. Se uma diferença visual for intencional, ela pertence a outra feature.
- Se `parity.test.ts` ou `test:visual` falhar, quem está errado é o port, não o baseline.
