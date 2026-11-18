// Long careers stay small: old albums, rival archives and award rows are trimmed without losing scores.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function releasedAlbum() {
  const s = G.create(31, { ceo: false });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { inspiration: 90, energy: 100 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000, themes: [] });
  const p = s.albums.at(-1);
  for (let i = 0; i < 40 && !p.released; i++) {
    while (s.event) G.choose(s, 2);
    p.launchReview = false;
    const d = p.production;
    if (!d.cooldown) {
      if (d.releaseReady) {
        G.releaseAlbum(s, p.id, p.title);
        p.launchReview = false;
        break;
      }
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    G.advance(s);
  }
  assert.ok(p.released);
  return { s, p };
}

test("Albums whose run ended over a year ago keep scores but drop calculation rows", () => {
  const { s, p } = releasedAlbum();
  const scores = p.production.results.map((r) => r.score),
    ratings = p.launchRatings.map((r) => r.score);
  p.age = p.salesWeeks;
  s.week = p.releaseWeek + 52 * 2 + 10;
  G.compactHistory(s);
  assert.equal(p.production, undefined);
  assert.deepEqual(
    p.stageScores.map((r) => r.score),
    scores,
  );
  assert.deepEqual(
    p.launchRatings.map((r) => r.score),
    ratings,
  );
  assert.ok(p.launchRatings.every((r) => !r.parts));
  assert.ok(G.validManagementSave(s) && G.validSystemsSave(s));
});

test("Recent or still-earning albums are left alone", () => {
  const { s, p } = releasedAlbum();
  s.week = p.releaseWeek + 20;
  p.age = p.salesWeeks;
  G.compactHistory(s);
  assert.ok(p.production, "released this year");
  s.week = p.releaseWeek + 52 * 3;
  p.age = p.salesWeeks - 1;
  G.compactHistory(s);
  assert.ok(p.production, "still in its earning run");
});

test("Rival archive keeps this year, last year and charting albums only", () => {
  const s = G.create(32, { ceo: false });
  s.week = 52 * 5 + 3;
  const year = Math.ceil(s.week / 52);
  s.rivalArchive = {
    old: { id: "old", year: year - 3 },
    last: { id: "last", year: year - 1 },
    now: { id: "now", year },
    oldCharting: { id: "oldCharting", year: year - 4 },
  };
  s.charts.rivals = [{ id: "oldCharting" }];
  G.compactHistory(s);
  assert.deepEqual(Object.keys(s.rivalArchive).sort(), ["last", "now", "oldCharting"]);
});

test("Award results older than three years keep scores without rows", () => {
  const s = G.create(33, { ceo: false });
  s.week = 52 * 6 + 2;
  const entry = () => ({ id: 1, score: 80, parts: [{ name: "Quality", value: 80 }] });
  s.awardPrograms = {
    1: { year: 1, results: [{ genre: "Pop", entries: [entry()] }] },
    5: { year: 5, results: [{ genre: "Pop", entries: [entry()] }] },
  };
  G.compactHistory(s);
  assert.deepEqual(s.awardPrograms[1].results[0].entries[0].parts, []);
  assert.equal(s.awardPrograms[1].results[0].entries[0].score, 80);
  assert.equal(s.awardPrograms[5].results[0].entries[0].parts.length, 1);
});

test("Chart history keeps the Top 40 and the label's own entries", () => {
  const s = G.create(34, { ceo: false });
  s.charts.history = [
    {
      week: 1,
      entries: [
        { rank: 1, owned: false },
        { rank: 41, owned: false },
        { rank: 150, owned: true },
      ],
    },
  ];
  G.compactHistory(s);
  assert.deepEqual(
    s.charts.history[0].entries.map((e) => e.rank),
    [1, 150],
  );
});

console.log(`${count} save size tests passed.`);
