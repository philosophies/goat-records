// The company system (2.0): the label's growth phases in a CEO run.
// Only active when a run was created with { ceo: true }; other runs are left untouched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { PHASES, REACHES } = D;
    const isCount = (n) => Number.isInteger(n) && n >= 0;

    function init(s) {
      if (!s.ceoMode || s.company) return s;
      s.company = { phase: 1, since: s.week, history: [{ phase: 1, week: s.week }] };
      s.cash = PHASES[0].startCash;
      return s;
    }
    function validSave(s) {
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

    return { init, validSave, api: { PHASES, REACHES, companyPhase } };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { company: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
