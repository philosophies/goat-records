// One ladder (3.0, T40): in CEO runs the company phase does the classic label rank's job.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
function ceo(phase = 1, seed = 8) {
  const s = G.create(seed, { ceo: true });
  s.company.phase = phase;
  return s;
}
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  for (const x of [...(s.company?.inbox || [])]) G.decide(s, x.id, 0);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}

test("Each phase carries a roster size, theme slots and a room tier", () => {
  for (const p of G.PHASES) {
    const s = ceo(p.id);
    assert.equal(G.rank(s), p.id, "the rank is the phase");
    assert.equal(G.slots(s), p.ladder.slots);
    assert.equal(G.themeSlots(s), p.ladder.themeSlots);
    assert.equal(G.rankInfo(s).tier, p.ladder.tier);
    assert.equal(G.rankInfo(s).name, p.name);
  }
  const sizes = G.PHASES.map((p) => p.ladder.slots);
  assert.deepEqual(
    sizes,
    [...sizes].sort((a, b) => a - b),
    "the roster never shrinks as the company grows",
  );
});

test("The classic rank no longer moves in a CEO run", () => {
  const s = ceo(1);
  s.fame = 9999;
  s.awards = 50;
  assert.deepEqual(G.checkRank(s), []);
  assert.equal(G.rankStatus(s).next, null);
  assert.equal(G.rank(s), 1);
});

test("Rooms open with the phase", () => {
  const tierOf = (id) => G.BOOTHS[id].labelTier;
  const locked = G.BOOTHS.map((b, id) => id).filter((id) => tierOf(id) > 1);
  assert.ok(locked.length, "some rooms need a higher tier");
  const room = locked[0],
    s = ceo(1);
  assert.ok(G.rankInfo(s).tier < tierOf(room));
  const at = G.PHASES.find((p) => p.ladder.tier >= tierOf(room));
  s.company.phase = at.id;
  assert.ok(G.rankInfo(s).tier >= tierOf(room));
});

test("Reaching a phase pays its backers' cash and finds its themes", () => {
  const s = ceo(1);
  s.cash = 0;
  s.fame = 100000;
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, albumIncome: 50000 }));
  s.albums.push(
    ...Array.from({ length: 5 }, (_, i) => ({ id: 900 + i, released: true, quality: 90, title: "Hit " + i })),
  );
  const themes = (s.themes || []).length,
    two = G.PHASES[1];
  settle(s);
  assert.equal(s.company.phase, 2);
  const n = s.notifications.find((x) => x.kind === "phase");
  assert.match(
    n.body,
    new RegExp(
      `Roster ${two.ladder.slots}, one theme per album, \\$${two.ladder.cash.toLocaleString("en-US")} from backers`,
    ),
  );
  assert.ok((s.themes || []).length >= themes, "themes are not lost");
  assert.ok(s.cash >= two.ladder.cash, "the backers paid");
});

test("CEO runs have no yearly goal; the yearly review stays", () => {
  const s = ceo(1);
  s.cash = 1e6;
  assert.equal(G.currentGoal(s), null);
  while (s.week <= 53) settle(s);
  const r = s.campaign.reviews.at(-1);
  assert.equal(r.year, 1);
  assert.equal(r.goal, null);
  assert.equal(r.status, "none");
  assert.equal(r.next, null);
});

test("Locked places and ads name the phase they open at", () => {
  const s = ceo(1),
    label = G.ladderLabel(s, 3);
  assert.equal(label, `phase 3 (${G.PHASES[2].name})`);
  const classic = G.create(8, { ceo: false });
  assert.equal(G.ladderLabel(classic, 3), `label rank 3 (${G.RANKS[2].name})`);
});

test("Classic saves keep the classic rank and yearly goals", () => {
  const s = G.create(8, { ceo: false });
  assert.equal(G.rank(s), 1);
  assert.equal(G.slots(s), G.RANKS[0].slots);
  assert.ok(G.currentGoal(s));
});

console.log(`${count} ladder tests passed.`);
