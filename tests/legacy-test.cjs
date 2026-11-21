// Legacy and challenges (3.0, T62): hall of fame entries for every ending, achievements that unlock
// once, challenge starts that are the same for the same seed, and perks within their cap.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { ACHIEVEMENTS, CHALLENGES, PERKS, LEGACY_RULES: R } = G;
const D = require("../src/data/legacy.js");
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function run(seed = 62, options = {}) {
  const s = G.create(seed, { ceo: true, ...options });
  G.setStarter(s, false);
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  return s;
}
const settle = (s) => {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
};

test("every way a run ends leaves one hall of fame entry", () => {
  let hall = [];
  const endings = {
    folded: (s) => Object.assign(s, { finished: true, bankrupt: true, cash: -500 }),
    fired: (s) => Object.assign(s, { finished: true, fired: true }),
    complete: (s) => Object.assign(s, { finished: true, week: 20 * 52 + 1 }),
  };
  for (const [ending, end] of Object.entries(endings)) {
    const s = run(70 + hall.length);
    s.cash = 1e6;
    G.sign(s, s.candidates[0].id);
    s.company.phase = 3;
    s.company.history.push({ phase: 4, week: 2 });
    assert.equal(G.recordRun(hall, s, 1).length, hall.length, "not before the run ends");
    end(s);
    hall = G.recordRun(hall, s, 1700000000000);
    const e = hall[0];
    assert.equal(e.ending, ending);
    assert.equal(e.label, G.labelName(s));
    assert.equal(e.peakPhase, 4, "the highest phase reached");
    assert.ok(Number.isInteger(e.years));
    assert.ok("bestAlbum" in e && Array.isArray(e.superstars));
    assert.equal(e.when, 1700000000000);
    assert.equal(G.recordRun(hall, s, 2), hall, "recorded once");
    assert.equal(s.company.legacy.recorded, true);
  }
  assert.deepEqual(
    hall.map((e) => e.ending),
    ["complete", "fired", "folded"],
    "newest first",
  );
  // The hall keeps the most recent runs only.
  let long = [];
  for (let i = 0; i < R.hallSize + 5; i++) {
    const s = run(100 + i);
    s.finished = true;
    s.bankrupt = true;
    long = G.recordRun(long, s, i);
  }
  assert.equal(long.length, R.hallSize);
  assert.equal(long[0].when, R.hallSize + 4);
});

test("about thirty achievements, each with a measure; each unlocks once with a notice", () => {
  assert.ok(ACHIEVEMENTS.length >= 30);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const s = run();
  settle(s); // every measure runs on a fresh label without error
  assert.deepEqual(s.company.legacy.achievements, []);
  s.awards = 5;
  s.cash = 1e6 + 1;
  settle(s);
  for (const id of ["award", "five-awards", "millionaire"])
    assert.ok(s.company.legacy.achievements.includes(id), id);
  const notices = () => s.notifications.filter((n) => n.kind === "achievement").length;
  const n = notices();
  assert.equal(n, 3);
  settle(s);
  assert.equal(notices(), n, "no second unlock");
  assert.equal(new Set(s.company.legacy.achievements).size, s.company.legacy.achievements.length);
  // A chart position counts down: #1 also meets the Top 10.
  s.albums.push({ id: 5000, released: true, chart: { best: 1 }, hit: true, releaseWeek: s.week, artist: -1 });
  settle(s);
  for (const id of ["top-ten", "number-one", "first-release", "first-hit"])
    assert.ok(s.company.legacy.achievements.includes(id), id);
  // Across runs: stored ids plus this run's, in table order.
  assert.deepEqual(G.unlockedAchievements(["chart-war", "award"], s).slice(0, 3), [
    "first-sign",
    "first-release",
    "first-hit",
  ]);
  assert.ok(G.unlockedAchievements(["chart-war"], s).includes("chart-war"));
});

test("each challenge starts the same for the same seed, with its twist", () => {
  for (const c of CHALLENGES) {
    const a = G.create(9, { ceo: true, challenge: c.id }),
      b = G.create(9, { ceo: true, challenge: c.id });
    assert.deepEqual(roundTrip(a), roundTrip(b), c.id);
    assert.equal(a.company.legacy.challenge.id, c.id);
    assert.ok(G.validSystemsSave(roundTrip(a)), c.id);
  }
  const debt = G.create(9, { ceo: true, challenge: "debt" }),
    plain = G.create(9, { ceo: true });
  assert.equal(debt.cash, plain.cash, "the loan's money is already gone");
  assert.equal(debt.company.loan.balance, D.CHALLENGE_RULES.debt.loan);
  const star = G.create(9, { ceo: true, challenge: "star" });
  assert.equal(star.artists.length, 1);
  assert.equal(G.tierOf(star.artists[0]), "superstar");
  assert.equal(star.artists[0].contract.remaining, D.CHALLENGE_RULES.star.albums);
  assert.equal(star.cash, D.CHALLENGE_RULES.star.cash);
  const board = G.create(9, { ceo: true, challenge: "board" });
  assert.equal(board.company.phase, 1);
  assert.equal(board.company.board.freedom, "low");
  assert.ok(
    board.company.board.directors.every((d) => d.relationship === D.CHALLENGE_RULES.board.relationship),
  );
  const piracy = G.create(9, { ceo: true, challenge: "piracy" });
  assert.equal(G.currentEra(piracy).id, "piracy");
  const e = piracy.company.eras.starts;
  for (let i = 2; i < e.length; i++) assert.ok(e[i] - e[i - 1] >= 104, "later eras still last two years");
  const noLoans = G.create(9, { ceo: true, challenge: "noLoans" });
  assert.ok(!G.fundingOffers(noLoans).some((o) => o.kind === "loan"));
  assert.throws(() => G.takeFunding(noLoans, "loan"), /will not lend/);
  assert.ok(G.fundingOffers(plain).some((o) => o.kind === "loan"));
});

test("the weekly seed is shared within an ISO week and sets its own twist", () => {
  const mon = G.weeklyChallenge(new Date("2026-11-16T09:00:00Z")),
    sun = G.weeklyChallenge(new Date("2026-11-22T23:00:00Z")),
    next = G.weeklyChallenge(new Date("2026-11-23T00:30:00Z"));
  assert.deepEqual(mon, sun);
  assert.notEqual(mon.seed, next.seed);
  assert.equal(mon.week, 47);
  assert.ok(D.CHALLENGE_RULES.weeklyTwists.includes(mon.twist));
  const s = G.create(mon.seed, { ceo: true, challenge: "weekly" });
  assert.equal(s.company.legacy.challenge.twist, mon.twist);
});

test("perks are small: none over the cap, at most two, opened by achievements", () => {
  for (const p of PERKS)
    for (const k of ["sales", "touring", "training"]) assert.ok((p[k] || 0) <= R.cap, `${p.id} ${k}`);
  assert.deepEqual(G.perksOpen(0), []);
  assert.deepEqual(G.perksOpen(6), ["extra-candidate", "second-theme"]);
  assert.equal(G.perksOpen(ACHIEVEMENTS.length).length, PERKS.length);
  const plain = run(11),
    s = run(11, { perks: ["extra-candidate", "known-name", "loyal-fans"] });
  assert.deepEqual(s.company.legacy.perks, ["extra-candidate", "known-name"], "two at most");
  assert.equal(s.candidates.length, plain.candidates.length + 1);
  assert.equal(s.reputation, Math.min(100, plain.reputation + 5));
  const fans = run(11, { perks: ["loyal-fans", "road-crew"] });
  const sys = require("../src/systems/legacy.js").create(
    { clamp: (x) => x, log() {}, operatingYear: G.operatingYear, api: () => G },
    D,
  );
  assert.equal(sys.salesMultiplier(fans), 1.03);
  assert.equal(sys.tourGate(fans), 1.03);
  assert.equal(sys.salesMultiplier(plain), 1);
  const hands = run(11, { perks: ["steady-hands"] });
  assert.equal(sys.trainingAdjust(hands).discount, 0.05);
});

test("saves check their legacy data; classic runs have none", () => {
  const s = run();
  const bad = roundTrip(s);
  bad.company.legacy.achievements.push("moon-landing");
  assert.equal(G.validSystemsSave(bad), false);
  const many = roundTrip(s);
  many.company.legacy.perks = ["extra-candidate", "known-name", "loyal-fans"];
  assert.equal(G.validSystemsSave(many), false);
  const old = roundTrip(s);
  delete old.company.legacy;
  assert.ok(G.migrate(old).company.legacy);
  assert.equal(G.create(3, { ceo: false }).company, undefined);
});

console.log(`\n${count} legacy tests passed.`);
