// Funding and the board (2.0): offers, dilution, seats, and no board without investors.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { FUNDING, VALUATION, PHASES, DIRECTORS } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(phase = 1, seed = 41) {
  const s = G.create(seed, { ceo: true });
  s.company.phase = phase;
  return s;
}
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
const kinds = (s) => G.fundingOffers(s).map((o) => o.kind);

test("A new CEO run owns all of itself, owes nothing and has no board", () => {
  const s = ceo();
  assert.equal(s.company.ownership, 1);
  assert.deepEqual(s.company.rounds, []);
  assert.equal(s.company.loan, null);
  assert.equal(G.board(s), null);
  assert.equal(G.seats(s), 0);
  assert.equal(G.create(41).company, undefined, "classic runs have no funding");
  assert.deepEqual(G.fundingOffers(G.create(41)), []);
});

test("Offers open by phase: a loan always, an angel in phase 2, venture rounds in phases 3–5", () => {
  assert.deepEqual(kinds(ceo(1)), ["loan"]);
  assert.deepEqual(kinds(ceo(2)), ["loan", "angel", "angel"]);
  for (const p of [3, 4, 5]) assert.deepEqual(kinds(ceo(p)), ["loan", "venture", "venture"]);
  assert.deepEqual(kinds(ceo(6)), ["loan"]);
  const s = ceo(3);
  assert.deepEqual(
    G.fundingOffers(s)
      .filter((o) => o.kind === "venture")
      .map((o) => o.equity),
    FUNDING.venture.terms,
  );
});

test("A bank loan adds cash and weekly payments but no seats and no board", () => {
  const s = ceo(1),
    cash = s.cash,
    offer = G.fundingOffers(s)[0];
  assert.equal(offer.amount, FUNDING.loan.limit[0]);
  G.takeFunding(s, "loan");
  assert.equal(s.cash, cash + offer.amount);
  assert.equal(s.company.ownership, 1);
  assert.equal(G.board(s), null, "a loan brings no board");
  assert.deepEqual(kinds(s), [], "one loan at a time");
  assert.throws(() => G.takeFunding(s, "loan"), /Repay the current loan/);
  const upkeep = G.upkeep(s);
  s.company.loan = null;
  assert.equal(upkeep - G.upkeep(s), offer.payment, "the payment is part of the weekly costs");
  s.company.loan = { amount: offer.amount, balance: offer.amount, payment: offer.payment, week: s.week };
  s.cash = 100000;
  const balance = s.company.loan.balance;
  settle(s);
  assert.ok(s.company.loan.balance < balance, "each week pays some of it off");
  s.company.loan.balance = 10;
  const due = G.loanPayment(s);
  assert.ok(due <= 11);
  settle(s);
  assert.equal(s.company.loan, null, "paid off");
});

test("Repaying a loan early clears it", () => {
  const s = ceo(2);
  G.takeFunding(s, "loan");
  const balance = s.company.loan.balance,
    cash = s.cash;
  G.repayLoan(s);
  assert.equal(s.cash, cash - balance);
  assert.equal(s.company.loan, null);
  assert.throws(() => G.repayLoan(s), /no loan/);
});

test("An angel buys a share for one seat; the board appears with them", () => {
  const s = ceo(2),
    value = G.valuation(s),
    offer = G.fundingOffers(s).find((o) => o.kind === "angel" && o.equity === 0.2),
    cash = s.cash;
  assert.equal(value, VALUATION.floor[1]);
  assert.equal(offer.amount, Math.round(value * 0.2));
  const taken = G.takeFunding(s, "angel", 1);
  assert.equal(s.cash, cash + offer.amount);
  assert.equal(s.company.ownership, 0.8);
  assert.equal(G.seats(s), 1);
  assert.equal(taken.directors.length, 1);
  const d = G.board(s).directors[0];
  assert.ok(G.BACKERS.angel.includes(d.type));
  assert.equal(d.satisfaction, 50);
  assert.equal(d.patience, DIRECTORS.find((x) => x.id === d.type).patience);
  assert.deepEqual(kinds(s), ["loan"], "one angel ever");
});

test("Venture rounds dilute on top of earlier rounds and fill seats up to the phase's board", () => {
  const s = ceo(2);
  G.takeFunding(s, "angel", 0);
  assert.equal(s.company.ownership, 0.9);
  s.company.phase = 3;
  G.takeFunding(s, "venture", 1);
  assert.equal(s.company.ownership, 0.63, "0.9 × 0.7");
  assert.equal(G.seats(s), 1 + FUNDING.venture.seats);
  assert.ok(G.seats(s) <= PHASES[2].boardSeats);
  assert.deepEqual(kinds(s), ["loan"], "one round a phase");
  s.company.phase = 4;
  G.takeFunding(s, "venture", 0);
  assert.equal(s.company.ownership, Math.round(0.63 * 0.85 * 10000) / 10000);
  assert.equal(G.seats(s), 5);
  assert.equal(s.company.rounds.map((r) => r.name).join(","), "Angel investor,Series A,Series B");
  s.company.phase = 5;
  G.takeFunding(s, "venture", 1);
  assert.ok(s.company.ownership < 0.5, "below half the company");
  assert.equal(G.seats(s), 7);
  assert.equal(G.board(s).directors.length, new Set(G.board(s).directors.map((d) => d.id)).size);
});

test("A round never adds more seats than the phase's board holds", () => {
  const s = ceo(3);
  s.company.board = { directors: [], nextId: 1, since: 1 };
  for (let i = 0; i < PHASES[2].boardSeats; i++)
    s.company.board.directors.push({
      id: s.company.board.nextId++,
      type: "accountant",
      name: "X",
      patience: 1,
      relationship: 0,
      satisfaction: 50,
      since: 1,
    });
  const offer = G.fundingOffers(s).find((o) => o.kind === "venture");
  assert.equal(offer.seats, 0);
  G.takeFunding(s, "venture", 0);
  assert.equal(G.seats(s), PHASES[2].boardSeats);
});

test("Rounds are priced from revenue once it beats the floor", () => {
  const s = ceo(3);
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, albumIncome: 20000 }));
  const revenue = G.yearRevenue(s);
  assert.equal(G.valuation(s), Math.round(Math.max(VALUATION.floor[2], revenue * VALUATION.multiple[2])));
});

test("No board without investors, however long the run", () => {
  const s = ceo(1);
  s.cash = 100000;
  G.takeFunding(s, "loan");
  for (let i = 0; i < 30; i++) settle(s);
  assert.equal(G.board(s), null);
  assert.equal(s.company.ownership, 1);
});

test("Funding survives a save, bad funding data is rejected, older CEO saves gain it", () => {
  const s = ceo(2);
  G.takeFunding(s, "angel", 0);
  G.takeFunding(s, "loan");
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  G.migrate(copy);
  assert.deepEqual(copy.company.board, s.company.board);
  const bad = (f) => {
    const x = roundTrip(s);
    f(x);
    return G.validSystemsSave(x);
  };
  assert.equal(
    bad((x) => (x.company.ownership = 1.5)),
    false,
  );
  assert.equal(
    bad((x) => (x.company.board.directors[0].type = "king")),
    false,
  );
  assert.equal(
    bad((x) => (x.company.loan.balance = -5)),
    false,
  );
  const old = roundTrip(ceo(1));
  for (const k of ["ownership", "rounds", "loan"]) delete old.company[k];
  assert.equal(G.validSystemsSave(old), true);
  G.migrate(old);
  assert.equal(old.company.ownership, 1);
  assert.deepEqual(old.company.rounds, []);
});

// ---- Board confidence (T19) ----
const { METRICS, MONEY_STEP } = G;
/** A phase-3 board with one director of each listed type and fixed targets. */
function seatedBoard(types, targets) {
  const s = ceo(3);
  s.company.board = {
    directors: types.map((type, i) => ({
      id: i + 1,
      type,
      name: "D" + i,
      patience: 1,
      relationship: 0,
      satisfaction: 50,
      since: 1,
    })),
    nextId: types.length + 1,
    since: 1,
    scandals: 0,
    targets,
  };
  return s;
}
const TARGETS = {
  profit: 1000,
  growth: 100000,
  cash: 50000,
  welfare: 70,
  reputation: 60,
  scandals: 0,
  valuation: 400000,
};

test("Metric points follow the step for money, percent and plain metrics, capped", () => {
  const s = seatedBoard(["accountant"], TARGETS),
    unit = MONEY_STEP[2];
  assert.equal(G.metricPoints(s, "profit", 1000 + unit, 1000), 1 / METRICS.profit.step);
  assert.equal(G.metricPoints(s, "cash", 50000 - 10 * unit, 50000), -10 / METRICS.cash.step);
  assert.ok(Math.abs(G.metricPoints(s, "growth", 120000, 100000) - 20 / METRICS.growth.step) < 1e-9);
  assert.equal(G.metricPoints(s, "welfare", 80, 70), 10 / METRICS.welfare.step);
  assert.equal(G.metricPoints(s, "scandals", 2, 0), 2 / METRICS.scandals.step);
  assert.equal(G.metricPoints(s, "scandals", 10, 0), METRICS.scandals.cap, "capped");
  assert.equal(G.metricPoints(s, "growth", 9e9, 100000), METRICS.growth.cap);
  assert.equal(G.metricPoints(s, "growth", 5000, 0), 0, "no target, no percent change");
});

test("Satisfaction is 50 + Σ points × agenda weight + relationship + promises, on fixed inputs", () => {
  const s = seatedBoard(["accountant"], TARGETS),
    d = s.company.board.directors[0],
    unit = MONEY_STEP[2],
    values = { ...TARGETS, profit: 1000 + 3 * unit, cash: 50000 + 10 * unit, growth: 108000 };
  // profit +6 × 1, cash +2 × 0.8, growth +2 × 0.2
  const expected = 50 + 6 * 1 + 2 * 0.8 + 2 * 0.2;
  assert.equal(G.satisfaction(s, d, values).value, Math.round(expected));
  d.relationship = 5;
  d.promises = -4;
  assert.equal(G.satisfaction(s, d, values).value, Math.round(expected + 1));
  const reasons = G.satisfaction(s, d, values).reasons;
  assert.deepEqual(
    reasons.map((r) => [r.key, r.points]),
    [
      ["profit", 6],
      ["relationship", 5],
      ["promises", -4],
      ["cash", 1.6],
      ["growth", 0.4],
    ],
    "reasons, largest first",
  );
  d.relationship = -30;
  assert.equal(
    G.satisfaction(s, d, { ...values, profit: -9e9, cash: -9e9, growth: 0 }).value,
    0,
    "never below 0",
  );
  d.relationship = 30;
  assert.equal(
    G.satisfaction(s, d, { ...values, profit: 9e9, cash: 9e9, growth: 9e9 }).value,
    100,
    "never above 100",
  );
});

test("Each agenda reacts to its own metric", () => {
  const types = G.DIRECTORS.map((d) => d.id),
    s = seatedBoard(types, TARGETS),
    base = (d, values) => G.satisfaction(s, d, values).value,
    find = (type) => s.company.board.directors.find((d) => d.type === type),
    step = MONEY_STEP[2];
  const cases = [
    ["accountant", { profit: TARGETS.profit + 5 * step }],
    ["visionary", { growth: TARGETS.growth * 1.2 }],
    ["friend", { welfare: TARGETS.welfare + 10 }],
    ["oldGuard", { scandals: 0, reputation: TARGETS.reputation + 10 }],
    ["investor", { valuation: TARGETS.valuation * 1.2 }],
  ];
  for (const [type, change] of cases) {
    const d = find(type),
      before = base(d, TARGETS),
      after = base(d, { ...TARGETS, ...change });
    assert.ok(after > before, `${type} likes ${Object.keys(change).join(", ")}`);
    for (const other of types.filter((t) => t !== type)) {
      const o = find(other),
        agenda = G.DIRECTORS.find((x) => x.id === other).agenda;
      if (!Object.keys(change).some((k) => agenda[k]))
        assert.equal(base(o, { ...TARGETS, ...change }), base(o, TARGETS), `${other} ignores it`);
    }
  }
  const guard = find("oldGuard");
  assert.ok(base(guard, { ...TARGETS, scandals: 2 }) < base(guard, TARGETS), "the Old Guard hates scandals");
  assert.equal(base(find("friend"), { ...TARGETS, scandals: 2 }), base(find("friend"), TARGETS));
});

test("Confidence is the seat-weighted average of satisfaction", () => {
  const s = seatedBoard(["accountant", "friend", "visionary"], TARGETS),
    values = { ...TARGETS, profit: TARGETS.profit + 10 * MONEY_STEP[2], welfare: 50 },
    each = s.company.board.directors.map((d) => G.satisfaction(s, d, values).value);
  assert.equal(G.confidence(s, values), Math.round(each.reduce((n, x) => n + x, 0) / each.length));
  assert.equal(G.confidence(ceo(3)), null, "no board, no confidence");
});

test("The board reports each director's satisfaction with its reasons", () => {
  const s = ceo(2);
  s.cash = 50000;
  G.takeFunding(s, "angel", 0);
  const report = G.boardReport(s);
  assert.equal(report.directors.length, 1);
  assert.equal(report.confidence, 50, "at the targets the board starts at 50");
  assert.deepEqual(report.targets, G.metricValues(s));
  s.reputation += 30;
  s.artists.forEach((a) => (a.morale = 100));
  s.cash += 5e5;
  const later = G.boardReport(s).directors[0];
  assert.ok(later.reasons.length > 0);
  assert.ok(later.reasons.every((r) => typeof r.name === "string" && Number.isFinite(r.points)));
});

test("Scandals count toward the Old Guard and the week stores satisfaction and confidence", () => {
  const s = ceo(2);
  s.cash = 200000;
  G.sign(s, s.candidates[0].id);
  G.takeFunding(s, "angel", 0);
  s.company.board.directors[0].type = "oldGuard";
  const a = s.artists[0];
  s.event = { id: 9001, title: "Scandal", artist: a.id, options: [{ label: "Ride it out", trust: -10 }] };
  G.choose(s, 0);
  assert.equal(s.company.board.scandals, 1);
  settle(s);
  const d = s.company.board.directors[0];
  assert.equal(d.satisfaction, G.satisfaction(s, d).value);
  assert.equal(s.company.board.confidence, G.confidence(s));
  assert.ok(d.satisfaction < 50, "the scandal cost the Old Guard");
  assert.equal(G.validSystemsSave(roundTrip(s)), true);
});

console.log(`${count} board tests passed.`);
