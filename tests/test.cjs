const assert = require("node:assert/strict");
const G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function resolveProduction(s) {
  for (const p of s.albums) {
    if (p.launchReview) {
      p.launchReview = false;
      continue;
    }
    if (p.released || !p.production) continue;
    let d = p.production;
    if (d.cooldown) continue;
    if (d.releaseReady) {
      G.releaseAlbum(s, p.id, p.title);
      p.launchReview = false;
      continue;
    }
    if (!d.review) G.decideStage(s, p.id, 1);
    G.continueProduction(s, p.id);
  }
}
const next = (s) => {
  while (s.event) G.choose(s, 2);
  if (s.finished) return;
  resolveProduction(s);
  G.advance(s);
};
test("Seeded candidate generation is reproducible", () => assert.deepEqual(G.create(42), G.create(42)));
test("Roster capacity is enforced and expands with label rank, not fame alone", () => {
  let s = G.create(4);
  G.sign(s, s.candidates[0].id);
  G.sign(s, s.candidates[0].id);
  assert.throws(() => G.sign(s, s.candidates[0].id), /Roster full/);
  s.fame = 30;
  assert.throws(() => G.sign(s, s.candidates[0].id), /Roster full/);
  s.rank = 2;
  G.sign(s, s.candidates[0].id);
  assert.equal(s.artists.length, 3);
  s.rank = 4;
  assert.equal(G.slots(s), 6);
});
test("Insufficient funds cannot mutate a signing", () => {
  let s = G.create(1);
  s.cash = 0;
  let before = JSON.stringify(s);
  assert.throws(() => G.sign(s, s.candidates[0].id), /cash/);
  assert.equal(JSON.stringify(s), before);
});
test("Album and booth reservations, production, revenue and hit legacy", () => {
  let s = G.create(1);
  G.sign(s, s.candidates[0].id);
  G.sign(s, s.candidates[0].id);
  let a = s.artists[0];
  a.talent = 100;
  a.genre = "Country";
  a.audience = "Adult";
  G.record(s, {
    artistId: a.id,
    boothId: 0,
    genre: "Country",
    audience: "Adult",
    budget: 8000,
    title: "First Press",
  });
  assert.throws(
    () => G.record(s, { artistId: s.artists[1].id, boothId: 0, genre: "Pop", audience: "Adult" }),
    /occupied/,
  );
  while (!s.albums[0].released) next(s);
  assert.equal(s.albums[0].released, true);
  assert.ok(s.albums[0].total > 0);
  assert.equal(s.booths[0].hits, 1);
  assert.equal(s.booths[0].prestige, 12);
});
test("Youth artists receive a six-week production schedule", () => {
  let s = G.create(3);
  G.sign(s, s.candidates[0].id);
  s.artists[0].age = "Youth";
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Youth" });
  assert.equal(s.albums[0].duration, 6);
});
test("Events pause actions; choices schedule persistent consequences", () => {
  let s = G.create(8);
  G.sign(s, s.candidates[0].id);
  while (s.week < 8) next(s);
  assert.ok(s.event);
  assert.throws(() => G.advance(s), /Resolve/);
  G.choose(s, 1);
  assert.equal(s.event, null);
  s.event = {
    artist: s.artists[0].id,
    title: "Delayed partnership",
    options: [
      { label: "Agree", delay: { after: 3, fans: 4, text: "The partnership builds lasting connections." } },
    ],
  };
  G.choose(s, 0);
  assert.equal(s.effects.length, 1);
  let copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(s, copy);
  while (s.week < 11) next(s);
  assert.equal(s.effects.length, 0);
  assert.ok(s.news.some((x) => x.includes("lasting connections")));
});
test("PR staff mitigates immediate trust damage", () => {
  let s = G.create(7);
  G.sign(s, s.candidates[0].id);
  G.hire(s, "Public Relations");
  s.event = { artist: s.artists[0].id, title: "Test", options: [{ label: "Choice", trust: -10 }] };
  let before = s.artists[0].trust;
  G.choose(s, 0);
  assert.equal(
    before - s.artists[0].trust,
    -Math.ceil(-10 * (1 - G.staffSkill(s, "Public Relations") * 0.005)),
  );
});
test("Released catalog survives a contract ending", () => {
  let s = G.create(9);
  G.sign(s, s.candidates[0].id);
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
  while (!s.albums[0].released) next(s);
  while (s.event) G.choose(s, 2);
  G.releaseArtist(s, s.artists[0].id);
  let n = s.albums[0].total;
  next(s);
  assert.ok(s.albums[0].total > n);
});
test("Awards are not automatically granted each quarter", () => {
  let s = G.create(12);
  s.albums.push({
    id: 99,
    artist: 99,
    title: "Test",
    released: true,
    releaseWeek: 3,
    quality: 90,
    age: 12,
    total: 100,
    launchFans: 0,
    launchTrust: 60,
    launchAttention: 0,
  });
  while (s.week < 13) next(s);
  assert.equal(s.awards, 0);
  while (s.week < 26) next(s);
  assert.equal(s.awards, 0);
});
test("Negative cash past the grace period ends the game and prevents further actions", () => {
  let s = G.create(5);
  s.cash = 0;
  s.debtWeeks = G.DEBT.graceWeeks;
  G.advance(s);
  assert.ok(s.finished);
  assert.throws(() => G.advance(s), /ended/);
});
function play(seed) {
  let s = G.create(seed);
  G.sign(s, s.candidates.toSorted((a, b) => b.talent - a.talent)[0].id);
  G.hire(s, "Producer");
  // Plays the first operating year; the campaign continues after it, so the sample stops at week 53.
  while (!s.finished && s.week < 53) {
    while (s.event) G.choose(s, 2);
    if (s.finished) break;
    let a = s.artists[0];
    if (!a.contract.remaining && s.cash > G.contractQuote(s, a, 3).fee + 5000) G.renew(s, a.id, 3);
    if (
      G.inspirationInfo(a).canRecord &&
      a.contract.remaining &&
      !G.busy(s, a.id) &&
      a.energy >= 35 &&
      s.cash > 5500
    )
      G.record(s, {
        artistId: a.id,
        boothId: 0,
        genre: a.genre,
        audience: a.audience,
        budget: 4000,
        title: "Season " + s.week,
      });
    next(s);
    assert.ok(Number.isFinite(s.cash));
  }
  return s;
}
test("Fifty seeded first years either fold or carry on into year two", () => {
  let wins = 0,
    survived = 0;
  for (let i = 1; i <= 50; i++) {
    let s = play(i);
    assert.ok(s.finished ? s.cash < 0 : s.week === 53, "only bankruptcy stops a run in year one");
    if (!s.finished) {
      survived++;
      assert.equal(s.campaign.goals[0].year, 1);
      if (s.campaign.goals[0].status === "met") wins++;
    }
  }
  console.log(`  Conservative strategy: ${survived}/50 survived, ${wins}/50 met the year-one goal.`);
  assert.ok(survived > 0);
});

test("Five stages require decisions, reviews and elapsed weeks before release", () => {
  let s = G.migrate(G.create(41));
  G.sign(s, s.candidates[0].id);
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
  let p = s.albums[0];
  assert.throws(() => G.advance(s), /album decision/);
  assert.throws(() => G.releaseAlbum(s, p.id), /five stages/);
  G.decideStage(s, p.id, 0);
  assert.throws(() => G.decideStage(s, p.id, 0), /not ready/);
  assert.throws(() => G.advance(s), /album decision/);
  G.continueProduction(s, p.id);
  assert.throws(() => G.decideStage(s, p.id, 0), /not ready/);
  next(s);
  assert.equal(p.production.stage, 1);
  while (!p.production.releaseReady) next(s);
  assert.equal(p.released, false);
  assert.equal(p.production.results.length, 5);
  G.releaseAlbum(s, p.id, "New Final Name");
  assert.equal(p.title, "New Final Name");
  assert.equal(p.launchRatings.length, 3);
  assert.equal(p.quality, G.albumQuality(p));
  assert.equal(s.artists[0].xp, 3);
  assert.throws(() => G.releaseAlbum(s, p.id), /not found/);
});
test("Expertise, artist state, studio and current trend change previews", () => {
  let s = G.migrate(G.create(4));
  G.sign(s, s.candidates[0].id);
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
  let p = s.albums[0];
  s.trend = "Pop";
  let before = G.stagePreview(s, p, 1);
  G.hire(s, "Marketing");
  let after = G.stagePreview(s, p, 1);
  assert.equal(after.parts[1].value - before.parts[1].value, G.staffBonus(s, "Marketing"));
  s.trend = "Rock";
  assert.equal(G.stagePreview(s, p, 1).parts[4].value, -3);
  s.artists[0].talent += 10;
  assert.ok(G.stagePreview(s, p, 1).parts[0].value > after.parts[0].value);
});
test("Level-based reshuffles are capped, persisted and never reroll fixed contributions", () => {
  for (const xp of [0, 3, 6, 12]) {
    let s = G.migrate(G.create(31));
    G.sign(s, s.candidates[0].id);
    s.artists[0].xp = xp;
    G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
    let p = s.albums[0];
    while (!p.production.releaseReady) next(s);
    let cap = Math.min(3, G.level(s.artists[0]));
    assert.equal(p.production.rerollLimit, cap);
    for (let i = 0; i < cap; i++) {
      let fixed = JSON.stringify(p.production.results[0].parts.slice(0, -1));
      G.reshuffle(s, p.id, 0);
      assert.equal(JSON.stringify(p.production.results[0].parts.slice(0, -1)), fixed);
      assert.throws(() => G.reshuffle(s, p.id, 0), /No reshuffle/);
      G.acknowledgeReshuffle(s, p.id);
    }
    let copy = JSON.parse(JSON.stringify(s));
    assert.equal(copy.albums[0].production.rerollsUsed, cap);
    assert.throws(() => G.reshuffle(copy, p.id, 0), /No reshuffle/);
    G.releaseAlbum(s, p.id, "Mastered");
    assert.throws(() => G.reshuffle(s, p.id, 0), /not found/);
  }
});
test("Old saves preserve released albums and migrate active albums", () => {
  let s = G.create(2);
  G.sign(s, s.candidates[0].id);
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Rap", audience: "Teen" });
  delete s.albums[0].production;
  s.albums.push({ id: 88, released: true, quality: 70, title: "Old catalog" });
  G.migrate(s);
  assert.equal(s.albums[0].production.stage, 0);
  assert.equal(s.albums[1].quality, 70);
  assert.equal(s.artists[0].xp, 0);
});
test("Release strategy and specialist expertise affect their target ratings", () => {
  function ready() {
    let s = G.migrate(G.create(18));
    G.sign(s, s.candidates[0].id);
    G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
    while (!s.albums[0].production.releaseReady) next(s);
    return s;
  }
  let s = ready(),
    copy = JSON.parse(JSON.stringify(s)),
    p = s.albums[0];
  G.releaseAlbum(s, p.id, "Press", "press");
  G.releaseAlbum(copy, p.id, "Wide", "wide");
  assert.equal(s.albums[0].launchRatings[0].score - copy.albums[0].launchRatings[0].score, 9);
  assert.equal(copy.albums[0].launchRatings[2].score - s.albums[0].launchRatings[2].score, 9);
  let trained = ready();
  trained.staff.push("Marketing");
  G.releaseAlbum(trained, p.id, "Wide", "wide");
  assert.equal(trained.albums[0].launchRatings[2].score - copy.albums[0].launchRatings[2].score, 18);
  assert.ok(copy.albums[0].launchMultiplier > 0);
});
test("Training grants XP and migration credits prior releases only once", () => {
  let s = G.create(18);
  G.sign(s, s.candidates[0].id);
  G.train(s, s.artists[0].id);
  assert.equal(s.artists[0].xp, 1);
  s.albums.push({ released: true, artist: s.artists[0].id });
  G.migrate(s);
  assert.equal(s.artists[0].xp, 2);
  G.migrate(s);
  assert.equal(s.artists[0].xp, 2);
});
console.log(`${count} tests passed.`);
