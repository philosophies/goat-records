// Roster tiers (3.0): up-and-comers, stars and superstars in CEO runs. A tier sets what the company
// may spend on the artist; the phase sets how many slots each tier has. Classic saves are not touched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { TIERS, TIER_SLOTS, TIER_RULES, FACE, SECOND_ACT, LEVELS } = D;
    const { log, roll, clamp } = core;
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
      const from = tierOf(a),
        up = ORDER.indexOf(id) > ORDER.indexOf(from),
        rule = TIER_RULES[id];
      core.api().noteWhy?.(s, {
        kind: "tier",
        who: `artist:${a.id}`,
        title: `${up ? "Moved up" : "Dropped"} to ${tierById[id].name}`,
        parts: up
          ? [
              { name: `Artist fame (needs ${rule.fame})`, value: Math.round(a.fame || 0) },
              { name: `Hits with the label (needs ${rule.hits})`, value: hitsWith(s, a) },
              { name: `${tierById[id].name} slots this phase`, value: tierSlots(s)[id] },
            ]
          : s.albums
              .filter((x) => x.artist === a.id && x.released)
              .slice(-TIER_RULES.demotion.flops)
              .map((x) => ({
                name: `${x.title} (below ${TIER_RULES.demotion.quality})`,
                value: x.quality || 0,
              })),
      });
      a.tier = id;
      if (id === "superstar" && !Number.isFinite(a.ceoRelation))
        a.ceoRelation = Math.round(
          FACE.relation.start + ((a.persona?.loyalty ?? 50) - 50) * FACE.relation.loyaltyWeight,
        );
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
      if (a && (p.quality || 0) >= TIER_RULES.hitQuality) a.xp = (a.xp || 0) + LEVELS.hitXp;
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
    // ---- Artist levels (T49) ----
    /** Marks a CEO run's artists for the 30-level career. */
    function markCareers(s) {
      if (!s.company) return;
      for (const a of [...s.artists, ...s.candidates]) a.longCareer = true;
    }
    function rawLevel(a) {
      let n = 1;
      for (let i = 1; i < LEVELS.xp.length; i++) if ((a.xp || 0) >= LEVELS.xp[i]) n = i + 1;
      return n;
    }
    /** The level a CEO-run artist plays at, capped by their tier; null for classic artists. */
    function artistLevel(a) {
      if (!a?.longCareer) return null;
      return Math.min(rawLevel(a), LEVELS.cap[tierOf(a)]);
    }
    /** Everything the artist panel shows about levels. */
    function levelInfo(a) {
      const lv = artistLevel(a);
      if (lv === null) {
        const L = core.api().level(a),
          X = core.api().CAREER_XP;
        return {
          level: L,
          max: X.length,
          cap: X.length,
          capped: false,
          xp: a.xp || 0,
          next: X[L] ?? null,
          perks: [],
        };
      }
      const cap = LEVELS.cap[tierOf(a)],
        capped = rawLevel(a) > cap || (rawLevel(a) === cap && cap < LEVELS.xp.length);
      return {
        level: lv,
        max: LEVELS.xp.length,
        cap,
        capped,
        xp: a.xp || 0,
        next: lv < cap ? LEVELS.xp[lv] : null,
        perks: LEVELS.perks.filter((p) => p.level <= lv),
        nextPerk: LEVELS.perks.find((p) => p.level > lv) || null,
      };
    }
    function perkTotals(a) {
      const lv = artistLevel(a) || 0;
      return LEVELS.perks
        .filter((p) => p.level <= lv)
        .reduce((t, p) => ({ stage: t.stage + p.stage, sales: t.sales + p.sales }), { stage: 0, sales: 0 });
    }
    /** Long careers lift an artist's potential, so craft can keep growing late in a run. */
    function trainingAdjust(s, a) {
      const lv = artistLevel(a);
      if (!s.company || !lv) return {};
      return { potentialBonus: Math.floor(Math.max(0, lv - LEVELS.potentialFrom) / LEVELS.potentialEvery) };
    }
    function stageParts(s, p) {
      if (!s.company) return [];
      const a = s.artists.find((x) => x.id === p.artist),
        n = a ? perkTotals(a).stage : 0;
      return n ? [{ name: `Career perks · level ${artistLevel(a)}`, value: n }] : [];
    }
    function salesMultiplier(s, p, a) {
      if (!s.company || !a) return 1;
      return 1 + perkTotals(a).sales;
    }
    /** Gives artists in older CEO saves the tier they have earned, as far as the slots allow. */
    function init(s) {
      markCareers(s);
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

    // ---- The face of the company (T46) ----
    function superstars(s) {
      return s.company ? s.artists.filter((a) => tierOf(a) === "superstar") : [];
    }
    function relationOf(a) {
      return Number.isFinite(a.ceoRelation) ? a.ceoRelation : FACE.relation.start;
    }
    /** Moves the CEO relationship; superstars swing harder. Returns the new value. */
    /** Moves the artist's relationship with the CEO; `reason` is logged when the swing is big. */
    function shiftRelation(s, a, n, reason) {
      const swing = tierOf(a) === "superstar" ? FACE.relation.swing : 1,
        before = relationOf(a);
      a.ceoRelation = Math.round(clamp(before + n * swing, -100, 100));
      const delta = a.ceoRelation - before;
      if (Math.abs(delta) >= (core.api().WHY_RULES?.relationMin ?? 3))
        core.api().noteWhy?.(s, {
          kind: "relation",
          who: `artist:${a.id}`,
          title: `Relationship with you ${delta > 0 ? "+" : ""}${delta}: ${reason || "a change of heart"}`,
          parts: [
            { name: reason || "A change of heart", value: n },
            ...(swing !== 1 ? [{ name: `Superstars feel it ×${swing}`, value: delta - n }] : []),
          ],
        });
      return a.ceoRelation;
    }
    function face(s) {
      if (!s.company) return null;
      s.company.face ??= { shocks: [] };
      return s.company.face;
    }
    /** News that moves company value for a while: { artist, mult, until, text }. */
    function addShock(s, a, mult, weeks, text) {
      face(s).shocks.push({ artist: a?.id ?? null, mult, until: s.week + weeks, text });
    }
    /** Company value multiplier from the superstars' standing and their recent news. */
    function faceMultiplier(s) {
      if (!s.company) return 1;
      const brand = superstars(s).reduce(
        (n, a) => n + FACE.brand * ((a.fame || 0) / 100) * (relationOf(a) >= 0 ? 1 : -0.5),
        0,
      );
      const news = (face(s).shocks || [])
        .filter((x) => x.until >= s.week)
        .reduce((n, x) => n * (1 + x.mult), 1);
      return Math.max(0.5, (1 + brand) * news);
    }
    function endorsements(s) {
      const rate = FACE.endorse[(s.company?.phase || 1) - 1] || 0;
      return superstars(s).reduce(
        (n, a) => n + Math.round((a.fame || 0) * rate * (relationOf(a) >= 0 ? 1 : 0.5)),
        0,
      );
    }
    function faceWeek(s) {
      const f = face(s);
      f.shocks = f.shocks.filter((x) => x.until >= s.week);
      let income = 0;
      for (const a of superstars(s)) {
        const target = ((a.morale ?? 75) - 60) / 2;
        a.ceoRelation = Math.round(relationOf(a) + (target - relationOf(a)) * FACE.relation.drift);
        if (roll(s, "face") >= FACE.shock.chance) continue;
        const warm = (relationOf(a) + 100) / 200,
          good = roll(s, "face") < 0.3 + 0.5 * warm,
          S = good ? FACE.shock.good : FACE.shock.bad,
          cash = S.cashPerPhase * s.company.phase;
        addShock(
          s,
          a,
          S.mult,
          S.weeks,
          good ? `${a.name} is everywhere this month` : `${a.name} is in the wrong kind of headlines`,
        );
        s.cash += cash;
        if (S.relation) shiftRelation(s, a, S.relation, `${a.name} in the wrong kind of headlines`);
        s.notifications.push({
          id: s.nextId++,
          kind: good ? "tier" : "deadline",
          title: good ? `${a.name} lifts the label` : `${a.name} drags the label down`,
          body: good
            ? `A sold-out night and a viral moment. Company value is up ${Math.round(S.mult * 100)}% for ${S.weeks} weeks, and $${cash.toLocaleString("en-US")} in bookings came in.`
            : `Bad press around your superstar. Company value is down ${Math.round(-S.mult * 100)}% for ${S.weeks} weeks, and damage control cost $${(-cash).toLocaleString("en-US")}.`,
          week: s.week,
        });
        income += 0;
      }
      return income + endorsements(s);
    }

    // ---- Second act (T47) ----
    /** Superstars who would follow a fired or ousted CEO to a new company. */
    function willingToFollow(s) {
      return superstars(s).filter(
        (a) => relationOf(a) >= SECOND_ACT.relation && (a.persona?.loyalty ?? 50) >= SECOND_ACT.loyalty,
      );
    }
    /**
     * Starts a new company after you were fired or ousted, with one superstar who follows you.
     * Returns the new run's state; the old one is left as it was.
     */
    function secondAct(s, artistId, labelName) {
      if (!s.company || !s.finished || !(s.fired || s.ousted))
        throw Error("A second act follows being fired or ousted.");
      const a = willingToFollow(s).find((x) => x.id === Number(artistId));
      if (!a) throw Error("That artist will not follow you.");
      const name = String(labelName || "").trim();
      if (!name) throw Error("Name the new company.");
      const game = core.api(),
        n = game.create((s.seed ^ 0x5eca7) >>> 0, { labelName: name }),
        b = JSON.parse(JSON.stringify(a));
      Object.assign(b, {
        id: n.nextId++,
        tier: "superstar",
        contract: { ...(b.contract || {}), remaining: SECOND_ACT.albums, term: SECOND_ACT.albums },
      });
      n.artists.push(b);
      n.cash += SECOND_ACT.cash;
      n.campaign.run = s.campaign?.run ?? n.campaign.run;
      n.secondAct = {
        count: (s.secondAct?.count || 0) + 1,
        from: game.labelName(s),
        artist: b.name,
        week: s.week,
      };
      log(n, `A second act: ${b.name} left ${n.secondAct.from} to start ${name} with you.`);
      return n;
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
      a.longCareer = true;
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
      markCareers(s);
      promote(s);
      if (!s.company) return 0;
      const income = faceWeek(s);
      s.cash += income;
      return income;
    }
    function validSave(s) {
      if (!s.company) return true;
      const f = s.company.face;
      if (
        f !== undefined &&
        !(f && Array.isArray(f.shocks) && f.shocks.every((x) => Number.isFinite(x.mult)))
      )
        return false;
      return s.artists.every(
        (a) =>
          (a.tier === undefined || !!tierById[a.tier]) &&
          (a.longCareer === undefined || typeof a.longCareer === "boolean") &&
          (a.ceoRelation === undefined || (Number.isFinite(a.ceoRelation) && Math.abs(a.ceoRelation) <= 100)),
      );
    }

    return {
      init,
      validSave,
      weekly,
      onRelease,
      stageParts,
      salesMultiplier,
      trainingAdjust,
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
        LEVELS,
        artistLevel,
        levelInfo,
        FACE,
        superstars,
        relationOf,
        shiftRelation,
        faceMultiplier,
        endorsements,
        addShock,
        SECOND_ACT,
        willingToFollow,
        secondAct,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { roster: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
