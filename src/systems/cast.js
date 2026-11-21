// The authored cast (3.0): scouting, recruitment and new board seats in CEO runs draw from authored
// people first, and fall back to generated ones. Classic runs never see the cast.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { REACH_ORDER, CAST_RULES, CAST_ARTISTS, CAST_EXECS, CAST_TEAM, CAST_DIRECTORS } = D;
    const { roll } = core;
    const byId = new Map(
      [
        ...CAST_ARTISTS.map((x) => ["artist", x]),
        ...CAST_EXECS.map((x) => ["exec", x]),
        ...CAST_TEAM.map((x) => ["team", x]),
        ...CAST_DIRECTORS.map((x) => ["director", x]),
      ].map(([kind, x]) => [x.id, { kind, ...x }]),
    );

    /** The authored entry behind a person, or null. */
    function castEntry(id) {
      return (id && byId.get(id)) || null;
    }
    /** Everyone in the run who could carry a cast id. */
    function people(s) {
      const c = s.company || {};
      return [
        ...s.artists,
        ...s.candidates,
        ...Object.values(c.departments || {}).flatMap((d) => [d.head, ...(d.pool || [])]),
        ...(c.team?.pool || []),
        ...Object.values(c.team?.candidates || {}).flat(),
        ...(c.board?.directors || []),
      ].filter(Boolean);
    }
    /** Cast ids already met in this run: signed, hired, seated or on a list right now. */
    function taken(s) {
      const set = new Set(s.company?.cast?.used || []);
      for (const x of people(s)) if (x.castId) set.add(x.castId);
      return set;
    }
    /** Picks someone from `list` within `reach`, weighted toward the scout's own reach; null to generate. */
    function pick(s, list, reach, fits = () => true) {
      if (!s.company || roll(s, "cast") >= CAST_RULES.chance) return null;
      const top = reach ? REACH_ORDER.indexOf(reach) : REACH_ORDER.length - 1,
        used = taken(s),
        names = core.peopleNames(s),
        pool = list.filter(
          (x) =>
            fits(x) &&
            !used.has(x.id) &&
            !names.has(x.name) &&
            (!x.reach ||
              (REACH_ORDER.indexOf(x.reach) <= top &&
                REACH_ORDER.indexOf(x.reach) >= top - CAST_RULES.window)),
        );
      if (!pool.length) return null;
      const weight = (x) =>
          !x.reach || REACH_ORDER.indexOf(x.reach) === top ? CAST_RULES.sameReach : CAST_RULES.nearerReach,
        total = pool.reduce((n, x) => n + weight(x), 0);
      let r = roll(s, "cast") * total;
      const x = pool.find((p) => (r -= weight(p)) < 0) || pool.at(-1);
      core.reserveName(s, x.name);
      return x;
    }
    /** Turns a scouted prospect into an authored artist when one fits the reach. */
    function castArtist(s, a, lim) {
      const x = pick(s, CAST_ARTISTS, lim?.reach);
      if (!x) return a;
      Object.assign(a, {
        castId: x.id,
        name: x.name,
        genre: x.genre,
        age: x.age,
        audience: x.audience,
        talent: Math.min(x.talent, lim?.talentMax ?? 100),
      });
      a.potential = Math.max(a.talent, Math.min(x.potential, lim?.potentialMax ?? 100));
      return a;
    }
    /** An authored department head for a recruitment drive. */
    function castExec(s, deptId, c, reach, salaryFor, [lo, hi] = [0, 100]) {
      const x = pick(s, CAST_EXECS, reach, (e) => e.dept === deptId && e.skill >= lo && e.skill <= hi);
      if (!x) return c;
      Object.assign(c, {
        castId: x.id,
        name: x.name,
        skill: x.skill,
        ambition: x.ambition,
        loyalty: x.loyalty,
        influence: x.influence,
        salary: salaryFor(x.skill),
      });
      return c;
    }
    /** An authored artist team member for a team search. */
    function castTeam(s, roleId, c, reach, salaryFor, [lo, hi] = [0, 100]) {
      const x = pick(s, CAST_TEAM, reach, (m) => m.role === roleId && m.skill >= lo && m.skill <= hi);
      if (!x) return c;
      Object.assign(c, {
        castId: x.id,
        name: x.name,
        skill: x.skill,
        genres: [...x.genres],
        style: x.style,
        salary: salaryFor(x.skill),
      });
      return c;
    }
    /** An authored director for a new board seat of the given type. */
    function castDirector(s, d) {
      const x = pick(s, CAST_DIRECTORS, null, (p) => p.type === d.type);
      if (!x) return d;
      d.castId = x.id;
      d.name = x.name;
      return d;
    }
    /** Remembers everyone the label has signed, hired or seated, so they are never scouted twice. */
    function weekly(s) {
      if (!s.company) return 0;
      const c = s.company,
        mine = [
          ...s.artists,
          ...Object.values(c.departments || {}).map((d) => d.head),
          ...(c.team?.pool || []),
          ...(c.board?.directors || []),
        ].filter((x) => x?.castId);
      if (!mine.length) return 0;
      c.cast ??= { used: [] };
      for (const x of mine) if (!c.cast.used.includes(x.castId)) c.cast.used.push(x.castId);
      return 0;
    }
    function validSave(s) {
      const c = s.company?.cast;
      if (c === undefined) return true;
      return !!c && Array.isArray(c.used) && c.used.every((id) => byId.has(id));
    }

    return {
      weekly,
      validSave,
      api: {
        castEntry,
        castArtist,
        castExec,
        castTeam,
        castDirector,
        CAST_ARTISTS,
        CAST_EXECS,
        CAST_TEAM,
        CAST_DIRECTORS,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { cast: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
