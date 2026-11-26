// Tours in weeks (T85): in a CEO run a tour plays a whole week at each weekly settlement, decisions
// come as weekly cards, every change is in weeks, and saves with a tour planned in days convert.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const TW = require("../src/data/touring.js").TOUR_WEEKS;
const clear = (s) => {
  while (s.event) G.choose(s, s.event.options.length - 1);
};
/** A CEO label with a popular album, ready to tour; choices play as written. */
function label(seed = 85, mode = "solo") {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  G.setFixedOutcomes(s, true);
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.rivalCardWeek = 1e9;
  Object.assign(s, { cash: 1e6, reputation: 70 });
  G.sign(s, s.candidates[0].id, 3);
  G.sign(s, s.candidates[0].id, 3);
  for (const a of s.artists) Object.assign(a, { energy: 100, fame: 50, fans: 80 });
  const a = s.artists[0];
  s.albums.push({
    id: 700,
    artist: a.id,
    artistName: a.name,
    title: "Road Record",
    genre: a.genre,
    released: true,
    releaseWeek: s.week,
    quality: 80,
    age: 3,
    salesWeeks: 12,
    gross: 40000,
    total: 0,
    economyVersion: 5,
    lastUnits: 900,
    royalty: 0.15,
    launchMultiplier: 1,
    eventsSeen: [],
    boosts: [],
    themes: [],
    chart: { best: 5, weeks: 3, rank: 5, milestones: [], history: [] },
  });
  s.event = null;
  s.eventQueue = [];
  const t = G.startTour(s, { albumId: 700, scale: "regional", mode, partnerId: s.artists[1].id });
  return { s, a, t };
}

test("a week on the road settles at the weekly settlement, all at once", () => {
  const { s, a, t } = label();
  const energy = a.energy,
    fame = a.fame,
    week = s.week;
  G.advance(s);
  assert.equal(s.week, week + 1);
  assert.equal(t.weeksPlayed, 1);
  assert.equal(t.showWeeks, 1);
  assert.equal(t.showDays, 7, "seven shows in the week");
  const row = t.history.at(-1);
  assert.equal(row.week, s.week);
  assert.equal(row.tourWeek, 1);
  assert.ok(row.revenue > 0);
  assert.equal(row.cost, t.weekly + Math.round(row.revenue * 0.15), "the week's running cost and venue fees");
  assert.equal(t.net, t.revenue - t.costs);
  assert.ok(a.energy < energy, "a week's energy");
  assert.ok(a.fame >= fame + 3, "a week's fame for a solo headliner");
  assert.equal(s.financeHistory.at(-1).tourIncome, row.revenue - row.cost);
});

test("a tour plays its booked weeks and then ends", () => {
  const { s, t } = label();
  for (let i = 0; i < 6 && t.status === "active"; i++) {
    clear(s);
    G.advance(s);
  }
  assert.equal(t.status, "completed");
  assert.equal(t.weeksPlayed, 4);
  assert.equal(t.history.filter((h) => !h.event).length, 4, "one row a week");
});

test("decision cards come on the scale's cadence, worded in weeks", () => {
  const { s, t } = label();
  G.advance(s);
  assert.ok(!s.event, "no card after the first week");
  G.advance(s);
  assert.equal(s.event?.type, "tour");
  assert.match(s.event.title, /^Tour week 2 of 4 · /);
  for (const o of s.event.options) assert.doesNotMatch(o.hint, /\bdays?\b/i);
  assert.equal(t.nextDecision, s.week + 2);
  // Every card in the table is about weeks.
  for (const e of TW.events)
    for (const o of e.options)
      for (const k of Object.keys(o))
        assert.ok(
          [
            "label",
            "costWeeks",
            "cashWeeks",
            "addWeeks",
            "cutWeeks",
            "tourPause",
            "tourMult",
            "tourBoostWeeks",
            "qualityDelta",
            "cancelChance",
            "energy",
            "morale",
            "fans",
            "trust",
            "attention",
          ].includes(k),
          `${e.id} ${k}`,
        );
});

test("a tired artist brings a card at once, with a rest week", () => {
  const { s, a, t } = label();
  a.energy = 35;
  G.advance(s);
  assert.equal(s.event?.type, "tour");
  assert.match(s.event.title, /fatigue/);
  const rest = s.event.options.findIndex((o) => o.tourPause);
  G.choose(s, rest);
  assert.equal(t.restWeeks, 1);
  assert.equal(t.plannedWeeks, 5, "the rest week is added to the plan");
  const tickets = t.revenue;
  const energy = a.energy;
  G.advance(s);
  assert.equal(t.history.at(-1).rest, true);
  assert.equal(t.revenue, tickets, "no tickets in a rest week");
  assert.ok(a.energy >= Math.min(100, energy + TW.restEnergy) - 0.001);
});

test("card effects: more weeks, fewer weeks, quality, ticket changes, money and the end", () => {
  const { s, t } = label();
  G.advance(s);
  const e = { type: "tour", byWeek: true, tour: t.id, artist: t.artist, title: "x", body: "x" };
  const play = (o) => {
    s.event = { ...e, options: [{ label: "x", hint: "", ...o }] };
    G.choose(s, 0);
  };
  play({ addWeeks: 1 });
  assert.equal(t.plannedWeeks, 5);
  play({ addWeeks: 10 });
  assert.equal(t.plannedWeeks, t.baseWeeks * TW.maxLength, "a tour grows at most to twice its length");
  play({ cutWeeks: 20 });
  assert.equal(t.plannedWeeks, t.weeksPlayed + 1, "a cut leaves the next week");
  const q = t.quality;
  play({ qualityDelta: 6 });
  assert.equal(t.quality, q + 6);
  play({ tourMult: 1.3, tourBoostWeeks: 1 });
  assert.deepEqual(t.effects.at(-1), { until: t.showWeeks + 1, mult: 1.3 });
  const cash = s.cash;
  play({ tourCash: 1200 });
  assert.equal(s.cash, cash + 1200);
  assert.equal(t.history.at(-1).event, true);
  play({ endTour: true });
  assert.equal(t.status, "ended early");
});

test("a ticket boost lifts the next show week and then runs out", () => {
  const a = label(),
    b = label();
  for (const x of [a, b]) G.advance(x.s);
  b.t.effects.push({ until: b.t.showWeeks + 1, mult: 1.5 });
  for (const x of [a, b]) G.advance(x.s);
  assert.ok(b.t.history.at(-1).revenue > a.t.history.at(-1).revenue * 1.3, "boosted week");
  for (const x of [a, b]) {
    clear(x.s);
    G.advance(x.s);
  }
  assert.ok(!b.t.effects.some((e) => e.mult === 1.5), "spent");
});

test("a shared tour pays both artists' week and both stop for it", () => {
  const { s, t } = label(85, "labelmate");
  const [a, b] = s.artists;
  G.advance(s);
  assert.equal(t.artists.length, 2);
  assert.ok(a.energy < 100 && b.energy < 100);
  assert.ok(G.busy(s, b.id));
});

test("a save with a CEO tour planned in days converts to weeks", () => {
  const { s, t } = label();
  // An older save: 10 days played of 28, 3 rest days booked, a boost to show 16, a day card waiting.
  for (const k of [
    "byWeek",
    "weeksPlayed",
    "plannedWeeks",
    "baseWeeks",
    "restWeeks",
    "showWeeks",
    "nextDecision",
  ])
    delete t[k];
  Object.assign(t, {
    day: 10,
    plannedDays: 28,
    restDays: 3,
    showDays: 9,
    effects: [{ untilDay: 16, mult: 1.2 }],
  });
  s.eventQueue = [{ type: "tourDay", tour: t.id, title: "Day 10", options: [] }];
  s.tourDayInWeek = 3;
  const old = JSON.parse(JSON.stringify(s));
  G.toursToWeeks(old);
  const x = old.tours.find((y) => y.id === t.id);
  assert.equal(x.byWeek, true);
  assert.equal(x.weeksPlayed, 1);
  assert.equal(x.plannedWeeks, 4);
  assert.equal(x.restWeeks, 1);
  assert.equal(x.showWeeks, 1);
  assert.deepEqual(x.effects, [{ mult: 1.2, until: 3 }]);
  assert.equal(old.eventQueue.length, 0, "day cards dropped");
  assert.equal(old.tourDayInWeek, 0);
  G.advance(old);
  assert.equal(old.tours.find((y) => y.id === t.id).weeksPlayed, 2);
  // Loading runs the conversion (the touring system's init, run by migrate).
  const loaded = G.migrate(JSON.parse(JSON.stringify(s)));
  const z = (loaded || s).tours.find((y) => y.id === t.id);
  assert.equal(z.byWeek, true);
  assert.equal(z.plannedWeeks, 4);
});

test("classic tours still play a day at a time", () => {
  const c = G.create(85, { ceo: false });
  c.cash = 1e6;
  G.sign(c, c.candidates[0].id, 3);
  Object.assign(c.artists[0], { energy: 100, fame: 50, fans: 80 });
  const { s } = label();
  c.albums.push({ ...s.albums.find((p) => p.id === 700), tourLaunched: false, artist: c.artists[0].id });
  const t = G.startTour(c, { albumId: 700 });
  assert.equal(t.byWeek, undefined);
  G.advanceTourDay(c);
  assert.equal(t.day, 1);
});

console.log(`${count} tour week tests passed`);
