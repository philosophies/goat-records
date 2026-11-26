// Fortune (CEO runs, owner decision 2026-11-25): decision cards play out by chance. Each option is
// rated safe, steady or bold by how much it puts at stake; its outcome is drawn when it is chosen.
(function (root) {
  "use strict";

  // For each rating, the outcomes it can have: `weight` (out of 100), `gain` (multiplies what an
  // option gives) and `loss` (multiplies what it costs in morale, trust, reputation and the like;
  // a price already paid is never changed). A negative gain turns a benefit into a setback; cash
  // gains never go below nothing. Expected gains: safe ×1.0, steady ×1.03, bold ×1.09; expected
  // losses: safe ×1.0, steady ×1.05, bold ×1.2. Bold pays more on average and swings much wider.
  const FORTUNE = {
    risks: {
      safe: [
        { id: "better", weight: 15, gain: 1.2, loss: 0.8 },
        { id: "planned", weight: 75, gain: 1, loss: 1 },
        { id: "worse", weight: 10, gain: 0.8, loss: 1.2 },
      ],
      steady: [
        { id: "better", weight: 25, gain: 1.6, loss: 0.6 },
        { id: "planned", weight: 45, gain: 1, loss: 1 },
        { id: "worse", weight: 30, gain: 0.6, loss: 1.5 },
      ],
      bold: [
        { id: "triumph", weight: 30, gain: 2.8, loss: 0.5 },
        { id: "planned", weight: 35, gain: 1, loss: 1 },
        { id: "backfire", weight: 35, gain: -0.3, loss: 2 },
      ],
    },
    riskNames: { safe: "Safe", steady: "Steady", bold: "Bold" },
    outcomeNames: {
      triumph: "A triumph",
      better: "Better than hoped",
      planned: "As planned",
      worse: "Worse than hoped",
      backfire: "It backfired",
    },
    // Effects scaled by an outcome. `good`: more is better. `bad`: more is worse (a delay, a fee, a
    // chance of cancellation, an executive's ambition). `mult`: a multiplier, scaled on its distance
    // from 1. Anything else (costs, lengths of time, which beat comes next) is left as it is.
    keys: {
      good: [
        "cash",
        "fame",
        "labelFame",
        "artistFame",
        "artistReputation",
        "artistMomentum",
        "reputation",
        "morale",
        "energy",
        "fans",
        "trust",
        "attention",
        "rosterMorale",
        "qualityDelta",
        "recoveryEnergy",
        "tourCash",
        "relationship",
        "relation",
        "confidence",
        "xp",
        "loyalty",
        "skill",
        "director",
        "rival",
      ],
      bad: ["delayAlbum", "cancelChance", "distributionFee", "royaltyIncrease", "ambition", "influence"],
      mult: ["mult", "tourMult", "albumBoost"],
      whole: ["extension"],
    },
    // How much an option puts at stake, to rate it: points per unit of each effect, with cash and
    // costs per dollar; an option that can fail outright adds `gamble`.
    stakes: { cash: 1 / 500, cost: 1 / 500, mult: 100, gamble: 10, default: 1 },
    // Cards that keep their own odds or are not the label's call.
    exempt: ["approval", "awards", "era", "rivalBid", "rivalFeud"],
  };

  const data = { FORTUNE };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
