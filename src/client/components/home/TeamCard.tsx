import type { HomeCard } from '../../../domain/verdict';
import { ask } from '../../../shared/teams';
import { cx } from '../../lib/cx';
import ty from '../../styles/type.module.css';
import s from './TeamCard.module.css';

interface Props {
  c: HomeCard;
  /** SIM (no Z4): cartão grande */
  big: boolean;
  /** formato pôster (SIM lado a lado ou no celular) */
  poster: boolean;
  mobile: boolean;
}

function sizes(tall: boolean, big: boolean, mobile: boolean) {
  if (tall) {
    return {
      pad: mobile ? '16px' : '20px 22px',
      gap: mobile ? '12px 14px' : '16px 18px',
      crest: mobile ? '52px' : '72px',
      q: mobile ? 'min(1.25rem,5.6vw)' : '1.35rem',
      meta: '0.85rem',
      ans: mobile ? 'min(3rem,14vw)' : '4rem',
    };
  }
  if (big) return { pad: '22px', gap: '18px', crest: '84px', q: '1.35rem', meta: '0.85rem', ans: '3.4rem' };
  return {
    pad: mobile ? '10px 12px' : '12px 16px',
    gap: '12px',
    crest: mobile ? '40px' : '44px',
    q: mobile ? 'min(1rem,4.4vw)' : '1rem',
    meta: '0.78rem',
    ans: mobile ? 'min(1.7rem,8vw)' : '1.8rem',
  };
}

/** Cartão de um time na página inicial: escudo, "O X cai?", chance, posição e o SIM/NÃO. */
export function TeamCard({ c, big, poster, mobile }: Props) {
  const tall = big && poster;
  const z = sizes(tall, big, mobile);
  const vars = {
    '--pad': z.pad,
    '--gap': z.gap,
    '--crest': z.crest,
    '--q': z.q,
    '--meta': z.meta,
    '--ans': z.ans,
    '--ring': big ? '2px' : '1px',
  };
  return (
    <a
      class={cx('card', s.card, tall && s.tall, big && s.big, c.yes && s.yes)}
      href={'/' + c.slug}
      aria-label={`${ask(c.t)} ${c.yes ? 'Sim' : 'Não'}. ${c.pos}º lugar, ${c.label} de chance de cair`}
      style={vars}
    >
      <div aria-hidden="true" class={s.stripes} style={{ opacity: big ? 0.09 : 0.06, background: c.t.bg }}></div>
      <div class={s.crest}>
        <div
          aria-hidden="true"
          class={s.halo}
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${c.t.halo} ${big ? 40 : 28}%, transparent), transparent 65%)`,
          }}
        ></div>
        <img class={s.img} src={'/' + c.slug + '.svg'} alt="" />
      </div>
      <div class={s.txt}>
        <span class={cx(ty.head, s.q)}>{ask(c.t)}</span>
        <span class={s.meta}>
          <span class={s.nowrap}>
            <strong style={{ color: c.p >= 0.5 ? 'var(--danger)' : 'var(--text)' }}>{c.label}</strong> de chance
          </span>{' '}
          <span class={s.nowrap}>
            · {c.pos}º · {c.pts} pts
          </span>
        </span>
      </div>
      <span class={cx(ty.head, s.ans)}>{c.yes ? 'SIM' : 'NÃO'}</span>
    </a>
  );
}
