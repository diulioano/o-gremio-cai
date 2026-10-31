# Quickstart: validar a atualização de minuto em minuto

Pré-requisitos: `npm ci`; `.dev.vars` com `FOOTBALL_DATA_TOKEN` (para os passos com dados reais).

## 1. Portão automático

```sh
npm run check
```

Precisa incluir e passar:

- `tests/domain/live.test.ts`: janela ao vivo (antes de 15 min, dentro, depois de 3 h, `FINISHED`/`POSTPONED`, `PAUSED` fora do horário).
- `tests/worker/scheduled.test.ts`:
  - fora de jogo e minuto ≠ 0: nenhuma chamada à fonte;
  - ao vivo: 1 chamada;
  - dados iguais dentro do pulso: 0 gravações;
  - dados mudados: 1 gravação;
  - pulso vencido: 1 gravação;
  - fonte 429: 0 gravações.
- `tests/worker/data.test.ts`: `stale` pela idade (15 min ao vivo / 3 h fora), `cache-control` 30 ou 300, partida a frio com o KV vazio.
- Simulação de um dia de rodada (`scheduled` chamado 1.440 vezes com uma tabela de jogos fictícia): menos de 700 gravações e no máximo 1 busca por minuto (SC-002, SC-003).

## 2. Cron local

```sh
npx wrangler dev --test-scheduled
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
curl -s http://localhost:8787/api/data | head -c 200
```

O esperado:

- Com jogo no ar ou dentro da janela, o log mostra a busca.
- Fora de jogo e fora do minuto 0, não há busca.

> No Windows, encerre o `wrangler dev` ao terminar (ver nota de deploy sobre processos órfãos).

## 3. Polling no navegador

1. `npm run dev`, abrir `/gremio` com DevTools → Network.
2. Com dados demo/fixture em janela ao vivo: aparece `GET /api/data` a cada ~60 s.
3. Trocar de aba por 3 min: nenhuma requisição. Voltar: 1 requisição imediata.
4. Fora de janela: nenhuma requisição periódica.
5. Com palpites feitos, esperar um polling: palpites e selo "MODO SIMULAÇÃO" permanecem.

## 4. Produção (dia de rodada)

- Dashboard Cloudflare → Workers → o-gremio-cai → Cron events: execuções a cada minuto, sem erros.
- KV → métricas: gravações do dia < 700.
- Com um jogo rolando, deixar a página aberta e comparar o placar com outra fonte: diferença ≤ 3 min além do atraso da própria fonte.
