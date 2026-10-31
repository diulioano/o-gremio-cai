import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'domain', environment: 'node', include: ['tests/domain/**/*.test.ts', 'tests/structure.test.ts'] },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { FOOTBALL_DATA_TOKEN: '' } },
          }),
        ],
        test: { name: 'worker', include: ['tests/worker/**/*.test.ts'] },
      },
    ],
  },
});
