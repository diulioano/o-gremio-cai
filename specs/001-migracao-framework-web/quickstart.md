# Quickstart: validar a migração

Guia de execução e validação. Os detalhes de formato estão em [contracts/](./contracts/) e [data-model.md](./data-model.md).

## Pré-requisitos

- Node 24 (o atual é v24.15) e npm.
- `git` com a versão antiga commitada como baseline (tag `pre-migracao`).
- `.dev.vars` com `FOOTBALL_DATA_TOKEN` (opcional; sem ele o site usa dados demo).
- Navegadores do Playwright: `npx playwright install chromium`.

## 0. Baseline visual (uma vez, na versão antiga)

```sh
git checkout pre-migracao
npm run baseline        # sobe a versão antiga em modo demo e grava os screenshots em tests/visual/__baseline__/
git checkout 001-migracao-framework-web
```

Resultado esperado: 40 PNGs (raiz + 9 times) × (390×844, 1440×900) × (sem palpites, com o conjunto fixo de palpites).

## 1. Desenvolvimento local

```sh
npm install
npm run dev             # Vite + Worker no workerd, http://localhost:5173
```

- Abrir `/`, `/gremio`, `/inter`: veredito, tabela e jogos aparecem.
- Para testar o modo demo, apagar o token de `.dev.vars` e reiniciar: a barra de status mostra "Dados de demonstração".
- No Windows, ao encerrar, conferir que nenhum `workerd` ficou órfão (`tasklist | findstr workerd`).

## 2. Verificação estática

```sh
npm run check           # typecheck + lint + format:check + test
```

Esperado: zero erros. Se mudar um campo em `src/shared/api.ts` sem atualizar quem o usa, o typecheck tem que falhar (FR-011).

## 3. Testes de domínio e do Worker

```sh
npm test
```

Precisa cobrir, no mínimo:

| Cenário | Esperado |
|---------|----------|
| Classificação com empate em pontos | desempata por vitórias → saldo → gols pró → nome |
| Time em 17º / 16º | veredito SIM / NÃO |
| `simulate` com semente 42 rodado 2× | resultados idênticos |
| Payload demo | % iguais às da versão antiga (fixture gravada a partir do `compute` antigo) |
| `fill` com palpite manual + sorteado | o manual fica, o sorteado é refeito |
| Palpites corrompidos no storage | entradas inválidas descartadas, sem exceção |
| `GET` em host `o-inter-cai.diuliano.com` | 301 → `https://vaicair.diuliano.com/inter` |
| `GET /Gremio/` | 200, `data-team="gremio"`, `<title>O Grêmio cai?</title>` |
| `GET /api/data` sem token | 200, `demo: true` |
| `GET /flamengo` | mesmo status da versão antiga |

## 4. Paridade visual

```sh
npm run test:visual     # compara a versão nova com o baseline (tolerância ~1%)
```

Esperado: as 40 comparações passam (SC-001). Se alguma falhar, abrir o relatório (`npx playwright show-report`) e corrigir. Diferenças de hierarquia, cor ou texto nunca são aceitas.

## 5. Checagens manuais rápidas

1. Palpites antigos: com a versão antiga, fazer 3 palpites. Trocar para a nova (mesma origem) e recarregar: os 3 palpites continuam lá (SC-002).
2. "Reduzir movimento" ligado no sistema: nenhuma animação (stamp, glow, FLIP).
3. Rolar a página de um time: a barra fixa com o SIM/NÃO aparece embaixo (desktop) ou em cima (celular, depois que a linha do time sai da tela).
4. DevTools → Network → "Fast 4G", celular intermediário: o veredito aparece em tempo igual ou menor que na versão antiga (SC-003).

## 6. Publicação

Só depois de `npm run check` e `npm run test:visual` verdes.

```sh
npm run build
npx wrangler versions upload          # gera URL de preview
# validar os passos 4–5 no preview
npx wrangler versions deploy          # promove para 100%
# se der problema: npx wrangler rollback
```

Esperado: `vaicair.diuliano.com` e os 4 subdomínios antigos respondendo, sem indisponibilidade (SC-007).
