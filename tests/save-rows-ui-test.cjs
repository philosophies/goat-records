// A production stage can carry every optional calculation row at once (theme fit, combo experience,
// familiar combo, headquarters, location, genre affinity, heat). Such a save must still load.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const element = (() => {
  const all = new Map();
  return (id) => {
    if (!all.has(id))
      all.set(id, {
        innerHTML: "",
        textContent: "",
        value: "",
        disabled: false,
        classList: { toggle() {} },
        dataset: {},
      });
    return all.get(id);
  };
})();
let stored = null;
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const G = context.LabelGame,
  s = G.create(41);
s.cash = 1e6;
s.rank = 6;
G.sign(s, s.candidates[0].id);
const a = s.artists[0];
Object.assign(a, { genre: "Country", inspiration: 90, energy: 100 });
for (const id of ["writers", "vocal", "mix", "radio"]) {
  const free = [...Array(24).keys()]
    .map((i) => [i % 6, Math.floor(i / 6)])
    .find(([x, y]) => !G.facilityAt(s, x, y));
  G.buildFacility(s, id, free[0], free[1]);
}
const location = G.LOCATIONS.find((l) => l.genres.Country === 2).id;
// Earlier release of the same combo, recent enough to count as familiar.
s.combos["Country · Heartbreak"] = { genre: "Country", themes: ["Heartbreak"], releases: 2, firstWeek: 1 };
s.albums.push({ id: 999, released: true, comboKey: "Country · Heartbreak", releaseWeek: s.week, chart: {} });
s.promotion.heat[a.id] = { level: 3, weeksLeft: 8, reasons: ["award"] };
G.record(s, {
  artistId: a.id,
  boothId: 0,
  genre: "Country",
  audience: a.audience,
  budget: 4000,
  themes: ["Heartbreak"],
  location,
});
const p = s.albums.at(-1);
for (let stage = 0; stage < 5; stage++) {
  while (s.event) G.choose(s, 2);
  p.production.cooldown = 0;
  G.decideStage(s, p.id, 0);
  G.continueProduction(s, p.id);
}
s.albums = s.albums.filter((x) => x.id !== 999);
const most = Math.max(...p.production.results.map((r) => r.parts.length));
assert.ok(most >= 12, `expected a stage with every optional row, got ${most}`);
context.saved = JSON.parse(JSON.stringify(s));
assert.equal(
  vm.runInContext("validProductionSave(saved)", context),
  true,
  "a save with every optional row loads",
);
console.log(`PASS save rows harness: a stage with ${most} calculation rows passes the load check.`);
