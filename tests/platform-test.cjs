// The streaming platform (T74): stakes from phase 5, the sales and chart lift, the era, company value,
// scrutiny of big stakes and save round trips.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const P = G.PLATFORM;
function label(phase = 5, seed = 74) {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.phase = phase;
  s.cash = 1e9;
  return s;
}
const total = P.stakes.reduce((n, x) => n + x.price, 0);

test("stakes open at phase 5 and are bought in order, each costing more", () => {
  const early = label(4);
  assert.throws(() => G.buyPlatformStake(early), /opens at phase 5/);
  const s = label(5);
  for (let i = 1; i < P.stakes.length; i++) assert.ok(P.stakes[i].price > P.stakes[i - 1].price);
  const before = s.cash;
  P.stakes.forEach((stake, i) => {
    const info = G.buyPlatformStake(s);
    assert.equal(info.level, i + 1);
    assert.equal(info.share, stake.share);
  });
  assert.equal(before - s.cash, total, "every stake is paid for");
  assert.equal(s.company.platform.paid, total);
  assert.throws(() => G.buyPlatformStake(s), /already owns all/);
  const poor = label(5);
  poor.cash = P.stakes[0].price - 1;
  assert.throws(() => G.buyPlatformStake(poor), /costs \$3,000,000/);
  assert.equal(poor.company.platform.level, 0);
});

test("a stake lifts the label's album sales by its share, × the era's catalog number", () => {
  const s = label(5);
  assert.equal(G.platformInfo(s).lift, 0);
  G.buyPlatformStake(s);
  G.buyPlatformStake(s);
  const era = G.eraFactor(s, P.era);
  assert.equal(G.platformInfo(s).lift, P.stakes[1].lift * era);
  // Later in the run, in the streaming era, the same stake lifts more.
  s.week = s.company.eras.starts.at(-1) + 1;
  assert.ok(G.eraFactor(s, P.era) > era);
  assert.equal(G.platformInfo(s).lift, P.stakes[1].lift * G.eraFactor(s, P.era));
});

test("the lift reaches album sales, and so chart units", () => {
  const plain = label(5),
    owned = label(5);
  for (const s of [plain, owned]) {
    G.sign(s, s.candidates[0].id);
    const a = s.artists[0];
    s.albums.push({
      id: 900,
      artist: a.id,
      artistName: a.name,
      title: "Test",
      genre: a.genre,
      released: true,
      releaseWeek: s.week,
      quality: 80,
      age: 0,
      salesWeeks: 12,
      gross: 0,
      total: 0,
      economyVersion: 5,
      boosts: [],
      themes: [],
      chart: { best: null, weeks: 0, rank: null, milestones: [], history: [] },
    });
  }
  G.buyPlatformStake(owned);
  G.buyPlatformStake(owned);
  const lift = G.platformInfo(owned).lift;
  for (const s of [plain, owned]) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  const ratio = owned.albums[0].gross / plain.albums[0].gross;
  assert.ok(owned.albums[0].lastUnits > plain.albums[0].lastUnits, "more chart units too");
  assert.ok(
    Math.abs(ratio - (1 + lift)) < 0.01,
    `sales × ${ratio.toFixed(3)}, expected × ${(1 + lift).toFixed(3)}`,
  );
});

test("part of what was paid counts toward company value and shows in its breakdown", () => {
  const s = label(5);
  const before = G.companyValuation(s).value;
  G.buyPlatformStake(s);
  const v = G.companyValuation(s);
  assert.equal(v.platform, Math.round(P.stakes[0].price * P.bookValue));
  assert.equal(before - v.value, P.stakes[0].price - v.platform, "cash out, part of it back as the stake");
  assert.ok(
    G.valuationWhy(s).parts.some((x) => x.name === "Streaming platform stake" && x.value === v.platform),
  );
});

test("big stakes draw questions about the numbers: reputation, and a scandal with a board", () => {
  const s = label(5);
  while (s.company.platform.level < P.scrutiny.from - 1) G.buyPlatformStake(s);
  const sys = require("../src/systems/platform.js").create(
    {
      roll: () => 0,
      log() {},
      pay() {},
      requireAction() {},
      clamp: (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x)),
      api: () => G,
    },
    require("../src/data/platform.js"),
  );
  s.week = P.scrutiny.every * 3;
  s.reputation = 60;
  sys.weekly(s);
  assert.equal(s.reputation, 60, "a small stake draws no questions");
  G.buyPlatformStake(s);
  s.company.board = { scandals: 0 };
  sys.weekly(s);
  assert.equal(s.reputation, 60 + P.scrutiny.reputation);
  assert.equal(s.company.board.scandals, 1);
  assert.ok(s.notifications.some((n) => /Questions about Tributary/.test(n.title)));
  s.week++;
  sys.weekly(s);
  assert.equal(s.reputation, 60 + P.scrutiny.reputation, "only every 13 weeks");
});

test("saves keep the stake; older saves and classic runs load without one", () => {
  const s = label(5);
  G.buyPlatformStake(s);
  const copy = JSON.parse(JSON.stringify(s));
  assert.ok(G.validSystemsSave(copy));
  assert.deepEqual(copy.company.platform, s.company.platform);
  const old = JSON.parse(JSON.stringify(s));
  delete old.company.platform;
  assert.ok(G.validSystemsSave(old));
  const bad = JSON.parse(JSON.stringify(s));
  bad.company.platform.level = 99;
  assert.equal(G.validSystemsSave(bad), false);
  const classic = G.create(74, { ceo: false });
  assert.equal(G.platformInfo(classic), null);
  assert.throws(() => G.buyPlatformStake(classic), /part of a CEO run/);
});

console.log(`\n${count} platform tests passed.`);
