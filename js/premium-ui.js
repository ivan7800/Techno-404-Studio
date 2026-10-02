(()=>{
  'use strict';
  const T=window.Techno404=window.Techno404||{};
  const KEY='techno404-premium-ui-v4.1';
  const SKINS={
    carbon:{label:'Carbon',theme:'#070a0f'},
    acid:{label:'Acid Lime',theme:'#090d08'},
    detroit:{label:'Detroit Amber',theme:'#120e08'},
    ultraviolet:{label:'Ultraviolet',theme:'#0f0918'},
    ice:{label:'Ice Blue',theme:'#08111a'},
    crimson:{label:'Crimson',theme:'#14090d'},
    'studio-light':{label:'Studio Light',theme:'#f4f7fa'}
  };
  const MODES={cinematic:'Cinematic',clean:'Clean',performance:'Performance'};
  const DENSITIES={normal:'Normal',compact:'Compact'};
  const defaults={skin:'carbon',mode:'cinematic',density:'normal'};
  let settings={...defaults};

  const safeParse=s=>{try{return JSON.parse(s)}catch(_){return null}};
  function load(){let raw=null;try{raw=safeParse(localStorage.getItem(KEY));}catch(_){}settings={...defaults,...(raw&&typeof raw==='object'?raw:{})};if(!SKINS[settings.skin])settings.skin=defaults.skin;if(!MODES[settings.mode])settings.mode=defaults.mode;if(!DENSITIES[settings.density])settings.density=defaults.density;return settings;}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
  function themeMeta(){let meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta);}meta.content=SKINS[settings.skin].theme;}
  function apply(next={},persist=true){settings={...settings,...next};if(!SKINS[settings.skin])settings.skin='carbon';if(!MODES[settings.mode])settings.mode='cinematic';if(!DENSITIES[settings.density])settings.density='normal';const root=document.documentElement;root.dataset.skin=settings.skin;root.dataset.uiMode=settings.mode;root.dataset.density=settings.density;themeMeta();if(persist)save();syncControls();window.dispatchEvent(new CustomEvent('techno404:themechange',{detail:{...settings}}));}
  function cssVar(name,fallback=''){const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();return value||fallback;}
  function syncControls(){const skin=document.getElementById('skinSelect'),mode=document.getElementById('uiModeSelect'),density=document.getElementById('densitySelect');if(skin&&skin.value!==settings.skin)skin.value=settings.skin;if(mode&&mode.value!==settings.mode)mode.value=settings.mode;if(density&&density.value!==settings.density)density.value=settings.density;const dot=document.querySelector('.skin-dot');if(dot)dot.title=`Skin: ${SKINS[settings.skin].label}`;}
  function cycleSkin(){const keys=Object.keys(SKINS),i=keys.indexOf(settings.skin);apply({skin:keys[(i+1)%keys.length]});}
  function init(){
    const skin=document.getElementById('skinSelect'),mode=document.getElementById('uiModeSelect'),density=document.getElementById('densitySelect');
    if(skin)skin.onchange=e=>apply({skin:e.target.value});
    if(mode)mode.onchange=e=>apply({mode:e.target.value});
    if(density)density.onchange=e=>apply({density:e.target.value});
    window.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.shiftKey&&e.key.toLowerCase()==='t'){e.preventDefault();cycleSkin();}});
    syncControls();
  }

  load();
  apply(settings,false);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  T.PremiumUI={apply,get settings(){return {...settings}},cssVar,skins:SKINS,modes:MODES,densities:DENSITIES,cycleSkin};
})();
