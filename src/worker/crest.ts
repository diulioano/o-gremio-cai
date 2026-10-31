// GET /crest/<png|svg>/<id>: escudo da football-data.org servido pelo nosso domínio.
// O card de compartilhar desenha os escudos num canvas; vindo de outro domínio sem CORS, o canvas fica
// contaminado e não exporta a imagem. Só aceita escudos da football-data (id numérico, às vezes com _large, como o da Chapecoense), para não virar proxy aberto.
// Sem extensão no caminho: os caminhos com ponto vão direto para os arquivos estáticos (run_worker_first).

const CREST = /^\/crest\/(png|svg)\/(\d{1,7}(?:_large)?)$/;
const WEEK = 7 * 24 * 3600;

export const isCrestPath = (path: string): boolean => CREST.test(path);

export async function crest(path: string): Promise<Response> {
  const m = CREST.exec(path);
  if (!m) return new Response('Not found', { status: 404 });
  const [, ext, id] = m;
  const up = await fetch(`https://crests.football-data.org/${id}.${ext}`, {
    cf: { cacheTtl: WEEK, cacheEverything: true },
  });
  if (!up.ok) return new Response('Not found', { status: 404 });
  return new Response(up.body, {
    headers: {
      'content-type': ext === 'svg' ? 'image/svg+xml' : 'image/png',
      'cache-control': `public, max-age=${WEEK}`,
      'x-content-type-options': 'nosniff',
    },
  });
}
