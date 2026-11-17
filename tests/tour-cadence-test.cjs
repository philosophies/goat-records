const assert = require("node:assert/strict"),
  G = require("../src/engine.js"),
  B = require("./tour-balance.cjs");
let count = 0;
function test(n, fn) {
  fn();
  count++;
  console.log("PASS " + n);
}
function choose(s) {
  if (s.event) G.choose(s, B.steady(s, s.event));
}
test("All concurrent tours share a strict three-decision cap per label week", () => {
  const f = B.fixture(9, "regional", "solo"),
    a = f.s.artists[1],
    p = {
      ...f.s.albums[0],
      id: f.s.nextId++,
      artist: a.id,
      artistName: a.name,
      tourLaunched: false,
      boosts: [],
    };
  f.s.albums.push(p);
  const t2 = G.startTour(f.s, { albumId: p.id }),
    weeks = {},
    seen = new Set();
  let guard = 0;
  while (f.s.tours.some((t) => t.status === "active") && guard++ < 150) {
    if (!f.s.event) G.advanceTourToNextActivity(f.s);
    if (f.s.event?.type === "tourDay") {
      weeks[f.s.week] = (weeks[f.s.week] || 0) + 1;
      seen.add(f.s.event.tour);
    }
    choose(f.s);
  }
  assert.ok(guard < 150);
  assert.ok(Object.values(weeks).every((n) => n <= 3));
  assert.equal(seen.size, 2);
  assert.ok(f.s.tours.every((t) => t.day === t.plannedDays));
  assert.ok(t2.day > 0);
});
test("Ordinary, promotion and routing decisions schedule different real review days", () => {
  for (const [id, index, expected] of [
    ["crew", 0, 4],
    ["promoter", 1, 3],
    ["viral", 1, 5],
  ]) {
    const f = B.fixture(3, "regional", "solo");
    f.t.eventBag = [id];
    G.advanceTourToNextActivity(f.s);
    assert.equal(f.t.day, 1);
    const option = f.s.event.options[index];
    assert.match(option.hint, new RegExp("Next review: tour day " + expected));
    G.choose(f.s, index);
    assert.equal(f.t.nextInteractionDay, expected);
    G.advanceTourToNextActivity(f.s);
    assert.equal(f.t.day, expected);
    assert.equal(f.s.event.type, "tourDay");
  }
});
test("Recovery selections span the full recovery without intervening prompts", () => {
  const f = B.fixture(4, "regional", "solo");
  f.t.eventBag = ["care"];
  f.s.artists[0].energy = 50;
  G.advanceTourToNextActivity(f.s);
  const energy = f.s.artists[0].energy;
  G.choose(f.s, 0);
  assert.equal(f.t.nextInteractionDay, 4);
  assert.equal(f.t.restDays, 2);
  G.advanceTourToNextActivity(f.s);
  assert.equal(f.t.day, 4);
  assert.equal(f.t.showDays, 2);
  assert.equal(f.t.restDays, 0);
  assert.ok(Math.abs(f.s.artists[0].energy - (energy + 18 - 8 / 7)) < 0.001);
  assert.equal(f.s.event.type, "tourDay");
});
test("Quiet days still settle daily receipts and exactly one weekly payroll", () => {
  const f = B.fixture(5, "regional", "solo");
  f.s.tourCadence.count = 3;
  const week = f.s.week,
    history = f.s.financeHistory.length;
  G.advanceTourToNextActivity(f.s);
  assert.equal(f.t.day, 7);
  assert.equal(f.t.history.filter((h) => !h.event).length, 7);
  assert.ok(f.t.revenue > 0);
  assert.equal(f.s.week, week + 1);
  assert.equal(f.s.financeHistory.length, history + 1);
  assert.equal(f.s.event, null);
  assert.equal(G.tourInteractionBudget(f.s).count, 0);
});
test("Reload preserves next review, show hold and the used weekly budget", () => {
  let f = B.fixture(6, "regional", "solo");
  f.t.eventBag = ["promoter"];
  G.advanceTourToNextActivity(f.s);
  G.choose(f.s, 0);
  const saved = JSON.stringify(f.s);
  f.s = G.migrate(JSON.parse(saved));
  f.t = f.s.tours[0];
  assert.equal(f.s.tourCadence.count, 1);
  assert.equal(f.t.nextInteractionDay, 4);
  assert.equal(f.t.reviewAfterShow, 4);
  G.advanceTourToNextActivity(f.s);
  assert.equal(f.t.day, 4);
  assert.equal(f.s.tourCadence.count, 2);
});
test("The final date completes automatically when the weekly interaction cap is used", () => {
  const f = B.fixture(7, "regional", "solo");
  f.t.day = 27;
  f.t.showDays = 27;
  f.s.tourCadence.count = 3;
  G.advanceTourToNextActivity(f.s);
  assert.equal(f.t.status, "completed");
  assert.equal(f.t.day, 28);
  assert.equal(f.s.event, null);
  assert.equal(f.s.tourCadence.count, 3);
});
test("Fast-forward stops at weekly settlement before the next album stage needs a choice", () => {
  const f = B.fixture(8, "regional", "solo"),
    a = f.s.artists[1];
  G.record(f.s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  const p = f.s.albums.at(-1);
  G.decideStage(f.s, p.id, 0);
  G.continueProduction(f.s, p.id);
  f.s.tourCadence.count = 3;
  G.advanceTourToNextActivity(f.s);
  assert.equal(f.t.day, 7);
  assert.equal(p.production.cooldown, 0);
  assert.ok(G.productionBlock(f.s));
  const before = JSON.stringify(f.s);
  assert.throws(() => G.advanceTourToNextActivity(f.s), /album decision/);
  assert.equal(JSON.stringify(f.s), before);
});
console.log(`${count} multi-day tour cadence tests passed.`);
