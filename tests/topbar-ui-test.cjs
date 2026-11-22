// DOM harness for the compact phone top bar (T66): the short forms of the date and phase chip, and the phone rules.
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
const fs = require("node:fs"),
  path = require("node:path");

run(`state = G.create(66, { ceo: true }); state.week = 60; save(); render();`);
const date = element("date").innerHTML;
assert.equal(date.replace(/<[^>]+>/g, ""), "YEAR 02 · WEEK 8 · DAY 1", "the full date on wide screens");
assert.equal(
  date.replace(/<span class="date-long">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, ""),
  "Y02 · W8 · D1",
  "the short date on phones",
);
const chip = element("hud").innerHTML;
assert.match(
  chip,
  /Phase 1<span class="chip-long"> · Home studio<\/span> · \d\/\d<span class="chip-long"> goals<\/span>/,
);
// The phone rules exist and hide the long forms only at phone width.
const css = fs.readFileSync(path.join(__dirname, "../styles/dynasty.css"), "utf8");
const phone = css.slice(css.indexOf("/* Phones: a compact top bar (T66)"));
assert.match(phone, /@media \(max-width: 760px\)[\s\S]*\.date-long \{\s*display: none;/);
assert.match(phone, /@media \(max-width: 760px\)[\s\S]*\.company-chip \.chip-long \{\s*display: none;/);
assert.doesNotMatch(css.slice(0, css.indexOf("/* Phones: a compact top bar (T66)")), /date-long|chip-long/);
console.log("Top bar interface harness passed.");
