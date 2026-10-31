# Contract: `GET /api/data`

Fonte da verdade em código: `src/shared/api.ts`. O Worker produz e o cliente consome. **Formato idêntico ao atual.**

## 200 OK

Headers: `content-type: application/json; charset=utf-8`, `cache-control: public, max-age=300`.

```ts
type ApiStatus = 'FINISHED' | 'AWARDED' | 'IN_PLAY' | 'PAUSED' | 'LIVE'
  | 'SCHEDULED' | 'TIMED' | 'POSTPONED' | 'SUSPENDED' | (string & {});

interface SlimTeam { id: number | null; name: string; tla: string | null; crest: string | null }

interface SlimMatch {
  id: number;
  md: number;            // rodada
  status: ApiStatus;
  utc: string;           // ISO 8601
  h: SlimTeam;           // mandante
  a: SlimTeam;           // visitante
  hs: number | null;     // gols mandante (fullTime)
  as: number | null;     // gols visitante
}

interface DataPayload {
  fetchedAt: number;     // epoch ms
  matches: SlimMatch[];
  demo?: true;           // sem FOOTBALL_DATA_TOKEN
  stale?: true;          // API falhou, servindo cópia vencida do KV
}
```

## 502

```ts
interface DataError { error: string }
```

Só quando a API falha **e** não há cópia no KV. O cliente cai na cópia do `localStorage` ou mostra "Não deu para carregar a tabela."

## Regras do Worker (inalteradas)

1. Sem token: `demoData()` + `demo: true`.
2. KV `bsa-matches-v1` com menos de 1h: devolve a cópia do KV.
3. Senão, busca `https://api.football-data.org/v4/competitions/BSA/matches` (header `X-Auth-Token`), aplica `slim`, grava no KV com `waitUntil` e devolve.
4. Erro com cópia no KV: devolve a cópia + `stale: true`. Erro sem cópia: 502.

# Contract: rotas HTML

| Requisição | Resposta |
|------------|----------|
| Host `[oa]-<slug>-cai.*.diuliano.com`, qualquer caminho | 301 → `https://vaicair.diuliano.com/<slug>` (ou `/`, se o slug não existir) |
| `/` | `index.html` sem `data-team` (lista de times) |
| `/<slug>` ou `/<slug>/`, sem diferenciar maiúsculas de minúsculas, slug ∈ `TEAMS` | `index.html` com `<html data-team="<slug>">`, `<title>` e `og:title` = `"O <Nome> cai?"`, favicon `/<slug>.svg`. A `og:description` é a mesma para todos os times |
| Outros caminhos sem extensão (ex.: `/flamengo`) | encaminhados ao `ASSETS` (comportamento atual). O status precisa ser igual ao da versão antiga, conferido na tag `pre-migracao` |
| Arquivos com extensão (`/assets/*.js`, `/*.svg`) | servidos direto pelos assets, sem passar pelo Worker |
