import { useEffect, useRef, useState } from 'preact/hooks';
import type { Vote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { Icon } from './Icon';
import { VoteForm } from './VoteForm';
import { VoteResult } from './VoteResult';
import s from './VoteSheet.module.css';

// Gaveta da votação "quem você acha que cai?" (Claude Design: Votacao Torcida, estados A a G).
// Mesma família da gaveta de compartilhar: sobe de baixo no celular, painel lateral no PC.
// Os destaques usam o accent do time, nunca o vermelho/verde do SIM/NÃO: é opinião, não veredito.

/** arrastar a gaveta mais que isso para baixo fecha */
const DRAG_CLOSE = 120;

export function VoteSheet({ vote, mobile }: { vote: Vote; mobile: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const dragRef = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const { phase, state, isOpen, close } = vote;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  const isForm = phase === 'form' || phase === 'sending';
  const closed = phase === 'closed';

  const title = isForm ? 'Quem você acha que cai?' : 'O que a torcida acha';
  const sub = isForm
    ? 'Escolha 3. A Chapecoense já caiu.'
    : closed
      ? 'Resultado final. A votação fechou quando começou a última rodada.'
      : state?.warmingUp
        ? 'Seu voto foi registrado.'
        : '% de quem votou que acha que o time cai. Cada voto escolhe 3, então a soma passa de 100%.';

  // arrastar pela alça ou pelo título (só no celular)
  const dragHandlers = mobile
    ? {
        onPointerDown: (e: PointerEvent) => {
          if ((e.target as Element).closest('button')) return;
          dragRef.current = e.clientY;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        },
        onPointerMove: (e: PointerEvent) => {
          if (dragRef.current !== null) setDy(Math.max(0, e.clientY - dragRef.current));
        },
        onPointerUp: () => {
          if (dragRef.current !== null && dy > DRAG_CLOSE) close();
          dragRef.current = null;
          setDy(0);
        },
        onPointerCancel: () => {
          dragRef.current = null;
          setDy(0);
        },
      }
    : {};

  return (
    <dialog
      ref={ref}
      class={cx(s.dialog, mobile ? s.sheet : s.side)}
      aria-labelledby="vote-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {isOpen && (
        <div
          class={s.panel}
          style={dy ? { transform: `translateY(${String(dy)}px)`, transition: 'none' } : undefined}
        >
          <div class={s.top} {...dragHandlers}>
            {mobile && <span class={s.grip} aria-hidden="true"></span>}
            <div class={s.head}>
              <div class={s.titles}>
                {closed && <span class={s.badge}>VOTAÇÃO ENCERRADA</span>}
                <h2 id="vote-title" class={s.title}>
                  {title}
                </h2>
                <p class={s.sub}>{sub}</p>
              </div>
              <button class={s.close} aria-label="Fechar" onClick={close}>
                <Icon name="close" size="18px" />
              </button>
            </div>
          </div>
          {isForm ? <VoteForm vote={vote} /> : <VoteResult vote={vote} />}
        </div>
      )}
    </dialog>
  );
}
