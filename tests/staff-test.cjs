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
  s.company.rivalCardWeek = 1e9; // no rival bids or feuds in these tests
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
  const classic = G.create(31, { ceo: false });
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
  const s = G.migrate(G.create(seed, { ceo: false }));
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
  // These tests are about teams, not tiers: a superstar can have a full team.
  s.artists[0].tier = "superstar";
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
  assert.deepEqual(G.teamSlots(G.create(31, { ceo: false })), [], "classic runs have no team slots");
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

test("Chemistry does not drift as the run's random numbers move on", () => {
  const s = teamRun(),
    a = s.artists[0],
    m = hireMember(s, "producer"),
    shown = G.chemistry(s, a, m).value;
  for (let i = 0; i < 4; i++) settle(s);
  assert.equal(G.chemistry(s, a, m).value, shown);
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
  assert.deepEqual(old.company.team, { pool: [], candidates: {}, nextId: 1, salt: old.company.team.salt });
  assert.ok(Number.isInteger(old.company.team.salt));
});

// ---- Team effects (T15) ----
const { TEAM_EFFECTS } = G;
/** A phase-4 CEO run with one strong artist recording an album. */
function studioRun(seed = 18) {
  const s = ceo(seed, 4);
  s.cash = 900000;
  G.sign(s, s.candidates[0].id, 3);
  s.artists[0].tier = "superstar";
  const a = s.artists[0];
  Object.assign(a, { age: "Adult", talent: 85, potential: 100, fans: 150, fame: 40, energy: 100 });
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience, title: "Team Test" });
  return { s, a, p: s.albums[0] };
}
function clearEvents(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
}
function produce(s, p) {
  for (let guard = 0; guard < 120 && !p.production.releaseReady; guard++) {
    clearEvents(s);
    const d = p.production;
    while (!d.cooldown && !d.releaseReady && (d.stage < 5 || d.review)) {
      if (!d.review) G.decideStage(s, p.id, 0);
      G.continueProduction(s, p.id);
    }
    if (!d.releaseReady) G.advance(s);
  }
  clearEvents(s);
}
/** Hires a member for a role at a set skill and genre fit, and assigns them. */
function assign(s, a, role, skill = 70) {
  const m = hireMember(s, role);
  m.skill = skill;
  m.genres = [a.genre];
  G.assignTeam(s, m.id, a.id);
  return m;
}
/** Expected score for every stage with option 0, without moving the album on. */
function stageScores(s, p) {
  const stage = p.production.stage;
  const out = [0, 1, 2, 3, 4].map((k) => {
    p.production.stage = k;
    return G.stagePreview(s, p, 0);
  });
  p.production.stage = stage;
  return out;
}
const teamRows = (preview) => preview.parts.filter((x) => x.name.startsWith("Team "));

test("Team effect is skill × weight × chemistry × share", () => {
  const { s, a } = studioRun(),
    m = assign(s, a, "producer", 80);
  assert.equal(G.teamEffect(s, a, "producer"), 80 * 1 * G.chemistry(s, a, m).value);
  assert.equal(G.teamEffect(s, a, "publicist"), 0, "an empty slot has no effect");
});

test("Producer and A&R rep each show as a row on their own stages only", () => {
  const { s, a, p } = studioRun(),
    before = stageScores(s, p);
  assert.deepEqual(
    before.map((x) => teamRows(x).map((r) => r.name)),
    [
      [],
      ["Team a&r rep · nobody assigned"],
      ["Team producer · nobody assigned"],
      ["Team producer · nobody assigned"],
      [],
    ],
  );
  const producer = assign(s, a, "producer"),
    withProducer = stageScores(s, p),
    lift = Math.round(G.teamEffect(s, a, "producer") * TEAM_EFFECTS.producer.stagePoints);
  assert.ok(lift > 0);
  for (const k of [0, 1, 4])
    assert.equal(withProducer[k].expected, before[k].expected, `stage ${k} unchanged`);
  for (const k of [2, 3]) {
    assert.deepEqual(teamRows(withProducer[k]), [{ name: `Team producer · ${producer.name}`, value: lift }]);
    assert.equal(withProducer[k].expected, Math.min(100, before[k].expected + lift));
  }
  const rep = assign(s, a, "ar"),
    withRep = stageScores(s, p);
  assert.equal(teamRows(withRep[1])[0].name, `Team a&r rep · ${rep.name}`);
  assert.ok(withRep[1].expected > withProducer[1].expected);
  for (const k of [0, 2, 3, 4]) assert.equal(withRep[k].expected, withProducer[k].expected);
  for (const role of ["publicist", "tour", "manager", "stylist", "business"]) assign(s, a, role);
  assert.deepEqual(
    stageScores(s, p).map((x) => x.expected),
    withRep.map((x) => x.expected),
    "other roles leave the stages alone",
  );
});

test("The publicist adds fame on release and cushions trust losses", () => {
  const base = studioRun();
  produce(base.s, base.p);
  const plain = roundTrip(base.s),
    s = base.s,
    a = base.a,
    m = assign(s, a, "publicist"),
    fame = Math.round(G.teamEffect(s, a, "publicist") * TEAM_EFFECTS.publicist.releaseFame);
  assert.ok(fame > 0);
  const before = a.fame;
  globalThis.DBG = 1;
  console.log("TEST", JSON.stringify(G.chemistry(s, a, m)), a.genre, a.id, m.skill, m.artists);
  G.releaseAlbum(s, base.p.id, base.p.title);
  G.releaseAlbum(plain, plain.albums[0].id, plain.albums[0].title);
  console.log("DBG", before, a.fame, plain.artists[0].fame, base.p.quality, plain.albums[0].quality, fame);
  assert.equal(a.fame - plain.artists[0].fame, fame);
  assert.ok(a.fame >= before + fame);
  assert.equal(m.history[a.id], 1, "an album together counts toward chemistry");
  clearEvents(s);
  clearEvents(plain);
  const scandal = (x) => {
    const artist = x.artists[0];
    artist.trust = 80;
    x.event = {
      id: 999,
      title: "Scandal",
      artist: artist.id,
      options: [{ label: "Ride it out", trust: -20 }],
    };
    G.choose(x, 0);
    return artist.trust;
  };
  const share =
    1 -
    Math.min(
      TEAM_EFFECTS.publicist.defenceMax,
      G.teamEffect(s, a, "publicist") * TEAM_EFFECTS.publicist.defence,
    );
  assert.equal(scandal(plain), 60);
  assert.equal(scandal(s), 80 + Math.ceil(-20 * share));
  assert.ok(scandal(s) > 60);
});

test("The tour manager raises ticket revenue and saves energy on the road", () => {
  const base = studioRun();
  produce(base.s, base.p);
  G.releaseAlbum(base.s, base.p.id, base.p.title);
  base.p.launchReview = false;
  base.p.chart.best = 5;
  clearEvents(base.s);
  const plain = roundTrip(base.s),
    s = base.s;
  assign(s, base.a, "tour");
  const scores = (x) => stageScores(x, x.albums[0]).map((y) => y.expected);
  assert.deepEqual(scores(s), scores(plain), "the tour manager leaves the stages alone");
  const tour = (x) => {
    x.artists[0].energy = 100;
    const t = G.startTour(x, {
      albumId: x.albums[0].id,
      scale: "regional",
      mode: "solo",
      rivalId: x.rivalArtists[0].id,
    });
    for (let i = 0; i < 10 && t.status === "active"; i++) {
      clearEvents(x);
      G.advanceTourDay(x);
    }
    clearEvents(x);
    return { t, energy: x.artists[0].energy, fame: x.artists[0].fame };
  };
  const a = tour(plain),
    b = tour(s);
  assert.ok(b.t.teamGate > 1);
  assert.equal(a.t.teamGate, 1, "no tour manager, no lift");
  assert.ok(b.t.revenue > a.t.revenue, "more ticket revenue");
  assert.ok(b.energy > a.energy, "less energy drain");
});

// ---- Traits, wants and morale (T16) ----
const { TRAITS, WANTS, WANT_MORALE, WALKOUT } = G;
/** A CEO run with one signed artist whose main want is set for the test. */
function moodRun(want, seed = 31) {
  const s = teamRun(3, seed),
    a = s.artists[0];
  G.artistMood(s, a);
  a.persona.want = want;
  a.morale = 60;
  return { s, a };
}
/** Settles a week with the artist idle and nothing else moving their morale. */
function idleWeek(s, a) {
  const before = a.morale;
  settle(s);
  return a.morale - before;
}

test("Every artist gets fixed traits and one main want", () => {
  const s = teamRun(3),
    a = s.artists[0],
    mood = G.artistMood(s, a);
  for (const id of TRAITS.ids) assert.ok(mood.traits[id] >= TRAITS.min && mood.traits[id] <= TRAITS.max);
  assert.ok(Object.keys(WANTS).includes(mood.want));
  for (let i = 0; i < 3; i++) settle(s);
  assert.deepEqual(G.artistMood(s, a).traits, mood.traits, "traits do not change");
  const wants = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const x = teamRun(1, seed);
    wants.add(G.artistMood(x, x.artists[0]).want);
  }
  assert.deepEqual([...wants].sort(), Object.keys(WANTS).sort(), "all four wants occur");
  assert.equal(
    G.create(31, { ceo: false }).artists.every((x) => !x.persona),
    true,
    "classic artists have no persona",
  );
});

test("Money: a bonus meets the want for a while; without one morale falls", () => {
  const { s, a } = moodRun("money"),
    ignored = G.artistMood(s, a).weekly;
  assert.equal(G.wantStatus(s, a), "ignored");
  assert.ok(ignored < 0);
  const cash = s.cash;
  G.payBonus(s, a.id);
  assert.equal(s.cash, cash - G.bonusCost(a));
  assert.equal(G.wantStatus(s, a), "met");
  a.persona.bonusWeek = s.week - WANTS.money.window;
  assert.equal(G.wantStatus(s, a), "ignored", "the bonus wears off");
});

test("Creative control: met only when the latest album follows the artist's vision", () => {
  const { s, a } = moodRun("control");
  assert.equal(G.wantStatus(s, a), "neutral", "nothing to judge before a record");
  G.record(s, { artistId: a.id, boothId: 0, genre: a.genre, audience: a.audience });
  const p = s.albums.at(-1);
  G.decideStage(s, p.id, 1);
  assert.equal(p.production.results[0].choice, "Follow the current wave");
  assert.equal(G.wantStatus(s, a), "ignored");
  p.production.results[0].choice = WANTS.control.choice;
  assert.equal(G.wantStatus(s, a), "met");
});

test("Fame: judged each quarter by how much the artist's fame rose", () => {
  const { s, a } = moodRun("fame");
  assert.equal(G.wantStatus(s, a), "met", "a fresh artist gets the benefit of the doubt");
  a.persona.fameMark = a.fame;
  for (let i = 0; i < WANTS.fame.window; i++) settle(s);
  a.fame = Math.min(a.fame, WANTS.fame.star - 1);
  a.persona.fameMark = a.fame;
  for (let i = 0; i < WANTS.fame.window; i++) settle(s);
  assert.equal(a.persona.fameMet, false);
  assert.equal(G.wantStatus(s, a), "ignored");
  a.fame = a.persona.fameMark + WANTS.fame.gain;
  for (let i = 0; i < WANTS.fame.window; i++) settle(s);
  assert.equal(G.wantStatus(s, a), "met");
});

test("Family time: too many busy weeks in a row, until they rest", () => {
  const { s, a } = moodRun("family");
  assert.equal(G.wantStatus(s, a), "met");
  a.persona.busyWeeks = WANTS.family.maxBusy;
  assert.equal(G.wantStatus(s, a), "ignored");
  for (let i = 0; i < WANTS.family.rest; i++) settle(s);
  assert.equal(a.persona.busyWeeks, 0);
  assert.equal(G.wantStatus(s, a), "met");
});

test("Weekly morale follows the want, scaled by ego and loyalty", () => {
  const { s, a } = moodRun("money");
  Object.assign(a.persona, { ego: 90, loyalty: 15 });
  const proud = G.artistMood(s, a).weekly;
  Object.assign(a.persona, { ego: 15, loyalty: 90 });
  const easy = G.artistMood(s, a).weekly;
  assert.equal(
    proud,
    -Math.round(WANT_MORALE.ignored + 90 * WANT_MORALE.egoWeight - 15 * WANT_MORALE.loyaltyWeight),
  );
  assert.ok(proud < easy && easy <= -1);
  G.payBonus(s, a.id);
  assert.equal(G.artistMood(s, a).weekly, WANT_MORALE.met);
});

test("Morale stays between 0 and 100 however long a want is met or ignored", () => {
  const met = moodRun("family");
  met.a.morale = 99;
  for (let i = 0; i < 6; i++) settle(met.s);
  assert.equal(met.a.morale, 100);
  const low = moodRun("money");
  low.a.contract.remaining = 2;
  low.a.morale = 3;
  for (let i = 0; i < 6; i++) settle(low.s);
  assert.ok(low.a.morale >= 0 && low.a.morale <= 100);
});

test("An unhappy artist walks out when their contract is complete", () => {
  const { s, a } = moodRun("money");
  a.persona.loyalty = 20;
  a.contract.remaining = 1;
  a.morale = 10;
  settle(s);
  assert.ok(s.artists.includes(a), "albums still owed: they stay, however unhappy");
  assert.equal(G.artistMood(s, a).unhappy, true);
  a.contract.remaining = 0;
  a.morale = WALKOUT.walkOut + 10;
  G.payBonus(s, a.id);
  settle(s);
  assert.ok(s.artists.includes(a), "happy enough: they stay to talk about a new deal");
  a.morale = WALKOUT.walkOut - 5;
  assert.throws(() => G.renew(s, a.id, 3), /will not re-sign/);
  s.notifications = [];
  settle(s);
  assert.ok(!s.artists.includes(a), "walked out");
  assert.equal(s.notifications.at(-1).kind, "walkout");
});

test("Loyal artists give the label more room before walking out", () => {
  const { s, a } = moodRun("family");
  a.contract.remaining = 0;
  a.persona.loyalty = WALKOUT.loyal;
  a.morale = WALKOUT.walkOut - 5;
  assert.equal(G.walksOut(s, a), false);
  a.morale = WALKOUT.walkOut - WALKOUT.loyalGrace - 1;
  assert.equal(G.walksOut(s, a), true);
});

test("Personas survive a save and bad ones are rejected", () => {
  const { s, a } = moodRun("fame");
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  G.migrate(copy);
  assert.deepEqual(copy.artists[0].persona, a.persona);
  copy.artists[0].persona.want = "yacht";
  assert.equal(G.validSystemsSave(copy), false);
});

// ---- Power grabs (T24) ----
const { GRAB, CEO_INFLUENCE, RESPONSES } = G;
/** A phase-3 run with an angel board and a Head of A&R whose stats are set for the test. */
function grabRun(seed = 31, stats = { ambition: 100, influence: 100, loyalty: 0 }) {
  const s = ceo(seed, 2);
  s.cash = 1e6;
  G.takeFunding(s, "angel", 0);
  s.company.phase = 3;
  G.takeFunding(s, "venture", 0);
  const x = hire(s, "ar");
  Object.assign(x, stats);
  return { s, x };
}
/** First seed whose first quarterly check starts a grab, or null. */
function grabbingSeed(from, to) {
  for (let seed = from; seed < to; seed++) {
    const { s, x } = grabRun(seed);
    G.grabQuarter(s);
    if (x.plot) return seed;
  }
  return null;
}

test("Grab chance follows design 4 and your influence", () => {
  const { s, x } = grabRun();
  assert.equal(G.ceoInfluence(s), CEO_INFLUENCE.base + 3 * CEO_INFLUENCE.perPhase);
  Object.assign(x, { ambition: 80, influence: 60, loyalty: 20 });
  assert.equal(G.grabChance(s, x), ((80 + 60 - 20 - 90) / 200) * (1 - G.ceoInfluence(s) / 200));
  Object.assign(x, { ambition: 40, influence: 20, loyalty: 60 });
  assert.equal(G.grabChance(s, x), 0, "loyal and content: no grab");
  Object.assign(x, { ambition: 100, influence: 100, loyalty: 0 });
  const before = G.grabChance(s, x);
  s.company.board.perks = ["car", "penthouse"];
  assert.ok(G.grabChance(s, x) < before, "perks make you harder to topple");
  x.calmUntil = s.week + 5;
  assert.equal(G.grabChance(s, x), 0, "calm while promoted or placated");
});

test("A grab can be forced by seed, and the same seed always does the same thing", () => {
  const seed = grabbingSeed(1, 60);
  assert.notEqual(seed, null, "some seed starts a grab");
  const a = grabRun(seed),
    b = grabRun(seed);
  G.grabQuarter(a.s);
  G.grabQuarter(b.s);
  assert.deepEqual(a.x.plot, b.x.plot);
  assert.deepEqual(a.x.contacts, b.x.contacts);
  assert.equal(grabbingSeed(1, 60), seed);
  const calm = grabRun(seed, { ambition: 10, influence: 10, loyalty: 90 });
  G.grabQuarter(calm.s);
  assert.equal(calm.x.plot, undefined, "no drive, no grab, whatever the seed");
});

test("A grab starts as gossip in the Inbox, two quarters before it comes to a head", () => {
  const seed = grabbingSeed(1, 60),
    { s, x } = grabRun(seed);
  s.notifications = [];
  G.grabQuarter(s);
  assert.equal(x.plot.due, s.week + GRAB.warnWeeks);
  const n = s.notifications.at(-1);
  assert.equal(n.kind, "gossip");
  assert.match(n.title, new RegExp(x.name));
  assert.equal(x.contacts.length, 1, "they start courting a director");
  const influence = x.influence;
  G.grabQuarter(s);
  assert.equal(x.contacts.length, 2, "one more director a quarter");
  assert.equal(x.influence, Math.min(100, influence + GRAB.perQuarter + 2 * GRAB.perContact));
});

test("The quarterly check runs at the settlement every 13 weeks", () => {
  const { s, x } = grabRun(31, { ambition: 30, influence: 10, loyalty: 80 });
  const influence = x.influence;
  while (s.week % GRAB.quarter !== GRAB.quarter - 1) settle(s);
  settle(s);
  assert.equal(x.influence, influence + GRAB.perQuarter);
});

/** A run with a head already plotting and courting two directors. */
function plotting() {
  const { s, x } = grabRun();
  x.contacts = s.company.board.directors.slice(0, 2).map((d) => d.id);
  x.plot = { since: s.week, due: s.week + GRAB.warnWeeks };
  return { s, x };
}

test("Promote: a title, a raise, less ambition, calm for a year, and the plot ends", () => {
  const { s, x } = plotting(),
    salary = x.salary;
  G.respond(s, "ar", "promote");
  assert.equal(x.salary, Math.round(salary * (1 + RESPONSES.promote.raise)));
  assert.equal(x.title, "Senior Head of A&R");
  assert.equal(x.ambition, 100 + RESPONSES.promote.ambition);
  assert.equal(x.calmUntil, s.week + RESPONSES.promote.calmWeeks);
  assert.equal(x.plot, undefined);
  assert.equal(G.grabChance(s, x), 0);
});

test("Placate: a bonus buys a quarter and pushes the plot back", () => {
  const { s, x } = plotting(),
    cash = s.cash,
    due = x.plot.due;
  G.respond(s, "ar", "placate");
  assert.equal(s.cash, cash - x.salary * RESPONSES.placate.bonusWeeks);
  assert.equal(x.plot.due, due + RESPONSES.placate.calmWeeks, "the plot is delayed, not ended");
  assert.equal(x.calmUntil, s.week + RESPONSES.placate.calmWeeks);
});

test("Sideline: moved to an open department, with less influence and less loyalty", () => {
  const { s, x } = plotting();
  x.loyalty = 40;
  x.influence = 70;
  assert.throws(() => G.respond(s, "ar", "sideline", "creative"), /not open yet/);
  G.respond(s, "ar", "sideline", "live");
  assert.equal(s.company.departments.ar.head, null);
  assert.equal(s.company.departments.live.head, x);
  assert.equal(x.influence, 70 + RESPONSES.sideline.influence);
  assert.equal(x.loyalty, 40 + RESPONSES.sideline.loyalty);
  assert.equal(x.plot, undefined);
});

test("Fire: severance, and the directors they courted think less of you", () => {
  const { s, x } = plotting(),
    [d1, d2, d3] = s.company.board.directors,
    cash = s.cash;
  G.respond(s, "ar", "fire");
  assert.equal(s.cash, cash - x.salary * G.EXEC_PAY.severanceWeeks);
  assert.equal(s.company.departments.ar.head, null);
  assert.equal(d1.relationship, -RESPONSES.fire.contactPenalty);
  assert.equal(d2.relationship, -RESPONSES.fire.contactPenalty);
  assert.equal(d3.relationship, 0, "a director they never courted does not mind");
});

test("Counter: win their board contacts back, at the cost of your week", () => {
  const { s, x } = plotting(),
    cash = s.cash,
    influence = x.influence;
  G.respond(s, "ar", "counter");
  assert.equal(s.cash, cash - RESPONSES.counter.costPerPhase * 3);
  assert.deepEqual(x.contacts, []);
  assert.equal(x.influence, influence - 2 * RESPONSES.counter.perContact);
  assert.equal(x.plot, undefined);
  assert.equal(s.company.board.meetingWeek, s.week);
  assert.throws(() => G.respond(s, "ar", "counter"), /no board contacts/);
  const busy = plotting();
  busy.s.company.board.meetingWeek = busy.s.week;
  assert.throws(() => G.respond(busy.s, "ar", "counter"), /this week's time/);
});

test("Plots survive a save", () => {
  const { s } = plotting();
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  copy.company.departments.ar.head.plot = { due: -3 };
  assert.equal(G.validSystemsSave(copy), false);
});

// ---- How a grab ends (T25) ----
const { GRAB_END } = G;
/** A plotting head with `contacts` of the board's seats courted and a given influence. */
function headToHead(contacts, influence) {
  const { s, x } = grabRun();
  x.contacts = s.company.board.directors.slice(0, contacts).map((d) => d.id);
  x.influence = influence;
  x.plot = { since: s.week, due: s.week + 1 };
  return { s, x };
}

test("A grab without enough of the board fails; they leave and try to take the least loyal artist", () => {
  const { s, x } = headToHead(1, 100);
  G.sign(s, s.candidates[0].id);
  G.sign(s, s.candidates[0].id);
  const [a, b] = s.artists;
  G.artistMood(s, a);
  G.artistMood(s, b);
  a.persona.loyalty = 20;
  b.persona.loyalty = 80;
  assert.equal(G.grabResult(s, x), "failed", "1 of 3 seats is not a majority");
  const o = G.resolveGrab(s, "ar");
  assert.deepEqual([o.kind, o.artist, o.artistLeft], ["failed", a.name, true]);
  assert.ok(!s.artists.includes(a), "the disloyal artist went with them");
  assert.ok(s.artists.includes(b));
  assert.equal(s.company.departments.ar.head, null);
  assert.equal(s.finished, false);
});

test("A loyal artist stays when a failed plotter tries to take them", () => {
  const { s, x } = headToHead(0, 100);
  G.sign(s, s.candidates[0].id);
  const a = s.artists[0];
  G.artistMood(s, a);
  a.persona.loyalty = GRAB_END.poachLoyalty;
  const o = G.resolveGrab(s, "ar");
  assert.deepEqual([o.kind, o.artist, o.artistLeft], ["failed", a.name, false]);
  assert.ok(s.artists.includes(a));
  assert.equal(x.name, o.exec);
});

test("Backing without more influence than you still fails", () => {
  const { s, x } = headToHead(3, 10);
  assert.ok(x.influence < G.ceoInfluence(s));
  assert.equal(G.grabResult(s, x), "failed");
});

test("A majority and more influence makes them co-CEO, and your freedom splits", () => {
  const { s, x } = headToHead(2, G.ceoInfluence(grabRun().s) + 5);
  s.company.board.freedom = "high";
  s.company.board.confidence = 80;
  assert.equal(G.grabResult(s, x), "coCeo");
  const o = G.resolveGrab(s, "ar");
  assert.equal(o.kind, "coCeo");
  assert.deepEqual(s.company.coCeo, { name: x.name, since: s.week });
  assert.equal(s.company.board.freedom, "medium", "one step lower now");
  assert.equal(s.finished, false);
  for (const d of s.company.board.directors) {
    d.relationship = 0;
    d.relationship = 80 - G.satisfaction(s, d).value;
  }
  G.runReview(s);
  assert.equal(s.company.board.freedom, "medium", "and at every review: 80 confidence would be high");
});

test("Every seat and far more influence takes the chair: the run ends", () => {
  const { s, x } = headToHead(3, 100);
  assert.ok(x.influence >= G.ceoInfluence(s) + GRAB_END.chairMargin);
  const o = G.resolveGrab(s, "ar");
  assert.equal(o.kind, "chair");
  assert.equal(s.finished, true);
  assert.equal(s.ousted, true);
  assert.match(s.outcome, /^Ousted/);
  assert.throws(() => G.advance(s), /season has ended/);
});

test("A grab comes to a head at the settlement in its due week, and the outcome is kept for the card", () => {
  const { s, x } = headToHead(1, 50);
  x.plot.due = s.week + 2;
  settle(s);
  assert.ok(x.plot, "not yet");
  settle(s);
  assert.equal(s.company.departments.ar.head, null);
  assert.equal(s.company.grabOutcome.kind, "failed");
  assert.equal(s.company.grabOutcome.seen, false);
  G.ackGrab(s);
  assert.equal(s.company.grabOutcome.seen, true);
  const copy = roundTrip(s);
  assert.equal(G.validSystemsSave(copy), true);
  copy.company.grabOutcome.kind = "coup";
  assert.equal(G.validSystemsSave(copy), false);
});

console.log(`${count} staff tests passed.`);
