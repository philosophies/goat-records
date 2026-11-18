// The company system (2.0): the label's growth phases in a CEO run.
// Only active when a run was created with { ceo: true }; other runs are left untouched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const {
      PHASES, REACHES, PHASE_GOALS, HIT_QUALITY, REACH_SCOUTING, RENAME, LABEL_NAME, BUILDINGS,
      COMPANY_REVENUE, COMPANY_COSTS, COMPANY_VALUE, FUNDING, VALUATION, IPO,
    } = D;
    const { BOOTHS, FACILITIES, HQ } = D;
    const buildingById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])),
      facilityById = Object.fromEntries(FACILITIES.map((f) => [f.id, f]));
    const { log } = core;
    const isCount = (n) => Number.isInteger(n) && n >= 0;

    function init(s) {
      if (s.company) {
        if (s.company.shares === undefined) syncShares(s);
        return s;
      }
      if (!s.ceoMode) return s;
      s.company = {
        phase: 1,
        since: s.week,
        history: [{ phase: 1, week: s.week }],
        // The bedroom booth (recording room 0) is the apartment's first floor.
        buildings: [{ id: "apartment", floors: [{ type: "room", room: 0, level: 1 }] }],
      };
      syncShares(s);
      s.cash = PHASES[0].startCash;
      // The first prospects were drawn before the company existed: hold them to the local scene too.
      const lim = scoutLimits(s);
      for (const a of s.candidates || []) {
        a.talent = Math.min(a.talent, lim.talentMax);
        a.potential = Math.max(a.talent, Math.min(a.potential, lim.potentialMax));
        a.reach = lim.reach;
        const q = core.api().contractQuote(s, a, 3);
        a.fee = q.fee;
        a.wage = q.wage;
      }
      return s;
    }
    /** The label's own name: the player's choice, or the default. Works in every run. */
    function labelName(s) {
      return s.labelName || LABEL_NAME;
    }
    /** A cleaned name, or throws with the reason it cannot be used. */
    function cleanName(name) {
      if (typeof name !== "string") throw Error("The label needs a name.");
      const clean = name
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (clean.length < RENAME.minLength) throw Error("The label needs a name.");
      if (clean.length > RENAME.maxLength) throw Error(`Keep the name to ${RENAME.maxLength} characters.`);
      return clean;
    }
    /** Renames the label. Costs RENAME.fame, unless `free` (naming a new run). */
    function renameLabel(s, name, free = false) {
      core.requireAction(s);
      const clean = cleanName(name),
        old = labelName(s);
      if (clean === old) throw Error(`The label is already called ${old}.`);
      const cost = free ? 0 : Math.min(RENAME.fame, s.fame);
      s.fame -= cost;
      s.labelName = clean;
      log(
        s,
        free
          ? `The label is named ${clean}.`
          : `${old} is now ${clean}.${cost ? ` Fans need time to catch up: −${cost} fame.` : ""}`,
      );
      return clean;
    }
    function validSave(s) {
      if (s.labelName !== undefined) {
        if (typeof s.labelName !== "string") return false;
        const n = s.labelName.trim().length;
        if (n < RENAME.minLength || n > RENAME.maxLength) return false;
      }
      if (s.company === undefined) return true;
      const c = s.company;
      if (!c || typeof c !== "object" || Array.isArray(c)) return false;
      if (!Number.isInteger(c.phase) || c.phase < 1 || c.phase > PHASES.length) return false;
      if (!isCount(c.since) || !Array.isArray(c.history)) return false;
      if (!c.history.every((h) => h && Number.isInteger(h.phase) && isCount(h.week))) return false;
      if (c.shares !== undefined) {
        const shares = c.shares;
        if (!shares || shares.total !== COMPANY_VALUE.shares || !isCount(shares.yours) ||
          !isCount(shares.investors) || shares.yours + shares.investors !== shares.total ||
          shares.yours !== Math.round((c.ownership ?? 1) * shares.total)) return false;
      }
      if (c.marketMood !== undefined &&
        (!Number.isFinite(c.marketMood) || c.marketMood < COMPANY_VALUE.moodRange[0] ||
          c.marketMood > COMPANY_VALUE.moodRange[1])) return false;
      if (c.annualProfit !== undefined && (!Array.isArray(c.annualProfit) ||
        c.annualProfit.length > IPO.profitYears ||
        !c.annualProfit.every((row) => row && isCount(row.year) && Number.isFinite(row.profit)))) return false;
      if (c.offering !== undefined && (!c.public || !c.offering || !isCount(c.offering.week) ||
        !isCount(c.offering.proceeds) || !Number.isFinite(c.offering.price) ||
        typeof c.offering.scene !== "boolean")) return false;
      if (c.analyst !== undefined && (!c.public || !c.analyst || !isCount(c.analyst.dueWeek) ||
        !isCount(c.analyst.revenue) ||
        (c.analyst.last !== null && (!c.analyst.last || !isCount(c.analyst.last.revenue) ||
          !isCount(c.analyst.last.target) || typeof c.analyst.last.met !== "boolean")))) return false;
      if (c.buildings === undefined) return true;
      if (!Array.isArray(c.buildings)) return false;
      const seen = new Set();
      for (const b of c.buildings) {
        const def = b && buildingById[b.id];
        if (!def || seen.has(b.id) || !Array.isArray(b.floors) || b.floors.length > def.maxFloors)
          return false;
        seen.add(b.id);
        for (const f of b.floors) {
          if (
            !f ||
            !def.floors.includes(f.type) ||
            !Number.isInteger(f.level) ||
            f.level < 1 ||
            f.level > HQ.maxLevel
          )
            return false;
          if (f.type === "room" && !BOOTHS[f.room]) return false;
        }
      }
      return true;
    }
    /** The current phase row in a CEO run, or null for a classic run. */
    function companyPhase(s) {
      return s.company ? PHASES[s.company.phase - 1] : null;
    }
    function revenueFor(rows) {
      return rows.reduce(
        (n, w) =>
          n +
          Math.max(0, w.albumIncome || 0) +
          Math.max(0, w.hqIncome || 0) +
          Math.max(0, w.otherIncome || 0),
        0,
      );
    }
    /** Income over the last 52 settled weeks: album sales plus every system's weekly income. */
    function yearRevenue(s) {
      return revenueFor((s.financeHistory || []).slice(-52));
    }
    function syncShares(s) {
      const total = COMPANY_VALUE.shares;
      const yours = Math.round((s.company.ownership ?? 1) * total);
      s.company.shares = { total, yours, investors: total - yours };
      return s.company.shares;
    }
    function companyValuation(s) {
      if (!s.company) return null;
      const rows = s.financeHistory || [];
      const prior = rows.length >= 52 ? revenueFor(rows.slice(-52, -26)) : 0;
      const growth = prior ? revenueFor(rows.slice(-26)) / prior - 1 : 0;
      const albums = s.albums.filter((p) => p.released);
      const hitRate = albums.length ? albums.filter((p) => p.quality >= HIT_QUALITY).length / albums.length : 0;
      const multiple = VALUATION.multiple[s.company.phase - 1] +
        core.clamp(growth, ...COMPANY_VALUE.growthRange) * COMPANY_VALUE.growthFactor +
        hitRate * COMPANY_VALUE.hitRateFactor;
      const revenue = yearRevenue(s);
      const catalogValue = albums.reduce((total, p) => total + (p.total || 0), 0) *
        COMPANY_VALUE.catalogIncomeFactor;
      const debt = (s.company.loan?.balance || 0) + (s.company.acquisitionDebt || 0);
      const value = Math.max(0, Math.round(revenue * multiple + catalogValue + s.cash - debt));
      const mood = s.company.marketMood ?? 1;
      const shares = s.company.shares || { total: COMPANY_VALUE.shares };
      const sharePrice = Math.round((value / shares.total) * mood * 100) / 100;
      return { value, sharePrice, mood, multiple, revenue, growth, hitRate, catalogValue, debt };
    }
    function metric(s, key) {
      const released = s.albums.filter((p) => p.released);
      if (key === "fame") return s.fame;
      if (key === "revenue") return yearRevenue(s);
      if (key === "releases") return released.length;
      if (key === "hits") return released.filter((p) => (p.quality || 0) >= HIT_QUALITY).length;
      return 0;
    }
    /** Goals for the next phase: { next, goals: [{ key, name, have, need, met }], met } or null. */
    function phaseProgress(s) {
      if (!s.company || s.company.phase >= IPO.phase) return null;
      const next = PHASES[s.company.phase],
        goals = Object.entries(next.goals).map(([key, need]) => {
          const have = metric(s, key);
          return { key, name: PHASE_GOALS[key] || key, have, need, met: have >= need };
        });
      return { next, goals, met: goals.every((g) => g.met) };
    }
    /** Scouting limits for the label's reach in a CEO run, or null for a classic run. */
    function scoutLimits(s) {
      const phase = companyPhase(s);
      return phase ? { reach: phase.reach, ...REACH_SCOUTING[phase.reach] } : null;
    }
    /** Why a paid scouting budget is locked, or "" when it can be used. */
    function scoutLocked(s, index) {
      const lim = scoutLimits(s);
      if (!lim || index <= lim.budget) return "";
      const opens = PHASES.find((p) => REACH_SCOUTING[p.reach].budget >= index);
      return `Opens when the label reaches phase ${opens.id}, ${opens.name}, and scouts ${REACH_SCOUTING[opens.reach].name}.`;
    }
    /* ---------------- Buildings and floors ---------------- */

    function requireCeo(s) {
      if (!s.company) throw Error("Buildings are part of a CEO run.");
    }
    function ownedBuilding(s, id) {
      return s.company?.buildings?.find((b) => b.id === id) || null;
    }
    /** Every floor of every building, with where it stands: [{ building, index, floor }]. */
    function allFloors(s) {
      return (s.company?.buildings || []).flatMap((b) =>
        b.floors.map((floor, index) => ({ building: b.id, index, floor })),
      );
    }
    /** Price of the next floor of a building for a floor type (and room id for a recording room). */
    function floorQuote(s, buildingId, type, room) {
      const def = buildingById[buildingId],
        owned = ownedBuilding(s, buildingId);
      const base = type === "room" ? BOOTHS[Number(room)]?.cost : facilityById[type]?.cost;
      return (base ?? 0) + def.floorCost * (owned ? owned.floors.length : 0);
    }
    function buyBuilding(s, id) {
      core.requireAction(s);
      requireCeo(s);
      const def = buildingById[id];
      if (!def) throw Error("Unknown building.");
      if (ownedBuilding(s, id)) throw Error(`The ${def.name} is already yours.`);
      if (s.company.phase < def.phase)
        throw Error(`The ${def.name} opens at phase ${def.phase}, ${PHASES[def.phase - 1].name}.`);
      core.pay(s, def.cost);
      s.company.buildings.push({ id, floors: [] });
      log(s, `${labelName(s)} buys the ${def.name}.`);
    }
    /** Adds a floor on top of a building: a recording room (with its room id) or a facility. */
    function buildFloor(s, buildingId, type, room) {
      core.requireAction(s);
      requireCeo(s);
      const def = buildingById[buildingId],
        owned = ownedBuilding(s, buildingId);
      if (!def) throw Error("Unknown building.");
      if (!owned) throw Error(`Buy the ${def.name} first.`);
      if (owned.floors.length >= def.maxFloors)
        throw Error(`The ${def.name} is full: ${def.maxFloors} floors.`);
      if (!def.floors.includes(type)) throw Error(`That cannot go in the ${def.name}.`);
      let floor;
      if (type === "room") {
        room = Number(room);
        const r = BOOTHS[room];
        if (!r) throw Error("Unknown recording room.");
        if (s.booths.some((b) => b.id === room)) throw Error(`The ${r.name} is already built.`);
        if (s.company.phase < r.labelTier)
          throw Error(`The ${r.name} opens at phase ${r.labelTier}, ${PHASES[r.labelTier - 1].name}.`);
        floor = { type, room, level: 1 };
      } else {
        const f = facilityById[type];
        if (allFloors(s).some((x) => x.floor.type === type))
          throw Error(`The ${f.name} is already built. Upgrade it instead.`);
        floor = { type, level: 1 };
      }
      core.pay(s, floorQuote(s, buildingId, type, room));
      owned.floors.push(floor);
      if (type === "room") s.booths.push({ id: room, hits: 0, prestige: 0 });
      log(
        s,
        `New floor in the ${def.name}: ${type === "room" ? BOOTHS[room].name : facilityById[type].name}.`,
      );
      return floor;
    }
    /** Raises a facility floor one level, at the facility's usual upgrade price. */
    function upgradeFloor(s, buildingId, index) {
      core.requireAction(s);
      requireCeo(s);
      const owned = ownedBuilding(s, buildingId),
        floor = owned?.floors[Number(index)];
      if (!floor) throw Error("No such floor.");
      if (floor.type === "room") throw Error("Recording rooms do not level up.");
      if (floor.level >= HQ.maxLevel) throw Error("This floor is at its top level.");
      core.pay(s, facilityById[floor.type].cost * floor.level);
      floor.level++;
      log(s, `${facilityById[floor.type].name} upgraded to level ${floor.level}.`);
      return floor;
    }

    /** Whether the board lets the label move up. Always true with no board. */
    function boardApproved(s) {
      return core.api().approvesPhase?.(s) ?? true;
    }
    function companyRevenue(s) {
      if (!s.company) return {};
      const catalog = s.albums.filter((album) => album.released);
      const activity = {
        studio: 1,
        activeCatalog: catalog.filter((album) => album.age < album.salesWeeks).length,
        roster: s.artists.filter((artist) => artist.contract?.remaining > 0).length,
        hits: catalog.filter((album) => album.quality >= HIT_QUALITY).length,
        catalog: catalog.length,
      };
      return Object.fromEntries(
        COMPANY_REVENUE.filter((stream) => stream.phase <= s.company.phase)
          .map(({ id, source, rate }) => [id, activity[source] * rate]),
      );
    }
    function companyCosts(s) {
      if (!s.company) return null;
      const phaseIndex = s.company.phase - 1;
      const loan = s.company.loan;
      return {
        rent: COMPANY_COSTS.rent[phaseIndex],
        insurance: COMPANY_COSTS.insurance[phaseIndex],
        // The board's existing loan payment already settles this amount as part of upkeep.
        interest: loan ? Math.min(loan.payment, Math.round(loan.balance * FUNDING.loan.rate / 52)) : 0,
      };
    }
    function companyUpkeep(s) {
      const costs = companyCosts(s);
      return costs ? costs.rent + costs.insurance : 0;
    }
    function weekly(s, revenues = companyRevenue(s)) {
      if (!s.company) return 0;
      const income = Object.values(revenues).reduce((total, value) => total + value, 0);
      s.cash += income;
      const progress = phaseProgress(s);
      if (!progress?.met || !boardApproved(s)) return income;
      const p = progress.next;
      s.company.phase = p.id;
      s.company.since = s.week;
      s.company.history.push({ phase: p.id, week: s.week });
      log(s, `${labelName(s)} grows into phase ${p.id}: ${p.name}.`);
      s.notifications.push({
        id: s.nextId++,
        kind: "phase",
        title: `Phase ${p.id} · ${p.name}`,
        body: `The label has outgrown its last phase. Scouting now reaches ${REACH_SCOUTING[p.reach].name}.`,
        week: s.week,
      });
      return income;
    }

    function ipoRequirements(s) {
      const company = s.company;
      if (company?.phase !== IPO.phase || company.public) return null;
      const years = company.annualProfit || [];
      let streak = 0;
      for (const { profit } of [...years].reverse()) {
        if (profit <= 0) break;
        streak++;
      }
      const goals = [
        { label: "Consecutive profitable years", have: streak, need: IPO.profitYears },
        { label: "CFO skill", have: company.departments.finance.head?.skill || 0, need: IPO.cfoSkill },
        { label: "Board confidence", have: company.board?.confidence || 0, need: IPO.boardConfidence },
      ];
      const valuation = companyValuation(s);
      const mood = core.clamp(1 - (company.board?.scandals || 0) * IPO.scandalDiscount, ...COMPANY_VALUE.moodRange);
      const proceeds = Math.round(valuation.value * mood * IPO.equity / (1 - IPO.equity));
      const price = Math.round(proceeds / (company.shares.total * IPO.equity) * 100) / 100;
      return { goals, ready: proceeds > 0 && goals.every(({ have, need }) => have >= need), proceeds, price, mood };
    }

    function nextAnalystTarget(s, last = null) {
      const revenue = revenueFor(s.financeHistory.slice(-IPO.analystWeeks));
      return { dueWeek: s.week + IPO.analystWeeks, revenue: Math.ceil(revenue * IPO.revenueStretch), last };
    }

    function goPublic(s) {
      core.requireAction(s);
      const ipo = ipoRequirements(s);
      if (!ipo?.ready) throw Error("The label does not meet the IPO requirements.");
      const company = s.company;
      company.public = true;
      company.phase = PHASES.length;
      company.since = s.week;
      company.history.push({ phase: company.phase, week: s.week });
      company.marketMood = ipo.mood;
      company.offering = { week: s.week, proceeds: ipo.proceeds, price: ipo.price, scene: true };
      company.analyst = nextAnalystTarget(s);
      s.cash += ipo.proceeds;
      core.api().recordPublicRound(s, IPO.equity, ipo.proceeds);
      log(s, `${labelName(s)} rings the bell and raises $${ipo.proceeds.toLocaleString("en-US")} in its IPO.`);
      return company.offering;
    }

    function acknowledgeIPO(s) {
      if (s.company?.offering) s.company.offering.scene = false;
    }

    function afterSettlement(s) {
      if (!s.company) return;
      const company = s.company;
      if (s.week > 1 && s.week % 52 === 1 && s.financeHistory.length === 52) {
        const profit = s.financeHistory.reduce((total, row) => total + (row.cashChange || 0), 0);
        const year = core.operatingYear(s.week - 1);
        company.annualProfit = [...(company.annualProfit || []), { year, profit }].slice(-IPO.profitYears);
      }
      if (!company.analyst || !company.public || s.week < company.analyst.dueWeek || s.finished) return;
      const revenue = revenueFor(s.financeHistory.slice(-IPO.analystWeeks));
      const target = company.analyst.revenue;
      const met = revenue >= target;
      const direction = met ? 1 : -1;
      company.marketMood = core.clamp(
        company.marketMood + direction * IPO.moodChange, ...COMPANY_VALUE.moodRange,
      );
      const board = company.board;
      board.analystConfidence = core.clamp((board.analystConfidence || 0) + direction * IPO.confidenceChange, -100, 100);
      company.analyst = nextAnalystTarget(s, { revenue, target, met });
      log(s, `Analysts: ${met ? "revenue beat" : "revenue missed"} the half-year target.`);
    }

    return {
      init,
      validSave,
      upkeep: companyUpkeep,
      weekly,
      afterSettlement,
      api: {
        PHASES,
        REACHES,
        PHASE_GOALS,
        REACH_SCOUTING,
        companyPhase,
        phaseProgress,
        yearRevenue,
        companyValuation,
        syncShares,
        ipoRequirements,
        goPublic,
        acknowledgeIPO,
        COMPANY_REVENUE,
        companyRevenue,
        companyCosts,
        boardApproved,
        scoutLimits,
        scoutLocked,
        RENAME,
        labelName,
        renameLabel,
        BUILDINGS,
        allFloors,
        floorQuote,
        buyBuilding,
        buildFloor,
        upgradeFloor,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { company: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
