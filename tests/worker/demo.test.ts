// O port para TypeScript não mudou os dados de demonstração (a fixture veio do src/demo.js antigo).
import { describe, expect, it } from 'vitest';
import { demoData } from '../../src/worker/demo';
import fixture from '../domain/fixtures/demo-payload.json';

describe('demoData', () => {
  it('jogos idênticos aos da versão antiga', () => {
    expect(demoData().matches).toEqual(fixture.matches);
  });
});
