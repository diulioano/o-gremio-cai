// localStorage: specs/001-migracao-framework-web/contracts/browser-storage.md
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATA_KEY,
  PREDICTIONS_KEY,
  loadCachedData,
  loadPredictions,
  savePredictions,
} from '../../src/client/lib/storage';

function fakeStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
  });
  return m;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('palpites salvos', () => {
  it('JSON inválido vira vazio', () => {
    fakeStorage({ [PREDICTIONS_KEY]: '{oops' });
    expect(loadPredictions()).toEqual({});
  });

  it('descarta só as entradas inválidas', () => {
    fakeStorage({
      [PREDICTIONS_KEY]: JSON.stringify({
        1: { h: 2, a: 1 },
        2: { h: 12, a: 0 },
        3: { h: 1, a: 'x' },
        4: { h: 0, a: 0, auto: 1 },
        5: { h: 1, a: 1, auto: 2 },
        6: null,
      }),
    });
    expect(loadPredictions()).toEqual({ 1: { h: 2, a: 1 }, 4: { h: 0, a: 0, auto: 1 }, 5: { h: 1, a: 1 } });
  });

  it('salva no mesmo formato da versão antiga', () => {
    const m = fakeStorage();
    savePredictions({ 7: { h: 1, a: 0 } });
    expect(m.get(PREDICTIONS_KEY)).toBe('{"7":{"h":1,"a":0}}');
  });

  it('localStorage que lança erro: leitura vazia, escrita sem erro', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('modo privado');
      },
      setItem: () => {
        throw new Error('cota cheia');
      },
    });
    expect(loadPredictions()).toEqual({});
    expect(() => {
      savePredictions({});
    }).not.toThrow();
  });
});

describe('cópia dos dados', () => {
  it('sem matches em array conta como ausente', () => {
    fakeStorage({ [DATA_KEY]: JSON.stringify({ fetchedAt: 1, matches: 'x' }) });
    expect(loadCachedData()).toBeNull();
  });

  it('devolve a cópia válida', () => {
    fakeStorage({ [DATA_KEY]: JSON.stringify({ fetchedAt: 1, matches: [] }) });
    expect(loadCachedData()).toEqual({ fetchedAt: 1, matches: [] });
  });
});
