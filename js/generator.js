window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;
  const rnd=(n=1)=>Math.random()*n, chance=p=>Math.random()*100<p, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pitchFrom=arr=>arr[Math.floor(rnd(arr.length))];

  function resetStep(s){Object.assign(s,{on:false,velocity:100,probability:100,ratchet:1,pitch:0,micro:0,accent:false,glide:false,cutoff:60,gate:72});}
  function clearPattern(pat){T.TRACKS.forEach(t=>pat.tracks[t.id].forEach(resetStep));}
  function hit(s, velocity=100, extra={}){s.on=true;s.velocity=clamp(Math.round(velocity),1,127);Object.assign(s,extra);}

  function seedAutomation(pat, genre, style, energy, dark){
    for(let i=0;i<64;i++){
      const phase=(i%16)/15, deep=genre==='deep-house', acid=genre==='acid-house'||style==='acid';
      pat.automation.filter[i]=clamp((deep?72:60)+energy*.22+Math.sin(phase*Math.PI)*10,0,100);
      pat.automation.delay[i]=clamp((deep?20:genre==='house'?13:10)+(i%8===7?10:0),0,100);
      pat.automation.reverb[i]=clamp((deep?25:genre==='house'?14:9)+dark*.06,0,100);
      pat.automation.master[i]=82;
      pat.automation.drive[i]=clamp((genre==='techno'&&['hard','industrial'].includes(style)?35:genre==='acid-house'?18:genre==='deep-house'?6:12)+energy*.08,0,100);
      pat.automation.acidCutoff[i]=clamp((acid?34:25)+energy*.35+Math.sin(i/5)*20,5,95);
    }
  }

  function techno(pat,n,style,energy,dark,complex){
    const hard=['hard','industrial','peak'].includes(style), acid=style==='acid', dub=style==='dub';
    for(let i=0;i<n;i++){
      const q=i%16; let s;
      if(q%4===0||(hard&&chance(8+energy*.22)))hit(pat.tracks.kick[i],112+rnd(15),{accent:q===0,gate:88});
      if(q===4||q===12)hit(pat.tracks.clap[i],90+rnd(25));
      if(q%2===0&&chance(55+energy*.35))hit(pat.tracks.chh[i],58+rnd(45),{probability:80+Math.floor(rnd(21))});
      if([2,6,10,14].includes(q)&&chance(30+energy*.42))hit(pat.tracks.ohh[i],65+rnd(40));
      if(chance(7+complex*.18))hit(pat.tracks.perc[i],55+rnd(50),{micro:Math.floor(rnd(17))-8,pitch:Math.floor(rnd(9))-4});
      if(chance((acid?38:20)+complex*.18)&&q%2===0){const id=acid?'acid':'bass';s=pat.tracks[id][i];hit(s,80+rnd(45),{pitch:pitchFrom([0,0,3,5,7,10,12])-(dark>65?12:0),accent:chance(28+energy*.2),glide:chance(acid?30:8),cutoff:35+Math.floor(rnd(60)),probability:80+Math.floor(rnd(21)),gate:45+Math.floor(rnd(50))});}
      if((style==='detroit'||dub)&&q%8===4&&chance(35+complex*.25))hit(pat.tracks.stab[i],70+rnd(35),{pitch:pitchFrom([0,3,5,7]),gate:60});
      if(hard&&q===15&&chance(complex*.7))hit(pat.tracks.clap[i],75+rnd(40),{ratchet:chance(50)?2:3});
    }
  }

  function houseFamily(pat,n,genre,style,energy,dark,complex){
    const tech=genre==='tech-house', deep=genre==='deep-house', acid=genre==='acid-house';
    const kickVel=deep?103:tech?118:112;
    const swingMicro=deep?7:tech?5:4;
    for(let i=0;i<n;i++){
      const q=i%16; let s;
      if(q%4===0)hit(pat.tracks.kick[i],kickVel+(q===0?7:0)+rnd(5),{accent:q===0,gate:82});
      if(q===4||q===12)hit(pat.tracks.clap[i],deep?78+rnd(10):92+rnd(18),{micro:q===12?swingMicro:0});
      if(q%2===0 && q%4!==0)hit(pat.tracks.chh[i],deep?56+rnd(18):65+rnd(26),{micro:swingMicro,probability:deep?88:96});
      if([2,6,10,14].includes(q)&&chance((deep?46:68)+energy*.18))hit(pat.tracks.ohh[i],deep?62+rnd(14):72+rnd(24),{micro:swingMicro});
      const percChance=tech?18+complex*.28:8+complex*.15;
      if(chance(percChance)&&![0,4,8,12].includes(q))hit(pat.tracks.perc[i],55+rnd(35),{micro:Math.floor(rnd(11))-2,pitch:Math.floor(rnd(7))-3,probability:75+Math.floor(rnd(25))});

      if(acid){
        if(q%2===0&&chance(48+complex*.25)){s=pat.tracks.acid[i];hit(s,82+rnd(39),{pitch:pitchFrom([0,0,3,5,7,10,12])-12,accent:chance(30+energy*.25),glide:chance(30+complex*.15),cutoff:30+Math.floor(rnd(66)),gate:42+Math.floor(rnd(50))});}
        if([0,7,10,14].includes(q)&&chance(35))hit(pat.tracks.bass[i],70+rnd(20),{pitch:pitchFrom([0,-5,-7])-12,gate:50});
      }else{
        const bassPositions=tech?[0,3,6,10,14]:deep?[0,3,7,10,14]:[0,3,6,10,14];
        if(bassPositions.includes(q)&&chance((tech?78:deep?66:72)+energy*.12)){s=pat.tracks.bass[i];hit(s,deep?76+rnd(20):84+rnd(30),{pitch:pitchFrom(deep?[0,0,-5,3,7]:[0,0,-2,3,5,7])-12,gate:deep?72:55,probability:88+Math.floor(rnd(13)),micro:(q%2?swingMicro:0)});}
      }

      const stabPositions=deep?[0,6,12]:style==='piano'?[0,4,8,12]:[0,6,12];
      if(stabPositions.includes(q)&&chance((deep?58:genre==='house'?52:28)+complex*.18))hit(pat.tracks.stab[i],deep?68+rnd(18):75+rnd(28),{pitch:pitchFrom(deep?[0,3,7,10]:[0,3,5,7,10]),gate:deep?78:58,probability:82+Math.floor(rnd(19)),micro:q%2?swingMicro:0});

      if(style==='jackin'&&[1,5,9,13].includes(q)&&chance(45))hit(pat.tracks.perc[i],72+rnd(22),{pitch:-2,micro:5});
      if(style==='percussive'&&chance(18)&&q%2===1)hit(pat.tracks.perc[i],62+rnd(30),{pitch:Math.floor(rnd(9))-4,micro:5});
      if(style==='atmospheric'&&[6,14].includes(q))hit(pat.tracks.stab[i],62+rnd(12),{pitch:7,gate:90,probability:80});
      if(style==='warehouse'&&q===15&&chance(50))hit(pat.tracks.clap[i],86+rnd(20),{ratchet:2});
    }
  }

  function generate(style,energy=72,dark=78,complex=58){
    const P=T.State.project, pat=P.patterns[P.currentPattern], n=P.steps, genre=P.genre||'techno';
    clearPattern(pat);
    if(genre==='techno') techno(pat,n,style,energy,dark,complex); else houseFamily(pat,n,genre,style,energy,dark,complex);
    const profile=T.Genres&&T.Genres.get(genre); if(profile){P.bpm=profile.bpm;P.swing=profile.swing;}
    if(genre==='techno'){
      const bpm=({minimal:128,detroit:132,dub:124,acid:136,hypnotic:134,peak:138,industrial:145,hard:150})[style]; if(bpm)P.bpm=bpm;
      P.swing=style==='detroit'?18:style==='hypnotic'?10:6;
    } else if(genre==='tech-house') P.bpm=style==='minimal-th'?125:126;
    else if(genre==='house') P.bpm=style==='jackin'?125:124;
    else if(genre==='deep-house') P.bpm=style==='atmospheric'?121:122;
    else if(genre==='acid-house') P.bpm=style==='warehouse'?128:126;
    seedAutomation(pat,genre,style,energy,dark); return pat;
  }

  function createArrangement(){
    const P=T.State.project, genre=P.genre||'techno', profile=T.Genres&&T.Genres.get(genre), length=(profile&&profile.arrangementBars)||32;
    const hasHits=pid=>T.TRACKS.some(track=>P.patterns[pid].tracks[track.id].some(step=>step.on));
    const available=T.PATTERN_IDS.filter(hasHits), progression=available.length?available:['A1'];
    P.arranger.lengthBars=length; P.arranger.clips=[];
    const startBars={
      techno:{kick:0,clap:4,chh:0,ohh:8,perc:8,bass:4,stab:12,acid:16},
      'tech-house':{kick:0,clap:0,chh:0,ohh:4,perc:4,bass:4,stab:12,acid:20},
      house:{kick:0,clap:0,chh:0,ohh:4,perc:8,bass:4,stab:4,acid:24},
      'deep-house':{kick:0,clap:4,chh:0,ohh:8,perc:8,bass:4,stab:4,acid:24},
      'acid-house':{kick:0,clap:0,chh:0,ohh:4,perc:8,bass:8,stab:12,acid:4}
    }[genre]||{};
    T.TRACKS.forEach(track=>{
      const start=startBars[track.id]??0;
      for(let bar=start;bar<length;bar+=4){
        // Breathers create more musical arrangements without deleting the backbone.
        if(track.id!=='kick' && bar>=24 && bar<28 && ['ohh','perc'].includes(track.id)) continue;
        const section=Math.floor(bar/4), sourcePattern=progression[section%progression.length];
        P.arranger.clips.push({id:T.uid('clip'),type:'pattern',track:track.id,pattern:sourcePattern,midiClipId:null,bar,bars:Math.min(4,length-bar)});
      }
    });
    P.arranger.automationPattern=progression[0]; return P.arranger;
  }

  T.Generator={
    generate,
    humanize(){const pat=T.State.project.patterns[T.State.project.currentPattern];T.TRACKS.forEach(t=>pat.tracks[t.id].forEach(s=>{if(!s.on)return;s.velocity=clamp(s.velocity+Math.floor(rnd(15))-7,35,127);s.micro=clamp(s.micro+Math.floor(rnd(9))-4,-20,20);}));},
    euclid(track,pulses=5){const arr=T.State.project.patterns[T.State.project.currentPattern].tracks[track],n=T.State.project.steps,p=Math.max(1,Math.min(n,pulses));for(let i=0;i<n;i++){arr[i].on=Math.floor(i*p/n)!==Math.floor((i-1)*p/n);if(arr[i].on)arr[i].velocity=92+(i%4===0?20:0);}},
    acidLine(){const arr=T.State.project.patterns[T.State.project.currentPattern].tracks.acid,n=T.State.project.steps;for(let i=0;i<n;i++){arr[i].on=chance(42)&&i%2===0;arr[i].pitch=pitchFrom([0,3,5,7,10,12])-12;arr[i].velocity=80+Math.floor(rnd(46));arr[i].accent=chance(35);arr[i].glide=chance(30);arr[i].cutoff=30+Math.floor(rnd(68));arr[i].gate=45+Math.floor(rnd(50));}},
    createArrangement
  };
})();
