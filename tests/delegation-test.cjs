// Late-game delegation (3.0, T63): each unlock and its limits, the monthly summary and undo, and
// that story, superstar and board decisions are never automated.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const X = G.DELEGATION;
const { COMPANY_EVENTS } = require("../src/data/events.js");
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
/** A label at the given phase with heads of A&R and Live and one signed artist. */
function label(phase = 6, seed = 63) {
  const s = G.create(seed, { ceo: true });
  G.setStarter(s, false);
  Object.assign(s, { cash: 1e7, week: 300, fame: 60 });
  s.company.phase = phase;
  s.company.rivalCardWeek = 1e9;
  s.company.stories = { arcs: [], log: {}, lastWeek: 1e9 };
  s.company.catalog.offers = [];
  G.CATALOG_OFFERS.chance = 0;
  for (const id of ["ar", "live"].filter((d) => G.departmentOpen(s, d))) {
    const pool = G.recruitExecs(s, id);
    G.hireHead(s, id, pool[0].id);
  }
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  a.energy = 100;
  return { s, a };
}
let id = 7000;
function album(s, a, extra = {}) {
  const p = {
    id: id++,
    artist: a.id,
    artistName: a.name,
    title: "Record " + id,
    genre: a.genre,
    released: true,
    releaseWeek: s.week - 3,
    quality: 80,
    hit: true,
    gross: 50000,
    total: 50000,
    age: 12,
    salesWeeks: 12,
    boosts: [],
    chart: { best: 5, weeks: 3, rank: 8, milestones: [], history: [] },
    ...extra,
  };
  s.albums.push(p);
  return p;
}
const settle = (s) => {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
};
const notes = (s, kind) => s.company.delegation.log.filter((x) => x.kind === kind);

test("each kind of delegation opens at its phase", () => {
  for (const [key, patch] of [
    ["renew", { on: true }],
    ["tours", { on: true }],
    ["autopilot", { policy: "safe" }],
    ["coo", { on: true }],
  ]) {
    const { s } = label(X[key].phase - 1);
    assert.throws(() => G.setDelegation(s, key, patch), new RegExp(`opens at phase ${X[key].phase}`));
    s.company.phase = X[key].phase;
    if (key === "tours" && !s.company.departments.live.head) {
      const pool = G.recruitExecs(s, "live");
      G.hireHead(s, "live", pool[0].id);
    }
    G.setDelegation(s, key, patch);
    assert.deepEqual({ ...s.company.delegation[key], ...patch }, s.company.delegation[key]);
  }
  const { s } = label();
  assert.throws(
    () => G.setDelegation(s, "autopilot", { policy: "reckless" }),
    /safe, balanced or aggressive/,
  );
});

test("renewals by rule: quality and wage limits; never a superstar", () => {
  const { s, a } = label(3);
  album(s, a, { quality: 70, releaseWeek: s.week - 40 });
  a.contract.remaining = 0;
  settle(s);
  assert.equal(a.contract.remaining, 0, "off by default");
  G.setDelegation(s, "renew", { on: true, minQuality: 75 });
  settle(s);
  assert.equal(a.contract.remaining, 0, "average quality 70 is under the limit");
  G.setDelegation(s, "renew", { minQuality: 65, maxWage: 1 });
  settle(s);
  assert.equal(a.contract.remaining, 0, "the wage is over the limit");
  G.setDelegation(s, "renew", { maxWage: 1e6 });
  settle(s);
  assert.equal(a.contract.remaining, X.renew.term);
  assert.equal(notes(s, "renew").length, 1);
  a.contract.remaining = 0;
  a.tier = "superstar";
  for (let i = 0; i < 3; i++) settle(s);
  assert.equal(a.contract.remaining, 0, "a superstar's contract is the player's call");
});

/** A studio with no free place (capacity 0 at every phase) for the length of fn. */
function studioFull(fn) {
  const saved = G.STUDIO_CAPACITY.byPhase;
  G.STUDIO_CAPACITY.byPhase = saved.map(() => 0);
  try {
    return fn();
  } finally {
    G.STUDIO_CAPACITY.byPhase = saved;
  }
}

test("tour booking waits for a full studio: an artist who could record is left to record", () => {
  const { s, a } = label(4);
  a.tier = "star";
  album(s, a);
  G.setDelegation(s, "tours", { on: true, cap: 20000 });
  assert.equal(G.studioCapacity(s).full, false);
  settle(s);
  assert.equal(s.tours.length, 0, "the studio has room");
  studioFull(() => settle(s));
  assert.equal(s.tours.length, 1, "with the studio full, the head of Live books the tour");
});

test("tour booking: the biggest tour under the cap, only with a head of Live; undo cancels it", () =>
  studioFull(() => {
    const { s, a } = label(4);
    a.tier = "star";
    const p = album(s, a);
    G.setDelegation(s, "tours", { on: true, cap: 20000 });
    settle(s);
    const tour = s.tours.find((t) => t.albumId === p.id || t.album === p.id) || s.tours.at(-1);
    assert.equal(tour.scale, "national", "world costs $35,000, over the cap");
    const entry = notes(s, "tour")[0];
    assert.match(entry.text, /booked a national tour/);
    G.undoDelegated(s, entry.id);
    assert.notEqual(s.tours.find((t) => t.id === tour.id).status, "active");
    assert.throws(() => G.undoDelegated(s, entry.id), /cannot be undone/);
    // Under a small cap nothing fits but a regional run; with no head, nothing at all.
    const two = label(4, 64);
    album(two.s, two.a);
    G.setDelegation(two.s, "tours", { on: true, cap: 1000 });
    settle(two.s);
    assert.equal(two.s.tours.length, 0, "regional costs $4,500, over a $1,000 cap");
    const three = label(4, 65);
    album(three.s, three.a);
    three.a.tier = "superstar";
    G.setDelegation(three.s, "tours", { on: true });
    settle(three.s);
    assert.equal(three.s.tours.length, 0, "a superstar's tour is the player's call");
    const four = label(4, 66);
    four.s.company.departments.live.head = null;
    assert.throws(() => G.setDelegation(four.s, "tours", { on: true }), /head of Live/);
  }));

test("autopilot: a policy sets the steps per month and the cash it keeps; never a superstar", () => {
  const { s, a } = label(5);
  const step = () => {
    while (s.week % X.autopilot.every !== X.autopilot.every - 1) settle(s);
    settle(s);
  };
  G.setDelegation(s, "autopilot", { policy: "safe" });
  step();
  const safe = s.company.delegation.log.filter((x) => ["train", "staff", "develop"].includes(x.kind));
  assert.equal(safe.length, 1, "safe takes one step a month");
  assert.equal(safe[0].kind, "train", "and never hires or develops");
  G.setDelegation(s, "autopilot", { policy: "aggressive" });
  step();
  const kinds = new Set(
    notes(s, "staff")
      .map(() => "staff")
      .concat(notes(s, "develop").map(() => "develop")),
  );
  assert.ok(kinds.has("staff"), "aggressive adds juniors");
  const junior = notes(s, "staff")[0],
    before = s.company.departments[junior.undo.department].staff;
  G.undoDelegated(s, junior.id);
  assert.equal(s.company.departments[junior.undo.department].staff, before - 1);
  // The reserve: with little cash, nothing is spent.
  const poor = label(5, 67);
  poor.s.cash = 100;
  G.setDelegation(poor.s, "autopilot", { policy: "aggressive" });
  for (let i = 0; i < X.autopilot.every; i++) settle(poor.s);
  assert.equal(poor.s.company.delegation.log.length, 0);
  // Superstars are never developed.
  const star = label(5, 68);
  star.a.tier = "superstar";
  for (const d of Object.values(star.s.company.departments)) if (d.head) d.head.trainedWeek = star.s.week;
  G.setDelegation(star.s, "autopilot", { policy: "aggressive" });
  for (let i = 0; i < X.autopilot.every; i++) settle(star.s);
  assert.equal(notes(star.s, "develop").length, 0);
});

test("the COO settles small company events; never politics, superstars, stories, approvals or rivals", () => {
  const { s, a } = label(6);
  G.setDelegation(s, "coo", { on: true, limit: 5000 });
  const ids = COMPANY_EVENTS.map((e) => e.id);
  const mk = (eventId) => {
    const ev = COMPANY_EVENTS.find((e) => e.id === eventId);
    return {
      eventId,
      artist: a.id,
      album: null,
      dueWeek: s.week + 4,
      type: "companyEvent",
      kind: ev.kind,
      title: ev.title,
      body: ev.body,
      options: [
        ...ev.choices.map(({ label, hint, cost }, choice) => ({ label, hint, cost, choice })),
        { label: "Later", hint: "", defer: true },
      ],
    };
  };
  const small = COMPANY_EVENTS.find(
    (e) =>
      e.kind === "opportunity" &&
      !/^superstar/.test(e.id) &&
      e.choices.some((c) => (c.cost || 0) <= 5000) &&
      !e.when?.album,
  );
  const politics = COMPANY_EVENTS.find((e) => e.kind === "politics");
  const star = COMPANY_EVENTS.find((e) => /^superstar/.test(e.id));
  const other = [
    {
      type: "story",
      title: "A story",
      body: "",
      artist: a.id,
      options: [{ label: "x", hint: "", storyChoice: 0 }],
    },
    { type: "approval", title: "Approval", body: "", options: [{ label: "x", hint: "" }] },
    {
      type: "rivalFeud",
      title: "Feud",
      body: "",
      artist: a.id,
      rival: s.company.rivals[0].id,
      options: [{ label: "x", hint: "", rivalChoice: "calm" }],
    },
  ];
  s.eventQueue.push(mk(small.id), mk(politics.id), mk(star.id), ...other);
  const queued = s.eventQueue.length;
  G.systems.find((x) => x.name === "delegation").cardsQueued(s);
  assert.equal(s.eventQueue.length, queued - 1, "only the small opportunity is settled");
  assert.ok(!s.eventQueue.some((e) => e.eventId === small.id));
  for (const kept of [politics.id, star.id])
    assert.ok(
      s.eventQueue.some((e) => e.eventId === kept),
      kept,
    );
  for (const t of ["story", "approval", "rivalFeud"])
    assert.ok(
      s.eventQueue.some((e) => e.type === t),
      t,
    );
  assert.ok(
    ids.every((x) => !G.cooMay({ type: "story", eventId: x })),
    "never a story card",
  );
  assert.equal(notes(s, "coo").length, 1);
  // Over the limit the card waits for the player.
  G.setDelegation(s, "coo", { limit: -0 });
  const pricey = COMPANY_EVENTS.find(
    (e) => e.kind !== "politics" && !/^superstar/.test(e.id) && e.choices.every((c) => (c.cost || 0) > 0),
  );
  if (pricey) {
    s.eventQueue = [mk(pricey.id)];
    G.systems.find((x) => x.name === "delegation").cardsQueued(s);
    assert.equal(s.eventQueue.length, 1);
  }
});

test("a monthly summary of every delegated step", () => {
  const { s, a } = label(6);
  G.setDelegation(s, "autopilot", { policy: "balanced" });
  for (let i = 0; i < 2 * X.summaryWeeks; i++) settle(s);
  const n = s.notifications.filter((x) => x.kind === "delegation");
  assert.ok(n.length >= 1);
  assert.match(n[0].title, /Delegated this month: \d+ steps?/);
  const sum = G.delegationSummary(s);
  assert.ok(sum.log.length >= sum.month.length);
  assert.deepEqual(sum.open, { renew: true, tours: true, autopilot: true, coo: true });
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.delegation.autopilot.policy = "yolo";
  assert.equal(G.validSystemsSave(bad), false);
  const old = roundTrip(s);
  delete old.company.delegation;
  assert.equal(G.migrate(old).company.delegation.coo.on, false, "older saves start with nothing delegated");
});

console.log(`\n${count} delegation tests passed.`);
