window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T=window.Techno404;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function wave(type,phase){const p=((phase%1)+1)%1;if(type==='triangle')return 1-4*Math.abs(p-.5);if(type==='square')return p<.5?1:-1;if(type==='saw')return p*2-1;return Math.sin(p*Math.PI*2);}
  function value(lfo, step, time, bpm){if(!lfo||!lfo.enabled||lfo.target==='off')return 0;let phase;if(lfo.sync){phase=(step/16)*Math.max(.03125,Number(lfo.rate)||.5)+(Number(lfo.phase)||0);}else{phase=time*Math.max(.03125,Number(lfo.rate)||.5)+(Number(lfo.phase)||0);}return wave(lfo.waveform,phase)*clamp((Number(lfo.depth)||0)/100,0,1);}
  function apply(engine,step,time,bpm){const mod=T.State.project.modulation||{};['lfo1','lfo2'].forEach(k=>{const l=mod[k];if(l&&l.enabled)engine.applyLfo(l.target,value(l,step,time,bpm),time);});}
  T.Modulation={wave,value,apply};
})();
