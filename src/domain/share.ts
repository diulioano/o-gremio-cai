import type { SimulationResult } from './simulate';
import { verdict, type Badge } from './verdict';

export interface CardRow {
  id: number;
  pos: number;
  name: string;
  code: string;
  crest: string | null;
  pts: number;
  /** o time da página */
  me: boolean;
}

/** O que vai no card de compartilhar (Stories 9:16): sempre da tabela exibida, real ou simulada. */
export interface CardData {
  yes: boolean;
  sim: boolean;
  pos: number;
  pts: number;
  prob: string;
  /** % em vermelho a partir de 50% */
  probHigh: boolean;
  decision: Badge | null;
  /** 17º → 20º */
  z4: CardRow[];
}

export function shareCard(res: SimulationResult, gid: number, sim: boolean): CardData | null {
  const v = verdict(res, gid);
  if (!v) return null;
  const n = res.table.length;
  return {
    yes: v.yes,
    sim,
    pos: v.pos,
    pts: v.row.pts,
    prob: v.pctLabel,
    probHigh: v.pct >= 0.5,
    decision: v.badge,
    z4: res.table.slice(-4).map((t, i) => ({
      id: t.id,
      pos: n - 3 + i,
      name: t.name,
      code: t.code,
      crest: t.crest,
      pts: t.pts,
      me: t.id === gid,
    })),
  };
}
