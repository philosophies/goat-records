// The company system (2.0): the label's growth phases in a CEO run.
// Only active when a run was created with { ceo: true }; other runs are left untouched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { PHASES, REACHES, PHASE_GOALS, HIT_QUALITY, REACH_SCOUTING, RENAME, LABEL_NAME } = D;
    const { log } = core;
    const isCount = (n) => Number.isInteger(n) && n >= 0;

    function init(s) {
      if (!s.ceoMode || s.company) return s;
      s.company = { phase: 1, since: s.week, history: [{ phase: 1, week: s.week }] };
      s.cash = PHASES[0].startCash;
      // The first prospects were drawn before the company existed: hold them to the local scene too.
      const lim = scoutLimits(s);
      for (const a of s.candidates || []) {
        a.talent = Math.min(a.talent, lim.talentMax);
        a.potential = Math.max(a.talent, Math.min(a.potential, lim.potentialMax));
        a.reach = lim.reach;
        const q = core.api().contractQuote(s, a, 3);
        a.fee = q.fee;
        a.wage = q.wage;
      }
      return s;
    }
    /** The label's own name: the player's choice, or the default. Works in every run. */
    function labelName(s) {
      return s.labelName || LABEL_NAME;
    }
    /** A cleaned name, or throws with the reason it cannot be used. */
    function cleanName(name) {
      if (typeof name !== "string") throw Error("The label needs a name.");
      const clean = name
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (clean.length < RENAME.minLength) throw Error("The label needs a name.");
      if (clean.length > RENAME.maxLength) throw Error(`Keep the name to ${RENAME.maxLength} characters.`);
      return clean;
    }
    /** Renames the label. Costs RENAME.fame, unless `free` (naming a new run). */
    function renameLabel(s, name, free = false) {
      core.requireAction(s);
      const clean = cleanName(name),
        old = labelName(s);
      if (clean === old) throw Error(`The label is already called ${old}.`);
      const cost = free ? 0 : Math.min(RENAME.fame, s.fame);
      s.fame -= cost;
      s.labelName = clean;
      log(
        s,
        free
          ? `The label is named ${clean}.`
          : `${old} is now ${clean}.${cost ? ` Fans need time to catch up: −${cost} fame.` : ""}`,
      );
      return clean;
    }
    function validSave(s) {
      if (s.labelName !== undefined) {
        if (typeof s.labelName !== "string") return false;
        const n = s.labelName.trim().length;
        if (n < RENAME.minLength || n > RENAME.maxLength) return false;
      }
      if (s.company === undefined) return true;
      const c = s.company;
      if (!c || typeof c !== "object" || Array.isArray(c)) return false;
      if (!Number.isInteger(c.phase) || c.phase < 1 || c.phase > PHASES.length) return false;
      if (!isCount(c.since) || !Array.isArray(c.history)) return false;
      return c.history.every((h) => h && Number.isInteger(h.phase) && isCount(h.week));
    }
    /** The current phase row in a CEO run, or null for a classic run. */
    function companyPhase(s) {
      return s.company ? PHASES[s.company.phase - 1] : null;
    }
    /** Income over the last 52 settled weeks: album sales plus every system's weekly income. */
    function yearRevenue(s) {
      return (s.financeHistory || []).reduce(
        (n, w) =>
          n +
          Math.max(0, w.albumIncome || 0) +
          Math.max(0, w.hqIncome || 0) +
          Math.max(0, w.otherIncome || 0),
        0,
      );
    }
    function metric(s, key) {
      const released = s.albums.filter((p) => p.released);
      if (key === "fame") return s.fame;
      if (key === "revenue") return yearRevenue(s);
      if (key === "releases") return released.length;
      if (key === "hits") return released.filter((p) => (p.quality || 0) >= HIT_QUALITY).length;
      return 0;
    }
    /** Goals for the next phase: { next, goals: [{ key, name, have, need, met }], met } or null. */
    function phaseProgress(s) {
      if (!s.company || s.company.phase >= PHASES.length) return null;
      const next = PHASES[s.company.phase],
        goals = Object.entries(next.goals).map(([key, need]) => {
          const have = metric(s, key);
          return { key, name: PHASE_GOALS[key] || key, have, need, met: have >= need };
        });
      return { next, goals, met: goals.every((g) => g.met) };
    }
    /** Scouting limits for the label's reach in a CEO run, or null for a classic run. */
    function scoutLimits(s) {
      const phase = companyPhase(s);
      return phase ? { reach: phase.reach, ...REACH_SCOUTING[phase.reach] } : null;
    }
    /** Why a paid scouting budget is locked, or "" when it can be used. */
    function scoutLocked(s, index) {
      const lim = scoutLimits(s);
      if (!lim || index <= lim.budget) return "";
      const opens = PHASES.find((p) => REACH_SCOUTING[p.reach].budget >= index);
      return `Opens when the label reaches phase ${opens.id}, ${opens.name}, and scouts ${REACH_SCOUTING[opens.reach].name}.`;
    }
    /** Whether the board lets the label move up. Always true until the board exists (T20). */
    function boardApproved(s) {
      return true;
    }
    function weekly(s) {
      const progress = phaseProgress(s);
      if (!progress?.met || !boardApproved(s)) return 0;
      const p = progress.next;
      s.company.phase = p.id;
      s.company.since = s.week;
      s.company.history.push({ phase: p.id, week: s.week });
      log(s, `${labelName(s)} grows into phase ${p.id}: ${p.name}.`);
      s.notifications.push({
        id: s.nextId++,
        kind: "phase",
        title: `Phase ${p.id} · ${p.name}`,
        body: `The label has outgrown its last phase. Scouting now reaches ${REACH_SCOUTING[p.reach].name}.`,
        week: s.week,
      });
      return 0;
    }

    return {
      init,
      validSave,
      weekly,
      api: {
        PHASES,
        REACHES,
        PHASE_GOALS,
        REACH_SCOUTING,
        companyPhase,
        phaseProgress,
        yearRevenue,
        boardApproved,
        scoutLimits,
        scoutLocked,
        RENAME,
        labelName,
        renameLabel,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { company: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
