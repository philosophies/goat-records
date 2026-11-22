// Late-game delegation (3.0): renewals by rule from phase 3, tour booking from phase 4, department
// autopilot from phase 5 and a chief operating officer for small company events at phase 6. Every
// automated step is logged; a monthly notice sums them up, and tours and junior hires can be undone.
// Delegation never touches story choices, superstars or the board.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { DELEGATION: X, COMPANY_EVENTS } = D;
    const { log } = core;
    const api = () => core.api();
    const eventById = new Map(COMPANY_EVENTS.map((e) => [e.id, e]));
    const KEYS = ["renew", "tours", "autopilot", "coo"];
    const dollars = (n) => "$" + Math.round(n).toLocaleString("en-US");

    function init(s) {
      if (!s.company || s.company.delegation) return s;
      s.company.delegation = {
        // maxWage null: follow the phase (renewWageLimit).
        renew: { on: false, minQuality: X.renew.minQuality, maxWage: null },
        tours: { on: false, cap: X.tours.cap },
        autopilot: { policy: null },
        coo: { on: false, limit: X.coo.limit },
        log: [],
        nextId: 1,
        lastSummary: s.week,
      };
      return s;
    }
    const Dg = (s) => s.company?.delegation;
    const open = (s, key) => (s.company?.phase || 0) >= X[key].phase;
    const superstar = (a) => api().tierOf?.(a) === "superstar";
    function note(s, kind, text, undo = null) {
      const d = Dg(s);
      d.log.push({ id: d.nextId++, week: s.week, kind, text, ...(undo ? { undo } : {}) });
      d.log = d.log.slice(-X.keep);
      log(s, `Delegated: ${text}`);
    }

    /** Changes one delegation setting; each unlocks at its phase. */
    function setDelegation(s, key, patch) {
      core.requireAction(s);
      const d = Dg(s);
      if (!d || !KEYS.includes(key)) throw Error("Nothing to delegate there.");
      if (!open(s, key)) throw Error(`That opens at phase ${X[key].phase}.`);
      const next = { ...d[key], ...patch };
      if (key === "autopilot" && next.policy !== null && !X.autopilot.policies[next.policy])
        throw Error("Pick safe, balanced or aggressive.");
      if (key === "tours" && !(next.cap >= 0)) throw Error("Set a budget cap.");
      if (key === "tours" && next.on && !s.company.departments[X.tours.department]?.head)
        throw Error("Hire a head of Live first: they book the tours.");
      if (key === "coo" && !(next.limit >= 0)) throw Error("Set a cash limit.");
      d[key] = next;
      return next;
    }

    // ---- Phase 3: renewals ----
    /** The wage limit for delegated renewals: the player's, or the phase's until they set one. */
    function renewWageLimit(s) {
      const m = Dg(s)?.renew.maxWage;
      return m ?? X.renew.maxWageByPhase[(s.company?.phase || 1) - 1];
    }
    function averageQuality(s, a) {
      const mine = s.albums.filter((p) => p.released && p.artist === a.id);
      return mine.length ? mine.reduce((n, p) => n + p.quality, 0) / mine.length : 0;
    }
    function renewals(s) {
      const r = Dg(s).renew;
      if (!r.on || !open(s, "renew")) return;
      for (const a of [...s.artists]) {
        if (a.contract?.remaining || superstar(a) || api().busy(s, a.id)) continue;
        const q = api().contractQuote(s, a, X.renew.term),
          avg = averageQuality(s, a);
        if (avg < r.minQuality || q.wage > renewWageLimit(s) || s.cash < q.fee) continue;
        try {
          api().renew(s, a.id, X.renew.term);
          note(
            s,
            "renew",
            `renewed ${a.name} for ${X.renew.term} albums (average quality ${Math.round(avg)}, ${dollars(q.wage)} a week).`,
          );
        } catch {}
      }
    }

    // ---- Phase 4: tours ----
    function tours(s) {
      const t = Dg(s).tours;
      if (!t.on || !open(s, "tours") || !s.company.departments[X.tours.department]?.head) return;
      // The head of Live books artists who are waiting on a full studio, not ones who could record.
      if (!api().studioCapacity(s).full) return;
      for (const a of s.artists) {
        if (superstar(a) || api().busy(s, a.id)) continue;
        const p = s.albums.find((x) => x.artist === a.id && api().popularAlbum(s, x));
        if (!p) continue;
        for (const scale of X.tours.scales) {
          let q;
          try {
            q = api().tourQuote(s, { albumId: p.id, scale, mode: "solo" });
          } catch {
            continue;
          }
          if (q.upfront > t.cap || s.cash < q.upfront + q.weekly) continue;
          try {
            const tour = api().startTour(s, { albumId: p.id, scale, mode: "solo" });
            note(
              s,
              "tour",
              `booked a ${scale} tour for ${a.name} (${p.title}), ${dollars(q.upfront)} upfront.`,
              {
                tour: tour?.id ?? s.tours.at(-1)?.id,
              },
            );
            break;
          } catch {
            // Too big for the artist's tier or otherwise not possible: try a smaller tour.
          }
        }
      }
    }

    // ---- Phase 5: department autopilot ----
    function autopilot(s) {
      const policyId = Dg(s).autopilot.policy;
      if (!policyId || !open(s, "autopilot") || s.week % X.autopilot.every !== 0) return;
      const P = X.autopilot.policies[policyId],
        reserve = P.reserveWeeks * api().upkeep(s),
        spare = (cost) => s.cash - cost >= reserve;
      let left = P.actions;
      const take = (fn) => {
        if (left <= 0) return;
        try {
          if (fn()) left--;
        } catch {}
      };
      for (const dep of api().DEPARTMENTS) {
        const dept = s.company.departments[dep.id];
        if (!dept?.head) continue;
        take(() => {
          const g = api().growthInfo(s, "head", dep.id);
          if (g.train.wait || g.train.gain <= 0 || !spare(g.train.cost)) return false;
          api().trainPerson(s, "head", dep.id);
          note(s, "train", `trained ${dept.head.name}, head of ${dep.name}, for ${dollars(g.train.cost)}.`);
          return true;
        });
        if (P.staff)
          take(() => {
            if (dept.staff >= api().maxStaff(s) || !spare(api().DEPT_STAFF.hireFee * 4)) return false;
            api().addStaff(s, dep.id);
            note(s, "staff", `added a junior to ${dep.name}.`, { department: dep.id });
            return true;
          });
      }
      if (P.develop)
        for (const a of s.artists)
          take(() => {
            if (superstar(a) || api().busy(s, a.id) || !a.contract?.remaining) return false;
            const info = api().trainingInfo(s, a);
            if (info.wait || info.gain <= 0 || !spare(info.cost)) return false;
            api().train(s, a.id);
            note(s, "develop", `developed ${a.name} for ${dollars(info.cost)}.`);
            return true;
          });
    }

    // ---- Phase 6: the chief operating officer ----
    /** Whether the COO may ever settle a company event: never board politics or superstar matters. */
    function cooMay(e) {
      const ev = eventById.get(e?.eventId);
      return (
        e?.type === "companyEvent" &&
        !!ev &&
        ev.kind !== "politics" &&
        !/^superstar/.test(ev.id) &&
        !(ev.when?.artist || []).some((c) => c.field === "tier" && c.equals === "superstar")
      );
    }
    function merit(s, choice) {
      const W = X.coo.weights,
        e = choice.effects || {};
      return (
        ((e.cash || 0) - (choice.cost || 0)) / X.coo.cashWeight +
        Object.entries(W).reduce((n, [k, w]) => n + (e[k] || 0) * w, 0)
      );
    }
    function coo(s) {
      const c = Dg(s).coo;
      if (!c.on || !open(s, "coo")) return;
      for (const e of [...s.eventQueue]) {
        if (!cooMay(e)) continue;
        const ev = eventById.get(e.eventId);
        const options = e.options
          .filter((o) => !o.defer && (o.cost || 0) <= c.limit && api().eventOptionAvailable(s, o, e))
          .map((o) => ({ o, value: merit(s, ev.choices[o.choice]) }))
          .sort((x, y) => y.value - x.value);
        if (!options.length) continue;
        const { o } = options[0];
        try {
          api().settleCompanyEvent(s, e, o);
        } catch {
          continue; // the board's budget or cash said no: the card stays for the player
        }
        s.eventQueue = s.eventQueue.filter((x) => x !== e);
        note(s, "coo", `${e.title}: ${o.label}${o.cost ? ` (${dollars(o.cost)})` : ""}.`);
      }
    }

    function weekly(s) {
      const d = Dg(s);
      if (!d) return 0;
      renewals(s);
      tours(s);
      autopilot(s);
      if (s.week - d.lastSummary >= X.summaryWeeks) {
        const month = d.log.filter((x) => x.week > d.lastSummary);
        d.lastSummary = s.week;
        if (month.length)
          s.notifications.push({
            id: s.nextId++,
            kind: "delegation",
            title: `Delegated this month: ${month.length} step${month.length === 1 ? "" : "s"}`,
            body: month.map((x) => x.text[0].toUpperCase() + x.text.slice(1)).join(" "),
            week: s.week,
          });
      }
      return 0;
    }
    function cardsQueued(s) {
      if (Dg(s)) coo(s);
    }

    /** Undoes a delegated step where possible: a tour not yet under way, or a junior hire. */
    function undoDelegated(s, entryId) {
      core.requireAction(s);
      const d = Dg(s),
        x = d?.log.find((e) => e.id === Number(entryId));
      if (!x?.undo || x.undone) throw Error("That step cannot be undone.");
      if (x.undo.tour !== undefined) api().cancelTour(s, x.undo.tour);
      else if (x.undo.department) api().removeStaff(s, x.undo.department);
      x.undone = true;
      log(s, `Undone: ${x.text}`);
      return x;
    }
    /** The last month's delegated steps, newest first. */
    function delegationSummary(s) {
      const d = Dg(s);
      if (!d) return null;
      return {
        settings: { renew: d.renew, tours: d.tours, autopilot: d.autopilot, coo: d.coo },
        open: Object.fromEntries(KEYS.map((k) => [k, open(s, k)])),
        month: d.log.filter((x) => x.week > s.week - X.summaryWeeks).reverse(),
        log: [...d.log].reverse(),
      };
    }

    function validSave(s) {
      const d = Dg(s);
      if (d === undefined) return true;
      return (
        !!d &&
        typeof d.renew?.on === "boolean" &&
        typeof d.tours?.on === "boolean" &&
        (d.autopilot?.policy === null || !!X.autopilot.policies[d.autopilot?.policy]) &&
        typeof d.coo?.on === "boolean" &&
        Array.isArray(d.log) &&
        Number.isInteger(d.nextId)
      );
    }

    return {
      init,
      weekly,
      cardsQueued,
      validSave,
      api: { DELEGATION: X, renewWageLimit, setDelegation, undoDelegated, delegationSummary, cooMay },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { delegation: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
