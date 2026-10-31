// O card de compartilhar, 1080 × 1920 (Stories), desenhado no canvas a partir do ShareCard do Claude Design.
// Zonas: topo 0–250 e base 1580–1920 ficam livres para a interface do Stories/WhatsApp; o terço do meio
// (640–1280) carrega selo + SIM/NÃO + %, que é o que sobra no recorte quadrado da miniatura do chat.
import type { CardData } from '../../../domain/share';
import { ask, type Team, type TeamSlug } from '../../../shared/teams';
import { box, contain, paintStripes, rgba, type Ctx } from './paint';
import { baseline, measure, normalH, setFont, wrap, write, type Font } from './text';

export const W = 1080,
  H = 1920;
const X = 60,
  INNER = 960;

const C = {
  bg: '#07090d',
  surface: '#10151d',
  surface2: '#18202b',
  line: '#233042',
  text: '#f2f5f8',
  muted: '#8c98a8',
  danger: '#ff2e3d',
  safe: '#2ee57a',
  warn: '#ffb020',
};

export interface CardInput {
  team: Team;
  slug: TeamSlug;
  data: CardData;
  crest: HTMLImageElement | null;
  /** escudos do Z4, na ordem de data.z4 */
  rowCrests: (HTMLImageElement | null)[];
}

export function drawCard(ctx: Ctx, { team, slug, data: d, crest, rowCrests }: CardInput): void {
  const tone = d.yes ? C.danger : C.safe;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.08;
  paintStripes(ctx, team.bg, W, H, 2);
  ctx.globalAlpha = 1;

  // brilho do veredito no meio
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, (0.26 * H) / (0.75 * W));
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.75 * W);
  glow.addColorStop(0, rgba(tone, d.yes ? 0.26 : 0.16));
  glow.addColorStop(1, rgba(tone, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-W, -H * 4, W * 2, H * 8);
  ctx.restore();

  const fade = ctx.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(7,9,13,.55)');
  fade.addColorStop(0.14, 'rgba(7,9,13,0)');
  fade.addColorStop(0.58, 'rgba(7,9,13,0)');
  fade.addColorStop(0.82, 'rgba(7,9,13,.92)');
  fade.addColorStop(1, C.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  drawQuestion(ctx, team, crest);
  drawMiddle(ctx, d, tone);
  drawZ4(ctx, d, rowCrests);

  // endereço, no limite de cima da margem de baixo
  const a: Font = { w: 900, px: 32, ls: -0.02 },
    b: Font = { w: 600, px: 32 };
  const url = `vaicair.diuliano.com/${slug}`;
  const wa = measure(ctx, 'Quem vai cair?', a),
    wb = measure(ctx, url, b);
  const left = W / 2 - (wa + 18 + wb) / 2,
    y = baseline(ctx, a, 1590, normalH(ctx, a));
  ctx.fillStyle = C.text;
  write(ctx, 'Quem vai cair?', a, left, y);
  ctx.fillStyle = C.muted;
  write(ctx, url, b, left + wa + 18, y);
}

/** Escudo com halo + "O X CAI?", alinhados embaixo no bloco 262–630. */
function drawQuestion(ctx: Ctx, team: Team, crest: HTMLImageElement | null): void {
  const q = ask(team).toUpperCase();
  const f: Font = { w: 900, px: 112, narrow: true, ls: -0.04 };
  while (f.px > 72 && measure(ctx, q, f) > INNER) f.px -= 2;
  const lines = wrap(ctx, q, f, INNER, 2);
  const size = lines.length > 1 ? 180 : 210;
  const lh = f.px * 0.95;
  const qTop = 630 - lines.length * lh;
  ctx.fillStyle = C.text;
  lines.forEach((l, i) => write(ctx, l, f, W / 2, baseline(ctx, f, qTop + i * lh, lh), 'center'));

  const top = qTop - 22 - size,
    cx = W / 2,
    cy = top + size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.88, 0, Math.PI * 2);
  ctx.clip();
  const r = size * 0.88 * Math.SQRT2;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  halo.addColorStop(0, rgba(team.halo, 0.42));
  halo.addColorStop(0.42, rgba(team.halo, 0.12));
  halo.addColorStop(0.68, rgba(team.halo, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  if (crest) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 14;
    contain(ctx, crest, cx - size / 2, top, size);
    ctx.restore();
  } else {
    codeDisc(ctx, team.code, cx, cy, size, 6, Math.round(size * 0.3));
  }
}

function codeDisc(ctx: Ctx, code: string, cx: number, cy: number, size: number, ring: number, px: number) {
  box(ctx, cx - size / 2, cy - size / 2, size, size, size / 2, C.surface2, { w: ring, color: C.line });
  const f: Font = { w: 900, px, ls: -0.02 };
  ctx.fillStyle = C.text;
  write(ctx, code, f, cx, baseline(ctx, f, cy - px / 2, px), 'center');
}

/** Terço do meio: selo de origem, SIM/NÃO, selo de decisão e a prova (%, posição, pontos; sem a % quando há selo). */
function drawMiddle(ctx: Ctx, d: CardData, tone: string): void {
  const selo: Font = { w: 900, px: 46, ls: 0.05 };
  const ans: Font = { w: 900, px: d.decision ? 360 : 400, ls: -0.04 };
  const dec: Font = { w: 900, px: 44, ls: 0.06 };
  const big: Font = { w: 900, px: 76, ls: -0.03 };
  const gap = d.decision ? 16 : 26;
  const word = d.yes ? 'SIM' : 'NÃO';
  // o SIM/NÃO ocupa o desenho das letras (o til do NÃO sobe além da caixa de .8 e encostaria no selo)
  setFont(ctx, ans);
  const ink = ctx.measureText(word);
  const inkUp = ink.actualBoundingBoxAscent || ans.px * 0.72,
    inkDown = ans.px * 0.035;
  const seloH = 46 * 1.1 + 32,
    ansH = inkUp + inkDown,
    decH = 44 * 1.1 + 24 + 12,
    proofH = Math.max(normalH(ctx, big), 64);
  const total = seloH + ansH + proofH + gap * 2 + (d.decision ? decH + gap : 0);
  let y = 640 + (640 - total) / 2;

  const seloText = d.sim ? 'MINHA SIMULAÇÃO' : 'TABELA REAL';
  const sw = measure(ctx, seloText, selo) + 68;
  box(ctx, W / 2 - sw / 2, y, sw, seloH, seloH / 2, d.sim ? C.warn : C.text);
  ctx.fillStyle = C.bg;
  write(ctx, seloText, selo, W / 2, baseline(ctx, selo, y + 16, 46 * 1.1), 'center');
  y += seloH + gap;

  const ay = y + inkUp;
  const aw = measure(ctx, word, ans);
  const ax = W / 2 - aw / 2;
  ctx.save();
  // brilho por trás: só a sombra, com o texto fora da tela
  ctx.shadowColor = rgba(tone, 0.35);
  ctx.shadowBlur = 90;
  ctx.shadowOffsetX = W * 2;
  ctx.fillStyle = tone;
  write(ctx, word, ans, ax - W * 2, ay);
  ctx.restore();
  const off = ans.px * 0.035;
  ctx.fillStyle = d.yes ? '#5c1016' : '#0f4f2a';
  write(ctx, word, ans, ax + off, ay + off);
  ctx.fillStyle = tone;
  write(ctx, word, ans, ax, ay);
  y += ansH + gap;

  if (d.decision) {
    const dw = measure(ctx, d.decision, dec) + 68;
    box(ctx, W / 2 - dw / 2, y, dw, decH, 12, null, { w: 6, color: tone });
    ctx.fillStyle = tone;
    write(ctx, d.decision, dec, W / 2, baseline(ctx, dec, y + 18, 44 * 1.1), 'center');
    y += decH + gap;
  }

  drawProof(ctx, d, y, proofH);
}

function drawProof(ctx: Ctx, d: CardData, top: number, h: number): void {
  const big: Font = { w: 900, px: 76, ls: -0.03 };
  const lab: Font = { w: 700, px: 30 };
  const unit: Font = { w: 900, px: 40 };
  const pos = `${d.pos}º`,
    pts = String(d.pts);
  const wProb = measure(ctx, d.prob, big),
    wLab = Math.max(measure(ctx, 'de chance', lab), measure(ctx, 'de cair', lab)),
    wPos = measure(ctx, pos, big),
    wPts = measure(ctx, pts, big),
    wUnit = measure(ctx, 'pts', unit);
  // com selo de decisão a % é 0% ou 100% e só repete o selo: fica posição e pontos
  const prob = !d.decision;
  const div = 26 + 4 + 26;
  const total = (prob ? wProb + 16 + wLab + div : 0) + wPos + div + wPts + 8 + wUnit;
  let x = W / 2 - total / 2;
  const by = baseline(ctx, big, top, h);
  const mid = top + h / 2;
  const divider = () => {
    x += 26;
    ctx.fillStyle = C.line;
    ctx.fillRect(x, mid - 32, 4, 64);
    x += 4 + 26;
  };

  if (prob) {
    ctx.fillStyle = d.probHigh ? C.danger : C.text;
    x += write(ctx, d.prob, big, x, by) + 16;
    ctx.fillStyle = C.muted;
    const lh = 30 * 1.05;
    write(ctx, 'de chance', lab, x, baseline(ctx, lab, mid - lh, lh));
    write(ctx, 'de cair', lab, x, baseline(ctx, lab, mid, lh));
    x += wLab;
    divider();
  }
  ctx.fillStyle = C.text;
  x += write(ctx, pos, big, x, by);
  divider();
  ctx.fillStyle = C.text;
  x += write(ctx, pts, big, x, by) + 8;
  ctx.fillStyle = C.muted;
  write(ctx, 'pts', unit, x, by);
}

/** "Quem cai": os 4 do Z4 da tabela exibida, 17º → 20º, com o time da página destacado. */
function drawZ4(ctx: Ctx, d: CardData, crests: (HTMLImageElement | null)[]): void {
  const tf: Font = { w: 800, px: 30, ls: 0.14 };
  const title = (d.sim ? 'Quem cai na minha simulação' : 'Quem cai na tabela real').toUpperCase();
  const th = normalH(ctx, tf),
    tw = measure(ctx, title, tf);
  const ruleW = (INNER - tw - 40) / 2;
  ctx.fillStyle = C.line;
  ctx.fillRect(X, 1292 + th / 2 - 1.5, ruleW, 3);
  ctx.fillRect(X + INNER - ruleW, 1292 + th / 2 - 1.5, ruleW, 3);
  ctx.fillStyle = C.muted;
  write(ctx, title, tf, W / 2, baseline(ctx, tf, 1292, th), 'center');

  const top = 1292 + th + 14,
    cw = (INNER - 16 * 3) / 4,
    ch = 226;
  const num: Font = { w: 800, px: 28 };
  const name: Font = { w: 800, px: 30, narrow: true };
  d.z4.forEach((r, i) => {
    const x = X + i * (cw + 16);
    box(ctx, x, top, cw, ch, 24, r.me ? 'rgba(255,46,61,.18)' : 'rgba(16,21,29,.92)', {
      w: r.me ? 5 : 2,
      color: r.me ? C.danger : C.line,
    });
    const ny = baseline(ctx, num, top + 14, 28);
    ctx.fillStyle = C.danger;
    write(ctx, `${r.pos}º`, num, x + 18, ny);
    ctx.fillStyle = C.muted;
    write(ctx, `${r.pts} pts`, num, x + cw - 18, ny, 'right');

    const cTop = top + 14 + 28 + 8,
      img = crests[i] ?? null;
    if (img) contain(ctx, img, x + cw / 2 - 48, cTop, 96);
    else codeDisc(ctx, r.code, x + cw / 2, cTop + 48, 96, 4, 30);

    ctx.fillStyle = C.text;
    const lines = wrap(ctx, r.name, name, cw - 24, 2);
    lines.forEach((l, j) =>
      write(ctx, l, name, x + cw / 2, baseline(ctx, name, cTop + 96 + 8 + j * 30, 30), 'center'),
    );
  });
}
