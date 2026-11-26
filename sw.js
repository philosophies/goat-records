// Change the cache version whenever a shipped shell file changes.
const CACHE_PREFIX = "goat-records-shell-";
const CACHE_NAME = CACHE_PREFIX + "22";
const APP_SHELL = [
  "index.html",
  "icons/goat-512.png",
  "manifest.webmanifest",
  "icons/goat-192.png",
  "styles/style.css",
  "styles/production.css",
  "styles/management.css",
  "styles/road.css",
  "styles/industry.css",
  "styles/activities.css",
  "styles/hq.css",
  "styles/campaign.css",
  "styles/locations.css",
  "styles/promotion.css",
  "styles/shell.css",
  "styles/lot.css",
  "styles/places.css",
  "styles/ceo.css",
  "styles/street.css",
  "styles/phone.css",
  "styles/dynasty.css",
  "src/data/core.js",
  "src/data/label.js",
  "src/data/campaign.js",
  "src/data/locations.js",
  "src/data/promotion.js",
  "src/data/company.js",
  "src/data/staff.js",
  "src/data/board.js",
  "src/data/events.js",
  "src/data/roster.js",
  "src/data/parties.js",
  "src/data/cast.js",
  "src/data/stories.js",
  "src/data/story-artists.js",
  "src/data/story-staff.js",
  "src/data/why.js",
  "src/data/onboarding.js",
  "src/data/rivals.js",
  "src/data/eras.js",
  "src/data/catalog.js",
  "src/data/legacy.js",
  "src/data/delegation.js",
  "src/data/platform.js",
  "src/data/fortune.js",
  "src/systems/label.js",
  "src/systems/campaign.js",
  "src/systems/locations.js",
  "src/systems/promotion.js",
  "src/systems/company.js",
  "src/systems/staff.js",
  "src/systems/board.js",
  "src/systems/events.js",
  "src/systems/roster.js",
  "src/systems/parties.js",
  "src/systems/cast.js",
  "src/systems/stories.js",
  "src/systems/why.js",
  "src/systems/onboarding.js",
  "src/systems/rivals.js",
  "src/systems/eras.js",
  "src/systems/catalog.js",
  "src/systems/legacy.js",
  "src/systems/delegation.js",
  "src/systems/platform.js",
  "src/systems/fortune.js",
  "src/engine.js",
  "src/ui/registry.js",
  "src/ui/label-ui.js",
  "src/ui/campaign.js",
  "src/ui/locations.js",
  "src/ui/promotion.js",
  "src/ui/company.js",
  "src/ui/lot.js",
  "src/ui/places.js",
  "src/ui/street.js",
  "src/ui/phone.js",
  "src/ui/staff.js",
  "src/ui/board.js",
  "src/ui/party.js",
  "src/ui/cast.js",
  "src/ui/onboarding.js",
  "src/ui/rivals.js",
  "src/ui/eras.js",
  "src/ui/vault.js",
  "src/ui/legacy.js",
  "src/ui/delegation.js",
  "src/ui/clock.js",
  "src/app.js",
];

const scope = self.registration.scope;
const shellURLs = new Set(APP_SHELL.map((path) => new URL(path, scope).href));
const indexURL = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  const requests = APP_SHELL.map((path) => new Request(new URL(path, scope), { cache: "reload" }));
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(requests)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isStartPage = event.request.mode === "navigate" && (url.href === scope || url.href === indexURL);
  if (!isStartPage && !shellURLs.has(url.href)) return;
  const key = isStartPage ? indexURL : url.href;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => (await cache.match(key)) || fetch(event.request)),
  );
});
