window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;

  class Sequencer {
    constructor(engine) {
      this.engine = engine;
      this.timer = null;
      this.playing = false;
      this.mode = 'pattern';
      this.step = 0;
      this.nextTime = 0;
      this.pendingPattern = null;
      this.visualQueue = [];
      this.onVisual = null;
      this.onStop = null;
      this.onMode = null;
      this.song = null;
      this.arrStep = 0;
    }

    async play(mode = 'pattern') {
      await this.engine.init();
      if (this.playing) return;
      this.mode = mode;
      this.playing = true;
      this.step = 0;
      this.arrStep = 0;
      this.nextTime = this.engine.ctx.currentTime + 0.06;
      this.timer = setInterval(() => this.schedule(), 25);
      if (this.onMode) this.onMode(this.mode);
      this.schedule();
    }

    async playPattern() {
      this.song = null;
      await this.play('pattern');
    }

    async startArranger() {
      this.song = null;
      if (this.playing) this.stop(false);
      await this.play('arranger');
    }

    async startSong(chain, repeats) {
      const ids = String(chain || '').split(',').map(s => s.trim()).filter(x => T.PATTERN_IDS.includes(x));
      if (!ids.length) throw new Error('La cadena de Song Mode no contiene patrones válidos');
      if (this.playing) this.stop(false);
      this.song = { ids, index: 0, repeats: Math.max(1, Number(repeats) || 1), count: 0 };
      T.State.project.currentPattern = ids[0];
      await this.play('song');
    }

    stop(notify = true) {
      const wasPlaying = this.playing;
      this.playing = false;
      clearInterval(this.timer);
      this.timer = null;
      this.step = 0;
      this.arrStep = 0;
      this.visualQueue = [];
      this.pendingPattern = null;
      this.song = null;
      if (wasPlaying && notify && this.onStop) this.onStop();
    }

    launchPattern(id) {
      if (!T.PATTERN_IDS.includes(id)) return;
      if (this.playing && this.mode !== 'arranger') this.pendingPattern = id;
      else T.State.project.currentPattern = id;
    }

    schedulePatternStep(p, time, dur) {
      const pattern = p.patterns[p.currentPattern];
      T.AUTOMATION_PARAMS.forEach(k => this.engine.automation(k, pattern.automation[k][this.step], time));
      if (T.Modulation) T.Modulation.apply(this.engine, this.step, time, p.bpm);
      T.TRACKS.forEach(track => {
        const s = pattern.tracks[track.id][this.step];
        this.scheduleTrigger(track.id, s, time, dur);
      });
      this.visualQueue.push({ mode: this.mode, step: this.step, time, pattern: p.currentPattern, bar: Math.floor(this.step / 16) });

      this.step++;
      if (this.pendingPattern && (this.step % 16 === 0 || this.step >= p.steps)) {
        p.currentPattern = this.pendingPattern;
        this.pendingPattern = null;
        this.step = 0;
      }

      if (this.step >= p.steps) {
        this.step = 0;
        if (this.mode === 'song' && this.song) {
          this.song.count++;
          if (this.song.count >= this.song.repeats) {
            this.song.count = 0;
            this.song.index++;
            if (this.song.index >= this.song.ids.length) {
              this.stop();
              return false;
            }
            p.currentPattern = this.song.ids[this.song.index];
          }
        }
      }
      return true;
    }

    scheduleArrangerStep(p, time, dur) {
      const totalSteps = p.arranger.lengthBars * 16;
      const bar = Math.floor(this.arrStep / 16);
      const stepInBar = this.arrStep % 16;
      const automationPattern = p.patterns[p.arranger.automationPattern] || p.patterns[p.currentPattern];
      const automationStep = this.arrStep % p.steps;
      T.AUTOMATION_PARAMS.forEach(k => this.engine.automation(k, automationPattern.automation[k][automationStep], time));
      if (T.Modulation) T.Modulation.apply(this.engine, this.arrStep, time, p.bpm);

      T.TRACKS.forEach(track => {
        const resolved = T.Arranger.stepFor(track.id, bar, stepInBar);
        if (resolved) this.scheduleTrigger(track.id, resolved.step, time, dur);
        if (T.SYNTH_TRACKS.includes(track.id)) {
          const notes = T.Arranger.midiNotesAt(track.id, bar, stepInBar);
          notes.forEach(({note}) => this.engine.triggerMidiNote(track.id, note.note, note.velocity, time, Math.max(0.04, note.length * dur * 0.92)));
        }
      });

      this.visualQueue.push({ mode: 'arranger', step: stepInBar, arrangementStep: this.arrStep, time, bar, pattern: p.arranger.automationPattern });
      this.arrStep++;
      if (this.arrStep >= totalSteps) {
        if (p.arranger.loop) this.arrStep = 0;
        else {
          this.stop();
          return false;
        }
      }
      return true;
    }

    scheduleTrigger(trackId, step, time, dur) {
      if (!step || !step.on || Math.random() * 100 > step.probability) return;
      const micro = (step.micro || 0) / 1000;
      const ratchets = Math.max(1, step.ratchet || 1);
      for (let r = 0; r < ratchets; r++) {
        const rt = time + micro + r * (dur / ratchets);
        this.engine.trigger(trackId, step, Math.max(this.engine.ctx.currentTime + 0.002, rt), dur / ratchets);
      }
    }

    schedule() {
      if (!this.playing || !this.engine.ctx) return;
      const ctx = this.engine.ctx;
      const p = T.State.project;
      while (this.playing && this.nextTime < ctx.currentTime + 0.12) {
        const dur = 60 / p.bpm / 4;
        const seqStep = this.mode === 'arranger' ? this.arrStep : this.step;
        const swing = seqStep % 2 ? dur * (p.swing / 100) * 0.5 : 0;
        const time = this.nextTime + swing;
        const keepGoing = this.mode === 'arranger'
          ? this.scheduleArrangerStep(p, time, dur)
          : this.schedulePatternStep(p, time, dur);
        if (!keepGoing) break;
        this.nextTime += dur;
      }
    }

    pumpVisual() {
      if (!this.engine.ctx) return;
      const now = this.engine.ctx.currentTime;
      while (this.visualQueue.length && this.visualQueue[0].time <= now + 0.01) {
        const event = this.visualQueue.shift();
        if (this.onVisual) this.onVisual(event);
      }
    }
  }

  T.Sequencer = Sequencer;
})();
