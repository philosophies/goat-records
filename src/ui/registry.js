// Interface plug-in points. Feature scripts in src/ui/ register here before app.js runs;
// app.js renders whatever is registered. Every render function returns an HTML string.
"use strict";

const GoatUI = {
  /** Full screens, shown in a place on the lot (see places.js) or on their own: { id, label, order, render() }. */
  panels: [],
  /** Album form additions: { fields(), read() -> plan fields, quote(plan) -> html }. */
  albumForm: [],
  /** Extra sections on the roof sign's panel, below headquarters: { render() }. */
  studioSections: [],
  /** Extra rows on a signed artist's card: { render(artist) }. */
  artistCard: [],
  /** Extra rows on a released album in the catalog: { render(album) }. */
  catalogCard: [],
  /** Extra rows under an album that is in production: { render(album) }. */
  productionPanel: [],
  /** Small status chips in the top bar beside the date: { render() }. */
  hud: [],
  /**
   * Notices (rank-ups and similar): { render() }. A banner with a data-action button is shown as
   * a card over the lot and pauses the clock; one without is shown in the side ticker.
   */
  banners: [],
  /**
   * Reasons to hold the clock: { reason() -> short text or "" }. Any non-empty reason pauses
   * time until it clears, for example "contract offer". Banners with a data-action button
   * already pause the clock.
   */
  pauses: [],
  /** Extra items drawn on the ground in front of the headquarters: { render() }. */
  lotDecor: [],
  /** Click handlers: (button) => true when handled. */
  click: [],
  /** Change handlers: (event) => true when handled. */
  change: [],
  registerPanel(panel) {
    this.panels = this.panels.filter((p) => p.id !== panel.id);
    this.panels.push(panel);
    this.panels.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  },
  /** Joins the output of one registry list for the given arguments. */
  html(list, ...args) {
    return this[list].map((x) => x.render(...args) || "").join("");
  },
};
