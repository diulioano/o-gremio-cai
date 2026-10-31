// Paridade dos números: a versão nova tem que dar exatamente as mesmas % da antiga (gravadas em fixtures/).
import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/domain/prepare';
import { simulate, type SimulationResult } from '../../src/domain/simulate';
import { TEAMS } from '../../src/shared/teams';
import type { DataPayload } from '../../src/shared/api';
import payloadJson from './fixtures/demo-payload.json';
import expected from './fixtures/demo-expected.json';
import palpites from '../visual/fixtures/palpites.json';

const payload = payloadJson as DataPayload;
const pick = (r: SimulationResult) => ({
  table: r.table.map((t) => t.id),
  pts: Object.fromEntries(r.table.map((t) => [String(t.id), t.pts])),
  pct: Object.fromEntries(Object.entries(r.pct)),
  dec: Object.fromEntries(Object.entries(r.dec)),
});

describe('paridade com a versão antiga (dados demo)', () => {
  const P = prepare(payload, TEAMS.gremio);

  it('acha o time e a rodada atual', () => {
    expect(P.gid).toBe(expected.gid);
    expect(P.current).toBe(expected.current);
  });

  it('tabela real e % de queda idênticas', () => {
    expect(pick(simulate(P, {}))).toEqual(expected.real);
  });

  it('tabela com palpites e % de queda idênticas', () => {
    expect(pick(simulate(P, palpites))).toEqual(expected.comPalpites);
  });
});
