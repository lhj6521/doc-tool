// 문서 도구 서비스 워커: 오프라인 실행 + 공유받기
const VERSION = '20261118072515';
const CACHE = 'doc-tool-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('doc-tool-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // 다른 앱에서 "공유 → 문서 도구"로 보낸 파일
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.getAll('file').find((x) => x && typeof x === 'object');
        if (f) {
          const c = await caches.open('doc-tool-share');
          await c.put('./shared-file', new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name || 'shared'), 'Content-Type': f.type || 'application/octet-stream' } }));
        }
      } catch (err) { /* 무시하고 앱만 연다 */ }
      return Response.redirect(new URL('./?share=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  // 캐시 먼저 보여 주고 뒤에서 새 버전 받기
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(e.request.url.split('?')[0], res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await cache.match('./index.html')) || new Response('오프라인', { status: 503 });
  })());
});
