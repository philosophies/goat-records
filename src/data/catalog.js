// The catalog (3.0, design 7.5): old albums keep earning and bring offers.
(function (root) {
  "use strict";

  // An album is fresh for its first freshWeeks after release, then catalog; a classic once it is
  // classicWeeks old with quality classicQuality or more and was a hit.
  const CATALOG_STATUS = { freshWeeks: 26, classicWeeks: 156, classicQuality: 80 };

  // Weekly catalog royalties per album from phase `phase` (they replace the company's flat
  // catalog royalty line): its gross sales so far × perGross × the era's catalog number; a classic
  // earns classicMult times as much. Big records keep paying; flops barely do.
  const ROYALTIES = { phase: 5, perGross: 0.003, classicMult: 2.5 };

  // Offers. One may arrive in a week with probability `chance` while fewer than `max` are open;
  // each lapses after `expires` weeks. `weight` sets how often each random kind is drawn.
  // Money from a flow is `share` of the album's gross over `weeks`, times the era's number.
  // A cleared sample pays its fee now and royaltyShare × the fee a week for royaltyWeeks.
  const OFFERS = {
    chance: 0.12,
    max: 3,
    expires: 8,
    deluxe: {
      weight: 3,
      minQuality: 60,
      maxAgeWeeks: 156,
      costPerPhase: 1500,
      studioWeeks: 2,
      energy: 15,
      share: 0.12,
      weeks: 8,
    },
    sample: { weight: 3, feePerQuality: 40, royaltyShare: 0.01, royaltyWeeks: 52, refuseStanding: -10 },
    sync: { weight: 2, feePerQuality: 60, classicMult: 1.5 },
    fanMail: { weight: 2, remix: { cost: 500, fans: 3, fame: 2 }, tour: { morale: 5, reputation: 2 } },
    // Reissues come at these anniversaries for classics; greatest hits once an artist has `albums`.
    reissue: {
      years: [5, 10],
      costPerPhase: 2000,
      share: 0.1,
      weeks: 8,
      fans: 4,
      reputation: 2,
      goodPress: 0.5,
    },
    hits: { albums: 3, costPerPhase: 2500, share: 0.05, weeks: 12 },
  };
  // Who asks: sync clients and sample requests from outside the label's rivals.
  const SYNC_CLIENTS = [
    "a feature film",
    "a video game",
    "a phone advert",
    "a TV drama",
    "a sports broadcast",
  ];
  const SAMPLERS = ["Kilo Grand", "Velvet Ash", "DJ Marrow", "Nova Kincaid", "Lil Atlas", "Seraphine"];

  const data = { CATALOG_STATUS, ROYALTIES, OFFERS, SYNC_CLIENTS, SAMPLERS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
