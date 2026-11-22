// Owner decisions of 2026-11-22 (T65): an empty roster may sign one up-and-comer at low reputation,
// the board's album floor and its negotiation, and the delegated renewal wage limit by phase.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const quiet = (s) => {
  G.setStarter(s, false);
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  return s;
};

test("a label with no artists can sign one up-and-comer whatever its reputation", () => {
  const s = quiet(G.create(65, { ceo: true }));
  Object.assign(s, { cash: 1e6, reputation: 5 });
  G.sign(s, s.candidates[0].id);
  assert.equal(s.artists.length, 1);
  assert.equal(G.tierOf(s.artists[0]), "rising", "an up-and-comer");
  assert.throws(
    () => G.sign(s, s.candidates[0].id),
    /reputation of at least 30.*no artists can still sign one/,
  );
  // Empty again: one more.
  s.artists[0].contract.remaining = 0;
  G.releaseArtist(s, s.artists[0].id);
  assert.equal(s.artists.length, 0);
  G.sign(s, s.candidates[0].id);
  assert.equal(s.artists.length, 1);
  // Classic runs keep the old rule.
  const c = G.create(65, { ceo: false });
  Object.assign(c, { cash: 1e6, reputation: 5 });
  assert.throws(
    () => G.sign(c, c.candidates[0].id),
    /^Error: This artist needs label reputation of at least 30\.$/,
  );
});

/** A phase-2 label with a board on low freedom and its budget spent. */
function boarded() {
  const s = quiet(G.create(66, { ceo: true }));
  s.cash = 1e6;
  s.company.phase = 2;
  G.takeFunding(s, "angel", 0);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, inspiration: 90 });
  const b = s.company.board;
  Object.assign(b, { freedom: "low", spent: b.budget, budgetLeft: 0 });
  return { s, a, b };
}
const album = (s, a, budget = 4000) =>
  G.record(s, { artistId: a.id, boothId: s.booths[0].id, genre: a.genre, audience: a.audience, budget });

test("the album floor lets album budgets through a refusing board without counting them", () => {
  const { s, a, b } = boarded();
  const f = G.albumFloor(s);
  assert.equal(f.amount, G.ALBUM_FLOOR.byPhase[1]);
  assert.equal(f.left, f.amount);
  const spent = b.spent;
  album(s, a);
  assert.equal(s.event, null, "no approval card");
  assert.equal(b.spent, spent, "not counted against the budget");
  assert.equal(G.albumFloor(s).used, 4000);
  // Other payments past the budget still need the board.
  assert.throws(() => G.recruitExecs(s, "ar"), /Board approval needed/);
  s.event = null;
  // Once the floor is used up, albums need approval again.
  b.albumFloor.used = f.amount - 1000;
  const p = s.albums.at(-1);
  p.released = true;
  a.inspiration = 90;
  a.energy = 100;
  assert.throws(() => album(s, a), /Board approval needed/);
});

test("a review resets the floor; high confidence opens one negotiation; a low one loses a level", () => {
  const { s, b } = boarded();
  b.albumFloor = { level: 0, used: 5000, offer: false };
  for (const d of b.directors) d.relationship = 25;
  const r = G.runReview(s);
  b.scene = false;
  assert.equal(b.albumFloor.used, 0);
  assert.equal(r.floor.offer, r.confidence >= G.ALBUM_FLOOR.levels[0].at);
  // Ask with enough confidence: the next level.
  b.albumFloor.offer = true;
  b.confidence = 75;
  assert.equal(G.negotiateFloor(s), true);
  assert.equal(G.albumFloor(s).level, 1);
  assert.equal(G.albumFloor(s).amount, G.ALBUM_FLOOR.byPhase[1] * G.ALBUM_FLOOR.levels[0].mult);
  assert.throws(() => G.negotiateFloor(s), /only right after a review/, "once per review");
  // Not enough confidence for the next level: the board says no and the offer is spent.
  b.albumFloor.offer = true;
  b.meetingWeek = null;
  b.confidence = 65;
  assert.equal(G.negotiateFloor(s), false);
  assert.equal(G.albumFloor(s).level, 1);
  assert.equal(G.albumFloor(s).offer, false);
  // It takes the week with the board.
  b.albumFloor.offer = true;
  b.meetingWeek = s.week;
  assert.throws(() => G.negotiateFloor(s), /this week's time/);
  // A review under 50 loses a level.
  for (const d of b.directors) d.relationship = -25;
  b.probation = false;
  const low = G.runReview(s);
  if (!s.finished) assert.equal(b.albumFloor.level, low.confidence < G.ALBUM_FLOOR.dropBelow ? 0 : 1);
  const bad = JSON.parse(JSON.stringify(s));
  if (bad.company.board) {
    bad.company.board.albumFloor.level = 9;
    assert.equal(G.validSystemsSave(bad), false);
  }
});

test("the delegated renewal wage limit follows the phase until the player sets one", () => {
  const s = quiet(G.create(67, { ceo: true }));
  const X = G.DELEGATION.renew;
  for (let phase = 3; phase <= 6; phase++) {
    s.company.phase = phase;
    assert.equal(G.renewWageLimit(s), X.maxWageByPhase[phase - 1]);
  }
  assert.ok(X.maxWageByPhase[5] > X.maxWageByPhase[2], "rises with the phase");
  G.setDelegation(s, "renew", { maxWage: 700 });
  assert.equal(G.renewWageLimit(s), 700);
  G.setDelegation(s, "renew", { maxWage: null });
  assert.equal(G.renewWageLimit(s), X.maxWageByPhase[5]);
});

console.log(`\n${count} owner-answer tests passed.`);
