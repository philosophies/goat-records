// Tour pay (T82): the ticket rate follows the artist's fame, the tour's quality, the artist's tier and
// the label's reputation; shared tours get a capped boost; quotes and live tickets use the same rate.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const P = require("../src/data/touring.js").TOUR_PAY;
function label(seed = 82) {
  const s = G.create(seed, { ceo: true });
  s.cash = 1e6;
  s.reputation = 60;
  G.sign(s, s.candidates[0].id, 3);
  G.sign(s, s.candidates[0].id, 3);
  const [a, b] = s.artists;
  for (const x of [a, b]) Object.assign(x, { fame: 50, energy: 100, morale: 75 });
  return { s, a, b };
}
const rate = (s, x) => G.tourRate(s, { mode: "solo", quality: 70, ...x });
const part = (r, re) => r.parts.find((p) => re.test(p.name))?.value;

test("an average up-and-comer at an average label tours at ×1", () => {
  const { s, a } = label();
  const r = rate(s, { lead: a });
  assert.equal(r.mult, 1);
  assert.deepEqual(
    r.parts.map((p) => p.value),
    [0, 0, 0, 0],
  );
});

test("fame, quality, tier and reputation each move the rate", () => {
  const { s, a } = label();
  a.fame = 100;
  assert.equal(part(rate(s, { lead: a }), /^Fame/), 0.1);
  a.fame = 0;
  assert.equal(part(rate(s, { lead: a }), /^Fame/), -0.1);
  a.fame = 50;
  assert.equal(part(rate(s, { lead: a, quality: 100 }), /quality/), 0.09);
  assert.equal(part(rate(s, { lead: a, quality: 40 }), /quality/), -0.09);
  s.reputation = 100;
  assert.equal(part(rate(s, { lead: a }), /reputation/), 0.08);
  s.reputation = 60;
  a.tier = "superstar";
  const tier = G.tierOf(a);
  assert.equal(rate(s, { lead: a }).parts[2].value, P.tier[tier]);
});

test("the rate stays between its floor and ceiling", () => {
  const { s, a } = label();
  Object.assign(a, { fame: 0 });
  s.reputation = 0;
  assert.equal(rate(s, { lead: a, quality: 0 }).mult, P.min);
  Object.assign(a, { fame: 100, tier: "superstar" });
  s.reputation = 100;
  const top = rate(s, { lead: a, quality: 100, mode: "labelmate", partner: { ...a, id: 999, name: "X" } });
  assert.ok(top.mult <= P.max);
});

test("a shared tour gets a base boost, more for a famous partner and strong labels, capped", () => {
  const { s, a, b } = label();
  b.fame = 0;
  const plain = rate(s, { lead: a, mode: "labelmate", partner: b });
  assert.equal(plain.shared, P.shared.base, "a weak partner still brings the base boost");
  b.fame = 90;
  const famous = rate(s, { lead: a, mode: "labelmate", partner: b });
  assert.ok(famous.shared > plain.shared);
  s.reputation = 100;
  b.fame = 100;
  const best = rate(s, { lead: a, mode: "labelmate", partner: b });
  assert.equal(best.shared, P.shared.max, "capped");
  // A rival's artist brings their label's strength.
  s.reputation = 60;
  const rival = { ...s.rivalArtists[0], fame: 80 };
  const r = rate(s, { lead: a, mode: "rival", rival });
  assert.match(r.parts.at(-1).name, new RegExp(`Shared with ${rival.name} \\(.+\\)`));
  assert.ok(r.shared >= P.shared.base + (P.shared.tier.superstar ?? 0));
});

test("the quote forecasts with the rate, and classic tours are unchanged", () => {
  const { s, a } = label();
  s.albums.push({
    id: 700,
    artist: a.id,
    artistName: a.name,
    title: "Road Record",
    released: true,
    releaseWeek: s.week,
    quality: 80,
    salesWeeks: 8,
    boosts: [],
    chart: { best: 5 },
  });
  const low = G.tourQuote(s, { albumId: 700 });
  a.fame = 95;
  s.reputation = 95;
  const high = G.tourQuote(s, { albumId: 700 });
  assert.ok(high.rate.mult > low.rate.mult);
  assert.ok(high.forecast > low.forecast);
  const c = G.create(82, { ceo: false });
  assert.equal(G.tourRate(c, { lead: c.candidates[0], mode: "solo" }).mult, 1);
});

test("live ticket income uses the rate of the day", () => {
  const { s, a } = label();
  const t = { id: 1, artist: a.id, artists: [a.id], mode: "solo", quality: 70, rival: null };
  const base = G.tourRateOf(s, t).mult;
  a.fame = 100;
  assert.ok(G.tourRateOf(s, t).mult > base);
  // The engine multiplies every system's tour gate together; this one is among them.
  assert.ok(G.systems.some((x) => x.name === "touring" && x.tourGate));
});

console.log(`${count} tour pay tests passed`);
