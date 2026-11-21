// Story pack: artists (3.0, T55). Each authored artist's own arc, plus general arcs any artist can
// walk into: debuts, rivalries, family, legal trouble, comebacks and collaborations.
// See src/data/stories.js for how arcs, beats, conditions and choices work.
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
  const castArc = (id, start, beats) => ({ id, who: "cast", start, beats });
  const anyArc = (id, start, beats) => ({ id, who: "artist", start, beats });
  const debuted = { releases: { min: 1 } };

  const ARTIST_ARCS = [
    // ---------------- Rap ----------------
    castArc("block-to-booth", debuted, [
      beat(
        "old-crew",
        0,
        "{name}'s old crew comes calling",
        "The guys from the car wash want a cut of {name}'s advance. They helped sell the first tapes, and they remember.",
        [
          ch(
            "Pay them off once",
            { cost: 2000, morale: 4 },
            { set: { paid: true }, next: "the-favour" },
            "A clean break, if they keep their word.",
          ),
          ch(
            "Tell {name} to cut ties",
            { morale: -6, trust: -3 },
            { set: { paid: false }, next: "the-favour" },
          ),
          ch(
            "Put them on the team as runners",
            { morale: 6, attention: 6 },
            { loyalty: 6, set: { hired: true }, next: "the-favour" },
          ),
        ],
      ),
      beat(
        "the-favour",
        10,
        "The crew asks a favour",
        "One of the old crew needs {name} at a block party on the night of a radio interview.",
        [
          ch(
            "Do the block party",
            { fans: 8, attention: -6 },
            { loyalty: 4 },
            "The neighbourhood will not forget it.",
          ),
          ch("Do the interview", { artistFame: 4, morale: -4 }, { xp: 2 }),
        ],
      ),
    ]),
    castArc("the-record", debuted, [
      beat(
        "transcript",
        0,
        "An old transcript surfaces",
        "A lawyer calls {name}: a friend's appeal hangs on a transcript {name} typed years ago. They need a statement.",
        [
          ch(
            "Give the statement",
            { morale: 5, attention: 8, trust: 4 },
            { set: { helped: true }, next: "verse" },
            "It will cost studio time.",
          ),
          ch("Stay out of it", { morale: -6 }, { set: { helped: false }, next: "verse" }),
        ],
      ),
      beat(
        "verse",
        8,
        "{name} wants to write about the case",
        "{name} has a verse about the courtroom that names nobody and says everything.",
        [
          ch("Make it the single", { fans: 10, trust: -3 }, { xp: 3 }, "Some listeners will not like it."),
          ch("Keep it for the deep cuts", { morale: -2 }, { xp: 1 }),
        ],
      ),
    ]),
    castArc("ghost-credits", debuted, [
      beat(
        "liner-notes",
        0,
        "{name} wants the old credits back",
        "{name} wrote three hits for a star who never credited him. He wants to say so on the radio.",
        [
          ch(
            "Back him on air",
            { artistFame: 6, trust: -4, attention: 10 },
            { set: { public: true }, next: "lawyers" },
          ),
          ch(
            "Settle it quietly",
            { cost: 3000, morale: 3 },
            { set: { public: false }, next: "lawyers" },
            "Lawyers first, microphones never.",
          ),
        ],
      ),
      beat(
        "lawyers",
        10,
        "The star's lawyers reply",
        "The star's people offer {name} a credit on the next reissue, if he signs a promise to stop talking.",
        [
          ch("Sign it", { cash: 5000, morale: -4 }, {}),
          ch("Refuse and keep talking", { fans: 10, trust: -5 }, { loyalty: 3 }, "The fans love a fight."),
        ],
        { fame: { min: 30 } },
      ),
    ]),
    castArc("two-homes", debuted, [
      beat(
        "old-label",
        0,
        "A label overseas says {name} owes them",
        "{name}'s first label back home claims an unfinished contract and wants one more album.",
        [
          ch(
            "Buy out the old contract",
            { cost: 8000, morale: 6 },
            { set: { free: true }, next: "homecoming" },
          ),
          ch(
            "Fight it in court",
            { cost: 3000, trust: -4 },
            { set: { free: false }, next: "homecoming" },
            "It may drag on.",
          ),
          ch(
            "Ignore the claim",
            { morale: -6, trust: -6 },
            { relation: -4, next: "homecoming" },
            "The papers back home will run with it.",
          ),
        ],
      ),
      beat(
        "homecoming",
        12,
        "A homecoming show",
        "A stadium back home wants {name} for a festival headline slot, in the same week as your launch plans.",
        [
          ch("Send her home to headline", { fans: 14, energy: -20 }, { relation: 6, xp: 3 }),
          ch("Keep her here for the launch", { attention: 10, morale: -6 }, { relation: -4 }),
        ],
      ),
    ]),

    // ---------------- R&B ----------------
    castArc("two-stages", debuted, [
      beat(
        "found-out",
        0,
        "{name}'s mother hears about the lounge",
        "Someone from church saw {name} singing at the lounge. Her mother is waiting at home.",
        [
          ch("Go with her to talk to her mother", { morale: 6, energy: -5 }, { loyalty: 6, next: "sunday" }),
          ch("Let her handle it herself", { morale: -4 }, { next: "sunday" }),
        ],
      ),
      beat(
        "sunday",
        8,
        "A Sunday solo",
        "The choir has asked {name} to sing a solo on Sunday, the same morning as a photo shoot.",
        [
          ch("Move the shoot", { cost: 1000, morale: 8, trust: 3 }, {}),
          ch("Keep the shoot", { attention: 8, morale: -5 }, {}),
        ],
      ),
    ]),
    castArc("day-job", { releases: { min: 0 } }, [
      beat(
        "holiday-rush",
        0,
        "The bakery wants {name} back",
        "The bakery's holiday rush starts next week. The owner gave {name} his first stage, a counter by the till.",
        [
          ch("Let him go back for the rush", { energy: -10, fans: 5, morale: 6 }, { next: "pastry-promo" }),
          ch("Keep him in the studio", { morale: -6 }, { xp: 2, next: "pastry-promo" }),
        ],
      ),
      beat(
        "pastry-promo",
        10,
        "A cake named after the single",
        "The bakery wants to name a cake after {name}'s single and sell it with the record.",
        [
          ch("Do it", { fans: 8, cash: 1200 }, {}, "Sweet and very local."),
          ch("Keep the music serious", { morale: -2, trust: 2 }, {}),
        ],
        debuted,
      ),
    ]),
    castArc("backing-no-more", debuted, [
      beat(
        "old-boss",
        0,
        "{name}'s old boss calls",
        "The star {name} used to sing behind wants her back on tour, at triple pay, for a summer.",
        [
          ch(
            "Tell her it's her call",
            { morale: 5 },
            { loyalty: 4, set: { offered: true }, next: "spotlight" },
          ),
          ch("Remind her of her contract", { morale: -8 }, { loyalty: -4, next: "spotlight" }),
        ],
      ),
      beat(
        "spotlight",
        8,
        "{name} takes the solo",
        "At a festival, {name} is asked to sing a verse on someone else's set. The crowd knows her voice but not her name.",
        [
          ch("Make sure they announce her name", { artistFame: 6, attention: 8 }, { xp: 2 }),
          ch("Let the moment speak for itself", { fans: 6, morale: 4 }, {}),
        ],
      ),
    ]),
    castArc("child-star", debuted, [
      beat(
        "reunion",
        0,
        "The sitcom reunion",
        "The old sitcom is filming a reunion special and wants {name} to sing the theme song.",
        [
          ch(
            "Do it, with a new arrangement",
            { fans: 12, trust: -3 },
            { set: { reunion: true }, next: "critics" },
            "Nostalgia sells.",
          ),
          ch("Turn it down", { morale: 4, attention: -6 }, { set: { reunion: false }, next: "critics" }),
        ],
      ),
      beat(
        "critics",
        10,
        "The critics on {name}",
        "A review calls {name} 'still a child star in a grown man's suit'. He has read it twelve times.",
        [
          ch("Book a serious interview", { trust: 5, artistFame: 3 }, { xp: 2 }),
          ch("Answer the critic online", { attention: 10, trust: -6 }, { relation: -3 }),
        ],
        { fame: { min: 25 } },
      ),
    ]),
    castArc("quiet-life", debuted, [
      beat(
        "photographers",
        0,
        "Photographers at the school gate",
        "Photographers found {name}'s daughter's school. {name} is furious and frightened.",
        [
          ch("Hire private security", { cost: 4000, morale: 8 }, { relation: 8, next: "statement" }),
          ch("Ask the press to back off, politely", { morale: -4, trust: 3 }, { next: "statement" }),
        ],
      ),
      beat(
        "statement",
        8,
        "{name} wants to step back",
        "{name} asks to skip all promotion for the next album. No interviews, no shows, just the record.",
        [
          ch("Agree", { morale: 10, attention: -10 }, { loyalty: 6, relation: 6 }),
          ch("Ask for one interview", { morale: -6, attention: 6 }, { relation: -4 }),
        ],
      ),
    ]),

    // ---------------- Pop ----------------
    castArc("family-manager", { releases: { min: 0 } }, [
      beat(
        "big-brother",
        0,
        "{name}'s brother wants a title",
        "{name}'s sixteen-year-old brother has been managing her from a school laptop. He wants a title and a salary.",
        [
          ch("Make him assistant manager", { cost: 1500, morale: 8 }, { loyalty: 5, next: "his-idea" }),
          ch(
            "Put a real manager in charge",
            { morale: -6 },
            { next: "his-idea" },
            "He will sulk for a while.",
          ),
        ],
      ),
      beat(
        "his-idea",
        8,
        "The brother has a plan",
        "{name}'s brother wants to film a dance challenge for the single in their school gym.",
        [
          ch("Let them film it", { fans: 10, attention: 8 }, {}, "It might go nowhere."),
          ch("Hire a director instead", { cost: 2000, attention: 12, morale: -3 }, {}),
        ],
      ),
    ]),
    castArc("band-split", debuted, [
      beat(
        "one-voice",
        0,
        "Only one of {name} gets the calls",
        "Every interview request names the lead singer of {name}. The other three have noticed.",
        [
          ch(
            "Insist on group interviews",
            { attention: -6, morale: 6 },
            { loyalty: 5, set: { together: true }, next: "solo-offer" },
          ),
          ch(
            "Let the singer take them",
            { artistFame: 5, morale: -6 },
            { set: { together: false }, next: "solo-offer" },
          ),
        ],
      ),
      beat(
        "solo-offer",
        12,
        "A solo offer for {name}'s singer",
        "A rival label has offered the lead singer a solo deal. The band wants to know where you stand.",
        [
          ch("Stand by the band", { morale: 8, trust: 4 }, { loyalty: 6 }),
          ch("Offer the singer a side project", { fans: 6, morale: -8 }, { loyalty: -6 }),
        ],
        { flags: { together: false } },
      ),
    ]),
    castArc("crew-loyalty", debuted, [
      beat(
        "the-video",
        0,
        "{name}'s old crew wants the video",
        "{name}'s dance crew asks to be in the new video. The director wants professional dancers.",
        [
          ch("Put the crew in", { morale: 8, fans: 6 }, { loyalty: 6, next: "battle" }),
          ch("Go with the professionals", { attention: 10, morale: -6 }, { next: "battle" }),
        ],
      ),
      beat(
        "battle",
        8,
        "A dance battle challenge",
        "A rival crew challenges {name} to a battle on the same night as a TV taping.",
        [
          ch("Take the battle", { fans: 10, energy: -10 }, { xp: 2 }),
          ch("Do the TV taping", { artistFame: 5, morale: -3 }, {}),
        ],
      ),
    ]),
    castArc("perfectionist", debuted, [
      beat(
        "not-done",
        0,
        "{name} says the record isn't finished",
        "Two weeks before release, {name} wants to re-record every vocal. 'It isn't right yet.'",
        [
          ch("Give her the time", { cost: 3000, morale: 8 }, { set: { patient: true }, next: "the-set" }),
          ch("Ship it as it is", { morale: -8, trust: -2 }, { set: { patient: false }, next: "the-set" }),
        ],
      ),
      beat(
        "the-set",
        10,
        "{name}'s stage set",
        "{name} has designed a stage set that would make the tour unforgettable, and very expensive.",
        [
          ch("Build it", { cost: 6000, fans: 12, attention: 10 }, { xp: 3 }),
          ch("Build half of it", { cost: 2500, fans: 5, morale: -3 }, {}),
          ch("Tour with the old set", { morale: -8 }, { loyalty: -3 }),
        ],
      ),
    ]),
    castArc("flight-risk", debuted, [
      beat(
        "whispers",
        0,
        "Rivals are circling {name}",
        "Three labels have sent {name} flowers this week. Her contract is not up yet, but everyone can count.",
        [
          ch("Show her she matters here", { cost: 6000, morale: 10 }, { relation: 10, next: "the-offer" }),
          ch("Let the contract speak", { morale: -4 }, { relation: -6, next: "the-offer" }),
        ],
      ),
      beat(
        "the-offer",
        12,
        "{name} has an offer in writing",
        "{name} shows you a rival's offer: bigger advance, her own imprint. She wants to know what you'll do.",
        [
          ch(
            "Give her an imprint here",
            { cost: 12000, morale: 10, trust: 4 },
            { relation: 12, loyalty: 10 },
          ),
          ch("Wish her luck and mean it", { morale: 4 }, { relation: 4, loyalty: -4 }),
          ch("Threaten to hold her to every album", { morale: -10, trust: -6 }, { relation: -15 }),
        ],
        { fame: { min: 40 } },
      ),
    ]),

    // ---------------- Country ----------------
    castArc("home-farm", { releases: { min: 0 } }, [
      beat(
        "harvest",
        0,
        "Harvest at the Pell farm",
        "{name}'s father has hurt his back and harvest starts Monday. {name} is already packing.",
        [
          ch(
            "Give him three weeks off",
            { energy: 15, morale: 10, attention: -8 },
            { loyalty: 6, next: "barn-show" },
          ),
          ch("Pay for farm hands instead", { cost: 2500, morale: 4 }, { next: "barn-show" }),
        ],
      ),
      beat(
        "barn-show",
        8,
        "A show in the barn",
        "After the harvest the town wants {name} to play in the old barn, like he used to.",
        [
          ch("Play it and record it", { fans: 8, morale: 6 }, { xp: 2 }, "Could be a live album one day."),
          ch("Send him straight back to work", { attention: 4, morale: -5 }, {}),
        ],
      ),
    ]),
    castArc("small-town", debuted, [
      beat(
        "recognised",
        0,
        "The town hears itself in {name}'s songs",
        "A woman from {name}'s town is sure the new ballad is about her. She has called the local paper.",
        [
          ch("Stand by the song", { attention: 10, trust: -3 }, { set: { stood: true }, next: "town-hall" }),
          ch("Change a line for the album", { morale: -6 }, { set: { stood: false }, next: "town-hall" }),
        ],
      ),
      beat(
        "town-hall",
        10,
        "The town hall wants a show",
        "The town has decided it is proud of {name} after all. They want a free show on the square.",
        [ch("Do the show", { fans: 10, morale: 8, energy: -8 }, {}), ch("Not yet", { morale: -2 }, {})],
      ),
    ]),
    castArc("last-ride", debuted, [
      beat(
        "one-season",
        0,
        "The rodeo wants {name} back",
        "The circuit has offered {name} one last season on the bulls. He wants to say yes.",
        [
          ch(
            "Forbid it in the contract",
            { morale: -10 },
            { loyalty: -5, set: { rode: false }, next: "the-buckle" },
          ),
          ch(
            "Let him ride, insured",
            { cost: 3000, morale: 10, fans: 6 },
            { set: { rode: true }, next: "the-buckle" },
          ),
        ],
      ),
      beat(
        "the-buckle",
        12,
        "{name} wins a buckle",
        "{name} came off a bull with a bruised rib and a championship buckle. The press loves him.",
        [
          ch("Make it the album cover", { artistFame: 6, fans: 8 }, { xp: 2 }),
          ch("Make him rest before the tour", { energy: 20, attention: -4 }, {}),
        ],
        { flags: { rode: true } },
      ),
    ]),
    castArc("sister-feud", debuted, [
      beat(
        "solo-sister",
        0,
        "One of {name} wants to go solo",
        "The youngest Lacey sister has written songs her sisters won't sing. She wants a solo record.",
        [
          ch(
            "Back the solo record",
            { cost: 4000, morale: -6, fans: 6 },
            { set: { solo: true }, next: "christmas" },
          ),
          ch("Keep the harmony together", { morale: 4 }, { set: { solo: false }, next: "christmas" }),
        ],
      ),
      beat(
        "christmas",
        12,
        "A family Christmas special",
        "A TV network wants {name} for a Christmas special. The sisters haven't spoken in weeks.",
        [
          ch("Get them in a room together", { morale: 8, fans: 10 }, { loyalty: 6, xp: 2 }),
          ch("Do it with two sisters", { morale: -8, attention: 8 }, { loyalty: -4 }),
        ],
      ),
    ]),
    castArc("famous-father", debuted, [
      beat(
        "the-tapes",
        0,
        "The old tapes",
        "{name}'s father's estate has found unreleased tapes and wants a father-and-son duet.",
        [
          ch(
            "Make the duet",
            { fans: 14, morale: -8 },
            { relation: -6, set: { duet: true }, next: "the-fans" },
            "He never wanted to sing with his father.",
          ),
          ch(
            "Let {name} refuse",
            { morale: 8, attention: -6 },
            { relation: 6, set: { duet: false }, next: "the-fans" },
          ),
        ],
      ),
      beat(
        "the-fans",
        10,
        "His father's fans",
        "At a festival, a section of the crowd chants for his father's songs. {name} stops the show.",
        [
          ch("Back him in the press", { trust: 4, morale: 6 }, { relation: 8, loyalty: 4 }),
          ch("Ask him to play one of the old songs next time", { fans: 8, morale: -8 }, { relation: -8 }),
        ],
      ),
    ]),

    // ---------------- Sacred ----------------
    castArc("choir-home", debuted, [
      beat(
        "congregation",
        0,
        "The congregation is worried",
        "The church board fears {name} will leave the choir for the road. They have asked to meet the label.",
        [
          ch(
            "Promise she'll lead Sunday service",
            { morale: 8, energy: -5 },
            { loyalty: 6, next: "choir-record" },
          ),
          ch("Tell them the record comes first", { morale: -6, attention: 6 }, { next: "choir-record" }),
        ],
      ),
      beat(
        "choir-record",
        10,
        "The choir wants to sing on the record",
        "Forty voices would like to sing on {name}'s next record. They will sing for lunch.",
        [
          ch("Bring them in", { cost: 1200, fans: 10, morale: 8 }, { xp: 2 }),
          ch("Keep the record lean", { morale: -4 }, {}),
        ],
      ),
    ]),
    castArc("crossover", debuted, [
      beat(
        "radio-edit",
        0,
        "Pop radio wants a cleaner {name}",
        "A pop station will play {name}'s single if he swaps the word 'grace' for 'love'.",
        [
          ch(
            "Make the radio edit",
            { fans: 12, morale: -8, trust: -3 },
            { set: { edited: true }, next: "camp" },
          ),
          ch("Keep the words", { morale: 8, attention: -6 }, { set: { edited: false }, next: "camp" }),
        ],
      ),
      beat(
        "camp",
        10,
        "A summer camp invitation",
        "The camps where {name}'s songs started want him back for a week, unpaid.",
        [
          ch("Send him", { energy: -10, fans: 10, morale: 6 }, { loyalty: 5 }),
          ch("Keep him on promotion", { attention: 8, morale: -4 }, {}),
        ],
      ),
    ]),
    castArc("night-shift", debuted, [
      beat(
        "the-ward",
        0,
        "The hospital needs an answer",
        "The hospital will hold {name}'s nursing job for one more month. After that, it's gone.",
        [
          ch("Encourage her to keep both", { energy: -15, morale: 4 }, { loyalty: 4, next: "benefit" }),
          ch("Offer a bonus to go full time", { cost: 2500, morale: 6 }, { next: "benefit" }),
        ],
      ),
      beat(
        "benefit",
        10,
        "A benefit concert for the ward",
        "Her old ward needs new equipment. {name} wants to play a benefit concert.",
        [
          ch("Put on the concert", { cost: 2000, fans: 10, trust: 6 }, { xp: 2 }),
          ch("Donate quietly", { cost: 3000, morale: 6, reputation: 2 }, {}),
          ch("Not this year", { morale: -5 }, {}),
        ],
      ),
    ]),
    castArc("empty-mic", debuted, [
      beat(
        "the-tenor",
        0,
        "The missing brother returns",
        "The tenor who left {name} years ago is at the stage door, asking for his place back.",
        [
          ch(
            "Give him the empty microphone",
            { morale: 6, fans: 8 },
            { set: { back: true }, next: "harmony" },
          ),
          ch(
            "Keep the microphone empty",
            { morale: -6, trust: 3 },
            { set: { back: false }, next: "harmony" },
          ),
        ],
      ),
      beat(
        "harmony",
        10,
        "Four-part harmony again",
        "With the tenor back, {name} sound like they did twenty years ago. A gospel festival wants them.",
        [
          ch("Headline the festival", { fans: 12, energy: -10 }, { xp: 3 }),
          ch("Record first, play later", { morale: 4 }, { xp: 2 }),
        ],
        { flags: { back: true } },
      ),
    ]),
    castArc("farewell-tour", debuted, [
      beat(
        "family-asks",
        0,
        "{name}'s family asks her to stop touring",
        "{name}'s children have asked the label to cut her touring. She hasn't asked for anything.",
        [
          ch(
            "Plan a short farewell tour",
            { morale: 6, fans: 10 },
            { relation: 6, set: { farewell: true }, next: "last-night" },
          ),
          ch("Leave it to her", { morale: 2 }, { set: { farewell: false }, next: "last-night" }),
        ],
      ),
      beat(
        "last-night",
        12,
        "The last night",
        "Twenty thousand people are singing {name}'s songs back to her. She wants to say something.",
        [
          ch("Give her the stage as long as she wants", { fans: 14, morale: 10 }, { relation: 8, xp: 3 }),
          ch("Keep to the schedule", { morale: -6 }, { relation: -4 }),
        ],
        { flags: { farewell: true } },
      ),
    ]),

    // ---------------- Rock ----------------
    castArc("garage-band", { releases: { min: 0 } }, [
      beat(
        "school-first",
        0,
        "{name}'s parents call",
        "The parents of {name} want the band home by ten and passing every class, or no more shows.",
        [
          ch("Agree to their rules", { morale: -6, trust: 4 }, { loyalty: 6, next: "graduation" }),
          ch("Hire a tutor for the road", { cost: 1500, morale: 6 }, { next: "graduation" }),
        ],
      ),
      beat(
        "graduation",
        12,
        "Graduation night",
        "{name} graduated this week. The school wants them to play the ceremony.",
        [
          ch("Play the ceremony", { fans: 8, morale: 10 }, { xp: 2 }),
          ch("Book a real club instead", { attention: 8, morale: -2 }, {}),
        ],
      ),
    ]),
    castArc("bandmates", debuted, [
      beat(
        "fired-again",
        0,
        "{name} has fired her drummer",
        "{name} fired her drummer in the middle of soundcheck. The tour starts in nine days.",
        [
          ch("Find her a session drummer", { cost: 1500, morale: 4 }, { next: "the-drummer" }),
          ch("Make her rehire him", { morale: -8, trust: 3 }, { loyalty: -3, next: "the-drummer" }),
        ],
      ),
      beat(
        "the-drummer",
        10,
        "The drummer talks",
        "The fired drummer has given an interview about what {name} is like to work with.",
        [
          ch("Let her answer with a song", { fans: 8, attention: 10 }, { xp: 2 }),
          ch("Keep quiet", { trust: -4 }, {}),
        ],
      ),
    ]),
    castArc("hometown", debuted, [
      beat(
        "the-plant",
        0,
        "The last plant is closing",
        "The factory in {name}'s hometown is closing. The town wants a benefit show.",
        [
          ch("Play the benefit", { cost: 2000, fans: 10, trust: 6 }, { loyalty: 6, next: "anthem" }),
          ch("Send a donation", { cost: 1000, morale: -3 }, { next: "anthem" }),
          ch("Stay out of it", { morale: -8, trust: -3 }, { loyalty: -4, next: "anthem" }),
        ],
      ),
      beat(
        "anthem",
        10,
        "The town's anthem",
        "A song {name} wrote about the plant has become the town's anthem. A truck company wants it for an advert.",
        [
          ch("License it", { cash: 6000, trust: -6, morale: -4 }, {}, "The town may not like it."),
          ch("Keep it for the town", { morale: 6, trust: 4 }, { loyalty: 3 }),
        ],
      ),
    ]),
    castArc("orchestra", debuted, [
      beat(
        "gala",
        0,
        "The orchestra wants {name} back",
        "The orchestra {name} walked out on wants her for a gala, playing their programme, in a gown.",
        [
          ch(
            "She plays it her way or not at all",
            { attention: 10, trust: -3 },
            { set: { herWay: true }, next: "the-review" },
          ),
          ch(
            "Play their programme",
            { morale: -8, trust: 4 },
            { set: { herWay: false }, next: "the-review" },
          ),
        ],
      ),
      beat(
        "the-review",
        8,
        "The gala reviews",
        "The papers can't agree whether {name}'s gala was a disgrace or the best night in the hall's history.",
        [
          ch("Release the recording", { fans: 12, artistFame: 4 }, { xp: 3 }),
          ch("Let the argument run", { attention: 10 }, {}),
        ],
      ),
    ]),
    castArc("comeback", debuted, [
      beat(
        "the-lawsuit",
        0,
        "{name}'s old bassist sues",
        "{name}'s old bassist says he co-wrote the hits and wants twenty years of royalties.",
        [
          ch("Settle", { cost: 6000, morale: -4 }, { next: "one-more" }),
          ch(
            "Fight it",
            { cost: 2500, trust: -5, attention: 8 },
            { set: { fought: true }, next: "one-more" },
          ),
          ch("Let {name} pay it himself", { morale: -10 }, { relation: -8, next: "one-more" }),
        ],
      ),
      beat(
        "one-more",
        12,
        "One more comeback",
        "{name} wants to play the club where it all started, unannounced, on a Tuesday.",
        [
          ch("Let him", { fans: 10, morale: 10 }, { relation: 6, xp: 2 }),
          ch("Make it a ticketed event", { cash: 4000, morale: -4 }, { relation: -3 }),
        ],
      ),
    ]),

    // ---------------- Any artist ----------------
    anyArc("debut-nerves", { releases: { max: 0 }, morale: { max: 70 } }, [
      beat(
        "cold-feet",
        0,
        "{name} has cold feet",
        "{name} hasn't slept. What if the first record flops and everyone at home was right?",
        [
          ch("Take them to dinner and listen", { morale: 8 }, { loyalty: 4, next: "release-week" }),
          ch("Show them the numbers on other debuts", { morale: 3 }, { xp: 1, next: "release-week" }),
        ],
      ),
      beat(
        "release-week",
        6,
        "Release week for {name}",
        "{name}'s first record is out. They keep refreshing the chart page.",
        [
          ch("Throw a release party", { cost: 800, morale: 8, fans: 4 }, {}),
          ch("Get them back to work", { morale: -2 }, { xp: 2 }),
        ],
        { releases: { min: 1 } },
      ),
    ]),
    anyArc("legal-trouble", { fame: { min: 40 }, releases: { min: 2 } }, [
      beat(
        "the-summons",
        0,
        "A summons for {name}",
        "A producer {name} worked with before the label says they're owed points on two songs.",
        [
          ch("Settle out of court", { cost: 4000, morale: 3 }, { next: "the-ruling" }),
          ch("Fight it", { cost: 1500, trust: -4 }, { set: { fought: true }, next: "the-ruling" }),
          ch("Leave {name} to their own lawyer", { morale: -8 }, { loyalty: -5 }),
        ],
      ),
      beat(
        "the-ruling",
        10,
        "The ruling",
        "The judge has ruled for {name}. The producer is talking to reporters outside the courthouse.",
        [
          ch("Release a gracious statement", { trust: 6 }, {}),
          ch("Let {name} gloat a little", { fans: 6, trust: -4, morale: 6 }, {}),
        ],
        { flags: { fought: true } },
      ),
    ]),
    anyArc("collab-offer", { hit: true, fame: { min: 45 } }, [
      beat(
        "the-feature",
        0,
        "A feature for {name}",
        "A big name from another label wants {name} on their next single.",
        [
          ch(
            "Say yes",
            { fans: 12, attention: 8, energy: -10 },
            { xp: 3, set: { featured: true }, next: "the-return" },
          ),
          ch("Keep {name} exclusive", { morale: -4 }, { next: "the-return" }),
        ],
      ),
      beat(
        "the-return",
        10,
        "The favour returned",
        "The big name offers to return the favour and sing on {name}'s next record, for a fee.",
        [
          ch("Pay for the verse", { cost: 5000, fans: 10, artistFame: 5 }, {}),
          ch("Keep it in the family", { morale: 3 }, {}),
        ],
        { flags: { featured: true } },
      ),
    ]),
    anyArc("comeback-trail", { releases: { min: 2 }, fame: { max: 25 }, morale: { max: 55 } }, [
      beat(
        "forgotten",
        0,
        "{name} feels forgotten",
        "{name}'s last two records went nowhere. They ask you, quietly, if they still have a future here.",
        [
          ch(
            "Promise them a proper push",
            { morale: 10 },
            { loyalty: 6, set: { promised: true }, next: "small-room" },
          ),
          ch("Be honest about the numbers", { morale: -4, trust: 2 }, { next: "small-room" }),
        ],
      ),
      beat(
        "small-room",
        8,
        "A small room, packed",
        "{name} played a tiny venue last night. It was packed, and the clip is everywhere this morning.",
        [
          ch("Book a bigger room fast", { cost: 1500, fans: 10, attention: 10 }, { xp: 2 }),
          ch("Keep it small and special", { morale: 8, fans: 5 }, {}),
        ],
      ),
    ]),
    anyArc("superstar-ego", { tier: "superstar", relation: { max: 10 } }, [
      beat(
        "the-rider",
        0,
        "{name}'s new rider",
        "{name}'s tour rider now asks for a private chef, a gold microphone and your parking space.",
        [
          ch("Give them everything", { cost: 5000, morale: 10 }, { relation: 8, next: "the-meeting" }),
          ch("Draw the line at the parking space", { morale: -3 }, { relation: 2, next: "the-meeting" }),
          ch("Say no to all of it", { morale: -10 }, { relation: -10, next: "the-meeting" }),
        ],
      ),
      beat(
        "the-meeting",
        8,
        "{name} wants a meeting",
        "{name} wants to meet you alone, no managers. Nobody knows what about.",
        [
          ch("Clear your afternoon", { morale: 8 }, { relation: 10 }),
          ch("Send your head of A&R", { morale: -6 }, { relation: -6 }),
        ],
      ),
    ]),
    anyArc("tour-burnout", { touring: true, morale: { max: 50 } }, [
      beat(
        "on-the-bus",
        0,
        "{name} is falling apart on the road",
        "{name} hasn't left the tour bus all day. The crew says they cried before the show.",
        [
          ch("Cancel two dates", { cost: 2000, energy: 20, morale: 8 }, { loyalty: 6, next: "after" }),
          ch("Send a doctor and keep going", { cost: 800, energy: 10, morale: -4 }, { next: "after" }),
          ch("Tell them to push through", { morale: -10, energy: -5 }, { loyalty: -6, next: "after" }),
        ],
      ),
      beat(
        "after",
        6,
        "After the tour, {name} talks",
        "Back home, {name} wants to talk about what the road did to them.",
        [
          ch("Give them a month off", { energy: 25, morale: 10, attention: -8 }, { loyalty: 5 }),
          ch("Talk it through, then plan the next record", { morale: 4 }, { xp: 2 }),
        ],
        { touring: false },
      ),
    ]),
  ];

  const data = { ARTIST_ARCS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
