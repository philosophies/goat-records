// Fortune (CEO runs): rates each option on a decision card safe, steady or bold, draws its outcome
// when it is chosen and scales its effects to match. Classic runs never use it.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { FORTUNE: F } = D;
    const { roll } = core;
    const GOOD = new Set(F.keys.good),
      BAD = new Set(F.keys.bad),
      MULT = new Set(F.keys.mult),
      WHOLE = new Set(F.keys.whole);
    const companyEvents = new Map((D.COMPANY_EVENTS || []).map((e) => [e.id, e]));

    /** The effects an option can have, for rating it: { effects, failure, chance, cost }. */
    function optionEffects(e, o) {
      if (e.type === "companyEvent") {
        const c = companyEvents.get(e.eventId)?.choices[o.choice];
        return c
          ? { effects: c.effects || {}, failure: c.failure, chance: c.chance, cost: c.cost || 0 }
          : null;
      }
      return { effects: o, cost: o.cost || 0 };
    }
    function stakesOf(x) {
      if (!x) return 0;
      const S = F.stakes;
      let n = (x.cost || 0) * S.cost + (x.chance !== undefined ? S.gamble : 0);
      for (const set of [x.effects, x.failure])
        for (const [k, v] of Object.entries(set || {})) {
          if (typeof v !== "number" || k === "cost") continue;
          if (k === "cash") n += Math.abs(v) * S.cash;
          else if (MULT.has(k)) n += Math.abs(v - 1) * S.mult;
          else if (GOOD.has(k) || BAD.has(k) || WHOLE.has(k)) n += Math.abs(v) * S.default;
        }
      return n;
    }
    /** Whether a card plays out by chance: CEO runs, every card but those with their own odds. */
    function chancy(s, e) {
      return !!s.company && !s.company.fixedOutcomes && !!e && !F.exempt.includes(e.type);
    }
    /** Checks only: every choice plays exactly as written. */
    function setFixedOutcomes(s, on) {
      if (!s.company) throw Error("Only CEO runs play choices by chance.");
      if (on) s.company.fixedOutcomes = true;
      else delete s.company.fixedOutcomes;
    }
    /** Safe, steady or bold for each option on a card (null for options that are not a call). */
    function optionRisks(s, e) {
      if (!chancy(s, e)) return e?.options?.map(() => null) || [];
      const stakes = e.options.map((o) => (o.defer ? null : stakesOf(optionEffects(e, o))));
      const real = stakes.filter((x) => x !== null);
      const low = Math.min(...real),
        high = Math.max(...real);
      return stakes.map((x) => {
        if (x === null) return null;
        if (high - low < 1) return "steady";
        if (x === low) return "safe";
        if (x === high) return "bold";
        return "steady";
      });
    }
    /** Scales one set of effects to an outcome. */
    function scale(effects, out) {
      if (!effects || !out) return effects;
      const r = {};
      for (const [k, v] of Object.entries(effects)) {
        if (typeof v !== "number") {
          r[k] =
            k === "brand" && v && typeof v.mult === "number"
              ? { ...v, mult: 1 + (v.mult - 1) * (v.mult < 1 ? out.loss : out.gain) }
              : v;
          continue;
        }
        if (MULT.has(k))
          r[k] = Math.max(0.1, Math.round((1 + (v - 1) * (v >= 1 ? out.gain : out.loss)) * 100) / 100);
        else if (BAD.has(k)) r[k] = Math.round(v * (v > 0 ? out.loss : out.gain) * 100) / 100;
        else if (WHOLE.has(k)) r[k] = Math.max(0, Math.round(v * Math.max(0, out.gain)));
        else if (GOOD.has(k)) {
          const f = v > 0 ? out.gain : out.loss;
          r[k] = k === "cash" ? Math.round(v > 0 ? v * Math.max(0, f) : v * f) : Math.round(v * f);
        } else r[k] = v;
      }
      return r;
    }
    /**
     * Draws the outcome of option `index` on card `e`: { risk, tier, name, gain, loss, option } where
     * option is the option with its effects scaled. Null when the card does not play out by chance.
     */
    function drawFortune(s, e, index) {
      const o = e.options[index];
      if (!chancy(s, e) || !o || o.defer) return null;
      const risk = optionRisks(s, e)[index] || "steady",
        table = F.risks[risk];
      let r = roll(s, "fortune") * table.reduce((n, t) => n + t.weight, 0);
      const t = table.find((x) => (r -= x.weight) < 0) || table.at(-1);
      const { cost, ...rest } = o;
      return {
        risk,
        tier: t.id,
        name: F.outcomeNames[t.id],
        gain: t.gain,
        loss: t.loss,
        option: { ...scale(rest, t), ...(cost !== undefined ? { cost } : {}) },
      };
    }
    // What a choice changed, measured before and after it, for the card that reveals the outcome.
    const WATCH = [
      ["cash", "Cash", (s) => s.cash],
      ["fame", "Label fame", (s) => s.fame],
      ["reputation", "Reputation", (s) => s.reputation],
      ["confidence", "Board confidence", (s) => s.company?.board?.confidence],
    ];
    const ARTIST = [
      ["morale", "morale"],
      ["fans", "fans"],
      ["fame", "fame"],
      ["trust", "trust"],
      ["energy", "energy"],
      ["attention", "attention"],
      ["reputation", "reputation"],
    ];
    function fortuneSnapshot(s, e) {
      const a = s.artists.find((x) => x.id === e.artist),
        t = e.tour !== undefined ? s.tours.find((x) => x.id === e.tour) : null,
        p = e.album !== undefined ? s.albums.find((x) => x.id === e.album) : null;
      return {
        label: Object.fromEntries(WATCH.map(([k, , f]) => [k, f(s)])),
        artist: a && { id: a.id, name: a.name, ...Object.fromEntries(ARTIST.map(([k]) => [k, a[k]])) },
        tour: t && { quality: t.quality, days: t.plannedDays, status: t.status },
        album: p && { weeks: p.salesWeeks, boosts: p.boosts?.length || 0 },
        roster: s.artists.length,
      };
    }
    function fortuneChanges(s, e, before) {
      if (!before) return [];
      const now = fortuneSnapshot(s, e),
        out = [],
        add = (name, d, money = false) => {
          const n = money ? Math.round(d) : Math.round(d * 10) / 10;
          if (Number.isFinite(n) && n !== 0) out.push({ name, delta: n, money });
        };
      for (const [k, name] of WATCH) add(name, (now.label[k] ?? 0) - (before.label[k] ?? 0), k === "cash");
      if (before.artist && now.artist)
        for (const [k, name] of ARTIST)
          add(`${before.artist.name}'s ${name}`, now.artist[k] - before.artist[k]);
      if (before.artist && !now.artist) out.push({ name: `${before.artist.name} left the label`, delta: 0 });
      if (before.tour && now.tour) {
        add("Tour quality", now.tour.quality - before.tour.quality);
        add("Tour days", now.tour.days - before.tour.days);
        if (before.tour.status === "active" && now.tour.status !== "active")
          out.push({ name: "The tour ended", delta: 0 });
      }
      if (before.album && now.album) add("Earning weeks", now.album.weeks - before.album.weeks);
      return out;
    }
    function validSave(s) {
      const x = s.company?.lastOutcome;
      return x === undefined || (!!x && typeof x.title === "string" && !!F.outcomeNames[x.tier]);
    }

    return {
      validSave,
      api: {
        FORTUNE: F,
        setFixedOutcomes,
        optionRisks,
        drawFortune,
        scaleFortune: scale,
        fortuneSnapshot,
        fortuneChanges,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { fortune: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
