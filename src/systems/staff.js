// The staff system (2.0): label departments, their executives and junior staff, in CEO runs.
// Classic runs keep the six 1.x roles and are not touched here.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { DEPARTMENTS, EXEC_POOL, EXEC_PAY, DEPT_STAFF, EXEC_FIRST, EXEC_LAST, PHASES } = D;
    const { log, pay, requireAction, roll } = core;
    const deptById = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
    const isCount = (n) => Number.isInteger(n) && n >= 0;
    const between = (s, [lo, hi]) => lo + Math.floor(roll(s, "staff") * (hi - lo + 1));

    function requireCeo(s) {
      if (!s.company) throw Error("Departments are part of a CEO run.");
    }
    function dept(id) {
      const d = deptById[id];
      if (!d) throw Error("Unknown department.");
      return d;
    }
    function phaseOf(s) {
      return s.company.phase;
    }
    function salaryFor(skill) {
      return EXEC_PAY.base + skill * EXEC_PAY.perSkill;
    }
    function init(s) {
      if (!s.company || s.company.departments) return s;
      s.company.departments = Object.fromEntries(
        DEPARTMENTS.map((d) => [d.id, { head: null, staff: 0, pool: [] }]),
      );
      s.company.nextExecId = 1;
      return s;
    }
    /** A new executive candidate for a department, from the company's reach. */
    function candidate(s, deptId) {
      const reach = PHASES[phaseOf(s) - 1].reach,
        skill = between(s, EXEC_POOL.skill[reach]);
      return {
        id: s.company.nextExecId++,
        name: `${EXEC_FIRST[Math.floor(roll(s, "staff") * EXEC_FIRST.length)]} ${EXEC_LAST[Math.floor(roll(s, "staff") * EXEC_LAST.length)]}`,
        dept: deptId,
        skill,
        salary: salaryFor(skill),
        ambition: between(s, EXEC_POOL.ambition),
        loyalty: between(s, EXEC_POOL.loyalty),
        influence: between(s, EXEC_POOL.influence),
      };
    }
    function departmentOpen(s, id) {
      return phaseOf(s) >= dept(id).phase;
    }
    function requireOpen(s, id) {
      const d = dept(id);
      if (!departmentOpen(s, id))
        throw Error(`${d.name} opens at phase ${d.phase}, ${PHASES[d.phase - 1].name}.`);
      return d;
    }
    /** Runs a recruitment drive: a fresh pool of candidates for a department's head. */
    function recruitExecs(s, id) {
      requireAction(s);
      requireCeo(s);
      requireOpen(s, id);
      pay(s, EXEC_POOL.recruitCost * phaseOf(s));
      const d = s.company.departments[id];
      d.pool = Array.from({ length: EXEC_POOL.size }, () => candidate(s, id));
      return d.pool;
    }
    function hireHead(s, id, candidateId) {
      requireAction(s);
      requireCeo(s);
      const info = requireOpen(s, id),
        d = s.company.departments[id],
        c = d.pool.find((x) => x.id === Number(candidateId));
      if (!c) throw Error("That candidate is not in this department's pool.");
      if (d.head) throw Error(`${info.name} already has a head. Let them go first.`);
      pay(s, c.salary * EXEC_PAY.signWeeks);
      d.pool = d.pool.filter((x) => x !== c);
      d.head = { ...c, hiredWeek: s.week };
      log(s, `${c.name} joins as ${info.head}.`);
      return d.head;
    }
    function fireHead(s, id) {
      requireAction(s);
      requireCeo(s);
      const info = dept(id),
        d = s.company.departments[id];
      if (!d.head) throw Error(`${info.name} has no head.`);
      // Severance can run the label below $0, so cutting costs is always possible.
      s.cash -= d.head.salary * EXEC_PAY.severanceWeeks;
      log(s, `${d.head.name} leaves the ${info.head} job.`);
      d.head = null;
    }
    function maxStaff(s) {
      return DEPT_STAFF.perPhase * phaseOf(s);
    }
    function addStaff(s, id) {
      requireAction(s);
      requireCeo(s);
      const info = requireOpen(s, id),
        d = s.company.departments[id];
      if (!d.head) throw Error(`Hire a ${info.head} before building the team.`);
      if (d.staff >= maxStaff(s))
        throw Error(`${info.name} is at its size for this phase: ${maxStaff(s)} staff.`);
      pay(s, DEPT_STAFF.hireFee);
      d.staff++;
    }
    function removeStaff(s, id) {
      requireAction(s);
      requireCeo(s);
      const d = s.company.departments[dept(id).id];
      if (!d.staff) throw Error("Nobody to let go.");
      d.staff--;
    }
    /** Projects a department can run each quarter: its head plus junior staff. */
    function capacity(s, id) {
      const d = s.company?.departments?.[id];
      return d?.head ? 1 + d.staff : 0;
    }
    /** Weekly pay for every department. */
    function departmentPay(s) {
      if (!s.company?.departments) return 0;
      return Object.values(s.company.departments).reduce(
        (n, d) => n + (d.head ? d.head.salary : 0) + d.staff * DEPT_STAFF.salary,
        0,
      );
    }
    function validExec(x) {
      return (
        x &&
        isCount(x.id) &&
        typeof x.name === "string" &&
        [x.skill, x.ambition, x.loyalty, x.influence].every(
          (n) => Number.isFinite(n) && n >= 0 && n <= 100,
        ) &&
        isCount(x.salary)
      );
    }
    function validSave(s) {
      const deps = s.company?.departments;
      if (deps === undefined) return true;
      if (!deps || typeof deps !== "object") return false;
      for (const [id, d] of Object.entries(deps)) {
        if (!deptById[id] || !d || !isCount(d.staff) || !Array.isArray(d.pool)) return false;
        if (d.head !== null && !validExec(d.head)) return false;
        if (!d.pool.every(validExec)) return false;
      }
      return isCount(s.company.nextExecId);
    }

    return {
      init,
      validSave,
      upkeep: departmentPay,
      api: {
        DEPARTMENTS,
        EXEC_POOL,
        EXEC_PAY,
        DEPT_STAFF,
        departmentOpen,
        recruitExecs,
        hireHead,
        fireHead,
        addStaff,
        removeStaff,
        capacity,
        maxStaff,
        departmentPay,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { staff: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
