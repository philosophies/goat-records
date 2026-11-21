// Late-game delegation (3.0, design 7.7): chores the label can hand over as it grows.
(function (root) {
  "use strict";

  const DELEGATION = {
    // Phase 3: renew a finished contract when the artist's average album quality and the new
    // weekly wage meet the limits. Superstars are always the player's call.
    renew: { phase: 3, term: 3, minQuality: 65, maxWage: 600 },
    // Phase 4: the head of touring (the Live department) books a solo tour for an album that
    // qualifies, the biggest one whose upfront cost fits the cap.
    tours: { phase: 4, department: "live", cap: 15000, scales: ["world", "national", "regional"] },
    // Phase 5: department autopilot. Every `every` weeks it takes up to `actions` steps (train a
    // head, add a junior to a department, develop an artist who is not a superstar), keeping
    // reserveWeeks of overhead in cash.
    autopilot: {
      phase: 5,
      every: 4,
      policies: {
        safe: { name: "Safe", reserveWeeks: 52, actions: 1, staff: false, develop: false },
        balanced: { name: "Balanced", reserveWeeks: 26, actions: 2, staff: true, develop: true },
        aggressive: { name: "Aggressive", reserveWeeks: 8, actions: 4, staff: true, develop: true },
      },
    },
    // Phase 6: a chief operating officer settles company events whose every chosen cost is within
    // the limit. Never political (board) events or superstar events. Choices are weighed as
    // cash / cashWeight − cost / cashWeight + fame + morale / 2 + confidence × 3 − delay × 4.
    coo: {
      phase: 6,
      limit: 10000,
      cashWeight: 600,
      weights: { fame: 1, morale: 0.5, confidence: 3, delayAlbum: -4, artistFame: 0.5, reputation: 1 },
    },
    // The monthly summary covers this many weeks; the log keeps `keep` entries.
    summaryWeeks: 4,
    keep: 60,
  };

  const data = { DELEGATION };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
