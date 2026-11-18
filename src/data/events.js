(function (root) {
  "use strict";
  const data = {
    COMPANY_EVENT_INTERVAL: 13,
    COMPANY_EVENTS: [
      {
        id: "studio-cancellation",
        kind: "opportunity",
        phases: [1, 2],
        weight: 1,
        when: { artist: [{ field: "morale", min: 45 }] },
        deadlineWeeks: 2,
        title: "A studio slot opens",
        body: "A local studio offers a cancelled session and a credit on its showcase compilation.",
        expiryChoice: 2,
        choices: [
          {
            label: "Book the full session",
            hint: "$300. The showcase may raise the label's profile.",
            cost: 300,
            chance: 0.75,
            effects: { fame: 3, artistFame: 2, morale: 4 },
            failure: { morale: -2 },
          },
          {
            label: "Take the short session",
            hint: "$100. The artist gains 2 morale.",
            cost: 100,
            effects: { morale: 2 },
          },
          {
            label: "Let the slot go",
            hint: "The disappointed artist loses 3 morale.",
            effects: { morale: -3 },
          },
        ],
      },
    ],
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
