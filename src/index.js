import { demoData } from './demo.js';

const API = 'https://api.football-data.org/v4/competitions/BSA/matches';
const TTL_MS = 60 * 60 * 1000; // busca dados novos no máximo 1x por hora
const KEY = 'bsa-matches-v1';

// páginas por time (/inter etc.): mesma index.html, com título, prévia de link, favicon e data-team do time.
// Em / fica a lista dos times (index.html sem data-team). O visual de cada um fica em TEAMS no public/app.js.
const TEAMS = {
  gremio: 'O Grêmio', inter: 'O Inter', corinthians: 'O Corinthians', vasco: 'O Vasco',
  botafogo: 'O Botafogo', coritiba: 'O Coritiba', vitoria: 'O Vitória', mirassol: 'O Mirassol', remo: 'O Remo',
};
const SITE = 'https://vaicair.diuliano.com';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    // os primeiros endereços eram um subdomínio por time (o-inter-cai.diuliano.com): mandam para o caminho novo
    const old = url.hostname.endsWith('.diuliano.com') && url.hostname.match(/^[oa]-([a-z-]+)-cai\./);
    if (old) return Response.redirect(SITE + '/' + (TEAMS[old[1]] ? old[1] : ''), 301);
    if (url.pathname === '/api/data') return data(env, ctx);
    const slug = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();
    if (TEAMS[slug]) return teamPage(req, env, slug);
    return env.ASSETS.fetch(req);
  },
};

async function teamPage(req, env, slug) {
  const page = await env.ASSETS.fetch(new Request(new URL('/', req.url), req));
  const title = `${TEAMS[slug]} cai?`;
  const content = (el) => el.setAttribute('content', title);
  return new HTMLRewriter()
    .on('html', { element: (el) => el.setAttribute('data-team', slug) })
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: content })
    .on('link[rel="icon"]', { element: (el) => el.setAttribute('href', `/${slug}.svg`) })
    .transform(page);
}

async function data(env, ctx) {
  if (!env.FOOTBALL_DATA_TOKEN) return json({ ...demoData(), demo: true });

  const cached = env.CACHE ? await env.CACHE.get(KEY, 'json') : null;
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return json(cached);

  try {
    const r = await fetch(API, { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN } });
    if (!r.ok) throw new Error('football-data ' + r.status);
    const body = slim(await r.json());
    if (env.CACHE) ctx.waitUntil(env.CACHE.put(KEY, JSON.stringify(body)));
    return json(body);
  } catch (e) {
    if (cached) return json({ ...cached, stale: true });
    return json({ error: String(e.message || e) }, 502);
  }
}

// Só o que a página usa: deixa a resposta ~10x menor que a da API.
function slim(raw) {
  const team = (t) => ({ id: t.id, name: t.shortName || t.name, tla: t.tla, crest: t.crest });
  return {
    fetchedAt: Date.now(),
    matches: raw.matches.map((m) => ({
      id: m.id,
      md: m.matchday,
      status: m.status,
      utc: m.utcDate,
      h: team(m.homeTeam),
      a: team(m.awayTeam),
      hs: m.score?.fullTime?.home ?? null,
      as: m.score?.fullTime?.away ?? null,
    })),
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
