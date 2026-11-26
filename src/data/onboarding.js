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

  // The mentor: a retiring label boss who walks a new CEO through the starter checklist.
  // Beats come in this order; a beat's moment is set in src/systems/onboarding.js. `kind` "talk" is a
  // card over the lot that holds the clock until answered; "note" sits on the album being made.
  // `go` opens a panel ("Show me"); `place` is the panel where `here` is shown as pointers.
  const MENTOR = {
    name: "Augie Delmonte",
    label: "Delmonte Sound",
    beats: [
      {
        id: "intro",
        kind: "talk",
        title: "Welcome to the business",
        text: [
          "Forty-one years I ran Delmonte Sound. Friday I hand in my keys, and I'm not leaving until somebody's making records in my old home studio. That somebody is you.",
          "Up top is your scoreboard: cash, fame, reputation and the roster. Under it, the date and the clock. Pause, 1×, 2× and 4× run time; Next week jumps ahead. Time stops whenever a panel is open, so read as long as you like.",
          "Everything else is on the street. Tap a building or a sign and it opens a panel beside it. The checklist in the side ticker is what I want done before I go, and I'm paying for your first signing and your first record.",
        ],
        go: "desk~sec-scout",
        goLabel: "Show me the front desk",
      },
      {
        id: "desk",
        kind: "pointers",
        place: "desk",
        title: "The front desk",
        here: [
          "Craft is how good they are today; potential is how far they can grow.",
          "Fans and fame decide who hears the first record; age and audience decide who it's for.",
          "A longer deal costs more up front but pays the artist a smaller royalty. Your first one costs no advance.",
          "Pick a sound you like and press Sign. Hiring staff, on the Staff tab, can wait.",
        ],
      },
      {
        id: "artist",
        kind: "talk",
        title: "Now make a record",
        text: [
          "Good ear. Their panel is where you'll live: inspiration (they need 25 to record, 90 for a classic), energy, morale, and what they want from you: money, creative control, fame or family time. Ignore that for long and they walk.",
          "Everyone starts as an up-and-comer. Fame and hits make them a star, then a superstar, and each step up lets the company spend more on them.",
          "Open their Record section. At your size the studio makes one album at a time; it grows with the company. I've covered this record's base budget.",
        ],
        go: "artist~sec-record",
        goLabel: "Show me the Record section",
      },
      {
        id: "record",
        kind: "pointers",
        place: "artist",
        title: "Planning the album",
        here: [
          "The album is in the artist's own genre. Pick a theme that suits it: a good match adds points, and the combo notebook on your sign remembers every match you've tried.",
          "The audience should be the artist's own unless you have a reason.",
          "Lean is fine for a first record. Add-ons (a video, a press run, live spots, a star producer) cost extra and take a week each.",
          "Press Begin recording when it looks right.",
        ],
      },
      {
        id: "stages",
        kind: "note",
        title: "Five decisions",
        text: [
          "A record is five decisions: creative direction, songwriting, recording, mix and master, and the campaign. Each offers three approaches with a forecast; open the rating breakdown to see what goes into it. The safe one is steady, the bold one swings.",
          "Usually there's a week between stages. I've pushed this one through, so you'll see all five now.",
        ],
      },
      {
        id: "release",
        kind: "note",
        title: "Ready for the world?",
        text: [
          "The five ratings average into quality; 75 or more is a hit. A reshuffle rerolls one area's luck, and it can come out worse.",
          "Before release you can play it to a room of fans. Their reactions show which part to rework. Then pick a release plan: a press premiere for the critics, a fan listening party for the fans, a wide launch for the market.",
        ],
      },
      {
        id: "charts",
        kind: "talk",
        title: "It's out",
        text: [
          "Sales start when the week turns. Press Next week, or let the clock run. Each weekly settlement pays sales, takes wages and rent, and posts the chart.",
          "The billboard keeps the Top 300, your promotion (a lead single or ads), the three rival labels and the market. Rivals matter: release next to one of theirs and it's a chart battle. And watch the market, because the music business changes every few years.",
        ],
        go: "billboard~sec-charts",
        goLabel: "Show me the billboard",
      },
      {
        id: "billboard",
        kind: "pointers",
        place: "billboard",
        title: "The billboard",
        here: [
          "Charts: where your record lands each week, and how many units it moved.",
          "Promotion: a lead single before release, ads while it sells.",
          "Rivals: each label's strength, releases and how they feel about you.",
          "The market: the era you're in and what it does to sales, tours and ads.",
        ],
      },
      {
        id: "money",
        kind: "talk",
        title: "Keep the lights on",
        text: [
          "You charted. Now end one week with more cash than you started it with, and my list is done.",
          "The office has the company's goals for the next phase, the finances line by line, your catalog and your label's name. Your phone has the inbox, where decisions wait; the Wallet, with cash and what the company's worth; and Settings.",
          "Short of cash? The boardroom has the bank. A loan is just a loan. Angel and venture money buy part of the company, and with them comes a board that judges everything you do.",
        ],
        go: "office~sec-company",
        goLabel: "Show me the office",
      },
      {
        id: "office",
        kind: "pointers",
        place: "office",
        title: "The office",
        here: [
          "Company: the goals for the next phase (fame, revenue, releases and hits) and the boardroom.",
          "Finances: where every dollar came from and went, week by week.",
          "Catalog: every record you've made and what it still earns.",
        ],
      },
      {
        id: "farewell",
        kind: "talk",
        title: "The keys are yours",
        text: [
          "That's my list. The rest you learn by doing. Each phase opens more buildings, departments, artist slots and a bigger studio. When the studio is full, the tour bus is how idle artists earn. The trophy case holds your awards, the Vault where old records find new money, and the hall of fame.",
          "Out of town are bigger studios and paid gigs. The newsstand tells you what the industry's saying. Rivals will come for your stars, and the market will change under you, so read the signs.",
          "Last advice: keep your artists happy, don't rush records, and never let the cash sit below zero for four weeks. Good luck, CEO.",
        ],
        goLabel: "Thanks, Augie",
      },
    ],
  };

  const data = { STARTER_GOALS, STARTER, TIPS, MENTOR };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
