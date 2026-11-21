// The story engine (3.0, T54): arcs of beats with conditions, flags, waits and follow-ups, played as
// decision cards, with a story log per character. CEO runs only.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { STORY_RULES } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
/** A CEO run with one artist and, optionally, a recent hit. */
function label({ hit = true, castId } = {}) {
  const s = G.create(61, { ceo: true });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  if (castId) a.castId = castId;
  if (hit)
    s.albums.push({ id: 900, artist: a.id, released: true, quality: 82, releaseWeek: s.week, title: "Hit" });
  return { s, a };
}
/** Plays one due beat for the artist from the given arc and resolves the chosen option. */
function playAndChoose(s, arcId, choice) {
  const due = G.storyDue(s).find((x) => x.arc.id === arcId);
  assert.ok(due, `${arcId} is due`);
  G.playStory(s, due);
  s.event = s.eventQueue.shift();
  assert.equal(s.event.type, "story");
  G.choose(s, choice);
  return due;
}
const run = (s, arc) => s.company.stories.arcs.find((r) => r.arc === arc);

test("an arc starts only when its conditions hold", () => {
  const { s } = label({ hit: false });
  assert.ok(!G.storyDue(s).some((x) => x.arc.id === "first-hit"));
  const { s: t } = label();
  assert.ok(G.storyDue(t).some((x) => x.arc.id === "first-hit"));
  t.week += 10;
  assert.ok(!G.storyDue(t).some((x) => x.arc.id === "first-hit"), "only soon after the release");
});

test("a choice applies its effects, sets flags, logs the beat and names the next one", () => {
  const { s, a } = label();
  const morale = a.morale,
    xp = a.xp || 0;
  playAndChoose(s, "first-hit", 0);
  assert.equal(a.morale, Math.min(100, morale + 4));
  assert.equal(a.xp, xp + 2);
  const r = run(s, "first-hit");
  assert.deepEqual(r.flags, { pushed: true });
  assert.equal(r.next, "crowd");
  assert.equal(r.done, false);
  const log = G.storyLog(s, a);
  assert.equal(log.length, 1);
  assert.match(log[0].title, new RegExp(a.name));
  assert.equal(log[0].choice, "Back to the studio while it's hot");
});

test("a follow-up waits for its delay, the character's gap and its own conditions", () => {
  const { s, a } = label();
  playAndChoose(s, "first-hit", 1);
  a.fame = 10;
  s.week += 6;
  assert.ok(!G.storyDue(s).length, "too soon for the same character");
  s.week += STORY_RULES.personGap;
  assert.ok(!G.storyDue(s).some((x) => x.beat.id === "crowd"), "needs 30 fame");
  a.fame = 40;
  const due = G.storyDue(s).find((x) => x.beat.id === "crowd");
  assert.ok(due);
  assert.equal(due.weight, STORY_RULES.continueWeight);
  playAndChoose(s, "first-hit", 0);
  assert.equal(run(s, "first-hit").done, true);
  assert.equal(G.storyLog(s, a).length, 2);
  assert.ok(!G.storyDue(s).some((x) => x.arc.id === "first-hit"), "an arc plays once per artist");
});

test("cast arcs belong to their cast artist, and flags steer the ending", () => {
  const plain = label().s;
  assert.ok(!G.storyDue(plain).some((x) => x.arc.id === "viral-curse"));
  const { s, a } = label({ castId: "tiny-cobra" });
  s.company.stories = { arcs: [], log: {}, lastWeek: -10 };
  playAndChoose(s, "viral-curse", 1);
  assert.deepEqual(run(s, "viral-curse").flags, { embraced: false });
  assert.equal(run(s, "viral-curse").done, true, "dropping the song ends it");
  const other = label({ castId: "tiny-cobra" });
  playAndChoose(other.s, "viral-curse", 0);
  other.s.week += 10 + STORY_RULES.personGap;
  const fans = other.a.fans;
  playAndChoose(other.s, "viral-curse", 0);
  assert.ok(other.a.fans > fans);
  assert.equal(run(other.s, "viral-curse").flags.remixed, true);
  assert.equal(a.castId, "tiny-cobra");
});

test("weekly play: one beat at a time, spaced by the gap, and beats do turn up", () => {
  const { s } = label();
  let seen = 0;
  for (let w = 0; w < 60; w++) {
    while (s.event) {
      if (s.event.type === "story") seen++;
      G.choose(s, 0);
    }
    for (const x of [...(s.company?.inbox || [])]) G.decide(s, x.id, 0);
    G.advance(s);
    assert.ok([s.event, ...s.eventQueue].filter((e) => e?.type === "story").length <= 1);
  }
  assert.ok(seen >= 1, "a hit leads to a story within a year");
  const weeks = Object.values(s.company.stories.log)
    .flat()
    .map((x) => x.week)
    .sort((x, y) => x - y);
  for (let i = 1; i < weeks.length; i++) assert.ok(weeks[i] - weeks[i - 1] >= STORY_RULES.gap);
});

test("a queued beat is dropped when its artist leaves", () => {
  const { s, a } = label();
  G.playStory(
    s,
    G.storyDue(s).find((x) => x.arc.id === "first-hit"),
  );
  s.artists = s.artists.filter((x) => x !== a);
  G.advance(s);
  assert.ok([s.event, ...s.eventQueue].every((e) => e?.type !== "story" || e.artist !== a.id));
  assert.equal(run(s, "first-hit").done, true);
});

test("saves keep story state and refuse broken ones; classic runs have none", () => {
  const { s } = label();
  playAndChoose(s, "first-hit", 0);
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.stories.arcs[0].next = "nowhere";
  assert.equal(G.validSystemsSave(bad), false);
  const old = roundTrip(s);
  delete old.company.stories;
  assert.ok(G.validSystemsSave(old));
  const c = G.create(61, { ceo: false });
  for (let w = 0; w < 20; w++) {
    while (c.event) G.choose(c, 0);
    G.advance(c);
  }
  assert.equal(c.company, undefined);
  assert.ok([c.event, ...c.eventQueue].every((e) => e?.type !== "story"));
});

console.log(`\n${count} story engine tests passed.`);
