# Data Model: Votação "Quem você acha que cai?"

## No banco (D1 `vaicair-votos`, binding `DB`)

Migração `migrations/0001_votos.sql`:

```sql
-- um voto por aparelho/navegador; voter é um UUID aleatório gerado no navegador
CREATE TABLE votes (
  voter   TEXT PRIMARY KEY,
  t1      INTEGER NOT NULL,
  t2      INTEGER NOT NULL,
  t3      INTEGER NOT NULL,
  at      INTEGER NOT NULL          -- epoch ms
) WITHOUT ROWID;

-- contagem pronta: team_id = id da football-data; team_id = 0 guarda o total de votantes
CREATE TABLE tally (
  team_id INTEGER PRIMARY KEY,
  n       INTEGER NOT NULL DEFAULT 0
);

-- votos por dia (UTC, 'YYYY-MM-DD'), para o teto diário
CREATE TABLE daily (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

CREATE TRIGGER count_vote AFTER INSERT ON votes BEGIN
  INSERT INTO tally (team_id, n) VALUES (0, 1), (NEW.t1, 1), (NEW.t2, 1), (NEW.t3, 1)
    ON CONFLICT (team_id) DO UPDATE SET n = n + 1;
  INSERT INTO daily (day, n) VALUES (strftime('%Y-%m-%d', NEW.at / 1000, 'unixepoch'), 1)
    ON CONFLICT (day) DO UPDATE SET n = n + 1;
END;
```

| Entidade (spec) | Onde | Regras |
|-----------------|------|--------|
| **Voto** | `votes` | `voter` único (FR-006). `t1..t3` são 3 ids distintos de `TEAMS`, validados pelo Worker antes do `INSERT` (FR-008). Não tem IP, nome nem e-mail (SC-007). Nunca é atualizado nem apagado pela aplicação (FR-007: voto definitivo). |
| **Resultado da votação** | `tally` | Só muda pelo trigger, na mesma transação do voto. `tally[0]` é o total de votantes. Times sem voto não têm linha e contam como 0. |
| (operacional) Contador diário | `daily` | Lido antes de cada `INSERT`. Com `n >= DAILY_CAP`, o voto é recusado com 503. |

**Linhas gravadas por voto**: 6 (1 voto + 4 tally + 1 daily). **Lidas por voto**: ~2 (daily + checagem da chave). **Lidas por GET**: até 11.

## No domínio (`src/domain/votes.ts`, puro e testado)

```ts
export const PICKS = 3;            // vagas que sobram no Z4 (a Chapecoense já caiu)
export const MIN_VOTES = 10;       // abaixo disso, "votação começando"
export const DAILY_CAP = 10_000;   // votos/dia (UTC): 60 mil linhas, 60% do limite do D1

ballotError(picks: unknown): string | null
//  null se for um array de exatamente 3 ids inteiros, distintos e em TEAMS; senão, a mensagem em pt-BR

votingClosesAt(matches: readonly SlimMatch[]): number | null
//  menor Date.parse(utc) entre os jogos do maior md; null se não houver jogos

crowdResult(counts: Record<number, number>, total: number): CrowdResult
//  total < MIN_VOTES → { total, warmingUp: true }
//  senão → { total, rows: [{ id, slug, votes, pct }] } com os 9 times de TEAMS,
//          pct = round(100 * votes / total), ordem: votes desc, depois nome
```

## Estados da votação (o que a tela mostra)

```text
                ┌──────────── votação aberta (now < closesAt) ────────────┐
 sem voto local → FORMULÁRIO ──confirmar──► ENVIANDO ──201/409──► VOTOU (seu palpite + resultado)
                      ▲                        │
                      └──── erro / 429 / 503 ──┘   (mantém os 3 marcados, mostra o motivo)

 votação fechada (now >= closesAt) → ENCERRADA (resultado final para todos; quem votou vê os seus destacados)
```

- Em VOTOU e ENCERRADA, com `total < 10`, o resultado aparece como "votação começando".
- O 409 (já votou, por exemplo em outra aba) leva a VOTOU. Os times mostrados como "seu palpite" são os que o servidor devolve.

## No navegador (`localStorage`)

Nova chave `vaicair-voto-v1` (ver [contracts/browser-storage.md](./contracts/browser-storage.md)):

```ts
{ voter: string /* UUID */, picks?: [number, number, number], at?: number }
```

- `voter` é criado na primeira vez que a votação aparece e não muda depois.
- `picks` e `at` são gravados só depois de uma resposta 201 ou 409 do servidor (nunca antes: FR-003, FR-004).
