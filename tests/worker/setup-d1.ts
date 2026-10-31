// Aplica as migrações do D1 (migrations/) antes dos testes do Worker. É idempotente: só roda as que faltam.
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- é assim que se estende o Env do Cloudflare
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
