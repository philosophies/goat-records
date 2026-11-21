// DOM harness for rival labels (CEO runs): the Rivals section on the billboard, bids and a buyout.
// status chip and artist badge. Checks rendering and actions, not real-browser layout.
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
const nameOf = (id) => run(`G.RIVAL_LABELS.find((x) => x.id === "${id}").name`).replace(/&/g, "&amp;");

run(`state = G.create(31, { ceo: true }); state.cash = 1e7; G.setStarter(state, false); save(); render();`);
click({ tab: "rivals" });
const rivals = saved().company.rivals;
for (const r of rivals) assert.ok(screen().includes(nameOf(r.id)));
assert.match(screen(), /Your standing <b>0<\/b> <small>neutral<\/small>/);
assert.match(screen(), /Bidding for their artists opens at phase 3/);
assert.doesNotMatch(screen(), /data-action="rivalBid"/);
assert.doesNotMatch(screen(), /data-action="rivalBuy"/);

// Phase 3: bids open. Make the bid certain and take one artist.
run(`state.company.phase = 3; G.RIVAL_RULES.bid.base = 2; G.RIVAL_RULES.bid.max = 1; save(); render();`);
click({ tab: "rivals" });
assert.match(screen(), /Bid · \$[\d,]+ · 100%/);
const first = rivals[0],
  name = first.roster[0].name;
click({ action: "rivalBid", rival: first.id, index: "0" });
assert.ok(
  saved().candidates.some((c) => c.name === name),
  "the bid winner waits at the front desk",
);
assert.ok(!saved().company.rivals[0].roster.some((x) => x.name === name));

// Phase 5: a weak rival can be bought from the same card.
run(`state.company.phase = 5; state.company.rivals[0].strength = -100; save(); render();`);
click({ tab: "rivals" });
assert.match(screen(), /data-action="rivalBuy"/);
assert.match(screen(), /Too strong to buy/);
click({ action: "rivalBuy", rival: first.id });
assert.equal(saved().company.rivals[0].bought, true);
assert.ok(!screen().includes(nameOf(first.id) + "</h3>"));

// A feud is called out on the card.
run(`state.rivalCompanies.find((c) => c.id === "${rivals[1].id}").relationship = -60; save(); render();`);
click({ tab: "rivals" });
assert.match(screen(), /in a feud/);
assert.match(screen(), /both labels sell 5% more/);

// Classic runs have no rivals screen content.
run(`state = G.create(31, { ceo: false }); save(); render();`);
assert.equal(run("G.rivalsInfo(state).length"), 0);

console.log("Rivals interface harness passed.");
