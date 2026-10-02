window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T=window.Techno404;
  const p=()=>T.State.project;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function all(){return Object.values(p().midiClips).sort((a,b)=>a.name.localeCompare(b.name));}
  function get(id){return p().midiClips[id]||null;}
  function create(track='acid',bars=2,name='MIDI Clip'){const c=T.makeMidiClip(name,T.SYNTH_TRACKS.includes(track)?track:'acid',bars);c.notes=[];p().midiClips[c.id]=c;p().selectedMidiClipId=c.id;return c;}
  function duplicate(id){const src=get(id);if(!src)return null;const c=JSON.parse(JSON.stringify(src));c.id=T.uid('midi');c.name=(src.name+' Copy').slice(0,80);c.notes=c.notes.map(n=>({...n,id:T.uid('note')}));p().midiClips[c.id]=c;p().selectedMidiClipId=c.id;return c;}
  function remove(id){if(Object.keys(p().midiClips).length<=1)return false;delete p().midiClips[id];p().arranger.clips.forEach(c=>{if(c.midiClipId===id){c.type='pattern';c.midiClipId=null;}});if(p().selectedMidiClipId===id)p().selectedMidiClipId=Object.keys(p().midiClips)[0];return true;}
  function addNote(clipId,start,note,length=1,velocity=100){const c=get(clipId);if(!c)return null;const total=c.bars*16;const n={id:T.uid('note'),start:clamp(Math.round(start),0,total-1),length:clamp(Math.round(length),1,total),note:clamp(Math.round(note),24,84),velocity:clamp(Math.round(velocity),1,127)};n.length=Math.min(n.length,total-n.start);c.notes.push(n);return n;}
  function removeNote(clipId,noteId){const c=get(clipId);if(!c)return false;const before=c.notes.length;c.notes=c.notes.filter(n=>n.id!==noteId);return c.notes.length!==before;}
  function updateNote(clipId,noteId,patch){const c=get(clipId),n=c&&c.notes.find(x=>x.id===noteId);if(!n)return false;const total=c.bars*16;if('start'in patch)n.start=clamp(Math.round(patch.start),0,total-1);if('note'in patch)n.note=clamp(Math.round(patch.note),24,84);if('velocity'in patch)n.velocity=clamp(Math.round(patch.velocity),1,127);if('length'in patch)n.length=clamp(Math.round(patch.length),1,total-n.start);n.length=Math.min(n.length,total-n.start);return true;}
  function notesAt(clipId,step){const c=get(clipId);if(!c)return[];const total=c.bars*16;const pos=((step%total)+total)%total;return c.notes.filter(n=>n.start===pos);}
  function resize(clipId,bars){const c=get(clipId);if(!c)return false;c.bars=clamp(Math.round(bars),1,8);const total=c.bars*16;c.notes=c.notes.filter(n=>n.start<total).map(n=>({...n,length:Math.min(n.length,total-n.start)}));return true;}
  T.MidiClips={all,get,create,duplicate,remove,addNote,removeNote,updateNote,notesAt,resize};
})();
