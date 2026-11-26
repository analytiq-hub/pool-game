// Tiny synthesized sound effects (no audio files): ball clicks, cushion thuds, pocket drops.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function soundEnabled(): boolean {
  return enabled;
}

/** Must be called from a user gesture so the browser allows audio. */
export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function burst(freq: number, q: number, duration: number, volume: number, type: BiquadFilterType = 'bandpass'): void {
  if (!enabled || !ctx || !noise || volume <= 0.001) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(Math.min(1, volume), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t, Math.random() * 0.2, duration);
}

function tone(freq: number, duration: number, volume: number): void {
  if (!enabled || !ctx || volume <= 0.001) return;
  const osc = ctx.createOscillator();
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(Math.min(1, volume), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export function playBallClick(speed: number): void {
  const v = Math.min(1, speed / 1.5);
  burst(3200, 6, 0.04, v * 0.9);
  tone(2400 + Math.random() * 400, 0.03, v * 0.15);
}

export function playCushion(speed: number): void {
  burst(260, 1.2, 0.08, Math.min(1, speed / 1.5) * 0.7, 'lowpass');
}

export function playPocket(): void {
  burst(180, 1, 0.18, 0.6, 'lowpass');
  setTimeout(() => burst(500, 3, 0.06, 0.35), 90);
}

export function playCueHit(power: number): void {
  burst(1400, 2, 0.05, 0.25 + power * 0.6);
}
