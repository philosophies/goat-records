// Legacy and challenges (3.0, design 7.6): the hall of fame, achievements, challenge starts and
// legacy perks. The hall of fame and unlocked achievements live outside any save (the interface
// keeps them in browser storage); a run only records what it has unlocked so far.
(function (root) {
  "use strict";

  // Achievements. `check` names the test in the legacy system; `n` is its threshold.
  const ACHIEVEMENTS = [
    {
      id: "first-sign",
      name: "Open for business",
      text: "Sign your first artist.",
      check: "artistsSigned",
      n: 1,
    },
    { id: "first-release", name: "Out now", text: "Release an album.", check: "releases", n: 1 },
    { id: "first-hit", name: "A hit", text: "Release an album of quality 75 or more.", check: "hits", n: 1 },
    { id: "top-ten", name: "Top ten", text: "An album reaches the Top 10.", check: "bestPeak", n: 10 },
    { id: "number-one", name: "Number one", text: "An album reaches #1.", check: "bestPeak", n: 1 },
    { id: "phase-2", name: "Storefront", text: "Reach phase 2.", check: "phase", n: 2 },
    { id: "phase-3", name: "Regional power", text: "Reach phase 3.", check: "phase", n: 3 },
    { id: "phase-4", name: "National name", text: "Reach phase 4.", check: "phase", n: 4 },
    { id: "phase-5", name: "Global label", text: "Reach phase 5.", check: "phase", n: 5 },
    { id: "phase-6", name: "Empire", text: "Reach phase 6.", check: "phase", n: 6 },
    { id: "star", name: "A star is born", text: "An artist becomes a star.", check: "stars", n: 1 },
    { id: "superstar", name: "Superstar", text: "An artist becomes a superstar.", check: "superstars", n: 1 },
    {
      id: "three-superstars",
      name: "Three of a kind",
      text: "Have three superstars at once.",
      check: "superstars",
      n: 3,
    },
    { id: "award", name: "Silver Groove", text: "Win an award.", check: "awards", n: 1 },
    { id: "five-awards", name: "Mantelpiece", text: "Win five awards.", check: "awards", n: 5 },
    { id: "classic", name: "A classic", text: "An album becomes a classic.", check: "classics", n: 1 },
    {
      id: "ten-year-classic",
      name: "Ten-year classic",
      text: "A classic turns ten.",
      check: "classicYears",
      n: 10,
    },
    { id: "deluxe", name: "Deluxe", text: "Make a deluxe edition.", check: "deluxe", n: 1 },
    {
      id: "on-screen",
      name: "On screen",
      text: "License a song to a film, game or advert.",
      check: "syncs",
      n: 1,
    },
    { id: "battle", name: "Chart battle", text: "Win a chart battle.", check: "battlesWon", n: 1 },
    { id: "chart-war", name: "Chart war", text: "Win ten chart battles.", check: "battlesWon", n: 10 },
    {
      id: "feud-winner",
      name: "Feud winner",
      text: "Win three chart battles against a label you are feuding with.",
      check: "feudBattlesWon",
      n: 3,
    },
    { id: "takeover", name: "Takeover", text: "Buy a rival label.", check: "rivalsBought", n: 1 },
    { id: "raid", name: "The raid", text: "Win a rival's artist with a bid.", check: "rivalSignings", n: 1 },
    {
      id: "ahead",
      name: "Ahead of the curve",
      text: "Invest early in a new era.",
      check: "eraInvestments",
      n: 1,
    },
    {
      id: "streaming",
      name: "Through the ages",
      text: "Run a label into the streaming era.",
      check: "era",
      n: 3,
    },
    {
      id: "public",
      name: "Going public",
      text: "List the company on the stock market.",
      check: "listed",
      n: 1,
    },
    { id: "millionaire", name: "Seven figures", text: "Hold $1,000,000 in cash.", check: "cash", n: 1000000 },
    { id: "level-20", name: "Legend", text: "An artist reaches level 20.", check: "topLevel", n: 20 },
    {
      id: "second-act",
      name: "Second act",
      text: "Start a new company after losing the first.",
      check: "secondAct",
      n: 1,
    },
    {
      id: "better-second",
      name: "Better the second time",
      text: "A second act reaches a higher phase than the company before it.",
      check: "secondActOutgrown",
      n: 1,
    },
    { id: "full-run", name: "Twenty years", text: "Run a label for twenty years.", check: "years", n: 20 },
    {
      id: "against-odds",
      name: "Against the odds",
      text: "Reach phase 3 in a challenge run.",
      check: "challengePhase",
      n: 3,
    },
  ];

  // Challenge starts: the same for everyone who picks them with the same seed.
  //   debt     start owing a bank loan you never received
  //   star     one superstar on a fresh deal and nothing else
  //   board    a board from day one, cold and on low freedom
  //   piracy   the piracy years from week one
  //   noLoans  the bank will not lend
  //   weekly   this week's seed with this week's twist (one of the five above)
  const CHALLENGES = [
    { id: "debt", name: "In the red", text: "Start owing the bank $20,000 you have already spent." },
    {
      id: "star",
      name: "One star",
      text: "Start with one superstar on a two-album deal, no cash and no one else.",
    },
    {
      id: "board",
      name: "Hostile board",
      text: "Start with a board that does not trust you, on low freedom.",
    },
    { id: "piracy", name: "Piracy from day one", text: "The piracy years have already begun." },
    { id: "noLoans", name: "No credit", text: "The bank will not lend to you for the whole run." },
    { id: "weekly", name: "This week's run", text: "Everyone gets the same seed and twist this week." },
  ];
  const CHALLENGE_RULES = {
    debt: { loan: 20000 },
    star: { cash: 0, fame: 70, talent: 78, albums: 2 },
    board: { satisfaction: 30, relationship: -10, freedom: "low" },
    weeklyTwists: ["debt", "star", "board", "piracy", "noLoans"],
  };

  // Legacy perks: chosen at a new CEO run once enough achievements are unlocked, up to `max` at a
  // time. Nothing raises income, quality or a discount by more than `cap`.
  const PERKS = [
    {
      id: "extra-candidate",
      name: "Word of mouth",
      unlock: 3,
      text: "One more artist at the front desk at the start.",
    },
    { id: "second-theme", name: "Notebook", unlock: 6, text: "Start with a second album theme." },
    {
      id: "known-name",
      name: "Known name",
      unlock: 10,
      reputation: 5,
      text: "Start with 5 more reputation.",
    },
    {
      id: "steady-hands",
      name: "Steady hands",
      unlock: 14,
      training: 0.05,
      text: "Development sessions cost 5% less.",
    },
    { id: "loyal-fans", name: "Loyal fans", unlock: 18, sales: 0.03, text: "Album sales +3%." },
    { id: "road-crew", name: "Road crew", unlock: 24, touring: 0.03, text: "Tour ticket sales +3%." },
  ];
  const LEGACY_RULES = { hallSize: 50, maxPerks: 2, cap: 0.05 };

  const data = { ACHIEVEMENTS, CHALLENGES, CHALLENGE_RULES, PERKS, LEGACY_RULES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
