const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function resolve(s) {
  while (s.event) G.choose(s, 2);
  for (const p of s.albums) {
    if (p.launchReview) p.launchReview = false;
    if (p.released) continue;
    const d = p.production;
    if (d.cooldown) continue;
    if (d.releaseReady) {
      G.releaseAlbum(s, p.id, p.title);
      p.launchReview = false;
    } else {
      if (!d.review) {
        const choice = [0, 1, 2].toSorted(
          (a, b) => G.stagePreview(s, p, b).expected - G.stagePreview(s, p, a).expected,
        )[0];
        G.decideStage(s, p.id, choice);
      }
      G.continueProduction(s, p.id);
    }
  }
}
function step(s) {
  resolve(s);
  G.advance(s);
}
function ready(seed = 24, term = 3) {
  const s = G.migrate(G.create(seed));
  G.sign(s, s.candidates[0].id, term);
  const a = s.artists[0];
  a.talent = 90;
  a.potential = 100;
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, title: "Test Campaign" });
  const p = s.albums[0];
  while (!p.production.releaseReady) step(s);
  while (s.event) G.choose(s, 2);
  return { s, a, p };
}
function released(seed, term) {
  const fixture = ready(seed, term);
  G.releaseAlbum(fixture.s, fixture.p.id, fixture.p.title);
  fixture.p.launchReview = false;
  return fixture;
}
test("Paid scouting charges once, replaces the list, and improves statistical outcomes", () => {
  let local = 0,
    national = 0,
    localFans = 0,
    nationalFans = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = G.create(seed),
      copy = JSON.parse(JSON.stringify(s)),
      cash = s.cash,
      ids = s.candidates.map((a) => a.id);
    G.paidScout(s, 0);
    G.paidScout(copy, 2);
    assert.equal(s.cash, cash - 500);
    assert.equal(copy.cash, cash - 6000);
    assert.equal(s.candidates.length, 3);
    assert.equal(copy.candidates.length, 5);
    assert.ok(s.candidates.every((a) => !ids.includes(a.id)));
    local += s.candidates.reduce((n, a) => n + a.talent, 0) / 3;
    national += copy.candidates.reduce((n, a) => n + a.talent, 0) / 5;
    localFans += s.candidates.reduce((n, a) => n + a.fans, 0) / 3;
    nationalFans += copy.candidates.reduce((n, a) => n + a.fans, 0) / 5;
  }
  assert.ok(national / 60 > local / 60 + 15);
  assert.ok(nationalFans > localFans * 2);
});
test("Failed scouting and recruitment preserve cash, candidates and RNG state", () => {
  const s = G.create(4);
  s.cash = 0;
  const before = JSON.stringify(s);
  assert.throws(() => G.paidScout(s, 2), /cash/);
  assert.throws(() => G.recruitmentDrive(s, "Producer", 2), /cash/);
  assert.equal(JSON.stringify(s), before);
});
test("Recruitment refreshes one role and a chosen candidate controls expertise and salary", () => {
  const s = G.create(8),
    oldProducer = s.staffCandidates.Producer.map((c) => c.id),
    marketing = JSON.stringify(s.staffCandidates.Marketing);
  G.recruitmentDrive(s, "Producer", 2);
  assert.equal(JSON.stringify(s.staffCandidates.Marketing), marketing);
  assert.ok(s.staffCandidates.Producer.every((c) => !oldProducer.includes(c.id) && c.skill >= 68));
  const c = s.staffCandidates.Producer[1],
    cash = s.cash;
  G.hire(s, "Producer", c.id);
  assert.equal(s.cash, cash - c.cost);
  assert.equal(s.employees.Producer.id, c.id);
  assert.equal(G.staffBonus(s, "Producer"), Math.round(6 + c.skill / 10));
  assert.equal(G.upkeep(s), 100 + c.wage);
  const replacement = s.staffCandidates.Producer[0],
    before = s.cash;
  G.hire(s, "Producer", replacement.id);
  assert.equal(before - s.cash, replacement.cost + c.wage * 2);
  assert.equal(s.staff.filter((r) => r === "Producer").length, 1);
  G.fire(s, "Producer");
  assert.equal(G.upkeep(s), 100);
});
test("Contract price and royalties vary by term; stat growth raises market value", () => {
  const s = G.create(2),
    a = s.candidates[0],
    q1 = G.contractQuote(s, a, 1),
    q3 = G.contractQuote(s, a, 3),
    q5 = G.contractQuote(s, a, 5);
  assert.ok(q1.fee < q3.fee && q3.fee < q5.fee);
  assert.ok(q1.royalty > q3.royalty && q3.royalty > q5.royalty);
  const value = G.artistValue(a);
  a.talent += 5;
  a.fans += 30;
  a.fame += 20;
  a.reputation += 5;
  assert.ok(G.artistValue(a) > value);
});
test("A one-album contract expires exactly at release, then requires paid renewal", () => {
  const { s, a, p } = ready(11, 1),
    remaining = a.contract.remaining;
  G.releaseAlbum(s, p.id, "Contract Finale");
  assert.equal(remaining, 1);
  assert.equal(a.contract.remaining, 0);
  assert.equal(G.upkeep(s), 100);
  p.launchReview = false;
  assert.throws(
    () => G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience }),
    /Renew/,
  );
  const q = G.contractQuote(s, a, 5),
    cash = s.cash;
  G.renew(s, a.id, 5);
  assert.equal(a.contract.remaining, 5);
  assert.equal(s.cash, cash - q.fee);
  assert.equal(a.wage, q.wage);
  assert.throws(() => G.renew(s, a.id, 1), /commitment/);
});
test("Weekly income deducts contract royalties and continues after the artist leaves", () => {
  const { s, a, p } = released(12, 1);
  G.advance(s);
  assert.ok(p.gross > 0);
  assert.equal(p.royalties, Math.round(p.gross * 0.18));
  assert.equal(p.total, p.gross - p.royalties - p.distributionFees);
  while (s.event) G.choose(s, 2);
  const rep = s.reputation;
  G.releaseArtist(s, a.id);
  assert.equal(s.reputation, rep);
  const total = p.total;
  G.advance(s);
  assert.ok(p.total > total);
  assert.equal(p.total, p.gross - p.royalties - p.distributionFees);
});
test("Development has a three-week cooldown, rising costs and a real growth ceiling", () => {
  const s = G.create(7);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0],
    t = G.trainingInfo(s, a),
    beforeTalent = a.talent;
  G.train(s, a.id);
  assert.equal(a.talent, beforeTalent + t.gain);
  assert.ok(G.trainingInfo(s, a).cost > t.cost);
  const after = JSON.stringify(s);
  assert.throws(() => G.train(s, a.id), /Development available/);
  assert.equal(JSON.stringify(s), after);
  for (let i = 0; i < 3; i++) step(s);
  while (s.event) G.choose(s, 2);
  assert.equal(G.trainingInfo(s, a).wait, 0);
  a.talent = 100;
  a.potential = 100;
  assert.equal(G.trainingInfo(s, a).gain, 0);
  assert.throws(() => G.train(s, a.id), /ceiling/);
});
test("Weekly charts rank player sales, pay milestones once, and retain rivals across saves", () => {
  const { s, p } = released(13);
  for (const r of s.charts.rivals) r.baseUnits = 1;
  s.week = 8;
  G.advance(s);
  assert.equal(s.charts.entries[0].id, p.id);
  assert.equal(p.chart.best, 1);
  assert.deepEqual(p.chart.milestones, [300, 100, 40, 20, 10, 5, 1]);
  assert.ok(s.notifications[0].title.includes("NUMBER ONE"));
  const n = s.notifications[0];
  G.acknowledgeMilestone(s, n.id);
  let copy = JSON.parse(JSON.stringify(s));
  G.migrate(copy);
  while (copy.event) G.choose(copy, 2);
  G.advance(copy);
  assert.equal(copy.notifications.length, 0);
  assert.equal(copy.charts.rivals.length, 320);
  assert.equal(copy.albums[0].chart.milestones.length, 7);
  assert.ok(G.validManagementSave(copy));
});
test("Campaign quarter checkpoints produce interactive sales and fame effects", () => {
  const { s, a, p } = released(14);
  p.age = 2;
  G.advance(s);
  assert.equal(s.event.album, p.id);
  assert.match(s.event.title, /quarter 1/);
  const fame = a.fame,
    rep = s.reputation;
  G.choose(s, 0);
  assert.equal(a.fame, fame + 5);
  assert.equal(s.reputation, rep + 2);
  assert.equal(p.boosts[0].mult, 1.3);
  assert.equal(p.boosts[0].start, s.week + 1);
  assert.ok(p.eventsSeen.includes(3));
});
test("Calendar-quarter events and campaign events queue rather than overwrite each other", () => {
  const { s, p } = released(15);
  s.week = 12;
  p.age = 2;
  G.advance(s);
  assert.equal(s.week, 13);
  assert.equal(s.event.album, p.id);
  assert.match(s.event.title, /quarter 1/);
  assert.ok(s.eventQueue.some((e) => e.title === "Quarterly industry spotlight"));
  G.choose(s, 2);
  assert.equal(s.event.title, "Quarterly industry spotlight");
  G.choose(s, 2);
  assert.equal(s.event, null);
});
test("Album extension adds earning weeks, costs cash, and caps at 18", () => {
  const { s, p } = released(16);
  p.age = 8;
  G.advance(s);
  while (s.event && !s.event.title.includes("quarter 3")) G.choose(s, 2);
  const cash = s.cash;
  G.choose(s, 0);
  assert.equal(p.salesWeeks, 15);
  assert.equal(cash - s.cash, 2000);
  while (s.event) G.choose(s, 2);
  p.age = 11;
  G.advance(s);
  while (s.event && !s.event.title.includes("quarter 4")) G.choose(s, 2);
  G.choose(s, 0);
  assert.equal(p.salesWeeks, 18);
  while (s.event) G.choose(s, 2);
  const total = p.total;
  p.age = 12;
  G.advance(s);
  assert.ok(p.total > total);
});
test("An extension at the cap is rejected without charging or consuming the event", () => {
  const { s, p } = released(17);
  p.age = 11;
  p.salesWeeks = 18;
  G.advance(s);
  while (s.event && !s.event.title.includes("quarter 4")) G.choose(s, 2);
  const before = JSON.stringify(s);
  assert.equal(G.eventOptionAvailable(s, s.event.options[0]), false);
  assert.throws(() => G.choose(s, 0), /limit/);
  assert.equal(JSON.stringify(s), before);
  G.choose(s, 2);
});
test("Legacy migration preserves existing cash, roster stats and catalog totals", () => {
  const s = G.create(6);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  delete a.contract;
  delete a.potential;
  delete s.staffCandidates;
  delete s.employees;
  delete s.charts;
  delete s.eventQueue;
  delete s.notifications;
  const cash = s.cash,
    talent = a.talent;
  G.migrate(s);
  assert.equal(s.cash, cash);
  assert.equal(a.talent, talent);
  assert.equal(a.contract.remaining, 3);
  assert.ok(G.validManagementSave(s));
});
console.log(`${count} management tests passed.`);
