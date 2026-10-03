'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

global.window = global;
global.document = {
  createElement(){ return {style:{}, click(){}, remove(){}}; },
  body:{appendChild(){}},
};
global.URL = global.URL || {createObjectURL(){return 'blob:test';},revokeObjectURL(){}};

const mem = new Map();
global.localStorage = {
  getItem:k => mem.has(k) ? mem.get(k) : null,
  setItem:(k,v) => mem.set(k,String(v)),
  removeItem:k => mem.delete(k)
};

function load(file){
  const code = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  vm.runInThisContext(code,{filename:file});
}
function hits(pattern){
  return Techno404.TRACKS.reduce((sum,t)=>sum+pattern.tracks[t.id].filter(s=>s.on).length,0);
}

(async()=>{
  load('js/state.js');
  load('js/genres.js');
  load('js/arranger.js');
  load('js/midi-clips.js');
  load('js/generator.js');
  load('js/storage.js');
  load('js/exporter.js');

  // Factory semantics: factory used by CLEAR PATTERN must actually be empty.
  const seeded = Techno404.makeDefaultProject().patterns.A1;
  assert(hits(seeded) > 0, 'A1 de fábrica debe seguir siendo un groove demo');
  const empty = Techno404.makeEmptyPattern();
  assert.strictEqual(hits(empty),0,'makeEmptyPattern debe estar realmente vacío');
  for(const p of Techno404.AUTOMATION_PARAMS) assert.strictEqual(empty.automation[p].length,64,`automation ${p}`);

  // Normalization / hostile values.
  const normalized = Techno404.normalizeProject({
    bpm:999, swing:-20, steps:13, name:'x'.repeat(200),
    master:{volume:999,filter:1,bassRes:999},
    arranger:{lengthBars:999,clips:[{track:'nope',bar:999,bars:999,pattern:'ZZ'}]},
    midiClips:{bad:{id:'bad',track:'kick',bars:99,notes:[{start:999,length:999,note:999,velocity:999}]}}
  });
  assert.strictEqual(normalized.bpm,210);
  assert.strictEqual(normalized.swing,0);
  assert.strictEqual(normalized.steps,64);
  assert.strictEqual(normalized.name.length,80);
  assert.strictEqual(normalized.master.volume,100);
  assert.strictEqual(normalized.master.filter,300);
  assert.strictEqual(normalized.master.bassRes,28);
  assert.strictEqual(normalized.arranger.lengthBars,64);
  assert.strictEqual(normalized.midiClips.bad.track,'acid');
  assert.strictEqual(normalized.midiClips.bad.bars,8);

  // MIDI clip operations.
  Techno404.State.project = Techno404.makeDefaultProject();
  const mc = Techno404.MidiClips.create('acid',2,'QA');
  const note = Techno404.MidiClips.addNote(mc.id,31,60,8,127);
  assert.strictEqual(note.length,1,'nota debe truncarse al final del clip');
  Techno404.MidiClips.resize(mc.id,1);
  assert(mc.notes.every(n=>n.start<16),'resize debe eliminar notas fuera de rango');

  // Arranger operations and sanitization.
  const ac = Techno404.Arranger.addClip('kick','A1',7,8);
  assert.strictEqual(ac.bar,7);
  assert.strictEqual(ac.bars,1);
  assert(Techno404.Arranger.moveClip(ac.id,'acid',0));
  assert.strictEqual(ac.track,'acid');
  Techno404.State.project.arranger.lengthBars=4;
  Techno404.Arranger.sanitize();
  assert(Techno404.State.project.arranger.clips.every(c=>c.bar<4 && c.bar+c.bars<=4));

  // Generator remains inside valid state ranges.
  Techno404.State.project = Techno404.makeDefaultProject();
  Techno404.Generator.generate('industrial',95,90,90);
  assert(Techno404.State.project.bpm>=70 && Techno404.State.project.bpm<=210);
  for(const t of Techno404.TRACKS){
    for(const s of Techno404.State.project.patterns[Techno404.State.project.currentPattern].tracks[t.id]){
      assert(s.velocity>=1 && s.velocity<=127);
      assert(s.probability>=1 && s.probability<=100);
    }
  }

  // V4.3 genre engine: every mode must generate a usable groove and genre-specific arrangement.
  const genreCases=[
    ['techno','hypnotic',134],['tech-house','rolling',126],['house','classic',124],['deep-house','warm',122],['acid-house','chicago303',126]
  ];
  for(const [genre,style,expectedBpm] of genreCases){
    Techno404.State.project=Techno404.makeDefaultProject();
    Techno404.State.project.patterns.A1=Techno404.makeEmptyPattern();
    Techno404.State.project.currentPattern='A1';
    Techno404.Genres.apply(Techno404.State.project,genre);
    Techno404.Generator.generate(style,72,70,58);
    assert.strictEqual(Techno404.State.project.genre,genre);
    assert.strictEqual(Techno404.State.project.bpm,expectedBpm);
    assert(hits(Techno404.State.project.patterns.A1)>0,`${genre} debe generar golpes`);
    Techno404.Generator.createArrangement();
    assert.strictEqual(Techno404.State.project.arranger.lengthBars,32,`${genre} arranger debe ser 32 bars`);
    assert(Techno404.State.project.arranger.clips.length>0,`${genre} debe crear clips`);
    if(genre==='acid-house') assert(Techno404.State.project.patterns.A1.tracks.acid.some(s=>s.on),'Acid House debe usar la pista ACID');
  }

  // Legacy project without genre must migrate safely to techno.
  assert.strictEqual(Techno404.normalizeProject({name:'Legacy'}).genre,'techno');

  // Storage must fail closed instead of crashing when localStorage is blocked.
  assert.strictEqual(Techno404.Storage.saveProject(Techno404.State.project),true);
  const originalSet=localStorage.setItem;
  localStorage.setItem=()=>{throw new Error('quota');};
  assert.strictEqual(Techno404.Storage.saveProject(Techno404.State.project),false);
  localStorage.setItem=originalSet;

  // WAV header and ZIP store format.
  const fakeBuffer={numberOfChannels:2,length:4,sampleRate:44100,getChannelData(){return new Float32Array([0,.5,-.5,1]);}};
  const wav=Techno404.Export.encodeWav(fakeBuffer);
  const wavBytes=new Uint8Array(await wav.arrayBuffer());
  assert.strictEqual(Buffer.from(wavBytes.slice(0,4)).toString('ascii'),'RIFF');
  assert.strictEqual(Buffer.from(wavBytes.slice(8,12)).toString('ascii'),'WAVE');
  const zip=await Techno404.Export._zipStore([{name:'qa.txt',blob:new Blob(['ok'])}]);
  const zipBytes=new Uint8Array(await zip.arrayBuffer());
  assert.deepStrictEqual([...zipBytes.slice(0,4)],[0x50,0x4b,0x03,0x04]);

  // Export post-processing: normalization/fades must remain bounded.
  const procLeft=new Float32Array([.2,.4,.4,.2]);
  const procRight=new Float32Array([.2,.4,.4,.2]);
  const procBuffer={numberOfChannels:2,length:4,sampleRate:4,getChannelData(ch){return ch?procRight:procLeft;}};
  const proc=Techno404.Export.processAudioBuffer(procBuffer,{normalize:true,targetDb:-1,fadeIn:.5,fadeOut:.5});
  assert(proc.appliedGain>1,'normalize debe elevar una señal baja');
  assert.strictEqual(procLeft[0],0,'fade in debe comenzar en cero');
  assert(Math.abs(procLeft[2])<=1,'procesado no debe superar 0 dBFS');
  assert.strictEqual(procLeft[3],0,'fade out debe terminar en cero');

  // Codec wrappers with deterministic fakes: validates chunking / Blob assembly without claiming browser codec QA.
  class FakeMp3Encoder{
    constructor(channels,sampleRate,bitrate){this.channels=channels;this.sampleRate=sampleRate;this.bitrate=bitrate;}
    encodeBuffer(left,right){assert(left instanceof Int16Array);if(this.channels===2)assert(right instanceof Int16Array);return new Int8Array([1,2,3]);}
    flush(){return new Int8Array([4,5]);}
  }
  let flacWrite=null;
  const FakeFlac={
    create_libflac_encoder(){return 7;},
    init_encoder_stream(id,write){assert.strictEqual(id,7);flacWrite=write;return 0;},
    FLAC__stream_encoder_process_interleaved(id,pcm,frames){assert.strictEqual(id,7);assert(pcm instanceof Int32Array);assert(frames>0);flacWrite(new Uint8Array([0x66,0x4c,0x61,0x43]));return true;},
    FLAC__stream_encoder_finish(){return true;},
    FLAC__stream_encoder_delete(){},
    FLAC__stream_encoder_get_state(){return 0;}
  };
  Techno404.Codecs={ensureMp3:async()=>({Mp3Encoder:FakeMp3Encoder}),ensureFlac:async()=>FakeFlac};
  const codecBuffer={numberOfChannels:2,length:2304,sampleRate:44100,getChannelData(){return new Float32Array(2304).fill(.1);}};
  const mp3=await Techno404.Export.encodeMp3(codecBuffer,320);
  assert.strictEqual(mp3.type,'audio/mpeg');
  assert(mp3.size>0,'MP3 fake debe producir datos');
  const flac=await Techno404.Export.encodeFlac(codecBuffer,5);
  assert.strictEqual(flac.type,'audio/flac');
  assert(flac.size>0,'FLAC fake debe producir datos');

  console.log('PASS logic-tests: 5 genre modes + export multiformato + invariantes');
})().catch(err=>{console.error(err);process.exit(1);});
