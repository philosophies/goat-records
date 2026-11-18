// Company phases (2.0): the CEO run flag, the starting phase and save checks.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { PHASES } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

test("A classic run has no company and keeps the 1.1 start", () => {
  const s = G.create(7);
  assert.equal(s.company, undefined);
  assert.equal(s.ceoMode, undefined);
  assert.equal(G.companyPhase(s), null);
  assert.equal(s.cash, G.create(7).cash);
  assert.ok(s.cash > PHASES[0].startCash, "classic runs keep their larger starting cash");
});

test("A CEO run starts in the home studio with $2,000", () => {
  const s = G.create(7, { ceo: true });
  assert.equal(s.ceoMode, true);
  assert.deepEqual(s.company, { phase: 1, since: 1, history: [{ phase: 1, week: 1 }] });
  assert.equal(s.cash, PHASES[0].startCash);
  assert.equal(s.cash, 2000);
  assert.equal(G.companyPhase(s).name, "Home studio");
  assert.equal(G.companyPhase(s).reach, "local");
});

test("Phases are numbered 1-6 with goals that only grow", () => {
  assert.equal(PHASES.length, 6);
  PHASES.forEach((p, i) => assert.equal(p.id, i + 1));
  for (let i = 1; i < PHASES.length; i++)
    for (const k of Object.keys(PHASES[i].goals))
      assert.ok(PHASES[i].goals[k] >= PHASES[i - 1].goals[k], `${PHASES[i].name} ${k}`);
  for (const p of PHASES) assert.ok(G.REACHES.includes(p.reach), p.name);
});

test("CEO and classic saves pass the load checks after a round trip", () => {
  for (const s of [G.create(3), G.create(3, { ceo: true })]) {
    const copy = roundTrip(s);
    assert.equal(G.validSystemsSave(copy), true);
    G.migrate(copy);
    assert.equal(copy.company === undefined, !s.ceoMode, "migration neither adds nor drops the company");
    assert.equal(copy.cash, s.cash, "migration does not reset a CEO run's cash");
  }
});

test("A damaged company record fails the load checks", () => {
  const bad = (change) => {
    const s = roundTrip(G.create(4, { ceo: true }));
    change(s);
    return G.validSystemsSave(s);
  };
  assert.equal(
    bad((s) => (s.company.phase = 0)),
    false,
  );
  assert.equal(
    bad((s) => (s.company.phase = 7)),
    false,
  );
  assert.equal(
    bad((s) => (s.company = [])),
    false,
  );
  assert.equal(
    bad((s) => (s.company.history = [{ phase: "x", week: 1 }])),
    false,
  );
  assert.equal(
    bad((s) => (s.company.since = -1)),
    false,
  );
});

test("A CEO run plays weeks like any other run", () => {
  const s = G.create(9, { ceo: true });
  s.cash = 50000;
  for (let i = 0; i < 10; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  assert.equal(s.company.phase, 1);
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
});

function ceo(seed = 21) {
  const s = G.create(seed, { ceo: true });
  s.cash = 100000;
  return s;
}
function week(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
/** Meets phase 2's goals: fame, a year of revenue and three released albums. */
function readyForPhase2(s) {
  const g = PHASES[1].goals;
  s.fame = g.fame + 50;
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({
    week: i + 1,
    albumIncome: Math.ceil(g.revenue / 52) + 10,
    hqIncome: 0,
    otherIncome: 0,
  }));
  for (let i = 0; i < g.releases; i++)
    s.albums.push({ id: 900 + i, released: true, quality: 60, age: 30, salesWeeks: 12, chart: {} });
}

test("Phase progress lists the next phase's goals with what the label has", () => {
  const s = ceo();
  const pr = G.phaseProgress(s);
  assert.equal(pr.next.name, "Indie label");
  assert.deepEqual(
    pr.goals.map((g) => g.key),
    ["fame", "revenue", "releases", "hits"],
  );
  assert.equal(pr.met, false);
  assert.equal(pr.goals.find((g) => g.key === "hits").met, true, "phase 2 needs no hits");
  assert.equal(G.phaseProgress(G.create(21)), null, "classic runs have no phase progress");
});

test("Revenue counts the last 52 weeks of income and ignores losses", () => {
  const s = ceo();
  s.financeHistory = [
    { albumIncome: 1000, hqIncome: 200, otherIncome: 300 },
    { albumIncome: -50, hqIncome: 0, otherIncome: 0 },
  ];
  assert.equal(G.yearRevenue(s), 1500);
});

test("Meeting every goal moves the label up one phase at the settlement", () => {
  const s = ceo();
  readyForPhase2(s);
  assert.equal(G.phaseProgress(s).met, true);
  const notes = s.notifications.length;
  week(s);
  assert.equal(s.company.phase, 2);
  assert.equal(G.companyPhase(s).name, "Indie label");
  assert.equal(s.company.history.at(-1).phase, 2);
  assert.equal(s.company.since, s.company.history.at(-1).week);
  assert.ok(s.company.since >= 1 && s.company.since <= s.week);
  const n = s.notifications.slice(notes).find((x) => x.kind === "phase");
  assert.ok(n, "a phase notification is raised");
  assert.match(n.title, /Phase 2 · Indie label/);
  assert.ok(s.news.some((x) => /phase 2: Indie label/.test(x)));
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
});

test("Missing one goal holds the label where it is", () => {
  const s = ceo();
  readyForPhase2(s);
  s.fame = PHASES[1].goals.fame - 1;
  week(s);
  assert.equal(s.company.phase, 1);
});

test("A phase is never lost, and the label moves at most one phase a week", () => {
  const s = ceo();
  readyForPhase2(s);
  s.fame = 10 ** 6;
  for (let i = 0; i < 20; i++) s.albums.push({ id: 950 + i, released: true, quality: 90, chart: {} });
  s.financeHistory.forEach((w) => (w.albumIncome = 10 ** 6));
  week(s);
  assert.equal(s.company.phase, 2, "one phase per settlement");
  week(s);
  assert.equal(s.company.phase, 3);
  s.fame = 0;
  s.financeHistory = [];
  week(s);
  assert.equal(s.company.phase, 3, "falling below the goals does not demote");
});

test("The last phase has no next goals", () => {
  const s = ceo();
  s.company.phase = PHASES.length;
  assert.equal(G.phaseProgress(s), null);
  week(s);
  assert.equal(s.company.phase, PHASES.length);
});

test("A classic run never changes phase", () => {
  const s = G.create(21);
  readyForPhase2(s);
  week(s);
  assert.equal(s.company, undefined);
});

console.log(`${count} company tests passed.`);
