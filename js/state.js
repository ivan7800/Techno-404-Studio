window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;

  T.TRACKS = [
    { id: 'kick', name: 'KICK', color: '#55f59d', kind: 'drum' },
    { id: 'clap', name: 'CLAP', color: '#ffc857', kind: 'drum' },
    { id: 'chh', name: 'CLOSED HH', color: '#7dd3fc', kind: 'drum' },
    { id: 'ohh', name: 'OPEN HH', color: '#38bdf8', kind: 'drum' },
    { id: 'perc', name: 'PERC', color: '#c084fc', kind: 'drum' },
    { id: 'bass', name: 'BASS', color: '#f472b6', kind: 'synth' },
    { id: 'stab', name: 'STAB', color: '#fb7185', kind: 'synth' },
    { id: 'acid', name: 'ACID', color: '#a3e635', kind: 'synth' }
  ];
  T.SYNTH_TRACKS = ['bass', 'stab', 'acid'];
  T.PATTERN_IDS = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'];
  T.AUTOMATION_PARAMS = ['filter','delay','reverb','master','drive','acidCutoff'];
  T.LFO_TARGETS = ['off','masterFilter','acidCutoff','delay','reverb','drive','bassFilter','stabFilter','acidFilter'];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const asNum = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const uid = (prefix='id') => `${prefix}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;

  const makeStep = () => ({
    on: false, velocity: 100, probability: 100, ratchet: 1, pitch: 0, micro: 0,
    accent: false, glide: false, cutoff: 60, gate: 72
  });

  const makePattern = () => {
    const tracks = {};
    T.TRACKS.forEach(track => { tracks[track.id] = Array.from({ length: 64 }, makeStep); });
    return {
      tracks,
      automation: {
        filter: Array(64).fill(90), delay: Array(64).fill(15), reverb: Array(64).fill(10),
        master: Array(64).fill(82), drive: Array(64).fill(18), acidCutoff: Array(64).fill(42)
      }
    };
  };

  function seedDemoPattern(pat, variation = false) {
    for (let i = 0; i < 64; i++) {
      const q = i % 16;
      if (q % 4 === 0) { const s=pat.tracks.kick[i]; s.on=true; s.velocity=q===0?124:116; s.accent=q===0; }
      if (q === 4 || q === 12) { const s=pat.tracks.clap[i]; s.on=true; s.velocity=100; }
      if (q % 2 === 0) { const s=pat.tracks.chh[i]; s.on=true; s.velocity=q%4===2?78:66; s.probability=96; }
      if ([2,10].includes(q)) { const s=pat.tracks.ohh[i]; s.on=true; s.velocity=72; s.probability=80; }
      if ([3,11,15].includes(q) && variation) { const s=pat.tracks.perc[i]; s.on=true; s.velocity=72; s.pitch=q===15?2:-2; }
      if ([0,6,10,14].includes(q)) { const s=pat.tracks.bass[i]; s.on=true; s.velocity=96; s.pitch=[0,0,-2,3][[0,6,10,14].indexOf(q)]-12; s.gate=58; }
      if (variation && [0,4,7,10,14].includes(q)) { const s=pat.tracks.acid[i]; s.on=true; s.velocity=q===10?120:98; s.pitch=[0,3,5,7,10][[0,4,7,10,14].indexOf(q)]-12; s.cutoff=45+q*3; s.glide=q===7||q===14; s.accent=q===10; s.gate=66; }
      if (variation && (q===4||q===12)) { const s=pat.tracks.stab[i]; s.on=true; s.velocity=76; s.pitch=q===12?3:0; s.probability=72; }
    }
  }

  const makeMixerChannel = id => ({
    volume: id==='kick'?90:82, pan: 0, mute: false, solo: false, filter: 100,
    eqLow: 0, eqMid: 0, eqHigh: 0, delaySend: id==='stab'?22:10,
    reverbSend: id==='stab'?18:7, sidechain: ['bass','stab','acid'].includes(id)?32:0
  });

  const makeSamplerChannel = () => ({ name:'', start:0, end:1, gain:1, reverse:false });

  const makeMidiClip = (name='MIDI 1', track='acid', bars=2) => ({
    id: uid('midi'), name, track, bars: clamp(Math.round(bars),1,8), root: 36,
    notes: [
      { id:uid('note'), start:0, length:2, note:36, velocity:112 },
      { id:uid('note'), start:4, length:1, note:39, velocity:96 },
      { id:uid('note'), start:7, length:2, note:43, velocity:118 },
      { id:uid('note'), start:10, length:1, note:41, velocity:92 },
      { id:uid('note'), start:14, length:2, note:46, velocity:120 }
    ]
  });

  const defaultClips = () => {
    const clips=[];
    T.TRACKS.forEach(track => {
      clips.push({ id:uid('clip'), type:'pattern', track:track.id, pattern:'A1', midiClipId:null, bar:0, bars:4 });
      clips.push({ id:uid('clip'), type:'pattern', track:track.id, pattern:'B1', midiClipId:null, bar:4, bars:4 });
    });
    return clips;
  };

  const makePad = i => ({ id:`pad${i+1}`, name:`PAD ${String(i+1).padStart(2,'0')}`, fileName:'', gain:1, pitch:0, choke:0 });

  function makeDefaultProject() {
    const patterns={}; T.PATTERN_IDS.forEach(id=>{patterns[id]=makePattern();});
    seedDemoPattern(patterns.A1,false); seedDemoPattern(patterns.B1,true);
    const mixer={}, sampler={}; T.TRACKS.forEach(t=>{mixer[t.id]=makeMixerChannel(t.id);sampler[t.id]=makeSamplerChannel();});
    const firstMidi = makeMidiClip('Acid Hook','acid',2);
    return {
      version: 4,
      name:'Untitled Techno', genre:'techno', bpm:136, swing:10, steps:64, currentPattern:'A1',
      patterns, mixer, sampler,
      master:{
        volume:82, filter:16000, drive:18, delay:15, reverb:10, bassCutoff:1200, bassRes:15,
        compressor:38, limiterEnabled:true, limiterCeiling:-1, sidechainRelease:180,
        fx:{ delayTime:0.375, delayFeedback:34, delayTone:68, reverbDecay:2.3, reverbTone:72 }
      },
      modulation:{
        lfo1:{ enabled:false, target:'acidCutoff', waveform:'sine', rate:0.5, sync:true, depth:35, phase:0 },
        lfo2:{ enabled:false, target:'masterFilter', waveform:'triangle', rate:0.25, sync:true, depth:22, phase:0.25 }
      },
      midiClips:{ [firstMidi.id]: firstMidi },
      selectedMidiClipId:firstMidi.id,
      pads:Array.from({length:16},(_,i)=>makePad(i)),
      sampleLibrary:[],
      arranger:{ enabled:false, lengthBars:8, loop:true, automationPattern:'A1', zoom:1, clips:defaultClips() },
      song:{ chain:'A1,A1,A2,B1,B1,C1,C1,D1', repeats:2 }
    };
  }

  function normalizeStep(src,dst){
    const s=src||{}; dst.on=!!s.on; dst.velocity=clamp(asNum(s.velocity,100),1,127); dst.probability=clamp(asNum(s.probability,100),1,100);
    dst.ratchet=clamp(Math.round(asNum(s.ratchet,1)),1,4); dst.pitch=clamp(asNum(s.pitch,0),-24,36); dst.micro=clamp(asNum(s.micro,0),-40,40);
    dst.accent=!!s.accent; dst.glide=!!s.glide; dst.cutoff=clamp(asNum(s.cutoff,60),0,100); dst.gate=clamp(asNum(s.gate,72),5,100);
  }

  function normalizeMidiClip(src, fallbackTrack='acid') {
    const bars=clamp(Math.round(asNum(src&&src.bars,2)),1,8);
    const total=bars*16;
    const track=T.SYNTH_TRACKS.includes(src&&src.track)?src.track:fallbackTrack;
    return {
      id:String(src&&src.id||uid('midi')).slice(0,80), name:String(src&&src.name||'MIDI Clip').slice(0,80), track, bars,
      root:clamp(Math.round(asNum(src&&src.root,36)),24,72),
      notes:Array.isArray(src&&src.notes)?src.notes.map(n=>({
        id:String(n.id||uid('note')).slice(0,80), start:clamp(Math.round(asNum(n.start,0)),0,total-1),
        length:clamp(Math.round(asNum(n.length,1)),1,Math.max(1,total)), note:clamp(Math.round(asNum(n.note,36)),24,84),
        velocity:clamp(Math.round(asNum(n.velocity,100)),1,127)
      })).map(n=>({...n,length:Math.min(n.length,total-n.start)})):[]
    };
  }

  function normalize(raw){
    const base=makeDefaultProject(); if(!raw||typeof raw!=='object')return base;
    base.name=String(raw.name||base.name).slice(0,80); base.genre=['techno','tech-house','house','deep-house','acid-house'].includes(raw.genre)?raw.genre:'techno'; base.bpm=clamp(asNum(raw.bpm,base.bpm),70,210); base.swing=clamp(asNum(raw.swing,base.swing),0,70);
    base.steps=[16,32,64].includes(Number(raw.steps))?Number(raw.steps):64; base.currentPattern=T.PATTERN_IDS.includes(raw.currentPattern)?raw.currentPattern:'A1';

    if(raw.master&&typeof raw.master==='object'){
      const m=raw.master; ['volume','filter','drive','delay','reverb','bassCutoff','bassRes','compressor','limiterCeiling','sidechainRelease'].forEach(k=>{if(k in m)base.master[k]=asNum(m[k],base.master[k]);});
      base.master.volume=clamp(base.master.volume,0,100); base.master.filter=clamp(base.master.filter,300,18000); base.master.drive=clamp(base.master.drive,0,100);
      base.master.delay=clamp(base.master.delay,0,100); base.master.reverb=clamp(base.master.reverb,0,100); base.master.bassCutoff=clamp(base.master.bassCutoff,80,7000);
      base.master.bassRes=clamp(base.master.bassRes,0,28); base.master.compressor=clamp(base.master.compressor,0,100); base.master.limiterEnabled=m.limiterEnabled!==false;
      base.master.limiterCeiling=clamp(base.master.limiterCeiling,-12,0); base.master.sidechainRelease=clamp(base.master.sidechainRelease,60,600);
      if(m.fx&&typeof m.fx==='object'){
        const f=m.fx; base.master.fx.delayTime=clamp(asNum(f.delayTime,base.master.fx.delayTime),0.0625,1.5); base.master.fx.delayFeedback=clamp(asNum(f.delayFeedback,34),0,88);
        base.master.fx.delayTone=clamp(asNum(f.delayTone,68),0,100); base.master.fx.reverbDecay=clamp(asNum(f.reverbDecay,2.3),0.3,6); base.master.fx.reverbTone=clamp(asNum(f.reverbTone,72),0,100);
      }
    }

    T.TRACKS.forEach(track=>{
      const srcMix=raw.mixer&&raw.mixer[track.id]; if(srcMix&&typeof srcMix==='object'){
        const d=base.mixer[track.id]; d.volume=clamp(asNum(srcMix.volume,d.volume),0,100); d.pan=clamp(asNum(srcMix.pan,d.pan),-100,100); d.mute=!!srcMix.mute; d.solo=!!srcMix.solo;
        d.filter=clamp(asNum(srcMix.filter,d.filter),0,100); d.eqLow=clamp(asNum(srcMix.eqLow,d.eqLow),-18,18); d.eqMid=clamp(asNum(srcMix.eqMid,d.eqMid),-18,18); d.eqHigh=clamp(asNum(srcMix.eqHigh,d.eqHigh),-18,18);
        d.delaySend=clamp(asNum(srcMix.delaySend,d.delaySend),0,100); d.reverbSend=clamp(asNum(srcMix.reverbSend,d.reverbSend),0,100); d.sidechain=clamp(asNum(srcMix.sidechain,d.sidechain),0,100);
      }
      const ss=raw.sampler&&raw.sampler[track.id]; if(ss&&typeof ss==='object'){
        const d=base.sampler[track.id]; d.name=String(ss.name||'').slice(0,120); d.start=clamp(asNum(ss.start,0),0,.999); d.end=clamp(asNum(ss.end,1),.001,1); if(d.end<=d.start)d.end=Math.min(1,d.start+.01); d.gain=clamp(asNum(ss.gain,1),0,2); d.reverse=!!ss.reverse;
      }
    });

    T.PATTERN_IDS.forEach(pid=>{
      const src=raw.patterns&&raw.patterns[pid]; if(!src||typeof src!=='object')return;
      T.TRACKS.forEach(track=>{const arr=src.tracks&&src.tracks[track.id]; if(!Array.isArray(arr))return; for(let i=0;i<Math.min(64,arr.length);i++)normalizeStep(arr[i],base.patterns[pid].tracks[track.id][i]);});
      T.AUTOMATION_PARAMS.forEach(param=>{const arr=src.automation&&src.automation[param]; if(!Array.isArray(arr))return; for(let i=0;i<Math.min(64,arr.length);i++)base.patterns[pid].automation[param][i]=clamp(asNum(arr[i],base.patterns[pid].automation[param][i]),0,100);});
    });

    base.midiClips={};
    if(raw.midiClips&&typeof raw.midiClips==='object') Object.values(raw.midiClips).forEach(c=>{const mc=normalizeMidiClip(c);base.midiClips[mc.id]=mc;});
    if(!Object.keys(base.midiClips).length){const mc=makeMidiClip('Acid Hook','acid',2);base.midiClips[mc.id]=mc;}
    base.selectedMidiClipId=base.midiClips[raw.selectedMidiClipId]?raw.selectedMidiClipId:Object.keys(base.midiClips)[0];

    if(Array.isArray(raw.pads)) base.pads=Array.from({length:16},(_,i)=>{const src=raw.pads[i]||makePad(i);return {id:`pad${i+1}`,name:String(src.name||`PAD ${i+1}`).slice(0,60),fileName:String(src.fileName||'').slice(0,120),gain:clamp(asNum(src.gain,1),0,2),pitch:clamp(asNum(src.pitch,0),-24,24),choke:clamp(Math.round(asNum(src.choke,0)),0,4)};});
    if(Array.isArray(raw.sampleLibrary)) base.sampleLibrary=raw.sampleLibrary.map(x=>({id:String(x.id||uid('sample')).slice(0,80),name:String(x.name||'Sample').slice(0,120),size:Math.max(0,Math.round(asNum(x.size,0))),type:String(x.type||'audio/*').slice(0,80),updatedAt:asNum(x.updatedAt,Date.now())})).slice(0,500);

    if(raw.modulation&&typeof raw.modulation==='object'){
      ['lfo1','lfo2'].forEach(key=>{const src=raw.modulation[key];if(!src||typeof src!=='object')return;const d=base.modulation[key];d.enabled=!!src.enabled;d.target=T.LFO_TARGETS.includes(src.target)?src.target:d.target;d.waveform=['sine','triangle','square','saw'].includes(src.waveform)?src.waveform:d.waveform;d.rate=clamp(asNum(src.rate,d.rate),.03125,16);d.sync=src.sync!==false;d.depth=clamp(asNum(src.depth,d.depth),0,100);d.phase=clamp(asNum(src.phase,d.phase),0,1);});
    }

    if(raw.arranger&&typeof raw.arranger==='object'){
      const a=raw.arranger; base.arranger.enabled=!!a.enabled; base.arranger.lengthBars=clamp(Math.round(asNum(a.lengthBars,8)),1,64); base.arranger.loop=a.loop!==false; base.arranger.zoom=clamp(asNum(a.zoom,1),.5,2.5);
      base.arranger.automationPattern=T.PATTERN_IDS.includes(a.automationPattern)?a.automationPattern:'A1';
      if(Array.isArray(a.clips)) base.arranger.clips=a.clips.map(c=>{
        const track=T.TRACKS.some(t=>t.id===c.track)?c.track:'kick'; const type=c.type==='midi'&&T.SYNTH_TRACKS.includes(track)?'midi':'pattern';
        const candidateMidi=base.midiClips[c.midiClipId]?c.midiClipId:null;
        return {id:String(c.id||uid('clip')).slice(0,80),type,track,pattern:T.PATTERN_IDS.includes(c.pattern)?c.pattern:'A1',midiClipId:type==='midi'?(candidateMidi||base.selectedMidiClipId):null,bar:clamp(Math.floor(asNum(c.bar,0)),0,63),bars:clamp(Math.floor(asNum(c.bars,1)),1,16)};
      }).filter(c=>c.bar<base.arranger.lengthBars).map(c=>({...c,bars:Math.min(c.bars,base.arranger.lengthBars-c.bar)}));
    }

    if(raw.song&&typeof raw.song==='object'){base.song.chain=String(raw.song.chain||base.song.chain).slice(0,220);base.song.repeats=clamp(Math.round(asNum(raw.song.repeats,2)),1,16);}
    base.version=4.3;
    return base;
  }

  T.makeDefaultProject=makeDefaultProject; T.makeEmptyPattern=makePattern; T.makeStep=makeStep; T.makeMidiClip=makeMidiClip; T.uid=uid; T.normalizeProject=normalize;
  T.State={
    project:makeDefaultProject(), selectedTrack:'kick', selectedStep:null, selectedClipId:null, selectedMidiNoteId:null, selectedPad:0, clipboard:null, history:[], future:[],
    clone(v){return JSON.parse(JSON.stringify(v));},
    snapshot(){this.history.push(this.clone(this.project));if(this.history.length>50)this.history.shift();this.future.length=0;},
    undo(){if(!this.history.length)return false;this.future.push(this.clone(this.project));this.project=this.history.pop();return true;},
    redo(){if(!this.future.length)return false;this.history.push(this.clone(this.project));this.project=this.future.pop();return true;},
    reset(){this.project=makeDefaultProject();this.selectedTrack='kick';this.selectedStep=null;this.selectedClipId=null;this.selectedMidiNoteId=null;this.selectedPad=0;this.clipboard=null;this.history=[];this.future=[];},
    normalize(raw){return normalize(raw);}
  };
})();
