// Regras de organização do código (US2): componentes pequenos, lista de times num lugar só, nada da versão antiga.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name).replaceAll('\\', '/')],
  );
}

const src = files('src');

describe('estrutura', () => {
  it.each(src.filter((f) => f.startsWith('src/client/') && f.endsWith('.tsx')))(
    '%s tem no máximo 200 linhas (SC-004)',
    (f) => {
      expect(readFileSync(f, 'utf8').split('\n').length).toBeLessThanOrEqual(200);
    },
  );

  it('os times só são definidos em src/shared/teams.ts (SC-005)', () => {
    // demo.ts tem a tabela inventada do campeonato inteiro, não a lista da briga
    const others = src.filter(
      (f) => /\.tsx?$/.test(f) && f !== 'src/shared/teams.ts' && f !== 'src/worker/demo.ts',
    );
    const offenders = others.filter((f) => {
      const code = readFileSync(f, 'utf8');
      return /\b1767\b/.test(code) || /['"]Grêmio['"]/.test(code) || /\bgremio\s*:/.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it('não sobrou nada da versão antiga', () => {
    for (const f of ['public/app.js', 'public/index.html', 'src/index.js', 'src/demo.js']) {
      expect(existsSync(f), f).toBe(false);
    }
  });
});
