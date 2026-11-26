// Tour pay (CEO runs, owner decision 2026-11-26): the ticket rate rises and falls with the artist's
// fame, the tour's quality, the artist's tier and the label's reputation. Shared tours get a small
// boost, plus more for the other act's fame and tier and the two labels' standing.
(function (root) {
  "use strict";

  // Each term adds (value − around) × per to a rate of 1. The rate is kept between min and max.
  // fame 100: +10%, fame 0: −10%; quality 100: +9%, quality 40: −9%; reputation 100: +8%, 20: −8%.
  const TOUR_PAY = {
    fame: { around: 50, per: 0.002 },
    quality: { around: 70, per: 0.003 },
    reputation: { around: 60, per: 0.002 },
    tier: { rising: 0, star: 0.03, superstar: 0.08 },
    // Shared tours: `base`, then the other act's fame above `around`, their tier, and the two labels'
    // average standing above 60 (yours is your reputation; a rival label's is its strength). Each
    // part counts only upward, and all of it together is at most `max`.
    shared: {
      base: 0.05,
      fame: { around: 40, per: 0.0015 },
      tier: { rising: 0, star: 0.02, superstar: 0.04 },
      label: { around: 60, per: 0.0015 },
      max: 0.15,
    },
    // A rival's artist has no tier at your label: their fame stands in for it.
    rivalTier: { star: 40, superstar: 75 },
    min: 0.8,
    max: 1.45,
  };

  const data = { TOUR_PAY };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
