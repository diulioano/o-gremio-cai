# Research: Votação "Quem você acha que cai?"

Decisões tomadas para o plano. Limites conferidos na documentação da Cloudflare em 2026-10-30.

## Limites do plano grátis que importam aqui

| Recurso | Limite grátis | Uso atual | Observação |
|---------|---------------|-----------|------------|
| KV, gravações | 1.000/dia | até ~180/dia pelo cron (spec 002) | não serve para votos |
| D1, linhas gravadas | 100.000/dia | 0 | desde 01/09/2026, ao passar do limite as consultas **falham** até 00:00 UTC |
| D1, linhas lidas | 5.000.000/dia | 0 | idem |
| D1, armazenamento | 5 GB | 0 | votos ocupam poucos KB |
| Requisições ao Worker | 100.000/dia | página + `/api/data` | a votação soma 1 GET por página aberta e 1 POST por voto |

## D1 — Onde guardar os votos

- **Decision**: banco D1 (`vaicair-votos`, binding `DB`).
- **Rationale**: o KV tem 1.000 gravações por dia, e o cron de placares já usa até ~180 delas. Se cada voto gravasse no KV, uns 800 votos num domingo derrubariam a atualização dos placares. Além disso, o KV não tem incremento atômico (dois votos ao mesmo tempo perderiam contagem) e demora até 60 s para propagar. O D1 tem 100 mil gravações por dia, transação e restrição de chave única, que resolve o "um voto por aparelho" sem corrida.
- **Alternatives considered**:
  - KV com um contador: estoura o limite e perde votos simultâneos.
  - Durable Object com SQLite: funciona no plano grátis, mas exige classe, migração de DO e roteamento. É mais código para o mesmo resultado.
  - Analytics Engine: conta aproximada e sem garantia de "um por aparelho".

## D2 — Contagem pronta, não recalculada

- **Decision**: uma tabela `tally` com a contagem por time, mais uma linha de total (`team_id = 0`), atualizada por um **trigger** `AFTER INSERT ON votes`. O resultado é lido em `tally` (10 linhas), nunca com `COUNT(*)` em `votes`.
- **Rationale**: no D1, cobra-se pelas linhas *lidas*. Com `COUNT(*)`, 5.000 votos fariam cada página aberta ler 5.000 linhas, e 1.000 visitas já gastariam o limite diário inteiro. Com a contagem pronta, cada página lê 10 linhas. O trigger roda na mesma transação do `INSERT`: se o voto entra, a contagem sobe; se não entra (voto repetido), nada muda.
- **Custo por voto**: 1 linha em `votes` (tabela `WITHOUT ROWID`, sem índice extra) + 3 linhas de time + 1 de total + 1 do contador diário = **6 linhas gravadas**.
- **Alternatives considered**: atualizar a contagem pelo Worker num `batch()` depois do `INSERT`. Funciona, mas duplica a regra "só conta se o voto entrou", que o trigger garante de graça.

## D3 — "Um voto por aparelho" sem login e sem dado pessoal

- **Decision**: na primeira visita à votação, o navegador gera um id aleatório (`crypto.randomUUID()`) e o guarda no `localStorage` junto com os 3 times escolhidos depois do voto. O id vai no envio e é a chave primária em `votes`. Um segundo envio com o mesmo id bate na chave única, e o servidor responde "já votou" com o resultado.
- **Rationale**: atende FR-005/FR-006 sem cookie de sessão e sem IP guardado (SC-007). Quem limpa os dados ou abre uma aba anônima ganha um id novo, e isso foi aceito na spec. O IP é usado só em memória, como chave do limitador (D4), e nunca é gravado.
- **Alternatives considered**:
  - Hash do IP como chave: bloquearia família, escritório e redes móveis com IP compartilhado (CGNAT, muito comum no Brasil), além de ser dado pessoal.
  - Fingerprint do navegador: invasivo e frágil.

## D4 — Contra envio em massa

- **Decision**: duas barreiras.
  1. **Binding de Rate Limiting** do Workers (`VOTE_LIMITER`), com chave = IP da requisição e limite de **5 votos a cada 60 s** por local da Cloudflare. Acima disso, responde 429.
  2. **Teto diário próprio**: o trigger também incrementa `daily(day)`. Antes de inserir, o Worker lê essa linha. Com **10.000 votos no dia (UTC)** (60 mil linhas gravadas, 60% do limite do D1), responde 503 `daily-cap`, e a tela mostra "votação temporariamente fechada, volte amanhã".
- **Rationale**: 5 por minuto é folgado para uma família no mesmo Wi-Fi e corta scripts. O teto diário garante que a votação nunca chegue ao corte do D1, que derrubaria a própria votação o resto do dia (desde 01/09/2026 as consultas falham). Isso cumpre o caso "não perder votos em silêncio". O limitador é aproximado (por local), o que basta para zoeira.
- **Alternatives considered**: Turnstile (captcha). Funciona, mas cria atrito e esforço de design para um voto de 3 cliques. Fica como plano B se aparecer abuso real.

## D5 — Quando a votação fecha

- **Decision**: função pura `votingClosesAt(matches)` em `src/domain/votes.ts`: o menor horário de início entre os jogos da **última rodada** (maior `md` presente nos dados, que é a 38ª). A votação está aberta enquanto `now < closesAt`. O Worker usa os jogos que já estão no KV (`bsa-matches-v1`) ou os dados de demonstração sem token. Não há consulta extra à fonte.
- **Rationale**: a regra fica num lugar só, testável e usada pelo Worker (aceitar ou recusar) e pela tela (mostrar formulário ou encerrado). Se um jogo da última rodada for remarcado, o horário acompanha os dados.
- **Edge**: sem dados no KV (primeiro deploy), `closesAt = null` e a votação fica aberta. É um estado de minutos, até o próximo cron.

## D6 — Resultado só para quem votou (FR-014)

- **Decision**: `GET /api/votes?voter=<id>`. O servidor só inclui a contagem por time se a votação já fechou ou se o `voter` existe em `votes` (1 linha lida pela chave). Para os outros, devolve só `total`, `open` e `closesAt`.
- **Rationale**: esconder só na tela deixaria o resultado no JSON, à vista de qualquer um. No servidor, o custo é 1 leitura. Quem quiser burlar precisa votar antes, que é justamente o comportamento pedido.
- **Cache**: a resposta depende do visitante, então vai com `cache-control: no-store`. Leituras por GET: 1 (voter) + 10 (tally) = 11. Com 5 milhões por dia, sobra para ~450 mil páginas abertas.

## D7 — Porcentagem, ordem e mínimo de votos

- **Decision**: `crowdResult(counts, total)` em `src/domain/votes.ts`:
  - `pct = Math.round(100 * votos_do_time / total_de_votantes)`;
  - ordena pela contagem (decrescente) e desempata pelo nome;
  - com `total < 10`, devolve `{ warmingUp: true }` sem porcentagens (FR-013).
  - A soma dá ~300% (SC-004).
- **Rationale**: domínio puro e testado, conforme o Princípio II.

## D8 — Validação do voto

- **Decision**: `ballotError(picks)` em `src/domain/votes.ts`, usada pela tela e pelo Worker. Exige exatamente 3 ids, distintos e presentes em `TEAMS` (a lista única de `src/shared/teams.ts`). A Chapecoense não está em `TEAMS`, então fica de fora sem regra especial. O `voter` precisa ter formato de UUID.
- **Rationale**: FR-008 e FR-017, com uma regra só nos dois lados.

## D9 — Atualização do resultado (FR-016)

- **Decision**: o `POST` devolve o resultado já com o voto contado, e a tela troca o formulário pelo resultado sem recarregar. O `GET` roda quando a página abre. Não há polling.
- **Rationale**: o próprio voto aparece na hora. O voto dos outros aparece na próxima vez que a página abrir, o que basta para "no máximo alguns minutos" sem gastar requisições.

## D10 — Testes com D1

- **Decision**: migrações SQL em `migrations/` (`wrangler d1 migrations`). Nos testes do Worker, `readD1Migrations` (exportado por `@cloudflare/vitest-plugin`) lê as migrações no `vitest.config.ts`, e um arquivo de setup aplica com `applyD1Migrations` de `cloudflare:test`. O miniflare simula o binding de rate limit.
- **Rationale**: testa o trigger, a chave única e o teto diário de verdade, sem mock.

## D11 — Visual

- **Decision**: a interface da votação (formulário, resultado, encerrado, "começando", erro, teto diário) e a linha da torcida na página do time **só são construídas depois do design no Claude Design**, como nas specs anteriores. O plano define comportamento e dados. As tarefas de UI ficam bloqueadas pelo briefing de design.
- **Rationale**: decisão do usuário registrada (construir só depois do design).
