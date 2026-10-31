export interface TeamInfo {
  id: number;
  name: string;
  code: string;
  crest: string | null;
}

export interface StandingRow extends TeamInfo {
  pts: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
}

/** Soma um jogo à campanha dos dois times. */
export function play(h: StandingRow, a: StandingRow, x: number, y: number): void {
  h.j++;
  a.j++;
  h.gp += x;
  h.gc += y;
  a.gp += y;
  a.gc += x;
  h.sg += x - y;
  a.sg += y - x;
  if (x > y) {
    h.pts += 3;
    h.v++;
    a.d++;
  } else if (x < y) {
    a.pts += 3;
    a.v++;
    h.d++;
  } else {
    h.pts++;
    a.pts++;
    h.e++;
    a.e++;
  }
}

/** Critérios do Brasileirão: pontos, vitórias, saldo, gols pró (e o nome, para a ordem ser estável). */
export const compareStandings = (x: StandingRow, y: StandingRow): number =>
  y.pts - x.pts || y.v - x.v || y.sg - x.sg || y.gp - x.gp || x.name.localeCompare(y.name);
