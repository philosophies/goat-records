// Balance tables for the staff system (2.0): label departments and their executives.
// See design/gdd/ceo-2.0.md, sections 3.4 and 3.6.
(function (root) {
  "use strict";

  // Label departments. Each has a head (an executive) and junior staff.
  //   head      the head's title
  //   phase     the company phase that opens the department
  //   capacity  projects a quarter = the head (1) + junior staff
  const DEPARTMENTS = [
    {
      id: "ar",
      name: "A&R",
      head: "Head of A&R",
      phase: 1,

      text: "Scouting reach and accuracy, the signing pipeline.",
    },
    {
      id: "marketing",
      name: "Marketing",
      head: "Chief Marketing Officer",
      phase: 2,

      text: "Release campaigns, ads and brand deals.",
    },
    {
      id: "promotion",
      name: "Promotion",
      head: "Head of Promotion",
      phase: 2,

      text: "Radio, playlists and chart pushes.",
    },
    {
      id: "live",
      name: "Live",
      head: "Head of Touring",
      phase: 3,

      text: "Tours, festivals and the venue.",
    },
    {
      id: "business",
      name: "Business Affairs",
      head: "General Counsel",
      phase: 3,

      text: "Contracts, lawsuits, sync and publishing deals.",
    },
    {
      id: "finance",
      name: "Finance",
      head: "Chief Financial Officer",
      phase: 3,

      text: "Budgets, the IPO and the board's trust in your numbers.",
    },
    {
      id: "creative",
      name: "Creative",
      head: "Creative Director",
      phase: 4,

      text: "Visual identity, videos and handling controversy.",
    },
  ];

  // The 1.x staff role whose effect each department head carries in CEO runs.
  // Producer also comes from an artist's team producer once teams exist (T14).
  const ROLE_DEPARTMENT = {
    Producer: "ar",
    "A&R": "ar",
    Marketing: "marketing",
    "Public Relations": "promotion",
    VP: "finance",
    "Artist Development": "creative",
  };

  // Executives found by a recruitment drive, by the company's reach.
  //   skill  range of the candidates' skill (0–100)
  const EXEC_POOL = {
    size: 3,
    recruitCost: 600, // per drive, × the company phase
    skill: {
      local: [30, 55],
      city: [38, 62],
      region: [45, 72],
      country: [55, 82],
      world: [65, 92],
    },
    ambition: [20, 90],
    loyalty: [30, 90],
    influence: [5, 25],
  };
  // Pay: an executive earns base + skill × perSkill a week. Signing costs signWeeks of salary;
  // letting one go costs severanceWeeks.
  const EXEC_PAY = { base: 150, perSkill: 9, signWeeks: 2, severanceWeeks: 2 };
  // Junior staff: a weekly salary each, a hiring fee, and at most perPhase × company phase per department.
  const DEPT_STAFF = { salary: 300, hireFee: 600, perPhase: 2 };

  // The team around each artist (design 3.5). Each artist has one slot per role once its phase opens.
  //   weight   how strongly the role's skill counts in the team effect (skill × weight × chemistry)
  //   salary   weekly pay at skill 0; add TEAM_POOL.perSkill per skill point
  const TEAM_ROLES = [
    { id: "manager", name: "Manager", phase: 1, weight: 0.6, text: "Morale, wants and contract talks." },
    { id: "producer", name: "Producer", phase: 1, weight: 1, text: "Album quality on Recording and Mix." },
    { id: "ar", name: "A&R rep", phase: 2, weight: 0.8, text: "Songwriting and picking singles." },
    { id: "publicist", name: "Publicist", phase: 3, weight: 0.8, text: "Fame and scandal defence." },
    { id: "stylist", name: "Stylist", phase: 3, weight: 0.5, text: "Image, videos and launch hype." },
    { id: "tour", name: "Tour manager", phase: 3, weight: 0.8, text: "Tour profit and artist energy." },
    {
      id: "business",
      name: "Business manager",
      phase: 4,
      weight: 0.6,
      text: "Deals, royalties and the artist's money.",
    },
  ];
  // Hiring team members into the label's pool, by the company's reach.
  //   sharedEffect  a member serving two artists works at this share of their effect for each
  const TEAM_POOL = {
    size: 3,
    recruitCost: 250, // per drive, × the company phase
    skill: {
      local: [25, 50],
      city: [32, 58],
      region: [40, 68],
      country: [50, 78],
      world: [60, 90],
    },
    salary: 80,
    perSkill: 5,
    signWeeks: 2,
    maxArtists: 2,
    sharedEffect: 0.6,
  };
  // What each team role changes. A member's effect is skill × role weight × chemistry × share.
  //   stagePoints  stage score points per effect point, on the listed stages (0 Creative direction …
  //                4 Campaign planning)
  //   releaseFame  artist fame per effect point when an album comes out
  //   defence      share of an event's trust loss absorbed per effect point, up to defenceMax
  //   gate         extra tour ticket revenue per effect point
  //   drain        share of tour energy drain removed per effect point, up to drainMax
  // Manager, stylist and business manager effects arrive with traits, wants and deals (T16, T27).
  const TEAM_EFFECTS = {
    producer: { stages: [2, 3], stagePoints: 0.1 },
    ar: { stages: [1], stagePoints: 0.1 },
    publicist: { releaseFame: 0.05, defence: 0.004, defenceMax: 0.5 },
    tour: { gate: 0.002, drain: 0.004, drainMax: 0.5 },
  };
  // How a member styles their work; shown on their card. Chemistry with an artist also depends on the pair.
  const TEAM_STYLES = ["Calm", "Driven", "Blunt", "Playful", "Meticulous", "Old-school"];
  // Chemistry = base + genre fit + personality + history, clamped to min–max.
  //   personality  the pair's fit spreads from −personality to +personality, fixed for a run
  //   history      perAlbum for each album released together, up to historyMax
  const CHEMISTRY = {
    base: 1,
    genreMatch: 0.2,
    genreMiss: -0.15,
    personality: 0.2,
    perAlbum: 0.05,
    historyMax: 0.2,
    min: 0.6,
    max: 1.4,
  };

  // Artist personality (design 3.5), fixed for each artist in a CEO run. Each trait is min–max.
  const TRAITS = { ids: ["ego", "discipline", "loyalty", "workRate"], min: 15, max: 90 };
  // Each artist has one main want. Morale moves every week by whether it is met.
  //   money    met while a bonus paid in the last `window` weeks; a bonus costs `wageWeeks` of wage, at least `min`
  //   control  met when the latest album's creative direction was the artist's own vision (`choice`)
  //   fame     checked every `window` weeks: met if fame rose by `gain`, or is already at `star`
  //   family   met unless the artist has worked `maxBusy` weeks in a row; `rest` idle weeks reset the count
  const WANTS = {
    money: { name: "Money", window: 26, wageWeeks: 8, min: 500 },
    control: { name: "Creative control", choice: "Artist-led vision" },
    fame: { name: "Fame", window: 13, gain: 3, star: 80 },
    family: { name: "Family time", maxBusy: 8, rest: 2 },
  };
  // Weekly morale from wants: +met when met; when ignored, −(ignored + ego × egoWeight − loyalty × loyaltyWeight),
  // at least −1. An artist with no record yet has nothing to judge control by and is left alone.
  const WANT_MORALE = { met: 1, ignored: 3, egoWeight: 0.02, loyaltyWeight: 0.015 };
  // Unhappy artists: below `unhappy` morale they start making demands (task T27). With no albums left on
  // their contract they walk out below `walkOut`, or below walkOut − loyalGrace if loyalty is at least `loyal`.
  const WALKOUT = { unhappy: 40, walkOut: 35, loyal: 75, loyalGrace: 15 };

  // Power grabs (design 3.4 and 4). Checked every `quarter` weeks for each department head:
  //   chance a quarter = max(0, (ambition + influence − loyalty − threshold) ÷ divisor) × (1 − your influence ÷ ceoDivisor)
  // A grab starts as office gossip in the Inbox and comes to a head warnWeeks later. While plotting, an
  // executive courts one more director a quarter. Influence grows by perQuarter a quarter, plus perContact
  // for each director they have courted, up to 100.
  const GRAB = {
    quarter: 13,
    threshold: 90,
    divisor: 200,
    ceoDivisor: 200,
    warnWeeks: 26,
    perQuarter: 2,
    perContact: 1,
  };
  // How a grab ends when it comes to a head. With a board, it succeeds when the executive has courted
  // more than `majority` of the seats and out-influences you. They take the chair (the run ends) when their
  // influence beats yours by chairMargin or more and they courted every seat; otherwise they become co-CEO,
  // which costs you one step of creative freedom from then on. A failed grab sends them to a rival, and
  // they try to take an artist: the least loyal one goes with them if that loyalty is below poachLoyalty.
  const GRAB_END = { majority: 0.5, chairMargin: 25, poachLoyalty: 50 };
  // Your own influence: base, plus perPhase for each phase, plus perPerk for each board perk; at most 100.
  const CEO_INFLUENCE = { base: 20, perPhase: 5, perPerk: 10 };
  // Your answers to an ambitious executive.
  //   promote   a title and a raise (salary × (1 + raise)); ambition − ambition; calm for calmWeeks
  //   placate   a bonus of bonusWeeks of salary; calm for calmWeeks, and a plot slips by as long
  //   sideline  move them to head an open department; influence and loyalty fall
  //   fire      the usual severance; each director they courted loses contactPenalty relationship with you
  //   counter   win their board contacts first: costs your week and costPerPhase × phase; their influence
  //             falls by perContact for each contact won back
  // Any answer but placate ends a plot that has started.
  const RESPONSES = {
    promote: { name: "Promote", raise: 0.25, ambition: -15, calmWeeks: 52 },
    placate: { name: "Placate", bonusWeeks: 8, calmWeeks: 13 },
    sideline: { name: "Sideline", influence: -20, loyalty: -15 },
    fire: { name: "Fire", contactPenalty: 6 },
    counter: { name: "Counter", costPerPhase: 2000, perContact: 5 },
  };


  const data = {
    DEPARTMENTS,
    ROLE_DEPARTMENT,
    TEAM_ROLES,
    TEAM_EFFECTS,
    TEAM_POOL,
    TEAM_STYLES,
    TRAITS,
    WANTS,
    WANT_MORALE,
    WALKOUT,
    GRAB,
    GRAB_END,
    CEO_INFLUENCE,
    RESPONSES,
    CHEMISTRY,
    EXEC_POOL,
    EXEC_PAY,
    DEPT_STAFF,
  };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
