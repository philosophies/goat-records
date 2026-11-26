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

  // Tours in weeks (CEO runs, owner decision 2026-11-26). A week on the road settles with the weekly
  // settlement: seven shows' tickets, a week's running cost, a week's energy, fame and fans. A rest
  // week sells no tickets and gives each touring artist `restEnergy`. A decision card comes every
  // tour scale's `eventEvery` weeks (the first after `firstDecision` weeks), or as soon as a touring
  // artist is under `fatigueEnergy`. A tour can grow to `maxLength` × its booked weeks.
  // Card effects: `costWeeks` and `cashWeeks` are in weeks of the tour's running cost; `addWeeks`
  // and `cutWeeks` change the plan; `tourPause` books rest weeks; `tourMult` × `tourBoostWeeks`
  // changes ticket sales for that many show weeks; `qualityDelta` moves tour quality; `cancelChance`
  // can end the tour.
  // ticketScale: a week's shows sell for this much more than the same shows played a day at a time,
  // standing in for the many small daily promotions that week-long play no longer has.
  const TOUR_WEEKS = {
    ticketScale: 1.15,
    firstDecision: 1,
    restEnergy: 24,
    fatigueEnergy: 30,
    maxLength: 2,
    xpEvery: { solo: 1, shared: 2 },
    craftEvery: 2,
    events: [
      {
        id: "second-night",
        title: "A sold-out city wants another week",
        body: "Every date in the region has sold out and promoters are asking for more.",
        options: [
          { label: "Add a week in the region", addWeeks: 1, costWeeks: 0.5, morale: 2 },
          { label: "Raise ticket prices instead", tourMult: 1.2, tourBoostWeeks: 2, fans: -3 },
          { label: "Keep to the plan", morale: -2 },
        ],
      },
      {
        id: "sound-trouble",
        title: "The sound keeps failing",
        body: "The rented sound rig has failed twice this week and the crowds noticed.",
        options: [
          { label: "Hire a better crew", costWeeks: 0.6, qualityDelta: 8 },
          { label: "Make do with what you have", qualityDelta: -4 },
          {
            label: "Strip the show back to acoustic sets",
            qualityDelta: 4,
            tourMult: 0.9,
            tourBoostWeeks: 1,
            fans: 4,
          },
        ],
      },
      {
        id: "radio-week",
        title: "Local radio wants a week of interviews",
        body: "Stations along the route want the artist in every morning before the shows.",
        options: [
          { label: "Do every interview", energy: -8, fans: 6, tourMult: 1.15, tourBoostWeeks: 1 },
          { label: "Send a recorded message", fans: 2 },
          {
            label: "Play live on air in every city",
            energy: -14,
            fans: 10,
            qualityDelta: 4,
            tourMult: 1.3,
            tourBoostWeeks: 1,
            cancelChance: 0.1,
          },
        ],
      },
      {
        id: "merch-rush",
        title: "The merch has sold out",
        body: "Shirts and posters were gone by the third night. Fans are asking where to buy them.",
        options: [
          { label: "Rush a restock", costWeeks: 0.5, cashWeeks: 0.9 },
          { label: "Sell a limited run online", cashWeeks: 0.3, fans: 3 },
          { label: "Let it go", morale: -1 },
        ],
      },
      {
        id: "worn-crew",
        title: "The crew is worn out",
        body: "Load-outs are running late and the crew has stopped laughing at the bus jokes.",
        options: [
          { label: "Take a rest week", tourPause: 1, morale: 4 },
          { label: "Pay the crew a bonus", costWeeks: 0.5, morale: 4 },
          { label: "Push on", qualityDelta: -6, morale: -4 },
        ],
      },
      {
        id: "festival-slot",
        title: "A festival slot opens up",
        body: "A festival on the route has lost an act and wants yours this weekend.",
        options: [
          { label: "Play the festival", energy: -12, fans: 10, cashWeeks: 0.5 },
          { label: "Pass", morale: -2 },
          {
            label: "Headline it with the full production",
            costWeeks: 0.5,
            energy: -12,
            fans: 16,
            tourMult: 1.35,
            tourBoostWeeks: 1,
            cancelChance: 0.15,
          },
        ],
      },
      {
        id: "bad-review",
        title: "A harsh review in the city paper",
        body: "The biggest paper on the route called the show tired and overlong.",
        options: [
          { label: "Rework the set", energy: -6, qualityDelta: 6 },
          { label: "Ignore it", tourMult: 0.95, tourBoostWeeks: 1 },
          {
            label: "Answer the critic in public",
            attention: 10,
            fans: 6,
            trust: -4,
            tourMult: 1.1,
            tourBoostWeeks: 1,
          },
        ],
      },
      {
        id: "bus-breakdown",
        title: "The tour bus breaks down",
        body: "The bus is stuck between cities with a cracked engine block.",
        options: [
          { label: "Rent a replacement", costWeeks: 0.5 },
          { label: "Drop the next week of dates", cutWeeks: 1, morale: 2 },
          { label: "Drive on in vans", energy: -10, qualityDelta: -4, cancelChance: 0.15 },
        ],
      },
    ],
  };

  const data = { TOUR_PAY, TOUR_WEEKS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
