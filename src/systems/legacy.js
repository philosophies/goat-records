// Legacy and challenges (3.0): achievements unlocked during a CEO run, challenge starts, legacy
// perks and the hall of fame entry a finished run leaves. The interface keeps the hall of fame and
// the achievements unlocked across runs in browser storage, outside any save.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { ACHIEVEMENTS, CHALLENGES, CHALLENGE_RULES: CR, PERKS, LEGACY_RULES: R } = D;
    const { clamp, log, operatingYear } = core;
    const perkById = new Map(PERKS.map((p) => [p.id, p]));
    const api = () => core.api();
    const L = (s) => s.company?.legacy;

    // ---- What each achievement measures ----
    const released = (s) => s.albums.filter((p) => p.released);
    const tierCount = (s, tiers) => s.artists.filter((a) => tiers.includes(api().tierOf?.(a))).length;
    const MEASURES = {
      artistsSigned: (s) => s.artists.length + released(s).length,
      releases: (s) => released(s).length,
      hits: (s) => released(s).filter((p) => p.hit).length,
      // Lower is better: the threshold is a chart position.
      bestPeak: (s) => Math.min(999, ...released(s).map((p) => p.chart?.best ?? 999)),
      phase: (s) => s.company.phase,
      stars: (s) => tierCount(s, ["star", "superstar"]),
      superstars: (s) => tierCount(s, ["superstar"]),
      awards: (s) => s.awards,
      classics: (s) => released(s).filter((p) => api().albumStatus?.(s, p) === "classic").length,
      classicYears: (s) =>
        Math.max(
          0,
          ...released(s)
            .filter((p) => api().albumStatus?.(s, p) === "classic")
            .map((p) => Math.floor((s.week - p.releaseWeek) / 52)),
        ),
      deluxe: (s) => s.albums.filter((p) => p.deluxe).length,
      syncs: (s) => s.company.catalog?.syncs || 0,
      battlesWon: (s) => s.albums.filter((p) => p.battle?.won).length,
      feudBattlesWon: (s) => s.albums.filter((p) => p.battle?.won && p.battle.feud).length,
      rivalsBought: (s) => (s.company.rivals || []).filter((r) => r.bought).length,
      rivalSignings: (s) => s.artists.filter((a) => typeof a.from === "string").length,
      eraInvestments: (s) => s.company.eras?.invested.length || 0,
      era: (s) => api().eraInfo?.(s)?.index ?? 0,
      listed: (s) => (s.company.offering ? 1 : 0),
      cash: (s) => s.cash,
      topLevel: (s) => Math.max(0, ...s.artists.map((a) => api().artistLevel?.(a) ?? 0)),
      secondAct: (s) => s.secondAct?.count || 0,
      secondActOutgrown: (s) => (s.secondAct?.phase && s.company.phase > s.secondAct.phase ? 1 : 0),
      years: (s) => operatingYear(s.week) - 1,
      challengePhase: (s) => (L(s)?.challenge ? s.company.phase : 0),
    };
    function met(s, a) {
      const v = MEASURES[a.check](s);
      return a.check === "bestPeak" ? v <= a.n : v >= a.n;
    }

    // ---- Setup ----
    function init(s) {
      if (!s.company || s.company.legacy) return s;
      s.company.legacy = { achievements: [], perks: [], challenge: null, recorded: false };
      return s;
    }
    /** Applies a chosen challenge and perks once every other system has set the run up. */
    function afterInit(s) {
      const setup = s.setup;
      delete s.setup;
      if (!setup || !s.company?.legacy) return;
      const perks = [...new Set(setup.perks || [])].filter((id) => perkById.has(id)).slice(0, R.maxPerks);
      if (setup.challenge) applyChallenge(s, setup.challenge, setup.seed);
      for (const id of perks) applyPerk(s, id);
      L(s).perks = perks;
    }
    /** The twist a weekly run gets from its seed. */
    function weeklyTwist(seed) {
      return CR.weeklyTwists[(seed >>> 0) % CR.weeklyTwists.length];
    }
    /** This week's shared seed: the same for every player in the same ISO week. */
    function weeklyChallenge(date) {
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const year = d.getUTCFullYear(),
        week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
      let h = 2166136261;
      for (const c of `goat-weekly-${year}-${week}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      return { year, week, seed: h, twist: weeklyTwist(h) };
    }
    function applyChallenge(s, id, seed) {
      if (!CHALLENGES.some((c) => c.id === id)) throw Error("Unknown challenge.");
      const twist = id === "weekly" ? weeklyTwist(seed) : id;
      L(s).challenge = { id, twist, seed };
      if (twist === "debt") {
        const cash = s.cash;
        api().takeFunding(s, "loan");
        const loan = s.company.loan;
        loan.payment = Math.ceil((loan.payment * CR.debt.loan) / loan.amount);
        Object.assign(loan, { amount: CR.debt.loan, balance: CR.debt.loan });
        s.cash = cash;
      } else if (twist === "star") {
        const S = CR.star,
          a = api().makeProspect(s, 0);
        Object.assign(a, {
          talent: S.talent,
          potential: Math.max(a.potential || 0, S.talent + 10),
          fame: S.fame,
        });
        s.candidates.push(a);
        s.cash = 1e6;
        api().sign(s, a.id, 3);
        const signed = s.artists.find((x) => x.id === a.id);
        signed.tier = "superstar";
        signed.contract.remaining = S.albums;
        s.cash = S.cash;
      } else if (twist === "board") {
        const B = CR.board,
          phase = s.company.phase;
        s.company.phase = Math.max(phase, 2);
        const cash = s.cash;
        api().takeFunding(s, "angel", 0);
        s.cash = cash;
        s.company.phase = phase;
        const b = s.company.board;
        b.freedom = B.freedom;
        for (const d of b.directors)
          Object.assign(d, { satisfaction: B.satisfaction, relationship: B.relationship });
      } else if (twist === "piracy") {
        const e = s.company.eras,
          gap = 104;
        e.starts[1] = 1;
        e.starts[0] = 1 - gap;
        e.starts[2] = Math.max(e.starts[2], e.starts[1] + gap);
        e.starts[3] = Math.max(e.starts[3], e.starts[2] + gap);
        e.seen = e.announced = 1;
      }
      log(s, `Challenge run: ${CHALLENGES.find((c) => c.id === id).name}.`);
    }
    function applyPerk(s, id) {
      const p = perkById.get(id);
      if (id === "extra-candidate") s.candidates.push(api().makeProspect(s, 0));
      if (id === "second-theme") api().discoverTheme?.(s, "legacy", true);
      if (p.reputation) s.reputation = clamp(s.reputation + p.reputation);
    }
    const hasPerk = (s, key) => (L(s)?.perks || []).reduce((n, id) => n + (perkById.get(id)[key] || 0), 0);
    /** Whether a challenge rules out bank loans. */
    function noLoans(s) {
      return L(s)?.challenge?.twist === "noLoans";
    }

    // ---- The week ----
    function weekly(s) {
      const l = L(s);
      if (!l) return 0;
      for (const a of ACHIEVEMENTS) {
        if (l.achievements.includes(a.id) || !met(s, a)) continue;
        l.achievements.push(a.id);
        s.notifications.push({
          id: s.nextId++,
          kind: "achievement",
          title: `Achievement: ${a.name}`,
          body: a.text,
          week: s.week,
        });
      }
      return 0;
    }
    function salesMultiplier(s) {
      return 1 + hasPerk(s, "sales");
    }
    function tourGate(s) {
      return 1 + hasPerk(s, "touring");
    }
    function trainingAdjust(s) {
      return { discount: hasPerk(s, "training") };
    }

    // ---- The hall of fame ----
    /** What a finished run leaves in the hall of fame. */
    function hallEntry(s) {
      const review = api().finalReview(s),
        best = released(s).toSorted((a, b) => b.quality - a.quality || a.releaseWeek - b.releaseWeek)[0];
      return {
        label: api().labelName(s),
        ending: review.ending,
        years: review.yearsPlayed,
        peakPhase: Math.max(s.company.phase, ...(s.company.history || []).map((h) => h.phase)),
        bestAlbum: best ? { title: best.title, artist: best.artistName, quality: best.quality } : null,
        superstars: s.artists.filter((a) => api().tierOf?.(a) === "superstar").map((a) => a.name),
        score: review.score.total,
        challenge: L(s)?.challenge?.id || null,
        achievements: L(s)?.achievements.length || 0,
        seed: L(s)?.challenge?.seed ?? null,
      };
    }
    /**
     * Adds a finished run to a hall of fame (an array kept outside the save) once, newest first.
     * Returns the new hall; the run is marked recorded.
     */
    function recordRun(hall, s, when = 0) {
      const list = Array.isArray(hall) ? hall : [];
      if (!s.finished || !L(s) || L(s).recorded) return list;
      L(s).recorded = true;
      return [{ ...hallEntry(s), when }, ...list].slice(0, R.hallSize);
    }
    /** Achievements unlocked across runs: the stored ids plus this run's. */
    function unlockedAchievements(stored, s) {
      const ids = new Set([...(Array.isArray(stored) ? stored : []), ...(L(s)?.achievements || [])]);
      return ACHIEVEMENTS.filter((a) => ids.has(a.id)).map((a) => a.id);
    }
    /** A hall of fame entry that came from a file: a known shape, or null. */
    function cleanEntry(e) {
      if (!e || typeof e !== "object" || typeof e.label !== "string" || !Number.isFinite(e.when ?? 0))
        return null;
      return {
        label: e.label.slice(0, 80),
        ending: ["complete", "fired", "folded"].includes(e.ending) ? e.ending : "complete",
        years: Number.isInteger(e.years) ? e.years : 0,
        peakPhase: Number.isInteger(e.peakPhase) ? e.peakPhase : 1,
        bestAlbum:
          e.bestAlbum && typeof e.bestAlbum.title === "string"
            ? {
                title: e.bestAlbum.title.slice(0, 80),
                artist: String(e.bestAlbum.artist ?? "").slice(0, 80),
                quality: Number(e.bestAlbum.quality) || 0,
              }
            : null,
        superstars: Array.isArray(e.superstars)
          ? e.superstars.filter((x) => typeof x === "string").slice(0, 10)
          : [],
        score: Number(e.score) || 0,
        challenge: CHALLENGES.some((c) => c.id === e.challenge) ? e.challenge : null,
        achievements: Number(e.achievements) || 0,
        seed: Number.isFinite(e.seed) ? e.seed : null,
        when: Number(e.when) || 0,
      };
    }
    /**
     * Merges a hall of fame and achievements carried in a save file into this browser's: the same run
     * is kept once, newest first, within the hall's size; achievements are the union.
     */
    function mergeLegacy(local, incoming) {
      const key = (e) => [e.label, e.ending, e.years, e.peakPhase, e.when, e.seed].join("|");
      const seen = new Set(),
        hall = [...(local?.hall || []), ...(Array.isArray(incoming?.hall) ? incoming.hall : [])]
          .map(cleanEntry)
          .filter((e) => e && !seen.has(key(e)) && seen.add(key(e)))
          .sort((a, b) => b.when - a.when)
          .slice(0, R.hallSize);
      const ids = new Set([
        ...(local?.achievements || []),
        ...(Array.isArray(incoming?.achievements) ? incoming.achievements : []),
      ]);
      return { hall, achievements: ACHIEVEMENTS.filter((a) => ids.has(a.id)).map((a) => a.id) };
    }
    /** Perks open to a player with this many achievements unlocked. */
    function perksOpen(count) {
      return PERKS.filter((p) => count >= p.unlock).map((p) => p.id);
    }

    function validSave(s) {
      const l = L(s);
      if (l === undefined) return true;
      return (
        !!l &&
        Array.isArray(l.achievements) &&
        l.achievements.every((id) => ACHIEVEMENTS.some((a) => a.id === id)) &&
        Array.isArray(l.perks) &&
        l.perks.length <= R.maxPerks &&
        l.perks.every((id) => perkById.has(id)) &&
        (l.challenge === null || CHALLENGES.some((c) => c.id === l.challenge?.id)) &&
        typeof l.recorded === "boolean"
      );
    }

    return {
      init,
      afterInit,
      weekly,
      salesMultiplier,
      tourGate,
      trainingAdjust,
      validSave,
      api: {
        ACHIEVEMENTS,
        CHALLENGES,
        PERKS,
        LEGACY_RULES: R,
        weeklyChallenge,
        hallEntry,
        recordRun,
        unlockedAchievements,
        mergeLegacy,
        perksOpen,
        noLoans,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { legacy: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
