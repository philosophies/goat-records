const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function clearEvents(s) {
  while (s.event) {
    const e = s.event;
    let pick = 2;
    if (e.type === "tour") {
      pick = e.title.includes("fatigue") ? 0 : e.options[0].recruitRival ? 1 : 0;
    }
    G.choose(s, pick);
  }
}
function step(s) {
  clearEvents(s);
  for (const p of s.albums) {
    if (p.launchReview) p.launchReview = false;
    if (p.released || p.production.cooldown) continue;
    const d = p.production;
    if (d.releaseReady) {
      G.releaseAlbum(s, p.id, p.title);
      p.launchReview = false;
    } else {
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
  }
  G.advance(s);
}
function ready(seed = 18, addOns = []) {
  const s = G.create(seed);
  s.cash = 500000;
  s.fame = 200;
  G.sign(s, s.candidates[0].id, 3);
  const a = s.artists[0];
  a.age = "Adult";
  a.talent = 85;
  a.potential = 100;
  a.fans = 150;
  a.fame = 70;
  a.energy = 100;
  G.record(s, {
    artistId: a.id,
    boothId: 0,
    genre: a.genre,
    audience: a.audience,
    title: "Road Test",
    addOns,
  });
  const p = s.albums[0];
  while (!p.production.releaseReady) step(s);
  clearEvents(s);
  return { s, a, p };
}
function fixture(seed = 18) {
  const f = ready(seed);
  G.releaseAlbum(f.s, f.p.id, f.p.title);
  f.p.launchReview = false;
  f.p.chart.best = 5;
  f.a.energy = 100;
  return f;
}
function book(f, scale = "regional", mode = "solo", partnerId = null) {
  return G.startTour(f.s, { albumId: f.p.id, scale, mode, partnerId, rivalId: f.s.rivalArtists[0].id });
}
test("Six rooms progress monotonically in equipment, crew, build cost and upkeep", () => {
  assert.equal(G.BOOTHS.length, 6);
  for (let i = 1; i < 6; i++)
    for (const k of ["equipment", "team", "cost", "upkeep"]) assert.ok(G.BOOTHS[i][k] > G.BOOTHS[i - 1][k]);
  const s = G.create(2);
  s.cash = 100000;
  assert.throws(() => G.build(s, 5), /tier/);
  s.fame = 200;
  G.build(s, 5);
  assert.equal(G.upkeep(s), 900);
});
test("Rooms improve all genres without an affinity table", () => {
  const { s, a, p } = ready();
  p.production.stage = 2;
  const base = G.stagePreview(s, p, 2);
  s.booths.push({ id: 5, prestige: 0, hits: 0 });
  p.booth = 5;
  const high = G.stagePreview(s, p, 2);
  assert.ok(high.expected > base.expected);
  p.genre = a.genre = "Rock";
  const rock = G.stagePreview(s, p, 2);
  p.genre = a.genre = "Sacred";
  assert.deepEqual(G.stagePreview(s, p, 2).parts, rock.parts);
  assert.ok(!G.BOOTHS.some((r) => "genres" in r));
});
test("Every add-on adds exactly one elapsed production week across all package combinations", () => {
  for (let mask = 0; mask < 16; mask++) {
    const ids = G.ALBUM_ADDONS.filter((_, i) => mask & (1 << i)).map((a) => a.id),
      { s, p } = ready(20, ids);
    assert.equal(s.week - 1, 5 + ids.length);
    assert.equal(p.duration, 5 + ids.length);
    assert.equal(
      p.budget,
      4000 + G.ALBUM_ADDONS.filter((o) => ids.includes(o.id)).reduce((n, o) => n + o.cost, 0),
    );
  }
});
test("A Star Producer is paid once for this album and does not boost later projects for free", () => {
  const s = G.create(3);
  s.cash = 100000;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  a.age = "Adult";
  const copy = JSON.parse(JSON.stringify(s)),
    cash = s.cash;
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, addOns: ["star"] });
  G.record(copy, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  assert.equal(cash - s.cash, 19000);
  assert.equal(
    G.stagePreview(s, s.albums[0], 0).parts[2].value - G.stagePreview(copy, copy.albums[0], 0).parts[2].value,
    10,
  );
  assert.equal(s.staff.includes("Producer"), false);
  assert.deepEqual(copy.albums[0].addOns, []);
});
test("Invalid or duplicate add-ons do not charge or mutate a plan", () => {
  const s = G.create(3);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0],
    before = JSON.stringify(s);
  for (const addOns of [["star", "star"], ["unknown"]])
    assert.throws(
      () => G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, addOns }),
      /Invalid/,
    );
  assert.equal(JSON.stringify(s), before);
});
test("Expectations use artist value and prior revenue and remain fixed after recording starts", () => {
  const { s, a, p } = fixture();
  p.total = 30000;
  const e = G.albumExpectation(s, a, 4000);
  assert.ok(e.target >= 28500);
  a.inspiration = 60;
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  const next = s.albums.at(-1),
    target = next.expectation.target;
  a.fame = 100;
  a.fans = 1000;
  assert.equal(next.expectation.target, target);
});
test("Underperformance applies morale, artist and label penalties only once", () => {
  const { s, a, p } = fixture(21);
  p.expectation.target = 100000;
  p.total = 1000;
  p.age = 12;
  p.lastSalesWeek = s.week;
  const morale = a.morale,
    rep = s.reputation,
    fame = s.fame;
  G.advance(s);
  assert.equal(p.expectation.status, "underperformed");
  assert.ok(a.morale < morale && s.reputation < rep && s.fame < fame);
  const penalized = s.reputation;
  clearEvents(s);
  G.advance(s);
  assert.equal(s.reputation, penalized);
});
test("An extended campaign is assessed after the extended earning window, not at week 12", () => {
  const { s, p } = fixture(22);
  p.age = 11;
  p.salesWeeks = 15;
  G.advance(s);
  assert.equal(p.expectation.assessed, false);
  clearEvents(s);
  for (let i = 0; i < 3; i++) {
    G.advance(s);
    clearEvents(s);
  }
  assert.equal(p.age, 15);
  assert.equal(p.expectation.assessed, false);
  G.advance(s);
  assert.equal(p.expectation.assessed, true);
});
test("Morale affects production ratings; legacy releases are never retroactively punished", () => {
  const { s, a, p } = ready();
  p.production.stage = 0;
  a.morale = 100;
  const high = G.stagePreview(s, p, 0).parts[0].value;
  a.morale = 10;
  assert.ok(G.stagePreview(s, p, 0).parts[0].value < high);
  p.released = true;
  delete p.expectation;
  G.migrate(s);
  assert.equal(p.expectation.status, "legacy");
  assert.equal(p.expectation.assessed, true);
});
test("Tour territory increases booking cost, operating cost and length", () => {
  const f = fixture();
  const quotes = G.TOUR_SCALES.map((r) => G.tourQuote(f.s, { albumId: f.p.id, scale: r.id, mode: "solo" }));
  for (let i = 1; i < 3; i++) {
    assert.ok(quotes[i].upfront > quotes[i - 1].upfront);
    assert.ok(quotes[i].weekly > quotes[i - 1].weekly);
    assert.ok(quotes[i].scale.weeks > quotes[i - 1].scale.weeks);
  }
});
test("Tours require proven popularity and enough booking cash", () => {
  const { s, p } = fixture();
  p.chart.best = null;
  p.gross = 0;
  p.age = 0;
  assert.throws(() => G.startTour(s, { albumId: p.id }), /Tour requires/);
  p.chart.best = 5;
  s.cash = 0;
  assert.throws(() => G.startTour(s, { albumId: p.id }), /Booking/);
});
console.log(
  `${count} room, package, expectation and tour-eligibility tests passed. Daily tour behavior is covered in industry-test.cjs.`,
);
