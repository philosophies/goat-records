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
  // Board results (design 4): each metric turns its distance from the target set at the last review
  // into satisfaction points, capped at ±cap. step is the distance worth one point:
  //   money    step × the phase's MONEY_STEP dollars
  //   percent  step percent of the target (for growth and valuation)
  //   plain    step units (morale, reputation, scandals)
  //   profit      average weekly cash change over the last `weeks` weeks
  //   growth      revenue over the last 52 weeks
  //   cash        cash in hand
  //   welfare     average artist morale
  //   reputation  label reputation
  //   scandals    trust-losing events since the last review (target 0)
  //   valuation   company value
  const METRICS = {
    profit: { name: "Weekly profit", kind: "money", step: 0.5, cap: 25, weeks: 13 },
    growth: { name: "Revenue", kind: "percent", step: 4, cap: 25 },
    cash: { name: "Cash", kind: "money", step: 5, cap: 20 },
    welfare: { name: "Artist morale", kind: "plain", step: 2, cap: 20 },
    reputation: { name: "Reputation", kind: "plain", step: 2, cap: 20 },
    scandals: { name: "Scandals", kind: "plain", step: 0.2, cap: 25 },
    valuation: { name: "Company value", kind: "percent", step: 4, cap: 25 },
  };
  // Dollars behind one "money" step, by phase.
  const MONEY_STEP = [200, 800, 3000, 10000, 30000, 100000];
  // Confidence = Σ satisfaction × seat weight ÷ Σ seat weight. Every seat counts the same for now.
  const SEAT_WEIGHT = 1;

  // The periodic review (design 3.3 and 4). It comes every intervalWeeks (publicInterval once public).
  //   budget     the first budget is max(floor by phase, a year of revenue × revenueShare); after that
  //              last budget × (0.8 + 0.4 × confidence ÷ 100) × (1 + revenue growth), growth kept within growth
  //   freedom    creative freedom by confidence; one step lower while on probation
  //   perks      granted at or above `min` confidence; each costs `weekly` dollars
  //   probation  confidence below probationBelow at a review puts you on probation for the next period
  //   vote       a no-confidence vote below voteBelow at any review, or below voteOnProbationBelow while on
  //              probation; each director below removeBelow satisfaction votes to remove you, and it passes
  //              with more than half the seats unless you own more than half the company
  //   phaseVote  confidence the board needs to approve moving up a phase
  const REVIEW = {
    intervalWeeks: 52,
    publicInterval: 26,
    budget: {
      floor: [5000, 30000, 120000, 400000, 1200000, 4000000],
      revenueShare: 0.6,
      growth: [-0.5, 1],
    },
    freedom: [
      { id: "low", name: "Low", below: 40 },
      { id: "medium", name: "Medium", below: 70 },
      { id: "high", name: "High", below: Infinity },
    ],
    perks: [
      { id: "car", name: "Company car", min: 55, weekly: 300 },
      { id: "penthouse", name: "Penthouse office", min: 70, weekly: 1500 },
      { id: "jet", name: "Private jet", min: 85, weekly: 6000 },
    ],
    probationBelow: 35,
    voteBelow: 10,
    voteOnProbationBelow: 20,
    removeBelow: 25,
    phaseVote: 50,
  };

  // Spending against the period budget (design 3.3). Every payment counts; weekly costs do not.
  //   overspend  past the budget, every director loses one point per pctPerPoint % of overage, up to cap
  const OVERSPEND = { pctPerPoint: 2, cap: 30 };
  // Approval requests. Low creative freedom: big signings (a fee of bigSigning × the budget or more),
  // albums with a risky theme, and a genre the label has never released. Low and medium: any payment
  // that would go past the budget. The board grants a request at `grant` confidence or more; an approval
  // lasts for the rest of the week it was given.
  const APPROVAL = {
    bigSigning: 0.25,
    riskyThemes: ["Rebellion", "Revenge", "Money", "Party"],
    grant: 50,
  };

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

  const data = {
    DIRECTORS,
    METRICS,
    MONEY_STEP,
    SEAT_WEIGHT,
    REVIEW,
    OVERSPEND,
    APPROVAL,
    BACKERS,
    VALUATION,
    FUNDING,
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
