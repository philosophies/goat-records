// The streaming platform (CEO runs): stakes bought from phase 5 lift the label's album sales and
// chart units; large stakes draw questions about the numbers. Classic runs have no platform.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { PLATFORM: P } = D;
    const { roll, log, pay, requireAction, clamp } = core;

    function init(s) {
      if (s.company && !s.company.platform) s.company.platform = { level: 0, paid: 0 };
      return s;
    }
    /** The label's stake now, what it does and what the next one costs. */
    function platformInfo(s) {
      const pl = s.company?.platform;
      if (!pl) return null;
      const stake = P.stakes[pl.level - 1] || null,
        next = P.stakes[pl.level] || null,
        era = core.api().eraFactor?.(s, P.era) ?? 1;
      return {
        name: P.name,
        open: s.company.phase >= P.phase,
        phase: P.phase,
        level: pl.level,
        share: stake?.share ?? 0,
        lift: stake ? stake.lift * era : 0,
        paid: pl.paid,
        next: next && { ...next, lift: next.lift * era },
        scrutiny: pl.level >= P.scrutiny.from,
      };
    }
    /** Buys the next stake in the platform. */
    function buyPlatformStake(s) {
      requireAction(s);
      const info = platformInfo(s);
      if (!info) throw Error("The streaming platform is part of a CEO run.");
      if (!info.open) throw Error(`Investing in ${P.name} opens at phase ${P.phase}.`);
      if (!info.next) throw Error(`The label already owns all of ${P.name}.`);
      if (s.cash < info.next.price)
        throw Error(`The next stake costs $${info.next.price.toLocaleString("en-US")}.`);
      pay(s, info.next.price, "platform");
      const pl = s.company.platform;
      pl.level++;
      pl.paid += info.next.price;
      pl.since ??= s.week;
      log(s, `${core.api().labelName(s)} now owns ${info.next.share}% of ${P.name}.`);
      return platformInfo(s);
    }
    /** The label's records sell more, and chart higher, on its own platform. */
    function salesMultiplier(s) {
      const info = s.company?.platform?.level ? platformInfo(s) : null;
      return info ? 1 + info.lift : 1;
    }
    /** What the stake counts for in company value. */
    function platformValue(s) {
      return Math.round((s.company?.platform?.paid || 0) * P.bookValue);
    }
    function weekly(s) {
      const pl = s.company?.platform,
        S = P.scrutiny;
      if (!pl || pl.level < S.from || s.week % S.every !== 0) return 0;
      if (roll(s, "platform") >= S.chance * (pl.level - S.from + 1)) return 0;
      s.reputation = clamp(s.reputation + S.reputation);
      if (s.company.board) s.company.board.scandals = (s.company.board.scandals || 0) + 1;
      s.notifications.push({
        id: s.nextId++,
        kind: "deadline",
        title: `Questions about ${P.name}'s numbers`,
        body: `A music paper asks why ${core.api().labelName(s)}'s artists do so well on a platform the label owns. Reputation ${S.reputation}${s.company.board ? "; the board counts it as a scandal" : ""}.`,
        week: s.week,
      });
      return 0;
    }
    function validSave(s) {
      const pl = s.company?.platform;
      if (pl === undefined) return true;
      return (
        !!pl &&
        Number.isInteger(pl.level) &&
        pl.level >= 0 &&
        pl.level <= P.stakes.length &&
        Number.isFinite(pl.paid) &&
        pl.paid >= 0
      );
    }

    return {
      init,
      weekly,
      salesMultiplier,
      validSave,
      api: { PLATFORM: P, platformInfo, buyPlatformStake, platformValue },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { platform: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
