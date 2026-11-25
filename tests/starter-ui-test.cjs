// DOM harness for the starter checklist: the checklist says what it pays for, the front desk shows
// the free first signing, and the album form lets a free first album start with little cash.
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

run(`state = G.create(73, { ceo: true });`);
let card = run("starterCard()");
assert.match(
  card,
  /On the house while you get started: your first signing and your first album's budget \(up to \$4,000\)\./,
);
const desk = run("scouting()");
assert.match(desk, /3 albums · no advance · \d+% royalty/);
assert.match(
  desk,
  /Your first signing is free while the starter checklist is on: no advance \(usually \$[\d,]+ for one album\)\./,
);
assert.doesNotMatch(desk, /Short by/);
run(
  `G.sign(state, state.candidates[0].id, 1); state.cash = 100; Object.assign(state.artists[0], { energy: 100, inspiration: 90 });`,
);
card = run("starterCard()");
assert.match(card, /On the house while you get started: your first album's budget/);
assert.doesNotMatch(card, /your first signing/);
assert.doesNotMatch(run("scouting()"), /Your first signing is free/);
const form = run("albumFormCard()");
assert.match(
  form,
  /<button id="beginAlbum" class="primary" >|<button id="beginAlbum" class="primary">/,
  "Begin recording is open with $100",
);
run(
  `const a = state.artists[0]; G.record(state, { artistId: a.id, boothId: state.booths[0].id, genre: a.genre, audience: a.audience, budget: 4000 });`,
);
assert.equal(run("state.cash"), 100);
assert.doesNotMatch(run("starterCard()"), /On the house/);
console.log("Starter checklist interface harness passed.");
