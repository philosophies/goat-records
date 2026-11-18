// DOM harness for the promotion interface: Promotion screen, lead single row, catalog ad row,
// status chip and artist badge. Checks rendering and actions, not real-browser layout.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      dataset: {},
    });
  return elements.get(id);
};
let stored = null;
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
const saved = () => JSON.parse(stored);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}

click({ tab: "promotion" });
const screen = () => element("content").innerHTML;
assert.match(screen(), /HOW HEAT WORKS/);
assert.match(screen(), /Nobody is on fire yet/);
assert.match(screen(), /Street posters/);
assert.match(screen(), /Locked · rank 6/);
assert.match(screen(), /×1\.60/, "the promotion cap is spelled out");
assert.doesNotMatch(element("hud").innerHTML, /on fire/, "no heat chip while nobody is hot");

// Sign an artist and record up to the end of Recording.
click({ tab: "scout" });
click({ action: "sign", id: saved().candidates[0].id });
run(
  `Object.assign(state.artists[0], { talent: 80, inspiration: 90, energy: 100 }); state.cash = 500000; save();`,
);
run(`G.record(state, { artistId: state.artists[0].id, boothId: 0, genre: state.artists[0].genre,
  audience: state.artists[0].audience, budget: 8000, themes: ["Summer"] }); save(); render();`);
assert.match(element("production").innerHTML, /Lead single · unlocks after Recording/);
for (let i = 0; i < 20 && saved().albums[0].production.stage < 3; i++) {
  let s = saved();
  if (s.event) click({ action: "choose", id: 2 });
  s = saved();
  const p = s.albums[0];
  if (!p.production.cooldown) {
    click({ action: "stage", id: p.id, option: 0 });
    click({ action: "continue", id: p.id });
  }
  if (saved().albums[0].production.stage < 3) element("advance").onclick();
}
while (saved().event) click({ action: "choose", id: 2 });
const albumId = saved().albums[0].id;
// Albums waiting between stages are listed in the studio queue; ready ones show over the lot.
const productionRows = () => element("production").innerHTML + element("studioQueue").innerHTML;
assert.match(productionRows(), /Release single · \$1,800/);
assert.match(productionRows(), /Market impact \+5/);
click({ action: "promoSingle", album: String(albumId) });
assert.ok(saved().promotion.singles[albumId], "the single is saved");
assert.match(productionRows(), /Lead single out/);

// Finish and release the album, then make the artist hot.
for (let i = 0; i < 20 && !saved().albums[0].released; i++) {
  let s = saved();
  if (s.event) click({ action: "choose", id: 2 });
  s = saved();
  const p = s.albums[0],
    d = p.production;
  if (d.releaseReady) {
    element("release-title-" + p.id).value = p.title;
    click({ action: "release", id: p.id });
    click({ action: "ackLaunch", id: p.id });
    break;
  }
  if (!d.cooldown) {
    if (!d.review) click({ action: "stage", id: p.id, option: 0 });
    click({ action: "continue", id: p.id });
  }
  element("advance").onclick();
}
assert.ok(saved().albums[0].released);
run(
  `G.systems.find((x) => x.name === "promotion").onRelease(state, Object.assign({}, state.albums[0], { quality: 95, id: 999 })); save(); render();`,
);
assert.match(element("hud").innerHTML, /1 artist on fire/);

click({ tab: "catalog" });
assert.match(screen(), /Ad campaign/);
assert.match(screen(), /promo-ad-quote-/);
element("promo-ad-" + albumId).value = "posters";
listeners.change({
  target: { id: "promo-ad-" + albumId, value: "posters", dataset: { promoAd: String(albumId) } },
});
assert.match(element("promo-ad-quote-" + albumId).innerHTML, /Street posters: \$\d/);
const cash = saved().cash;
click({ action: "promoAd", album: String(albumId) });
assert.equal(saved().promotion.ads.length, 1);
assert.ok(saved().cash < cash);
assert.match(screen(), /Ad running/);

click({ tab: "artist:" + saved().artists[0].id });
assert.match(screen(), /ON FIRE · LEVEL [1-3]\/3 · \d+ weeks left/, "the artist card glows");

click({ tab: "promotion" });
assert.match(screen(), /promo-hot-card/);
assert.match(screen(), /Hit release/);
assert.match(screen(), /Street posters · ×1\.10/);
assert.match(screen(), /1 on fire · 1 ad running/);

assert.equal(run("validSave(JSON.parse(JSON.stringify(state)))"), true);
assert.equal(run("validProductionSave(JSON.parse(JSON.stringify(state)))"), true);
assert.equal(
  run(
    "(() => { const c = JSON.parse(JSON.stringify(state)); c.promotion.ads[0].adId = 'blimp'; return validSave(c); })()",
  ),
  false,
);
console.log(
  "PASS promotion interface harness: Promotion screen, single row, catalog ad row and quote, status chip, artist badge, save checks.",
);
