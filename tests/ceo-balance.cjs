// Run from any directory. The sample uses game actions and fixed seeds.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = require("../src/engine");
const { COMPANY_EVENTS } = require("../src/data/events");

const policies = {
  careful: { artists: 4, reserve: 1400, budget: 12000, funding: 0, lobby: true },
  average: { artists: 3, reserve: 850, budget: 8000, funding: 0, lobby: false },
  reckless: { artists: 4, reserve: 600, budget: 12000, funding: 1, lobby: false },
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
  const options = entry.options.map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.defer && G.eventOptionAvailable(s, option, entry) &&
      !(option.cost && board?.freedom !== "high" && board?.confidence < G.APPROVAL.grant &&
        board.spent + option.cost > board.budget));
  if (entry.type === "approval") return options[0].index;
  if (!options.length) return entry.options.findIndex((option) => option.defer);
  if (entry.type !== "companyEvent") return options[Math.min(1, options.length - 1)].index;
  const choices = events.get(entry.eventId).choices;
  function merit(option) {
    const choice = choices[option.choice];
    const { cash = 0, fame = 0, morale = 0, confidence = 0, artistFame = 0, delayAlbum = 0 } = choice.effects || {};
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
    if (p.released || p.production.cooldown || s.event) continue;
    if (p.production.releaseReady) {
      G.releaseAlbum(s, p.id, p.title, "fans");
      p.launchReview = false;
      continue;
    }
    if (!p.production.review) {
      const option = [0, 1, 2].toSorted((a, b) => G.stagePreview(s, p, b).expected - G.stagePreview(s, p, a).expected)[0];
      G.decideStage(s, p.id, option);
    }
    G.continueProduction(s, p.id);
  }
}

function fund(s, name, policy) {
  const offers = G.fundingOffers(s);
  if (s.week === 1 || (name === "careful" && s.cash < 7000 && s.company.phase > 1 &&
    !s.company.loan && s.artists.some((a) => a.contract.remaining > 0)))
    G.takeFunding(s, "loan");
  const kind = s.company.phase === 2 ? "angel" : "venture";
  const equity = offers.filter((offer) => offer.kind === kind);
  if (equity.length && (kind === "angel" || name === "reckless" || s.cash < 25000))
    G.takeFunding(s, kind, policy.funding);
}

function lobby(s, enabled) {
  if (!enabled || !s.company.board || s.company.board.meetingWeek === s.week) return;
  const director = s.company.board.directors.filter((d) => d.relationship < G.LOBBY.maxRelationship)
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
  if (!s.event && s.artists.length < desired && s.reputation >= 30) {
    const candidate = s.candidates.toSorted((a, b) => b.talent - a.talent)[0];
    if (candidate && s.cash > G.contractQuote(s, candidate, 3).fee + policy.reserve)
      action(() => G.sign(s, candidate.id, 3));
    else if (!candidate && s.cash > policy.reserve + 5000)
      action(() => G.paidScout(s, G.scoutLimits(s).budget));
  }
  if (s.event) return;
  const room = G.BOOTHS.findIndex((booth, index) =>
    booth.labelTier <= s.company.phase && !s.booths.some(({ id }) => id === index));
  if (s.company.phase >= 2 && s.cash > 38000 && !s.company.buildings.some(({ id }) => id === "storefront"))
    action(() => G.buyBuilding(s, "storefront"));
  const storefront = s.company.buildings.find(({ id }) => id === "storefront");
  if (!s.event && room >= 0 && storefront && s.booths.length < s.artists.length && storefront.floors.length < 3 && s.cash > 45000)
    action(() => G.buildFloor(s, storefront.id, "room", room));
  if (!s.event && s.company.phase >= 3 && s.cash > 110000 && !s.company.buildings.some(({ id }) => id === "studio"))
    action(() => G.buyBuilding(s, "studio"));
  const studio = s.company.buildings.find(({ id }) => id === "studio");
  if (!s.event && room >= 0 && !s.booths.some(({ id }) => id === room) &&
    studio && s.booths.length < s.artists.length && studio.floors.length < 4 && s.cash > 65000)
    action(() => G.buildFloor(s, studio.id, "room", room));
  if (!s.event && s.company.phase >= 4 && s.cash > 140000 && !s.company.departments.finance.head) {
    const d = s.company.departments.finance;
    let available = d.pool.filter((candidate) => candidate.skill >= 60);
    if (!available.length && s.week % 4 === 1)
      available = (action(() => G.recruitExecs(s, "finance")) || []).filter((candidate) => candidate.skill >= 60);
    if (available.length) action(() => G.hireHead(s, "finance", available[0].id));
  }
  if (!s.event && G.ipoRequirements(s)?.ready) G.goPublic(s);
}

function work(s, name, policy) {
  for (const a of s.artists) {
    if (s.event) return;
    if (G.busy(s, a.id) || !a.contract.remaining) continue;
    if (policy.lobby && a.talent < a.potential && s.cash > 12000) {
      const training = G.trainingInfo(s, a);
      if (training.available) action(() => G.train(s, a.id));
      if (s.event) return;
    }
    const booth = s.booths.find((b) => !s.albums.some((p) => !p.released && p.booth === b.id));
    const budget = s.cash > 60000 ? policy.budget : 4000;
    if (booth && a.energy >= 35 && G.inspirationInfo(a).canRecord && s.cash >= budget + policy.reserve) {
      const theme = s.themes.toSorted((x, y) => G.comboFit(a.genre, [y]).points - G.comboFit(a.genre, [x]).points)[0];
      const p = action(() => G.record(s, {
        artistId: a.id, boothId: booth.id, genre: a.genre, audience: a.audience, budget,
        title: `W${s.week}-${a.id}`, themes: [theme],
      }));
      if (p || s.event) continue;
    }
    const gigs = G.GIGS.map(({ id }) => G.gigQuote(s, a.id, id)).filter(({ ready }) => ready);
    const gig = gigs.toSorted((x, y) => y.pay.expected - x.pay.expected)[0];
    if (gig && (name !== "reckless" || s.cash < 10000)) G.playGig(s, a.id, gig.id);
  }
}

function run(seed, name, policy) {
  const s = G.create(seed, { ceo: true });
  const phaseByYear = [];
  while (!s.finished) {
    clearDecisions(s, name);
    if (s.finished) break;
    fund(s, name, policy);
    lobby(s, policy.lobby || (name === "reckless" && s.company.ownership > 0.5));
    manage(s, name, policy);
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
    if (year !== G.operatingYear(s.week) || s.finished) phaseByYear[year - 1] = s.company.phase;
  }
  const f = G.finalReview(s);
  return {
    seed, phaseByYear, phase: s.company.phase, ending: f.ending, year: f.yearsPlayed,
    ipoYear: s.company.offering ? G.operatingYear(s.company.offering.week) : null,
    score: f.score.total, stars: f.score.stars,
    releases: s.albums.filter((p) => p.released).length,
    hits: s.albums.filter((p) => p.hit).length,
    revenue: G.yearRevenue(s), fame: s.fame, cash: s.cash,
    confidence: s.company.board?.confidence ?? null,
  };
}

const quick = process.argv.includes("--quick");
const report = { seeds: quick ? 2 : 12, policies: {} };
for (const [name, policy] of Object.entries(policies)) {
  const runs = Array.from({ length: report.seeds }, (_, i) => run(i + 1, name, policy));
  const fired = runs.filter((r) => r.ending === "fired").length;
  const folded = runs.filter((r) => r.ending === "folded").length;
  const listedByYear12 = runs.filter((r) => r.ipoYear && r.ipoYear <= 12).length;
  report.policies[name] = { fired, folded, listedByYear12, runs };
  console.log(`${name}: ${fired} fired, ${folded} folded, ${listedByYear12} listed by year 12 · phases ${runs.map((r) => r.phase).join(", ")}`);
  if (quick) console.log(runs);
}
if (!quick) fs.writeFileSync(path.join(__dirname, "../CEO-BALANCE.json"), JSON.stringify(report, null, 2) + "\n");
