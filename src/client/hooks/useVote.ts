// Votação "quem você acha que cai?": estado, seleção, envio e a gaveta aberta ou fechada.
// Um por página, repartido entre o botão flutuante, a gaveta e a linha da torcida.
// Ver specs/003-votacao-rebaixados/data-model.md (estados da tela).
import { useCallback, useEffect, useState } from 'preact/hooks';
import { PICKS, type Picks } from '../../domain/votes';
import type { VoteError, VoteState } from '../../shared/api';
import { forgetVote, loadVote, saveVote } from '../lib/storage';

export type VotePhase = 'loading' | 'hidden' | 'form' | 'sending' | 'voted' | 'closed';

/** erro no envio: `error` deixa tentar de novo; `today` é o teto diário (a votação fecha até amanhã) */
export interface VoteProblem {
  kind: 'error' | 'today';
  text: string;
}

const OFFLINE = 'Sem conexão. Seu voto não foi enviado; tente de novo.';
const HASH = '#votacao';

const isState = (d: unknown): d is VoteState =>
  typeof d === 'object' && d !== null && 'open' in d && 'total' in d;

export function useVote() {
  const [phase, setPhase] = useState<VotePhase>('loading');
  const [state, setState] = useState<VoteState | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [problem, setProblem] = useState<VoteProblem | null>(null);
  const [isOpen, setOpen] = useState(false);

  const settle = useCallback((s: VoteState) => {
    setState(s);
    if (s.mine) saveVote(s.mine, Date.now());
    // encerrada vem antes de "já votou": quem votou também vê o selo e o resultado final
    setPhase(!s.open ? 'closed' : s.mine ? 'voted' : 'form');
  }, []);

  useEffect(() => {
    const { voter } = loadVote();
    fetch(`/api/votes?voter=${encodeURIComponent(voter)}`)
      .then((r) => r.json() as Promise<VoteState | VoteError>)
      .then((d) => {
        if (!isState(d)) throw new Error('error' in d ? d.message : 'sem votação');
        settle(d);
        // vaicair.diuliano.com/#votacao (link no grupo) já abre a gaveta
        if (location.hash === HASH) setOpen(true);
      })
      // sem a votação, o resto da página segue igual
      .catch(() => {
        setPhase('hidden');
      });
  }, [settle]);

  const open = useCallback(() => {
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    if (location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
  }, []);

  /** marca/desmarca; com 3 marcados, os outros não entram até desmarcar um */
  const toggle = useCallback((id: number) => {
    setProblem((p) => (p?.kind === 'today' ? p : null));
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PICKS ? [...p, id] : p));
  }, []);

  const submit = useCallback(async () => {
    if (picked.length !== PICKS) return;
    setPhase('sending');
    setProblem(null);
    try {
      const r = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voter: loadVote().voter, picks: picked as Picks }),
      });
      const d = (await r.json()) as VoteState | VoteError;
      // 201 (votou) ou 409 (já tinha votado): só aqui o voto conta como feito
      if ((r.status === 201 || r.status === 409) && isState(d)) {
        settle(d);
        return;
      }
      if (!isState(d) && d.error === 'closed' && d.state) {
        settle(d.state);
        return;
      }
      // erro: mantém os 3 marcados para tentar de novo
      if (isState(d)) setProblem({ kind: 'error', text: OFFLINE });
      else setProblem({ kind: d.error === 'daily-cap' ? 'today' : 'error', text: d.message });
      setPhase('form');
    } catch {
      setProblem({ kind: 'error', text: OFFLINE });
      setPhase('form');
    }
  }, [picked, settle]);

  // só no `npm run dev` (o build de produção remove): volta ao formulário como um aparelho novo
  const voteAgain = useCallback(() => {
    forgetVote();
    setPicked([]);
    setProblem(null);
    setState((s) => s && { open: s.open, closesAt: s.closesAt, total: s.total });
    setPhase('form');
  }, []);

  return {
    phase,
    state,
    picked,
    missing: PICKS - picked.length,
    problem,
    isOpen,
    open,
    close,
    toggle,
    submit,
    voteAgain: import.meta.env.DEV ? voteAgain : null,
  };
}

export type Vote = ReturnType<typeof useVote>;
