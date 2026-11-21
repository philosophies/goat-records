// DOM harness for legacy (CEO runs): starting a challenge run with a perk from the new label
// dialog, and a finished run reaching the hall of fame. Checks rendering and actions, not layout.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      id,
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      dataset: {},
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
        this.onclose?.();
      },
      select() {},
      setCustomValidity() {},
      reportValidity() {},
    });
  return elements.get(id);
};
let stored = null,
  checkedPerks = [];
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    getElementById: element,
    querySelectorAll: (sel) =>
      sel === "#newLabelPerks input:checked" ? checkedPerks.map((value) => ({ value })) : [],
    addEventListener: (name, fn) => (listeners[name] ??= []).push(fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  matchMedia: () => ({ matches: true }),
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const fire = (name, e) => listeners[name].forEach((fn) => fn(e));
const click = (data) => fire("click", { target: { closest: () => ({ dataset: data }) } });
const screen = () => element("content").innerHTML;
const run = (code) => vm.runInContext(code, context);

// A player with seven achievements from earlier runs.
run(
  `localStorage.setItem(GoatLegacy.KEY, JSON.stringify({ hall: [], achievements: G.ACHIEVEMENTS.slice(0, 7).map((a) => a.id) })); GoatLegacy.reset();`,
);
element("reset").onclick();
assert.equal(element("newLabelDialog").open, true);
const extras = element("newLabelExtras").innerHTML;
assert.match(extras, /<option value="debt">In the red<\/option>/);
assert.match(extras, /<option value="weekly">This week&#39;s run \(week \d+\)<\/option>/);
assert.match(extras, /7 of \d+ achievements · up to 2/);
assert.match(extras, /value="extra-candidate"\s+\/><span>/, "open at three achievements");
assert.match(extras, /value="known-name" disabled \/><span>.*Opens at 10 achievements\./s);

// Pick a challenge and a perk, then start.
element("newLabelName").value = "Night Shift Records";
element("newLabelChallenge").value = "debt";
fire("change", { target: element("newLabelChallenge") });
assert.match(element("newLabelChallengeText").textContent, /\$20,000/);
checkedPerks = ["extra-candidate"];
element("newLabelForm").onsubmit({ preventDefault() {} });
const s = JSON.parse(stored);
assert.equal(s.company.legacy.challenge.id, "debt");
assert.deepEqual(s.company.legacy.perks, ["extra-candidate"]);
assert.equal(s.company.loan.balance, 20000);

// The hall of fame shows the run's challenge and perks; finishing records it once.
click({ tab: "hall" });
assert.match(screen(), /This run: In the red\./);
assert.match(screen(), /Perks: Word of mouth\./);
assert.match(screen(), /Finished runs are listed here/);
run(`state.finished = true; state.bankrupt = true; state.cash = -100; save(); render();`);
const profile = JSON.parse(run("localStorage.getItem(GoatLegacy.KEY)"));
assert.equal(profile.hall.length, 1);
assert.equal(profile.hall[0].label, "Night Shift Records");
assert.equal(profile.hall[0].ending, "folded");
assert.equal(profile.hall[0].challenge, "debt");
run("render();");
assert.equal(JSON.parse(run("localStorage.getItem(GoatLegacy.KEY)")).hall.length, 1, "recorded once");
assert.equal(JSON.parse(stored).company.legacy.recorded, true, "the save remembers it was recorded");

console.log("Legacy interface harness passed.");
