// Story pack: what the artist is doing (3.0, T80). Stories that depend on whether an artist is
// headlining a tour, sharing one, recording, has an album just out or is waiting for the next
// record. Most run over several cards. They follow the kinds of trouble that make music news in each
// genre (feuds played out on stage, co-headliners falling out, leaks, contract fights, old posts
// coming back), with original people and places. Some can cost the label tour dates, album sales or
// the artist. See src/data/stories.js for how arcs, beats and choices work.
//
// Beyond the usual conditions, a beat's `when` can name a `context` ("headlining", "sharing",
// "recording", "albumOut", "waiting") and a `genre`. A beat can also have:
//   soon      plays as soon as it is due, without the usual wait between a person's stories
//   lapse     weeks it may wait for its conditions once due; after that the story ends
//   headline  the press line shown on the card
//   major     the outcome is revealed with the larger animation
// and its choices can have, besides the usual effects:
//   mult, boostWeeks      album sales multiplier on the latest album, and for how many weeks
//   tourMult, tourWeeks   ticket sales multiplier for the tour, and for how many weeks
//   tourCut               weeks of tour dates removed
//   tourEndChance         chance the rest of the tour is called off (tourEnd: certain)
//   leaveChance           chance the artist leaves the label (leaves: certain)
// Chances, cuts and multipliers are drawn with the choice's outcome like every other effect.
(function (root) {
  "use strict";

  // albumOut: weeks after a release that count as "album out". tourWeeks: default length of a
  // ticket change. leaveMorale: morale lost by an artist who would leave but is mid-record, or by an
  // up-and-comer told to go (owner decision 2026-11-26: only stars and superstars leave after a
  // story). leaveScale: how much likelier a star or superstar is to go than the card's base chance,
  // up to leaveMax.
  const STORY_CONTEXT = {
    albumOut: 10,
    tourWeeks: 2,
    leaveMorale: -15,
    leaveScale: { rising: 0, star: 1.75, superstar: 2.25 },
    leaveMax: 0.9,
  };

  const ch = (label, effects = {}, story = {}, note) => ({
    label,
    ...(note ? { note } : {}),
    ...effects,
    story,
  });
  const beat = (id, after, title, body, choices, when, extra = {}) => ({
    id,
    after,
    title,
    body,
    choices,
    ...(when ? { when } : {}),
    ...extra,
  });
  const arc = (id, start, beats, extra = {}) => ({ id, who: "artist", start, beats, ...extra });
  const out = { releases: { min: 1 } };

  const CONTEXT_ARCS = [
    // ---------------- Headlining a tour ----------------
    arc("diss-on-stage", { ...out, genre: "Rap", context: "headlining" }, [
      beat(
        "the-premiere",
        0,
        "{name} debuts a diss track on stage",
        "Midway through the set {name} stops the band and performs a new verse aimed at a rival camp's biggest star. Phones are up all over the room.",
        [
          ch(
            "Let it ride",
            { fans: 14, attention: 10, trust: -4, tourMult: 1.3 },
            { set: { rode: true }, next: "venues-pull-out" },
            "Ticket demand jumps. So does the heat.",
          ),
          ch(
            "Put it out as a single tonight",
            { cost: 3000, fans: 20, attention: 16, artistFame: 4, trust: -8, tourMult: 1.4 },
            { set: { rode: true, single: true }, next: "venues-pull-out" },
          ),
          ch("Ask {name} to drop it from the set", { morale: -5, trust: 2 }, { relation: -2 }),
        ],
        null,
        { headline: "{name} fires a new diss mid-set", major: true },
      ),
      beat(
        "venues-pull-out",
        1,
        "Venues start pulling out",
        "Two promoters on the back half of the tour say they don't want the trouble. Their insurers agree. The other camp's fans are buying tickets just to boo.",
        [
          ch(
            "Fight the cancellations in public",
            { fans: 10, attention: 8, trust: -6, tourEndChance: 0.3 },
            { set: { fought: true }, next: "it-follows-home" },
            "Rally the fans and dare the venues to say no.",
          ),
          ch("Quietly swap in friendlier cities", { cost: 6000, tourCut: 1 }, { next: "it-follows-home" }),
          ch("Drop the cities that balked", { tourCut: 2, morale: -4 }, { next: "it-follows-home" }),
        ],
        { flags: { rode: true }, context: "headlining" },
        { soon: true, lapse: 3, headline: "Promoters drop {name} dates as the feud heats up" },
      ),
      beat(
        "it-follows-home",
        4,
        "The feud follows {name} home",
        "The other camp answers with a track of their own, and it's good. Everyone is waiting to see what {name} does next.",
        [
          ch(
            "Fire back with a second track",
            { cost: 2500, fans: 18, attention: 14, trust: -6, leaveChance: 0.1 },
            { xp: 3, relation: 3 },
            "{name} loves it. The label's lawyers don't.",
          ),
          ch("Broker a public truce", { trust: 8, fans: -6, morale: -4 }, { relation: -2 }),
          ch("Let {name} decide", { morale: 6, attention: 4 }, { relation: 4 }),
        ],
        { touring: false },
        { lapse: 12 },
      ),
    ]),

    arc("wrecked-suite", { ...out, genre: "Country", context: "headlining" }, [
      beat(
        "rough-night",
        0,
        "A rough night in Cedar Falls",
        "{name} took the stage after a long afternoon at the bar. The set ran short, the words ran together and a clip is already going around.",
        [
          ch(
            "Post an apology tonight",
            { trust: 4, fans: -4, morale: -2 },
            {},
            "Own it before anyone else frames it.",
          ),
          ch("Drop a week of shows so {name} can rest", { tourCut: 1, energy: 18, morale: 4 }, {}),
          ch(
            "Laugh it off as a wild night",
            { fans: 6, attention: 8, trust: -6 },
            { set: { laughed: true }, next: "the-suite" },
          ),
        ],
        null,
        { headline: "{name} stumbles through a shortened set" },
      ),
      beat(
        "the-suite",
        1,
        "The hotel sends a bill",
        "The hotel says {name}'s suite was wrecked after the show: a broken television, a door off its hinges and an unpaid bar tab. They are talking to the police.",
        [
          ch(
            "Pay it quietly",
            { cost: 16000, trust: 2 },
            {},
            "The story ends here, if the hotel keeps quiet.",
          ),
          ch(
            "Dispute the claim",
            { trust: -10, attention: 10, tourMult: 0.8, tourEndChance: 0.25 },
            { set: { disputed: true } },
            "If it goes to court, the rest of the tour goes with it.",
          ),
          ch(
            "Make {name} pay it out of their own pocket",
            { morale: -12, trust: 4, leaveChance: 0.2 },
            { relation: -6 },
          ),
        ],
        { flags: { laughed: true }, context: "headlining" },
        { soon: true, lapse: 4, headline: "Hotel accuses {name} of trashing a suite", major: true },
      ),
    ]),

    arc("opening-act-rant", { ...out, genre: ["Pop", "R&B"], context: "headlining" }, [
      beat(
        "the-rant",
        0,
        "The opening act goes off script",
        "{name}'s opener spent ten minutes of their slot ranting at the crowd. Fans are posting that they came for {name}, not a lecture.",
        [
          ch("Drop the opener from the tour", { trust: 3, morale: -2 }, {}, "Clean, quick, a little cold."),
          ch(
            "Keep them on and sell the controversy",
            { attention: 12, trust: -5, tourMult: 1.25 },
            { set: { kept: true }, next: "walkouts" },
          ),
          ch("Have {name} address it from the stage", { fans: 6, trust: 2, energy: -6 }, { xp: 1 }),
        ],
        null,
        { headline: "Fans boo {name}'s opener after a mid-set rant" },
      ),
      beat(
        "walkouts",
        1,
        "Walkouts during the opener",
        "Half the floor now leaves for the bar when the opener starts, and some never come back. A few fans want refunds.",
        [
          ch("Cut the opener's set to two songs", { cost: 1500, trust: 2 }, {}),
          ch("Refund anyone who asks", { cost: 5000, trust: 6, fans: 4 }, {}),
          ch(
            "Do nothing and ride it out",
            { trust: -6, tourMult: 0.8, tourWeeks: 3 },
            {},
            "Some of them won't buy a ticket next time.",
          ),
        ],
        { flags: { kept: true }, context: "headlining" },
        { soon: true, lapse: 3 },
      ),
    ]),

    arc("soft-tickets", { ...out, context: "headlining", fame: { max: 70 } }, [
      beat(
        "empty-rows",
        0,
        "Empty rows on the second leg",
        "Ticket sales for the back half of {name}'s run are soft. The promoter wants an answer before more seats go unsold.",
        [
          ch("Cut the weakest dates", { tourCut: 2, morale: -4 }, {}, "Smaller tour, fewer losses."),
          ch("Paper the rooms with free tickets", { cost: 5000, fans: 8, tourMult: 1.15 }, {}),
          ch(
            "Postpone the rest, citing exhaustion",
            { energy: 25, trust: -2, tourEndChance: 0.7 },
            { set: { excuse: true }, next: "spotted-out" },
            "Fans will be sympathetic. Probably.",
          ),
        ],
        null,
        { headline: "Promoter says {name} tickets are moving slowly" },
      ),
      beat(
        "spotted-out",
        1,
        "{name} is spotted out the next night",
        'A photo of {name} laughing at an expensive restaurant, the day after cancelling for exhaustion, is everywhere. Another artist has posted it with a single word: "Really?"',
        [
          ch("Stay quiet and let it pass", { trust: -6, fans: -6 }, {}),
          ch(
            "Fire back at the other artist",
            { attention: 14, fans: 8, trust: -8, leaveChance: 0.1 },
            {},
            "Turns an embarrassment into a feud.",
          ),
          ch(
            "Have {name} explain what exhaustion means for them",
            { trust: 6, fans: 4, morale: -4 },
            { relation: 2 },
          ),
        ],
        { flags: { excuse: true } },
        { soon: true, lapse: 3, headline: "{name} out at dinner a day after cancelling", major: true },
      ),
    ]),

    // ---------------- Sharing a tour ----------------
    arc("co-headline-chill", { ...out, genre: ["R&B", "Pop"], context: "sharing" }, [
      beat(
        "backstage",
        0,
        "Trouble backstage with {partner}",
        "{name} and {partner} haven't spoken since a shouting match over who closes the show. Two dates were already pushed back while the crews sort it out.",
        [
          ch("Pay for a mediator on the road", { cost: 3000, morale: 2 }, { next: "rumours" }),
          ch(
            "Insist {name} closes the show",
            { morale: 8, attention: 6, tourMult: 0.9 },
            { set: { closing: true }, next: "rumours" },
          ),
          ch(
            "Let them settle it themselves",
            { attention: 10, tourEndChance: 0.3, leaveChance: 0.1 },
            { set: { left: true }, next: "rumours" },
            "It could clear the air, or end the tour.",
          ),
        ],
        null,
        { headline: "Shows postponed amid rumoured rift between {name} and {partner}", major: true },
      ),
      beat(
        "rumours",
        1,
        "The rumours get worse",
        "Fan accounts claim it came to blows. {name} posts a laughing photo calling the reports nonsense; {partner}'s team says nothing.",
        [
          ch("Film a joint video to settle it", { cost: 4000, trust: 6, tourMult: 1.2 }, {}),
          ch("Let {name}'s post stand", { trust: -2 }, {}),
          ch(
            "Call off the remaining dates",
            { tourEnd: true, morale: 4, fans: -10 },
            { relation: 2 },
            "Ends the arguing and the ticket money.",
          ),
        ],
        { context: "sharing" },
        { soon: true, lapse: 3 },
      ),
    ]),

    arc("band-blows-up", { ...out, genre: "Rock", context: ["headlining", "sharing"] }, [
      beat(
        "the-swing",
        0,
        "A punch on stage",
        "Three songs into the set, {name}'s singer swung at the guitarist. The show stopped, the crowd filmed everything and the band is in separate vans.",
        [
          ch(
            "Hire a session guitarist and finish the dates",
            { cost: 8000, morale: -6, tourMult: 0.9 },
            { next: "the-split" },
          ),
          ch(
            "Cancel the rest and call it a break",
            { tourEnd: true, fans: -8, energy: 20, morale: 4 },
            { set: { rested: true }, next: "the-split" },
          ),
          ch(
            "Sell it as rock and roll",
            { attention: 16, fans: 10, trust: -8, tourMult: 1.3, leaveChance: 0.15 },
            { set: { sold: true }, next: "the-split" },
            "The shows will sell. The band may not survive it.",
          ),
        ],
        null,
        { headline: "{name} show ends early after on-stage fight", major: true },
      ),
      beat(
        "the-split",
        3,
        "The band wants out",
        "With the tour behind them, {name}'s members say they can't keep working together. Unless something changes, they want to break up the band and leave the label.",
        [
          ch("Fund solo side projects to keep them", { cost: 10000, morale: 10 }, { loyalty: 6 }),
          ch("Pay for counselling and a writing retreat", { cost: 4000, morale: 4, leaveChance: 0.25 }, {}),
          ch("Let them go", { leaves: true, reputation: -2 }, {}, "The catalog stays with the label."),
          ch("Hold them to the contract", { morale: -10, leaveChance: 0.4 }, { relation: -6 }),
        ],
        { touring: false },
        { lapse: 10, headline: "Members of {name} hint at a breakup", major: true },
      ),
    ]),

    arc("stolen-encore", { ...out, context: "sharing" }, [
      beat(
        "encore",
        0,
        "{partner} takes the encore",
        "{partner} has started running long and taking the encore slot that was meant for {name}. {name}'s fans are noticing.",
        [
          ch("Have the tour manager enforce the running order", { cost: 1000, morale: 4 }, {}),
          ch(
            "Tell {name} to out-perform them",
            { energy: -10, fans: 10, tourMult: 1.15 },
            { xp: 2 },
            "A nightly battle. The crowds love it; {name} gets tired.",
          ),
          ch("Walk {name} off the tour", { tourEnd: true, morale: 6, fans: -6, trust: -2 }, { relation: 2 }),
        ],
        null,
        { headline: "{partner} steals the encore from {name}" },
      ),
    ]),

    // ---------------- Recording ----------------
    arc("the-leak", { ...out, context: "recording" }, [
      beat(
        "it-leaks",
        0,
        "The new songs leak",
        "Rough mixes from {name}'s sessions are all over the internet. Fans are already arguing about them.",
        [
          ch(
            "Say nothing and keep working",
            { morale: -3 },
            { set: { leaked: true }, next: "the-comparison" },
          ),
          ch(
            "Scrap the leaked songs and write new ones",
            { morale: -8, energy: -10 },
            { xp: 2 },
            "The album will be all new. {name} is exhausted.",
          ),
          ch(
            "Embrace it: call the leak a preview",
            { attention: 14, fans: 12, trust: -3 },
            { set: { leaked: true, embraced: true }, next: "the-comparison" },
          ),
        ],
        null,
        { headline: "Unfinished {name} songs leak online", major: true },
      ),
      beat(
        "the-comparison",
        2,
        "Fans compare the leak to the album",
        "With the album out, fans are lining up the leaked versions against the finished ones. Some say the rough mixes were better.",
        [
          ch("Ignore it", { mult: 0.85, boostWeeks: 4 }, {}, "First-week buyers already have the leak."),
          ch(
            "Release the rough mixes as a deluxe edition",
            { cost: 4000, mult: 1.2, boostWeeks: 4, fans: 6 },
            {},
          ),
          ch(
            "Have {name} call the leakers out",
            { attention: 10, trust: -4, mult: 0.9, boostWeeks: 3, morale: 4 },
            {},
          ),
        ],
        { flags: { leaked: true }, context: "albumOut" },
        { lapse: 20 },
      ),
    ]),

    arc(
      "contract-fight",
      { ...out, genre: ["R&B", "Sacred", "Rap"], context: "recording", releases: { min: 2 } },
      [
        beat(
          "the-terms",
          0,
          "{name} says the deal is unfair",
          "Between takes, {name} tells the engineer they're making the label rich and getting nothing back. They've started talking to a lawyer about who owns their masters.",
          [
            ch("Pay a goodwill bonus", { cost: 6000, morale: 10 }, { relation: 4 }),
            ch(
              "Promise better terms on the next deal",
              { morale: 4 },
              { set: { promised: true }, next: "the-letter" },
            ),
            ch(
              "Remind them what they signed",
              { morale: -10, leaveChance: 0.15 },
              { relation: -6, set: { refused: true }, next: "the-letter" },
            ),
          ],
        ),
        beat(
          "the-letter",
          4,
          "A letter from {name}'s lawyer",
          "{name}'s lawyer says the label has under-reported royalties and wants the contract ended. The press has the letter.",
          [
            ch("Settle and open the books", { cost: 20000, trust: 6, morale: 8 }, { relation: 6 }),
            ch(
              "Sue to hold them to the contract",
              { cost: 8000, reputation: -4, morale: -14, leaveChance: 0.35 },
              { relation: -8 },
              "The label could win and still lose the artist.",
            ),
            ch(
              "Let them buy their way out",
              { leaves: true, cash: 25000, reputation: -2 },
              {},
              "A clean break and a cheque.",
            ),
          ],
          { context: ["albumOut", "waiting"] },
          { lapse: 24, headline: "{name} accuses label of withholding royalties", major: true },
        ),
      ],
    ),

    arc("unapproved-song", { ...out, genre: "Sacred", context: "recording" }, [
      beat(
        "the-song",
        0,
        "{name} wants to put out a song on their own",
        "{name} wrote a song for their church's anniversary and wants to release it themselves, outside the deal. The congregation already knows the words.",
        [
          ch("Release it through the label", { cost: 2000, fans: 8, morale: 6 }, {}),
          ch("Let them put it out themselves", { morale: 8, fans: 4, labelFame: -1 }, { relation: 4 }),
          ch(
            "Block it in court",
            { cost: 5000, trust: -8, morale: -14, leaveChance: 0.25 },
            { relation: -8 },
            "The contract is on the label's side. The congregation isn't.",
          ),
        ],
        null,
        { headline: "Label moves to block {name}'s church anthem" },
      ),
    ]),

    arc("studio-blowup", { ...out, genre: ["Rap", "Rock"], context: "recording" }, [
      beat(
        "the-blowup",
        0,
        "{name} throws the producer out",
        "Three weeks into the sessions, {name} threw the producer out of the room and posted about it. The producer is posting back.",
        [
          ch("Bring in a new producer", { cost: 5000, morale: 4 }, {}),
          ch("Broker a peace", { morale: -4, trust: 2 }, {}),
          ch(
            "Let {name} produce it alone",
            { morale: 10, attention: 6, energy: -8 },
            { xp: 3 },
            "It might be their best work, or a mess.",
          ),
        ],
      ),
    ]),

    // ---------------- Album out ----------------
    arc("stream-farm", { ...out, context: "albumOut" }, [
      beat(
        "the-accusation",
        0,
        "Accused of buying streams",
        "A data blogger claims {name}'s first week was padded by fake streams from a click farm. Rival fans are sharing the charts.",
        [
          ch("Deny it and move on", { trust: -2 }, { set: { denied: true }, next: "the-chart-ruling" }),
          ch("Commission an audit and publish it", { cost: 6000, trust: 8, mult: 1.1, boostWeeks: 3 }, {}),
          ch(
            'Lean in: "the numbers are the numbers"',
            { attention: 14, fans: 6, trust: -6, mult: 1.15, boostWeeks: 3 },
            { set: { denied: true }, next: "the-chart-ruling" },
          ),
        ],
        null,
        { headline: "Blogger questions {name}'s streaming numbers" },
      ),
      beat(
        "the-chart-ruling",
        2,
        "The chart looks into it",
        "The chart company says it is reviewing {name}'s streams. If it agrees with the blogger, the album loses its position and a lot of its sales.",
        [
          ch(
            "Co-operate fully",
            { trust: 4, mult: 0.85, boostWeeks: 4 },
            {},
            "Some streams will be struck off.",
          ),
          ch(
            "Threaten to sue the chart",
            { cost: 4000, trust: -8, attention: 10, mult: 0.7, boostWeeks: 6 },
            {},
            "Loud, expensive and very likely to backfire.",
          ),
          ch("Say nothing", { mult: 0.8, boostWeeks: 4 }, {}),
        ],
        { flags: { denied: true }, context: "albumOut" },
        { soon: true, lapse: 4, headline: "Chart reviews {name}'s album sales", major: true },
      ),
    ]),

    arc("old-posts", { ...out, genre: ["Country", "Pop"], context: "albumOut" }, [
      beat(
        "they-resurface",
        0,
        "Old posts resurface",
        "In release week, someone digs up posts {name} made as a teenager. They're ugly, and they're on every music site.",
        [
          ch(
            "A full apology and a donation",
            { cost: 5000, trust: 6, fans: -4, mult: 0.9, boostWeeks: 3 },
            {},
          ),
          ch(
            "Delete them and say nothing",
            { trust: -4, mult: 0.85, boostWeeks: 4 },
            { set: { silent: true }, next: "radio" },
          ),
          ch(
            "Stand by {name}: people change",
            { fans: 8, trust: -10, attention: 10, mult: 0.75, boostWeeks: 5 },
            { set: { defended: true }, next: "radio" },
            "Their core fans rally. Everyone else might not.",
          ),
        ],
        null,
        { headline: "{name}'s old posts resurface in release week", major: true },
      ),
      beat(
        "radio",
        2,
        "Radio pulls the single",
        "Two big radio groups have dropped {name}'s single from rotation. The program directors want a statement before they'll play it again.",
        [
          ch("Arrange a sit-down interview", { cost: 3000, trust: 6, mult: 1.1, boostWeeks: 3 }, {}),
          ch("Promote straight to fans online", { cost: 2000, fans: 6, mult: 0.95, boostWeeks: 3 }, {}),
          ch(
            "Tell {name} to take a step back",
            { morale: -10, trust: 4, leaveChance: 0.1 },
            { relation: -4 },
          ),
        ],
        { context: ["albumOut", "waiting"] },
        { soon: true, lapse: 4 },
      ),
    ]),

    arc(
      "same-week-drop",
      { ...out, context: "albumOut", genre: ["Pop", "Rap", "R&B"] },
      [
        beat(
          "the-drop",
          0,
          "{rival} drops a surprise album",
          "{rival} has put out their biggest star's album with no warning, in {name}'s second week. The first-day numbers are huge.",
          [
            ch("Stay the course", { mult: 0.9, boostWeeks: 3 }, {}),
            ch(
              "Answer with a deluxe edition this week",
              { cost: 5000, mult: 1.2, boostWeeks: 3, energy: -8 },
              {},
            ),
            ch(
              "Have {name} take a shot at them",
              { attention: 12, fans: 8, trust: -4, mult: 1.15, boostWeeks: 3 },
              { rival: -10 },
              "Free press, and a new enemy.",
            ),
          ],
          null,
          { headline: "{rival} surprise release lands on {name}'s chart run" },
        ),
      ],
      { rival: true },
    ),

    // ---------------- Waiting to record ----------------
    arc("cryptic-posts", { ...out, context: "waiting", morale: { max: 70 } }, [
      beat(
        "the-posts",
        0,
        '{name} posts "I\'m done"',
        "With nothing booked, {name} has been posting cryptic messages about quitting music. Fans are worried; other labels are curious.",
        [
          ch("Take {name} to dinner and listen", { cost: 800, morale: 8 }, { relation: 4 }),
          ch("Book them a writing trip", { cost: 4000, morale: 12, energy: 10 }, {}),
          ch(
            "Let them vent",
            { morale: -4, attention: 6, leaveChance: 0.1 },
            { set: { ignored: true }, next: "the-announcement" },
          ),
        ],
      ),
      beat(
        "the-announcement",
        3,
        "{name} announces a break",
        '{name} tells fans they\'re stepping away from music "for a while". Two other labels have already called their manager.',
        [
          ch("Give them all the time they need", { morale: 10, fans: -6 }, { loyalty: 6 }),
          ch("Offer a new deal on better terms", { cost: 10000, morale: 12, leaveChance: 0.1 }, {}),
          ch(
            "Call their bluff",
            { morale: -8, leaveChance: 0.45 },
            { relation: -6 },
            "If it's a bluff, they'll be back. If it isn't, they're gone.",
          ),
        ],
        { flags: { ignored: true }, context: "waiting" },
        { lapse: 8, headline: "{name} says they are stepping away from music", major: true },
      ),
    ]),

    arc(
      "rival-dinner",
      { ...out, context: "waiting", genre: ["Sacred", "Country", "Rock"] },
      [
        beat(
          "the-dinner",
          0,
          "{name} is seen dining with {rival}",
          "A photo of {name} at dinner with {rivalCeo} of {rival} is making the rounds. {name} says it was just dinner.",
          [
            ch("Ask {name} straight out", { morale: -2, trust: 2 }, {}),
            ch("Get {name} into the studio as soon as you can", { cost: 2500, morale: 6 }, {}),
            ch("Say nothing and watch", {}, { set: { watching: true }, next: "the-offer" }),
          ],
        ),
        beat(
          "the-offer",
          2,
          "{rival} makes an offer",
          "{rival} has offered {name} a bigger advance and a share of their masters. {name} wants to know if the label will match it.",
          [
            ch("Match it", { cost: 15000, morale: 14 }, { loyalty: 8, rival: -6 }),
            ch("Make a smaller counter-offer", { cost: 5000, morale: 4, leaveChance: 0.35 }, {}),
            ch("Wish them well", { leaves: true, reputation: -1 }, { rival: 4 }, "No bidding war."),
          ],
          { flags: { watching: true }, context: "waiting" },
          { lapse: 6, headline: "{rival} moves to sign {name}", major: true },
        ),
      ],
      { rival: true },
    ),

    arc("family-first", { ...out, context: "waiting", genre: ["Pop", "Country", "Sacred"] }, [
      beat(
        "home",
        0,
        "{name} wants to be home",
        "{name} has a young family and says the next record and tour feel like too much right now. They want to slow down.",
        [
          ch("Give them a lighter year", { morale: 12, energy: 15, fans: -4 }, { loyalty: 6 }),
          ch("Build the next record around home", { cost: 2000, morale: 6 }, { xp: 1 }),
          ch("Ask them to keep to the plan", { morale: -10, leaveChance: 0.25 }, { relation: -4 }),
        ],
      ),
    ]),

    // ---------------- Stars who want more ----------------
    arc("own-imprint", { ...out, tier: "superstar", context: ["albumOut", "waiting"] }, [
      beat(
        "the-pitch",
        0,
        "{name} wants their own imprint",
        "{name} arrives with a logo, a name and two young acts they want to sign. They want their own imprint inside {label}, or they want out.",
        [
          ch(
            "Give them the imprint",
            { cost: 25000, morale: 14, labelFame: 3 },
            { relation: 8, loyalty: 6 },
            "Their name on the door, your money behind it.",
          ),
          ch("Offer a profit share instead", { cost: 8000, morale: 4, leaveChance: 0.2 }, { relation: 2 }),
          ch(
            "Tell them the label has one name on it",
            { morale: -12, leaveChance: 0.35 },
            { relation: -8, set: { refused: true }, next: "the-walkout" },
          ),
        ],
        null,
        { headline: "{name} pushes {label} for an imprint of their own", major: true },
      ),
      beat(
        "the-walkout",
        3,
        "{name} skips the label's showcase",
        "{name} didn't turn up to {label}'s showcase, and posted from a rival's party instead. Their manager says they are weighing their options.",
        [
          ch("Reopen the imprint talks", { cost: 15000, morale: 10 }, { relation: 6 }),
          ch(
            "Fine them for missing the showcase",
            { cash: 5000, morale: -10, leaveChance: 0.4 },
            { relation: -6 },
          ),
          ch("Let it blow over", { morale: -2, leaveChance: 0.2 }, {}),
        ],
        { flags: { refused: true }, context: ["albumOut", "waiting"] },
        { lapse: 10, headline: "{name} seen at a rival label's party", major: true },
      ),
    ]),

    arc("bigger-check", { ...out, tier: "star", context: ["albumOut", "waiting"], hit: true }, [
      beat(
        "the-numbers",
        0,
        "{name} has seen the numbers",
        "After a hit, {name} has worked out what the label made from it, and what they got. They want a bigger share of the next one.",
        [
          ch("Raise their bonus", { cost: 10000, morale: 12 }, { relation: 4, loyalty: 4 }),
          ch("Promise a bigger push for the next record", { morale: 2, leaveChance: 0.15 }, {}),
          ch(
            "Point at the contract",
            { morale: -10, leaveChance: 0.3 },
            { relation: -6 },
            "They signed it. They may not stay for the next one.",
          ),
        ],
        null,
        { headline: "{name} says the label owes them more" },
      ),
    ]),
  ];

  const data = { STORY_CONTEXT, CONTEXT_ARCS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
