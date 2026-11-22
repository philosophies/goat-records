// Playability fuzz (T70): a random player tries every kind of action, week after week. A refused
// action (an Error with a message for the player) is fine; anything else is a bug. After each week
// the save must round-trip through the load checks, the numbers must stay finite, and the run must
// never stall: a waiting card can always be answered, and a ready album can always be released.
// FUZZ_SEEDS and FUZZ_WEEKS make a longer run (the audit used 40 × 1040).
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
const SEEDS = Number(process.env.FUZZ_SEEDS || 4),
  WEEKS = Number(process.env.FUZZ_WEEKS || 260);

let rnd = 1;
const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (list) => (list.length ? list[Math.floor(rand() * list.length)] : undefined);
const BUG = (e) => !(e instanceof Error) || e.constructor !== Error || !e.message;
const problems = [];

const done = {};
function attempt(s, label, fn) {
  try {
    fn();
    done[label] = (done[label] || 0) + 1;
  } catch (e) {
    if (BUG(e))
      problems.push(
        `seed ${s.__seed} week ${s.week} ${label}: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`,
      );
    else if (process.env.FUZZ_DEBUG)
      refused[label + ": " + e.message.slice(0, 70)] =
        (refused[label + ": " + e.message.slice(0, 70)] || 0) + 1;
  }
}
const refused = {};
function actions(s) {
  const a = pick(s.artists),
    p = pick(s.albums.filter((x) => !x.released)),
    out = pick(s.albums.filter((x) => x.released)),
    dept = pick(G.DEPARTMENTS),
    building = pick(G.BUILDINGS),
    rival = pick(G.rivalsInfo(s)),
    offer = pick(s.company?.catalog?.offers || []);
  return [
    ["sign", () => G.sign(s, pick(s.candidates)?.id, pick([1, 3, 5]))],
    ["scout", () => G.paidScout(s, Math.floor(rand() * 3))],
    [
      "record",
      () =>
        G.record(s, {
          artistId: a?.id,
          boothId: pick(s.booths)?.id,
          genre: rand() < 0.8 ? a?.genre : pick(G.GENRES),
          audience: a?.audience,
          budget: pick([4000, 8000, 12000]),
          themes: rand() < 0.5 ? [pick(s.themes || [])].filter(Boolean) : [],
        }),
    ],
    ["stage", () => G.decideStage(s, p?.id, Math.floor(rand() * 3))],
    ["continue", () => G.continueProduction(s, p?.id)],
    ["release", () => G.releaseAlbum(s, p?.id, p?.title, pick(["critics", "fans", "market"]))],
    ["reshuffle", () => G.reshuffle(s, p?.id, Math.floor(rand() * 5))],
    ["single", () => G.releaseSingle(s, p?.id)],
    ["party", () => G.holdParty(s, p?.id)],
    ["partyChoice", () => G.partyChoice(s, p?.id, pick(["rework", "single", "release"]))],
    ["ad", () => G.buyAd(s, out?.id, pick(G.ADS).id)],
    ["renew", () => G.renew(s, a?.id, pick([1, 3, 5]))],
    ["releaseArtist", () => rand() < 0.2 && G.releaseArtist(s, a?.id)],
    ["bonus", () => G.payBonus(s, a?.id)],
    ["train", () => G.train(s, a?.id)],
    ["gig", () => G.playGig(s, a?.id, pick(G.GIGS).id)],
    [
      "tour",
      () =>
        G.startTour(s, { albumId: out?.id, scale: pick(["regional", "national", "world"]), mode: "solo" }),
    ],
    ["cancelTour", () => rand() < 0.1 && G.cancelTour(s, pick(s.tours)?.id)],
    ["tourDay", () => s.tours.some((t) => t.status === "active") && G.advanceTourDay(s)],
    ["loan", () => G.takeFunding(s, "loan")],
    ["repay", () => rand() < 0.2 && G.repayLoan(s)],
    ["fund", () => G.takeFunding(s, pick(["angel", "venture"]), Math.floor(rand() * 2))],
    ["buyBuilding", () => G.buyBuilding(s, building.id)],
    ["buildFloor", () => G.buildFloor(s, building.id, pick(building.floors), "neon")],
    ["upgradeFloor", () => G.upgradeFloor(s, building.id, Math.floor(rand() * 3))],
    ["recruitExecs", () => G.recruitExecs(s, dept.id)],
    ["hireHead", () => G.hireHead(s, dept.id, pick(s.company?.departments?.[dept.id]?.pool || [])?.id)],
    ["addStaff", () => G.addStaff(s, dept.id)],
    ["removeStaff", () => rand() < 0.2 && G.removeStaff(s, dept.id)],
    ["trainHead", () => G.trainPerson(s, "head", dept.id)],
    ["promoteHead", () => G.promoteHead(s, dept.id)],
    ["recruitTeam", () => G.recruitTeam(s, pick(G.TEAM_ROLES).id)],
    ["meet", () => G.meetDirector(s, pick(s.company?.board?.directors || [])?.id)],
    ["negotiateFloor", () => G.negotiateFloor(s)],
    ["bidRival", () => G.bidForRival(s, rival?.id, 0)],
    ["buyRival", () => G.buyRival(s, rival?.id)],
    ["offer", () => G.answerOffer(s, offer?.id, rand() < 0.7)],
    ["delegate", () => G.setDelegation(s, pick(["renew", "tours", "coo"]), { on: rand() < 0.7 })],
    [
      "autopilot",
      () => G.setDelegation(s, "autopilot", { policy: pick([null, "safe", "balanced", "aggressive"]) }),
    ],
    ["ipo", () => G.goPublic(s)],
    ["acquire", () => G.buyAcquisition(s, pick(G.acquisitionOffers(s) || [])?.id, rand() < 0.5)],
    ["awards", () => G.enterAwards(s, G.operatingYear(s.week), out?.genre, out?.id)],
  ];
}
/** Answers every waiting card with a random choice, as a player could. */
function answerCards(s, seed) {
  for (let guard = 0; s.event && guard < 50; guard++) {
    const options = s.event.options;
    const order = options.map((_, i) => i).sort(() => rand() - 0.5);
    let answered = false;
    for (const i of order) {
      try {
        G.choose(s, i);
        answered = true;
        break;
      } catch (e) {
        if (BUG(e)) problems.push(`seed ${seed} week ${s.week} choose ${s.event?.type}: ${e.message}`);
      }
    }
    if (!answered) {
      problems.push(`seed ${seed} week ${s.week}: no choice on "${s.event.title}" can be taken`);
      s.event = null;
    }
  }
}
const finite = (s) =>
  ["cash", "fame", "reputation", "week"].every((k) => Number.isFinite(s[k])) &&
  s.artists.every((a) =>
    ["talent", "fans", "energy", "morale", "trust"].every((k) => Number.isFinite(a[k] ?? 0)),
  ) &&
  (!s.company?.board || Number.isFinite(s.company.board.confidence ?? 0));

for (let seed = Number(process.env.FUZZ_FROM || 1); seed <= SEEDS; seed++) {
  rnd = seed * 7919;
  const s = G.create(seed, { ceo: true, ...(seed % 3 === 0 ? { challenge: pick(G.CHALLENGES).id } : {}) });
  s.__seed = seed;
  // Runs start at every phase, so late systems get played too.
  s.company.phase = Math.max(s.company.phase, 1 + (seed % 6));
  let stuck = 0;
  for (let w = 0; s.week <= WEEKS && w < WEEKS * 2 && !s.finished; w++) {
    // A random player who keeps the lights on: money is topped up, so the run lasts and every
    // system gets its turn. Balance is not under test here.
    if (s.cash < 20000 && !s.finished) s.cash += 50000;
    for (let i = 0; i < 8; i++) {
      const list = actions(s),
        production = list.filter(([l]) => ["record", "stage", "continue", "release", "sign"].includes(l));
      const [label, fn] = pick(rand() < 0.4 ? production : list);
      attempt(s, label, fn);
    }
    answerCards(s, seed);
    const week = s.week;
    let blocked = "";
    try {
      G.advance(s);
    } catch (e) {
      blocked = e.message;
      if (BUG(e))
        problems.push(`seed ${seed} week ${s.week} advance: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
    }
    const days = () => s.tours.reduce((n, x) => n + (x.day || 0), 0),
      daysBefore = days();
    if (s.week === week && !s.finished) {
      // Blocked by an album decision or a tour: a player can always settle it.
      for (const p of s.albums.filter((x) => !x.released)) {
        const d = p.production;
        try {
          if (d.releaseReady) G.releaseAlbum(s, p.id, p.title, "fans");
          else {
            if (!d.review) G.decideStage(s, p.id, 0);
            G.continueProduction(s, p.id);
          }
        } catch {
          // Waiting for its next stage: the week will move it on.
        }
        if (p.launchReview) p.launchReview = false;
      }
      // The release card's Continue button.
      for (const p of s.albums) if (p.launchReview) p.launchReview = false;
      for (let d = 0; d < 7 && s.tours.some((t) => t.status === "active"); d++)
        try {
          answerCards(s, seed);
          G.advanceTourDay(s);
          answerCards(s, seed);
        } catch (e) {
          if (BUG(e)) problems.push(`seed ${seed} week ${s.week} tourDay: ${e.message}`);
          break;
        }
      for (const m of s.milestones || []) attempt(s, "milestone", () => G.acknowledgeMilestone(s, m.id));
      if (process.env.FUZZ_DUMP && stuck === 29)
        require("node:fs").writeFileSync(process.env.FUZZ_DUMP, JSON.stringify(s));
      // Stuck only if neither the week nor a tour day moved.
      if (s.week !== week || days() !== daysBefore) stuck = 0;
      else if (++stuck > 30) {
        problems.push(`seed ${seed}: stuck at week ${s.week}: ${blocked || "no reason given"}`);
        break;
      }
    } else stuck = 0;
    if (!finite(s)) problems.push(`seed ${seed} week ${s.week}: a number is not finite`);
    if (w % 13 === 0 || s.finished) {
      const copy = JSON.parse(JSON.stringify(s));
      if (!G.validSystemsSave(copy) || !G.validManagementSave(copy) || !G.validRoadSave(copy))
        problems.push(`seed ${seed} week ${s.week}: the save fails the load checks`);
    }
    if (problems.length > 20) break;
  }
  if (process.env.FUZZ_DEBUG)
    console.log(
      `seed ${seed}: week ${s.week}, phase ${s.company.phase}, ${s.artists.length} artists, ${s.albums.filter((x) => x.released).length} released, cash ${Math.round(s.cash)}, ${s.finished ? s.outcome : "running"}`,
    );
}
if (process.env.FUZZ_DEBUG) {
  console.log(JSON.stringify(done));
  for (const [k, v] of Object.entries(refused)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25))
    console.log(v, k);
}
if (problems.length) console.log(problems.slice(0, 20).join("\n"));
assert.equal(problems.length, 0, `${problems.length} playability problems`);
console.log(
  `Fuzz: ${SEEDS} random CEO runs of up to ${WEEKS} weeks with no crashes, broken saves or stalls.`,
);
