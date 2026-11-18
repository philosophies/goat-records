// Departments and executives (2.0): hiring heads, department staff, salaries and severance.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const { DEPARTMENTS, EXEC_POOL, EXEC_PAY, DEPT_STAFF } = G;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));
function ceo(seed = 31, phase = 1) {
  const s = G.create(seed, { ceo: true });
  s.cash = 200000;
  s.company.phase = phase;
  return s;
}
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
function hire(s, id) {
  const pool = G.recruitExecs(s, id);
  return G.hireHead(s, id, pool[0].id);
}

test("CEO runs start with every department empty; classic runs have none", () => {
  const s = ceo();
  assert.deepEqual(Object.keys(s.company.departments).sort(), DEPARTMENTS.map((d) => d.id).sort());
  for (const d of Object.values(s.company.departments))
    assert.deepEqual(d, { head: null, staff: 0, pool: [] });
  assert.equal(G.departmentPay(s), 0);
  const classic = G.create(31);
  assert.equal(classic.company, undefined);
  assert.throws(() => G.recruitExecs(classic, "ar"), /CEO run/);
});

test("A recruitment drive costs money and finds candidates within the phase's reach", () => {
  const s = ceo(31, 1),
    before = s.cash,
    pool = G.recruitExecs(s, "ar");
  assert.equal(s.cash, before - EXEC_POOL.recruitCost);
  assert.equal(pool.length, EXEC_POOL.size);
  const [lo, hi] = EXEC_POOL.skill.local;
  for (const c of pool) {
    assert.ok(c.skill >= lo && c.skill <= hi, "skill within local reach");
    assert.equal(c.salary, EXEC_PAY.base + c.skill * EXEC_PAY.perSkill);
    for (const k of ["ambition", "loyalty", "influence"]) assert.ok(c[k] >= 0 && c[k] <= 100);
  }
  const world = ceo(31, 6);
  for (const c of G.recruitExecs(world, "ar")) assert.ok(c.skill >= EXEC_POOL.skill.world[0]);
});

test("Departments open by phase", () => {
  const s = ceo(31, 1);
  assert.throws(() => G.recruitExecs(s, "marketing"), /opens at phase 2/);
  assert.throws(() => G.recruitExecs(s, "creative"), /opens at phase 4/);
  assert.throws(() => G.recruitExecs(s, "nope"), /Unknown department/);
  s.company.phase = 4;
  assert.equal(G.recruitExecs(s, "creative").length, EXEC_POOL.size);
});

test("Hiring a head pays the signing cost and gives the department capacity", () => {
  const s = ceo(),
    pool = G.recruitExecs(s, "ar"),
    c = pool[1],
    before = s.cash;
  assert.equal(G.capacity(s, "ar"), 0);
  const head = G.hireHead(s, "ar", c.id);
  assert.equal(head.name, c.name);
  assert.equal(s.cash, before - c.salary * EXEC_PAY.signWeeks);
  assert.equal(s.company.departments.ar.pool.length, EXEC_POOL.size - 1);
  assert.equal(G.capacity(s, "ar"), 1);
  assert.throws(() => G.hireHead(s, "ar", pool[0].id), /already has a head/);
  assert.throws(() => G.hireHead(s, "ar", 999), /not in this department's pool/);
});

test("Staff need a head and are capped by phase", () => {
  const s = ceo(31, 2);
  assert.throws(() => G.addStaff(s, "ar"), /Hire a Head of A&R/);
  hire(s, "ar");
  const before = s.cash;
  for (let i = 0; i < G.maxStaff(s); i++) G.addStaff(s, "ar");
  assert.equal(G.maxStaff(s), DEPT_STAFF.perPhase * 2);
  assert.equal(s.cash, before - DEPT_STAFF.hireFee * G.maxStaff(s));
  assert.equal(G.capacity(s, "ar"), 1 + G.maxStaff(s));
  assert.throws(() => G.addStaff(s, "ar"), /at its size for this phase/);
  G.removeStaff(s, "ar");
  assert.equal(G.capacity(s, "ar"), G.maxStaff(s));
});

test("Salaries are paid at the weekly settlement", () => {
  const s = ceo(31, 2);
  const head = hire(s, "ar");
  G.addStaff(s, "ar");
  G.addStaff(s, "ar");
  const pay = head.salary + 2 * DEPT_STAFF.salary;
  assert.equal(G.departmentPay(s), pay);
  const without = roundTrip(s);
  without.company.departments.ar = { head: null, staff: 0, pool: [] };
  assert.equal(G.upkeep(s) - G.upkeep(without), pay);
  settle(s);
  settle(without);
  assert.equal(s.financeHistory.at(-1).overhead - without.financeHistory.at(-1).overhead, pay);
});

test("Letting a head go costs severance, can go below $0, and empties the job", () => {
  const s = ceo();
  const head = hire(s, "ar");
  s.cash = 100;
  G.fireHead(s, "ar");
  assert.equal(s.cash, 100 - head.salary * EXEC_PAY.severanceWeeks);
  assert.equal(s.company.departments.ar.head, null);
  assert.equal(G.capacity(s, "ar"), 0);
  assert.throws(() => G.fireHead(s, "ar"), /has no head/);
});

test("Departments survive a save and bad department data is rejected", () => {
  const s = ceo(31, 3);
  hire(s, "ar");
  hire(s, "finance");
  G.addStaff(s, "finance");
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  G.migrate(copy);
  assert.deepEqual(copy.company.departments, s.company.departments);
  const bad = (f) => {
    const x = roundTrip(s);
    f(x);
    return G.validSystemsSave(x);
  };
  assert.equal(
    bad((x) => (x.company.departments.ar.staff = -1)),
    false,
  );
  assert.equal(
    bad((x) => (x.company.departments.ar.head.loyalty = 140)),
    false,
  );
  assert.equal(
    bad((x) => (x.company.departments.mystery = { head: null, staff: 0, pool: [] })),
    false,
  );
  assert.equal(
    bad((x) => (x.company.departments.ar.pool = null)),
    false,
  );
});

test("A CEO save from before departments gains them on load", () => {
  const s = ceo(),
    old = roundTrip(s);
  delete old.company.departments;
  delete old.company.nextExecId;
  assert.equal(G.validSystemsSave(old), true);
  G.migrate(old);
  assert.equal(Object.keys(old.company.departments).length, DEPARTMENTS.length);
  assert.equal(old.company.nextExecId, 1);
});

// A classic run with all six roles, recorded and released over three seeds. The hash was taken
// from 1.1 code before role effects went through roleSkill; it must not change.
function classicFingerprint(seed) {
  const s = G.migrate(G.create(seed));
  s.cash = 500000;
  for (const r of ["Producer", "A&R", "Marketing", "Public Relations", "VP", "Artist Development"])
    G.hire(s, r);
  G.sign(s, s.candidates[0].id);
  G.record(s, { artistId: s.artists[0].id, boothId: 0, genre: "Pop", audience: "Adult" });
  const p = s.albums[0],
    previews = [];
  for (let guard = 0; guard < 120 && !p.released; guard++) {
    while (s.event) G.choose(s, 2);
    const d = p.production;
    if (p.launchReview) p.launchReview = false;
    else if (d.releaseReady) {
      G.releaseAlbum(s, p.id, p.title);
      p.launchReview = false;
    } else if (!d.cooldown) {
      if (!d.review) {
        previews.push(G.stagePreview(s, p, guard % 3).parts.map((x) => x.value));
        G.decideStage(s, p.id, guard % 3);
      }
      G.continueProduction(s, p.id);
    }
    if (!p.released) G.advance(s);
  }
  for (let i = 0; i < 20; i++) {
    while (s.event) G.choose(s, s.event.options.length - 1);
    G.advance(s);
  }
  return JSON.stringify({
    results: p.production.results,
    quality: p.quality,
    previews,
    upkeep: G.upkeep(s),
    cash: s.cash,
    prospects: JSON.stringify(s.candidates.map((c) => [c.fee, c.wage])),
    fin: s.financeHistory.slice(-5),
  });
}

test("Classic runs keep 1.1's stage scores, costs and sales with every role hired", () => {
  const hash = require("node:crypto")
    .createHash("sha256")
    .update([3, 41, 77].map(classicFingerprint).join("|"))
    .digest("hex");
  assert.equal(hash, "4aae5a51678b23244fcdad1fba87e0191946cf781836e31cfc8712e961372640");
});

test("Each 1.x role is carried by one department head", () => {
  assert.deepEqual(G.ROLE_DEPARTMENT, {
    Producer: "ar",
    "A&R": "ar",
    Marketing: "marketing",
    "Public Relations": "promotion",
    VP: "finance",
    "Artist Development": "creative",
  });
  for (const id of Object.values(G.ROLE_DEPARTMENT)) assert.ok(DEPARTMENTS.some((d) => d.id === id));
});

test("A CEO run with a Head of A&R gets the A&R and Producer bonuses", () => {
  const s = ceo(31, 1),
    a = s.candidates[0],
    before = G.contractQuote(s, a);
  assert.equal(G.hasRole(s, "A&R"), false);
  assert.equal(G.staffBonus(s, "A&R"), 0);
  const head = hire(s, "ar");
  assert.equal(G.hasRole(s, "A&R"), true);
  assert.equal(G.roleSkill(s, "A&R"), head.skill);
  assert.equal(G.roleSkill(s, "Producer"), head.skill);
  assert.equal(G.staffBonus(s, "A&R"), Math.round(6 + head.skill / 10));
  assert.ok(G.contractQuote(s, a).fee < before.fee, "the A&R discount lowers the signing fee");
  assert.equal(G.hasRole(s, "Marketing"), false, "other departments are still empty");
  G.fireHead(s, "ar");
  assert.equal(G.staffBonus(s, "A&R"), 0);
});

test("A role uses the better of a hired employee and the department head", () => {
  const s = ceo(31, 3);
  G.hire(s, "VP");
  const employee = s.employees.VP.skill;
  assert.equal(G.roleSkill(s, "VP"), employee);
  const head = hire(s, "finance");
  assert.equal(G.roleSkill(s, "VP"), Math.max(employee, head.skill));
});

// ---- Artist teams (T14) ----
const { TEAM_ROLES, TEAM_POOL, CHEMISTRY } = G;
function teamRun(phase = 1, seed = 31) {
  const s = ceo(seed, phase);
  G.sign(s, s.candidates[0].id);
  return s;
}
function hireMember(s, role, pick = 0) {
  return G.hireTeam(s, role, G.recruitTeam(s, role)[pick].id);
}

test("Team slots open by phase", () => {
  const ids = (s) => G.teamSlots(s).map((r) => r.id);
  assert.deepEqual(ids(ceo(31, 1)), ["manager", "producer"]);
  assert.deepEqual(ids(ceo(31, 2)), ["manager", "producer", "ar"]);
  assert.deepEqual(ids(ceo(31, 3)), ["manager", "producer", "ar", "publicist", "stylist", "tour"]);
  assert.deepEqual(
    ids(ceo(31, 4)),
    TEAM_ROLES.map((r) => r.id),
  );
  assert.deepEqual(G.teamSlots(G.create(31)), [], "classic runs have no team slots");
  const s = ceo(31, 1);
  assert.throws(() => G.recruitTeam(s, "publicist"), /phase 3/);
  assert.throws(() => G.recruitTeam(s, "drummer"), /Unknown team role/);
});

test("Hiring puts a member in the pool at a cost and adds their salary to weekly costs", () => {
  const s = teamRun(),
    before = s.cash,
    list = G.recruitTeam(s, "producer");
  assert.equal(list.length, TEAM_POOL.size);
  assert.equal(s.cash, before - TEAM_POOL.recruitCost);
  const [lo, hi] = TEAM_POOL.skill.local;
  for (const c of list) {
    assert.ok(c.skill >= lo && c.skill <= hi);
    assert.equal(c.salary, TEAM_POOL.salary + c.skill * TEAM_POOL.perSkill);
    assert.ok(c.genres.length >= 1 && c.genres.length <= 2);
  }
  const upkeep = G.upkeep(s),
    cash = s.cash,
    m = G.hireTeam(s, "producer", list[0].id);
  assert.equal(s.cash, cash - m.salary * TEAM_POOL.signWeeks);
  assert.equal(G.upkeep(s) - upkeep, m.salary);
  assert.equal(s.company.team.pool.length, 1);
  assert.equal(s.company.team.candidates.producer.length, TEAM_POOL.size - 1);
});

test("Each artist has one member per role; assigning replaces the old one", () => {
  const s = teamRun(),
    a = s.artists[0],
    first = hireMember(s, "producer", 0),
    second = hireMember(s, "producer", 0);
  G.assignTeam(s, first.id, a.id);
  assert.equal(G.teamMember(s, a.id, "producer").id, first.id);
  G.assignTeam(s, second.id, a.id);
  assert.equal(G.teamMember(s, a.id, "producer").id, second.id);
  assert.deepEqual(first.artists, []);
  const slots = G.artistTeam(s, a.id);
  assert.deepEqual(
    slots.map((x) => x.role.id),
    ["manager", "producer"],
  );
  assert.equal(slots[0].member, null);
  assert.equal(slots[1].member.id, second.id);
  assert.throws(() => G.assignTeam(s, second.id, a.id), /already works with/);
});

test("A member can serve two artists at the shared effect, never three", () => {
  const s = teamRun();
  // Two more artists without the roster cap, which is not what this test is about.
  for (const c of s.candidates.slice(0, 2)) s.artists.push({ ...c, contract: { remaining: 1 } });
  const [a, b, c] = s.artists,
    m = hireMember(s, "manager");
  G.assignTeam(s, m.id, a.id);
  assert.equal(G.teamShare(m), 1);
  G.assignTeam(s, m.id, b.id);
  assert.equal(G.teamShare(m), TEAM_POOL.sharedEffect);
  assert.equal(G.artistTeam(s, a.id)[0].share, TEAM_POOL.sharedEffect);
  assert.throws(() => G.assignTeam(s, m.id, c.id), /already serves 2 artists/);
  G.unassignTeam(s, m.id, b.id);
  assert.equal(G.teamShare(m), 1);
});

test("Chemistry stays within its range and is the same before and after assigning", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const s = teamRun(4, seed),
      a = s.artists[0];
    for (const role of ["manager", "producer", "publicist"]) {
      for (const c of G.recruitTeam(s, role)) {
        const shown = G.chemistry(s, a, c);
        assert.ok(shown.value >= CHEMISTRY.min && shown.value <= CHEMISTRY.max, `chemistry ${shown.value}`);
        assert.equal(shown.parts.length, 3);
      }
      const m = G.hireTeam(s, role, s.company.team.candidates[role][0].id),
        preview = G.chemistry(s, a, m).value;
      assert.equal(G.assignTeam(s, m.id, a.id).value, preview);
    }
  }
  const s = teamRun(),
    a = s.artists[0],
    m = hireMember(s, "producer");
  m.genres = [a.genre];
  const match = G.chemistry(s, a, m).value;
  m.genres = [a.genre === "Pop" ? "Rock" : "Pop"];
  assert.ok(match > G.chemistry(s, a, m).value, "genre fit raises chemistry");
  const low = G.chemistry(s, a, m).value;
  m.history[a.id] = 2;
  assert.ok(G.chemistry(s, a, m).value > low || low === CHEMISTRY.max, "albums together raise chemistry");
  m.history[a.id] = 99;
  m.genres = [a.genre];
  assert.ok(G.chemistry(s, a, m).value <= CHEMISTRY.max);
});

test("Team pools and chemistry are the same for the same seed", () => {
  const build = (seed) => {
    const s = teamRun(3, seed);
    const list = ["manager", "producer", "tour"].map((r) => hireMember(s, r));
    return list.map((m) => [m.name, m.skill, m.genres, m.style, G.chemistry(s, s.artists[0], m).value]);
  };
  assert.deepEqual(build(55), build(55));
  assert.notDeepEqual(build(55), build(56));
});

test("Artists who leave drop off their team members, and teams survive a save", () => {
  const s = teamRun(),
    a = s.artists[0],
    m = hireMember(s, "manager");
  G.assignTeam(s, m.id, a.id);
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  G.migrate(copy);
  assert.deepEqual(copy.company.team, s.company.team);
  s.artists = [];
  settle(s);
  assert.deepEqual(m.artists, []);
  const bad = (f) => {
    const x = roundTrip(copy);
    f(x);
    return G.validSystemsSave(x);
  };
  assert.equal(
    bad((x) => (x.company.team.pool[0].role = "chef")),
    false,
  );
  assert.equal(
    bad((x) => (x.company.team.pool[0].artists = [1, 2, 3])),
    false,
  );
  assert.equal(
    bad((x) => (x.company.team.pool[0].genres = ["Polka"])),
    false,
  );
  assert.equal(
    bad((x) => (x.company.team.candidates.drummer = [])),
    false,
  );
  const old = roundTrip(copy);
  delete old.company.team;
  assert.equal(G.validSystemsSave(old), true);
  G.migrate(old);
  assert.deepEqual(old.company.team, { pool: [], candidates: {}, nextId: 1 });
});

console.log(`${count} staff tests passed.`);
