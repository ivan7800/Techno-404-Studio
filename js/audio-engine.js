window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.channels = {};
      this.noiseBuffer = null;
      this.analyser = null;
      this.customSamples = {};
      this.padSamples = {};
      this.librarySamples = {};
      this.started = false;
      this.lastAcidFreq = 110;
      this.automatedBassCutoff = null;
      this._noiseCache = new WeakMap();
    }

    async init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API no disponible');
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this._buildGraph(ctx);
      this.noiseBuffer = this.makeNoise(ctx);
      this.setMaster(T.State.project.master);
      this.applyMixer(T.State.project.mixer);
      this.started = true;
    }

    _buildGraph(ctx) {
      this.masterBus = ctx.createGain();
      this.drive = ctx.createWaveShaper();
      this.masterFilter = ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.16;

      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.001;
      this.limiter.release.value = 0.055;

      this.masterGain = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.84;

      this.delay = ctx.createDelay(2);
      this.delay.delayTime.value = 0.28;
      this.delayTone = ctx.createBiquadFilter(); this.delayTone.type = 'lowpass'; this.delayTone.frequency.value = 9000;
      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.value = 0.32;
      this.delayWet = ctx.createGain();

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(ctx, 2.4, 2.7);
      this.reverbTone = ctx.createBiquadFilter(); this.reverbTone.type = 'lowpass'; this.reverbTone.frequency.value = 10000;
      this.reverbWet = ctx.createGain();

      this.masterBus.connect(this.drive);
      this.drive.connect(this.masterFilter);
      this.masterFilter.connect(this.compressor);
      this.compressor.connect(this.limiter);
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this.delay.connect(this.delayTone);
      this.delayTone.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delayTone.connect(this.delayWet);
      this.delayWet.connect(this.masterBus);

      this.reverb.connect(this.reverbTone);
      this.reverbTone.connect(this.reverbWet);
      this.reverbWet.connect(this.masterBus);

      T.TRACKS.forEach(track => this.createChannel(track.id));
    }

    createChannel(id) {
      const c = this.ctx;
      const input = c.createGain();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 25;
      const low = c.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 130;
      const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 0.75;
      const high = c.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 5200;
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 18000;
      const gain = c.createGain();
      const duck = c.createGain();
      const pan = c.createStereoPanner();
      const dsend = c.createGain();
      const rsend = c.createGain();

      input.connect(hp).connect(low).connect(mid).connect(high).connect(filter).connect(gain).connect(duck).connect(pan).connect(this.masterBus);
      pan.connect(dsend).connect(this.delay);
      pan.connect(rsend).connect(this.reverb);

      this.channels[id] = { input, hp, low, mid, high, filter, gain, duck, pan, dsend, rsend };
    }

    makeNoise(ctx = this.ctx) {
      if (this._noiseCache.has(ctx)) return this._noiseCache.get(ctx);
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noiseCache.set(ctx, b);
      return b;
    }

    makeImpulse(ctx, seconds, decay) {
      const len = Math.floor(ctx.sampleRate * seconds);
      const b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return b;
    }

    curve(amount) {
      const n = 4096;
      const a = Math.max(0, amount);
      const arr = new Float32Array(n);
      const k = a * 8;
      for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        arr[i] = (1 + k) * x / (1 + k * Math.abs(x));
      }
      return arr;
    }

    setMaster(m) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(clamp((m.volume || 0) / 100, 0, 1.2), now, 0.01);
      this.automatedBassCutoff = clamp(m.bassCutoff || 1200, 80, 7000);
      this.masterFilter.frequency.setTargetAtTime(clamp(m.filter || 16000, 300, 18000), now, 0.02);
      this.drive.curve = this.curve((m.drive || 0) / 100);
      this.drive.oversample = '2x';
      this.delayWet.gain.setTargetAtTime(clamp((m.delay || 0) / 100 * 0.8, 0, 0.8), now, 0.02);
      this.reverbWet.gain.setTargetAtTime(clamp((m.reverb || 0) / 100 * 0.72, 0, 0.72), now, 0.02);
      const fx = m.fx || {};
      this.delay.delayTime.setTargetAtTime(clamp(Number(fx.delayTime || 0.375), 0.0625, 1.5), now, 0.02);
      this.delayFeedback.gain.setTargetAtTime(clamp(Number(fx.delayFeedback ?? 34) / 100, 0, 0.88), now, 0.02);
      this.delayTone.frequency.setTargetAtTime(500 * Math.pow(30, clamp(Number(fx.delayTone ?? 68) / 100, 0, 1)), now, 0.02);
      this.reverbTone.frequency.setTargetAtTime(700 * Math.pow(24, clamp(Number(fx.reverbTone ?? 72) / 100, 0, 1)), now, 0.02);
      const rvDecay = clamp(Number(fx.reverbDecay || 2.3), 0.3, 6);
      if (this._reverbDecay !== rvDecay) { this.reverb.buffer = this.makeImpulse(this.ctx, rvDecay, 2.7); this._reverbDecay = rvDecay; }
      const comp = clamp((m.compressor || 0) / 100, 0, 1);
      this.compressor.threshold.setTargetAtTime(-3 - comp * 21, now, 0.02);
      this.compressor.ratio.setTargetAtTime(1 + comp * 7, now, 0.02);
      const ceiling = clamp(Number(m.limiterCeiling ?? -1), -12, 0);
      this.limiter.threshold.setTargetAtTime(m.limiterEnabled === false ? 0 : ceiling, now, 0.02);
      this.limiter.ratio.setTargetAtTime(m.limiterEnabled === false ? 1 : 20, now, 0.02);
    }

    applyMixer(mixer) {
      if (!this.ctx) return;
      const anySolo = Object.values(mixer).some(m => m.solo);
      const now = this.ctx.currentTime;
      T.TRACKS.forEach(track => {
        const m = mixer[track.id];
        const ch = this.channels[track.id];
        const audible = !m.mute && (!anySolo || m.solo);
        ch.gain.gain.setTargetAtTime(audible ? m.volume / 100 : 0, now, 0.01);
        ch.pan.pan.setTargetAtTime((m.pan || 0) / 100, now, 0.01);
        ch.filter.frequency.setTargetAtTime(180 * Math.pow(100, (m.filter || 0) / 100), now, 0.02);
        ch.low.gain.setTargetAtTime(m.eqLow || 0, now, 0.02);
        ch.mid.gain.setTargetAtTime(m.eqMid || 0, now, 0.02);
        ch.high.gain.setTargetAtTime(m.eqHigh || 0, now, 0.02);
        ch.dsend.gain.setTargetAtTime((m.delaySend || 0) / 100, now, 0.02);
        ch.rsend.gain.setTargetAtTime((m.reverbSend || 0) / 100, now, 0.02);
        if (ch.duck.gain.value < 0.999) ch.duck.gain.setTargetAtTime(1, now, 0.01);
      });
    }

    automation(param, val, time) {
      if (!this.ctx) return;
      const n = clamp(val / 100, 0, 1);
      if (param === 'filter') this.masterFilter.frequency.setValueAtTime(300 * Math.pow(60, n), time);
      else if (param === 'delay') this.delayWet.gain.setValueAtTime(n * 0.8, time);
      else if (param === 'reverb') this.reverbWet.gain.setValueAtTime(n * 0.72, time);
      else if (param === 'master') this.masterGain.gain.setValueAtTime(n, time);
      else if (param === 'drive') this.drive.curve = this.curve(n);
      else if (param === 'acidCutoff') this.automatedBassCutoff = 100 + Math.pow(n, 1.8) * 6900;
    }

    duck(time) {
      const p = T.State.project;
      const release = clamp((p.master.sidechainRelease || 180) / 1000, 0.06, 0.6);
      T.TRACKS.forEach(track => {
        if (track.id === 'kick') return;
        const amount = clamp((p.mixer[track.id].sidechain || 0) / 100, 0, 0.95);
        if (amount <= 0) return;
        const g = this.channels[track.id].duck.gain;
        const floor = Math.max(0.04, 1 - amount);
        g.cancelScheduledValues(time);
        g.setValueAtTime(Math.max(0.001, g.value || 1), time);
        g.linearRampToValueAtTime(floor, time + 0.008);
        g.exponentialRampToValueAtTime(1, time + release);
      });
    }

    envGain(time, attack, peak, decay) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), time + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
      return g;
    }

    kick(time, v = 1, pitch = 0, accent = false) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = this.envGain(time, 0.002, Math.min(1.35, v * (accent ? 1.16 : 1)), 0.42);
      o.type = 'sine';
      const base = 52 * Math.pow(2, pitch / 12);
      o.frequency.setValueAtTime(base * 3.1, time);
      o.frequency.exponentialRampToValueAtTime(base, time + 0.055);
      o.connect(g).connect(this.channels.kick.input);
      o.start(time); o.stop(time + 0.5);

      const click = c.createBufferSource();
      click.buffer = this.noiseBuffer;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4600;
      const cg = this.envGain(time, 0.001, 0.15 * v, 0.024);
      click.connect(f).connect(cg).connect(this.channels.kick.input);
      click.start(time); click.stop(time + 0.03);
      this.duck(time);
    }

    noiseHit(track, time, v, kind) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuffer;
      const f = c.createBiquadFilter();
      const g = c.createGain();
      let dur = 0.1;
      if (kind === 'clap') { f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 0.6; dur = 0.16; }
      else if (kind === 'chh') { f.type = 'highpass'; f.frequency.value = 6500; dur = 0.045; }
      else if (kind === 'ohh') { f.type = 'highpass'; f.frequency.value = 5800; dur = 0.28; }
      else { f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 2; dur = 0.11; }
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(v, time + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      s.connect(f).connect(g).connect(this.channels[track].input);
      s.start(time); s.stop(time + dur + 0.02);
    }

    bass(track, time, v, pitch, accent, cutoff, glide, dur = 0.18) {
      const c = this.ctx;
      const o = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o.type = track === 'acid' ? 'sawtooth' : 'square';
      const hz = midiHz(36 + pitch);
      if (glide) {
        o.frequency.setValueAtTime(Math.max(20, this.lastAcidFreq), time);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, hz), time + 0.06);
      } else {
        o.frequency.setValueAtTime(hz, time);
      }
      this.lastAcidFreq = hz;
      f.type = 'lowpass';
      const base = this.automatedBassCutoff || T.State.project.master.bassCutoff || 1200;
      const lock = 0.3 + (cutoff / 100) * 1.7;
      f.frequency.setValueAtTime(Math.min(9000, base * lock), time);
      f.frequency.exponentialRampToValueAtTime(Math.max(120, Math.min(3500, base * 0.45)), time + dur);
      f.Q.value = T.State.project.master.bassRes || 14;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, v * (accent ? 1.2 : 1) * 0.55), time + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f).connect(g).connect(this.channels[track].input);
      o.start(time); o.stop(time + dur + 0.03);
    }

    stab(time, v, pitch) {
      const c = this.ctx;
      const g = this.envGain(time, 0.006, 0.34 * v, 0.22);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.1;
      [0, 3, 7].forEach(semi => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(48 + pitch + semi);
        o.connect(f); o.start(time); o.stop(time + 0.28);
      });
      f.connect(g).connect(this.channels.stab.input);
    }

    midiSynth(track, time, velocity, note, dur = 0.18) {
      const c = this.ctx;
      const v = clamp(velocity / 127, 0.001, 1);
      if (track === 'stab') {
        const g = this.envGain(time, 0.005, 0.34 * v, Math.max(0.08, dur));
        const f = c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1500; f.Q.value=1.05;
        [0,3,7].forEach(semi=>{const o=c.createOscillator();o.type='sawtooth';o.frequency.value=midiHz(note+semi);o.connect(f);o.start(time);o.stop(time+dur+0.06);});
        f.connect(g).connect(this.channels.stab.input);
        return;
      }
      if (track === 'bass' || track === 'acid') {
        const o=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain();
        o.type=track==='acid'?'sawtooth':'square'; o.frequency.setValueAtTime(midiHz(note),time);
        f.type='lowpass'; const base=this.automatedBassCutoff || T.State.project.master.bassCutoff || 1200;
        f.frequency.setValueAtTime(Math.min(9000,base*(track==='acid'?1.15:.8)),time);
        f.frequency.exponentialRampToValueAtTime(Math.max(120,base*.42),time+Math.max(.05,dur)); f.Q.value=T.State.project.master.bassRes||14;
        g.gain.setValueAtTime(.0001,time); g.gain.exponentialRampToValueAtTime(Math.max(.001,v*.58),time+.006); g.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.04,dur));
        o.connect(f).connect(g).connect(this.channels[track].input); o.start(time); o.stop(time+dur+.05);
      }
    }

    triggerMidiNote(track, note, velocity, time, duration) {
      if (!T.SYNTH_TRACKS.includes(track)) return;
      this.midiSynth(track, time, velocity, note, Math.max(0.04, duration || 0.16));
    }

    applyLfo(target, bipolar, time) {
      if (!this.ctx || target === 'off') return;
      const p=T.State.project, x=clamp(bipolar,-1,1);
      if (target==='masterFilter') this.masterFilter.frequency.setValueAtTime(clamp((p.master.filter||16000)*Math.pow(2,x*2.2),300,18000),time);
      else if (target==='acidCutoff') this.automatedBassCutoff=clamp((p.master.bassCutoff||1200)*Math.pow(2,x*2.4),80,7000);
      else if (target==='delay') this.delayWet.gain.setValueAtTime(clamp((p.master.delay||0)/100*.8 + x*.18,0,.8),time);
      else if (target==='reverb') this.reverbWet.gain.setValueAtTime(clamp((p.master.reverb||0)/100*.72 + x*.15,0,.72),time);
      else if (target==='drive') this.drive.curve=this.curve(clamp((p.master.drive||0)/100+x*.25,0,1));
      else if (target.endsWith('Filter')) { const id=target.replace('Filter',''); if(this.channels[id]) this.channels[id].filter.frequency.setValueAtTime(clamp(250*Math.pow(60,clamp((p.mixer[id].filter||100)/100+x*.25,0,1)),180,18000),time); }
    }

    async loadPadSample(index, arrayBuffer) { await this.init(); const decoded=await this.ctx.decodeAudioData(arrayBuffer.slice(0)); this.padSamples[index]=decoded; return decoded; }
    clearPadSample(index) { delete this.padSamples[index]; }
    padHit(index, time, velocity=1) {
      const b=this.padSamples[index]; if(!b||!this.ctx)return; const pad=T.State.project.pads[index]||{}; const s=this.ctx.createBufferSource(),g=this.ctx.createGain();
      s.buffer=b; s.playbackRate.setValueAtTime(Math.pow(2,(pad.pitch||0)/12),time); g.gain.value=clamp((pad.gain||1)*velocity,0,2); s.connect(g).connect(this.masterBus); s.start(time);
    }
    async triggerPadNow(index, velocity=1) { await this.init(); this.padHit(index,this.ctx.currentTime+.008,velocity); }

    async loadSample(track, arrayBuffer) {
      await this.init();
      const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.customSamples[track] = decoded;
      return decoded;
    }

    clearSample(track) { delete this.customSamples[track]; }

    sampleHit(track, time, v, pitch = 0) {
      const c = this.ctx;
      const buffer = this.customSamples[track];
      if (!buffer) return;
      const settings = T.State.project.sampler[track] || { start: 0, end: 1, gain: 1, reverse: false };
      const source = c.createBufferSource();
      let useBuffer = buffer;
      if (settings.reverse) useBuffer = this.reverseBuffer(buffer);
      source.buffer = useBuffer;
      source.playbackRate.setValueAtTime(Math.pow(2, pitch / 12), time);
      const g = c.createGain();
      g.gain.value = Math.max(0.001, v * (settings.gain || 1));
      source.connect(g).connect(this.channels[track].input);
      const start = clamp(settings.start || 0, 0, 0.999) * useBuffer.duration;
      const end = clamp(settings.end ?? 1, 0.001, 1) * useBuffer.duration;
      const duration = Math.max(0.005, end - start);
      source.start(time, start, duration);
      source.stop(time + duration / source.playbackRate.value + 0.02);
      if (track === 'kick') this.duck(time);
    }

    reverseBuffer(buffer) {
      if (buffer._techno404Reverse) return buffer._techno404Reverse;
      const b = this.ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = b.getChannelData(ch);
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j];
      }
      try { Object.defineProperty(buffer, '_techno404Reverse', { value: b }); } catch (_) {}
      return b;
    }

    trigger(track, step, time, dur) {
      const v = (step.velocity || 100) / 127;
      if (this.customSamples[track]) {
        this.sampleHit(track, time, v, step.pitch);
        return;
      }
      if (track === 'kick') this.kick(time, v, step.pitch, step.accent);
      else if (['clap','chh','ohh','perc'].includes(track)) this.noiseHit(track, time, v, track);
      else if (track === 'bass' || track === 'acid') {
        const gate = clamp((step.gate || 72) / 100, 0.05, 1);
        this.bass(track, time, v, step.pitch, step.accent, step.cutoff, step.glide, Math.min(0.5, dur * gate));
      }
      else if (track === 'stab') this.stab(time, v, step.pitch);
    }

    async triggerNow(track, velocity = 110, pitch = 0) {
      await this.init();
      const s = { velocity, probability: 100, ratchet: 1, pitch, micro: 0, accent: false, glide: false, cutoff: 60, gate: 72 };
      this.trigger(track, s, this.ctx.currentTime + 0.01, 0.14);
    }

    async previewSample(track) {
      await this.init();
      if (!this.customSamples[track]) throw new Error('No hay sample cargado en esta pista');
      this.sampleHit(track, this.ctx.currentTime + 0.01, 0.9, 0);
    }
  }

  T.AudioEngine = AudioEngine;
})();
