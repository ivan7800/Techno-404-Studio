window.Techno404 = window.Techno404 || {};
(() => {
  'use strict';
  const T=window.Techno404;
  const PROJECT_KEY='techno404-v4';
  const DB_NAME='techno404-samples';
  const DB_VERSION=3;

  function openDB(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('IndexedDB no disponible'));const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('samples'))db.createObjectStore('samples',{keyPath:'track'});if(!db.objectStoreNames.contains('library'))db.createObjectStore('library',{keyPath:'id'});if(!db.objectStoreNames.contains('pads'))db.createObjectStore('pads',{keyPath:'pad'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('No se pudo abrir IndexedDB'));});}
  async function tx(storeName,mode,action){const db=await openDB();return new Promise((resolve,reject)=>{const close=()=>{try{db.close();}catch(_){}};let tr,store,req;try{tr=db.transaction(storeName,mode);store=tr.objectStore(storeName);req=action(store);}catch(e){close();reject(e);return;}tr.oncomplete=()=>{const result=req&&'result'in req?req.result:undefined;close();resolve(result);};tr.onerror=()=>{const err=tr.error||new Error('Error de IndexedDB');close();reject(err);};tr.onabort=()=>{const err=tr.error||new Error('Transacción cancelada');close();reject(err);};});}

  T.Storage={
    saveProject(project){try{localStorage.setItem(PROJECT_KEY,JSON.stringify(project));return true;}catch(_){return false;}},
    loadProject(){const keys=[PROJECT_KEY,'techno404-v3','techno404-v2'];for(const key of keys){let raw=null;try{raw=localStorage.getItem(key);}catch(_){return null;}if(!raw)continue;try{const migrated=T.normalizeProject(JSON.parse(raw));try{localStorage.setItem(PROJECT_KEY,JSON.stringify(migrated));}catch(_){}return migrated;}catch(_){continue;}}return null;},
    clearProject(){try{localStorage.removeItem(PROJECT_KEY);return true;}catch(_){return false;}},

    async listSamples(){return tx('samples','readonly',s=>s.getAll()).then(v=>v||[]).catch(()=>[]);},
    async putSample(track,fileName,arrayBuffer){return tx('samples','readwrite',s=>s.put({track,fileName,buffer:arrayBuffer,updatedAt:Date.now()}));},
    async deleteSample(track){return tx('samples','readwrite',s=>s.delete(track));},
    async getSample(track){return tx('samples','readonly',s=>s.get(track)).catch(()=>null);},

    async listLibrary(){return tx('library','readonly',s=>s.getAll()).then(v=>v||[]).catch(()=>[]);},
    async putLibrarySample(id,file){const buffer=await file.arrayBuffer();const row={id,name:file.name,type:file.type||'audio/*',size:file.size||buffer.byteLength,buffer,updatedAt:Date.now()};await tx('library','readwrite',s=>s.put(row));return row;},
    async getLibrarySample(id){return tx('library','readonly',s=>s.get(id)).catch(()=>null);},
    async deleteLibrarySample(id){return tx('library','readwrite',s=>s.delete(id));},

    async listPadSamples(){return tx('pads','readonly',s=>s.getAll()).then(v=>v||[]).catch(()=>[]);},
    async putPadSample(pad,fileName,arrayBuffer,libraryId=null){return tx('pads','readwrite',s=>s.put({pad,fileName,libraryId,buffer:arrayBuffer,updatedAt:Date.now()}));},
    async getPadSample(pad){return tx('pads','readonly',s=>s.get(pad)).catch(()=>null);},
    async deletePadSample(pad){return tx('pads','readwrite',s=>s.delete(pad));}
  };
})();
