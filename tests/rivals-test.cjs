// Rival labels and feuds (3.0, T60): setup, releases, chart battles, bids for your artists, feuds,
// your bids for theirs and buying a weak rival.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { PERSONALITIES, RIVAL_RULES: R, RIVAL_LABELS } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
/** Runs fn with some table values changed, then puts them back. */
function withRules(changes, fn) {
  const saved = changes.map(([obj, key, v]) => [obj, key, obj[key]]);
  changes.forEach(([obj, key, v]) => (obj[key] = v));
  try {
    return fn();
  } finally {
    saved.forEach(([obj, key, v]) => (obj[key] = v));
  }
}
function label(phase = 3, seed = 121) {
  const s = G.create(seed, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e7;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  G.setStarter(s, false);
  return s;
}
const quiet = () =>
  Object.keys(PERSONALITIES).flatMap((k) => [
    [PERSONALITIES[k], "poach", 0],
    [PERSONALITIES[k], "feud", 0],
  ]);
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
}

test("a CEO run meets three distinct authored rivals; classic runs do not", () => {
  const s = label();
  assert.equal(s.company.rivals.length, R.count);
  assert.equal(new Set(s.company.rivals.map((r) => r.id)).size, R.count);
  const authored = s.rivalCompanies.filter((c) => c.authored);
  assert.deepEqual(authored.map((c) => c.id).sort(), s.company.rivals.map((r) => r.id).sort());
  assert.equal(RIVAL_LABELS.length, 8);
  const c = G.create(121, { ceo: false });
  assert.ok(c.rivalCompanies.every((x) => !x.authored));
});

test("strength grows with your phase", () => {
  const s = label(1);
  const r = s.company.rivals[0],
    low = G.rivalStrength(s, r);
  s.company.phase = 5;
  assert.equal(G.rivalStrength(s, r), Math.min(100, low + 4 * R.perPhase));
});

test("rivals release into the charts on their schedule", () => {
  const s = label();
  withRules(quiet(), () => {
    const r = s.company.rivals[0],
      lab = RIVAL_LABELS.find((x) => x.id === r.id);
    r.nextRelease = s.week + 1;
    settle(s);
    assert.equal(r.releases.length, 1);
    const album = s.charts.rivals.find((x) => x.id === r.releases[0].id);
    assert.equal(album.label, lab.name);
    assert.equal(album.genre, lab.genre);
    assert.equal(r.nextRelease, r.releases[0].week + PERSONALITIES[lab.personality].releaseEvery);
  });
});

test("a rival whose artists were all bid away signs a newcomer and keeps releasing", () => {
  const s = label();
  withRules(quiet(), () => {
    const r = s.company.rivals[0];
    r.roster = [];
    r.nextRelease = s.week + 1;
    settle(s);
    assert.equal(r.releases.length, 1);
    assert.equal(r.roster.length, 1);
    const album = s.charts.rivals.find((x) => x.id === r.releases[0].id);
    assert.equal(album.artistName, r.roster[0].name);
    assert.ok(!s.artists.some((a) => a.name === r.roster[0].name), "a name nobody at your label has");
  });
});

test("releases within two weeks meet in a chart battle, decided by best position", () => {
  const s = label();
  withRules(quiet(), () => {
    const r = s.company.rivals[0];
    const strength = r.strength;
    r.releases = [{ id: "rx", week: s.week - R.battleWeeks, title: "Their Record" }];
    s.rivalArchive.rx = { id: "rx", best: 40 };
    s.albums.push({
      id: 801,
      artist: 0,
      released: true,
      releaseWeek: s.week - 1,
      title: "Our Record",
      chart: { best: 12, weeks: R.battleWeeks, rank: 12, milestones: [], history: [] },
      quality: 70,
      age: 12,
      salesWeeks: 12,
    });
    G.advance(s);
    const p = s.albums.find((x) => x.id === 801);
    assert.deepEqual(p.battle, {
      rival: r.id,
      title: "Their Record",
      mine: 12,
      theirs: 40,
      won: true,
      feud: false,
    });
    assert.ok(s.notifications.some((n) => n.kind === "battle" && /you win/.test(n.title)));
    assert.ok(r.strength <= strength - R.battleSwing + R.drift);
  });
});

test("a rival bids for an artist who could leave: match, or let them go", () => {
  for (const choice of ["match", "let"]) {
    const s = label();
    G.sign(s, s.candidates[0].id, 1);
    const a = s.artists[0];
    a.tier = "star";
    const r = s.company.rivals[0],
      P = PERSONALITIES[RIVAL_LABELS.find((x) => x.id === r.id).personality];
    withRules([...quiet(), [P, "poach", 1]], () => {
      a.contract.remaining = 1;
      G.advance(s);
    });
    const card = s.event;
    assert.equal(card.type, "rivalBid");
    assert.equal(card.artist, a.id);
    const i = card.options.findIndex((o) => o.rivalChoice === choice),
      cash = s.cash,
      standing = s.rivalCompanies.find((c) => c.id === card.rival).relationship;
    G.choose(s, i);
    if (choice === "match") {
      assert.equal(cash - s.cash, Math.round(a.wage * R.match));
      assert.ok(s.artists.includes(a));
    } else {
      assert.ok(!s.artists.includes(a));
      const rival = s.company.rivals.find((x) => x.id === card.rival);
      assert.ok(rival.roster.some((x) => x.name === a.name && x.from));
      assert.equal(
        s.rivalCompanies.find((c) => c.id === card.rival).relationship,
        standing + R.letGo.standing,
      );
    }
  }
});

test("a superstar can start a feud you back or calm", () => {
  const s = label();
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  a.tier = "superstar";
  const r = s.company.rivals[0],
    P = PERSONALITIES[RIVAL_LABELS.find((x) => x.id === r.id).personality];
  withRules([...quiet(), [P, "feud", 1]], () => G.advance(s));
  assert.equal(s.event.type, "rivalFeud");
  const before = G.relationOf(a),
    standing = s.rivalCompanies.find((c) => c.id === s.event.rival).relationship;
  G.choose(
    s,
    s.event.options.findIndex((o) => o.rivalChoice === "back"),
  );
  assert.equal(
    s.rivalCompanies.find((c) => c.id === r.id).relationship,
    standing + R.superstarFeud.back.standing,
  );
  assert.ok(G.relationOf(a) > before);
});

test("a feud lifts sales and can spill over into a scandal", () => {
  const s = label(2);
  G.takeFunding(s, "angel", 0);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0],
    r = s.company.rivals[0];
  s.rivalCompanies.find((c) => c.id === r.id).relationship = R.feudAt;
  const sys = require("../src/systems/rivals.js").create(
    {
      clamp: (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x)),
      log() {},
      roll: () => 0,
      pay() {},
      requireAction() {},
      busy: () => false,
      operatingYear: () => 1,
      api: () => G,
    },
    require("../src/data/rivals.js"),
  );
  assert.equal(sys.salesMultiplier(s), 1 + R.feudSales);
  const trust = a.trust,
    scandals = s.company.board.scandals || 0;
  withRules([...quiet(), [R, "flare", 1]], () => G.advance(s));
  assert.equal(a.trust, Math.max(0, trust - R.flareTrust));
  assert.equal(s.company.board.scandals, scandals + 1);
  assert.ok(s.notifications.some((n) => /spills over/.test(n.title)));
});

test("from phase 3 you can bid for a rival's artist; a win puts them on your front desk", () => {
  const early = label(2);
  assert.throws(() => G.bidForRival(early, early.company.rivals[0].id, 0), /opens at phase 3/);
  const s = label(3),
    r = s.company.rivals[0],
    name = r.roster[0].name,
    q = G.bidQuote(s, r.id, 0),
    cash = s.cash;
  const a = withRules(
    [
      [R.bid, "max", 1],
      [R.bid, "base", 2],
    ],
    () => G.bidForRival(s, r.id, 0),
  );
  assert.equal(cash - s.cash, q.cost);
  assert.equal(a.name, name);
  assert.ok(s.candidates.includes(a));
  assert.ok(!r.roster.some((x) => x.name === name));
  assert.equal(s.rivalCompanies.find((c) => c.id === r.id).relationship, R.bid.standing);
});

test("from phase 5 a weak rival can be bought; its catalog then pays every week", () => {
  const s = label(5);
  const r = s.company.rivals[0];
  r.strength = 90;
  assert.throws(() => G.buyRival(s, r.id), /too strong/);
  r.strength = 0;
  const q = G.buyQuote(s, r.id);
  assert.ok(q.weak);
  G.buyRival(s, r.id);
  assert.equal(r.bought, true);
  assert.ok(!s.rivalCompanies.some((c) => c.id === r.id));
  assert.ok(!s.charts.rivals.some((x) => x.companyId === r.id));
  assert.equal(G.rivalsInfo(s).length, R.count - 1);
  const sys = require("../src/systems/rivals.js").create(
    {
      clamp: (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x)),
      log() {},
      roll: () => 0.99,
      pay() {},
      requireAction() {},
      busy: () => true,
      operatingYear: () => 1,
      api: () => G,
    },
    require("../src/data/rivals.js"),
  );
  const paid = Math.round(R.buy.catalog * r.boughtStrength * G.eraFactor(s, "catalog")),
    before = s.cash;
  assert.equal(sys.weekly(s), paid);
  assert.equal(s.cash - before, paid, "the catalog's income is paid, not only reported");
});

test("awards night: losing to a rival or beating one moves your standing once", () => {
  const s = label();
  const [r, q] = s.company.rivals;
  s.rivalArchive.ra = { id: "ra", companyId: r.id, title: "Their Win", genre: "Rap", year: 1 };
  s.rivalArchive.rb = { id: "rb", companyId: q.id, title: "Their Loss", genre: "Pop", year: 1 };
  s.awardPrograms[1] = {
    year: 1,
    entries: {},
    results: [
      {
        genre: "Rap",
        winner: "ra",
        entries: [
          { id: "ra", owned: false, title: "Their Win" },
          { id: 9, owned: true, title: "Ours" },
        ],
      },
      {
        genre: "Pop",
        winner: 8,
        entries: [
          { id: 8, owned: true, title: "Ours Too" },
          { id: "rb", owned: false, title: "Their Loss" },
        ],
      },
    ],
  };
  withRules(quiet(), () => G.advance(s));
  const standing = (id) => s.rivalCompanies.find((c) => c.id === id).relationship;
  assert.equal(standing(r.id), R.awardSnub);
  assert.equal(standing(q.id), R.awardBeat);
  withRules(quiet(), () => G.advance(s));
  assert.equal(standing(r.id), R.awardSnub, "counted once");
});

test("stories name one of the run's own rivals", () => {
  const s = label();
  s.company.stories = { arcs: [], log: {}, lastWeek: -10 };
  s.fame = 60;
  G.playStory(
    s,
    G.storyDue(s).find((x) => x.arc.id === "rival-diss"),
  );
  const run = s.company.stories.arcs.find((x) => x.arc === "rival-diss");
  assert.ok(s.company.rivals.some((r) => r.id === run.rival));
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.rivals[0].id = "nobody";
  assert.equal(G.validSystemsSave(bad), false);
});

console.log(`\n${count} rival tests passed.`);
