// The streaming platform (CEO runs, owner decision 2026-11-22): from phase 5 the label can buy into
// a streaming service that puts its artists' records in front of listeners and inflates their numbers.
(function (root) {
  "use strict";

  //   name       the platform (an original name)
  //   phase      the company phase that opens it
  //   stakes     bought in order; `share` is the total owned after that stake, `price` what the step
  //              costs and `lift` the label's album sales lift with that stake (sales and chart units)
  //   era        the lift is × the current era's catalog number (×0.8 in tapes … ×1.4 in streaming)
  //   bookValue  share of what was paid that counts toward company value
  //   scrutiny   every `every` weeks from stake `from`, a chance of `chance` × (stake − from + 1) that
  //              the press questions the numbers: reputation `reputation`, counted by a board as a scandal
  const PLATFORM = {
    name: "Tributary",
    phase: 5,
    stakes: [
      { share: 10, price: 3000000, lift: 0.03 },
      { share: 25, price: 10000000, lift: 0.06 },
      { share: 45, price: 30000000, lift: 0.09 },
      { share: 70, price: 75000000, lift: 0.12 },
      { share: 100, price: 180000000, lift: 0.15 },
    ],
    era: "catalog",
    bookValue: 0.8,
    scrutiny: { from: 3, every: 13, chance: 0.06, reputation: -4 },
  };

  const data = { PLATFORM };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
