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

console.log(`${count} company tests passed.`);
