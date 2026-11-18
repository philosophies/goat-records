// DOM harness for company phases (CEO runs): the top bar chip, the Company panel in the office,
// the phase-up card, and nothing at all in a classic run.
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
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context, { classic: true });
const run = (code) => vm.runInContext(code, context);
const saved = () => JSON.parse(stored);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}

const html = (id) => element(id).innerHTML;

// A classic run shows no company chip or panel.
assert.doesNotMatch(html("hud"), /company-chip/);
click({ tab: "office" });
assert.doesNotMatch(html("content"), /sec-company/);

// Start a CEO run.
run(`state = G.create(41, { ceo: true }); save(); render();`);
assert.match(html("hud"), /class="company-chip" data-tab="company"[^>]*>Phase 1 · Home studio · 1\/4 goals/);
click({ tab: "company" });
assert.equal(element("drawerTitle").textContent, "Company");
assert.match(html("content"), /Phase 1 · Home studio/);
assert.match(html("content"), /Goals for phase 2, Indie label/);
assert.match(html("content"), /Revenue, last 52 weeks<\/span><span>\$0 \/ \$25,000/);
assert.match(html("content"), /phase-step now"><b>1<\/b>/);
assert.match(html("content"), /Public company/);
click({ tab: "office" });
assert.match(
  html("content"),
  /id="sec-company"[\s\S]*Goals for phase 2[\s\S]*id="sec-campaign"/,
  "the office leads with the company",
);

// Meet phase 2's goals and settle a week: the chip and a phase card update.
click({ tab: "company" });
run(`state.fame = 500; state.cash = 100000;
  state.financeHistory = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, albumIncome: 1000, hqIncome: 0, otherIncome: 0 }));
  for (let i = 0; i < 3; i++) state.albums.push({ id: 800 + i, released: true, quality: 60, age: 30, salesWeeks: 12, chart: {}, production: null });
  save(); render();`);
assert.match(html("content"), /✓ Label fame/);
click({ action: "closePanel" });
run(
  `while (state.event) G.choose(state, state.event.options.length - 1); G.advance(state); save(); render();`,
);
assert.equal(saved().company.phase, 2);
assert.match(html("hud"), /Phase 2 · Indie label/);
assert.match(html("milestones"), /COMPANY GROWTH[\s\S]*Phase 2 · Indie label/);

// The office renames the label; the roof sign and panel title follow.
run(`state.albums = state.albums.filter((p) => p.id < 800); save(); render();`);
click({ tab: "office" });
assert.match(html("content"), /COMPANY NAME[\s\S]*Goat Records/);
element("labelNameInput").value = "Velvet Throne";
click({ action: "renameLabel" });
assert.equal(saved().labelName, "Velvet Throne");
assert.equal(element("brandName").textContent, "VELVET THRONE", "the top bar carries the name");
click({ tab: "label" });
assert.equal(element("drawerTitle").textContent, "Velvet Throne");
element("labelNameInput").value = "";
click({ tab: "office" });
click({ action: "renameLabel" });
assert.equal(saved().labelName, "Velvet Throne", "an empty name is refused");

console.log(
  "PASS company interface harness: label renaming in the office, phase chip, Company panel and office section, phase-up card, classic runs untouched",
);
