const assert = require("node:assert/strict"),
  G = require("../src/engine.js"),
  B = require("./tour-balance.cjs");
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("PASS " + name);
}
function clear(s) {
  while (s.event) G.choose(s, B.steady(s, s.event));
}
function next(f) {
  clear(f.s);
  G.advanceTourDay(f.s);
  return f.s.event;
}
test("Booking and remaining forecasts use identical live daily revenue and all tour costs", () => {
  for (const r of G.TOUR_SCALES)
    for (const m of G.TOUR_MODES) {
      const f = B.fixture(1, r.id, m.id),
        projection = G.tourRemainingForecast(f.t);
      assert.equal(projection.net, f.q.expectedNet);
      assert.equal(projection.breakEvenDay, f.q.breakEvenDay);
      let revenue = 0,
        cost = f.q.upfront;
      for (let day = 1; day <= r.weeks * 7; day++) {
        const gate = G.tourTicketRevenue(r, m, f.q.demand, f.q.quality, day);
        revenue += gate;
        cost += Math.ceil(f.q.weekly / 7) + Math.round(gate * 0.15);
      }
      assert.equal(f.q.forecast, revenue);
      assert.equal(f.q.cost, cost);
    }
});
test("Twelve normal show situations rotate without repeating and persist through reload", () => {
  let f = B.fixture(22, "world", "solo"),
    ids = [];
  for (let day = 0; day < 12; day++) {
    f.s.artists[0].energy = 100;
    let e;
    for (let guard = 0; guard < 20; guard++) {
      e = next(f);
      if (e?.type === "tourDay") break;
    }
    assert.equal(e?.type, "tourDay");
    ids.push(e.id);
    assert.match(e.body, /has already settled/);
    G.choose(f.s, B.steady(f.s, e));
    f.s = G.migrate(JSON.parse(JSON.stringify(f.s)));
    f.t = f.s.tours[0];
  }
  assert.equal(new Set(ids).size, 12);
});
test("Recovery starts next day, heals on those days, and cannot recursively add more recovery", () => {
  const f = B.fixture(8, "regional", "solo");
  f.t.eventBag = ["care"];
  f.s.artists[0].energy = 50;
  const e = next(f),
    before = f.s.artists[0].energy,
    planned = f.t.plannedDays;
  assert.equal(e.id, "care");
  const o = e.options.find((o) => o.restDays);
  G.choose(f.s, e.options.indexOf(o));
  assert.equal(f.s.artists[0].energy, before);
  assert.equal(f.t.plannedDays, planned + 2);
  const show = f.t.showDays,
    revenue = f.t.revenue;
  for (let i = 1; i <= 2; i++) {
    const rest = next(f);
    assert.equal(rest, null);
    assert.equal(f.t.showDays, show);
    assert.equal(f.t.revenue, revenue);
    assert.equal(f.s.artists[0].energy, before + i * 9);
  }
  assert.equal(f.t.restDays, 0);
});
test("Ticket boosts affect exactly the promised upcoming shows and pause through recovery", () => {
  const f = B.fixture(9, "regional", "solo");
  f.t.eventBag = ["promoter"];
  const e = next(f),
    o = e.options[0],
    show = f.t.showDays;
  assert.match(o.hint, new RegExp(`show numbers ${show + 1}–${show + 3}`));
  G.choose(f.s, 0);
  assert.equal(f.t.effects.at(-1).untilDay, show + 3);
  f.t.restDays = 2;
  f.t.plannedDays += 2;
  for (let i = 0; i < 2; i++) {
    next(f);
    assert.equal(f.t.showDays, show);
    assert.ok(f.t.effects.length);
    if (f.s.event) G.choose(f.s, B.steady(f.s, f.s.event));
  }
  for (let i = 1; i <= 4; i++) {
    clear(f.s);
    G.advanceTourDay(f.s);
    assert.equal(
      f.t.effects.some((x) => x.mult === o.tourMult),
      i <= 3,
    );
    if (f.s.event) G.choose(f.s, B.steady(f.s, f.s.event));
  }
});
test("Final-day prompts do not sell expired future boosts or request another interaction", () => {
  const f = B.fixture(10, "regional", "solo");
  f.t.day = f.t.plannedDays - 1;
  f.t.showDays = f.t.day;
  const e = next(f);
  assert.match(e.id, /^final-/);
  assert.ok(e.options.every((o) => !o.tourMult && !o.lengthDelta && !o.restDays));
  assert.match(e.body, /no next tour interaction/);
  G.choose(f.s, 0);
  assert.equal(f.t.status, "completed");
});
test("Itinerary caps change the displayed and actual recovery duration together", () => {
  const f = B.fixture(11, "regional", "solo");
  f.t.plannedDays = 55;
  f.t.day = 53;
  f.t.showDays = 53;
  f.t.eventBag = ["care"];
  const e = next(f),
    o = e.options.find((o) => o.restDays);
  assert.equal(o.lengthDelta, 1);
  assert.equal(o.restDays, 1);
  assert.equal(o.recoveryEnergy, 9);
  assert.match(o.hint, /55 → 56/);
  G.choose(f.s, e.options.indexOf(o));
  assert.equal(f.t.plannedDays, 56);
  assert.equal(f.t.restDays, 1);
});
test("Remote appearance receipts increase tour net and trigger break-even once", () => {
  const f = B.fixture(12, "regional", "solo");
  f.t.eventBag = ["city"];
  const e = next(f),
    o = e.options.find((o) => o.tourCash);
  f.t.costs = f.t.revenue + 10;
  f.t.net = -10;
  const cash = f.s.cash;
  G.choose(f.s, e.options.indexOf(o));
  assert.equal(f.s.cash, cash + o.tourCash);
  assert.equal(f.t.net, o.tourCash - 10);
  assert.equal(f.t.otherRevenue, o.tourCash);
  assert.ok(f.t.profitMilestone);
  assert.equal(f.s.notifications.filter((n) => n.kind === "tour").length, 1);
});
test("Typical tours can profit before the original end in every territory and lineup", () => {
  for (const r of G.TOUR_SCALES)
    for (const m of G.TOUR_MODES) {
      const runs = Array.from({ length: 10 }, (_, i) => B.run(i + 1, r.id, m.id));
      assert.ok(runs.filter((r) => r.profit && r.breakEven <= r.originalDays).length >= 9, `${r.id} ${m.id}`);
      assert.ok(runs.every((r) => r.days <= r.originalDays));
    }
  const weak = B.fixture(1, "regional", "solo", "low");
  assert.ok(weak.q.expectedNet < 0);
});
test("Upgrading a pending recovery prompt preserves money and time and refreshes it only once", () => {
  const f = B.fixture(13, "regional", "solo");
  next(f);
  f.t.history.at(-1).rest = true;
  delete f.s.event.timingRevision;
  f.s.event.options = [{ label: "Old recovery loop", hint: "Add two days", restDays: 2, lengthDelta: 2 }];
  const cash = f.s.cash,
    day = f.t.day,
    week = f.s.week;
  G.migrate(f.s);
  assert.match(f.s.event.id, /^rest-/);
  assert.equal(f.s.cash, cash);
  assert.equal(f.t.day, day);
  assert.equal(f.s.week, week);
  const saved = JSON.stringify(f.s.event),
    seed = f.s.seed;
  G.migrate(f.s);
  assert.equal(JSON.stringify(f.s.event), saved);
  assert.equal(f.s.seed, seed);
});
test("Near the final show, a three-show offer is clipped to the one show remaining", () => {
  const f = B.fixture(14, "regional", "solo");
  f.t.day = 26;
  f.t.showDays = 26;
  f.t.eventBag = ["promoter"];
  const e = next(f),
    o = e.options[0];
  assert.equal(o.tourBoostDays, 1);
  assert.match(o.hint, /next 1 show day/);
  G.choose(f.s, 0);
  assert.equal(f.t.effects.at(-1).untilDay, 28);
});
console.log(`${count} tour timing, variation and profitability tests passed.`);
