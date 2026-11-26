import { useEffect, useRef, useState } from 'preact/hooks';
import { detectGoalTeams } from '../../domain/live';
import type { DataPayload } from '../../shared/api';

const FLASH_MS = 2600;

/** Toque curto e discreto de gol via Web Audio (ignora silenciosamente se o navegador bloquear autoplay). */
function playGoalChime(): void {
  try {
    const win = window as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.close();
      return;
    }
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 → A5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.34);
    });
    setTimeout(() => void ctx.close(), 700);
  } catch {
    // ambiente sem Web Audio ou bloqueado pelo navegador
  }
}

const EMPTY: ReadonlySet<number> = new Set();

/** Detecta gols novos no polling ao vivo para destacar a linha na tabela e tocar o aviso sonoro. */
export function useLiveGoals(raw: DataPayload | null): ReadonlySet<number> {
  const prevRef = useRef<DataPayload | null>(null);
  const [goalTeams, setGoalTeams] = useState<ReadonlySet<number>>(EMPTY);

  useEffect(() => {
    const scorers = detectGoalTeams(prevRef.current, raw);
    prevRef.current = raw;
    if (!scorers.length) return;
    setGoalTeams(new Set(scorers));
    playGoalChime();
    const timer = setTimeout(() => {
      setGoalTeams(EMPTY);
    }, FLASH_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [raw]);

  return goalTeams;
}
