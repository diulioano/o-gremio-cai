// localStorage: palpites, a última cópia dos dados (para quando cair a conexão) e o voto na votação.
// Chaves mantidas da versão antiga. Ver specs/001-migracao-framework-web/contracts/browser-storage.md.
import type { Prediction, Predictions } from '../../domain/predictions';
import { isBallot, isVoterId, type Picks } from '../../domain/votes';
import type { DataPayload } from '../../shared/api';

export const PREDICTIONS_KEY = 'gremiocai-palpites-v1';
export const DATA_KEY = 'gremiocai-dados-v1';
/** Ver specs/003-votacao-rebaixados/contracts/browser-storage.md. */
export const VOTE_KEY = 'vaicair-voto-v1';

export type { Prediction, Predictions };

const isGoal = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 9;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s == null ? null : (JSON.parse(s) as unknown);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // modo privado ou cota cheia: segue sem salvar
  }
}

/** Palpites salvos; entradas inválidas são descartadas uma a uma, sem derrubar as outras. */
export function parsePredictions(raw: unknown): Predictions {
  if (!isObject(raw)) return {};
  const out: Predictions = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!isObject(v) || !isGoal(v.h) || !isGoal(v.a)) continue;
    out[id] = v.auto === 1 ? { h: v.h, a: v.a, auto: 1 } : { h: v.h, a: v.a };
  }
  return out;
}

export const loadPredictions = (): Predictions => parsePredictions(read(PREDICTIONS_KEY));
export const savePredictions = (p: Predictions): void => {
  write(PREDICTIONS_KEY, p);
};

export function loadCachedData(): DataPayload | null {
  const d = read(DATA_KEY);
  return isObject(d) && Array.isArray(d.matches) ? (d as unknown as DataPayload) : null;
}
export const saveCachedData = (d: DataPayload): void => {
  write(DATA_KEY, d);
};

export interface SavedVote {
  /** id anônimo do aparelho, gerado aqui; o servidor aceita um voto por id */
  voter: string;
  /** os 3 times, gravados só depois de o servidor confirmar o voto */
  picks?: Picks;
  at?: number;
}

/** O voto deste aparelho. Sem um id válido, cria um novo (e grava). Times inválidos são descartados. */
export function loadVote(): SavedVote {
  const v = read(VOTE_KEY);
  if (isObject(v) && isVoterId(v.voter)) {
    return isBallot(v.picks) && Number.isFinite(v.at)
      ? { voter: v.voter, picks: v.picks, at: v.at as number }
      : { voter: v.voter };
  }
  const fresh = { voter: crypto.randomUUID() };
  write(VOTE_KEY, fresh);
  return fresh;
}

export const saveVote = (picks: Picks, at: number): void => {
  write(VOTE_KEY, { voter: loadVote().voter, picks, at });
};

/** Só no `npm run dev`: esquece o voto e vira um aparelho novo, para votar de novo. */
export function forgetVote(): void {
  write(VOTE_KEY, { voter: crypto.randomUUID() });
}
