const vm = require("node:vm"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  G = require("../src/engine.js");
const s = G.create(7);
s.cash = 100000;
G.sign(s, s.candidates[0].id);
const a = s.artists[0];
a.age = "Adult";
G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, title: "Annual Entry" });
const p = s.albums[0];
while (!p.production.releaseReady) {
  while (s.event) G.choose(s, 2);
  if (!p.production.cooldown) {
    G.decideStage(s, p.id, 0);
    G.continueProduction(s, p.id);
  }
  G.advance(s);
}
while (s.event) G.choose(s, 2);
G.releaseAlbum(s, p.id, p.title);
p.launchReview = false;
let stored = JSON.stringify(s);
const elements = new Map(),
  listeners = {};
const el = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      dataset: {},
      disabled: false,
      hidden: false,
      classList: { toggle() {} },
    });
  return elements.get(id);
};
const ctx = vm.createContext({
  console,
  LabelGame: G,
  document: {
    getElementById: el,
    querySelectorAll: () => [],
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
vm.runInContext(fs.readFileSync(__dirname + "/../src/ui/label-ui.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../src/app.js", "utf8"), ctx);
function click(dataset) {
  listeners.click({ target: { closest: () => ({ dataset }) } });
}
click({ tab: "charts" });
assert.match(el("content").innerHTML, /Industry Top 300/);
assert.match(el("content").innerHTML, /page 1\/6/);
click({ action: "chartPage", id: 1 });
assert.match(el("content").innerHTML, /page 2\/6/);
assert.match(el("content").innerHTML, /#51/);
listeners.change({ target: { id: "chartFilter", value: "own" } });
assert.match(el("content").innerHTML, /Annual Entry/);
click({ tab: "journal" });
assert.match(el("content").innerHTML, /Company release listings/);
assert.match(el("content").innerHTML, /Marlowe Sterling/);
click({ tab: "finance" });
assert.match(el("content").innerHTML, /LEVEL 1\/10/);
click({ tab: "awards" });
assert.match(el("content").innerHTML, /Annual Silver Groove Awards/);
const key = p.genre.replace(/[^a-zA-Z]/g, "");
el("award-" + key).value = p.id;
click({ action: "awardEntry", genre: p.genre, year: 1 });
assert.equal(JSON.parse(stored).awardPrograms[1].entries[p.genre], p.id);
assert.match(el("content").innerHTML, /Entered: Annual Entry/);
console.log(
  "PASS industry interface harness: Top 300 pagination/filtering, company wire, career finances and annual genre submission.",
);
