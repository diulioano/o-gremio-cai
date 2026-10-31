# Research: Migração para framework web componentizado

**Feature**: [spec.md](./spec.md) · **Date**: 2026-10-30

Ponto de partida: `public/app.js` (663 linhas, Preact 10 + htm carregados do unpkg, sem build), `public/index.html` (tokens CSS e keyframes), `src/index.js` (Worker: redirects, página por time via HTMLRewriter, `/api/data` com cache KV 1h), `src/demo.js` (dados de demonstração). Versões conferidas no npm em 2026-10-30.

## R1. Framework de UI

- **Decision**: **Preact 10.x** com JSX/TSX (última 10.x estável).
- **Rationale**: o código atual já é Preact com hooks (`useState`, `useMemo`, `useLayoutEffect`, `useRef`). A migração vira uma troca de `html\`...\`` por JSX e a divisão em arquivos, sem reescrever a lógica. Isso é o que dá para garantir paridade (FR-001/FR-004) no meio da reta final. O runtime tem ~4 KB, bom para celular em 4G (SC-003). Ficar na 10.x mantém o mesmo major de hoje.
- **Alternatives considered**:
  - *Preact 11*: major novo, com mudanças que não trazem nada para esta feature. Fica para depois.
  - *React 19*: ~10× maior no bundle e sem ganho funcional aqui.
  - *Svelte 5 / SolidJS*: exigiriam reescrever todos os componentes em outro modelo de reatividade, com mais risco de quebrar a paridade.
  - *Astro / Next (vinext)*: SSR/ilhas são desnecessários. A página é um app de cliente com um HTML pequeno, e o Worker já faz a injeção por time.

## R2. Linguagem e tipagem

- **Decision**: **TypeScript 6.0.x**, `strict: true`, `noUncheckedIndexedAccess: true`, módulos ESM.
- **Rationale**: atende FR-011/FR-012 (contrato verificado no build). O `tsc -b` compila o Worker e o cliente contra o mesmo `src/shared/api.ts`, então uma mudança no formato que não for acompanhada pelos dois lados não compila. O TypeScript 7.0 (compilador nativo) já saiu, mas o `typescript-eslint` 8.72 só suporta `typescript <6.1`. Vamos ficar no 6.0 até o linter acompanhar.
- **Alternatives considered**: *JS + JSDoc com `checkJs`*: tipagem mais fraca e pior ergonomia para contratos compartilhados. *TS 7*: bloqueado pelo linter.

## R3. Build e integração com o Cloudflare Worker

- **Decision**: **Vite 8** + `@preact/preset-vite` + **`@cloudflare/vite-plugin`** (≥1.66, que pede `wrangler ^4.154`). Um único `vite build` gera o bundle do cliente e o Worker. `wrangler deploy` publica o resultado.
- **Rationale**: é a integração oficial da Cloudflare. O `vite dev` roda o Worker no runtime `workerd` de verdade (KV, assets, HTMLRewriter), então o desenvolvimento local fica fiel à produção. Isso também resolve o problema do `wrangler dev` órfão no Windows, porque passa a existir um único processo, o do Vite. A config `assets.run_worker_first` continua valendo. O `assets.directory` fica apontando para `./dist/client` (a saída do build do cliente), para os testes do Worker no `vitest-pool-workers` terem o binding `ASSETS`. Por isso o `npm test` roda o `vite build` antes.
- **Alternatives considered**: *Vite só para o cliente + `wrangler dev` separado*: dois processos e dois builds, mais fácil de dessincronizar. *esbuild manual*: perde HMR e plugins.

## R4. Estilos

- **Decision**: **CSS Modules** (`*.module.css`, nativo no Vite) por componente. Os tokens globais (`--bg`, `--danger`, `--safe`, `--warn`, fontes) e os `@keyframes` vão para `src/client/styles/`. Os valores dinâmicos (cor do time, largura da barra de %, escala) entram como **custom properties** no `style` (`style={{ '--accent': team.accent }}`).
- **Rationale**: hoje todo o visual está em strings `style="..."` inline. Elas não dá para reutilizar, não aceitam `:hover`/media queries e incham o JSX. CSS Modules dão escopo por componente sem runtime e mantêm o CSS idêntico, só que movido de lugar. As decisões `mobile`/`wide`, hoje tomadas em JS por `width`, podem virar media queries onde não mudam a estrutura do DOM, e continuam em JS onde mudam (layout pôster da home, botões −/+ no celular).
- **Alternatives considered**: *Tailwind*: tradução 1:1 de centenas de declarações, com risco alto de diferença visual. *CSS-in-JS (styled-components, etc.)*: tem custo de runtime. *Manter inline*: não cumpre "boas práticas" nem SC-004.

## R5. Fonte única de times e contrato de dados

- **Decision**: o diretório `src/shared/` é importado pelo Worker e pelo cliente. Nele ficam:
  - `teams.ts`: registro `TEAMS` (slug → `{ id, art, name, code, accent, halo, bg }`), helper `ask(team)` e o tipo `TeamSlug`.
  - `api.ts`: tipos de `GET /api/data` (`DataPayload`, `SlimMatch`, `SlimTeam`, `ApiStatus`).

  O `localStorage` fica em `src/client/lib/storage.ts`, e não em `shared`: só o cliente usa, e `shared` é compilado também no tsconfig do Worker, que não tem tipos de navegador.
- **Rationale**: FR-010 (um único lugar) e FR-011 (o tipo é o contrato; se o Worker mudar o formato, o cliente deixa de compilar). O Worker só usa `slug/art/name`, e importar o registro inteiro custa poucos bytes.
- **Alternatives considered**: *JSON compartilhado*: perde o tipo literal dos slugs. *Validação em runtime com zod*: dependência extra. Os dados vêm do nosso próprio Worker; a validação defensiva fica restrita ao `localStorage`, que pode ter formato antigo ou corrompido.

## R6. Separação da lógica de domínio

- **Decision**: o diretório `src/domain/` guarda funções puras sem DOM e sem Preact: `prepare`, `play`/`compareStandings`, `computeStandings` (tabela com palpites), `simulate` (Monte Carlo com RNG injetável, padrão `mulberry(42)`), `decide` (salvo/rebaixado), `verdict`, `predictions` (pick/step/setValue/fill/clear), `format` (`pctLabel`, `when`, `roundRange`, `signed`).
- **Rationale**: FR-009 e FR-013, princípio II da constituição. Hoje `compute()` mistura tabela, simulação e decisão. Separar permite testar cada parte. O `drawGoals` usa `Math.random`. Ele passa a receber um `rng` como parâmetro (o padrão continua sendo `Math.random`), o que permite testes determinísticos sem mudar o comportamento.
- **Note**: o algoritmo, as constantes (`N_SIM = 5000`, `K = 5`, semente 42, médias padrão 1.4/1.0) e a ordem de consumo do RNG ficam **idênticos**, para que as % saiam exatamente iguais às de hoje (SC-001).

## R7. Testes

- **Decision**:
  - **Vitest 4.x** (o `@cloudflare/vitest-pool-workers` 0.23 exige `vitest ^4.1`) com dois projetos:
    - `domain`: ambiente node, testes de `src/domain/**` e `src/client/lib/storage.ts`.
    - `worker`: `@cloudflare/vitest-pool-workers`, testes de rotas do Worker (redirect 301, página por time com título reescrito, `/api/data` em modo demo, fallback `stale`).
  - **Playwright** para regressão visual: screenshots de `/` e dos 9 times, em 390×844 e 1440×900, com dados demo e com um conjunto fixo de palpites.
- **Rationale**: SC-006 (domínio), FR-002/FR-005 (Worker), SC-001 (paridade visual comparável e repetível). Em modo demo os dados são determinísticos (`mulberry(7)`) e a simulação usa semente fixa, então as telas são estáveis. Só `fetchedAt` varia, e o texto em demo não mostra hora.
- **Baseline**: antes de migrar, capturar os screenshots da versão atual (commit inicial). Os testes visuais da versão nova comparam contra esse baseline, com tolerância de `maxDiffPixelRatio` de ~1%. A spec aceita 1–2 px de diferença.
- **Alternatives considered**: *Vitest 5*: incompatível com o pool de workers. *Jest*: integração pior com Vite/ESM. *Comparação manual*: não é repetível.

## R8. Lint e formatação

- **Decision**: **ESLint 10** (flat config) + `typescript-eslint` 8 (`strictTypeChecked` + `stylisticTypeChecked`) + `eslint-plugin-react-hooks` 7 (funciona com os hooks do Preact) + **Prettier 3** (printWidth 110, singleQuote, semicolons, como no código atual). Scripts: `lint`, `format`, `typecheck`, `test`, `test:visual`, `check` (todos juntos).
- **Rationale**: FR-012. A config de `react-hooks` pega dependências faltando em `useMemo`/`useEffect`. O código atual tem um caso: `res` depende de `palKey` mas usa `pal`.

## R9. Persistência no navegador (compatibilidade)

- **Decision**: manter as chaves `gremiocai-palpites-v1` (palpites: `Record<matchId, { h, a, auto? }>`) e `gremiocai-dados-v1` (última cópia do `DataPayload`). A leitura passa por um parser que descarta entradas inválidas (placar fora de 0–9, não numérico) em vez de quebrar.
- **Rationale**: FR-003/SC-002 sem migração de dados. Atende o edge case de palpites corrompidos.

## R10. Publicação sem indisponibilidade e controle de versão

- **Decision**: `git init` + commit da versão atual **antes** de qualquer mudança (baseline). A migração acontece na branch `001-migracao-framework-web`. A publicação usa `wrangler deploy` (troca atômica de versão do Worker + assets). Antes do deploy de produção: `wrangler versions upload` + teste no preview URL. Rollback com `wrangler rollback`.
- **Rationale**: SC-007. O deploy de Workers não tem janela de indisponibilidade, e o rollback é imediato.

## R11. Desempenho

- **Decision**: o Preact fica no bundle (sai o `<script>` do unpkg, menos uma conexão a terceiros). O script vai como `type="module"` com hash no nome e cache longo. A simulação continua na thread principal com 5000 iterações, como hoje. Movê-la para um Web Worker fica fora do escopo.
- **Rationale**: SC-003 pede tempo igual ou menor. Tirar o CDN externo já reduz a latência do primeiro veredito.
