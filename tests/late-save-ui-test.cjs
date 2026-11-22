// Late CEO saves load (T68): an album recorded by an artist past level 10, and company revenue scaled by the era.
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
const run = (code) => vm.runInContext(code, context);

// An album started by a level-18 artist: the production record keeps that level.
run(`state = G.create(68, { ceo: true }); state.cash = 1e6; G.setStarter(state, false);
  G.sign(state, state.candidates[0].id); const a = state.artists[0];
  Object.assign(a, { xp: 600, energy: 100, inspiration: 90, tier: "superstar" });
  G.record(state, { artistId: a.id, boothId: state.booths[0].id, genre: a.genre, audience: a.audience, budget: 4000 });`);
assert.ok(run("state.albums.at(-1).production.artistLevel") > 10, "the level is past classic's 10");
assert.equal(run("validProductionSave(state)"), true, "a CEO save with a high-level album loads");
run(`state.albums.at(-1).production.artistLevel = 31;`);
assert.equal(run("validProductionSave(state)"), false, "past level 30 is still refused");
// Classic careers still stop at 10.
run(`state = G.create(68, { ceo: false }); state.cash = 1e6; G.sign(state, state.candidates[0].id);
  const b = state.artists[0]; Object.assign(b, { energy: 100, inspiration: 90 });
  G.record(state, { artistId: b.id, boothId: state.booths[0].id, genre: b.genre, audience: b.audience, budget: 4000 });
  state.albums.at(-1).production.artistLevel = 11;`);
assert.equal(run("validProductionSave(state)"), false);
console.log("Late save interface harness passed.");
