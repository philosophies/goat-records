// The first fifteen minutes (3.0, T59): the starter checklist, its rewards, skipping, the fast first
// album and one-time tips.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
const goal = (s, id) => G.starterGoals(s)?.find((g) => g.id === id);
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  for (const x of [...(s.company?.inbox || [])]) G.decide(s, x.id, 0);
  s.albums.forEach((p) => (p.launchReview = false));
  G.advance(s);
}

test("new CEO runs start with the checklist; classic runs, old saves and second acts do not", () => {
  const s = G.create(111, { ceo: true });
  assert.deepEqual(s.company.onboarding, { on: true, done: [], tips: [], mentor: { on: true, seen: [] } });
  assert.equal(G.starterGoals(s).length, 5);
  assert.equal(G.create(111, { ceo: false }).company, undefined);
  const old = roundTrip(s);
  delete old.company.onboarding;
  old.week = 40;
  assert.equal(G.migrate(old).company.onboarding, undefined);
});

test("a goal pays its reward once, at the settlement after it is met", () => {
  const s = G.create(111, { ceo: true });
  s.cash = 50000;
  G.sign(s, s.candidates[0].id);
  const off = G.create(111, { ceo: true });
  off.cash = 50000;
  G.setStarter(off, false);
  const advance = G.contractQuote(off, off.candidates[0], 3).fee;
  G.sign(off, off.candidates[0].id);
  assert.equal(s.cash - off.cash, advance, "with the checklist on, the first signing was free");
  assert.equal(goal(s, "sign").done, false);
  settle(s);
  settle(off);
  assert.equal(goal(s, "sign").done, true);
  assert.equal(s.cash - off.cash, advance + 500, "the $500 reward arrived");
  const again = s.cash;
  settle(s);
  assert.ok(G.starterGoals(s).filter((g) => g.id === "sign" && g.done).length === 1);
  assert.ok(s.news.filter((n) => /Starter goal done: Sign your first artist/.test(n)).length === 1);
  assert.ok(Number.isFinite(again));
});

test("the run's first album skips the waits and comes out by week 6", () => {
  const s = G.create(111, { ceo: true });
  s.cash = 50000;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, inspiration: 80 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  const p = s.albums[0],
    d = p.production;
  for (let i = 0; i < 6 && !p.released; i++) {
    for (let k = 0; k < 6 && !d.cooldown && !d.releaseReady && (d.stage < 5 || d.review); k++) {
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    if (d.releaseReady) G.releaseAlbum(s, p.id, p.title);
    else settle(s);
  }
  assert.ok(p.released, "released");
  assert.ok(p.releaseWeek <= 6, `week ${p.releaseWeek}`);
  // The second album waits as usual.
  G.setStarter(s, true);
  s.albums.push({
    ...p,
    id: 1e6,
    released: false,
    production: { ...d, stage: 1, review: true, cooldown: 0, releaseReady: false },
  });
  G.continueProduction(s, 1e6);
  assert.equal(s.albums.at(-1).production.cooldown, 1);
});

test("skipping turns the checklist and fast album off; it can be turned back on", () => {
  const s = G.create(111, { ceo: true });
  G.setStarter(s, false);
  assert.equal(G.starterGoals(s), null);
  s.cash = 50000;
  G.sign(s, s.candidates[0].id);
  settle(s);
  assert.deepEqual(s.company.onboarding.done, [], "no rewards while off");
  G.setStarter(s, true);
  settle(s);
  assert.ok(goal(s, "sign").done);
  const c = G.create(111, { ceo: false });
  assert.throws(() => G.setStarter(c, true), /no starter checklist/);
});

test("tips appear once, the first time each matters, and stay quiet when off", () => {
  const s = G.create(111, { ceo: true });
  G.checkTips(s);
  assert.equal(s.notifications.filter((n) => n.kind === "tip").length, 0, "nothing matters yet");
  s.company.phase = 2;
  G.checkTips(s);
  const tips = () => s.notifications.filter((n) => n.kind === "tip").map((n) => n.title);
  assert.deepEqual(tips(), ["Tip: a star slot is open"]);
  G.checkTips(s);
  assert.equal(tips().length, 1, "once only");
  G.setStarter(s, false);
  G.takeFunding(s, "angel", 0);
  G.checkTips(s);
  assert.equal(tips().length, 1, "off: no notice");
  assert.ok(s.company.onboarding.tips.includes("board"), "but remembered");
});

test("the checklist switches itself off when every goal is done", () => {
  const s = G.create(111, { ceo: true });
  s.company.onboarding.done = ["sign", "stage", "release", "chart"];
  s.cash += 0;
  for (let i = 0; i < 6 && s.company.onboarding.on; i++) settle(s);
  // A week in profit finishes it (the first weeks have beat sales and few costs).
  assert.equal(s.company.onboarding.on, false);
  assert.equal(s.company.onboarding.done.length, 5);
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.onboarding.done.push("nope");
  assert.equal(G.validSystemsSave(bad), false);
});

test("the checklist pays for the first signing and the first album's base budget, once", () => {
  const s = G.create(112, { ceo: true }),
    start = s.cash;
  assert.deepEqual(G.starterFree(s), { signing: true, album: true });
  const c = s.candidates[0];
  assert.equal(G.signingFee(s, c, G.contractQuote(s, c, 3)), 0);
  G.sign(s, c.id, 3);
  assert.equal(s.cash, start, "no advance");
  assert.deepEqual(G.starterFree(s), { signing: false, album: true });
  const next = s.candidates[0],
    q = G.contractQuote(s, next, 1);
  assert.equal(G.signingFee(s, next, q), q.fee, "the second signing is paid");
  const a = s.artists[0],
    plan = { artistId: a.id, boothId: s.booths[0].id, genre: a.genre, audience: a.audience, budget: 4000 };
  Object.assign(a, { energy: 100, inspiration: 90 });
  const video = G.ALBUM_ADDONS.find((x) => x.id === "video") || G.ALBUM_ADDONS[0];
  s.cash = video.cost;
  G.record(s, { ...plan, addOns: [video.id] });
  assert.equal(s.cash, 0, "add-ons are still paid; the base budget is not");
  assert.equal(s.albums[0].baseBudget, 4000, "the album is still made on its full budget");
  assert.deepEqual(G.starterFree(s), { signing: false, album: false });
  assert.equal(G.planCost(s, plan), 0, "the second album is paid");
});

test("with the checklist off, nothing is free", () => {
  const s = G.create(113, { ceo: true });
  G.setStarter(s, false);
  s.cash = 50000;
  assert.deepEqual(G.starterFree(s), { signing: false, album: false });
  const c = s.candidates[0],
    q = G.contractQuote(s, c, 1);
  assert.equal(G.signingFee(s, c, q), q.fee);
  G.sign(s, c.id, 1);
  assert.equal(s.cash, 50000 - q.fee);
  const a = s.artists[0];
  assert.equal(
    G.planCost(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 }),
    0,
  );
});

test("a new label can finish every starter goal without borrowing", () => {
  for (const seed of [114, 115, 116, 117, 118]) {
    const s = G.create(seed, { ceo: true });
    G.sign(s, s.candidates[0].id, 1);
    const a = s.artists[0];
    G.record(s, {
      artistId: a.id,
      boothId: s.booths[0].id,
      genre: a.genre,
      audience: a.audience,
      budget: 4000,
    });
    let low = s.cash;
    for (let w = 0; w < 30 && G.starterGoals(s); w++) {
      const p = s.albums.find((x) => !x.released);
      if (p) {
        if (p.production.releaseReady) {
          p.launchReview = false;
          G.releaseAlbum(s, p.id, p.title, "fans");
        } else if (p.production.review) G.continueProduction(s, p.id);
        else if (!p.production.cooldown) G.decideStage(s, p.id, 1);
        if (s.week === 1 || p.production.review || p.production.releaseReady || !p.production.cooldown)
          continue;
      }
      settle(s);
      low = Math.min(low, s.cash);
    }
    assert.equal(G.starterGoals(s), null, `seed ${seed}: every goal done (the checklist switched off)`);
    assert.ok(!s.company.loan, `seed ${seed}: no bank loan`);
    assert.ok(low >= 0, `seed ${seed}: cash never below $0 (lowest $${low})`);
  }
});

/** Plays a new label through the checklist, reading every mentor beat, and returns the beats seen in order. */
function playWithMentor(seed) {
  const s = G.create(seed, { ceo: true }),
    order = [];
  const read = () => {
    const b = G.mentorBeat(s);
    if (b && order.at(-1) !== b.id) order.push(b.id);
    if (b && !b.seen && b.kind !== "pointers") G.mentorSeen(s, b.id);
  };
  read();
  read();
  G.sign(s, s.candidates[0].id, 1);
  read();
  read();
  const a = s.artists[0];
  G.record(s, {
    artistId: a.id,
    boothId: s.booths[0].id,
    genre: a.genre,
    audience: a.audience,
    budget: 4000,
  });
  for (let w = 0; w < 40 && G.mentorBeat(s); w++) {
    read();
    const p = s.albums.find((x) => !x.released);
    if (p) {
      if (p.production.releaseReady) G.releaseAlbum(s, p.id, p.title, "fans");
      else if (p.production.review) G.continueProduction(s, p.id);
      else if (!p.production.cooldown) G.decideStage(s, p.id, 1);
      if (p.production.review || p.production.releaseReady || !p.production.cooldown) continue;
    }
    // The release-day results are acknowledged before the week turns, as in play.
    s.albums.forEach((x) => (x.launchReview = false));
    read();
    read();
    settle(s);
    read();
  }
  return { s, order };
}

test("the mentor talks the player through the checklist, in order, then retires", () => {
  const { s, order } = playWithMentor(121);
  assert.deepEqual(
    order,
    G.MENTOR.beats.map((b) => b.id),
    "every beat, in order",
  );
  assert.equal(G.mentorBeat(s), null, "gone after the farewell");
  assert.equal(s.company.onboarding.mentor.on, false);
  assert.ok(s.company.onboarding.mentor.seen.includes("farewell"));
  assert.equal(G.starterGoals(s), null, "and the checklist is done");
});

test("every beat has words, and every talk has a way forward", () => {
  for (const b of G.MENTOR.beats) {
    assert.ok(["talk", "pointers", "note"].includes(b.kind), b.id);
    assert.ok(b.title, b.id);
    if (b.kind === "pointers") assert.ok(b.place && b.here.length >= 3, b.id);
    else assert.ok(b.text.length >= 2, b.id);
    if (b.kind === "talk") assert.ok(b.goLabel, b.id);
  }
});

test("a beat stays until it is read; reading moves the mentor on", () => {
  const s = G.create(122, { ceo: true });
  let b = G.mentorBeat(s);
  assert.equal(b.id, "intro");
  assert.equal(b.seen, false);
  assert.equal(b.step, 1);
  G.advance(s);
  assert.equal(G.mentorBeat(s).id, "intro", "time does not skip a talk");
  b = G.mentorSeen(s, "intro");
  assert.equal(b.id, "desk");
  assert.equal(b.kind, "pointers");
  assert.throws(() => G.mentorSeen(s, "nope"), /Nothing to read/);
});

test("skipping the checklist sends the mentor home; letting him go keeps the checklist", () => {
  const s = G.create(123, { ceo: true });
  G.setStarter(s, false);
  assert.equal(G.mentorBeat(s), null);
  G.setStarter(s, true);
  assert.equal(G.mentorBeat(s).id, "intro", "back with the checklist");
  G.setMentor(s, false);
  assert.equal(G.mentorBeat(s), null);
  assert.ok(G.starterGoals(s), "the checklist stays");
  const done = playWithMentor(124).s;
  G.setMentor(done, true);
  G.setStarter(done, true);
  assert.equal(G.mentorBeat(done), null, "after the farewell he stays retired");
});

test("the money talk is not skipped when the chart and a profit come in one week", () => {
  const s = G.create(126, { ceo: true });
  s.company.onboarding.done = ["sign", "stage", "release", "chart", "profit"];
  s.company.onboarding.mentor.seen = ["intro", "artist", "charts"];
  assert.equal(G.mentorBeat(s).id, "money");
  G.mentorSeen(s, "money");
  assert.equal(G.mentorBeat(s).id, "farewell");
});

test("saves keep the mentor; older saves load without one, and bad ones are refused", () => {
  const s = G.create(125, { ceo: true });
  G.mentorSeen(s, "intro");
  const copy = roundTrip(s);
  assert.ok(G.validSystemsSave(copy));
  assert.deepEqual(copy.company.onboarding.mentor, { on: true, seen: ["intro"] });
  const old = roundTrip(s);
  delete old.company.onboarding.mentor;
  assert.ok(G.validSystemsSave(old));
  assert.equal(G.mentorBeat(old), null, "no mentor in a run started before him");
  const bad = roundTrip(s);
  bad.company.onboarding.mentor.seen.push("speech");
  assert.equal(G.validSystemsSave(bad), false);
});

console.log(`\n${count} onboarding tests passed.`);
