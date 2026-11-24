import { describe, expect, it } from 'vitest';
import { prepare } from '../../src/domain/prepare';
import type { DataPayload } from '../../src/shared/api';
import { TEAMS } from '../../src/shared/teams';
import demo from './fixtures/demo-payload.json';
import { match, payload } from './helpers';

describe('prepare', () => {
  it('mapeia os status da API', () => {
    const P = prepare(
      payload([
        match(1, 1, 2, [1, 0], 'AWARDED'),
        match(1, 3, 4, [0, 0], 'PAUSED'),
        match(2, 1, 3, undefined, 'POSTPONED'),
        match(2, 2, 4, undefined, 'SUSPENDED'),
        match(2, 1, 4, undefined, 'SCHEDULED'),
      ]),
      null,
    );
    expect(P.matches.map((g) => g.status)).toEqual(['fin', 'live', 'fut', 'fut', 'fut']);
    expect(P.matches[2]?.postponed).toBe(true);
  });

  it('encerrado sem placar vira futuro; status desconhecido e time sem id são descartados', () => {
    const noId = match(1, 3, 4);
    noId.a = { id: null, name: 'A definir', tla: null, crest: null };
    const P = prepare(
      payload([match(1, 1, 2, undefined, 'FINISHED'), match(1, 1, 3, [1, 1], 'CANCELLED'), noId]),
      null,
    );
    expect(P.matches).toHaveLength(1);
    expect(P.matches[0]?.status).toBe('fut');
  });

  it('só os encerrados entram na campanha base', () => {
    const P = prepare(payload([match(1, 1, 2, [2, 0]), match(2, 2, 1)]), null);
    expect(P.base[1]).toMatchObject({ pts: 3, j: 1 });
    expect(P.base[2]).toMatchObject({ pts: 0, j: 1 });
  });

  it('rodada atual ignora jogo adiado de rodada antiga', () => {
    const P = prepare(
      payload([
        match(1, 1, 2, [1, 0]),
        match(1, 3, 4, undefined, 'POSTPONED'),
        match(2, 1, 3, [0, 0]),
        match(3, 2, 4),
      ]),
      null,
    );
    expect([P.first, P.current, P.last]).toEqual([1, 3, 3]);
  });

  it('sem rodada pendente, a atual é a última', () => {
    const P = prepare(payload([match(1, 1, 2, [1, 0]), match(2, 2, 1, [1, 0])]), null);
    expect(P.current).toBe(2);
  });

  it('acha o time pelo id e, na falta, pela sigla (dados demo têm ids inventados)', () => {
    const d = demo as DataPayload;
    expect(prepare(d, TEAMS.gremio).gid).toBe(TEAMS.gremio.id);
    expect(prepare(d, TEAMS.coritiba).gid).toBe(90002);
    expect(prepare(d, null).gid).toBeNull();
  });

  it('gols esperados positivos, com vantagem de mando', () => {
    const P = prepare(payload([match(1, 1, 2, [2, 1]), match(2, 2, 1, [2, 1])]), null);
    const [h, a] = P.lambda(1, 2);
    expect(h).toBeGreaterThan(0);
    expect(a).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(a);
  });
});
