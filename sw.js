const CACHE='techno404-v4.3.0';
const FILES=[
  './','./index.html','./css/app.css',
  './js/state.js','./js/genres.js','./js/arranger.js','./js/midi-clips.js','./js/audio-engine.js','./js/modulation.js','./js/sequencer.js','./js/generator.js','./js/midi.js','./js/storage.js','./js/codecs.js','./js/exporter.js','./js/v4-ui.js','./js/premium-ui.js','./js/app.js',
  './manifest.webmanifest','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('techno404-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(response=>{if(response&&response.status===200){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>{
    const network=fetch(req).then(response=>{if(response&&response.status===200){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return response;});
    if(cached){event.waitUntil(network.catch(()=>undefined));return cached;}
    return network;
  }));
});
