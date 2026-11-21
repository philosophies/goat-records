// A second act (3.0, T47): a superstar may follow a fired or ousted CEO to a new company.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { SECOND_ACT } = G;
/** A finished CEO run: fired, with one superstar at the given relationship and loyalty. */
function firedWith(relation, loyalty, how = "fired") {
  const s = G.create(41, { ceo: true, labelName: "Velvet Throne" });
  s.company.phase = 4;
  const a = {
    ...s.candidates[0],
    id: s.nextId++,
    name: "Kofi Banks",
    fame: 92,
    morale: 70,
    tier: "superstar",
    ceoRelation: relation,
    contract: { remaining: 0, term: 3 },
  };
  s.artists.push(a);
  G.artistMood(s, a);
  a.persona.loyalty = loyalty;
  s.finished = true;
  s[how] = true;
  s.outcome = how === "fired" ? "Fired." : "Ousted.";
  return { s, a };
}

test("A trusted, loyal superstar is willing to follow you", () => {
  assert.deepEqual(
    G.willingToFollow(firedWith(SECOND_ACT.relation, SECOND_ACT.loyalty).s).map((a) => a.name),
    ["Kofi Banks"],
  );
  assert.deepEqual(G.willingToFollow(firedWith(SECOND_ACT.relation - 1, 90).s), [], "not enough trust");
  assert.deepEqual(G.willingToFollow(firedWith(90, SECOND_ACT.loyalty - 1).s), [], "not loyal enough");
  const { s, a } = firedWith(90, 90);
  a.tier = "star";
  assert.deepEqual(G.willingToFollow(s), [], "only superstars can carry a new company");
});

test("Following you starts a new company at phase 1 with that superstar", () => {
  for (const how of ["fired", "ousted"]) {
    const { s, a } = firedWith(70, 80, how),
      n = G.secondAct(s, a.id, "Second Wind");
    assert.equal(n.company.onboarding, undefined, "a second act has no starter checklist");
    assert.equal(n.finished, false);
    assert.equal(n.company.phase, 1);
    assert.equal(G.labelName(n), "Second Wind");
    const b = n.artists.find((x) => x.name === a.name);
    assert.ok(b, "the superstar came along");
    assert.equal(G.tierOf(b), "superstar");
    assert.equal(b.ceoRelation, 70);
    assert.equal(b.contract.remaining, SECOND_ACT.albums);
    assert.equal(n.cash, G.PHASES[0].startCash + SECOND_ACT.cash);
    assert.deepEqual(n.secondAct, { count: 1, from: "Velvet Throne", artist: a.name, week: s.week });
    assert.equal(s.finished, true, "the old run is untouched");
    assert.equal(G.validSystemsSave(JSON.parse(JSON.stringify(n))), true);
  }
});

test("Without a willing superstar the run ends; a second act needs a real ending", () => {
  const { s, a } = firedWith(10, 90);
  assert.throws(() => G.secondAct(s, a.id, "Again"), /will not follow you/);
  const happy = firedWith(90, 90);
  happy.s.finished = false;
  happy.s.fired = false;
  assert.throws(() => G.secondAct(happy.s, happy.a.id, "Again"), /follows being fired or ousted/);
  const unnamed = firedWith(90, 90);
  assert.throws(() => G.secondAct(unnamed.s, unnamed.a.id, "  "), /Name the new company/);
});

test("A second act can be played on", () => {
  const { s, a } = firedWith(90, 90),
    n = G.secondAct(s, a.id, "Second Wind");
  for (let i = 0; i < 6; i++) {
    while (n.event) G.choose(n, n.event.options.length - 1);
    for (const x of [...(n.company.inbox || [])]) G.decide(n, x.id, 0);
    G.advance(n);
  }
  assert.equal(n.week, 7);
});

console.log(`${count} second act tests passed.`);
