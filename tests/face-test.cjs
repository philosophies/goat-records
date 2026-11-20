// Superstars as the face of the company (3.0, T46): value, revenue, news, and a relationship that swings.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { FACE } = G;
function ceo(phase = 4, seed = 33) {
  const s = G.create(seed, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e6;
  return s;
}
function star(s, fame = 100, tier = "superstar") {
  const a = {
    ...s.candidates[0],
    id: s.nextId++,
    name: "Star " + s.nextId,
    fame,
    morale: 70,
    contract: { remaining: 2, term: 2 },
  };
  s.artists.push(a);
  a.tier = tier;
  a.ceoRelation = FACE.relation.start;
  return a;
}
const value = (s) => G.companyValuation(s).value - s.cash;

test("A superstar lifts company value by their fame; a feud halves it into a drag", () => {
  const s = ceo();
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, albumIncome: 20000 }));
  const base = value(s);
  const a = star(s, 100);
  assert.equal(G.faceMultiplier(s), 1 + FACE.brand);
  assert.ok(Math.abs(value(s) - base * (1 + FACE.brand)) <= 2, "value moves with the multiplier");
  a.ceoRelation = -40;
  assert.equal(G.faceMultiplier(s), 1 - FACE.brand / 2);
  a.tier = "star";
  assert.equal(G.faceMultiplier(s), 1, "only superstars are the face of the company");
});

test("Superstars bring in endorsement money every week", () => {
  const s = ceo(4),
    a = star(s, 80);
  assert.equal(G.endorsements(s), 80 * FACE.endorse[3]);
  a.ceoRelation = -10;
  assert.equal(G.endorsements(s), Math.round(80 * FACE.endorse[3] * 0.5), "half while feuding");
  assert.equal(G.endorsements(ceo(2)), 0);
});

test("News shocks move value for a while, then fade", () => {
  const s = ceo(),
    a = star(s);
  G.addShock(s, a, -0.1, 4, "test");
  const shocked = G.faceMultiplier(s);
  assert.ok(Math.abs(shocked - (1 + FACE.brand) * 0.9) < 1e-9);
  s.week += 5;
  assert.equal(G.faceMultiplier(s), 1 + FACE.brand, "expired");
});

test("Superstars make news by themselves now and then", () => {
  let good = 0,
    bad = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = ceo(4, seed),
      a = star(s);
    for (let w = 0; w < 26; w++) {
      const before = s.notifications.length;
      while (s.event) G.choose(s, s.event.options.length - 1);
      for (const x of [...(s.company.inbox || [])]) G.decide(s, x.id, 0);
      G.advance(s);
      for (const n of s.notifications.slice(before))
        if (n.title.includes(a.name)) n.title.includes("lifts") ? good++ : n.title.includes("drags") && bad++;
    }
  }
  assert.ok(good > 0 && bad > 0, `both kinds of news happen (${good} good, ${bad} bad)`);
});

test("The relationship swings harder for superstars and stays within ±100", () => {
  const s = ceo(),
    a = star(s),
    b = star(s, 60, "star");
  b.ceoRelation = FACE.relation.start;
  G.shiftRelation(s, a, 20);
  G.shiftRelation(s, b, 20);
  assert.equal(a.ceoRelation - FACE.relation.start, 20 * FACE.relation.swing);
  assert.equal(b.ceoRelation - FACE.relation.start, 20);
  G.shiftRelation(s, a, 500);
  assert.equal(a.ceoRelation, 100);
  G.shiftRelation(s, a, -900);
  assert.equal(a.ceoRelation, -100);
});

test("A new superstar's relationship starts from their loyalty and drifts with their mood", () => {
  const s = ceo(4),
    a = star(s, 90, "star");
  delete a.ceoRelation;
  G.artistMood(s, a);
  a.persona.loyalty = 80;
  for (let i = 0; i < 4; i++)
    s.albums.push({ id: s.nextId++, artist: a.id, released: true, quality: 90, releaseWeek: s.week });
  G.promoteTiers(s);
  assert.equal(G.tierOf(a), "superstar");
  assert.equal(a.ceoRelation, Math.round(FACE.relation.start + 30 * FACE.relation.loyaltyWeight));
  // Unhappy: the relationship drifts down toward (morale − 60) ÷ 2.
  a.morale = 10;
  a.persona.want = "family";
  const start = a.ceoRelation;
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
  assert.ok(a.ceoRelation < start, `${a.ceoRelation} < ${start}`);
});

test("Superstar events swing the relationship and the company's value", () => {
  const ids = ["superstar-sneaker", "superstar-radio", "superstar-imprint", "superstar-rumor"];
  for (const id of ids) {
    const e = require("../src/data/events.js").COMPANY_EVENTS.find((x) => x.id === id);
    assert.ok(e, id);
    assert.deepEqual(e.when.artist, [{ field: "tier", equals: "superstar" }]);
    assert.ok(
      e.choices.some((c) => c.effects.relation > 0) &&
        e.choices.some((c) => c.effects.relation < 0 || c.effects.brand?.mult < 0),
    );
  }
});

test("Face state survives a save", () => {
  const s = ceo(),
    a = star(s);
  G.addShock(s, a, 0.05, 6, "x");
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(G.validSystemsSave(copy), true);
  copy.artists.at(-1).ceoRelation = 400;
  assert.equal(G.validSystemsSave(copy), false);
});

console.log(`${count} face tests passed.`);
