// People's names: a larger pool, and no two people at the label share a name.
const assert = require("node:assert/strict"),
  G = require("../src/engine.js"),
  D = require("../src/data/core.js");
let count = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  count++;
}
const clone = (s) => JSON.parse(JSON.stringify(s));
function settle(s) {
  while (s.event) G.choose(s, s.event.options.length - 1);
  for (const x of [...(s.company?.inbox || [])]) G.decide?.(s, x.id, 0);
  G.advance(s);
  while (s.event) G.choose(s, s.event.options.length - 1);
}
/** Every person at the label, with where they are. */
function people(s) {
  const out = [],
    add = (where, list) => (list || []).forEach((x) => x && out.push({ where, name: x.name })),
    c = s.company;
  add("artist", s.artists);
  add("prospect", s.candidates);
  add("staff", Object.values(s.employees || {}));
  for (const list of Object.values(s.staffCandidates || {})) add("staff candidate", list);
  for (const d of Object.values(c?.departments || {})) {
    add("head", [d.head]);
    add("head candidate", d.pool);
  }
  add("team", c?.team?.pool);
  for (const list of Object.values(c?.team?.candidates || {})) add("team candidate", list);
  add("director", c?.board?.directors);
  return out;
}
function assertUnique(s, label) {
  const seen = new Map();
  for (const p of people(s)) {
    assert.ok(!seen.has(p.name), `${label}: ${p.name} is both a ${seen.get(p.name)} and a ${p.where}`);
    seen.set(p.name, p.where);
  }
  return seen.size;
}

test("The name pool has 60 first and 60 last names, with no repeats", () => {
  assert.equal(D.NAME_FIRST.length, 60);
  assert.equal(D.NAME_LAST.length, 60);
  assert.equal(new Set(D.NAME_FIRST).size, 60);
  assert.equal(new Set(D.NAME_LAST).size, 60);
});

test("New names are a first and a last name, with no number on the end", () => {
  const s = G.create(4);
  for (const p of people(s)) assert.match(p.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/, p.name);
});

test("Classic runs: repeated scouting and staff drives never repeat a name", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = G.create(seed, { ceo: false });
    s.cash = 1e7;
    s.reputation = 90;
    for (let i = 0; i < 40; i++) {
      G.paidScout(s, i % 3);
      if (i % 4 === 0 && s.artists.length < G.slots(s)) G.sign(s, s.candidates[0].id, 1);
      for (const role of Object.keys(D.ROLES)) G.recruitmentDrive(s, role, 0);
      if (i === 5) for (const role of Object.keys(D.ROLES)) G.hire(s, role, s.staffCandidates[role][0].id);
      assertUnique(s, `seed ${seed}, round ${i}`);
    }
  }
});

test("A batch of prospects never repeats a name, even inside the same search", () => {
  const s = G.create(9, { ceo: false });
  s.cash = 1e7;
  for (let i = 0; i < 200; i++) {
    G.paidScout(s, 2);
    assert.equal(new Set(s.candidates.map((c) => c.name)).size, s.candidates.length);
  }
});

test("A name already taken is skipped for the next free one", () => {
  const s = G.create(12, { ceo: false });
  s.cash = 1e6;
  const peek = clone(s);
  G.paidScout(peek, 0);
  const next = peek.candidates[0].name;
  s.artists.push({ ...s.candidates[0], id: 9999, name: next });
  G.paidScout(s, 0);
  assert.notEqual(s.candidates[0].name, next);
  assertUnique(s, "after the collision");
});

test("CEO runs: artists, staff, executives, team members and directors never share a name", () => {
  for (const seed of [21, 22, 23]) {
    const s = G.create(seed, { ceo: true });
    s.cash = 1e8;
    s.reputation = 90;
    s.company.phase = 2;
    G.takeFunding(s, "angel", 0);
    s.company.phase = 4;
    G.takeFunding(s, "venture", 1);
    // Plenty of budget and full freedom, so no approval requests interrupt the hiring.
    Object.assign(s.company.board, { budget: 1e9, budgetLeft: 1e9, freedom: "high" });
    for (let i = 0; i < 12; i++) {
      for (const d of G.DEPARTMENTS) if (G.departmentOpen(s, d.id)) G.recruitExecs(s, d.id);
      for (const r of G.teamSlots(s)) G.recruitTeam(s, r.id);
      G.paidScout(s, 0);
      if (i === 2)
        for (const d of G.DEPARTMENTS)
          if (G.departmentOpen(s, d.id)) G.hireHead(s, d.id, s.company.departments[d.id].pool[0].id);
      if (i === 3) for (const r of G.teamSlots(s)) G.hireTeam(s, r.id, s.company.team.candidates[r.id][0].id);
      assertUnique(s, `seed ${seed}, round ${i}`);
      settle(s);
    }
    assert.ok(people(s).length > 60, "a crowded label");
  }
});

test("Saves with numbered names from earlier versions still load and keep their names", () => {
  const s = G.create(30, { ceo: false });
  s.candidates[0].name = "Sage Rivers 2";
  const copy = clone(s);
  G.migrate(copy);
  assert.equal(copy.candidates[0].name, "Sage Rivers 2");
});

console.log(`${count} name tests passed.`);
