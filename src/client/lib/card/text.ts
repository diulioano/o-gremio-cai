// Texto no canvas com as mesmas regras do CSS do desenho: Archivo, largura condensada, espaçamento em em
// e a linha posicionada como uma caixa de line-height.
import type { Ctx } from './paint';

export interface Font {
  w: number;
  px: number;
  /** wdth 75 */
  narrow?: boolean;
  /** letter-spacing em em */
  ls?: number;
}

type Spaced = Ctx & { letterSpacing?: string; fontStretch?: string };
const nativeSpacing = (ctx: Ctx) => 'letterSpacing' in ctx;

export function setFont(ctx: Ctx, f: Font): void {
  const c = ctx as Spaced;
  c.font = `${f.narrow ? 'condensed ' : ''}${f.w} ${f.px}px Archivo, sans-serif`;
  if ('fontStretch' in c) c.fontStretch = f.narrow ? 'condensed' : 'normal';
  if (nativeSpacing(c)) c.letterSpacing = `${(f.ls ?? 0) * f.px}px`;
}

/** Largura do texto com o espaçamento (sem o espaço que sobra depois da última letra). */
export function measure(ctx: Ctx, t: string, f: Font): number {
  setFont(ctx, f);
  const ls = (f.ls ?? 0) * f.px;
  if (nativeSpacing(ctx)) return ctx.measureText(t).width - ls;
  return ctx.measureText(t).width + ls * Math.max(0, t.length - 1);
}

/** Linha de base para centralizar a fonte numa caixa de altura `lineH` que começa em `top` (como o CSS). */
export function baseline(ctx: Ctx, f: Font, top: number, lineH: number): number {
  setFont(ctx, f);
  const m = ctx.measureText('H');
  const asc = m.fontBoundingBoxAscent || f.px * 0.88;
  const desc = m.fontBoundingBoxDescent || f.px * 0.21;
  return top + (lineH - (asc + desc)) / 2 + asc;
}

/** Altura da caixa com line-height normal. */
export function normalH(ctx: Ctx, f: Font): number {
  setFont(ctx, f);
  const m = ctx.measureText('H');
  return (m.fontBoundingBoxAscent || f.px * 0.88) + (m.fontBoundingBoxDescent || f.px * 0.21);
}

export type Align = 'left' | 'center' | 'right';

/** Escreve com o espaçamento do desenho; x é a borda esquerda, o centro ou a borda direita. */
export function write(ctx: Ctx, t: string, f: Font, x: number, y: number, align: Align = 'left'): number {
  const w = measure(ctx, t, f);
  let left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (nativeSpacing(ctx) || !f.ls) {
    ctx.fillText(t, left, y);
    return w;
  }
  const ls = f.ls * f.px;
  for (const ch of t) {
    ctx.fillText(ch, left, y);
    left += ctx.measureText(ch).width + ls;
  }
  return w;
}

/** Quebra em até `max` linhas equilibradas; o que não couber termina em reticências. */
export function wrap(ctx: Ctx, t: string, f: Font, width: number, max: number): string[] {
  if (measure(ctx, t, f) <= width) return [t];
  const words = t.split(' ');
  if (max >= 2 && words.length > 1) {
    let best: string[] | null = null,
      bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '),
        b = words.slice(i).join(' ');
      const w = Math.max(measure(ctx, a, f), measure(ctx, b, f));
      if (w < bestW) {
        bestW = w;
        best = [a, b];
      }
    }
    if (best && bestW <= width) return best;
    if (best) return [ellipsis(ctx, best[0] ?? '', f, width), ellipsis(ctx, best[1] ?? '', f, width)];
  }
  return [ellipsis(ctx, t, f, width)];
}

function ellipsis(ctx: Ctx, t: string, f: Font, width: number): string {
  if (measure(ctx, t, f) <= width) return t;
  let s = t;
  while (s.length > 1 && measure(ctx, `${s}…`, f) > width) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}
