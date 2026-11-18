// Core balance tables: genres, staff roles, rooms, production stages, scouting,
// album packages, touring and career curves.
(function (root) {
  "use strict";
  const GENRES = ["Rap", "R&B", "Pop", "Country", "Sacred", "Rock"];
  const ROLES = {
    VP: { cost: 7000, wage: 350, description: "Skill reduces weekly roster wages by 15–24%." },
    Marketing: {
      cost: 5000,
      wage: 250,
      description: "Skill increases album revenue and campaign effectiveness.",
    },
    "Artist Development": {
      cost: 4500,
      wage: 220,
      description: "Skill 65+ adds one extra training point; skill scales production bonuses.",
    },
    "Public Relations": {
      cost: 5000,
      wage: 250,
      description: "Skill softens immediate trust losses in PR events.",
    },
    Producer: {
      cost: 6000,
      wage: 300,
      description: "Skill scales bonuses to supported songwriting, recording and mastering choices.",
    },
    "A&R": {
      cost: 4000,
      wage: 200,
      description: "Skill reduces artist advances and supports artist-led releases.",
    },
  };
  const BOOTHS = [
    {
      name: "The Living Room",
      theme: "Rank 1 · Demo room",
      equipment: 20,
      team: 15,
      cost: 0,
      upkeep: 100,
      labelTier: 1,
    },
    {
      name: "Neon Vault",
      theme: "Rank 2 · Project studio",
      equipment: 40,
      team: 35,
      cost: 9000,
      upkeep: 175,
      labelTier: 1,
    },
    {
      name: "Voltage Chapel",
      theme: "Rank 3 · Professional studio",
      equipment: 55,
      team: 50,
      cost: 15000,
      upkeep: 250,
      labelTier: 2,
    },
    {
      name: "Skyline Sound",
      theme: "Rank 4 · Premium production",
      equipment: 70,
      team: 65,
      cost: 24000,
      upkeep: 375,
      labelTier: 2,
    },
    {
      name: "Platinum Works",
      theme: "Rank 5 · Flagship studio",
      equipment: 85,
      team: 80,
      cost: 40000,
      upkeep: 550,
      labelTier: 3,
    },
    {
      name: "Legend Hall",
      theme: "Rank 6 · World-class production",
      equipment: 100,
      team: 95,
      cost: 65000,
      upkeep: 800,
      labelTier: 4,
    },
  ];
  const STAGES = [
    {
      name: "Creative direction",
      area: "Identity",
      question: "What should this album stand for?",
      options: [
        {
          name: "Artist-led vision",
          role: "A&R",
          factor: "trust",
          text: "Build on artist trust and their signature genre.",
        },
        {
          name: "Follow the current wave",
          role: "Marketing",
          factor: "trend",
          text: "Chase the current genre trend; a mismatch weakens the concept.",
        },
        {
          name: "Craft a label statement",
          role: "VP",
          factor: "label",
          text: "Use label fame and reputation to establish a distinctive identity.",
        },
      ],
    },
    {
      name: "Songwriting",
      area: "Songwriting",
      question: "Where will the songs find their voice?",
      options: [
        {
          name: "Personal storytelling",
          role: "Artist Development",
          factor: "trust",
          text: "Trust and development expertise make the writing feel personal.",
        },
        {
          name: "Hook-writing workshop",
          role: "Producer",
          factor: "craft",
          text: "Craft and a producer build memorable melodies and hooks.",
        },
        {
          name: "Write for the listeners",
          role: "Marketing",
          factor: "audience",
          text: "Core audience fit shapes accessible songs.",
        },
      ],
    },
    {
      name: "Recording",
      area: "Performance",
      question: "How will you capture the performance?",
      options: [
        {
          name: "An intimate live take",
          role: "Artist Development",
          factor: "energy",
          text: "A rested artist gives an expressive, natural performance.",
        },
        {
          name: "Layer a polished performance",
          role: "Producer",
          factor: "craft",
          text: "Artist craft and producer expertise reward technical precision.",
        },
        {
          name: "Lean into the room",
          role: "Producer",
          factor: "booth",
          text: "Room equipment, production team and prestige shape the session.",
        },
      ],
    },
    {
      name: "Mix & master",
      area: "Sound",
      question: "What should listeners hear in the finished sound?",
      options: [
        {
          name: "Warm and organic",
          role: "Producer",
          factor: "booth",
          text: "Room equipment, production team and hit history shape the master.",
        },
        {
          name: "Loud and contemporary",
          role: "Producer",
          factor: "trend",
          text: "Current genre momentum supports a chart-focused sound.",
        },
        {
          name: "Detailed and dynamic",
          role: "Artist Development",
          factor: "craft",
          text: "Strong craft and development expertise preserve musical detail.",
        },
      ],
    },
    {
      name: "Campaign planning",
      area: "Reach",
      question: "How will you introduce this record to the world?",
      options: [
        {
          name: "A fan-first introduction",
          role: "Public Relations",
          factor: "trust",
          text: "Artist trust supports a lasting connection.",
        },
        {
          name: "A trend-driven campaign",
          role: "Marketing",
          factor: "trend",
          text: "A matching trend boosts the campaign’s reach.",
        },
        {
          name: "A flagship label launch",
          role: "VP",
          factor: "label",
          text: "Label fame and reputation give this release institutional weight.",
        },
      ],
    },
  ];
  const RELEASE_PLANS = [
    { id: "press", name: "Press premiere", role: "Public Relations", target: 0 },
    { id: "fans", name: "Fan listening party", role: "A&R", target: 1 },
    { id: "wide", name: "Wide digital launch", role: "Marketing", target: 2 },
  ];
  const INSPIRATION_TIERS = [
    { min: 0, name: "Recharging", bonus: -10 },
    { min: 25, name: "Ready to record", bonus: -10 },
    { min: 50, name: "Decent album odds", bonus: 0 },
    { min: 75, name: "Great album odds", bonus: 6 },
    { min: 90, name: "Classic album odds", bonus: 12 },
  ];
  const SCOUT_BUDGETS = [
    { name: "Local open call", cost: 500, count: 3, min: 38, max: 63, fans: 8, fanRange: 20, potential: 78 },
    {
      name: "Regional showcase",
      cost: 2000,
      count: 4,
      min: 48,
      max: 76,
      fans: 18,
      fanRange: 38,
      potential: 87,
    },
    {
      name: "National talent search",
      cost: 6000,
      count: 5,
      min: 60,
      max: 86,
      fans: 35,
      fanRange: 65,
      potential: 94,
    },
  ];
  const RECRUIT_BUDGETS = [
    { name: "Local recruitment", cost: 400, min: 35, max: 60 },
    { name: "Industry recruitment", cost: 1200, min: 50, max: 78 },
    { name: "Executive search", cost: 3000, min: 68, max: 92 },
  ];
  const ALBUM_ADDONS = [
    {
      id: "video",
      name: "Music video",
      cost: 5000,
      weeks: 1,
      description: "Reach +6; market reception +8; album sales +12%.",
    },
    {
      id: "press",
      name: "Press run",
      cost: 2000,
      weeks: 1,
      description: "Identity +2, Reach +4; critics +5, market reception +3.",
    },
    {
      id: "appearances",
      name: "Live appearances",
      cost: 3000,
      weeks: 1,
      description: "Performance +3, Reach +5; launch attention +10, energy −8.",
    },
    {
      id: "star",
      name: "Star Producer session",
      cost: 15000,
      weeks: 1,
      description: "One album only: first four production areas +10, Reach +2, critics +6.",
    },
  ];
  const TOUR_SCALES = [
    {
      id: "regional",
      name: "Regional",
      weeks: 4,
      upfront: 4500,
      weekly: 800,
      gate: 1050,
      ramp: 0.65,
      eventEvery: 2,
    },
    {
      id: "national",
      name: "National",
      weeks: 8,
      upfront: 14000,
      weekly: 2200,
      gate: 1950,
      ramp: 0.45,
      eventEvery: 2,
    },
    {
      id: "world",
      name: "World",
      weeks: 12,
      upfront: 35000,
      weekly: 5000,
      gate: 3900,
      ramp: 0.35,
      eventEvery: 3,
    },
  ];
  const TOUR_MODES = [
    {
      id: "solo",
      name: "Solo headliner",
      upfront: 1,
      weekly: 1,
      revenue: 1,
      drain: 8,
      minEnergy: 65,
      description: "Highest headliner stat gains; highest energy drain.",
    },
    {
      id: "labelmate",
      name: "With a labelmate",
      upfront: 1.35,
      weekly: 1.2,
      revenue: 1.65,
      drain: 2,
      minEnergy: 45,
      description: "Highest revenue potential; lowest drain; both artists unavailable for albums.",
    },
    {
      id: "rival",
      name: "With a rival artist",
      upfront: 1.12,
      weekly: 1.1,
      revenue: 1.25,
      drain: 5,
      minEnergy: 55,
      description: "Balanced costs and fatigue; rival recruitment opportunities and poaching risks.",
    },
  ];
  const CAREER_XP = [0, 4, 10, 19, 31, 46, 64, 85, 109, 136];
  const CAREER_NAMES = ["Emerging", "Developing", "Breakthrough", "Headliner", "Icon"];
  // A label can stay below $0 for this many weekly settlements before the run ends.
  const DEBT = { graceWeeks: 4 };
  const data = {
    DEBT,
    GENRES,
    ROLES,
    BOOTHS,
    STAGES,
    RELEASE_PLANS,
    INSPIRATION_TIERS,
    SCOUT_BUDGETS,
    RECRUIT_BUDGETS,
    ALBUM_ADDONS,
    TOUR_SCALES,
    TOUR_MODES,
    CAREER_XP,
    CAREER_NAMES,
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = root.GoatData;
})(typeof globalThis !== "undefined" ? globalThis : this);
