// Balance tables for the promotion system: hot streaks, lead singles and ad campaigns.
(function (root) {
  "use strict";

  // Hot streaks. A trigger adds its levels (up to maxLevel) and refreshes the timer to at least its
  // weeks (up to maxWeeks). The timer counts down once per weekly settlement; at zero the streak ends.
  const HEAT = {
    triggers: {
      hit: { name: "Hit release", levels: 1, weeks: 6 },
      top10: { name: "Top 10 chart week", levels: 1, weeks: 4 },
      award: { name: "Award win", levels: 2, weeks: 8 },
    },
    // Quality needed for a release to count as a hit.
    hitQuality: 75,
    // Best chart position that counts as a Top 10 week. Each album triggers this once.
    topRank: 10,
    maxLevel: 3,
    maxWeeks: 12,
    // Added to every production stage decided while the artist is on fire.
    stagePerLevel: 1,
    // Sales multiplier on every earning release by the artist: 1 + level × this.
    salesPerLevel: 0.06,
    // Reasons kept per artist.
    reasonLimit: 4,
  };

  // Lead singles. Available once Recording (stage 3 of 5) is done, once per album, before release.
  // Cost and buzz follow the album's base budget tier.
  const SINGLE = {
    minStage: 3,
    tiers: {
      4000: { name: "Lean", cost: 1000, fans: 4, attention: 10, market: 4, fanResponse: 3 },
      8000: { name: "Standard", cost: 1800, fans: 6, attention: 14, market: 5, fanResponse: 4 },
      12000: { name: "Premium", cost: 2600, fans: 9, attention: 18, market: 6, fanResponse: 5 },
    },
    // How the single lands; added to both launch rows. Drawn from the promotion random stream.
    reception: [
      { name: "Quiet", value: -2, chance: 0.25 },
      { name: "Steady", value: 0, chance: 0.45 },
      { name: "Strong", value: 2, chance: 0.22 },
      { name: "Breakout", value: 4, chance: 0.08 },
    ],
    // Album sales multiplier for the first earning weeks after release.
    launchMult: 1.15,
    launchWeeks: 3,
  };

  // Ad campaigns for released albums still in their earning run. One active ad per album.
  // Cost = base × (1 + label fame / fameScale), rounded to $50. Effects apply when the ad is bought;
  // the sales multiplier starts with the next weekly settlement.
  const ADS = [
    { id: "posters", name: "Street posters", rank: 1, base: 450, mult: 1.1, weeks: 4 },
    { id: "radio", name: "Radio spot", rank: 2, base: 900, mult: 1.15, weeks: 4, attention: 6 },
    { id: "playlist", name: "Playlist push", rank: 3, base: 3000, mult: 1.22, weeks: 5, fans: 4 },
    { id: "billboard", name: "Billboard", rank: 4, base: 5500, mult: 1.3, weeks: 5, reputation: 1 },
    { id: "tv", name: "TV spot", rank: 5, base: 13000, mult: 1.4, weeks: 6, fans: 8, attention: 8 },
    {
      id: "global",
      name: "Global campaign",
      rank: 6,
      base: 22000,
      mult: 1.5,
      weeks: 8,
      fans: 15,
      attention: 10,
      reputation: 2,
    },
  ];
  const AD_RULES = { fameScale: 1000, round: 50, historyLimit: 60 };

  // Heat, single and ad multipliers multiply together, then stop at this cap.
  const PROMOTION_CAP = 1.6;

  const data = { HEAT, SINGLE, ADS, AD_RULES, PROMOTION_CAP };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
