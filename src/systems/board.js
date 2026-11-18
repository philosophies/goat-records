// The board system (2.0): funding, ownership and the directors outside money brings.
// A CEO run has no board until it takes an angel or venture round. Classic runs are not touched.
// See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { DIRECTORS, BACKERS, VALUATION, FUNDING, PHASES, EXEC_FIRST, EXEC_LAST } = D;
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
      s.company.board ??= { directors: [], nextId: 1, since: s.week };
      const added = Array.from({ length: offer.seats }, () => newDirector(s, kind));
      s.company.board.directors.push(...added);
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
        c.board.directors.every(validDirector)
      );
    }

    return {
      init,
      validSave,
      upkeep: loanPayment,
      weekly: loanWeek,
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
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { board: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
