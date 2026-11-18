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

console.log(`${count} staff tests passed.`);
