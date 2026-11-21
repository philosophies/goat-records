// Company phases (2.0): the CEO run flag, the starting phase and save checks.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { PHASES } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

test("A classic run has no company and keeps the 1.1 start", () => {
  const s = G.create(7, { ceo: false });
  assert.equal(s.company, undefined);
  assert.equal(s.ceoMode, undefined);
  assert.equal(G.companyPhase(s), null);
  assert.equal(s.cash, G.create(7, { ceo: false }).cash);
  assert.ok(s.cash > PHASES[0].startCash, "classic runs keep their larger starting cash");
});

test("New runs default to the CEO home studio with $2,000", () => {
  const s = G.create(7, { labelName: "Goat Records" });
  assert.equal(s.ceoMode, true);
  assert.deepEqual(s.company, {
    phase: 1,
    since: 1,
    history: [{ phase: 1, week: 1 }],
    buildings: [{ id: "apartment", floors: [{ type: "room", room: 0, level: 1 }] }],
    departments: Object.fromEntries(G.DEPARTMENTS.map((d) => [d.id, { head: null, staff: 0, pool: [] }])),
    nextExecId: 1,
    team: { pool: [], candidates: {}, nextId: 1, salt: s.company.team.salt },
    ownership: 1,
    rounds: [],
    loan: null,
    shares: { total: 10000, yours: 10000, investors: 0 },
    onboarding: { on: true, done: [], tips: [] },
  });
  assert.equal(s.cash, PHASES[0].startCash);
  assert.equal(s.cash, 2000);
  assert.equal(G.companyPhase(s).name, "Home studio");
  assert.equal(G.companyPhase(s).reach, "local");
});

test("Phases are numbered 1-6 with goals that only grow", () => {
  assert.equal(PHASES.length, 6);
  PHASES.forEach((p, i) => assert.equal(p.id, i + 1));
  for (let i = 1; i < PHASES.length; i++)
    for (const k of Object.keys(PHASES[i].goals))
      assert.ok(PHASES[i].goals[k] >= PHASES[i - 1].goals[k], `${PHASES[i].name} ${k}`);
  for (const p of PHASES) assert.ok(G.REACHES.includes(p.reach), p.name);
});

test("CEO and classic saves pass the load checks after a round trip", () => {
  for (const s of [G.create(3, { ceo: false }), G.create(3, { ceo: true })]) {
    const copy = roundTrip(s);
    assert.equal(G.validSystemsSave(copy), true);
    G.migrate(copy);
    assert.equal(copy.company === undefined, !s.ceoMode, "migration neither adds nor drops the company");
    assert.equal(copy.cash, s.cash, "migration does not reset a CEO run's cash");
  }
});

test("A damaged company record fails the load checks", () => {
  const bad = (change) => {
    const s = roundTrip(G.create(4, { ceo: true }));
    change(s);
    return G.validSystemsSave(s);
  };
  assert.equal(
    bad((s) => (s.company.phase = 0)),
    false,
  );
  assert.equal(
    bad((s) => (s.company.phase = 7)),
    false,
  );
  assert.equal(
    bad((s) => (s.company = [])),
    false,
  );
  assert.equal(
    bad((s) => (s.company.history = [{ phase: "x", week: 1 }])),
    false,
  );
  assert.equal(
    bad((s) => (s.company.since = -1)),
    false,
  );
});

test("A CEO run plays weeks like any other run", () => {
  const s = G.create(9, { ceo: true });
  s.cash = 50000;
  for (let i = 0; i < 10; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  assert.equal(s.company.phase, 1);
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
});

function ceo(seed = 21) {
  const s = G.create(seed, { ceo: true });
  s.cash = 100000;
  return s;
}
function week(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
/** Meets phase 2's goals: fame, a year of revenue and three released albums. */
function readyForPhase2(s) {
  const g = PHASES[1].goals;
  s.fame = g.fame + 50;
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({
    week: i + 1,
    albumIncome: Math.ceil(g.revenue / 52) + 10,
    hqIncome: 0,
    otherIncome: 0,
  }));
  for (let i = 0; i < g.releases; i++)
    s.albums.push({ id: 900 + i, released: true, quality: 60, age: 30, salesWeeks: 12, chart: {} });
}

test("Phase progress lists the next phase's goals with what the label has", () => {
  const s = ceo();
  const pr = G.phaseProgress(s);
  assert.equal(pr.next.name, "Indie label");
  assert.deepEqual(
    pr.goals.map((g) => g.key),
    ["fame", "revenue", "releases", "hits"],
  );
  assert.equal(pr.met, false);
  assert.equal(pr.goals.find((g) => g.key === "hits").met, true, "phase 2 needs no hits");
  assert.equal(G.phaseProgress(G.create(21, { ceo: false })), null, "classic runs have no phase progress");
});

test("Revenue counts the last 52 weeks of income and ignores losses", () => {
  const s = ceo();
  s.financeHistory = [
    { albumIncome: 1000, hqIncome: 200, otherIncome: 300 },
    { albumIncome: -50, hqIncome: 0, otherIncome: 0 },
  ];
  assert.equal(G.yearRevenue(s), 1500);
});

test("Meeting every goal moves the label up one phase at the settlement", () => {
  const s = ceo();
  readyForPhase2(s);
  assert.equal(G.phaseProgress(s).met, true);
  const notes = s.notifications.length;
  week(s);
  assert.equal(s.company.phase, 2);
  assert.equal(G.companyPhase(s).name, "Indie label");
  assert.equal(s.company.history.at(-1).phase, 2);
  assert.equal(s.company.since, s.company.history.at(-1).week);
  assert.ok(s.company.since >= 1 && s.company.since <= s.week);
  const n = s.notifications.slice(notes).find((x) => x.kind === "phase");
  assert.ok(n, "a phase notification is raised");
  assert.match(n.title, /Phase 2 · Indie label/);
  assert.ok(s.news.some((x) => /phase 2: Indie label/.test(x)));
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
});

test("Missing one goal holds the label where it is", () => {
  const s = ceo();
  readyForPhase2(s);
  s.fame = PHASES[1].goals.fame - 1;
  week(s);
  assert.equal(s.company.phase, 1);
});

test("A phase is never lost, and the label moves at most one phase a week", () => {
  const s = ceo();
  readyForPhase2(s);
  s.fame = 10 ** 6;
  for (let i = 0; i < 20; i++) s.albums.push({ id: 950 + i, released: true, quality: 90, chart: {} });
  s.financeHistory.forEach((w) => (w.albumIncome = 10 ** 6));
  week(s);
  assert.equal(s.company.phase, 2, "one phase per settlement");
  week(s);
  assert.equal(s.company.phase, 3);
  s.fame = 0;
  s.financeHistory = [];
  week(s);
  assert.equal(s.company.phase, 3, "falling below the goals does not demote");
});

test("The last phase has no next goals", () => {
  const s = ceo();
  s.company.phase = PHASES.length;
  assert.equal(G.phaseProgress(s), null);
  week(s);
  assert.equal(s.company.phase, PHASES.length);
});

test("A classic run never changes phase", () => {
  const s = G.create(21, { ceo: false });
  readyForPhase2(s);
  week(s);
  assert.equal(s.company, undefined);
});

test("A home studio only finds local talent, over 200 searches", () => {
  const s = ceo(31),
    lim = G.REACH_SCOUTING.local;
  s.cash = 10 ** 7;
  const pool = [...s.candidates];
  for (let i = 0; i < 200; i++) {
    G.paidScout(s, 0);
    pool.push(...s.candidates);
  }
  assert.ok(pool.length > 600);
  for (const a of pool) {
    assert.ok(a.talent <= lim.talentMax, `craft ${a.talent}`);
    assert.ok(a.potential <= lim.potentialMax && a.potential >= a.talent, `potential ${a.potential}`);
    assert.equal(a.reach, "local");
  }
});

test("Paid searches beyond the label's reach are locked with the phase that opens them", () => {
  const s = ceo(32);
  s.cash = 10 ** 6;
  assert.equal(G.scoutLocked(s, 0), "");
  assert.match(G.scoutLocked(s, 1), /phase 3, Regional label/);
  assert.match(G.scoutLocked(s, 2), /phase 4, National label/);
  const cash = s.cash;
  assert.throws(() => G.paidScout(s, 1), /phase 3/);
  assert.equal(s.cash, cash, "a locked search costs nothing");
  s.company.phase = 3;
  assert.equal(G.scoutLocked(s, 1), "");
  G.paidScout(s, 1);
  assert.ok(s.candidates.every((a) => a.reach === "region"));
});

test("A regional label finds better talent than a home studio", () => {
  const best = (phase) => {
    const s = ceo(33);
    s.company.phase = phase;
    s.cash = 10 ** 7;
    let top = 0;
    for (let i = 0; i < 100; i++) {
      G.paidScout(s, phase >= 3 ? 1 : 0);
      top = Math.max(top, ...s.candidates.map((a) => a.talent));
    }
    return top;
  };
  assert.ok(best(1) <= G.REACH_SCOUTING.local.talentMax);
  assert.ok(best(3) > G.REACH_SCOUTING.local.talentMax);
});

test("Prospects from events stay within the label's reach", () => {
  const s = ceo(34);
  s.cash = 10 ** 6;
  // Signing replaces a prospect with a newcomer drawn from the top budget.
  G.sign(s, s.candidates[0].id);
  for (const a of s.candidates) assert.ok(a.talent <= G.REACH_SCOUTING.local.talentMax);
});

test("Classic scouting is unchanged: no reach tags, no caps, no locks", () => {
  const s = G.create(35, { ceo: false });
  s.cash = 10 ** 7;
  assert.equal(G.scoutLimits(s), null);
  assert.equal(G.scoutLocked(s, 2), "");
  let top = 0;
  for (let i = 0; i < 50; i++) {
    G.paidScout(s, 2);
    top = Math.max(top, ...s.candidates.map((a) => a.talent));
    assert.ok(s.candidates.every((a) => a.reach === undefined));
  }
  assert.ok(top > G.REACH_SCOUTING.local.talentMax);
  assert.deepEqual(
    G.create(35, { ceo: false }).candidates,
    G.create(35, { ceo: false }).candidates,
    "same seed, same prospects",
  );
});

test("A label is Goat Records unless named, and a new run can be named for free", () => {
  assert.equal(G.labelName(G.create(51, { ceo: false })), "Goat Records");
  assert.equal(G.create(51, { ceo: false }).labelName, undefined, "classic saves gain no name field");
  const s = G.create(51, { ceo: true, labelName: "  Dynasty   Sound " });
  assert.equal(G.labelName(s), "Dynasty Sound");
  assert.equal(s.fame, 0);
  assert.ok(s.news.some((x) => /Welcome to Dynasty Sound/.test(x)));
});

test("The label's name appears on its chart entries", () => {
  const s = G.create(52, { ceo: true, labelName: "Crown Lane" });
  s.cash = 10 ** 6;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { talent: 90, inspiration: 90, energy: 100 });
  G.record(s, {
    artistId: a.id,
    boothId: 0,
    genre: a.genre,
    audience: a.audience,
    budget: 4000,
    themes: [s.themes[0]],
  });
  for (let i = 0; i < 60 && !s.albums[0].released; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    const p = s.albums[0];
    const d = p.production;
    if (d?.releaseReady) {
      G.releaseAlbum(s, p.id, p.title, "fans");
      continue;
    }
    if (d && !d.cooldown && !d.review) G.decideStage(s, p.id, 0);
    if (d && !d.cooldown) G.continueProduction(s, p.id);
    if (!G.productionBlock(s)) G.advance(s);
  }
  for (let i = 0; i < 3; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    for (const p of s.albums) p.launchReview = false;
    G.advance(s);
  }
  const mine = s.charts.entries.filter((e) => e.owned);
  assert.ok(mine.length, "the album charted");
  assert.ok(mine.every((e) => e.label === "Crown Lane"));
});

test("Renaming costs fame, is logged and checks the name", () => {
  const s = G.create(53, { ceo: false });
  s.fame = 100;
  G.renameLabel(s, "Gold Standard");
  assert.equal(G.labelName(s), "Gold Standard");
  assert.equal(s.fame, 100 - G.RENAME.fame);
  assert.match(s.news[0], /Goat Records is now Gold Standard/);
  s.fame = 5;
  G.renameLabel(s, "Gold Standard Two");
  assert.equal(s.fame, 0, "fame never goes below zero");
  assert.throws(() => G.renameLabel(s, "   "), /needs a name/);
  assert.throws(() => G.renameLabel(s, 42), /needs a name/);
  assert.throws(() => G.renameLabel(s, "x".repeat(G.RENAME.maxLength + 1)), /32 characters/);
  assert.throws(() => G.renameLabel(s, "Gold Standard Two"), /already called/);
  assert.equal(G.labelName(s), "Gold Standard Two");
});

test("Save checks reject a bad name", () => {
  const s = roundTrip(G.create(54, { ceo: true, labelName: "Fine Name" }));
  assert.equal(G.validSystemsSave(s), true);
  for (const bad of ["", "   ", 7, "y".repeat(40)]) {
    const copy = roundTrip(s);
    copy.labelName = bad;
    assert.equal(G.validSystemsSave(copy), false, JSON.stringify(bad));
  }
});

test("A CEO run starts with the apartment, its bedroom booth as the first floor", () => {
  const s = ceo(61);
  assert.equal(s.company.buildings.length, 1);
  assert.deepEqual(G.allFloors(s), [
    { building: "apartment", index: 0, floor: { type: "room", room: 0, level: 1 } },
  ]);
  assert.deepEqual(
    s.booths.map((b) => b.id),
    [0],
  );
});

test("Buildings open by phase, cost money and are bought once", () => {
  const s = ceo(62);
  s.cash = 10 ** 6;
  assert.throws(() => G.buyBuilding(s, "storefront"), /opens at phase 2, Indie label/);
  assert.throws(() => G.buyBuilding(s, "castle"), /Unknown building/);
  assert.throws(() => G.buyBuilding(s, "apartment"), /already yours/);
  s.company.phase = 2;
  const cash = s.cash;
  G.buyBuilding(s, "storefront");
  assert.equal(s.cash, cash - G.BUILDINGS.find((b) => b.id === "storefront").cost);
  assert.throws(() => G.buyBuilding(s, "storefront"), /already yours/);
  s.cash = 10;
  s.company.phase = 3;
  assert.throws(() => G.buyBuilding(s, "studio"), /cash|Not enough/i);
  assert.equal(
    s.company.buildings.some((b) => b.id === "studio"),
    false,
  );
  assert.throws(() => G.buyBuilding(G.create(62, { ceo: false }), "storefront"), /CEO run/);
});

test("Floors take only their building's types, up to its height, each facility once", () => {
  const s = ceo(63);
  s.cash = 10 ** 7;
  assert.throws(() => G.buildFloor(s, "storefront", "writers"), /Buy the Storefront studio first/);
  assert.throws(() => G.buildFloor(s, "apartment", "bar"), /cannot go in/);
  const cash = s.cash;
  G.buildFloor(s, "apartment", "writers");
  assert.equal(s.cash, cash - G.floorQuote(G.create(63, { ceo: true }), "apartment", "writers"));
  assert.throws(() => G.buildFloor(s, "apartment", "room", 1), /full: 2 floors/);
  s.company.phase = 2;
  G.buyBuilding(s, "storefront");
  assert.throws(() => G.buildFloor(s, "storefront", "writers"), /already built/);
  G.buildFloor(s, "storefront", "vocal");
  assert.equal(s.company.buildings.find((b) => b.id === "storefront").floors.length, 1);
});

test("Each floor up costs more, by the building's structural cost", () => {
  const s = ceo(64);
  s.cash = 10 ** 7;
  s.company.phase = 2;
  G.buyBuilding(s, "storefront");
  const first = G.floorQuote(s, "storefront", "lounge");
  G.buildFloor(s, "storefront", "lounge");
  const second = G.floorQuote(s, "storefront", "merch");
  const def = G.BUILDINGS.find((b) => b.id === "storefront"),
    cost = (id) => G.FACILITIES.find((f) => f.id === id).cost;
  assert.equal(first, cost("lounge"));
  assert.equal(second, cost("merch") + def.floorCost);
});

test("A recording room floor opens a room the studio can record in", () => {
  const s = ceo(65);
  s.cash = 10 ** 7;
  s.company.phase = 2;
  G.buyBuilding(s, "storefront");
  assert.throws(() => G.buildFloor(s, "storefront", "room", 0), /already built/);
  assert.throws(() => G.buildFloor(s, "storefront", "room", 4), /opens at phase 3, Regional label/);
  G.buildFloor(s, "storefront", "room", 1);
  assert.deepEqual(
    s.booths.map((b) => b.id),
    [0, 1],
  );
  assert.throws(() => G.buildFloor(s, "storefront", "room", 1), /already built/);
  assert.throws(() => G.buildFloor(s, "storefront", "room", 99), /Unknown recording room/);
});

test("Facility floors level up to the top level at the usual upgrade price", () => {
  const s = ceo(66);
  s.cash = 10 ** 7;
  G.buildFloor(s, "apartment", "writers");
  const base = G.FACILITIES.find((f) => f.id === "writers").cost;
  let cash = s.cash;
  G.upgradeFloor(s, "apartment", 1);
  assert.equal(s.cash, cash - base);
  cash = s.cash;
  G.upgradeFloor(s, "apartment", 1);
  assert.equal(s.cash, cash - base * 2);
  assert.throws(() => G.upgradeFloor(s, "apartment", 1), /Level 4 opens at phase 2/);
  assert.throws(() => G.upgradeFloor(s, "apartment", 0), /do not level up/);
  assert.throws(() => G.upgradeFloor(s, "apartment", 5), /No such floor/);
});

test("Save checks guard the buildings", () => {
  const ok = roundTrip(ceo(67));
  assert.equal(G.validSystemsSave(ok), true);
  const bad = (change) => {
    const s = roundTrip(ok);
    change(s.company);
    return G.validSystemsSave(s);
  };
  assert.equal(
    bad((c) => (c.buildings = {})),
    false,
  );
  assert.equal(
    bad((c) => c.buildings.push({ id: "apartment", floors: [] })),
    false,
  );
  assert.equal(
    bad((c) => (c.buildings[0].floors[0].type = "bar")),
    false,
  );
  assert.equal(
    bad((c) => (c.buildings[0].floors[0].level = 11)),
    false,
  );
  assert.equal(
    bad((c) => c.buildings[0].floors.push({ type: "writers", level: 1 }, { type: "writers", level: 1 })),
    false,
  );
  assert.equal(
    bad((c) => delete c.buildings),
    true,
    "a CEO save from before buildings still loads",
  );
});

test("Facility floors give their headquarters bonuses, upkeep and takings", () => {
  const s = ceo(71);
  s.cash = 10 ** 7;
  const before = G.hqBonuses(s);
  assert.equal(G.hqUpkeep(s), 0);
  assert.equal(G.builtFacility(s, "writers"), null);
  G.buildFloor(s, "apartment", "writers");
  const writers = G.FACILITIES.find((f) => f.id === "writers");
  assert.ok(G.builtFacility(s, "writers"), "the floor counts as the built facility");
  assert.equal(G.hqUpkeep(s), writers.upkeep);
  const after = G.hqBonuses(s);
  for (const [i, v] of Object.entries(writers.stages || {})) {
    assert.equal(after.stages[i].value, before.stages[i].value + v);
    assert.ok(after.stages[i].sources.includes(writers.name));
  }
  G.upgradeFloor(s, "apartment", 1);
  assert.equal(G.hqUpkeep(s), writers.upkeep * 2, "upkeep scales with the floor's level");
});

test("Floors above each other, or side by side next door, pair up", () => {
  const syn = G.SYNERGIES[0],
    [a, b] = syn.pair;
  // Find buildings that take each half of the pair.
  const holder = (id) =>
    G.BUILDINGS.find((x) => x.floors.includes(id) && x.floors.includes(a) && x.floors.includes(b));
  const both = holder(a);
  assert.ok(both, "some building takes both halves of the first pairing");
  const s = ceo(72);
  s.cash = 10 ** 8;
  s.company.phase = 6;
  if (both.id !== "apartment") G.buyBuilding(s, both.id);
  G.buildFloor(s, both.id, a);
  G.buildFloor(s, both.id, b);
  assert.ok(
    G.activeSynergies(s).some((x) => x.name === syn.name),
    `${a} under ${b} pairs up`,
  );
  assert.deepEqual(
    G.facilitiesOf(s).map((f) => [f.id, f.building]),
    [
      [a, both.id],
      [b, both.id],
    ],
  );
});

test("A classic run still reads its lot tiles", () => {
  const s = G.create(73, { ceo: false });
  assert.equal(G.facilitiesOf(s), s.hq.facilities);
});

test("Each company revenue stream opens in its specified phase", () => {
  const s = ceo(74);
  s.cash = 100000;
  G.sign(s, s.candidates[0].id);
  s.albums.push({ released: true, age: 1, salesWeeks: 12, quality: 79 });
  const streamIds = [
    ["beats", "downloads"],
    ["streams", "merch"],
    ["distribution", "radio"],
    ["sync", "brand"],
    ["publishing", "catalog"],
    [],
  ];
  for (const phase of G.PHASES) {
    s.company.phase = phase.id;
    const income = G.companyRevenue(s);
    assert.deepEqual(Object.keys(income), streamIds.slice(0, phase.id).flat());
    for (const id of Object.keys(income)) assert.ok(income[id] > 0, id);
  }
  s.albums[0].age = s.albums[0].salesWeeks;
  assert.equal(G.companyRevenue(s).streams, 0);
  assert.ok(G.companyRevenue(s).catalog > 0);
});

test("Weekly settlement itemizes company income and growing costs without charging interest twice", () => {
  const s = ceo(75);
  s.cash = 100000;
  s.company.phase = 4;
  G.takeFunding(s, "loan");
  const costs = G.companyCosts(s);
  const overhead = G.upkeep(s);
  const income = G.companyRevenue(s);
  const totalIncome = Object.values(income).reduce((sum, value) => sum + value, 0);
  assert.ok(costs.rent > 0 && costs.insurance > 0 && costs.interest > 0);
  G.advance(s);
  const row = s.financeHistory.at(-1);
  assert.deepEqual(row.companyRevenue, income);
  assert.deepEqual(row.companyCosts, costs);
  assert.equal(row.otherIncome, totalIncome);
  assert.equal(row.cashChange, totalIncome - overhead);

  const classic = G.create(76, { ceo: false });
  G.advance(classic);
  assert.equal(classic.financeHistory.at(-1).companyRevenue, undefined);
  assert.equal(classic.financeHistory.at(-1).companyCosts, undefined);
});

test("Company value uses trailing revenue, growth, hit rate, catalog, cash, debt and market mood", () => {
  const s = ceo(77);
  s.company.phase = 2;
  s.cash = 1000;
  s.company.loan = { amount: 600, balance: 600, payment: 50 };
  s.company.marketMood = 1.2;
  s.financeHistory = Array.from({ length: 52 }, (_, index) => ({ albumIncome: index < 26 ? 80 : 120 }));
  s.albums.push(
    { released: true, quality: 80, total: 750 },
    { released: true, quality: 60, total: 250 },
    { released: false, quality: 100, total: 2000 },
  );
  assert.deepEqual(G.companyValuation(s), {
    value: 15750,
    sharePrice: 1.89,
    mood: 1.2,
    multiple: 2.875,
    revenue: 5200,
    growth: 0.5,
    hitRate: 0.5,
    catalogValue: 400,
    debt: 600,
  });
  assert.equal(G.companyValuation(G.create(77, { ceo: false })), null);
});

test("Funding updates share ownership and older CEO saves derive it from existing ownership", () => {
  const s = ceo(78);
  s.company.phase = 2;
  const angel = G.takeFunding(s, "angel", 0);
  s.company.phase = 3;
  const venture = G.takeFunding(s, "venture", 0);
  const yours = Math.round(10000 * (1 - angel.equity) * (1 - venture.equity));
  assert.deepEqual(s.company.shares, { total: 10000, yours, investors: 10000 - yours });
  const oldSave = roundTrip(s);
  delete oldSave.company.shares;
  assert.ok(G.validSystemsSave(oldSave));
  assert.deepEqual(G.migrate(oldSave).company.shares, s.company.shares);
  oldSave.company.shares.yours++;
  assert.equal(G.validSystemsSave(oldSave), false);
});

function ipoFixture() {
  const s = ceo(79);
  s.cash = 2000000;
  s.company.phase = 2;
  G.takeFunding(s, "angel", 0);
  s.company.phase = 5;
  G.appointHead(s, "finance", { skill: 60 });
  s.company.annualProfit = [
    { year: 1, profit: 1 },
    { year: 2, profit: 1 },
    { year: 3, profit: 1 },
  ];
  s.company.board.confidence = 60;
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({
    week: 106 + i,
    albumIncome: 50000,
    cashChange: 10000,
  }));
  s.week = 157;
  return s;
}

test("An IPO requires phase five, three profitable years, a skilled CFO and confident directors", () => {
  for (const miss of [
    (s) => {
      s.company.phase = 4;
    },
    (s) => {
      s.company.annualProfit[1].profit = 0;
    },
    (s) => {
      s.company.departments.finance.head = null;
    },
    (s) => {
      s.company.departments.finance.head.skill = 59;
    },
    (s) => {
      s.company.board.confidence = 59;
    },
  ]) {
    const s = ipoFixture();
    miss(s);
    assert.ok(!G.ipoRequirements(s)?.ready);
    assert.throws(() => G.goPublic(s), /IPO requirements/);
  }
  const s = ipoFixture();
  s.company.board.scandals = 4;
  const value = G.companyValuation(s).value;
  const ownership = s.company.ownership;
  const cash = s.cash;
  const offered = G.goPublic(s);
  assert.equal(offered.proceeds, Math.round((value * 0.9) / 3));
  assert.equal(offered.price, Math.round((offered.proceeds / 2500) * 100) / 100);
  assert.equal(s.cash, cash + offered.proceeds);
  assert.equal(s.company.phase, 6);
  assert.equal(s.company.ownership, Math.round(ownership * 0.75 * 10000) / 10000);
  assert.equal(G.seats(s), 9);
  assert.equal(s.company.board.nextReview, s.week + 26);
  assert.equal(s.company.analyst.dueWeek, s.week + 26);
  assert.equal(s.company.analyst.revenue, 1378000);
  assert.equal(offered.scene, true);
  G.acknowledgeIPO(s);
  assert.equal(offered.scene, false);
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
  assert.throws(() => G.goPublic(s), /IPO requirements/);
});

test("Annual profit comes from settlements and analysts move sentiment at half-year reviews", () => {
  const s = ipoFixture();
  s.week = 156;
  s.financeHistory.pop();
  week(s);
  assert.equal(s.company.annualProfit.at(-1).year, 3);
  assert.ok(s.company.annualProfit.at(-1).profit > 0);
  s.company.board.confidence = 60;
  G.goPublic(s);
  G.acknowledgeIPO(s);
  const first = s.company.analyst.dueWeek;
  s.week = first - 1;
  s.financeHistory = Array.from({ length: 51 }, () => ({ albumIncome: 100000, cashChange: 10000 }));
  week(s);
  assert.equal(s.company.analyst.last.met, true);
  assert.equal(s.company.marketMood, 1.05);
  assert.equal(s.company.board.analystConfidence, 5);
  assert.equal(s.company.board.nextReview, first + 26);
  s.week = first + 25;
  s.financeHistory = Array.from({ length: 51 }, () => ({ albumIncome: 100, cashChange: 100 }));
  week(s);
  assert.equal(s.company.analyst.last.met, false);
  assert.equal(s.company.marketMood, 1);
  assert.equal(s.company.board.analystConfidence, 0);
  assert.equal(s.company.board.nextReview, first + 52);
});

test("Catalog purchases earn weekly royalties and cannot be bought twice", () => {
  const s = ceo(80);
  assert.deepEqual(G.acquisitionOffers(s), []);
  s.company.phase = 6;
  s.cash = 1000000;
  const offer = G.acquisitionOffers(s)[0];
  const cash = s.cash;
  const owned = G.buyAcquisition(s, offer.id);
  assert.equal(s.cash, cash - offer.price);
  assert.equal(owned.debt, 0);
  assert.throws(() => G.buyAcquisition(s, offer.id), /unavailable/);
  G.advance(s);
  assert.equal(s.financeHistory.at(-1).companyRevenue.acquisitions, offer.revenue);
  assert.ok(G.validSystemsSave(roundTrip(s)));
});

test("Financing a small label transfers its artist and repays acquisition debt weekly", () => {
  const s = ceo(81);
  s.company.phase = 6;
  s.cash = 1000000;
  const offer = G.acquisitionOffers(s).find(({ kind }) => kind === "label");
  const cash = s.cash;
  const owned = G.buyAcquisition(s, offer.id, true);
  assert.equal(s.cash, cash - offer.down);
  assert.equal(owned.debt, offer.price - offer.down);
  assert.equal(s.artists[0].id, offer.artist.id);
  assert.equal(s.artists[0].contract.remaining, 3);
  assert.ok(!s.rivalArtists.some(({ id }) => id === offer.artist.id));
  const debt = owned.debt;
  G.advance(s);
  assert.ok(owned.debt < debt);
  assert.equal(G.companyValuation(s).debt, owned.debt);
  assert.equal(s.financeHistory.at(-1).companyCosts.acquisitionPayments, owned.payment);
});

test("A majority can veto a purchase above budget even under high creative freedom", () => {
  const s = ipoFixture();
  G.goPublic(s);
  const board = s.company.board;
  board.freedom = "high";
  board.budget = 1;
  for (const director of board.directors) director.promises = -100;
  const offer = G.acquisitionOffers(s)[0];
  const cash = s.cash;
  const spent = board.spent;
  assert.equal(G.buyAcquisition(s, offer.id), null);
  G.choose(s, 0);
  assert.ok(s.news.some((line) => line.includes("vetoed the acquisition")));
  assert.equal(s.cash, cash);
  assert.equal(s.company.acquisitions, undefined);
  for (const director of board.directors) director.promises = 100;
  assert.equal(G.buyAcquisition(s, offer.id), null);
  G.choose(s, 0);
  assert.ok(G.buyAcquisition(s, offer.id));
  assert.equal(s.cash, cash - offer.price);
  assert.equal(board.spent, spent + offer.price);
});

console.log(`${count} company tests passed.`);
