// Pincéis do card: o canvas não entende CSS, então as listras dos times (teams.ts) são traduzidas aqui.

export type Ctx = CanvasRenderingContext2D;

/** "#1A9BE0" → "rgba(26,155,224,a)" */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface Band {
  color: string;
  from: number;
  to: number | null;
}

/** Divide por vírgula fora de parênteses. */
const split = (s: string) => s.split(/,(?![^(]*\))/).map((x) => x.trim());

const LINEAR = /^(repeating-)?linear-gradient\((-?\d+(?:\.\d+)?)deg,(.*)\)$/;

/**
 * Pinta um linear-gradient de paradas duras (o formato das listras em teams.ts) num retângulo w × h.
 * Medidas em px são multiplicadas por `k` (o card tem o dobro da largura de um celular).
 */
export function paintStripes(ctx: Ctx, css: string, w: number, h: number, k: number): void {
  const m = LINEAR.exec(css.replace(/\s+/g, ' ').trim());
  if (!m) return;
  const [, rep, deg, body] = m;
  const a = (Number(deg) * Math.PI) / 180;
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  // largura da faixa: o retângulo inteiro visto de lado
  const across = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const at = (t: string) => (t.endsWith('%') ? (parseFloat(t) / 100) * len : parseFloat(t) * k);
  const bands: Band[] = split(body ?? '').map((stop) => {
    const [color = 'transparent', p1, p2] = stop.split(' ');
    return { color, from: p1 ? at(p1) : 0, to: p2 ? at(p2) : null };
  });
  bands.forEach((b, i) => {
    b.to ??= bands[i + 1]?.from ?? len;
  });
  const period = rep ? Math.max(...bands.map((b) => b.to ?? 0)) : len;
  if (!(period > 0)) return;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(a - Math.PI / 2);
  for (let x = -len / 2; x < len / 2; x += period) {
    for (const b of bands) {
      if (b.color === 'transparent' || b.to == null) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(x + b.from, -across / 2, b.to - b.from, across);
    }
    if (!rep) break;
  }
  ctx.restore();
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Caixa com fundo e contorno por dentro (o box-shadow inset do desenho). */
export function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | null,
  ring?: { w: number; color: string },
): void {
  if (fill) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (ring) {
    const i = ring.w / 2;
    roundRect(ctx, x + i, y + i, w - ring.w, h - ring.w, Math.max(0, r - i));
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.w;
    ctx.stroke();
  }
}

/** Desenha a imagem inteira dentro do quadrado (object-fit: contain). */
export function contain(ctx: Ctx, img: HTMLImageElement, x: number, y: number, size: number): void {
  const iw = img.naturalWidth || size,
    ih = img.naturalHeight || size;
  const s = size / Math.max(iw, ih);
  const dw = iw * s,
    dh = ih * s;
  ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
}
