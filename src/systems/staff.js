// The staff system (2.0): label departments, their executives and junior staff, in CEO runs.
// Classic runs keep the six 1.x roles and are not touched here.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { DEPARTMENTS, ROLE_DEPARTMENT, EXEC_POOL, EXEC_PAY, DEPT_STAFF, EXEC_FIRST, EXEC_LAST, PHASES } =
      D;
    const { TEAM_ROLES, TEAM_POOL, TEAM_STYLES, CHEMISTRY, GENRES } = D;
    const teamRoleById = Object.fromEntries(TEAM_ROLES.map((r) => [r.id, r]));
    const { log, pay, requireAction, roll } = core;
    const deptById = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d]));
    const isCount = (n) => Number.isInteger(n) && n >= 0;
    const between = (s, [lo, hi], stream = "staff") => lo + Math.floor(roll(s, stream) * (hi - lo + 1));

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
    function initTeam(s) {
      if (s.company && !s.company.team) s.company.team = { pool: [], candidates: {}, nextId: 1 };
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
    /** Skill a CEO run's department head lends to a 1.x role effect; 0 without a head. */
    function headSkill(s, role) {
      const id = ROLE_DEPARTMENT[role];
      return (id && s.company?.departments?.[id]?.head?.skill) || 0;
    }
    // ---- Artist teams (design 3.5) ----
    function teamRole(id) {
      const r = teamRoleById[id];
      if (!r) throw Error("Unknown team role.");
      return r;
    }
    /** Team roles open at the company's current phase. */
    function teamSlots(s) {
      return s.company ? TEAM_ROLES.filter((r) => r.phase <= phaseOf(s)) : [];
    }
    function member(s, id) {
      const m = s.company?.team?.pool.find((x) => x.id === Number(id));
      if (!m) throw Error("That person is not on the label's team.");
      return m;
    }
    function teamCandidate(s, roleId) {
      const reach = PHASES[phaseOf(s) - 1].reach,
        skill = between(s, TEAM_POOL.skill[reach], "team"),
        pick = (list) => list[Math.floor(roll(s, "team") * list.length)],
        first = pick(GENRES),
        second = roll(s, "team") < 0.5 ? pick(GENRES.filter((g) => g !== first)) : null;
      return {
        id: s.company.team.nextId++,
        name: `${pick(EXEC_FIRST)} ${pick(EXEC_LAST)}`,
        role: roleId,
        skill,
        salary: TEAM_POOL.salary + skill * TEAM_POOL.perSkill,
        genres: second ? [first, second] : [first],
        style: pick(TEAM_STYLES),
        artists: [],
        history: {},
      };
    }
    /** A recruitment drive for one team role: a fresh list of candidates. */
    function recruitTeam(s, roleId) {
      requireAction(s);
      requireCeo(s);
      const r = teamRole(roleId);
      if (r.phase > phaseOf(s))
        throw Error(`${r.name}s join artist teams at phase ${r.phase}, ${PHASES[r.phase - 1].name}.`);
      pay(s, TEAM_POOL.recruitCost * phaseOf(s));
      s.company.team.candidates[roleId] = Array.from({ length: TEAM_POOL.size }, () =>
        teamCandidate(s, roleId),
      );
      return s.company.team.candidates[roleId];
    }
    function hireTeam(s, roleId, candidateId) {
      requireAction(s);
      requireCeo(s);
      const r = teamRole(roleId),
        list = s.company.team.candidates[roleId] || [],
        c = list.find((x) => x.id === Number(candidateId));
      if (!c) throw Error("That candidate is not on the list.");
      pay(s, c.salary * TEAM_POOL.signWeeks);
      s.company.team.candidates[roleId] = list.filter((x) => x !== c);
      s.company.team.pool.push(c);
      log(s, `${c.name} joins the label as a ${r.name.toLowerCase()}.`);
      return c;
    }
    function releaseTeam(s, id) {
      requireAction(s);
      const m = member(s, id);
      s.company.team.pool = s.company.team.pool.filter((x) => x !== m);
      log(s, `${m.name} leaves the label.`);
    }
    /** Fixed −1..1 personality fit for an artist and a team member in this run. */
    function pairFit(s, artistId, memberId) {
      let h = (s.seed ^ 0x2c1b3c6d) >>> 0;
      for (const n of [artistId, memberId]) h = Math.imul(h ^ (n + 0x9e3779b9), 2246822519) >>> 0;
      h ^= h >>> 15;
      return (h % 2001) / 1000 - 1;
    }
    /** Chemistry between an artist and a team member (CHEMISTRY.min–max), shown before assigning. */
    function chemistry(s, a, m) {
      const C = CHEMISTRY,
        genre = m.genres.includes(a.genre) ? C.genreMatch : C.genreMiss,
        personality = pairFit(s, a.id, m.id) * C.personality,
        history = Math.min(C.historyMax, (m.history[a.id] || 0) * C.perAlbum),
        value = Math.min(C.max, Math.max(C.min, C.base + genre + personality + history));
      return {
        value: Math.round(value * 100) / 100,
        parts: [
          { name: m.genres.includes(a.genre) ? `Knows ${a.genre}` : `New to ${a.genre}`, value: genre },
          { name: "Personality", value: Math.round(personality * 100) / 100 },
          { name: "History together", value: history },
        ],
      };
    }
    /** The member filling an artist's slot for a role, or null. */
    function teamMember(s, artistId, roleId) {
      return (
        s.company?.team?.pool.find((m) => m.role === roleId && m.artists.includes(Number(artistId))) || null
      );
    }
    function assignTeam(s, memberId, artistId) {
      requireAction(s);
      requireCeo(s);
      const m = member(s, memberId),
        a = s.artists.find((x) => x.id === Number(artistId)),
        r = teamRole(m.role);
      if (!a) throw Error("Artist not found.");
      if (r.phase > phaseOf(s)) throw Error(`${r.name} slots open at phase ${r.phase}.`);
      if (m.artists.includes(a.id)) throw Error(`${m.name} already works with ${a.name}.`);
      if (m.artists.length >= TEAM_POOL.maxArtists)
        throw Error(`${m.name} already serves ${TEAM_POOL.maxArtists} artists.`);
      const current = teamMember(s, a.id, m.role);
      if (current) current.artists = current.artists.filter((id) => id !== a.id);
      m.artists.push(a.id);
      log(s, `${m.name} is now ${a.name}'s ${r.name.toLowerCase()}.`);
      return chemistry(s, a, m);
    }
    function unassignTeam(s, memberId, artistId) {
      requireAction(s);
      const m = member(s, memberId);
      m.artists = m.artists.filter((id) => id !== Number(artistId));
    }
    /** Effect share for a member: 1 alone, TEAM_POOL.sharedEffect when serving two artists. */
    function teamShare(m) {
      return m.artists.length > 1 ? TEAM_POOL.sharedEffect : 1;
    }
    /** Each open slot for an artist with its member, chemistry and share. */
    function artistTeam(s, artistId) {
      const a = s.artists.find((x) => x.id === Number(artistId));
      if (!a) return [];
      return teamSlots(s).map((r) => {
        const m = teamMember(s, a.id, r.id);
        return {
          role: r,
          member: m,
          chemistry: m ? chemistry(s, a, m).value : null,
          share: m ? teamShare(m) : 0,
        };
      });
    }
    function teamPay(s) {
      return (s.company?.team?.pool || []).reduce((n, m) => n + m.salary, 0);
    }
    /** Drops assignments to artists who have left the roster. */
    function pruneTeam(s) {
      const ids = new Set(s.artists.map((a) => a.id));
      for (const m of s.company?.team?.pool || []) m.artists = m.artists.filter((id) => ids.has(id));
      return 0;
    }
    function validMember(m) {
      return (
        m &&
        isCount(m.id) &&
        typeof m.name === "string" &&
        !!teamRoleById[m.role] &&
        Number.isFinite(m.skill) &&
        m.skill >= 0 &&
        m.skill <= 100 &&
        isCount(m.salary) &&
        Array.isArray(m.genres) &&
        m.genres.every((g) => GENRES.includes(g)) &&
        Array.isArray(m.artists) &&
        m.artists.length <= TEAM_POOL.maxArtists &&
        m.artists.every(isCount) &&
        !!m.history &&
        typeof m.history === "object" &&
        Object.values(m.history).every(isCount)
      );
    }
    function validTeam(s) {
      const t = s.company?.team;
      if (t === undefined) return true;
      if (
        !t ||
        !Array.isArray(t.pool) ||
        !isCount(t.nextId) ||
        !t.candidates ||
        typeof t.candidates !== "object"
      )
        return false;
      return (
        t.pool.every(validMember) &&
        Object.entries(t.candidates).every(
          ([r, list]) => teamRoleById[r] && Array.isArray(list) && list.every(validMember),
        )
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
      return validDepartments(s) && validTeam(s);
    }
    function validDepartments(s) {
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
      init: (s) => initTeam(init(s)),
      validSave,
      weekly: pruneTeam,
      upkeep: (s) => departmentPay(s) + teamPay(s),
      roleSkill: headSkill,
      api: {
        DEPARTMENTS,
        EXEC_POOL,
        EXEC_PAY,
        DEPT_STAFF,
        ROLE_DEPARTMENT,
        TEAM_ROLES,
        TEAM_POOL,
        CHEMISTRY,
        teamSlots,
        recruitTeam,
        hireTeam,
        releaseTeam,
        chemistry,
        teamMember,
        assignTeam,
        unassignTeam,
        teamShare,
        artistTeam,
        teamPay,
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
