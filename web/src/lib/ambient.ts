import { useSyncExternalStore } from 'react';
import rainUrl from '../assets/audio/chuva.mp3';
import { readPref, writePref } from './prefs';

/**
 * Background rain, off by default. A four-minute excerpt of HoliznaCC0's
 * "Rain · Sleep · Meditation" (CC0), cut with its tail crossfaded into its head
 * so the loop has no seam — see ATTRIBUTION.md.
 *
 * Web Audio rather than `<audio loop>`: an mp3 carries encoder padding at both
 * ends, and the element replays it as a click-and-gap every four minutes. An
 * AudioBufferSourceNode loops sample-exact between `loopStart`/`loopEnd`, which
 * are set past that padding.
 *
 * The file is fetched on first play, never at load — 2.9 MB nobody asked for —
 * and it is not in the service worker's precache (`globPatterns` has no mp3).
 * It is a hashed asset under /assets/, so after one play the HTTP cache keeps it.
 */

const PREF = 'ambient';
const VOLUME = 0.35;
const FADE_S = 1.5;

let on = readPref(PREF) === 'on';
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let buffer: Promise<AudioBuffer> | null = null;
let playing: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** First/last sample above the noise floor: the rain is never silent, so anything quieter is padding. */
function audibleBounds(buf: AudioBuffer): [number, number] {
  const edge = Math.min(buf.length, Math.round(buf.sampleRate * 0.2));
  const loud = (i: number) => {
    for (let c = 0; c < buf.numberOfChannels; c++) {
      if (Math.abs(buf.getChannelData(c)[i] ?? 0) > 1e-4) return true;
    }
    return false;
  };
  let first = 0;
  while (first < edge && !loud(first)) first++;
  let last = buf.length - 1;
  while (last > buf.length - edge && !loud(last)) last--;
  return [first / buf.sampleRate, (last + 1) / buf.sampleRate];
}

async function start(): Promise<void> {
  ctx ??= new AudioContext();
  // Not awaited: outside a user gesture the promise stays pending until one
  // arrives, and playback is scheduled on the context clock either way.
  void ctx.resume();
  const audio = ctx;

  buffer ??= fetch(rainUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((bytes) => audio.decodeAudioData(bytes));
  let buf: AudioBuffer;
  try {
    buf = await buffer;
  } catch (err) {
    buffer = null; // offline or a failed fetch: let the next attempt retry
    throw err;
  }

  // Turned off while the file was still loading, or already playing.
  if (!on || playing) return;

  const [loopStart, loopEnd] = audibleBounds(buf);
  const source = audio.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.loopStart = loopStart;
  source.loopEnd = loopEnd;

  const gain = audio.createGain();
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(VOLUME, now + FADE_S);

  source.connect(gain).connect(audio.destination);
  source.start(now, loopStart);
  playing = { source, gain };
}

function stop() {
  if (!playing || !ctx) return;
  const { source, gain } = playing;
  playing = null;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE_S);
  source.stop(now + FADE_S);
}

/** Resolves false when the sound could not start (offline on first play); the toggle is then back off. */
export async function setAmbient(next: boolean): Promise<boolean> {
  on = next;
  writePref(PREF, next ? 'on' : 'off');
  emit();
  if (!next) {
    stop();
    return true;
  }
  try {
    await start();
    return true;
  } catch {
    on = false;
    writePref(PREF, 'off');
    emit();
    return false;
  }
}

/**
 * Left on last session: browsers refuse to start audio before the page gets a
 * gesture, so wait for the first tap or key. A failure here leaves the
 * preference alone — being offline for a moment should not switch it off.
 */
export function resumeAmbientOnGesture(): () => void {
  if (!on) return () => {};
  const events = ['pointerdown', 'keydown'] as const;
  const kick = () => {
    detach();
    if (on) start().catch(() => {});
  };
  const detach = () => events.forEach((e) => document.removeEventListener(e, kick, true));
  events.forEach((e) => document.addEventListener(e, kick, true));
  return detach;
}

export function useAmbient(): boolean {
  return useSyncExternalStore(subscribe, () => on);
}
