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
  // Each phase also carries what the classic label rank set (design 3.0, section 1):
  //   ladder.slots       roster size      ladder.themeSlots  themes per album
  //   ladder.tier        room tier and stage bonus (the development ceiling is 64 + tier × 4)
  //   ladder.themes / ladder.cash   rewards on reaching the phase
  const PHASES = [
    {
      id: 1,
      name: "Home studio",
      ladder: { slots: 2, themeSlots: 1, tier: 1, themes: 0, cash: 0 },
      startCash: 2000,
      reach: "local",
      boardSeats: 0,
      buildings: ["apartment"],
      goals: { fame: 0, revenue: 0, releases: 0, hits: 0 },
    },
    {
      id: 2,
      name: "Indie label",
      ladder: { slots: 3, themeSlots: 1, tier: 1, themes: 2, cash: 6000 },
      reach: "city",
      boardSeats: 1,
      buildings: ["storefront"],
      goals: { fame: 60, revenue: 25000, releases: 3, hits: 0 },
    },
    {
      id: 3,
      name: "Regional label",
      ladder: { slots: 5, themeSlots: 2, tier: 2, themes: 2, cash: 15000 },
      reach: "region",
      boardSeats: 3,
      buildings: ["studio", "office"],
      goals: { fame: 180, revenue: 70000, releases: 8, hits: 1 },
    },
    {
      id: 4,
      name: "National label",
      ladder: { slots: 7, themeSlots: 2, tier: 3, themes: 2, cash: 30000 },
      reach: "country",
      boardSeats: 5,
      buildings: ["hq", "venue"],
      goals: { fame: 440, revenue: 225000, releases: 18, hits: 2 },
    },
    {
      id: 5,
      name: "Global label",
      ladder: { slots: 8, themeSlots: 2, tier: 4, themes: 2, cash: 60000 },
      reach: "world",
      boardSeats: 7,
      buildings: ["media", "warehouse"],
      goals: { fame: 1000, revenue: 650000, releases: 35, hits: 5 },
    },
    {
      id: 6,
      name: "Public company",
      ladder: { slots: 10, themeSlots: 2, tier: 4, themes: 3, cash: 100000 },
      reach: "world",
      boardSeats: 9,
      buildings: ["overseas"],
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

  // The label's own name: its length limits, and the fame a rename costs while fans catch up.
  // Naming a new run is free.
  const RENAME = { minLength: 1, maxLength: 32, fame: 15 };
  // Weekly company income by release and roster activity. Every rate is in dollars.
  const COMPANY_REVENUE = [
    { id: "beats", name: "Beats for hire", phase: 1, source: "studio", rate: 240 },
    { id: "downloads", name: "Local downloads", phase: 1, source: "activeCatalog", rate: 25 },
    { id: "streams", name: "Streaming", phase: 2, source: "activeCatalog", rate: 90 },
    { id: "merch", name: "Merchandise", phase: 2, source: "roster", rate: 160 },
    { id: "distribution", name: "Distribution", phase: 3, source: "activeCatalog", rate: 400 },
    { id: "radio", name: "Radio", phase: 3, source: "hits", rate: 80 },
    { id: "sync", name: "Sync licensing", phase: 4, source: "hits", rate: 300 },
    { id: "brand", name: "Brand partnerships", phase: 4, source: "roster", rate: 360 },
    { id: "publishing", name: "Publishing", phase: 5, source: "catalog", rate: 180 },
    { id: "catalog", name: "Catalog royalties", phase: 5, source: "catalog", rate: 140 },
  ];
  const COMPANY_COSTS = {
    rent: [0, 45, 130, 320, 650, 1100],
    insurance: [0, 15, 55, 140, 320, 600],
  };
  const COMPANY_VALUE = {
    shares: 10000,
    growthFactor: 0.5,
    growthRange: [-0.5, 1],
    hitRateFactor: 1.25,
    catalogIncomeFactor: 0.4,
    moodRange: [0.8, 1.2],
  };
  const IPO = {
    phase: 5,
    profitYears: 3,
    cfoSkill: 60,
    boardConfidence: 60,
    equity: 0.25,
    scandalDiscount: 0.025,
    analystWeeks: 26,
    revenueStretch: 1.06,
    moodChange: 0.05,
    confidenceChange: 5,
  };
  const ACQUISITIONS = {
    phase: 6,
    downPayment: 0.35,
    termWeeks: 104,
    rate: 0.08,
    termAlbums: 3,
    offers: [
      { id: "harbor-catalog", company: "harbor", kind: "catalog", price: 150000, revenue: 1650 },
      { id: "redwood-catalog", company: "redwood", kind: "catalog", price: 260000, revenue: 2700 },
      { id: "meridian-label", company: "meridian", kind: "label", price: 450000, revenue: 4500 },
    ],
  };
  const CEO_MIGRATION = {
    phaseByRank: [1, 2, 3, 4, 5, 5],
    boardConfidence: 60,
    departments: {
      "A&R": "ar",
      Producer: "business",
      Marketing: "marketing",
      "Public Relations": "promotion",
      VP: "finance",
      "Artist Development": "creative",
    },
    executive: { ambition: 35, loyalty: 70, influence: 20 },
  };

  // Buildings along the street (CEO runs). Each is bought once and built up floor by floor.
  //   phase      the company phase that unlocks it
  //   cost       purchase price
  //   maxFloors  floors it can hold
  //   floorCost  structural cost added per floor already standing (floor n costs type cost + n × this)
  //   floors     what can go on its floors: "room" (a recording room) or a headquarters facility id
  const BUILDINGS = [
    {
      id: "apartment",
      name: "Your apartment",
      phase: 1,
      cost: 0,
      maxFloors: 2,
      floorCost: 0,
      floors: ["room", "writers"],
    },
    {
      id: "storefront",
      name: "Storefront studio",
      phase: 2,
      cost: 15000,
      maxFloors: 3,
      floorCost: 2000,
      floors: ["room", "writers", "vocal", "lounge", "merch"],
    },
    {
      id: "studio",
      name: "Studio building",
      phase: 3,
      cost: 60000,
      maxFloors: 5,
      floorCost: 5000,
      floors: ["room", "vocal", "mix", "rehearsal", "writers"],
    },
    {
      id: "office",
      name: "Label office",
      phase: 3,
      cost: 50000,
      maxFloors: 4,
      floorCost: 5000,
      floors: ["lounge", "radio", "archive", "merch"],
    },
    {
      id: "hq",
      name: "Headquarters tower",
      phase: 4,
      cost: 250000,
      maxFloors: 8,
      floorCost: 12000,
      floors: [
        "room",
        "writers",
        "vocal",
        "lounge",
        "mix",
        "merch",
        "rehearsal",
        "radio",
        "bar",
        "archive",
        "academy",
      ],
    },
    {
      id: "venue",
      name: "Live venue",
      phase: 4,
      cost: 180000,
      maxFloors: 3,
      floorCost: 10000,
      floors: ["bar", "rehearsal", "merch"],
    },
    {
      id: "media",
      name: "Media center",
      phase: 5,
      cost: 400000,
      maxFloors: 4,
      floorCost: 20000,
      floors: ["radio", "academy", "archive", "mix"],
    },
    {
      id: "warehouse",
      name: "Warehouse",
      phase: 5,
      cost: 150000,
      maxFloors: 3,
      floorCost: 8000,
      floors: ["merch", "archive"],
    },
    {
      id: "overseas",
      name: "Overseas office",
      phase: 6,
      cost: 600000,
      maxFloors: 4,
      floorCost: 25000,
      floors: ["room", "lounge", "radio", "bar"],
    },
  ];

  const data = {
    PHASES,
    REACHES,
    PHASE_GOALS,
    HIT_QUALITY,
    REACH_SCOUTING,
    RENAME,
    BUILDINGS,
    COMPANY_REVENUE,
    COMPANY_COSTS,
    COMPANY_VALUE,
    IPO,
    ACQUISITIONS,
    CEO_MIGRATION,
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
