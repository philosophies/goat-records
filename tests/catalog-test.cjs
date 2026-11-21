// The catalog (3.0, T64): album status, weekly royalties by era, Vault offers and their conditions,
// and older saves loading with their albums classed.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { CATALOG_STATUS: ST, CATALOG_OFFERS: O, CATALOG_ROYALTIES: ROY, ERAS } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
/** A phase-5 label with one signed artist, quiet apart from the catalog. */
function label(seed = 64, phase = 5) {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  Object.assign(s, { cash: 1e7, week: 600 });
  s.company.phase = phase;
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.eras.seen = s.company.eras.announced = 3;
  G.sign(s, s.candidates[0].id);
  s.artists[0].energy = 100;
  return { s, a: s.artists[0] };
}
let nextAlbum = 9000;
/** A released album past its sales window. */
function album(s, a, weeksAgo, quality = 70, extra = {}) {
  const p = {
    id: nextAlbum++,
    artist: a.id,
    title: `Old Record ${nextAlbum}`,
    genre: a.genre,
    released: true,
    releaseWeek: s.week - weeksAgo,
    quality,
    hit: quality >= 75,
    gross: 100000,
    total: 100000,
    age: 12,
    salesWeeks: 12,
    boosts: [],
    chart: { best: 20, weeks: 6, rank: null, milestones: [], history: [] },
    ...extra,
  };
  s.albums.push(p);
  return p;
}
const quietOffers = () => (O.chance = 0);
const chance = O.chance;
const settle = (s) => {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
};
const eraOf = (s, k) => G.eraFactor(s, k);

test("an album is fresh for 26 weeks, then catalog; a classic at three years with quality 80 and a hit", () => {
  const { s, a } = label();
  assert.equal(G.albumStatus(s, album(s, a, ST.freshWeeks - 1)), "fresh");
  assert.equal(G.albumStatus(s, album(s, a, ST.freshWeeks)), "catalog");
  assert.equal(G.albumStatus(s, album(s, a, ST.classicWeeks, 80)), "classic");
  assert.equal(G.albumStatus(s, album(s, a, ST.classicWeeks - 1, 90)), "catalog", "not old enough");
  assert.equal(G.albumStatus(s, album(s, a, ST.classicWeeks, 79)), "catalog", "not good enough");
  assert.equal(G.albumStatus(s, album(s, a, ST.classicWeeks, 85, { hit: false })), "catalog", "never a hit");
  assert.equal(G.albumStatus(s, { released: false }), null);
});

test("royalties from phase 5: gross × rate × era, classics more; paid weekly and counted by year", () => {
  quietOffers();
  const { s, a } = label();
  s.albums = [];
  const fresh = album(s, a, 5),
    old = album(s, a, 100, 70),
    classic = album(s, a, 400, 90);
  const k = eraOf(s, "catalog");
  assert.equal(G.catalogRoyalty(s, fresh), 0);
  assert.equal(G.catalogRoyalty(s, old), Math.round(100000 * ROY.perGross * k));
  assert.equal(G.catalogRoyalty(s, classic), Math.round(100000 * ROY.perGross * k * ROY.classicMult));
  s.company.phase = ROY.phase - 1;
  assert.equal(G.catalogRoyalty(s, old), 0, "no royalties before phase 5");
  s.company.phase = ROY.phase;
  const before = s.company.catalog.earned[String(G.operatingYear(s.week))] || 0;
  settle(s);
  const paid = G.vaultInfo(s).weekly;
  assert.ok(paid > 0);
  assert.equal(s.company.catalog.earned[String(G.operatingYear(s.week - 1))] - before, paid);
  assert.equal(s.financeHistory.at(-1).companyRevenue.catalog, undefined, "no flat catalog line beside them");
  // Royalties follow the era.
  for (const [i, era] of ERAS.entries()) {
    s.week = s.company.eras.starts[i] + 400;
    if (i < 3) s.week = s.company.eras.starts[i + 1] - 1;
    old.releaseWeek = s.week - 100;
    assert.equal(G.catalogRoyalty(s, old), Math.round(100000 * ROY.perGross * era.catalog), era.id);
  }
  O.chance = chance;
});

test("a deluxe edition: costs, takes energy and pays after two weeks in the studio", () => {
  quietOffers();
  const { s, a } = label();
  const p = album(s, a, 60, 70);
  const o = G.catalogOffer(s, "deluxe", p.id);
  assert.equal(o.cost, O.deluxe.costPerPhase * 5);
  const cash = s.cash,
    energy = a.energy;
  G.answerOffer(s, o.id, true);
  assert.equal(cash - s.cash, o.cost);
  assert.equal(a.energy, energy - O.deluxe.energy);
  const f = s.company.catalog.flows.at(-1);
  assert.equal(f.from, s.week + O.deluxe.studioWeeks);
  assert.equal(f.until - f.from, O.deluxe.weeks);
  assert.equal(f.perWeek, Math.round(((100000 * O.deluxe.share) / O.deluxe.weeks) * eraOf(s, "sales")));
  // Without the artist it cannot be made.
  const q = G.catalogOffer(s, "deluxe", p.id);
  s.artists = [];
  assert.throws(() => G.answerOffer(s, q.id, true), /left the label/);
  O.chance = chance;
});

test("anniversary reissues come for classics at 5 and 10 years, once; a former artist's word decides the press", () => {
  quietOffers();
  const { s, a } = label();
  const classic = album(s, a, 5 * 52 - 1, 90),
    plain = album(s, a, 5 * 52 - 1, 70);
  settle(s);
  const offers = s.company.catalog.offers.filter((o) => o.kind === "reissue");
  assert.deepEqual(
    offers.map((o) => [o.album, o.years]),
    [[classic.id, 5]],
  );
  assert.ok(!offers.some((o) => o.album === plain.id));
  assert.ok(s.notifications.some((n) => n.kind === "offer" && /5th anniversary/.test(n.title)));
  settle(s);
  assert.equal(s.company.catalog.offers.filter((o) => o.kind === "reissue").length, 1, "once");
  // The artist has left: the press goes one way or the other.
  s.artists = [];
  const rep = s.reputation;
  G.answerOffer(s, offers[0].id, true);
  assert.equal(Math.abs(s.reputation - rep), O.reissue.reputation);
  assert.ok(s.company.catalog.flows.some((f) => f.kind === "reissue"));
  O.chance = chance;
});

test("a sample request: clear it for a fee and royalty, or refuse and annoy the rival who asked", () => {
  quietOffers();
  const { s, a } = label();
  const p = album(s, a, 60, 80);
  const r = s.company.rivals[0];
  const o = G.catalogOffer(s, "sample", p.id, { by: "Someone", rival: r.id, rivalName: "Them" });
  assert.equal(o.fee, Math.round(80 * O.sample.feePerQuality * eraOf(s, "licensing")));
  const cash = s.cash;
  G.answerOffer(s, o.id, true);
  assert.equal(s.cash - cash, o.fee);
  const f = s.company.catalog.flows.at(-1);
  assert.equal(f.perWeek, Math.round(o.fee * O.sample.royaltyShare));
  assert.equal(f.until - f.from, O.sample.royaltyWeeks);
  const standing = () => s.rivalCompanies.find((c) => c.id === r.id).relationship;
  const before = standing();
  const no = G.catalogOffer(s, "sample", p.id, { by: "Someone", rival: r.id, rivalName: "Them" });
  G.answerOffer(s, no.id, false);
  assert.equal(standing(), before + O.sample.refuseStanding);
  O.chance = chance;
});

test("sync licensing pays once by quality and era, more for a classic", () => {
  quietOffers();
  const { s, a } = label();
  const p = album(s, a, 60, 80),
    c = album(s, a, 400, 80);
  const k = eraOf(s, "licensing");
  const o = G.catalogOffer(s, "sync", p.id, { client: "a feature film" }),
    oc = G.catalogOffer(s, "sync", c.id, { client: "a feature film" });
  assert.equal(o.fee, Math.round(80 * O.sync.feePerQuality * k));
  assert.equal(oc.fee, Math.round(80 * O.sync.feePerQuality * k * O.sync.classicMult));
  const cash = s.cash;
  G.answerOffer(s, o.id, true);
  assert.equal(s.cash - cash, o.fee);
  O.chance = chance;
});

test("a greatest hits once an artist has three albums out, once per artist", () => {
  quietOffers();
  const { s, a } = label();
  s.albums = [];
  album(s, a, 60);
  album(s, a, 80);
  settle(s);
  assert.ok(!s.company.catalog.offers.some((o) => o.kind === "hits"), "two is not enough");
  album(s, a, 100);
  settle(s);
  const o = s.company.catalog.offers.find((x) => x.kind === "hits");
  assert.equal(o.artist, a.id);
  G.answerOffer(s, o.id, true);
  const f = s.company.catalog.flows.at(-1);
  assert.equal(f.perWeek, Math.round(((300000 * O.hits.share) / O.hits.weeks) * eraOf(s, "sales")));
  settle(s);
  assert.ok(!s.company.catalog.offers.some((x) => x.kind === "hits"), "once");
  O.chance = chance;
});

test("fan mail: a remix lifts fame and fans; a live request lifts reputation and morale", () => {
  quietOffers();
  const { s, a } = label();
  const p = album(s, a, 60);
  const fame = s.fame,
    fans = a.fans;
  G.answerOffer(s, G.catalogOffer(s, "fanMail", p.id, { ask: "remix" }).id, true);
  assert.equal(s.fame, fame + O.fanMail.remix.fame);
  assert.equal(a.fans, fans + O.fanMail.remix.fans);
  const rep = s.reputation,
    morale = (a.morale = 50);
  G.answerOffer(s, G.catalogOffer(s, "fanMail", p.id, { ask: "tour" }).id, true);
  assert.equal(s.reputation, Math.min(100, rep + O.fanMail.tour.reputation));
  assert.equal(a.morale, morale + O.fanMail.tour.morale);
  O.chance = chance;
});

test("random offers need catalog albums, stop at three open and lapse after eight weeks", () => {
  const { s, a } = label();
  s.albums = [];
  O.chance = 1;
  settle(s);
  assert.equal(s.company.catalog.offers.length, 0, "nothing in the catalog yet");
  album(s, a, 60, 70);
  for (let i = 0; i < 4; i++) settle(s);
  assert.equal(s.company.catalog.offers.length, O.max);
  O.chance = 0;
  const first = s.company.catalog.offers[0];
  while (s.week < first.expires) settle(s);
  assert.ok(!s.company.catalog.offers.includes(first));
  O.chance = chance;
});

test("older saves load with a catalog and their albums classed", () => {
  const { s, a } = label();
  const old = album(s, a, 200, 90);
  delete s.company.catalog;
  const loaded = G.migrate(roundTrip(s));
  assert.deepEqual(loaded.company.catalog.offers, []);
  assert.equal(
    G.albumStatus(
      loaded,
      loaded.albums.find((p) => p.id === old.id),
    ),
    "classic",
  );
  assert.ok(G.validSystemsSave(loaded));
  const bad = roundTrip(loaded);
  bad.company.catalog.offers.push({ id: 1, kind: "bootleg", expires: 9 });
  assert.equal(G.validSystemsSave(bad), false);
  const classic = G.create(64, { ceo: false });
  assert.equal(classic.company, undefined);
});

console.log(`\n${count} catalog tests passed.`);
