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

// Calendar, Contacts, Wallet and Settings.
run(`state.event = null; state.notifications = []; state.cash = 200000;
  G.sign(state, state.candidates[0].id); G.hire(state, "Producer"); save(); render();`);
const s = saved();
click({ tab: "phone:calendar" });
assert.match(html("content"), /AWARDS · Y2 W1[\s\S]*Annual awards/);
click({ tab: "phone:contacts" });
assert.match(
  html("content"),
  new RegExp(`data-tab="artist:${s.artists[0].id}"[\\s\\S]*data-tab="staffer:Producer"`),
);
element("contactSearch").value = "producer";
listeners.change({ target: { dataset: { contactSearch: "" }, value: "producer" } });
assert.doesNotMatch(
  html("content"),
  new RegExp(`data-tab="artist:${s.artists[0].id}"`),
  "search filters by name or role",
);
assert.match(html("content"), /data-tab="staffer:Producer"/);
listeners.change({ target: { dataset: { contactSearch: "" }, value: "nobody-by-this-name" } });
assert.match(html("content"), /Nobody matches/);
click({ tab: "phone:wallet" });
assert.match(
  html("content"),
  /Cash<\/dt><dd>\$[\d,]+<\/dd>[\s\S]*Budget left this period<\/dt><dd>— \(no board\)[\s\S]*Share price<\/dt><dd>— \(private company\)/,
);
click({ tab: "phone:settings" });
assert.match(html("content"), /data-action="phoneSpeed" data-speed="2"/);
click({ action: "phoneSpeed", speed: "2" });
assert.equal(run("GoatClock.speed"), 2);
click({ action: "phoneSpeed", speed: "0" });
assert.equal(run("GoatClock.speed"), 0);

run(`state = G.create(91, { ceo: true });
  state.cash = 100000; G.sign(state, state.candidates[0].id);
  state.artists[0].morale = 60; state.week = 12; G.advance(state); save(); render();`);
click({ tab: "phone:inbox" });
assert.match(html("content"), /A studio slot opens[\s\S]*Deadline in 2/);
click({ action: "showModal" });
click({ action: "choose", id: "3" });
assert.equal(saved().event, null);
assert.equal(saved().company.deferredEvents[0].dueWeek, 15);

console.log(
  "PASS phone interface harness: Calendar, Contacts with search, Wallet and Settings apps, corner button and badge, Inbox, classic runs without a phone",
);
