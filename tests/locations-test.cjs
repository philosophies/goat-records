// Recording locations and paid gigs.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function label(seed = 11) {
  const s = G.create(seed, { ceo: false });
  s.cash = 500000;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, {
    genre: "Country",
    audience: "Adult",
    talent: 70,
    energy: 100,
    inspiration: 80,
    fans: 50,
    fame: 20,
  });
  return { s, a };
}
function album(s, a, location, genre = "Country", extra = {}) {
  G.record(s, { artistId: a.id, boothId: 0, genre, audience: "Adult", budget: 4000, location, ...extra });
  return s.albums.at(-1);
}
function preview(s, p, stage) {
  p.production.stage = stage;
  return G.stagePreview(s, p, 0);
}
const rows = (pv, prefix) => pv.parts.filter((c) => c.name.startsWith(prefix));
function finish(s, p) {
  for (let i = 0; i < 40 && !p.released; i++) {
    while (s.event) G.choose(s, 2);
    if (p.launchReview) p.launchReview = false;
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
}
const snapshot = (s) => JSON.stringify(s);
const loc = (id) => G.LOCATIONS.find((l) => l.id === id);
const gig = (id) => G.GIGS.find((g) => g.id === id);

test("The location tables are complete and the pixel icons are 10×10", () => {
  assert.ok(G.LOCATIONS.length >= 8 && G.LOCATIONS.length <= 10);
  assert.equal(new Set(G.LOCATIONS.map((l) => l.id)).size, G.LOCATIONS.length);
  assert.equal(new Set(G.LOCATIONS.map((l) => l.theme)).size, G.LOCATIONS.length);
  for (const l of G.LOCATIONS) {
    assert.equal(l.icon.length, 10, l.id);
    assert.ok(
      l.icon.every((r) => r.length === 10 && /^[.kwysdgra]+$/.test(r)),
      l.id,
    );
    assert.ok(
      G.THEMES.some((t) => t.name === l.theme && !t.starter),
      l.id + " signature is not a starter",
    );
  }
  assert.equal(G.LOCATION_LEVELS.xp.length, G.LOCATION_LEVELS.max);
  assert.equal(G.LOCATION_LEVELS.stageBonus.length, G.LOCATION_LEVELS.max);
});

test("New labels and albums without a location work as before", () => {
  const { s, a } = label();
  assert.deepEqual(s.locationStats, {});
  assert.equal(s.gigs.played, 0);
  const p = album(s, a, "");
  assert.equal(p.budget, 4000);
  assert.equal(p.location, undefined);
  assert.equal(rows(preview(s, p, 0), "Location").length, 0);
  assert.equal(G.planCost(s, { location: "" }), 0);
});

test("Locations above the label rank are locked", () => {
  const { s, a } = label();
  assert.throws(() => album(s, a, "rooftop"), /Reach label rank 2/);
  assert.equal(G.locationQuote(s, "rooftop", "Rap").locked, true);
  s.rank = 2;
  assert.equal(album(s, a, "rooftop", "Rap").location, "rooftop");
});

test("Rejected plans leave the label untouched", () => {
  const { s, a } = label();
  const before = snapshot(s);
  assert.throws(() => album(s, a, "nowhere"), /Unknown recording location/);
  assert.throws(() => album(s, a, 7), /Unknown recording location/);
  assert.throws(() => album(s, a, "island"), /Reach label rank 5/);
  assert.equal(snapshot(s), before);
  s.cash = 4300;
  const poor = snapshot(s);
  assert.throws(() => album(s, a, "barn"), /Not enough cash/);
  assert.equal(snapshot(s), poor);
});

test("A location can host one album at a time", () => {
  const { s, a } = label();
  G.sign(s, s.candidates[0].id);
  const b = s.artists[1];
  Object.assign(b, { energy: 100, inspiration: 80 });
  G.build(s, 1);
  album(s, a, "barn");
  const before = snapshot(s);
  assert.throws(
    () => G.record(s, { artistId: b.id, boothId: 1, genre: "Rock", audience: "Adult", location: "barn" }),
    /booked/,
  );
  assert.equal(snapshot(s), before);
  assert.ok(G.locationQuote(s, "barn", "Rock").booked);
});

test("Rent is added to the album cost and the quote", () => {
  const { s, a } = label();
  const cash = s.cash;
  assert.equal(G.planCost(s, { location: "chapel" }), loc("chapel").rent);
  const p = album(s, a, "chapel", "Sacred");
  assert.equal(p.budget, 4000 + loc("chapel").rent);
  assert.equal(p.locationRent, loc("chapel").rent);
  assert.equal(s.cash, cash - 4000 - loc("chapel").rent);
});

test("A location adds its boost only to the stages it lists", () => {
  const { s, a } = label();
  const p = album(s, a, "barn", "Pop"); // Pop is Fair at the Barn Loft: no affinity row
  const id = rows(preview(s, p, 0), "Location · Barn Loft"),
    write = rows(preview(s, p, 1), "Location · Barn Loft"),
    perform = rows(preview(s, p, 2), "Location · Barn Loft");
  assert.deepEqual(
    id.map((r) => r.value),
    [loc("barn").stages[0]],
  );
  assert.deepEqual(
    write.map((r) => r.value),
    [loc("barn").stages[1]],
  );
  assert.equal(perform.length, 0);
  assert.equal(rows(preview(s, p, 0), "Location genre affinity").length, 0);
});

test("Genre affinity adds to every stage: Great helps, Poor hurts", () => {
  const { s, a } = label();
  const great = album(s, a, "barn", "Country");
  for (let i = 0; i < 5; i++)
    assert.deepEqual(
      rows(preview(s, great, i), "Location genre affinity").map((r) => r.value),
      [G.LOCATION_AFFINITY.points[2]],
    );
  great.production.stage = 0;
  const poorFit = G.locationAffinity("barn", "Rap");
  assert.equal(poorFit.name, "Poor");
  assert.ok(poorFit.points < 0);
  const q = G.locationQuote(s, "barn", "Country");
  assert.equal(q.total, 5 * 4 + 2 + 1);
  assert.ok(G.locationQuote(s, "barn", "Rap").total < 0);
});

test("Location levels follow the experience table and lift boosts and rent", () => {
  const T = G.LOCATION_LEVELS;
  assert.equal(G.locationLevelForXp(0), 1);
  for (let i = 1; i < T.max; i++) {
    assert.equal(G.locationLevelForXp(T.xp[i] - 1), i, "just below level " + (i + 1));
    assert.equal(G.locationLevelForXp(T.xp[i]), i + 1);
  }
  assert.equal(G.locationLevelForXp(9999), T.max);
  const { s, a } = label();
  s.locationStats.barn = { albums: 4, releases: 4, xp: T.xp[4], level: 5, bestQuality: 70, firstWeek: 1 };
  assert.equal(G.locationLevel(s, "barn"), 5);
  assert.equal(G.locationRent(s, "barn"), Math.round((loc("barn").rent * (1 + 4 * T.rentStep)) / 50) * 50);
  const p = album(s, a, "barn", "Pop");
  assert.equal(p.locationLevel, 5);
  assert.equal(
    rows(preview(s, p, 0), "Location · Barn Loft")[0].value,
    loc("barn").stages[0] + T.stageBonus[4],
  );
});

test("Releasing an album at a location adds experience, counts and best quality", () => {
  const { s, a } = label();
  const p = album(s, a, "barn");
  assert.equal(s.locationStats.barn.albums, 1);
  assert.equal(s.locationStats.barn.releases, 0);
  finish(s, p);
  const st = s.locationStats.barn,
    T = G.LOCATION_LEVELS;
  assert.equal(st.releases, 1);
  assert.equal(st.xp, T.releaseXp + (p.quality >= T.hitQuality ? T.hitXp : 0));
  assert.equal(st.bestQuality, p.quality);
  assert.equal(st.level, G.locationLevelForXp(st.xp));
});

test("A location's signature theme is found once, on the first album there", () => {
  const { s, a } = label();
  const known = s.themes.length;
  const p = album(s, a, "barn");
  assert.ok(s.themes.includes("Working Class"));
  assert.equal(s.themes.length, known + 1);
  assert.equal(p.locationTheme, "Working Class");
  assert.equal(s.themeLog[0].source, "Barn Loft");
  finish(s, p);
  a.inspiration = 80;
  a.energy = 100;
  while (s.event) G.choose(s, 2);
  const again = album(s, a, "barn");
  assert.equal(s.themes.length, known + 1);
  assert.equal(again.locationTheme, undefined);
  // Already known before the first visit: nothing new is added.
  const other = label(12);
  other.s.themes.push("Healing");
  const n = other.s.themes.length;
  album(other.s, other.a, "chapel", "Sacred");
  assert.equal(other.s.themes.length, n);
  assert.equal(other.s.themes.filter((t) => t === "Healing").length, 1);
});

test("Gig pay stays inside the quoted range and follows the formula", () => {
  const { s, a } = label();
  const g = gig("bar"),
    q = G.gigQuote(s, a.id, "bar"),
    raw = g.base + Math.min(a.fans, g.fanCap) * g.perFan + a.fame * g.perFame + a.talent * g.perCraft;
  assert.equal(q.pay.expected, Math.round(raw / 10) * 10);
  assert.equal(q.pay.min, Math.round((raw * (1 - g.spread)) / 10) * 10);
  assert.equal(q.pay.max, Math.round((raw * (1 + g.spread)) / 10) * 10);
  const pays = [];
  for (let i = 0; i < 60; i++) {
    Object.assign(a, { energy: 100, fans: 50, fame: 20, talent: 70 });
    if (s.gigs.artists[a.id]) s.gigs.artists[a.id].readyWeek = 0;
    const cash = s.cash,
      r = G.playGig(s, a.id, "bar");
    assert.equal(s.cash - cash, r.pay);
    assert.ok(r.pay >= q.pay.min && r.pay <= q.pay.max, `${r.pay} outside ${q.pay.min}–${q.pay.max}`);
    pays.push(r.pay);
  }
  assert.ok(new Set(pays).size > 3, "pay varies");
  // Venue size: fans above the cap do not raise a bar fee.
  a.fans = g.fanCap;
  const capped = G.gigQuote(s, a.id, "bar").pay.expected;
  a.fans = 900;
  assert.equal(G.gigQuote(s, a.id, "bar").pay.expected, capped);
});

test("A gig costs energy, moves morale within its range and starts a cooldown", () => {
  const { s, a } = label();
  const g = gig("wedding");
  a.morale = 70;
  const r = G.playGig(s, a.id, "wedding");
  assert.equal(a.energy, 100 - g.energy);
  assert.ok(r.morale >= g.morale[0] && r.morale <= g.morale[1]);
  assert.equal(a.morale, 70 + r.morale);
  assert.equal(s.gigs.played, 1);
  assert.equal(s.gigs.earned, r.pay);
  assert.throws(() => G.playGig(s, a.id, "bar"), /Next gig available in 3 weeks/);
  for (let i = 0; i < g.cooldown - 1; i++) {
    while (s.event) G.choose(s, 2);
    G.advance(s);
  }
  assert.equal(G.gigQuote(s, a.id, "bar").wait, 1);
  while (s.event) G.choose(s, 2);
  G.advance(s);
  assert.equal(G.gigQuote(s, a.id, "bar").wait, 0);
  while (s.event) G.choose(s, 2);
  a.energy = g.energy - 1;
  assert.throws(() => G.playGig(s, a.id, "wedding"), /needs 20 energy/);
});

test("Festival gigs add fans, artist fame and career XP", () => {
  const { s, a } = label();
  s.rank = 3;
  const fans = a.fans,
    xp = a.xp,
    fame = a.fame;
  G.playGig(s, a.id, "festival");
  assert.equal(a.fans, fans + gig("festival").fans);
  assert.equal(a.xp, xp + gig("festival").xp);
  assert.equal(a.fame, fame + gig("festival").fame);
});

test("Gigs are refused when locked, recording, touring, out of contract or during an event", () => {
  const { s, a } = label();
  assert.throws(() => G.playGig(s, a.id, "college"), /Reach label rank 2/);
  assert.throws(() => G.playGig(s, a.id, "nope"), /Unknown gig/);
  let before = snapshot(s);
  s.event = { title: "x", body: "y", options: [] };
  assert.throws(() => G.playGig(s, a.id, "bar"), /Resolve the industry event/);
  assert.match(G.gigQuote(s, a.id, "bar").reason, /industry event/);
  s.event = null;
  assert.equal(snapshot(s), before);
  a.contract.remaining = 0;
  assert.throws(() => G.playGig(s, a.id, "bar"), /Renew/);
  a.contract.remaining = 3;
  album(s, a, "");
  before = snapshot(s);
  assert.throws(() => G.playGig(s, a.id, "bar"), /recording or touring/);
  assert.equal(snapshot(s), before);
  s.albums.pop();
  s.tours.push({ status: "active", artists: [a.id], artist: a.id, title: "Road" });
  assert.ok(G.onTour(s, a.id), "fixture tour is active");
  assert.throws(() => G.playGig(s, a.id, "bar"), /recording or touring/);
});

test("Gig rolls use their own streams: the core seed never moves", () => {
  const { s, a } = label();
  const seed = s.seed,
    old = gig("bar").theme;
  gig("bar").theme = 1;
  try {
    const known = s.themes.length,
      r = G.playGig(s, a.id, "bar");
    assert.equal(s.seed, seed);
    assert.ok(r.theme);
    assert.equal(s.themes.length, known + 1);
    assert.equal(s.themeLog[0].source, "Bar set gig");
    assert.ok(Number.isInteger(s.streams["gigs.pay"]));
    assert.ok(Number.isInteger(s.streams["gigs.theme"]));
  } finally {
    gig("bar").theme = old;
  }
  // Same label, same choices: same gig outcome.
  const x = label(21),
    y = label(21);
  assert.deepEqual(G.playGig(x.s, x.a.id, "bar"), G.playGig(y.s, y.a.id, "bar"));
});

test("A 0.9 save loads with empty location stats and keeps its albums", () => {
  const { s, a } = label(31);
  const p = album(s, a, undefined);
  finish(s, p);
  const saved = JSON.parse(JSON.stringify(s));
  delete saved.locationStats;
  delete saved.gigs;
  delete saved.streams;
  assert.equal(G.validSystemsSave(saved), true);
  G.migrate(saved);
  assert.deepEqual(saved.locationStats, {});
  assert.deepEqual(saved.gigs, { artists: {}, played: 0, earned: 0, history: [] });
  const old = saved.albums.find((x) => x.id === p.id);
  assert.equal(old.quality, p.quality);
  assert.equal(old.location, undefined);
  assert.equal(
    old.production.results.some((r) => r.parts.some((c) => c.name.startsWith("Location"))),
    false,
  );
  assert.equal(G.validSystemsSave(saved), true);
});

test("Imported saves with broken location or gig data are rejected", () => {
  const { s, a } = label(41);
  G.playGig(s, a.id, "bar");
  album(s, a, "barn");
  const ok = JSON.parse(JSON.stringify(s));
  assert.equal(G.validSystemsSave(ok), true);
  const bad = (fn) => {
    const c = JSON.parse(JSON.stringify(s));
    fn(c);
    return G.validSystemsSave(c);
  };
  assert.equal(
    bad((c) => (c.locationStats = [])),
    false,
  );
  assert.equal(
    bad((c) => (c.locationStats.moon = c.locationStats.barn)),
    false,
  );
  assert.equal(
    bad((c) => (c.locationStats.barn.level = 12)),
    false,
  );
  assert.equal(
    bad((c) => (c.locationStats.barn.xp = -1)),
    false,
  );
  assert.equal(
    bad((c) => (c.locationStats.barn.bestQuality = "high")),
    false,
  );
  assert.equal(
    bad((c) => (c.albums[0].location = "moon")),
    false,
  );
  assert.equal(
    bad((c) => (c.albums[0].locationLevel = 0)),
    false,
  );
  assert.equal(
    bad((c) => (c.gigs = null)),
    false,
  );
  assert.equal(
    bad((c) => (c.gigs.played = 1.5)),
    false,
  );
  assert.equal(
    bad((c) => (c.gigs.artists[5] = { readyWeek: "soon", played: 0, earned: 0 })),
    false,
  );
});

console.log(`${count} location and gig checks passed.`);
