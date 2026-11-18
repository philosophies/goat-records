(function (root) {
  "use strict";
  function card(kind, id, title, body, phases, when, weight, deadlineWeeks, choices) {
    return { kind, id, title, body, phases, when, weight, deadlineWeeks, choices, expiryChoice: choices.length - 1 };
  }
  const choice = (label, hint, effects, cost = 0) => ({ label, hint, effects, cost });
  const gamble = (offer, chance, failure) => ({ ...offer, chance, failure });
  const opportunity = (...details) => card("opportunity", ...details);
  const artistReady = { artist: [{ field: "fame", min: 35 }] };
  const signedArtist = { artist: [] };
  const activeAlbum = { album: [] };
  const majorPhases = [4, 5, 6];
  const opportunities = [
    opportunity("trailer-sync", "A song for the trailer", "A film studio is cutting its trailer and needs a song before the final edit.",
      [2, 3, 4, 5, 6], artistReady, 3, 2, [
        gamble(choice("Pitch an original", "Spend $1,200 for a chance at $6,000 and more fame.", { cash: 6000, fame: 6 }, 1200), 0.65, { morale: -3 }),
        choice("License a catalog track", "Earn $2,000 and 2 label fame.", { cash: 2000, fame: 2 }),
        choice("Pass on the trailer", "Keep the artist focused on their own work.", { morale: 2 }),
      ]),
    opportunity("sportswear-brand", "A sportswear partnership", "A sportswear brand wants your artist in a campaign. The full deal comes with more shoot days.",
      majorPhases, artistReady, 2, 2, [
        choice("Take the full deal", "Earn $14,000. The extra shoot days cost the artist 8 morale.", { cash: 14000, morale: -8, artistFame: 6 }),
        choice("Sell a single appearance", "Earn $5,000 and give the artist 2 fame.", { cash: 5000, artistFame: 2 }),
        choice("Decline the campaign", "The artist gains 3 morale.", { morale: 3 }),
      ]),
    opportunity("festival-slot", "A festival slot opens", "The promoter needs a replacement act and can give your artist a late-afternoon slot.",
      [2, 3, 4], artistReady, 3, 1, [
        choice("Bring the full band", "Spend $900 to gain 5 label fame and 8 artist fame.", { fame: 5, artistFame: 8 }, 900),
        choice("Play an acoustic set", "Gain 3 artist fame and 2 morale.", { artistFame: 3, morale: 2 }),
        choice("Decline the slot", "The artist loses 2 morale.", { morale: -2 }),
      ]),
    opportunity("viral-performance", "A live clip goes viral", "People are sharing a live recording faster than the artist's team can answer messages.",
      [1, 2, 3, 4, 5, 6], { artist: [{ field: "fame", min: 60 }] }, 2, 1, [
        gamble(choice("Rush a performance video", "Spend $800 for a chance to gain 7 label fame and 8 artist fame.", { fame: 7, artistFame: 8 }, 800), 0.7, { morale: -5 }),
        choice("Organize a small follow-up show", "Earn $600 and gain 4 artist fame.", { cash: 600, artistFame: 4 }),
        choice("Let the clip circulate", "Gain 1 artist fame.", { artistFame: 1 }),
      ]),
    opportunity("catalog-license", "A catalog license is for sale", "A closing label offers a short-term license to reissue one of its collections.",
      [4, 5, 6], { label: [{ field: "cash", min: 12000 }] }, 2, 3, [
        gamble(choice("Fund a full reissue", "Spend $12,000 for a chance to earn $21,000 and 5 fame.", { cash: 21000, fame: 5 }, 12000), 0.75, { fame: 1 }),
        choice("Buy a digital-only license", "Spend $4,000. The digital distributor pays $5,500 up front.", { cash: 5500, fame: 1 }, 4000),
        choice("Pass on the collection", "Keep the cash for your own releases.", {}),
      ]),
    opportunity("distribution-deal", "A regional distribution deal", "A distributor will pay an advance for first access to your next releases.",
      [3, 4, 5, 6], signedArtist, 3, 2, [
        choice("Accept a larger advance", "Earn $11,000. Your artist loses 6 morale over the restriction.", { cash: 11000, morale: -6 }),
        choice("Keep the deal nonexclusive", "Earn $4,000 and gain 2 label fame.", { cash: 4000, fame: 2 }),
        choice("Keep distribution in-house", "Your artist gains 2 morale.", { morale: 2 }),
      ]),
    opportunity("streaming-exclusive", "A platform asks for an exclusive", "A streaming service will feature your artist if it gets the song first.",
      [2, 3, 4, 5, 6], artistReady, 2, 2, [
        choice("Grant the exclusive", "Earn $8,000 and gain 5 artist fame. The artist loses 4 morale.", { cash: 8000, artistFame: 5, morale: -4 }),
        choice("Negotiate a one-day window", "Earn $3,200 and gain 2 artist fame.", { cash: 3200, artistFame: 2 }),
        choice("Release everywhere at once", "The artist gains 3 morale.", { morale: 3 }),
      ]),
    opportunity("remix-contest", "Fans want a remix contest", "Producers have been trading unofficial remixes. The artist wants to invite them in.",
      [2, 3, 4], artistReady, 2, 2, [
        choice("Offer prizes and an official release", "Spend $1,000 to gain 4 label fame and 5 artist morale.", { fame: 4, morale: 5 }, 1000),
        choice("Share stems for a community showcase", "Gain 3 artist fame and 2 morale.", { artistFame: 3, morale: 2 }),
        choice("Keep the stems private", "The artist loses 2 morale.", { morale: -2 }),
      ]),
    opportunity("tour-documentary", "A documentary crew calls", "A filmmaker offers to follow an upcoming album, from rehearsal to release.",
      majorPhases, activeAlbum, 2, 2, [
        choice("Let the crew follow the recording", "Earn $9,000 and gain 6 fame. Recording takes another week.", { cash: 9000, fame: 6, delayAlbum: 1 }),
        choice("Offer one interview", "Earn $2,500 and gain 2 artist fame.", { cash: 2500, artistFame: 2 }),
        choice("Keep the sessions private", "The artist gains 4 morale.", { morale: 4 }),
      ]),
    opportunity("star-feature", "A star asks for a feature", "A marquee artist has a guest verse open and asks your artist to record it.",
      [3, 4, 5, 6], { artist: [{ field: "fame", min: 50 }] }, 2, 1, [
        gamble(choice("Book a session together", "Spend $1,500 for a chance to gain 12 artist fame and 4 label fame.", { artistFame: 12, fame: 4 }, 1500), 0.75, { morale: -4 }),
        choice("Send a remote verse", "Earn $1,200 and gain 4 artist fame.", { cash: 1200, artistFame: 4 }),
        choice("Decline the feature", "The artist loses 3 morale.", { morale: -3 }),
      ]),
    opportunity("indie-radio-session", "An independent radio session", "A regional station offers a live session and an interview if you can spare an afternoon.",
      [2, 3], signedArtist, 3, 2, [
        choice("Send the artist to the studio", "Spend $250 to gain 2 label fame and 4 artist fame.", { fame: 2, artistFame: 4 }, 250),
        choice("Send an interview from home", "Gain 1 artist fame and 1 morale.", { artistFame: 1, morale: 1 }),
        choice("Turn down the airtime", "The artist loses 1 morale.", { morale: -1 }),
      ]),
    opportunity("limited-merch", "A limited merchandise run", "An independent printer can deliver a small batch of artist merchandise before the next show.",
      [2, 3, 4], signedArtist, 2, 2, [
        gamble(choice("Order the limited run", "Spend $1,400 for a chance to earn $4,600 and gain 3 morale.", { cash: 4600, morale: 3 }, 1400), 0.8, { cash: 600 }),
        choice("Open preorders only", "Earn $1,000, with no upfront cost.", { cash: 1000 }),
        choice("Save the design for later", "The artist loses 1 morale.", { morale: -1 }),
      ]),
    opportunity("artist-demands", "A meeting about morale", "An unhappy artist tells their team that something has to change.",
      [1, 2, 3, 4, 5, 6], { artist: [{ field: "morale", max: 34 }] }, 4, 2, [
        choice("Pay a retention bonus", "Spend $750 to restore 16 morale.", { morale: 16 }, 750),
        choice("Make space for a private meeting", "Restore 7 morale.", { morale: 7 }),
        choice("Keep the schedule as it is", "The artist loses 6 morale.", { morale: -6 }),
      ]),
    opportunity("game-soundtrack", "A game soundtrack placement", "A game studio offers a royalty buyout for a placement over its closing credits.",
      [3, 4, 5, 6], artistReady, 2, 3, [
        choice("Sell a worldwide buyout", "Earn $12,000 and gain 3 label fame.", { cash: 12000, fame: 3 }),
        choice("License the track for one territory", "Earn $4,500 and gain 4 artist fame.", { cash: 4500, artistFame: 4 }),
        choice("Keep the track available", "The artist gains 1 morale.", { morale: 1 }),
      ]),
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
    ],
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
