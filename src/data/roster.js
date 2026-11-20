// Balance tables for roster tiers (3.0): up-and-comers, stars and superstars. See design/gdd/ceo-3.0.md, 3.
(function (root) {
  "use strict";

  // What the company may spend on an artist in each tier.
  //   budget  the largest album budget          adRank  the highest ad campaign (by its rank)
  //   tours   tour scales they can headline      team    team members they can have at once
  const TIERS = [
    { id: "rising", name: "Up-and-comer", budget: 4000, adRank: 2, tours: ["regional"], team: 2 },
    { id: "star", name: "Star", budget: 8000, adRank: 4, tours: ["regional", "national"], team: 4 },
    {
      id: "superstar",
      name: "Superstar",
      budget: 12000,
      adRank: 6,
      tours: ["regional", "national", "world"],
      team: 7,
    },
  ];
  // Slots in each tier by company phase (1–6): rising, star, superstar. You start with no superstar slot.
  const TIER_SLOTS = [
    [2, 0, 0],
    [2, 1, 0],
    [3, 1, 1],
    [4, 2, 1],
    [4, 2, 2],
    [5, 3, 2],
  ];
  // Moving up needs artist fame and hit albums (quality 75+) with the label, and a free slot.
  // Dropping a tier follows `flops` releases in a row below `quality`.
  const TIER_RULES = {
    star: { fame: 40, hits: 1 },
    superstar: { fame: 75, hits: 3 },
    demotion: { flops: 2, quality: 55 },
    hitQuality: 75,
  };

  // Superstars are the face of the company (design 3).
  //   endorse      weekly endorsement income per point of a superstar's fame, by phase
  //   brand        company value lift per superstar at fame 100 (a feud with the CEO turns it to −half)
  //   relation     the CEO relationship (−100…100): where a new superstar starts, how fast it drifts toward
  //                (morale − 60) ÷ 2 each week, and how much sharper event swings are for superstars
  //   shock        each week a superstar may make news: good news lifts value and pays out, bad news
  //                cuts value, costs money and strains the relationship; good news is likelier when the
  //                relationship is warm
  const FACE = {
    endorse: [0, 0, 10, 15, 25, 40],
    brand: 0.06,
    relation: { start: 25, loyaltyWeight: 0.2, drift: 0.1, swing: 1.5 },
    shock: {
      chance: 0.03,
      good: { mult: 0.08, weeks: 8, cashPerPhase: 4000 },
      bad: { mult: -0.1, weeks: 8, cashPerPhase: -3000, relation: -10 },
    },
  };

  const data = { TIERS, TIER_SLOTS, TIER_RULES, FACE };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
