const G = require("../src/engine.js"),
  fs = require("node:fs");
function fixture(seed, scale, mode, profile = "typical") {
  const s = G.create(seed);
  s.cash = 1000000;
  s.fame = 200;
  G.sign(s, s.candidates[0].id, 5);
  G.sign(s, s.candidates[0].id, 5);
  for (const a of s.artists) {
    a.age = "Adult";
    a.energy = 100;
    a.talent = profile === "low" ? 55 : 75;
    a.fans = profile === "low" ? 15 : 60;
    a.fame = profile === "low" ? 10 : 35;
    a.morale = 75;
  }
  const a = s.artists[0],
    p = {
      id: s.nextId++,
      artist: a.id,
      artistName: a.name,
      title: "Tour benchmark",
      booth: 0,
      genre: a.genre,
      audience: a.audience,
      released: true,
      releaseWeek: 1,
      quality: profile === "low" ? 65 : 80,
      gross: 12000,
      total: 10000,
      royalties: 2000,
      royalty: 0.15,
      distributionFees: 0,
      economyVersion: 5,
      launchFans: a.fans,
      launchTrust: a.trust,
      launchAttention: 0,
      launchMultiplier: 1,
      age: 12,
      salesWeeks: 12,
      boosts: [],
      chart: { rank: null, best: 10, weeks: 1, milestones: [], history: [] },
      eventsSeen: [],
      addOns: [],
      baseBudget: 4000,
      budget: 4000,
      expectation: { legacy: true, assessed: true },
      remaining: 0,
    };
  s.albums.push(p);
  const plan = { albumId: p.id, scale, mode, partnerId: s.artists[1].id, rivalId: s.rivalArtists[0].id },
    q = G.tourQuote(s, plan),
    t = G.startTour(s, plan);
  return { s, t, q };
}
function steady(s, e) {
  let choices = e.options
    .map((o, i) => ({ o, i }))
    .filter(
      ({ o }) =>
        !o.cancelChance &&
        !o.poachChance &&
        !o.endTour &&
        !o.lengthDelta &&
        !o.restDays &&
        !o.tourPause &&
        !o.recruitRival &&
        !o.royaltyIncrease,
    );
  if (!choices.length)
    choices = e.options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.cancelChance && !o.poachChance && !o.endTour);
  const tired =
    e.tour &&
    Math.min(
      ...s.tours
        .find((t) => t.id === e.tour)
        .artists.map((id) => s.artists.find((a) => a.id === id)?.energy ?? 100),
    ) < 40;
  choices.sort(
    (a, b) =>
      (tired ? (b.o.energy || 0) - (a.o.energy || 0) : 0) ||
      (a.o.cost || 0) - (b.o.cost || 0) ||
      (b.o.qualityDelta || 0) - (a.o.qualityDelta || 0),
  );
  return choices[0]?.i ?? 0;
}
function run(seed, scale, mode, profile = "typical", risky = false) {
  const { s, t, q } = fixture(seed, scale, mode, profile);
  let guard = 0;
  while (t.status === "active" && guard++ < 220) {
    if (s.event) {
      G.choose(
        s,
        risky && s.event.tour === t.id ? Math.floor(GEN(s) * s.event.options.length) : steady(s, s.event),
      );
      continue;
    }
    G.advanceTourDay(s);
  }
  while (s.event) G.choose(s, steady(s, s.event));
  const breakEven = t.history.find((h) => h.net >= 0)?.day;
  return {
    net: t.net,
    profit: t.net >= 0,
    completed: t.status === "completed",
    days: t.day,
    originalDays: t.baseDays,
    breakEven: breakEven ?? null,
    quoteNet: q.expectedNet,
    quoteBreakEven: q.breakEvenDay,
  };
}
function GEN(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function report() {
  const rows = [];
  for (const profile of ["typical", "low"])
    for (const mode of G.TOUR_MODES)
      for (const scale of G.TOUR_SCALES) {
        const runs = Array.from({ length: 30 }, (_, i) => run(i + 1, scale.id, mode.id, profile));
        rows.push({
          profile,
          mode: mode.id,
          scale: scale.id,
          runs: 30,
          profitable: runs.filter((r) => r.profit).length,
          completed: runs.filter((r) => r.completed).length,
          profitByOriginalEnd: runs.filter((r) => r.breakEven !== null && r.breakEven <= r.originalDays)
            .length,
          averageNet: Math.round(runs.reduce((n, r) => n + r.net, 0) / 30),
          averageDays: runs.reduce((n, r) => n + r.days, 0) / 30,
          averageBreakEvenDay: Math.round(
            runs.filter((r) => r.breakEven).reduce((n, r) => n + r.breakEven, 0) /
              Math.max(1, runs.filter((r) => r.breakEven).length),
          ),
          quoteNet: runs[0].quoteNet,
          quoteBreakEven: runs[0].quoteBreakEven,
        });
      }
  const risk = Array.from({ length: 100 }, (_, i) => run(i + 1, "national", "solo", "typical", true));
  return {
    version: "0.8",
    policy:
      "Lowest fee, avoid extensions and explicit cancellation risk; typical craft 75 / fans 60 / fame 35 / quality 80; low craft 55 / fans 15 / fame 10 / quality 65. Tour net excludes normal label salaries.",
    rows,
    risky: {
      runs: 100,
      completed: risk.filter((r) => r.completed).length,
      profitable: risk.filter((r) => r.profit).length,
    },
  };
}
module.exports = { fixture, steady, run, report };
if (require.main === module) {
  const r = report();
  fs.writeFileSync(__dirname + "/../TOUR-BALANCE.json", JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 2));
}
