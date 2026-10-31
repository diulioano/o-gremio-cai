// Dados de demonstração para rodar sem token da football-data.org (desenvolvimento local).
// Temporada inventada: 38 rodadas em turno e returno, 30 já jogadas.
import type { DataPayload, SlimMatch, SlimTeam } from '../shared/api';

const T: [number, string, string][] = [
  [1783, 'Flamengo', 'FLA'],
  [1769, 'Palmeiras', 'PAL'],
  [1771, 'Cruzeiro', 'CRU'],
  [90001, 'Mirassol', 'MIR'],
  [1765, 'Fluminense', 'FLU'],
  [1770, 'Botafogo', 'BOT'],
  [1777, 'Bahia', 'BAH'],
  [1776, 'São Paulo', 'SAO'],
  [1779, 'Corinthians', 'COR'],
  [1766, 'Atlético-MG', 'CAM'],
  [1780, 'Vasco', 'VAS'],
  [6684, 'Internacional', 'INT'],
  [4286, 'Bragantino', 'RBB'],
  [6685, 'Santos', 'SAN'],
  [1768, 'Athletico-PR', 'CAP'],
  [1767, 'Grêmio', 'GRE'],
  [1782, 'Vitória', 'VIT'],
  [90002, 'Coritiba', 'CFC'],
  [90003, 'Chapecoense', 'CHA'],
  [90004, 'Remo', 'REM'],
];

interface DemoTeam extends SlimTeam {
  id: number;
  /** força */
  s: number;
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(l: number, rng: () => number): number {
  const L = Math.exp(-l);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

const strip = ({ id, name, tla, crest }: DemoTeam): SlimTeam => ({ id, name, tla, crest });

export function demoData(): DataPayload {
  const rng = mulberry(7);
  const teams: DemoTeam[] = T.map(([id, name, tla], i) => ({
    id,
    name,
    tla,
    crest: id < 90000 ? `https://crests.football-data.org/${id}.png` : null,
    s: 1.35 - i * 0.035,
  }));
  // método do círculo: 19 rodadas do turno, returno com mando invertido
  const list = teams.slice();
  const turno: [DemoTeam, DemoTeam][][] = [];
  for (let r = 0; r < 19; r++) {
    const games: [DemoTeam, DemoTeam][] = [];
    for (let i = 0; i < 10; i++) {
      const x = list[i] as DemoTeam,
        y = list[19 - i] as DemoTeam;
      games.push((r + i) % 2 ? [y, x] : [x, y]);
    }
    turno.push(games);
    list.splice(1, 0, list.pop() as DemoTeam);
  }
  const rounds = turno.concat(turno.map((g) => g.map(([h, a]): [DemoTeam, DemoTeam] => [a, h])));
  const base = Date.UTC(2026, 9, 31, 21, 30); // rodada 31 = 31/10/2026
  const matches: SlimMatch[] = [];
  let id = 1;
  rounds.forEach((games, ri) => {
    const md = ri + 1;
    games.forEach(([h, a], gi) => {
      const day = base + (md - 31) * 4.5 * 864e5 + (gi % 3) * 864e5 - (gi % 2) * 3 * 36e5;
      let status = md <= 30 ? 'FINISHED' : 'TIMED';
      if (md === 31 && gi < 3) status = 'FINISHED';
      if (md === 31 && gi === 3) status = 'IN_PLAY';
      const done = status !== 'TIMED';
      matches.push({
        id: id++,
        md,
        status,
        utc: new Date(day).toISOString(),
        h: strip(h),
        a: strip(a),
        hs: done ? poisson((1.45 * h.s) / a.s, rng) : null,
        as: done ? poisson((1.05 * a.s) / h.s, rng) : null,
      });
    });
  });
  return { fetchedAt: Date.now(), matches };
}
