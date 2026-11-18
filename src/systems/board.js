// The board system (2.0): funding, ownership and the directors outside money brings.
// A CEO run has no board until it takes an angel or venture round. Classic runs are not touched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const {
      DIRECTORS,
      METRICS,
      MONEY_STEP,
      SEAT_WEIGHT,
      BACKERS,
      VALUATION,
      FUNDING,
      PHASES,
      EXEC_FIRST,
      EXEC_LAST,
    } = D;
    const { clamp } = core;
    const { log, requireAction, roll } = core;
    const directorById = Object.fromEntries(DIRECTORS.map((d) => [d.id, d]));
    const isCount = (n) => Number.isInteger(n) && n >= 0;
    const weeklyRate = FUNDING.loan.rate / 52;

    function requireCeo(s) {
      if (!s.company) throw Error("Funding is part of a CEO run.");
    }
    function init(s) {
      if (!s.company) return s;
      if (s.company.ownership === undefined) s.company.ownership = 1;
      s.company.rounds ??= [];
      if (s.company.loan === undefined) s.company.loan = null;
      return s;
    }
    function phase(s) {
      return s.company.phase;
    }
    /** The board, or null while the label has taken no outside money. */
    function board(s) {
      return s.company?.board || null;
    }
    function seats(s) {
      return board(s)?.directors.length || 0;
    }
    /** Company value used to price a round. */
    function valuation(s) {
      const i = phase(s) - 1;
      return Math.round(Math.max(VALUATION.floor[i], core.api().yearRevenue(s) * VALUATION.multiple[i]));
    }

    // ---- Offers ----
    function loanOffer(s) {
      if (s.company.loan) return null;
      const amount = FUNDING.loan.limit[phase(s) - 1],
        n = FUNDING.loan.termWeeks,
        payment = Math.ceil((amount * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -n)));
      return { kind: "loan", name: "Bank loan", amount, equity: 0, seats: 0, payment, weeks: n };
    }
    function angelOffers(s) {
      const A = FUNDING.angel;
      if (phase(s) !== A.phase || s.company.rounds.length) return [];
      return A.terms.map((equity) => ({
        kind: "angel",
        name: "Angel investor",
        equity,
        amount: Math.round(valuation(s) * equity),
        seats: A.seats,
      }));
    }
    function ventureRound(s) {
      return s.company.rounds.filter((r) => r.kind === "venture").length;
    }
    function ventureOffers(s) {
      const V = FUNDING.venture,
        p = phase(s);
      if (!V.phases.includes(p) || s.company.rounds.some((r) => r.kind === "venture" && r.phase === p))
        return [];
      const k = ventureRound(s),
        free = Math.max(0, PHASES[p - 1].boardSeats - seats(s));
      if (k >= V.rounds.length) return [];
      return V.terms.map((equity) => ({
        kind: "venture",
        name: V.rounds[k],
        equity,
        amount: Math.round(valuation(s) * equity),
        seats: Math.min(V.seats, free),
      }));
    }
    /** Every deal on the table right now. */
    function fundingOffers(s) {
      if (!s.company) return [];
      return [loanOffer(s), ...angelOffers(s), ...ventureOffers(s)].filter(Boolean);
    }

    // ---- Taking money ----
    function newDirector(s, kind) {
      const b = s.company.board,
        used = new Set(b.directors.map((d) => d.type)),
        prefs = BACKERS[kind],
        open = prefs.filter((t) => !used.has(t)),
        pool = open.length ? open : prefs,
        type = pool[Math.floor(roll(s, "board") * pool.length)],
        pick = (list) => list[Math.floor(roll(s, "board") * list.length)];
      return {
        id: b.nextId++,
        type,
        name: `${pick(EXEC_FIRST)} ${pick(EXEC_LAST)}`,
        patience: directorById[type].patience,
        relationship: 0,
        satisfaction: 50,
        since: s.week,
      };
    }
    /** Takes the offer of a kind at a term (0 or 1 for equity deals). Returns what changed. */
    function takeFunding(s, kind, term = 0) {
      requireAction(s);
      requireCeo(s);
      const offer = fundingOffers(s).filter((o) => o.kind === kind)[Number(term)];
      if (!offer)
        throw Error(kind === "loan" ? "Repay the current loan first." : "That deal is not on the table.");
      s.cash += offer.amount;
      if (kind === "loan") {
        s.company.loan = {
          amount: offer.amount,
          balance: offer.amount,
          payment: offer.payment,
          week: s.week,
        };
        log(s, `Bank loan of $${offer.amount.toLocaleString("en-US")} taken: $${offer.payment}/week.`);
        return offer;
      }
      s.company.ownership = Math.round(s.company.ownership * (1 - offer.equity) * 10000) / 10000;
      const fresh = !s.company.board;
      s.company.board ??= { directors: [], nextId: 1, since: s.week };
      const added = Array.from({ length: offer.seats }, () => newDirector(s, kind));
      s.company.board.directors.push(...added);
      if (fresh) setTargets(s);
      boardWeek(s);
      s.company.rounds.push({
        kind,
        name: offer.name,
        phase: phase(s),
        week: s.week,
        equity: offer.equity,
        amount: offer.amount,
        seats: offer.seats,
      });
      log(
        s,
        `${offer.name}: $${offer.amount.toLocaleString("en-US")} for ${Math.round(offer.equity * 100)}% of the company. ${added.length ? added.map((d) => d.name).join(" and ") + " join the board." : ""} You now own ${Math.round(s.company.ownership * 100)}%.`,
      );
      return { ...offer, directors: added };
    }

    // ---- Satisfaction and confidence (design 4) ----
    /** Today's value of every board metric. */
    function metricValues(s) {
      const recent = (s.financeHistory || []).slice(-METRICS.profit.weeks),
        morale = s.artists.map((a) => a.morale ?? 75);
      return {
        profit: recent.length
          ? Math.round(recent.reduce((n, w) => n + (w.cashChange || 0), 0) / recent.length)
          : 0,
        growth: core.api().yearRevenue(s),
        cash: Math.round(s.cash),
        welfare: morale.length ? Math.round(morale.reduce((n, m) => n + m, 0) / morale.length) : 75,
        reputation: Math.round(s.reputation),
        scandals: board(s)?.scandals || 0,
        valuation: valuation(s),
      };
    }
    /** Satisfaction points a metric is worth before the director's agenda weight. */
    function metricPoints(s, key, value, target) {
      const m = METRICS[key];
      let distance;
      if (m.kind === "money") distance = (value - target) / (m.step * MONEY_STEP[phase(s) - 1]);
      else if (m.kind === "percent") distance = target > 0 ? ((value / target - 1) * 100) / m.step : 0;
      else distance = (value - target) / m.step;
      return Math.max(-m.cap, Math.min(m.cap, distance));
    }
    /**
     * A director's satisfaction: clamp(0, 100, 50 + Σ metric points × agenda weight + relationship +
     * promises), with the reasons that moved it, largest first.
     */
    function satisfaction(s, d, values = metricValues(s)) {
      const targets = board(s)?.targets || values,
        agenda = directorById[d.type].agenda,
        reasons = Object.entries(agenda)
          .map(([key, weight]) => ({
            key,
            name: METRICS[key].name,
            value: values[key],
            target: targets[key],
            points: Math.round(metricPoints(s, key, values[key], targets[key]) * weight * 10) / 10,
          }))
          .filter((r) => r.points);
      if (d.relationship)
        reasons.push({ key: "relationship", name: "Your relationship", points: d.relationship });
      if (d.promises) reasons.push({ key: "promises", name: "Promises", points: d.promises });
      reasons.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
      const total = 50 + reasons.reduce((n, r) => n + r.points, 0);
      return { value: Math.round(clamp(total)), reasons };
    }
    /** Board confidence 0–100, or null with no board. */
    function confidence(s, values = metricValues(s)) {
      const b = board(s);
      if (!b?.directors.length) return null;
      const weights = b.directors.map(() => SEAT_WEIGHT),
        sum = b.directors.reduce((n, d, i) => n + satisfaction(s, d, values).value * weights[i], 0);
      return Math.round(sum / weights.reduce((n, w) => n + w, 0));
    }
    /** Every director's satisfaction and reasons, and the board's confidence. */
    function boardReport(s) {
      const b = board(s);
      if (!b) return null;
      const values = metricValues(s);
      return {
        confidence: confidence(s, values),
        values,
        targets: b.targets,
        directors: b.directors.map((d) => ({
          ...d,
          archetype: directorById[d.type].name,
          ...satisfaction(s, d, values),
        })),
      };
    }
    /** Sets this period's targets to where the label stands now, and clears the scandal count. */
    function setTargets(s) {
      const b = board(s);
      b.scandals = 0;
      b.targets = metricValues(s);
    }
    function boardWeek(s) {
      const b = board(s);
      if (!b) return;
      const values = metricValues(s);
      for (const d of b.directors) d.satisfaction = satisfaction(s, d, values).value;
      b.confidence = confidence(s, values);
    }
    function onScandal(s) {
      const b = board(s);
      if (b) b.scandals = (b.scandals || 0) + 1;
    }

    // ---- Loan payments ----
    /** This week's loan payment (charged with the weekly costs). */
    function loanPayment(s) {
      const l = s.company?.loan;
      return l ? Math.min(l.payment, Math.ceil(l.balance * (1 + weeklyRate))) : 0;
    }
    function loanWeek(s) {
      const l = s.company?.loan;
      if (!l) return 0;
      const paid = loanPayment(s);
      l.balance = Math.max(0, Math.round(l.balance * (1 + weeklyRate) - paid));
      if (l.balance === 0) {
        s.company.loan = null;
        log(s, "The bank loan is paid off.");
      }
      return 0;
    }
    function repayLoan(s) {
      requireAction(s);
      requireCeo(s);
      const l = s.company.loan;
      if (!l) throw Error("There is no loan to repay.");
      core.pay(s, l.balance);
      s.company.loan = null;
      log(s, "The bank loan is repaid early.");
    }

    function validDirector(d) {
      return (
        d &&
        isCount(d.id) &&
        !!directorById[d.type] &&
        typeof d.name === "string" &&
        isCount(d.patience) &&
        Number.isFinite(d.relationship) &&
        Number.isFinite(d.satisfaction) &&
        d.satisfaction >= 0 &&
        d.satisfaction <= 100
      );
    }
    function validSave(s) {
      const c = s.company;
      if (!c || c.ownership === undefined) return true;
      if (!(Number.isFinite(c.ownership) && c.ownership > 0 && c.ownership <= 1)) return false;
      if (!Array.isArray(c.rounds)) return false;
      if (c.loan !== null && c.loan !== undefined) {
        const l = c.loan;
        if (![l.amount, l.balance, l.payment].every(isCount)) return false;
      }
      if (c.board === undefined) return true;
      return (
        !!c.board &&
        Array.isArray(c.board.directors) &&
        isCount(c.board.nextId) &&
        c.board.directors.every(validDirector) &&
        (c.board.scandals === undefined || isCount(c.board.scandals)) &&
        (c.board.targets === undefined ||
          (!!c.board.targets && Object.keys(METRICS).every((k) => Number.isFinite(c.board.targets[k])))) &&
        (c.board.confidence === undefined ||
          c.board.confidence === null ||
          (Number.isFinite(c.board.confidence) && c.board.confidence >= 0 && c.board.confidence <= 100))
      );
    }

    return {
      init,
      validSave,
      upkeep: loanPayment,
      weekly: (s) => {
        loanWeek(s);
        boardWeek(s);
        return 0;
      },
      onScandal,
      api: {
        DIRECTORS,
        BACKERS,
        VALUATION,
        FUNDING,
        board,
        seats,
        valuation,
        fundingOffers,
        takeFunding,
        loanPayment,
        repayLoan,
        METRICS,
        MONEY_STEP,
        metricValues,
        metricPoints,
        satisfaction,
        confidence,
        boardReport,
        setTargets,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { board: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
