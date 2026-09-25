// Musik und Geraeusche fuer "24 Glaeser", komplett synthetisch.
// Liest dieselbe Zeitleiste wie das Bild und schreibt out/audio.wav (48 kHz, Stereo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './timeline.js';

const { BEAT, bar } = T;
const SR = 48000;
const LEN = Math.ceil((T.DURATION + 0.5) * SR);
const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- Busse
function bus() {
  return { L: new Float32Array(LEN), R: new Float32Array(LEN), sL: new Float32Array(LEN), sR: new Float32Array(LEN) };
}
const MUSIC = bus();
const SFX = bus();

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;

// Schreibt eine Stimme: fn(i, tRel) liefert ein Sample (mono), pan -1..1, send 0..1
function voice(b, t0, dur, fn, { gain = 1, pan = 0, send = 0.25 } = {}) {
  const i0 = Math.max(0, Math.round(t0 * SR));
  const n = Math.min(LEN - i0, Math.round(dur * SR));
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
  for (let k = 0; k < n; k++) {
    const v = fn(k, k / SR);
    const i = i0 + k;
    b.L[i] += v * gl; b.R[i] += v * gr;
    b.sL[i] += v * gl * send; b.sR[i] += v * gr * send;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------------------------------------------------------------- Instrumente
function glock(b, t, midi, vel = 0.5, pan = 0, send = 0.35) {
  const f = mtof(midi);
  const parts = [[1, 1, 1.6], [2.76, 0.35, 0.7], [5.4, 0.16, 0.3], [8.93, 0.06, 0.15]];
  voice(b, t, 3, (k, s) => {
    let v = 0;
    for (const [r, a, d] of parts) v += Math.sin(2 * Math.PI * f * r * s) * a * Math.exp(-s / d);
    return v * Math.min(1, s / 0.002) * 0.22;
  }, { gain: vel, pan, send });
}
function marimba(b, t, midi, vel = 0.4, pan = 0, send = 0.2) {
  const f = mtof(midi);
  voice(b, t, 1.4, (k, s) => {
    const a = Math.min(1, s / 0.003);
    const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.45)
      + 0.22 * Math.sin(2 * Math.PI * f * 3.93 * s) * Math.exp(-s / 0.07)
      + 0.05 * Math.sin(2 * Math.PI * f * 9.2 * s) * Math.exp(-s / 0.025);
    return v * a * 0.3;
  }, { gain: vel, pan, send });
}
// Gezupfter Bass (Karplus-Strong mit Grundton-Unterstuetzung)
function pluck(b, t, midi, dur = 0.5, vel = 0.6, pan = 0) {
  const f = mtof(midi);
  const N = Math.round(SR / f);
  const line = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp = lp * 0.6 + noise() * 0.4; line[i] = lp; }
  let idx = 0, prev = 0;
  const total = dur + 0.25;
  voice(b, t, total, (k, s) => {
    const cur = line[idx];
    const nxt = 0.5 * (cur + prev) * 0.994;
    prev = cur;
    line[idx] = nxt;
    idx = (idx + 1) % N;
    const rel = s > dur ? Math.exp(-(s - dur) / 0.06) : 1;
    const sub = Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.5) * 0.7;
    return (cur * 1.4 + sub) * rel * Math.min(1, s / 0.004) * 0.45;
  }, { gain: vel, pan, send: 0.05 });
}
// Weiche Flaeche: drei verstimmte Saegezaehne je Ton, Tiefpass, langsamer Einsatz
const PAD_GAIN = 0.38;
function pad(b, t0, t1, midis, vel = 0.12, { attack = 0.6, release = 1.2, cutoff = 1800 } = {}) {
  const dur = t1 - t0 + release;
  vel *= PAD_GAIN;
  midis.forEach((m, ni) => {
    const f = mtof(m);
    const det = [-0.0045, 0, 0.0048];
    det.forEach((d, vi) => {
      let ph = rnd(), lp1 = 0, lp2 = 0;
      const inc = (f * (1 + d)) / SR;
      const pan = (vi - 1) * 0.6 + (ni % 2 ? 0.1 : -0.1);
      voice(b, t0, dur, (k, s) => {
        ph += inc; if (ph >= 1) ph -= 1;
        // polyBLEP-Saegezahn
        let v = 2 * ph - 1;
        if (ph < inc) { const x = ph / inc; v -= x + x - x * x - 1; }
        else if (ph > 1 - inc) { const x = (ph - 1) / inc; v -= x * x + x + x + 1; }
        const c = cutoff * (0.75 + 0.25 * Math.sin(s * 0.7 + ni));
        const g = 1 - Math.exp((-2 * Math.PI * c) / SR);
        lp1 += g * (v - lp1); lp2 += g * (lp1 - lp2);
        const e = s < attack ? s / attack : s > t1 - t0 ? Math.exp(-(s - (t1 - t0)) / (release / 3)) : 1;
        return lp2 * e * 0.12;
      }, { gain: vel, pan, send: 0.55 });
    });
  });
}
function kick(b, t, vel = 0.7) {
  voice(b, t, 0.45, (k, s) => {
    const f = 48 + 110 * Math.exp(-s / 0.035);
    const ph = 2 * Math.PI * (48 * s + (110 * 0.035) * (1 - Math.exp(-s / 0.035)));
    return (Math.sin(ph) * Math.exp(-s / 0.18) + noise() * 0.1 * Math.exp(-s / 0.004)) * 0.7;
  }, { gain: vel, send: 0.03 });
}
function snap(b, t, vel = 0.35, pan = 0.15) {
  let bp1 = 0, bp2 = 0;
  voice(b, t, 0.2, (k, s) => {
    const x = noise();
    bp1 += 0.35 * (x - bp1); bp2 += 0.35 * (bp1 - bp2);
    const hp = bp1 - bp2 * 0.9;
    return hp * Math.exp(-s / 0.03) * 1.3 * Math.min(1, s / 0.001);
  }, { gain: vel, pan, send: 0.3 });
}
function shaker(b, t, vel = 0.12, pan = -0.3) {
  let prev = 0;
  voice(b, t, 0.09, (k, s) => {
    const x = noise();
    const hp = x - prev; prev = x;
    return hp * env(s, 0.01, 0.025) * 0.5;
  }, { gain: vel, pan, send: 0.1 });
}
function woodblock(b, t, midi = 84, vel = 0.3, pan = 0) {
  const f = mtof(midi);
  voice(b, t, 0.15, (k, s) => (Math.sin(2 * Math.PI * f * s) + 0.4 * Math.sin(2 * Math.PI * f * 1.52 * s)) * Math.exp(-s / 0.025) * 0.5, { gain: vel, pan, send: 0.2 });
}
// "Plopp" beim Erscheinen eines Glases: kurzer Tonhoehensprung plus Glockenton
function pop(b, t, midi, vel = 0.5, pan = 0) {
  const f = mtof(midi - 12);
  voice(b, t, 0.2, (k, s) => {
    const ff = f * (0.55 + 0.45 * Math.min(1, s / 0.03));
    return Math.sin(2 * Math.PI * ff * s) * Math.exp(-s / 0.05) * 0.5;
  }, { gain: vel, pan, send: 0.15 });
  glock(b, t + 0.005, midi, vel * 0.8, pan);
}
function bubblePop(b, t, vel = 0.35, pan = 0) {
  voice(b, t, 0.08, (k, s) => {
    const f = 700 + 1300 * Math.min(1, s / 0.025);
    return Math.sin(2 * Math.PI * f * s) * Math.exp(-s / 0.018) * 0.6;
  }, { gain: vel, pan, send: 0.2 });
}
function tink(b, t, vel = 0.2, pan = 0) {
  const f = 2400 + rnd() * 1800;
  voice(b, t, 0.4, (k, s) => (Math.sin(2 * Math.PI * f * s) + 0.5 * Math.sin(2 * Math.PI * f * 2.7 * s)) * Math.exp(-s / 0.09) * 0.4, { gain: vel, pan, send: 0.4 });
}
// Gefiltertes Rauschen mit wanderndem Bandpass (Whoosh, Riser, Atmen)
function sweep(b, t, dur, f0, f1, vel = 0.3, { q = 2, pan = 0, send = 0.3, shape = null } = {}) {
  let low = 0, band = 0;
  voice(b, t, dur, (k, s) => {
    const p = s / dur;
    const f = f0 * Math.pow(f1 / f0, p);
    const F = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    const x = noise();
    low += F * band;
    const high = x - low - band / q;
    band += F * high;
    const e = shape ? shape(p) : Math.sin(Math.PI * p);
    return band * e * 0.6;
  }, { gain: vel, pan, send });
}
function thump(b, t, vel = 0.5, f = 90) {
  let lp = 0;
  voice(b, t, 0.3, (k, s) => {
    lp += 0.08 * (noise() - lp);
    return (Math.sin(2 * Math.PI * f * s) * 0.8 + lp * 2) * Math.exp(-s / 0.06);
  }, { gain: vel, send: 0.08 });
}
function paperFlip(b, t, vel = 0.3) {
  sweep(b, t, 0.12, 5000, 1800, vel, { q: 1.2, send: 0.1, shape: (p) => Math.sin(Math.PI * Math.pow(p, 0.5)) });
}
function register(b, t) {
  // Ka-tsching: Mechanik, dann zwei Glocken
  thump(b, t, 0.35, 140);
  sweep(b, t, 0.08, 3000, 6000, 0.25, { q: 1, send: 0.1 });
  for (const [m, dt, v] of [[91, 0.07, 0.5], [96, 0.1, 0.35]]) {
    const f = mtof(m);
    voice(b, t + dt, 2.2, (k, s) => {
      let x = 0;
      for (const [r, a, d] of [[1, 1, 1.2], [2.01, 0.5, 0.6], [3.02, 0.25, 0.35], [4.2, 0.12, 0.2]]) x += Math.sin(2 * Math.PI * f * r * s) * a * Math.exp(-s / d);
      return x * 0.18 * Math.min(1, s / 0.002);
    }, { gain: v, pan: 0.2, send: 0.45 });
  }
}
function sigh(b, t) {
  // Ausatmen: Rauschen durch zwei Formanten, faellt ab
  sweep(b, t, 0.75, 900, 420, 0.5, { q: 3.5, send: 0.2, shape: (p) => Math.sin(Math.PI * Math.pow(p, 0.6)) * (1 - p * 0.3) });
  sweep(b, t, 0.75, 2400, 1300, 0.18, { q: 3, send: 0.2, shape: (p) => Math.sin(Math.PI * Math.pow(p, 0.6)) });
}
function step(b, t, vel = 0.22) {
  let lp = 0;
  voice(b, t, 0.12, (k, s) => { lp += 0.15 * (noise() - lp); return (lp * 2.4 + Math.sin(2 * Math.PI * 110 * s) * 0.4) * Math.exp(-s / 0.03); }, { gain: vel, send: 0.05 });
}
function sparkleRun(b, t, notes, vel = 0.3) {
  notes.forEach((m, i) => glock(b, t + i * 0.035, m, vel * (1 - i * 0.04), (i % 2 ? 0.4 : -0.4), 0.6));
}

// ---------------------------------------------------------------- Harmonie
const Q = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14], m6: [0, 3, 7, 9], sus4: [0, 5, 7], add9: [0, 4, 7, 14] };
const PC = { F: 5, G: 7, A: 9, Bb: 10, C: 0, D: 2, Db: 1, E: 4 };
// [Takt, Grundton, Klangart]
const CHORDS = [
  [0, 'F', 'maj9'], [2, 'F', 'maj'], [3, 'D', 'min'], [4, 'Bb', 'maj'], [5, 'C', 'maj'], [5.5, 'C', 'dom7'],
  [6.5, null], [7, 'Bb', 'm6'], [8, null],
  [9, 'F', 'maj'], [10, 'Bb', 'maj'], [11, 'G', 'm7'], [11.5, 'C', 'maj'], [12, 'F', 'maj'],
  [13, 'D', 'min'], [14, 'Bb', 'maj'], [14.5, 'C', 'maj'],
  [15, 'D', 'min'], [16, 'Bb', 'maj7'], [17, 'F', 'maj'], [17.5, 'C', 'maj'],
  [18, 'Bb', 'maj'], [19, 'C', 'maj'], [20, 'D', 'min'], [20.5, 'C', 'maj'],
  [21, 'Bb', 'maj7'], [22, 'C', 'maj'], [23, 'D', 'm7'], [23.5, 'G', 'm7'], [24, 'C', 'sus4'], [24.25, 'C', 'dom7'],
  [24.5, 'F', 'add9'], [25, 'F', 'maj9'], [28, null],
];
function chordAt(b) {
  let c = null;
  for (const ch of CHORDS) if (ch[0] <= b + 1e-9) c = ch; else break;
  return c && c[1] ? { root: PC[c[1]], q: Q[c[2]], name: c } : null;
}
// Toene eines Akkords in einem Bereich
function voicing(ch, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (ch.q.some((iv) => (ch.root + iv) % 12 === m % 12)) out.push(m);
  return out;
}
const bassNote = (ch) => { let m = 36 + ch.root; if (m < 38) m += 12; return m; };

// ---------------------------------------------------------------- Begleitung pro Abschnitt
// Intensitaet pro Takt: 0 nichts, 1 nur Flaeche, 2 leicht, 3 voll
function groove(b0, b1, level, opts = {}) {
  for (let bb = b0; bb < b1; bb += 0.25) {
    // Viertel-Raster: bb in Takten, Schritt = 1 Schlag
    const t = bar(bb);
    const beat = Math.round((bb % 1) * 4);
    const ch = chordAt(bb);
    if (!ch) continue;
    const bn = bassNote(ch);
    if (level >= 2) {
      // Bass: Grundton auf 1, Quinte auf 2+, Grundton auf 3, Durchgang auf 4+
      if (beat === 0) pluck(MUSIC, t, bn, BEAT * 0.9, 0.55);
      if (beat === 1) pluck(MUSIC, t + BEAT / 2, bn + 7, BEAT * 0.4, 0.4);
      if (beat === 2) pluck(MUSIC, t, bn, BEAT * 0.9, 0.5);
      if (beat === 3) pluck(MUSIC, t + BEAT / 2, bn + (opts.walkUp ? 2 : 12), BEAT * 0.4, 0.35);
      // Marimba auf den Offbeats
      const v = voicing(ch, 62, 74).slice(0, 3);
      v.forEach((m, i) => marimba(MUSIC, t + BEAT / 2 + i * 0.008, m, 0.22 * (opts.soft ? 0.7 : 1), (i - 1) * 0.3));
      // Shaker in Sechzehnteln
      for (let s = 0; s < 4; s++) shaker(MUSIC, t + (s * BEAT) / 4, s % 2 ? 0.06 : 0.12, -0.35);
    }
    if (level >= 3) {
      if (beat === 0 || beat === 2) kick(MUSIC, t, 0.55);
      if (beat === 1 || beat === 3) snap(MUSIC, t, 0.28);
    }
  }
}
function pads(b0, b1, vel, lo = 53, hi = 70) {
  // Flaechen folgen den Akkordwechseln
  const bounds = CHORDS.map((c) => c[0]).filter((x) => x > b0 && x < b1);
  const cuts = [b0, ...bounds, b1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const ch = chordAt(cuts[i]);
    if (!ch) continue;
    pad(MUSIC, bar(cuts[i]), bar(cuts[i + 1]) + 0.05, voicing(ch, lo, hi).slice(0, 5), vel, { attack: 0.35, release: 0.9 });
  }
}

// ---------------------------------------------------------------- Partitur
function score() {
  // --- Intro
  pads(0, 2, 0.9, 53, 72);
  // Glas fuellt sich: Blubbern
  for (let i = 0; i < 9; i++) {
    const t = 0.85 + i * 0.09;
    voice(SFX, t, 0.12, (k, s) => Math.sin(2 * Math.PI * (300 + i * 40) * (1 + s * 6) * s) * Math.exp(-s / 0.03) * 0.5, { gain: 0.35, send: 0.2 });
  }
  const titleNotes = [72, 77, null, 81, 84, 81, 79, 77, 84];
  titleNotes.forEach((m, i) => { if (m) glock(MUSIC, bar(0.5) + i * (BEAT / 4), m, 0.42, (i - 4) * 0.12); });
  marimba(MUSIC, bar(1), 65, 0.3); marimba(MUSIC, bar(1), 69, 0.25); marimba(MUSIC, bar(1), 72, 0.25);
  woodblock(SFX, bar(1.5), 86, 0.2, -0.2); woodblock(SFX, bar(1.5) + BEAT / 2, 91, 0.16, 0.2);
  // Tisch faehrt hoch, Stufen, Glas fliegt ein
  sweep(SFX, 3.85, 0.6, 300, 2200, 0.35, { send: 0.2 });
  thump(SFX, 4.42, 0.55, 80);
  woodblock(SFX, 4.8, 67, 0.3, -0.3); woodblock(SFX, 4.92, 72, 0.3, 0.3);
  sweep(SFX, bar(2) - BEAT * 1.2, BEAT * 1.2, 2500, 700, 0.25, { pan: -0.4 });
  thump(SFX, bar(2), 0.4, 120);

  // --- Tag 1: 24 Pops
  T.POP24.forEach((t, i) => {
    const j = T.JARS24[i];
    pop(SFX, t, T.POP24_NOTES[i], i === 16 ? 0.35 : 0.42, (j.x - 540) / 600);
  });
  pads(2, 6.5, 0.55);
  groove(2, 4, 2);
  groove(4, 5.5, 3);
  // Schritte
  const steps = (t0, t1, v = 0.22) => { for (let k = 1; k <= T.STEPS_PER_WALK; k++) step(SFX, t0 + (k / T.STEPS_PER_WALK) * (t1 - t0) - 0.02, v); };
  steps(...T.CUST24.enter);
  // Karte 60 %
  cardSounds(T.CUST24.card60, 60, false);
  // Blicke: kleine Holzklicks, im Raum verteilt
  T.GAZE24.forEach((g) => woodblock(SFX, g.t, 88 + ((g.jar * 7) % 12), 0.12, (T.JARS24[g.jar].x - 540) / 500));
  // Gedankenblasen
  T.BUBBLES24.forEach((bb) => { bubblePop(SFX, bb.t, 0.3, (bb.x - 540) / 500); glock(MUSIC, bb.t, bb.note, 0.36, (bb.x - 540) / 500); });
  // Kreisende Glaeser
  T.ORBIT.forEach((o) => tink(SFX, o.t, 0.14, Math.cos(o.phase) * 0.8));
  // Ueberforderung: Arpeggio wird schneller und schraeger, Rauschen steigt
  const fz = T.CUST24.freeze;
  groove(5.5, 6.5, 3, { walkUp: true });
  {
    const arp = [60, 64, 67, 70, 72, 76, 79, 82];
    let t = bar(5.5), i = 0;
    while (t < fz) {
      const p = (t - bar(5.5)) / (fz - bar(5.5));
      const detune = p * p * 0.9;
      const m = arp[i % arp.length] + (i % 3 === 2 ? detune : 0) + (p > 0.6 ? ((i * 5) % 3) - 1 : 0);
      marimba(MUSIC, t, m, 0.18 + p * 0.12, ((i % 4) - 1.5) * 0.4);
      t += p < 0.4 ? BEAT / 4 : p < 0.75 ? BEAT / 6 : BEAT / 8;
      i++;
    }
    for (let k = 0; k < 16; k++) snap(MUSIC, bar(6) + k * (BEAT / 8), 0.08 + k * 0.012, ((k % 2) - 0.5) * 0.6);
    kick(MUSIC, bar(6) + BEAT, 0.6); kick(MUSIC, bar(6) + BEAT * 1.5, 0.6);
  }
  sweep(MUSIC, bar(5.5), fz - bar(5.5), 400, 7000, 0.3, { q: 3, send: 0.4, shape: (p) => Math.pow(p, 1.8) });
  // Stille, dann Ausatmen
  sigh(SFX, fz + 0.35);
  // Geht weg
  steps(...T.CUST24.leave, 0.18);
  bubblePop(SFX, T.LEAVE_BUBBLE.t, 0.25, 0.2);
  glock(MUSIC, T.LEAVE_BUBBLE.t, 77, 0.3, 0.2);
  pads(7, 8, 0.6, 50, 68);
  [[bar(7) + BEAT, 77], [bar(7) + BEAT * 1.5, 75], [bar(7) + BEAT * 2, 73], [bar(7) + BEAT * 3, 72]].forEach(([t, m]) => glock(MUSIC, t, m, 0.3, 0));
  cardSounds(T.CUST24.card3, 3, true);
  marimba(MUSIC, T.CUST24.card3, 46, 0.5); marimba(MUSIC, T.CUST24.card3, 53, 0.3);

  // --- Zurueckspulen: Knopfdruck
  woodblock(SFX, T.REWIND.t0, 60, 0.4, 0);
  thump(SFX, T.REWIND.t0, 0.3, 200);

  // --- Tag 2
  woodblock(SFX, bar(9) - 0.05, 69, 0.3, 0);
  T.POP6.forEach((t, i) => pop(SFX, t, T.POP6_NOTES[i], 0.42, (T.JARS6[i].x - 540) / 600));
  pads(9, 13, 0.5);
  groove(9, 10, 2, { soft: true });
  groove(10, 13, 2);
  steps(...T.CUST6.enter, 0.2);
  cardSounds(T.CUST6.card40, 40, false);
  T.CUST6.gazes.forEach((g) => woodblock(SFX, g.t, 84, 0.12, (T.JARS6[g.jar].x - 540) / 500));
  bubblePop(SFX, T.CUST6.bubble, 0.3, 0.4);
  glock(MUSIC, T.CUST6.bubble, 84, 0.35, 0.3); glock(MUSIC, T.CUST6.bubble + BEAT / 2, 89, 0.35, 0.3);
  sweep(SFX, T.CUST6.lift[0], T.CUST6.lift[1] - T.CUST6.lift[0], 600, 2400, 0.18, { pan: 0.1 });
  register(SFX, T.CUST6.ding);
  cardSounds(T.CUST6.card30, 30, false);
  sparkleRun(MUSIC, T.CUST6.card30 + 0.1, [77, 81, 84, 89], 0.22);

  // --- Diagramm
  const ch = T.CHART;
  sweep(SFX, ch.fly[0], 0.7, 1800, 250, 0.3, { send: 0.2 });
  thump(SFX, ch.dropLeft + 0.17, 0.45, 100);
  // Leerlaufen: Gluckern abwaerts
  for (let i = 0; i < 5; i++) {
    const t = ch.fly[1] + i * 0.07;
    voice(SFX, t, 0.1, (k, s) => Math.sin(2 * Math.PI * (520 - i * 60) * (1 - s * 3) * s) * Math.exp(-s / 0.03) * 0.5, { gain: 0.3, pan: 0.4, send: 0.2 });
  }
  // Fuellen: steigendes Blubbern, rechts laenger als links
  for (const [pan, n, top] of [[-0.45, 3, 0.15], [0.45, 14, 1]]) {
    for (let i = 0; i < n; i++) {
      const t = ch.fill[0] + (i / 14) * (ch.fill[1] - ch.fill[0]) * 0.9;
      voice(SFX, t, 0.1, (k, s) => Math.sin(2 * Math.PI * (260 + i * 35 * top + 30) * (1 + s * 8) * s) * Math.exp(-s / 0.025) * 0.5, { gain: 0.28, pan, send: 0.25 });
    }
  }
  countTicks(ch.fill[0], ch.fill[1] - ch.fill[0], 30, 0.45);
  countTicks(ch.fill[0], ch.fill[1] - ch.fill[0], 3, -0.45);
  pads(13, 15, 0.45);
  groove(13, 15, 2, { soft: true });
  // Zehnmal: Akkordschlag
  [65, 69, 72, 77].forEach((m, i) => marimba(MUSIC, ch.caption + i * 0.01, m, 0.35, (i - 1.5) * 0.3));
  glock(MUSIC, ch.caption, 84, 0.4); glock(MUSIC, ch.caption + BEAT / 2, 89, 0.35);
  pop(SFX, ch.out[0] + 0.1, 72, 0.25, -0.4); pop(SFX, ch.out[0] + 0.2, 67, 0.25, 0.4);

  // --- Meta-Analyse 2010: sparsam, Tropfen machen die Musik
  pads(15, 18, 0.6, 50, 69);
  for (let bb = 15; bb < 18; bb += 0.25) {
    const c = chordAt(bb);
    if (c) pluck(MUSIC, bar(bb), bassNote(c), BEAT * 0.6, 0.3);
  }
  marimba(MUSIC, bar(15) + BEAT * 0.75, 50, 0.4); marimba(MUSIC, bar(15) + BEAT * 0.75, 62, 0.3);
  sweep(SFX, T.META.axis[0], T.META.axis[1] - T.META.axis[0], 500, 3000, 0.22, { q: 4 });
  for (const d of T.DOTS) {
    const pan = (d.x - 540) / 480;
    if (d.jam) { thump(SFX, d.t, 0.4, 110); glock(MUSIC, d.t, 84, 0.5, pan); }
    else glock(MUSIC, d.t, d.note, 0.2, pan, 0.45);
  }
  // Mittelwert: tiefer Ton, Flaeche schwillt
  voice(MUSIC, T.META.mean, 2.5, (k, s) => Math.sin(2 * Math.PI * 73.4 * s) * Math.min(1, s / 0.08) * Math.exp(-s / 0.9) * 0.6, { gain: 0.3, send: 0.1 });
  glock(MUSIC, T.META.mean + 0.2, 74, 0.4); glock(MUSIC, T.META.mean + 0.2 + BEAT / 2, 69, 0.35);
  // Punkte steigen auf
  for (let i = 0; i < 12; i++) voice(SFX, T.META.out[0] + i * 0.07, 0.1, (k, s) => Math.sin(2 * Math.PI * (500 + i * 70) * (1 + s * 5) * s) * Math.exp(-s / 0.03) * 0.4, { gain: 0.18, pan: ((i % 5) - 2) * 0.3, send: 0.3 });

  // --- 2015: vier Bedingungen
  pads(18, 21, 0.45);
  groove(18, 19, 2, { soft: true });
  groove(19, 21, 3);
  T.MODER.items.forEach((t, i) => {
    pop(SFX, t, [69, 72, 77, 81][i], 0.4, -0.5);
    [0, 4, 7].forEach((iv, k) => marimba(MUSIC, t + k * 0.012, [65, 67, 69, 72][i] + iv, 0.2, (k - 1) * 0.3));
  });
  sweep(SFX, T.MODER.out[0], 0.6, 2500, 600, 0.2, { pan: -0.5 });

  // --- Zwei
  const tw = T.TWO;
  pads(21, 25, 0.55);
  glock(MUSIC, tw.line1, 72, 0.3); glock(MUSIC, tw.line1 + BEAT, 77, 0.3);
  sweep(SFX, tw.stand - 0.1, 0.6, 300, 2000, 0.3, { send: 0.2 });
  thump(SFX, tw.stand + 0.45, 0.5, 80);
  // das Motiv "zwei": Quarte aufwaerts
  pop(SFX, tw.pops[0], 72, 0.45, -0.35); pop(SFX, tw.pops[1], 77, 0.45, 0.35);
  groove(21.5, 22.5, 2, { soft: true });
  groove(22.5, 24.5, 2);
  steps(...tw.enter, 0.2);
  tw.gazes.forEach((g) => woodblock(SFX, g.t, 84, 0.13, (T.JARS2[g.jar].x - 540) / 400));
  [[tw.line2, 72], [tw.line2 + BEAT, 77], [tw.line2 + BEAT * 2, 81], [tw.line2 + BEAT * 3, 79]].forEach(([t, m]) => glock(MUSIC, t, m, 0.3));
  bubblePop(SFX, tw.bubble, 0.3, -0.4);
  glock(MUSIC, tw.bubble, 84, 0.36, -0.3);
  sweep(SFX, tw.lift[0], tw.lift[1] - tw.lift[0], 600, 2400, 0.18, { pan: -0.1 });
  // Aufloesung auf F, Funkeln
  sparkleRun(MUSIC, tw.sparkle, [77, 81, 84, 88, 89, 93, 96], 0.25);
  kick(MUSIC, tw.sparkle, 0.5);
  pluck(MUSIC, tw.sparkle, 41, BEAT * 3, 0.55);
  [65, 69, 72, 76, 79].forEach((m, i) => marimba(MUSIC, tw.sparkle + i * 0.02, m, 0.25, (i - 2) * 0.25));
  for (let s = 0; s < 8; s++) shaker(MUSIC, tw.sparkle + BEAT * 0.5 + (s * BEAT) / 4, 0.08);

  // --- Abspann
  sweep(SFX, T.END.iris[0], T.END.iris[1] - T.END.iris[0], 3000, 400, 0.25, { send: 0.3 });
  pads(25, 27.3, 0.7, 53, 76);
  pluck(MUSIC, T.END.title, 41, 2.5, 0.5);
  glock(MUSIC, T.END.title, 72, 0.45); glock(MUSIC, T.END.title + BEAT, 77, 0.5);
  glock(MUSIC, T.END.l2, 81, 0.3, -0.2); glock(MUSIC, T.END.l2 + BEAT / 2, 84, 0.3, 0.2);
  [65, 72, 76, 79, 81].forEach((m, i) => marimba(MUSIC, T.END.title + i * 0.03, m, 0.2, (i - 2) * 0.3));
}
function cardSounds(t0, N, swap) {
  if (swap) paperFlip(SFX, t0 - 0.1, 0.35);
  paperFlip(SFX, t0, 0.3);
  if (!swap) thump(SFX, t0 + 0.1, 0.2, 160);
  countTicks(t0 + 0.05, 0.65, N, 0);
}
// Zaehlwerk: kleine Klicks, wenn die Zahl springt
function countTicks(t0, dur, N, pan) {
  const stepN = Math.max(1, Math.ceil(N / 10));
  for (let v = stepN; v <= N; v += stepN) {
    const e = v / N;
    const p = 1 - Math.cbrt(1 - Math.min(0.999, e - 1e-6));
    woodblock(SFX, t0 + p * dur, 96 + (v / N) * 5, 0.07, pan);
  }
}

// ---------------------------------------------------------------- Effekte
// Freeverb (Schroeder/Moorer), fuer 48 kHz skaliert
function reverb(inL, inR, { room = 0.86, damp = 0.28, wet = 1 } = {}) {
  const sc = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * sc));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * sc));
  const outL = new Float32Array(LEN), outR = new Float32Array(LEN);
  for (const [inp, out, spread] of [[inL, outL, 0], [inR, outR, Math.round(23 * sc)]]) {
    const combs = combT.map((n) => ({ buf: new Float32Array(n + spread), i: 0, store: 0 }));
    const aps = apT.map((n) => ({ buf: new Float32Array(n + spread), i: 0 }));
    for (let k = 0; k < LEN; k++) {
      const x = inp[k] * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        s += y;
      }
      for (const a of aps) {
        const y = a.buf[a.i];
        a.buf[a.i] = s + y * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        s = y - s;
      }
      out[k] = s * wet;
    }
  }
  return [outL, outR];
}
function mixdown(b, wet) {
  const [rL, rR] = reverb(b.sL, b.sR);
  const L = new Float32Array(LEN), R = new Float32Array(LEN);
  for (let k = 0; k < LEN; k++) { L[k] = b.L[k] + rL[k] * wet; R[k] = b.R[k] + rR[k] * wet; }
  return [L, R];
}
// Liest ein Signal an einer Fliesskomma-Position
const at = (buf, pos) => { const i = Math.floor(pos); const f = pos - i; if (i < 0 || i + 1 >= LEN) return 0; return buf[i] * (1 - f) + buf[i + 1] * f; };

// ---------------------------------------------------------------- Rendern
console.time('Partitur');
score();
console.timeEnd('Partitur');
console.time('Hall');
const [mL, mR] = mixdown(MUSIC, 1.0);
const [sL, sR] = mixdown(SFX, 0.9);
console.timeEnd('Hall');

// Bandstopp beim Einfrieren: Musik laeuft aus wie ein angehaltenes Tonband, dann Stille
{
  const fz = T.CUST24.freeze;
  const stopDur = 0.32;
  const i0 = Math.round(fz * SR);
  const n = Math.round(stopDur * SR);
  const srcL = mL.slice(i0, i0 + n), srcR = mR.slice(i0, i0 + n);
  let pos = 0;
  for (let k = 0; k < n; k++) {
    const p = k / n;
    const speed = Math.pow(1 - p, 2);
    const g = 1 - p;
    mL[i0 + k] = at(srcL, pos) * g; mR[i0 + k] = at(srcR, pos) * g;
    pos += speed;
  }
  const end = Math.round((bar(7) - 0.02) * SR);
  for (let k = i0 + n; k < end; k++) { mL[k] = 0; mR[k] = 0; }
}
const L = new Float32Array(LEN), R = new Float32Array(LEN);
for (let k = 0; k < LEN; k++) { L[k] = mL[k] + sL[k] * 1.05; R[k] = mR[k] + sR[k] * 1.05; }

// Zurueckspulen: dieselbe Zeitkurve wie das Bild, der Ton laeuft rueckwaerts und schnell
{
  const i0 = Math.round(T.REWIND.t0 * SR), i1 = Math.round(T.REWIND.t1 * SR), i2 = Math.round(bar(9) * SR) - 1200;
  const srcL = L.slice(), srcR = R.slice();
  let lpL = 0, lpR = 0;
  const g = 1 - Math.exp((-2 * Math.PI * 3800) / SR);
  for (let k = i0; k < i2; k++) {
    const t = k / SR;
    if (k < i1) {
      const wow = 1 + 0.004 * Math.sin(t * 2 * Math.PI * 7);
      const pos = T.rewindMap(t) * SR * wow;
      const p = (k - i0) / (i1 - i0);
      const fadeIn = Math.min(1, p / 0.05), fadeOut = Math.min(1, (1 - p) / 0.04);
      lpL += g * (at(srcL, pos) - lpL); lpR += g * (at(srcR, pos) - lpR);
      const hiss = noise() * 0.012;
      L[k] = (lpL * 0.75 + hiss) * fadeIn * fadeOut + (k < i0 + 2400 ? srcL[k] * (1 - fadeIn) : 0);
      R[k] = (lpR * 0.75 + hiss) * fadeIn * fadeOut + (k < i0 + 2400 ? srcR[k] * (1 - fadeIn) : 0);
    } else {
      L[k] = srcL[k] * 0; R[k] = srcR[k] * 0;
    }
  }
  // Klack am Ende des Spulens
  const b = bus();
  thump(b, T.REWIND.t1, 0.5, 150);
  woodblock(b, T.REWIND.t1, 62, 0.3);
  for (let k = 0; k < LEN; k++) { L[k] += b.L[k]; R[k] += b.R[k]; }
}

// Master: Hochpass, Normalisierung, weiche Kompression, Sanft-Clipping, Ein- und Ausblenden
{
  let hpL = 0, hpR = 0, pxL = 0, pxR = 0;
  const a = Math.exp((-2 * Math.PI * 28) / SR);
  for (let k = 0; k < LEN; k++) {
    hpL = a * (hpL + L[k] - pxL); pxL = L[k]; L[k] = hpL;
    hpR = a * (hpR + R[k] - pxR); pxR = R[k]; R[k] = hpR;
  }
  const peakOf = () => { let p = 0; for (let k = 0; k < LEN; k++) p = Math.max(p, Math.abs(L[k]), Math.abs(R[k])); return p; };
  let g0 = 1 / peakOf();
  let envv = 0;
  const att = Math.exp(-1 / (0.004 * SR)), rel = Math.exp(-1 / (0.15 * SR));
  const thr = 0.38, ratio = 2.5;
  for (let k = 0; k < LEN; k++) {
    const l = L[k] * g0, r = R[k] * g0;
    const lvl = Math.max(Math.abs(l), Math.abs(r));
    envv = lvl > envv ? att * envv + (1 - att) * lvl : rel * envv + (1 - rel) * lvl;
    const gain = envv > thr ? Math.pow(envv / thr, 1 / ratio - 1) : 1;
    L[k] = Math.tanh(l * gain * 1.7); R[k] = Math.tanh(r * gain * 1.7);
  }
  const norm = 0.89 / peakOf(); // etwa -1 dBFS
  const fadeOut0 = T.END.fade[0], fadeOut1 = T.DURATION;
  for (let k = 0; k < LEN; k++) {
    const t = k / SR;
    const f = Math.min(1, t / 0.02) * (t > fadeOut0 ? Math.max(0, 1 - (t - fadeOut0) / (fadeOut1 - fadeOut0)) : 1);
    L[k] *= norm * f; R[k] *= norm * f;
  }
  let sum = 0;
  for (let k = 0; k < LEN; k++) sum += L[k] * L[k] + R[k] * R[k];
  console.log(`Pegel: RMS ${(10 * Math.log10(sum / (2 * LEN))).toFixed(1)} dBFS`);
}

// WAV schreiben (16 bit, mit Dither)
{
  const n = Math.round(T.DURATION * SR);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let k = 0; k < n; k++) {
    const d = (rnd() - rnd()) / 32768;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((L[k] + d) * 32767))), 44 + k * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((R[k] + d) * 32767))), 46 + k * 4);
  }
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'audio.wav'), buf);
  console.log('out/audio.wav geschrieben');
}
