// Floor levels to 10 (3.0, T50): phase caps, rising costs, softer late steps and the save check.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { FLOOR_LEVELS } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(phase = 6) {
  const s = G.create(41, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e9;
  G.buildFloor(s, "apartment", "writers");
  return { s, floor: s.company.buildings[0].floors.find((f) => f.type === "writers") };
}
const writers = G.FACILITIES.find((f) => f.id === "writers");
/** Upgrades a floor and, when that starts a renovation, waits it out. */
function up(s, building, index) {
  G.upgradeFloor(s, building, index);
  const f = s.company.buildings.find((b) => b.id === building).floors[index];
  if (f.renovating) {
    s.week = f.renovating.done;
    G.finishRenovations(s);
  }
}

test("each phase caps the floor level, up to 10 at phase 6", () => {
  assert.deepEqual(FLOOR_LEVELS.byPhase.at(-1), 10);
  FLOOR_LEVELS.byPhase.forEach((cap, i) => {
    const { s, floor } = ceo(i + 1);
    while (floor.level < cap) up(s, "apartment", s.company.buildings[0].floors.indexOf(floor));
    assert.equal(floor.level, cap);
    const index = s.company.buildings[0].floors.indexOf(floor);
    assert.throws(() => G.upgradeFloor(s, "apartment", index), cap === 10 ? /top level/ : /opens at phase/);
  });
});

test("upgrades cost more past level 3, and upkeep follows the level", () => {
  const { s, floor } = ceo();
  const index = s.company.buildings[0].floors.indexOf(floor),
    paid = [];
  while (floor.level < 10) {
    const cash = s.cash,
      quote = G.floorUpgradeCost(floor);
    up(s, "apartment", index);
    assert.equal(cash - s.cash, quote);
    paid.push(quote);
  }
  assert.deepEqual(paid.slice(0, 2), [writers.cost, writers.cost * 2]);
  assert.equal(paid[2], writers.cost * 3);
  assert.equal(paid[8], Math.round(writers.cost * 9 * (1 + FLOOR_LEVELS.costStep * 6)));
  for (let i = 1; i < paid.length; i++) assert.ok(paid[i] > paid[i - 1]);
  assert.equal(G.hqUpkeep(s), writers.upkeep * 10);
});

test("later levels count for less, and stage bonuses stay whole numbers", () => {
  const { s, floor } = ceo();
  const stage = () => G.hqBonuses(s).stages.reduce((n, x) => n + x.value, 0),
    perLevel = Object.values(writers.stages).reduce((n, x) => n + x, 0),
    seen = [];
  for (let level = 1; level <= 10; level++) {
    floor.level = level;
    seen.push(stage());
    assert.equal(stage(), Math.round(perLevel * FLOOR_LEVELS.effect[level - 1]));
    for (const x of G.hqBonuses(s).stages) assert.ok(Number.isInteger(x.value));
  }
  for (let i = 1; i < 10; i++) assert.ok(seen[i] >= seen[i - 1]);
  assert.ok(seen[3] - seen[2] < seen[2] - seen[1], "level 4 adds less than level 3");
  assert.equal(G.floorEffect(3), 3);
});

test("levels past 3 take renovation weeks, one floor per building at a time", () => {
  const { s } = ceo();
  G.buyBuilding(s, "studio");
  G.buildFloor(s, "studio", "vocal");
  G.buildFloor(s, "studio", "mix");
  const studio = s.company.buildings.find((b) => b.id === "studio"),
    floors = studio.floors,
    w = floors.findIndex((f) => f.type === "vocal"),
    v = floors.findIndex((f) => f.type === "mix"),
    floor = floors[w];
  floor.level = 3;
  floors[v].level = 3;
  const start = s.week,
    before = G.hqBonuses(s).stages.reduce((n, x) => n + x.value, 0);
  G.upgradeFloor(s, "studio", w);
  assert.deepEqual(floor.renovating, { to: 4, done: start + FLOOR_LEVELS.weeks[3] });
  assert.equal(floor.level, 3, "works at its old level meanwhile");
  assert.equal(
    G.hqBonuses(s).stages.reduce((n, x) => n + x.value, 0),
    before,
  );
  assert.throws(() => G.upgradeFloor(s, "studio", w), /Already renovating to level 4/);
  assert.throws(() => G.upgradeFloor(s, "studio", v), /One at a time/);
  s.week = start + FLOOR_LEVELS.weeks[3] - 1;
  G.finishRenovations(s);
  assert.equal(floor.level, 3);
  s.week++;
  G.finishRenovations(s);
  assert.equal(floor.level, 4);
  assert.equal(floor.renovating, undefined);
  G.upgradeFloor(s, "studio", v);
  assert.ok(floors[v].renovating);
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.buildings.find((b) => b.id === "studio").floors[v].renovating.to = 9;
  assert.equal(G.validSystemsSave(bad), false);
  assert.deepEqual(FLOOR_LEVELS.weeks.slice(0, 3), [0, 0, 0]);
});

test("saves accept floors up to 10 and refuse more", () => {
  const { s, floor } = ceo();
  floor.level = 10;
  assert.ok(G.validSystemsSave(roundTrip(s)));
  floor.level = 11;
  assert.equal(G.validSystemsSave(roundTrip(s)), false);
});

test("classic facilities still stop at level 3", () => {
  const c = G.create(41, { ceo: false });
  assert.equal(G.HQ.maxLevel, 3);
  assert.equal(c.company, undefined);
});

console.log(`\n${count} floor level tests passed.`);
