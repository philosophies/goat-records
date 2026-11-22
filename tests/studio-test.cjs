// Studio capacity (T73): a CEO label can only have so many albums in production at once, by phase,
// so artists waiting on the studio tour instead. Albums already in production are always kept.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const CAP = G.STUDIO_CAPACITY.byPhase;

/** A CEO label at `phase` with `n` rested artists and a recording room for each. */
function label(phase, n, seed = 73) {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  Object.assign(s, { cash: 1e7, reputation: 80 });
  s.company.phase = 6;
  while (s.artists.length < n) {
    if (!s.candidates.length) G.paidScout(s, "local");
    G.sign(s, s.candidates[0].id);
  }
  s.company.phase = phase;
  for (const a of s.artists) Object.assign(a, { energy: 100, inspiration: 90 });
  for (let id = 1; s.booths.length < n; id++)
    if (!s.booths.some((b) => b.id === id)) s.booths.push({ id, hits: 0, prestige: 0 });
  return s;
}
const record = (s, a) => {
  const booth = s.booths.find((b) => !s.albums.some((p) => !p.released && p.booth === b.id));
  return G.record(s, {
    artistId: a.id,
    boothId: booth.id,
    genre: a.genre,
    audience: a.audience,
    budget: 4000,
  });
};

test("the studio's capacity rises with the phase", () => {
  assert.deepEqual(CAP, [1, 2, 2, 2, 3, 3]);
  for (let phase = 1; phase <= 6; phase++) {
    const s = label(phase, 1);
    assert.deepEqual(G.studioCapacity(s), { used: 0, max: CAP[phase - 1], full: false });
  }
});

test("a full studio refuses another album, whatever rooms are free", () => {
  const s = label(3, 3);
  record(s, s.artists[0]);
  record(s, s.artists[1]);
  assert.deepEqual(G.studioCapacity(s), { used: 2, max: 2, full: true });
  assert.ok(s.booths.length > 2, "a room is still free");
  assert.throws(() => record(s, s.artists[2]), /The studio is full: 2 albums in production, 2 at phase 3/);
  // Phase 5 makes room.
  s.company.phase = 5;
  record(s, s.artists[2]);
  assert.equal(G.studioCapacity(s).used, 3);
});

test("albums already in production are kept when a save is over the limit", () => {
  const s = label(5, 3);
  s.artists.forEach((a) => record(s, a));
  s.company.phase = 2; // as if saved before the limit existed
  const copy = JSON.parse(JSON.stringify(s));
  assert.ok(G.validSystemsSave(copy) && G.validManagementSave(copy));
  assert.deepEqual(G.studioCapacity(copy), { used: 3, max: 2, full: true });
  for (let w = 0; w < 3; w++) {
    for (const p of copy.albums)
      if (!p.released && !p.production.cooldown && !p.production.review && !p.production.releaseReady)
        G.decideStage(copy, p.id, 0);
    for (const p of copy.albums) if (p.production.review) G.continueProduction(copy, p.id);
    while (copy.event) G.choose(copy, copy.event.options.length - 1);
    G.advance(copy);
  }
  assert.equal(copy.albums.filter((p) => !p.released).length, 3, "all three still in production");
  assert.ok(
    copy.albums.every((p) => p.production.stage > 1),
    "and moving forward",
  );
  const a = copy.artists[0];
  assert.throws(
    () => G.record(copy, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience }),
    /studio is full/,
  );
});

test("classic labels have no studio limit", () => {
  const s = G.create(73, { ceo: false });
  assert.equal(s.company, undefined);
  Object.assign(s, { cash: 1e6, reputation: 80 });
  G.sign(s, s.candidates[0].id);
  G.sign(s, s.candidates[0].id);
  s.booths.push({ id: 1, hits: 0, prestige: 0 });
  s.artists.forEach((a, i) => {
    Object.assign(a, { energy: 100, inspiration: 90 });
    G.record(s, {
      artistId: a.id,
      boothId: s.booths[i].id,
      genre: a.genre,
      audience: a.audience,
      budget: 4000,
    });
  });
  assert.equal(s.albums.filter((p) => !p.released).length, 2, "two at once, over a phase-1 CEO limit of 1");
});

console.log(`\n${count} studio tests passed.`);
