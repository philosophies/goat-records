// Tour pay (CEO runs): the ticket rate from the artist's fame, the tour's quality, the artist's tier,
// the label's reputation and, on a shared tour, the other act and their label. Classic runs never use it.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const P = D.TOUR_PAY;
    const pct = (n) => Math.round(n * 100) / 100;
    const term = (value, t) => (value - t.around) * t.per;
    const TIER_NAMES = { rising: "Up-and-comer", star: "Star", superstar: "Superstar" };

    function rivalTierOf(a) {
      return (a?.fame || 0) >= P.rivalTier.superstar
        ? "superstar"
        : (a?.fame || 0) >= P.rivalTier.star
          ? "star"
          : "rising";
    }
    /** The rival label a rival's artist records for, for a shared tour with them. */
    function rivalLabelOf(s, a) {
      const list = core.api().rivalsInfo?.(s) || [];
      return a && list.length ? list[Math.abs(a.id) % list.length] : null;
    }
    /**
     * The ticket rate for a tour, or for a tour being quoted: { lead, partner, rival, mode, quality }.
     * Returns { mult, parts: [{ name, value }], shared } where each part is added to 1.
     */
    function tourRate(s, x) {
      if (!s.company || !x?.lead) return { mult: 1, parts: [], shared: 0 };
      const api = core.api(),
        a = x.lead,
        tier = api.tierOf?.(a) || "rising",
        parts = [
          { name: `Fame ${Math.round(a.fame || 0)}`, value: pct(term(a.fame || 0, P.fame)) },
          {
            name: `Tour quality ${Math.round(x.quality ?? 70)}`,
            value: pct(term(x.quality ?? 70, P.quality)),
          },
          { name: TIER_NAMES[tier], value: P.tier[tier] || 0 },
          {
            name: `Label reputation ${Math.round(s.reputation)}`,
            value: pct(term(s.reputation, P.reputation)),
          },
        ];
      let shared = 0;
      if (x.mode && x.mode !== "solo") {
        const other = x.partner || x.rival,
          otherTier = x.partner ? api.tierOf?.(x.partner) || "rising" : rivalTierOf(x.rival),
          label = x.rival ? rivalLabelOf(s, x.rival) : null,
          standing = label ? (s.reputation + label.strength) / 2 : s.reputation,
          S = P.shared;
        shared = Math.min(
          S.max,
          S.base +
            Math.max(0, term(other?.fame || 0, S.fame)) +
            (S.tier[otherTier] || 0) +
            Math.max(0, term(standing, S.label)),
        );
        parts.push({
          name: `Shared with ${other?.name || "another act"}${label ? ` (${label.name})` : ""}`,
          value: pct(shared),
        });
      }
      const mult = pct(Math.max(P.min, Math.min(P.max, 1 + parts.reduce((n, p) => n + p.value, 0))));
      return { mult, parts, shared: pct(shared) };
    }
    /** The rate for a tour on the road, with its people as they are today. */
    function rateOfTour(s, t) {
      const lead = s.artists.find((a) => a.id === t.artist),
        partner =
          t.mode === "labelmate"
            ? s.artists.find((a) => a.id !== t.artist && t.artists.includes(a.id))
            : null;
      return tourRate(s, {
        lead,
        partner,
        rival: t.mode === "rival" ? t.rival : null,
        mode: t.mode,
        quality: t.quality,
      });
    }
    function tourGate(s, t) {
      return rateOfTour(s, t).mult;
    }

    /** Saves from before tours ran in weeks convert any tour on the road (CEO runs). */
    function init(s) {
      core.api().toursToWeeks?.(s);
    }

    return {
      init,
      tourGate,
      api: { TOUR_PAY: P, TOUR_WEEKS: D.TOUR_WEEKS, tourRate, tourRateOf: rateOfTour },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { touring: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
