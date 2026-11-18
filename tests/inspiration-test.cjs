const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
function label(seed = 1) {
  const s = G.create(seed, { ceo: false });
  s.cash = 1000000;
  G.sign(s, s.candidates[0].id, 5);
  s.artists[0].age = "Adult";
  return s;
}
function clear(s) {
  while (s.event)
    G.choose(
      s,
      s.event.options.findIndex((o) => !o.cost && !o.cancelChance && !o.endTour && !o.poachChance),
    );
}
function begin(s) {
  const a = s.artists[0];
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  return s.albums.at(-1);
}
function finish(s, p) {
  while (!p.production.releaseReady) {
    clear(s);
    if (!p.production.review && !p.production.cooldown) {
      let best = 0;
      for (let i = 1; i < 3; i++)
        if (G.stagePreview(s, p, i).expected > G.stagePreview(s, p, best).expected) best = i;
      G.decideStage(s, p.id, best);
    }
    if (p.production.review) G.continueProduction(s, p.id);
    G.advance(s);
  }
  clear(s);
  G.releaseAlbum(s, p.id, "Inspiration Test");
  p.launchReview = false;
  return p;
}
test("Inspiration minimum rejects album creation without cash or RNG mutation", () => {
  const s = label(),
    a = s.artists[0];
  a.inspiration = 24;
  const before = JSON.stringify(s);
  assert.throws(() => begin(s), /25 inspiration/);
  assert.equal(JSON.stringify(s), before);
  a.inspiration = 25;
  assert.equal(begin(s).inspirationAtStart, 25);
});
test("Thresholds increase the same sessions and improve actual album outcome frequencies", () => {
  const wins = { 25: 0, 50: 0, 75: 0, 90: 0 },
    totals = { 25: 0, 50: 0, 75: 0, 90: 0 };
  for (let seed = 1; seed <= 80; seed++) {
    let previous = -1;
    for (const v of [25, 50, 75, 90]) {
      const s = label(seed);
      s.artists[0].talent = 75;
      s.artists[0].inspiration = v;
      const p = finish(s, begin(s));
      assert.ok(p.quality >= previous);
      previous = p.quality;
      totals[v] += p.quality;
      if (p.quality >= 80) wins[v]++;
    }
  }
  assert.ok(totals[90] > totals[75] && totals[75] > totals[50] && totals[50] > totals[25]);
  assert.ok(wins[90] > wins[25]);
  assert.ok(wins[25] < 80);
});
test("Recording locks inspiration across save reload and release resets it exactly to zero", () => {
  let s = label(),
    a = s.artists[0];
  a.inspiration = 90;
  let p = begin(s);
  const preview = G.stagePreview(s, p, 0).expected;
  a.inspiration = 25;
  assert.equal(G.stagePreview(s, p, 0).expected, preview);
  s = G.migrate(JSON.parse(JSON.stringify(s)));
  a = s.artists[0];
  p = s.albums[0];
  assert.equal(p.inspirationAtStart, 90);
  finish(s, p);
  assert.equal(a.inspiration, 0);
  G.migrate(s);
  assert.equal(a.inspiration, 0);
  assert.throws(() => begin(s), /25 inspiration/);
});
test("Recovery uses weeks, stops during recording, and caps at 100", () => {
  const s = label(),
    a = s.artists[0];
  a.inspiration = 25;
  const p = begin(s);
  G.decideStage(s, p.id, 0);
  G.continueProduction(s, p.id);
  G.advance(s);
  assert.equal(a.inspiration, 25);
  finish(s, p);
  a.inspiration = 95;
  G.advance(s);
  assert.equal(a.inspiration, 100);
  a.inspiration = 0;
  for (let i = 0; i < 3; i++) {
    clear(s);
    G.advance(s);
  }
  assert.equal(a.inspiration, 30);
  assert.equal(G.inspirationInfo(a).canRecord, true);
});
test("Tour inspiration recovers once per seven resolved days rather than each day", () => {
  const s = label(),
    a = s.artists[0],
    p = finish(s, begin(s));
  p.gross = 20000;
  a.energy = 100;
  G.startTour(s, { albumId: p.id, scale: "regional", mode: "solo" });
  for (let day = 0; day < 7; day++) {
    G.advanceTourDay(s);
    clear(s);
    assert.equal(a.inspiration, day < 6 ? 0 : 5);
  }
  assert.equal(G.inspirationInfo(a).canRecord, false);
});
test("Migration preserves legacy project ratings and existing inspiration across repeated loads", () => {
  const s = label(),
    p = begin(s);
  delete s.artists[0].inspiration;
  delete p.inspirationAtStart;
  G.migrate(s);
  assert.equal(s.artists[0].inspiration, 60);
  assert.equal(G.stagePreview(s, p, 0).parts.length, 5);
  G.decideStage(s, p.id, 0);
  assert.equal(p.production.results[0].parts.length, 6);
  s.artists[0].inspiration = 0;
  G.migrate(s);
  assert.equal(s.artists[0].inspiration, 0);
});
console.log(`${count} inspiration lifecycle and outcome tests passed.`);
