// Show why (3.0, T58): causes behind tier moves, relationship swings, votes and leaks; the company value
// breakdown; a monthly ledger that sums to the cash change; and each artist's timeline.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function label(phase = 3) {
  const s = G.create(101, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e6;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  G.sign(s, s.candidates[0].id);
  return { s, a: s.artists[0] };
}

test("a tier move records the numbers behind it", () => {
  const { s, a } = label();
  a.fame = 60;
  s.albums.push({ id: 900, artist: a.id, released: true, quality: 82, releaseWeek: s.week, title: "Hit" });
  G.promoteTiers(s);
  assert.equal(a.tier, "star");
  const w = G.whyFor(s, `artist:${a.id}`, ["tier"])[0];
  assert.equal(w.title, "Moved up to Star");
  assert.deepEqual(
    w.parts.map((p) => p.value),
    [60, 1, G.tierSlots(s).star],
  );
});

test("big relationship swings are logged with their cause, small ones are not", () => {
  const { s, a } = label();
  a.tier = "superstar";
  G.shiftRelation(s, a, 1, "A small thing");
  assert.equal(G.whyFor(s, `artist:${a.id}`, ["relation"]).length, 0);
  const before = G.relationOf(a);
  G.shiftRelation(s, a, -6, "Said no to the rider");
  const w = G.whyFor(s, `artist:${a.id}`, ["relation"])[0];
  assert.match(w.title, /Relationship with you -9: Said no to the rider/);
  assert.equal(G.relationOf(a), before - 9);
  assert.deepEqual(
    w.parts.map((p) => p.value),
    [-6, -3],
  );
});

test("a no-confidence vote records each director's vote and reasons", () => {
  const { s } = label(2);
  G.takeFunding(s, "angel", 0);
  const b = s.company.board;
  b.directors[0].relationship = -25;
  s.reputation = 0;
  const v = G.holdVote(s);
  assert.equal(v.voters.length, b.directors.length);
  assert.ok(v.voters.every((x) => Number.isFinite(x.satisfaction) && Array.isArray(x.why)));
  const w = G.whyFor(s, "company", ["vote"])[0];
  assert.match(w.title, /No-confidence vote: \d of \d against/);
  assert.equal(w.parts.length, b.directors.length);
});

test("a leak records the risk it came from", () => {
  const { s, a } = label();
  s.albums.push({
    id: 901,
    artist: a.id,
    title: "Leaky",
    audience: a.audience,
    production: {
      releaseReady: true,
      review: false,
      results: [0, 1, 2, 3, 4].map((i) => ({ area: "A" + i, score: 70, parts: [] })),
    },
  });
  let leaked = false;
  for (let i = 0; i < 60 && !leaked; i++) {
    const p = s.albums.at(-1);
    delete p.party;
    delete p.leaked;
    leaked = G.holdParty(s, p.id).leaked;
  }
  assert.ok(leaked, "a leak happened");
  const w = G.whyFor(s, `artist:${a.id}`, ["leak"])[0];
  assert.match(w.title, /Leaky leaked from listening party 1/);
  assert.equal(w.parts[0].value, Math.round(G.PARTY.leak[0] * 100));
});

test("the company value breakdown adds up to the value", () => {
  const { s } = label(4);
  for (let i = 0; i < 30; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  s.company.loan = { amount: 5000, balance: 4000, payment: 100, week: 1 };
  const w = G.valuationWhy(s);
  const sum = w.parts.reduce((n, p) => n + p.value, 0);
  assert.ok(Math.abs(sum - w.value) <= 3, `${sum} vs ${w.value}`);
  assert.ok(w.parts.some((p) => p.name === "Debt" && p.value === -4000));
});

test("each month of the ledger sums to that month's cash change", () => {
  const { s, a } = label();
  Object.assign(a, { energy: 100, inspiration: 80 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  for (let w = 0; w < 14; w++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    if (w === 9) G.train(s, a.id); // money spent during the week
    for (const p of s.albums.filter((x) => !x.released && x.production)) {
      const d = p.production;
      if (d.releaseReady) G.releaseAlbum(s, p.id, p.title);
      else if (!d.cooldown) {
        if (!d.review) G.decideStage(s, p.id, 0);
        G.continueProduction(s, p.id);
      }
    }
    s.albums.forEach((p) => (p.launchReview = false));
    G.advance(s);
  }
  const months = G.monthlyLedger(s);
  assert.equal(months.length, G.WHY_RULES.ledgerMonths);
  for (const m of months) {
    assert.equal(m.total, m.cashChange, `weeks ${m.from}–${m.to}`);
    assert.ok(m.rows.every((r) => typeof r.name === "string" && Number.isFinite(r.value)));
  }
  assert.ok(months.some((m) => m.rows.some((r) => r.name === "Album sales")));
  assert.ok(months.some((m) => m.rows.some((r) => r.name === "Spending and deals during the week")));
});

test("an artist's timeline runs newest first through signing, releases and beats", () => {
  const { s, a } = label();
  s.albums.push({
    id: 902,
    artist: a.id,
    released: true,
    quality: 82,
    releaseWeek: s.week + 2,
    title: "Later",
  });
  const t = G.timeline(s, a);
  assert.equal(t[0].kind, "release");
  assert.match(t[0].text, /Later \(quality 82, a hit\)/);
  assert.equal(t.at(-1).kind, "signed");
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].week >= t[i].week);
});

test("saves keep the cause log within its size and refuse broken entries", () => {
  const { s, a } = label();
  for (let i = 0; i < 80; i++) G.noteWhy(s, { kind: "tier", who: `artist:${a.id}`, title: "x" + i });
  assert.equal(s.company.why.length, G.WHY_RULES.keep);
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.why[0].parts = "nope";
  assert.equal(G.validSystemsSave(bad), false);
  const c = G.create(101, { ceo: false });
  assert.equal(G.noteWhy(c, { kind: "tier", who: "x", title: "y" }), null);
});

console.log(`\n${count} why tests passed.`);
