window.Techno404 = window.Techno404 || {};
(async () => {
  'use strict';
  const T = window.Techno404;
  const S = T.State;
  const engine = new T.AudioEngine();
  const seq = new T.Sequencer(engine);
  T.runtime = { engine, seq };
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const uiColor = (name, fallback) => T.PremiumUI?.cssVar(name, fallback) || fallback;

  let autosaveTimer = null;
  let taps = [];
  let sampleRows = [];
  let samplesActivated = false;
  let drawingAutomation = false;
  let lastArrangerBar = -1;
  let progressToast = null;

  function project() { return S.project; }
  function pattern() { return project().patterns[project().currentPattern]; }
  function selectedTrackMeta() { return T.TRACKS.find(t => t.id === S.selectedTrack) || T.TRACKS[0]; }
  function selectedClip() { return project().arranger.clips.find(c => c.id === S.selectedClipId) || null; }

  function status(text) { $('#statusText').textContent = text; }
  function toast(text, ms = 1900) {
    status(text);
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  function snapshot() { S.snapshot(); }
  function remember() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const saved = T.Storage.saveProject(project());
      status(saved ? 'Autoguardado.' : 'No se pudo autoguardar. Revisa el almacenamiento del navegador.');
    }, 350);
  }
  function safeName(name) {
    return String(name || 'techno404').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'techno404';
  }

  function setProgress(label, ratio) {
    if (!progressToast) {
      progressToast = document.createElement('div');
      progressToast.className = 'toast progress-toast';
      progressToast.innerHTML = '<span></span><div class="progress-bar"><i></i></div>';
      document.body.appendChild(progressToast);
    }
    progressToast.querySelector('span').textContent = label;
    progressToast.querySelector('i').style.width = `${clamp(ratio, 0, 1) * 100}%`;
  }
  function clearProgress() {
    if (progressToast) progressToast.remove();
    progressToast = null;
  }

  async function ensureAudio() {
    await engine.init();
    if (!samplesActivated) {
      for (const row of sampleRows) {
        const settings = project().sampler[row.track];
        if (!settings || !settings.name) continue;
        const storedName = row.fileName || row.name || '';
        if (storedName && storedName !== settings.name) continue;
        try { await engine.loadSample(row.track, row.buffer); }
        catch (e) { console.warn('No se pudo restaurar sample', row.track, e); }
      }
      samplesActivated = true;
    }
    if (T.V4UI && T.V4UI.activateAudio) await T.V4UI.activateAudio();
    engine.setMaster(project().master);
    engine.applyMixer(project().mixer);
  }

  function fillPatternSelects() {
    ['#patternSelect','#arrangerAutomationPattern','#arrangerClipPattern','#clipPatternInput'].forEach(id => {
      const el = $(id);
      const previous = el.value;
      el.innerHTML = '';
      T.PATTERN_IDS.forEach(pid => el.add(new Option(pid, pid)));
      if (T.PATTERN_IDS.includes(previous)) el.value = previous;
    });
    $('#patternSelect').value = project().currentPattern;
    $('#arrangerAutomationPattern').value = project().arranger.automationPattern;
    if (!$('#arrangerClipPattern').value) $('#arrangerClipPattern').value = project().currentPattern;
  }

  function syncControls() {
    const p = project();
    $('#projectNameInput').value = p.name;
    $('#bpmInput').value = p.bpm;
    $('#swingInput').value = p.swing;
    $('#swingValue').textContent = `${p.swing}%`;
    $('#stepsSelect').value = p.steps;
    $('#patternSelect').value = p.currentPattern;
    $('#arrangerBarsInput').value = p.arranger.lengthBars;
    $('#arrangerEnabledInput').checked = p.arranger.enabled;
    $('#arrangerLoopInput').checked = p.arranger.loop;
    $('#arrangerAutomationPattern').value = p.arranger.automationPattern;
    if ($('#arrangerZoomInput')) $('#arrangerZoomInput').value = p.arranger.zoom || 1;
    $('#masterInput').value = p.master.volume;
    $('#masterFilterInput').value = p.master.filter;
    $('#driveInput').value = p.master.drive;
    $('#delayInput').value = p.master.delay;
    $('#reverbInput').value = p.master.reverb;
    $('#compressorInput').value = p.master.compressor;
    $('#bassCutoffInput').value = p.master.bassCutoff;
    $('#bassResInput').value = p.master.bassRes;
    $('#sidechainReleaseInput').value = p.master.sidechainRelease;
    $('#limiterInput').checked = p.master.limiterEnabled;
    $('#limiterCeilingInput').value = p.master.limiterCeiling;
    $('#songChainInput').value = p.song.chain;
    $('#songRepeatsInput').value = p.song.repeats;
    $('#selectedTrackLabel').textContent = selectedTrackMeta().name;
  }

  function renderScenes() {
    const box = $('#liveScenes');
    box.innerHTML = '';
    T.PATTERN_IDS.forEach(id => {
      const b = document.createElement('button');
      b.textContent = id;
      b.className = id === project().currentPattern ? 'active' : '';
      b.onclick = () => {
        seq.launchPattern(id);
        if (!seq.playing || seq.mode === 'arranger') {
          project().currentPattern = id;
          renderAll();
        } else {
          toast(`Pattern ${id} en cola`);
        }
      };
      box.appendChild(b);
    });
  }

  function renderSequencer() {
    const box = $('#sequencerGrid');
    const n = project().steps;
    box.innerHTML = '';
    box.style.minWidth = `${130 + n * 36}px`;
    T.TRACKS.forEach(track => {
      const row = document.createElement('div');
      row.className = 'seq-row track-row';
      row.style.gridTemplateColumns = `110px repeat(${n}, minmax(30px,1fr))`;
      const name = document.createElement('div');
      name.className = `track-name${S.selectedTrack === track.id ? ' active' : ''}`;
      const hasSample = !!project().sampler[track.id].name;
      name.innerHTML = `<span>${track.name}</span><small>${hasSample ? 'SMP' : (track.id === 'acid' ? '303' : '')}</small>`;
      name.onclick = () => {
        S.selectedTrack = track.id;
        renderSequencer(); renderMixer(); renderSampler();
        $('#selectedTrackLabel').textContent = track.name;
      };
      row.appendChild(name);
      pattern().tracks[track.id].slice(0, n).forEach((st, i) => {
        const b = document.createElement('button');
        b.className = `step${st.on ? ' on' : ''}${st.accent ? ' accented' : ''}${S.selectedTrack === track.id && S.selectedStep === i ? ' selected' : ''}`;
        b.dataset.step = i; b.dataset.track = track.id;
        b.title = `${track.name} ${i + 1} · vel ${st.velocity} · prob ${st.probability}% · gate ${st.gate}%`;
        if (st.probability < 100) {
          const sp = document.createElement('span'); sp.className = 'prob'; sp.textContent = st.probability; b.appendChild(sp);
        }
        if (st.ratchet > 1) {
          const sr = document.createElement('span'); sr.className = 'ratchet'; sr.textContent = `×${st.ratchet}`; b.appendChild(sr);
        }
        if (st.gate !== 72 && ['bass','acid','stab'].includes(track.id)) {
          const sg = document.createElement('span'); sg.className = 'gate'; sg.textContent = st.gate; b.appendChild(sg);
        }
        b.onclick = () => {
          snapshot(); st.on = !st.on; S.selectedTrack = track.id; S.selectedStep = i;
          renderSequencer(); renderEditor(); renderSampler(); remember();
        };
        b.oncontextmenu = e => {
          e.preventDefault(); S.selectedTrack = track.id; S.selectedStep = i;
          renderEditor(); renderSequencer(); renderSampler();
        };
        row.appendChild(b);
      });
      box.appendChild(row);
    });
  }

  function renderEditor() {
    const i = S.selectedStep;
    if (i === null || i >= project().steps) {
      $('#selectedStepLabel').textContent = 'Selecciona un paso';
      return;
    }
    const st = pattern().tracks[S.selectedTrack][i];
    $('#selectedStepLabel').textContent = `${selectedTrackMeta().name} · STEP ${i + 1}`;
    $('#velocityInput').value = st.velocity;
    $('#probabilityInput').value = st.probability;
    $('#ratchetInput').value = st.ratchet;
    $('#pitchInput').value = st.pitch;
    $('#microInput').value = st.micro;
    $('#gateInput').value = st.gate;
    $('#stepCutoffInput').value = st.cutoff;
    $('#accentInput').checked = st.accent;
    $('#glideInput').checked = st.glide;
  }

  function renderMixer() {
    const box = $('#mixer');
    box.innerHTML = '';
    T.TRACKS.forEach(track => {
      const m = project().mixer[track.id];
      const ch = document.createElement('div');
      ch.className = `channel${S.selectedTrack === track.id ? ' active' : ''}`;
      ch.innerHTML = `
        <h3><span>${track.name}</span><small>${Math.round(m.volume)}%</small></h3>
        <label>VOL <input data-k="volume" type="range" min="0" max="100" value="${m.volume}"></label>
        <label>PAN <input data-k="pan" type="range" min="-100" max="100" value="${m.pan}"></label>
        <label>LPF <input data-k="filter" type="range" min="0" max="100" value="${m.filter}"></label>
        <label>LOW <input data-k="eqLow" type="range" min="-18" max="18" value="${m.eqLow}"></label>
        <label>MID <input data-k="eqMid" type="range" min="-18" max="18" value="${m.eqMid}"></label>
        <label>HIGH <input data-k="eqHigh" type="range" min="-18" max="18" value="${m.eqHigh}"></label>
        <label>DLY <input data-k="delaySend" type="range" min="0" max="100" value="${m.delaySend}"></label>
        <label>REV <input data-k="reverbSend" type="range" min="0" max="100" value="${m.reverbSend}"></label>
        <label>SC <input data-k="sidechain" type="range" min="0" max="95" value="${m.sidechain}"></label>
        <div class="channel-actions"><button class="mute ${m.mute ? 'on' : ''}">M</button><button class="solo ${m.solo ? 'on' : ''}">S</button></div>`;
      ch.onclick = e => {
        if (['DIV','H3','SPAN','SMALL'].includes(e.target.tagName)) {
          S.selectedTrack = track.id; renderMixer(); renderSequencer(); renderSampler();
        }
      };
      ch.querySelectorAll('input').forEach(inp => {
        inp.oninput = e => {
          m[e.target.dataset.k] = Number(e.target.value);
          ch.querySelector('small').textContent = `${Math.round(m.volume)}%`;
          engine.applyMixer(project().mixer); remember();
        };
      });
      ch.querySelector('.mute').onclick = e => { e.stopPropagation(); m.mute = !m.mute; engine.applyMixer(project().mixer); renderMixer(); remember(); };
      ch.querySelector('.solo').onclick = e => { e.stopPropagation(); m.solo = !m.solo; engine.applyMixer(project().mixer); renderMixer(); remember(); };
      box.appendChild(ch);
    });
  }

  function renderPiano() {
    const box = $('#pianoRoll');
    box.innerHTML = '';
    const page = Number($('#pianoPageSelect').value);
    const oct = Number($('#pianoOctaveSelect').value);
    const start = page * 16;
    const baseMidi = 12 * (oct + 1);
    for (let semi = 12; semi >= 0; semi--) {
      const midi = baseMidi + semi;
      const label = document.createElement('div');
      label.className = 'note-label';
      label.textContent = noteNames[midi % 12] + (Math.floor(midi / 12) - 1);
      box.appendChild(label);
      for (let col = 0; col < 16; col++) {
        const idx = start + col;
        const st = pattern().tracks.acid[idx];
        const b = document.createElement('button');
        b.className = `piano-cell${[1,3,6,8,10].includes(midi % 12) ? ' blackish' : ''}`;
        if (idx < project().steps && st.on && (36 + st.pitch) === midi) b.classList.add('on');
        if (idx >= project().steps) b.disabled = true;
        b.onclick = () => {
          snapshot();
          const same = st.on && (36 + st.pitch) === midi;
          st.on = !same; st.pitch = clamp(midi - 36, -24, 36); st.velocity = Math.max(st.velocity, 95);
          S.selectedTrack = 'acid'; S.selectedStep = idx;
          renderAll(); remember();
        };
        b.dataset.step = idx;
        box.appendChild(b);
      }
    }
  }

  function drawAutomation() {
    const canvas = $('#automationCanvas');
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(140, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const param = $('#automationParamSelect').value;
    const data = pattern().automation[param];
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = uiColor('--canvas-bg','#090d12'); ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = uiColor('--line','#202a35'); ctx.lineWidth = 1;
    for (let i=0;i<=project().steps;i++) {
      const x = i/project().steps*w;
      if (i%4===0) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    }
    for (let q=1;q<4;q++) { const y=q/4*h; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    ctx.beginPath();
    for (let i=0;i<project().steps;i++) {
      const x = (i + .5) / project().steps * w;
      const y = h - (data[i]/100)*h;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = uiColor('--accent','#55f59d'); ctx.lineWidth = 2*dpr; ctx.stroke();
    ctx.fillStyle = uiColor('--accent2','#58b8ff');
    for (let i=0;i<project().steps;i++) {
      const x=(i+.5)/project().steps*w, y=h-(data[i]/100)*h;
      ctx.beginPath(); ctx.arc(x,y,2.2*dpr,0,Math.PI*2); ctx.fill();
    }
  }

  function automationPointer(e) {
    const canvas = $('#automationCanvas');
    const rect = canvas.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width - 0.001);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    const step = clamp(Math.floor(x / rect.width * project().steps), 0, project().steps - 1);
    const value = clamp(Math.round(100 - y / rect.height * 100), 0, 100);
    const param = $('#automationParamSelect').value;
    pattern().automation[param][step] = value;
    $('#automationReadout').textContent = `STEP ${step + 1} · ${value}%`;
    drawAutomation(); remember();
  }

  function renderSampler() {
    const track = S.selectedTrack;
    const settings = project().sampler[track];
    const buffer = engine.customSamples[track];
    $('#sampleState').textContent = settings.name ? `${selectedTrackMeta().name}: ${settings.name}` : 'SYNTH ENGINE';
    $('#sampleStartInput').value = Math.round(settings.start * 100);
    $('#sampleEndInput').value = Math.round(settings.end * 100);
    $('#sampleGainInput').value = Math.round(settings.gain * 100);
    $('#sampleReverseInput').checked = settings.reverse;
    $('#previewSampleBtn').disabled = !settings.name;
    $('#clearSampleBtn').disabled = !settings.name;
    $('#sampleInfo').textContent = settings.name
      ? `${settings.name}${buffer ? ` · ${buffer.duration.toFixed(2)} s · ${buffer.sampleRate} Hz` : ' · se activará al iniciar audio'}`
      : 'Selecciona una pista y carga un WAV/MP3/OGG. El sample se guarda localmente en IndexedDB.';
    drawWaveform();
  }

  function drawWaveform() {
    const canvas = $('#waveformCanvas');
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(canvas.clientWidth*dpr));
    const h = Math.max(140, Math.floor(canvas.clientHeight*dpr));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    ctx.clearRect(0,0,w,h); ctx.fillStyle=uiColor('--canvas-bg','#090d12'); ctx.fillRect(0,0,w,h);
    const buffer = engine.customSamples[S.selectedTrack];
    if(!buffer){ctx.fillStyle=uiColor('--muted','#58677a');ctx.font=`${12*dpr}px monospace`;ctx.fillText('NO SAMPLE / AUDIO NOT INITIALIZED',18*dpr,h/2);return;}
    const data=buffer.getChannelData(0), step=Math.max(1,Math.floor(data.length/w));
    ctx.strokeStyle=uiColor('--accent2','#58b8ff');ctx.lineWidth=1;ctx.beginPath();
    for(let x=0;x<w;x++){let min=1,max=-1;const start=x*step;for(let j=0;j<step&&start+j<data.length;j++){const v=data[start+j];if(v<min)min=v;if(v>max)max=v;}const y1=(1-max)*h/2,y2=(1-min)*h/2;ctx.moveTo(x,y1);ctx.lineTo(x,y2);}ctx.stroke();
    const s=project().sampler[S.selectedTrack];
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,s.start*w,h);ctx.fillRect(s.end*w,0,(1-s.end)*w,h);
    ctx.strokeStyle=uiColor('--accent','#55f59d');ctx.lineWidth=2*dpr;ctx.beginPath();ctx.moveTo(s.start*w,0);ctx.lineTo(s.start*w,h);ctx.moveTo(s.end*w,0);ctx.lineTo(s.end*w,h);ctx.stroke();
  }

  function renderArranger() {
    const box = $('#arrangerGrid');
    const bars = project().arranger.lengthBars;
    const zoom = project().arranger.zoom || 1;
    const cols = `110px repeat(${bars}, minmax(${Math.round(58*zoom)}px,1fr))`;
    box.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'arr-header'; header.style.gridTemplateColumns = cols;
    const corner = document.createElement('div'); corner.className='arr-track-label'; corner.textContent='TRACK / BAR'; header.appendChild(corner);
    for(let bar=0;bar<bars;bar++){const h=document.createElement('div');h.textContent=bar+1;header.appendChild(h);}box.appendChild(header);

    T.TRACKS.forEach(track => {
      const row = document.createElement('div'); row.className='arr-row'; row.style.gridTemplateColumns=cols;
      const label=document.createElement('div');label.className='arr-track-label';label.textContent=track.name;label.onclick=()=>{S.selectedTrack=track.id;renderMixer();renderSequencer();renderSampler();};row.appendChild(label);
      for(let bar=0;bar<bars;bar++){
        const cell=document.createElement('div');cell.className=`arr-cell${bar===lastArrangerBar?' playing':''}`;cell.dataset.track=track.id;cell.dataset.bar=bar;
        cell.style.gridColumn=String(bar+2);
        cell.ondblclick=()=>{snapshot();const c=T.Arranger.addClip(track.id,$('#arrangerClipPattern').value,bar,1);S.selectedClipId=c.id;renderArranger();remember();};
        cell.ondragover=e=>{e.preventDefault();cell.classList.add('drag-over');};
        cell.ondragleave=()=>cell.classList.remove('drag-over');
        cell.ondrop=e=>{e.preventDefault();cell.classList.remove('drag-over');const id=e.dataTransfer.getData('text/techno404-clip')||e.dataTransfer.getData('text/plain');if(id){snapshot();T.Arranger.moveClip(id,track.id,bar);S.selectedClipId=id;renderArranger();remember();}};
        row.appendChild(cell);
      }
      project().arranger.clips.filter(c=>c.track===track.id).forEach(clip=>{
        const b=document.createElement('button');b.className=`arr-clip${clip.type==='midi'?' midi-clip':''}${S.selectedClipId===clip.id?' selected':''}`;const mc=clip.type==='midi'&&project().midiClips[clip.midiClipId];const source=clip.type==='midi'?(mc?`MIDI:${mc.name}`:'MIDI'):`PAT:${clip.pattern}`;b.textContent=`${source} · ${clip.bars}B`;b.title=`${track.name} · ${source} · bar ${clip.bar+1} · ${clip.bars} bar(s)`;b.draggable=true;b.style.gridColumn=`${clip.bar+2} / span ${clip.bars}`;b.style.borderColor=track.color;
        b.ondragstart=e=>{e.dataTransfer.setData('text/techno404-clip',clip.id);e.dataTransfer.setData('text/plain',clip.id);};
        b.onclick=e=>{e.stopPropagation();S.selectedClipId=clip.id;renderArranger();};
        b.oncontextmenu=e=>{e.preventDefault();snapshot();T.Arranger.removeClip(clip.id);if(S.selectedClipId===clip.id)S.selectedClipId=null;renderArranger();remember();};
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    renderClipInspector();
  }

  function renderClipInspector() {
    const clip=selectedClip();
    $('#clipInspectorLabel').textContent=clip?`${clip.track.toUpperCase()} · BAR ${clip.bar+1}`:'Ninguno seleccionado';
    ['#clipPatternInput','#clipBarsInput','#duplicateClipBtn','#deleteClipBtn','#clipTypeInput','#clipSourceInput'].forEach(id=>{const el=$(id);if(el)el.disabled=!clip;});
    if(!clip)return;
    $('#clipBarsInput').value=clip.bars;$('#clipBarsInput').max=Math.max(1,project().arranger.lengthBars-clip.bar);
    if($('#clipTypeInput')) $('#clipTypeInput').value=clip.type||'pattern';
    const source=$('#clipSourceInput');
    if(source){source.innerHTML='';if(clip.type==='midi'){Object.values(project().midiClips).filter(mc=>mc.track===clip.track).forEach(mc=>source.add(new Option(mc.name,mc.id)));if(clip.midiClipId)source.value=clip.midiClipId;}else{T.PATTERN_IDS.forEach(pid=>source.add(new Option(pid,pid)));source.value=clip.pattern;}}
    $('#clipPatternInput').value=clip.pattern;
    $('#clipPatternInput').style.display=clip.type==='midi'?'none':'';
  }

  function renderAll() {
    fillPatternSelects(); syncControls(); renderScenes(); renderSequencer(); renderEditor(); renderMixer(); renderPiano(); drawAutomation(); renderSampler(); renderArranger(); if(T.V4UI&&T.V4UI.render)T.V4UI.render();
  }

  function bindEditor() {
    const fields = [
      ['#velocityInput','velocity'],['#probabilityInput','probability'],['#ratchetInput','ratchet'],['#pitchInput','pitch'],['#microInput','micro'],['#gateInput','gate'],['#stepCutoffInput','cutoff']
    ];
    fields.forEach(([id,key]) => {
      $(id).oninput = e => {
        if (S.selectedStep === null) return;
        pattern().tracks[S.selectedTrack][S.selectedStep][key] = Number(e.target.value);
        renderSequencer(); remember();
      };
    });
    $('#accentInput').onchange=e=>{if(S.selectedStep===null)return;pattern().tracks[S.selectedTrack][S.selectedStep].accent=e.target.checked;renderSequencer();remember();};
    $('#glideInput').onchange=e=>{if(S.selectedStep===null)return;pattern().tracks[S.selectedTrack][S.selectedStep].glide=e.target.checked;remember();};
    $('#copyStepBtn').onclick=()=>{if(S.selectedStep!==null){S.clipboard=S.clone(pattern().tracks[S.selectedTrack][S.selectedStep]);toast('Paso copiado.');}};
    $('#pasteStepBtn').onclick=()=>{if(S.selectedStep===null||!S.clipboard)return;snapshot();Object.assign(pattern().tracks[S.selectedTrack][S.selectedStep],S.clone(S.clipboard));renderAll();remember();};
  }

  function bindTransport() {
    $('#playBtn').onclick=async()=>{try{await ensureAudio();if(seq.playing)seq.stop();await seq.playPattern();updateTransport();}catch(e){toast(e.message);}};
    $('#arrangerPlayBtn').onclick=async()=>{try{await ensureAudio();project().arranger.enabled=true;if(seq.playing)seq.stop();await seq.startArranger();updateTransport();remember();}catch(e){toast(e.message);}};
    $('#stopBtn').onclick=()=>{seq.stop();engine.setMaster(project().master);updateTransport();};
    $('#projectNameInput').onchange=e=>{project().name=String(e.target.value||'Untitled Techno').slice(0,80);e.target.value=project().name;remember();};
    $('#bpmInput').onchange=e=>{project().bpm=clamp(Number(e.target.value)||136,70,210);e.target.value=project().bpm;remember();};
    $('#swingInput').oninput=e=>{project().swing=Number(e.target.value);$('#swingValue').textContent=`${project().swing}%`;remember();};
    $('#tapBtn').onclick=()=>{const now=performance.now();taps.push(now);taps=taps.filter(t=>now-t<3000).slice(-6);if(taps.length>=2){const intervals=taps.slice(1).map((t,i)=>t-taps[i]);const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;project().bpm=clamp(Math.round(60000/avg),70,210);$('#bpmInput').value=project().bpm;remember();}};
  }

  function updateTransport() {
    const state=$('#transportState');
    state.textContent=seq.playing?seq.mode.toUpperCase():'STOPPED';
    state.style.color=seq.playing?'var(--accent)':'';
  }

  function bindPatterns() {
    $('#patternSelect').onchange=e=>{project().currentPattern=e.target.value;S.selectedStep=null;renderAll();remember();};
    $('#stepsSelect').onchange=e=>{project().steps=Number(e.target.value);if(S.selectedStep>=project().steps)S.selectedStep=null;renderAll();remember();};
    $('#duplicatePatternBtn').onclick=()=>{const ids=T.PATTERN_IDS,src=project().currentPattern,i=ids.indexOf(src);const empty=T.makeEmptyPattern(),isEmpty=pid=>JSON.stringify(project().patterns[pid])===JSON.stringify(empty);let dst=ids.slice(i+1).concat(ids.slice(0,i)).find(isEmpty)||ids[(i+1)%ids.length];if(!isEmpty(dst)&&!confirm(`El pattern ${dst} contiene datos. ¿Sobrescribirlo con ${src}?`))return;snapshot();project().patterns[dst]=S.clone(project().patterns[src]);project().currentPattern=dst;renderAll();remember();toast(`${src} duplicado en ${dst}`);};
    $('#clearPatternBtn').onclick=()=>{snapshot();project().patterns[project().currentPattern]=T.makeEmptyPattern();renderAll();remember();toast('Pattern vaciado.');};
    $('#undoBtn').onclick=()=>{if(S.undo()){renderAll();engine.setMaster(project().master);engine.applyMixer(project().mixer);remember();}};
    $('#redoBtn').onclick=()=>{if(S.redo()){renderAll();engine.setMaster(project().master);engine.applyMixer(project().mixer);remember();}};
    $('#humanizeBtn').onclick=()=>{snapshot();T.Generator.humanize();renderAll();remember();};
    $('#euclidBtn').onclick=()=>{snapshot();const pulses=Math.max(3,Math.round(project().steps/8));T.Generator.euclid(S.selectedTrack,pulses);renderAll();remember();};
  }

  function bindGenerator() {
    $('#generateBtn').onclick=()=>{snapshot();T.Generator.generate($('#styleSelect').value,Number($('#energyInput').value),Number($('#darkInput').value),Number($('#complexInput').value));renderAll();remember();toast('Pattern techno generado.');};
    $('#acidRandomBtn').onclick=()=>{snapshot();T.Generator.acidLine();S.selectedTrack='acid';renderAll();remember();};
  }

  function bindMaster() {
    const map=[['#masterInput','volume'],['#masterFilterInput','filter'],['#driveInput','drive'],['#delayInput','delay'],['#reverbInput','reverb'],['#compressorInput','compressor'],['#bassCutoffInput','bassCutoff'],['#bassResInput','bassRes'],['#sidechainReleaseInput','sidechainRelease'],['#limiterCeilingInput','limiterCeiling']];
    map.forEach(([id,key])=>{$(id).oninput=e=>{project().master[key]=Number(e.target.value);engine.setMaster(project().master);remember();};});
    $('#limiterInput').onchange=e=>{project().master.limiterEnabled=e.target.checked;engine.setMaster(project().master);remember();};
  }

  function bindPianoAutomation() {
    $('#pianoPageSelect').onchange=renderPiano;$('#pianoOctaveSelect').onchange=renderPiano;
    $('#automationParamSelect').onchange=drawAutomation;
    $('#automationResetBtn').onclick=()=>{snapshot();const param=$('#automationParamSelect').value;const defaults=T.makeDefaultProject().patterns.A1.automation[param];pattern().automation[param]=defaults.slice();drawAutomation();remember();};
    const c=$('#automationCanvas');
    c.onpointerdown=e=>{snapshot();drawingAutomation=true;c.setPointerCapture(e.pointerId);automationPointer(e);};
    c.onpointermove=e=>{if(drawingAutomation)automationPointer(e);};
    c.onpointerup=c.onpointercancel=()=>{drawingAutomation=false;};
  }

  function bindArranger() {
    $('#arrangerEnabledInput').onchange=e=>{project().arranger.enabled=e.target.checked;remember();};
    $('#arrangerBarsInput').onchange=e=>{snapshot();project().arranger.lengthBars=clamp(Math.round(Number(e.target.value)||8),1,64);T.Arranger.sanitize();if(lastArrangerBar>=project().arranger.lengthBars)lastArrangerBar=-1;renderArranger();remember();};
    $('#arrangerLoopInput').onchange=e=>{project().arranger.loop=e.target.checked;remember();};
    $('#arrangerAutomationPattern').onchange=e=>{project().arranger.automationPattern=e.target.value;remember();};
    if($('#arrangerZoomInput')) $('#arrangerZoomInput').oninput=e=>{project().arranger.zoom=clamp(Number(e.target.value)||1,.5,2.5);renderArranger();remember();};
    $('#addClipBtn').onclick=()=>{snapshot();project().arranger.enabled=true;const track=S.selectedTrack;const clips=T.Arranger.clipsForTrack(track);const bar=clips.length?Math.min(project().arranger.lengthBars-1,Math.max(...clips.map(c=>c.bar+c.bars))):0;const c=T.Arranger.addClip(track,$('#arrangerClipPattern').value,bar,1);S.selectedClipId=c.id;renderArranger();remember();};
    $('#generateArrangementBtn').onclick=()=>{snapshot();T.Generator.createArrangement();project().arranger.enabled=true;S.selectedClipId=null;syncControls();renderArranger();remember();toast('Arranger base generado.');};
    $('#clipPatternInput').onchange=e=>{const c=selectedClip();if(!c)return;snapshot();c.pattern=e.target.value;renderArranger();remember();};
    if($('#clipTypeInput')) $('#clipTypeInput').onchange=e=>{const c=selectedClip();if(!c)return;snapshot();T.Arranger.setClipType(c.id,e.target.value);renderArranger();remember();};
    if($('#clipSourceInput')) $('#clipSourceInput').onchange=e=>{const c=selectedClip();if(!c)return;snapshot();if(c.type==='midi')c.midiClipId=e.target.value;else c.pattern=e.target.value;renderArranger();remember();};
    $('#clipBarsInput').onchange=e=>{const c=selectedClip();if(!c)return;snapshot();T.Arranger.resizeClip(c.id,Number(e.target.value));renderArranger();remember();};
    $('#duplicateClipBtn').onclick=()=>{const c=selectedClip();if(!c)return;snapshot();const copy=T.Arranger.duplicateClip(c.id);if(copy)S.selectedClipId=copy.id;renderArranger();remember();};
    $('#deleteClipBtn').onclick=()=>{const c=selectedClip();if(!c)return;snapshot();T.Arranger.removeClip(c.id);S.selectedClipId=null;renderArranger();remember();};
  }

  function bindSampler() {
    $('#sampleInput').onchange=async e=>{
      const file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;
      try{
        await ensureAudio();const ab=await file.arrayBuffer();const decoded=await engine.loadSample(S.selectedTrack,ab);await T.Storage.putSample(S.selectedTrack,file.name,ab);
        project().sampler[S.selectedTrack].name=file.name;project().sampler[S.selectedTrack].start=0;project().sampler[S.selectedTrack].end=1;project().sampler[S.selectedTrack].gain=1;project().sampler[S.selectedTrack].reverse=false;
        const existing=sampleRows.findIndex(r=>r.track===S.selectedTrack);const row={track:S.selectedTrack,fileName:file.name,buffer:ab};if(existing>=0)sampleRows[existing]=row;else sampleRows.push(row);
        renderSampler();renderSequencer();remember();toast(`${file.name} cargado · ${decoded.duration.toFixed(2)} s`);
      }catch(err){toast(`Sample: ${err.message}`);}
    };
    $('#previewSampleBtn').onclick=async()=>{try{await ensureAudio();await engine.previewSample(S.selectedTrack);}catch(e){toast(e.message);}};
    $('#clearSampleBtn').onclick=async()=>{const track=S.selectedTrack;engine.clearSample(track);await T.Storage.deleteSample(track).catch(()=>{});sampleRows=sampleRows.filter(r=>r.track!==track);project().sampler[track]={name:'',start:0,end:1,gain:1,reverse:false};renderSampler();renderSequencer();remember();toast('Sample eliminado; vuelve el motor sintetizado.');};
    $('#sampleStartInput').oninput=e=>{const s=project().sampler[S.selectedTrack];s.start=Math.min(Number(e.target.value)/100,s.end-.01);e.target.value=Math.round(s.start*100);drawWaveform();remember();};
    $('#sampleEndInput').oninput=e=>{const s=project().sampler[S.selectedTrack];s.end=Math.max(Number(e.target.value)/100,s.start+.01);e.target.value=Math.round(s.end*100);drawWaveform();remember();};
    $('#sampleGainInput').oninput=e=>{project().sampler[S.selectedTrack].gain=Number(e.target.value)/100;remember();};
    $('#sampleReverseInput').onchange=e=>{project().sampler[S.selectedTrack].reverse=e.target.checked;remember();};
  }

  function bindMidiAndKeyboard() {
    const noteToTrack=n=>T.TRACKS[(n-36)%T.TRACKS.length>=0?(n-36)%T.TRACKS.length:0].id;
    $('#midiBtn').onclick=async()=>{try{const n=await T.Midi.init();$('#midiState').textContent=`MIDI ${n} INPUT${n===1?'':'S'}`;$('#midiState').style.color='var(--accent)';toast('MIDI activo.');}catch(e){toast(e.message);}};
    T.Midi.onNote=async(n,v)=>{try{await ensureAudio();await engine.triggerNow(noteToTrack(n),v,n-60);}catch(_){}};
    T.Midi.onCC=(cc,v)=>{const n=v/127;if(cc===1||cc===74){project().master.bassCutoff=Math.round(80+n*6920);$('#bassCutoffInput').value=project().master.bassCutoff;}else if(cc===7){project().master.volume=Math.round(n*100);$('#masterInput').value=project().master.volume;}else if(cc===71){project().master.bassRes=Math.round(n*28);$('#bassResInput').value=project().master.bassRes;}else return;engine.setMaster(project().master);remember();};
    const map={a:'kick',s:'clap',d:'chh',f:'ohh',g:'perc',h:'bass',j:'stab',k:'acid'};
    window.addEventListener('keydown',async e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();$('#playBtn').click();return;}const tr=map[e.key.toLowerCase()];if(tr){e.preventDefault();try{await ensureAudio();await engine.triggerNow(tr,112,0);}catch(_){}}});
  }

  function bindSong() {
    $('#songPlayBtn').onclick=async()=>{try{await ensureAudio();project().song.chain=$('#songChainInput').value;project().song.repeats=Number($('#songRepeatsInput').value)||1;await seq.startSong(project().song.chain,project().song.repeats);updateTransport();remember();}catch(e){toast(e.message);}};
    $('#songStopBtn').onclick=()=>{seq.stop();updateTransport();};
  }

  function bindProject() {
    $('#saveBtn').onclick=()=>{const ok=T.Storage.saveProject(project());toast(ok?'Proyecto guardado localmente.':'No se pudo guardar. Revisa permisos/cuota de almacenamiento.',3000);};
    $('#newBtn').onclick=()=>{if(!confirm('¿Crear un proyecto nuevo? Se perderán los cambios no guardados.'))return;seq.stop();S.reset();T.TRACKS.forEach(t=>engine.clearSample(t.id));samplesActivated=false;fillPatternSelects();renderAll();const ok=T.Storage.saveProject(project());engine.setMaster(project().master);engine.applyMixer(project().mixer);toast(ok?'Proyecto nuevo.':'Proyecto nuevo creado, pero no pudo guardarse localmente.',3000);};
    $('#exportProjectBtn').onclick=()=>{const blob=new Blob([JSON.stringify(project(),null,2)],{type:'application/json'});T.Export.download(blob,`${safeName(project().name)}.techno404.json`);};
    $('#importProjectInput').onchange=async e=>{const file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;try{const raw=JSON.parse(await file.text());S.project=S.normalize(raw);S.history=[];S.future=[];S.selectedStep=null;S.selectedClipId=null;T.TRACKS.forEach(t=>engine.clearSample(t.id));samplesActivated=false;renderAll();engine.setMaster(project().master);engine.applyMixer(project().mixer);remember();toast('Proyecto importado.');}catch(err){toast(`JSON inválido: ${err.message}`);}};
    const refreshExportOptions=()=>{const format=$('#exportFormatSelect').value;$$('.mp3-export-option').forEach(el=>el.hidden=format!=='mp3');$$('.flac-export-option').forEach(el=>el.hidden=format!=='flac');const cs=T.Codecs?.status?.();if(cs){const ready=[cs.mp3?'MP3 ✓':'MP3 ·',cs.flac?'FLAC ✓':'FLAC ·'].join('  ');$('#codecState').textContent=ready;}};
    $('#exportFormatSelect').onchange=refreshExportOptions;
    refreshExportOptions();
    $('#prepareCodecsBtn').onclick=async()=>{const btn=$('#prepareCodecsBtn');btn.disabled=true;try{setProgress('Preparando codecs…',.05);const report=await T.Codecs.prepareAll(label=>setProgress(label,.45));const ok=report.filter(r=>r.ok);const failed=report.filter(r=>!r.ok);refreshExportOptions();clearProgress();if(failed.length)toast(`Codecs: ${ok.length}/2 preparados. ${failed.map(r=>r.name+': '+r.error).join(' · ')}`,5000);else toast('MP3 y FLAC preparados y cacheados para reutilización offline.',3200);}catch(e){clearProgress();toast(`Codecs: ${e.message}`,4200);}finally{btn.disabled=false;}};
    $('#exportWavBtn').onclick=async()=>{const btn=$('#exportWavBtn');try{await ensureAudio();btn.disabled=true;const bars=clamp(Number($('#wavBarsInput').value)||4,1,32);const format=$('#exportFormatSelect').value;const opts={format,mp3Bitrate:Number($('#mp3BitrateSelect').value)||320,flacCompression:clamp(Number.isFinite(Number($('#flacCompressionInput').value))?Number($('#flacCompressionInput').value):5,0,8),normalize:$('#exportNormalizeInput').checked,targetDb:-1,fadeIn:clamp(Number($('#exportFadeInInput').value)||0,0,10),fadeOut:clamp(Number($('#exportFadeOutInput').value)||0,0,10),tailSeconds:clamp(Number($('#exportTailInput').value)||0,0,15),onProgress:(stage,ratio)=>{if(stage==='codec')setProgress(`Preparando codec ${format.toUpperCase()}…`,.02+ratio*.06);else if(stage==='render')setProgress('Renderizando mixdown…',.08+ratio*.58);else setProgress(`Codificando ${format.toUpperCase()}…`,.67+ratio*.31);}};await new Promise(r=>setTimeout(r,20));const result=await T.Export.mixdownFormat(project(),engine.customSamples,bars,opts);setProgress(`Preparando ${format.toUpperCase()}…`,.99);const date=new Date().toISOString().slice(0,10);const base=`${safeName(project().name)}_${project().bpm}bpm_${date}`;T.Export.download(result.blob,`${base}.${result.extension}`);clearProgress();refreshExportOptions();toast(`Mix ${format.toUpperCase()} exportado.`);}catch(e){clearProgress();toast(`Export: ${e.message}`,4200);}finally{btn.disabled=false;}};
    $('#exportStemsBtn').onclick=async()=>{try{await ensureAudio();const bars=clamp(Number($('#wavBarsInput').value)||4,1,32);$('#exportStemsBtn').disabled=true;const zip=await T.Export.stemsZip(project(),engine.customSamples,bars,(i,total,name)=>setProgress(`Stem ${Math.min(i+1,total)}/${total}: ${name}`,i/total));const date=new Date().toISOString().slice(0,10);T.Export.download(zip,`${safeName(project().name)}_${project().bpm}bpm_${date}_stems_wav.zip`);clearProgress();toast('STEMS WAV ZIP exportado.');}catch(e){clearProgress();toast(`Stems: ${e.message}`,3000);}finally{$('#exportStemsBtn').disabled=false;}};
  }

  function spectrum() {
    seq.pumpVisual();
    const canvas=$('#miniSpectrumCanvas'),ctx=canvas.getContext('2d'),dpr=devicePixelRatio||1,w=Math.max(120,Math.floor(canvas.clientWidth*dpr)),h=Math.max(80,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;ctx.clearRect(0,0,w,h);ctx.fillStyle=uiColor('--canvas-bg','#080b10');ctx.fillRect(0,0,w,h);
    if(engine.analyser){const data=new Uint8Array(engine.analyser.frequencyBinCount);engine.analyser.getByteFrequencyData(data);ctx.beginPath();for(let i=0;i<data.length;i+=4){const x=i/data.length*w,y=h-(data[i]/255)*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=uiColor('--accent','#55f59d');ctx.lineWidth=Math.max(1,dpr);ctx.stroke();}
    requestAnimationFrame(spectrum);
  }

  seq.onVisual=event=>{
    $$('.step.playing').forEach(el=>el.classList.remove('playing'));
    if(event.mode!=='arranger'){$$(`.step[data-step="${event.step}"]`).forEach(el=>el.classList.add('playing'));}
    if(event.mode==='arranger'&&event.bar!==lastArrangerBar){lastArrangerBar=event.bar;renderArranger();}
    if(event.mode!=='arranger'&&project().currentPattern!==$('#patternSelect').value){$('#patternSelect').value=project().currentPattern;renderScenes();}
  };
  seq.onStop=()=>{lastArrangerBar=-1;updateTransport();renderArranger();engine.setMaster(project().master);};
  seq.onMode=updateTransport;

  async function main() {
    const restored = T.Storage.loadProject();
    if (restored) S.project = restored;
    sampleRows = await T.Storage.listSamples();
    fillPatternSelects();
    bindEditor(); bindTransport(); bindPatterns(); bindGenerator(); bindMaster(); bindPianoAutomation(); bindArranger(); bindSampler(); bindMidiAndKeyboard(); bindSong(); bindProject();
    if(T.V4UI&&T.V4UI.init) await T.V4UI.init({engine,seq,ensureAudio,toast,remember,snapshot,renderAll,renderArranger,renderSampler});
    renderAll();
    window.addEventListener('techno404:themechange',()=>renderAll());
    spectrum();
    if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
    status('V4.2.0 lista. WAV/MP3/FLAC, Premium UI, 7 skins, ARRANGER, MIDI clips y 16 pads preparados.');
  }

  main().catch(e=>{console.error(e);toast(`Inicio: ${e.message}`,4000);});
})();
