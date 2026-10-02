window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;
  const rnd = (n = 1) => Math.random() * n;
  const chance = p => Math.random() * 100 < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resetStep(s) {
    Object.assign(s, { on:false, velocity:100, probability:100, ratchet:1, pitch:0, micro:0, accent:false, glide:false, cutoff:60, gate:72 });
  }

  function clearPattern(pat) {
    T.TRACKS.forEach(t => pat.tracks[t.id].forEach(resetStep));
  }

  function bpmFor(style) {
    return ({ minimal:128, detroit:132, dub:124, acid:136, hypnotic:134, peak:138, industrial:145, hard:150 })[style] || 136;
  }

  function seedAutomation(pat, style, energy, dark) {
    for (let i = 0; i < 64; i++) {
      const phase = (i % 16) / 15;
      pat.automation.filter[i] = clamp(60 + energy * 0.25 + Math.sin(phase * Math.PI) * 12, 0, 100);
      pat.automation.delay[i] = clamp((style === 'dub' ? 28 : 10) + (i % 8 === 7 ? 12 : 0), 0, 100);
      pat.automation.reverb[i] = clamp((style === 'dub' ? 24 : 8) + dark * 0.08, 0, 100);
      pat.automation.master[i] = 82;
      pat.automation.drive[i] = clamp((style === 'hard' || style === 'industrial' ? 35 : 15) + energy * 0.12, 0, 100);
      pat.automation.acidCutoff[i] = clamp(28 + energy * 0.35 + Math.sin(i / 5) * 18, 5, 95);
    }
  }

  T.Generator = {
    generate(style, energy = 72, dark = 78, complex = 58) {
      const P = T.State.project;
      const pat = P.patterns[P.currentPattern];
      const n = P.steps;
      clearPattern(pat);
      const hard = ['hard','industrial','peak'].includes(style);
      const acid = style === 'acid';
      const dub = style === 'dub';

      for (let i = 0; i < n; i++) {
        const q = i % 16;
        let s = pat.tracks.kick[i];
        if (q % 4 === 0 || (hard && chance(8 + energy * 0.22))) {
          s.on = true; s.velocity = 112 + Math.floor(rnd(15)); s.accent = q === 0; s.gate = 88;
        }
        if (q === 4 || q === 12) {
          s = pat.tracks.clap[i]; s.on = true; s.velocity = 90 + Math.floor(rnd(25));
        }
        if (q % 2 === 0 && chance(55 + energy * 0.35)) {
          s = pat.tracks.chh[i]; s.on = true; s.velocity = 58 + Math.floor(rnd(45)); s.probability = 80 + Math.floor(rnd(21));
        }
        if ([2,6,10,14].includes(q) && chance(30 + energy * 0.42)) {
          s = pat.tracks.ohh[i]; s.on = true; s.velocity = 65 + Math.floor(rnd(40));
        }
        if (chance(7 + complex * 0.18)) {
          s = pat.tracks.perc[i]; s.on = true; s.velocity = 55 + Math.floor(rnd(50)); s.micro = Math.floor(rnd(17)) - 8; s.pitch = Math.floor(rnd(9)) - 4;
        }
        if (chance((acid ? 38 : 20) + complex * 0.18) && q % 2 === 0) {
          const id = acid ? 'acid' : 'bass';
          s = pat.tracks[id][i];
          s.on = true;
          s.velocity = 80 + Math.floor(rnd(45));
          s.pitch = [0,0,3,5,7,10,12][Math.floor(rnd(7))] - (dark > 65 ? 12 : 0);
          s.accent = chance(28 + energy * 0.2);
          s.glide = chance(acid ? 30 : 8);
          s.cutoff = 35 + Math.floor(rnd(60));
          s.probability = 80 + Math.floor(rnd(21));
          s.gate = 45 + Math.floor(rnd(50));
        }
        if ((style === 'detroit' || dub) && q % 8 === 4 && chance(35 + complex * 0.25)) {
          s = pat.tracks.stab[i]; s.on = true; s.velocity = 70 + Math.floor(rnd(35)); s.pitch = [0,3,5,7][Math.floor(rnd(4))]; s.gate = 60;
        }
        if (hard && q === 15 && chance(complex * 0.7)) {
          s = pat.tracks.clap[i]; s.on = true; s.ratchet = chance(50) ? 2 : 3; s.velocity = 75 + Math.floor(rnd(40));
        }
      }

      P.bpm = bpmFor(style);
      P.swing = style === 'detroit' ? 18 : style === 'hypnotic' ? 10 : 6;
      seedAutomation(pat, style, energy, dark);
      return pat;
    },

    humanize() {
      const pat = T.State.project.patterns[T.State.project.currentPattern];
      T.TRACKS.forEach(t => pat.tracks[t.id].forEach(s => {
        if (!s.on) return;
        s.velocity = clamp(s.velocity + Math.floor(rnd(15)) - 7, 35, 127);
        s.micro = clamp(s.micro + Math.floor(rnd(9)) - 4, -20, 20);
      }));
    },

    euclid(track, pulses = 5) {
      const arr = T.State.project.patterns[T.State.project.currentPattern].tracks[track];
      const n = T.State.project.steps;
      const p = Math.max(1, Math.min(n, pulses));
      for (let i = 0; i < n; i++) {
        arr[i].on = Math.floor(i * p / n) !== Math.floor((i - 1) * p / n);
        if (arr[i].on) arr[i].velocity = 92 + (i % 4 === 0 ? 20 : 0);
      }
    },

    acidLine() {
      const arr = T.State.project.patterns[T.State.project.currentPattern].tracks.acid;
      const n = T.State.project.steps;
      for (let i = 0; i < n; i++) {
        arr[i].on = chance(42) && i % 2 === 0;
        arr[i].pitch = [0,3,5,7,10,12][Math.floor(rnd(6))] - 12;
        arr[i].velocity = 80 + Math.floor(rnd(46));
        arr[i].accent = chance(35);
        arr[i].glide = chance(30);
        arr[i].cutoff = 30 + Math.floor(rnd(68));
        arr[i].gate = 45 + Math.floor(rnd(50));
      }
    },

    createArrangement() {
      const P = T.State.project;
      const hasHits = pid => T.TRACKS.some(track => P.patterns[pid].tracks[track.id].some(step => step.on));
      const available = T.PATTERN_IDS.filter(hasHits);
      const progression = available.length ? available : ['A1'];
      P.arranger.lengthBars = 16;
      P.arranger.clips = [];
      T.TRACKS.forEach(track => {
        for (let bar = 0; bar < P.arranger.lengthBars; bar += 2) {
          if ((track.id === 'ohh' || track.id === 'stab') && bar < 2) continue;
          if (track.id === 'acid' && bar < 4) continue;
          const section = Math.floor(bar / 2);
          const sourcePattern = progression[section % progression.length];
          P.arranger.clips.push({
            id: T.uid('clip'),
            type: 'pattern',
            track: track.id,
            pattern: sourcePattern,
            midiClipId: null,
            bar,
            bars: 2
          });
        }
      });
      P.arranger.automationPattern = progression[0];
      return P.arranger;
    }
  };
})();
