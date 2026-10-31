# Quickstart: validar a votação

## Pré-requisitos

- Dependências instaladas (`npm install`).
- Banco criado uma vez na conta: `npx wrangler d1 create vaicair-votos`. Cole o `database_id` em `wrangler.jsonc`.
- Migração aplicada:
  - local: `npx wrangler d1 migrations apply vaicair-votos --local`
  - produção (antes do deploy): `npx wrangler d1 migrations apply vaicair-votos --remote`

## Testes automáticos

```sh
npm run check
```

O que precisa passar:

| Teste | Prova |
|-------|-------|
| `tests/domain/votes.test.ts` | `ballotError` (2, 4, repetido, Chapecoense, id fora de `TEAMS`, não-inteiro), `votingClosesAt` (maior rodada, jogo remarcado, lista vazia), `crowdResult` (75% com 150/200, ordem e desempate, `warmingUp` com 9 votos, soma ≈ 300%) |
| `tests/worker/votes.test.ts` | POST 201 conta nos 3 times e no total; mesmo `voter` → 409 com o voto gravado, sem contar de novo; 400 para voto inválido sem gravar nada; 410 depois de `closesAt`; 503 com `daily` no teto; 429 na 6ª tentativa do mesmo IP em 60 s; GET sem `voter` não traz `rows`; GET com `voter` que votou traz `rows` e `mine`; GET com votação fechada traz `rows` para todos; nenhuma coluna guarda IP |
| `tests/types/*-contract.ts` | `VoteState`/`VoteRequest`/`VoteError` usados igual pelo Worker e pela página |
| `tests/visual/parity.spec.ts` | Páginas de time sem mudança visual acima da linha da torcida (SC-005). Os baselines da home são atualizados de propósito com o design novo |

## Roteiro manual (local, `npm run dev`)

1. Abra `/` numa janela anônima: o botão "Quem você acha que cai?" aparece no canto inferior direito. Ao tocar, sobe a gaveta com os 9 times, e a Chapecoense fica fora, com a explicação. Não aparece nenhuma porcentagem. A gaveta fecha com Esc, com o fundo e com o X.
2. Marque 2 times: o botão diz que falta 1. Marque o 3º: os outros 6 ficam bloqueados.
3. Confirme: aparece "Seu palpite: …" e o resultado (ou "votação começando", com menos de 10 votos).
4. Recarregue: o botão diz "O que a torcida acha" e abre o seu voto e o resultado, sem a lista para escolher. Abra `/#votacao`: a gaveta abre sozinha.
5. Abra `/gremio`: o SIM/NÃO e a % de queda vêm primeiro, e a linha da torcida aparece abaixo. Role até a barra fixa do veredito aparecer: o botão sobe e não a cobre.
6. Em outra janela anônima, abra `/gremio`: a linha diz "Vote para ver o que a torcida acha" e, ao tocar, abre a gaveta.
7. Desligue a rede e tente votar: aparece o erro, e os 3 continuam marcados.
8. Envie direto ao servidor um voto com 4 times ou com a Chapecoense (`curl -X POST localhost:5173/api/votes -H 'content-type: application/json' -d '{"voter":"<uuid>","picks":[1,2,3,4]}'`): recebe 400, e o total não muda.
9. Para testar o encerramento, use os dados de demonstração com a data da última rodada no passado: o botão vira "O que a torcida acha", e todos veem o resultado final como "encerrada".

## Depois do deploy

- `npx wrangler d1 execute vaicair-votos --remote --command "SELECT * FROM tally"`: o total bate com o que a página mostra.
- No painel do D1, em Metrics → Row Metrics: o número de linhas gravadas por dia fica perto de 6 × o número de votos.
