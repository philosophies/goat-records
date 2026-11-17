// Label growth systems: album themes and combos, the headquarters floor plan, and label ranks.
// The engine passes in its shared helpers; nothing here touches the page.
(function (root) {
  "use strict";

  /**
   * Builds the label systems around the engine's helpers.
   * @param {object} core  clamp, log, pay, requireAction, busy
   * @param {object} D     merged data tables (core + label)
   */
  function createLabelSystems(core, D) {
    const { clamp, log, pay, requireAction, busy } = core;
    const { GENRES, THEMES, FIT, FACILITIES, SYNERGIES, HQ, RANKS, REQUIREMENT_NAMES } = D;
    const byId = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));
    const STAGE_COUNT = 5;

    // Discovery uses its own random stream so existing seeded outcomes stay reproducible.
    function discoveryRoll(s) {
      s.discoverySeed = (Math.imul(s.discoverySeed, 1664525) + 1013904223) >>> 0;
      return s.discoverySeed / 4294967296;
    }

    /* ---------------- Ranks ---------------- */

    /** Current rank number, 1-based. */
    function rank(s) {
      return clamp(s.rank ?? 1, 1, RANKS.length);
    }
    function rankInfo(s) {
      return RANKS[rank(s) - 1];
    }
    /** Room unlock / stage bonus tier derived from rank. */
    function tier(s) {
      return rankInfo(s).tier;
    }
    function slots(s) {
      return rankInfo(s).slots;
    }
    function themeSlots(s) {
      return rankInfo(s).themeSlots;
    }
    function bestChartPeak(s) {
      const peaks = s.albums.map((p) => p.chart?.best).filter((n) => Number.isFinite(n) && n > 0);
      return peaks.length ? Math.min(...peaks) : null;
    }
    function rankMetrics(s) {
      return {
        fame: s.fame,
        releases: s.albums.filter((p) => p.released).length,
        facilities: s.hq.facilities.length,
        chartPeak: bestChartPeak(s),
        awards: s.awards,
        cash: s.cash,
      };
    }
    /** Progress toward the next rank: one row per requirement. */
    function rankStatus(s) {
      const current = rank(s),
        next = RANKS[current],
        metrics = rankMetrics(s);
      if (!next) return { rank: current, name: rankInfo(s).name, next: null, checks: [], ready: false };
      const checks = Object.entries(next.req).map(([key, need]) => {
        const have = metrics[key],
          met = key === "chartPeak" ? have !== null && have <= need : have >= need;
        return { key, name: REQUIREMENT_NAMES[key], need, have, met };
      });
      return {
        rank: current,
        name: rankInfo(s).name,
        next: {
          rank: current + 1,
          name: next.name,
          slots: next.slots,
          lot: next.lot,
          themeSlots: next.themeSlots,
        },
        checks,
        ready: checks.every((c) => c.met),
      };
    }
    /** Promotes the label while every requirement for the next rank is met. Returns promotions made. */
    function checkRank(s) {
      const promoted = [];
      while (rankStatus(s).ready) {
        s.rank = rank(s) + 1;
        const r = rankInfo(s),
          found = [];
        for (let i = 0; i < (r.grantThemes || 0); i++) {
          const t = discoverTheme(s, "rank", true);
          if (t) found.push(t);
        }
        s.rankUps.push({ rank: s.rank, week: s.week, themes: found, seen: false });
        promoted.push(s.rank);
        log(
          s,
          `Label rank up: ${r.name}. Roster ${r.slots}, lot ${r.lot[0]}×${r.lot[1]}${found.length ? ", new themes " + found.join(", ") : ""}.`,
        );
      }
      return promoted;
    }
    function acknowledgeRankUp(s) {
      for (const r of s.rankUps) r.seen = true;
    }

    /* ---------------- Themes and combos ---------------- */

    function theme(name) {
      return THEMES.find((t) => t.name === name);
    }
    function fitOf(genre, themeName) {
      return theme(themeName).fit[GENRES.indexOf(genre)];
    }
    function fitName(points) {
      return points >= 7 ? "Great" : points >= 4 ? "Good" : points >= 0 ? "Fair" : "Poor";
    }
    /** Fit points and label for a genre with one or two themes. */
    function comboFit(genre, themes) {
      if (!themes?.length) return { points: 0, name: "No theme", parts: [] };
      const parts = themes.map((t) => ({
        theme: t,
        rating: fitOf(genre, t),
        points: FIT.points[fitOf(genre, t)],
      }));
      const sum = parts.reduce((n, p) => n + p.points, 0),
        points = parts.length > 1 ? Math.round(sum * FIT.pairScale) : sum;
      return { points, name: fitName(points), parts };
    }
    function comboKey(genre, themes) {
      return genre + " · " + [...themes].sort().join(" + ");
    }
    function recentComboUses(s, key, week = s.week) {
      return s.albums.filter(
        (p) => p.released && p.comboKey === key && week - p.releaseWeek < FIT.freshnessWindow,
      ).length;
    }
    /** What the player knows about a combo. Fit is hidden until the combo has been recorded once. */
    function comboInfo(s, genre, themes) {
      if (!themes?.length) return { key: null, known: false, level: 0, releases: 0, recent: 0 };
      const key = comboKey(genre, themes),
        record = s.combos[key],
        releases = record?.releases || 0;
      return {
        key,
        known: !!record,
        releases,
        level: Math.min(FIT.maxLevel, 1 + releases),
        recent: recentComboUses(s, key),
        fit: record ? comboFit(genre, themes) : null,
      };
    }
    function validateThemes(s, themes) {
      if (!Array.isArray(themes)) throw Error("Invalid album plan.");
      if (themes.length > themeSlots(s))
        throw Error(themeSlots(s) === 1 ? "Choose one theme." : "Choose up to two themes.");
      if (new Set(themes).size !== themes.length) throw Error("Choose different themes.");
      if (themes.some((t) => !s.themes.includes(t))) throw Error("That theme has not been discovered.");
    }
    /** Adds a random undiscovered theme. Returns its name, or null when all are known. */
    function discoverTheme(s, source, quiet = false) {
      const left = THEMES.filter((t) => !s.themes.includes(t.name));
      if (!left.length) return null;
      const t = left[Math.floor(discoveryRoll(s) * left.length)].name;
      s.themes.push(t);
      s.themeLog.unshift({ theme: t, week: s.week, source });
      s.themeLog = s.themeLog.slice(0, 40);
      if (!quiet) log(s, `New album theme discovered (${source}): ${t}.`);
      return t;
    }
    function onRecord(s, p) {
      if (!p.themes?.length) return;
      p.comboKey = comboKey(p.genre, p.themes);
      s.combos[p.comboKey] ??= {
        genre: p.genre,
        themes: [...p.themes].sort(),
        releases: 0,
        firstWeek: s.week,
      };
      p.comboLevel = comboInfo(s, p.genre, p.themes).level;
      p.comboFit = comboFit(p.genre, p.themes);
    }
    function onRelease(s, p) {
      if (!p.comboKey) return;
      const c = s.combos[p.comboKey];
      c.releases++;
      c.bestQuality = Math.max(c.bestQuality || 0, p.quality);
    }

    /* ---------------- Headquarters ---------------- */

    function lotSize(s) {
      return rankInfo(s).lot;
    }
    function facilityAt(s, x, y) {
      return s.hq.facilities.find((f) => f.x === x && f.y === y) || null;
    }
    function builtFacility(s, id) {
      return s.hq.facilities.find((f) => f.id === id) || null;
    }
    function insideLot(s, x, y) {
      const [w, h] = lotSize(s);
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
    }
    function adjacent(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    }
    function activeSynergies(s) {
      return SYNERGIES.filter((syn) => {
        const a = builtFacility(s, syn.pair[0]),
          b = builtFacility(s, syn.pair[1]);
        return a && b && adjacent(a, b);
      });
    }
    /** Combined effect of every facility and active neighbor bonus. */
    function hqBonuses(s) {
      const out = {
        stages: Array.from({ length: STAGE_COUNT }, () => ({ value: 0, sources: [] })),
        market: 0,
        morale: 0,
        inspiration: 0,
        energy: 0,
        discovery: 0,
        incomeBonus: 0,
        residual: 0,
        ceiling: 0,
        trainingDiscount: 0,
      };
      const addStages = (stages, scale, name) => {
        for (const [i, v] of Object.entries(stages || {})) {
          out.stages[i].value += v * scale;
          out.stages[i].sources.push(name);
        }
      };
      for (const f of s.hq.facilities) {
        const def = byId[f.id],
          n = f.level;
        addStages(def.stages, n, def.name);
        out.market += (def.market || 0) * n;
        out.morale += (def.morale || 0) * n;
        out.inspiration += (def.inspiration || 0) * n;
        out.energy += (def.energy || 0) * n;
        out.discovery += (def.discovery || 0) * n;
        out.residual += (def.residual || 0) * n;
        out.ceiling += (def.ceiling || 0) * n;
        out.trainingDiscount += (def.trainingDiscount || 0) * n;
      }
      for (const syn of activeSynergies(s)) {
        addStages(syn.stages, 1, syn.name);
        out.discovery += syn.discovery || 0;
        out.incomeBonus += syn.incomeBonus || 0;
        out.trainingDiscount += syn.trainingDiscount || 0;
      }
      out.trainingDiscount = Math.min(0.6, out.trainingDiscount);
      return out;
    }
    function hqUpkeep(s) {
      return s.hq.facilities.reduce((n, f) => n + byId[f.id].upkeep * f.level, 0);
    }
    /** Weekly shop and bar takings plus archive residuals, before upkeep. */
    function hqIncome(s) {
      const bonus = hqBonuses(s);
      let shops = 0;
      for (const f of s.hq.facilities) {
        const inc = byId[f.id].income;
        if (inc) shops += (inc.base + s.fame * inc.fame) * f.level;
      }
      shops = Math.round(shops * (1 + bonus.incomeBonus));
      const residual = Math.round(
        bonus.residual *
          s.albums
            .filter((p) => p.released && p.age >= p.salesWeeks)
            .reduce((n, p) => n + (p.quality || 0), 0),
      );
      return { shops, residual, total: shops + residual };
    }
    function upgradeCost(f) {
      return byId[f.id].cost * f.level;
    }
    function buildFacility(s, id, x, y) {
      requireAction(s);
      const def = byId[id];
      x = Number(x);
      y = Number(y);
      if (!def) throw Error("Unknown facility.");
      if (builtFacility(s, id)) throw Error(`${def.name} is already built. Upgrade it instead.`);
      if (rank(s) < def.rank)
        throw Error(`Reach label rank ${def.rank} (${RANKS[def.rank - 1].name}) first.`);
      if (!insideLot(s, x, y)) throw Error("That tile is outside your lot.");
      if (facilityAt(s, x, y)) throw Error("That tile is occupied.");
      pay(s, def.cost);
      s.hq.facilities.push({ id, x, y, level: 1, builtWeek: s.week });
      log(s, `${def.name} built at headquarters.`);
    }
    function upgradeFacility(s, id) {
      requireAction(s);
      const f = builtFacility(s, id);
      if (!f) throw Error("Facility not built.");
      if (f.level >= HQ.maxLevel) throw Error("Facility is already at the top level.");
      pay(s, upgradeCost(f));
      f.level++;
      log(s, `${byId[id].name} upgraded to level ${f.level}.`);
    }
    /** Moves a facility to another tile, swapping places with anything already there. */
    function moveFacility(s, id, x, y) {
      requireAction(s);
      const f = builtFacility(s, id);
      x = Number(x);
      y = Number(y);
      if (!f) throw Error("Facility not built.");
      if (!insideLot(s, x, y)) throw Error("That tile is outside your lot.");
      if (f.x === x && f.y === y) throw Error("Choose a different tile.");
      pay(s, HQ.moveCost);
      const other = facilityAt(s, x, y);
      if (other) {
        other.x = f.x;
        other.y = f.y;
      }
      f.x = x;
      f.y = y;
      log(s, `${byId[id].name} moved${other ? " (swapped with " + byId[other.id].name + ")" : ""}.`);
    }
    function demolishFacility(s, id) {
      requireAction(s);
      const f = builtFacility(s, id);
      if (!f) throw Error("Facility not built.");
      s.hq.facilities = s.hq.facilities.filter((x) => x !== f);
      log(s, `${byId[id].name} closed. Build costs are not refunded.`);
    }

    /** Weekly headquarters settlement: income, artist care and theme discovery. Returns income paid. */
    function weekly(s) {
      const bonus = hqBonuses(s),
        income = hqIncome(s);
      s.cash += income.total;
      s.hq.lastIncome = income;
      for (const a of s.artists) {
        if (busy(s, a.id)) continue;
        a.morale = clamp((a.morale ?? 75) + bonus.morale);
        a.inspiration = clamp((a.inspiration ?? 60) + bonus.inspiration);
        a.energy = clamp(a.energy + bonus.energy);
      }
      if (bonus.discovery > 0 && discoveryRoll(s) < bonus.discovery) discoverTheme(s, "Writers' Room");
      checkRank(s);
      return income.total;
    }

    /* ---------------- Engine hooks ---------------- */

    /** Extra rows for a production stage calculation. */
    function stageParts(s, p, stageIndex) {
      const parts = [];
      if (p.themes?.length) {
        const fit = p.comboFit || comboFit(p.genre, p.themes);
        if (stageIndex <= 1)
          parts.push({ name: `Theme fit · ${p.themes.join(" + ")} (${fit.name})`, value: fit.points });
        const level = p.comboLevel || 1;
        if (level > 1) parts.push({ name: `Combo experience · level ${level}`, value: level - 1 });
        if (stageIndex === 4) {
          const recent = Math.min(
            FIT.freshnessCap,
            recentComboUses(s, p.comboKey, p.recordWeek ?? s.week) * FIT.freshnessPenalty,
          );
          if (recent) parts.push({ name: "Familiar combo · recent release", value: -recent });
        }
      }
      const hq = hqBonuses(s).stages[stageIndex];
      if (hq.value) parts.push({ name: "Headquarters · " + hq.sources.join(", "), value: hq.value });
      return parts;
    }
    /** Extra rows for launch ratings: 0 Critics, 1 Fan response, 2 Market impact. */
    function launchParts(s, p, ratingIndex) {
      const parts = [];
      if (ratingIndex === 1 && p.themes?.length)
        parts.push({ name: "Theme fit", value: (p.comboFit || comboFit(p.genre, p.themes)).points });
      if (ratingIndex === 2) {
        const market = hqBonuses(s).market;
        if (market) parts.push({ name: "Radio Room", value: market });
      }
      return parts;
    }
    function trainingAdjust(s, info) {
      const bonus = hqBonuses(s);
      return { ...info, ceilingBonus: bonus.ceiling, discount: bonus.trainingDiscount };
    }
    function afterTraining(s) {
      if (discoveryRoll(s) < FIT.trainingDiscovery) discoverTheme(s, "development session");
    }
    function afterTour(s, t, completed) {
      if (completed) discoverTheme(s, `${t.title} tour`);
    }

    /** Adds label fields to a new or older save. Older labels keep the rank their fame had earned. */
    function init(s) {
      s.discoverySeed ??= (s.seed ^ 0x9e3779b9) >>> 0;
      s.themes ??= THEMES.filter((t) => t.starter).map((t) => t.name);
      s.themeLog ??= [];
      s.combos ??= {};
      s.hq ??= { facilities: [], lastIncome: { shops: 0, residual: 0, total: 0 } };
      s.rankUps ??= [];
      if (!Number.isInteger(s.rank)) s.rank = s.fame >= 200 ? 4 : s.fame >= 90 ? 3 : s.fame >= 30 ? 2 : 1;
      // Earlier versions listed the player's label as "Side A" in award results.
      for (const program of Object.values(s.awardPrograms || {}))
        for (const r of program?.results || [])
          for (const e of r.entries || []) if (e.owned && e.label === "Side A") e.label = D.LABEL_NAME;
      s.labelRevision = 2;
      return s;
    }
    /** Rejects malformed label data in an imported save. Missing fields are allowed (older saves). */
    function validSave(s) {
      if (s.rank !== undefined && !(Number.isInteger(s.rank) && s.rank >= 1 && s.rank <= RANKS.length))
        return false;
      if (s.themes !== undefined && !(Array.isArray(s.themes) && s.themes.every((t) => theme(t))))
        return false;
      if (s.combos !== undefined && (typeof s.combos !== "object" || s.combos === null)) return false;
      if (s.hq !== undefined) {
        if (!s.hq || !Array.isArray(s.hq.facilities)) return false;
        const seen = new Set();
        for (const f of s.hq.facilities) {
          if (!byId[f.id] || seen.has(f.id)) return false;
          if (![f.x, f.y, f.level].every(Number.isInteger) || f.level < 1 || f.level > HQ.maxLevel)
            return false;
          seen.add(f.id);
        }
      }
      return (s.albums || []).every(
        (p) => p.themes === undefined || (Array.isArray(p.themes) && p.themes.every((t) => theme(t))),
      );
    }

    return {
      rank,
      rankInfo,
      tier,
      slots,
      themeSlots,
      rankStatus,
      checkRank,
      acknowledgeRankUp,
      bestChartPeak,
      fitOf,
      comboFit,
      comboKey,
      comboInfo,
      validateThemes,
      discoverTheme,
      onRecord,
      onRelease,
      lotSize,
      facilityAt,
      builtFacility,
      activeSynergies,
      hqBonuses,
      hqUpkeep,
      hqIncome,
      upgradeCost,
      buildFacility,
      upgradeFacility,
      moveFacility,
      demolishFacility,
      weekly,
      stageParts,
      launchParts,
      trainingAdjust,
      afterTraining,
      afterTour,
      init,
      validSave,
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { createLabelSystems });
  if (typeof module !== "undefined" && module.exports) module.exports = { createLabelSystems };
})(typeof globalThis !== "undefined" ? globalThis : this);
