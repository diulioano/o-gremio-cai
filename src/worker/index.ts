import { isTeamSlug } from '../shared/teams';
import { crest, isCrestPath } from './crest';
import { getData } from './data';
import { refresh } from './refresh';
import { teamPage } from './team-page';
import { votes } from './votes';

const SITE = 'https://vaicair.diuliano.com';
// os primeiros endereços eram um subdomínio por time (o-inter-cai.diuliano.com): mandam para o caminho novo
const OLD_HOST = /^[oa]-([a-z-]+)-cai\./;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const old = url.hostname.endsWith('.diuliano.com') ? OLD_HOST.exec(url.hostname) : null;
    if (old) return Response.redirect(`${SITE}/${isTeamSlug(old[1]) ? old[1] : ''}`, 301);
    if (url.pathname === '/api/data') return getData(env, ctx);
    if (url.pathname === '/api/votes') return votes(req, env);
    if (isCrestPath(url.pathname)) return crest(url.pathname);
    const slug = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();
    if (isTeamSlug(slug)) return teamPage(req, env, slug);
    return env.ASSETS.fetch(req);
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(refresh(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
