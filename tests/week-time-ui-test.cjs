// Time in weeks (T77, T85): the week is the only unit of time in a CEO run. A tour plays a whole week
// on the road at each weekly settlement, at the clock's normal pace; the top bar names no day; tours,
// gigs and development are worded in weeks. Classic tours keep their day-by-day calendar.
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
  G.setFixedOutcomes(s, true); // tour choices here are about time, not odds (no reveal cards)
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
    royalty: 0.15,
    launchMultiplier: 1,
    eventsSeen: [],
    boosts: [],
    themes: [],
    chart: { best: 5, weeks: 3, rank: 5, milestones: [], history: [] },
  });
  return s;
}

// Engine: a week on the road is settled with the week, in one step.
{
  const s = touring(77),
    week = s.week;
  const t = G.startTour(s, { albumId: 700, scale: "regional", mode: "solo" });
  assert.equal(t.byWeek, true);
  assert.equal(t.plannedWeeks, 4);
  assert.equal(t.weeksPlayed, 0, "the first week is played at the next settlement");
  G.advance(s);
  assert.equal(s.week, week + 1, "one step is one week, tour or not");
  assert.equal(t.weeksPlayed, 1);
  assert.equal(t.history.length, 1, "one ledger row for the week");
  assert.ok(t.history[0].revenue > 0, "seven shows' tickets paid as one week");
  assert.ok(!s.eventQueue.concat(s.event || []).some((e) => e?.type === "tourDay"), "no day-by-day cards");
  assert.equal(
    s.financeHistory.at(-1).tourIncome,
    t.history[0].revenue - t.history[0].cost,
    "the week's tour money is its own line in the settlement",
  );
  // advanceTourDay, for older callers, is the same week step in a CEO run.
  while (s.event) G.choose(s, 0);
  G.advanceTourDay(s);
  assert.equal(s.week, week + 2);
  assert.equal(t.weeksPlayed, 2);
  // A classic run keeps its old calendar: a tour still plays a day at a time.
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
  G.startTour(c, { albumId: 700, scale: "regional", mode: "solo" });
  assert.throws(() => G.advance(c), /one day at a time/);
  G.advanceTourDay(c);
  assert.equal(c.tours[0].day, 1);
}

// Page: the clock runs a tour week at the pace of any week, and the top bar names no day.
run(`state = LabelGame.create(77, { ceo: true }); save(); render();`);
context.__state = touring(77);
run(`state = __state; G.startTour(state, { albumId: 700, scale: "regional", mode: "solo" }); save(); render();
  GoatClock.speed = 1; GoatClock.blockers = []; GoatClock.sync();`);
const week = run("state.week");
assert.doesNotMatch(element("date").innerHTML, /DAY|dateDay/);
// Halfway through the clock's week nothing is played yet.
run(`GoatClock.progress = 0.5; GoatClock.last = Date.now(); GoatClock.frame();`);
assert.equal(run("state.week"), week);
assert.equal(run("state.tours[0].weeksPlayed"), 0);
// The end of the clock's week plays the tour's week and settles it.
run(`GoatClock.progress = 0.9999; GoatClock.last = Date.now() - 400; GoatClock.frame();`);
assert.equal(run("state.week"), week + 1);
assert.equal(run("state.tours[0].weeksPlayed"), 1);

// Wording: tours, gigs and development in weeks, and no days anywhere on the tour bus.
run(`while (state.event) G.choose(state, 0); render();`);
const bus = run("road()");
assert.match(bus, /Regional · 4 weeks<\/option>/);
assert.match(bus, /1 week of 4 played/);
assert.match(bus, /Running cost <b>\$[\d,]+\/week<\/b>/);
assert.match(bus, /Projected finish: −?\$[\d,]+ net after tour week 4/);
assert.match(bus, /Next tour decision: week \d+/);
assert.match(bus, /<small>W\d+<\/small>/, "ledger rows by week");
{
  const text = bus.replace(/<[^>]+>/g, " ");
  const m = text.match(/.{80}\bdays?\b.{40}/i);
  assert.ok(!m, m && m[0]);
}
run(`openPanel("bus"); updateTourQuote(true);`);
assert.doesNotMatch(String(element("tourQuote").innerHTML).replace(/<[^>]+>/g, " "), /\bdays?\b/i);
assert.equal(run("weeksText(31)"), "4 weeks 3 days", "classic wording is unchanged");
run(`const a = state.artists[0]; a.lastTrainingWeek = state.week - 1;`);
assert.match(
  run("artistCard(state.artists[0])"),
  new RegExp(`Development returns in week ${run("state.week") + 2} \\(2 weeks\\)`),
);
console.log("Week time harness passed.");
