// Automatic award entries (T84): in a CEO run each genre's entry is the year's strongest album by the
// judges' weights, a stronger album replaces a weaker one, and the ceremony judges those entries.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function label(seed = 84) {
  const s = G.create(seed, { ceo: true });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id, 3);
  return { s, a: s.artists[0] };
}
let next = 9000;
function album(s, a, quality, extra = {}) {
  const p = {
    id: next++,
    artist: a.id,
    artistName: a.name,
    title: "Record " + next,
    genre: a.genre,
    released: true,
    releaseWeek: s.week,
    quality,
    salesWeeks: 12,
    boosts: [],
    chart: { best: null },
    launchRatings: [
      { name: "Critics", score: quality },
      { name: "Fan response", score: quality },
      { name: "Market impact", score: quality },
    ],
    ...extra,
  };
  s.albums.push(p);
  return p;
}

test("strength uses the judges' weights without the jury", () => {
  const { s, a } = label();
  const p = album(s, a, 80, {
    chart: { best: 1 },
    launchRatings: [
      { name: "Critics", score: 70 },
      { name: "Fan response", score: 90 },
    ],
  });
  assert.equal(G.awardStrength(p), 80 * 0.6 + 70 * 0.2 + 90 * 0.1 + 100 * 0.1);
});

test("each genre's strongest album of the year is entered, and a stronger one replaces it", () => {
  const { s, a } = label();
  const year = G.operatingYear(s.week);
  const first = album(s, a, 70);
  G.autoEnterAwards(s);
  assert.equal(s.awardPrograms[year].entries[a.genre], first.id);
  const better = album(s, a, 88);
  G.autoEnterAwards(s);
  assert.equal(s.awardPrograms[year].entries[a.genre], better.id);
  // A chart peak can lift an older album past a newer one.
  first.chart.best = 1;
  first.quality = 86;
  G.autoEnterAwards(s);
  assert.equal(
    s.awardPrograms[year].entries[a.genre],
    G.awardStrength(first) > G.awardStrength(better) ? first.id : better.id,
  );
  // Genres with no release have no entry; last year's albums do not count.
  const other = G.GENRES.find((g) => g !== a.genre);
  assert.equal(s.awardPrograms[year].entries[other], undefined);
  album(s, a, 99, { releaseWeek: s.week - 60 });
  G.autoEnterAwards(s);
  assert.ok([first.id, better.id].includes(s.awardPrograms[year].entries[a.genre]));
});

test("entries cannot be chosen by hand in a CEO run, and are kept current each week", () => {
  const { s, a } = label();
  const p = album(s, a, 75);
  assert.throws(() => G.enterAwards(s, G.operatingYear(s.week), a.genre, p.id), /automatically/);
  s.event = null;
  s.eventQueue = [];
  G.advance(s);
  assert.equal(s.awardPrograms[G.operatingYear(p.releaseWeek)].entries[a.genre], p.id);
});

test("the ceremony judges the automatic entry", () => {
  const { s, a } = label();
  const year = G.operatingYear(s.week);
  const p = album(s, a, 95, { chart: { best: 1 } });
  s.awardPrograms[year].entries = {}; // nothing entered by hand
  // The year closes: the settlement into the next year runs the ceremony.
  s.week = year * 52;
  s.event = null;
  s.eventQueue = [];
  G.advance(s);
  const result = s.awardPrograms[year].results.find((r) => r.genre === a.genre);
  assert.ok(
    result.entries.some((e) => e.owned && e.id === p.id),
    "the album was judged",
  );
});

test("classic runs still enter by hand", () => {
  const s = G.create(84, { ceo: false });
  assert.equal(G.autoEnterAwards(s), undefined);
  assert.deepEqual(s.awardPrograms[G.operatingYear(s.week)]?.entries || {}, {});
});

console.log(`${count} automatic award tests passed`);
