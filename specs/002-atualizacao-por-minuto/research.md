# Research: Atualização de minuto em minuto durante os jogos

Limites conferidos em 2026-10-30 nas páginas oficiais:

- **football-data.org grátis**: 10 consultas por minuto, placares "atrasados" (a página não diz quanto).
- **Cloudflare Workers Free**:
  - 100.000 requisições por dia;
  - 5 Cron Triggers por conta;
  - KV com 100.000 leituras e 1.000 gravações por dia, e no máximo 1 gravação por segundo na mesma chave;
  - uma gravação no KV pode levar **até 60 s** para aparecer em outras regiões (`cacheTtl` mínimo de 30 s, padrão de 60 s).

## D1. Quem consulta a fonte: um Cron Trigger de minuto em minuto

**Decision**: um handler `scheduled` com cron `* * * * *` é o **único** que consulta a football-data.org:

- **Com jogo ao vivo**: consulta todo minuto.
- **Fora de jogo**: consulta só no minuto 0 de cada hora (UTC).

As requisições `/api/data` só leem o KV. A exceção é a partida a frio (D5).

**Rationale**:

- Garante no máximo 1 consulta por minuto à fonte, seja qual for o número de visitantes ou de data centers. Isso cumpre o FR-004 e o SC-003 com sobra.
- Com o modelo atual (o primeiro visitante depois do vencimento busca), cada data center do Cloudflare pode buscar por conta própria. O Brasil tem vários data centers, e com TTL de 1 minuto isso poderia passar de 5 consultas por minuto.
- Gasta 1 dos 5 crons da conta, que hoje não usa nenhum. São 1.440 execuções por dia, pouco perto das 100 mil requisições, mesmo que elas contem para o limite (a documentação não diz).

**Alternatives considered**:

- *TTL dinâmico no caminho da requisição (busca quem chegar primeiro)*: é o mais simples. Mas o número de consultas cresce com o número de data centers, e há corrida entre requisições simultâneas.
- *Cache API (`caches.default`) como marca de "conferido agora"*: o cache é de cada data center, então tem o mesmo problema de várias buscas.
- *Durable Object como coordenador*: resolve a coordenação, mas é infraestrutura demais para uma temporada (Constituição, Restrições).

## D2. Quando "tem jogo ao vivo": função de domínio compartilhada

**Decision**: `isLiveWindow(matches, now)` em `src/domain/live.ts` é pura e testada. Devolve `true` se algum jogo:

- está com status `IN_PLAY`, `PAUSED` ou `LIVE`; **ou**
- não está `FINISHED`/`AWARDED`/`POSTPONED`/`CANCELLED`/`SUSPENDED` e `now` está entre `utc − 15 min` e `utc + 3 h`.

O cron (para decidir se consulta) e o cliente (para decidir se faz polling) usam a mesma função.

**Rationale**: a regra vale igual nos dois lados, com fonte única (princípio III). A margem de 3 horas cobre o atraso de começo, o intervalo e os acréscimos, e fecha sozinha se a fonte demorar a marcar `FINISHED`.

**Alternatives considered**: agenda fixa de horários de rodada. Foi descartada porque é frágil com jogos remarcados e porque os horários já vêm na própria fonte.

## D3. Economizar gravações no KV: grava só se mudou, ou por pulso

**Decision**: o cron compara os jogos novos com os do KV, por igualdade do JSON de `matches` já enxuto. Ele grava se:

- (a) algo mudou; **ou**
- (b) o `fetchedAt` guardado tem mais de **5 min** (com jogo ao vivo) ou mais de **60 min** (fora de jogo). É o "pulso" que mostra que a fonte continua sendo conferida.

Conta para um dia de rodada cheio, com jogos ao vivo de 16h às 23h50 (~8 h de janela):

- pulsos na janela: 8 × 12 = 96;
- mudanças: ~7 por jogo (início, intervalo, volta, gols, fim) × 10 = 70, que em geral coincidem com os pulsos;
- pulsos fora da janela: 16 × 1 = 16.

O teto é de **~180 gravações por dia**, abaixo da meta de 700 (SC-002) e muito abaixo do limite de 1.000.

**Rationale**: o `fetchedAt` continua com um significado honesto ("conferido na fonte há no máximo X"), sem custar uma gravação por minuto. O contrato `/api/data` não muda.

**Alternatives considered**:

- *Gravar só quando muda*: aí não dá para distinguir "nada mudou" de "a fonte está fora do ar", e o aviso de dado desatualizado (FR-009) deixa de funcionar.
- *Guardar o "conferido em" nos metadados do KV*: atualizar os metadados também conta como gravação, então não economiza nada.

## D4. Quando o dado é "desatualizado" (`stale`)

**Decision**: o caminho `/api/data` marca `stale: true` quando `now − fetchedAt` passa de:

- **15 min** com jogo ao vivo (3 pulsos perdidos);
- **3 h** fora de jogo.

Se a fonte falhar ou devolver 429, o cron só registra no log e não grava. A próxima tentativa é natural, no minuto seguinte com jogo ao vivo ou na hora seguinte sem jogo. Como as consultas não passam de 1 por minuto, não há como martelar a fonte, e o FR-009 fica cumprido sem um backoff explícito.

**Rationale**: o aviso continua aparecendo quando a fonte cai, como hoje, só que calculado pela idade do dado.

## D5. Partida a frio e modo demo

**Decision**:

- **Sem token**: o modo demo continua igual.
- **Com token e KV vazio** (primeiro deploy, chave apagada): `/api/data` busca direto na fonte uma vez e grava, como hoje. Isso evita uma página vazia até o próximo cron.

**Rationale**: o comportamento atual continua como reserva, e o deploy não precisa de um passo manual.

## D6. Polling no cliente

**Decision**: `useMatchData` passa a ter uma função `load()`.

- Roda ao montar, a cada **60 s** quando `isLiveWindow(raw.matches, now)` e `document.visibilityState === 'visible'`, e uma vez no `visibilitychange` para visível.
- O relógio de 1 minuto que já existe dispara a verificação, então não precisa de um segundo intervalo.
- Os dados novos substituem `raw`. Os palpites ficam no `localStorage` e não são mexidos (FR-008). `prepare` roda de novo pelo `useMemo`.

**Rationale**: o custo em requisições fica proporcional a quem está olhando um jogo ao vivo. Uma aba em segundo plano não gasta nada (SC-005).

**Budget**: 100.000 requisições ÷ (1 por minuto × 60 × 3 h) ≈ 550 pessoas olhando o jogo inteiro no mesmo dia. Hoje sobra bastante. Se o tráfego crescer, o intervalo pode ir para 90 s.

## D7. Cabeçalho de cache HTTP da resposta

**Decision**: o `cache-control` de `/api/data` passa de `max-age=300` fixo para:

- `max-age=30` com jogo ao vivo;
- `max-age=300` fora de jogo.

**Rationale**: com `max-age=300`, o navegador continuaria entregando dados de até 5 minutos e o polling não adiantaria nada.

## D8. Latência real esperada

Caminho de um gol até a tela, depois que a fonte o registra:

- até 60 s até o próximo cron;
- até 60 s para a gravação aparecer em outras regiões do KV;
- até 60 s até o próximo polling da página.

O pior caso é de **~3 min**, e a média fica perto de **1,5 min**. O spec SC-001 foi ajustado para "em média até 2 min, no máximo 3 min", sem contar o atraso da própria fonte grátis.
