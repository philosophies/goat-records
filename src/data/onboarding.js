// The first fifteen minutes (3.0, design 7.1): a short starter checklist and one-time tips.
(function (root) {
  "use strict";

  // The starter checklist, in order. A goal pays its reward once, at the week's settlement after it
  // is met. `fame` is label fame; `reputation` is label reputation.
  const STARTER_GOALS = [
    { id: "sign", text: "Sign your first artist", reward: { cash: 500 } },
    { id: "stage", text: "Finish the first recording stage", reward: { cash: 500 } },
    { id: "release", text: "Release your first album", reward: { cash: 1000, fame: 5 } },
    { id: "chart", text: "Reach the chart", reward: { cash: 1500 } },
    { id: "profit", text: "End a week in profit", reward: { reputation: 5 } },
  ];
  // While the checklist is on, the run's first album has no wait between stages, the first signing
  // costs no advance and the first album's base budget (up to `freeAlbumBudget`) is paid for, so
  // every goal can be done without borrowing. Add-ons and location rent are still paid.
  const STARTER = { fastFirstAlbum: true, freeFirstSigning: true, freeAlbumBudget: 4000 };
  // One-time tips: shown the first time each matters, never before.
  const TIPS = [
    {
      id: "party",
      title: "Tip: listening parties",
      body: "Your album is finished. Before you release it, you can play it to a room of fans from the final review: their reactions show which part to rework.",
    },
    {
      id: "starSlot",
      title: "Tip: a star slot is open",
      body: "Your phase now has room for a star. An up-and-comer with 40 fame and a hit moves up on their own, and stars can spend more on albums, ads, tours and their team.",
    },
    {
      id: "superstar",
      title: "Tip: your first superstar",
      body: "A superstar is the face of the company. Their news moves company value, and their relationship with you can swing hard. Keep it warm: one day they may be the reason you get a second chance.",
    },
    {
      id: "board",
      title: "Tip: you have a board",
      body: "Outside money brings directors. Each judges you by their own agenda; meet them before reviews, keep your promises and watch the budget. Open the boardroom from the office.",
    },
  ];

  const data = { STARTER_GOALS, STARTER, TIPS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
