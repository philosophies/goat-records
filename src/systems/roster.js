// Roster tiers (3.0): up-and-comers, stars and superstars in CEO runs. A tier sets what the company
// may spend on the artist; the phase sets how many slots each tier has. Classic saves are not touched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { TIERS, TIER_SLOTS, TIER_RULES } = D;
    const { log } = core;
    const tierById = Object.fromEntries(TIERS.map((t) => [t.id, t]));
    const ORDER = TIERS.map((t) => t.id);

    /** An artist's tier id; signed artists start as up-and-comers. */
    function tierOf(a) {
      return tierById[a?.tier] ? a.tier : "rising";
    }
    function tierInfo(a) {
      return tierById[tierOf(a)];
    }
    /** Slots per tier for the company's phase: { rising, star, superstar }. */
    function tierSlots(s) {
      const row = TIER_SLOTS[Math.max(0, Math.min(TIER_SLOTS.length, s.company?.phase || 1) - 1)];
      return Object.fromEntries(ORDER.map((id, i) => [id, row[i]]));
    }
    function tierCount(s, id) {
      return s.artists.filter((a) => tierOf(a) === id).length;
    }
    function hitsWith(s, a) {
      return s.albums.filter(
        (p) => p.artist === a.id && p.released && (p.quality || 0) >= TIER_RULES.hitQuality,
      ).length;
    }
    /** Whether an artist has earned a tier (fame and hits), regardless of free slots. */
    function earned(s, a, id) {
      const rule = TIER_RULES[id];
      return !rule || ((a.fame || 0) >= rule.fame && hitsWith(s, a) >= rule.hits);
    }
    /** What the artist still needs for the next tier: null at the top. */
    function nextTier(s, a) {
      const i = ORDER.indexOf(tierOf(a)),
        id = ORDER[i + 1];
      if (!id) return null;
      const rule = TIER_RULES[id];
      return {
        id,
        name: tierById[id].name,
        fame: { have: a.fame || 0, need: rule.fame },
        hits: { have: hitsWith(s, a), need: rule.hits },
        slot: tierCount(s, id) < tierSlots(s)[id],
      };
    }
    function move(s, a, id, why) {
      const from = tierOf(a);
      a.tier = id;
      log(
        s,
        `${a.name} ${ORDER.indexOf(id) > ORDER.indexOf(from) ? "moves up" : "drops"} to ${tierById[id].name}${why ? ": " + why : ""}.`,
      );
      if (ORDER.indexOf(id) > ORDER.indexOf(from))
        s.notifications.push({
          id: s.nextId++,
          kind: "tier",
          title: `${a.name} is now a ${tierById[id].name.toLowerCase()}`,
          body: `More of the company's money can go behind them: albums up to $${tierById[id].budget.toLocaleString("en-US")}, bigger ads and tours, a larger team.`,
          week: s.week,
        });
    }
    /** Moves up every artist who has earned the next tier and has a free slot there. */
    function promote(s) {
      if (!s.company) return [];
      const moved = [];
      for (let i = ORDER.length - 1; i > 0; i--) {
        const id = ORDER[i];
        for (const a of s.artists.filter((x) => ORDER.indexOf(tierOf(x)) === i - 1 && earned(s, x, id))) {
          if (tierCount(s, id) >= tierSlots(s)[id]) break;
          move(s, a, id);
          moved.push(a.id);
        }
      }
      return moved;
    }
    /** After a release: a run of flops drops the artist one tier. */
    function onRelease(s, p) {
      if (!s.company) return;
      const a = s.artists.find((x) => x.id === p.artist);
      if (!a || tierOf(a) === "rising") return;
      const R = TIER_RULES.demotion,
        last = s.albums
          .filter((x) => x.artist === a.id && x.released)
          .sort((x, y) => (x.releaseWeek ?? 0) - (y.releaseWeek ?? 0) || x.id - y.id)
          .slice(-R.flops);
      if (
        last.length === R.flops &&
        last.every((x) => (x.quality || 0) < R.quality) &&
        a.tierDropAfter !== p.id
      ) {
        a.tierDropAfter = p.id;
        move(s, a, ORDER[ORDER.indexOf(tierOf(a)) - 1], `${R.flops} flops in a row`);
      }
    }
    /** Gives artists in older CEO saves the tier they have earned, as far as the slots allow. */
    function init(s) {
      if (!s.company) return s;
      const fresh = s.artists.filter((a) => !tierById[a.tier]);
      if (!fresh.length) return s;
      for (const a of fresh) a.tier = "rising";
      for (const id of [...ORDER].reverse().slice(0, -1))
        for (const a of fresh
          .filter((x) => tierOf(x) === "rising" && earned(s, x, id))
          .sort((x, y) => y.fame - x.fame))
          if (tierCount(s, id) < tierSlots(s)[id]) a.tier = id;
      return s;
    }

    // ---- Caps ----
    function aTier(t) {
      return (/^[aeiou]/i.test(t.name) ? "an " : "a ") + t.name.toLowerCase();
    }
    /** Why a tier rules something out for an artist, or null: kind "budget" | "ad" | "tour" | "team". */
    function tierBlocks(s, a, kind, value) {
      if (!s.company || !a) return null;
      const t = tierInfo(a);
      if (kind === "budget" && value > t.budget)
        return `${a.name} is ${aTier(t)}: albums up to $${t.budget.toLocaleString("en-US")}.`;
      if (kind === "ad" && value.rank > t.adRank)
        return `${a.name} is ${aTier(t)}: the ${value.name.toLowerCase()} needs a bigger name.`;
      if (kind === "tour" && !t.tours.includes(value))
        return `${a.name} is ${aTier(t)}: tours up to ${t.tours.at(-1)}.`;
      if (kind === "team" && value > t.team) return `${a.name} is ${aTier(t)}: a team of up to ${t.team}.`;
      return null;
    }
    function approveSigning(s, a) {
      if (!s.company) return;
      if (tierCount(s, "rising") >= tierSlots(s).rising)
        throw Error(
          `No up-and-comer slot free (${tierSlots(s).rising} at this phase). New signings start as up-and-comers.`,
        );
    }
    function approvePlan(s, plan, a) {
      const why = tierBlocks(s, a, "budget", Number(plan.budget ?? 4000));
      if (why) throw Error(why);
    }
    function approveTour(s, q) {
      const why = tierBlocks(s, q.artist, "tour", q.scale.id);
      if (why) throw Error(why);
    }
    function weekly(s) {
      promote(s);
      return 0;
    }
    function validSave(s) {
      if (!s.company) return true;
      return s.artists.every((a) => a.tier === undefined || !!tierById[a.tier]);
    }

    return {
      init,
      validSave,
      weekly,
      onRelease,
      approveSigning,
      approvePlan,
      approveTour,
      api: {
        TIERS,
        TIER_SLOTS,
        TIER_RULES,
        tierOf,
        tierInfo,
        tierSlots,
        tierCount,
        hitsWith,
        nextTier,
        promoteTiers: promote,
        tierAfterRelease: onRelease,
        tierBlocks,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { roster: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
