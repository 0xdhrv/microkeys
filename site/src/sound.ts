/**
 * Synthesised mechanical-keyboard sounds. Modelled on how sampled keyboard
 * apps work: separate down/up sounds, a few alpha variants, distinct space /
 * enter / backspace voices, and a little random pitch per press.
 */

const STORAGE_KEY = "sound";
const MAX_VOICES = 10;

type Kind = "alpha" | "space" | "enter" | "backspace" | "modifier";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let voices = 0;

const listeners = new Set<() => void>();

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {}
  for (const l of listeners) l();
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function kindOf(code: string): Kind {
  if (code === "Space") return "space";
  if (code === "Enter" || code === "NumpadEnter") return "enter";
  if (code === "Backspace" || code === "Delete") return "backspace";
  if (/^(Shift|Control|Alt|Meta|OS|Caps|Fn|Tab|Escape)/.test(code)) return "modifier";
  return "alpha";
}

const VOICE: Record<Kind, { body: number; click: number; gain: number }> = {
  alpha: { body: 190, click: 3200, gain: 0.5 },
  space: { body: 120, click: 2200, gain: 0.65 },
  enter: { body: 150, click: 2600, gain: 0.6 },
  backspace: { body: 160, click: 2800, gain: 0.55 },
  modifier: { body: 220, click: 3600, gain: 0.4 },
};

function getContext() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: "interactive" }) as AudioContext;
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function play(code: string, down: boolean) {
  const c = getContext();
  if (!c || !noise || voices >= MAX_VOICES) return;
  const kind = kindOf(code);
  const v = VOICE[kind];
  // Same range sampled apps use: 0.88x to 1.12x playback rate.
  const rate = 0.88 + Math.random() * 0.24;
  const level = v.gain * (down ? 1 : 0.4);
  const t = c.currentTime;
  const len = down ? 0.09 : 0.045;

  const out = c.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(level, t + 0.002);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 7000;
  out.connect(lowpass).connect(c.destination);

  // Click: filtered noise burst.
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = rate;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = v.click * rate * (down ? 1 : 1.3);
  band.Q.value = 0.9;
  const clickGain = c.createGain();
  clickGain.gain.setValueAtTime(0.9, t);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + (down ? 0.02 : 0.012));
  src.connect(band).connect(clickGain).connect(out);

  // Thock: short sine with a falling pitch.
  const osc = c.createOscillator();
  osc.type = "sine";
  const f = v.body * rate * (down ? 1 : 1.6);
  osc.frequency.setValueAtTime(f * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  const oscGain = c.createGain();
  oscGain.gain.value = down ? 0.9 : 0.35;
  osc.connect(oscGain).connect(out);

  voices++;
  src.start(t);
  src.stop(t + 0.04);
  osc.start(t);
  osc.stop(t + len);
  osc.onended = () => {
    voices--;
    out.disconnect();
  };
}

/** Plays down/up sounds for every real key event until the returned cleanup runs. */
export function installKeySounds(): () => void {
  const down = new Set<string>();
  const onDown = (e: KeyboardEvent) => {
    if (e.repeat || down.has(e.code) || !isSoundOn()) return;
    down.add(e.code);
    play(e.code, true);
  };
  const onUp = (e: KeyboardEvent) => {
    if (!down.delete(e.code) || !isSoundOn()) return;
    play(e.code, false);
  };
  const onBlur = () => down.clear();
  window.addEventListener("keydown", onDown, true);
  window.addEventListener("keyup", onUp, true);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onDown, true);
    window.removeEventListener("keyup", onUp, true);
    window.removeEventListener("blur", onBlur);
  };
}
