// One shared AudioContext, created lazily inside a user gesture. Nothing in
// here is ever called without one: browsers block audio otherwise, and the
// spec says nothing plays unasked.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch (err) {
      console.warn("audio: Web Audio unavailable", err);
      return null;
    }
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch((err: unknown) => console.warn("audio: resume blocked", err));
  }
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const length = Math.floor(c.sampleRate * 0.2);
  noise = c.createBuffer(1, length, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** A chunky toggle-switch clack: a filtered noise snap over a short low thunk. */
export function playSwitchClick(pitch = 1) {
  const c = getAudioContext();
  if (!c) return;
  const t = c.currentTime + 0.005;
  const out = c.createGain();
  out.gain.value = 0.32;
  out.connect(c.destination);

  const snap = c.createBufferSource();
  snap.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2600 * pitch;
  band.Q.value = 1.4;
  const snapGain = c.createGain();
  snapGain.gain.setValueAtTime(0.9, t);
  snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  snap.connect(band).connect(snapGain).connect(out);
  snap.start(t);
  snap.stop(t + 0.05);

  const thunk = c.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(190 * pitch, t);
  thunk.frequency.exponentialRampToValueAtTime(70, t + 0.06);
  const thunkGain = c.createGain();
  thunkGain.gain.setValueAtTime(0.5, t);
  thunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  thunk.connect(thunkGain).connect(out);
  thunk.start(t);
  thunk.stop(t + 0.08);
}
