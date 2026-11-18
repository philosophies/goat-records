// The staff system (2.0): label departments, their executives and junior staff, in CEO runs.
// Classic runs keep the six 1.x roles and are not touched here.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { DEPARTMENTS, ROLE_DEPARTMENT, EXEC_POOL, EXEC_PAY, DEPT_STAFF, EXEC_FIRST, EXEC_LAST, PHASES } =
      D;
    const { TEAM_ROLES, TEAM_EFFECTS, TEAM_POOL, TEAM_STYLES, CHEMISTRY, GENRES } = D;
    const { TRAITS, WANTS, WANT_MORALE, WALKOUT, GRAB, GRAB_END, CEO_INFLUENCE, RESPONSES } = D;
    const WANT_IDS = Object.keys(WANTS);
    const teamRoleById = Object.fromEntries(TEAM_ROLES.map((r) => [r.id, r]));
    const { log, pay, requireAction, roll, busy, clamp } = core;
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
      // A fixed number for this run's personality fits; s.seed itself moves with every roll.
      if (s.company?.team && !isCount(s.company.team.salt)) s.company.team.salt = (s.seed ^ 0x2c1b3c6d) >>> 0;
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
    /** Hires a ready-made head (for example a director's pick) without a search. */
    function appointHead(s, id, overrides = {}) {
      requireAction(s);
      requireCeo(s);
      const info = requireOpen(s, id),
        d = s.company.departments[id];
      if (d.head) throw Error(`${info.name} already has a head. Let them go first.`);
      const c = { ...candidate(s, id), ...overrides };
      c.salary = salaryFor(c.skill);
      pay(s, c.salary * EXEC_PAY.signWeeks);
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
    /** A fixed number for this run from a few ids; it does not use up random numbers. */
    function fixedHash(s, ...ids) {
      let h = s.company.team.salt;
      for (const n of ids) h = Math.imul(h ^ (n + 0x9e3779b9), 2246822519) >>> 0;
      return (h ^ (h >>> 15)) >>> 0;
    }
    /** Fixed −1..1 personality fit for an artist and a team member in this run. */
    function pairFit(s, artistId, memberId) {
      return (fixedHash(s, artistId, memberId) % 2001) / 1000 - 1;
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
    /** A role's effect for an artist: skill × weight × chemistry × share, or 0 with nobody in the slot. */
    function teamEffect(s, a, roleId) {
      if (!a || !s.company?.team) return 0;
      const m = teamMember(s, a.id, roleId);
      return m ? m.skill * teamRole(roleId).weight * chemistry(s, a, m).value * teamShare(m) : 0;
    }
    function teamStageParts(s, p, stage) {
      const a = s.company && s.artists.find((x) => x.id === p.artist);
      if (!a) return [];
      const out = [];
      for (const [roleId, fx] of Object.entries(TEAM_EFFECTS)) {
        if (!fx.stages?.includes(stage) || teamRole(roleId).phase > phaseOf(s)) continue;
        const m = teamMember(s, a.id, roleId);
        out.push({
          name: `Team ${teamRole(roleId).name.toLowerCase()} · ${m ? m.name : "nobody assigned"}`,
          value: Math.round(teamEffect(s, a, roleId) * fx.stagePoints),
        });
      }
      return out;
    }
    /** On release: the publicist adds artist fame, and every member counts an album together. */
    function teamRelease(s, p) {
      const a = s.company?.team && s.artists.find((x) => x.id === p.artist);
      if (!a) return;
      const fame = Math.round(teamEffect(s, a, "publicist") * TEAM_EFFECTS.publicist.releaseFame);
      if (fame) a.fame = Math.min(100, a.fame + fame);
      for (const m of s.company.team.pool)
        if (m.artists.includes(a.id)) m.history[a.id] = (m.history[a.id] || 0) + 1;
    }
    /** Share of an event's trust loss that reaches the artist (1 without a publicist). */
    function trustLossShare(s, a) {
      const fx = TEAM_EFFECTS.publicist;
      return 1 - Math.min(fx.defenceMax, teamEffect(s, a, "publicist") * fx.defence);
    }
    /** Tour ticket revenue multiplier from the lead artist's tour manager. */
    function tourGate(s, t) {
      const lead = s.artists.find((x) => x.id === t.artist);
      return 1 + teamEffect(s, lead, "tour") * TEAM_EFFECTS.tour.gate;
    }
    /** Share of the tour energy drain an artist still takes, from their own tour manager. */
    function tourDrain(s, t, a) {
      const fx = TEAM_EFFECTS.tour;
      return 1 - Math.min(fx.drainMax, teamEffect(s, a, "tour") * fx.drain);
    }
    // ---- Artist traits, wants and morale (design 3.5) ----
    /** An artist's traits and main want, fixed for this run, plus the counters their want needs. */
    function persona(s, a) {
      if (a.persona) return a.persona;
      const trait = (i) => TRAITS.min + (fixedHash(s, a.id, 100 + i) % (TRAITS.max - TRAITS.min + 1));
      a.persona = {
        ...Object.fromEntries(TRAITS.ids.map((id, i) => [id, trait(i)])),
        want: WANT_IDS[fixedHash(s, a.id, 200) % WANT_IDS.length],
        since: s.week,
        bonusWeek: null,
        fameMark: a.fame,
        fameMet: true,
        busyWeeks: 0,
        idleWeeks: 0,
        status: "neutral",
      };
      return a.persona;
    }
    function latestAlbum(s, a) {
      return s.albums
        .filter((p) => p.artist === a.id && p.production?.results?.length)
        .reduce((best, p) => (!best || p.id > best.id ? p : best), null);
    }
    /** "met", "ignored" or "neutral" for an artist's main want this week. */
    function wantStatus(s, a) {
      const x = persona(s, a);
      switch (x.want) {
        case "money":
          return x.bonusWeek !== null && s.week - x.bonusWeek < WANTS.money.window ? "met" : "ignored";
        case "control": {
          const p = latestAlbum(s, a);
          return !p ? "neutral" : p.production.results[0].choice === WANTS.control.choice ? "met" : "ignored";
        }
        case "fame":
          return x.fameMet ? "met" : "ignored";
        case "family":
          return x.busyWeeks < WANTS.family.maxBusy ? "met" : "ignored";
      }
      return "neutral";
    }
    /** This week's morale change from the artist's want. */
    function wantMorale(s, a) {
      const x = persona(s, a),
        status = wantStatus(s, a),
        M = WANT_MORALE;
      if (status === "met") return M.met;
      if (status === "ignored")
        return -Math.max(1, Math.round(M.ignored + x.ego * M.egoWeight - x.loyalty * M.loyaltyWeight));
      return 0;
    }
    /** Morale below which an artist with nothing left on their contract walks out. */
    function walkOutLine(s, a) {
      const x = persona(s, a);
      return WALKOUT.walkOut - (x.loyalty >= WALKOUT.loyal ? WALKOUT.loyalGrace : 0);
    }
    function walksOut(s, a) {
      return a.contract?.remaining === 0 && !busy(s, a.id) && (a.morale ?? 75) < walkOutLine(s, a);
    }
    function moodWeek(s) {
      if (!s.company?.team) return;
      for (const a of [...s.artists]) {
        const x = persona(s, a);
        if (busy(s, a.id)) {
          x.busyWeeks++;
          x.idleWeeks = 0;
        } else if (++x.idleWeeks >= WANTS.family.rest) x.busyWeeks = 0;
        if ((s.week - x.since) % WANTS.fame.window === 0 && s.week > x.since) {
          x.fameMet = a.fame >= x.fameMark + WANTS.fame.gain || a.fame >= WANTS.fame.star;
          x.fameMark = a.fame;
        }
        x.status = wantStatus(s, a);
        a.morale = clamp((a.morale ?? 75) + wantMorale(s, a));
        if (walksOut(s, a)) {
          s.artists = s.artists.filter((y) => y !== a);
          log(s, `${a.name} walked out at the end of their contract. Morale ${Math.round(a.morale)}.`);
          s.notifications.push({
            id: s.nextId++,
            kind: "walkout",
            title: `${a.name} walked out`,
            body: `Their contract was complete and their morale had fallen to ${Math.round(a.morale)}. They wanted ${WANTS[x.want].name.toLowerCase()}.`,
            week: s.week,
          });
        }
      }
    }
    function bonusCost(a) {
      return Math.max(WANTS.money.min, a.wage * WANTS.money.wageWeeks);
    }
    /** Pays an artist a bonus. It meets a money want for WANTS.money.window weeks. */
    function payBonus(s, id) {
      requireAction(s);
      requireCeo(s);
      const a = s.artists.find((x) => x.id === Number(id));
      if (!a) throw Error("Artist not found.");
      pay(s, bonusCost(a));
      persona(s, a).bonusWeek = s.week;
      persona(s, a).status = wantStatus(s, a);
      log(s, `${a.name} received a bonus.`);
    }
    function checkRenew(s, a) {
      if (s.company?.team && walksOut(s, a))
        throw Error(`${a.name} will not re-sign while this unhappy. Meet what they want first.`);
    }
    /** Mood summary for panels and events. */
    function artistMood(s, a) {
      const x = persona(s, a);
      return {
        traits: Object.fromEntries(TRAITS.ids.map((id) => [id, x[id]])),
        want: x.want,
        wantName: WANTS[x.want].name,
        status: wantStatus(s, a),
        weekly: wantMorale(s, a),
        unhappy: (a.morale ?? 75) < WALKOUT.unhappy,
        walkOutBelow: walkOutLine(s, a),
      };
    }
    // ---- Power grabs (design 3.4) ----
    /** Your influence as CEO: base, phase and board perks, at most 100. */
    function ceoInfluence(s) {
      const perks = s.company?.board?.perks?.length || 0;
      return Math.min(
        100,
        CEO_INFLUENCE.base + phaseOf(s) * CEO_INFLUENCE.perPhase + perks * CEO_INFLUENCE.perPerk,
      );
    }
    /** Chance a quarter that a head starts a power grab (design 4). */
    function grabChance(s, x) {
      if (!x || (x.calmUntil && s.week < x.calmUntil)) return 0;
      const drive = Math.max(0, (x.ambition + x.influence - x.loyalty - GRAB.threshold) / GRAB.divisor);
      return drive * (1 - ceoInfluence(s) / GRAB.ceoDivisor);
    }
    function heads(s) {
      return Object.entries(s.company?.departments || {})
        .filter(([, d]) => d.head)
        .map(([id, d]) => ({ dept: id, x: d.head }));
    }
    function headOf(s, id) {
      const x = s.company?.departments?.[id]?.head;
      if (!x) throw Error("That department has no head.");
      return x;
    }
    function courtDirector(s, x) {
      const free = (s.company.board?.directors || []).filter((d) => !x.contacts.includes(d.id));
      if (free.length) x.contacts.push(free[Math.floor(roll(s, "grab") * free.length)].id);
    }
    /** Every quarter: influence grows, plots move on, new plots may start as gossip. */
    function grabQuarter(s) {
      for (const { dept: id, x } of heads(s)) {
        x.contacts ??= [];
        x.influence = Math.min(100, x.influence + GRAB.perQuarter + x.contacts.length * GRAB.perContact);
        if (x.plot) {
          courtDirector(s, x);
          continue;
        }
        if (roll(s, "grab") < grabChance(s, x)) {
          x.plot = { since: s.week, due: s.week + GRAB.warnWeeks };
          courtDirector(s, x);
          s.notifications.push({
            id: s.nextId++,
            kind: "gossip",
            title: `Office gossip about ${x.name}`,
            body: `People say ${x.name} (${deptById[id].head}) has been meeting directors and taking credit for wins. It will come to a head around week ${x.plot.due}.`,
            week: s.week,
          });
          log(s, `Office gossip: ${x.name} is building a following.`);
        }
      }
    }
    /** Answers an executive: "promote", "placate", "sideline" (with the department to move them to), "fire" or "counter". */
    function respond(s, id, kind, target) {
      requireAction(s);
      requireCeo(s);
      const x = headOf(s, id),
        R = RESPONSES[kind];
      if (!R) throw Error("Unknown response.");
      x.contacts ??= [];
      if (kind === "promote") {
        x.salary = Math.round(x.salary * (1 + R.raise));
        x.title = "Senior " + deptById[id].head;
        x.ambition = Math.max(0, x.ambition + R.ambition);
        x.calmUntil = s.week + R.calmWeeks;
        delete x.plot;
        log(s, `${x.name} is promoted to ${x.title}.`);
      } else if (kind === "placate") {
        pay(s, x.salary * R.bonusWeeks);
        x.calmUntil = s.week + R.calmWeeks;
        if (x.plot) x.plot.due += R.calmWeeks;
        log(s, `${x.name} takes a bonus and goes quiet for a while.`);
      } else if (kind === "sideline") {
        const to = dept(target);
        if (to.id === id) throw Error("Pick another department.");
        if (!departmentOpen(s, to.id)) throw Error(`${to.name} is not open yet.`);
        if (s.company.departments[to.id].head) throw Error(`${to.name} already has a head.`);
        s.company.departments[id].head = null;
        s.company.departments[to.id].head = x;
        x.dept = to.id;
        x.influence = Math.max(0, x.influence + R.influence);
        x.loyalty = Math.max(0, x.loyalty + R.loyalty);
        delete x.plot;
        log(s, `${x.name} is moved to head ${to.name}.`);
      } else if (kind === "fire") {
        const courted = x.contacts.slice();
        fireHead(s, id);
        for (const d of s.company.board?.directors || [])
          if (courted.includes(d.id)) d.relationship -= R.contactPenalty;
      } else if (kind === "counter") {
        const b = s.company.board;
        if (!b || !x.contacts.length) throw Error(`${x.name} has no board contacts to win back.`);
        if (b.meetingWeek === s.week) throw Error("You have already spent this week's time with the board.");
        pay(s, R.costPerPhase * phaseOf(s));
        b.meetingWeek = s.week;
        x.influence = Math.max(0, x.influence - x.contacts.length * R.perContact);
        x.contacts = [];
        delete x.plot;
        log(s, `You won ${x.name}'s board contacts back.`);
      }
      return x;
    }
    /** How a grab that has come to a head ends: "chair", "coCeo" or "failed". */
    function grabResult(s, x) {
      const seats = s.company.board?.directors.length || 0,
        backed = seats > 0 && x.contacts.length > seats * GRAB_END.majority,
        stronger = x.influence > ceoInfluence(s);
      if (!backed || !stronger) return "failed";
      return x.contacts.length >= seats && x.influence >= ceoInfluence(s) + GRAB_END.chairMargin
        ? "chair"
        : "coCeo";
    }
    /** Ends a grab that has come to a head, records the outcome card and returns it. */
    function resolveGrab(s, id) {
      const x = headOf(s, id),
        result = grabResult(s, x),
        outcome = {
          kind: result,
          exec: x.name,
          dept: id,
          week: s.week,
          artist: null,
          artistLeft: false,
          seen: false,
        };
      s.company.departments[id].head = null;
      if (result === "chair") {
        s.finished = true;
        s.bankrupt = false;
        s.ousted = true;
        s.outcome = `Ousted. ${x.name} won the board over and took the CEO's chair at ${core.api().labelName(s)}.`;
        log(s, s.outcome);
      } else if (result === "coCeo") {
        s.company.coCeo = { name: x.name, since: s.week };
        const b = s.company.board;
        if (b) b.freedom = core.api().freedomFor(b.confidence ?? 50, b.probation, true);
        log(s, `${x.name} is now co-CEO. Creative decisions are shared from here on.`);
      } else {
        const target = s.artists
          .filter((a) => !busy(s, a.id))
          .reduce((low, a) => (!low || persona(s, a).loyalty < persona(s, low).loyalty ? a : low), null);
        if (target) {
          outcome.artist = target.name;
          outcome.artistLeft = persona(s, target).loyalty < GRAB_END.poachLoyalty;
          if (outcome.artistLeft) s.artists = s.artists.filter((a) => a !== target);
        }
        log(
          s,
          `${x.name}'s grab failed. They left for a rival${target ? (outcome.artistLeft ? ` and took ${target.name} with them` : `; ${target.name} stayed loyal`) : ""}.`,
        );
      }
      s.company.grabOutcome = outcome;
      return outcome;
    }
    function grabWeek(s) {
      for (const { dept: id, x } of heads(s))
        if (x.plot && s.week >= x.plot.due && !s.finished) resolveGrab(s, id);
    }
    function ackGrab(s) {
      if (s.company?.grabOutcome) s.company.grabOutcome.seen = true;
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
        (t.salt !== undefined && !isCount(t.salt)) ||
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
        isCount(x.salary) &&
        (x.contacts === undefined || (Array.isArray(x.contacts) && x.contacts.every(isCount))) &&
        (x.plot === undefined || (!!x.plot && isCount(x.plot.due))) &&
        (x.calmUntil === undefined || isCount(x.calmUntil))
      );
    }
    function validSave(s) {
      const c = s.company,
        outcome = c?.grabOutcome;
      if (c?.coCeo !== undefined && (!c.coCeo || typeof c.coCeo.name !== "string")) return false;
      if (outcome !== undefined && !(outcome && ["chair", "coCeo", "failed"].includes(outcome.kind)))
        return false;
      return validDepartments(s) && validTeam(s) && (s.artists || []).every((a) => validPersona(a.persona));
    }
    function validPersona(x) {
      if (x === undefined) return true;
      return (
        !!x &&
        TRAITS.ids.every((id) => Number.isFinite(x[id]) && x[id] >= 0 && x[id] <= 100) &&
        WANT_IDS.includes(x.want) &&
        isCount(x.since) &&
        (x.bonusWeek === null || isCount(x.bonusWeek)) &&
        isCount(x.busyWeeks) &&
        isCount(x.idleWeeks)
      );
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
      weekly: (s) => {
        pruneTeam(s);
        moodWeek(s);
        if (s.company?.departments && s.week % GRAB.quarter === 0) grabQuarter(s);
        if (s.company?.departments) grabWeek(s);
        return 0;
      },
      beforeRenew: checkRenew,
      stageParts: teamStageParts,
      onRelease: teamRelease,
      trustLoss: trustLossShare,
      tourGate,
      tourDrain,
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
        teamEffect,
        TEAM_EFFECTS,
        TRAITS,
        WANTS,
        WANT_MORALE,
        WALKOUT,
        artistMood,
        wantStatus,
        payBonus,
        bonusCost,
        walksOut,
        GRAB,
        CEO_INFLUENCE,
        RESPONSES,
        ceoInfluence,
        grabChance,
        grabQuarter,
        respond,
        GRAB_END,
        grabResult,
        resolveGrab,
        ackGrab,
        artistTeam,
        teamPay,
        departmentOpen,
        recruitExecs,
        hireHead,
        appointHead,
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
