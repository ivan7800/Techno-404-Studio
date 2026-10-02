window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length * channels * 2 + 44;
    const ab = new ArrayBuffer(length);
    const view = new DataView(ab);
    const write = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, length - 8, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length - 44, true);
    const data = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
    let pos = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const s = clamp(data[ch][i], -1, 1);
        view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        pos += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function impulse(ctx, seconds = 1.8, decay = 2.5) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function noise(ctx) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function distortionCurve(amount) {
    const n = 2048, out = new Float32Array(n), k = Math.max(0, amount) * 8;
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      out[i] = (1 + k) * x / (1 + k * Math.abs(x));
    }
    return out;
  }

  function buildGraph(ctx, project, trackFilter, applyMaster) {
    const master = ctx.createGain();
    const drive = ctx.createWaveShaper(); drive.curve = distortionCurve((project.master.drive || 0) / 100); drive.oversample = '2x';
    const masterFilter = ctx.createBiquadFilter(); masterFilter.type = 'lowpass'; masterFilter.frequency.value = project.master.filter || 16000;
    const comp = ctx.createDynamicsCompressor();
    const strength = clamp((project.master.compressor || 0) / 100, 0, 1);
    comp.threshold.value = -3 - strength * 21; comp.ratio.value = 1 + strength * 7; comp.attack.value = 0.004; comp.release.value = 0.16;
    const limiter = ctx.createDynamicsCompressor(); limiter.knee.value = 0; limiter.attack.value = 0.001; limiter.release.value = 0.055;
    limiter.threshold.value = project.master.limiterEnabled === false ? 0 : (project.master.limiterCeiling ?? -1);
    limiter.ratio.value = project.master.limiterEnabled === false ? 1 : 20;
    const output = ctx.createGain(); output.gain.value = applyMaster ? (project.master.volume || 82) / 100 : 1;

    if (applyMaster) master.connect(drive).connect(masterFilter).connect(comp).connect(limiter).connect(output).connect(ctx.destination);
    else master.connect(output).connect(ctx.destination);

    const fx=project.master.fx||{};
    const delay = ctx.createDelay(2); delay.delayTime.value = clamp(Number(fx.delayTime||0.375),0.0625,1.5);
    const delayTone=ctx.createBiquadFilter();delayTone.type='lowpass';delayTone.frequency.value=500*Math.pow(30,clamp(Number(fx.delayTone??68)/100,0,1));
    const feedback = ctx.createGain(); feedback.gain.value = clamp(Number(fx.delayFeedback??34)/100,0,.88);
    const delayWet = ctx.createGain(); delayWet.gain.value = applyMaster ? (project.master.delay || 0) / 100 * 0.8 : 0;
    delay.connect(delayTone); delayTone.connect(feedback).connect(delay); delayTone.connect(delayWet).connect(master);

    const reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx,clamp(Number(fx.reverbDecay||2.3),.3,6),2.7);
    const reverbTone=ctx.createBiquadFilter();reverbTone.type='lowpass';reverbTone.frequency.value=700*Math.pow(24,clamp(Number(fx.reverbTone??72)/100,0,1));
    const reverbWet = ctx.createGain(); reverbWet.gain.value = applyMaster ? (project.master.reverb || 0) / 100 * 0.72 : 0;
    reverb.connect(reverbTone).connect(reverbWet).connect(master);

    const channels = {};
    const anySolo = !trackFilter && Object.values(project.mixer).some(m => m.solo);
    T.TRACKS.forEach(track => {
      if (trackFilter && track.id !== trackFilter) return;
      const m = project.mixer[track.id];
      const input = ctx.createGain();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 25;
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 130; low.gain.value = m.eqLow || 0;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 0.75; mid.gain.value = m.eqMid || 0;
      const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 5200; high.gain.value = m.eqHigh || 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 * Math.pow(100, (m.filter || 0) / 100);
      const gain = ctx.createGain(); const audible = !m.mute && (!anySolo || m.solo); gain.gain.value = audible ? m.volume / 100 : 0;
      const duck = ctx.createGain(); duck.gain.value = 1;
      const pan = ctx.createStereoPanner(); pan.pan.value = (m.pan || 0) / 100;
      const ds = ctx.createGain(); ds.gain.value = applyMaster ? (m.delaySend || 0) / 100 : 0;
      const rs = ctx.createGain(); rs.gain.value = applyMaster ? (m.reverbSend || 0) / 100 : 0;
      input.connect(hp).connect(low).connect(mid).connect(high).connect(lp).connect(gain).connect(duck).connect(pan).connect(master);
      pan.connect(ds).connect(delay); pan.connect(rs).connect(reverb);
      channels[track.id] = { input, gain, duck, lp, sidechain: clamp((m.sidechain || 0) / 100, 0, .95) };
    });
    return { master, drive, masterFilter, output, delayWet, reverbWet, channels, bassCutoff: project.master.bassCutoff || 1200 };
  }


  function scheduleDuck(graph, project, time) {
    const release = clamp((project.master.sidechainRelease || 180) / 1000, .06, .6);
    Object.values(graph.channels).forEach(ch => {
      if (!ch.sidechain) return;
      const floor = Math.max(.04, 1 - ch.sidechain);
      ch.duck.gain.setValueAtTime(1, time);
      ch.duck.gain.linearRampToValueAtTime(floor, time + .008);
      ch.duck.gain.exponentialRampToValueAtTime(1, time + release);
    });
  }

  function scheduleAutomation(graph, project, patternId, stepIndex, time) {
    const pat = project.patterns[patternId];
    if (!pat || !pat.automation) return;
    const value = key => clamp((pat.automation[key] && pat.automation[key][stepIndex]) ?? 0, 0, 100) / 100;
    graph.masterFilter.frequency.setValueAtTime(300 * Math.pow(60, value('filter')), time);
    graph.delayWet.gain.setValueAtTime(value('delay') * .8, time);
    graph.reverbWet.gain.setValueAtTime(value('reverb') * .72, time);
    graph.output.gain.setValueAtTime(value('master'), time);
    graph.drive.curve = distortionCurve(value('drive'));
    graph.bassCutoff = 100 + Math.pow(value('acidCutoff'),1.8) * 6900;
  }

  function reverseForContext(ctx, buffer) {
    const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch), dst = out.getChannelData(ch);
      for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j];
    }
    return out;
  }

  function env(ctx, time, attack, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    return g;
  }

  function synthHit(ctx, graph, nbuf, project, track, step, time, dur, customSamples) {
    const ch = graph.channels[track];
    if (!ch) return;
    const velocity = (step.velocity || 100) / 127;
    const sample = customSamples && customSamples[track];
    if (sample) {
      const source = ctx.createBufferSource();
      const sg = project.sampler[track] || { start:0, end:1, gain:1, reverse:false };
      const useSample = sg.reverse ? reverseForContext(ctx, sample) : sample;
      source.buffer = useSample;
      source.playbackRate.value = Math.pow(2, (step.pitch || 0) / 12);
      const g = ctx.createGain(); g.gain.value = velocity * (sg.gain || 1);
      source.connect(g).connect(ch.input);
      const start = clamp(sg.start || 0, 0, 0.999) * useSample.duration;
      const end = clamp(sg.end ?? 1, 0.001, 1) * useSample.duration;
      const len = Math.max(0.005, end - start);
      source.start(time, start, len);
      return;
    }

    if (track === 'kick') {
      const o = ctx.createOscillator(); const g = env(ctx, time, 0.002, Math.min(1.3, velocity * (step.accent ? 1.16 : 1)), 0.42);
      const base = 52 * Math.pow(2, (step.pitch || 0) / 12); o.type = 'sine';
      o.frequency.setValueAtTime(base * 3.1, time); o.frequency.exponentialRampToValueAtTime(base, time + 0.055);
      o.connect(g).connect(ch.input); o.start(time); o.stop(time + 0.5);
      const click=ctx.createBufferSource(),cf=ctx.createBiquadFilter(),cg=env(ctx,time,.001,.15*velocity,.024);click.buffer=nbuf;cf.type='highpass';cf.frequency.value=4600;click.connect(cf).connect(cg).connect(ch.input);click.start(time);click.stop(time+.03);return;
    }
    if (['clap','chh','ohh','perc'].includes(track)) {
      const s = ctx.createBufferSource(); s.buffer = nbuf;
      const f = ctx.createBiquadFilter(); const g = ctx.createGain(); let hitDur = 0.1;
      if (track === 'clap') { f.type='bandpass'; f.frequency.value=1750; f.Q.value=.6; hitDur=.16; }
      else if (track === 'chh') { f.type='highpass'; f.frequency.value=6500; hitDur=.045; }
      else if (track === 'ohh') { f.type='highpass'; f.frequency.value=5800; hitDur=.28; }
      else { f.type='bandpass'; f.frequency.value=950; f.Q.value=2; hitDur=.11; }
      g.gain.setValueAtTime(.0001,time); g.gain.linearRampToValueAtTime(velocity,time+.002); g.gain.exponentialRampToValueAtTime(.0001,time+hitDur);
      s.connect(f).connect(g).connect(ch.input); s.start(time); s.stop(time+hitDur+.02); return;
    }
    if (track === 'bass' || track === 'acid') {
      const o=ctx.createOscillator(), f=ctx.createBiquadFilter(), g=ctx.createGain();
      o.type=track==='acid'?'sawtooth':'square'; o.frequency.value=midiHz(36+(step.pitch||0));
      f.type='lowpass'; const base=graph.bassCutoff||project.master.bassCutoff||1200, lock=.3+((step.cutoff||60)/100)*1.7;
      f.frequency.setValueAtTime(Math.min(9000,base*lock),time); f.frequency.exponentialRampToValueAtTime(Math.max(120,Math.min(3500,base*.45)),time+dur*.75); f.Q.value=project.master.bassRes||14;
      g.gain.setValueAtTime(.0001,time); g.gain.exponentialRampToValueAtTime(Math.max(.001,velocity*(step.accent?1.2:1)*.55),time+.006); g.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.04,dur*((step.gate||72)/100)));
      o.connect(f).connect(g).connect(ch.input); o.start(time); o.stop(time+dur+.08); return;
    }
    if (track === 'stab') {
      const g=env(ctx,time,.006,.34*velocity,.22), f=ctx.createBiquadFilter(); f.type='bandpass';f.frequency.value=1400;f.Q.value=1.1;
      [0,3,7].forEach(semi=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=midiHz(48+(step.pitch||0)+semi);o.connect(f);o.start(time);o.stop(time+.28);});
      f.connect(g).connect(ch.input);
    }
  }

  function midiSynth(ctx, graph, project, track, note, velocity, time, dur) {
    const ch=graph.channels[track]; if(!ch)return; const v=clamp((velocity||100)/127,.001,1);
    if(track==='stab'){const g=env(ctx,time,.005,.34*v,Math.max(.08,dur));const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1500;f.Q.value=1.05;[0,3,7].forEach(semi=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=midiHz(note+semi);o.connect(f);o.start(time);o.stop(time+dur+.05);});f.connect(g).connect(ch.input);return;}
    if(track==='bass'||track==='acid'){const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type=track==='acid'?'sawtooth':'square';o.frequency.value=midiHz(note);f.type='lowpass';const base=graph.bassCutoff||project.master.bassCutoff||1200;f.frequency.setValueAtTime(Math.min(9000,base*(track==='acid'?1.15:.8)),time);f.frequency.exponentialRampToValueAtTime(Math.max(120,base*.42),time+Math.max(.05,dur));f.Q.value=project.master.bassRes||14;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,v*.58),time+.006);g.gain.exponentialRampToValueAtTime(.0001,time+Math.max(.04,dur));o.connect(f).connect(g).connect(ch.input);o.start(time);o.stop(time+dur+.05);}
  }

  function arrangerMidiNotes(project,track,bar,stepInBar){const clip=activeArrangerClip(project,track,bar);if(!clip||clip.type!=='midi')return[];const mc=project.midiClips&&project.midiClips[clip.midiClipId];if(!mc)return[];const pos=(((bar-clip.bar)*16+stepInBar)%(mc.bars*16));return mc.notes.filter(n=>n.start===pos);}

  function lfoWave(type,p){p=((p%1)+1)%1;if(type==='triangle')return 1-4*Math.abs(p-.5);if(type==='square')return p<.5?1:-1;if(type==='saw')return p*2-1;return Math.sin(p*Math.PI*2);}
  function scheduleLfos(graph,project,global,time){const mods=project.modulation||{};['lfo1','lfo2'].forEach(k=>{const l=mods[k];if(!l||!l.enabled||l.target==='off')return;const phase=(l.sync?(global/16)*Math.max(.03125,Number(l.rate)||.5):time*Math.max(.03125,Number(l.rate)||.5))+(Number(l.phase)||0);const x=lfoWave(l.waveform,phase)*clamp((Number(l.depth)||0)/100,0,1);if(l.target==='masterFilter')graph.masterFilter.frequency.setValueAtTime(clamp((project.master.filter||16000)*Math.pow(2,x*2.2),300,18000),time);else if(l.target==='acidCutoff')graph.bassCutoff=clamp((project.master.bassCutoff||1200)*Math.pow(2,x*2.4),80,7000);else if(l.target==='delay')graph.delayWet.gain.setValueAtTime(clamp((project.master.delay||0)/100*.8+x*.18,0,.8),time);else if(l.target==='reverb')graph.reverbWet.gain.setValueAtTime(clamp((project.master.reverb||0)/100*.72+x*.15,0,.72),time);else if(l.target==='drive')graph.drive.curve=distortionCurve(clamp((project.master.drive||0)/100+x*.25,0,1));else if(l.target.endsWith('Filter')){const id=l.target.replace('Filter','');if(graph.channels[id])graph.channels[id].lp.frequency.setValueAtTime(clamp(250*Math.pow(60,clamp((project.mixer[id].filter||100)/100+x*.25,0,1)),180,18000),time);}});}

  function activeArrangerClip(project,track,bar){const clips=project.arranger.clips.filter(c=>c.track===track&&bar>=c.bar&&bar<c.bar+c.bars);return clips.length?clips[clips.length-1]:null;}
  function arrangerStep(project, track, bar, stepInBar) {
    const clip=activeArrangerClip(project,track,bar); if(!clip||clip.type==='midi')return null;
    const index=(((bar-clip.bar)*16)+stepInBar)%project.steps; return project.patterns[clip.pattern].tracks[track][index];
  }

  async function render(project, customSamples, options = {}) {
    const useArranger = options.arrangement !== false && project.arranger.enabled;
    const bars = useArranger ? project.arranger.lengthBars : Math.max(1, Number(options.bars) || 4);
    const stepDur = 60 / project.bpm / 4;
    const fx = project.master.fx || {};
    const reverbTail = clamp(Number(fx.reverbDecay || 2.3) + 0.75, 2.5, 8);
    const delayFeedback = clamp(Number(fx.delayFeedback ?? 34) / 100, 0, 0.88);
    const delayTail = clamp(Number(fx.delayTime || 0.375) * (1 / Math.max(0.12, 1 - delayFeedback)), 0.5, 10);
    const requestedTail = Number(options.tailSeconds || 0);
    const tailSeconds = requestedTail > 0 ? clamp(requestedTail, 0.25, 15) : Math.max(2.5, reverbTail, delayTail);
    const seconds = bars * 16 * stepDur + tailSeconds;
    const sampleRate = 44100;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('OfflineAudioContext no disponible');
    const ctx = new Offline(2, Math.ceil(seconds * sampleRate), sampleRate);
    const graph = buildGraph(ctx, project, options.trackFilter || null, options.applyMaster !== false);
    const nbuf = noise(ctx);

    for (let bar = 0; bar < bars; bar++) {
      for (let s = 0; s < 16; s++) {
        const global = bar * 16 + s;
        const time = global * stepDur + (global % 2 ? stepDur * (project.swing / 100) * 0.5 : 0);
        if (options.applyMaster !== false) {
          const automationPattern = useArranger ? project.arranger.automationPattern : project.currentPattern;
          scheduleAutomation(graph, project, automationPattern, global % project.steps, time);
          scheduleLfos(graph,project,global,time);
        }
        for (const tr of T.TRACKS) {
          if (options.trackFilter && tr.id !== options.trackFilter) continue;
          const step = useArranger
            ? arrangerStep(project, tr.id, bar, s)
            : project.patterns[project.currentPattern].tracks[tr.id][global % project.steps];
          if(useArranger && T.SYNTH_TRACKS.includes(tr.id)) arrangerMidiNotes(project,tr.id,bar,s).forEach(n=>midiSynth(ctx,graph,project,tr.id,n.note,n.velocity,time,Math.max(.04,n.length*stepDur*.92)));
          if (!step || !step.on || Math.random() * 100 > step.probability) continue;
          const ratchets = Math.max(1, step.ratchet || 1);
          for (let r = 0; r < ratchets; r++) {
            const hitTime = time + (step.micro || 0)/1000 + r*(stepDur/ratchets);
            if (tr.id === 'kick') scheduleDuck(graph, project, hitTime);
            synthHit(ctx, graph, nbuf, project, tr.id, step, hitTime, stepDur/ratchets, customSamples);
          }
        }
      }
    }
    return ctx.startRendering();
  }

  let crcTable = null;
  function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; crcTable[n]=c>>>0; }
    return crcTable;
  }
  function crc32(bytes) {
    const table=getCrcTable(); let c=0xffffffff;
    for(let i=0;i<bytes.length;i++) c=table[(c^bytes[i])&0xff]^(c>>>8);
    return (c^0xffffffff)>>>0;
  }
  function u16(n){return [n&255,(n>>>8)&255];}
  function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
  async function zipStore(entries) {
    const encoder = new TextEncoder();
    const locals=[], centrals=[]; let offset=0;
    for(const entry of entries){
      const name=encoder.encode(entry.name); const bytes=new Uint8Array(await entry.blob.arrayBuffer()); const crc=crc32(bytes);
      const local=new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(name.length),0,0,...name]);
      locals.push(local,bytes);
      const central=new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...name]);
      centrals.push(central); offset+=local.length+bytes.length;
    }
    const centralSize=centrals.reduce((a,b)=>a+b.length,0); const centralOffset=offset;
    const end=new Uint8Array([80,75,5,6,0,0,0,0,...u16(entries.length),...u16(entries.length),...u32(centralSize),...u32(centralOffset),0,0]);
    return new Blob([...locals,...centrals,end],{type:'application/zip'});
  }


  function processAudioBuffer(buffer, options = {}) {
    const normalize = !!options.normalize;
    const targetDb = Number.isFinite(Number(options.targetDb)) ? Number(options.targetDb) : -1;
    const targetPeak = Math.pow(10, targetDb / 20);
    const fadeInSeconds = clamp(Number(options.fadeIn || 0), 0, 10);
    const fadeOutSeconds = clamp(Number(options.fadeOut || 0), 0, 10);
    let peak = 0;
    if (normalize) {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      }
    }
    const gain = normalize && peak > 1e-7 ? clamp(targetPeak / peak, 0, 8) : 1;
    const fadeInSamples = Math.min(buffer.length, Math.round(fadeInSeconds * buffer.sampleRate));
    const fadeOutSamples = Math.min(buffer.length, Math.round(fadeOutSeconds * buffer.sampleRate));
    const fadeOutStart = buffer.length - fadeOutSamples;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        let scale = gain;
        if (fadeInSamples > 0 && i < fadeInSamples) scale *= i / fadeInSamples;
        if (fadeOutSamples > 0 && i >= fadeOutStart) scale *= Math.max(0, (buffer.length - 1 - i) / fadeOutSamples);
        data[i] = clamp(data[i] * scale, -1, 1);
      }
    }
    return { buffer, peakBefore: peak, appliedGain: gain };
  }

  function floatToInt16(value) {
    const sample = clamp(value, -1, 1);
    return sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
  }

  async function encodeMp3(buffer, bitrate = 320, onProgress) {
    if (!T.Codecs || typeof T.Codecs.ensureMp3 !== 'function') throw new Error('Módulo de codecs MP3 no disponible.');
    const lame = await T.Codecs.ensureMp3();
    const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
    const kbps = [128, 192, 256, 320].includes(Number(bitrate)) ? Number(bitrate) : 320;
    const encoder = new lame.Mp3Encoder(channels, buffer.sampleRate, kbps);
    const left = buffer.getChannelData(0);
    const right = channels > 1 ? buffer.getChannelData(1) : null;
    const blockSize = 1152;
    const chunks = [];
    let blockIndex = 0;
    for (let offset = 0; offset < buffer.length; offset += blockSize) {
      const count = Math.min(blockSize, buffer.length - offset);
      const l16 = new Int16Array(count);
      const r16 = channels > 1 ? new Int16Array(count) : null;
      for (let i = 0; i < count; i++) {
        l16[i] = floatToInt16(left[offset + i]);
        if (r16) r16[i] = floatToInt16(right[offset + i]);
      }
      const encoded = channels > 1 ? encoder.encodeBuffer(l16, r16) : encoder.encodeBuffer(l16);
      if (encoded && encoded.length) chunks.push(new Int8Array(encoded));
      blockIndex++;
      if (onProgress && (blockIndex % 24 === 0 || offset + count >= buffer.length)) onProgress((offset + count) / buffer.length);
      if (blockIndex % 48 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const tail = encoder.flush();
    if (tail && tail.length) chunks.push(new Int8Array(tail));
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    if (!blob.size) throw new Error('El encoder MP3 devolvió un archivo vacío.');
    return blob;
  }

  async function encodeFlac(buffer, compression = 5, onProgress) {
    if (!T.Codecs || typeof T.Codecs.ensureFlac !== 'function') throw new Error('Módulo de codecs FLAC no disponible.');
    const Flac = await T.Codecs.ensureFlac();
    const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));
    const rawCompression = Number(compression);
    const level = Math.round(clamp(Number.isFinite(rawCompression) ? rawCompression : 5, 0, 8));
    const bitsPerSample = 16;
    const encoder = Flac.create_libflac_encoder(buffer.sampleRate, channels, bitsPerSample, level, 0, false, 0);
    if (!encoder) throw new Error('No se pudo crear el encoder FLAC.');
    const chunks = [];
    const writeCallback = encodedData => {
      if (encodedData && encodedData.length) chunks.push(new Uint8Array(encodedData));
    };
    let initialized = false;
    let finished = false;
    try {
      const initStatus = Flac.init_encoder_stream(encoder, writeCallback, () => {});
      if (initStatus !== 0) throw new Error(`FLAC init status ${initStatus}`);
      initialized = true;
      const data = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
      const frameBlock = 4096;
      let blockIndex = 0;
      for (let offset = 0; offset < buffer.length; offset += frameBlock) {
        const frames = Math.min(frameBlock, buffer.length - offset);
        const pcm = new Int32Array(frames * channels);
        let pos = 0;
        for (let i = 0; i < frames; i++) {
          for (let ch = 0; ch < channels; ch++) pcm[pos++] = floatToInt16(data[ch][offset + i]);
        }
        const ok = Flac.FLAC__stream_encoder_process_interleaved(encoder, pcm, frames);
        if (!ok) throw new Error(`FLAC encode state ${Flac.FLAC__stream_encoder_get_state(encoder)}`);
        blockIndex++;
        if (onProgress && (blockIndex % 12 === 0 || offset + frames >= buffer.length)) onProgress((offset + frames) / buffer.length);
        if (blockIndex % 24 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      finished = !!Flac.FLAC__stream_encoder_finish(encoder);
      if (!finished) throw new Error(`FLAC finish state ${Flac.FLAC__stream_encoder_get_state(encoder)}`);
    } finally {
      try {
        if (initialized && !finished) Flac.FLAC__stream_encoder_finish(encoder);
      } catch (_) {}
      try { Flac.FLAC__stream_encoder_delete(encoder); } catch (_) {}
    }
    const blob = new Blob(chunks, { type: 'audio/flac' });
    if (!blob.size) throw new Error('El encoder FLAC devolvió un archivo vacío.');
    return blob;
  }

  async function renderMixBuffer(project, customSamples, bars, options = {}) {
    const audio = await render(project, customSamples, {
      bars,
      arrangement: true,
      applyMaster: true,
      tailSeconds: options.tailSeconds
    });
    processAudioBuffer(audio, options);
    return audio;
  }

  async function mixdownFormat(project, customSamples, bars, options = {}) {
    const format = String(options.format || 'wav').toLowerCase();
    if (format === 'mp3') {
      if (options.onProgress) options.onProgress('codec', 0.2);
      await T.Codecs.ensureMp3();
      if (options.onProgress) options.onProgress('codec', 1);
    } else if (format === 'flac') {
      if (options.onProgress) options.onProgress('codec', 0.2);
      await T.Codecs.ensureFlac();
      if (options.onProgress) options.onProgress('codec', 1);
    }
    if (options.onProgress) options.onProgress('render', 0.05);
    const audio = await renderMixBuffer(project, customSamples, bars, options);
    if (options.onProgress) options.onProgress('render', 1);
    if (format === 'wav') return { blob: encodeWav(audio), extension: 'wav', mime: 'audio/wav' };
    if (format === 'mp3') {
      const blob = await encodeMp3(audio, options.mp3Bitrate, ratio => options.onProgress && options.onProgress('encode', ratio));
      return { blob, extension: 'mp3', mime: 'audio/mpeg' };
    }
    if (format === 'flac') {
      const blob = await encodeFlac(audio, options.flacCompression, ratio => options.onProgress && options.onProgress('encode', ratio));
      return { blob, extension: 'flac', mime: 'audio/flac' };
    }
    throw new Error(`Formato de exportación no soportado: ${format}`);
  }

  T.Export = {
    encodeWav,
    encodeMp3,
    encodeFlac,
    processAudioBuffer,
    renderMixBuffer,
    mixdownFormat,
    download,
    async mixdown(project, customSamples, bars, options = {}) {
      const audio = await renderMixBuffer(project, customSamples, bars, options);
      return encodeWav(audio);
    },
    _zipStore: zipStore,
    async stemsZip(project, customSamples, bars, progress) {
      const entries=[];
      for(let i=0;i<T.TRACKS.length;i++){
        const track=T.TRACKS[i];
        if(progress) progress(i, T.TRACKS.length, track.name);
        const audio=await render(project, customSamples, { bars, arrangement:true, trackFilter:track.id, applyMaster:false });
        entries.push({name:`${String(i+1).padStart(2,'0')}_${track.id}.wav`,blob:encodeWav(audio)});
      }
      if(progress) progress(T.TRACKS.length,T.TRACKS.length,'ZIP');
      return zipStore(entries);
    }
  };
})();
