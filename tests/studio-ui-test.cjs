// DOM harness for studio capacity (T73): the album form shows the studio's places and, when the
// studio is full, points waiting artists to the tour bus. Classic forms are unchanged.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map();
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
  document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  matchMedia: () => ({ matches: false }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);

run(`state = G.create(73, { ceo: true }); G.setStarter(state, false);
  Object.assign(state, { cash: 1e6, reputation: 80 });
  G.sign(state, state.candidates[0].id);
  Object.assign(state.artists[0], { energy: 100, inspiration: 90 });`);
let form = run("albumFormCard()");
assert.match(form, /Studio: 0 of 1 albums in production\./);
assert.match(form, /id="albumForm"/);
run(`const a = state.artists[0];
  G.record(state, { artistId: a.id, boothId: state.booths[0].id, genre: a.genre, audience: a.audience, budget: 4000 });
  G.sign(state, state.candidates[0].id);
  Object.assign(state.artists[1], { energy: 100, inspiration: 90 });`);
form = run("albumFormCard()");
assert.match(
  form,
  /The studio is full: 1 of 1 albums in production at phase 1\. Artists waiting for it can tour\./,
);
assert.match(form, /data-tab="bus"/);
assert.doesNotMatch(form, /id="albumForm"/);

run(`state = G.create(73, { ceo: false }); state.cash = 1e6; G.sign(state, state.candidates[0].id);`);
assert.doesNotMatch(run("albumFormCard()"), /Studio:|studio is full/);
console.log("Studio interface harness passed.");
