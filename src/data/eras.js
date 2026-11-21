// Music eras (3.0, design 7.4): the industry changes across a CEO run.
(function (root) {
  "use strict";

  // The four eras in order. `from` is the usual first year; each run moves every change one or two
  // years earlier or later (ERA_RULES). Stream multipliers:
  //   sales      weekly album sales            singles    the lead single's sales lift
  //   touring    tour ticket revenue           licensing  sync and publishing income
  //   catalog    streaming and catalog income  marketing  ad campaign prices
  // `strongest` is the stream an early investment lifts. `events` reweights company events by id.
  const ERAS = [
    {
      id: "tapes",
      name: "Tapes and CDs",
      from: 1,
      sales: 1.2,
      singles: 0.8,
      touring: 1.0,
      licensing: 0.8,
      catalog: 0.8,
      marketing: 1.0,
      strongest: "sales",
      events: {},
      text: "Fans buy the whole album in a shop. Albums sell best; singles and old records matter less.",
    },
    {
      id: "piracy",
      name: "The piracy years",
      from: 5,
      sales: 0.7,
      singles: 1.0,
      touring: 1.3,
      licensing: 1.1,
      catalog: 0.9,
      marketing: 0.9,
      strongest: "touring",
      events: { "album-leak": 3, "market-slump": 1.5, "tour-documentary": 1.5, "festival-slot": 1.5 },
      text: "Albums leak before release and sales fall. Fans still pay to see a show.",
    },
    {
      id: "downloads",
      name: "Download stores",
      from: 9,
      sales: 0.9,
      singles: 1.3,
      touring: 1.1,
      licensing: 1.2,
      catalog: 1.0,
      marketing: 1.1,
      strongest: "singles",
      events: { "distribution-deal": 2, "remix-contest": 1.5, "trailer-sync": 1.5 },
      text: "Fans buy songs one at a time. A strong lead single carries an album.",
    },
    {
      id: "streaming",
      name: "Streaming",
      from: 13,
      sales: 0.8,
      singles: 1.1,
      touring: 1.2,
      licensing: 1.2,
      catalog: 1.4,
      marketing: 1.2,
      strongest: "catalog",
      events: { "streaming-exclusive": 2, "stream-payout-cut": 2, "viral-performance": 1.5 },
      text: "Every song ever made is a tap away. Old records earn again; attention is expensive.",
    },
  ];

  // Which era stream each company revenue line follows (company COMPANY_REVENUE ids).
  const ERA_REVENUE = {
    downloads: "singles",
    streams: "catalog",
    merch: "touring",
    distribution: "sales",
    radio: "singles",
    sync: "licensing",
    publishing: "licensing",
    catalog: "catalog",
    acquisitions: "catalog",
  };

  const ERA_RULES = {
    // Each change of era moves by one of these many years; no era is shorter than minYears.
    shifts: [-2, -1, 1, 2],
    minYears: 2,
    // Weeks of warning before a change.
    announce: 13,
    // Investing early: cost per company phase; lifts the coming era's strongest stream for `weeks`.
    invest: { costPerPhase: 2500, bonus: 0.15, weeks: 52 },
  };

  const data = { ERAS, ERA_REVENUE, ERA_RULES };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
