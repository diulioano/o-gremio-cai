// Fonte e escudos para o card. Tudo vem do nosso domínio (ou do Google Fonts, que não contamina o canvas):
// os 9 times da briga pelo SVG em public/, os outros pelo proxy /crest do Worker.
import { TEAMS, type TeamSlug } from '../../../shared/teams';

const SAMPLE = 'O GRÊMIO CAI? SIM NÃO MINHA SIMULAÇÃO 17º 100% <1% pts…';

/** Espera a Archivo nos pesos e larguras do card (com os acentos, que ficam em outro pedaço da fonte). */
export async function loadFonts(): Promise<void> {
  const specs = ['900', 'condensed 900', 'condensed 800', '800', '700', '600'];
  await Promise.race([
    Promise.all(specs.map((s) => document.fonts.load(`${s} 64px Archivo`, SAMPLE))),
    new Promise((r) => setTimeout(r, 4000)),
  ]).catch(() => undefined);
}

const FD = /^https?:\/\/crests\.football-data\.org\/(\d+(?:_large)?)\.(png|svg)$/i;

/** Endereço do escudo pelo nosso domínio, ou null (o card desenha a sigla num círculo). */
export function crestUrl(id: number, apiCrest: string | null): string | null {
  const own = (Object.keys(TEAMS) as TeamSlug[]).find((s) => TEAMS[s].id === id);
  if (own) return `/${own}.svg`;
  if (apiCrest?.startsWith('/') && !apiCrest.startsWith('//')) return apiCrest;
  const m = apiCrest ? FD.exec(apiCrest) : null;
  return m ? `/crest/${(m[2] ?? 'png').toLowerCase()}/${m[1] ?? ''}` : null;
}

/** SVG sem width/height não tem tamanho para o canvas em alguns navegadores: põe o do viewBox. */
function sized(svg: string): string {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!tag || /\swidth=/i.test(tag)) return svg;
  const vb = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(tag);
  const [w, h] = vb ? [vb[1], vb[2]] : ['512', '512'];
  return svg.replace(tag, tag.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`));
}

export async function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      ctl.abort();
    }, 6000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    let blob = await r.blob();
    if (blob.type.includes('svg') || url.endsWith('.svg')) {
      blob = new Blob([sized(await blob.text())], { type: 'image/svg+xml' });
    }
    const src = URL.createObjectURL(blob);
    const img = new Image();
    img.src = src;
    await img.decode();
    // o canvas desenha a partir do elemento já decodificado; o endereço pode ser liberado depois do desenho
    setTimeout(() => {
      URL.revokeObjectURL(src);
    }, 30000);
    return img;
  } catch {
    return null;
  }
}
