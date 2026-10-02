window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T=window.Techno404, S=T.State;
  const $=s=>document.querySelector(s);
  const uiColor=(name,fallback)=>T.PremiumUI?.cssVar(name,fallback)||getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  let R=null, libraryRows=[], padRows=[], selectedLibraryId=null, padsActivated=false, draggingNote=null;
  const padKeys=['1','2','3','4','q','w','e','r','z','x','c','v','5','6','7','8'];
  const p=()=>S.project;
  const currentMidi=()=>T.MidiClips.get(p().selectedMidiClipId);
  const noteName=m=>`${notes[m%12]}${Math.floor(m/12)-1}`;

  async function activateAudio(){
    if(padsActivated||!R)return;
    for(const row of padRows){try{await R.engine.loadPadSample(Number(row.pad),row.buffer);}catch(e){console.warn('Pad restore',e);}}
    padsActivated=true;
  }

  function fillSelect(el,items,value){if(!el)return;const old=value??el.value;el.innerHTML='';items.forEach(([label,val])=>el.add(new Option(label,val)));if([...el.options].some(o=>o.value===String(old)))el.value=String(old);}

  function renderMidiControls(){
    const clips=T.MidiClips.all(), c=currentMidi();
    fillSelect($('#midiClipSelect'),clips.map(x=>[`${x.name} · ${x.track.toUpperCase()} · ${x.bars}B`,x.id]),p().selectedMidiClipId);
    if(!c)return;
    $('#midiClipNameInput').value=c.name; $('#midiClipTrackInput').value=c.track; $('#midiClipBarsInput').value=c.bars;
    const n=c.notes.find(x=>x.id===S.selectedMidiNoteId)||null;
    $('#midiNoteInfo').textContent=n?`${noteName(n.note)} · STEP ${n.start+1}`:'Haz clic para crear/seleccionar una nota · botón derecho elimina';
    $('#midiNoteVelocityInput').value=n?n.velocity:100; $('#midiNoteLengthInput').value=n?n.length:1;
    $('#midiNoteVelocityInput').disabled=!n; $('#midiNoteLengthInput').disabled=!n;
    drawMidiPiano();
  }

  function drawMidiPiano(){
    const canvas=$('#midiPianoCanvas'), c=currentMidi(); if(!canvas||!c)return;
    const ctx=canvas.getContext('2d'), dpr=devicePixelRatio||1, steps=c.bars*16, colsW=36, labelW=58, rowH=18, rows=36;
    const cssW=Math.max(820,labelW+steps*colsW), cssH=rows*rowH;
    canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);ctx.scale(dpr,dpr);
    ctx.fillStyle=uiColor('--canvas-bg','#080b10');ctx.fillRect(0,0,cssW,cssH);ctx.font='10px ui-monospace,monospace';ctx.textBaseline='middle';
    const minNote=36,maxNote=71;
    for(let r=0;r<rows;r++){
      const midi=maxNote-r,y=r*rowH,isBlack=[1,3,6,8,10].includes(midi%12);
      ctx.fillStyle=isBlack?uiColor('--bg','#0b1016'):uiColor('--panel','#111820');ctx.fillRect(labelW,y,cssW-labelW,rowH-1);ctx.fillStyle=uiColor('--muted','#8e9aab');ctx.fillText(noteName(midi),7,y+rowH/2);
      ctx.strokeStyle=uiColor('--line','#1f2933');ctx.beginPath();ctx.moveTo(labelW,y+rowH);ctx.lineTo(cssW,y+rowH);ctx.stroke();
    }
    for(let st=0;st<=steps;st++){const x=labelW+st*colsW;ctx.strokeStyle=st%16===0?uiColor('--line2','#465567'):st%4===0?uiColor('--line','#303b47'):uiColor('--line','#202832');ctx.lineWidth=st%16===0?2:1;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cssH);ctx.stroke();}
    c.notes.forEach(n=>{if(n.note<minNote||n.note>maxNote)return;const y=(maxNote-n.note)*rowH+2,x=labelW+n.start*colsW+1,w=Math.max(8,n.length*colsW-3);ctx.fillStyle=n.id===S.selectedMidiNoteId?uiColor('--accent','#55f59d'):uiColor('--accent2','#287ab1');ctx.fillRect(x,y,w,rowH-5);ctx.fillStyle=uiColor('--canvas-bg','#071018');ctx.fillText(`${noteName(n.note)} ${n.velocity}`,x+4,y+(rowH-5)/2);});
    ctx.fillStyle=uiColor('--muted','#8e9aab');for(let st=0;st<steps;st+=4)ctx.fillText(String(st+1),labelW+st*colsW+3,9);
  }

  function pianoPoint(e){const canvas=$('#midiPianoCanvas'),c=currentMidi(),rect=canvas.getBoundingClientRect(),steps=c.bars*16,labelW=58,colsW=36,rowH=18,maxNote=71;const x=e.clientX-rect.left,y=e.clientY-rect.top;if(x<labelW)return null;return{step:clamp(Math.floor((x-labelW)/colsW),0,steps-1),note:clamp(maxNote-Math.floor(y/rowH),36,71)};}
  function noteUnder(pt){const c=currentMidi();return c&&c.notes.slice().reverse().find(n=>n.note===pt.note&&pt.step>=n.start&&pt.step<n.start+n.length);}

  function renderPads(){const box=$('#padGrid');if(!box)return;box.replaceChildren();p().pads.forEach((pad,i)=>{const b=document.createElement('button'),key=document.createElement('b'),name=document.createElement('span');b.className=`sample-pad${S.selectedPad===i?' selected':''}${pad.fileName?' loaded':''}`;key.textContent=padKeys[i].toUpperCase();name.textContent=pad.fileName||pad.name;b.append(key,name);b.setAttribute('aria-label',`Pad ${i+1}: ${pad.fileName||pad.name}`);b.onclick=async()=>{S.selectedPad=i;renderPads();syncPadInspector();try{await R.ensureAudio();await activateAudio();if(R.engine.padSamples[i])await R.engine.triggerPadNow(i,1);}catch(_){} };box.appendChild(b);});syncPadInspector();}
  function syncPadInspector(){const pad=p().pads[S.selectedPad];if(!pad)return;$('#padSelectedLabel').textContent=`PAD ${String(S.selectedPad+1).padStart(2,'0')} · ${pad.fileName||'EMPTY'}`;$('#padGainInput').value=Math.round(pad.gain*100);$('#padPitchInput').value=pad.pitch;}

  function renderLibrary(){const list=$('#sampleLibraryList');if(!list)return;const q=String($('#librarySearchInput').value||'').toLowerCase();const rows=libraryRows.filter(r=>!q||String(r.name||'').toLowerCase().includes(q));list.replaceChildren();rows.forEach(row=>{const d=document.createElement('button'),name=document.createElement('span'),size=document.createElement('small');d.className=`library-row${selectedLibraryId===row.id?' selected':''}`;name.textContent=String(row.name||'Sample');size.textContent=`${Math.round((row.size||0)/1024)} KB`;d.append(name,size);d.onclick=()=>{selectedLibraryId=row.id;renderLibrary();$('#librarySelectedLabel').textContent=String(row.name||'Sample');};list.appendChild(d);});if(!rows.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='Librería vacía. Importa WAV/MP3/OGG.';list.appendChild(empty);}const selected=libraryRows.find(r=>r.id===selectedLibraryId);$('#librarySelectedLabel').textContent=selected?String(selected.name||'Sample'):'Ningún sample seleccionado';}

  function renderFxMod(){const fx=p().master.fx,m=p().modulation;$('#fxDelayTimeInput').value=fx.delayTime;$('#fxDelayFeedbackInput').value=fx.delayFeedback;$('#fxDelayToneInput').value=fx.delayTone;$('#fxReverbDecayInput').value=fx.reverbDecay;$('#fxReverbToneInput').value=fx.reverbTone;['lfo1','lfo2'].forEach(k=>{const l=m[k],pre='#'+k;$(pre+'Enabled').checked=l.enabled;$(pre+'Target').value=l.target;$(pre+'Wave').value=l.waveform;$(pre+'Rate').value=l.rate;$(pre+'Sync').checked=l.sync;$(pre+'Depth').value=l.depth;});}

  function render(){if(!R)return;renderMidiControls();renderPads();renderLibrary();renderFxMod();}

  async function assignLibraryToPad(){if(!selectedLibraryId)return R.toast('Selecciona un sample de la librería.');const row=await T.Storage.getLibrarySample(selectedLibraryId);if(!row)return;await R.ensureAudio();const i=S.selectedPad;await T.Storage.putPadSample(i,row.name,row.buffer,row.id);await R.engine.loadPadSample(i,row.buffer);const pad=p().pads[i];pad.fileName=row.name;pad.name=row.name.replace(/\.[^.]+$/,'').slice(0,40);padsActivated=true;R.remember();renderPads();R.toast(`${row.name} → PAD ${i+1}`);}
  async function assignLibraryToTrack(){if(!selectedLibraryId)return R.toast('Selecciona un sample de la librería.');const row=await T.Storage.getLibrarySample(selectedLibraryId);if(!row)return;await R.ensureAudio();await R.engine.loadSample(S.selectedTrack,row.buffer);await T.Storage.putSample(S.selectedTrack,row.name,row.buffer);Object.assign(p().sampler[S.selectedTrack],{name:row.name,start:0,end:1,gain:1,reverse:false});R.renderSampler();R.remember();R.toast(`${row.name} → ${S.selectedTrack.toUpperCase()}`);}

  async function init(runtime){
    R=runtime;libraryRows=await T.Storage.listLibrary();padRows=await T.Storage.listPadSamples();
    if(!p().sampleLibrary.length&&libraryRows.length)p().sampleLibrary=libraryRows.map(r=>({id:r.id,name:r.name,size:r.size,type:r.type,updatedAt:r.updatedAt}));
    padRows.forEach(row=>{const pad=p().pads[Number(row.pad)];if(pad&&!pad.fileName)pad.fileName=row.fileName;});

    $('#midiClipSelect').onchange=e=>{p().selectedMidiClipId=e.target.value;S.selectedMidiNoteId=null;renderMidiControls();R.remember();};
    $('#newMidiClipBtn').onclick=()=>{R.snapshot();const c=T.MidiClips.create(T.SYNTH_TRACKS.includes(S.selectedTrack)?S.selectedTrack:'acid',2,`MIDI ${T.MidiClips.all().length+1}`);S.selectedMidiNoteId=null;renderMidiControls();R.remember();};
    $('#duplicateMidiClipBtn').onclick=()=>{R.snapshot();const c=T.MidiClips.duplicate(p().selectedMidiClipId);if(c){S.selectedMidiNoteId=null;renderMidiControls();R.remember();}};
    $('#deleteMidiClipBtn').onclick=()=>{R.snapshot();if(!T.MidiClips.remove(p().selectedMidiClipId))return R.toast('Debe quedar al menos un clip MIDI.');S.selectedMidiNoteId=null;renderMidiControls();R.renderArranger();R.remember();};
    $('#midiClipNameInput').onchange=e=>{const c=currentMidi();c.name=String(e.target.value||'MIDI Clip').slice(0,80);renderMidiControls();R.renderArranger();R.remember();};
    $('#midiClipTrackInput').onchange=e=>{const c=currentMidi();c.track=e.target.value;p().arranger.clips.forEach(ac=>{if(ac.type==='midi'&&ac.midiClipId===c.id)ac.track=c.track;});S.selectedTrack=c.track;renderMidiControls();R.renderArranger();R.remember();};
    $('#midiClipBarsInput').onchange=e=>{R.snapshot();T.MidiClips.resize(p().selectedMidiClipId,Number(e.target.value));renderMidiControls();R.remember();};
    $('#midiNoteVelocityInput').oninput=e=>{const c=currentMidi(),n=c.notes.find(x=>x.id===S.selectedMidiNoteId);if(n){n.velocity=Number(e.target.value);drawMidiPiano();R.remember();}};
    $('#midiNoteLengthInput').oninput=e=>{const c=currentMidi(),n=c.notes.find(x=>x.id===S.selectedMidiNoteId);if(n){T.MidiClips.updateNote(c.id,n.id,{length:Number(e.target.value)});drawMidiPiano();R.remember();}};
    $('#addMidiToArrangerBtn').onclick=()=>{const c=currentMidi();if(!c)return;R.snapshot();p().arranger.enabled=true;const clips=T.Arranger.clipsForTrack(c.track),bar=clips.length?Math.min(p().arranger.lengthBars-1,Math.max(...clips.map(x=>x.bar+x.bars))):0;const ac=T.Arranger.addClip(c.track,p().currentPattern,bar,Math.min(c.bars,p().arranger.lengthBars-bar),'midi',c.id);S.selectedClipId=ac.id;R.renderArranger();R.remember();};
    const pc=$('#midiPianoCanvas');pc.onpointerdown=e=>{if(e.button!==0)return;const pt=pianoPoint(e);if(!pt)return;const existing=noteUnder(pt);R.snapshot();if(existing){S.selectedMidiNoteId=existing.id;draggingNote={id:existing.id,offset:pt.step-existing.start};}else{const n=T.MidiClips.addNote(p().selectedMidiClipId,pt.step,pt.note,Number($('#midiNoteLengthInput').value)||1,Number($('#midiNoteVelocityInput').value)||100);S.selectedMidiNoteId=n.id;draggingNote={id:n.id,offset:0};try{R.ensureAudio().then(()=>R.engine.triggerMidiNote(currentMidi().track,n.note,n.velocity,R.engine.ctx.currentTime+.01,.15));}catch(_){} }pc.setPointerCapture(e.pointerId);renderMidiControls();R.remember();};
    pc.onpointermove=e=>{if(!draggingNote)return;const pt=pianoPoint(e);if(!pt)return;T.MidiClips.updateNote(p().selectedMidiClipId,draggingNote.id,{start:pt.step-draggingNote.offset,note:pt.note});drawMidiPiano();R.remember();};pc.onpointerup=pc.onpointercancel=()=>{draggingNote=null;};pc.oncontextmenu=e=>{e.preventDefault();const pt=pianoPoint(e),n=pt&&noteUnder(pt);if(n){R.snapshot();T.MidiClips.removeNote(p().selectedMidiClipId,n.id);if(S.selectedMidiNoteId===n.id)S.selectedMidiNoteId=null;renderMidiControls();R.remember();}};

    $('#padSampleInput').onchange=async e=>{const file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;try{await R.ensureAudio();const ab=await file.arrayBuffer(),i=S.selectedPad;await R.engine.loadPadSample(i,ab);await T.Storage.putPadSample(i,file.name,ab,null);const pad=p().pads[i];pad.fileName=file.name;pad.name=file.name.replace(/\.[^.]+$/,'').slice(0,40);padRows=(await T.Storage.listPadSamples());padsActivated=true;renderPads();R.remember();R.toast(`${file.name} cargado en PAD ${i+1}`);}catch(err){R.toast(`Pad: ${err.message}`);}};
    $('#clearPadBtn').onclick=async()=>{const i=S.selectedPad;await T.Storage.deletePadSample(i);R.engine.clearPadSample(i);p().pads[i]={id:`pad${i+1}`,name:`PAD ${String(i+1).padStart(2,'0')}`,fileName:'',gain:1,pitch:0,choke:0};padRows=padRows.filter(x=>Number(x.pad)!==i);renderPads();R.remember();};
    $('#padGainInput').oninput=e=>{p().pads[S.selectedPad].gain=Number(e.target.value)/100;R.remember();};$('#padPitchInput').oninput=e=>{p().pads[S.selectedPad].pitch=Number(e.target.value);R.remember();};

    $('#libraryInput').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;let count=0;for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(wav|mp3|ogg|m4a|aac)$/i.test(file.name))continue;const id=T.uid('sample');const row=await T.Storage.putLibrarySample(id,file);libraryRows.push(row);count++;}p().sampleLibrary=libraryRows.map(r=>({id:r.id,name:r.name,size:r.size,type:r.type,updatedAt:r.updatedAt}));renderLibrary();R.remember();R.toast(`${count} sample(s) añadidos a la librería.`);};
    $('#librarySearchInput').oninput=renderLibrary;$('#assignLibraryPadBtn').onclick=assignLibraryToPad;$('#assignLibraryTrackBtn').onclick=assignLibraryToTrack;
    $('#previewLibraryBtn').onclick=async()=>{if(!selectedLibraryId)return R.toast('Selecciona un sample.');const row=await T.Storage.getLibrarySample(selectedLibraryId);if(!row)return;await R.ensureAudio();const b=await R.engine.ctx.decodeAudioData(row.buffer.slice(0));const src=R.engine.ctx.createBufferSource();src.buffer=b;src.connect(R.engine.masterBus);src.start();};
    $('#deleteLibraryBtn').onclick=async()=>{if(!selectedLibraryId)return;await T.Storage.deleteLibrarySample(selectedLibraryId);libraryRows=libraryRows.filter(x=>x.id!==selectedLibraryId);p().sampleLibrary=libraryRows.map(r=>({id:r.id,name:r.name,size:r.size,type:r.type,updatedAt:r.updatedAt}));selectedLibraryId=null;renderLibrary();R.remember();};

    ['delayTime','delayFeedback','delayTone','reverbDecay','reverbTone'].forEach(k=>{const map={delayTime:'fxDelayTimeInput',delayFeedback:'fxDelayFeedbackInput',delayTone:'fxDelayToneInput',reverbDecay:'fxReverbDecayInput',reverbTone:'fxReverbToneInput'};$('#'+map[k]).oninput=e=>{p().master.fx[k]=Number(e.target.value);R.engine.setMaster(p().master);R.remember();};});
    ['lfo1','lfo2'].forEach(k=>{const pre='#'+k,fields=[['Enabled','enabled','checked'],['Target','target','value'],['Wave','waveform','value'],['Rate','rate','number'],['Sync','sync','checked'],['Depth','depth','number']];fields.forEach(([suf,key,kind])=>{$(pre+suf).onchange=$(pre+suf).oninput=e=>{p().modulation[k][key]=kind==='checked'?e.target.checked:kind==='number'?Number(e.target.value):e.target.value;R.remember();};});});

    window.addEventListener('keydown',async e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const i=padKeys.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();S.selectedPad=i;renderPads();try{await R.ensureAudio();await activateAudio();await R.engine.triggerPadNow(i,1);}catch(_){}}});
    render();
  }

  T.V4UI={init,render,activateAudio};
})();
