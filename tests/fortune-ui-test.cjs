// DOM harness for outcomes revealed after the choice (T79): ratings without numbers, the testing
// switch, the reveal card with its stamp and changes, the pause it holds, and classic cards as before.
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
const body = { dataset: {}, classList: { toggle() {} } };
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    body,
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
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}
const html = (id) => element(id).innerHTML;

run(`state = G.create(79, { ceo: true }); G.setStarter(state, false); G.setMentor(state, false);
  state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 }; state.company.rivalCardWeek = 1e9;
  state.cash = 50000; G.sign(state, state.candidates[0].id, 1); state.artists[0].morale = 60;
  state.event = { type: "ceo", title: "A party invitation", body: "A promoter wants the artist at a party.", artist: state.artists[0].id,
    options: [
      { label: "Stay home", hint: "Morale +1.", morale: 1 },
      { label: "Go for an hour", hint: "Costs $500. Fans +3, morale +2.", cost: 500, fans: 3, morale: 2 },
      { label: "Host the after-party", hint: "Costs $4,000. Fans +12, morale +8, trust -6.", cost: 4000, fans: 12, morale: 8, trust: -6 },
    ] };
  save(); render();`);

// Hidden: the rating and the price, not the effects.
let card = html("event");
assert.match(
  card,
  /Stay home<span class="risk risk-safe">Safe<\/span><small>What it does shows once you choose\.<\/small>/,
);
assert.match(
  card,
  /Go for an hour<span class="risk risk-steady">Steady<\/span><small>Costs \$500\. What it does shows once you choose\./,
);
assert.match(
  card,
  /Host the after-party<span class="risk risk-bold">Bold<\/span><small>Costs \$4,000\. What it does shows once you choose\./,
);
assert.doesNotMatch(card, /Fans \+12|trust -6/);
assert.match(card, /data-action="toggleOutcomes" aria-pressed="false">Show outcomes \(testing\)/);

// The testing switch shows the effects and the odds; it is kept in the browser.
click({ action: "toggleOutcomes" });
card = html("event");
assert.match(
  card,
  /Costs \$4,000\. Fans \+12, morale \+8, trust -6\. Bold: 30% a triumph \(gains ×2\.8, losses ×0\.5\), 35% as planned, 35% it backfired/,
);
assert.match(card, /Hide outcomes \(testing\)/);
assert.equal(stored, "1");
click({ action: "toggleOutcomes" });
assert.doesNotMatch(html("event"), /Fans \+12/);

// Choosing reveals the outcome before anything else, and holds the clock.
run(
  `state.eventQueue.push({ type: "ceo", title: "The next card", body: "Later.", options: [{ label: "Fine", hint: "", morale: 1 }] }); render();`,
);
click({ action: "choose", id: "2" });
const out = run("state.company.lastOutcome");
card = html("event");
assert.match(card, /outcome-reveal tier-\w+ risk-bold/);
assert.match(card, /BOLD CALL · THE OUTCOME/);
assert.match(card, /You chose: <b>Host the after-party<\/b>/);
assert.match(card, new RegExp(`outcome-stamp[^>]*>${out.name}<`));
assert.match(card, /<li style="--i:0" class="down">Cash <b>−\$4,000<\/b><\/li>/);
assert.match(card, /fans <b>[+−]\d/);
assert.doesNotMatch(card, /The next card/, "the next card waits");
assert.equal(run("GoatClock.current().run"), false);
assert.ok(run("GoatClock.blockers").includes("outcome"), "the reveal holds the clock");
click({ action: "outcomeSeen" });
assert.equal(run("state.company.lastOutcome.seen"), true);
assert.match(html("event"), /The next card/);

// The phone's Settings has the same switch.
assert.match(
  run("phoneSettings()"),
  /<h3>Testing<\/h3><button data-action="toggleOutcomes" aria-pressed="false">Show outcomes before choosing/,
);

// Classic cards show their effects as before, with no ratings.
run(`state = G.create(79, { ceo: false }); state.event = { type: "ceo", title: "Old card", body: "x",
  options: [{ label: "A", hint: "Morale +1.", morale: 1 }, { label: "B", hint: "Fans +9.", fans: 9 }] }; render();`);
assert.match(html("event"), /A<small>Morale \+1\.<\/small>/);
assert.doesNotMatch(html("event"), /risk-|Show outcomes/);
console.log("Outcome reveal harness passed.");
