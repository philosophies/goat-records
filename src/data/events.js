(function (root) {
  "use strict";
  function card(kind, id, title, body, phases, when, weight, deadlineWeeks, choices) {
    return {
      kind,
      id,
      title,
      body,
      phases,
      when,
      weight,
      deadlineWeeks,
      choices,
      expiryChoice: choices.length - 1,
    };
  }
  const choice = (label, hint, effects, cost = 0) => ({ label, hint, effects, cost });
  const gamble = (offer, chance, failure) => ({ ...offer, chance, failure });
  const opportunity = (...details) => card("opportunity", ...details);
  const crisis = (...details) => card("crisis", ...details);
  const political = (...details) => card("politics", ...details);
  const artistReady = { artist: [{ field: "fame", min: 35 }] };
  const signedArtist = { artist: [] };
  const activeAlbum = { album: [] };
  const majorPhases = [4, 5, 6];
  const opportunities = [
    opportunity(
      "trailer-sync",
      "A song for the trailer",
      "A film studio is cutting its trailer and needs a song before the final edit.",
      [2, 3, 4, 5, 6],
      artistReady,
      3,
      2,
      [
        gamble(
          choice(
            "Pitch an original",
            "Spend $1,200 for a chance at $6,000 and more fame.",
            { cash: 6000, fame: 6 },
            1200,
          ),
          0.65,
          { morale: -3 },
        ),
        choice("License a catalog track", "Earn $2,000 and 2 label fame.", { cash: 2000, fame: 2 }),
        choice("Pass on the trailer", "Keep the artist focused on their own work.", { morale: 2 }),
      ],
    ),
    opportunity(
      "sportswear-brand",
      "A sportswear partnership",
      "A sportswear brand wants your artist in a campaign. The full deal comes with more shoot days.",
      majorPhases,
      artistReady,
      2,
      2,
      [
        choice("Take the full deal", "Earn $14,000. The extra shoot days cost the artist 8 morale.", {
          cash: 14000,
          morale: -8,
          artistFame: 6,
        }),
        choice("Sell a single appearance", "Earn $5,000 and give the artist 2 fame.", {
          cash: 5000,
          artistFame: 2,
        }),
        choice("Decline the campaign", "The artist gains 3 morale.", { morale: 3 }),
      ],
    ),
    opportunity(
      "festival-slot",
      "A festival slot opens",
      "The promoter needs a replacement act and can give your artist a late-afternoon slot.",
      [2, 3, 4],
      artistReady,
      3,
      1,
      [
        choice(
          "Bring the full band",
          "Spend $900 to gain 5 label fame and 8 artist fame.",
          { fame: 5, artistFame: 8 },
          900,
        ),
        choice("Play an acoustic set", "Gain 3 artist fame, 2 morale and 2 career XP.", {
          artistFame: 3,
          morale: 2,
          xp: 2,
        }),
        choice("Decline the slot", "The artist loses 2 morale.", { morale: -2 }),
      ],
    ),
    opportunity(
      "viral-performance",
      "A live clip goes viral",
      "People are sharing a live recording faster than the artist's team can answer messages.",
      [1, 2, 3, 4, 5, 6],
      { artist: [{ field: "fame", min: 60 }] },
      2,
      1,
      [
        gamble(
          choice(
            "Rush a performance video",
            "Spend $800 for a chance to gain 7 label fame and 8 artist fame.",
            { fame: 7, artistFame: 8 },
            800,
          ),
          0.7,
          { morale: -5 },
        ),
        choice("Organize a small follow-up show", "Earn $600 and gain 4 artist fame.", {
          cash: 600,
          artistFame: 4,
        }),
        choice("Let the clip circulate", "Gain 1 artist fame.", { artistFame: 1 }),
      ],
    ),
    opportunity(
      "catalog-license",
      "A catalog license is for sale",
      "A closing label offers a short-term license to reissue one of its collections.",
      [4, 5, 6],
      { label: [{ field: "cash", min: 12000 }] },
      2,
      3,
      [
        gamble(
          choice(
            "Fund a full reissue",
            "Spend $12,000 for a chance to earn $21,000 and 5 fame.",
            { cash: 21000, fame: 5 },
            12000,
          ),
          0.75,
          { fame: 1 },
        ),
        choice(
          "Buy a digital-only license",
          "Spend $4,000. The digital distributor pays $5,500 up front.",
          { cash: 5500, fame: 1 },
          4000,
        ),
        choice("Pass on the collection", "Keep the cash for your own releases.", {}),
      ],
    ),
    opportunity(
      "distribution-deal",
      "A regional distribution deal",
      "A distributor will pay an advance for first access to your next releases.",
      [3, 4, 5, 6],
      signedArtist,
      3,
      2,
      [
        choice("Accept a larger advance", "Earn $11,000. Your artist loses 6 morale over the restriction.", {
          cash: 11000,
          morale: -6,
        }),
        choice("Keep the deal nonexclusive", "Earn $4,000 and gain 2 label fame.", { cash: 4000, fame: 2 }),
        choice("Keep distribution in-house", "Your artist gains 2 morale.", { morale: 2 }),
      ],
    ),
    opportunity(
      "streaming-exclusive",
      "A platform asks for an exclusive",
      "A streaming service will feature your artist if it gets the song first.",
      [2, 3, 4, 5, 6],
      artistReady,
      2,
      2,
      [
        choice("Grant the exclusive", "Earn $8,000 and gain 5 artist fame. The artist loses 4 morale.", {
          cash: 8000,
          artistFame: 5,
          morale: -4,
        }),
        choice("Negotiate a one-day window", "Earn $3,200 and gain 2 artist fame.", {
          cash: 3200,
          artistFame: 2,
        }),
        choice("Release everywhere at once", "The artist gains 3 morale.", { morale: 3 }),
      ],
    ),
    opportunity(
      "remix-contest",
      "Fans want a remix contest",
      "Producers have been trading unofficial remixes. The artist wants to invite them in.",
      [2, 3, 4],
      artistReady,
      2,
      2,
      [
        choice(
          "Offer prizes and an official release",
          "Spend $1,000 to gain 4 label fame and 5 artist morale.",
          { fame: 4, morale: 5 },
          1000,
        ),
        choice("Share stems for a community showcase", "Gain 3 artist fame and 2 morale.", {
          artistFame: 3,
          morale: 2,
        }),
        choice("Keep the stems private", "The artist loses 2 morale.", { morale: -2 }),
      ],
    ),
    opportunity(
      "tour-documentary",
      "A documentary crew calls",
      "A filmmaker offers to follow an upcoming album, from rehearsal to release.",
      majorPhases,
      activeAlbum,
      2,
      2,
      [
        choice(
          "Let the crew follow the recording",
          "Earn $9,000 and gain 6 fame. Recording takes another week.",
          { cash: 9000, fame: 6, delayAlbum: 1 },
        ),
        choice("Offer one interview", "Earn $2,500 and gain 2 artist fame.", { cash: 2500, artistFame: 2 }),
        choice("Keep the sessions private", "The artist gains 4 morale.", { morale: 4 }),
      ],
    ),
    opportunity(
      "star-feature",
      "A star asks for a feature",
      "A marquee artist has a guest verse open and asks your artist to record it.",
      [3, 4, 5, 6],
      { artist: [{ field: "fame", min: 50 }] },
      2,
      1,
      [
        gamble(
          choice(
            "Book a session together",
            "Spend $1,500 for a chance to gain 12 artist fame and 4 label fame.",
            { artistFame: 12, fame: 4 },
            1500,
          ),
          0.75,
          { morale: -4 },
        ),
        choice("Send a remote verse", "Earn $1,200, gain 4 artist fame and 2 career XP.", {
          cash: 1200,
          artistFame: 4,
          xp: 2,
        }),
        choice("Decline the feature", "The artist loses 3 morale.", { morale: -3 }),
      ],
    ),
    opportunity(
      "indie-radio-session",
      "An independent radio session",
      "A regional station offers a live session and an interview if you can spare an afternoon.",
      [2, 3],
      signedArtist,
      3,
      2,
      [
        choice(
          "Send the artist to the studio",
          "Spend $250 to gain 2 label fame and 4 artist fame.",
          { fame: 2, artistFame: 4 },
          250,
        ),
        choice("Send an interview from home", "Gain 1 artist fame and 1 morale.", {
          artistFame: 1,
          morale: 1,
        }),
        choice("Turn down the airtime", "The artist loses 1 morale.", { morale: -1 }),
      ],
    ),
    opportunity(
      "limited-merch",
      "A limited merchandise run",
      "An independent printer can deliver a small batch of artist merchandise before the next show.",
      [2, 3, 4],
      signedArtist,
      2,
      2,
      [
        gamble(
          choice(
            "Order the limited run",
            "Spend $1,400 for a chance to earn $4,600 and gain 3 morale.",
            { cash: 4600, morale: 3 },
            1400,
          ),
          0.8,
          { cash: 600 },
        ),
        choice("Open preorders only", "Earn $1,000, with no upfront cost.", { cash: 1000 }),
        choice("Save the design for later", "The artist loses 1 morale.", { morale: -1 }),
      ],
    ),
    opportunity(
      "artist-demands",
      "A meeting about morale",
      "An unhappy artist tells their team that something has to change.",
      [1, 2, 3, 4, 5, 6],
      { artist: [{ field: "morale", max: 34 }] },
      4,
      2,
      [
        choice("Pay a retention bonus", "Spend $750 to restore 16 morale.", { morale: 16 }, 750),
        choice("Make space for a private meeting", "Restore 7 morale.", { morale: 7 }),
        choice("Keep the schedule as it is", "The artist loses 6 morale.", { morale: -6 }),
      ],
    ),
    opportunity(
      "game-soundtrack",
      "A game soundtrack placement",
      "A game studio offers a royalty buyout for a placement over its closing credits.",
      [3, 4, 5, 6],
      artistReady,
      2,
      3,
      [
        choice("Sell a worldwide buyout", "Earn $12,000 and gain 3 label fame.", { cash: 12000, fame: 3 }),
        choice("License the track for one territory", "Earn $4,500 and gain 4 artist fame.", {
          cash: 4500,
          artistFame: 4,
        }),
        choice("Keep the track available", "The artist gains 1 morale.", { morale: 1 }),
      ],
    ),
  ];
  const crises = [
    crisis(
      "album-leak",
      "An unfinished album leaks",
      "A rough mix from the studio has reached listeners ahead of the release.",
      [2, 3, 4, 5, 6],
      activeAlbum,
      4,
      1,
      [
        choice(
          "Rework the leaked tracks",
          "Spend $1,100 and add two recording weeks to protect the release.",
          { delayAlbum: 2, morale: 3 },
          1100,
        ),
        choice("Own the leak publicly", "Gain 2 label fame. The artist loses 6 morale.", {
          fame: 2,
          morale: -6,
        }),
        choice("Say nothing", "Lose 3 label fame and 8 artist morale.", { fame: -3, morale: -8 }),
      ],
    ),
    crisis(
      "artist-arrest",
      "An artist is arrested",
      "Your artist has been detained the night before a major appearance.",
      [3, 4, 5, 6],
      artistReady,
      2,
      1,
      [
        choice(
          "Cover legal support",
          "Spend $5,000 to restore 10 morale. Board confidence falls by 3.",
          { morale: 10, confidence: -3 },
          5000,
        ),
        choice(
          "Refund the promoter",
          "The refund costs $2,000 and limits the loss to 2 artist fame.",
          { artistFame: -2 },
          2000,
        ),
        choice("Leave the team to handle it", "Lose 6 artist fame and 10 morale.", {
          artistFame: -6,
          morale: -10,
        }),
      ],
    ),
    crisis(
      "civil-lawsuit",
      "A promoter files suit",
      "A promoter disputes its share of a sold-out appearance and demands compensation.",
      [3, 4, 5, 6],
      signedArtist,
      2,
      2,
      [
        choice(
          "Settle out of court",
          "Spend $7,000 and gain 2 board confidence for containing the dispute.",
          { confidence: 2 },
          7000,
        ),
        gamble(
          choice(
            "Contest the claim",
            "Spend $2,000 on counsel. Losing costs another $12,000.",
            { confidence: 3 },
            2000,
          ),
          0.55,
          { cash: -12000, confidence: -6 },
        ),
        choice("Let the response deadline pass", "The claim costs $16,000 and 8 board confidence.", {
          cash: -16000,
          confidence: -8,
        }),
      ],
    ),
    crisis(
      "sample-clearance",
      "A sample clearance falls through",
      "A rights holder has withdrawn clearance for a sample in the current album.",
      [2, 3, 4, 5, 6],
      activeAlbum,
      3,
      2,
      [
        choice("Pay for clearance", "Spend $3,400 and restore 3 artist morale.", { morale: 3 }, 3400),
        choice("Replace the sample", "The edit adds one recording week.", { delayAlbum: 1 }),
        choice("Wait for the rights holder", "The album loses two weeks and the artist loses 5 morale.", {
          delayAlbum: 2,
          morale: -5,
        }),
      ],
    ),
    crisis(
      "rival-poaching",
      "A rival courts your executive",
      "A rival is using a big signing bonus to lure one of your executives.",
      [3, 4, 5, 6],
      { executive: [{ field: "loyalty", max: 50 }] },
      3,
      2,
      [
        choice(
          "Fund a retention package",
          "Spend $6,000 to reassure the board and gain 4 confidence.",
          { confidence: 4 },
          6000,
        ),
        choice("Brief the board about succession", "The board loses 2 confidence.", { confidence: -2 }),
        choice("Let the rumor spread", "The board loses 7 confidence and the label loses 2 fame.", {
          confidence: -7,
          fame: -2,
        }),
      ],
    ),
    crisis(
      "stream-payout-cut",
      "Streaming payouts drop",
      "A platform is reducing its next payment and will take appeals this week.",
      [2, 3, 4, 5, 6],
      artistReady,
      3,
      1,
      [
        gamble(
          choice(
            "Send Business Affairs to negotiate",
            "Spend $1,000 for a chance to recover $5,000.",
            { cash: 5000 },
            1000,
          ),
          0.65,
          { cash: -2000 },
        ),
        choice("Take a one-time settlement", "The reduced settlement costs $1,500 in expected revenue.", {
          cash: -1500,
        }),
        choice("Absorb the whole cut", "Lose $3,500 and 2 artist morale.", { cash: -3500, morale: -2 }),
      ],
    ),
    crisis(
      "studio-flood",
      "Water damages the studio",
      "A pipe burst in the control room. The engineer needs a decision before work can resume.",
      [1, 2, 3, 4, 5, 6],
      activeAlbum,
      2,
      1,
      [
        choice(
          "Rent a replacement room",
          "Spend $2,000 to keep the schedule and restore 2 morale.",
          { morale: 2 },
          2000,
        ),
        choice(
          "Patch the room on a budget",
          "Spend $600 and lose one week to repairs.",
          { delayAlbum: 1 },
          600,
        ),
        choice("Wait for the room to dry", "Lose three recording weeks and 4 artist morale.", {
          delayAlbum: 3,
          morale: -4,
        }),
      ],
    ),
    crisis(
      "artist-walkout",
      "An artist walks out of a session",
      "A frustrated artist leaves during rehearsal and asks their manager to speak for them.",
      [1, 2, 3, 4, 5, 6],
      { artist: [{ field: "morale", max: 25 }], album: [] },
      4,
      1,
      [
        choice(
          "Pay for mediation and restart",
          "Spend $900. The artist regains 14 morale.",
          { morale: 14 },
          900,
        ),
        choice("Give them a week off", "The album loses a week. The artist recovers 7 morale.", {
          delayAlbum: 1,
          morale: 7,
        }),
        choice("Leave the session on hold", "Two recording weeks are lost and morale falls by 6.", {
          delayAlbum: 2,
          morale: -6,
        }),
      ],
    ),
    crisis(
      "tax-audit",
      "The label is audited",
      "Auditors want receipts for a set of payments that the label's records fail to explain.",
      [2, 3, 4, 5, 6],
      { label: [{ field: "cash", min: 2500 }] },
      2,
      3,
      [
        choice(
          "Hire a forensic accountant",
          "Spend $2,500 and gain 3 board confidence.",
          { confidence: 3 },
          2500,
        ),
        choice("Pay the adjustment", "Pay $4,000 to close the audit.", { cash: -4000 }),
        choice("Miss the filing deadline", "Pay $7,000 and lose 7 board confidence.", {
          cash: -7000,
          confidence: -7,
        }),
      ],
    ),
    crisis(
      "review-storm",
      "Bad reviews pile up",
      "A wave of hostile coverage is turning an artist's press cycle into a drag on the whole label.",
      [2, 3, 4, 5, 6],
      artistReady,
      3,
      1,
      [
        choice(
          "Book a direct interview",
          "Spend $700 to restore 5 morale and retain the artist's audience.",
          { morale: 5 },
          700,
        ),
        choice("Cut the press schedule short", "Lose 2 artist fame but gain 3 morale.", {
          artistFame: -2,
          morale: 3,
        }),
        choice("Ignore the coverage", "Lose 5 artist fame and 4 morale.", { artistFame: -5, morale: -4 }),
      ],
    ),
    crisis(
      "tour-cancellation",
      "A promoter cancels the shows",
      "A regional promoter has cancelled a booked run. Bookings and refunds still have to be handled.",
      [3, 4, 5, 6],
      artistReady,
      2,
      2,
      [
        gamble(
          choice(
            "Secure a substitute venue",
            "Spend $2,500 for a chance to recover $6,000.",
            { cash: 6000, morale: 5 },
            2500,
          ),
          0.6,
          { morale: -4 },
        ),
        choice("Return the deposits", "Refunds cost $3,200 and keep the artist's trust.", {
          cash: -3200,
          morale: 2,
        }),
        choice("Let the promoter handle refunds", "Chargebacks cost $5,400 and the artist loses 8 morale.", {
          cash: -5400,
          morale: -8,
        }),
      ],
    ),
    crisis(
      "manager-theft",
      "Tour advances go missing",
      "The accounting team finds unrecorded withdrawals tied to an outside manager.",
      [3, 4, 5, 6],
      signedArtist,
      2,
      3,
      [
        gamble(
          choice(
            "Investigate and recover funds",
            "Spend $1,600 for a chance to recover $8,000.",
            { cash: 8000, confidence: 3 },
            1600,
          ),
          0.6,
          { confidence: -4 },
        ),
        choice("Negotiate repayment", "Recover $2,200 and lose 2 artist morale.", { cash: 2200, morale: -2 }),
        choice("Write off the withdrawal", "Lose $4,800 and 4 board confidence.", {
          cash: -4800,
          confidence: -4,
        }),
      ],
    ),
    crisis(
      "rival-diss",
      "A rival releases a diss track",
      "A rising artist calls out your roster by name. Fans are waiting for a response.",
      [2, 3, 4, 5, 6],
      artistReady,
      3,
      1,
      [
        gamble(
          choice(
            "Commission a response",
            "Spend $700 for a chance to gain 7 artist fame.",
            { artistFame: 7 },
            700,
          ),
          0.65,
          { artistFame: -3, morale: -4 },
        ),
        choice("Defuse it with an interview", "Trade 1 artist fame for 4 morale.", {
          artistFame: -1,
          morale: 4,
        }),
        choice("Stay quiet", "The artist loses 4 fame and 2 morale.", { artistFame: -4, morale: -2 }),
      ],
    ),
    crisis(
      "contract-dispute",
      "An artist disputes a contract",
      "The artist's lawyer wants an accounting of advances and a private settlement.",
      [2, 3, 4, 5, 6],
      signedArtist,
      3,
      2,
      [
        choice(
          "Settle and explain the accounting",
          "Spend $3,000 to restore 10 artist morale.",
          { morale: 10 },
          3000,
        ),
        choice("Negotiate with the lawyer", "Spend $900 to restore 3 artist morale.", { morale: 3 }, 900),
        choice("Wait for a formal claim", "Lose $4,500 and 9 artist morale.", { cash: -4500, morale: -9 }),
      ],
    ),
    crisis(
      "artist-burnout",
      "An artist needs a break",
      "The artist is running on empty and asks for relief from the recording schedule.",
      [1, 2, 3, 4, 5, 6],
      { artist: [{ field: "energy", max: 25 }], album: [] },
      4,
      1,
      [
        choice("Pause for recovery", "Delay recording by two weeks and restore 12 morale.", {
          delayAlbum: 2,
          morale: 12,
        }),
        choice("Shorten the session days", "Delay recording one week and restore 5 morale.", {
          delayAlbum: 1,
          morale: 5,
        }),
        choice("Keep the current schedule", "The artist loses 12 morale.", { morale: -12 }),
      ],
    ),
    crisis(
      "market-slump",
      "The market cools",
      "Advance orders are down across the market and distributors are slow to pay.",
      [3, 4, 5, 6],
      { label: [{ field: "cash", max: 22000 }] },
      2,
      2,
      [
        choice(
          "Accept a bridge loan",
          "Borrow $10,000 with $300 weekly payments. The board loses 3 confidence.",
          { loan: { amount: 10000, payment: 300 }, confidence: -3 },
        ),
        choice("Sell stock at a discount", "Collect $2,500 now and lose 2 label fame.", {
          cash: 2500,
          fame: -2,
        }),
        choice("Hold stock through the slump", "Carry $3,000 in costs and lose 2 board confidence.", {
          cash: -3000,
          confidence: -2,
        }),
      ],
    ),
  ];
  const politics = [
    political(
      "director-pick",
      "A director presses for a signing",
      "A director wants the label to fund a development session for a prospect they champion.",
      [2, 3, 4, 5, 6],
      { board: [] },
      3,
      2,
      [
        choice("Fund a trial session", "Spend $2,000 and gain 5 board confidence.", { confidence: 5 }, 2000),
        choice("Offer a smaller showcase", "Spend $500 and gain 2 board confidence.", { confidence: 2 }, 500),
        choice("Close the discussion", "Lose 5 board confidence.", { confidence: -5 }),
      ],
    ),
    political(
      "executive-feud",
      "Two executives clash",
      "A fight over who controls the next campaign has reached the board.",
      [3, 4, 5, 6],
      { board: [], executive: [{ field: "ambition", min: 60 }] },
      2,
      2,
      [
        choice("Hire a mediator", "Spend $1,600 to gain 5 board confidence.", { confidence: 5 }, 1600),
        choice("Settle it at the next meeting", "Gain 2 board confidence for intervening.", {
          confidence: 2,
        }),
        choice("Stay out of the feud", "Lose 6 board confidence.", { confidence: -6 }),
      ],
    ),
    political(
      "artist-feud",
      "A roster feud goes public",
      "One of your artists posts their side of a dispute with a labelmate.",
      [2, 3, 4, 5, 6],
      artistReady,
      3,
      1,
      [
        choice("Mediate privately", "Spend $600 to restore 8 artist morale.", { morale: 8 }, 600),
        gamble(
          choice("Turn it into publicity", "The feud could bring 6 fame or cost 8 morale and 4 confidence.", {
            fame: 6,
            morale: -4,
          }),
          0.55,
          { morale: -8, confidence: -4 },
        ),
        choice("Let the posts stand", "Lose 2 label fame and 5 artist morale.", { fame: -2, morale: -5 }),
      ],
    ),
    political(
      "board-leak",
      "A board memo leaks",
      "A confidential memo about the label's strategy reaches a trade reporter.",
      [2, 3, 4, 5, 6],
      { board: [] },
      3,
      1,
      [
        choice(
          "Give a joint statement",
          "Spend $500 on the response and gain 3 board confidence.",
          { confidence: 3 },
          500,
        ),
        choice("Brief the directors privately", "Lose 1 label fame while the board closes ranks.", {
          fame: -1,
          confidence: 1,
        }),
        choice("Leave the leak unanswered", "Lose 2 fame and 5 board confidence.", {
          fame: -2,
          confidence: -5,
        }),
      ],
    ),
    political(
      "takeover-rumor",
      "The trade press reports a takeover",
      "A trade reporter claims a rival is preparing an offer and asks whether the board has been informed.",
      majorPhases,
      { board: [] },
      2,
      2,
      [
        choice(
          "Commission an independent review",
          "Spend $4,000 and gain 6 board confidence.",
          { confidence: 6 },
          4000,
        ),
        choice("Publish a holding statement", "Gain 2 board confidence while discussions continue.", {
          confidence: 2,
        }),
        choice("Let investors guess", "Lose 7 board confidence.", { confidence: -7 }),
      ],
    ),
    political(
      "director-resignation",
      "A director prepares to resign",
      "A director tells the chair they plan to leave. Investors are waiting for an explanation.",
      [3, 4, 5, 6],
      { board: [{ field: "confidence", max: 54 }] },
      3,
      2,
      [
        choice(
          "Arrange a handover",
          "Spend $2,000 on the transition and gain 3 board confidence.",
          { confidence: 3 },
          2000,
        ),
        choice("Announce an orderly transition", "Lose 2 board confidence.", { confidence: -2 }),
        choice("Let the news break first", "Lose 8 board confidence and 2 label fame.", {
          confidence: -8,
          fame: -2,
        }),
      ],
    ),
    political(
      "activist-investor",
      "An investor challenges your strategy",
      "An investor is circulating an open letter about the company's costs.",
      majorPhases,
      { board: [] },
      2,
      2,
      [
        choice(
          "Publish an independent cost review",
          "Spend $3,000 and gain 6 board confidence.",
          { confidence: 6 },
          3000,
        ),
        choice("Host a meeting with shareholders", "Gain 2 board confidence.", { confidence: 2 }),
        choice("Ignore the campaign", "Lose 6 board confidence.", { confidence: -6 }),
      ],
    ),
    political(
      "staff-raise",
      "Staff ask for a raise",
      "An executive brings you a petition asking for better pay this quarter.",
      [2, 3, 4, 5, 6],
      { board: [], executive: [] },
      3,
      2,
      [
        choice(
          "Approve a one-time adjustment",
          "Spend $3,500 and gain 4 board confidence.",
          { confidence: 4 },
          3500,
        ),
        choice(
          "Pay a smaller retention bonus",
          "Spend $1,200 and gain 1 board confidence.",
          { confidence: 1 },
          1200,
        ),
        choice("Defer the pay discussion", "Lose 4 board confidence.", { confidence: -4 }),
      ],
    ),
    political(
      "union-push",
      "Workers ask to bargain",
      "The studio crew presents a request for a meeting about overtime and scheduling.",
      [3, 4, 5, 6],
      { board: [], album: [] },
      2,
      2,
      [
        choice("Agree to mediated talks", "Spend $2,400 and restore 4 artist morale.", { morale: 4 }, 2400),
        choice("Make time for an open meeting", "Recording slips a week. Gain 2 board confidence.", {
          delayAlbum: 1,
          confidence: 2,
        }),
        choice("Keep the recording calendar", "Lose 3 morale and 5 board confidence.", {
          morale: -3,
          confidence: -5,
        }),
      ],
    ),
    political(
      "credit-taking",
      "An executive takes the credit",
      "An executive claims to have discovered a breakout act. The artist says the credit belongs to their team.",
      [2, 3, 4, 5, 6],
      { board: [], executive: [], ...artistReady },
      2,
      2,
      [
        choice("Correct the credits publicly", "The artist gains 7 morale and 2 fame.", {
          morale: 7,
          artistFame: 2,
        }),
        choice("Ask the executive to share the credit", "Gain 4 artist morale and 2 board confidence.", {
          morale: 4,
          confidence: 2,
        }),
        choice("Leave the claim up", "The artist loses 8 morale and the board loses 2 confidence.", {
          morale: -8,
          confidence: -2,
        }),
      ],
    ),
  ];

  // Superstar news (3.0, T46). `relation` moves the superstar's relationship with the CEO (superstars
  // swing harder), `brand` moves company value by `mult` for `weeks`.
  const superstar = { artist: [{ field: "tier", equals: "superstar" }] };
  const superstars = [
    opportunity(
      "superstar-sneaker",
      "A sneaker company wants your superstar",
      "A sportswear giant wants a signature shoe with your superstar's name on it.",
      [3, 4, 5, 6],
      superstar,
      3,
      2,
      [
        choice(
          "Sign the label's deal",
          "Earn $30,000; company value up 5% for 12 weeks. The artist likes it a little.",
          { cash: 30000, brand: { mult: 0.05, weeks: 12 }, relation: 5 },
        ),
        choice(
          "Let the artist take the bigger cut",
          "Earn $12,000. The artist remembers who looked out for them.",
          { cash: 12000, relation: 20 },
        ),
        choice("Turn the shoe down", "The artist wanted this. The relationship cools.", { relation: -15 }),
      ],
    ),
    crisis(
      "superstar-radio",
      "Your superstar called you out on air",
      "On a morning show your superstar said the label takes their money and gives nothing back.",
      [3, 4, 5, 6],
      superstar,
      3,
      1,
      [
        choice("Apologise in public", "Reputation −3. The artist softens.", { reputation: -3, relation: 15 }),
        choice("Meet them in private", "Spend $5,000 on a dinner and a gesture.", { relation: 10 }, 5000),
        choice(
          "Fire back on the record",
          "The feud sells headlines and scares investors: company value down 8% for 8 weeks.",
          { relation: -30, brand: { mult: -0.08, weeks: 8 }, fame: 6 },
        ),
        choice("Say nothing", "The silence reads as contempt.", { relation: -15 }),
      ],
    ),
    political(
      "superstar-imprint",
      "Your superstar wants their own imprint",
      "They want a vanity label under your roof: their name on the door and a say in signings.",
      [4, 5, 6],
      superstar,
      2,
      3,
      [
        choice(
          "Give them the imprint",
          "Spend $20,000. Company value up 6% for 26 weeks; the artist feels like family.",
          { brand: { mult: 0.06, weeks: 26 }, relation: 25 },
          20000,
        ),
        choice("Offer a producer credit instead", "A smaller gesture.", { relation: 5 }),
        choice("Refuse", "The artist starts talking to other labels.", { relation: -25 }),
      ],
    ),
    crisis(
      "superstar-rumor",
      "Rumours swirl around your superstar",
      "A gossip site claims your superstar was involved in a fight outside a club.",
      [3, 4, 5, 6],
      superstar,
      3,
      1,
      [
        choice(
          "Hire a crisis lawyer",
          "Spend $8,000; company value down 3% for 6 weeks.",
          { brand: { mult: -0.03, weeks: 6 } },
          8000,
        ),
        choice(
          "Stand by them in public",
          "The artist is grateful; investors are not: value down 8% for 10 weeks.",
          { relation: 20, brand: { mult: -0.08, weeks: 10 } },
        ),
        choice("Distance the label", "Value holds, the relationship does not.", {
          relation: -30,
          brand: { mult: 0.02, weeks: 6 },
        }),
        choice("No comment", "The story runs for weeks: value down 10% for 8 weeks.", {
          brand: { mult: -0.1, weeks: 8 },
        }),
      ],
    ),
  ];

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
      ...opportunities,
      ...crises,
      ...politics,
      ...superstars,
    ],
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
