// DOM harness for the owner decisions of 2026-11-22: the album floor and its negotiation in the boardroom,
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
// and the delegated renewal wage limit that follows the phase.
const saved = () => JSON.parse(stored);
const click = (data) => listeners.click({ target: { closest: () => ({ dataset: data }) } });
const screen = () => element("content").innerHTML;
const run = (code) => vm.runInContext(code, context);

run(`state = G.create(66, { ceo: true }); state.cash = 1e6; G.setStarter(state, false);
  state.company.rivalCardWeek = 1e9; state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  state.company.phase = 2; G.takeFunding(state, "angel", 0); state.company.board.scene = false; save(); render();`);
click({ tab: "board" });
assert.match(screen(), /Album floor<\/span><b>\$12,000 of \$12,000 left<\/b>/);
assert.doesNotMatch(screen(), /Negotiate the album floor/);

// Right after a good review the board will hear the request.
run(
  `state.company.board.albumFloor = { level: 0, used: 0, offer: true }; state.company.board.confidence = 72; save(); render();`,
);
click({ tab: "board" });
assert.match(screen(), /Ask for a bigger album floor: \$18,000 a period, at 60\+ confidence \(now 72\)/);
click({ action: "negotiateFloor" });
assert.equal(saved().company.board.albumFloor.level, 1);
assert.match(screen(), /Album floor<\/span><b>\$18,000 of \$18,000 left · negotiated ×1\.5<\/b>/);
assert.doesNotMatch(screen(), /Negotiate the album floor/);

// Delegated renewals: the wage limit follows the phase until the player sets one.
run(`state.company.phase = 4; save(); render();`);
click({ tab: "delegation" });
assert.match(screen(), /data-field="maxWage" value="900"/);
assert.match(screen(), /Follows the phase\./);
listeners.change({ target: { value: "650", dataset: { delegate: "renew", field: "maxWage" } } });
assert.equal(saved().company.delegation.renew.maxWage, 650);
assert.match(screen(), /Follow the phase \(\$900\)/);
click({ action: "delegateWageAuto" });
assert.equal(saved().company.delegation.renew.maxWage, null);

console.log("Owner decisions interface harness passed.");
