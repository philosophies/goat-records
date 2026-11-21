// Story pack: staff, executives, board and rivals (3.0, T56). Stories about department heads, artist
// team members, directors and the label itself: rival labels, the press, the landlord and the street.
// See src/data/stories.js for how arcs, beats, conditions and choices work. In these stories, `story`
// also takes skill, ambition, influence (heads), director (a director's regard for you), confidence
// (the board) and rival (the label's standing with the rival named in the story).
(function (root) {
  "use strict";

  const ch = (label, effects = {}, story = {}, note) => ({
    label,
    ...(note ? { note } : {}),
    ...effects,
    story,
  });
  const beat = (id, after, title, body, choices, when) => ({
    id,
    after,
    title,
    body,
    choices,
    ...(when ? { when } : {}),
  });
  const arc = (id, who, start, beats, extra = {}) => ({ id, who, start, beats, ...extra });

  const STAFF_ARCS = [
    // ---------------- Department heads ----------------
    arc("new-broom", "head", { weeks: { max: 10 } }, [
      beat(
        "the-plan",
        0,
        "{name} wants to reorganise {dept}",
        "Two weeks in, {name} has a plan to rebuild {dept} from the ground up.",
        [
          ch(
            "Back the plan",
            { cost: 2000 },
            { skill: 3, loyalty: 6, next: "results" },
            "New desks, new rules.",
          ),
          ch("Ask for something smaller", {}, { loyalty: -2, next: "results" }),
          ch("Tell them to learn the place first", {}, { ambition: -4, loyalty: -4 }),
        ],
      ),
      beat(
        "results",
        13,
        "{name}'s first quarter",
        "{name} has a report on {dept}'s first quarter under new management, and a request for more.",
        [
          ch("Give them more room", { reputation: 1 }, { influence: 4, loyalty: 4 }),
          ch("Hold them to the budget", {}, { ambition: -3 }),
        ],
      ),
    ]),
    arc(
      "poached-head",
      "head",
      { skill: { min: 65 } },
      [
        beat(
          "the-offer",
          0,
          "{rival} wants {name}",
          "{rivalCeo} of {rival} has offered {name} a bigger title and a bigger office.",
          [
            ch(
              "Counter with a raise",
              { cost: 3000 },
              { loyalty: 10, set: { countered: true }, next: "the-call" },
            ),
            ch("Trust {name} to stay", {}, { set: { countered: false }, next: "the-call" }, "They might."),
            ch("Call {rivalCeo} and complain", {}, { rival: -10, loyalty: 4, next: "the-call" }),
          ],
        ),
        beat(
          "the-call",
          8,
          "{name} gives an answer",
          "{name} has turned {rival} down, and wants you to know it cost them something.",
          [
            ch("Thank them in front of the staff", { reputation: 1 }, { loyalty: 6, influence: 3 }),
            ch("Say nothing more about it", {}, { loyalty: -3 }),
          ],
        ),
      ],
      { rival: true },
    ),
    arc("credit-grab", "head", { ambition: { min: 65 } }, [
      beat(
        "the-interview",
        0,
        "{name} takes the credit",
        "In a trade magazine interview, {name} says the label's last hit was their idea. The artist has read it.",
        [
          ch("Make them correct it", {}, { ambition: -5, loyalty: -4 }),
          ch("Let it go", { reputation: -1 }, { influence: 5, set: { let: true }, next: "the-next" }),
          ch("Tell the press it was a team effort", { labelFame: 2 }, { influence: -3 }),
        ],
      ),
      beat(
        "the-next",
        12,
        "{name} is in the papers again",
        "{name} has another profile out, and this one calls them 'the real power at {label}'.",
        [
          ch("Have a quiet word", {}, { influence: -6, loyalty: -3 }),
          ch("Promote the story yourself", { labelFame: 3 }, { influence: 8, ambition: 4 }),
        ],
        { flags: { let: true } },
      ),
    ]),
    arc("exec-burnout", "head", { weeks: { min: 52 }, loyalty: { min: 55 } }, [
      beat(
        "late-nights",
        0,
        "{name} hasn't been home",
        "The cleaners say {name}'s office light has been on every night for a month.",
        [
          ch("Order two weeks off", {}, { loyalty: 6, skill: -1, next: "back" }),
          ch("Hire them an assistant", { cost: 2500 }, { loyalty: 4, next: "back" }),
          ch("Leave it, it's their job", {}, { loyalty: -6 }),
        ],
      ),
      beat(
        "back",
        6,
        "{name} is back, and lighter",
        "{name} came back with a list of things {dept} should stop doing.",
        [ch("Read the list properly", {}, { skill: 2, loyalty: 3 }), ch("File it", {}, { loyalty: -2 })],
      ),
    ]),
    arc("expense-account", "head", { dept: ["marketing", "promotion"], ambition: { min: 50 } }, [
      beat(
        "the-receipts",
        0,
        "{name}'s expense report",
        "Finance has flagged {name}'s expenses: three dinners at the city's most expensive restaurant, in one week.",
        [
          ch("Make them pay it back", { cash: 1500 }, { loyalty: -6, ambition: -3 }),
          ch("Ask what the dinners bought", {}, { next: "the-deal" }),
          ch("Approve it quietly", { reputation: -1 }, { loyalty: 3 }),
        ],
      ),
      beat("the-deal", 4, "The dinners paid off", "{name} shows you a radio deal signed over dessert.", [
        ch("Give them a proper entertainment budget", { cost: 2000, labelFame: 4 }, { loyalty: 5 }),
        ch("Ask for cheaper restaurants", {}, {}),
      ]),
    ]),
    arc("the-mentor", "head", { skill: { min: 70 } }, [
      beat(
        "juniors",
        0,
        "{name} wants to train the juniors",
        "{name} offers to spend Fridays teaching the junior staff, if you'll cover their desk.",
        [
          ch("Make it official", { cost: 1500 }, { influence: 4, loyalty: 4, next: "graduates" }),
          ch("Not on company time", {}, { loyalty: -3 }),
        ],
      ),
      beat(
        "graduates",
        13,
        "The Friday class",
        "Two of {name}'s juniors have already landed small wins for {dept}.",
        [
          ch("Throw them a lunch", { cost: 500, reputation: 1 }, { loyalty: 3 }),
          ch("Note it in their reviews", {}, { skill: 1 }),
        ],
      ),
    ]),
    arc("board-whisper", "head", { board: true, influence: { min: 30 } }, [
      beat(
        "lunches",
        0,
        "{name} is lunching with the board",
        "Your assistant has noticed {name} lunching with directors. Twice this month.",
        [
          ch("Join the next lunch", {}, { influence: -5, set: { joined: true } }),
          ch("Ask {name} what's going on", {}, { loyalty: 4, influence: -2, next: "the-answer" }),
          ch("Ignore it", {}, { influence: 6 }),
        ],
      ),
      beat(
        "the-answer",
        4,
        "{name}'s answer",
        "{name} says the directors asked for their view of {dept}, and they gave it honestly.",
        [
          ch("Ask to see it first next time", {}, { loyalty: -2, influence: -3 }),
          ch("Thank them for being straight", {}, { loyalty: 6 }),
        ],
      ),
    ]),
    arc("bad-clause", "head", { dept: "business" }, [
      beat(
        "old-deal",
        0,
        "{name} finds a bad clause",
        "Reading old contracts, {name} found a clause that lets a distributor take a bigger cut next year.",
        [
          ch("Renegotiate now", { cost: 2500 }, { skill: 2, set: { fixed: true }, next: "follow-up" }),
          ch("Let it ride", {}, { next: "follow-up" }),
        ],
      ),
      beat(
        "follow-up",
        13,
        "The distributor calls",
        "The distributor has noticed the label reading its contracts closely.",
        [
          ch("Push for better terms everywhere", { reputation: -1, cash: 3000 }, { skill: 1 }),
          ch("Keep the peace", { reputation: 1 }, {}),
        ],
      ),
    ]),
    arc("double-booked", "head", { dept: "live" }, [
      beat(
        "two-tours",
        0,
        "Two tours, one venue",
        "{name} has discovered the label's tour and a rival's are booked into the same arena on the same night.",
        [
          ch("Pay to move the date", { cost: 2000 }, { loyalty: 3, next: "the-night" }),
          ch("Fight for the date", { reputation: -1 }, { skill: 1, next: "the-night" }),
        ],
      ),
      beat(
        "the-night",
        6,
        "The night of the show",
        "{name} pulled it off: the show went ahead, and the crowd never knew.",
        [
          ch("A bonus for {name}", { cost: 1000 }, { loyalty: 6 }),
          ch("A thank-you card", {}, { loyalty: 1 }),
        ],
      ),
    ]),
    arc("the-audit", "head", { dept: "finance" }, [
      beat(
        "numbers",
        0,
        "{name} finds a hole",
        "{name} has found a gap in the books: royalties paid twice to the same artist for a year.",
        [
          ch("Ask for the money back", { cash: 3000, reputation: -1 }, { skill: 1, next: "controls" }),
          ch("Write it off as a gift", { reputation: 1 }, { next: "controls" }),
        ],
      ),
      beat(
        "controls",
        10,
        "{name} wants new controls",
        "{name} wants every payment over $1,000 signed by two people.",
        [ch("Agree", {}, { influence: 4, loyalty: 3 }), ch("Keep things fast", {}, { loyalty: -3 })],
      ),
    ]),
    arc("controversial-video", "head", { dept: "creative" }, [
      beat(
        "the-treatment",
        0,
        "{name}'s video idea",
        "{name} has a video treatment that will either win awards or get banned.",
        [
          ch(
            "Shoot it",
            { cost: 3000, labelFame: 5, reputation: -2 },
            { skill: 2, loyalty: 4, next: "the-ban" },
            "It will be talked about.",
          ),
          ch("Tone it down", {}, { loyalty: -4 }),
        ],
      ),
      beat(
        "the-ban",
        10,
        "One channel won't play it",
        "A music channel has refused {name}'s video. The internet has noticed.",
        [
          ch("Make the ban the story", { labelFame: 4 }, { influence: 3 }),
          ch("Cut a clean version", { cost: 800 }, {}),
        ],
      ),
    ]),
    arc("church-basement", "head", { dept: "ar" }, [
      beat(
        "the-find",
        0,
        "{name} found someone",
        "{name} wants to show you a phone video of a singer in a church basement. Nobody else has heard her.",
        [
          ch(
            "Send {name} back with a contract",
            { cost: 1000 },
            { skill: 2, loyalty: 4, next: "the-singer" },
          ),
          ch("Not right now", {}, { loyalty: -3 }),
        ],
      ),
      beat(
        "the-singer",
        8,
        "The basement singer",
        "The singer turned the contract down: she wants to finish school first. {name} is crushed.",
        [ch("Tell {name} to keep in touch with her", {}, { loyalty: 4 }), ch("Move on", {}, {})],
      ),
    ]),
    // Authored heads.
    arc(
      "tuesday-night",
      "head",
      { weeks: { min: 4 } },
      [
        beat(
          "open-mic",
          0,
          "{name} wants you at an open mic",
          "{name} insists you come to Tuesday's open mic. 'You'll see what I mean.'",
          [ch("Go", {}, { loyalty: 8, next: "the-act" }), ch("Send someone else", {}, { loyalty: -3 })],
        ),
        beat(
          "the-act",
          2,
          "The act at the open mic",
          "The last act of the night was raw and remarkable. {name} is already writing a deal memo.",
          [
            ch("Back the memo", { cost: 1500, labelFame: 2 }, { skill: 2, loyalty: 4 }),
            ch("Watch them a while longer", {}, {}),
          ],
        ),
      ],
      { castId: "desmond-achebe" },
    ),
    arc(
      "product-launch",
      "head",
      { weeks: { min: 4 } },
      [
        beat(
          "launch-plan",
          0,
          "{name} wants a launch event",
          "{name} wants to launch the next album like a sneaker: a countdown, a pop-up shop, a queue round the block.",
          [
            ch(
              "Fund the pop-up",
              { cost: 5000, labelFame: 6 },
              { loyalty: 5, set: { popup: true }, next: "the-queue" },
            ),
            ch("Keep it to a release party", {}, { ambition: 4, loyalty: -4 }),
          ],
        ),
        beat(
          "the-queue",
          6,
          "The queue round the block",
          "There really is a queue round the block. {name} wants to do this for every release.",
          [
            ch("Make it a house style", { reputation: 1 }, { influence: 5 }),
            ch("Once was enough", {}, { ambition: 3 }),
          ],
          { flags: { popup: true } },
        ),
      ],
      { castId: "grant-holloway" },
    ),
    arc(
      "long-memory",
      "head",
      { weeks: { min: 8 } },
      [
        beat(
          "old-grudge",
          0,
          "{name} remembers a lawyer",
          "{name} has recognised the lawyer across the table: the one who beat her, once, eleven years ago.",
          [
            ch(
              "Let her settle the score",
              { cash: 3000 },
              { loyalty: 6, set: { score: true }, next: "the-rematch" },
            ),
            ch("Keep it professional", {}, { loyalty: -2 }),
          ],
        ),
        beat(
          "the-rematch",
          8,
          "The rematch",
          "{name} won. The other side's lawyer has asked her to lunch.",
          [ch("Encourage it", {}, { influence: 4 }), ch("Keep her focused", {}, { skill: 1 })],
          { flags: { score: true } },
        ),
      ],
      { castId: "evelyn-sato" },
    ),
    arc(
      "the-auteur",
      "head",
      { weeks: { min: 6 } },
      [
        beat(
          "one-take",
          0,
          "{name} wants a one-take video",
          "{name} wants to shoot the next video in a single take through the whole street, at night.",
          [
            ch(
              "Close the street for a night",
              { cost: 4000, labelFame: 5 },
              { loyalty: 6, skill: 1, next: "festival" },
            ),
            ch("Shoot it in the studio", {}, { loyalty: -4, ambition: 3 }),
          ],
        ),
        beat(
          "festival",
          10,
          "A film festival calls",
          "A short-film festival wants to screen {name}'s video.",
          [
            ch("Send {name} to the festival", { cost: 800, reputation: 2 }, { loyalty: 4 }),
            ch("Keep {name} at work", {}, { loyalty: -2 }),
          ],
        ),
      ],
      { castId: "mina-larouche" },
    ),

    // ---------------- Artist team members ----------------
    arc("signature-sound", "member", { role: "producer", assigned: true }, [
      beat(
        "the-sound",
        0,
        "{name} wants a signature sound",
        "Your {role} {name} wants every record they touch to carry the same drum sound. 'People should know it's mine.'",
        [
          ch("Let them sign their work", {}, { skill: 2, loyalty: 4, next: "copycats" }),
          ch("Every record should sound like its artist", {}, { loyalty: -3 }),
        ],
      ),
      beat(
        "copycats",
        10,
        "Everyone wants {name}'s drums",
        "Other labels' producers are copying {name}'s drum sound.",
        [
          ch("Put {name}'s name on the sleeves", { labelFame: 3 }, { loyalty: 4 }),
          ch("Keep the sound in-house", {}, {}),
        ],
      ),
    ]),
    arc("manager-overreach", "member", { role: "manager", assigned: true }, [
      beat(
        "side-deal",
        0,
        "{name} is negotiating on the side",
        "Your {role} {name} has been talking to a brand about an endorsement without telling the label.",
        [
          ch("Bring the deal in-house", { cash: 2000 }, { loyalty: -4 }),
          ch("Let {name} run with it", { reputation: -1 }, { loyalty: 4, skill: 1, next: "the-brand" }),
        ],
      ),
      beat(
        "the-brand",
        8,
        "The brand wants more",
        "The brand loved the first campaign and wants a year-long deal.",
        [ch("Sign it", { cash: 4000, reputation: -1 }, {}), ch("Keep it to one campaign", {}, {})],
      ),
    ]),
    arc("planted-rumour", "member", { role: "publicist" }, [
      beat(
        "the-rumour",
        0,
        "{name} planted a rumour",
        "Your {role} {name} admits the 'secret duet' rumour in today's papers came from them.",
        [
          ch("Ride the wave", { labelFame: 4, reputation: -2 }, { loyalty: 3, next: "the-duet" }),
          ch("Make them retract it", { reputation: 1 }, { loyalty: -5 }),
        ],
      ),
      beat(
        "the-duet",
        10,
        "People want the duet",
        "The duet that never existed is now the most requested song on the radio.",
        [ch("Make the duet real", { cost: 3000, labelFame: 5 }, { skill: 2 }), ch("Let it fade", {}, {})],
      ),
    ]),
    arc("wardrobe-bill", "member", { role: "stylist" }, [
      beat(
        "the-bill",
        0,
        "{name}'s wardrobe bill",
        "Your {role} {name} has sent a wardrobe bill longer than some album budgets.",
        [
          ch("Pay it", { cost: 2000 }, { loyalty: 5, next: "the-look" }),
          ch("Ask for vintage and borrowed pieces", {}, { skill: 1, loyalty: -2, next: "the-look" }),
        ],
      ),
      beat(
        "the-look",
        10,
        "The look everyone copies",
        "Teenagers across the city are dressing like the label's artists. {name} is quietly delighted.",
        [
          ch("A merch line from {name}'s designs", { cost: 1500, cash: 4000 }, { loyalty: 4 }),
          ch("Just say well done", {}, { loyalty: 2 }),
        ],
      ),
    ]),
    arc("van-trouble", "member", { role: "tour" }, [
      beat(
        "breakdown",
        0,
        "The van broke down",
        "Your {role} {name} calls from a lay-by: the van is dead and the show is in five hours.",
        [
          ch("Hire a van, whatever it costs", { cost: 1200 }, { loyalty: 4 }),
          ch("Tell {name} to work it out", {}, { skill: 2, loyalty: -2, next: "the-fix" }),
        ],
      ),
      beat(
        "the-fix",
        2,
        "{name} worked it out",
        "{name} flagged down a church minibus. The band arrived in choir robes and played the best show of the tour.",
        [
          ch("Make it a story for the press", { labelFame: 3 }, { loyalty: 3 }),
          ch("Pay the church back", { cost: 300, reputation: 1 }, { loyalty: 3 }),
        ],
      ),
    ]),

    // ---------------- Directors ----------------
    arc("cost-cuts", "director", { type: "accountant" }, [
      beat(
        "the-memo",
        0,
        "{name} wants cuts",
        "{name} has sent a memo: ten percent off every department's spending, starting now.",
        [
          ch("Agree publicly", { reputation: -1 }, { director: 6, confidence: 3, next: "the-review" }),
          ch("Offer a smaller cut", {}, { director: 2, next: "the-review" }),
          ch("Refuse", {}, { director: -6, confidence: -2 }),
        ],
      ),
      beat(
        "the-review",
        13,
        "{name} checks the numbers",
        "{name} has gone through the books line by line, and wants to talk about the results.",
        [
          ch("Walk them through it yourself", {}, { director: 4 }),
          ch("Send the finance head", {}, { director: -2 }),
        ],
      ),
    ]),
    arc("hologram-tour", "director", { type: "visionary" }, [
      beat(
        "the-pitch",
        0,
        "{name} has a big idea",
        "{name} wants a hologram tour: your artists on stage in ten cities at once.",
        [
          ch(
            "Fund a test show",
            { cost: 6000, labelFame: 6 },
            { director: 8, set: { tested: true }, next: "the-test" },
          ),
          ch("Promise to look at it next year", {}, { director: -2 }),
        ],
      ),
      beat(
        "the-test",
        10,
        "The hologram test show",
        "The test show sold out. Half the reviews say it's the future; half say it's creepy.",
        [
          ch("Tell the board it worked", {}, { director: 6, confidence: 3 }),
          ch("Tell the board it's not ready", {}, { director: -4 }),
        ],
        { flags: { tested: true } },
      ),
    ]),
    arc("wellness", "director", { type: "friend" }, [
      beat(
        "the-worry",
        0,
        "{name} is worried about the artists",
        "{name} has heard artists are touring too hard and wants a wellness programme.",
        [
          ch("Start one", { cost: 3000, reputation: 2 }, { director: 8 }),
          ch("Ask the artists what they want first", {}, { director: 3, next: "the-survey" }),
          ch("Say the artists are fine", {}, { director: -6 }),
        ],
      ),
      beat(
        "the-survey",
        6,
        "What the artists said",
        "The artists asked for two things: a quiet room at the office and fewer early flights.",
        [
          ch("Do both", { cost: 1500, reputation: 1 }, { director: 6 }),
          ch("The quiet room only", { cost: 500 }, { director: 2 }),
          ch("Neither for now", {}, { director: -4 }),
        ],
      ),
    ]),
    arc("old-ears", "director", { type: "oldGuard" }, [
      beat(
        "the-single",
        0,
        "{name} hates the new single",
        "{name} has called the label's new single 'noise with a logo'.",
        [
          ch("Play them the demo it came from", {}, { director: 4, next: "the-classic" }),
          ch("Remind them how many streams it has", {}, { director: -3, confidence: 1 }),
        ],
      ),
      beat(
        "the-classic",
        8,
        "{name} has a suggestion",
        "{name} suggests the label reissue an old classic it owns, for the people who still buy records.",
        [
          ch("Press a vinyl run", { cost: 2000, cash: 3500 }, { director: 6 }),
          ch("Maybe next year", {}, { director: -2 }),
        ],
      ),
    ]),
    arc("stake-sale", "director", { type: "investor", satisfaction: { max: 45 } }, [
      beat(
        "exit-talk",
        0,
        "{name} wants out",
        "{name} hints that their fund might sell its stake in the label to someone less patient.",
        [
          ch(
            "Take them through the plan for the year",
            {},
            { director: 6, confidence: 2, next: "second-look" },
          ),
          ch("Let them sell", {}, { director: -6, confidence: -3 }),
        ],
      ),
      beat(
        "second-look",
        10,
        "{name} takes a second look",
        "{name} says the fund will hold for now, if the next quarter goes well.",
        [ch("Promise them a strong quarter", {}, { director: 4 }), ch("Promise nothing", {}, {})],
      ),
    ]),
    arc("industry-dinner", "director", { relationship: { min: 8 } }, [
      beat(
        "the-invite",
        0,
        "{name} invites you to dinner",
        "{name} is hosting a dinner for the biggest names in the business, and has saved you a seat.",
        [
          ch("Go", { cost: 500, labelFame: 3 }, { director: 4, next: "the-table" }),
          ch("Politely decline", {}, { director: -2 }),
        ],
      ),
      beat(
        "the-table",
        1,
        "At the table",
        "Across the table, a streaming executive asks what {label} is working on next.",
        [
          ch("Tell them everything", { labelFame: 4, reputation: -1 }, { director: 2 }),
          ch("Keep your cards close", { reputation: 1 }, { director: 2 }),
        ],
      ),
    ]),

    // ---------------- The label ----------------
    arc(
      "rival-diss",
      "company",
      { labelFame: { min: 40 } },
      [
        beat(
          "the-quote",
          0,
          "{rivalCeo} takes a shot",
          "{rivalCeo} of {rival} told a magazine that {label} 'signs anyone with a phone and a dream'.",
          [
            ch(
              "Answer with a joke",
              { labelFame: 3 },
              { rival: -6, set: { answered: true }, next: "round-two" },
            ),
            ch("Rise above it", { reputation: 1 }, { rival: 2 }),
            ch(
              "Answer with a diss record",
              { labelFame: 6, reputation: -2 },
              { rival: -15, set: { answered: true }, next: "round-two" },
            ),
          ],
        ),
        beat(
          "round-two",
          8,
          "{rival} hits back",
          "{rival} has answered with a billboard across the street from your office.",
          [
            ch("Call {rivalCeo} and end it", {}, { rival: 10 }),
            ch("Buy a bigger billboard", { cost: 3000, labelFame: 6 }, { rival: -10 }),
          ],
          { flags: { answered: true } },
        ),
      ],
      { rival: true },
    ),
    arc(
      "merger-talk",
      "company",
      { phase: [4, 6] },
      [
        beat(
          "coffee",
          0,
          "{rivalCeo} suggests coffee",
          "{rivalCeo} of {rival} wants to talk about 'working more closely together'. Everyone knows what that means.",
          [
            ch("Take the meeting", {}, { rival: 6, confidence: 2, set: { met: true }, next: "the-terms" }),
            ch("Decline", {}, { rival: -4 }),
          ],
        ),
        beat(
          "the-terms",
          8,
          "{rival} names terms",
          "{rival}'s terms arrive: a joint venture on touring, split down the middle.",
          [
            ch("Sign the joint venture", { cash: 8000, reputation: -1 }, { rival: 10, confidence: 3 }),
            ch("Walk away", {}, { rival: -6 }),
          ],
          { flags: { met: true } },
        ),
      ],
      { rival: true },
    ),
    arc("expose", "company", { labelFame: { min: 100 } }, [
      beat(
        "the-reporter",
        0,
        "A reporter is asking questions",
        "A reporter is writing a long piece about how {label} treats its artists and wants an interview.",
        [
          ch("Open the doors", { reputation: 2 }, { confidence: 1, set: { open: true }, next: "the-piece" }),
          ch("No comment", {}, { next: "the-piece" }),
        ],
      ),
      beat(
        "the-piece",
        8,
        "The piece runs",
        "The article is out. It is fairer than you feared, and harder on {label}'s contracts than you'd like.",
        [
          ch("Announce fairer contracts", { reputation: 3, labelFame: 3 }, { confidence: -2 }),
          ch("Let it blow over", { reputation: -2 }, {}),
        ],
      ),
    ]),
    arc("street-team", "company", { phase: [1, 2] }, [
      beat(
        "the-kids",
        0,
        "Kids want to help",
        "A group of teenagers from the block has offered to be {label}'s street team, for free t-shirts.",
        [ch("Print the t-shirts", { cost: 300, labelFame: 3 }, { next: "posters" }), ch("Not now", {}, {})],
      ),
      beat(
        "posters",
        6,
        "Posters everywhere",
        "The street team has postered every wall in the neighbourhood. The council has sent a letter.",
        [
          ch("Pay the fine and keep going", { cost: 400, labelFame: 4 }, {}),
          ch("Ask them to stop", { reputation: 1 }, {}),
        ],
      ),
    ]),
    arc("the-landlord", "company", { phase: [1, 3] }, [
      beat(
        "the-rent",
        0,
        "The landlord has news",
        "The landlord wants to raise the rent, or sell the building to a coffee chain.",
        [
          ch("Negotiate hard", {}, { set: { stayed: true }, next: "the-deal" }),
          ch("Offer a year up front", { cost: 3000, reputation: 1 }, {}),
        ],
      ),
      beat(
        "the-deal",
        4,
        "The landlord's counter",
        "The landlord will hold the rent if the label puts on a show for the building's birthday.",
        [
          ch("Put on the show", { cost: 500, labelFame: 3 }, {}),
          ch("Pay the higher rent", { cost: 1500 }, {}),
          ch("Call the landlord's bluff", { reputation: -1 }, {}),
        ],
      ),
    ]),
    arc("charity-gala", "company", { phase: [3, 6] }, [
      beat(
        "the-invite",
        0,
        "The city's charity gala",
        "The city's biggest charity gala wants a {label} artist to close the night.",
        [
          ch(
            "Send your biggest act",
            { reputation: 3, labelFame: 3 },
            { confidence: 1, next: "the-auction" },
          ),
          ch("Send a newcomer", { labelFame: 2 }, { next: "the-auction" }),
          ch("Decline", { reputation: -1 }, {}),
        ],
      ),
      beat(
        "the-auction",
        1,
        "The auction",
        "At the gala auction, a signed guitar from {label} is up against a rival's.",
        [
          ch("Bid it up yourself", { cost: 2000, reputation: 2 }, {}),
          ch("Let it sell for what it sells for", {}, {}),
        ],
      ),
    ]),
    arc(
      "award-gloat",
      "company",
      { labelFame: { min: 150 } },
      [
        beat(
          "the-speech",
          0,
          "{rivalCeo}'s speech",
          "Collecting an award, {rivalCeo} of {rival} thanked 'everyone, especially the labels who made it easy'.",
          [
            ch("Laugh it off in public", { reputation: 1 }, { rival: 2 }),
            ch(
              "Promise the press you'll win next year",
              { labelFame: 3 },
              { rival: -6, set: { vowed: true }, next: "next-year" },
            ),
          ],
        ),
        beat(
          "next-year",
          26,
          "A year later",
          "The press remembers your promise. They want a comment before this year's awards.",
          [
            ch("Stand by it", { labelFame: 4 }, { rival: -4 }),
            ch("Say the music speaks for itself", { reputation: 1 }, {}),
          ],
          { flags: { vowed: true } },
        ),
      ],
      { rival: true },
    ),
    arc("market-interview", "company", { public: true }, [
      beat(
        "the-anchor",
        0,
        "A financial news interview",
        "A business channel wants you live, to talk about the share price.",
        [
          ch(
            "Go on and talk up the year",
            { labelFame: 2 },
            { confidence: 3, set: { promised: true }, next: "the-quarter" },
          ),
          ch("Go on and be careful", { reputation: 1 }, { confidence: 1 }),
          ch("Decline", {}, { confidence: -2 }),
        ],
      ),
      beat(
        "the-quarter",
        13,
        "The anchor remembers",
        "The anchor has replayed your interview against this quarter's numbers.",
        [
          ch("Call it a long game", {}, { confidence: -1 }),
          ch("Point to the release schedule", {}, { confidence: 1 }),
        ],
        { flags: { promised: true } },
      ),
    ]),
  ];

  const data = { STAFF_ARCS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
