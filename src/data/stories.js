// Stories (3.0, design 6): arcs are chains of beats. A beat is a decision card that only appears when
// its context is true; its choices change the game, set flags the later beats read, and pick the next
// beat. The story engine is in src/systems/stories.js; the packs (T55, T56) add most of the arcs.
(function (root) {
  "use strict";

  //   chance          chance each week that a due beat is played, once the gap has passed
  //   gap             weeks between any two beats
  //   personGap       weeks between two beats for the same character
  //   continueWeight  how much likelier an arc already under way is to move on than a new arc to start
  //   logSize         beats kept in each character's story log
  //   scandalTrust    a story choice that costs this much trust or more is a public scandal (the board
  //                   counts it); smaller trust losses stay private
  const STORY_RULES = { chance: 0.45, gap: 3, personGap: 8, continueWeight: 3, logSize: 20, scandalTrust: 6 };

  // An arc:
  //   id      unique; a cast artist's arc.id ties the arc to that artist
  //   who     "artist" (any artist on the roster who meets `start`), or "cast" (only the cast artist
  //           whose arc id it is)
  //   start   conditions for the first beat (see below)
  //   beats   in order of id; the first beat starts the arc
  // A beat:
  //   id, title, body ({name} is the artist, {label} the label)
  //   after   weeks to wait after the previous beat in the arc (0 for the first)
  //   when    conditions that must hold when it plays
  //   choices label, an optional `note` (a line of flavour; the card adds every effect in numbers),
  //           optional cost, effects for the engine's event fields (morale, fans, trust,
  //           energy, attention, cash, reputation, artistFame, labelFame), and `story`:
  //             set      flags to record on the arc
  //             next     the beat to play next (null or absent ends the arc)
  //             relation change to the CEO relationship (superstars feel it hardest)
  //             xp       career XP for the artist
  //             loyalty  change to the artist's loyalty trait
  // Conditions (all optional): phase [min, max]; tier (one id or a list); fame {min, max};
  // morale {min, max}; relation {min, max}; releases {min}; hit (true: has a hit with the label);
  // sinceRelease {max} (weeks since their last release); touring (true or false); cash {min};
  // flags { name: value } set earlier in the arc.
  const ARCS = [
    {
      id: "first-hit",
      who: "artist",
      start: { hit: true, sinceRelease: { max: 6 } },
      beats: [
        {
          id: "glow",
          after: 0,
          title: "{name} hears the song everywhere",
          body: "The hit is on every radio in town. {name} wants to know what happens next, and so does everyone around them.",
          choices: [
            {
              label: "Back to the studio while it's hot",
              note: "They will remember you pushed.",
              morale: 4,
              story: { xp: 2, set: { pushed: true }, next: "crowd" },
            },
            {
              label: "Give them a week off to enjoy it",
              morale: 8,
              energy: 15,
              story: { set: { pushed: false }, next: "crowd" },
            },
          ],
        },
        {
          id: "crowd",
          after: 6,
          when: { fame: { min: 30 } },
          title: "New friends for {name}",
          body: "Since the hit, {name} has a lot of new friends, and some of them want jobs.",
          choices: [
            {
              label: "Keep the circle small",
              morale: -3,
              story: { loyalty: 5 },
            },
            {
              label: "Let them build their own team",
              note: "The new people will talk.",
              morale: 5,
              trust: -4,
              story: { loyalty: -3 },
            },
          ],
        },
      ],
    },
    {
      id: "viral-curse",
      who: "cast",
      start: { releases: { min: 1 } },
      beats: [
        {
          id: "the-clip",
          after: 0,
          title: "Everyone still wants the vending-machine song",
          body: "At every show the crowd chants for the old viral freestyle. {name} is starting to hate it.",
          choices: [
            {
              label: "Play it, and smile",
              fans: 6,
              morale: -5,
              story: { set: { embraced: true }, next: "remix" },
            },
            {
              label: "Drop it from the set",
              morale: 6,
              attention: -8,
              story: { set: { embraced: false } },
            },
          ],
        },
        {
          id: "remix",
          after: 10,
          when: { flags: { embraced: true } },
          title: "A remix offer for the old clip",
          body: "A producer wants to turn the vending-machine freestyle into a full song. {name} is tempted, for once.",
          choices: [
            {
              label: "Make it the lead single",
              cash: 4000,
              fans: 10,
              story: { xp: 3, set: { remixed: true } },
            },
            {
              label: "Leave the past alone",
              morale: 4,
            },
          ],
        },
      ],
    },
  ];

  const data = { STORY_RULES, ARCS };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
