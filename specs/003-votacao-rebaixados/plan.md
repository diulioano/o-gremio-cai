# Implementation Plan: Votação "Quem você acha que cai?"

**Branch**: `003-votacao-rebaixados` (ainda não criada; o trabalho atual está em `002-atualizacao-por-minuto`) | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-votacao-rebaixados/spec.md`

## Summary

Os votos ficam num **banco D1** (grátis: 100 mil linhas gravadas por dia), não no KV. O KV tem só 1.000 gravações por dia, e o cron de placares já usa parte delas.

- **Esquema**: uma tabela `votes` com chave única por aparelho (UUID aleatório gerado no navegador) e uma tabela `tally` com a contagem pronta, atualizada por trigger na mesma transação. Cada voto grava 6 linhas, e cada página aberta lê no máximo 11.
- **Rota `/api/votes`**:
  - o GET devolve o estado da votação, com a contagem só para quem já votou ou depois do encerramento (FR-014);
  - o POST valida, aplica o limitador por IP (sem guardar o IP) e o teto diário de 10 mil votos, e grava.
- **Domínio puro** em `src/domain/votes.ts`: validação do voto, momento do encerramento (primeiro jogo da última rodada) e cálculo das porcentagens.
- **Interface**: botão flutuante em todas as páginas que abre uma gaveta de votação (lista para escolher, depois o resultado), mais a linha da torcida na página do time. Só será construída depois do design no Claude Design.

Decisões e contas em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0.x (`strict`), ESM. Node 24 para tooling.

**Primary Dependencies**: Preact 10, Vite 8, `@cloudflare/vite-plugin`, Wrangler 4 (≥ 4.36 para `ratelimits`). Nenhuma dependência npm nova.

**Storage**:
- **novo**: D1 `vaicair-votos` (binding `DB`, migrações em `migrations/`);
- **novo**: binding de Rate Limiting `VOTE_LIMITER`;
- KV `CACHE`: só leitura dos jogos para saber quando a votação fecha;
- `localStorage`: chave nova `vaicair-voto-v1`.

**Testing**: Vitest.
- Projeto `domain`: `votes.test.ts`.
- Projeto `worker`: `votes.test.ts`, com o D1 real do miniflare e as migrações aplicadas num arquivo de setup (`readD1Migrations`/`applyD1Migrations`).
- Contrato de tipos em `tests/types/`.
- Visual: o Playwright continua igual nas páginas de time acima da linha da torcida.

**Target Platform**: Cloudflare Workers Free (D1, Rate Limiting, KV), navegadores de celular.

**Project Type**: web app (Worker + SPA), estrutura existente.

**Performance Goals**: votar em < 30 s (SC-001). O voto aparece contado na resposta do envio (SC-002).

**Constraints**:
- ≤ 60 mil linhas gravadas por dia no D1 (teto de 10 mil votos; limite: 100 mil);
- leituras bem abaixo de 5 milhões por dia;
- nenhum dado pessoal guardado;
- zero custo;
- não tocar no orçamento de gravações do KV.

**Scale/Scope**:
- 1 rota nova (`/api/votes`);
- 1 módulo de domínio (`votes.ts`);
- 1 migração SQL;
- tipos novos em `src/shared/api.ts`;
- 1 hook (`useVote`);
- 3 componentes de UI (`VoteButton` + `VoteSheet` em `common/`, usados na home e nos times; `CrowdLine` na página do time), dependentes do design;
- mudanças em `wrangler.jsonc`, `src/worker/index.ts`, `src/client/lib/storage.ts` e `vitest.config.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano cumpre | Status |
|-----------|---------------------|--------|
| I. Veredito primeiro, SIM vermelho / NÃO verde | A linha da torcida fica abaixo do veredito e da % de queda (FR-015, SC-005). O resultado da votação não usa vermelho/verde de SIM/NÃO para não se confundir com o veredito; a cor fica a cargo do design | ✅ |
| II. Rigor nos números | A opinião da torcida é rotulada como opinião e nunca entra no simulador nem no veredito (FR-012). `ballotError`, `votingClosesAt` e `crowdResult` são puros e testados. A contagem é exata (transação + chave única) | ✅ |
| III. Componentizado e fonte única | Times votáveis vêm de `TEAMS`. Uma regra de validação serve à tela e ao Worker. Contrato `/api/votes` tipado em `src/shared/api.ts` e verificado no build | ✅ |
| IV. Boas práticas | Bindings tipados via `wrangler types`, SQL em migrações versionadas, testes no pool de Workers, `npm run check` | ✅ |
| V. Justo, leve e para celular | As mesmas regras para os 9 times. Nenhuma dependência nova. Sem polling. Texto em pt-BR. Respeita "reduzir movimento" | ✅ |
| Restrição: plano grátis | D1 e Rate Limiting estão no Workers Free. Teto diário próprio a 60% do limite do D1 | ✅ |
| Restrição: simplicidade, vida útil 2026 | Um banco novo é infraestrutura a mais; justificado em Complexity Tracking. Os dados podem ser apagados ao fim da temporada | ✅ (justificado) |
| Restrição: não inventar números | Só aparecem contagens reais. Com < 10 votos, "votação começando" em vez de porcentagens | ✅ |

**Re-check pós-design**: ✅ Nenhuma violação. A constituição não precisa de emenda: D1 e Rate Limiting estão dentro de "Cloudflare Workers, no plano grátis".

## Project Structure

### Documentation (this feature)

```text
specs/003-votacao-rebaixados/
├── spec.md
├── plan.md                  # este arquivo
├── research.md              # decisões D1–D11 e contas de limite
├── data-model.md            # tabelas, trigger, funções de domínio, estados da tela
├── quickstart.md            # roteiro de validação
├── contracts/
│   ├── api-votes.md         # GET/POST /api/votes
│   └── browser-storage.md   # chave vaicair-voto-v1
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
migrations/
└── 0001_votos.sql                     # novo: votes, tally, daily, trigger

src/
├── domain/
│   └── votes.ts                       # novo: PICKS, MIN_VOTES, DAILY_CAP, ballotError, votingClosesAt, crowdResult
├── shared/
│   └── api.ts                         # + VoteState, VoteRequest, VoteError, VoteRow
├── worker/
│   ├── index.ts                       # + rota /api/votes
│   └── votes.ts                       # novo: GET/POST, limitador, teto diário, leitura dos jogos no KV
└── client/
    ├── lib/storage.ts                 # + loadVote/saveVote (vaicair-voto-v1)
    ├── hooks/useVote.ts               # novo: estado da votação, envio, erros
    └── components/
        ├── common/VoteButton.tsx (+ .module.css)  # novo: botão flutuante, depois do design
        ├── common/VoteSheet.tsx (+ .module.css)   # novo: gaveta (lista / resultado), depois do design
        └── team/CrowdLine.tsx (+ .module.css)   # novo, depois do design

tests/
├── domain/votes.test.ts               # novo
├── worker/votes.test.ts               # novo
├── worker/setup-d1.ts                 # novo: aplica as migrações
└── types/{client,worker}-contract.ts  # + tipos da votação

wrangler.jsonc                         # + d1_databases (DB), ratelimits (VOTE_LIMITER)
vitest.config.ts                       # + migrações D1 no projeto worker
```

**Structure Decision**: mantém a estrutura Worker + SPA. A regra fica em `src/domain/`, a I/O em `src/worker/votes.ts` e o visual em componentes próprios, igual ao `/api/data`.

## Ordem sugerida

1. Domínio (`votes.ts` + testes). Não depende de nada.
2. Migração + `wrangler.jsonc` + setup de testes D1.
3. Worker `/api/votes` + testes + contrato de tipos.
4. **Briefing de design** (botão flutuante e gaveta: formulário, enviando, votou, começando, encerrada, erro, teto diário; linha da torcida no time). Esperar o design do Claude Design.
5. `storage` + `useVote` + componentes, seguindo o design.
6. Criar o D1 em produção, aplicar a migração `--remote` e fazer o deploy.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Novo serviço de armazenamento (D1) além do KV | Votos exigem gravação por visitante, contagem exata e "um por aparelho" | KV: 1.000 gravações por dia (já usadas pelo cron) e sem incremento atômico, então perderia votos e poderia derrubar a atualização dos placares |
| Trigger SQL | Garante que a contagem só sobe se o voto entrou, na mesma transação | Atualizar no Worker duplica a regra e abre brecha para contagem dupla |
| Binding de Rate Limiting | FR-009 sem login | Contar por IP no D1 gravaria IP (dado pessoal) e gastaria linhas |
