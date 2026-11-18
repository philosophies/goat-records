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

// ---- The periodic review (T20) ----
const { REVIEW } = G;
/** A phase-2 run with an angel on the board, plenty of cash, and the review due now. */
function reviewRun(satisfactionOf = 50, seats = 1) {
  const s = ceo(2);
  s.cash = 500000;
  G.takeFunding(s, "angel", 0);
  const b = s.company.board;
  while (b.directors.length < seats) b.directors.push({ ...b.directors[0], id: b.nextId++ });
  return s;
}
/** Forces each director's satisfaction in turn. */
function setEach(s, values) {
  s.company.board.directors.forEach((d, i) => {
    d.relationship = 0;
    d.relationship = values[i] - G.satisfaction(s, d).value;
  });
}
/** Forces every director's satisfaction (and so confidence) through their relationship. */
function setMood(s, value) {
  for (const d of s.company.board.directors) {
    d.relationship = 0;
    d.relationship = value - G.satisfaction(s, d).value;
  }
  assert.equal(G.confidence(s), value);
}

test("A label without a board never gets a review and cannot be fired", () => {
  const s = ceo(1);
  s.cash = 1e6;
  for (let i = 0; i < 60; i++) settle(s);
  assert.equal(G.board(s), null);
  assert.equal(s.finished, false);
  assert.throws(() => G.runReview(s), /no board/);
  assert.equal(G.approvesPhase(s), true, "no board, no vote on phases");
});

test("The board forms with a first budget and the next review a year away", () => {
  const s = reviewRun(),
    b = s.company.board;
  assert.equal(b.budget, REVIEW.budget.floor[1]);
  assert.equal(b.budgetLeft, b.budget);
  assert.equal(b.freedom, "medium");
  assert.deepEqual(b.perks, []);
  assert.equal(b.nextReview, s.week + REVIEW.intervalWeeks);
});

test("The review comes once a year and sets the next period", () => {
  const s = reviewRun(),
    b = s.company.board;
  b.nextReview = s.week + 1;
  s.notifications = [];
  settle(s);
  assert.equal(b.reviews.length, 1);
  assert.equal(b.nextReview, s.week + REVIEW.intervalWeeks);
  assert.equal(s.notifications.at(-1).kind, "board");
  settle(s);
  assert.equal(b.reviews.length, 1, "not again until the next one is due");
  s.company.public = true;
  G.runReview(s);
  assert.equal(b.nextReview, s.week + REVIEW.publicInterval, "twice a year once public");
});

test("Each confidence band sets creative freedom and perks", () => {
  const cases = [
    [20, "low", []],
    [45, "medium", []],
    [60, "medium", ["car"]],
    [75, "high", ["car", "penthouse"]],
    [90, "high", ["car", "penthouse", "jet"]],
  ];
  for (const [c, freedom, perks] of cases) {
    const s = reviewRun();
    setMood(s, c);
    const r = G.runReview(s);
    assert.equal(r.confidence, c);
    assert.equal(s.company.board.freedom, c < REVIEW.probationBelow ? "low" : freedom, `freedom at ${c}`);
    assert.deepEqual(s.company.board.perks, perks, `perks at ${c}`);
  }
  assert.equal(G.freedomFor(50, true), "low", "one step lower on probation");
  assert.equal(G.freedomFor(80, true), "medium");
  assert.equal(G.freedomFor(10, true), "low", "never below low");
});

test("Perks cost money every week", () => {
  const s = reviewRun();
  setMood(s, 90);
  G.runReview(s);
  const cost = REVIEW.perks.reduce((n, p) => n + p.weekly, 0);
  assert.equal(G.perkCost(s), cost);
  const upkeep = G.upkeep(s);
  s.company.board.perks = [];
  assert.equal(upkeep - G.upkeep(s), cost);
});

test("The budget follows design 4: last × (0.8 + 0.4 × confidence) × (1 + growth)", () => {
  const s = reviewRun(),
    b = s.company.board;
  b.budget = 100000;
  b.targets.growth = 50000;
  s.financeHistory = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, albumIncome: 1500 }));
  const revenue = G.yearRevenue(s),
    growth = Math.min(1, revenue / 50000 - 1);
  assert.equal(
    G.reviewBudget(s, 60),
    Math.max(REVIEW.budget.floor[1], Math.round(100000 * (0.8 + 0.24) * (1 + growth))),
  );
  b.targets.growth = revenue * 4;
  assert.equal(
    G.reviewBudget(s, 60),
    Math.max(REVIEW.budget.floor[1], Math.round(100000 * 1.04 * 0.5)),
    "growth floored at −50%",
  );
});

test("Below 35 puts you on probation; a good next review lifts it", () => {
  const s = reviewRun();
  setMood(s, 30);
  const r = G.runReview(s);
  assert.equal(r.vote, null, "30 is not low enough for a vote");
  assert.equal(s.company.board.probation, true);
  assert.equal(s.company.board.freedom, "low");
  setMood(s, 50);
  G.runReview(s);
  assert.equal(s.company.board.probation, false);
  assert.equal(s.company.board.freedom, "medium");
});

test("A vote comes below 20 on probation or below 10 at any review", () => {
  const onProbation = reviewRun();
  setMood(onProbation, 30);
  G.runReview(onProbation);
  setMood(onProbation, 18);
  assert.notEqual(G.runReview(onProbation).vote, null);
  const fresh = reviewRun();
  setMood(fresh, 18);
  assert.equal(G.runReview(fresh).vote, null, "18 off probation: probation, no vote");
  const crash = reviewRun();
  setMood(crash, 8);
  assert.notEqual(G.runReview(crash).vote, null);
});

test("A won vote keeps the job; allies on the board can carry it", () => {
  const s = reviewRun(50, 3);
  s.company.ownership = 0.4;
  setMood(s, 30);
  G.runReview(s);
  assert.equal(s.company.board.probation, true);
  // Two allies just at the line, one director against: confidence 17 on probation calls a vote.
  setEach(s, [REVIEW.removeBelow, REVIEW.removeBelow, 0]);
  assert.ok(G.confidence(s) < REVIEW.voteOnProbationBelow);
  const r = G.runReview(s);
  assert.deepEqual([r.vote.against, r.vote.seats, r.vote.passed], [1, 3, false]);
  assert.equal(s.finished, false);
});

test("A lost vote fires you: the run ends and no more weeks can be played", () => {
  const s = reviewRun(50, 3);
  s.company.ownership = 0.4;
  setMood(s, 5);
  const r = G.runReview(s);
  assert.equal(r.vote.passed, true);
  assert.equal(s.finished, true);
  assert.equal(s.fired, true);
  assert.equal(s.company.fired, true);
  assert.match(s.outcome, /^Fired/);
  assert.throws(() => G.advance(s), /season has ended/);
  assert.throws(() => G.takeFunding(s, "loan"), /season has ended/);
});

test("Owning more than half the company protects you from a no-confidence vote", () => {
  const s = reviewRun(50, 3);
  assert.ok(s.company.ownership > 0.5);
  setMood(s, 5);
  const r = G.runReview(s);
  assert.equal(r.vote.against, 3);
  assert.equal(r.vote.protectedByShares, true);
  assert.equal(r.vote.passed, false);
  assert.equal(s.finished, false);
  assert.equal(s.company.board.probation, true);
});

test("With a board, moving up a phase needs its approval", () => {
  const s = reviewRun();
  setMood(s, REVIEW.phaseVote - 1);
  s.company.board.confidence = REVIEW.phaseVote - 1;
  assert.equal(G.approvesPhase(s), false);
  s.company.board.confidence = REVIEW.phaseVote;
  assert.equal(G.approvesPhase(s), true);
});

test("Review state survives a save and bad values are rejected", () => {
  const s = reviewRun();
  setMood(s, 75);
  G.runReview(s);
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  const bad = (f) => {
    const x = roundTrip(s);
    f(x);
    return G.validSystemsSave(x);
  };
  assert.equal(
    bad((x) => (x.company.board.freedom = "total")),
    false,
  );
  assert.equal(
    bad((x) => (x.company.board.perks = ["yacht"])),
    false,
  );
  assert.equal(
    bad((x) => (x.company.board.nextReview = -1)),
    false,
  );
});

// ---- Budget and creative freedom in play (T21) ----
const { OVERSPEND, APPROVAL } = G;
/** A board run with a given freedom and budget, confidence held at `mood`. */
function budgetRun(freedom, budget = 10000, mood = 60) {
  const s = reviewRun();
  setMood(s, mood);
  Object.assign(s.company.board, { freedom, budget, budgetLeft: budget, spent: 0, confidence: mood });
  return s;
}
const drive = (s) => G.recruitExecs(s, "ar"); // $600 × phase 2 = $1,200
const DRIVE = 1200;

test("Spending under the budget is tracked and costs nothing", () => {
  const s = budgetRun("high");
  drive(s);
  assert.equal(s.company.board.spent, DRIVE);
  assert.equal(s.company.board.budgetLeft, 10000 - DRIVE);
  assert.equal(G.overspendPoints(s), 0);
  const cash = s.cash;
  settle(s);
  assert.equal(s.company.board.spent, DRIVE, "weekly costs are not budget spending");
  assert.ok(s.cash < cash);
});

test("Spending exactly to the budget needs no approval and costs no confidence", () => {
  for (const freedom of ["low", "medium", "high"]) {
    const s = budgetRun(freedom, DRIVE);
    drive(s);
    assert.equal(s.company.board.budgetLeft, 0);
    assert.equal(G.overspendPoints(s), 0, freedom);
    assert.equal(s.event, null);
  }
});

test("Over budget the action still works with high freedom but costs confidence by the overage", () => {
  const s = budgetRun("high", 5000),
    before = G.confidence(s);
  for (let i = 0; i < 5; i++) drive(s);
  assert.equal(s.company.board.spent, 6000);
  const expected = -Math.min(OVERSPEND.cap, ((1000 / 5000) * 100) / OVERSPEND.pctPerPoint);
  assert.equal(G.overspendPoints(s), expected);
  assert.equal(G.confidence(s), before + expected);
  assert.ok(G.satisfaction(s, s.company.board.directors[0]).reasons.some((r) => r.key === "overspend"));
  for (let i = 0; i < 40; i++) drive(s);
  assert.equal(G.overspendPoints(s), -OVERSPEND.cap, "capped");
  G.runReview(s);
  assert.equal(s.company.board.spent, 0, "a new period starts the count again");
});

test("Medium and low freedom ask before going past the budget; the board decides", () => {
  for (const freedom of ["medium", "low"]) {
    const s = budgetRun(freedom, DRIVE);
    drive(s);
    assert.throws(() => drive(s), /Board approval needed/);
    assert.equal(s.event.type, "approval");
    assert.equal(s.company.board.spent, DRIVE, "nothing spent yet");
    G.choose(s, 0);
    assert.equal(s.event, null);
    drive(s);
    assert.equal(s.company.board.spent, 2 * DRIVE, "approved for this week");
  }
  const refused = budgetRun("medium", DRIVE, APPROVAL.grant - 5);
  drive(refused);
  assert.throws(() => drive(refused), /Board approval needed/);
  G.choose(refused, 0);
  assert.throws(() => drive(refused), /Board approval needed/, "a refused request stays refused");
  G.choose(refused, 1);
  assert.equal(refused.event, null, "dropping it clears the request");
});

test("Approvals last only for the week they were given", () => {
  const s = budgetRun("medium", DRIVE);
  drive(s);
  assert.throws(() => drive(s), /approval/);
  G.choose(s, 0);
  settle(s);
  assert.throws(() => drive(s), /approval/);
});

test("Low freedom: a big signing needs approval; medium and high do not", () => {
  const big = (freedom) => {
    const s = budgetRun(freedom, 1e6);
    s.reputation = 80;
    const c = s.candidates[0],
      fee = G.contractQuote(s, c).fee;
    s.company.board.budget = Math.ceil(fee / APPROVAL.bigSigning);
    s.company.board.budgetLeft = s.company.board.budget;
    return { s, c };
  };
  for (const freedom of ["medium", "high"]) {
    const { s, c } = big(freedom);
    G.sign(s, c.id);
    assert.ok(
      s.artists.some((a) => a.id === c.id),
      freedom,
    );
  }
  const { s, c } = big("low");
  assert.throws(() => G.sign(s, c.id), /big signing/);
  assert.ok(!s.artists.some((a) => a.id === c.id));
  G.choose(s, 0);
  G.sign(s, c.id);
  assert.ok(s.artists.some((a) => a.id === c.id));
});

/** A signed artist ready to record, with one album already released in `genre`. */
function studio(freedom, released = "Pop") {
  const s = budgetRun(freedom, 1e6, 70);
  s.reputation = 80;
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  Object.assign(a, { energy: 100, inspiration: 90 });
  s.albums.push({ id: 900, artist: a.id, genre: released, released: true, title: "Old" });
  return { s, a };
}
const plan = (a, genre, themes = []) => ({ artistId: a.id, boothId: 0, genre, audience: a.audience, themes });

test("Low freedom: a risky theme needs approval; medium and high do not", () => {
  const theme = APPROVAL.riskyThemes[0];
  for (const freedom of ["medium", "high"]) {
    const { s, a } = studio(freedom);
    s.themes = [...new Set([...(s.themes || []), theme])];
    G.record(s, plan(a, "Pop", [theme]));
    assert.equal(s.albums.filter((p) => !p.released).length, 1, freedom);
  }
  const { s, a } = studio("low");
  s.themes = [...new Set([...(s.themes || []), theme])];
  assert.throws(() => G.record(s, plan(a, "Pop", [theme])), new RegExp(`risky theme: ${theme}`));
  G.choose(s, 0);
  G.record(s, plan(a, "Pop", [theme]));
  assert.equal(s.albums.filter((p) => !p.released).length, 1);
});

test("Low freedom: a genre the label has never released needs approval; medium and high do not", () => {
  for (const freedom of ["medium", "high"]) {
    const { s, a } = studio(freedom, "Pop");
    G.record(s, plan(a, "Country"));
    assert.equal(s.albums.filter((p) => !p.released).length, 1, freedom);
  }
  const known = studio("low", "Pop");
  G.record(known.s, plan(known.a, "Pop"));
  assert.equal(known.s.event, null, "a genre the label knows is fine");
  const { s, a } = studio("low", "Pop");
  assert.throws(() => G.record(s, plan(a, "Country")), /new genre/);
  G.choose(s, 0);
  G.record(s, plan(a, "Country"));
  assert.equal(s.albums.filter((p) => !p.released).length, 1);
});

test("Without a board nothing needs approval and nothing is tracked", () => {
  const s = ceo(2);
  s.cash = 1e5;
  G.recruitExecs(s, "ar");
  assert.equal(s.event, null);
  assert.equal(G.board(s), null);
});

console.log(`${count} board tests passed.`);
