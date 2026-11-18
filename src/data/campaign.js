// Balance tables for the campaign: the 20-year run, yearly goals, the final score and New Game+ legacy bonuses.
(function (root) {
  "use strict";

  const CAMPAIGN = {
    // Operating years in one run (52 weeks each). The run ends after the last year's awards.
    years: 20,
    weeksPerYear: 52,
    // An artist counts as developed once they reach this career level during the run.
    developedLevel: 5,
    // A theme reward pays this much cash per theme once every theme is known.
    themeFallbackCash: 5000,
  };

  // One goal per operating year. Types:
  //   breakout   — fame, releases (and optionally awards), with cash remaining
  //   rank       — reach label rank `need` (1–6)
  //   peak       — `count` albums (default 1) that peaked at `peak` or better
  //   awards     — `need` annual awards
  //   releases   — `need` albums released
  //   hits       — `need` hit albums (quality 75+)
  //   facilities — `need` facilities built
  //   fame       — label fame of `need`
  //   cash       — `need` cash on hand
  // scope "total" counts the whole run; scope "year" counts only that operating year.
  // Rewards: cash, fame, or themes (new album themes discovered).
  const CAMPAIGN_GOALS = [
    { year: 1, type: "rank", need: 2, name: "Reach Indie Imprint", reward: { cash: 8000 } },
    { year: 2, type: "peak", peak: 40, scope: "total", name: "A Top 40 album", reward: { themes: 1 } },
    {
      year: 3,
      type: "breakout",
      name: "Breakout Label",
      need: { fame: 300, releases: 12 },
      reward: { cash: 15000 },
    },
    { year: 4, type: "releases", need: 10, scope: "total", name: "Release 10 albums", reward: { fame: 20 } },
    {
      year: 5,
      type: "awards",
      need: 1,
      scope: "total",
      name: "Win an annual award",
      reward: { cash: 15000 },
    },
    { year: 6, type: "rank", need: 3, name: "Reach Rising Label", reward: { themes: 1 } },
    { year: 7, type: "peak", peak: 10, scope: "total", name: "A Top 10 album", reward: { cash: 20000 } },
    { year: 8, type: "hits", need: 2, scope: "year", name: "Two hit albums this year", reward: { fame: 30 } },
    { year: 9, type: "facilities", need: 6, name: "Build 6 facilities", reward: { themes: 2 } },
    { year: 10, type: "rank", need: 4, name: "Reach Major Contender", reward: { cash: 40000 } },
    { year: 11, type: "peak", peak: 1, scope: "total", name: "A #1 album", reward: { fame: 40 } },
    {
      year: 12,
      type: "awards",
      need: 4,
      scope: "total",
      name: "Win 4 awards in total",
      reward: { themes: 2 },
    },
    { year: 13, type: "cash", need: 150000, name: "$150,000 on hand", reward: { fame: 40 } },
    { year: 14, type: "rank", need: 5, name: "Reach Powerhouse", reward: { cash: 60000 } },
    {
      year: 15,
      type: "awards",
      need: 1,
      scope: "year",
      name: "An award this year",
      reward: { themes: 2 },
    },
    {
      year: 16,
      type: "releases",
      need: 35,
      scope: "total",
      name: "Release 35 albums",
      reward: { cash: 75000 },
    },
    {
      year: 17,
      type: "peak",
      peak: 1,
      count: 3,
      scope: "total",
      name: "Three #1 albums",
      reward: { fame: 60 },
    },
    {
      year: 18,
      type: "awards",
      need: 8,
      scope: "total",
      name: "Win 8 awards in total",
      reward: { themes: 2 },
    },
    { year: 19, type: "fame", need: 900, name: "900 label fame", reward: { cash: 100000 } },
    { year: 20, type: "rank", need: 6, name: "Greatest of All Time rank", reward: { fame: 100 } },
  ];

  // Final score: one row per source, summed. Cash counts per $1,000 on hand, capped.
  const CAMPAIGN_SCORE = {
    perRank: 100, // × label rank (1–6)
    perAward: 60,
    awardCap: 15,
    perFame: 0.25,
    fameCap: 4000, // fame counted up to this
    perNumberOne: 80, // albums that peaked at #1
    numberOneCap: 10,
    perTopTen: 25, // albums that peaked at #2–#10 (a #1 counts only as a #1)
    topTenCap: 20,
    perHit: 10, // albums with quality 75+
    hitCap: 40,
    perGoal: 30, // yearly goals met
    cashPer: 1000,
    cashCap: 500,
    // A run that ends in bankruptcy loses this share of its score.
    bankruptPenalty: 0.25,
  };

  // Minimum final score for each star grade, 1 to 5.
  const CAMPAIGN_STARS = [0, 1200, 2400, 3600, 4800];

  // Legacy points earned per final score point, and the bonuses they buy for the next run.
  const LEGACY = { scorePerPoint: 250 };
  const LEGACY_BONUSES = [
    { id: "seed", name: "Seed money", cost: 3, cash: 15000, text: "Start with $15,000 more cash." },
    { id: "fund", name: "Trust fund", cost: 7, cash: 40000, text: "Start with $40,000 more cash." },
    {
      id: "themes",
      name: "Theme library",
      cost: 5,
      text: "Keep every album theme discovered in the last run.",
    },
    {
      id: "notebook",
      name: "Combo notebook",
      cost: 4,
      text: "Keep the fit of every genre and theme combo you recorded. Combo levels start over.",
    },
    {
      id: "facility",
      name: "Founding room",
      cost: 4,
      facility: "writers",
      text: "Start with a Writers' Room already built.",
    },
    {
      id: "studio",
      name: "Second studio",
      cost: 4,
      booth: 1,
      text: "Start with the Neon Vault recording room already built.",
    },
    { id: "indie", name: "Indie start", cost: 8, rank: 2, text: "Start at Indie Imprint rank." },
    {
      id: "scouts",
      name: "Scouting network",
      cost: 3,
      scout: 2,
      text: "Open with a free National talent search.",
    },
    {
      id: "team",
      name: "Veteran team",
      cost: 6,
      text: "Keep the last run's staff, with no hiring fees.",
    },
  ];

  const data = { CAMPAIGN, CAMPAIGN_GOALS, CAMPAIGN_SCORE, CAMPAIGN_STARS, LEGACY, LEGACY_BONUSES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
