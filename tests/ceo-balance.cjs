// Run from any directory. The sample uses game actions and fixed seeds.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = require("../src/engine");
const { COMPANY_EVENTS } = require("../src/data/events");

const policies = {
  careful: { artists: 4, reserve: 1400, budget: 12000, funding: 0, lobby: true, grow: 1 },
  average: { artists: 3, reserve: 850, budget: 8000, funding: 0, lobby: false, grow: 0.5 },
  reckless: { artists: 4, reserve: 600, budget: 12000, funding: 1, lobby: false, grow: 0 },
};
const events = new Map(COMPANY_EVENTS.map((event) => [event.id, event]));

function action(fn) {
  try {
    return fn();
  } catch (error) {
    if (!/cash|approval|budget|re-sign|contract|roster/i.test(error.message)) throw error;
    return null;
  }
}

function eventChoice(s, name) {
  const entry = s.event;
  const board = s.company.board;
  const options = entry.options
    .map((option, index) => ({ option, index }))
    .filter(
      ({ option }) =>
        !option.defer &&
        G.eventOptionAvailable(s, option, entry) &&
        !(
          option.cost &&
          board?.freedom !== "high" &&
          board?.confidence < G.APPROVAL.grant &&
          board.spent + option.cost > board.budget
        ),
    );
  if (entry.type === "approval") return options[0].index;
  if (entry.type === "story") {
    // Optional story spending only with room left in the board's budget for a few albums.
    const roomy = (o) => !o.cost || !board || board.budget - board.spent - o.cost > 3 * policies[name].budget;
    const usable = options.filter(({ option }) => roomy(option));
    if (usable.length) options.splice(0, options.length, ...usable);
    // Weigh a story choice by what it does: money against morale, fans and trust.
    const worth = (o) =>
      ((o.cash || 0) - (o.cost || 0)) / 600 +
      (o.morale || 0) / 2 +
      (o.fans || 0) / 2 +
      (o.trust || 0) * 1.5 +
      (o.energy || 0) / 3;
    const sorted = options.toSorted((x, y) => worth(y.option) - worth(x.option));
    return (name === "reckless" ? sorted.at(-1) : sorted[0]).index;
  }
  if (entry.type === "rivalBid" || entry.type === "rivalFeud") {
    // Careful keeps its people and the peace; reckless lets them go and backs every fight.
    const want = {
      rivalBid: { careful: "match", average: "counter", reckless: "let" },
      rivalFeud: { careful: "calm", average: "calm", reckless: "back" },
    }[entry.type][name];
    const pick = options.find(({ option }) => option.rivalChoice === want) || options.at(-1);
    return pick.index;
  }
  if (!options.length) return entry.options.findIndex((option) => option.defer);
  if (entry.type !== "companyEvent") return options[Math.min(1, options.length - 1)].index;
  const choices = events.get(entry.eventId).choices;
  function merit(option) {
    const choice = choices[option.choice];
    const {
      cash = 0,
      fame = 0,
      morale = 0,
      confidence = 0,
      artistFame = 0,
      delayAlbum = 0,
    } = choice.effects || {};
    const charge = choice.cost || 0;
    return cash / 600 - charge / 600 + fame + artistFame / 2 + morale / 2 + confidence * 3 - delayAlbum * 4;
  }
  if (name === "average") return options[Math.min(1, options.length - 1)].index;
  const sorted = options.toSorted((a, b) => merit(b.option) - merit(a.option));
  return name === "reckless" && s.company.ownership <= 0.5 ? sorted.at(-1).index : sorted[0].index;
}

function clearDecisions(s, name) {
  for (let count = 0; s.event && !s.finished; count++) {
    assert.ok(count < 30, "Decision queue did not clear");
    action(() => G.choose(s, eventChoice(s, name)));
  }
  G.acknowledgeRankUp(s);
  for (const n of [...s.notifications]) G.acknowledgeMilestone(s, n.id);
  G.acknowledgeCampaignReview(s);
  G.ackReview(s);
  G.ackGrab(s);
  G.acknowledgeIPO(s);
}

function produce(s) {
  for (const p of s.albums) {
    if (p.launchReview) p.launchReview = false; // Same acknowledgement as the release card.
    // The run's first album can take several stages in one week (the starter checklist's fast album).
    for (let step = 0; step < 6; step++) {
      if (p.released || p.production.cooldown || s.event) break;
      if (p.production.releaseReady) {
        G.releaseAlbum(s, p.id, p.title, "fans");
        p.launchReview = false;
        break;
      }
      if (!p.production.review) {
        const option = [0, 1, 2].toSorted(
          (a, b) => G.stagePreview(s, p, b).expected - G.stagePreview(s, p, a).expected,
        )[0];
        G.decideStage(s, p.id, option);
      }
      G.continueProduction(s, p.id);
    }
  }
}

function fund(s, name, policy) {
  const offers = G.fundingOffers(s);
  if (
    s.week === 1 ||
    (name === "careful" &&
      s.cash < 7000 &&
      s.company.phase > 1 &&
      !s.company.loan &&
      s.artists.some((a) => a.contract.remaining > 0))
  )
    G.takeFunding(s, "loan");
  const kind = s.company.phase === 2 ? "angel" : "venture";
  const equity = offers.filter((offer) => offer.kind === kind);
  if (equity.length && (kind === "angel" || name === "reckless" || s.cash < 25000))
    G.takeFunding(s, kind, policy.funding);
}

function lobby(s, enabled) {
  if (!enabled || !s.company.board || s.company.board.meetingWeek === s.week) return;
  const director = s.company.board.directors
    .filter((d) => d.relationship < G.LOBBY.maxRelationship)
    .toSorted((a, b) => a.satisfaction - b.satisfaction)[0];
  if (director) G.meetDirector(s, director.id);
}

function manage(s, name, policy) {
  for (const a of s.artists) {
    if (s.event) return;
    if (!a.contract.remaining && !G.busy(s, a.id)) {
      const terms = G.contractQuote(s, a, 3);
      if (s.cash >= terms.fee + policy.reserve) {
        if (a.morale < 55 && s.cash > 10000) action(() => G.payBonus(s, a.id));
        if (!s.event) action(() => G.renew(s, a.id, 3));
      }
    }
  }
  for (const a of [...s.artists]) {
    if (s.event) return;
    if (!a.contract.remaining && !G.busy(s, a.id) && (a.persona?.walked || s.cash > 25000))
      action(() => G.releaseArtist(s, a.id));
  }
  const desired = s.company.phase === 1 ? 1 : Math.min(G.slots(s), policy.artists, s.company.phase + 1);
  // New signings need a free up-and-comer slot.
  const risingFree = G.tierCount(s, "rising") < G.tierSlots(s).rising;
  if (!s.event && risingFree && s.artists.length < desired && s.reputation >= 30) {
    const candidate = s.candidates.toSorted((a, b) => b.talent - a.talent)[0];
    if (candidate && s.cash > G.contractQuote(s, candidate, 3).fee + policy.reserve)
      action(() => G.sign(s, candidate.id, 3));
    else if (!candidate && s.cash > policy.reserve + 5000)
      action(() => G.paidScout(s, G.scoutLimits(s).budget));
  }
  if (s.event) return;
  const room = G.BOOTHS.findIndex(
    (booth, index) => booth.labelTier <= s.company.phase && !s.booths.some(({ id }) => id === index),
  );
  if (s.company.phase >= 2 && s.cash > 38000 && !s.company.buildings.some(({ id }) => id === "storefront"))
    action(() => G.buyBuilding(s, "storefront"));
  const storefront = s.company.buildings.find(({ id }) => id === "storefront");
  if (
    !s.event &&
    room >= 0 &&
    storefront &&
    s.booths.length < s.artists.length &&
    storefront.floors.length < 3 &&
    s.cash > 45000
  )
    action(() => G.buildFloor(s, storefront.id, "room", room));
  if (
    !s.event &&
    s.company.phase >= 3 &&
    s.cash > 110000 &&
    !s.company.buildings.some(({ id }) => id === "studio")
  )
    action(() => G.buyBuilding(s, "studio"));
  const studio = s.company.buildings.find(({ id }) => id === "studio");
  if (
    !s.event &&
    room >= 0 &&
    !s.booths.some(({ id }) => id === room) &&
    studio &&
    s.booths.length < s.artists.length &&
    studio.floors.length < 4 &&
    s.cash > 65000
  )
    action(() => G.buildFloor(s, studio.id, "room", room));
  if (!s.event && s.company.phase >= 4 && s.cash > 140000 && !s.company.departments.finance.head) {
    const d = s.company.departments.finance;
    let available = d.pool.filter((candidate) => candidate.skill >= 60);
    if (!available.length && s.week % 4 === 1)
      available = (action(() => G.recruitExecs(s, "finance")) || []).filter(
        (candidate) => candidate.skill >= 60,
      );
    if (available.length) action(() => G.hireHead(s, "finance", available[0].id));
  }
  if (!s.event && G.ipoRequirements(s)?.ready) G.goPublic(s);
}

/**
 * Long-term growth (3.0): build and level facility floors, hire, train and promote department heads.
 * `grow` is how freely a policy spends on it (0 never; 1 whenever there is plenty of cash).
 */
function grow(s, policy) {
  if (!policy.grow || s.event) return;
  const spare = (n) => s.cash > (n * 1.5) / policy.grow + 20000;
  for (const b of s.company.buildings) {
    const def = G.BUILDINGS.find((x) => x.id === b.id);
    const built = new Set(G.allFloors(s).map((f) => f.floor.type));
    const type = def.floors.find((t) => t !== "room" && !built.has(t));
    if (type && b.floors.length < def.maxFloors && spare(G.floorQuote(s, b.id, type)))
      action(() => G.buildFloor(s, b.id, type));
    if (s.event) return;
  }
  for (const { building, index, floor } of G.allFloors(s)) {
    if (floor.type === "room" || floor.level >= G.floorLevelCap(s)) continue;
    if (s.company.buildings.find((b) => b.id === building).floors.some((f) => f.renovating)) continue;
    if (spare(G.floorUpgradeCost(floor))) action(() => G.upgradeFloor(s, building, index));
    if (s.event) return;
  }
  for (const d of G.DEPARTMENTS) {
    if (s.event || !G.departmentOpen(s, d.id)) continue;
    const dept = s.company.departments[d.id];
    if (!dept.head && spare(4000)) {
      if (!dept.pool.length && s.week % 8 === 1) action(() => G.recruitExecs(s, d.id));
      const best = dept.pool.toSorted((a, b) => b.skill - a.skill)[0];
      // Only a head the label can pay for half a year.
      if (best && spare(best.salary * 26)) action(() => G.hireHead(s, d.id, best.id));
    }
    if (!dept.head || s.event) continue;
    const g = G.growthInfo(s, "head", d.id);
    if (g.promotion?.ready) action(() => G.promoteHead(s, d.id));
    else if (!g.train.wait && g.train.gain > 0 && spare(g.train.cost))
      action(() => G.trainPerson(s, "head", d.id));
  }
}

/** Yearly progress readings for the pacing report. */
function measure(s) {
  const levels = s.artists.map((a) => G.level(a)).toSorted((a, b) => b - a),
    floors = G.allFloors(s)
      .filter((f) => f.floor.type !== "room")
      .map((f) => f.floor.level),
    heads = Object.values(s.company.departments || {})
      .map((d) => d.head?.skill)
      .filter(Number.isFinite),
    talent = s.artists.map((a) => a.talent).toSorted((a, b) => b - a);
  const avg = (list) =>
    list.length ? Math.round((list.reduce((n, x) => n + x, 0) / list.length) * 10) / 10 : 0;
  return {
    artistLevel: levels[0] || 0,
    topThreeLevel: avg(levels.slice(0, 3)),
    craft: avg(talent.slice(0, 3)),
    floorLevel: Math.max(0, ...floors),
    averageFloor: avg(floors),
    headSkill: avg(heads),
    value: Math.round(G.companyValuation?.(s)?.value ?? 0),
  };
}

function work(s, name, policy) {
  for (const a of s.artists) {
    if (s.event) return;
    if (G.busy(s, a.id) || !a.contract.remaining) continue;
    if (policy.lobby && s.cash > 12000) {
      const training = G.trainingInfo(s, a);
      if (training.gain > 0 && !training.wait && a.energy >= 30) action(() => G.train(s, a.id));
      if (s.event) return;
    }
    const booth = s.booths.find((b) => !s.albums.some((p) => !p.released && p.booth === b.id));
    // A policy spends what the artist's tier allows.
    const budget = Math.min(s.cash > 60000 ? policy.budget : 4000, G.tierInfo(a).budget);
    if (booth && a.energy >= 35 && G.inspirationInfo(a).canRecord && s.cash >= budget + policy.reserve) {
      // Under low creative freedom a risky theme needs the board's approval; a careful CEO avoids it.
      const lowFreedom = s.company.board?.freedom === "low";
      const theme = s.themes
        .filter((t) => !lowFreedom || !G.APPROVAL.riskyThemes.includes(t))
        .toSorted((x, y) => G.comboFit(a.genre, [y]).points - G.comboFit(a.genre, [x]).points)[0];
      const p = action(() =>
        G.record(s, {
          artistId: a.id,
          boothId: booth.id,
          genre: a.genre,
          audience: a.audience,
          budget,
          title: `W${s.week}-${a.id}`,
          themes: [theme],
        }),
      );
      if (p || s.event) continue;
    }
    const gigs = G.GIGS.map(({ id }) => G.gigQuote(s, a.id, id)).filter(({ ready }) => ready);
    const gig = gigs.toSorted((x, y) => y.pay.expected - x.pay.expected)[0];
    if (gig && (name !== "reckless" || s.cash < 10000)) G.playGig(s, a.id, gig.id);
  }
}

function run(seed, name, policy) {
  const s = G.create(seed, { ceo: true });
  const phaseByYear = [],
    progress = [];
  while (!s.finished) {
    clearDecisions(s, name);
    if (s.finished) break;
    fund(s, name, policy);
    lobby(s, policy.lobby || (name === "reckless" && s.company.ownership > 0.5));
    manage(s, name, policy);
    clearDecisions(s, name);
    grow(s, policy);
    clearDecisions(s, name);
    produce(s);
    work(s, name, policy);
    clearDecisions(s, name);
    produce(s);
    if (s.week % 52 === 0) {
      const year = G.operatingYear(s.week);
      for (const genre of G.GENRES) {
        const p = G.awardEligible(s, year, genre).toSorted((a, b) => b.quality - a.quality)[0];
        if (p) G.enterAwards(s, year, genre, p.id);
      }
    }
    const year = G.operatingYear(s.week);
    G.advance(s);
    if (year !== G.operatingYear(s.week) || s.finished) {
      phaseByYear[year - 1] = s.company.phase;
      progress[year - 1] = measure(s);
    }
  }
  const f = G.finalReview(s);
  return {
    seed,
    phaseByYear,
    progress,
    peaks: peakYears(progress),
    phase: s.company.phase,
    ending: f.ending,
    year: f.yearsPlayed,
    ipoYear: s.company.offering ? G.operatingYear(s.company.offering.week) : null,
    score: f.score.total,
    stars: f.score.stars,
    releases: s.albums.filter((p) => p.released).length,
    hits: s.albums.filter((p) => p.hit).length,
    revenue: G.yearRevenue(s),
    fame: s.fame,
    cash: s.cash,
    confidence: s.company.board?.confidence ?? null,
    lostToRivals: (s.company.rivals || []).reduce((n, r) => n + r.roster.filter((x) => x.from).length, 0),
    battles: s.albums.filter((p) => p.battle).length,
    battlesWon: s.albums.filter((p) => p.battle?.won).length,
  };
}

/** The year each measure first reaches its highest value in the run. */
function peakYears(progress) {
  const keys = Object.keys(progress[0] || {});
  return Object.fromEntries(
    keys.map((k) => {
      const values = progress.map((x) => x?.[k] ?? 0),
        top = Math.max(...values);
      return [k, values.findIndex((v) => v >= top) + 1];
    }),
  );
}

const quick = process.argv.includes("--quick");
// SEEDS=n runs a wider sample without rewriting CEO-BALANCE.json.
const report = { seeds: Number(process.env.SEEDS || (quick ? 2 : 12)), policies: {} };
for (const [name, policy] of Object.entries(policies)) {
  const runs = Array.from({ length: report.seeds }, (_, i) => run(i + 1, name, policy));
  const fired = runs.filter((r) => r.ending === "fired").length;
  const folded = runs.filter((r) => r.ending === "folded").length;
  const listedByYear12 = runs.filter((r) => r.ipoYear && r.ipoYear <= 12).length;
  const full = runs.filter((r) => r.year >= 20);
  const median = (list) => list.toSorted((a, b) => a - b)[Math.floor(list.length / 2)] ?? null;
  const peaks = full.length
    ? Object.fromEntries(Object.keys(full[0].peaks).map((k) => [k, median(full.map((r) => r.peaks[k]))]))
    : {};
  report.policies[name] = { fired, folded, listedByYear12, medianPeakYear: peaks, runs };
  console.log(
    `${name}: ${fired} fired, ${folded} folded, ${listedByYear12} listed by year 12 · phases ${runs.map((r) => r.phase).join(", ")}`,
  );
  console.log(`  median peak year (20-year runs): ${JSON.stringify(peaks)}`);
  const sum = (k) => runs.reduce((n, r) => n + r[k], 0);
  console.log(
    `  rivals: ${sum("lostToRivals")} artists lost to bids, ${sum("battlesWon")} of ${sum("battles")} chart battles won`,
  );
  if (quick) console.log(runs);
}
if (!quick && !process.env.SEEDS)
  fs.writeFileSync(path.join(__dirname, "../CEO-BALANCE.json"), JSON.stringify(report, null, 2) + "\n");
