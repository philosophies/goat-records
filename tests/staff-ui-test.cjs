// DOM harness for the people panels (CEO runs): the artist team section with its chemistry
// preview, the mood card, and the department panels at the front desk.
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

// A classic run: no team section, the classic staff list at the desk.
run(`G.sign(state, state.candidates[0].id); save(); render();`);
click({ tab: "artist:" + saved().artists[0].id });
assert.doesNotMatch(html("content"), /Team and mood/);
click({ tab: "desk" });
assert.doesNotMatch(html("content"), /Departments/);

// A CEO run with one artist.
run(
  `state = G.create(91, { ceo: true }); state.cash = 200000; G.sign(state, state.candidates[0].id); save(); render();`,
);
const artistId = saved().artists[0].id;
click({ tab: "artist:" + artistId + "~sec-team" });
let page = html("content");
assert.match(page, /Team and mood/);
assert.match(page, /WANTS [A-Z ]+ · /, "the mood card names the want");
assert.match(page, /Ego<\/span><b>\d+<\/b>/);
assert.match(page, /MANAGER[\s\S]*Empty[\s\S]*PRODUCER[\s\S]*Empty/);
assert.match(page, /Later: A&amp;R rep \(phase 2\)/);

// Assign a producer by clicks: open the chooser, search, see the chemistry, then hire and assign.
click({ action: "teamPick", artist: String(artistId), role: "producer" });
assert.match(html("content"), /CHOOSE A PRODUCER/);
assert.match(html("content"), /Run a search to see candidates/);
click({ action: "teamRecruit", role: "producer" });
page = html("content");
const candidates = saved().company.team.candidates.producer;
assert.equal(candidates.length, 3);
const chems = run(
  `state.company.team.candidates.producer.map((m) => G.chemistry(state, state.artists[0], m).value.toFixed(2))`,
);
for (const [i, c] of candidates.entries())
  assert.match(
    page,
    new RegExp(
      `${c.name}[\\s\\S]*?Chemistry ×${chems[i]}[\\s\\S]*?data-action="teamHire"[^>]*data-candidate="${c.id}"`,
    ),
    "each candidate shows chemistry before the hire button",
  );
assert.equal(saved().company.team.pool.length, 0, "nothing hired yet");
click({
  action: "teamHire",
  role: "producer",
  candidate: String(candidates[1].id),
  artist: String(artistId),
});
let s = saved();
assert.equal(s.company.team.pool.length, 1);
assert.deepEqual(s.company.team.pool[0].artists, [artistId]);
page = html("content");
assert.doesNotMatch(page, /CHOOSE A PRODUCER/, "the chooser closes");
assert.match(
  page,
  new RegExp(`PRODUCER</span><div><b>${candidates[1].name}</b><small>Skill \\d+ · chemistry ×${chems[1]}`),
);

// Remove them, then assign from the label's pool, again seeing the chemistry first.
click({ action: "teamUnassign", member: String(candidates[1].id), artist: String(artistId) });
assert.deepEqual(saved().company.team.pool[0].artists, []);
click({ action: "teamPick", artist: String(artistId), role: "producer" });
assert.match(
  html("content"),
  new RegExp(
    `On the label[\\s\\S]*${candidates[1].name}[\\s\\S]*Chemistry ×${chems[1]}[\\s\\S]*data-action="teamAssign"`,
  ),
);
click({ action: "teamAssign", member: String(candidates[1].id), artist: String(artistId) });
assert.deepEqual(saved().company.team.pool[0].artists, [artistId]);
click({ action: "teamPick", artist: String(artistId), role: "producer" });
click({ action: "teamCancel" });
assert.doesNotMatch(html("content"), /CHOOSE A PRODUCER/);

// A bonus from the mood card.
const cash = saved().cash;
click({ action: "payBonus", artist: String(artistId) });
s = saved();
assert.equal(s.artists[0].persona.bonusWeek, s.week);
assert.ok(s.cash < cash);

// Departments at the front desk and in their own panel.
click({ tab: "desk~sec-team" });
page = html("content");
assert.match(page, /Departments[\s\S]*data-tab="dept:ar"[\s\S]*No head yet/);
assert.match(page, /data-tab="dept:marketing"[\s\S]*Opens at phase 2/);
click({ tab: "dept:marketing" });
assert.match(html("content"), /Marketing opens at phase 2/);
click({ tab: "dept:ar" });
assert.equal(element("drawerTitle").textContent, "A&R department");
assert.match(html("content"), /No Head of A&amp;R yet/);
click({ action: "deptRecruit", dept: "ar" });
const execs = saved().company.departments.ar.pool;
assert.equal(execs.length, 3);
assert.match(html("content"), new RegExp(`${execs[0].name}[\\s\\S]*data-action="deptHire"`));
click({ action: "deptHire", dept: "ar", candidate: String(execs[0].id) });
s = saved();
assert.equal(s.company.departments.ar.head.name, execs[0].name);
page = html("content");
assert.match(page, /HEAD OF A&amp;R[\s\S]*Ambition/);
assert.match(page, /0 of 2 staff/);
click({ action: "deptStaffAdd", dept: "ar" });
assert.equal(saved().company.departments.ar.staff, 1);
assert.match(html("content"), /CAPACITY 2/);
click({ action: "deptStaffRemove", dept: "ar" });
click({ action: "deptFire", dept: "ar" });
assert.equal(saved().company.departments.ar.head, null);
click({ tab: "dept:nothing" });
assert.equal(element("drawer").hidden, true);

// An ambitious head: the response buttons, then a failed grab's outcome card.
run(`state.event = null; G.hireHead(state, "ar", G.recruitExecs(state, "ar")[0].id);
  Object.assign(state.company.departments.ar.head, { ambition: 90, loyalty: 10, plot: { since: state.week, due: state.week + 1 } });
  save(); render();`);
click({ tab: "dept:ar" });
page = html("content");
assert.match(page, /Rumoured to be plotting/);
assert.match(page, /data-action="execRespond" data-dept="ar" data-kind="promote"/);
assert.match(page, /data-kind="placate"/);
click({ action: "execRespond", dept: "ar", kind: "promote" });
s = saved();
assert.equal(s.company.departments.ar.head.title, "Senior Head of A&R");
assert.match(html("content"), /SENIOR HEAD OF A&amp;R[\s\S]*Calm until week/);
run(
  `state.company.departments.ar.head.plot = { since: state.week, due: state.week }; G.resolveGrab(state, "ar"); save(); render();`,
);
assert.match(html("milestones"), /POWER GRAB[\s\S]*The grab failed[\s\S]*data-action="grabAck"/);
click({ action: "grabAck" });
assert.doesNotMatch(html("milestones"), /POWER GRAB/);

console.log(
  "PASS staff interface harness: grab responses and the outcome card, team section with slots, chooser with chemistry before hiring or assigning, removal, mood card and bonus, departments at the desk and in their panels, classic runs untouched",
);
