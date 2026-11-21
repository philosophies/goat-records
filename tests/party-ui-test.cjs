// DOM harness for listening parties (CEO runs): hold one from the final review, read it, rework.
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
    addEventListener: (n, fn) => (listeners[n] = fn),
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
const click = (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } });
const html = () => element("production").innerHTML;

run(`state = G.create(21, { ceo: true }); state.cash = 1e6;
  G.sign(state, state.candidates[0].id);
  const a = state.artists[0]; Object.assign(a, { energy: 100, inspiration: 80, talent: 70 });
  G.record(state, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  const p = state.albums.at(-1);
  for (let i = 0; i < 40 && !p.production.releaseReady; i++) {
    while (state.event) G.choose(state, state.event.options.length - 1);
    for (const x of [...(state.company?.inbox || [])]) G.decide(state, x.id, 0);
    const d = p.production;
    while (!d.cooldown && !d.releaseReady && (d.stage < 5 || d.review)) { if (!d.review) G.decideStage(state, p.id, 0); G.continueProduction(state, p.id); }
    if (!d.releaseReady) G.advance(state);
  }
  while (state.event) G.choose(state, state.event.options.length - 1);
  save(); render();`);
const id = run("state.albums.at(-1).id");
click({ action: "showModal", project: String(id) });
assert.match(html(), /FINAL ALBUM REVIEW/);
assert.match(html(), /Hold a listening party · \$800/);
assert.match(html(), /Leak risk 5%/);

click({ action: "holdParty", id: String(id) });
assert.match(html(), /By audience/);
assert.match(html(), /By area/);
assert.match(html(), /The room was coldest on/);
assert.match(html(), /feedback waiting/);
assert.match(html(), /data-choice="rework"/);
assert.ok(run("state.albums.at(-1).party.pending"));

click({ action: "partyChoice", choice: "rework", id: String(id) });
assert.equal(run("state.albums.at(-1).party.pending"), false);
assert.equal(run("state.albums.at(-1).production.releaseReady"), false);
assert.match(element("activities").innerHTML + element("studioQueue").innerHTML, /week\(s\)/);

// The goal line in a CEO run names the year and the next phase, not the classic campaign.
assert.match(element("goal").textContent, /^Year 1 of \d+\. Next phase: .+ \((needs .+|all goals met)\)\.$/);
assert.doesNotMatch(element("goal").textContent, /Final year|label rank/);

// The starter checklist sits in the side ticker, can be skipped, and comes back from Settings.
run(`state.company.onboarding = { on: true, done: ["sign"], tips: [] }; render();`);
assert.match(
  element("notices").innerHTML,
  /Getting started[\s\S]*class="done"><span>✓<\/span> Sign your first artist[\s\S]*○<\/span> Finish the first recording stage <small>\$500<\/small>/,
);
assert.doesNotMatch(element("milestones").innerHTML, /Getting started/, "it does not cover the street");
click({ action: "starter", on: "no" });
assert.equal(run("state.company.onboarding.on"), false);
assert.doesNotMatch(element("notices").innerHTML, /Getting started/);
click({ tab: "phone:settings" });
assert.match(element("content").innerHTML, /data-action="starter" data-on="yes">Show the checklist/);
click({ action: "starter", on: "yes" });
assert.equal(run("state.company.onboarding.on"), true);

// Classic saves never show a party.
run(`state = G.create(5, { ceo: false }); render();`);
assert.doesNotMatch(
  run("typeof GoatParty !== 'undefined' ? GoatParty.block({ released: false }) : ''"),
  /party/,
);
console.log("PASS listening party harness");
