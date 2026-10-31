import type { CardData } from '../../../domain/share';
import type { Team, TeamSlug } from '../../../shared/teams';
import { crestUrl, loadFonts, loadImage } from './assets';
import { drawCard, H, W } from './draw';

/** Gera o PNG do card. Escudo que não carregar vira a sigla num círculo; só falha se o canvas falhar. */
export async function renderCard(team: Team, slug: TeamSlug, data: CardData): Promise<Blob> {
  const [, crest, ...rowCrests] = await Promise.all([
    loadFonts(),
    loadImage(`/${slug}.svg`),
    ...data.z4.map((r) => loadImage(crestUrl(r.id, r.crest))),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sem canvas 2d');
  drawCard(ctx, { team, slug, data, crest: crest ?? null, rowCrests: rowCrests.map((c) => c ?? null) });
  return new Promise((ok, fail) => {
    canvas.toBlob((b) => {
      if (b) ok(b);
      else fail(new Error('toBlob vazio'));
    }, 'image/png');
  });
}
