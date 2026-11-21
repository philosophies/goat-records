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

  // A second act: when you are fired or ousted, a superstar whose relationship with you is at least
  // `relation` and whose loyalty is at least `loyalty` will follow you to a new company. It starts at
  // phase 1 with `cash` from the old contacts, and the superstar signs for `albums` albums.
  const SECOND_ACT = { relation: 40, loyalty: 50, cash: 15000, albums: 2 };

  // Artist levels in CEO runs (design 5): levels 1–30 instead of the classic 10.
  //   xp       career XP needed for each level (index 0 is level 1). The first ten are the classic curve,
  //            so no artist changes level when the longer career starts; each later step costs 3 XP more
  //   cap      the highest level each tier allows; XP keeps counting past it
  //   hitXp    extra XP for a hit release (quality 75+), on top of the usual 3 for any release
  //   perks    milestone perks: `stage` adds to every production stage, `sales` to album sales
  const LEVELS = {
    xp: [0, 4, 10, 19, 31, 46, 64, 85, 109, 136].concat(
      Array.from({ length: 20 }, (_, i) => 136 + (i + 1) * 30 + ((i + 1) * i * 3) / 2),
    ),
    cap: { rising: 12, star: 22, superstar: 30 },
    hitXp: 3,
    perks: [
      { level: 5, name: "Studio regular", stage: 1, sales: 0 },
      { level: 10, name: "Crowd favourite", stage: 0, sales: 0.04 },
      { level: 15, name: "Veteran", stage: 1, sales: 0 },
      { level: 20, name: "Icon", stage: 0, sales: 0.04 },
      { level: 25, name: "Living legend", stage: 1, sales: 0 },
      { level: 30, name: "Greatest of all time", stage: 1, sales: 0.06 },
    ],
  };

  const data = { TIERS, TIER_SLOTS, TIER_RULES, FACE, SECOND_ACT, LEVELS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
