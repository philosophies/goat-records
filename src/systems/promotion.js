// The promotion system: hot streaks ("On fire"), lead singles and ad campaigns.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { clamp, log, pay, requireAction, artist, roll } = core;
    const { HEAT, SINGLE, ADS, AD_RULES, PROMOTION_CAP } = D;
    const adById = Object.fromEntries(ADS.map((x) => [x.id, x]));
    const TRIGGERS = Object.keys(HEAT.triggers);

    function rank(s) {
      return core.api().rank(s);
    }
    function album(s, id) {
      return s.albums.find((p) => p.id === Number(id)) || null;
    }
    function rosterArtist(s, id) {
      return s.artists.find((a) => a.id === Number(id)) || null;
    }

    /* ---------------- Hot streaks ---------------- */

    /** Heat for an artist: level 0 when not on fire. */
    function heat(s, artistId) {
      const h = s.promotion?.heat?.[Number(artistId)];
      if (!h || h.level <= 0 || h.weeksLeft <= 0) return { level: 0, weeksLeft: 0, reasons: [] };
      return { level: h.level, weeksLeft: h.weeksLeft, reasons: h.reasons.map((r) => r.text) };
    }
    function isHot(s, artistId) {
      return heat(s, artistId).level > 0;
    }
    /** Every signed artist on fire, hottest first. */
    function hotArtists(s) {
      return s.artists
        .map((a) => ({ artist: a, ...heat(s, a.id) }))
        .filter((x) => x.level > 0)
        .sort((a, b) => b.level - a.level || b.weeksLeft - a.weeksLeft);
    }
    function heatStageBonus(level) {
      return level * HEAT.stagePerLevel;
    }
    function heatSalesMult(level) {
      return 1 + level * HEAT.salesPerLevel;
    }
    /**
     * Adds heat to an artist. `key` makes a trigger count once (one Top 10 per album, one award per year).
     * Returns true when heat was added.
     */
    function addHeat(s, artistId, kind, text, key) {
      const t = HEAT.triggers[kind],
        a = rosterArtist(s, artistId);
      if (!t || !a) return false;
      if (key) {
        if (s.promotion.triggered.includes(key)) return false;
        s.promotion.triggered.push(key);
      }
      const h = (s.promotion.heat[a.id] ??= { level: 0, weeksLeft: 0, reasons: [], since: s.week });
      const wasHot = h.level > 0;
      h.level = Math.min(HEAT.maxLevel, h.level + t.levels);
      h.weeksLeft = Math.min(HEAT.maxWeeks, Math.max(h.weeksLeft, t.weeks));
      h.lastWeek = s.week;
      h.reasons.unshift({ kind, text: `${t.name} · ${text}`, week: s.week });
      h.reasons = h.reasons.slice(0, HEAT.reasonLimit);
      log(
        s,
        `${a.name} is ${wasHot ? "even hotter" : "on fire"} (${t.name.toLowerCase()}): heat level ${h.level}, ${h.weeksLeft} weeks.`,
      );
      return true;
    }
    /** Counts every streak down by one week; streaks that started this week are not counted down yet. */
    function fadeHeat(s) {
      for (const [id, h] of Object.entries(s.promotion.heat)) {
        const a = rosterArtist(s, id);
        if (!a) {
          delete s.promotion.heat[id];
          continue;
        }
        if (h.lastWeek !== s.week) h.weeksLeft--;
        if (h.weeksLeft <= 0) {
          delete s.promotion.heat[id];
          log(s, `${a.name} has cooled off.`);
        }
      }
    }
    function chartHeat(s) {
      for (const p of s.albums) {
        if (!p.released || p.lastSalesWeek !== s.week) continue;
        const r = p.chart?.rank;
        if (Number.isFinite(r) && r <= HEAT.topRank)
          addHeat(s, p.artist, "top10", `${p.title} at #${r}`, "top10:" + p.id);
      }
    }

    /* ---------------- Lead singles ---------------- */

    function singleOf(s, albumId) {
      return s.promotion?.singles?.[Number(albumId)] || null;
    }
    /** Cost, effects and availability of a lead single for an album. */
    function singleQuote(s, albumId) {
      const p = album(s, albumId);
      if (!p) return { available: false, reason: "Album not found." };
      const tier = SINGLE.tiers[p.baseBudget] || SINGLE.tiers[4000],
        out = {
          available: false,
          reason: "",
          tier: tier.name,
          cost: tier.cost,
          fans: tier.fans,
          attention: tier.attention,
          market: tier.market,
          fanResponse: tier.fanResponse,
          launchMult: SINGLE.launchMult,
          launchWeeks: SINGLE.launchWeeks,
          released: singleOf(s, p.id),
        };
      if (out.released) out.reason = "This album already has its lead single.";
      else if (p.released) out.reason = "Singles come out before the album.";
      else if (!p.production || p.production.stage < SINGLE.minStage)
        out.reason = "A lead single is ready once Recording is done.";
      else if (s.cash < tier.cost) out.reason = "Not enough cash.";
      else out.available = true;
      return out;
    }
    /** Releases the lead single for an album in production. */
    function releaseSingle(s, albumId) {
      requireAction(s);
      const q = singleQuote(s, albumId);
      if (!q.available) throw Error(q.reason);
      const p = album(s, albumId),
        a = artist(s, p.artist);
      pay(s, q.cost);
      const r = roll(s, "promotion.single");
      let acc = 0,
        reception = SINGLE.reception.at(-1);
      for (const x of SINGLE.reception) {
        acc += x.chance;
        if (r < acc) {
          reception = x;
          break;
        }
      }
      a.fans = clamp(a.fans + q.fans, 0, 1000);
      a.attention = clamp(a.attention + q.attention);
      s.promotion.singles[p.id] = {
        albumId: p.id,
        title: p.title,
        week: s.week,
        cost: q.cost,
        tier: q.tier,
        market: q.market,
        fanResponse: q.fanResponse,
        reception: reception.name,
        receptionValue: reception.value,
      };
      log(
        s,
        `${a.name} released the lead single from ${p.title} (${reception.name.toLowerCase()} reception): fans +${q.fans}, attention +${q.attention}.`,
      );
      return s.promotion.singles[p.id];
    }

    /* ---------------- Ads ---------------- */

    function adCost(s, ad) {
      const raw =
        ad.base *
        (1 + Math.max(0, s.fame) / AD_RULES.fameScale) *
        (core.api().eraFactor?.(s, "marketing") ?? 1);
      return Math.round(raw / AD_RULES.round) * AD_RULES.round;
    }
    /** The ad running (or about to start) on an album, if any. */
    function activeAd(s, albumId) {
      return (s.promotion?.ads || []).find((x) => x.albumId === Number(albumId) && x.until >= s.week) || null;
    }
    function earning(p) {
      return p && p.released && p.age < p.salesWeeks;
    }
    /** Cost, effect and availability of an ad type for an album. */
    function adQuote(s, albumId, adId) {
      const ad = adById[adId];
      if (!ad) return { available: false, reason: "Unknown ad type." };
      const p = album(s, albumId),
        cost = adCost(s, ad),
        weeks = p ? Math.max(0, Math.min(ad.weeks, p.salesWeeks - p.age)) : 0,
        out = { ad, available: false, reason: "", cost, mult: ad.mult, weeks, locked: rank(s) < ad.rank };
      // Rough guide from last week's label income, assuming the usual weekly decline.
      if (p?.released && p.lastNetIncome > 0 && weeks > 0) {
        const others = promotionParts(s, p, rosterArtist(s, p.artist), true).raw,
          gain = Math.min(PROMOTION_CAP, others * ad.mult) / Math.min(PROMOTION_CAP, others) - 1;
        let base = 0;
        for (let k = 1; k <= weeks; k++) base += p.lastNetIncome * Math.pow(0.88, k);
        out.estimate = Math.round(base * gain);
      }
      const capped = p && s.company ? core.api().tierBlocks?.(s, rosterArtist(s, p.artist), "ad", ad) : null;
      if (out.locked)
        out.reason = s.company
          ? `Reach ${core.api().ladderLabel(s, ad.rank)} first.`
          : `Reach label rank ${ad.rank} (${core.api().RANKS[ad.rank - 1].name}) first.`;
      else if (capped) out.reason = capped;
      else if (!p || !p.released) out.reason = "Ads are for released albums.";
      else if (!earning(p)) out.reason = "This album's earning run is over.";
      else if (activeAd(s, p.id)) out.reason = "This album already has an ad running.";
      else if (s.cash < cost) out.reason = "Not enough cash.";
      else out.available = true;
      return out;
    }
    /** Buys an ad for a released album still in its earning run. */
    function buyAd(s, albumId, adId) {
      requireAction(s);
      const q = adQuote(s, albumId, adId);
      if (!q.available) throw Error(q.reason);
      const p = album(s, albumId),
        ad = q.ad,
        a = rosterArtist(s, p.artist);
      pay(s, q.cost);
      if (a) {
        if (ad.fans) a.fans = clamp(a.fans + ad.fans, 0, 1000);
        if (ad.attention) a.attention = clamp(a.attention + ad.attention);
      }
      if (ad.reputation) s.reputation = clamp(s.reputation + ad.reputation);
      const record = {
        id: s.nextId++,
        albumId: p.id,
        adId: ad.id,
        cost: q.cost,
        mult: ad.mult,
        week: s.week,
        start: s.week + 1,
        until: s.week + q.weeks,
      };
      s.promotion.ads.push(record);
      log(s, `${ad.name} booked for ${p.title}: ${money(q.cost)}, sales ×${ad.mult} for ${q.weeks} weeks.`);
      return record;
    }
    function money(n) {
      return "$" + Math.round(n).toLocaleString("en-US");
    }
    function expireAds(s) {
      for (const x of s.promotion.ads) {
        if (x.ended || x.until >= s.week) continue;
        x.ended = true;
        const p = album(s, x.albumId);
        log(s, `${adById[x.adId]?.name || "Ad"} for ${p?.title || "an album"} has finished.`);
      }
      const ended = s.promotion.ads.filter((x) => x.ended),
        drop = new Set(ended.slice(0, Math.max(0, ended.length - AD_RULES.historyLimit)));
      if (drop.size) s.promotion.ads = s.promotion.ads.filter((x) => !drop.has(x));
    }

    /* ---------------- Sales ---------------- */

    /**
     * Promotion multiplier for one album's weekly sales: heat × lead single × ad, capped.
     * Returns { parts: [{name, mult}], raw, total, capped }.
     */
    function promotionParts(s, p, a, skipAd = false) {
      const parts = [];
      const h = heat(s, p.artist);
      if (h.level) parts.push({ name: `On fire · level ${h.level}`, mult: heatSalesMult(h.level) });
      if (singleOf(s, p.id) && p.released && p.age < SINGLE.launchWeeks)
        parts.push({ name: "Lead single buzz", mult: SINGLE.launchMult });
      if (!skipAd) {
        const ad = (s.promotion?.ads || []).find(
          (x) => x.albumId === p.id && x.start <= s.week && x.until >= s.week,
        );
        if (ad) parts.push({ name: adById[ad.adId]?.name || "Ad", mult: ad.mult });
      }
      const raw = parts.reduce((n, x) => n * x.mult, 1);
      return { parts, raw, total: Math.min(PROMOTION_CAP, raw), capped: raw > PROMOTION_CAP };
    }
    function salesMultiplier(s, p, a) {
      if (!s.promotion) return 1;
      return promotionParts(s, p, a).total;
    }

    /* ---------------- Engine hooks ---------------- */

    function stageParts(s, p) {
      const h = heat(s, p.artist);
      if (!h.level) return [];
      return [
        {
          name: `On fire · ${h.weeksLeft} week${h.weeksLeft === 1 ? "" : "s"} left`,
          value: heatStageBonus(h.level),
        },
      ];
    }
    function launchParts(s, p, i) {
      const x = singleOf(s, p.id);
      if (!x || i === 0) return [];
      const base = i === 2 ? x.market : x.fanResponse;
      return [{ name: `Lead single · ${x.reception} reception`, value: base + x.receptionValue }];
    }
    function onRelease(s, p) {
      if (p.quality >= HEAT.hitQuality)
        addHeat(s, p.artist, "hit", `${p.title} (${p.quality})`, "hit:" + p.id);
    }
    function yearEnd(s, year) {
      for (const r of s.awardPrograms?.[year]?.results || []) {
        const w = r.entries.find((e) => e.owned && e.id === r.winner);
        const p = w && album(s, w.id);
        if (p) addHeat(s, p.artist, "award", `${r.genre} Album of the Year`, `award:${year}:${r.genre}`);
      }
    }
    function weekly(s) {
      fadeHeat(s);
      chartHeat(s);
      expireAds(s);
      return 0;
    }
    function init(s) {
      s.promotion ??= {};
      s.promotion.heat ??= {};
      s.promotion.ads ??= [];
      s.promotion.singles ??= {};
      s.promotion.triggered ??= [];
      return s;
    }
    const isInt = Number.isInteger,
      isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
    /** Rejects malformed promotion data. A save without promotion data is an older save and is accepted. */
    function validSave(s) {
      const m = s.promotion;
      if (m === undefined) return true;
      if (!isObj(m)) return false;
      if (m.heat !== undefined) {
        if (!isObj(m.heat)) return false;
        for (const h of Object.values(m.heat))
          if (
            !isObj(h) ||
            !isInt(h.level) ||
            h.level < 0 ||
            h.level > HEAT.maxLevel ||
            !isInt(h.weeksLeft) ||
            h.weeksLeft < 0 ||
            h.weeksLeft > HEAT.maxWeeks ||
            !Array.isArray(h.reasons) ||
            !h.reasons.every((r) => isObj(r) && typeof r.text === "string" && TRIGGERS.includes(r.kind))
          )
            return false;
      }
      if (m.ads !== undefined) {
        if (!Array.isArray(m.ads)) return false;
        for (const x of m.ads)
          if (
            !isObj(x) ||
            !adById[x.adId] ||
            !isInt(x.albumId) ||
            !isInt(x.start) ||
            !isInt(x.until) ||
            x.until < x.start ||
            !Number.isFinite(x.mult) ||
            x.mult < 1 ||
            x.mult > PROMOTION_CAP ||
            !Number.isFinite(x.cost) ||
            x.cost < 0
          )
            return false;
      }
      if (m.singles !== undefined) {
        if (!isObj(m.singles)) return false;
        for (const [k, x] of Object.entries(m.singles))
          if (
            !isObj(x) ||
            x.albumId !== Number(k) ||
            !Number.isFinite(x.market) ||
            !Number.isFinite(x.fanResponse) ||
            !Number.isFinite(x.receptionValue) ||
            typeof x.reception !== "string"
          )
            return false;
      }
      if (
        m.triggered !== undefined &&
        !(Array.isArray(m.triggered) && m.triggered.every((k) => typeof k === "string"))
      )
        return false;
      return true;
    }

    return {
      init,
      validSave,
      stageParts,
      launchParts,
      onRelease,
      salesMultiplier,
      weekly,
      yearEnd,
      api: {
        isHot,
        heat,
        hotArtists,
        heatStageBonus,
        heatSalesMult,
        singleQuote,
        releaseSingle,
        leadSingle: singleOf,
        adQuote,
        buyAd,
        activeAd,
        adCost,
        promotionParts,
        validPromotionSave: validSave,
        HEAT,
        SINGLE,
        ADS,
        PROMOTION_CAP,
      },
    };
  }
  root.GoatSystems = Object.assign(root.GoatSystems || {}, { promotion: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
