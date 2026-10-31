# Quem vai cair?

Simulador da reta final do Brasileirão Série A 2026: um SIM ou NÃO gigante para "O [time] cai?", a tabela, os jogos que faltam e a chance de cada time cair. No ar em [vaicair.diuliano.com](https://vaicair.diuliano.com). O que o produto é e para quem está em [PRODUCT.md](./PRODUCT.md).

## Comandos

| Comando               | O que faz                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | Vite + Worker no `workerd` em http://localhost:5173                      |
| `npm run build`       | build do cliente (`dist/client`) e do Worker                             |
| `npm run preview`     | serve o build como em produção                                           |
| `npm test`            | build + testes do domínio e do Worker (Vitest)                           |
| `npm run test:visual` | compara as telas com o baseline da versão antiga (Playwright)            |
| `npm run check`       | typecheck + lint + formatação + testes; tem que passar antes de publicar |
| `npm run deploy`      | build + `wrangler deploy`                                                |

Sem `FOOTBALL_DATA_TOKEN` em `.dev.vars`, o site usa dados de demonstração.

## Banco da votação (D1)

Os votos ficam no D1 `vaicair-votos` (binding `DB` em `wrangler.jsonc`), com o esquema em `migrations/`. Ver `specs/003-votacao-rebaixados`.

- Local (uma vez, antes do `npm run dev`): `npx wrangler d1 migrations apply vaicair-votos --local`
- Produção (antes do deploy que traz uma migração nova): `npx wrangler d1 migrations apply vaicair-votos --remote`
- Conferir a contagem: `npx wrangler d1 execute vaicair-votos --remote --command "SELECT * FROM tally"`

Os testes do Worker aplicam as migrações sozinhos num banco em memória.

## Estrutura

```text
src/
├── shared/   lista de times e formato de /api/data; usado pelo Worker e pelo cliente
├── domain/   tabela, simulação (Monte Carlo), palpites e veredito; funções puras, testadas
├── worker/   Cloudflare Worker: rotas, redirects, /api/data (lê o KV) e o cron que atualiza o KV (~1 min com jogo, 1 h sem)
└── client/   Preact: hooks, componentes (common, home, team) e estilos (CSS Modules)
```

Regras de fronteira, garantidas pelo ESLint:

- `domain` não importa Preact, `client` nem `worker`.
- `shared` não importa nada dos outros e não usa APIs de navegador, porque é compilado também no Worker.
- O `localStorage` fica em `src/client/lib/storage.ts`.

Cada componente é um `Nome.tsx` + `Nome.module.css` com no máximo 200 linhas. O `tests/structure.test.ts` confere isso. Os `@keyframes` ficam em `src/client/styles/animations.css`, fora dos CSS Modules, que renomeariam as animações.

## Adicionar ou remover um time

1. Edite `src/shared/teams.ts`. Identifique o time pelo **id da football-data.org**, nunca pela sigla (Coritiba e Corinthians são ambos COR).
2. Ponha o escudo em `public/<slug>.svg`.

Só isso: rotas, títulos, rodapé e página inicial leem dessa lista. O `accent` nunca pode ser vermelho nem verde, porque essas são as cores do SIM e do NÃO. O teste `tests/domain/teams.test.ts` falha se for.

## Baseline visual

As telas de referência em `tests/visual/__baseline__/` são da versão com o card de compartilhar e a votação (regravadas na spec 003; antes vinham da versão antiga, tag `pre-migracao`). Usam os dados de `tests/domain/fixtures/` e um estado fixo da votação (aberta, sem voto deste aparelho). Só atualize com `npx playwright test --update-snapshots` quando a mudança visual for intencional, e revise os PNGs no commit.

## Windows: `workerd` órfão

Ao encerrar `npm run dev` ou `preview`, às vezes um processo `workerd` fica preso na porta. Confira com `tasklist | findstr workerd` e encerre com `taskkill /F /IM workerd.exe`.
