window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T = window.Techno404;

  const CACHE_NAME = 'techno404-codecs-v1';
  const SOURCES = Object.freeze({
    mp3: {
      name: 'lamejs 1.2.1',
      url: 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
      ready: () => !!(window.lamejs && typeof window.lamejs.Mp3Encoder === 'function')
    },
    flac: {
      name: 'libflacjs 5.6.0',
      url: 'https://cdn.jsdelivr.net/npm/libflacjs@5.6.0/dist/libflac.js',
      ready: () => !!(window.Flac && typeof window.Flac.create_libflac_encoder === 'function')
    }
  });

  const loaded = new Map();

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar el codec desde ${src}`));
      document.head.appendChild(script);
    });
  }

  async function cachedResponse(url) {
    if (!('caches' in window) || !window.isSecureContext) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return hit;
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(url, response.clone());
      return response;
    } catch (error) {
      console.warn('Techno404 codec cache:', error);
      return null;
    }
  }

  async function loadCodec(key) {
    const cfg = SOURCES[key];
    if (!cfg) throw new Error(`Codec desconocido: ${key}`);
    if (cfg.ready()) return true;
    if (loaded.has(key)) return loaded.get(key);

    const promise = (async () => {
      let blobUrl = '';
      try {
        const response = await cachedResponse(cfg.url);
        if (response) {
          const blob = await response.blob();
          blobUrl = URL.createObjectURL(blob);
          await injectScript(blobUrl);
        } else {
          if (!navigator.onLine && location.protocol !== 'file:') {
            throw new Error(`${cfg.name} no está cacheado. Conéctate una vez y pulsa PREPARAR CODECS.`);
          }
          await injectScript(cfg.url);
        }
      } finally {
        if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
      if (!cfg.ready()) throw new Error(`${cfg.name} se cargó, pero no expuso la API esperada.`);
      return true;
    })().catch(error => {
      loaded.delete(key);
      throw error;
    });

    loaded.set(key, promise);
    return promise;
  }

  async function waitForFlac(timeoutMs = 15000) {
    const F = window.Flac;
    if (!F) throw new Error('libflacjs no está disponible.');
    if (typeof F.isReady !== 'function' || F.isReady()) return true;
    await new Promise((resolve, reject) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { if (typeof F.off === 'function') F.off('ready', done); } catch (_) {}
        resolve();
      };
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        try { if (typeof F.off === 'function') F.off('ready', done); } catch (_) {}
        reject(new Error('Timeout inicializando el encoder FLAC.'));
      }, timeoutMs);
      if (typeof F.on === 'function') F.on('ready', done);
      else F.onready = done;
      if (F.isReady()) done();
    });
    return true;
  }

  async function ensureMp3() {
    await loadCodec('mp3');
    return window.lamejs;
  }

  async function ensureFlac() {
    await loadCodec('flac');
    await waitForFlac();
    return window.Flac;
  }

  async function prepareAll(onStatus) {
    const report = [];
    for (const key of ['mp3', 'flac']) {
      const cfg = SOURCES[key];
      try {
        if (onStatus) onStatus(`Preparando ${cfg.name}…`);
        if (key === 'mp3') await ensureMp3(); else await ensureFlac();
        report.push({ key, ok: true, name: cfg.name });
      } catch (error) {
        report.push({ key, ok: false, name: cfg.name, error: error.message });
      }
    }
    return report;
  }

  function status() {
    return {
      mp3: SOURCES.mp3.ready(),
      flac: SOURCES.flac.ready(),
      cacheAvailable: 'caches' in window && window.isSecureContext
    };
  }

  T.Codecs = { ensureMp3, ensureFlac, prepareAll, status, sources: SOURCES };
})();
