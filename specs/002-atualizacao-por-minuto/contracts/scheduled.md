# Contract: handler `scheduled` (Cron Trigger)

Gatilho: `wrangler.jsonc` → `"triggers": { "crons": ["* * * * *"] }`.

A cada execução (`controller.scheduledTime = t`):

1. Sem `FOOTBALL_DATA_TOKEN`: não faz nada.
2. Lê o snapshot `bsa-matches-v1` do KV (pode estar vazio).
3. `live = snapshot ? isLiveWindow(snapshot.matches, t) : true`.
4. Se `!live` e o minuto UTC de `t` ≠ 0: termina (sem chamar a fonte).
5. Busca `GET /v4/competitions/BSA/matches`. Erro/429 → `console.warn` e termina, sem gravar.
6. `next = slim(resposta)`. Grava no KV **somente se**: os `matches` mudaram, **ou** `t − snapshot.fetchedAt ≥ 5 min` (ao vivo; usar `isLiveWindow(next.matches, t)`) / `≥ 60 min` (fora).

Garantias: ≤ 1 consulta à fonte por minuto; ≤ ~200 gravações/dia num dia de rodada (research.md D3).
