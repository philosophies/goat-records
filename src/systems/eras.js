// Music eras (3.0): four eras per CEO run, their change years shifted at random per run, each
// announced 13 weeks ahead with a chance to invest early. Classic runs have no eras.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { ERAS, ERA_REVENUE, ERA_RULES: R } = D;
    const { roll, log } = core;
    const weekOfYear = (year) => (year - 1) * 52 + 1;

    /** The years each era starts for a run, from its own random stream. */
    function eraYears(s) {
      const years = [1];
      for (const era of ERAS.slice(1)) {
        const prev = years.at(-1),
          options = R.shifts.map((d) => era.from + d).filter((y) => y - prev >= R.minYears);
        years.push(options[Math.floor(roll(s, "eras") * options.length)]);
      }
      return years;
    }
    function init(s) {
      if (!s.company || s.company.eras) return s;
      const starts = eraYears(s).map(weekOfYear),
        now = indexAt(starts, s.week);
      // An older save starts in whatever era its year falls in, with past changes already seen.
      s.company.eras = { starts, invested: [], announced: now, seen: now };
      return s;
    }
    function indexAt(starts, week) {
      let i = 0;
      while (i + 1 < starts.length && starts[i + 1] <= week) i++;
      return i;
    }
    /** The current era, or null in a classic run. */
    function currentEra(s) {
      const e = s.company?.eras;
      return e ? ERAS[indexAt(e.starts, s.week)] : null;
    }
    /** The multiplier the current era puts on a stream (sales, singles, touring, licensing, catalog, marketing). */
    function eraFactor(s, stream) {
      const e = s.company?.eras;
      if (!e || !stream) return 1;
      const i = indexAt(e.starts, s.week),
        era = ERAS[i];
      let f = era[stream] ?? 1;
      if (era.strongest === stream && e.invested.includes(era.id) && s.week < e.starts[i] + R.invest.weeks)
        f *= 1 + R.invest.bonus;
      return f;
    }
    /** How the current era weights a company event. */
    function eraEventWeight(s, id) {
      return currentEra(s)?.events[id] ?? 1;
    }
    /** The era a company revenue line follows. */
    function revenueFactor(s, id) {
      return eraFactor(s, ERA_REVENUE[id]);
    }
    function investCost(s) {
      return R.invest.costPerPhase * (s.company?.phase || 1);
    }
    /** What the market screen shows: the era now, its numbers, and the next change once announced. */
    function eraInfo(s) {
      const e = s.company?.eras;
      if (!e) return null;
      const i = indexAt(e.starts, s.week),
        next = ERAS[i + 1];
      return {
        era: ERAS[i],
        index: i,
        since: e.starts[i],
        invested: e.invested.includes(ERAS[i].id) && s.week < e.starts[i] + R.invest.weeks,
        next: next && e.announced > i ? { era: next, week: e.starts[i + 1] } : null,
        factor: (stream) => eraFactor(s, stream),
      };
    }

    function weekly(s) {
      const e = s.company?.eras;
      if (!e) return 0;
      const i = indexAt(e.starts, s.week);
      if (i > e.seen) {
        e.seen = i;
        const era = ERAS[i];
        log(s, `A new era: ${era.name}.`);
        s.notifications.push({
          id: s.nextId++,
          kind: "era",
          title: `A new era: ${era.name}`,
          body: era.text,
          week: s.week,
        });
      }
      const n = i + 1;
      if (n < ERAS.length && e.announced < n && s.week >= e.starts[n] - R.announce) {
        e.announced = n;
        const era = ERAS[n],
          cost = investCost(s),
          weeks = e.starts[n] - s.week,
          lift = Math.round(R.invest.bonus * 100);
        s.eventQueue.push({
          type: "era",
          era: n,
          artist: null,
          title: `A new era in ${weeks} weeks: ${era.name}`,
          body: `${era.text} The change comes in week ${e.starts[n]} (year ${core.operatingYear(e.starts[n])}).`,
          options: [
            {
              label: "Invest early",
              hint: `Costs $${cost.toLocaleString("en-US")}. ${cap(era.strongest)} +${lift}% for the era's first year.`,
              cost,
              eraChoice: "invest",
            },
            { label: "Wait and see", hint: "No cost.", eraChoice: "wait" },
          ],
        });
      }
      return 0;
    }
    const cap = (x) => x[0].toUpperCase() + x.slice(1);
    function eventChoice(s, e, o) {
      if (e.type !== "era" || o.eraChoice !== "invest") return;
      const id = ERAS[e.era]?.id;
      if (id && !s.company.eras.invested.includes(id)) s.company.eras.invested.push(id);
    }

    /** Album sales follow the era; a lead single's lift follows its singles number. */
    function salesMultiplier(s, p) {
      if (!s.company?.eras) return 1;
      let f = eraFactor(s, "sales");
      const S = D.SINGLE;
      if (S && p && core.api().leadSingle?.(s, p.id) && p.age < S.launchWeeks)
        f *= (1 + (S.launchMult - 1) * eraFactor(s, "singles")) / S.launchMult;
      return f;
    }
    function tourGate(s) {
      return eraFactor(s, "touring");
    }

    function validSave(s) {
      const e = s.company?.eras;
      if (e === undefined) return true;
      return (
        !!e &&
        Array.isArray(e.starts) &&
        e.starts.length === ERAS.length &&
        e.starts.every((w, i) => Number.isInteger(w) && (i === 0 || w > e.starts[i - 1])) &&
        Array.isArray(e.invested) &&
        e.invested.every((id) => ERAS.some((x) => x.id === id)) &&
        Number.isInteger(e.announced) &&
        Number.isInteger(e.seen) &&
        [s.event, ...(s.eventQueue || [])].every(
          (x) => x?.type !== "era" || (Number.isInteger(x.era) && x.options.every((o) => !!o.eraChoice)),
        )
      );
    }

    return {
      init,
      weekly,
      eventChoice,
      salesMultiplier,
      tourGate,
      validSave,
      api: {
        ERAS,
        ERA_RULES: R,
        eraYears,
        currentEra,
        eraFactor,
        eraEventWeight,
        eraRevenueFactor: revenueFactor,
        eraInfo,
        eraInvestCost: investCost,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { eras: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
