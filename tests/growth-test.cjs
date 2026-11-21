// Staff growth (3.0, T51): XP from work, seniority ceilings, paid training and promotions.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { GROWTH } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(phase = 3) {
  const s = G.create(51, { ceo: true });
  s.company.phase = phase;
  s.cash = 1e8;
  const pool = G.recruitExecs(s, "ar");
  const head = G.hireHead(s, "ar", pool[0].id);
  return { s, head };
}
function member(s) {
  G.sign(s, s.candidates[0].id);
  const a = s.artists.at(-1),
    list = G.recruitTeam(s, "producer"),
    m = G.hireTeam(s, "producer", list[0].id);
  G.assignTeam(s, m.id, a.id);
  return { a, m };
}
/** Runs weeks with only the growth step, so nothing else moves the numbers. */
function weeks(s, n) {
  const staff = require("../src/systems/staff.js").create(
    {
      clamp: (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x)),
      log() {},
      pay() {},
      requireAction() {},
      roll: () => 0.5,
      busy: () => false,
      uniqueName: () => "X",
      api: () => G,
    },
    {
      ...require("../src/data/core.js"),
      ...require("../src/data/company.js"),
      ...require("../src/data/staff.js"),
    },
  );
  for (let i = 0; i < n; i++) {
    s.week++;
    staff.weekly(s);
  }
}

test("heads gain a skill point every 12 XP, one XP a week", () => {
  const { s, head } = ceo();
  head.skill = 40;
  head.startSkill = 40;
  weeks(s, GROWTH.xpPerPoint);
  assert.equal(head.skill, 41);
  assert.equal(head.xp, 0);
});

test("skill stops at the ceiling until seniority raises it", () => {
  const { s, head } = ceo();
  Object.assign(head, { skill: 40, startSkill: 40 });
  weeks(s, 24);
  const first = GROWTH.seniority[0].ceiling;
  assert.ok(head.skill <= 40 + first);
  head.skill = 40 + first;
  head.xp = GROWTH.xpPerPoint;
  weeks(s, 1);
  assert.equal(head.skill, 40 + first, "at the ceiling");
  assert.equal(head.xp, GROWTH.xpPerPoint, "XP waits");
  weeks(s, 1);
  assert.equal(G.growthInfo(s, "head", "ar").rank, GROWTH.seniority[1].name);
  assert.equal(G.skillCeiling(s, head), 40 + GROWTH.seniority[1].ceiling);
  assert.equal(head.skill, 40 + first + 1, "growth resumes once the ceiling rises");
});

test("reaching a new rank raises pay to the going rate", () => {
  const { s, head } = ceo();
  Object.assign(head, { skill: 70, startSkill: 50, salary: 100 });
  weeks(s, GROWTH.seniority[1].weeks + 1);
  assert.ok(head.salary >= 150 + 70 * 9);
});

test("team members grow only while working with an artist, and more on releases", () => {
  const { s, head } = ceo();
  const { a, m } = member(s);
  Object.assign(m, { skill: 30, startSkill: 30, xp: 0 });
  weeks(s, 6);
  assert.equal(m.xp, 6);
  G.unassignTeam(s, m.id, a.id);
  weeks(s, 6);
  assert.equal(m.xp, 6, "no XP without an artist");
  G.assignTeam(s, m.id, a.id);
  Object.assign(head, { xp: 0 });
  const p = { id: 9999, artist: a.id, released: true, quality: 60, releaseWeek: s.week };
  s.albums.push(p);
  const staff = require("../src/systems/staff.js").create(
    {
      clamp: (x) => x,
      log() {},
      pay() {},
      requireAction() {},
      roll: () => 0.5,
      busy: () => false,
      api: () => G,
    },
    {
      ...require("../src/data/core.js"),
      ...require("../src/data/company.js"),
      ...require("../src/data/staff.js"),
    },
  );
  staff.onRelease(s, p);
  assert.equal(m.xp, 6 + GROWTH.releaseXp.member);
  staff.onRelease(s, p);
  assert.equal(m.skill, 31, "a second release tips it over a point");
  assert.equal(m.xp, 6 + 2 * GROWTH.releaseXp.member - GROWTH.xpPerPoint);
  assert.equal(head.xp, 2 * GROWTH.releaseXp.head);
});

test("training costs six weeks of pay, adds two points within the ceiling, then waits", () => {
  const { s, head } = ceo();
  Object.assign(head, { skill: 50, startSkill: 50 });
  const cash = s.cash,
    cost = Math.round(head.salary * GROWTH.training.weeksOfPay);
  G.trainPerson(s, "head", "ar");
  assert.equal(cash - s.cash, cost);
  assert.equal(head.skill, 52);
  assert.throws(() => G.trainPerson(s, "head", "ar"), /train again in 13 week/);
  head.trainedWeek = s.week - GROWTH.training.cooldown;
  head.skill = G.skillCeiling(s, head);
  assert.throws(() => G.trainPerson(s, "head", "ar"), /at their ceiling/);
  const { m } = member(s);
  Object.assign(m, { skill: 30, startSkill: 30 });
  G.trainPerson(s, "member", m.id);
  assert.equal(m.skill, 32);
});

test("promotions need rank and skill, raise the ceiling, pay and loyalty", () => {
  const { s, head } = ceo();
  Object.assign(head, { skill: 65, startSkill: 60, loyalty: 50, ambition: 60 });
  assert.throws(() => G.promoteHead(s, "ar"), /needs experienced rank and skill 60/);
  head.hiredWeek = s.week - GROWTH.seniority[1].weeks;
  const ceiling = G.skillCeiling(s, head),
    salary = head.salary;
  G.promoteHead(s, "ar");
  assert.equal(head.title, "Senior Head of A&R");
  assert.equal(G.skillCeiling(s, head), ceiling + GROWTH.promotion[0].ceiling);
  assert.equal(head.salary, Math.round(salary * 1.2));
  assert.equal(head.loyalty, 60);
  assert.equal(head.ambition, 50);
  assert.throws(() => G.promoteHead(s, "ar"), /Executive Head of A&R needs seasoned rank and skill 75/);
  head.hiredWeek = s.week - GROWTH.seniority[2].weeks;
  head.skill = 80;
  G.promoteHead(s, "ar");
  assert.equal(head.title, "Executive Head of A&R");
  assert.throws(() => G.promoteHead(s, "ar"), /top title/);
  G.respond(s, "ar", "promote");
  assert.equal(head.title, "Executive Head of A&R", "calming a plot never demotes");
});

test("saves keep the growth fields and refuse broken ones; older saves fill them in", () => {
  const { s, head } = ceo();
  weeks(s, 3);
  assert.ok(G.validSystemsSave(roundTrip(s)));
  const bad = roundTrip(s);
  bad.company.departments.ar.head.promotions = 9;
  assert.equal(G.validSystemsSave(bad), false);
  const old = roundTrip(s);
  for (const k of ["xp", "startSkill", "promotions", "seniority"]) delete old.company.departments.ar.head[k];
  assert.ok(G.validSystemsSave(old));
  assert.equal(G.growthInfo(old, "head", "ar").xp, 0);
  assert.equal(old.company.departments.ar.head.startSkill, head.skill);
});

console.log(`\n${count} staff growth tests passed.`);
