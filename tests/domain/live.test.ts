import { describe, expect, it } from 'vitest';
import { isLiveWindow } from '../../src/domain/live';
import type { SlimMatch } from '../../src/shared/api';

const KICKOFF = Date.parse('2026-11-01T19:00:00Z');
const MIN = 60_000;

function game(status: string, utc = '2026-11-01T19:00:00Z'): SlimMatch {
  const t = { id: 1, name: 'T', tla: 'T', crest: null };
  return { id: 1, md: 33, status, utc, h: t, a: { ...t, id: 2 }, hs: null, as: null };
}

describe('isLiveWindow', () => {
  it('abre 15 min antes do horário marcado', () => {
    expect(isLiveWindow([game('TIMED')], KICKOFF - 16 * MIN)).toBe(false);
    expect(isLiveWindow([game('TIMED')], KICKOFF - 15 * MIN)).toBe(true);
  });

  it('fecha 3 h depois do horário marcado se a fonte não encerrar', () => {
    expect(isLiveWindow([game('TIMED')], KICKOFF + 179 * MIN)).toBe(true);
    expect(isLiveWindow([game('TIMED')], KICKOFF + 181 * MIN)).toBe(false);
  });

  it('jogo em andamento conta mesmo fora do horário', () => {
    for (const s of ['IN_PLAY', 'PAUSED', 'LIVE']) {
      expect(isLiveWindow([game(s)], KICKOFF + 5 * 60 * MIN)).toBe(true);
    }
  });

  it('jogo encerrado, adiado ou cancelado não conta', () => {
    for (const s of ['FINISHED', 'AWARDED', 'POSTPONED', 'CANCELLED', 'SUSPENDED']) {
      expect(isLiveWindow([game(s)], KICKOFF + 30 * MIN)).toBe(false);
    }
  });

  it('basta um jogo na janela', () => {
    expect(isLiveWindow([], KICKOFF)).toBe(false);
    const other = game('TIMED', '2026-11-05T19:00:00Z');
    expect(isLiveWindow([other, game('TIMED')], KICKOFF)).toBe(true);
  });
});
