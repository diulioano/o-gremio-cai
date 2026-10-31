import { useMemo } from 'preact/hooks';
import { simulate } from '../../../domain/simulate';
import { homeCards } from '../../../domain/verdict';
import { useMatchData } from '../../hooks/useMatchData';
import { useViewport } from '../../hooks/useViewport';
import { useVote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { status } from '../../lib/status';
import { loadPredictions } from '../../lib/storage';
import ty from '../../styles/type.module.css';
import { Footer } from '../common/Footer';
import { LoadFailed } from '../common/LoadFailed';
import { Skeleton } from '../common/Skeleton';
import { StatusBar } from '../common/StatusBar';
import { VoteButton } from '../common/VoteButton';
import { VoteSheet } from '../common/VoteSheet';
import s from './HomePage.module.css';
import { TeamCard } from './TeamCard';
import { Z4Divider } from './Z4Divider';

// Página inicial: quem cairia hoje (SIM) em destaque, a linha do Z4 e, abaixo, quem escapa (NÃO).
// Dentro de cada grupo, do mais ameaçado para o menos. Sempre pela tabela real.
export function HomePage() {
  const { raw, err, now, P } = useMatchData(null);
  const { width, mobile } = useViewport();
  const vote = useVote();
  const real = useMemo(() => (P ? simulate(P, {}) : null), [P]);
  const hasPal = Object.keys(loadPredictions()).length > 0;
  const cards = P && real ? homeCards(P, real) : [];
  const sims = cards.filter((c) => c.yes),
    naos = cards.filter((c) => !c.yes);
  // os SIM ficam lado a lado só se cada um tiver ao menos 320px; senão, um por linha
  const cw = Math.min(width, 1280) - (mobile ? 24 : 64);
  const simCols = !mobile && sims.length && cw / sims.length >= 320 ? sims.length : 1;
  // SIM lado a lado ou no celular: formato pôster; SIM sozinho na linha e todos os NÃO: em linha
  const poster = mobile || simCols > 1;
  const st = status(raw, err, now, P);

  return (
    <div data-theme="dark" data-font="archivo" class={cx(ty.page, mobile && s.mobile)}>
      <StatusBar dot={st.dot} text={st.text} />
      <section class={s.hero}>
        <h1 class={cx(ty.head, s.title)}>
          Quem vai <span class={s.danger}>cair?</span>
        </h1>
        <p class={s.lead}>
          A chance de cada time da briga contra o rebaixamento cair no Brasileirão. Escolha o seu para ver a
          tabela e simular os jogos que faltam.
        </p>
      </section>
      <main class={s.main}>
        <div class={cx(ty.sectionHeader, s.header)}>
          <h2 class={cx(ty.h2, mobile && ty.h2Mobile)}>Na briga</h2>
          {raw && (
            <span class={ty.note}>{hasPal ? 'Tabela real, sem os seus palpites' : 'Tabela atual'}</span>
          )}
        </div>
        {err && !raw ? (
          <LoadFailed msg="Não deu para carregar a tabela." />
        ) : !real ? (
          <>
            <div class={s.grid} style={{ gridTemplateColumns: `repeat(${mobile ? 1 : 3},minmax(0,1fr))` }}>
              {[1, 2, 3].map((k) => (
                <Skeleton key={k} height={mobile ? '92px' : '128px'} />
              ))}
            </div>
            <div class={s.skLine}></div>
            <div class={s.naoGrid}>
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <Skeleton key={k} height={mobile ? '64px' : '72px'} />
              ))}
            </div>
          </>
        ) : (
          <>
            {sims.length ? (
              <div class={s.grid} style={{ gridTemplateColumns: `repeat(${simCols},minmax(0,1fr))` }}>
                {sims.map((c) => (
                  <TeamCard key={c.slug} c={c} big poster={poster} mobile={mobile} />
                ))}
              </div>
            ) : (
              <p class={s.empty}>Nenhum time da lista está no Z4 hoje.</p>
            )}
            <Z4Divider mobile={mobile} />
            <div class={s.naoGrid}>
              {naos.map((c) => (
                <TeamCard key={c.slug} c={c} big={false} poster={poster} mobile={mobile} />
              ))}
            </div>
          </>
        )}
      </main>
      <Footer currentSlug={null} />
      <VoteButton vote={vote} mobile={mobile} />
      <VoteSheet vote={vote} mobile={mobile} />
    </div>
  );
}
