// Gemeinsame Zeitleiste fuer Bild (film.html) und Ton (audio.mjs).
// Alles, was im Film passiert, steht hier als Zeitpunkt im Takt.
// Bild und Ton lesen dieselben Werte, deshalb sitzt jeder Klang auf seinem Frame.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const BPM = 96;
export const BEAT = 60 / BPM; // 0.625 s
export const BAR = 4 * BEAT; // 2.5 s
export const bar = (b) => b * BAR;
export const DURATION = bar(28); // 70 s

// Szenen in Takten
export const SC = {
  intro: [0, 2],
  jars24: [2, 4],
  cust24: [4, 8],
  rewind: [8, 9],
  jars6: [9, 10],
  cust6: [10, 13],
  chart: [13, 15],
  meta: [15, 18],
  moder: [18, 21],
  two: [21, 25],
  end: [25, 28],
};

// Deterministischer Zufall (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sorten: Name, Marmeladenfarbe, Farbe des Stoffdeckels
export const FLAVORS = [
  { name: 'Erdbeere', jam: '#c8283a', lid: '#c8283a' },
  { name: 'Aprikose', jam: '#e8913a', lid: '#d9822b' },
  { name: 'Kirsche', jam: '#8e1b2c', lid: '#b3263a' },
  { name: 'Heidelbeere', jam: '#3b2e6b', lid: '#4a5aa8' },
  { name: 'Pflaume', jam: '#5c2446', lid: '#7b3a6b' },
  { name: 'Orange', jam: '#e77b25', lid: '#e2a12c' },
  { name: 'Himbeere', jam: '#c7305a', lid: '#d14d74' },
  { name: 'Pfirsich', jam: '#f0a66b', lid: '#e98f5a' },
  { name: 'Mirabelle', jam: '#e6b93a', lid: '#c9a12a' },
  { name: 'Quitte', jam: '#d9a441', lid: '#8aa83a' },
  { name: 'Blutorange', jam: '#c9442b', lid: '#e07a2f' },
  { name: 'Zitrone', jam: '#e9c84a', lid: '#e3b92e' },
  { name: 'Kiwi', jam: '#86a83a', lid: '#5f8f35' },
  { name: 'Stachelbeere', jam: '#9db65a', lid: '#6f9a45' },
  { name: 'Brombeere', jam: '#4a1f3d', lid: '#5e3a7a' },
  { name: 'Cassis', jam: '#3d1633', lid: '#6b2f5e' },
  { name: 'Feige', jam: '#7a3a4f', lid: '#8a5a3a' },
  { name: 'Holunder', jam: '#452446', lid: '#5b4b8a' },
  { name: 'Rhabarber', jam: '#d65a75', lid: '#7fa24a' },
  { name: 'Hagebutte', jam: '#c0452f', lid: '#b8612e' },
  { name: 'Preiselbeere', jam: '#a61e35', lid: '#c03a4a' },
  { name: 'Mango', jam: '#f2a41f', lid: '#e98a1f' },
  { name: 'Maracuja', jam: '#e8a93a', lid: '#8b5fa8' },
  { name: 'Birne', jam: '#c8b460', lid: '#98a84a' },
];

// ---------- Tag 1: 24 Glaeser auf drei Stufen ----------
export const TIER_Y = [1050, 1190, 1330]; // Unterkante der Glaeser: hinten, Mitte, vorne
export const J24 = { w: 100, h: 124 };
export const JARS24 = [];
{
  // Reihenfolge der Sorten auf dem Stand (gemischt, damit Farben sich abwechseln)
  const order = [0, 14, 5, 20, 12, 4, 21, 3, 9, 6, 17, 11, 2, 23, 15, 8, 18, 1, 13, 16, 10, 22, 19, 7];
  let k = 0;
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 8; c++) {
      const r = rng(1000 + k);
      JARS24.push({
        row,
        col: c,
        x: 540 + (c - 3.5) * 112,
        y: TIER_Y[row],
        flavor: order[k],
        labelRot: (r() - 0.5) * 0.12,
        fill: 0.72 + r() * 0.12,
      });
      k++;
    }
  }
}
// Einblenden: vorne links beginnend, schlangenfoermig nach hinten, auf Achteltriolen
export const POP24 = new Array(24);
{
  let n = 0;
  for (let row = 2; row >= 0; row--) {
    const cols = (2 - row) % 2 === 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    for (const c of cols) {
      POP24[row * 8 + c] = bar(2) + n * (BEAT / 3);
      n++;
    }
  }
}
// Tonhoehen der 24 Pops (MIDI), Arpeggio F-Dur dann d-Moll, auf und ab
export const POP24_NOTES = [
  65, 69, 72, 77, 81, 84, 89, 84, 81, 77, 72, 69,
  62, 65, 69, 74, 77, 81, 86, 81, 77, 74, 69, 65,
];

// ---------- Kundschaft Tag 1 ----------
export const CUST24 = {
  enter: [bar(4), bar(4) + 3 * BEAT],
  card60: bar(4) + 2 * BEAT,
  lookStart: bar(5),
  orbitStart: bar(5.5),
  freeze: bar(6.5),
  leave: [bar(7), bar(7) + 3 * BEAT],
  card3: bar(7) + 2 * BEAT,
};
// Blicke: Achtel, ab Takt 6 Sechzehntel
export const GAZE24 = [];
{
  const r = rng(77);
  let t = bar(5);
  let last = -1;
  while (t < CUST24.freeze - 1e-6) {
    let j;
    do { j = Math.floor(r() * 24); } while (j === last);
    last = j;
    GAZE24.push({ t, jar: j });
    t += t < bar(6) ? BEAT / 2 : BEAT / 4;
  }
}
// Gedankenblasen
export const BUBBLES24 = [];
{
  const texts = [
    'Feige?', 'Oder Kiwi?', 'Was ist Quitte?', 'Cassis??', 'Holunder...', 'Mango?',
    'Rhabarber!', 'Brombeere?', 'Oder doch Kirsche?', 'Alle?', 'Hilfe.',
  ];
  const times = [
    bar(5) + BEAT, bar(5) + 2 * BEAT, bar(5) + 3 * BEAT, // Viertel
    bar(5) + 3.5 * BEAT, bar(6), bar(6) + 0.5 * BEAT, bar(6) + BEAT, // Achtel
    bar(6) + 1.25 * BEAT, bar(6) + 1.5 * BEAT, bar(6) + 1.75 * BEAT, // Sechzehntel
    bar(6) + 1.875 * BEAT, // Zweiunddreissigstel
  ];
  const r = rng(4242);
  // Positionen um den Kopf, abwechselnd links/rechts, aufsteigend
  for (let i = 0; i < texts.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    BUBBLES24.push({
      t: times[i],
      text: texts[i],
      x: 540 + side * (170 + r() * 150),
      y: 470 + r() * 330,
      rot: (r() - 0.5) * 0.25,
      note: 0,
    });
  }
  // Tonhoehen: erst Akkordtoene, dann immer schraeger
  const last = BUBBLES24[BUBBLES24.length - 1];
  Object.assign(last, { x: 540, y: 500, rot: -0.03, size: 64 });
  const notes = [72, 76, 79, 84, 77, 78, 73, 80, 75, 82, 71];
  BUBBLES24.forEach((b, i) => {
    b.note = notes[i];
  });
}
// Kreisende Glaeser im Kopfkino
export const ORBIT = [];
{
  const r = rng(99);
  const times = [];
  for (let i = 0; i < 4; i++) times.push(bar(5.5) + i * (BEAT / 2));
  for (let i = 0; i < 8; i++) times.push(bar(6) + i * (BEAT / 4));
  for (let i = 0; i < 6; i++) times.push(bar(6) + BEAT + i * (BEAT / 8));
  times.forEach((t, i) => {
    ORBIT.push({
      t: Math.min(t, CUST24.freeze - 0.01),
      flavor: Math.floor(r() * 24),
      rx: 230 + r() * 250,
      ry: 120 + r() * 140,
      speed: (0.9 + r() * 1.3) * (r() < 0.5 ? -1 : 1),
      phase: r() * Math.PI * 2,
      scale: 0.55 + r() * 0.35,
      cy: 700 + r() * 260,
    });
  });
}
export const LEAVE_BUBBLE = { t: bar(7) + BEAT * 0.25, text: "Ich überleg's mir noch." };

// ---------- Zurueckspulen ----------
// Waehrend Takt 8 laeuft die Szenenzeit von 20 s zurueck auf 4.5 s (leerer Tisch).
export const REWIND = { t0: bar(8), t1: bar(9) - BEAT * 0.5, from: bar(8), to: 4.5 };
export function rewindMap(t) {
  const p = Math.min(1, Math.max(0, (t - REWIND.t0) / (REWIND.t1 - REWIND.t0)));
  // langsam anlaufen, dann schnell, am Ende abbremsen
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  return REWIND.from + (REWIND.to - REWIND.from) * e;
}

// ---------- Tag 2: 6 Glaeser ----------
export const J6 = { w: 136, h: 168 };
export const JARS6 = [0, 1, 2, 3, 4, 5].map((i) => {
  const r = rng(2000 + i);
  return {
    x: 540 + (i - 2.5) * 150,
    y: 1330,
    flavor: [2, 5, 0, 3, 1, 4][i], // Erdbeere an Position 2
    labelRot: (r() - 0.5) * 0.1,
    fill: 0.74 + r() * 0.1,
  };
});
export const POP6 = [0, 1, 2, 3, 4, 5].map((i) => bar(9) + BEAT * 0.5 + i * (BEAT / 2));
export const POP6_NOTES = [65, 69, 72, 77, 81, 84];
export const CUST6 = {
  enter: [bar(10), bar(10) + 3 * BEAT],
  card40: bar(10) + 2 * BEAT,
  gazes: [
    { t: bar(11), jar: 1 },
    { t: bar(11) + 2 * BEAT, jar: 4 },
    { t: bar(12) - BEAT, jar: 2 },
  ],
  pickJar: 2,
  bubble: bar(12) - BEAT * 0.5,
  reach: [bar(12), bar(12) + BEAT * 0.75],
  lift: [bar(12) + BEAT * 0.75, bar(12) + BEAT * 1.75],
  ding: bar(12) + BEAT * 1.5,
  card30: bar(12) + BEAT * 2,
};

// ---------- Diagramm ----------
export const CHART = {
  fly: [bar(13), bar(13) + BEAT * 1.25],
  dropLeft: bar(13) + BEAT * 0.75,
  fill: [bar(13.5), bar(13.5) + BEAT * 2],
  caption: bar(14),
  out: [bar(15) - BEAT * 0.5, bar(15) + BEAT * 0.5],
};

// ---------- Meta-Analyse 2010 (schematisch) ----------
export const META = {
  axis: [bar(15.5) + BEAT * 0.5, bar(15.5) + BEAT * 1.5],
  jamDot: bar(16),
  rain: [bar(16) + BEAT * 1.5, bar(17) + BEAT * 1.75],
  mean: bar(17) + BEAT * 2,
  out: [bar(18), bar(18) + BEAT * 1.5],
};
export const DOTS = [];
{
  const r = rng(2010);
  const n = 62;
  const vals = [];
  for (let i = 0; i < n; i++) {
    const u = Math.max(1e-6, r());
    const v = r();
    vals.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 0.3);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  // Mittelwert inklusive Marmeladen-Studie exakt auf null setzen
  const jam = 0.78;
  const shift = (mean * n + jam) / (n + 1);
  const all = [{ d: jam - shift, jam: true }, ...vals.map((d) => ({ d: d - shift, jam: false }))];
  const DOT = 34;
  const bins = new Map();
  const order = all.map((_, i) => i);
  // Regenreihenfolge zufaellig, Marmeladen-Studie zuerst
  for (let i = order.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(r() * i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((idx, k) => {
    const o = all[idx];
    const xRaw = 540 + o.d * 470;
    const bin = Math.round((xRaw - 540) / DOT);
    const cnt = bins.get(bin) || 0;
    bins.set(bin, cnt + 1);
    let t;
    if (k === 0) t = META.jamDot;
    else {
      const p = (k - 1) / (all.length - 2);
      t = META.rain[0] + (META.rain[1] - META.rain[0]) * Math.sqrt(p);
    }
    DOTS.push({
      t,
      x: 540 + bin * DOT,
      stack: cnt,
      jam: o.jam,
      d: o.d,
      color: o.jam ? '#c8283a' : FLAVORS[Math.floor(r() * 24)].jam,
      note: 0,
    });
  });
  DOTS.sort((a, b) => a.t - b.t);
  // Tonhoehe nach Position: links tief, rechts hoch (d-Moll pentatonisch)
  const scale = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86];
  DOTS.forEach((d) => {
    const q = Math.min(scale.length - 1, Math.max(0, Math.round(((d.x - 140) / 800) * (scale.length - 1))));
    d.note = scale[q];
  });
}
export const DOT_R = 15.5;
export const AXIS_Y = 1260;

// ---------- Meta-Analyse 2015: vier Bedingungen ----------
export const MODER = {
  head: bar(18) + BEAT * 0.5,
  items: [bar(19), bar(19) + 2 * BEAT, bar(20), bar(20) + 2 * BEAT],
  out: [bar(21) - BEAT, bar(21) + BEAT * 0.5],
};

// ---------- Zwei ----------
export const TWO = {
  line1: bar(21) + BEAT * 0.5,
  stand: bar(21.5),
  pops: [bar(21.5) + BEAT * 1.5, bar(21.5) + BEAT * 2],
  enter: [bar(22.5), bar(22.5) + 3 * BEAT],
  gazes: [
    { t: bar(23.25), jar: 0 },
    { t: bar(23.25) + BEAT * 1.5, jar: 1 },
    { t: bar(24) - BEAT * 0.5, jar: 0 },
  ],
  line2: bar(23.5),
  pickJar: 0,
  bubble: bar(24),
  reach: [bar(24) + BEAT * 0.25, bar(24) + BEAT],
  lift: [bar(24) + BEAT, bar(24) + BEAT * 2],
  sparkle: bar(24) + BEAT * 2,
};
export const JARS2 = [
  { x: 360, y: 1330, flavor: 1, labelRot: -0.04, fill: 0.8 },
  { x: 720, y: 1330, flavor: 0, labelRot: 0.05, fill: 0.78 },
];
export const J2 = { w: 190, h: 234 };

// ---------- Abspann ----------
export const END = {
  iris: [bar(25), bar(25) + BEAT * 1.5],
  title: bar(25) + BEAT * 1.75,
  l1: bar(25.5) + BEAT * 0.25,
  l2: bar(26) - BEAT * 0.5,
  src: bar(26.5) - BEAT * 0.5,
  fade: [DURATION - 0.6, DURATION],
};

// Schritte beim Gehen (fuer Wippen im Bild und Schritte im Ton)
export const STEPS_PER_WALK = 4;
export function walkSteps(t0, t1) {
  const out = [];
  for (let i = 0; i < STEPS_PER_WALK; i++) out.push(t0 + ((i + 0.5) / STEPS_PER_WALK) * (t1 - t0));
  return out;
}
