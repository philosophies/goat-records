// DOM harness for music eras (CEO runs): the market section, the top bar, the announcement card and investing.
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

run(`state = G.create(61, { ceo: true }); state.cash = 1e7; G.setStarter(state, false);
  state.company.rivalCardWeek = 1e9; state.company.stories = { arcs: [], log: {}, lastWeek: 1e9 }; save(); render();`);
assert.match(element("trend").textContent, /^Tapes and CDs · Trending: /);
click({ tab: "market" });
assert.match(screen(), /THE ERA NOW · SINCE YEAR 1/);
assert.match(screen(), /Tapes and CDs/);
assert.match(screen(), /Album sales<\/td><td class="up">×1\.20/);
assert.match(screen(), /Lead single lift<\/td><td class="down">×0\.80/);
assert.match(screen(), /The next change is announced 13 weeks before it comes/);

// Thirteen weeks before the change: the card, then the coming era on the market screen.
const start = run("state.company.eras.starts[1]");
run(`state.week = ${start} - 14; save(); render();`);
run("G.advance(state); save(); render();");
for (let i = 0; i < 5 && saved().event && saved().event.type !== "era"; i++)
  click({ action: "choose", id: saved().event.options.length - 1 });
assert.equal(saved().event?.type, "era");
assert.match(element("event").innerHTML, /THE MUSIC BUSINESS/);
assert.match(element("event").innerHTML, /A new era in 13 weeks: The piracy years/);
assert.match(
  element("event").innerHTML,
  /Invest early<small>Costs \$2,500\. Touring \+15% for the era&#39;s first year\./,
);
click({ action: "choose", id: 0 });
assert.deepEqual(saved().company.eras.invested, ["piracy"]);
click({ tab: "market" });
assert.match(screen(), new RegExp(`COMING IN WEEK ${start} · YEAR ${run(`G.operatingYear(${start})`)}`));
assert.match(screen(), /Tour tickets<\/td><td class="up">×1\.30/);

// Once it comes, the top bar and the market follow.
run(`state.week = ${start} + 1; state.company.eras.seen = 1; save(); render();`);
assert.match(element("trend").textContent, /^The piracy years · /);
click({ tab: "market" });
assert.match(screen(), /Invested early: touring \+15% until week/);
assert.match(screen(), /Tour tickets<\/td><td class="up">×1\.50/);

// Classic runs show no era.
run(`state = G.create(61, { ceo: false }); save(); render();`);
assert.match(element("trend").textContent, /^Trending: /);

console.log("Eras interface harness passed.");
