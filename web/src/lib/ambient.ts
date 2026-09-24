import chuva from '../assets/audio/chuva.mp3';
import cosmos1 from '../assets/audio/cosmos-1.mp3';
import cosmos2 from '../assets/audio/cosmos-2.mp3';
import cosmos3 from '../assets/audio/cosmos-3.mp3';
import sonho1 from '../assets/audio/sonho-1.mp3';
import sonho2 from '../assets/audio/sonho-2.mp3';
import sonho3 from '../assets/audio/sonho-3.mp3';
import breve1 from '../assets/audio/breve-1.mp3';
import breve2 from '../assets/audio/breve-2.mp3';
import breve3 from '../assets/audio/breve-3.mp3';
import medit12a from '../assets/audio/medit12-1.mp3';
import medit12b from '../assets/audio/medit12-2.mp3';
import medit12c from '../assets/audio/medit12-3.mp3';
import medit1a from '../assets/audio/medit1-1.mp3';
import medit1b from '../assets/audio/medit1-2.mp3';
import medit1c from '../assets/audio/medit1-3.mp3';

/**
 * Background music, off by default. Every track is HoliznaCC0, album
 * "Space - Sleep - Meditation" (CC0) — see ATTRIBUTION.md for the cuts.
 *
 * A track is one or more parts played in order and around again, each handed
 * to the next with an XF-second crossfade. Rain is one four-minute part cut to
 * loop on itself; the others are three three-minute excerpts from different
 * points of the original, so the loop takes nine minutes to come round. With
 * `sequence` on, the last part hands off to the next track's first instead. All
 * parts are levelled to -20 LUFS, so switching tracks does not jump in volume.
 *
 * Playback streams through two `<audio>` elements ("decks") routed into Web
 * Audio. Decoding into AudioBuffers would be sample-exact but costs ~30 MB of
 * PCM per minute of stereo audio; streaming keeps memory flat, and the
 * crossfade hides the element's imprecise timing. The gain nodes are there
 * because iOS ignores `HTMLMediaElement.volume`.
 *
 * Both decks are created — and played once — inside the first user gesture:
 * Safari only lets an element start later, unprompted (the next part at the
 * three-minute mark), if it has already played from a gesture.
 *
 * Nothing here persists anything; the app keeps its preference in
 * useAmbient.ts, and the product page plays the first track without one.
 */

export interface Track {
  id: string;
  name: string;
  /** One line under the name in the picker. */
  note: string;
  parts: string[];
}

export const TRACKS: readonly Track[] = [
  { id: 'chuva', name: 'Chuva', note: 'Chuva constante, sem melodia', parts: [chuva] },
  { id: 'cosmos', name: 'Ondas cósmicas', note: 'Pads longos que vêm e vão', parts: [cosmos1, cosmos2, cosmos3] },
  { id: 'sonho', name: 'Paisagem de sonho', note: 'Mais cheia, com camadas', parts: [sonho1, sonho2, sonho3] },
  { id: 'breve', name: 'Um tempo breve', note: 'Grave e lenta', parts: [breve1, breve2, breve3] },
  { id: 'meditacao-12', name: 'Meditação 12', note: 'Suave, quase parada', parts: [medit12a, medit12b, medit12c] },
  { id: 'meditacao-1', name: 'Meditação 1', note: 'Mais aberta, com brilho', parts: [medit1a, medit1b, medit1c] },
];

export const DEFAULT_TRACK = TRACKS[0]!.id;

export function trackById(id: string | null | undefined): Track {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}

const VOLUME = 0.35;
/** Crossfade between two parts of a track. */
const XF_S = 6;
/** Fade for switching tracks, starting and stopping. */
const FADE_S = 1.5;

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode;
}

let ctx: AudioContext | null = null;
let decks: [Deck, Deck] | null = null;
let current: { track: Track; part: number; deck: 0 | 1; handedOff: boolean } | null = null;
/** After a track's last part, move on to the next track instead of going round again. */
let sequence = false;

export function setAmbientSequence(on: boolean): void {
  sequence = on;
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function subscribeAmbient(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Id of the track playing (or starting), null when silent. */
export function playingTrack(): string | null {
  return current?.track.id ?? null;
}

function ramp(gain: GainNode, to: number, seconds: number) {
  const now = ctx!.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
}

function setup(firstUrl: string): [Deck, Deck] {
  ctx ??= new AudioContext();
  void ctx.resume();
  if (decks) return decks;

  const audio = ctx;
  const master = audio.createGain();
  master.gain.value = VOLUME;
  master.connect(audio.destination);

  const make = (index: 0 | 1): Deck => {
    const el = new Audio();
    el.preload = 'auto';
    const gain = audio.createGain();
    gain.gain.value = 0;
    audio.createMediaElementSource(el).connect(gain).connect(master);
    el.addEventListener('timeupdate', () => nearEnd(index));
    // Fallback for a timeupdate that came too late (a throttled background tab).
    el.addEventListener('ended', () => nearEnd(index, true));
    return { el, gain };
  };
  decks = [make(0), make(1)];

  // Unlock the second deck while we are still inside the gesture; it stays at
  // gain 0 and is paused again at once.
  const spare = decks[1].el;
  spare.src = firstUrl;
  spare
    .play()
    .then(() => {
      if (current?.deck !== 1) spare.pause();
    })
    .catch(() => {});
  return decks;
}

function nearEnd(index: 0 | 1, ended = false) {
  if (!current || current.deck !== index || current.handedOff || !decks) return;
  const el = decks[index].el;
  if (!ended && !(el.duration - el.currentTime <= XF_S)) return;
  current.handedOff = true;
  let track = current.track;
  let next = current.part + 1;
  if (next >= track.parts.length) {
    next = 0;
    if (sequence) track = TRACKS[(TRACKS.indexOf(track) + 1) % TRACKS.length]!;
  }
  // The next part failed to load (connection dropped mid-track): go quiet
  // rather than keep claiming to play.
  handoff(track, next, ended ? FADE_S : XF_S).catch(() => stopAmbient());
}

/** Starts `track` at `part` on the idle deck and fades the busy one out. */
function handoff(track: Track, part: number, fade: number): Promise<void> {
  const [a, b] = decks!;
  const from = current?.deck;
  const to: 0 | 1 = from === 0 ? 1 : 0;
  const incoming = to === 0 ? a : b;

  incoming.el.src = track.parts[part]!;
  incoming.gain.gain.cancelScheduledValues(ctx!.currentTime);
  incoming.gain.gain.setValueAtTime(0, ctx!.currentTime);
  ramp(incoming.gain, 1, fade);

  if (from !== undefined) fadeOutDeck(from, fade);
  current = { track, part, deck: to, handedOff: false };
  emit();
  return incoming.el.play();
}

function fadeOutDeck(index: 0 | 1, fade: number) {
  const deck = decks![index];
  ramp(deck.gain, 0, fade);
  window.setTimeout(() => {
    if (current?.deck !== index) deck.el.pause();
  }, fade * 1000 + 150);
}

/**
 * Starts `id` from its first part, crossfading from whatever was playing.
 * Call from a user gesture the first time. Resolves false when the audio could
 * not start (offline on first play); nothing is playing then.
 */
export async function playAmbient(id: string): Promise<boolean> {
  const track = trackById(id);
  if (current?.track.id === track.id) return true;
  setup(track.parts[0]!);
  try {
    await handoff(track, 0, FADE_S);
    return true;
  } catch {
    if (current?.track.id === track.id) stopAmbient();
    return false;
  }
}

export function stopAmbient(): void {
  if (!current || !decks) return;
  current = null;
  // Both decks: one may still be fading out from a crossfade, and "off" should
  // mean quiet in FADE_S, not whenever that crossfade would have ended.
  fadeOutDeck(0, FADE_S);
  fadeOutDeck(1, FADE_S);
  emit();
}
