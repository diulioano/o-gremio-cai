import { TEAMS, ask, type TeamSlug } from '../shared/teams';

// Páginas por time (/inter etc.): a mesma index.html, com título, prévia de link, favicon e data-team do time.
// Em / fica a lista dos times (index.html sem data-team).
export async function teamPage(req: Request, env: Env, slug: TeamSlug): Promise<Response> {
  const page = await env.ASSETS.fetch(new Request(new URL('/', req.url), req));
  const title = ask(TEAMS[slug]);
  const content = { element: (el: Element) => void el.setAttribute('content', title) };
  return new HTMLRewriter()
    .on('html', { element: (el) => void el.setAttribute('data-team', slug) })
    .on('title', { element: (el) => void el.setInnerContent(title) })
    .on('meta[property="og:title"]', content)
    .on('link[rel="icon"]', { element: (el) => void el.setAttribute('href', `/${slug}.svg`) })
    .transform(page);
}
