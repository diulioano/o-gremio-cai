// GET /api/data: jogos do Brasileirão (football-data.org, competição BSA) com cache de 1 hora no KV.
import type { DataError, DataPayload, SlimTeam } from '../shared/api';
import { demoData } from './demo';

const API = 'https://api.football-data.org/v4/competitions/BSA/matches';
const TTL_MS = 60 * 60 * 1000; // busca dados novos no máximo 1x por hora
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
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return json(cached);

  try {
    const r = await fetch(API, { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN } });
    if (!r.ok) throw new Error(`football-data ${r.status}`);
    const body = slim(await r.json<FdResponse>());
    ctx.waitUntil(env.CACHE.put(CACHE_KEY, JSON.stringify(body)));
    return json(body);
  } catch (e) {
    if (cached) return json({ ...cached, stale: true });
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
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

function json(body: DataPayload | DataError, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
