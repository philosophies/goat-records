// Balance tables for the staff system (2.0): label departments and their executives.
// See design/gdd/ceo-2.0.md, sections 3.4 and 3.6.
(function (root) {
  "use strict";

  // Label departments. Each has a head (an executive) and junior staff.
  //   head      the head's title
  //   phase     the company phase that opens the department
  //   role      the 1.x staff role whose effect this department carries (task T13)
  //   capacity  projects a quarter = the head (1) + junior staff
  const DEPARTMENTS = [
    {
      id: "ar",
      name: "A&R",
      head: "Head of A&R",
      phase: 1,
      role: "A&R",
      text: "Scouting reach and accuracy, the signing pipeline.",
    },
    {
      id: "marketing",
      name: "Marketing",
      head: "Chief Marketing Officer",
      phase: 2,
      role: "Marketing",
      text: "Release campaigns, ads and brand deals.",
    },
    {
      id: "promotion",
      name: "Promotion",
      head: "Head of Promotion",
      phase: 2,
      role: "Public Relations",
      text: "Radio, playlists and chart pushes.",
    },
    {
      id: "live",
      name: "Live",
      head: "Head of Touring",
      phase: 3,
      role: null,
      text: "Tours, festivals and the venue.",
    },
    {
      id: "business",
      name: "Business Affairs",
      head: "General Counsel",
      phase: 3,
      role: null,
      text: "Contracts, lawsuits, sync and publishing deals.",
    },
    {
      id: "finance",
      name: "Finance",
      head: "Chief Financial Officer",
      phase: 3,
      role: "VP",
      text: "Budgets, the IPO and the board's trust in your numbers.",
    },
    {
      id: "creative",
      name: "Creative",
      head: "Creative Director",
      phase: 4,
      role: "Artist Development",
      text: "Visual identity, videos and handling controversy.",
    },
  ];

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

  const EXEC_FIRST = [
    "Avery",
    "Marcus",
    "Dana",
    "Tiana",
    "Andre",
    "Simone",
    "Victor",
    "Kendra",
    "Malik",
    "Renee",
    "Jordan",
    "Celeste",
    "Darius",
    "Imani",
    "Felix",
    "Noelle",
  ];
  const EXEC_LAST = [
    "Holloway",
    "Price",
    "Okafor",
    "Vance",
    "Sterling",
    "Brooks",
    "Delgado",
    "Whitfield",
    "Carver",
    "Monroe",
    "Ashby",
    "Rowe",
    "Banks",
    "Calloway",
    "Reyes",
    "Thorne",
  ];

  const data = { DEPARTMENTS, EXEC_POOL, EXEC_PAY, DEPT_STAFF, EXEC_FIRST, EXEC_LAST };
  root.GoatData = Object.assign(root.GoatData || {}, data);
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
