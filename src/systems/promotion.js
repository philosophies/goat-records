// The promotion system. See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";
  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    return { api: {} };
  }
  root.GoatSystems = Object.assign(root.GoatSystems || {}, { promotion: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
