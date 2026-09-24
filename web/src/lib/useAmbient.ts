import { useSyncExternalStore } from 'react';
import { playAmbient, playingTrack, setAmbientSequence, stopAmbient, subscribeAmbient, trackById } from './ambient';
import { readPref, writePref } from './prefs';

/**
 * The app's side of ambient music: whether it is on and which track, both
 * remembered on this device so the next visit picks up where this one left
 * off. The player itself (ambient.ts) knows nothing about preferences.
 */

const ON_PREF = 'ambient';
const TRACK_PREF = 'ambient-track';
const SEQUENCE_PREF = 'ambient-sequence';

let state = {
  on: readPref(ON_PREF) === 'on',
  trackId: trackById(readPref(TRACK_PREF)).id,
  sequence: readPref(SEQUENCE_PREF) === 'on',
};
setAmbientSequence(state.sequence);
const listeners = new Set<() => void>();

function set(next: Partial<typeof state>) {
  state = { ...state, ...next };
  writePref(ON_PREF, state.on ? 'on' : 'off');
  writePref(TRACK_PREF, state.trackId);
  writePref(SEQUENCE_PREF, state.sequence ? 'on' : 'off');
  listeners.forEach((fn) => fn());
}

// In sequence the player moves on by itself; follow it, so the picker shows
// what is actually playing and the next visit resumes from there.
subscribeAmbient(() => {
  const id = playingTrack();
  if (id && id !== state.trackId) set({ trackId: id });
});

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAmbient(): typeof state {
  return useSyncExternalStore(subscribe, () => state);
}

/** Resolves false when the music could not start (offline on first play); it is then back off. */
export async function setAmbientOn(on: boolean): Promise<boolean> {
  set({ on });
  if (!on) {
    stopAmbient();
    return true;
  }
  const ok = await playAmbient(state.trackId);
  if (!ok && state.on) set({ on: false });
  return ok;
}

export function setAmbientSequenceOn(sequence: boolean): void {
  setAmbientSequence(sequence);
  set({ sequence });
}

/** Picking a track is asking to hear it: it also turns the music on. */
export function setAmbientTrack(id: string): Promise<boolean> {
  set({ trackId: trackById(id).id });
  return setAmbientOn(true);
}

/**
 * Left on last session: browsers refuse to start audio before the page gets a
 * gesture, so wait for the first tap or key. A failure here leaves the
 * preference alone — being offline for a moment should not switch it off.
 */
export function resumeAmbientOnGesture(): () => void {
  if (!state.on) return () => {};
  const events = ['pointerdown', 'keydown'] as const;
  const kick = () => {
    detach();
    if (state.on) void playAmbient(state.trackId);
  };
  const detach = () => events.forEach((e) => document.removeEventListener(e, kick, true));
  events.forEach((e) => document.addEventListener(e, kick, true));
  return detach;
}
