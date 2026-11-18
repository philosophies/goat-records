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

console.log(`${count} board tests passed.`);
