// DOM harness for the streaming platform (T74): the Company panel's card before phase 5, at phase 5,
// after a stake bought through the button, at scrutiny size and when fully owned.
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

run(`state = G.create(74, { ceo: true }); G.setStarter(state, false); state.cash = 1e9;`);
assert.equal(run("platformCard()"), "", "nothing before phase 5");
run("state.company.phase = 5;");
let card = run("platformCard()");
assert.match(card, /<h3>Streaming platform<\/h3>/);
assert.match(card, /Buy into Tributary, a streaming service/);
assert.match(card, /Buy up to 10% for \$3,000,000 · sales \+2\.4%/);
assert.match(card, /From a 45% stake the press starts asking questions/);
assert.match(run("companyScreen()"), /Streaming platform/);
// The button buys the next stake.
run(`companyClick({ dataset: { action: "platformStake" } })`);
assert.equal(run("state.company.platform.level"), 1);
card = run("platformCard()");
assert.match(card, /Tributary · 10% owned/);
assert.match(card, /owns 10% of Tributary: its albums sell \+2\.4% more/);
assert.match(card, /\$3,000,000 invested; 80% of that counts toward company value/);
run("G.buyPlatformStake(state); G.buyPlatformStake(state);");
assert.match(
  run("platformCard()"),
  /At this size the press asks questions about the numbers now and then \(reputation −4\)/,
);
run("G.buyPlatformStake(state); G.buyPlatformStake(state);");
assert.match(run("platformCard()"), /The label owns all of it\./);
console.log("Platform interface harness passed.");
