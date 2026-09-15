/* Service worker — deixa o aplicativo abrir e mostrar a última tela mesmo
   com a rede caindo. Dado de saldo sempre vem do servidor: não se inventa
   estoque a partir de cache. */
const CACHE = "smo-material-v2";
const CASCA = ["./", "./index.html", "./config.js", "./app.js", "./graficos.js",
               "./mod-estoque.js", "./mod-equipamentos.js", "./mod-pedidos.js",
               "./mod-missoes.js", "./mod-painel.js", "./manifest.webmanifest",
               "./img/gbaph-96.png", "./img/gbaph-192.png",
               "./img/cbmpe-96.png", "./img/cbmpe-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // nunca guardar resposta de API, autenticação ou tempo real
  if (url.pathname.includes("/rest/v1") || url.pathname.includes("/auth/v1")
      || url.pathname.includes("/realtime") || url.pathname.includes("/storage/v1")) return;

  e.respondWith(
    caches.match(e.request).then(guardado => {
      const rede = fetch(e.request).then(r => {
        if (r && r.status === 200 && url.origin === location.origin){
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      }).catch(() => guardado);
      return guardado || rede;
    })
  );
});
