const { html, render, useState, useEffect, useLayoutEffect, useRef, useMemo } = htmPreact;

const LS = 'gremiocai-palpites-v1';
const LSD = 'gremiocai-dados-v1';
// vaicair.diuliano.com/ lista os times; vaicair.diuliano.com/inter etc. é a página de um time.
// O Worker escolhe o time pelo caminho, marca <html data-team> e ajusta título e prévia de link.
// Os times são os que ainda brigavam contra a queda na 33ª rodada de 2026 (do Botafogo, 11º, para baixo); a lista também está em src/index.js.
// O time é achado pelo id da API (as siglas mudam e se repetem: Coritiba e Corinthians são COR); code só para os dados de demonstração.
// hd: o PNG da API tem só 70px. Grêmio, Inter, Vitória, Mirassol e Remo vêm do Wikimedia Commons;
// os outros são o SVG da API, sem o quadrado branco de fundo.
// accent nunca é vermelho nem verde: essas cores são do SIM/NÃO e do Z4. A cor do clube vai no halo e nas listras.
const W = '#E6EAF0';
const TEAMS = {
  gremio: { art: 'O', name: 'Grêmio', code: 'GRE', id: 1767, accent: '#1A9BE0', halo: '#1A9BE0',
    bg: 'repeating-linear-gradient(90deg,#1A9BE0 0 26px,#000 26px 52px,#fff 52px 55px,#000 55px 81px)' },
  inter: { art: 'O', name: 'Inter', code: 'INT', id: 6684, accent: W, halo: '#E5050F',
    bg: 'repeating-linear-gradient(90deg,#E5050F 0 40px,#fff 40px 46px)' },
  corinthians: { art: 'O', name: 'Corinthians', code: 'COR', id: 1779, accent: W, halo: W,
    bg: 'repeating-linear-gradient(90deg,#fff 0 26px,#000 26px 52px)' },
  vasco: { art: 'O', name: 'Vasco', code: 'VAS', id: 1780, accent: W, halo: W,
    bg: 'linear-gradient(125deg,transparent 0 38%,#fff 38% 52%,transparent 52%)' },
  botafogo: { art: 'O', name: 'Botafogo', code: 'BOT', id: 1770, accent: W, halo: W,
    bg: 'repeating-linear-gradient(90deg,#fff 0 30px,#000 30px 60px)' },
  coritiba: { art: 'O', name: 'Coritiba', code: 'CFC', id: 4241, accent: W, halo: W,
    bg: 'repeating-linear-gradient(180deg,#00544D 0 30px,#fff 30px 36px)' },
  vitoria: { art: 'O', name: 'Vitória', code: 'VIT', id: 1782, accent: W, halo: '#E30613',
    bg: 'repeating-linear-gradient(180deg,#E30613 0 40px,#000 40px 80px)' },
  mirassol: { art: 'O', name: 'Mirassol', code: 'MIR', id: 4364, accent: W, halo: '#FFE000',
    bg: 'repeating-linear-gradient(90deg,#FFE000 0 30px,#000 30px 60px)' },
  remo: { art: 'O', name: 'Remo', code: 'REM', id: 4287, accent: '#7FA6FF', halo: '#4F7DFF',
    bg: 'repeating-linear-gradient(90deg,#1F3E8C 0 30px,#000 30px 60px)' },
};
const SLUG = TEAMS[document.documentElement.dataset.team] ? document.documentElement.dataset.team : null; // null = página inicial
const TEAM = SLUG && TEAMS[SLUG];
const TEAM_HD = `/${SLUG}.svg`;
const ask = (t) => `${t.art} ${t.name} cai?`;
const findId = (ids, teams, t) => (ids.find((id) => id === t.id) ?? ids.find((id) => teams[id].code === t.code)) || null;
const TZ = 'America/Sao_Paulo';
const N_SIM = 5000;

const STATUS = { FINISHED: 'fin', AWARDED: 'fin', IN_PLAY: 'live', PAUSED: 'live', LIVE: 'live', SCHEDULED: 'fut', TIMED: 'fut', POSTPONED: 'fut', SUSPENDED: 'fut' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function when(utc) {
  const p = Object.fromEntries(dtf.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return { wd: WD[WD_EN.indexOf(p.weekday)], d: +p.day, m: +p.month, hm: p.hour + ':' + p.minute };
}

function roundRange(games) {
  if (!games.length) return '';
  const ds = games.map((g) => g.utc).sort();
  const a = when(ds[0]), b = when(ds[ds.length - 1]);
  if (a.d === b.d && a.m === b.m) return `${a.d} ${MO[a.m - 1]}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${MO[a.m - 1]}`;
  return `${a.d} ${MO[a.m - 1]} – ${b.d} ${MO[b.m - 1]}`;
}

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// critérios do Brasileirão: pontos, vitórias, saldo, gols pró
const sortFn = (x, y) => y.pts - x.pts || y.v - x.v || y.sg - x.sg || y.gp - x.gp || x.name.localeCompare(y.name);

function play(h, a, x, y) {
  h.j++; a.j++; h.gp += x; h.gc += y; a.gp += y; a.gc += x; h.sg += x - y; a.sg += y - x;
  if (x > y) { h.pts += 3; h.v++; a.d++; } else if (x < y) { a.pts += 3; a.v++; h.d++; } else { h.pts++; a.pts++; h.e++; a.e++; }
}

function prepare(d) {
  const teams = {}, matches = [];
  for (const m of d.matches) {
    for (const t of [m.h, m.a]) if (t.id && !teams[t.id]) teams[t.id] = { id: t.id, name: t.name, code: t.tla || t.name.slice(0, 3).toUpperCase(), crest: t.crest || null };
    const status = STATUS[m.status];
    if (!status || !m.h.id || !m.a.id) continue;
    matches.push({ id: m.id, r: m.md, h: m.h.id, a: m.a.id, status: status === 'fin' && m.hs == null ? 'fut' : status, postponed: m.status === 'POSTPONED', hs: m.hs, as: m.as, utc: m.utc });
  }
  const ids = Object.keys(teams).map(Number);
  const base = {};
  ids.forEach((id) => (base[id] = { ...teams[id], pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 }));
  let hg = 0, ag = 0, nf = 0;
  matches.forEach((g) => { if (g.status === 'fin') { play(base[g.h], base[g.a], g.hs, g.as); hg += g.hs; ag += g.as; nf++; } });

  // força pela campanha: ataque e defesa relativos à média, puxados para 1 nos primeiros jogos
  const avgH = nf ? hg / nf : 1.4, avgA = nf ? ag / nf : 1.0, avg = (avgH + avgA) / 2, K = 5;
  const att = {}, def = {};
  ids.forEach((id) => { const t = base[id]; att[id] = (t.gp + K * avg) / (t.j + K) / avg; def[id] = (t.gc + K * avg) / (t.j + K) / avg; });

  const rounds = {};
  matches.forEach((g) => (rounds[g.r] = rounds[g.r] || []).push(g));
  const nums = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  // jogo adiado de rodada antiga não deve prender a "rodada atual" lá atrás
  const pending = nums.filter((r) => rounds[r].some((g) => g.status !== 'fin' && !g.postponed));
  const gid = TEAM ? findId(ids, teams, TEAM) : null;
  return { teams, matches, ids, base, rounds, first: nums[0], last: nums[nums.length - 1], current: pending.length ? pending[0] : nums[nums.length - 1], lambda: (h, a) => [avgH * att[h] * def[a], avgA * att[a] * def[h]], gid };
}

function compute(P, pal) {
  const { ids, base, matches } = P;
  const st = {};
  ids.forEach((id) => (st[id] = { ...base[id] }));
  const rem = [];
  for (const g of matches) {
    if (g.status === 'fin') continue;
    const p = g.status === 'fut' && pal[g.id];
    if (p) play(st[g.h], st[g.a], p.h, p.a); else rem.push(g);
  }
  const table = ids.map((id) => st[id]).sort(sortFn);

  const n = ids.length, idx = {};
  ids.forEach((id, i) => (idx[id] = i));
  const pts0 = Int32Array.from(ids, (id) => st[id].pts), v0 = Int32Array.from(ids, (id) => st[id].v);
  const sg0 = Int32Array.from(ids, (id) => st[id].sg), gp0 = Int32Array.from(ids, (id) => st[id].gp);
  const left = new Int32Array(n);
  const games = rem.map((g) => { const h = idx[g.h], a = idx[g.a]; left[h]++; left[a]++; const [lh, la] = P.lambda(g.h, g.a); return [h, a, Math.exp(-lh), Math.exp(-la)]; });
  const rng = mulberry(42), rel = new Float64Array(n);
  const pts = new Int32Array(n), v = new Int32Array(n), sg = new Int32Array(n), gp = new Int32Array(n), tie = new Float64Array(n);
  const ord = ids.map((_, i) => i);
  const pois = (L) => { let k = 0, p = rng(); while (p > L) { k++; p *= rng(); } return k; };
  const cut = Math.max(0, n - 4);
  for (let s = 0; s < N_SIM; s++) {
    pts.set(pts0); v.set(v0); sg.set(sg0); gp.set(gp0);
    for (const [h, a, Lh, La] of games) {
      const x = pois(Lh), y = pois(La);
      gp[h] += x; gp[a] += y; sg[h] += x - y; sg[a] += y - x;
      if (x > y) { pts[h] += 3; v[h]++; } else if (x < y) { pts[a] += 3; v[a]++; } else { pts[h]++; pts[a]++; }
    }
    for (let i = 0; i < n; i++) tie[i] = rng();
    ord.sort((x, y) => pts[y] - pts[x] || v[y] - v[x] || sg[y] - sg[x] || gp[y] - gp[x] || tie[y] - tie[x]);
    for (let k = cut; k < n; k++) rel[ord[k]]++;
  }
  const pct = {}, dec = {};
  // sem jogos restantes (fim do campeonato ou tudo palpitado), a posição final decide, inclusive no desempate
  if (!rem.length) {
    table.forEach((t, k) => { const out = k >= cut; pct[t.id] = out ? 1 : 0; dec[t.id] = out ? 'reb' : 'salvo'; });
    return { table, pct, dec };
  }
  // com jogos restantes: salvo se não há times suficientes capazes de alcançá-lo; rebaixado se já há times
  // suficientes acima do máximo que ele ainda pode fazer (empate em pontos fica em aberto pelo desempate)
  ids.forEach((id, i) => {
    pct[id] = rel[i] / N_SIM;
    const max = pts0[i] + 3 * left[i];
    let canReach = 0, above = 0;
    ids.forEach((_, j) => { if (j === i) return; if (pts0[j] + 3 * left[j] >= pts0[i]) canReach++; if (pts0[j] > max) above++; });
    dec[id] = canReach < cut ? 'salvo' : above >= cut ? 'reb' : null;
  });
  return { table, pct, dec };
}

const pctLabel = (p, d) => (d === 'salvo' ? '0%' : d === 'reb' ? '100%' : p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : Math.round(p * 100) + '%');
const hideImg = (e) => { const i = e.currentTarget; i.style.display = 'none'; const sp = i.parentNode && i.parentNode.firstElementChild; if (sp && sp !== i) sp.style.display = 'grid'; };
const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

// placar sorteado pelo mesmo modelo da % de queda (Poisson pela força dos times)
function drawGoals(L) { const e = Math.exp(-L); let k = 0, p = Math.random(); while (p > e && k < 9) { k++; p *= Math.random(); } return k; }

// ícones desenhados (setas e símbolos Unicode viram emoji no iOS)
const ICONS = {
  prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', close: 'M6 6l12 12M18 6L6 18', warn: 'M12 3L2 21h20L12 3zM12 10v5M12 18v.01',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
};
const Ico = (name, size = '1em', w = 2.4) => html`<svg class="ico" style="width:${size};height:${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[name]} /></svg>`;

// sem dados e sem cópia salva: avisa e deixa tentar de novo, em vez de carregar para sempre
const Failed = ({ msg, detail = 'A conexão com a football-data.org falhou. Confira a internet e tente de novo.' }) => html`
  <div role="alert" style="display:flex;flex-direction:column;align-items:flex-start;gap:12px;max-width:44ch">
    <p style="margin:0;font-weight:600;font-size:clamp(.95rem,1.6vw,1.15rem);line-height:1.4;color:var(--text-muted);text-wrap:pretty"><strong style="color:var(--warn)">${msg}</strong> ${detail}</p>
    <button onClick=${() => location.reload()} style="height:44px;padding:0 18px;border-radius:8px;border:1px solid var(--warn);background:color-mix(in srgb, var(--warn) 12%, var(--surface-2));color:var(--text);font-weight:700">Tentar de novo</button>
  </div>`;

function loadPal() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }

// dados da API (com cópia no localStorage para quando cair a conexão), largura da tela e relógio
function useData() {
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    fetch('/api/data').then((r) => r.json()).then((d) => {
      if (!d.matches) throw new Error(d.error || 'sem dados');
      setRaw(d); setErr(!!d.stale);
      try { localStorage.setItem(LSD, JSON.stringify(d)); } catch (e) {}
    }).catch(() => {
      setErr(true);
      try { const d = JSON.parse(localStorage.getItem(LSD)); if (d) setRaw(d); } catch (e) {}
    });
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => { window.removeEventListener('resize', onResize); clearInterval(t); };
  }, []);
  const P = useMemo(() => (raw ? prepare(raw) : null), [raw]);
  return { raw, err, width, now, P };
}

function status(raw, err, now, P) {
  const mins = raw ? Math.max(0, Math.round((now - raw.fetchedAt) / 60000)) : 0;
  const ago = mins < 1 ? 'agora' : mins < 60 ? `há ${mins} min` : `há ${Math.round(mins / 60)} h`;
  const roundTxt = P ? ` · Rodada ${P.current} de ${P.last}` : '';
  const text = raw && raw.demo ? 'Dados de demonstração' + roundTxt
    : err ? (raw ? `Sem conexão · dados de ${hm(raw.fetchedAt)}` : 'Sem conexão com a API') + roundTxt
    : !raw ? 'Carregando dados…' : `Atualizado ${ago}` + roundTxt;
  const dot = err || (raw && raw.demo) ? 'var(--warn)' : !raw ? 'var(--text-muted)' : 'var(--safe)';
  return { text, dot };
}

const Footer = () => html`
  <footer style="border-top:1px solid var(--line);padding:24px 16px 72px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font-size:0.78rem;color:var(--text-muted);line-height:1.5">
    <nav aria-label="Times" style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;margin-bottom:6px">
      ${SLUG ? html`<a href="/" style="font-weight:700">Todos os times</a>` : html`<span aria-current="page" style="color:var(--text);font-weight:700">Todos os times</span>`}
      ${Object.entries(TEAMS).map(([slug, t]) => slug === SLUG
        ? html`<span key=${slug} aria-current="page" style="color:var(--text);font-weight:700">${ask(t)}</span>`
        : html`<a key=${slug} href=${'/' + slug} style="font-weight:600">${ask(t)}</a>`)}
    </nav>
    <strong style="color:var(--text);font-weight:600">Site não oficial, feito por torcedor.</strong>
    <span>Dados: <a href="https://www.football-data.org" target="_blank" rel="noopener">football-data.org</a>. Sem vínculo com clubes, CBF ou patrocinadores.</span>
    <span style="max-width:60ch;text-wrap:pretty">A % de queda vem de ${N_SIM.toLocaleString('pt-BR')} simulações dos jogos restantes. Cada placar é sorteado pela força de ataque e defesa dos times no campeonato, com vantagem para o mandante, respeitando seus palpites.</span>
  </footer>`;

const statusBar = (st, right) => html`
  <div style="position:sticky;top:0;z-index:40;height:36px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;background:color-mix(in srgb, var(--bg) 88%, transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);font-size:0.78rem;color:var(--text-muted)">
    <div style="display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden">
      <span style="width:7px;height:7px;border-radius:50%;flex:none;background:${st.dot}"></span>
      ${st.text && html`<span style="overflow:hidden;text-overflow:ellipsis">${st.text}</span>`}
    </div>
    ${right}
  </div>`;

// página inicial: quem cairia hoje (SIM) em destaque, a linha do Z4 e, abaixo, quem escapa (NÃO).
// Dentro de cada grupo, do mais ameaçado para o menos. Sempre pela tabela real.
function Home() {
  const { raw, err, width, now, P } = useData();
  const REAL = useMemo(() => (P ? compute(P, {}) : null), [P]);
  const mobile = width < 768;
  const head = 'font-family:var(--head);font-weight:var(--head-w);font-stretch:var(--head-s);text-transform:uppercase';
  const hasPal = Object.keys(loadPal()).length > 0;
  let cards = [];
  if (REAL) {
    const n = REAL.table.length;
    cards = Object.entries(TEAMS).map(([slug, t]) => {
      const gid = findId(P.ids, P.teams, t);
      const pos = REAL.table.findIndex((x) => x.id === gid) + 1;
      return gid && { slug, t, pos, pts: REAL.table[pos - 1].pts, yes: pos > n - 4, p: REAL.pct[gid], label: pctLabel(REAL.pct[gid], REAL.dec[gid]) };
    }).filter(Boolean).sort((a, b) => b.p - a.p || b.pos - a.pos);
  }
  const sims = cards.filter((c) => c.yes), naos = cards.filter((c) => !c.yes);
  // os SIM ficam lado a lado só se cada um tiver ao menos 320px; senão, um por linha
  const cw = Math.min(width, 1280) - (mobile ? 24 : 64);
  const simCols = !mobile && sims.length && cw / sims.length >= 320 ? sims.length : 1;

  // SIM lado a lado ou no celular: formato pôster (escudo e SIM em cima, pergunta embaixo na largura toda);
  // SIM sozinho na linha e todos os NÃO: em linha (escudo, pergunta, resposta)
  const poster = mobile || simCols > 1;
  const card = (c, big) => {
    const tall = big && poster;
    const s = tall
      ? { pad: mobile ? '16px' : '20px 22px', gap: mobile ? '12px 14px' : '16px 18px', crest: mobile ? '52px' : '72px', q: mobile ? 'min(1.25rem,5.6vw)' : '1.35rem', meta: '0.85rem', ans: mobile ? 'min(3rem,14vw)' : '4rem' }
      : big
      ? { pad: '22px', gap: '18px', crest: '84px', q: '1.35rem', meta: '0.85rem', ans: '3.4rem' }
      : { pad: mobile ? '10px 12px' : '12px 16px', gap: '12px', crest: mobile ? '40px' : '44px', q: mobile ? 'min(1rem,4.4vw)' : '1rem', meta: '0.78rem', ans: mobile ? 'min(1.7rem,8vw)' : '1.8rem' };
    const grid = tall ? `grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:'crest ans' 'txt txt'` : `grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:'crest txt ans'`;
    return html`
      <a key=${c.slug} class="card" href=${'/' + c.slug} aria-label="${ask(c.t)} ${c.yes ? 'Sim' : 'Não'}. ${c.pos}º lugar, ${c.label} de chance de cair"
        style="position:relative;isolation:isolate;overflow:hidden;display:grid;${grid};align-items:center;gap:${s.gap};padding:${s.pad};border-radius:10px;background:${c.yes ? 'color-mix(in srgb, var(--danger) 7%, var(--surface))' : 'var(--surface)'};color:var(--text);text-decoration:none;box-shadow:inset 0 0 0 ${big ? '2px' : '1px'} ${c.yes ? 'color-mix(in srgb, var(--danger) 60%, var(--line))' : 'var(--line)'}">
        <div aria-hidden="true" style="position:absolute;inset:0;z-index:-1;opacity:${big ? 0.09 : 0.06};background:${c.t.bg}"></div>
        <div style="grid-area:crest;align-self:${tall ? "start" : "center"};position:relative;width:${s.crest};aspect-ratio:1;display:grid;place-items:center">
          <div aria-hidden="true" style="position:absolute;inset:-30%;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${c.t.halo} ${big ? 40 : 28}%, transparent), transparent 65%)"></div>
          <img src=${'/' + c.slug + '.svg'} alt="" style="position:relative;width:100%;height:100%;object-fit:contain" />
        </div>
        <div style="grid-area:txt;align-self:${tall ? "end" : "center"};min-width:0;display:flex;flex-direction:column;gap:${big ? '6px' : '3px'}">
          <span style="${head};font-size:${s.q};line-height:1.05;text-wrap:balance">${ask(c.t)}</span>
          <span style="font-size:${s.meta};line-height:1.35;color:var(--text-muted);font-variant-numeric:tabular-nums"><span style="white-space:nowrap"><strong style="color:${c.p >= 0.5 ? 'var(--danger)' : 'var(--text)'}">${c.label}</strong> de chance</span> <span style="white-space:nowrap">· ${c.pos}º · ${c.pts} pts</span></span>
        </div>
        <span style="grid-area:ans;justify-self:end;align-self:${tall ? "start" : "center"};margin-top:${tall ? "6px" : "0"};${head};font-size:${s.ans};line-height:.9;letter-spacing:var(--head-ls);color:${c.yes ? 'var(--danger)' : 'var(--safe)'}">${c.yes ? 'SIM' : 'NÃO'}</span>
      </a>`;
  };
  const sk = (k, h) => html`<div key=${k} style="height:${h};border-radius:10px;background:var(--surface);animation:shimmer 1.4s ease-in-out infinite"></div>`;
  const naoGrid = `display:grid;grid-template-columns:repeat(auto-fill,minmax(${mobile ? '100%' : '340px'},1fr));gap:8px`;
  const z4Line = html`
    <div role="separator" style="display:flex;align-items:center;gap:12px;margin:${mobile ? '20px 0' : '28px 0'}">
      <span style="flex:1;border-top:2px dashed var(--danger)"></span>
      <span style="display:flex;align-items:center;gap:8px;font-size:0.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);white-space:nowrap">
        <span style="background:var(--danger);color:#fff;font-weight:800;letter-spacing:.1em;padding:2px 7px;border-radius:3px">Z4</span>Linha da queda
      </span>
      <span style="flex:1;border-top:2px dashed var(--danger)"></span>
    </div>`;

  return html`
<div data-theme="dark" data-font="archivo" style="background:var(--bg);color:var(--text);min-height:100vh;font-family:var(--body);font-size:0.95rem;-webkit-font-smoothing:antialiased">
  ${statusBar(status(raw, err, now, P))}
  <section style="max-width:1280px;margin:0 auto;padding:${mobile ? '40px 16px 32px' : '72px 32px 48px'}">
    <h1 style="margin:0;${head};font-size:${mobile ? 'min(16vw,4.5rem)' : 'clamp(4rem,9vw,8rem)'};line-height:.88;letter-spacing:var(--head-ls)">Quem vai <span style="color:var(--danger)">cair?</span></h1>
    <p style="margin:16px 0 0;max-width:52ch;font-weight:600;font-size:clamp(.95rem,1.6vw,1.15rem);line-height:1.4;color:var(--text-muted);text-wrap:balance">A chance de cada time da briga contra o rebaixamento cair no Brasileirão. Escolha o seu para ver a tabela e simular os jogos que faltam.</p>
  </section>
  <main style="max-width:1280px;margin:0 auto;padding:0 ${mobile ? '12px' : '32px'} 56px">
    <div style="display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;margin:0 0 16px">
      <h2 style="margin:0;${head};font-size:${mobile ? '1.5rem' : '1.75rem'};letter-spacing:.01em">Na briga</h2>
      ${raw && html`<span style="font-size:0.78rem;color:var(--text-muted)">${hasPal ? 'Tabela real, sem os seus palpites' : 'Tabela atual'}</span>`}
    </div>
    ${err && !raw ? html`<${Failed} msg="Não deu para carregar a tabela." />` : !REAL ? html`
      <div style="display:grid;grid-template-columns:repeat(${mobile ? 1 : 3},minmax(0,1fr));gap:${mobile ? '8px' : '12px'}">${[1, 2, 3].map((k) => sk(k, mobile ? '92px' : '128px'))}</div>
      <div style="margin:${mobile ? '20px 0' : '28px 0'};border-top:2px dashed color-mix(in srgb, var(--danger) 35%, transparent)"></div>
      <div style=${naoGrid}>${[1, 2, 3, 4, 5, 6].map((k) => sk(k, mobile ? '64px' : '72px'))}</div>` : html`
      ${sims.length
        ? html`<div style="display:grid;grid-template-columns:repeat(${simCols},minmax(0,1fr));gap:${mobile ? '8px' : '12px'}">${sims.map((c) => card(c, true))}</div>`
        : html`<p style="margin:0;color:var(--text-muted);font-weight:600">Nenhum time da lista está no Z4 hoje.</p>`}
      ${z4Line}
      <div style=${naoGrid}>${naos.map((c) => card(c, false))}</div>`}
  </main>
  <${Footer} />
</div>`;
}

function App() {
  const { raw, err, width, now, P } = useData();
  const [pal, setPalState] = useState(loadPal);
  const [round, setRound] = useState(null);
  const [pin, setPin] = useState(null);
  const [bandOut, setBandOut] = useState(false); // faixa amarela do modo simulação já saiu da tela
  const rootRef = useRef(null), heroRef = useRef(null), posRef = useRef(null);

  const palKey = JSON.stringify(pal);
  const REAL = useMemo(() => (P ? compute(P, {}) : null), [P]);
  const res = useMemo(() => (!P ? null : Object.keys(pal).length ? compute(P, pal) : REAL), [P, palKey]);

  // FLIP: linhas da tabela deslizam até a nova posição
  useLayoutEffect(() => {
    const old = posRef.current;
    posRef.current = null;
    if (!old || !rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rootRef.current.querySelectorAll('[data-team]').forEach((el) => {
      const o = old[el.dataset.team];
      if (o == null) return;
      const dy = o - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  });

  const mobile = width < 768, full = !mobile, wide = width >= 1100;

  // com o banner fora da tela, a barra do time (com o SIM/NÃO) gruda no rodapé;
  // no celular, vai para o topo quando a linha dele na tabela já passou
  useEffect(() => {
    const update = () => {
      let p = null;
      const hero = heroRef.current, root = rootRef.current;
      if (hero && root && hero.getBoundingClientRect().bottom < 80) {
        const g = root.querySelector(`[data-team="${P && P.gid}"]`);
        p = mobile && g && g.getBoundingClientRect().bottom < 36 ? 'top' : 'bottom';
      }
      setPin(p);
      setBandOut(!!hero && hero.getBoundingClientRect().top < -48);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [mobile, P]);

  const setPal = (fn) => {
    const root = rootRef.current;
    if (root) { const m = {}; root.querySelectorAll('[data-team]').forEach((el) => (m[el.dataset.team] = el.getBoundingClientRect().top)); posRef.current = m; }
    setPalState((s) => { const p = fn({ ...s }); try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {} return p; });
  };

  const loading = !res || !P.gid;
  const failed = (err && !raw) || (P && !P.gid);
  const isSim = Object.keys(pal).length > 0;
  const R = P ? Math.min(P.last, Math.max(P.first, round ?? P.current)) : null;

  // ---- banner ----
  let yes = false, badge = null, badgeColor = 'var(--safe)', ctxPct = '', ctxRest = '', gPos = 0, g = null;
  if (!loading) {
    const { table, pct, dec } = res, n = table.length, z = n - 4;
    const gIdx = table.findIndex((t) => t.id === P.gid);
    gPos = gIdx + 1; g = table[gIdx]; yes = gPos > z;
    ctxPct = pctLabel(pct[P.gid], dec[P.gid]);
    if (yes) { const gap = table[z - 1].pts - g.pts; ctxRest = `de chance de cair · ${gPos}º lugar · ${gap > 0 ? `${gap} pt${gap > 1 ? 's' : ''} para sair do Z4` : 'fora do Z4 só no desempate'}`; }
    else { const gap = g.pts - table[z].pts; ctxRest = `de chance de cair · ${gPos}º lugar · ${gap > 0 ? `${gap} pt${gap > 1 ? 's' : ''} acima do Z4` : 'à frente do Z4 no desempate'}`; }
    if (dec[P.gid] === 'salvo') badge = 'SALVO MATEMATICAMENTE';
    if (dec[P.gid] === 'reb') { badge = 'REBAIXADO'; badgeColor = 'var(--danger)'; }
  }
  const word = loading ? '?' : yes ? 'SIM' : 'NÃO';
  const col = failed ? 'var(--line)' : loading ? 'var(--text-muted)' : yes ? 'var(--danger)' : 'var(--safe)';
  const answerStyle = `font-family:var(--head);font-weight:var(--head-w);font-stretch:var(--head-s);font-size:${mobile ? 'min(40vw,30vh)' : 'var(--ans)'};line-height:.85;letter-spacing:var(--head-ls);padding-top:.2em;transform-origin:left center;color:${col};animation:stamp .55s cubic-bezier(.16,1,.3,1) both${yes && !loading ? ', glowpulse 2.8s ease-in-out .7s infinite' : ''}`;

  const st = status(raw, err, now, P);

  // ---- tabela ----
  const cols = mobile ? '2.2rem minmax(0,1fr) 2rem 2.4rem 3.6rem' : '2.8rem minmax(0,1fr) 3rem 2.5rem 2.5rem 2.5rem 2.5rem 3rem 5.5rem';
  const realPos = {};
  if (REAL) REAL.table.forEach((t, i) => (realPos[t.id] = i + 1));
  const rows = loading ? [] : res.table.map((t, i) => {
    const pos = i + 1, n = res.table.length, isG = t.id === P.gid, z4 = pos > n - 4, dlt = realPos[t.id] - pos, p = res.pct[t.id];
    return {
      t, pos, isG, z4, z4Label: pos === n - 3,
      arrow: isSim && dlt ? (dlt > 0 ? '▲' + dlt : '▼' + -dlt) : null, dlt,
      zone: pos <= 4 ? 'var(--accent)' : pos <= 6 ? 'color-mix(in srgb, var(--accent) 45%, #06223a)' : z4 ? 'var(--danger)' : 'transparent',
      bg: isG ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : z4 ? 'color-mix(in srgb, var(--danger) 8%, var(--surface))' : i % 2 ? 'color-mix(in srgb, var(--surface-2) 55%, var(--surface))' : 'var(--surface)',
      borderTop: pos === n - 3 ? '2px dashed var(--danger)' : i ? '1px solid color-mix(in srgb, var(--line) 60%, transparent)' : 'none',
      pct: pctLabel(p, res.dec[t.id]), pctW: Math.round(p * 100) + '%', pctColor: p >= 0.5 ? 'var(--danger)' : p >= 0.15 ? 'var(--text)' : 'var(--text-muted)',
    };
  });

  // ---- jogos ----
  const sg = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '0');
  const step = (id, side, d) => setPal((p) => { const c = { h: 0, a: 0, ...p[id] }; delete c.auto; c[side] = Math.max(0, Math.min(9, c[side] + d)); p[id] = c; return p; });
  const setV = (id, side) => (e) => { const v = e.target.value.replace(/\D/g, '').slice(-1); setPal((p) => { const c = { h: 0, a: 0, ...p[id] }; delete c.auto; c[side] = v === '' ? 0 : Math.min(9, +v); p[id] = c; return p; }); };
  const pick = (id, o) => () => setPal((p) => { p[id] = o === 'V' ? { h: 1, a: 0 } : o === 'E' ? { h: 1, a: 1 } : { h: 0, a: 1 }; return p; });
  const btn = (act) => (act ? 'background:var(--accent);color:#03121C;border:1px solid var(--accent)' : 'background:var(--surface-2);color:var(--text);border:1px solid var(--line)');
  const pickTxt = 'font-weight:700;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  const roundGames = P ? (P.rounds[R] || []).slice().sort((x, y) => (y.h === P.gid || y.a === P.gid) - (x.h === P.gid || x.a === P.gid) || x.utc.localeCompare(y.utc)) : [];
  const roundHasPicks = roundGames.some((gm) => pal[gm.id]);

  // sorteia os jogos sem palpite (e refaz os já sorteados); palpites feitos à mão ficam
  const fill = (games) => setPal((p) => {
    games.forEach((gm) => {
      if (gm.status !== 'fut' || (p[gm.id] && !p[gm.id].auto)) return;
      const [lh, la] = P.lambda(gm.h, gm.a);
      p[gm.id] = { h: drawGoals(lh), a: drawGoals(la), auto: 1 };
    });
    return p;
  });
  const futAll = P ? P.matches.filter((gm) => gm.status === 'fut') : [];
  const hasAuto = futAll.some((gm) => pal[gm.id] && pal[gm.id].auto);
  // rodada começada mas não terminada: a tabela só conta os jogos com palpite e fica desequilibrada
  const missingIn = (games) => { const fut = games.filter((gm) => gm.status === 'fut'), n = fut.filter((gm) => !pal[gm.id]).length; return n < fut.length ? n : 0; };
  const roundMissing = missingIn(roundGames);
  const incomplete = P ? Object.keys(P.rounds).map(Number).sort((a, b) => a - b).map((r) => [r, missingIn(P.rounds[r])]).filter(([, n]) => n) : [];
  const goRound = (r) => { setRound(r); const el = document.getElementById('jogos'); if (el) el.scrollIntoView({ behavior: 'smooth' }); };
  const jogos = (n) => `${n} jogo${n > 1 ? 's' : ''}`;

  const crest = (t, size) => html`
    <span style="position:relative;width:${size};height:${size};flex:none;display:grid;place-items:center">
      <span style="display:${t.crest ? 'none' : 'grid'};position:absolute;inset:0;border-radius:50%;place-items:center;background:var(--surface-2);font-size:8px;font-weight:700;color:var(--text-muted)">${t.code}</span>
      ${t.crest && html`<img src=${t.crest} alt="" loading="lazy" onError=${hideImg} style="width:100%;height:100%;object-fit:contain" />`}
    </span>`;

  const scoreInput = (gm, side, name, val, hasPick) => html`
    <div style="display:flex;align-items:center;gap:4px">
      ${mobile && html`<button aria-label="Menos um gol para ${name}" onClick=${() => step(gm.id, side, -1)} style="width:44px;height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-size:1.1rem">−</button>`}
      <input type="number" min="0" max="9" inputMode="numeric" placeholder="–" aria-label="Gols de ${name}" value=${val} onInput=${setV(gm.id, side)}
        style="width:44px;height:40px;border-radius:8px;border:1px solid ${hasPick ? 'var(--warn)' : 'var(--line)'};background:var(--surface-2);color:var(--text);text-align:center;font:800 1.1rem var(--body);font-variant-numeric:tabular-nums;-moz-appearance:textfield" />
      ${mobile && html`<button aria-label="Mais um gol para ${name}" onClick=${() => step(gm.id, side, 1)} style="width:44px;height:40px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-size:1.1rem">+</button>`}
    </div>`;

  const gameCard = (gm) => {
    const p = pal[gm.id], isFut = gm.status === 'fut', hasPick = isFut && !!p, o = hasPick ? (p.h > p.a ? 'V' : p.h < p.a ? 'D' : 'E') : null;
    const isG = gm.h === P.gid || gm.a === P.gid, h = P.teams[gm.h], a = P.teams[gm.a], w = when(gm.utc);
    const meta = gm.status === 'fin' ? `Encerrado · ${w.wd} ${w.d}/${w.m}` : gm.status === 'live' ? 'Em andamento' : gm.postponed ? 'Adiado' : `${w.wd} ${w.d}/${w.m} · ${w.hm}`;
    const line = (t, isHome) => html`
      <div style="display:flex;align-items:center;gap:10px;min-height:40px">
        ${crest(t, '24px')}
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${t.id === P.gid ? 800 : 600}">${t.name}</span>
        ${!isFut && html`<span style="width:2.2rem;text-align:center;font-weight:800;font-size:1.2rem;font-variant-numeric:tabular-nums">${isHome ? gm.hs : gm.as}</span>`}
        ${isFut && scoreInput(gm, isHome ? 'h' : 'a', t.name, hasPick ? String(isHome ? p.h : p.a) : '', hasPick)}
      </div>`;
    return html`
      <div key=${gm.id} style="display:flex;flex-direction:column;gap:6px;padding:${mobile ? '10px' : '10px 12px'};border-radius:10px;border:1.5px ${isFut && !hasPick && roundMissing ? 'dashed' : 'solid'} ${hasPick || (isFut && roundMissing) ? 'var(--warn)' : isG ? 'color-mix(in srgb, var(--accent) 40%, var(--line))' : 'var(--line)'};background:${isG ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px;font-size:0.72rem;color:var(--text-muted)">
          <div style="display:flex;align-items:center;gap:6px">
            ${gm.status === 'live' && html`<span style="width:8px;height:8px;border-radius:50%;background:var(--danger);animation:livedot 1.2s ease-in-out infinite"></span><span style="color:var(--danger);font-weight:800;letter-spacing:.08em">AO VIVO</span>`}
            <span>${meta}</span>
          </div>
          ${hasPick && html`
            <div style="display:flex;align-items:center;gap:2px">
              <span style="color:var(--warn);font-weight:700;letter-spacing:.06em;text-transform:uppercase">${p.auto ? 'Sorteado' : 'Palpite'}</span>
              <button aria-label="Apagar palpite" onClick=${() => setPal((q) => { delete q[gm.id]; return q; })} style="width:32px;height:28px;margin:-6px -8px -6px 0;border:none;background:none;color:var(--warn);display:grid;place-items:center">${Ico('close', '15px', 2.6)}</button>
            </div>`}
        </div>
        ${line(h, true)}
        ${line(a, false)}
        ${isFut && html`
          <div role="group" aria-label="Resultado para o mandante" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:2px">
            <button aria-label="Vitória do ${h.name}" aria-pressed=${o === 'V'} onClick=${pick(gm.id, 'V')} style="height:44px;padding:0 6px;border-radius:8px;${btn(o === 'V')};${pickTxt}">${h.name}</button>
            <button aria-label="Empate" aria-pressed=${o === 'E'} onClick=${pick(gm.id, 'E')} style="height:44px;padding:0 6px;border-radius:8px;${btn(o === 'E')};${pickTxt}">Empate</button>
            <button aria-label="Vitória do ${a.name}" aria-pressed=${o === 'D'} onClick=${pick(gm.id, 'D')} style="height:44px;padding:0 6px;border-radius:8px;${btn(o === 'D')};${pickTxt}">${a.name}</button>
          </div>`}
      </div>`;
  };

  const gCrest = (P && P.gid && P.teams[P.gid].crest) || TEAM_HD;
  const clearAll = () => setPal(() => ({}));
  const head = 'font-family:var(--head);font-weight:var(--head-w);font-stretch:var(--head-s);text-transform:uppercase';
  const num = 'text-align:center;color:var(--text-muted);font-variant-numeric:tabular-nums';
  const pinPct = !loading ? res.pct[P.gid] : 0;

  // no celular: escudo + pergunta numa linha, resposta embaixo ocupando a largura
  const heroCrest = html`
    <div style="position:relative;flex:none;display:grid;place-items:center;height:${mobile ? 'min(20vw,96px)' : 'min(clamp(80px,24vw,340px),46vh)'};aspect-ratio:1">
      <span style="display:none;position:absolute;inset:0;z-index:1;width:100%;height:100%;border-radius:50%;place-items:center;background:var(--surface-2);font-family:var(--head);font-weight:var(--head-w);font-stretch:var(--head-s);font-size:${mobile ? '1.2rem' : '3rem'};color:var(--text-muted)">${TEAM.code}</span>
      <div aria-hidden="true" style="position:absolute;inset:-35%;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${TEAM.halo} 45%, transparent) 0%, color-mix(in srgb, ${TEAM.halo} 12%, transparent) 40%, transparent 68%)"></div>
      <img src=${TEAM_HD} alt="Escudo d${TEAM.art.toLowerCase()} ${TEAM.name}" onError=${hideImg} style="position:absolute;inset:0;height:100%;width:100%;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,.5))" />
    </div>`;
  const heroQ = html`<h1 style="margin:0;${head};font-size:${mobile ? 'min(8vw,2.6rem)' : 'var(--q)'};line-height:.9;letter-spacing:var(--head-ls);color:var(--text);text-wrap:balance">${ask(TEAM)}</h1>`;
  const heroAns = html`
    <div style="display:grid;place-items:start;min-width:0">
      <div key=${word} aria-hidden="true" style=${answerStyle}>${word}</div>
    </div>`;

  return html`
<div ref=${rootRef} data-theme="dark" data-font="archivo" style="--accent:${TEAM.accent};background:var(--bg);color:var(--text);min-height:100vh;font-family:var(--body);font-size:0.95rem;-webkit-font-smoothing:antialiased">

  ${statusBar({ dot: st.dot, text: !(mobile && isSim && bandOut) && st.text }, isSim && bandOut && html`
      <div style="display:flex;align-items:center;gap:8px;flex:none">
        <span style="background:var(--warn);color:#160F00;font-weight:800;letter-spacing:.06em;font-size:0.68rem;padding:3px 7px;border-radius:4px">MODO SIMULAÇÃO</span>
        <button onClick=${clearAll} style="background:none;border:none;color:var(--warn);font-weight:700;font-size:0.78rem;padding:8px 0;text-decoration:underline">Voltar ao real</button>
      </div>`)}

  <section ref=${heroRef} style="position:relative;isolation:isolate;overflow:hidden;min-height:${mobile ? 'calc(100svh - 36px)' : '80svh'};display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:clamp(6px,1.4vh,14px);padding:64px max(16px, calc((100% - 1280px) / 2 + 32px)) 40px;text-align:left">
    <div aria-hidden="true" style="position:absolute;inset:0;z-index:-4;opacity:.08;background:${TEAM.bg}"></div>
    <div aria-hidden="true" style="position:absolute;inset:0;z-index:-3;background:radial-gradient(ellipse 70% 55% at 50% 62%, color-mix(in srgb, var(--danger) 26%, transparent), transparent 70%);opacity:${!loading && yes ? 1 : 0};transition:opacity .4s ease"></div>
    <div aria-hidden="true" style="position:absolute;inset:0;z-index:-3;background:radial-gradient(ellipse 70% 55% at 50% 62%, color-mix(in srgb, var(--safe) 16%, transparent), transparent 70%);opacity:${!loading && !yes ? 1 : 0};transition:opacity .4s ease"></div>
    <div aria-hidden="true" style="position:absolute;inset:auto 0 0 0;height:30%;z-index:-2;background:linear-gradient(to bottom, transparent, var(--bg))"></div>

    ${isSim && html`
      <div style="position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 14px;padding:8px 16px;background:var(--warn);color:#160F00;font-size:0.8rem">
        <span style="font-weight:800;letter-spacing:.08em">MODO SIMULAÇÃO</span>
        <span style="font-weight:500">resposta baseada nos seus palpites</span>
        <button onClick=${clearAll} style="background:#160F00;color:var(--warn);border:none;border-radius:4px;padding:5px 10px;font-weight:700;font-size:0.78rem">Voltar ao real</button>
        ${incomplete.length > 0 && html`
          <div role="alert" style="flex-basis:100%;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 10px;padding-top:6px;margin-top:2px;border-top:1px solid rgba(22,15,0,.25)">
            <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700">${Ico('warn')}${incomplete.length === 1 ? `Rodada ${incomplete[0][0]} com ${jogos(incomplete[0][1])} sem palpite` : `${incomplete.length} rodadas com jogos sem palpite`}</span>
            <button onClick=${() => goRound(incomplete[0][0])} style="background:none;border:1px solid #160F00;color:#160F00;border-radius:4px;padding:4px 10px;font-weight:700;font-size:0.78rem">Ver rodada ${incomplete[0][0]}</button>
          </div>`}
      </div>`}

    ${mobile
      ? html`<div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%">
          <div style="display:flex;align-items:center;gap:12px;min-width:0">${heroCrest}${heroQ}</div>
          ${heroAns}
        </div>`
      : html`<div style="display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap;gap:clamp(12px,3vw,48px);width:100%">
          ${heroCrest}
          <div style="display:flex;flex-direction:column;align-items:flex-start;gap:clamp(4px,1vh,12px);min-width:0">${heroQ}${heroAns}</div>
        </div>`}

    ${badge && html`<div style="border:2px solid ${badgeColor};color:${badgeColor};font-weight:800;letter-spacing:.14em;font-size:clamp(.75rem,2.2vw,1rem);padding:6px 14px;border-radius:4px;transform:rotate(-2deg)">${badge}</div>`}

    <p class="sr" aria-live="polite">${loading ? '' : `${yes ? 'Sim' : 'Não'}. ${ctxPct} ${ctxRest}.${isSim ? ' Resposta baseada nos seus palpites.' : ''}`}</p>

    ${failed
      ? (P && !P.gid
        ? html`<${Failed} msg="Não achamos ${TEAM.art.toLowerCase()} ${TEAM.name} nos dados do campeonato." detail="A API pode estar atualizando. Tente de novo em alguns minutos." />`
        : html`<${Failed} msg="Não deu para carregar a tabela." />`)
      : loading
      ? html`<div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px">
          <div style="width:min(420px,80vw);height:1.4rem;border-radius:6px;background:var(--surface-2);animation:shimmer 1.4s ease-in-out infinite"></div>
          <div style="width:min(220px,50vw);height:.9rem;border-radius:6px;background:var(--surface-2);animation:shimmer 1.4s ease-in-out .2s infinite"></div>
        </div>`
      : html`<p style="margin:0;max-width:44ch;font-weight:600;font-size:clamp(.9rem,1.6vw,1.15rem);line-height:1.4;color:var(--text-muted);font-variant-numeric:tabular-nums;text-wrap:balance"><span style="color:${yes ? 'var(--danger)' : 'var(--safe)'}">${ctxPct}</span> ${ctxRest}</p>`}

    ${!failed && html`<a href="#classificacao" style="align-self:center;margin-top:clamp(8px,3vh,28px);display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--text-muted);font-size:0.78rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:8px">ver tabela<span aria-hidden="true" style="font-size:1.2rem;line-height:1">↓</span></a>`}
  </section>

  <main style="max-width:1280px;margin:0 auto;padding:8px ${mobile ? '12px' : '32px'} 48px;display:grid;grid-template-columns:${wide ? 'minmax(0,3fr) minmax(0,2fr)' : 'minmax(0,1fr)'};gap:24px;align-items:start">

    <section id="classificacao" style="min-width:0;scroll-margin-top:44px">
      <div style="display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;margin:0 0 12px">
        <h2 style="margin:0;${head};font-size:${mobile ? '1.5rem' : '1.75rem'};letter-spacing:.01em">Classificação</h2>
        <span style="font-size:0.78rem;color:var(--text-muted)">${isSim ? 'Tabela simulada' : 'Tabela atual'}</span>
      </div>
      <div role="table" aria-label="Classificação do campeonato" style="background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden">
        <div role="row" style="display:grid;grid-template-columns:${cols};column-gap:${mobile ? '6px' : '8px'};align-items:center;height:36px;padding-right:12px;font-size:0.7rem;font-weight:600;letter-spacing:${mobile ? '.04em' : '.08em'};white-space:nowrap;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--line)">
          <span style="padding-left:${mobile ? '10px' : '12px'}">Pos</span>
          <span>Clube</span>
          <span style="text-align:center">P</span>
          ${full && html`<span style="text-align:center">J</span><span style="text-align:center">V</span><span style="text-align:center">E</span><span style="text-align:center">D</span>`}
          <span style="text-align:center">SG</span>
          <span style="text-align:right">% queda</span>
        </div>
        ${loading
          ? html`<div style="display:flex;flex-direction:column;gap:1px;padding:8px 12px">${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => html`<div key=${k} style="height:36px;margin:4px 0;border-radius:6px;background:var(--surface-2);animation:${failed ? 'none' : 'shimmer 1.4s ease-in-out infinite'}"></div>`)}</div>`
          : rows.map((r) => html`
            <div role="row" key=${r.t.id} data-team=${r.t.id} style="position:relative;z-index:${r.isG ? 2 : r.z4Label ? 1 : 0};display:grid;grid-template-columns:${cols};column-gap:${mobile ? '6px' : '8px'};align-items:center;height:${mobile ? '48px' : '50px'};padding-right:12px;background:${r.bg};border-top:${r.borderTop};box-shadow:${r.isG ? 'inset 0 0 0 2px var(--accent)' : 'none'}">
              <div style="align-self:stretch;display:flex;align-items:center;gap:${mobile ? '6px' : '8px'}">
                <span style="width:4px;align-self:stretch;background:${r.zone}"></span>
                <span style="width:1.3rem;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${r.pos}</span>
              </div>
              <div style="display:flex;align-items:center;gap:${mobile ? '8px' : '10px'};min-width:0">
                ${crest(r.t, mobile ? '22px' : '28px')}
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${mobile ? '0.9rem' : 'inherit'};font-weight:${r.isG ? 800 : 600}">${r.t.name}</span>
                ${r.arrow && html`<span aria-label=${r.dlt > 0 ? `subiu ${r.dlt}` : `caiu ${-r.dlt}`} style="font-size:0.65rem;font-weight:700;color:${r.dlt > 0 ? 'var(--safe)' : 'var(--danger)'};font-variant-numeric:tabular-nums;white-space:nowrap">${r.arrow}</span>`}
              </div>
              <span style="text-align:center;font-weight:800;font-variant-numeric:tabular-nums">${r.t.pts}</span>
              ${full && html`<span style=${num}>${r.t.j}</span><span style=${num}>${r.t.v}</span><span style=${num}>${r.t.e}</span><span style=${num}>${r.t.d}</span>`}
              <span style=${num}>${sg(r.t.sg)}</span>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <span style="font-weight:700;font-variant-numeric:tabular-nums;color:${r.pctColor}">${r.pct}</span>
                <span style="width:100%;height:4px;border-radius:2px;background:var(--surface-2);overflow:hidden;display:flex;justify-content:flex-end"><span style="height:100%;width:${r.pctW};background:var(--danger);border-radius:2px;transition:width .3s ease"></span></span>
              </div>
              ${r.z4Label && html`<span style="position:absolute;top:-9px;right:12px;background:var(--danger);color:#fff;font-size:0.62rem;font-weight:800;letter-spacing:.1em;padding:1px 6px;border-radius:3px">Z4</span>`}
            </div>`)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:0.75rem;color:var(--text-muted)">
        <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:var(--accent)"></span>Libertadores</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:color-mix(in srgb, var(--accent) 45%, #06223a)"></span>Pré-Libertadores</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger)"></span>Z4 · rebaixamento</span>
      </div>
    </section>

    <section id="jogos" aria-label="Jogos por rodada" style="scroll-margin-top:${mobile ? '104px' : '44px'};min-width:0;position:${wide ? 'sticky' : 'static'};top:48px">
      <div style="display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;margin:0 0 12px">
        <h2 style="margin:0;${head};font-size:${mobile ? '1.5rem' : '1.75rem'};letter-spacing:.01em">Jogos</h2>
        <span style="font-size:0.78rem;color:var(--text-muted)">Palpite = simule o resultado</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--line)">
          <button aria-label="Rodada anterior" onClick=${() => setRound(Math.max(P.first, R - 1))} disabled=${!P || R <= P.first} style="width:44px;height:44px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);display:grid;place-items:center;opacity:${!P || R <= P.first ? 0.35 : 1}">${Ico('prev', '20px')}</button>
          <div style="text-align:center;display:flex;flex-direction:column;gap:2px">
            <span style="font-family:var(--head);font-weight:var(--head-w);font-stretch:var(--head-s);font-size:1.35rem;text-transform:uppercase;line-height:1.1">${P ? `Rodada ${R}` : 'Rodada'}</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">${P ? roundRange(roundGames) : ''}</span>
          </div>
          <button aria-label="Próxima rodada" onClick=${() => setRound(Math.min(P.last, R + 1))} disabled=${!P || R >= P.last} style="width:44px;height:44px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);display:grid;place-items:center;opacity:${!P || R >= P.last ? 0.35 : 1}">${Ico('next', '20px')}</button>
        </div>
        ${futAll.length > 0 && html`
          <div style="display:flex;flex-direction:column;gap:6px;padding:10px;border-bottom:1px solid var(--line)">
            <button onClick=${() => fill(futAll)} style="height:44px;border-radius:8px;border:1px solid var(--accent);background:color-mix(in srgb, var(--accent) 14%, var(--surface-2));color:var(--text);font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px">${Ico('dice', '18px', 2)}${hasAuto ? 'Sortear de novo' : 'Simular até o fim'}</button>
            <span style="font-size:0.72rem;color:var(--text-muted);text-align:center;text-wrap:balance">Sorteia placares para os jogos sem palpite até a rodada ${P.last}. Os seus palpites ficam.</span>
          </div>`}
        ${roundMissing > 0 && html`
          <div role="alert" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;padding:10px 12px;background:color-mix(in srgb, var(--warn) 12%, var(--surface));border-bottom:1px solid var(--line);font-size:0.8rem;line-height:1.4">
            <span style="flex:1 1 14rem"><strong style="color:var(--warn)">${Ico('warn')} ${roundMissing > 1 ? 'Faltam' : 'Falta'} ${jogos(roundMissing)} nesta rodada.</strong> <span style="color:var(--text-muted)">A tabela só conta os jogos com palpite, então ela fica desequilibrada.</span></span>
            <button onClick=${() => fill(roundGames)} style="flex:none;height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--warn);background:none;color:var(--warn);font-weight:700;font-size:0.8rem">Sortear os que faltam</button>
          </div>`}
        ${roundHasPicks && html`
          <div style="display:flex;justify-content:center;border-bottom:1px solid var(--line)">
            <button onClick=${() => setPal((p) => { roundGames.forEach((gm) => delete p[gm.id]); return p; })} style="background:none;border:none;color:var(--warn);font-size:0.8rem;font-weight:600;padding:10px;text-decoration:underline">Limpar palpites desta rodada</button>
          </div>`}
        <div style="display:flex;flex-direction:column;gap:8px;padding:${mobile ? '6px' : '10px'};max-height:${wide ? 'calc(100vh - 220px)' : 'none'};overflow:auto">
          ${P && roundGames.map(gameCard)}
        </div>
      </div>
    </section>
  </main>

  <${Footer} />

  ${pin && !loading && html`
    <div role="group" aria-label="${ask(TEAM)} ${yes ? 'Sim' : 'Não'}. ${gPos}º lugar, ${g.pts} pontos, ${pctLabel(pinPct, res.dec[P.gid])} de chance de cair" style="position:fixed;left:50%;transform:translateX(-50%);width:calc(100% - 16px);max-width:560px;top:${pin === 'top' ? '44px' : 'auto'};bottom:${pin === 'bottom' ? 'calc(12px + env(safe-area-inset-bottom))' : 'auto'};z-index:30;display:grid;grid-template-columns:auto 24px minmax(0,1fr) auto auto auto;align-items:center;gap:${mobile ? '8px' : '12px'};height:52px;padding:0 6px 0 14px;border-radius:10px;background:var(--surface);box-shadow:inset 0 0 0 2px ${yes ? 'var(--danger)' : 'var(--accent)'}, 0 8px 30px rgba(0,0,0,.45);font-variant-numeric:tabular-nums">
      <span aria-hidden="true" style="font-weight:700">${gPos}º</span>
      <img src=${gCrest} alt="" style="width:24px;height:24px;object-fit:contain" />
      <span aria-hidden="true" style="font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${width >= 360 ? TEAM.name : ''}</span>
      <span aria-hidden="true" style="font-weight:800;white-space:nowrap">${g.pts} pts</span>
      <span aria-hidden="true" style="font-weight:700;color:${pinPct >= 0.5 ? 'var(--danger)' : 'var(--text-muted)'}">${pctLabel(pinPct, res.dec[P.gid])}</span>
      <a href="#" aria-hidden="true" tabindex="-1" onClick=${(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style="display:flex;align-items:center;gap:6px;height:40px;padding:0 10px;border-radius:7px;background:color-mix(in srgb, ${col} 16%, var(--surface-2));color:${col};text-decoration:none">
        <span style="font-size:0.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);line-height:1">Cai?</span>
        <span style="font-family:var(--head);font-weight:var(--head-w);font-size:1.45rem;line-height:1;letter-spacing:var(--head-ls)">${word}</span>
      </a>
    </div>`}
</div>`;
}

render(SLUG ? html`<${App} />` : html`<${Home} />`, document.getElementById('app'));
