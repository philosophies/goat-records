// Rented recording locations and paid gigs.
// Locations add stage bonuses and a genre affinity to albums recorded there, level up with
// releases and reveal a signature theme on first use. Gigs earn cash for idle artists.
(function (root) {
  "use strict";
  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { clamp, log, requireAction, busy, artist, roll } = core;
    const { LOCATIONS, LOCATION_AFFINITY, LOCATION_LEVELS, GIGS, THEMES, GENRES } = D;
    const byId = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
    const gigById = Object.fromEntries(GIGS.map((g) => [g.id, g]));
    const STAGE_NAMES = ["Identity", "Songwriting", "Performance", "Sound", "Reach"];
    const labelRank = (s) => core.api().rank(s);
    const rankName = (n) => D.RANKS[n - 1]?.name || "rank " + n;

    /* ---------------- Locations ---------------- */

    function stats(s, id) {
      return s.locationStats[id] || null;
    }
    /** Level 1–9 for a location's experience. */
    function levelForXp(xp) {
      let level = 1;
      for (let i = 1; i < LOCATION_LEVELS.xp.length; i++) if (xp >= LOCATION_LEVELS.xp[i]) level = i + 1;
      return Math.min(LOCATION_LEVELS.max, level);
    }
    function locationLevel(s, id) {
      return stats(s, id)?.level || 1;
    }
    /** Rent for one album at the location's current level. */
    function locationRent(s, id) {
      const loc = byId[id];
      if (!loc) return 0;
      const level = locationLevel(s, id);
      return Math.round((loc.rent * (1 + LOCATION_LEVELS.rentStep * (level - 1))) / 50) * 50;
    }
    /** Genre affinity of a location: rating -1..2, its name and the points added to every stage. */
    function locationAffinity(id, genre) {
      const rating = byId[id]?.genres[genre] ?? 0;
      return { rating, name: LOCATION_AFFINITY.names[rating], points: LOCATION_AFFINITY.points[rating] };
    }
    /** Points a location adds to one stage at a given level. */
    function stageBoost(id, stage, level) {
      const base = byId[id]?.stages[stage];
      return base
        ? base +
            LOCATION_LEVELS.stageBonus[level - 1] +
            (byId[id].rank - 1) * (LOCATION_LEVELS.rankBonus || 0)
        : 0;
    }
    /** Calculation rows a location adds to one stage. */
    function locationRows(id, genre, stage, level) {
      const loc = byId[id];
      if (!loc) return [];
      const rows = [],
        boost = stageBoost(id, stage, level),
        fit = locationAffinity(id, genre);
      if (boost) rows.push({ name: `Location · ${loc.name} (level ${level})`, value: boost });
      if (fit.points)
        rows.push({ name: `Location genre affinity · ${genre} (${fit.name})`, value: fit.points });
      return rows;
    }
    /** What recording a genre at a location would add, for the album quote. */
    function locationQuote(s, id, genre) {
      const loc = byId[id];
      if (!loc) return null;
      const level = locationLevel(s, id),
        fit = locationAffinity(id, genre),
        stages = STAGE_NAMES.map((name, i) => ({ name, value: stageBoost(id, i, level) + fit.points }));
      return {
        id,
        name: loc.name,
        level,
        rent: locationRent(s, id),
        affinity: fit,
        stages,
        total: stages.reduce((n, x) => n + x.value, 0),
        locked: labelRank(s) < loc.rank,
        booked: bookedBy(s, id),
        signature: !stats(s, id) && !s.themes.includes(loc.theme),
      };
    }
    function bookedBy(s, id) {
      return s.albums.find((p) => !p.released && p.location === id) || null;
    }
    /** Every location with its stats, for the Locations screen. */
    function locationList(s) {
      return LOCATIONS.map((loc) => {
        const st = stats(s, loc.id),
          level = st?.level || 1,
          next = LOCATION_LEVELS.xp[level];
        return {
          ...loc,
          level,
          xp: st?.xp || 0,
          nextXp: level < LOCATION_LEVELS.max ? next : null,
          rentNow: locationRent(s, loc.id),
          locked: labelRank(s) < loc.rank,
          rankName: s.company ? D.PHASES[loc.rank - 1]?.name || "" : rankName(loc.rank),
          stats: st,
          themeKnown: !!st,
          booked: bookedBy(s, loc.id),
        };
      });
    }
    // Signature themes go through the label system so its log and checks stay in one place.
    function learnTheme(s, name, source) {
      return core.api().learnTheme(s, name, source);
    }

    /* ---------------- Gigs ---------------- */

    function gigState(s, id) {
      return s.gigs.artists[id] || { readyWeek: 0, played: 0, earned: 0 };
    }
    /** Expected pay and limits for one gig before the variation roll. */
    function gigPay(a, g) {
      const expected =
          g.base +
          Math.min(a.fans || 0, g.fanCap) * g.perFan +
          (a.fame || 0) * g.perFame +
          (a.talent || 0) * g.perCraft,
        round = (n) => Math.round(n / 10) * 10;
      return {
        expected: round(expected),
        min: round(expected * (1 - g.spread)),
        max: round(expected * (1 + g.spread)),
        raw: expected,
      };
    }
    /**
     * Quote for one artist playing one gig: pay range, energy, cooldown, and the reason it
     * cannot be played right now (null when it can).
     */
    function gigQuote(s, artistId, gigId) {
      const a = artist(s, artistId),
        g = gigById[gigId];
      if (!g) throw Error("Unknown gig.");
      const st = gigState(s, a.id),
        wait = Math.max(0, st.readyWeek - s.week),
        pay = gigPay(a, g);
      let reason = null;
      if (s.finished) reason = "This season has ended.";
      else if (s.event) reason = "Resolve the industry event first.";
      else if (labelRank(s) < g.rank) reason = `Reach ${core.api().ladderLabel(s, g.rank)} first.`;
      else if (!a.contract?.remaining) reason = "Renew this artist's contract before booking gigs.";
      else if (busy(s, a.id)) reason = "Gigs are not possible while recording or touring.";
      else if (wait)
        reason = s.company
          ? `Next gig in week ${st.readyWeek} (${wait} week${wait === 1 ? "" : "s"}).`
          : `Next gig available in ${wait} week${wait === 1 ? "" : "s"}.`;
      else if (a.energy < g.energy) reason = `Artist needs ${g.energy} energy.`;
      return {
        gig: g,
        id: g.id,
        name: g.name,
        pay,
        energy: g.energy,
        cooldown: g.cooldown,
        wait,
        fans: g.fans,
        xp: g.xp,
        morale: g.morale,
        themeChance: g.theme,
        locked: labelRank(s) < g.rank,
        ready: !reason,
        reason,
      };
    }
    /** Plays a gig: pays cash, spends energy, starts the cooldown and may find a theme. */
    function playGig(s, artistId, gigId) {
      requireAction(s);
      const q = gigQuote(s, artistId, gigId),
        a = artist(s, artistId),
        g = q.gig;
      if (!q.ready) throw Error(q.reason);
      const swing = 1 - g.spread + 2 * g.spread * roll(s, "gigs.pay"),
        pay = Math.round((q.pay.raw * swing) / 10) * 10,
        [low, high] = g.morale,
        morale = low + Math.floor(roll(s, "gigs.morale") * (high - low + 1));
      s.cash += pay;
      a.energy = clamp(a.energy - g.energy);
      a.morale = clamp((a.morale ?? 75) + morale);
      a.fans = clamp(a.fans + g.fans, 0, 1000);
      a.fame = clamp((a.fame || 0) + g.fame);
      a.xp = (a.xp || 0) + g.xp;
      const st = (s.gigs.artists[a.id] = { ...gigState(s, a.id) });
      st.readyWeek = s.week + g.cooldown;
      st.played++;
      st.earned += pay;
      s.gigs.played++;
      s.gigs.earned += pay;
      const result = { week: s.week, artist: a.id, artistName: a.name, gig: g.id, pay, morale, theme: null };
      if (roll(s, "gigs.theme") < g.theme) result.theme = core.api().discoverTheme(s, g.name + " gig", true);
      s.gigs.history.unshift(result);
      s.gigs.history = s.gigs.history.slice(0, 20);
      log(
        s,
        `${a.name} played a ${g.name.toLowerCase()} for $${pay}. Energy −${g.energy}, morale ${morale >= 0 ? "+" : ""}${morale}${g.fans ? ", fans +" + g.fans : ""}${result.theme ? ", new theme " + result.theme : ""}.`,
      );
      return result;
    }

    /* ---------------- Engine hooks ---------------- */

    function init(s) {
      s.locationStats ??= {};
      s.gigs ??= { artists: {}, played: 0, earned: 0, history: [] };
      return s;
    }
    function validatePlan(s, plan) {
      const id = plan.location;
      if (id === undefined || id === null || id === "") return;
      if (typeof id !== "string" || !byId[id]) throw Error("Unknown recording location.");
      const loc = byId[id];
      if (labelRank(s) < loc.rank)
        throw Error(`Reach ${core.api().ladderLabel(s, loc.rank)} to rent the ${loc.name}.`);
      if (bookedBy(s, id)) throw Error(`The ${loc.name} is booked by another album in production.`);
    }
    function planCost(s, plan) {
      return plan.location && byId[plan.location] ? locationRent(s, plan.location) : 0;
    }
    function onRecord(s, p, plan = {}) {
      const id = plan.location;
      if (!id || !byId[id]) return;
      const loc = byId[id],
        first = !stats(s, id);
      p.location = id;
      p.locationLevel = locationLevel(s, id);
      p.locationRent = locationRent(s, id);
      const st = (s.locationStats[id] ??= {
        albums: 0,
        releases: 0,
        xp: 0,
        level: 1,
        bestQuality: 0,
        firstWeek: s.week,
      });
      st.albums++;
      if (first && learnTheme(s, loc.theme, loc.name)) p.locationTheme = loc.theme;
    }
    function stageParts(s, p, stage) {
      if (!p.location || !byId[p.location]) return [];
      return locationRows(p.location, p.genre, stage, p.locationLevel || 1);
    }
    function onRelease(s, p) {
      const st = p.location && stats(s, p.location);
      if (!st) return;
      st.releases++;
      st.xp +=
        LOCATION_LEVELS.releaseXp + (p.quality >= LOCATION_LEVELS.hitQuality ? LOCATION_LEVELS.hitXp : 0);
      st.bestQuality = Math.max(st.bestQuality, p.quality || 0);
      const level = levelForXp(st.xp);
      if (level > st.level) {
        st.level = level;
        log(s, `${byId[p.location].name} reached location level ${level}.`);
      }
    }
    const isCount = (n) => Number.isInteger(n) && n >= 0;
    /** Rejects malformed location and gig data. Missing fields are allowed (older saves). */
    function validSave(s) {
      if (s.locationStats !== undefined) {
        if (!s.locationStats || typeof s.locationStats !== "object" || Array.isArray(s.locationStats))
          return false;
        for (const [id, st] of Object.entries(s.locationStats)) {
          if (!byId[id] || !st || typeof st !== "object") return false;
          if (![st.albums, st.releases, st.xp].every(isCount)) return false;
          if (!Number.isInteger(st.level) || st.level < 1 || st.level > LOCATION_LEVELS.max) return false;
          if (!Number.isFinite(st.bestQuality) || st.bestQuality < 0 || st.bestQuality > 100) return false;
        }
      }
      if (s.gigs !== undefined) {
        const g = s.gigs;
        if (!g || typeof g !== "object" || !g.artists || typeof g.artists !== "object") return false;
        if (!isCount(g.played) || !Number.isFinite(g.earned) || !Array.isArray(g.history)) return false;
        for (const st of Object.values(g.artists))
          if (!st || !Number.isInteger(st.readyWeek) || !isCount(st.played) || !Number.isFinite(st.earned))
            return false;
      }
      return (s.albums || []).every(
        (p) =>
          (p.location === undefined || (typeof p.location === "string" && !!byId[p.location])) &&
          (p.locationLevel === undefined ||
            (Number.isInteger(p.locationLevel) &&
              p.locationLevel >= 1 &&
              p.locationLevel <= LOCATION_LEVELS.max)),
      );
    }

    // Sanity check on the tables, so a bad edit fails loudly at load.
    for (const loc of LOCATIONS) {
      if (!THEMES.some((t) => t.name === loc.theme)) throw Error(`Unknown signature theme: ${loc.theme}`);
      if (Object.keys(loc.genres).some((g) => !GENRES.includes(g))) throw Error(`Unknown genre at ${loc.id}`);
    }

    return {
      init,
      validSave,
      validatePlan,
      planCost,
      onRecord,
      stageParts,
      onRelease,
      api: {
        LOCATIONS,
        LOCATION_AFFINITY,
        LOCATION_LEVELS,
        GIGS,
        locationLevel,
        locationLevelForXp: levelForXp,
        locationRent,
        locationAffinity,
        locationQuote,
        locationList,
        gigQuote,
        playGig,
      },
    };
  }
  root.GoatSystems = Object.assign(root.GoatSystems || {}, { locations: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
