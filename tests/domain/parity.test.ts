// Paridade dos números: sem jogos ao vivo, a versão nova tem que dar exatamente as mesmas % da antiga (gravadas em fixtures/).
import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/domain/prepare';
import { simulate, type SimulationResult } from '../../src/domain/simulate';
import { TEAMS } from '../../src/shared/teams';
import type { DataPayload } from '../../src/shared/api';
import payloadJson from './fixtures/demo-payload.json';
import expected from './fixtures/demo-expected.json';
import palpites from '../visual/fixtures/palpites.json';

const payload = payloadJson as DataPayload;
/** Mesma fixture sem o jogo ao vivo (match 304 volta a TIMED), para validar paridade bit-a-bit com a versão antiga. */
const payloadNoLive: DataPayload = {
  ...payload,
  matches: payload.matches.map((m) =>
    m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE'
      ? { ...m, status: 'TIMED', hs: null, as: null }
      : m,
  ),
};
const pick = (r: SimulationResult) => ({
  table: r.table.map((t) => t.id),
  pts: Object.fromEntries(r.table.map((t) => [String(t.id), t.pts])),
  pct: Object.fromEntries(Object.entries(r.pct)),
  dec: Object.fromEntries(Object.entries(r.dec)),
});

describe('paridade com a versão antiga (dados demo)', () => {
  const P = prepare(payload, TEAMS.gremio);
  const PNoLive = prepare(payloadNoLive, TEAMS.gremio);

  it('acha o time e a rodada atual', () => {
    expect(P.gid).toBe(expected.gid);
    expect(P.current).toBe(expected.current);
  });

  it('sem jogos ao vivo: tabela real e % de queda idênticas', () => {
    expect(pick(simulate(PNoLive, {}))).toEqual(expected.real);
  });

  it('sem jogos ao vivo: tabela com palpites e % de queda idênticas', () => {
    expect(pick(simulate(PNoLive, palpites))).toEqual(expected.comPalpites);
  });

  it('com jogo ao vivo no demo (Botafogo 2x0 Inter): soma os 3 pontos na tabela e registra res.live', () => {
    const res = simulate(P, {});
    expect(res.table.find((t) => t.id === 1770)?.pts).toBe(expected.real.pts['1770'] + 3);
    expect(res.live).toEqual({
      1770: { gf: 2, ga: 0 },
      6684: { gf: 0, ga: 2 },
    });
  });
});
