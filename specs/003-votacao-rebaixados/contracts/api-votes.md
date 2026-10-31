# Contrato: `/api/votes`

Tipos declarados em `src/shared/api.ts` e verificados no build (`tests/types/*-contract.ts`), como o `/api/data`.

```ts
export interface VoteRow { id: number; votes: number; pct: number }

export interface VoteState {
  /** a votação ainda aceita votos */
  open: boolean;
  /** epoch ms do primeiro jogo da última rodada; null sem dados de jogos */
  closesAt: number | null;
  /** votantes até agora */
  total: number;
  /** só para quem já votou ou com a votação fechada; ausente com total < 10 */
  rows?: VoteRow[];
  /** total < 10: mostrar "votação começando" (só para quem pode ver o resultado) */
  warmingUp?: true;
  /** os 3 do visitante, quando ele já votou */
  mine?: [number, number, number];
}

export interface VoteRequest { voter: string; picks: [number, number, number] }

export interface VoteError {
  error: 'invalid' | 'forbidden' | 'closed' | 'rate-limited' | 'daily-cap' | 'unavailable';
  message: string; // pt-BR, pronto para a tela
  state?: VoteState; // só no 410
}
```

## `GET /api/votes?voter=<uuid>`

- `voter` é opcional. Se ausente, inválido ou desconhecido, a resposta não traz `rows`, `warmingUp` nem `mine` enquanto a votação estiver aberta.
- **200** `VoteState`. Header `cache-control: no-store`.
- **503** `VoteError { error: 'unavailable' }` se o banco falhar (por exemplo, limite do D1). A página segue funcionando sem a votação.

## `POST /api/votes`

Corpo JSON `VoteRequest`. Ordem das checagens (as mais baratas e as de segurança primeiro):

| # | Checagem | Resposta |
|---|----------|----------|
| 1 | `Origin` presente e diferente da origem do próprio site, ou `Content-Type` diferente de `application/json` | **403** `forbidden` |
| 2 | `VOTE_LIMITER.limit({ key: ip })` falhou (conta também envios inválidos) | **429** `rate-limited` |
| 3 | Corpo > 1 KB, JSON quebrado, `voter` fora de UUID ou `picks` recusado por `ballotError` | **400** `invalid` (a mensagem diz o motivo) |
| 4 | `now >= closesAt` | **410** `closed` + `VoteState` final em `state` |
| 5 | `daily[hoje].n >= DAILY_CAP` | **503** `daily-cap` |
| 6 | `INSERT INTO votes` deu certo | **201** `VoteState` (com `rows`/`warmingUp` e `mine`) |
| 6' | Chave repetida (já votou) | **409** `VoteState` com `mine` = o voto **gravado** (não o enviado) |
| — | Outro erro do banco | **503** `unavailable` (sem detalhes do erro) |

### Segurança

- **Outro site fazendo os visitantes dele votarem**: bloqueado pelo item 1. Navegadores sempre mandam `Origin` em POST, e exigir JSON força o preflight de CORS, que o Worker nunca autoriza. Sem isso, cada visitante do outro site teria um IP diferente e passaria pelo limitador.
- **SQL injection**: todas as consultas usam parâmetros (`bind`). Além disso, o `voter` precisa ser UUID e os times precisam ser ids da lista.
- **Segunda barreira no banco**: `CHECK` de tamanho do `voter` e de times distintos e positivos.
- **Corpo gigante**: é lido aos poucos e cortado em 1 KB.
- **Script com muitos IPs**: o teto diário segura o estrago. Se aparecer abuso real, o plano B é o Turnstile.

- O IP (`CF-Connecting-IP`) é usado só como chave do limitador e nunca é gravado nem registrado em log.
- Não há `PUT` nem `DELETE`: o voto é definitivo (FR-007).
- Corpo maior que 1 KB → 400.

## Página do time

Sem rota nova. A página do time chama o mesmo `GET /api/votes` e mostra a linha do time a partir de `rows` (quem votou ou votação fechada) ou o convite para votar (os outros).
