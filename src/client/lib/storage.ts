// localStorage: palpites e a última cópia dos dados (para quando cair a conexão).
// Chaves mantidas da versão antiga. Ver specs/001-migracao-framework-web/contracts/browser-storage.md.
import type { Prediction, Predictions } from '../../domain/predictions';
import type { DataPayload } from '../../shared/api';

export const PREDICTIONS_KEY = 'gremiocai-palpites-v1';
export const DATA_KEY = 'gremiocai-dados-v1';

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
