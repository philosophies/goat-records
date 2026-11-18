// Clock decisions: when time runs, when it holds, and what the top bar says.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js"),
  { clockState, clockReasons, clockLabel, CLOCK_TICK_MS } = require("../src/ui/clock.js");

const fresh = G.create(11);
let c = clockState(fresh, { speed: 0 });
assert.deepEqual([c.run, c.reason, c.held], [false, "paused", false], "a new label is paused");
assert.equal(clockLabel(c, true), "Paused · press 1× to start the clock");
assert.equal(clockLabel(c, false), "Paused");

for (const [speed, interval] of [
  [1, CLOCK_TICK_MS],
  [2, CLOCK_TICK_MS / 2],
  [4, CLOCK_TICK_MS / 4],
]) {
  c = clockState(fresh, { speed });
  assert.equal(c.run, true);
  assert.equal(c.interval, interval);
}
assert.equal(CLOCK_TICK_MS, 4000, "one tick at 1× takes about four seconds");
assert.equal(clockLabel(clockState(fresh, { speed: 2 })), "2× · time is running");
assert.equal(clockState(fresh, { speed: 3 }).run, false, "unknown speeds count as paused");

// Anything waiting on the player holds time; the chosen speed is kept so time resumes afterwards.
const waiting = (patch, ui = { speed: 1 }) => clockState({ ...fresh, ...patch }, ui);
c = waiting({ event: { type: "artist", title: "x" } });
assert.deepEqual([c.run, c.reason, c.held], [false, "industry event", true]);
assert.equal(clockLabel(c), "Paused · industry event");
assert.equal(waiting({ event: { type: "tourDay" } }).reason, "tour decision");
assert.equal(waiting({ event: { type: "awards" } }).reason, "awards night");
assert.equal(waiting({ finished: true }).reason, "run complete");
assert.equal(waiting({ notifications: [{ id: 1 }] }).reason, "chart milestone");
assert.equal(waiting({ notifications: [{ id: 1, kind: "debt" }] }).reason, "cash warning");
assert.equal(waiting({ rankUps: [{ rank: 2, seen: false }] }).reason, "rank up");
assert.equal(waiting({ rankUps: [{ rank: 2, seen: true }] }).run, true, "a seen rank-up does not hold time");
const album = (production, extra = {}) => ({ albums: [{ released: false, production, ...extra }] });
assert.equal(waiting(album({ cooldown: 0 })).reason, "album decision ready");
assert.equal(waiting(album({ cooldown: 0, review: true })).reason, "stage results ready");
assert.equal(waiting(album({ cooldown: 0, releaseReady: true })).reason, "album ready to release");
assert.equal(waiting(album({ cooldown: 2 })).run, true, "an album between decisions lets time run");
assert.equal(waiting(album({}, { released: true, launchReview: true })).reason, "release results");
assert.equal(waiting({}, { speed: 1, productionBlock: true }).reason, "album decision ready");
assert.equal(waiting({}, { speed: 1, blockers: ["menu open"] }).reason, "menu open");
assert.equal(
  waiting({ event: { type: "artist" }, ...album({ cooldown: 0 }) }, { speed: 1, blockers: ["menu open"] })
    .reason,
  "industry event",
  "events come first",
);
assert.deepEqual(
  clockReasons({ ...fresh, ...album({ cooldown: 0 }) }, { blockers: ["building", "building"] }),
  ["album decision ready", "building"],
);

// Once the hold clears, time resumes only if the player had a speed selected.
assert.equal(clockState(fresh, { speed: 1 }).run, true);
c = waiting({ event: { type: "artist" } }, { speed: 0 });
assert.deepEqual([c.run, c.held], [false, false], "a player pause is never resumed automatically");

// Across a real album, the clock holds exactly when the engine blocks advancing.
const s = G.create(5);
s.cash = 100000;
G.sign(s, s.candidates[0].id);
const a = s.artists[0];
G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, title: "Clockwork" });
const p = s.albums[0];
const productionHeld = () =>
  clockReasons(s).some((r) => /album|stage|release results/.test(r)) === G.productionBlock(s);
let checks = 0;
for (let i = 0; i < 40 && !p.released; i++) {
  assert.ok(productionHeld(), "clock and engine agree before a step");
  checks++;
  if (s.event) {
    assert.equal(clockState(s, { speed: 1 }).run, false);
    G.choose(s, 2);
    continue;
  }
  const d = p.production;
  if (d.releaseReady) G.releaseAlbum(s, p.id, p.title);
  else if (d.review) G.continueProduction(s, p.id);
  else if (!d.cooldown) G.decideStage(s, p.id, 0);
  else {
    assert.equal(clockState(s, { speed: 1 }).run, true, "studio weeks pass on the clock");
    G.advance(s);
  }
}
assert.ok(p.released);
assert.equal(clockState(s, { speed: 1 }).reason, "release results");
p.launchReview = false;
assert.ok(productionHeld());
console.log(
  `PASS clock: speeds and tick length, holds for events, album decisions, results, milestones, rank-ups and open menus, resume rules, and ${checks} engine agreement checks.`,
);
