# Implementation Plan: Atualização de minuto em minuto durante os jogos

**Branch**: `002-atualizacao-por-minuto` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-atualizacao-por-minuto/spec.md`

## Summary

Um **Cron Trigger de minuto em minuto** passa a ser o único que consulta a football-data.org:

- **Com jogo na janela ao vivo** (15 min antes do início até o fim, com teto de 3 h): consulta a cada minuto.
- **Fora de jogo**: consulta 1 vez por hora.

O cron grava no KV **só quando os dados mudam** ou quando vence um pulso (5 min ao vivo, 60 min fora). Isso dá no máximo ~180 gravações por dia, contra o limite de 1.000.

O `/api/data` passa a só ler o KV. Ele calcula `stale` pela idade do dado e devolve `cache-control` curto ao vivo.

A página busca de novo a cada 60 s só com jogo ao vivo e aba visível.

A regra "está ao vivo?" fica numa função de domínio única, usada pelo cron e pelo cliente. Decisões e contas em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`), ESM. Node 24 para tooling.

**Primary Dependencies**: Preact 10, Vite 8, `@cloudflare/vite-plugin`, Wrangler 4. Nenhuma dependência nova.

**Storage**: KV `CACHE` (mesma chave `bsa-matches-v1`, mesmo formato; muda a política de gravação) e `localStorage` (inalterado).

**Testing**: Vitest:
- projeto `domain`: `live.test.ts`;
- projeto `worker`: `scheduled.test.ts` e ajustes em `data.test.ts`, incluindo a simulação de um dia de 1.440 execuções.

O teste visual do Playwright não deve mudar.

**Target Platform**: Cloudflare Workers Free (Cron Triggers, KV), navegadores de celular.

**Project Type**: web app (Worker + SPA), estrutura existente.

**Performance Goals**: gol na tela em ~1,5 min em média e ≤ 3 min no pior caso, sem contar o atraso da fonte (SC-001).

**Constraints**:
- ≤ 1 consulta por minuto à fonte (limite: 10);
- < 700 gravações por dia no KV (limite: 1.000);
- requisições bem abaixo de 100 mil por dia;
- zero custo.

**Scale/Scope**:
- 1 handler novo (`scheduled`);
- 1 módulo de domínio novo (`live.ts`);
- mudanças em `src/worker/data.ts`, `src/worker/index.ts`, `src/client/hooks/useMatchData.ts` e `wrangler.jsonc`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | Status |
|-----------|---------------------|--------|
| I. Veredito primeiro | Nada muda no visual. O "atualizado há X min" do FR-010 é opcional e discreto | ✅ |
| II. Rigor nos números | `isLiveWindow` e a regra de gravação são puras e testadas. O `stale` continua avisando quando o dado está velho | ✅ |
| III. Componentizado e fonte única | Uma só `isLiveWindow` e um só conjunto de constantes em `src/domain/live.ts`, usados pelo Worker e pelo cliente. O contrato `/api/data` não muda de formato | ✅ |
| IV. Boas práticas | Handler `scheduled` tipado com `ExportedHandler<Env>`, testes no pool de Workers, `npm run check` | ✅ |
| V. Justo, leve e para celular | O polling só roda com jogo ao vivo e aba visível. Sem dependência nova | ✅ |
| Restrição "cache de 1 hora" | **Alterada por esta spec**: 1 h fora de jogo e ~1 min durante jogo. A constituição foi atualizada para 0.1.1 (PATCH: muda uma restrição, nenhum princípio) | ✅ (emenda) |

**Re-check pós-design**: ✅ Nenhuma violação. A emenda está registrada em `.specify/memory/constitution.md`.

## Project Structure

### Documentation (this feature)

```text
specs/002-atualizacao-por-minuto/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # decisões D1–D8 e contas de limite
├── data-model.md        # snapshot, regra de gravação, janela ao vivo, constantes
├── quickstart.md        # roteiro de validação
├── contracts/
│   ├── api-data.md      # delta de GET /api/data (semântica e cache-control)
│   └── scheduled.md     # comportamento do Cron Trigger
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── live.ts              # NOVO: isLiveWindow + constantes de frescor
├── shared/api.ts            # inalterado (só comentários de fetchedAt/stale)
├── worker/
│   ├── data.ts              # getData lê KV; stale por idade; cache-control dinâmico; fetchSource/slim reaproveitados
│   ├── refresh.ts           # NOVO: handler scheduled (decidir, buscar, comparar, gravar)
│   └── index.ts             # exporta scheduled ao lado de fetch
└── client/hooks/
    └── useMatchData.ts      # load() + polling ao vivo + visibilitychange

tests/
├── domain/live.test.ts      # NOVO
└── worker/
    ├── scheduled.test.ts    # NOVO (inclui simulação de 1 dia)
    └── data.test.ts         # ajustado

wrangler.jsonc               # "triggers": { "crons": ["* * * * *"] }
```

**Structure Decision**: mantém a estrutura da spec 001. O Worker ganha um arquivo (`refresh.ts`) para o caminho agendado, e o domínio ganha `live.ts`.

## Complexity Tracking

Nenhuma violação a justificar.
