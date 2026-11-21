// Artist levels in CEO runs (3.0, T49): a 30-level career, tier caps, milestone perks and XP sources.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { LEVELS } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(seed = 31) {
  const s = G.create(seed, { ceo: true });
  s.cash = 1e6;
  G.sign(s, s.candidates[0].id);
  return { s, a: s.artists[0] };
}
const at = (n) => LEVELS.xp[n - 1];

test("the curve starts as the classic one and runs to 30", () => {
  assert.equal(LEVELS.xp.length, 30);
  assert.deepEqual(LEVELS.xp.slice(0, 10), G.CAREER_XP);
  for (let i = 2; i < 30; i++)
    assert.ok(LEVELS.xp[i] - LEVELS.xp[i - 1] > LEVELS.xp[i - 1] - LEVELS.xp[i - 2] - 1);
});

test("CEO artists use the long career; classic artists keep ten levels", () => {
  const { a } = ceo();
  assert.equal(a.longCareer, true);
  a.xp = at(11);
  a.tier = "star";
  assert.equal(G.level(a), 11);
  assert.equal(G.levelInfo(a).max, 30);
  const c = G.create(31, { ceo: false });
  G.sign(c, c.candidates[0].id);
  const b = c.artists[0];
  b.xp = 500;
  assert.equal(b.longCareer, undefined);
  assert.equal(G.level(b), 10);
  assert.equal(G.levelInfo(b).max, 10);
  assert.equal(G.levelInfo(b).next, null);
});

test("each tier caps the level, and XP keeps counting past it", () => {
  const { a } = ceo();
  a.xp = at(30);
  for (const [tier, cap] of Object.entries(LEVELS.cap)) {
    a.tier = tier;
    assert.equal(G.level(a), cap);
    const L = G.levelInfo(a);
    assert.equal(L.next, null);
    assert.equal(L.capped, cap < 30);
  }
  a.tier = "rising";
  a.xp = at(5) + 1;
  assert.equal(G.levelInfo(a).next, at(6));
  assert.equal(G.levelInfo(a).capped, false);
});

test("milestone perks add to every stage and to sales", () => {
  const { s, a } = ceo();
  a.tier = "superstar";
  Object.assign(a, { energy: 100, inspiration: 80 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, budget: 4000 });
  const p = s.albums.at(-1);
  const perkRow = () => G.stagePreview(s, p, 0).parts.find((x) => x.name.startsWith("Career perks"));
  a.xp = at(4);
  assert.equal(perkRow(), undefined);
  a.xp = at(15);
  assert.equal(perkRow().value, 2);
  a.xp = at(30);
  const perks = LEVELS.perks;
  assert.equal(
    perkRow().value,
    perks.reduce((n, x) => n + x.stage, 0),
  );
  const sys = require("../src/systems/roster.js").create(
    { clamp: (x) => x, log() {}, roll: () => 0, api: () => G },
    require("../src/data/roster.js"),
  );
  assert.equal(sys.salesMultiplier(s, p, a), 1 + perks.reduce((n, x) => n + x.sales, 0));
  a.xp = at(9);
  assert.equal(sys.salesMultiplier(s, p, a), 1);
  assert.equal(sys.salesMultiplier({ company: null }, p, a), 1);
});

test("a hit release earns extra XP", () => {
  const { s, a } = ceo();
  const p = { id: 999, artist: a.id, released: true, quality: 80, releaseWeek: s.week };
  s.albums.push(p);
  a.xp = 0;
  G.tierAfterRelease(s, p);
  assert.equal(a.xp, LEVELS.hitXp);
  const q = { ...p, id: 1000, quality: 60 };
  s.albums.push(q);
  G.tierAfterRelease(s, q);
  assert.equal(a.xp, LEVELS.hitXp);
});

test("event choices can give career XP", () => {
  const ev = require("../src/data/events.js");
  const all = Object.values(ev)
    .filter(Array.isArray)
    .flat()
    .flatMap((c) => c.choices || []);
  assert.ok(all.filter((c) => c.effects?.xp > 0).length >= 2);
  for (const c of all.filter((c) => c.effects?.xp)) assert.match(c.hint, /career XP/);
});

test("an event choice with XP raises the artist's career XP", () => {
  const { s, a } = ceo();
  const ev = require("../src/data/events.js").COMPANY_EVENTS,
    event = ev.find((e) => e.choices.some((c) => c.effects?.xp)),
    index = event.choices.findIndex((c) => c.effects?.xp),
    E = require("../src/systems/events.js").create(
      {
        clamp: (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x)),
        log() {},
        pay: (st, n) => (st.cash -= n),
        roll: () => 0,
        api: () => G,
      },
      require("../src/data/events.js"),
    );
  a.xp = 5;
  E.resolve(s, { eventId: event.id, artist: a.id }, { choice: index });
  assert.equal(a.xp, 5 + event.choices[index].effects.xp);
});

test("older CEO saves move to the long career on load without changing level", () => {
  const { s, a } = ceo();
  a.xp = 50;
  const old = roundTrip(s);
  delete old.artists[0].longCareer;
  const lv = G.level(old.artists[0]);
  const loaded = G.migrate(old);
  assert.equal(loaded.artists[0].longCareer, true);
  assert.equal(G.level(loaded.artists[0]), lv);
  assert.ok(G.validSystemsSave(roundTrip(loaded)));
});

console.log(`\n${count} artist level tests passed.`);
