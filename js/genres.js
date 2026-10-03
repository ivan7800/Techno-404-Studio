window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;

  const PROFILES = {
    techno: {
      label:'Techno', bpm:136, swing:10, defaultStyle:'hypnotic',
      styles:[['hypnotic','Hypnotic'],['detroit','Detroit'],['minimal','Minimal'],['acid','Acid'],['industrial','Industrial'],['hard','Hard Techno'],['dub','Dub Techno'],['peak','Peak Time']],
      master:{drive:18,delay:15,reverb:10,bassCutoff:1200,bassRes:15,compressor:38,sidechainRelease:180},
      mixer:{kick:{volume:90},bass:{sidechain:32},stab:{delaySend:22,reverbSend:18},acid:{sidechain:32}},
      arrangementBars:32
    },
    'tech-house': {
      label:'Tech House', bpm:126, swing:18, defaultStyle:'rolling',
      styles:[['rolling','Rolling'],['groovy','Groovy'],['minimal-th','Minimal'],['percussive','Percussive']],
      master:{drive:12,delay:10,reverb:8,bassCutoff:1500,bassRes:10,compressor:42,sidechainRelease:150},
      mixer:{kick:{volume:92},clap:{volume:82,reverbSend:7},chh:{volume:76},ohh:{volume:72},perc:{volume:80},bass:{volume:88,sidechain:45},stab:{volume:72,delaySend:12,reverbSend:12},acid:{volume:64,sidechain:30}},
      arrangementBars:32
    },
    house: {
      label:'House', bpm:124, swing:20, defaultStyle:'classic',
      styles:[['classic','Classic'],['piano','Piano'],['jackin','Jackin'],['vocal','Vocal Groove']],
      master:{drive:8,delay:12,reverb:14,bassCutoff:1700,bassRes:8,compressor:34,sidechainRelease:170},
      mixer:{kick:{volume:88},clap:{volume:82,reverbSend:12},chh:{volume:75},ohh:{volume:78},perc:{volume:72},bass:{volume:84,sidechain:38},stab:{volume:82,delaySend:15,reverbSend:24},acid:{volume:58,sidechain:24}},
      arrangementBars:32
    },
    'deep-house': {
      label:'Deep House', bpm:122, swing:24, defaultStyle:'warm',
      styles:[['warm','Warm'],['atmospheric','Atmospheric'],['soulful','Soulful'],['deep-minimal','Minimal Deep']],
      master:{drive:5,delay:18,reverb:25,bassCutoff:1100,bassRes:7,compressor:28,sidechainRelease:210},
      mixer:{kick:{volume:84},clap:{volume:74,reverbSend:18},chh:{volume:68},ohh:{volume:72,reverbSend:10},perc:{volume:66,reverbSend:14},bass:{volume:86,sidechain:30},stab:{volume:80,delaySend:25,reverbSend:36},acid:{volume:48,sidechain:20}},
      arrangementBars:32
    },
    'acid-house': {
      label:'Acid House', bpm:126, swing:16, defaultStyle:'chicago303',
      styles:[['chicago303','Chicago 303'],['warehouse','Warehouse'],['psychedelic','Psychedelic'],['jack-acid','Jack Acid']],
      master:{drive:14,delay:17,reverb:12,bassCutoff:1850,bassRes:20,compressor:36,sidechainRelease:165},
      mixer:{kick:{volume:90},clap:{volume:80,reverbSend:8},chh:{volume:73},ohh:{volume:76},perc:{volume:75},bass:{volume:66,sidechain:30},stab:{volume:64,delaySend:18,reverbSend:14},acid:{volume:90,delaySend:16,reverbSend:9,sidechain:36}},
      arrangementBars:32
    }
  };

  function get(id){ return PROFILES[id] || PROFILES.techno; }
  function ids(){ return Object.keys(PROFILES); }
  function label(id){ return get(id).label; }

  function apply(project,id,{rename=false}={}){
    const p=get(id); project.genre=id; project.bpm=p.bpm; project.swing=p.swing;
    Object.assign(project.master,p.master);
    Object.entries(p.mixer).forEach(([track,values])=>{ if(project.mixer[track]) Object.assign(project.mixer[track],values); });
    if(rename && (!project.name || /^Untitled\b/i.test(project.name))) project.name=`Untitled ${p.label}`;
    return p;
  }

  T.Genres={PROFILES,get,ids,label,apply};
})();
