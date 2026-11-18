// A reproducible 20-year balance sample: four simple play policies over twelve seeds each.
// Writes CAMPAIGN-BALANCE.json with goal hit rates by year, final scores, stars and bankruptcies.
const G = require("../src/engine.js"),
  fs = require("node:fs");

const POLICIES = {
  "One artist, no extras": { maxArtists: 1 },
  "One artist, promoted": { maxArtists: 1, gigs: true, locations: true, singles: true, ads: true },
  "Two artists, gigs and locations": { maxArtists: 2, gigs: true, locations: true },
  "Three artists, promoted": {
    maxArtists: 3,
    gigs: true,
    locations: true,
    singles: true,
    ads: true,
    national: true,
  },
};
const SEEDS = 12;
const HQ_ORDER = [
  "writers",
  "lounge",
  "merch",
  "vocal",
  "mix",
  "rehearsal",
  "radio",
  "bar",
  "archive",
  "academy",
];

function pickTheme(s, genre) {
  const tried = s.themes.filter((t) => G.comboInfo(s, genre, [t]).known),
    best = tried.toSorted((x, y) => G.comboFit(genre, [y]).points - G.comboFit(genre, [x]).points)[0];
  if (best && G.comboFit(genre, [best]).points >= 4) return [best];
  return [s.themes.find((t) => !tried.includes(t)) || best || s.themes[0]];
}
function freeTile(s) {
  const [w, h] = G.lotSize(s);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!G.facilityAt(s, x, y)) return [x, y];
  return null;
}
// Best value location the label can afford with $15,000 to spare, or none.
function pickLocation(s, genre) {
  let best = "",
    bestValue = 0;
  for (const l of G.locationList(s)) {
    if (l.locked || l.booked) continue;
    const q = G.locationQuote(s, l.id, genre),
      value = q.total / Math.max(1, q.rent / 1000);
    if (s.cash >= q.rent + 15000 && value > bestValue) [best, bestValue] = [l.id, value];
  }
  return best;
}
function attempt(fn) {
  try {
    fn();
  } catch {}
}
function signArtists(s, f) {
  while (s.artists.length < Math.min(G.slots(s), f.maxArtists)) {
    const c = s.candidates.toSorted((a, b) => b.talent - a.talent)[0];
    if (!c || s.reputation < 30 || s.cash < G.contractQuote(s, c, 3).fee + (s.artists.length ? 25000 : 0))
      return;
    G.sign(s, c.id, 3);
  }
}
function clearPrompts(s) {
  for (let guard = 0; s.event && guard < 20; guard++) {
    const options = s.event.options.map((o, i) => [o, i]).filter(([o]) => G.eventOptionAvailable(s, o));
    G.choose(s, (options[1] || options[0])[1]);
  }
  G.acknowledgeRankUp(s);
  for (const n of [...s.notifications]) G.acknowledgeMilestone(s, n.id);
  G.acknowledgeCampaignReview(s);
}
function manageLabel(s) {
  // In the red: let the newest hire go to cut weekly costs.
  if (s.cash < 0 && s.staff.length) attempt(() => G.fire(s, s.staff.at(-1)));
  for (const role of ["Producer", "A&R", "VP", "Public Relations", "Engineer", "Marketing"]) {
    if (s.cash < 0 || s.staff.includes(role) || s.staff.length >= Math.floor(s.week / 40)) continue;
    const c = s.staffCandidates[role]?.toSorted((a, b) => b.skill - a.skill)[0];
    if (c && s.cash > c.cost + 30000) attempt(() => G.hire(s, role, c.id));
  }
  for (const id of HQ_ORDER) {
    const def = G.FACILITIES.find((x) => x.id === id),
      built = G.builtFacility(s, id);
    if (built) {
      if (built.level < G.HQ.maxLevel && s.week > 150 && s.cash > G.upgradeCost(built) + 16000)
        attempt(() => G.upgradeFacility(s, id));
      continue;
    }
    const tile = freeTile(s);
    if (G.rank(s) >= def.rank && tile && s.cash > def.cost + 20000)
      attempt(() => G.buildFacility(s, id, tile[0], tile[1]));
    break;
  }
  for (let b = 1; b < G.BOOTHS.length; b++)
    if (
      !s.booths.some((x) => x.id === b) &&
      G.tier(s) >= G.BOOTHS[b].labelTier &&
      s.cash > G.BOOTHS[b].cost + 15000 &&
      s.artists.length > s.booths.length
    )
      attempt(() => G.build(s, b));
}
function enterAwards(s) {
  if (s.week % 52 < 45 && s.week % 52 !== 0) return;
  const year = G.operatingYear(s.week);
  for (const genre of G.GENRES) {
    const p = G.awardEligible(s, year, genre).toSorted((a, b) => b.quality - a.quality)[0];
    if (p) attempt(() => G.enterAwards(s, year, genre, p.id));
  }
}
function produce(s, f) {
  for (const p of s.albums) {
    p.launchReview = false;
    if (p.released || p.production.cooldown) continue;
    const d = p.production;
    if (d.review) G.continueProduction(s, p.id);
    else if (d.releaseReady) {
      G.releaseAlbum(s, p.id, p.title, "fans");
      p.launchReview = false;
    } else {
      if (f.singles && d.stage >= 3) {
        const q = G.singleQuote(s, p.id);
        if (q.available && s.cash > q.cost + 4000) G.releaseSingle(s, p.id);
      }
      const option = [0, 1, 2].toSorted(
        (x, y) => G.stagePreview(s, p, y).expected - G.stagePreview(s, p, x).expected,
      )[0];
      G.decideStage(s, p.id, option);
      G.continueProduction(s, p.id);
    }
  }
}
function promote(s) {
  for (const p of s.albums) {
    if (!p.released || p.age > 1 || G.activeAd(s, p.id)) continue;
    const ad = G.ADS.find((a) => a.rank <= G.rank(s)),
      q = G.adQuote(s, p.id, ad.id);
    if (q.available && s.cash > q.cost + 4000) G.buyAd(s, p.id, ad.id);
  }
}
function workArtists(s, f) {
  for (const a of s.artists) {
    if (G.busy(s, a.id)) continue;
    if (!a.contract.remaining) {
      if (s.cash > G.contractQuote(s, a, 3).fee + 4000) attempt(() => G.renew(s, a.id, 3));
      if (!a.contract.remaining) continue;
    }
    const booth = s.booths.find((b) => !s.albums.some((x) => !x.released && x.booth === b.id)),
      budget = s.cash > 80000 ? 12000 : s.cash > 35000 ? 8000 : 4000;
    if (booth && G.inspirationInfo(a).canRecord && a.energy >= 35 && s.cash > budget + 4000) {
      const location = f.locations ? pickLocation(s, a.genre) : "";
      let recorded = true;
      try {
        G.record(s, {
          artistId: a.id,
          boothId: booth.id,
          genre: a.genre,
          audience: a.audience,
          budget,
          title: `W${s.week}-${a.id}`,
          themes: pickTheme(s, a.genre),
          location,
        });
      } catch {
        recorded = false;
      }
      if (recorded) continue;
    }
    if (f.gigs && a.inspiration < 25) {
      const gig = G.GIGS.filter((g) => G.rank(s) >= g.rank)
        .map((g) => G.gigQuote(s, a.id, g.id))
        .filter((q) => q.ready)
        .sort((x, y) => y.pay.expected - x.pay.expected)[0];
      if (gig) G.playGig(s, a.id, gig.id);
    }
  }
}
function run(seed, f) {
  const s = G.create(seed);
  G.paidScout(s, f.national ? 2 : 0);
  signArtists(s, f);
  while (!s.finished) {
    clearPrompts(s);
    if (s.finished) break;
    manageLabel(s);
    signArtists(s, f);
    enterAwards(s);
    produce(s, f);
    if (f.ads) promote(s);
    workArtists(s, f);
    produce(s, f);
    G.advance(s);
  }
  return s;
}

const report = { seeds: SEEDS, policies: {} };
for (const [name, f] of Object.entries(POLICIES)) {
  const met = Array(G.CAMPAIGN.years).fill(0),
    scores = [],
    stars = [0, 0, 0, 0, 0];
  let bankrupt = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = run(seed, f),
      review = G.finalReview(s);
    for (const g of s.campaign.goals) if (g.status === "met") met[g.year - 1]++;
    if (review.bankrupt) bankrupt++;
    scores.push(review.score.total);
    stars[review.score.stars - 1]++;
  }
  scores.sort((a, b) => a - b);
  report.policies[name] = {
    bankrupt,
    goalsMetByYear: Object.fromEntries(met.map((n, i) => [i + 1, n])),
    score: { min: scores[0], median: scores[Math.floor(SEEDS / 2)], max: scores.at(-1) },
    stars: Object.fromEntries(stars.map((n, i) => [i + 1 + "★", n])),
  };
  console.log(
    `${name}: ${bankrupt}/${SEEDS} folded · median score ${scores[Math.floor(SEEDS / 2)]} · stars ${stars.join("/")}`,
  );
}
fs.writeFileSync("CAMPAIGN-BALANCE.json", JSON.stringify(report, null, 2) + "\n");
