import type { Decision } from './simulate';

const TZ = 'America/Sao_Paulo';
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface When {
  wd: string;
  d: number;
  m: number;
  hm: string;
}

/** Data e hora no horário de Brasília, com dia da semana em português. */
export function when(utc: string): When {
  const p = Object.fromEntries(dtf.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return { wd: WD[WD_EN.indexOf(p.weekday ?? '')] ?? '', d: Number(p.day), m: Number(p.month), hm: `${p.hour ?? ''}:${p.minute ?? ''}` };
}

const month = (m: number) => MO[m - 1] ?? '';

/** "31 out", "31–2 out" ou "31 out – 2 nov" para os jogos de uma rodada. */
export function roundRange(games: readonly { utc: string }[]): string {
  if (!games.length) return '';
  const ds = games.map((g) => g.utc).sort();
  const a = when(ds[0] ?? ''), b = when(ds[ds.length - 1] ?? '');
  if (a.d === b.d && a.m === b.m) return `${a.d} ${month(a.m)}`;
  if (a.m === b.m) return `${a.d}–${b.d} ${month(a.m)}`;
  return `${a.d} ${month(a.m)} – ${b.d} ${month(b.m)}`;
}

export const pctLabel = (p: number, d: Decision): string =>
  d === 'salvo' ? '0%' : d === 'reb' ? '100%' : p < 0.01 ? '<1%' : p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`;

/** Saldo de gols com sinal (o menos é U+2212). */
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Hora local HH:MM. */
export const hm = (t: number): string => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const timeAgo = (mins: number): string =>
  mins < 1 ? 'agora' : mins < 60 ? `há ${mins} min` : `há ${Math.round(mins / 60)} h`;

export const games = (n: number): string => `${n} jogo${n > 1 ? 's' : ''}`;
