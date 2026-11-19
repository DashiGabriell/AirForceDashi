/* Shell-only PWA — never cache wallet / economy authority. */
const SHELL = "afd-shell-v1";
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  const apiPaths = [
    "/auth",
    "/me",
    "/wallet",
    "/rewards",
    "/hangar",
    "/shop",
    "/inventory",
    "/flags",
    "/telemetry",
    "/operations",
    "/mastery",
    "/medals",
    "/leaderboard",
    "/health",
  ];
  if (apiPaths.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname === "/" || url.pathname.endsWith(".html"))) {
            const copy = res.clone();
            void caches.open(SHELL).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
