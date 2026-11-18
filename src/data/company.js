// Balance tables for the company system (2.0): the six growth phases of the label.
// See design/gdd/ceo-2.0.md, section 3.2.
(function (root) {
  "use strict";

  // Goals are checked at the weekly settlement to enter the NEXT phase:
  //   fame      label fame
  //   revenue   income over the last 52 weeks
  //   releases  albums released
  //   hits      albums with quality 75+
  // reach: how far scouting looks. boardSeats: seats once outside money is taken.
  // buildings: building ids that unlock in this phase (filled in with the buildings table).
  const PHASES = [
    {
      id: 1,
      name: "Home studio",
      startCash: 2000,
      reach: "local",
      boardSeats: 0,
      buildings: [],
      goals: { fame: 0, revenue: 0, releases: 0, hits: 0 },
    },
    {
      id: 2,
      name: "Indie label",
      reach: "city",
      boardSeats: 1,
      buildings: [],
      goals: { fame: 60, revenue: 25000, releases: 3, hits: 0 },
    },
    {
      id: 3,
      name: "Regional label",
      reach: "region",
      boardSeats: 3,
      buildings: [],
      goals: { fame: 200, revenue: 150000, releases: 8, hits: 1 },
    },
    {
      id: 4,
      name: "National label",
      reach: "country",
      boardSeats: 5,
      buildings: [],
      goals: { fame: 600, revenue: 750000, releases: 18, hits: 4 },
    },
    {
      id: 5,
      name: "Global label",
      reach: "world",
      boardSeats: 7,
      buildings: [],
      goals: { fame: 1500, revenue: 3000000, releases: 35, hits: 10 },
    },
    {
      id: 6,
      name: "Public company",
      reach: "world",
      boardSeats: 9,
      buildings: [],
      goals: { fame: 3000, revenue: 10000000, releases: 60, hits: 20 },
    },
  ];
  const REACHES = ["local", "city", "region", "country", "world"];
  // What each goal is called in the interface, and the quality an album needs to count as a hit.
  const PHASE_GOALS = {
    fame: "Label fame",
    revenue: "Revenue, last 52 weeks",
    releases: "Albums released",
    hits: "Hit albums (quality 75+)",
  };
  const HIT_QUALITY = 75;
  // How far scouting looks at each reach, in a CEO run:
  //   budget        the highest paid scouting budget (index into SCOUT_BUDGETS) allowed
  //   talentMax     every prospect's craft is capped here
  //   potentialMax  and their potential here
  const REACH_SCOUTING = {
    local: { name: "the local scene", budget: 0, talentMax: 58, potentialMax: 80 },
    city: { name: "the city", budget: 0, talentMax: 64, potentialMax: 86 },
    region: { name: "the region", budget: 1, talentMax: 74, potentialMax: 91 },
    country: { name: "the whole country", budget: 2, talentMax: 86, potentialMax: 96 },
    world: { name: "the world", budget: 2, talentMax: 100, potentialMax: 100 },
  };

  const data = { PHASES, REACHES, PHASE_GOALS, HIT_QUALITY, REACH_SCOUTING };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
