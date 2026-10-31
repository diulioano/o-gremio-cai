import { useMemo, useRef, useState } from 'preact/hooks';
import { incompleteRounds } from '../../../domain/predictions';
import { simulate } from '../../../domain/simulate';
import { shareCard } from '../../../domain/share';
import { verdict } from '../../../domain/verdict';
import { TEAMS, type TeamSlug } from '../../../shared/teams';
import { useFlipRows } from '../../hooks/useFlipRows';
import { useMatchData } from '../../hooks/useMatchData';
import { usePinnedBar } from '../../hooks/usePinnedBar';
import { usePredictions } from '../../hooks/usePredictions';
import { useShare } from '../../hooks/useShare';
import { useViewport } from '../../hooks/useViewport';
import { useVote } from '../../hooks/useVote';
import { cx } from '../../lib/cx';
import { status } from '../../lib/status';
import ty from '../../styles/type.module.css';
import { Footer } from '../common/Footer';
import { StatusBar } from '../common/StatusBar';
import { VoteButton } from '../common/VoteButton';
import { VoteSheet } from '../common/VoteSheet';
import { CrowdLine } from './CrowdLine';
import { MatchesPanel } from './MatchesPanel';
import { PinnedVerdictBar } from './PinnedVerdictBar';
import { ShareSheet } from './ShareSheet';
import { SimulationBadge, SimulationBanner } from './SimulationBanner';
import { StandingsTable } from './StandingsTable';
import s from './TeamPage.module.css';
import { VerdictDetails } from './VerdictDetails';
import { VerdictHero, type VerdictState } from './VerdictHero';

/** Página de um time: o veredito, a tabela e os jogos com palpites. */
export function TeamPage({ slug }: { slug: TeamSlug }) {
  const team = TEAMS[slug];
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { raw, err, now, P } = useMatchData(team);
  const { width, mobile, wide } = useViewport();
  const captureRows = useFlipRows(rootRef);
  const { predictions, isSim, actions } = usePredictions(captureRows);
  const [round, setRound] = useState<number | null>(null);

  const gid = P?.gid ?? null;
  const real = useMemo(() => (P ? simulate(P, {}) : null), [P]);
  const res = useMemo(
    () => (!P ? null : isSim ? simulate(P, predictions) : real),
    [P, isSim, predictions, real],
  );
  const { pin, bandOut } = usePinnedBar(heroRef, rootRef, gid, mobile);

  const v = res && gid ? verdict(res, gid) : null;
  const card = res && gid ? shareCard(res, gid, isSim) : null;
  const share = useShare(team, slug, card);
  const vote = useVote();
  const notFound = !!P && !gid;
  const failed = (err && !raw) || notFound;
  const state: VerdictState = failed ? 'failed' : !v ? 'loading' : v.yes ? 'yes' : 'no';
  const shownRound = P ? Math.min(P.last, Math.max(P.first, round ?? P.current)) : null;
  const incomplete = P ? incompleteRounds(P, predictions) : [];
  const st = status(raw, err, now, P);

  const goRound = (r: number) => {
    setRound(r);
    document.getElementById('jogos')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      ref={rootRef}
      data-theme="dark"
      data-font="archivo"
      class={ty.page}
      style={{ '--accent': team.accent }}
    >
      <StatusBar
        dot={st.dot}
        text={!(mobile && isSim && bandOut) && st.text}
        right={isSim && bandOut && <SimulationBadge onBack={actions.clearAll} />}
      />

      <VerdictHero
        heroRef={heroRef}
        team={team}
        slug={slug}
        state={state}
        mobile={mobile}
        banner={
          isSim && <SimulationBanner onBack={actions.clearAll} incomplete={incomplete} onGoRound={goRound} />
        }
      >
        <VerdictDetails
          team={team}
          v={v}
          isSim={isSim}
          failed={err && !raw}
          notFound={notFound}
          onShare={share.open}
        />
        {!failed && <CrowdLine team={team} vote={vote} />}
      </VerdictHero>

      <main class={cx(s.main, mobile && s.mobile, wide && s.wide)}>
        <StandingsTable
          res={gid ? res : null}
          real={real}
          gid={gid}
          isSim={isSim}
          failed={failed}
          mobile={mobile}
        />
        <MatchesPanel
          P={P}
          round={shownRound}
          onRound={setRound}
          predictions={predictions}
          actions={actions}
          mobile={mobile}
          wide={wide}
        />
      </main>

      <Footer currentSlug={slug} />

      {pin && v && (
        <PinnedVerdictBar
          pin={pin}
          team={team}
          v={v}
          crest={(gid && P?.teams[gid]?.crest) || `/${slug}.svg`}
          color={v.yes ? 'var(--danger)' : 'var(--safe)'}
          width={width}
          mobile={mobile}
          onShare={share.open}
        />
      )}

      <ShareSheet share={share} team={team} sim={isSim} mobile={mobile} />
      <VoteButton vote={vote} mobile={mobile} pin={v ? pin : null} />
      <VoteSheet vote={vote} mobile={mobile} />
    </div>
  );
}
