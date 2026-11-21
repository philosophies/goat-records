// Music eras (3.0, T61): era years shifted at random per run, stream multipliers, announcements,
// investing early, and the systems the era reaches (sales, singles, tours, ads, company lines, events).
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { ERAS, ERA_RULES: R } = G;
const { AD_RULES } = require("../src/data/promotion.js");
const year = (w) => G.operatingYear(w);
function label(seed = 61) {
  const s = G.create(seed, { ceo: true });
  s.cash = 1e7;
  G.setStarter(s, false);
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  return s;
}
/** Puts a run a few weeks into era i, with its changes already seen. */
function inEra(s, i, weeks = 1) {
  s.week = s.company.eras.starts[i] + weeks;
  s.company.eras.seen = s.company.eras.announced = i;
  return s;
}
const settle = (s) => {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
};

test("every change of era moves one or two years, the same for the same seed, no era under two years", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const s = G.create(seed, { ceo: true }),
      years = s.company.eras.starts.map(year);
    assert.deepEqual(years, G.create(seed, { ceo: true }).company.eras.starts.map(year), "fixed by the seed");
    assert.equal(years[0], 1);
    for (let i = 1; i < ERAS.length; i++) {
      const shift = years[i] - ERAS[i].from;
      assert.ok([1, 2].includes(Math.abs(shift)), `seed ${seed}: shift ${shift}`);
      assert.ok(years[i] - years[i - 1] >= R.minYears, `seed ${seed}: ${years}`);
      seen.add(`${i}:${shift}`);
    }
    assert.equal(s.company.eras.starts[1], (years[1] - 1) * 52 + 1, "an era starts on a year's first week");
  }
  assert.equal(seen.size, 12, "every shift happens for every change");
});

test("each era's multipliers come from its table; classic runs have none", () => {
  const s = label();
  for (const [i, era] of ERAS.entries()) {
    inEra(s, i);
    assert.equal(G.currentEra(s).id, era.id);
    for (const k of ["sales", "singles", "touring", "licensing", "catalog", "marketing"])
      assert.equal(G.eraFactor(s, k), era[k], `${era.id} ${k}`);
  }
  const c = G.create(61, { ceo: false });
  assert.equal(c.company, undefined);
  assert.equal(G.eraFactor(c, "sales"), 1);
  assert.equal(G.currentEra(c), null);
});

test("a change is announced 13 weeks ahead, with a choice to invest early, and noticed when it comes", () => {
  const s = label();
  const start = s.company.eras.starts[1];
  s.week = start - R.announce - 2;
  settle(s);
  assert.ok(![s.event, ...s.eventQueue].some((e) => e?.type === "era"), "not yet");
  G.advance(s);
  const card = s.event?.type === "era" ? s.event : s.eventQueue.find((e) => e.type === "era");
  assert.ok(card, "announced 13 weeks ahead");
  assert.equal(start - s.week, R.announce);
  assert.equal(card.era, 1);
  assert.match(card.title, new RegExp(ERAS[1].name));
  assert.deepEqual(
    card.options.map((o) => o.eraChoice),
    ["invest", "wait"],
  );
  assert.equal(card.options[0].cost, R.invest.costPerPhase * s.company.phase);
  while (s.week < start) settle(s);
  settle(s);
  assert.equal(G.currentEra(s).id, ERAS[1].id);
  assert.ok(s.notifications.some((n) => n.kind === "era" && n.title === `A new era: ${ERAS[1].name}`));
  assert.equal(s.eventQueue.filter((e) => e.type === "era").length, 0, "one card per change");
});

test("investing early lifts the new era's strongest stream for its first year only", () => {
  const s = label();
  const start = s.company.eras.starts[1],
    era = ERAS[1];
  s.week = start - R.announce - 1;
  G.advance(s);
  while (s.event?.type !== "era") G.choose(s, s.event.options.length - 1);
  const cash = s.cash;
  G.choose(s, 0);
  assert.equal(cash - s.cash, R.invest.costPerPhase * s.company.phase);
  assert.deepEqual(s.company.eras.invested, [era.id]);
  inEra(s, 1, 0);
  assert.equal(G.eraFactor(s, era.strongest), era[era.strongest] * (1 + R.invest.bonus));
  const other = ["sales", "touring", "singles"].find((k) => k !== era.strongest);
  assert.equal(G.eraFactor(s, other), era[other], "other streams unchanged");
  s.week = start + R.invest.weeks;
  assert.equal(G.eraFactor(s, era.strongest), era[era.strongest], "the lift lasts a year");
});

test("the era reaches album sales, lead singles, tours, ads, company lines and the event pool", () => {
  const s = label();
  const sys = require("../src/systems/eras.js").create(
    { roll: () => 0, log() {}, operatingYear: year, api: () => G },
    { ...require("../src/data/eras.js"), SINGLE: G.SINGLE },
  );
  for (const [i, era] of ERAS.entries()) {
    inEra(s, i);
    assert.equal(sys.salesMultiplier(s, { id: 999, age: 0 }), era.sales);
    assert.equal(sys.tourGate(s), era.touring);
    assert.equal(G.eraRevenueFactor(s, "distribution"), era.sales);
    assert.equal(G.eraRevenueFactor(s, "sync"), era.licensing);
    assert.equal(G.eraRevenueFactor(s, "catalog"), era.catalog);
    assert.equal(G.eraRevenueFactor(s, "merch"), era.touring);
    assert.equal(G.eraRevenueFactor(s, "beats"), 1, "beats for hire do not follow the era");
    for (const [id, w] of Object.entries(era.events)) assert.equal(G.eraEventWeight(s, id), w);
    const ad = G.ADS.find((x) => x.id === "radio");
    const base = ad.base * (1 + Math.max(0, s.fame) / AD_RULES.fameScale);
    assert.equal(G.adCost(s, ad), Math.round((base * era.marketing) / AD_RULES.round) * AD_RULES.round);
  }
  // A lead single's lift follows the era's singles number.
  inEra(s, 2);
  G.sign(s, s.candidates[0].id);
  s.promotion.singles[777] = { album: 777 };
  const L = G.SINGLE.launchMult,
    era = ERAS[2];
  const lifted = sys.salesMultiplier(s, { id: 777, age: 0 });
  assert.ok(Math.abs(lifted - (era.sales * (1 + (L - 1) * era.singles)) / L) < 1e-12);
  assert.equal(sys.salesMultiplier(s, { id: 777, age: G.SINGLE.launchWeeks }), era.sales);
});

test("a tour's sales bars follow the era's album sales", () => {
  const s = label();
  const p = { released: true, releaseWeek: 0, age: 2, lastUnits: 200, gross: 8000, chart: { best: 50 } };
  for (const [i, era] of ERAS.entries()) {
    inEra(s, i);
    p.releaseWeek = s.week - 2;
    assert.equal(
      G.popularAlbum(s, p),
      200 >= Math.round(250 * era.sales) || 8000 >= Math.round(10000 * era.sales),
      era.id,
    );
  }
  inEra(s, 1);
  assert.equal(G.popularAlbum(s, p), true, "the piracy years lower the bar");
  inEra(s, 0);
  assert.equal(G.popularAlbum(s, p), false, "tapes and CDs raise it");
});

test("an older save gains eras on load, without announcing changes already past", () => {
  const s = label(62);
  delete s.company.eras;
  s.week = 52 * 10 + 5;
  const loaded = G.migrate(JSON.parse(JSON.stringify(s)));
  const e = loaded.company.eras;
  assert.ok(e);
  assert.equal(e.seen, e.announced);
  assert.equal(ERAS[e.seen].id, G.currentEra(loaded).id);
  assert.ok(G.validSystemsSave(loaded));
  const bad = JSON.parse(JSON.stringify(loaded));
  bad.company.eras.starts = [1, 1, 2, 3];
  assert.equal(G.validSystemsSave(bad), false);
  const bad2 = JSON.parse(JSON.stringify(loaded));
  bad2.company.eras.invested = ["disco"];
  assert.equal(G.validSystemsSave(bad2), false);
});

console.log(`\n${count} era tests passed.`);
