# Paridade: versão antiga (tag `pre-migracao`) × versão nova

**Data**: 2026-10-30. Dados demo fixos (`tests/domain/fixtures/demo-payload.json`), Chromium do Playwright.

## Números (T022)

- [x] Tabela, pontos, % de queda e decisões **idênticas** à versão antiga, sem palpites e com o conjunto fixo de palpites (`tests/domain/parity.test.ts`).

## Visual (T057, SC-001)

- [x] 40/40 telas passam no `npm run test:visual` (raiz + 9 times × celular/desktop × sem/com palpites, tolerância de 1%).
- [x] Com tolerância zero: 35 telas idênticas pixel a pixel. As outras 5 diferem de 1 a 110 pixels (de ~1,6 milhão), só no anti-aliasing do selo rotacionado "SALVO MATEMATICAMENTE" e de alguns dígitos. Nenhuma diferença de cor, texto ou layout.

## Checagens manuais (T058)

Automatizadas com Playwright, rodando a versão antiga (porta 8788) e a nova (8787) lado a lado.

- [x] **Palpites (SC-002)**: os mesmos cliques geram o mesmo JSON em `gremiocai-palpites-v1`, o mesmo veredito, o mesmo cabeçalho "Tabela simulada" e o mesmo banner. Os palpites gravados pela versão antiga, abertos na nova, aparecem marcados e dão o mesmo veredito.
- [x] **Reduzir movimento**: com `prefers-reduced-motion: reduce`, a animação do veredito fica `none`.
- [x] **Barra fixa**: depois de rolar, fica embaixo no desktop (12 px do rodapé) e em cima no celular (44 px do topo), com o mesmo `aria-label` nas duas versões.
- [x] **Tempo até o veredito (SC-003)**: celular 390×844, Fast 4G (150 ms, 9 Mbps) e CPU 4× mais lenta, 10 rodadas intercaladas. Mediana: antiga **1330 ms**, nova **1289 ms**. A nova foi medida no `vite preview`, que não comprime os arquivos; em produção a Cloudflare comprime, e a diferença a favor da nova tende a aumentar.

## Bundle (T072)

- [x] JS do cliente: 49,3 KB, **19,3 KB gzip** (meta ≤ ~25 KB). CSS: 21,0 KB, 5,4 KB gzip. Worker: 7,0 KB, 3,0 KB gzip.
- A versão antiga carregava `app.js` (26 KB) + Preact/htm do unpkg (terceiro). A nova não depende mais de CDN externo.

## Publicação (T074)

- [x] Versão `cae6f73a` enviada sem tráfego (`wrangler versions upload`). No preview, com os **dados reais** de 30/10/2026 servidos igualmente às duas versões, as 10 páginas tiveram o texto idêntico ao da produção antiga (vereditos, %, tabelas, jogos), sem erro no console.
- [x] Promovida para 100% (`wrangler versions deploy`). `vaicair.diuliano.com` serve o build novo, `/api/data` traz dados reais, e `o-inter-cai`/`o-gremio-cai` redirecionam com 301. Para voltar atrás: `npx wrangler rollback`.
