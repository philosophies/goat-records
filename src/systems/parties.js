// Listening parties (3.0): before release, play the album to fans, read the room, and rework or retune it.
// CEO runs only. See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { PARTY, AUDIENCES } = D;
    const { clamp, log, pay, requireAction, roll } = core;

    function album(s, id) {
      const p = s.albums.find((x) => x.id === Number(id));
      if (!p) throw Error("Album not found.");
      return p;
    }
    function artistOf(s, p) {
      return s.artists.find((a) => a.id === p.artist) || null;
    }
    function partyCost(s, p) {
      return PARTY.cost[core.api().tierOf?.(artistOf(s, p)) || "rising"] || PARTY.cost.rising;
    }
    function sentimentName(score) {
      return PARTY.sentiment.find((b) => score >= b.min).name;
    }
    /** Whether a party can be held now, and what it costs: { available, reason, cost, leak, count }. */
    function partyQuote(s, id) {
      const p = album(s, id),
        d = p.production,
        count = p.party?.count || 0,
        out = { available: false, reason: "", cost: partyCost(s, p), leak: PARTY.leak[count] ?? 0, count };
      if (!s.company) out.reason = "Listening parties are part of a CEO run.";
      else if (p.released) out.reason = "The album is already out.";
      else if (!d?.releaseReady) out.reason = "Finish every stage first.";
      else if (d.review) out.reason = "Settle the last stage result first.";
      else if (p.party?.pending) out.reason = "Decide what to do with the last party's feedback first.";
      else if (count >= PARTY.max) out.reason = `Two parties is the most an album can take.`;
      else if (s.cash < out.cost) out.reason = "Not enough cash.";
      else out.available = true;
      return out;
    }
    function noise(s) {
      return Math.round((roll(s, "party") * 2 - 1) * PARTY.noise);
    }
    /** Holds a party: a sentiment report by audience and by album area. It may leak the album. */
    function holdParty(s, id) {
      requireAction(s);
      const p = album(s, id),
        q = partyQuote(s, id);
      if (!q.available) throw Error(q.reason);
      pay(s, q.cost);
      const quality = Math.round(p.production.results.reduce((n, r) => n + r.score, 0) / 5),
        target = AUDIENCES.indexOf(p.audience),
        audiences = AUDIENCES.map((name, i) => {
          const score = clamp(quality + PARTY.audience[Math.abs(i - Math.max(0, target))] + noise(s));
          return { name, score, sentiment: sentimentName(score) };
        }),
        areas = p.production.results.map((r, index) => {
          const score = clamp(r.score + noise(s));
          return { index, area: r.area, score, sentiment: sentimentName(score) };
        }),
        weakest = areas.reduce((low, x) => (x.score < low.score ? x : low), areas[0]),
        leaked = roll(s, "party") < q.leak,
        report = { week: s.week, cost: q.cost, audiences, areas, weakest: weakest.index, leaked };
      p.party = {
        count: q.count + 1,
        pending: true,
        reports: [...(p.party?.reports || []), report],
        single: !!p.party?.single,
      };
      if (leaked) {
        p.leaked = true;
        s.notifications.push({
          id: s.nextId++,
          kind: "deadline",
          title: `${p.title} leaked from the party`,
          body: `Someone filmed the playback. Sales will run at ${Math.round(PARTY.leakSales * 100)}% of what they would have been.`,
          week: s.week,
        });
      }
      log(
        s,
        `Listening party for ${p.title}: the room was weakest on ${p.production.results[weakest.index].area}.`,
      );
      return report;
    }
    function reworkCost(s, p) {
      return Math.round(partyCost(s, p) * PARTY.rework.cost);
    }
    /** Acts on the last party: "rework" the weakest area, change the lead "single", or "release" as is. */
    function partyChoice(s, id, choice) {
      requireAction(s);
      const p = album(s, id);
      if (!p.party?.pending) throw Error("There is no party feedback waiting.");
      const report = p.party.reports.at(-1),
        d = p.production;
      if (choice === "rework") {
        pay(s, reworkCost(s, p));
        const r = d.results[report.weakest],
          gain = PARTY.rework.gain[p.party.count - 1] ?? 0;
        r.parts.push({ name: `Listening party rework`, value: gain });
        r.score = clamp(r.parts.reduce((n, c) => n + c.value, 0));
        d.cooldown += PARTY.rework.weeks;
        d.releaseReady = false;
        log(s, `${p.title}: ${r.area} reworked after the party (+${gain}).`);
      } else if (choice === "single") {
        if (p.party.single) throw Error("The lead single has already been changed.");
        const r = d.results[4];
        r.parts.push({ name: "New lead single", value: PARTY.single });
        r.score = clamp(r.parts.reduce((n, c) => n + c.value, 0));
        p.party.single = true;
      } else if (choice !== "release") throw Error("Choose rework, single or release.");
      p.party.pending = false;
      return p;
    }
    /** A leaked album sells less. */
    function salesMultiplier(s, p) {
      return p?.leaked ? PARTY.leakSales : 1;
    }
    function validSave(s) {
      return s.albums.every(
        (p) =>
          p.party === undefined ||
          (!!p.party &&
            Number.isInteger(p.party.count) &&
            p.party.count >= 0 &&
            p.party.count <= PARTY.max &&
            Array.isArray(p.party.reports)),
      );
    }

    return {
      validSave,
      salesMultiplier,
      api: {
        PARTY,
        PARTY_AUDIENCES: AUDIENCES,
        partyQuote,
        holdParty,
        partyChoice,
        reworkCost,
        partySentiment: sentimentName,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { parties: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
