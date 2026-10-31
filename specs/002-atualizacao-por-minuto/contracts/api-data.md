# Contract: `GET /api/data` (alterações da spec 002)

Base: [specs/001-migracao-framework-web/contracts/api-data.md](../../001-migracao-framework-web/contracts/api-data.md). Fonte da verdade em código: `src/shared/api.ts`.

**O formato do corpo não muda.** Mudam o significado de dois campos e um cabeçalho:

| Item | Antes | Depois |
|------|-------|--------|
| `fetchedAt` | quando o Worker buscou na fonte | quando a fonte foi conferida e gravada pela última vez (mudança ou pulso: 5 min ao vivo, 60 min fora de jogo) |
| `stale` | a fonte falhou nesta requisição e há cópia no KV | `now − fetchedAt` > 15 min (ao vivo) ou > 3 h (fora de jogo) |
| `cache-control` | `public, max-age=300` | `public, max-age=30` ao vivo; `public, max-age=300` fora de jogo |

"Ao vivo" = `isLiveWindow(matches, now)` (ver [data-model.md](../data-model.md)).

Erros: `502 { error }` só quando o KV está vazio **e** a busca de partida a frio falha (igual a hoje).
