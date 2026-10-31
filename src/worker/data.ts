// GET /api/data: jogos do Brasileirão (football-data.org, competição BSA) lidos do KV.
// Quem atualiza o KV é o cron (refresh.ts); aqui só se busca na fonte quando o KV está vazio.
// Ver specs/002-atualizacao-por-minuto/contracts/api-data.md.
import { isLiveWindow, STALE_IDLE_MS, STALE_LIVE_MS } from '../domain/live';
import type { DataError, DataPayload, SlimTeam } from '../shared/api';
import { CLUB_FIXES } from '../shared/teams';
import { demoData } from './demo';

const API = 'https://api.football-data.org/v4/competitions/BSA/matches';
export const CACHE_KEY = 'bsa-matches-v1';

/** O pedaço da resposta da football-data.org que usamos. */
export interface FdTeam {
  id: number | null;
  name: string;
  shortName?: string | null;
  tla: string | null;
  crest: string | null;
}
export interface FdResponse {
  matches: {
    id: number;
    matchday: number;
    status: string;
    utcDate: string;
    homeTeam: FdTeam;
    awayTeam: FdTeam;
    score?: { fullTime?: { home: number | null; away: number | null } };
  }[];
}

export async function getData(env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.FOOTBALL_DATA_TOKEN) return json({ ...demoData(), demo: true });

  const cached = await env.CACHE.get<DataPayload>(CACHE_KEY, 'json');
  if (cached) {
    const now = Date.now();
    const live = isLiveWindow(cached.matches, now);
    const stale = now - cached.fetchedAt > (live ? STALE_LIVE_MS : STALE_IDLE_MS);
    return json(stale ? { ...cached, stale: true } : cached, 200, live);
  }

  // KV vazio (primeiro deploy ou chave apagada): busca uma vez em vez de esperar o próximo cron
  try {
    const body = await fetchSource(env.FOOTBALL_DATA_TOKEN);
    ctx.waitUntil(env.CACHE.put(CACHE_KEY, JSON.stringify(body)));
    return json(body, 200, isLiveWindow(body.matches, Date.now()));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}

/** Busca os jogos na football-data.org e já devolve enxuto. Lança erro se a resposta não for 2xx. */
export async function fetchSource(token: string): Promise<DataPayload> {
  const r = await fetch(API, { headers: { 'X-Auth-Token': token } });
  if (!r.ok) throw new Error(`football-data ${r.status}`);
  return slim(await r.json<FdResponse>());
}

// Só o que a página usa: deixa a resposta ~10x menor que a da API.
export function slim(raw: FdResponse): DataPayload {
  const team = (t: FdTeam): SlimTeam => ({
    id: t.id,
    name: t.shortName || t.name,
    tla: t.tla,
    crest: t.crest,
  });
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

/** Nome e escudo atuais dos clubes que a fonte manda desatualizados (CLUB_FIXES). Vale também para o que já está no KV. */
export function withFixes(d: DataPayload): DataPayload {
  const fix = (t: SlimTeam): SlimTeam => {
    const f = t.id === null ? undefined : CLUB_FIXES[t.id];
    return f ? { ...t, ...f } : t;
  };
  return { ...d, matches: d.matches.map((m) => ({ ...m, h: fix(m.h), a: fix(m.a) })) };
}

// Durante jogo o navegador guarda a resposta só 30 s, para a busca de minuto em minuto da página ver dados novos.
function json(body: DataPayload | DataError, status = 200, live = false): Response {
  return new Response(JSON.stringify('matches' in body ? withFixes(body) : body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${live ? 30 : 300}`,
    },
  });
}
