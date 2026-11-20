// Balance tables for listening parties (3.0): fan sentiment before release. See design/gdd/ceo-3.0.md, 4.
(function (root) {
  "use strict";

  // A party is held once every stage is done and before release, at most `max` times per album.
  //   cost        by the artist's tier
  //   leak        chance the album leaks, by party number; a leak cuts its sales to leakSales
  //   rework      reworking the weakest area costs `cost` × the party cost, adds `weeks` to production and
  //               lifts that area by gain[party number − 1] (the second party gives less)
  //   single      changing the lead single lifts Campaign planning by this much, once per album
  //   sentiment   score bands for the report: loved, liked, mixed, cold
  //   audience    fit with the album's target audience: the target, one step away, two steps away
  //   noise       the room's mood: ± this many points on each reading
  const PARTY = {
    max: 2,
    cost: { rising: 800, star: 2500, superstar: 6000 },
    leak: [0.05, 0.15],
    leakSales: 0.85,
    rework: { cost: 1.5, weeks: 1, gain: [6, 3] },
    single: 2,
    sentiment: [
      { min: 80, name: "Loved it" },
      { min: 65, name: "Liked it" },
      { min: 50, name: "Mixed" },
      { min: 0, name: "Cold" },
    ],
    audience: [8, -2, -8],
    noise: 5,
  };
  const AUDIENCES = ["Youth", "Teen", "Adult"];

  const data = { PARTY, AUDIENCES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
