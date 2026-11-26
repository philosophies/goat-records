// Time in weeks (T77): a week has seven days at the same pace with or without a tour. A CEO tour
// starts on the day of the week the clock has reached, each tour day is settled as the clock reaches
// it, and the week settles after its seventh day. Waits are worded in weeks.
const vm = require("node:vm"),
  assert = require("node:assert/strict");
const elements = new Map(),
  listeners = {};
const element = (id) => {
  if (!elements.has(id))
    elements.set(id, {
      innerHTML: "",
      textContent: "",
      value: "",
      disabled: false,
      classList: { toggle() {} },
      dataset: {},
    });
  return elements.get(id);
};
let stored = null;
const body = { dataset: {}, classList: { toggle() {} } };
const context = vm.createContext({
  console,
  LabelGame: require("../src/engine.js"),
  document: {
    body,
    getElementById: element,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => (listeners[name] = fn),
  },
  localStorage: { getItem: () => stored, setItem: (_, v) => (stored = v) },
  confirm: () => true,
  setTimeout,
  Blob,
  URL,
});
require("./load-interface.cjs")(context);
const run = (code) => vm.runInContext(code, context);
const G = require("../src/engine.js");

/** A CEO label with a popular album, ready to tour. */
function touring(seed) {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.rivalCardWeek = 1e9;
  Object.assign(s, { cash: 1e6, reputation: 80 });
  G.sign(s, s.candidates[0].id, 3);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, fame: 40, fans: 60 });
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
    boosts: [],
    themes: [],
    chart: { best: 5, weeks: 3, rank: 5, milestones: [], history: [] },
  });
  return s;
}

// Engine: the tour starts on the day reached, so the first week has 7 − weekDay tour days.
{
  const s = touring(77),
    week = s.week;
  G.startTour(s, { albumId: 700, scale: "regional", mode: "solo", weekDay: 3 });
  assert.equal(s.tourDayInWeek, 3, "days already gone this week");
  let days = 0;
  while (s.week === week && days < 10) {
    while (s.event) G.choose(s, 0);
    if (s.week !== week) break;
    G.advanceTourDay(s);
    days++;
  }
  assert.equal(s.week, week + 1);
  assert.equal(days, 4, "days 4 to 7 on the road, then the week settles");
  // A classic run keeps its old calendar.
  const c = G.create(77, { ceo: false });
  c.cash = 1e6;
  G.sign(c, c.candidates[0].id, 3);
  Object.assign(c.artists[0], { energy: 100, fame: 40, fans: 60 });
  c.albums.push({
    ...s.albums.find((p) => p.id === 700),
    tourLaunched: false,
    artist: c.artists[0].id,
    artistName: c.artists[0].name,
  });
  G.startTour(c, { albumId: 700, scale: "regional", mode: "solo", weekDay: 3 });
  assert.equal(c.tourDayInWeek, 0);
}

// Page: tour days run at the clock's pace and the top bar names the right day.
run(`state = LabelGame.create(77, { ceo: true }); save(); render();`);
context.__state = touring(77);
run(`state = __state; G.startTour(state, { albumId: 700, scale: "regional", mode: "solo", weekDay: 2 }); save(); render();
  GoatClock.speed = 1; GoatClock.blockers = []; GoatClock.sync();`);
assert.equal(run("GoatClock.day()"), 3, "the tour began on day 3 of the week");
assert.equal(run("GoatClock.progress"), 2 / 7, "the clock keeps its place in the week");
const week = run("state.week");
// Move the clock to day 5: days 3 and 4 are settled, one per frame, and no more.
run(
  `GoatClock.progress = 4.5 / 7; GoatClock.last = Date.now(); for (let i = 0; i < 6; i++) { while (state.event) G.choose(state, 0); GoatClock.last = Date.now(); GoatClock.frame(); }`,
);
assert.equal(run("state.tourDayInWeek"), 4);
assert.equal(run("state.week"), week, "still the same week");
assert.equal(run("GoatClock.day()"), 5);
// The end of the clock's week plays the rest of the week and settles it.
run(
  `while (state.week === ${week}) { while (state.event) G.choose(state, 0); if (state.week !== ${week}) break; GoatClock.progress = 0.9999; GoatClock.last = Date.now() - 400; GoatClock.frame(); }`,
);
assert.equal(run("state.week"), week + 1);
assert.equal(run("GoatClock.progress < 1 / 7"), true, "a new week starts at day 1");

// Wording: tours, gigs and development in weeks.
const bus = run("road()");
assert.match(bus, /Regional · 4 weeks<\/option>/);
assert.match(bus, /(\d days?|1 week( \d days?)?) of [3-5] weeks( \d days?)? played/);
assert.match(bus, /Next review: week \d+, day \d|The tour ends in week \d+, day \d/);
assert.doesNotMatch(bus, /day \d+\/\d+/);
assert.equal(run("weeksText(31)"), "4 weeks 3 days");
assert.equal(run("weeksText(7)"), "1 week");
assert.equal(
  run("tourPoint({ startWeek: 1, startDay: 3 }, 1)"),
  "week 1, day 4",
  "a tour's first date is the day it began",
);
assert.equal(run("tourPoint({ startWeek: 1, startDay: 3 }, 5)"), "week 2, day 1");
assert.equal(run("tourPoint({ startWeek: 12 }, 10)"), "week 13, day 3");
run(`const a = state.artists[0]; a.lastTrainingWeek = state.week - 1;`);
assert.match(
  run("artistCard(state.artists[0])"),
  new RegExp(`Development returns in week ${run("state.week") + 2} \\(2 weeks\\)`),
);
console.log("Week time harness passed.");
