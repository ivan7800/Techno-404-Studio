window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T=window.Techno404;
  const p=()=>T.State.project;

  function clipsForTrack(trackId){return p().arranger.clips.filter(c=>c.track===trackId).sort((a,b)=>a.bar-b.bar||a.id.localeCompare(b.id));}
  function clipAt(trackId,bar){const clips=p().arranger.clips;for(let i=clips.length-1;i>=0;i--){const c=clips[i];if(c.track===trackId&&bar>=c.bar&&bar<c.bar+c.bars)return c;}return null;}
  function patternStep(trackId,bar,stepInBar){const pr=p(),clip=clipAt(trackId,bar);if(!clip||clip.type==='midi')return null;const rel=bar-clip.bar;const idx=(rel*16+stepInBar)%pr.steps;return{clip,patternId:clip.pattern,stepIndex:idx,step:pr.patterns[clip.pattern].tracks[trackId][idx]};}
  function midiNotesAt(trackId,bar,stepInBar){const pr=p(),clip=clipAt(trackId,bar);if(!clip||clip.type!=='midi'||!clip.midiClipId)return[];const mc=pr.midiClips[clip.midiClipId];if(!mc)return[];const global=(bar-clip.bar)*16+stepInBar;const cycle=mc.bars*16;const pos=((global%cycle)+cycle)%cycle;return mc.notes.filter(n=>n.start===pos).map(n=>({clip,midiClip:mc,note:n}));}

  function addClip(track,pattern,bar,bars=1,type='pattern',midiClipId=null){const pr=p(),start=Math.max(0,Math.min(pr.arranger.lengthBars-1,Math.floor(bar))),len=Math.max(1,Math.min(Math.floor(bars),pr.arranger.lengthBars-start));const synth=T.SYNTH_TRACKS.includes(track);const finalType=type==='midi'&&synth?'midi':'pattern';const c={id:T.uid('clip'),type:finalType,track,pattern:T.PATTERN_IDS.includes(pattern)?pattern:'A1',midiClipId:finalType==='midi'?(midiClipId||pr.selectedMidiClipId):null,bar:start,bars:len};pr.arranger.clips.push(c);return c;}
  function moveClip(id,track,bar){const pr=p(),c=pr.arranger.clips.find(x=>x.id===id);if(!c)return false;c.track=T.TRACKS.some(t=>t.id===track)?track:c.track;if(c.type==='midi'&&!T.SYNTH_TRACKS.includes(c.track)){c.type='pattern';c.midiClipId=null;}c.bar=Math.max(0,Math.min(pr.arranger.lengthBars-1,Math.floor(bar)));c.bars=Math.max(1,Math.min(c.bars,pr.arranger.lengthBars-c.bar));return true;}
  function resizeClip(id,bars){const pr=p(),c=pr.arranger.clips.find(x=>x.id===id);if(!c)return false;c.bars=Math.max(1,Math.min(Math.floor(bars),pr.arranger.lengthBars-c.bar));return true;}
  function removeClip(id){const pr=p(),n=pr.arranger.clips.length;pr.arranger.clips=pr.arranger.clips.filter(c=>c.id!==id);return pr.arranger.clips.length!==n;}
  function duplicateClip(id){const pr=p(),s=pr.arranger.clips.find(c=>c.id===id);if(!s)return null;const bar=Math.min(pr.arranger.lengthBars-1,s.bar+s.bars),bars=Math.min(s.bars,pr.arranger.lengthBars-bar);if(bars<1)return null;const c={...s,id:T.uid('clip'),bar,bars};pr.arranger.clips.push(c);return c;}
  function setClipType(id,type,sourceId=null){const pr=p(),c=pr.arranger.clips.find(x=>x.id===id);if(!c)return false;if(type==='midi'&&T.SYNTH_TRACKS.includes(c.track)){c.type='midi';c.midiClipId=pr.midiClips[sourceId]?sourceId:(pr.selectedMidiClipId||Object.keys(pr.midiClips)[0]);}else{c.type='pattern';c.midiClipId=null;}return true;}
  function sanitize(){const pr=p();pr.arranger.clips=pr.arranger.clips.filter(c=>T.TRACKS.some(t=>t.id===c.track)).map(c=>{const bar=Math.max(0,Math.min(pr.arranger.lengthBars-1,Math.floor(c.bar)));let type=c.type==='midi'&&T.SYNTH_TRACKS.includes(c.track)&&pr.midiClips[c.midiClipId]?'midi':'pattern';return{...c,type,pattern:T.PATTERN_IDS.includes(c.pattern)?c.pattern:'A1',midiClipId:type==='midi'?c.midiClipId:null,bar,bars:Math.max(1,Math.min(Math.floor(c.bars),pr.arranger.lengthBars-bar))};});}

  T.Arranger={clipsForTrack,clipAt,stepFor:patternStep,patternStep,midiNotesAt,addClip,moveClip,resizeClip,removeClip,duplicateClip,setClipType,sanitize};
})();
