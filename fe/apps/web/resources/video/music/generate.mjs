#!/usr/bin/env node
// Synthesises the NIVO music beds from scratch (no samples, no third-party material), so they are CC0 by construction.
//   node resources/video/music/generate.mjs <outDir>      -> <outDir>/<id>.wav (44.1 kHz stereo, 96 s)
// then encode: ffmpeg -i <id>.wav -c:a libmp3lame -b:a 112k engine/assets/video/music/<id>.mp3
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SR = 44100;
const SECONDS = 96;
const N = SR * SECONDS;
const out = process.argv[2] ?? "./music-out";
mkdirSync(out, { recursive: true });

let seed = 20261006;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;
const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
const saw = (p) => 2 * (p - Math.floor(p + 0.5));

const makeBuf = () => ({ l: new Float32Array(N), r: new Float32Array(N) });

/** Add one note. shape(phase)->sample, env(t,len)->0..1 */
const note = (b, start, len, f, amp, shape, env, pan = 0, detune = 0) => {
  const s0 = Math.floor(start * SR);
  const n = Math.floor(len * SR);
  const gl = amp * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = amp * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const t = i / SR;
    const v = (shape(f * t) + (detune ? shape(f * (1 + detune) * t) : 0)) * env(t, len) * (detune ? 0.5 : 1);
    b.l[s0 + i] += v * gl;
    b.r[s0 + i] += v * gr;
  }
};
const sine = (p) => Math.sin(TAU * p);
const pluckEnv = (decay) => (t) => Math.min(1, t * 400) * Math.exp(-t * decay);
const padEnv = (t, len) => Math.min(1, t / 0.35) * Math.min(1, Math.max(0, (len - t) / 0.5));
const bassEnv = (t, len) => Math.min(1, t * 80) * Math.exp(-t * 2.2) * Math.min(1, Math.max(0, (len - t) / 0.05));

const kick = (b, start, amp = 0.8) => {
  const s0 = Math.floor(start * SR);
  const n = Math.floor(0.28 * SR);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const t = i / SR;
    ph += (55 + 120 * Math.exp(-t * 28)) / SR;
    const v = Math.sin(TAU * ph) * Math.exp(-t * 11) * amp;
    b.l[s0 + i] += v;
    b.r[s0 + i] += v;
  }
};
const noiseHit = (b, start, len, amp, decay, hp = 0.6, pan = 0) => {
  const s0 = Math.floor(start * SR);
  const n = Math.floor(len * SR);
  let prev = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const w = rnd() * 2 - 1;
    const hf = w - prev * hp; // crude high-pass: brighter than raw noise
    prev = w;
    const v = hf * Math.exp(-(i / SR) * decay) * amp;
    b.l[s0 + i] += v * (1 - pan * 0.5);
    b.r[s0 + i] += v * (1 + pan * 0.5);
  }
};

/** Feedback echo for space, then peak-normalise to about -3 dBFS. */
const finish = (b, echoSec, feedback, wet) => {
  const d = Math.floor(echoSec * SR);
  for (let i = d; i < N; i++) {
    b.l[i] += b.r[i - d] * feedback * wet;
    b.r[i] += b.l[i - d] * feedback * wet;
  }
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(b.l[i]), Math.abs(b.r[i]));
  const g = 0.7 / peak;
  const fade = SR * 2;
  for (let i = 0; i < N; i++) {
    const f = Math.min(1, i / (SR * 0.05), (N - i) / fade);
    b.l[i] *= g * f;
    b.r[i] *= g * f;
  }
};

const writeWav = (file, b) => {
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(b.l[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(b.r[i] * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
};

// chords as MIDI note lists (root first)
const C = [48, 52, 55], G = [43, 47, 50], Am = [45, 48, 52], F = [41, 45, 48];
const Cmaj7 = [48, 52, 55, 59], Am7 = [45, 48, 52, 55], Fmaj7 = [41, 45, 48, 52], G6 = [43, 47, 50, 52];
const AmB = [45, 48, 52], FB = [41, 45, 48], CB = [48, 52, 55], GB = [43, 47, 50];

/* sunny-pop: 112 bpm, bright and bouncy */
{
  const b = makeBuf();
  const beat = 60 / 112;
  const prog = [C, G, Am, F];
  for (let bar = 0; bar * 4 * beat < SECONDS; bar++) {
    const t0 = bar * 4 * beat;
    const ch = prog[bar % 4];
    for (const m of ch) note(b, t0, 4 * beat, hz(m + 12), 0.07, tri, padEnv, 0, 0.004);
    note(b, t0, beat * 0.95, hz(ch[0] - 12), 0.34, sine, bassEnv);
    note(b, t0 + 2 * beat, beat * 0.95, hz(ch[0] - 12), 0.3, sine, bassEnv);
    note(b, t0 + 3 * beat, beat * 0.45, hz(ch[0]), 0.2, sine, bassEnv);
    const arp = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24];
    for (let e = 0; e < 8; e++) note(b, t0 + e * beat * 0.5, beat * 0.5, hz(arp[e % 4]), 0.1, tri, pluckEnv(9), e % 2 ? 0.35 : -0.35);
    for (let q = 0; q < 4; q++) kick(b, t0 + q * beat, q % 2 === 0 ? 0.55 : 0.4);
    for (let e = 0; e < 4; e++) noiseHit(b, t0 + e * beat + beat * 0.5, 0.06, 0.07, 60, 0.7, 0.4);
    noiseHit(b, t0 + beat, 0.16, 0.12, 22, 0.3);
    noiseHit(b, t0 + 3 * beat, 0.16, 0.12, 22, 0.3);
  }
  finish(b, 0.27, 0.5, 0.35);
  writeWav(join(out, "sunny-pop.wav"), b);
}

/* calm-glow: 72 bpm, soft pads and bell tones, no drums */
{
  const b = makeBuf();
  const beat = 60 / 72;
  const prog = [Cmaj7, Am7, Fmaj7, G6];
  const pent = [72, 74, 76, 79, 81, 84];
  for (let bar = 0; bar * 4 * beat < SECONDS; bar += 2) {
    const t0 = bar * 4 * beat;
    const ch = prog[(bar / 2) % 4];
    for (const m of ch) note(b, t0, 8 * beat, hz(m + 12), 0.08, sine, padEnv, (m % 3) - 1 > 0 ? 0.4 : -0.4, 0.003);
    note(b, t0, 8 * beat, hz(ch[0] - 12), 0.22, sine, (t, len) => Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (len - t) / 0.8)));
    for (let k = 0; k < 6; k++) {
      const at = t0 + (k * 1.25 + (rnd() * 0.5)) * beat;
      note(b, at, 2.2, hz(pent[Math.floor(rnd() * pent.length)] + (k % 3 === 0 ? 0 : 0)), 0.09, sine, pluckEnv(2.6), rnd() * 1.4 - 0.7);
    }
    for (let e = 0; e < 16; e++) noiseHit(b, t0 + e * 0.5 * beat, 0.05, 0.025, 70, 0.8, e % 2 ? 0.5 : -0.5);
  }
  finish(b, 0.42, 0.55, 0.5);
  writeWav(join(out, "calm-glow.wav"), b);
}

/* bold-beat: 124 bpm, four on the floor with a pumping bass */
{
  const b = makeBuf();
  const beat = 60 / 124;
  const prog = [AmB, FB, CB, GB];
  for (let bar = 0; bar * 4 * beat < SECONDS; bar++) {
    const t0 = bar * 4 * beat;
    const ch = prog[bar % 4];
    for (let q = 0; q < 4; q++) kick(b, t0 + q * beat, 0.85);
    for (let e = 0; e < 8; e++) note(b, t0 + e * beat * 0.5, beat * 0.42, hz(ch[0] - 12), 0.17, (p) => saw(p) * 0.6 + sine(p) * 0.6, bassEnv);
    for (const m of ch) note(b, t0 + (bar % 2 ? 0.75 : 0) * beat, beat * 0.55, hz(m + 12), 0.06, saw, pluckEnv(7), m % 2 ? 0.3 : -0.3);
    for (const m of ch) note(b, t0 + 2.5 * beat, beat * 0.4, hz(m + 12), 0.05, saw, pluckEnv(9), m % 2 ? 0.3 : -0.3);
    noiseHit(b, t0 + beat, 0.2, 0.2, 18, 0.2);
    noiseHit(b, t0 + 3 * beat, 0.2, 0.2, 18, 0.2);
    for (let s = 0; s < 16; s++) noiseHit(b, t0 + s * beat * 0.25, 0.03, s % 4 === 2 ? 0.08 : 0.035, 90, 0.8, s % 2 ? 0.3 : -0.3);
  }
  finish(b, 0.24, 0.4, 0.25);
  writeWav(join(out, "bold-beat.wav"), b);
}
console.log(`wrote 3 wav files to ${out}`);
