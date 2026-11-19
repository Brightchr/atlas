import { useEffect, useState, useSyncExternalStore } from 'react';

/** The rest countdown between sets.
 *
 * It lives OUTSIDE React, in a tiny store backed by localStorage, for two
 * reasons:
 *  1. It must survive leaving the workout screen (checking an exercise's
 *     how-to, logging a meal) and even a page reload mid-rest.
 *  2. It is stored as a deadline ("ends at 14:03:20"), never as a ticking
 *     counter, so a phone that sleeps or throttles timers can't make it drift.
 *
 * Components read it with `useRestTimer()`; anything can call the plain
 * functions (`startRest`, `adjustRest`, `stopRest`). */

export interface RestState {
  sessionId: string;
  /** Epoch ms when the rest is over. */
  endsAt: number;
  /** The full length this rest was started with, for the progress bar. */
  totalSec: number;
}

/** Used when an exercise has no rest time of its own (anything added
 * mid-workout), so every logged set still gets a countdown. */
export const DEFAULT_REST_SEC = 90;

const KEY = 'arcadia-rest-timer';
const listeners = new Set<() => void>();

function read(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestState;
    return typeof parsed.endsAt === 'number' && typeof parsed.sessionId === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

let state: RestState | null = read();

function set(next: RestState | null): void {
  state = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / storage full: the timer still works for this page load.
  }
  listeners.forEach((l) => l());
}

/* ------------------------------- The alarm ------------------------------- */

// Browsers only allow sound after a user gesture. startRest() is always
// called from a tap (logging a set), so the audio context is created there
// and reused when the countdown ends.
let audio: AudioContext | null = null;

function primeAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null; // no Web Audio: vibration alone will have to do
  }
}

function beep(): void {
  if (!audio) return;
  // Two short tones: audible over gym noise without being an alarm clock.
  for (const [offset, freq] of [
    [0, 880],
    [0.22, 1175],
  ] as const) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + offset);
    osc.stop(audio.currentTime + offset + 0.2);
  }
}

function alarm(): void {
  beep();
  // Not available on iOS Safari; harmless where it's missing.
  navigator.vibrate?.([200, 100, 200]);
}

/* -------------------------------- Actions -------------------------------- */

export function startRest(sessionId: string, seconds: number): void {
  primeAudio();
  set({ sessionId, endsAt: Date.now() + seconds * 1000, totalSec: seconds });
}

/** +15 / −15: moves the deadline, and the total so the bar stays honest. */
export function adjustRest(deltaSec: number): void {
  if (!state) return;
  const endsAt = Math.max(Date.now(), state.endsAt + deltaSec * 1000);
  set({ ...state, endsAt, totalSec: Math.max(1, state.totalSec + deltaSec) });
}

export function stopRest(): void {
  if (state) set(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* --------------------------------- Hooks --------------------------------- */

/** The running rest, with whole seconds remaining. Re-renders once a second
 * only while a rest is running. */
export function useRestTimer(): { rest: RestState | null; remainingSec: number } {
  const rest = useSyncExternalStore(subscribe, () => state);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rest) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [rest]);
  return { rest, remainingSec: rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0 };
}

/** Mount ONCE (in the app shell): sounds the alarm when the rest ends, on
 * whatever screen the user happens to be, then clears the timer. */
export function useRestAlarm(): void {
  const rest = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!rest) return;
    const msLeft = rest.endsAt - Date.now();
    // Ended while the app was closed: nothing to announce, just tidy up.
    if (msLeft < -5000) {
      stopRest();
      return;
    }
    const id = setTimeout(
      () => {
        alarm();
        stopRest();
      },
      Math.max(0, msLeft),
    );
    return () => clearTimeout(id);
  }, [rest]);
}

/** "1:05" for countdowns and clocks. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
