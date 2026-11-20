// Listening parties (3.0, T48): the report, each choice, diminishing returns and leaks.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { PARTY } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ready(seed = 21, ceo = true) {
  const s = G.create(seed, { ceo });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, inspiration: 80, talent: 70 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  const p = s.albums.at(-1);
  for (let i = 0; i < 40 && !p.production.releaseReady; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    for (const x of [...(s.company?.inbox || [])]) G.decide(s, x.id, 0);
    const d = p.production;
    if (!d.cooldown && !d.releaseReady) {
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    if (!d.releaseReady) G.advance(s);
  }
  while (s.event) G.choose(s, s.event.options.length - 1);
  assert.ok(p.production.releaseReady, "album reached the final review");
  return { s, a, p };
}
function weeksOut(s, p) {
  for (let i = 0; i < 6 && !p.production.releaseReady; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  while (s.event) G.choose(s, s.event.options.length - 1);
}

test("a party needs a finished album and is CEO only", () => {
  const { s, p } = ready(21, false);
  assert.equal(G.partyQuote(s, p.id).available, false);
  assert.throws(() => G.holdParty(s, p.id), /CEO run/);
  const c = ready(21).s;
  const q = G.partyQuote(c, c.albums.at(-1).id);
  assert.equal(q.available, true);
  assert.equal(q.cost, PARTY.cost.rising);
  assert.equal(q.leak, PARTY.leak[0]);
});

test("the report reads the room by audience and by area", () => {
  const { s, p } = ready();
  const cash = s.cash,
    r = G.holdParty(s, p.id);
  assert.equal(s.cash, cash - PARTY.cost.rising);
  assert.deepEqual(
    r.audiences.map((x) => x.name),
    G.PARTY_AUDIENCES,
  );
  assert.equal(r.areas.length, 5);
  for (const x of [...r.audiences, ...r.areas]) {
    assert.ok(x.score >= 0 && x.score <= 100);
    assert.equal(x.sentiment, G.partySentiment(x.score));
  }
  const target = r.audiences.find((x) => x.name === p.audience),
    far = r.audiences.filter((x) => x.name !== p.audience);
  assert.ok(far.every((x) => x.score <= target.score + PARTY.noise * 2));
  assert.equal(r.weakest, r.areas.reduce((lo, x) => (x.score < lo.score ? x : lo)).index);
  assert.ok(p.party.pending);
  assert.throws(() => G.holdParty(s, p.id), /last party/);
  assert.ok(G.validSystemsSave(roundTrip(s)));
});

test("rework lifts the weakest area, costs a week and gives less the second time", () => {
  const { s, p } = ready();
  const r1 = G.holdParty(s, p.id),
    area = p.production.results[r1.weakest],
    before = area.score,
    q = G.albumQuality(p);
  G.partyChoice(s, p.id, "rework");
  assert.equal(area.score, Math.min(100, before + PARTY.rework.gain[0]));
  assert.equal(p.production.releaseReady, false);
  assert.ok(G.albumQuality(p) >= q);
  assert.equal(G.partyQuote(s, p.id).available, false);
  weeksOut(s, p);
  assert.ok(p.production.releaseReady);
  assert.equal(G.partyQuote(s, p.id).leak, PARTY.leak[1]);
  const r2 = G.holdParty(s, p.id),
    second = p.production.results[r2.weakest],
    b2 = second.score;
  G.partyChoice(s, p.id, "rework");
  assert.equal(second.score - b2, Math.min(PARTY.rework.gain[1], 100 - b2));
  assert.ok(PARTY.rework.gain[1] < PARTY.rework.gain[0]);
  weeksOut(s, p);
  const q3 = G.partyQuote(s, p.id);
  assert.equal(q3.available, false);
  assert.match(q3.reason, /most an album/);
});

test("changing the lead single works once, and releasing as is changes nothing", () => {
  const { s, p } = ready();
  G.holdParty(s, p.id);
  const before = p.production.results.map((r) => r.score);
  G.partyChoice(s, p.id, "release");
  assert.deepEqual(
    p.production.results.map((r) => r.score),
    before,
  );
  assert.equal(p.party.pending, false);
  G.holdParty(s, p.id);
  const campaign = p.production.results[4].score;
  G.partyChoice(s, p.id, "single");
  assert.equal(p.production.results[4].score, Math.min(100, campaign + PARTY.single));
  assert.ok(p.party.single);
  assert.throws(() => G.partyChoice(s, p.id, "single"), /no party feedback/);
  G.releaseAlbum(s, p.id, p.title);
  assert.ok(p.released);
  assert.equal(G.partyQuote(s, p.id).available, false);
});

test("a leak cuts sales", () => {
  const leak = { p: { leaked: true } },
    clean = { p: {} };
  const sys = require("../src/systems/parties.js").create(
    { clamp: (x) => x, log() {}, pay() {}, requireAction() {}, roll: () => 0, api: () => ({}) },
    require("../src/data/parties.js"),
  );
  assert.equal(sys.salesMultiplier(null, leak.p), PARTY.leakSales);
  assert.equal(sys.salesMultiplier(null, clean.p), 1);
});

test("parties leak over a run at roughly the stated rate", () => {
  let leaks = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { s, p } = ready(seed);
    if (G.holdParty(s, p.id).leaked) leaks++;
  }
  assert.ok(leaks <= 8, `${leaks} leaks in 40 first parties`);
});

console.log(`\n${count} listening party tests passed.`);
