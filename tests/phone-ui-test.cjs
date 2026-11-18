// DOM harness for the CEO phone: the corner button and its badge, the five apps, and the Inbox
// listing what needs the CEO. Classic runs have no phone.
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
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
const saved = () => JSON.parse(stored);
function click(data) {
  listeners.click({ target: { closest: () => ({ dataset: data }) } });
}

const html = (id) => element(id).innerHTML;

assert.equal(element("phoneButton").hidden, true, "no phone in a classic run");
click({ tab: "phone" });
assert.equal(element("drawer").hidden, true, "the phone does not open in a classic run");

run(`state = G.create(91, { ceo: true }); save(); render();`);
assert.equal(element("phoneButton").hidden, false);
assert.doesNotMatch(html("phoneButton"), /phone-badge/, "nothing waiting, no badge");
click({ tab: "phone" });
assert.equal(element("drawerTitle").textContent, "Phone");
for (const app of ["inbox", "calendar", "contacts", "wallet", "settings"])
  assert.match(html("content"), new RegExp(`data-tab="phone:${app}"`));
click({ tab: "phone:inbox" });
assert.match(html("content"), /Nothing needs you right now/);

// A notification and an event: the badge counts both, the Inbox lists them.
run(`state.notifications.push({ id: state.nextId++, kind: "phase", title: "Phase 2 · Indie label", body: "Grown.", week: state.week });
  state.event = { title: "A studio offer", body: "Someone wants your booth.", options: [{ label: "Fine", hint: "", effects: {} }] };
  save(); render();`);
assert.match(html("phoneButton"), /<b class="phone-badge">2<\/b>/);
click({ tab: "phone" });
assert.match(html("content"), /data-tab="phone:inbox"[\s\S]*phone-badge">2</);
click({ tab: "phone:inbox" });
assert.match(html("content"), /DECISION[\s\S]*A studio offer[\s\S]*data-action="showModal">Decide/);
assert.match(html("content"), /NEWS[\s\S]*Phase 2 · Indie label[\s\S]*data-action="closePanel"/);
click({ action: "showModal" });
click({ tab: "phone:wallet" });
assert.match(html("content"), /data-tab="finance"/, "apps still to come point to where the information is");
click({ tab: "phone:unknown" });
assert.equal(element("drawer").hidden, true);

console.log(
  "PASS phone interface harness: corner button and badge, five apps, Inbox of decisions, albums and news, classic runs without a phone",
);
