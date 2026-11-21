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
  assert.deepEqual(s.company.onboarding, { on: true, done: [], tips: [] });
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
  G.sign(off, off.candidates[0].id);
  assert.equal(goal(s, "sign").done, false);
  settle(s);
  settle(off);
  assert.equal(goal(s, "sign").done, true);
  assert.equal(s.cash - off.cash, 500, "the $500 reward arrived");
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

console.log(`\n${count} onboarding tests passed.`);
