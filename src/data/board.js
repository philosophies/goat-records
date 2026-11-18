// Balance tables for the board system (2.0): funding offers and the directors they bring.
// See design/gdd/ceo-2.0.md, sections 3.3 and 3.10.
(function (root) {
  "use strict";

  // Director archetypes. Agenda weights say how much each result moves their satisfaction
  // (used by board confidence, task T19). Patience: periods of bad results they sit through.
  //   profit      weekly profit against last year
  //   growth      revenue growth
  //   cash        cash in hand
  //   welfare     average artist morale
  //   reputation  label reputation
  //   scandals    scandals and trust losses (negative weight: they dislike them)
  //   valuation   company value, later the share price
  const DIRECTORS = [
    { id: "accountant", name: "The Accountant", agenda: { profit: 1, cash: 0.8, growth: 0.2 }, patience: 1 },
    {
      id: "visionary",
      name: "The Visionary",
      agenda: { growth: 1, valuation: 0.6, profit: 0.2 },
      patience: 2,
    },
    { id: "friend", name: "The Artist's Friend", agenda: { welfare: 1, reputation: 0.8 }, patience: 2 },
    {
      id: "oldGuard",
      name: "The Old Guard",
      agenda: { scandals: -1, reputation: 0.6, cash: 0.4 },
      patience: 3,
    },
    { id: "investor", name: "The Investor", agenda: { valuation: 1, growth: 0.6, profit: 0.4 }, patience: 1 },
  ];
  // Which archetypes each kind of money tends to bring, in order of likelihood.
  const BACKERS = {
    angel: ["visionary", "friend", "investor"],
    venture: ["investor", "accountant", "visionary", "oldGuard"],
  };

  // Company value used to price a round: max(floor, revenue over 52 weeks × multiple), by phase.
  const VALUATION = {
    multiple: [1.5, 2, 2.5, 3, 3.5, 4],
    floor: [10000, 60000, 200000, 600000, 2000000, 6000000],
  };

  // Funding offers.
  //   loan     a bank loan: no seats, no shares; one at a time. Weekly payments over termWeeks at
  //            rate a year. limit by phase.
  //   angel    one ever, in phase 2 only: equity for one seat.
  //   venture  one round a phase, phases 3–5: equity for seats, up to the phase's board size.
  const FUNDING = {
    loan: { limit: [5000, 25000, 75000, 200000, 500000, 1200000], rate: 0.12, termWeeks: 104 },
    angel: { phase: 2, terms: [0.1, 0.2], seats: 1 },
    venture: {
      phases: [3, 4, 5],
      terms: [0.15, 0.3],
      seats: 2,
      rounds: ["Series A", "Series B", "Series C"],
    },
  };

  const data = { DIRECTORS, BACKERS, VALUATION, FUNDING };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
