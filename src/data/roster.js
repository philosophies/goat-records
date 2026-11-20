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

  const data = { TIERS, TIER_SLOTS, TIER_RULES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
