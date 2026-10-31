import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

// banco da votação nos testes: as mesmas migrações de produção, aplicadas em tests/worker/setup-d1.ts
const migrations = await readD1Migrations('./migrations');

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['tests/domain/**/*.test.ts', 'tests/structure.test.ts'],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { FOOTBALL_DATA_TOKEN: '', DEV_VOTES: '', TEST_MIGRATIONS: migrations } },
          }),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          setupFiles: ['./tests/worker/setup-d1.ts'],
        },
      },
    ],
  },
});
