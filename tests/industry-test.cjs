const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(n, fn) {
  fn();
  console.log("PASS " + n);
  count++;
}
function safeIndex(e) {
  let i = e.options.findIndex(
    (o) => !o.cancelChance && !o.poachChance && !o.endTour && !o.lengthDelta && !o.restDays && !o.tourPause,
  );
  return i < 0 ? 2 : i;
}
function clear(s) {
  let guard = 0;
  while (s.event && !s.finished) {
    if (++guard > 100) throw Error("Event queue did not drain");
    G.choose(s, safeIndex(s.event));
  }
}
function prepared(seed = 1) {
  const s = G.create(seed);
  s.cash = 1000000;
  s.fame = 200;
  s.rank = 4;
  G.sign(s, s.candidates[0].id, 3);
  const a = s.artists[0];
  a.age = "Adult";
  a.talent = 90;
  a.fans = 150;
  a.fame = 70;
  a.energy = 100;
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  const p = s.albums[0];
  while (!p.production.releaseReady) {
    clear(s);
    if (!p.production.cooldown) {
      G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    G.advance(s);
  }
  clear(s);
  G.releaseAlbum(s, p.id, "Industry Test");
  p.launchReview = false;
  a.energy = 100;
  p.chart.best = 5;
  return { s, a, p };
}
function book(f, mode = "solo", scale = "regional", partnerId = null) {
  return G.startTour(f.s, { albumId: f.p.id, mode, scale, partnerId, rivalId: f.s.rivalArtists[0].id });
}
function day(s) {
  clear(s);
  if (s.finished) return;
  G.advanceTourDay(s);
  clear(s);
}
test("Top 300 is exactly 300 ranked entries from a larger rival market", () => {
  const s = G.create(4);
  assert.equal(s.charts.entries.length, 300);
  assert.equal(s.charts.rivals.length, 320);
  assert.equal(new Set(s.charts.entries.map((e) => e.id)).size, 300);
  assert.equal(s.charts.entries[299].rank, 300);
  assert.ok(s.charts.entries.every((e, i, a) => !i || a[i - 1].units >= e.units));
});
test("Release-day provisional debut creates no fake sales, chart weeks or milestone awards", () => {
  const { s, p } = prepared(2);
  assert.ok(s.charts.previewEntries.some((e) => e.id === p.id && e.projected));
  assert.equal(p.total, 0);
  assert.equal(p.chart.weeks, 0);
  assert.equal(p.chart.history.length, 0);
  assert.equal(p.chart.milestones.length, 0);
  G.advance(s);
  assert.equal(s.charts.previewEntries, null);
  assert.equal(p.chart.weeks, 1);
  assert.ok(p.total > 0);
});
test("Weak releases can remain outside Top 300 and strong releases earn each milestone once", () => {
  const f = prepared(3);
  f.p.quality = 1;
  f.p.launchMultiplier = 0.01;
  f.a.fans = 0;
  f.p.chart.best = null;
  for (const r of f.s.charts.rivals) r.baseUnits = 10000;
  G.advance(f.s);
  assert.equal(f.p.chart.rank, null);
  assert.equal(f.p.chart.milestones.length, 0);
  const g = prepared(4);
  for (const r of g.s.charts.rivals) r.baseUnits = 1;
  g.s.week = 8;
  G.advance(g.s);
  assert.equal(g.p.chart.rank, 1);
  assert.deepEqual(g.p.chart.milestones, [300, 100, 40, 20, 10, 5, 1]);
  const n = g.s.notifications.length;
  clear(g.s);
  G.advance(g.s);
  assert.equal(g.s.notifications.length, n);
});
test("Industry wire listings correspond to rival company releases and refresh every four weeks", () => {
  const s = G.create(5),
    before = s.industryListings.length;
  for (let i = 0; i < 3; i++) G.advance(s);
  assert.equal(s.charts.rivals.length, 320);
  assert.equal(s.industryListings.length, before + 20);
  const l = s.industryListings[0];
  assert.ok(s.rivalCompanies.some((c) => c.id === l.companyId));
  assert.ok(s.charts.rivals.some((r) => r.id === l.id && r.title === l.title && r.genre === l.genre));
});
test("Eight CEO scenarios do not repeat within a bag and have materially different effects", () => {
  const f = prepared(6),
    events = Array.from({ length: 8 }, () => G.makeCEOEvent(f.s));
  assert.equal(new Set(events.map((e) => e.scenario)).size, 8);
  assert.ok(events.some((e) => e.options.some((o) => o.distributionFee)));
  assert.ok(events.some((e) => e.options.some((o) => o.staffLead)));
  assert.ok(events.some((e) => e.options.some((o) => o.royaltyIncrease)));
  assert.ok(events.some((e) => e.options.some((o) => o.recruitLead)));
});
test("CEO distribution deals persist fees, boosts and relationships without changing contracts", () => {
  const { s, a, p } = prepared(7);
  let e;
  do {
    e = G.makeCEOEvent(s);
  } while (e.scenario !== 3);
  s.event = e;
  const royalty = a.contract.royalty;
  G.choose(s, 0);
  assert.equal(p.extraDistribution, 0.04);
  assert.equal(p.boosts.at(-1).mult, 1.35);
  assert.equal(s.rivalCompanies.find((c) => c.id === e.company).relationship, 7);
  assert.equal(a.contract.royalty, royalty);
  G.advance(s);
  assert.ok(p.distributionFees > 0);
  assert.equal(p.total, p.gross - p.royalties - p.distributionFees);
});
test("Career XP has ten meaningful levels and new contracts respond to career recognition", () => {
  const s = G.create(8),
    a = s.candidates[0];
  for (const [xp, level] of [
    [0, 1],
    [3, 1],
    [4, 2],
    [10, 3],
    [31, 5],
    [136, 10],
  ]) {
    a.xp = xp;
    assert.equal(G.level(a), level);
  }
  a.xp = 0;
  const low = G.contractQuote(s, a, 3),
    v = G.artistValue(a);
  a.fans = 1000;
  a.fame = 90;
  a.momentum = 90;
  a.career.releases = 12;
  const high = G.contractQuote(s, a, 3);
  assert.ok(high.fee > low.fee && high.wage > low.wage && high.royalty > low.royalty);
  assert.ok(G.artistValue(a) > v);
});
test("New albums show distribution fees while legacy album models remain intact", () => {
  const f = prepared(9),
    copy = JSON.parse(JSON.stringify(f.s));
  copy.albums[0].economyVersion = 4;
  G.advance(f.s);
  G.advance(copy);
  assert.ok(f.p.distributionFees > 0);
  assert.equal(copy.albums[0].distributionFees, 0);
  assert.equal(f.p.total, f.p.gross - f.p.royalties - f.p.distributionFees);
  assert.equal(f.s.financeHistory.at(-1).albumIncome, f.p.lastNetIncome);
});
test("Awards accept one eligible release per genre and reject previous or future operating years", () => {
  const { s, p } = prepared(10);
  G.enterAwards(s, 1, p.genre, p.id);
  const second = JSON.parse(JSON.stringify(p));
  second.id = s.nextId++;
  second.title = "Replacement";
  s.albums.push(second);
  G.enterAwards(s, 1, p.genre, second.id);
  assert.equal(Object.keys(s.awardPrograms[1].entries).length, 1);
  assert.equal(s.awardPrograms[1].entries[p.genre], second.id);
  const wrong = G.GENRES.find((g) => g !== p.genre);
  assert.throws(() => G.enterAwards(s, 1, wrong, p.id), /operating year/);
  s.week = 53;
  s.awardPrograms[2] = { year: 2, entries: {}, results: null };
  assert.throws(() => G.enterAwards(s, 2, p.genre, p.id), /operating year/);
  assert.throws(() => G.enterAwards(s, 1, p.genre, p.id), /this operating year/);
});
test("Annual ceremony resolves once, competes with rivals, and does not softlock first-year results", () => {
  const { s, a, p } = prepared(11);
  p.quality = 100;
  p.launchRatings.forEach((r) => (r.score = 100));
  p.chart.best = 1;
  for (const r of Object.values(s.rivalArchive)) r.quality = 10;
  s.week = 51;
  G.enterAwards(s, 1, p.genre, p.id);
  G.advance(s);
  assert.equal(s.awards, 0);
  clear(s);
  G.advance(s);
  assert.equal(s.week, 53);
  assert.equal(s.awards, 1);
  assert.equal(s.finished, false);
  assert.equal(s.event.type, "awards");
  assert.equal(s.awardPrograms[1].results.find((r) => r.genre === p.genre).winner, p.id);
  assert.equal(a.career.awards, 1);
  G.choose(s, 2);
  assert.equal(s.finished, true);
  const cash = s.cash;
  G.resolveAnnualAwards(s, 1);
  assert.equal(s.awards, 1);
  assert.equal(s.cash, cash);
  G.continueCareer(s);
  assert.ok(s.awardPrograms[2]);
});
test("The first review blocks time and seven tour days settle exactly one label week", () => {
  const f = prepared(12),
    t = book(f),
    week = f.s.week,
    age = f.p.age,
    ledger = f.s.financeHistory.length;
  assert.throws(() => G.advance(f.s), /one day/);
  G.advanceTourDay(f.s);
  assert.equal(t.day, 1);
  assert.equal(f.s.week, week);
  assert.equal(f.p.age, age);
  assert.equal(f.s.event.type, "tourDay");
  assert.throws(() => G.advanceTourDay(f.s), /Resolve/);
  clear(f.s);
  for (let i = 1; i < 7; i++) day(f.s);
  assert.equal(t.day, 7);
  assert.equal(f.s.week, week + 1);
  assert.equal(f.p.age, age + 1);
  assert.equal(f.s.financeHistory.length, ledger + 1);
});
test("Concurrent tours share a decision budget and save the next pending decision", () => {
  const f = prepared(13);
  G.sign(f.s, f.s.candidates[0].id, 3);
  const a = f.s.artists[1];
  a.energy = 100;
  const p = JSON.parse(JSON.stringify(f.p));
  p.id = f.s.nextId++;
  p.artist = a.id;
  p.artistName = a.name;
  p.title = "Second Tour Album";
  p.tourLaunched = false;
  f.s.albums.push(p);
  const t1 = book(f),
    t2 = G.startTour(f.s, { albumId: p.id });
  G.advanceTourDay(f.s);
  assert.equal(t1.day, 1);
  assert.equal(t2.day, 1);
  assert.equal(f.s.eventQueue.filter((e) => e.type === "tourDay").length, 0);
  const clone = G.migrate(JSON.parse(JSON.stringify(f.s)));
  assert.equal(clone.event.type, "tourDay");
  assert.equal(clone.tourCadence.count, 1);
  G.choose(clone, safeIndex(clone.event));
  G.advanceTourDay(clone);
  assert.equal(clone.event.tour, t2.id);
  assert.equal(clone.tourCadence.count, 2);
  assert.ok(G.validRoadSave(clone));
});
test("Daily event pool changes length, quality and cancellation risk rather than merely text", () => {
  const titles = new Set();
  let extension = false,
    shortening = false,
    quality = false,
    risk = false;
  for (let seed = 1; seed <= 120; seed++) {
    const f = prepared(seed);
    book(f);
    G.advanceTourDay(f.s);
    const e = f.s.event;
    titles.add(e.title.replace(/^Day \d+ · /, ""));
    extension ||= e.options.some((o) => o.lengthDelta > 0);
    shortening ||= e.options.some((o) => o.lengthDelta < 0);
    quality ||= e.options.some((o) => o.qualityDelta);
    risk ||= e.options.some((o) => o.cancelChance);
  }
  assert.ok(titles.size >= 8);
  assert.ok(extension && shortening && quality && risk);
});
test("Tour decisions alter actual itinerary and quality, and preserve event costs in net", () => {
  let changed = false;
  for (let seed = 1; seed <= 30 && !changed; seed++) {
    const f = prepared(seed),
      t = book(f);
    G.advanceTourDay(f.s);
    const e = f.s.event,
      index = e.options.findIndex((o) => o.lengthDelta > 0);
    if (index < 0) continue;
    const old = t.plannedDays,
      q = t.quality,
      o = e.options[index];
    G.choose(f.s, index);
    assert.equal(t.plannedDays, Math.min(t.baseDays * 2, old + o.lengthDelta));
    assert.equal(t.quality, Math.max(0, Math.min(100, q + (o.qualityDelta || 0))));
    assert.equal(t.net, t.revenue - t.costs);
    changed = true;
  }
  assert.ok(changed);
});
test("Venue commissions and daily event spending are included in tour cash accounting", () => {
  let checked = false;
  for (let seed = 1; seed <= 10 && !checked; seed++) {
    const f = prepared(seed),
      t = book(f);
    const afterBooking = f.s.cash;
    G.advanceTourDay(f.s);
    const revenue = t.revenue,
      base = Math.ceil(t.weekly / 7);
    assert.equal(t.costs, t.upfront + base + Math.round(revenue * 0.15));
    assert.equal(f.s.cash, afterBooking + revenue - base - Math.round(revenue * 0.15));
    const o = f.s.event.options.find((o) => o.cost && !o.cancelChance);
    if (!o) continue;
    const costs = t.costs,
      cash = f.s.cash;
    G.choose(f.s, f.s.event.options.indexOf(o));
    assert.equal(t.costs, costs + o.cost);
    assert.equal(f.s.cash, cash - o.cost);
    assert.equal(t.net, t.revenue - t.costs);
    checked = true;
  }
  assert.ok(checked);
});
test("Solo, labelmate and rival daily tradeoffs retain reservation and energy rules", () => {
  const f = prepared(14);
  G.sign(f.s, f.s.candidates[0].id, 3);
  const partner = f.s.artists[1];
  partner.energy = 100;
  const duet = JSON.parse(JSON.stringify(f.s)),
    rival = JSON.parse(JSON.stringify(f.s));
  const soloTour = book(f),
    duetTour = G.startTour(duet, { albumId: f.p.id, mode: "labelmate", partnerId: partner.id }),
    rivalTour = G.startTour(rival, { albumId: f.p.id, mode: "rival", rivalId: rival.rivalArtists[0].id });
  G.advanceTourDay(f.s);
  G.advanceTourDay(duet);
  G.advanceTourDay(rival);
  assert.ok(duetTour.revenue > soloTour.revenue && duetTour.revenue > rivalTour.revenue);
  assert.ok(
    f.s.artists[0].energy < rival.artists[0].energy && rival.artists[0].energy < duet.artists[0].energy,
  );
  assert.ok(G.busy(duet, partner.id));
  clear(duet);
  assert.throws(
    () =>
      G.record(duet, { artistId: partner.id, boothId: 0, genre: partner.genre, audience: partner.audience }),
    /touring/,
  );
});
test("Cancellation stops future costs and a completed daily tour releases its artist", () => {
  let cancelled = false;
  for (let seed = 1; seed <= 30 && !cancelled; seed++) {
    const f = prepared(seed),
      t = book(f);
    f.a.energy = 20;
    G.advanceTourDay(f.s);
    const i = f.s.event.options.findIndex((o) => o.cancelChance);
    if (i < 0) continue;
    G.choose(f.s, i);
    if (t.status === "ended early") {
      const cost = t.costs;
      clear(f.s);
      G.advanceTourDay(f.s);
      assert.equal(t.costs, cost);
      cancelled = true;
    }
  }
  assert.ok(cancelled);
  const f = prepared(15),
    t = book(f);
  let guard = 0;
  while (t.status === "active" && guard++ < 100) day(f.s);
  assert.equal(t.status, "completed");
  assert.equal(t.day, t.plannedDays);
  assert.ok(!G.busy(f.s, f.a.id));
  assert.equal(t.net, t.revenue - t.costs);
});
test("Rival daily offers retain real recruitment and poaching outcomes", () => {
  let recruited = false,
    poached = false;
  for (let seed = 1; seed <= 20 && (!recruited || !poached); seed++) {
    for (const choice of [0, 2]) {
      const f = prepared(seed),
        t = book(f, "rival", "national");
      for (let i = 0; i < 20; i++) {
        clear(f.s);
        G.advanceTourDay(f.s);
        if (f.s.event?.options.some((o) => o.recruitRival)) break;
      }
      assert.ok(f.s.event?.options.some((o) => o.recruitRival));
      G.choose(f.s, choice);
      if (f.s.candidates.some((a) => a.sourceRivalId === t.rival.id)) recruited = true;
      if (!f.s.artists.some((a) => a.id === t.artist)) {
        poached = true;
        assert.equal(t.status, "ended early");
      }
    }
  }
  assert.ok(recruited && poached);
});
test("Daily tours can cross the annual ceremony and continue in career mode", () => {
  const f = prepared(16);
  f.s.week = 52;
  f.p.releaseWeek = 52;
  const t = book(f);
  for (let i = 0; i < 7; i++) day(f.s);
  assert.equal(f.s.week, 53);
  assert.equal(f.s.finished, true);
  G.continueCareer(f.s);
  let guard = 0;
  while (t.status === "active" && guard++ < 100) day(f.s);
  assert.equal(t.status, "completed");
  assert.ok(f.s.week > 53);
});
test("Free daily choices remain usable during a temporary negative cash balance", () => {
  const f = prepared(17);
  book(f);
  G.advanceTourDay(f.s);
  f.s.cash = -1;
  const i = f.s.event.options.findIndex((o) => !o.cost);
  assert.ok(i >= 0);
  assert.equal(G.eventOptionAvailable(f.s, f.s.event.options[i]), true);
  G.choose(f.s, i);
});
test("Royalty promises survive renewal and legacy rival recruits gain career data", () => {
  const s = G.create(77);
  s.cash = 1000000;
  G.sign(s, s.candidates[0].id, 1);
  const a = s.artists[0];
  a.royaltyFloor = 0.27;
  a.contract.remaining = 0;
  assert.ok(G.contractQuote(s, a, 5).royalty >= 0.27);
  G.renew(s, a.id, 5);
  assert.ok(a.contract.royalty >= 0.27);
  const r = s.rivalArtists[0];
  delete r.career;
  delete r.momentum;
  G.migrate(s);
  assert.equal(r.momentum, 25);
  assert.equal(r.career.releases, 0);
  s.candidates.push({ ...r, id: s.nextId++ });
  G.sign(s, s.candidates.at(-1).id, 3);
  assert.ok(s.artists.at(-1).career);
});
console.log(`${count} Top 300, CEO, career, annual award and daily tour tests passed.`);
