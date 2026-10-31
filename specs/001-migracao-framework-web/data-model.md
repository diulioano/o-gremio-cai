# Data Model: Migração para framework web componentizado

Nenhum dado novo. Este documento só tipa o que já existe. Os nomes de campo do contrato de rede e do `localStorage` **não mudam** (FR-002/FR-003). Os nomes internos de domínio ficam mais legíveis.

## Team (registro estático) — `src/shared/teams.ts`

| Campo | Tipo | Regra |
|-------|------|-------|
| `slug` (chave) | `TeamSlug` = `'gremio' \| 'inter' \| 'corinthians' \| 'vasco' \| 'botafogo' \| 'coritiba' \| 'vitoria' \| 'mirassol' \| 'remo'` | Usado na URL `/<slug>` e no escudo `/<slug>.svg` |
| `id` | `number` | id da football-data.org. **Identificação principal** |
| `code` | `string` | Sigla. Só serve de reserva para os dados demo (ids fictícios) |
| `art` | `'O' \| 'A'` | Artigo de "O [time] cai?" |
| `name` | `string` | Nome de exibição |
| `accent` | `string` (cor CSS) | **Nunca vermelho nem verde** (constituição I) |
| `halo` | `string` (cor CSS) | Cor do clube, usada no halo do escudo |
| `bg` | `string` (gradiente CSS) | Listras de fundo |

Ordem de inserção = ordem do rodapé. Helper: `ask(team) → "O Grêmio cai?"`. Teste: nenhum `accent` pode estar na faixa de matiz vermelha ou verde.

## Contrato de rede — `src/shared/api.ts`

Ver [contracts/api-data.md](./contracts/api-data.md). Tipos: `SlimTeam`, `SlimMatch`, `ApiStatus`, `DataPayload`, `DataError`.

## Domínio — `src/domain/`

### Match (preparado)
`{ id, round, home: TeamId, away: TeamId, status: 'fin' | 'live' | 'fut', postponed, homeGoals, awayGoals, utc }`

Mapeamento de `ApiStatus`: FINISHED/AWARDED → `fin` (vira `fut` se não tiver placar); IN_PLAY/PAUSED/LIVE → `live`; SCHEDULED/TIMED/POSTPONED/SUSPENDED → `fut`. Status desconhecido ou time sem id: o jogo é descartado.

### StandingRow
`{ id, name, code, crest, pts, j, v, e, d, gp, gc, sg }`

Ordem (`compareStandings`): pontos ↓, vitórias ↓, saldo ↓, gols pró ↓, nome (localeCompare) ↑.

### Prepared (`prepare(payload, team?)`)
`{ teams, matches, ids, base, rounds, first, last, current, lambda(home, away) → [λh, λa], gid }`

- `current`: a primeira rodada com algum jogo não encerrado e não adiado. Se não houver, a última rodada.
- Força: `att/def = (gols + K·avg) / (jogos + K) / avg`, com `K = 5`.
- `gid`: o time da página, achado por `id` e, na falta, por `code`.

### Prediction (palpite)
`Record<matchId, { h: 0..9, a: 0..9, auto?: 1 }>`

Transições:

| Ação | Efeito |
|------|--------|
| `pick(V\|E\|D)` | `{1,0}` / `{1,1}` / `{0,1}`, remove `auto` |
| `step(side, ±1)` | ajusta só aquele lado, entre 0 e 9, remove `auto` |
| `setValue(side, text)` | último dígito digitado, vazio = 0, remove `auto` |
| `fill(games, rng)` | sorteia por Poisson(λ) até 9 os jogos `fut` sem palpite **ou** com `auto`. Palpites manuais ficam |
| `clear(id)` / `clearRound` / `clearAll` | remove |

Só vale para jogos `fut`. O selo "MODO SIMULAÇÃO" aparece quando existe ≥1 palpite.

### SimulationResult
`{ table: StandingRow[], pct: Record<TeamId, 0..1>, dec: Record<TeamId, 'salvo' | 'reb' | null> }`

- Sem jogos restantes: a posição final decide (`pct` = 0 ou 1).
- Com jogos restantes: 5000 iterações, `mulberry(42)`, desempate final aleatório. `salvo` se menos de 4 times ainda conseguem alcançá-lo; `reb` se ≥4 já passaram do máximo que ele pode fazer.

### Verdict
`{ yes: pos > n-4, pos, pts, pctLabel, gapText, badge: 'SALVO MATEMATICAMENTE' | 'REBAIXADO' | null }`

`pctLabel`: `salvo` → `0%`, `reb` → `100%`, `<0.01` → `<1%`, `>0.99` → `>99%`, nos outros casos arredondado.

## Persistência no navegador — `src/client/lib/storage.ts`

Ver [contracts/browser-storage.md](./contracts/browser-storage.md).
