// Show why (3.0, design 7.2): the cause log, the monthly ledger and the artist timeline.
(function (root) {
  "use strict";

  //   keep          causes kept in the log (oldest dropped first)
  //   relationMin   a relationship swing smaller than this is not logged (weekly drift is gradual)
  //   ledgerWeeks   weeks in a ledger month; ledgerMonths how many months the Wallet shows
  //   timeline      events shown on an artist's timeline
  const WHY_RULES = { keep: 60, relationMin: 3, ledgerWeeks: 4, ledgerMonths: 3, timeline: 8 };

  const data = { WHY_RULES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
