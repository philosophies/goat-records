// Rival labels (3.0, design 7.3). Each CEO run meets three rivals drawn from eight authored labels.
// They release into the same charts, bid for your artists, feud with you and, when weak, can be bought.
(function (root) {
  "use strict";

  // How each kind of rival CEO plays.
  //   strength      starting strength (0–100); every phase you reach adds RIVAL_RULES.perPhase
  //   releaseEvery  weeks between their releases
  //   quality       added to their albums' quality
  //   poach         weekly chance of a bid for one of your artists who could leave
  //   feud          weekly chance of a public spat starting a feud with one of your superstars
  const PERSONALITIES = {
    shark: {
      name: "Shark",
      strength: 45,
      releaseEvery: 8,
      quality: 0,
      poach: 0.05,
      feud: 0.02,
      text: "Poaches often, overpays and starts feuds.",
    },
    purist: {
      name: "Purist",
      strength: 40,
      releaseEvery: 16,
      quality: 12,
      poach: 0.01,
      feud: 0.005,
      text: "Few releases, high quality, wins awards.",
    },
    hype: {
      name: "Hype machine",
      strength: 40,
      releaseEvery: 4,
      quality: -8,
      poach: 0.02,
      feud: 0.015,
      text: "Floods the charts and buys attention.",
    },
    oldGuard: {
      name: "Old guard",
      strength: 55,
      releaseEvery: 12,
      quality: 5,
      poach: 0.015,
      feud: 0.005,
      text: "A big catalog, slow to move, buys smaller labels.",
    },
  };

  // The eight labels. Every name is original.
  const RIVAL_LABELS = [
    {
      id: "black-halo",
      name: "Black Halo Music",
      ceo: "Rocco Vane",
      personality: "shark",
      genre: "Rap",
      roster: ["Knuckles Ray", "Mama Sol", "Drift Kid"],
    },
    {
      id: "velvet-rope",
      name: "Velvet Rope Records",
      ceo: "Celine Okoro",
      personality: "hype",
      genre: "Pop",
      roster: ["Glossy", "Tessa Blink", "The Neon Twins"],
    },
    {
      id: "cobalt-chapel",
      name: "Cobalt Chapel",
      ceo: "Abraham Wexley",
      personality: "purist",
      genre: "Sacred",
      roster: ["Hosanna Reed", "The Ninth Hour", "Brother Amos"],
    },
    {
      id: "dust-diesel",
      name: "Dust & Diesel",
      ceo: "June Barlow",
      personality: "oldGuard",
      genre: "Country",
      roster: ["Cutter Lane", "The Holloway Pines", "Ma Delphine"],
    },
    {
      id: "static-bloom",
      name: "Static Bloom",
      ceo: "Ivy Marchetti",
      personality: "hype",
      genre: "Rock",
      roster: ["Paper Teeth", "Lux Ferrari", "Dead Air Club"],
    },
    {
      id: "sundown",
      name: "Sundown Syndicate",
      ceo: "Dorian Pike",
      personality: "shark",
      genre: "R&B",
      roster: ["Honey Vale", "Marcus Mood", "Satin & Smoke"],
    },
    {
      id: "marble-arch",
      name: "Marble Arch Recordings",
      ceo: "Prudence Hale",
      personality: "oldGuard",
      genre: "Rock",
      roster: ["The Gentlemen", "Ava Strand", "Old Ironsides"],
    },
    {
      id: "lowrider",
      name: "Lowrider Sound",
      ceo: "Tino Alvarez",
      personality: "purist",
      genre: "R&B",
      roster: ["Luz Cervantes", "Slow Roll", "Ese Royale"],
    },
  ];

  //   count          rivals in a run
  //   perPhase       strength each of your phases adds to every rival
  //   drift          weekly random change in strength (±)
  //   battleWindow   releases within this many weeks of each other meet in a chart battle
  //   battleSwing    strength a rival wins or loses in a battle
  //   feudAt         standing at or below which a rival is in a feud with you
  //   feudSales      album sales lift for both sides of a feud
  //   flare          weekly chance during a feud that it spills over (an artist loses `flareTrust` trust,
  //                  and the board counts a scandal)
  //   match          matching a bid costs the artist's pay for this many weeks
  //   counter        a counter-offer costs `share` of a match; it holds with `base` + loyalty / 200
  //                  + relationship / 200 chance
  //   bid            from `phase`, you can bid for a rival's artist: costs `perTalent` × their talent,
  //                  works with `base` + (label fame − rival strength) / 400 chance (10–80%)
  //   buy            from `phase`, a rival weaker than `below` can be bought for `weeks` of its catalog
  //                  revenue; its catalog then pays you `catalog` × strength a week
  //   superstarFeud  a superstar-started feud: back it (standing −20, relationship +6, fans +5) or calm it
  //                  (standing +10, relationship −4)
  // Album titles rivals release under, combined with a number when they repeat.
  const RIVAL_TITLES = [
    "Night Shift",
    "Paper Crowns",
    "Last Call",
    "Gold Teeth",
    "Slow Burn",
    "Static",
    "Southbound",
    "Glass House",
    "Low Tide",
    "Iron Lung",
    "Halo Effect",
    "Back Roads",
  ];
  const RIVAL_RULES = {
    count: 3,
    perPhase: 6,
    drift: 2,
    battleWindow: 2,
    battleSwing: 3,
    feudAt: -40,
    feudSales: 0.05,
    flare: 0.03,
    flareTrust: 4,
    // A rival release: first-week units unitsByPhase[your phase] × own strength / 50 ×
    // (1 − spread / 2 … 1 + spread / 2), close to a typical album of yours at the same phase;
    // quality base + strength × perStrength + the personality's quality + up to `spread`.
    release: {
      unitsByPhase: [170, 220, 450, 500, 600, 1800],
      unitSpread: 0.6,
      quality: 50,
      qualityPerStrength: 0.35,
      qualitySpread: 10,
    },
    // A battle is called once both albums have charted this many weeks; checks stop after battleCheck.
    battleWeeks: 3,
    battleCheck: 8,
    // Awards night: a rival's album beating yours in a genre (they gloat), or yours beating theirs.
    awardSnub: -5,
    awardBeat: -3,
    // Weeks between any two rival cards, and before the same artist can be bid for again.
    cardGap: 26,
    // Rivals only bid for proven artists: stars and superstars.
    bidTiers: ["star", "superstar"],
    // Rivals start bidding for your artists at this phase, as you can for theirs.
    poachFrom: 3,
    artistGap: 52,
    // A rival's artist you bid for: talent 40 + strength / 2, potential talent + 10.
    poachTalent: { base: 40, perStrength: 0.5, potential: 10 },
    match: 8,
    matchMorale: 5,
    matchLoyalty: 4,
    counter: { share: 0.5, base: 0.5 },
    bid: { phase: 3, perTalent: 150, base: 0.4, min: 0.1, max: 0.8, standing: -10 },
    buy: { phase: 5, below: 55, weeks: 104, catalog: 40 },
    superstarFeud: { back: { standing: -20, relation: 6, fans: 5 }, calm: { standing: 10, relation: -4 } },
    letGo: { standing: -5 },
  };

  const data = { PERSONALITIES, RIVAL_LABELS, RIVAL_RULES, RIVAL_TITLES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
