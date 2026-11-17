// Label growth tables: album themes, headquarters facilities and label ranks.
(function (root) {
  "use strict";

  // Genre order for every fit row: Rap, R&B, Pop, Country, Sacred, Rock.
  // -1 Poor, 0 Fair, 1 Good, 2 Great.
  const THEMES = [
    { name: "Heartbreak", fit: [0, 2, 1, 2, -1, 1], starter: true },
    { name: "Hometown", fit: [1, 0, 0, 2, 1, 1], starter: true },
    { name: "Late Night", fit: [1, 2, 1, -1, -1, 0], starter: true },
    { name: "Summer", fit: [0, 1, 2, 1, -1, 0], starter: true },
    { name: "Faith", fit: [0, 1, -1, 1, 2, -1], starter: true },
    { name: "Hustle", fit: [2, 0, 0, -1, -1, 0], starter: true },
    { name: "First Love", fit: [-1, 2, 2, 1, 0, 0] },
    { name: "Rebellion", fit: [1, -1, 0, 0, -1, 2] },
    { name: "Road Trip", fit: [0, 0, 1, 2, -1, 2] },
    { name: "Party", fit: [1, 1, 2, 0, -1, 0] },
    { name: "Grief", fit: [0, 1, -1, 1, 2, 1] },
    { name: "Redemption", fit: [2, 0, -1, 1, 2, 0] },
    { name: "City Lights", fit: [2, 1, 1, -1, -1, 0] },
    { name: "Money", fit: [2, 0, 0, -1, -1, -1] },
    { name: "Nostalgia", fit: [0, 1, 1, 2, 0, 1] },
    { name: "Freedom", fit: [1, 0, 0, 1, 1, 2] },
    { name: "Family", fit: [0, 0, 0, 2, 2, -1] },
    { name: "Storms", fit: [-1, 0, 0, 1, 1, 2] },
    { name: "Dreams", fit: [1, 1, 2, 0, 0, 0] },
    { name: "Healing", fit: [0, 2, 0, 0, 2, -1] },
    { name: "Legacy", fit: [2, 0, -1, 1, 1, 1] },
    { name: "Celebration", fit: [0, 1, 2, 1, 1, -1] },
    { name: "Revenge", fit: [1, 1, 0, 1, -1, 2] },
    { name: "Working Class", fit: [1, -1, -1, 2, 0, 1] },
  ];

  const FIT = {
    names: { "-1": "Poor", 0: "Fair", 1: "Good", 2: "Great" },
    // Points added to the Identity and Songwriting stages, and to Fan response at launch.
    points: { "-1": -5, 0: 0, 1: 4, 2: 7 },
    // With two themes, the combined points are scaled so a pairing is a gamble, not a free stack.
    pairScale: 0.75,
    // Each earlier release of the same genre + theme combo adds one point to every stage, up to this level.
    maxLevel: 5,
    // Reach penalty for each release of the same combo inside the window.
    freshnessWindow: 26,
    freshnessPenalty: 4,
    freshnessCap: 8,
    // Chance to find a new theme from a development session or a Writers' Room each week.
    trainingDiscovery: 0.2,
  };

  // Shared pixel palette. Facility maps use "a" for their own accent color.
  const PALETTE = {
    k: "#18171f",
    w: "#efe9da",
    y: "#f3d25b",
    s: "#e7b48c",
    d: "#8c5a3c",
    g: "#7b7f8c",
    r: "#d9534f",
  };

  // Each facility occupies one tile. Bonuses are per level (levels 1–3).
  // stage: production stage index (0 Identity, 1 Songwriting, 2 Performance, 3 Sound, 4 Reach).
  const FACILITIES = [
    {
      id: "writers",
      name: "Writers' Room",
      rank: 1,
      cost: 4000,
      upkeep: 50,
      accent: "#c9e86a",
      stages: { 1: 2 },
      discovery: 0.1,
      text: "Songwriting +2 per level. Each level adds a 10% weekly chance to find a new theme.",
      icon: [
        "..........",
        ".kkkkkkk..",
        ".kwwwwwk..",
        ".kwkkkwk.y",
        ".kwwwwwkyk",
        ".kwkkkwyk.",
        ".kwwwwyk..",
        ".kwkkkkk..",
        ".kkkkkk...",
        "..........",
      ],
    },
    {
      id: "vocal",
      name: "Vocal Booth",
      rank: 1,
      cost: 5000,
      upkeep: 60,
      accent: "#7fb8e8",
      stages: { 2: 2 },
      text: "Performance +2 per level.",
      icon: [
        "...kkkk...",
        "..kaaaak..",
        "..kayaak..",
        "..kaaaak..",
        "...kkkk...",
        "....kk....",
        "..k.kk.k..",
        "...kkkk...",
        "....kk....",
        "..kkkkkk..",
      ],
    },
    {
      id: "lounge",
      name: "Artist Lounge",
      rank: 1,
      cost: 3000,
      upkeep: 40,
      accent: "#e88f6a",
      morale: 2,
      inspiration: 2,
      text: "Idle artists gain +2 morale and +2 inspiration per level each week.",
      icon: [
        "..........",
        "..........",
        ".kk....kk.",
        ".kakkkkak.",
        ".kaaaaaak.",
        "kaayaayaak",
        "kaaaaaaaak",
        "kkkkkkkkkk",
        ".k......k.",
        "..........",
      ],
    },
    {
      id: "mix",
      name: "Mix Suite",
      rank: 2,
      cost: 9000,
      upkeep: 140,
      accent: "#b48ae8",
      stages: { 3: 2 },
      text: "Sound +2 per level.",
      icon: [
        "..........",
        "kkkkkkkkkk",
        "kgkgkgkgkk",
        "kgkykgkgkk",
        "kgkgkgkykk",
        "kykgkykgkk",
        "kgkgkgkgkk",
        "kaaaaaaaak",
        "kkkkkkkkkk",
        ".k......k.",
      ],
    },
    {
      id: "merch",
      name: "Merch Shop",
      rank: 1,
      cost: 5000,
      upkeep: 60,
      accent: "#e8c86a",
      income: { base: 60, fame: 1.2 },
      text: "Weekly sales of $60 plus $1.20 per label fame, per level.",
      icon: [
        "..........",
        "..kk..kk..",
        ".kaakkaak.",
        "kaaaaaaaak",
        "kkkaaaakkk",
        "..kaaaak..",
        "..kayyak..",
        "..kaaaak..",
        "..kkkkkk..",
        "..........",
      ],
    },
    {
      id: "rehearsal",
      name: "Rehearsal Hall",
      rank: 2,
      cost: 10000,
      upkeep: 120,
      accent: "#e86a8f",
      energy: 4,
      text: "Idle artists recover +4 energy per level each week.",
      icon: [
        "..........",
        "....kkkk..",
        "...kaaaak.",
        "...kaaaak.",
        "..kkkkkk..",
        ".kdkdddk..",
        "kdddkddk..",
        "kddddkk...",
        ".kkkkk....",
        "..........",
      ],
    },
    {
      id: "radio",
      name: "Radio Room",
      rank: 3,
      cost: 14000,
      upkeep: 180,
      accent: "#6ae8c8",
      stages: { 4: 2 },
      market: 2,
      text: "Reach +2 and Market impact +2 per level.",
      icon: [
        "........k.",
        ".......k..",
        "......k...",
        ".kkkkkkkk.",
        ".kaaaaaak.",
        ".kakkaywk.",
        ".kakkaaak.",
        ".kaaaaaak.",
        ".kkkkkkkk.",
        "..........",
      ],
    },
    {
      id: "bar",
      name: "Listening Bar",
      rank: 3,
      cost: 18000,
      upkeep: 150,
      accent: "#e8a86a",
      income: { base: 100, fame: 1.5 },
      text: "Weekly takings of $100 plus $1.50 per label fame, per level.",
      icon: [
        "..........",
        ".k......k.",
        ".kk....kk.",
        ".kakkkkak.",
        "..kaaaak..",
        "...kyyk...",
        "....kk....",
        "....kk....",
        "...kkkk...",
        "..........",
      ],
    },
    {
      id: "archive",
      name: "Master Archive",
      rank: 4,
      cost: 25000,
      upkeep: 220,
      accent: "#8fa8c8",
      residual: 1,
      text: "Albums whose earning run has ended pay $1 per quality point each week, per level.",
      icon: [
        "..........",
        ".kkkkkkkk.",
        ".kakakaak.",
        ".kakakaak.",
        ".kkkkkkkk.",
        ".kaakakak.",
        ".kaakakak.",
        ".kkkkkkkk.",
        ".k......k.",
        "..........",
      ],
    },
    {
      id: "academy",
      name: "Talent Academy",
      rank: 5,
      cost: 30000,
      upkeep: 260,
      accent: "#c86ae8",
      ceiling: 3,
      trainingDiscount: 0.15,
      text: "Development ceiling +3 and development fees −15% per level.",
      icon: [
        "....kk....",
        "..kkaakk..",
        "kkaaaaaakk",
        "..kkkkkk..",
        "..kwkkwk..",
        "..kwkkwk..",
        "..kwkkwk..",
        "kkkkkkkkkk",
        "kyyyyyyyyk",
        "kkkkkkkkkk",
      ],
    },
  ];

  // Neighboring facilities (sharing a wall) unlock one bonus per pairing.
  const SYNERGIES = [
    { pair: ["writers", "lounge"], name: "Late-night sessions", stages: { 1: 2 } },
    { pair: ["vocal", "mix"], name: "Tracking line", stages: { 2: 1, 3: 1 } },
    { pair: ["mix", "radio"], name: "Broadcast ready", stages: { 4: 2 } },
    { pair: ["rehearsal", "vocal"], name: "Warm-up route", stages: { 2: 2 } },
    { pair: ["merch", "bar"], name: "Fan district", incomeBonus: 0.3 },
    { pair: ["archive", "writers"], name: "Deep crates", discovery: 0.05 },
    { pair: ["academy", "rehearsal"], name: "Practice pipeline", trainingDiscount: 0.1 },
  ];

  const HQ = {
    maxLevel: 3,
    // Upgrade from level n to n + 1 costs the build cost × n.
    moveCost: 500,
  };

  // Label ranks. Requirements are checked every week; a rank is never lost.
  // tier feeds the existing room unlocks, stage bonus and development ceiling.
  const RANKS = [
    { name: "Bedroom Label", tier: 1, slots: 2, lot: [3, 2], themeSlots: 1, req: {} },
    {
      name: "Indie Imprint",
      tier: 2,
      slots: 3,
      lot: [4, 2],
      themeSlots: 1,
      grantThemes: 2,
      req: { fame: 30, releases: 2, facilities: 1 },
    },
    {
      name: "Rising Label",
      tier: 3,
      slots: 4,
      lot: [4, 3],
      themeSlots: 2,
      grantThemes: 2,
      req: { fame: 90, releases: 5, facilities: 3, chartPeak: 40, cash: 20000 },
    },
    {
      name: "Major Contender",
      tier: 4,
      slots: 6,
      lot: [5, 3],
      themeSlots: 2,
      grantThemes: 2,
      req: { fame: 200, releases: 9, facilities: 5, chartPeak: 10, awards: 1 },
    },
    {
      name: "Powerhouse",
      tier: 4,
      slots: 7,
      lot: [5, 4],
      themeSlots: 2,
      grantThemes: 2,
      req: { fame: 400, releases: 14, facilities: 7, chartPeak: 1, awards: 3, cash: 100000 },
    },
    {
      name: "Greatest of All Time",
      tier: 4,
      slots: 8,
      lot: [6, 4],
      themeSlots: 2,
      grantThemes: 3,
      req: { fame: 700, releases: 20, facilities: 9, awards: 5, cash: 250000 },
    },
  ];

  const REQUIREMENT_NAMES = {
    fame: "Label fame",
    releases: "Albums released",
    facilities: "Facilities built",
    chartPeak: "Best chart peak",
    awards: "Awards won",
    cash: "Cash on hand",
  };

  // Pixel artist sprite. "a" is the genre color, "s" skin.
  const ARTIST_SPRITE = ["..kk..", ".kssk.", ".kssk.", "..kk..", ".kaak.", "kaaaak", ".kaak.", ".k..k."];
  const GENRE_COLORS = {
    Rap: "#e8c86a",
    "R&B": "#b48ae8",
    Pop: "#e86a8f",
    Country: "#d9a066",
    Sacred: "#efe9da",
    Rock: "#6aa8e8",
  };

  // The player's label as it appears in charts and award lists.
  const LABEL_NAME = "Goat Records";

  const data = {
    LABEL_NAME,
    THEMES,
    FIT,
    PALETTE,
    FACILITIES,
    SYNERGIES,
    HQ,
    RANKS,
    REQUIREMENT_NAMES,
    ARTIST_SPRITE,
    GENRE_COLORS,
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
