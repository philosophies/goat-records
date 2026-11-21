// DOM harness for the Vault (CEO runs): the shelves, an offer taken from the trophy case, the street count.
// Checks rendering and actions, not real-browser layout.
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
  matchMedia: () => ({ matches: true }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const click = (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } });
const screen = () => element("content").innerHTML;
const run = (code) => vm.runInContext(code, context);

run(`state = G.create(64, { ceo: true }); state.cash = 1e6; G.setStarter(state, false);
  state.company.phase = 5; state.week = 600; state.company.rivalCardWeek = 1e9;
  state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  G.sign(state, state.candidates[0].id);
  const a = state.artists[0];
  for (const [i, [ago, q]] of [[10, 70], [100, 72], [300, 88]].entries())
    state.albums.push({ id: 900 + i, artist: a.id, artistName: a.name, title: "Shelf " + i, genre: a.genre, released: true,
      releaseWeek: state.week - ago, quality: q, hit: q >= 75, gross: 100000, total: 100000, age: 12, salesWeeks: 12,
      boosts: [], chart: { best: 9, weeks: 6, rank: null, milestones: [], history: [] } });
  G.catalogOffer(state, "sync", 902, { client: "a feature film" });
  save(); render();`);
assert.match(
  element("town").innerHTML || run("GoatPlaces.town()"),
  /Trophy case<\/span><small>0 awards · 1 offer/,
);
click({ tab: "vault" });
assert.match(screen(), /The vault/);
assert.match(screen(), /1 fresh · 1 catalog · 1 classic\. Royalties \$[\d,]+ a week\./);
assert.match(screen(), /SYNC LICENSE · LAPSES WEEK 608/);
assert.match(screen(), /A feature film wants “Shelf 2”/);
assert.match(screen(), /<span class="status-classic">classic<\/span>/);
const id = run("state.company.catalog.offers[0].id"),
  fee = run("state.company.catalog.offers[0].fee"),
  cash = run("state.cash");
click({ action: "vaultAccept", id: String(id) });
assert.equal(run("state.cash") - cash, fee);
assert.match(screen(), /No offers right now/);
assert.match(screen(), /earned this year/);

// A refused sample from a rival label.
run(
  `G.catalogOffer(state, "sample", 901, { by: "Ace", rival: state.company.rivals[0].id, rivalName: "Rivals Inc" }); save(); render();`,
);
click({ tab: "vault" });
assert.match(screen(), /Refusing costs 10 standing with Rivals Inc/);
click({ action: "vaultDecline", id: String(run("state.company.catalog.offers[0].id")) });
assert.equal(run("state.rivalCompanies.find((c) => c.id === state.company.rivals[0].id).relationship"), -10);

// Classic runs keep the plain trophy case.
run(`state = G.create(64, { ceo: false }); save(); render();`);
assert.equal(run("G.vaultInfo(state)"), null);

console.log("Vault interface harness passed.");
