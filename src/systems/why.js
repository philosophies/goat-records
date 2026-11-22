// Show why (3.0): a log of causes behind big changes (tier moves, relationship swings, board votes,
// leaks), the company value breakdown, a monthly money ledger and each artist's timeline. CEO runs only.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { WHY_RULES } = D;

    /**
     * Records why something changed: { kind, who, title, parts: [{ name, value }] }. `who` is a
     * character key ("artist:3", "director:1") or "company".
     */
    function noteWhy(s, entry) {
      if (!s.company) return null;
      const list = (s.company.why ??= []),
        row = { week: s.week, ...entry, parts: entry.parts || [] };
      list.push(row);
      if (list.length > WHY_RULES.keep) list.splice(0, list.length - WHY_RULES.keep);
      return row;
    }
    /** Causes for a character (or the company), newest first; optionally only some kinds. */
    function whyFor(s, who, kinds) {
      return (s.company?.why || [])
        .filter((x) => x.who === who && (!kinds || kinds.includes(x.kind)))
        .reverse();
    }
    /** The company value as rows that add up to it. */
    function valuationWhy(s) {
      const v = core.api().companyValuation?.(s);
      if (!v) return null;
      const face = core.api().faceMultiplier?.(s) ?? 1,
        base = v.revenue * v.multiple + v.catalogValue,
        faced = base * face;
      return {
        value: v.value,
        parts: [
          { name: `A year of revenue × ${v.multiple.toFixed(2)}`, value: Math.round(v.revenue * v.multiple) },
          { name: "Catalog", value: Math.round(v.catalogValue) },
          ...(face !== 1
            ? [{ name: `Superstars, ×${face.toFixed(2)}`, value: Math.round(faced - base) }]
            : []),
          { name: "Cash", value: Math.round(s.cash) },
          ...(v.platform ? [{ name: "Streaming platform stake", value: v.platform }] : []),
          ...(v.debt ? [{ name: "Debt", value: -Math.round(v.debt) }] : []),
        ],
        multiple: [
          { name: "Phase", value: core.api().VALUATION?.multiple[s.company.phase - 1] ?? 0 },
          { name: `Growth ${Math.round(v.growth * 100)}%`, value: null },
          { name: `Hit rate ${Math.round(v.hitRate * 100)}%`, value: null },
        ],
      };
    }
    /**
     * Money in and out over the last months (4-week periods, newest first), from the weekly records.
     * Each month: { from, to, rows: [{ name, value }], total, cashChange } with total === cashChange.
     */
    function monthlyLedger(s, months = WHY_RULES.ledgerMonths) {
      const rows = s.financeHistory || [],
        out = [];
      for (let m = 0; m < months; m++) {
        const end = rows.length - m * WHY_RULES.ledgerWeeks,
          slice = rows.slice(Math.max(0, end - WHY_RULES.ledgerWeeks), end);
        if (!slice.length) break;
        const prevClose =
          rows[Math.max(0, end - WHY_RULES.ledgerWeeks) - 1]?.closingCash ?? slice[0].openingCash;
        const add = new Map(),
          put = (name, v) => v && add.set(name, (add.get(name) || 0) + v);
        slice.forEach((r, i) => {
          const before = i ? slice[i - 1].closingCash : prevClose;
          put("Album sales", r.albumIncome || 0);
          const company = r.companyRevenue || {};
          for (const [k, v] of Object.entries(company)) put(streamName(k), v);
          const companyIn = Object.values(company).reduce((n, v) => n + v, 0);
          put("Shops and bar", r.hqIncome || 0);
          put("Endorsements and other income", (r.otherIncome || 0) - companyIn);
          put("Weekly costs (pay, upkeep, rent, loans)", -(r.overhead || 0));
          const settled = (r.albumIncome || 0) + (r.hqIncome || 0) + (r.otherIncome || 0) - (r.overhead || 0);
          put("Awards and events settled at the week's end", (r.cashChange || 0) - settled);
          put("Spending and deals during the week", r.openingCash - before);
        });
        const list = [...add]
          .map(([name, value]) => ({ name, value: Math.round(value) }))
          .filter((x) => x.value);
        out.push({
          from: slice[0].week,
          to: slice.at(-1).week,
          rows: list,
          total: list.reduce((n, x) => n + x.value, 0),
          cashChange: Math.round(slice.at(-1).closingCash - prevClose),
        });
      }
      return out;
    }
    function streamName(key) {
      if (key === "acquisitions") return "Acquired catalog";
      return core.api().COMPANY_REVENUE?.find((r) => r.id === key)?.name || key;
    }
    /** An artist's story as a short timeline, newest first: signing, releases, tier moves, story beats. */
    function timeline(s, a) {
      const items = [];
      if (Number.isInteger(a.contract?.signedWeek))
        items.push({ week: a.contract.signedWeek, kind: "signed", text: "Signed with the label" });
      for (const p of s.albums.filter((x) => x.released && x.artist === a.id))
        items.push({
          week: p.releaseWeek,
          kind: "release",
          text: `Released ${p.title} (quality ${p.quality}${p.quality >= 75 ? ", a hit" : ""})`,
        });
      for (const w of whyFor(s, `artist:${a.id}`, ["tier", "relation"]))
        items.push({ week: w.week, kind: w.kind, text: w.title });
      for (const x of core.api().storyLog?.(s, a) || [])
        items.push({ week: x.week, kind: "story", text: `${x.title}: ${x.choice}` });
      // Newest first; within a week, the later entry first (signing, then releases, then the rest).
      return items
        .map((x, i) => ({ ...x, i }))
        .sort((x, y) => y.week - x.week || y.i - x.i)
        .map(({ i, ...x }) => x)
        .slice(0, WHY_RULES.timeline);
    }
    function validSave(s) {
      const w = s.company?.why;
      if (w === undefined) return true;
      return (
        Array.isArray(w) &&
        w.length <= WHY_RULES.keep &&
        w.every((x) => x && Number.isInteger(x.week) && typeof x.title === "string" && Array.isArray(x.parts))
      );
    }

    return { validSave, api: { WHY_RULES, noteWhy, whyFor, valuationWhy, monthlyLedger, timeline } };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { why: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
