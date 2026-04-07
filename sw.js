const CACHE_NAME='pm-scanner-v8';
const ASSETS=['/','/index.html','/manifest.json','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const rc=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,rc))}return r}).catch(()=>caches.match(e.request)))});
