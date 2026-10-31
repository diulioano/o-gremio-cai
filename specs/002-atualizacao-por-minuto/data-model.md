# Data Model: Atualização de minuto em minuto

## Snapshot (KV `CACHE`, chave `bsa-matches-v1`)

É o `DataPayload` atual (`src/shared/api.ts`), sem campos novos.

- `fetchedAt` (epoch ms): última vez que a fonte foi conferida **e** o snapshot foi gravado.
- `matches`: lista enxuta (`slim`).

**Regra de gravação** (só o cron grava, exceto na partida a frio):

| Situação | Grava? |
|----------|--------|
| `matches` diferentes dos guardados | sim |
| iguais, ao vivo, `t − fetchedAt ≥ 5 min` | sim (pulso) |
| iguais, fora de jogo, `t − fetchedAt ≥ 60 min` | sim (pulso) |
| iguais, dentro do pulso | não |
| fonte falhou | não |

Igualdade: `JSON.stringify(a.matches) === JSON.stringify(b.matches)`. A ordem é estável porque vem da fonte.

## Janela ao vivo: `isLiveWindow(matches, now): boolean`

Fica em `src/domain/live.ts` e é pura, sem I/O.

- Devolve `true` se algum jogo está com `status ∈ {IN_PLAY, PAUSED, LIVE}`.
- Também devolve `true` se algum jogo tem `status ∉ {FINISHED, AWARDED, POSTPONED, CANCELLED, SUSPENDED}` e `utc − 15 min ≤ now ≤ utc + 3 h`.
- Nos outros casos devolve `false`.

Constantes exportadas: `LIVE_LEAD_MS = 15 min`, `LIVE_TAIL_MS = 3 h`.

## Frescor: constantes em `src/domain/live.ts`

| Nome | Valor | Uso |
|------|-------|-----|
| `HEARTBEAT_LIVE_MS` | 5 min | pulso de gravação ao vivo |
| `HEARTBEAT_IDLE_MS` | 60 min | pulso fora de jogo |
| `STALE_LIVE_MS` | 15 min | `stale` ao vivo |
| `STALE_IDLE_MS` | 3 h | `stale` fora de jogo |
| `POLL_MS` | 60 s | polling do cliente ao vivo |

## Estado do cliente (`useMatchData`)

Os campos atuais (`raw`, `err`, `now`, `P`) continuam. O comportamento muda assim:

- O tique de 60 s chama `load()` se `raw` existe, `isLiveWindow(raw.matches, now)` e a aba está visível.
- O `visibilitychange` para visível chama `load()` uma vez.
- `load()` com falha mantém o `raw` atual e liga `err`, sem apagar dados que já estão na tela.

Os palpites (`gremiocai-palpites-v1`) não são tocados.
