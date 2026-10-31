// /api/votes: votação "quem você acha que cai?", guardada no D1 (binding DB).
// Ver specs/003-votacao-rebaixados/contracts/api-votes.md.
//
// Segurança:
// - SQL só com parâmetros (bind), nunca texto do visitante montado na consulta.
// - POST só de páginas do próprio site (Origin) e só com JSON: um site de fora não consegue fazer
//   os navegadores dos seus visitantes votarem (cada um teria um IP diferente e passaria pelo limitador).
// - Limite por IP antes de qualquer outra coisa; o IP nunca é gravado nem vai para o log.
// - Corpo de no máximo 1 KB, lido aos poucos (não carrega um corpo gigante na memória).
// - Erros do banco não vazam para a resposta.
import { DAILY_CAP, ballotError, crowdResult, isVoterId, votingClosesAt, type Picks } from '../domain/votes';
import type { DataPayload, VoteError, VoteState } from '../shared/api';
import { CACHE_KEY } from './data';
import { demoData } from './demo';

const MAX_BODY = 1024;

// Só para testar no `npm run dev`: DEV_VOTES=1 no .dev.vars desliga o limite por IP e o teto diário,
// para votar várias vezes seguidas (a página gera um aparelho novo a cada "votar de novo").
// Nunca configurar em produção: lá a variável não existe e tudo vale.
const isDevVotes = (env: Env): boolean => (env as { DEV_VOTES?: string }).DEV_VOTES === '1';

const MSG: Record<VoteError['error'], string> = {
  invalid: 'Voto inválido.',
  forbidden: 'Envio não permitido.',
  closed: 'A votação já fechou: a última rodada começou.',
  'rate-limited': 'Muitos votos daqui em pouco tempo. Espere um minuto e tente de novo.',
  'daily-cap': 'A votação está fechada por hoje. Volte amanhã!',
  unavailable: 'Não deu para registrar agora. Tente de novo em instantes.',
};

export async function votes(req: Request, env: Env): Promise<Response> {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') return await getVotes(req, env);
    if (req.method === 'POST') return await postVote(req, env);
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, POST' } });
  } catch (e) {
    // D1 fora do ar ou no limite diário: a página segue sem a votação
    console.warn('votes:', e instanceof Error ? e.message : e);
    return fail('unavailable', 503);
  }
}

async function getVotes(req: Request, env: Env): Promise<Response> {
  const now = Date.now();
  const closesAt = await closingTime(env);
  const voter = new URL(req.url).searchParams.get('voter');
  const mine = isVoterId(voter) ? await findVote(env, voter) : null;
  return json(await stateFor(env, closesAt, now, mine));
}

async function postVote(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req) || !isJson(req)) return fail('forbidden', 403);

  const ip = req.headers.get('cf-connecting-ip') ?? 'sem-ip';
  const dev = isDevVotes(env);
  const { success } = dev ? { success: true } : await env.VOTE_LIMITER.limit({ key: ip });
  if (!success) return fail('rate-limited', 429);

  const body = await readBody(req);
  if (body === null) return fail('invalid', 400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail('invalid', 400);
  }
  const { voter, picks } = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<
    string,
    unknown
  >;
  const why = ballotError(picks);
  if (!isVoterId(voter) || why) return fail('invalid', 400, why ?? MSG.invalid);

  const now = Date.now();
  const closesAt = await closingTime(env);
  if (closesAt !== null && now >= closesAt) {
    return fail('closed', 410, MSG.closed, await stateFor(env, closesAt, now, null));
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const day = await env.DB.prepare('SELECT n FROM daily WHERE day = ?').bind(today).first<number>('n');
  if (!dev && (day ?? 0) >= DAILY_CAP) return fail('daily-cap', 503);

  const [t1, t2, t3] = picks as Picks;
  try {
    await env.DB.prepare('INSERT INTO votes (voter, t1, t2, t3, at) VALUES (?, ?, ?, ?, ?)')
      .bind(voter, t1, t2, t3, now)
      .run();
  } catch (e) {
    if (!(e instanceof Error) || !/UNIQUE|PRIMARY KEY/i.test(e.message)) throw e;
    // já votou (outra aba, ou reenvio): vale o voto gravado, não o enviado agora
    return json(await stateFor(env, closesAt, now, await findVote(env, voter)), 409);
  }
  return json(await stateFor(env, closesAt, now, [t1, t2, t3]), 201);
}

/** Estado da votação. O resultado só vai para quem já votou ou depois que a votação fecha (FR-014). */
async function stateFor(
  env: Env,
  closesAt: number | null,
  now: number,
  mine: Picks | null,
): Promise<VoteState> {
  const open = closesAt === null || now < closesAt;
  const { results } = await env.DB.prepare('SELECT team_id, n FROM tally').all<{
    team_id: number;
    n: number;
  }>();
  const counts: Record<number, number> = {};
  for (const r of results) counts[r.team_id] = r.n;
  const total = counts[0] ?? 0;

  const state: VoteState = { open, closesAt, total };
  if (mine) state.mine = mine;
  if (mine || !open) Object.assign(state, crowdResult(counts, total));
  return state;
}

async function findVote(env: Env, voter: string): Promise<Picks | null> {
  const row = await env.DB.prepare('SELECT t1, t2, t3 FROM votes WHERE voter = ?')
    .bind(voter)
    .first<{ t1: number; t2: number; t3: number }>();
  return row ? [row.t1, row.t2, row.t3] : null;
}

/** Primeiro jogo da última rodada, pelos jogos que o cron já guardou (sem consultar a fonte). */
async function closingTime(env: Env): Promise<number | null> {
  const data = env.FOOTBALL_DATA_TOKEN ? await env.CACHE.get<DataPayload>(CACHE_KEY, 'json') : demoData();
  return data ? votingClosesAt(data.matches) : null;
}

// Navegadores sempre mandam Origin num POST via fetch. Sem Origin (curl, testes) o limitador ainda vale.
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  return origin === null || origin === new URL(req.url).origin;
}

// JSON obriga o navegador a pedir permissão (preflight) antes de um POST vindo de outro site; nunca damos.
const isJson = (req: Request): boolean =>
  (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() === 'application/json';

/** Lê o corpo até MAX_BODY bytes; null se passar disso. */
async function readBody(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY || !req.body) return declared > MAX_BODY ? null : '';
  const reader = (req.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

function fail(error: VoteError['error'], status: number, message = MSG[error], state?: VoteState): Response {
  const body: VoteError = state ? { error, message, state } : { error, message };
  return json(body, status);
}

function json(body: VoteState | VoteError, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // a resposta depende de quem pergunta (só quem votou vê o resultado): nada de cache compartilhado
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
