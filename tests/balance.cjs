// A reproducible first-year balance sample. These policies are intentionally simple.
const G = require("../src/engine.js"),
  fs = require("node:fs");
// Theme policy: reuse the best combo found so far once it is Good or better, otherwise try an untested theme.
function pickTheme(s, genre) {
  const tried = s.themes.filter((t) => G.comboInfo(s, genre, [t]).known),
    best = tried.toSorted((x, y) => G.comboFit(genre, [y]).points - G.comboFit(genre, [x]).points)[0];
  if (best && G.comboFit(genre, [best]).points >= 4) return [best];
  return [s.themes.find((t) => !tried.includes(t)) || best || s.themes[0]];
}
// Headquarters policy: Writers' Room and Lounge side by side, then a Merch Shop and Vocal Booth, one at a time with a $20,000 buffer.
function buildHq(s) {
  const plan = [
    ["writers", 0, 0],
    ["lounge", 1, 0],
    ["merch", 2, 0],
    ["vocal", 0, 1],
  ];
  for (const [id, x, y] of plan) {
    const def = G.FACILITIES.find((f) => f.id === id);
    if (G.builtFacility(s, id)) continue;
    if (s.cash > def.cost + 20000) G.buildFacility(s, id, x, y);
    break;
  }
}
function run(seed, national, hq = false) {
  const s = G.create(seed);
  if (national) G.paidScout(s, 2);
  const c = s.candidates.toSorted((a, b) => b.talent - a.talent)[0];
  G.sign(s, c.id, 3);
  G.hire(s, "Producer", s.staffCandidates.Producer.toSorted((a, b) => b.skill - a.skill)[0].id);
  const a = s.artists[0],
    start = a.talent;
  let sessions = 0,
    firstLevel3 = null;
  while (!s.finished) {
    while (s.event) G.choose(s, 2);
    if (s.finished) break;
    if (hq) buildHq(s);
    if (s.week >= 49 && s.week <= 52) {
      for (const g of G.GENRES) {
        const p = G.awardEligible(s, 1, g).toSorted((a, b) => b.quality - a.quality)[0];
        if (p) G.enterAwards(s, 1, g, p.id);
      }
    }
    for (const p of s.albums) {
      if (p.launchReview) p.launchReview = false;
      if (p.released || p.production.cooldown) continue;
      const d = p.production;
      if (d.releaseReady) {
        G.releaseAlbum(s, p.id, p.title);
        p.launchReview = false;
      } else {
        const option = [0, 1, 2].toSorted(
          (x, y) => G.stagePreview(s, p, y).expected - G.stagePreview(s, p, x).expected,
        )[0];
        G.decideStage(s, p.id, option);
        G.continueProduction(s, p.id);
      }
    }
    if (!G.busy(s, a.id)) {
      if (!a.contract.remaining && s.cash > G.contractQuote(s, a, 3).fee + 6000) G.renew(s, a.id, 3);
      const info = G.trainingInfo(s, a);
      if (
        a.contract.remaining &&
        info.gain > 0 &&
        !info.wait &&
        a.energy >= 60 &&
        s.cash > info.cost + 6000
      ) {
        G.train(s, a.id);
        sessions++;
      }
      if (
        G.inspirationInfo(a).canRecord &&
        a.contract.remaining &&
        a.energy >= 35 &&
        s.cash > 6000 &&
        s.week < 48
      )
        G.record(s, {
          artistId: a.id,
          boothId: 0,
          genre: a.genre,
          audience: a.audience,
          title: "Sessions " + s.week,
          themes: hq ? pickTheme(s, a.genre) : [],
        });
    }
    for (const p of s.albums.filter(
      (p) => !p.released && !p.production.cooldown && !p.production.review && !p.production.stage,
    )) {
      const option = [0, 1, 2].toSorted(
        (x, y) => G.stagePreview(s, p, y).expected - G.stagePreview(s, p, x).expected,
      )[0];
      G.decideStage(s, p.id, option);
      G.continueProduction(s, p.id);
    }
    if (firstLevel3 === null && G.level(a) >= 3) firstLevel3 = s.week;
    G.advance(s);
  }
  return {
    survived: s.week === 53,
    won: s.outcome.startsWith("You built"),
    startCraft: start,
    endCraft: a.talent,
    level: G.level(a),
    sessions,
    releases: s.albums.filter((p) => p.released).length,
    cash: s.cash,
    fame: s.fame,
    firstLevel3,
    rank: G.rank(s),
    facilities: s.hq.facilities.length,
    themes: s.themes.length,
  };
}
const report = { version: "0.9", seeds: 30, policies: {} };
for (const [name, national, hq] of [
  ["Develop a local discovery", false, false],
  ["Sign a national headliner", true, false],
  ["Local discovery with headquarters and themes", false, true],
  ["National headliner with headquarters and themes", true, true],
]) {
  const runs = Array.from({ length: 30 }, (_, i) => run(i + 1, national, hq));
  const avg = (k) => Math.round((runs.reduce((n, r) => n + (r[k] || 0), 0) / runs.length) * 10) / 10;
  report.policies[name] = {
    survived: runs.filter((r) => r.survived).length,
    breakoutWins: runs.filter((r) => r.won).length,
    averageStartingCraft: avg("startCraft"),
    averageFinalCraft: avg("endCraft"),
    highestFinalCraft: Math.max(...runs.map((r) => r.endCraft)),
    averageDevelopmentSessions: avg("sessions"),
    averageReleasedAlbums: avg("releases"),
    averageCash: avg("cash"),
    averageFame: avg("fame"),
    averageFinalLevel: avg("level"),
    averageRank: avg("rank"),
    averageFacilities: avg("facilities"),
    averageThemesKnown: avg("themes"),
  };
}
fs.writeFileSync(__dirname + "/../BALANCE.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
