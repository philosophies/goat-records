// Promotion: hot streaks, lead singles and ad campaigns.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const P = G.systems.find((x) => x.name === "promotion");
const { HEAT, SINGLE, ADS, PROMOTION_CAP } = G;

function label(seed = 11) {
  const s = G.create(seed);
  s.cash = 1000000;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { genre: "Pop", audience: "Adult", talent: 70, energy: 100, inspiration: 80 });
  return { s, a };
}
function clear(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  for (const p of s.albums) p.launchReview = false;
}
function start(s, a, budget = 4000) {
  G.record(s, { artistId: a.id, boothId: 0, genre: "Pop", audience: "Adult", budget, themes: ["Summer"] });
  return s.albums.at(-1);
}
/** Plays production until `until(p)` is true (or the album is released). */
function produce(s, p, until = () => false) {
  for (let i = 0; i < 40 && !p.released; i++) {
    clear(s);
    if (until(p)) return p;
    const d = p.production;
    if (!d.cooldown) {
      if (d.releaseReady) {
        G.releaseAlbum(s, p.id, p.title);
        p.launchReview = false;
        return p;
      }
      if (!d.review) G.decideStage(s, p.id, 0);
      if (until(p)) return p;
      G.continueProduction(s, p.id);
    }
    G.advance(s);
  }
  return p;
}
/** A released album without playing it out, for sales and ad checks. */
function releasedAlbum(s, a, extra = {}) {
  const p = {
    id: s.nextId++,
    title: "Test Pressing",
    artist: a.id,
    artistName: a.name,
    booth: 0,
    genre: "Pop",
    audience: "Adult",
    baseBudget: 4000,
    budget: 4000,
    addOns: [],
    released: true,
    releaseWeek: s.week,
    quality: 60,
    age: 0,
    salesWeeks: 12,
    total: 0,
    remaining: 0,
    boosts: [],
    eventsSeen: [],
    chart: { rank: null, best: null, weeks: 0, milestones: [], history: [] },
    ...extra,
  };
  s.albums.push(p);
  return p;
}
const mult = (s, p) =>
  P.salesMultiplier(
    s,
    p,
    s.artists.find((a) => a.id === p.artist),
  );

test("A hit release puts the artist on fire; a weaker one does not", () => {
  const { s, a } = label();
  P.onRelease(s, releasedAlbum(s, a, { quality: HEAT.hitQuality - 1 }));
  assert.equal(G.isHot(s, a.id), false);
  P.onRelease(s, releasedAlbum(s, a, { quality: HEAT.hitQuality, title: "Big One" }));
  const h = G.heat(s, a.id);
  assert.equal(h.level, HEAT.triggers.hit.levels);
  assert.equal(h.weeksLeft, HEAT.triggers.hit.weeks);
  assert.match(h.reasons[0], /Hit release · Big One/);
});

test("A Top 10 chart week adds heat once per album", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a, { lastSalesWeek: s.week });
  p.chart.rank = 11;
  P.weekly(s);
  assert.equal(G.isHot(s, a.id), false, "#11 is not a Top 10 week");
  p.chart.rank = 7;
  P.weekly(s);
  assert.equal(G.heat(s, a.id).level, 1);
  assert.equal(G.heat(s, a.id).weeksLeft, HEAT.triggers.top10.weeks);
  assert.match(G.heat(s, a.id).reasons[0], /Top 10 chart week · Test Pressing at #7/);
  s.week++;
  p.lastSalesWeek = s.week;
  P.weekly(s);
  assert.equal(G.heat(s, a.id).level, 1, "a second Top 10 week for the same album adds nothing");
});

test("An award win adds two levels at the year end", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a, { quality: 70 });
  s.awardPrograms[1] = {
    year: 1,
    entries: { Pop: p.id },
    results: [
      { genre: "Pop", winner: p.id, entries: [{ id: p.id, owned: true }] },
      { genre: "Rock", winner: "r1", entries: [{ id: "r1", owned: false }] },
    ],
  };
  P.yearEnd(s, 1);
  assert.equal(G.heat(s, a.id).level, HEAT.triggers.award.levels);
  assert.equal(G.heat(s, a.id).weeksLeft, HEAT.triggers.award.weeks);
  assert.match(G.heat(s, a.id).reasons[0], /Award win · Pop Album of the Year/);
  P.yearEnd(s, 1);
  assert.equal(G.heat(s, a.id).level, 2, "the same award counts once");
});

test("Heat fades one week per settlement and ends at zero", () => {
  const { s, a } = label();
  P.onRelease(s, releasedAlbum(s, a, { quality: 90 }));
  P.weekly(s);
  assert.equal(G.heat(s, a.id).weeksLeft, 6, "a streak started this week is not counted down yet");
  for (let w = 5; w >= 1; w--) {
    clear(s);
    G.advance(s);
    assert.equal(G.heat(s, a.id).weeksLeft, w);
  }
  clear(s);
  G.advance(s);
  assert.equal(G.isHot(s, a.id), false);
  assert.deepEqual(G.heat(s, a.id), { level: 0, weeksLeft: 0, reasons: [] });
  assert.ok(s.news.some((n) => n.includes("has cooled off")));
});

test("Heat stacks up to its level and week caps", () => {
  const { s, a } = label();
  for (let i = 0; i < 4; i++) {
    const p = releasedAlbum(s, a, { quality: 80 });
    P.onRelease(s, p);
    s.awardPrograms[i + 1] = {
      results: [{ genre: "Pop", winner: p.id, entries: [{ id: p.id, owned: true }] }],
    };
    P.yearEnd(s, i + 1);
  }
  const h = G.heat(s, a.id);
  assert.equal(h.level, HEAT.maxLevel);
  assert.ok(h.weeksLeft <= HEAT.maxWeeks);
  assert.ok(s.promotion.heat[a.id].reasons.length <= HEAT.reasonLimit);
  s.promotion.heat[a.id].weeksLeft = 10;
  P.onRelease(s, releasedAlbum(s, a, { quality: 80 }));
  assert.equal(G.heat(s, a.id).weeksLeft, 10, "a shorter trigger never cuts the timer");
});

test("On fire adds a labeled row to every production stage and a sales multiplier", () => {
  const { s, a } = label();
  const p = start(s, a);
  const plain = G.stagePreview(s, p, 0);
  assert.ok(!plain.parts.some((c) => c.name.startsWith("On fire")));
  P.onRelease(s, releasedAlbum(s, a, { quality: 90 }));
  P.onRelease(s, releasedAlbum(s, a, { quality: 91 }));
  for (let stage = 0; stage < 5; stage++) {
    p.production.stage = stage;
    const row = G.stagePreview(s, p, 0).parts.find((c) => c.name.startsWith("On fire"));
    assert.equal(row.name, "On fire · 6 weeks left");
    assert.equal(row.value, 2 * HEAT.stagePerLevel);
  }
  const old = releasedAlbum(s, a);
  assert.equal(mult(s, old), 1 + 2 * HEAT.salesPerLevel, "every earning release by a hot artist sells more");
});

test("A lead single waits for Recording, is once only and never after release", () => {
  const { s, a } = label(12);
  const p = start(s, a);
  assert.throws(() => G.releaseSingle(s, p.id), /once Recording is done/);
  produce(s, p, (x) => x.production.stage >= SINGLE.minStage);
  assert.equal(p.production.stage, SINGLE.minStage);
  const cash = s.cash,
    fans = a.fans,
    attention = a.attention,
    q = G.singleQuote(s, p.id);
  assert.equal(q.available, true);
  assert.equal(q.cost, SINGLE.tiers[4000].cost);
  G.releaseSingle(s, p.id);
  assert.equal(s.cash, cash - q.cost);
  assert.equal(a.fans, fans + q.fans);
  assert.equal(a.attention, Math.min(100, attention + q.attention));
  assert.throws(() => G.releaseSingle(s, p.id), /already has its lead single/);
  const other = label(13);
  const p2 = produce(other.s, start(other.s, other.a));
  assert.ok(p2.released);
  assert.throws(() => G.releaseSingle(other.s, p2.id), /before the album/);
});

test("Single cost follows the budget tier", () => {
  for (const budget of [4000, 8000, 12000]) {
    const { s, a } = label(14);
    const p = start(s, a, budget);
    assert.equal(G.singleQuote(s, p.id).cost, SINGLE.tiers[budget].cost);
  }
});

test("A lead single adds Fan response and Market impact rows and a short launch boost", () => {
  const { s, a } = label(15);
  const p = start(s, a);
  produce(s, p, (x) => x.production.stage >= SINGLE.minStage);
  const single = G.releaseSingle(s, p.id);
  produce(s, p);
  assert.ok(p.released);
  const row = (i) => p.launchRatings[i].parts.find((c) => c.name.startsWith("Lead single"));
  assert.equal(row(0), undefined, "critics ignore the single");
  assert.equal(row(1).value, single.fanResponse + single.receptionValue);
  assert.equal(row(2).value, single.market + single.receptionValue);
  assert.match(row(2).name, new RegExp(single.reception));
  s.promotion.heat = {};
  for (let age = 0; age < 6; age++) {
    p.age = age;
    assert.equal(mult(s, p), age < SINGLE.launchWeeks ? SINGLE.launchMult : 1);
  }
});

test("Ad types unlock with label rank", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a);
  for (const ad of ADS) {
    s.rank = ad.rank - 1 || 1;
    if (ad.rank > 1) {
      assert.equal(G.adQuote(s, p.id, ad.id).locked, true);
      assert.throws(() => G.buyAd(s, p.id, ad.id), /Reach label rank/);
    }
    s.rank = ad.rank;
    assert.equal(G.adQuote(s, p.id, ad.id).available, true);
  }
  assert.throws(() => G.buyAd(s, p.id, "blimp"), /Unknown ad type/);
});

test("Ad cost rises with label fame", () => {
  const { s } = label();
  const ad = ADS[0];
  s.fame = 0;
  assert.equal(G.adCost(s, ad), ad.base);
  s.fame = 500;
  assert.ok(G.adCost(s, ad) > ad.base);
  assert.equal(G.adCost(s, ad) % 50, 0);
});

test("One active ad per album, effects on purchase, and the boost starts next week", () => {
  const { s, a } = label();
  s.rank = 6;
  const p = releasedAlbum(s, a),
    q = G.adQuote(s, p.id, "tv"),
    cash = s.cash,
    fans = a.fans;
  const ad = G.buyAd(s, p.id, "tv");
  assert.equal(s.cash, cash - q.cost);
  assert.equal(a.fans, fans + ADS.find((x) => x.id === "tv").fans);
  assert.equal(ad.start, s.week + 1);
  assert.equal(mult(s, p), 1, "no boost before the next settlement");
  assert.throws(() => G.buyAd(s, p.id, "posters"), /already has an ad running/);
  s.week++;
  assert.equal(mult(s, p), ad.mult);
  const other = releasedAlbum(s, a);
  assert.doesNotThrow(() => G.buyAd(s, other.id, "posters"), "a different album can run its own ad");
});

test("Ads expire at the end of their weeks and are limited to the earning run", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a, { age: 10 });
  const ad = G.buyAd(s, p.id, "posters");
  assert.equal(ad.until - ad.start + 1, 2, "clipped to the two earning weeks left");
  s.week = ad.until;
  assert.ok(G.activeAd(s, p.id));
  s.week = ad.until + 1;
  assert.equal(G.activeAd(s, p.id), null);
  assert.equal(mult(s, p), 1);
  P.weekly(s);
  assert.equal(ad.ended, true);
  assert.ok(s.news.some((n) => n.includes("has finished")));
  p.age = 12;
  assert.throws(() => G.buyAd(s, p.id, "posters"), /earning run is over/);
  const unreleased = start(s, a);
  assert.throws(() => G.buyAd(s, unreleased.id, "posters"), /released albums/);
});

test("Heat, single and ad stack to the promotion cap", () => {
  const { s, a } = label();
  s.rank = 6;
  const p = releasedAlbum(s, a);
  s.promotion.singles[p.id] = {
    albumId: p.id,
    market: 4,
    fanResponse: 3,
    reception: "Steady",
    receptionValue: 0,
  };
  s.promotion.heat[a.id] = { level: 3, weeksLeft: 5, reasons: [], lastWeek: s.week };
  G.buyAd(s, p.id, "global");
  s.week++;
  const m = G.promotionParts(s, p, a);
  assert.equal(m.parts.length, 3);
  assert.ok(m.raw > PROMOTION_CAP);
  assert.equal(m.capped, true);
  assert.equal(mult(s, p), PROMOTION_CAP);
});

test("Promotion actions are refused during events and after the season ends", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a),
    q = start(s, a);
  q.production.stage = 3;
  s.event = { title: "x", body: "y", options: [] };
  assert.throws(() => G.buyAd(s, p.id, "posters"), /Resolve the industry event/);
  assert.throws(() => G.releaseSingle(s, q.id), /Resolve the industry event/);
  s.event = null;
  s.finished = true;
  assert.throws(() => G.buyAd(s, p.id, "posters"), /season has ended/);
  assert.throws(() => G.releaseSingle(s, q.id), /season has ended/);
});

test("Not enough cash is refused without charging", () => {
  const { s, a } = label();
  const p = releasedAlbum(s, a);
  s.cash = 100;
  assert.throws(() => G.buyAd(s, p.id, "posters"), /Not enough cash/);
  assert.equal(s.cash, 100);
  assert.equal(s.promotion.ads.length, 0);
});

test("A v0.9 save loads with empty promotion data and old albums are unaffected", () => {
  const { s, a } = label(16);
  const p = produce(s, start(s, a));
  const ratings = JSON.stringify(p.launchRatings);
  const old = JSON.parse(JSON.stringify(s));
  delete old.promotion;
  delete old.streams;
  assert.equal(G.validSystemsSave(old), true);
  G.migrate(old);
  assert.deepEqual(old.promotion, { heat: {}, ads: [], singles: {}, triggered: [] });
  const q = old.albums.find((x) => x.id === p.id);
  assert.equal(JSON.stringify(q.launchRatings), ratings);
  assert.equal(G.leadSingle(old, q.id), null);
  assert.equal(mult(old, q), 1);
  clear(old);
  assert.doesNotThrow(() => G.advance(old));
  G.migrate(old);
  assert.equal(old.promotion.ads.length, 0, "a second load keeps existing data");
});

test("Malformed promotion data is rejected", () => {
  const { s, a } = label();
  const good = JSON.parse(JSON.stringify(s));
  assert.equal(G.validSystemsSave(good), true);
  const bad = [
    (c) => (c.promotion = []),
    (c) => (c.promotion.heat = { [a.id]: { level: 9, weeksLeft: 2, reasons: [] } }),
    (c) => (c.promotion.heat = { [a.id]: { level: 1, weeksLeft: 99, reasons: [] } }),
    (c) =>
      (c.promotion.heat = { [a.id]: { level: 1, weeksLeft: 2, reasons: [{ kind: "luck", text: "x" }] } }),
    (c) => (c.promotion.ads = [{ adId: "blimp", albumId: 1, start: 2, until: 3, mult: 1.1, cost: 1 }]),
    (c) => (c.promotion.ads = [{ adId: "posters", albumId: 1, start: 2, until: 3, mult: 9, cost: 1 }]),
    (c) => (c.promotion.ads = {}),
    (c) =>
      (c.promotion.singles = {
        5: { albumId: 6, market: 1, fanResponse: 1, reception: "x", receptionValue: 0 },
      }),
    (c) =>
      (c.promotion.singles = {
        5: { albumId: 5, market: "a", fanResponse: 1, reception: "x", receptionValue: 0 },
      }),
    (c) => (c.promotion.triggered = [1]),
  ];
  for (const [i, f] of bad.entries()) {
    const c = JSON.parse(JSON.stringify(s));
    f(c);
    assert.equal(G.validSystemsSave(c), false, "case " + i);
  }
});

test("Promotion never moves the core random seed", () => {
  const { s, a } = label(17);
  const p = start(s, a);
  produce(s, p, (x) => x.production.stage >= SINGLE.minStage);
  const seed = s.seed;
  G.releaseSingle(s, p.id);
  const r = releasedAlbum(s, a);
  G.buyAd(s, r.id, "posters");
  P.onRelease(s, releasedAlbum(s, a, { quality: 90 }));
  G.heat(s, a.id);
  G.adQuote(s, r.id, "posters");
  P.weekly(s);
  assert.equal(s.seed, seed);
  assert.ok(Number.isInteger(s.streams["promotion.single"]));
});

test("Released artists lose their streak", () => {
  const { s, a } = label();
  P.onRelease(s, releasedAlbum(s, a, { quality: 90 }));
  s.artists = [];
  s.week++;
  P.weekly(s);
  assert.deepEqual(s.promotion.heat, {});
});

console.log(`${count} promotion checks passed.`);
