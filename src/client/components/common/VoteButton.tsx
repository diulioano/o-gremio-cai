import { useEffect, useState } from 'preact/hooks';
import type { Pin } from '../../hooks/usePinnedBar';
import type { Vote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { Icon } from './Icon';
import s from './VoteButton.module.css';

interface Props {
  vote: Vote;
  mobile: boolean;
  /** barra fixa do veredito (página do time): presa embaixo, o botão sobe acima dela */
  pin?: Pin;
}

/**
 * Botão flutuante da votação, no canto inferior direito de todas as páginas.
 * No celular, depois de rolar uma tela, encolhe para um círculo só com o ícone.
 */
export function VoteButton({ vote, mobile, pin = null }: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > window.innerHeight);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);

  if (vote.phase === 'loading' || vote.phase === 'hidden') return null;
  const label =
    vote.phase === 'voted' || vote.phase === 'closed' ? 'O que a torcida acha' : 'Quem você acha que cai?';
  const compact = mobile && scrolled;

  return (
    <button
      class={cx(s.fab, compact && s.compact, !mobile && s.desk, pin === 'bottom' && s.raised)}
      aria-label={compact ? label : undefined}
      aria-haspopup="dialog"
      onClick={vote.open}
    >
      <span class={s.ico}>
        <Icon name="bars" size="18px" strokeWidth={2.6} />
      </span>
      {!compact && label}
    </button>
  );
}
