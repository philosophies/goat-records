// The 20-year campaign: yearly goals and rewards, run end, final score and stars, New Game+ and old saves.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const copy = (x) => JSON.parse(JSON.stringify(x));
/** Resolves pending events with the first free option. */
function clear(s) {
  for (let guard = 0; s.event && !s.finished && guard < 50; guard++) {
    const i = s.event.options.findIndex((o) => !o.cost && G.eventOptionAvailable(s, o));
    G.choose(s, i < 0 ? 0 : i);
  }
}
/** Jumps to the last week of `year` and advances across the year boundary. */
function toYearEnd(s, year) {
  clear(s);
  s.week = year * 52;
  G.advance(s);
  clear(s);
  return s;
}
function fresh(seed = 3) {
  const s = G.create(seed);
  s.cash = 200000;
  return s;
}
/** A released album with the fields the campaign reads. */
function fakeAlbum(s, { year = 1, best = null, quality = 60 } = {}) {
  const p = {
    id: 9000 + s.albums.length,
    released: true,
    title: "Record " + s.albums.length,
    artistName: "Test Artist",
    releaseWeek: (year - 1) * 52 + 10,
    releaseYear: year,
    quality,
    hit: quality >= 75,
    chart: {
      best,
      rank: null,
      weeks: 0,
      milestones: [],
      history: best ? [{ week: (year - 1) * 52 + 12, rank: best, units: 1 }] : [],
    },
  };
  s.albums.push(p);
  return p;
}
const goal = (s, year) => s.campaign.goals.find((g) => g.year === year);

test("A new label starts run 1 of a 20-year campaign with the Breakout Label goal", () => {
  const s = G.create(1);
  assert.equal(s.campaign.run, 1);
  assert.equal(s.campaign.years, 20);
  assert.equal(G.CAMPAIGN_GOALS.length, 20);
  assert.deepEqual(
    G.CAMPAIGN_GOALS.map((g) => g.year),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  assert.equal(G.currentGoal(s).goal.name, "Breakout Label");
  assert.match(G.campaignGoalText(s), /^Year 1\/20 goal: Breakout Label · Fame 0\/180/);
  assert.equal(G.campaignStatus(s).goals.length, 20);
});

test("The game no longer stops at week 53: year one is scored and play continues", () => {
  const s = toYearEnd(fresh(4), 1);
  assert.equal(s.week, 53);
  assert.equal(s.finished, false);
  assert.equal(s.outcome, null);
  assert.equal(goal(s, 1).status, "missed");
  const review = s.campaign.reviews.at(-1);
  assert.equal(review.year, 1);
  assert.equal(review.seen, false);
  assert.equal(review.next.name, "Reach Indie Imprint");
  assert.ok(review.rows.every((r) => typeof r.name === "string" && r.value !== undefined));
  G.acknowledgeCampaignReview(s);
  assert.equal(review.seen, true);
  G.advance(s);
  assert.equal(s.week, 54);
  assert.equal(G.currentGoal(s).year, 2);
  assert.equal(G.canContinueCareer(s), false);
});

test("Meeting the year-one goal pays its cash reward exactly once", () => {
  const make = (fame) => {
    const s = fresh(5);
    for (let i = 0; i < 6; i++) fakeAlbum(s);
    s.fame = fame;
    s.awards = 1;
    return s;
  };
  const won = toYearEnd(make(200), 1),
    lost = toYearEnd(make(100), 1);
  assert.equal(goal(won, 1).status, "met");
  assert.equal(goal(lost, 1).status, "missed");
  assert.equal(won.campaign.reviews.at(-1).reward, "$10,000");
  assert.equal(won.cash - lost.cash, G.CAMPAIGN_GOALS[0].reward.cash);
  const cash = won.cash;
  G.systems.find((x) => x.name === "campaign").yearEnd(won, 1);
  assert.equal(won.cash, cash, "a year is scored once");
  assert.equal(won.campaign.goals.length, 1);
});

test("Theme and fame rewards apply when later goals are met", () => {
  const s = fresh(6);
  toYearEnd(s, 1);
  toYearEnd(s, 2);
  fakeAlbum(s, { year: 3, best: 30 });
  const themes = s.themes.length;
  toYearEnd(s, 3);
  assert.equal(goal(s, 3).status, "met");
  assert.equal(s.themes.length, themes + 1);
  assert.match(s.campaign.reviews.at(-1).reward, /^New themes: /);
  for (let i = 0; i < 10; i++) fakeAlbum(s, { year: 4 });
  const fame = s.fame;
  toYearEnd(s, 4);
  assert.equal(goal(s, 4).status, "met");
  assert.ok(s.fame >= fame + 20);
  assert.equal(s.campaign.reviews.at(-1).reward, "+20 fame");
});

test("Rank goals and this-year goals are measured against the right scope", () => {
  const s = fresh(7);
  for (let y = 1; y <= 7; y++) toYearEnd(s, y);
  assert.equal(goal(s, 2).status, "missed");
  fakeAlbum(s, { year: 7, quality: 90 });
  fakeAlbum(s, { year: 7, quality: 90 });
  fakeAlbum(s, { year: 8, quality: 90 });
  toYearEnd(s, 8);
  assert.equal(goal(s, 8).status, "missed", "hits from last year do not count this year");
  s.rank = 4;
  toYearEnd(s, 9);
  toYearEnd(s, 10);
  assert.equal(goal(s, 10).status, "met");
  assert.equal(s.campaign.reviews.at(-1).reward, "$40,000");
});

test("The run ends after year 20 once the awards ceremony is resolved", () => {
  const s = fresh(8);
  s.week = 20 * 52;
  G.advance(s);
  assert.equal(s.week, 1041);
  assert.equal(s.finished, false, "the ceremony is still pending");
  assert.equal(s.event.type, "awards");
  assert.equal(s.campaign.reviews.at(-1).last, true);
  clear(s);
  assert.equal(s.finished, true);
  assert.match(s.outcome, /^Run complete after 20 years: \d+ points, a [1-5]-star label/);
  assert.throws(() => G.advance(s), /ended/);
  const f = G.finalReview(s);
  assert.equal(f.complete, true);
  assert.equal(f.bankrupt, false);
  assert.equal(f.yearsPlayed, 20);
  assert.equal(f.canNewGamePlus, true);
  assert.equal(G.canContinueCareer(s), false);
});

test("Running out of cash still ends the run immediately", () => {
  const s = G.create(9);
  s.cash = 0;
  G.advance(s);
  assert.equal(s.finished, true);
  assert.match(s.outcome, /ran out of cash/);
  const f = G.finalReview(s);
  assert.equal(f.bankrupt, true);
  assert.equal(f.canNewGamePlus, false, "New Game+ needs at least year one");
  assert.throws(() => G.newGamePlus(s, []), /New Game\+ opens/);
  assert.match(f.score.rows.at(-1).name, /Ran out of cash/);
  const late = toYearEnd(fresh(10), 1);
  late.cash = -1;
  G.advance(late);
  assert.equal(late.finished, true);
  assert.equal(G.canNewGamePlus(late), true);
});

test("The final score follows the data formula and stars follow the thresholds", () => {
  const s = fresh(11),
    K = G.CAMPAIGN_SCORE;
  s.rank = 3;
  s.awards = 4;
  s.fame = 301;
  s.cash = 123456;
  fakeAlbum(s, { best: 1, quality: 90 });
  fakeAlbum(s, { best: 1, quality: 80 });
  fakeAlbum(s, { best: 7, quality: 70 });
  fakeAlbum(s, { best: 40, quality: 76 });
  s.campaign.goals.push(
    { year: 1, status: "met" },
    { year: 2, status: "missed" },
    { year: 3, status: "met" },
  );
  const sc = G.finalScore(s),
    expected =
      3 * K.perRank +
      4 * K.perAward +
      Math.round(301 * K.perFame) +
      2 * K.perNumberOne +
      1 * K.perTopTen +
      3 * K.perHit +
      2 * K.perGoal +
      123;
  assert.equal(sc.rows.length, 8);
  assert.equal(sc.total, expected);
  assert.equal(
    sc.rows.reduce((n, r) => n + r.value, 0),
    expected,
  );
  assert.equal(sc.stars, G.CAMPAIGN_STARS.filter((t) => expected >= t).length);
  s.cash = 10 ** 9;
  assert.equal(G.finalScore(s).rows.at(-1).value, K.cashCap, "cash points are capped");
  s.cash = -500;
  s.finished = true;
  const broke = G.finalScore(s),
    subtotal = broke.rows.slice(0, -1).reduce((n, r) => n + r.value, 0);
  assert.equal(broke.rows.at(-1).value, -Math.round(subtotal * K.bankruptPenalty));
  const empty = G.create(12);
  assert.equal(G.finalScore(empty).stars, 1);
  empty.awards = 100;
  assert.equal(G.finalScore(empty).stars, 5);
});

test("Final review lists best album, #1 hits, awards, top rank, peak cash and developed artists", () => {
  const s = fresh(13);
  G.sign(s, s.candidates[0].id);
  s.artists[0].xp = G.CAREER_XP[G.CAMPAIGN.developedLevel - 1];
  fakeAlbum(s, { best: 1, quality: 91 });
  fakeAlbum(s, { best: 12, quality: 70 });
  G.advance(s);
  clear(s);
  const h = G.finalReview(s).highlights;
  assert.equal(h.bestAlbum.quality, 91);
  assert.deepEqual(h.numberOnes, ["Record 0"]);
  assert.equal(h.topRank, "Bedroom Label");
  assert.ok(h.peakCash >= 150000);
  assert.deepEqual(h.developed, [s.artists[0].name]);
});

function finishedRun(seed = 14) {
  const s = fresh(seed);
  s.awards = 60;
  s.fame = 800;
  s.rank = 4;
  G.discoverTheme(s, "test", true);
  G.discoverTheme(s, "test", true);
  G.sign(s, s.candidates[0].id);
  G.hire(s, "Producer");
  G.record(s, {
    artistId: s.artists[0].id,
    boothId: 0,
    genre: "Pop",
    audience: "Adult",
    budget: 4000,
    themes: ["Summer"],
  });
  s.albums.pop(); // keeps the combo it recorded, without an album blocking the year end
  s.week = 20 * 52;
  G.advance(s);
  clear(s);
  assert.equal(s.finished, true);
  return s;
}

test("New Game+ starts run 2 with the chosen legacy bonuses", () => {
  const prev = finishedRun(),
    points = G.legacyPoints(prev);
  assert.equal(points, Math.floor(G.finalScore(prev).total / G.LEGACY.scorePerPoint));
  assert.ok(points >= 44, "this run can afford every bonus");
  const all = G.LEGACY_BONUSES.map((b) => b.id),
    cost = G.LEGACY_BONUSES.reduce((n, b) => n + b.cost, 0);
  const s = G.newGamePlus(prev, all),
    base = G.create(1);
  assert.equal(s.week, 1);
  assert.equal(s.finished, false);
  assert.equal(s.campaign.run, 2);
  assert.equal(s.campaign.bank, points - cost);
  assert.deepEqual(s.campaign.legacy, all);
  assert.equal(s.campaign.history[0].run, 1);
  assert.equal(s.campaign.history[0].score, G.finalScore(prev).total);
  assert.deepEqual([...s.themes].sort(), [...prev.themes].sort(), "theme library");
  assert.ok(s.combos["Pop · Summer"], "combo notebook keeps the fit");
  assert.equal(s.combos["Pop · Summer"].releases, 0, "combo levels start over");
  assert.equal(G.rank(s), 2, "Indie start");
  assert.ok(G.builtFacility(s, "writers"), "founding room");
  assert.ok(
    s.booths.some((b) => b.id === 1),
    "second studio",
  );
  assert.deepEqual(s.staff, ["Producer"], "veteran team");
  assert.equal(s.employees.Producer.skill, prev.employees.Producer.skill);
  assert.equal(s.candidates.length, G.SCOUT_BUDGETS[2].count, "free national search");
  assert.equal(s.cash, base.cash + 15000 + 40000, "cash bonuses, with the search paid for");
  assert.equal(s.artists.length, 0);
  assert.equal(s.albums.length, 0);
  assert.equal(s.awards, 0);
  assert.ok(G.validCampaignSave(s));
});

test("New Game+ without bonuses keeps only the run count, history and banked points", () => {
  const prev = finishedRun(15),
    s = G.newGamePlus(prev, []);
  assert.equal(s.campaign.run, 2);
  assert.equal(s.campaign.bank, G.legacyPoints(prev));
  assert.equal(s.themes.length, 6);
  assert.deepEqual(s.combos, {});
  assert.equal(G.rank(s), 1);
  assert.equal(s.staff.length, 0);
  assert.equal(s.cash, G.create(2).cash);
  s.week = 20 * 52;
  s.campaign.bank = 0;
  G.advance(s);
  clear(s);
  const third = G.newGamePlus(s, []);
  assert.equal(third.campaign.run, 3);
  assert.deepEqual(
    third.campaign.history.map((h) => h.run),
    [1, 2],
  );
});

test("New Game+ rejects unfinished runs, unknown bonuses and bonuses over budget", () => {
  assert.throws(() => G.newGamePlus(fresh(16), []), /New Game\+ opens/);
  const prev = finishedRun(17);
  assert.throws(() => G.newGamePlus(prev, ["nope"]), /Unknown legacy bonus/);
  prev.campaign.bank = 0;
  prev.awards = 0;
  prev.fame = 0;
  prev.cash = 0;
  prev.rank = 1;
  assert.throws(() => G.newGamePlus(prev, ["indie"]), /legacy points/);
});

/** A save as 0.9 left it: no campaign data. */
function oldSave(s) {
  delete s.campaign;
  return copy(s);
}

test("A 0.9 label that finished year one continues automatically, with the goal read from its result", () => {
  const s = toYearEnd(fresh(18), 1);
  const old = oldSave(s);
  old.finished = true;
  old.outcome = "You built a breakout label! Continue career to keep growing.";
  G.migrate(old);
  assert.equal(old.finished, false);
  assert.equal(old.outcome, null);
  assert.equal(old.campaign.years, 20);
  assert.equal(goal(old, 1).status, "met");
  assert.equal(goal(old, 1).migrated, true);
  G.advance(old);
  assert.equal(old.week, 54);
  const missed = oldSave(s);
  missed.finished = true;
  missed.outcome =
    "Year one complete. Breakout Label requires 180 fame, an award, six releases and cash remaining.";
  G.migrate(missed);
  assert.equal(goal(missed, 1).status, "missed");
  const broke = oldSave(s);
  broke.finished = true;
  broke.cash = -100;
  G.migrate(broke);
  assert.equal(broke.finished, true, "a bankrupt save stays ended");
});

test("A 0.9 career-mode save keeps playing; earlier goals come from history or are not tracked", () => {
  const s = fresh(19);
  for (let y = 1; y <= 4; y++) toYearEnd(s, y);
  fakeAlbum(s, { year: 2, best: 25 });
  s.rankUps.push({ rank: 2, week: 70, themes: [], seen: true });
  s.rank = 2;
  const old = oldSave(s);
  old.careerMode = true;
  old.outcome = "You built a breakout label! Continue career to keep growing.";
  G.migrate(old);
  assert.equal(old.finished, false);
  assert.deepEqual(
    old.campaign.goals.map((g) => [g.year, g.status]),
    [
      [1, "met"],
      [2, "met"],
      [3, "met"],
      [4, "missed"],
    ],
  );
  const later = oldSave(s);
  later.week = 25 * 52 + 3;
  later.careerMode = true;
  G.migrate(later);
  assert.equal(later.campaign.years, 26, "a save past year 20 finishes its current year");
  assert.equal(goal(later, 1).status, "untracked");
  assert.equal(goal(later, 13).status, "untracked", "cash goals need a ledger entry");
  assert.equal(goal(later, 21).status, "none");
  assert.ok(G.validCampaignSave(later));
  G.migrate(later);
  assert.equal(later.campaign.goals.length, 25, "migration runs once");
});

test("validSave accepts old and current saves and rejects malformed campaign data", () => {
  const s = fresh(20);
  toYearEnd(s, 1);
  assert.ok(G.validSystemsSave(s));
  assert.ok(G.validSystemsSave(oldSave(s)));
  const bad = [
    (c) => 5,
    (c) => null,
    (c) => ({ ...c, run: 0 }),
    (c) => ({ ...c, years: 3 }),
    (c) => ({ ...c, goals: [{ year: 1, status: "won" }] }),
    (c) => ({
      ...c,
      goals: [
        { year: 1, status: "met" },
        { year: 1, status: "missed" },
      ],
    }),
    (c) => ({ ...c, reviews: [{ year: 1, seen: "no", rows: [] }] }),
    (c) => ({ ...c, reviews: [{ year: 1, seen: false, rows: [{ name: 3, value: 1 }] }] }),
    (c) => ({ ...c, legacy: ["unknown"] }),
    (c) => ({ ...c, bank: -1 }),
    (c) => ({ ...c, peakCash: "lots" }),
    (c) => ({ ...c, history: [{ run: "one", score: 1 }] }),
    (c) => ({ ...c, developed: null }),
  ];
  for (const change of bad) {
    const t = copy(s);
    t.campaign = change(t.campaign);
    assert.equal(G.validSystemsSave(t), false, JSON.stringify(t.campaign)?.slice(0, 80));
  }
});

test("Seeded campaigns stay reproducible", () => {
  assert.deepEqual(G.create(42), G.create(42));
  const a = finishedRun(21),
    b = finishedRun(21);
  assert.deepEqual(G.newGamePlus(a, ["scouts"]), G.newGamePlus(b, ["scouts"]));
});

console.log(`${count} campaign tests passed.`);
