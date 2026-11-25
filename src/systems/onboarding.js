// The first fifteen minutes (3.0): a starter checklist with small rewards, a fast first album and
// one-time tips. CEO runs only; a second act starts without it. See docs/architecture.md for hooks.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { STARTER_GOALS, STARTER, TIPS, MENTOR } = D;
    const { log } = core;

    function state(s) {
      return s.company?.onboarding || null;
    }
    /** New CEO runs start with the checklist on; older saves and second acts do not get one. */
    function init(s) {
      if (!s.company || s.company.onboarding || s.week > 1 || s.secondAct || s.artists.length) return s;
      s.company.onboarding = { on: true, done: [], tips: [], mentor: { on: true, seen: [] } };
      return s;
    }
    const met = {
      sign: (s) => s.artists.length > 0 || s.albums.length > 0,
      stage: (s) => s.albums.some((p) => p.released || (p.production?.results?.length || 0) > 0),
      release: (s) => s.albums.some((p) => p.released),
      chart: (s) => s.albums.some((p) => p.released && (p.chart?.best || Infinity) <= 300),
      profit: (s) => (s.financeHistory?.at(-1)?.cashChange || 0) > 0,
    };
    /** The checklist as shown: [{ id, text, reward, done }], or null when it is off or finished. */
    function starterGoals(s) {
      const o = state(s);
      if (!o?.on) return null;
      return STARTER_GOALS.map((g) => ({ ...g, done: o.done.includes(g.id) }));
    }
    function setStarter(s, on) {
      const o = state(s);
      if (!o) throw Error("This run has no starter checklist.");
      o.on = !!on;
      // The mentor follows the checklist: skipping it sends him home, turning it back on brings him back.
      if (o.mentor && !o.mentor.seen.includes("farewell")) o.mentor.on = !!on;
      return o;
    }

    // ---- The mentor ----
    const first = (s) => s.albums.reduce((low, x) => (!low || x.id < low.id ? x : low), null);
    /** When each beat's moment has come. A beat stays current until a later one's moment comes. */
    const moment = {
      intro: () => true,
      desk: (s, m) => m.seen.includes("intro"),
      artist: (s) => s.artists.length > 0 || s.albums.length > 0,
      record: (s, m) => m.seen.includes("artist") || s.albums.length > 0,
      stages: (s) => s.albums.length > 0,
      release: (s) => !!(first(s)?.released || first(s)?.production?.releaseReady),
      charts: (s) => !!first(s)?.released && !first(s)?.launchReview,
      billboard: (s, m) => m.seen.includes("charts") && !!first(s)?.released,
      money: (s) => state(s).done.includes("chart"),
      office: (s, m) => m.seen.includes("money"),
      // After the money talk, so it is not skipped when the chart and a profit land in one week.
      farewell: (s, m) =>
        m.seen.includes("money") && STARTER_GOALS.every((g) => state(s).done.includes(g.id)),
    };
    /** The mentor's current beat: { ...beat, seen, step, of } or null when he is not around. */
    function mentorBeat(s) {
      const m = state(s)?.mentor;
      if (!m?.on) return null;
      let current = null;
      MENTOR.beats.forEach((b, i) => {
        if (moment[b.id](s, m)) current = { ...b, step: i + 1, of: MENTOR.beats.length };
      });
      return current && { ...current, seen: m.seen.includes(current.id) };
    }
    /** The player has read a beat. The farewell ends the mentor's part. */
    function mentorSeen(s, id) {
      const m = state(s)?.mentor;
      if (!m || !MENTOR.beats.some((b) => b.id === id)) throw Error("Nothing to read.");
      if (!m.seen.includes(id)) m.seen.push(id);
      if (id === "farewell") m.on = false;
      return mentorBeat(s);
    }
    /** "Let me play on my own": the mentor stops talking; the checklist stays. */
    function setMentor(s, on) {
      const m = state(s)?.mentor;
      if (!m) throw Error("This run has no mentor.");
      m.on = !!on && !m.seen.includes("farewell");
      return m;
    }
    /** While the checklist is on, the run's first album skips the waits between stages. */
    function fastFirstAlbum(s, p) {
      const o = state(s);
      if (!o?.on || !STARTER.fastFirstAlbum) return false;
      const first = s.albums.reduce((low, x) => (x.id < low.id ? x : low), s.albums[0]);
      return first?.id === p.id;
    }
    /** The first signing of a run on the checklist costs no advance. */
    function signingDiscount(s, a, q) {
      const o = state(s);
      if (!o?.on || !STARTER.freeFirstSigning || o.done.includes("sign")) return 0;
      return s.artists.length || s.albums.length ? 0 : q.fee;
    }
    /** ...and its first album's base budget is paid for. */
    function planCost(s, plan) {
      const o = state(s);
      if (!o?.on || !STARTER.freeAlbumBudget || s.albums.length) return 0;
      return -Math.min(Number(plan.budget ?? 4000) || 0, STARTER.freeAlbumBudget);
    }
    /** What the checklist still pays for: { signing, album } (false once used or off). */
    function starterFree(s) {
      const o = state(s);
      return {
        signing: !!(
          o?.on &&
          STARTER.freeFirstSigning &&
          !o.done.includes("sign") &&
          !s.artists.length &&
          !s.albums.length
        ),
        album: !!(o?.on && STARTER.freeAlbumBudget && !s.albums.length),
      };
    }
    const tipDue = {
      party: (s) => s.albums.some((p) => !p.released && p.production?.releaseReady),
      starSlot: (s) => (core.api().tierSlots?.(s)?.star || 0) > 0,
      superstar: (s) => s.artists.some((a) => core.api().tierOf?.(a) === "superstar"),
      board: (s) => !!s.company.board,
    };
    function tips(s) {
      const o = state(s);
      if (!o) return;
      for (const t of TIPS) {
        if (o.tips.includes(t.id) || !tipDue[t.id]?.(s)) continue;
        o.tips.push(t.id);
        if (!o.on) continue; // switched off: remember it, say nothing
        s.notifications.push({ id: s.nextId++, kind: "tip", title: t.title, body: t.body, week: s.week });
      }
    }
    function weekly(s) {
      const o = state(s);
      if (!o) return 0;
      if (o.on)
        for (const g of STARTER_GOALS) {
          if (o.done.includes(g.id) || !met[g.id](s)) continue;
          o.done.push(g.id);
          const r = g.reward;
          s.cash += r.cash || 0;
          s.fame += r.fame || 0;
          if (r.reputation) s.reputation = core.clamp(s.reputation + r.reputation);
          log(s, `Starter goal done: ${g.text}.`);
        }
      tips(s);
      if (o.on && o.done.length === STARTER_GOALS.length) o.on = false;
      return 0;
    }
    function validSave(s) {
      const o = s.company?.onboarding;
      if (o === undefined) return true;
      const ids = new Set(STARTER_GOALS.map((g) => g.id)),
        tipIds = new Set(TIPS.map((t) => t.id));
      return (
        !!o &&
        typeof o.on === "boolean" &&
        Array.isArray(o.done) &&
        o.done.every((x) => ids.has(x)) &&
        Array.isArray(o.tips) &&
        o.tips.every((x) => tipIds.has(x)) &&
        (o.mentor === undefined ||
          (!!o.mentor &&
            typeof o.mentor.on === "boolean" &&
            Array.isArray(o.mentor.seen) &&
            o.mentor.seen.every((x) => MENTOR.beats.some((b) => b.id === x))))
      );
    }

    return {
      init,
      weekly,
      validSave,
      signingDiscount,
      planCost,
      api: {
        STARTER_GOALS,
        STARTER,
        TIPS,
        starterGoals,
        starterFree,
        setStarter,
        fastFirstAlbum,
        checkTips: tips,
        MENTOR,
        mentorBeat,
        mentorSeen,
        setMentor,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { onboarding: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
