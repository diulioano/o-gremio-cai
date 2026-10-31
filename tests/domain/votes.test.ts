// Regras da votação (src/domain/votes.ts). Ver specs/003-votacao-rebaixados/data-model.md.
import { describe, expect, it } from 'vitest';
import { MIN_VOTES, ballotError, crowdResult, isVoterId, votingClosesAt } from '../../src/domain/votes';
import { TEAMS } from '../../src/shared/teams';
import { match } from './helpers';

const { gremio, inter, vasco, remo, botafogo } = TEAMS;
const CHAPECOENSE = 90003;

describe('ballotError', () => {
  it('aceita 3 times distintos da lista', () => {
    expect(ballotError([gremio.id, inter.id, vasco.id])).toBeNull();
  });

  it.each([
    ['2 times', [gremio.id, inter.id]],
    ['4 times', [gremio.id, inter.id, vasco.id, remo.id]],
    ['nenhum', []],
    ['não é lista', 'gremio'],
    ['nulo', null],
    ['objeto', { 0: gremio.id, 1: inter.id, 2: vasco.id, length: 3 }],
  ])('recusa %s', (_, picks) => {
    expect(ballotError(picks)).toBe('Escolha 3 times.');
  });

  it('recusa time repetido', () => {
    expect(ballotError([gremio.id, gremio.id, vasco.id])).toBe('Times repetidos.');
  });

  it.each([
    ['Chapecoense (já caiu)', CHAPECOENSE],
    ['id desconhecido', 1],
    ['decimal', gremio.id + 0.5],
    ['texto', String(gremio.id)],
    ['NaN', NaN],
  ])('recusa %s', (_, bad) => {
    expect(ballotError([gremio.id, inter.id, bad])).toBe('Time fora da lista.');
  });
});

describe('isVoterId', () => {
  it('aceita o formato do crypto.randomUUID()', () => {
    expect(isVoterId('8f2c1d3e-4b5a-4c6d-9e8f-0a1b2c3d4e5f')).toBe(true);
  });

  it.each([
    '',
    'abc',
    '8F2C1D3E-4B5A-4C6D-9E8F-0A1B2C3D4E5F',
    "8f2c1d3e-4b5a-4c6d-9e8f-0a1b2c3d4e5'",
    ' 8f2c1d3e-4b5a-4c6d-9e8f-0a1b2c3d4e5f',
    123,
    null,
  ])('recusa %j', (v) => {
    expect(isVoterId(v)).toBe(false);
  });
});

describe('votingClosesAt', () => {
  it('é o primeiro jogo da maior rodada', () => {
    const late = { ...match(38, 1, 2), utc: '2026-12-06T19:00:00Z' };
    const early = { ...match(38, 3, 4), utc: '2026-12-06T16:00:00Z' };
    expect(votingClosesAt([match(37, 5, 6), late, early])).toBe(Date.parse('2026-12-06T16:00:00Z'));
  });

  it('acompanha um jogo remarcado', () => {
    const other = { ...match(38, 3, 4), utc: '2026-12-06T16:00:00Z' };
    const moved = { ...match(38, 1, 2), utc: '2026-12-05T21:30:00Z' };
    expect(votingClosesAt([other, moved])).toBe(Date.parse('2026-12-05T21:30:00Z'));
  });

  it('ignora data ilegível', () => {
    const ok = { ...match(38, 3, 4), utc: '2026-12-06T16:00:00Z' };
    const bad = { ...match(38, 1, 2), utc: 'amanhã' };
    expect(votingClosesAt([bad, ok])).toBe(Date.parse('2026-12-06T16:00:00Z'));
    expect(votingClosesAt([bad])).toBeNull();
  });

  it('sem jogos: null', () => {
    expect(votingClosesAt([])).toBeNull();
  });
});

describe('crowdResult', () => {
  it(`com menos de ${MIN_VOTES} votos: começando, sem porcentagens`, () => {
    expect(crowdResult({ [gremio.id]: 9 }, 9)).toEqual({ total: 9, warmingUp: true });
  });

  it('150 de 200 votantes = 75%', () => {
    const r = crowdResult({ [gremio.id]: 150 }, 200);
    if (!('rows' in r)) throw new Error('esperava rows');
    expect(r.rows.find((x) => x.id === gremio.id)).toEqual({ id: gremio.id, votes: 150, pct: 75 });
  });

  it('sempre os 9 times, os sem voto com 0%, do mais votado para o menos', () => {
    const r = crowdResult({ [vasco.id]: 30, [gremio.id]: 50, [inter.id]: 10 }, 50);
    if (!('rows' in r)) throw new Error('esperava rows');
    expect(r.rows).toHaveLength(9);
    expect(r.rows.slice(0, 3).map((x) => x.id)).toEqual([gremio.id, vasco.id, inter.id]);
    expect(r.rows.at(-1)?.pct).toBe(0);
  });

  it('empate: ordem alfabética', () => {
    const r = crowdResult({ [remo.id]: 5, [botafogo.id]: 5, [gremio.id]: 5 }, 10);
    if (!('rows' in r)) throw new Error('esperava rows');
    expect(r.rows.slice(0, 3).map((x) => x.id)).toEqual([botafogo.id, gremio.id, remo.id]);
  });

  it('a soma das porcentagens fica em ~300% (cada votante escolhe 3)', () => {
    // 70 votantes × 3 = 210 votos
    const counts = { [gremio.id]: 70, [inter.id]: 33, [vasco.id]: 41, [remo.id]: 57, [botafogo.id]: 9 };
    const r = crowdResult(counts, 70);
    if (!('rows' in r)) throw new Error('esperava rows');
    const sum = r.rows.reduce((a, x) => a + x.pct, 0);
    expect(Math.abs(sum - 300)).toBeLessThanOrEqual(5);
  });
});
