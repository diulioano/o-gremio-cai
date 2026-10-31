# Implementation Plan: Migração para framework web componentizado

**Branch**: `001-migracao-framework-web` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-migracao-framework-web/spec.md`

## Summary

Trocar o script único (`public/app.js`, Preact + htm via CDN, 663 linhas, estilos inline) e o Worker em JS por um projeto **Preact 10 + TypeScript + Vite** com o **`@cloudflare/vite-plugin`**. Os pontos principais:

- Componentes em arquivos próprios com CSS Modules.
- Lógica de domínio pura e testada em `src/domain/`.
- Lista de times e contrato `/api/data` em `src/shared/`, usados pelo Worker e pelo cliente.
- Lint, formatação e testes (Vitest + pool de Workers + Playwright visual).

**Sem mudança de comportamento.** O algoritmo, as constantes, as chaves de `localStorage`, as rotas e o visual ficam idênticos, e uma comparação visual automatizada contra um baseline da versão atual garante isso. Detalhes em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`), ESM. Node 24 para tooling.

**Primary Dependencies**: Preact 10.x, Vite 8, `@preact/preset-vite`, `@cloudflare/vite-plugin` ≥1.66, Wrangler ≥4.154.

**Storage**: Cloudflare KV `CACHE` (inalterado, TTL lógico 1h). `localStorage` do navegador (chaves inalteradas).

**Testing**: Vitest 4.x (projeto `domain` em node + projeto `worker` com `@cloudflare/vitest-plugin` 1.4). Playwright 1.6x para regressão visual.

**Target Platform**: Cloudflare Workers + Static Assets. Navegadores modernos, foco em celular (iOS Safari, Chrome Android).

**Project Type**: web app (Worker de borda + SPA de cliente no mesmo projeto).

**Performance Goals**: veredito na tela em tempo ≤ ao atual em 4G (SC-003). Bundle do cliente ≤ ~25 KB gzip. Simulação (5000 iterações) sem regressão.

**Constraints**: paridade visual e funcional total. Zero indisponibilidade no deploy. Fonte única para os times. Nenhum arquivo de UI acima de ~200 linhas.

**Scale/Scope**: 2 telas (home, time), ~18 componentes, ~10 módulos de domínio, 1 Worker com 3 rotas. Tráfego de pico em dia de rodada, coberto pelo cache de 1h do KV.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | Status |
|-----------|---------------------|--------|
| I. Veredito primeiro, SIM vermelho / NÃO verde | O visual não muda. Os tokens `--danger`/`--safe` são centralizados. Um teste garante que nenhum `accent` de time é vermelho ou verde | ✅ |
| II. Rigor nos números | `src/domain/` é puro e testado. O algoritmo e a semente são idênticos, e um teste de fixture compara com as % da versão antiga. Os times são achados por `id` | ✅ |
| III. Componentizado e fonte única | ~18 componentes com CSS Module. `src/shared/teams.ts` é a única lista. `src/shared/api.ts` tipa o contrato | ✅ |
| IV. Boas práticas da linguagem | TS strict, ESLint `strictTypeChecked` + react-hooks, Prettier e `npm run check` | ✅ |
| V. Justo, leve e para celular | Preact no bundle (sai o CDN externo), mesmas regras para os 9 times, `prefers-reduced-motion` preservado, PT-BR | ✅ |
| Restrições (Workers, cache 1h, sem números inventados) | Mesma hospedagem e mesma lógica de cache | ✅ |

**Re-check pós-design**: ✅ Nenhuma violação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-migracao-framework-web/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-data.md          # GET /api/data + rotas HTML
│   └── browser-storage.md   # chaves do localStorage
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
index.html                        # entrada do Vite (meta, fontes; o CSS sai daqui e vai para styles/)
vite.config.ts                    # preact() + cloudflare()
wrangler.jsonc                    # main → src/worker/index.ts; rotas, KV e run_worker_first inalterados
tsconfig.json                     # referências: client / worker / node (tooling)
eslint.config.js · .prettierrc · vitest.config.ts · playwright.config.ts

public/                           # escudos SVG dos 9 times (inalterados)

src/
├── shared/                       # importado por Worker e cliente
│   ├── teams.ts                  # TEAMS, TeamSlug, ask()
│   └── api.ts                    # DataPayload, SlimMatch, SlimTeam, DataError
│
├── domain/                       # puro: sem DOM, sem Preact
│   ├── rng.ts                    # mulberry, poisson
│   ├── prepare.ts                # payload → Prepared (status, força, rodadas, gid)
│   ├── standings.ts              # play, compareStandings, computeTable
│   ├── simulate.ts               # Monte Carlo (N_SIM=5000, seed 42) + decide()
│   ├── verdict.ts                # SIM/NÃO, gap, badge
│   ├── predictions.ts            # pick, step, setValue, fill, clear*, missingIn
│   └── format.ts                 # pctLabel, when, roundRange, signed, timeAgo
│
├── worker/
│   ├── index.ts                  # roteamento (redirect, /api/data, /<slug>, assets)
│   ├── data.ts                   # fetch + KV + slim + fallback stale
│   ├── team-page.ts              # HTMLRewriter
│   └── demo.ts                   # dados de demonstração
│
└── client/
    ├── main.tsx                  # lê data-team, monta <HomePage/> ou <TeamPage/>
    ├── styles/                   # tokens.css, global.css, animations.css
    ├── lib/                      # storage.ts (chaves + parse defensivo do localStorage), status.ts
    ├── hooks/
    │   ├── useMatchData.ts       # fetch /api/data + cópia local + relógio
    │   ├── useViewport.ts        # largura, mobile/wide
    │   ├── usePredictions.ts     # estado + persistência + ações do domínio
    │   ├── useFlipRows.ts        # animação FLIP das linhas
    │   └── usePinnedBar.ts       # quando fixar a barra (topo/rodapé)
    ├── components/
    │   ├── common/               # Icon, Crest, StatusBar, Footer, LoadFailed, Skeleton
    │   ├── home/                 # HomePage, TeamCard, Z4Divider
    │   └── team/                 # TeamPage, VerdictHero, SimulationBanner, IncompleteRoundsAlert,
    │                             # StandingsTable, StandingsRow, StandingsLegend,
    │                             # MatchesPanel, RoundNav, MatchCard, ScoreInput, OutcomePicker,
    │                             # PinnedVerdictBar
    └── (cada componente: Nome.tsx + Nome.module.css)

tests/
├── domain/                       # *.test.ts (Vitest, node)
│   └── fixtures/                 # payload demo + % esperadas, gravadas da versão antiga
├── worker/                       # *.test.ts (vitest-plugin)
└── visual/                       # *.spec.ts (Playwright) + __baseline__/
```

**Structure Decision**: um projeto só, com Worker e cliente lado a lado em `src/`, unidos pelo `@cloudflare/vite-plugin`. `src/shared/` é a única fronteira compartilhada. `src/domain/` não importa nada de `client/` nem de `worker/`, e uma regra do ESLint (`no-restricted-imports`) garante isso. `src/shared/` não usa APIs de navegador nem de Worker, porque é compilado nos dois lados. Os arquivos antigos saem assim que o substituto existe (ficam guardados na tag `pre-migracao`): `src/index.js` e `src/demo.js` quando o Worker novo fica pronto, e `public/index.html` e `public/app.js` quando o `index.html` do Vite é criado. Isso evita que o Vite copie a página antiga de `public/` para o build.

## Estratégia de execução (ordem)

1. **Baseline**: `git init`, commit da versão atual, tag `pre-migracao`. Gravar a fixture de % do modo demo com o `compute` antigo. Capturar os screenshots baseline (Playwright contra a versão antiga).
2. **Esqueleto**: Vite + TS + Preact + plugin Cloudflare + lint/format/test. O app antigo continua servido até o passo 5.
3. **Shared + Worker**: portar `src/index.js`/`demo.js` para TS usando `shared/teams.ts` e apagar os originais. Testes do Worker.
4. **Domínio**: extrair as funções puras de `app.js` para `src/domain/` sem mudar o algoritmo. Testes, incluindo a fixture de paridade.
5. **UI**: trocar a entrada para o `index.html` do Vite (apagando `public/index.html` e `public/app.js`) e montar os componentes de baixo para cima (common → home → team), estilos inline → CSS Modules.
6. **Paridade**: `test:visual` contra o baseline, depois as checagens manuais do [quickstart](./quickstart.md).
7. **Fechamento**: lint e formatação zerados (US2) e testes do domínio (US3). Só então `npm run check` + `test:visual` verdes.
8. **Deploy**: `versions upload` → preview → `versions deploy`. Nada vai para produção com o `check` vermelho (constituição II e IV).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Pequenas diferenças de % por mudança na ordem de consumo do RNG | Fixture de paridade com a saída exata do `compute` antigo |
| Diferença visual ao trocar inline → CSS Modules (especificidade, ordem) | Baseline Playwright em 2 tamanhos × com/sem palpites; corrigir até passar |
| Media queries trocando decisões que hoje são feitas em JS | Só trocar onde o DOM não muda; manter `useViewport` onde a estrutura muda |
| Testes do Worker sem o binding `ASSETS` | `wrangler.jsonc` mantém `assets.directory: "./dist/client"`; `npm test` roda o build antes |
| `workerd` órfão no Windows no `vite dev` | Documentado no quickstart; um processo só |
| Deploy no meio de uma rodada | Preview via `versions upload`; `wrangler rollback` |

## Complexity Tracking

Nenhuma violação da constituição.
