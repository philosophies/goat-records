const vm = require("node:vm"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  G = require("../src/engine.js");
const seed = G.create(8);
seed.cash = 100000;
G.sign(seed, seed.candidates[0].id);
G.sign(seed, seed.candidates[0].id);
const a = seed.artists[0];
a.age = "Adult";
G.record(seed, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
const p = seed.albums[0];
while (!p.production.releaseReady) {
  while (seed.event) G.choose(seed, 2);
  if (!p.production.cooldown) {
    G.decideStage(seed, p.id, 0);
    G.continueProduction(seed, p.id);
  }
  G.advance(seed);
}
while (seed.event) G.choose(seed, 2);
G.releaseAlbum(seed, p.id, "Tour UI Album");
p.launchReview = false;
p.chart.best = 5;
a.energy = 100;
let stored = JSON.stringify(seed),
  checked = [];
const elements = new Map(),
  listeners = {};
const el = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      hidden: false,
      dataset: {},
      classList: { toggle() {} },
    });
  return elements.get(id);
};
const context = vm.createContext({
  console,
  LabelGame: G,
  document: {
    getElementById: el,
    querySelectorAll: (q) => (q.includes("albumAddon") ? checked.map((value) => ({ value })) : []),
    addEventListener: (n, fn) => (listeners[n] = fn),
  },
  localStorage: {
    getItem: (k) => (k === "side-a-save-v1" ? stored : null),
    setItem: (k, v) => {
      if (k === "side-a-save-v1") stored = v;
    },
  },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
vm.runInContext(fs.readFileSync(__dirname + "/../src/app.js", "utf8"), context);
el("artist").value = a.id;
el("booth").value = "0";
el("budget").value = "4000";
checked = ["video", "star"];
listeners.change({ target: { name: "albumAddon", id: "" } });
assert.match(el("albumQuote").innerHTML, /24,000/);
assert.match(el("albumQuote").innerHTML, /7 production weeks/);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
click({ tab: "road" });
assert.match(el("content").innerHTML, /Book a new tour/);
el("tour-album").value = p.id;
el("tour-scale").value = "regional";
el("tour-mode").value = "solo";
listeners.change({ target: { id: "tour-album" } });
assert.match(el("tourQuote").innerHTML, /4,500/);
assert.equal(el("bookTour").disabled, false);
listeners.submit({ target: { id: "tourForm" }, preventDefault() {} });
let saved = JSON.parse(stored);
assert.equal(saved.tours.length, 1);
assert.equal(saved.tours[0].net, -4500);
assert.match(el("content").innerHTML, /data-tour-money="-4500"/);
el("advance").onclick();
saved = JSON.parse(stored);
assert.equal(saved.tours[0].history.length, 1);
assert.ok(saved.tours[0].revenue > 0);
assert.ok(G.busy(saved, a.id));
assert.equal(
  vm.runInContext(
    "validProductionSave(state)&&G.validManagementSave(state)&&G.validRoadSave(state)",
    context,
  ),
  true,
);
const first = saved.event.options.findIndex(
  (o) => !o.cost && !o.cancelChance && !o.poachChance && !o.lengthDelta && !o.restDays,
);
click({ action: "choose", id: first });
const planned = JSON.parse(stored).tours[0].nextInteractionDay;
el("advance").onclick();
saved = JSON.parse(stored);
assert.equal(saved.tours[0].day, planned);
assert.ok(saved.tours[0].day > 1);
assert.equal(saved.event.type, "tourDay");
assert.match(el("event").innerHTML, /Next review: tour day/);
console.log(
  "PASS road interface harness: package cost/week previews, tour forecast, booking, negative opening ledger, daily revenue, multi-day fast-forward, artist reservation and save validation.",
);
