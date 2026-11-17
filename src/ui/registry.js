// Interface plug-in points. Feature scripts in src/ui/ register here before app.js runs;
// app.js renders whatever is registered. Every render function returns an HTML string.
"use strict";

const GoatUI = {
  /** Full screens opened from the menu: { id, label, order, render() }. */
  panels: [],
  /** Album form additions: { fields(), read() -> plan fields, quote(plan) -> html }. */
  albumForm: [],
  /** Extra sections in the studio screen below the album form: { render() }. */
  studioSections: [],
  /** Extra rows on a signed artist's card: { render(artist) }. */
  artistCard: [],
  /** Extra rows on a released album in the catalog: { render(album) }. */
  catalogCard: [],
  /** Extra rows under an album that is in production: { render(album) }. */
  productionPanel: [],
  /** Small status chips beside the date: { render() }. */
  hud: [],
  /** Full-width notices above the activity list (rank-ups and similar): { render() }. */
  banners: [],
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
