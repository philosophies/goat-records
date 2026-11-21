// DOM harness for delegation (CEO runs): setting an autopilot policy and limits in the office, the log and undo.
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
const saved = () => JSON.parse(stored);
const click = (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } });
const screen = () => element("content").innerHTML;
const run = (code) => vm.runInContext(code, context);

run(`state = G.create(63, { ceo: true }); state.cash = 1e7; G.setStarter(state, false); state.week = 300;
  state.company.phase = 2; state.company.rivalCardWeek = 1e9; state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  save(); render();`);
click({ tab: "delegation" });
assert.doesNotMatch(screen(), /sec-delegation/, "no delegation before phase 3");

run(
  `state.company.phase = 5; for (const id of ["ar", "marketing"]) { const pool = G.recruitExecs(state, id); G.hireHead(state, id, pool[0].id); } save(); render();`,
);
click({ tab: "delegation" });
assert.match(screen(), /Contract renewals/);
assert.match(screen(), /Department autopilot/);
assert.match(screen(), /OPENS AT PHASE 6<\/span><h3>Chief operating officer/);
assert.match(screen(), /Delegation handles chores, never stories, superstars or the board/);

// Set a policy and a renewal limit.
click({ action: "delegatePolicy", policy: "balanced" });
assert.equal(saved().company.delegation.autopilot.policy, "balanced");
assert.match(screen(), /data-policy="balanced" aria-pressed="true"/);
click({ action: "delegateToggle", key: "renew" });
assert.equal(saved().company.delegation.renew.on, true);
listeners.change({ target: { value: "72", dataset: { delegate: "renew", field: "minQuality" } } });
assert.equal(saved().company.delegation.renew.minQuality, 72);

// A month later the autopilot's steps are listed; a junior hire can be undone.
run(
  `for (let i = 0; i < 4; i++) { while (state.event) G.choose(state, state.event.options.length - 1); G.advance(state); } save(); render();`,
);
click({ tab: "delegation" });
assert.match(screen(), /W\d+: Trained /);
const junior = run(`(state.company.delegation.log.find((x) => x.kind === "staff") || {}).id`);
assert.ok(junior, "balanced adds a junior in its first month");
{
  const dep = run(`state.company.delegation.log.find((x) => x.id === ${junior}).undo.department`),
    before = run(`state.company.departments.${dep}.staff`);
  click({ action: "delegateUndo", id: String(junior) });
  assert.equal(saved().company.departments[dep].staff, before - 1);
  assert.match(screen(), /Undone/);
}
click({ action: "delegatePolicy", policy: "" });
assert.equal(saved().company.delegation.autopilot.policy, null);

console.log("Delegation interface harness passed.");
