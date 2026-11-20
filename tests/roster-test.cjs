// Roster tiers (3.0, T45): slots by phase, moving up and down, and what each tier may spend.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { TIERS, TIER_SLOTS, TIER_RULES } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(phase = 1, seed = 14) {
  const s = G.create(seed, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e7;
  s.reputation = 90;
  return s;
}
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  for (const x of [...(s.company?.inbox || [])]) G.decide(s, x.id, 0);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
/** Adds an artist straight to the roster with the given tier, fame and hit count. */
function put(s, tier, fame = 10, hits = 0) {
  const a = {
    ...s.candidates[0],
    id: s.nextId++,
    name: "Artist " + s.nextId,
    tier,
    fame,
    contract: { remaining: 2, term: 2 },
  };
  s.artists.push(a);
  for (let i = 0; i < hits; i++)
    s.albums.push({
      id: s.nextId++,
      artist: a.id,
      released: true,
      quality: 80,
      releaseWeek: s.week,
      title: "Hit",
    });
  return a;
}

test("Slots by phase: no superstar slot until phase 3, totals match the roster size", () => {
  assert.deepEqual(
    TIERS.map((t) => t.id),
    ["rising", "star", "superstar"],
  );
  for (const p of G.PHASES) {
    const s = ceo(p.id),
      slots = G.tierSlots(s);
    assert.deepEqual(Object.values(slots), TIER_SLOTS[p.id - 1]);
    assert.equal(slots.rising + slots.star + slots.superstar, p.ladder.slots, `phase ${p.id} adds up`);
  }
  assert.equal(G.tierSlots(ceo(1)).superstar, 0);
  assert.equal(G.tierSlots(ceo(2)).superstar, 0);
  assert.equal(G.tierSlots(ceo(3)).superstar, 1);
});

test("New signings start as up-and-comers and need a free up-and-comer slot", () => {
  const s = ceo(3);
  G.sign(s, s.candidates[0].id, 1);
  assert.equal(G.tierOf(s.artists[0]), "rising");
  put(s, "rising");
  put(s, "rising");
  assert.ok(s.artists.length < G.slots(s), "the roster itself has room");
  assert.throws(() => G.sign(s, s.candidates[0].id, 1), /No up-and-comer slot free \(3 at this phase\)/);
  const full = ceo(1);
  put(full, "rising");
  put(full, "rising");
  assert.throws(
    () => G.sign(full, full.candidates[0].id, 1),
    /Roster full\. The next phase opens more slots/,
  );
});

test("Fame and hits move an artist up when the next tier has a free slot", () => {
  const s = ceo(3),
    a = put(s, "rising", TIER_RULES.star.fame, TIER_RULES.star.hits);
  assert.equal(G.nextTier(s, a).id, "star");
  assert.equal(G.nextTier(s, a).slot, true);
  settle(s);
  assert.equal(G.tierOf(a), "star");
  assert.ok(s.notifications.some((n) => n.kind === "tier" && n.title.includes(a.name)));
  a.fame = TIER_RULES.superstar.fame;
  for (let i = 0; i < TIER_RULES.superstar.hits; i++)
    s.albums.push({ id: s.nextId++, artist: a.id, released: true, quality: 90, releaseWeek: s.week });
  settle(s);
  assert.equal(G.tierOf(a), "superstar");
  assert.equal(G.nextTier(s, a), null, "the top");
});

test("No slot, no move; fame without hits is not enough", () => {
  const s = ceo(2);
  put(s, "star");
  const a = put(s, "rising", 90, 5);
  settle(s);
  assert.equal(G.tierOf(a), "rising", "the one star slot is taken");
  const b = put(ceo(4), "rising", 90, 0);
  assert.equal(G.nextTier(ceo(4), b).hits.have, 0);
});

test("Two flops in a row drop an artist a tier; up-and-comers do not drop", () => {
  const s = ceo(4),
    a = put(s, "star", 50, 1);
  const release = (q) => {
    const p = { id: s.nextId++, artist: a.id, released: true, quality: q, releaseWeek: s.week++, title: "F" };
    s.albums.push(p);
    G.tierAfterRelease(s, p);
    return p;
  };
  release(TIER_RULES.demotion.quality - 1);
  assert.equal(G.tierOf(a), "star", "one flop is forgiven");
  release(TIER_RULES.demotion.quality + 20);
  release(TIER_RULES.demotion.quality - 1);
  assert.equal(G.tierOf(a), "star", "flops must be in a row");
  release(TIER_RULES.demotion.quality - 5);
  assert.equal(G.tierOf(a), "rising");
  release(10);
  release(10);
  assert.equal(G.tierOf(a), "rising", "the bottom tier");
});

test("A tier caps the album budget", () => {
  const s = ceo(1);
  G.sign(s, s.candidates[0].id, 1);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, inspiration: 90 });
  assert.throws(
    () => G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 8000 }),
    /an up-and-comer: albums up to \$4,000/,
  );
  a.tier = "star";
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 8000 });
  assert.equal(s.albums.at(-1).budget ?? 8000, 8000);
});

test("A tier caps ads, tours and team size", () => {
  const s = ceo(6),
    a = put(s, "rising");
  const big = G.ADS.find((x) => x.rank > TIERS[0].adRank);
  assert.match(G.tierBlocks(s, a, "ad", big), /needs a bigger name/);
  assert.equal(G.tierBlocks(s, a, "ad", G.ADS[0]), null);
  assert.match(G.tierBlocks(s, a, "tour", "national"), /tours up to regional/);
  assert.equal(G.tierBlocks(s, a, "tour", "regional"), null);
  assert.match(G.tierBlocks(s, a, "team", 3), /a team of up to 2/);
  a.tier = "superstar";
  for (const kind of ["ad", "tour", "team"]) {
    const value = kind === "ad" ? G.ADS.at(-1) : kind === "tour" ? "world" : 7;
    assert.equal(G.tierBlocks(s, a, kind, value), null, `a superstar can have the ${kind}`);
  }
});

test("Team assignments stop at the tier's team size", () => {
  const s = ceo(4),
    a = put(s, "rising");
  for (const role of ["manager", "producer"]) {
    const m = G.hireTeam(s, role, G.recruitTeam(s, role)[0].id);
    G.assignTeam(s, m.id, a.id);
  }
  const third = G.hireTeam(s, "ar", G.recruitTeam(s, "ar")[0].id);
  assert.throws(() => G.assignTeam(s, third.id, a.id), /a team of up to 2/);
  const swap = G.hireTeam(s, "producer", G.recruitTeam(s, "producer")[0].id);
  G.assignTeam(s, swap.id, a.id);
  assert.equal(G.teamMember(s, a.id, "producer").id, swap.id, "replacing someone is always fine");
});

test("Older CEO saves give artists the tier they have earned, within the slots", () => {
  const s = ceo(4),
    big = put(s, undefined, 90, 4),
    mid = put(s, undefined, 50, 1),
    low = put(s, undefined, 5, 0);
  for (const a of [big, mid, low]) delete a.tier;
  const copy = roundTrip(s);
  G.migrate(copy);
  const tier = (a) => G.tierOf(copy.artists.find((x) => x.id === a.id));
  assert.deepEqual([tier(big), tier(mid), tier(low)], ["superstar", "star", "rising"]);
  assert.equal(G.validSystemsSave(copy), true);
  copy.artists[0].tier = "legend";
  assert.equal(G.validSystemsSave(copy), false);
});

test("Classic saves have no tiers", () => {
  const s = G.create(14, { ceo: false });
  s.cash = 1e6;
  s.reputation = 90;
  G.sign(s, s.candidates[0].id, 1);
  assert.equal(s.artists[0].tier, undefined);
  assert.equal(G.tierBlocks(s, s.artists[0], "budget", 12000), null);
});

console.log(`${count} roster tests passed.`);
