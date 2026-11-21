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
      REVIEW,
      OVERSPEND,
      APPROVAL,
      LOBBY,
      BACKERS,
      VALUATION,
      FUNDING,
      PHASES,
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
        prefs = BACKERS[kind === "ipo" ? "venture" : kind],
        open = prefs.filter((t) => !used.has(t)),
        pool = open.length ? open : prefs,
        type = pool[Math.floor(roll(s, "board") * pool.length)];
      const d = {
        id: b.nextId++,
        type,
        name: core.uniqueName(s, roll(s, "board")),
        patience: directorById[type].patience,
        relationship: 0,
        satisfaction: 50,
        since: s.week,
      };
      return core.api().castDirector?.(s, d) || d;
    }
    function recordPublicRound(s, equity, amount) {
      const company = s.company;
      const b = board(s);
      company.ownership = Math.round(company.ownership * (1 - equity) * 10000) / 10000;
      core.api().syncShares(s);
      const seats = PHASES[phase(s) - 1].boardSeats - b.directors.length;
      for (let index = 0; index < seats; index++) b.directors.push(newDirector(s, "ipo"));
      company.rounds.push({ kind: "ipo", name: "IPO", phase: phase(s), week: s.week, equity, amount, seats });
      b.nextReview = s.week + reviewInterval(s);
      boardWeek(s);
    }
    function startConvertedBoard(s, initialConfidence) {
      const b = (s.company.board = {
        directors: [],
        nextId: 1,
        since: s.week,
        budget: firstBudget(s),
        spent: 0,
        freedom: "medium",
        perks: [],
        probation: false,
        reviews: [],
        nextReview: s.week + reviewInterval(s),
      });
      b.budgetLeft = b.budget;
      for (let index = 0; index < PHASES[phase(s) - 1].boardSeats; index++) {
        const director = newDirector(s, "venture");
        director.relationship = initialConfidence - director.satisfaction;
        b.directors.push(director);
      }
      setTargets(s);
      boardWeek(s);
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
      core.api().syncShares(s);
      const fresh = !s.company.board;
      s.company.board ??= { directors: [], nextId: 1, since: s.week };
      const added = Array.from({ length: offer.seats }, () => newDirector(s, kind));
      s.company.board.directors.push(...added);
      if (fresh) {
        setTargets(s);
        const b = s.company.board;
        b.budget = firstBudget(s);
        b.budgetLeft = b.budget;
        b.freedom = "medium";
        b.perks = [];
        b.probation = false;
        b.reviews = [];
        b.nextReview = s.week + reviewInterval(s);
      }
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
      if (board(s)?.eventConfidence)
        reasons.push({ key: "events", name: "Company events", points: board(s).eventConfidence });
      if (board(s)?.analystConfidence)
        reasons.push({ key: "analysts", name: "Analyst results", points: board(s).analystConfidence });
      const over = overspendPoints(s);
      if (over) reasons.push({ key: "overspend", name: "Over budget", points: over });
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
    // ---- The periodic review (design 3.3) ----
    function reviewInterval(s) {
      return s.company.public ? REVIEW.publicInterval : REVIEW.intervalWeeks;
    }
    function firstBudget(s) {
      const B = REVIEW.budget;
      return Math.round(Math.max(B.floor[phase(s) - 1], core.api().yearRevenue(s) * B.revenueShare));
    }
    /** Next period's budget from the last one, confidence and revenue growth (design 4). */
    function reviewBudget(s, c) {
      const b = board(s),
        [lo, hi] = REVIEW.budget.growth,
        target = b.targets?.growth || 0,
        growth = target > 0 ? Math.max(lo, Math.min(hi, core.api().yearRevenue(s) / target - 1)) : 0;
      return Math.max(
        REVIEW.budget.floor[phase(s) - 1],
        Math.round(b.budget * (0.8 + (0.4 * c) / 100) * (1 + growth)),
      );
    }
    /** Creative freedom for a confidence, one step lower on probation. */
    /** Creative freedom for a confidence: one step lower on probation, and one more with a co-CEO. */
    function freedomFor(c, probation, coCeo = false) {
      const i = REVIEW.freedom.findIndex((f) => c < f.below);
      return REVIEW.freedom[Math.max(0, i - (probation ? 1 : 0) - (coCeo ? 1 : 0))].id;
    }
    function perksFor(c) {
      return REVIEW.perks.filter((p) => c >= p.min).map((p) => p.id);
    }
    function perkCost(s) {
      const perks = board(s)?.perks || [];
      return REVIEW.perks.filter((p) => perks.includes(p.id)).reduce((n, p) => n + p.weekly, 0);
    }
    /** A no-confidence vote: who votes to remove you, and whether it passes. */
    function holdVote(s) {
      const b = board(s),
        against = b.directors.filter((d) => satisfaction(s, d).value < REVIEW.removeBelow).length,
        majority = against > b.directors.length / 2,
        protectedByShares = s.company.ownership > 0.5;
      return {
        against,
        seats: b.directors.length,
        passed: majority && !protectedByShares,
        protectedByShares,
      };
    }
    function fire(s, c) {
      s.finished = true;
      s.bankrupt = false;
      s.fired = true;
      s.company.fired = true;
      s.outcome = `Fired. The board lost confidence (${c}/100) and voted you out of ${core.api().labelName(s)}.`;
      log(s, s.outcome);
    }
    /** Runs the review now: confidence, any vote, then next period's budget, perks and freedom. */
    function runReview(s) {
      const b = board(s);
      if (!b) throw Error("There is no board to review the label.");
      const promises = checkPromises(s);
      boardWeek(s);
      const c = b.confidence,
        wasOnProbation = b.probation,
        voteDue = c < REVIEW.voteBelow || (wasOnProbation && c < REVIEW.voteOnProbationBelow),
        vote = voteDue ? holdVote(s) : null,
        record = {
          week: s.week,
          confidence: c,
          probation: false,
          vote,
          promises,
          directors: b.directors.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            satisfaction: d.satisfaction,
          })),
        };
      if (vote?.passed) {
        b.reviews.push(record);
        fire(s, c);
        return record;
      }
      b.probation = c < REVIEW.probationBelow;
      b.budget = reviewBudget(s, c);
      b.budgetLeft = b.budget;
      b.spent = 0;
      b.freedom = freedomFor(c, b.probation, !!s.company.coCeo);
      b.perks = perksFor(c);
      Object.assign(record, { probation: b.probation, budget: b.budget, freedom: b.freedom, perks: b.perks });
      b.reviews.push(record);
      if (b.reviews.length > 12) b.reviews.shift();
      b.scene = true;
      setTargets(s);
      b.nextReview = s.week + reviewInterval(s);
      log(s, `Board review: confidence ${c}/100${b.probation ? ", on probation" : ""}.`);
      return record;
    }
    /** Whether the board backs moving up a phase. Always yes with no board. */
    function approvesPhase(s) {
      const b = board(s);
      if (!b) return true;
      return (b.confidence ?? confidence(s)) >= REVIEW.phaseVote;
    }
    // ---- Spending and approvals (T21) ----
    /** Confidence points every director loses for spending past the budget (0 or negative). */
    function overspendPoints(s) {
      const b = board(s);
      if (!b?.budget || !(b.spent > b.budget)) return 0;
      const pct = ((b.spent - b.budget) / b.budget) * 100;
      return -Math.round(Math.min(OVERSPEND.cap, pct / OVERSPEND.pctPerPoint) * 10) / 10;
    }
    function onSpend(s, n) {
      const b = board(s);
      if (!b?.budget) return;
      b.spent = (b.spent || 0) + n;
      b.budgetLeft = b.budget - b.spent;
    }
    function approved(s, kind, key) {
      return (board(s)?.approvals || []).some((x) => x.kind === kind && x.key === key && x.week === s.week);
    }
    /** Throws after putting an approval request in the Inbox, unless the board approved it this week. */
    function requireApproval(s, kind, key, text) {
      if (approved(s, kind, key)) return;
      const c = board(s).confidence ?? confidence(s);
      s.event = {
        id: s.nextId++,
        type: "approval",
        title: "The board must approve this",
        body: `${text} Board confidence is ${c}; the board says yes at ${APPROVAL.grant} or more.`,
        approval: { kind, key },
        options: [
          {
            label: "Make the case",
            hint: `Approved at ${APPROVAL.grant}+ confidence (now ${c}).`,
            approve: true,
          },
          { label: "Drop it", hint: "Nothing happens." },
        ],
      };
      throw Error(`Board approval needed: ${text} The request is in your Inbox.`);
    }
    function freedomOf(s) {
      return board(s)?.freedom || "high";
    }
    function beforeSpend(s, n) {
      const b = board(s);
      if (!b?.budget || freedomOf(s) === "high") return;
      if ((b.spent || 0) + n > b.budget)
        requireApproval(
          s,
          "overBudget",
          String(n),
          `This $${n.toLocaleString("en-US")} payment goes past the period budget.`,
        );
    }
    function acquisitionVotes(s) {
      const directors = board(s).directors;
      return directors.filter((d) => satisfaction(s, d).value >= APPROVAL.grant).length;
    }
    function payAcquisition(s, id, price, upfront) {
      if (s.cash < upfront) throw Error("Not enough cash for the acquisition.");
      const b = board(s);
      if (b && price > b.budget - (b.spent || 0) && !approved(s, "acquisition", id)) {
        s.event = {
          type: "approval",
          title: "The board must approve the acquisition",
          body: "The proposed purchase exceeds the remaining budget. A majority must vote in favor.",
          approval: { kind: "acquisition", key: id },
          options: [
            {
              label: "Call the vote",
              hint: "Each director votes according to their satisfaction.",
              approve: true,
            },
            { label: "Drop it", hint: "Keep the current budget." },
          ],
        };
        return false;
      }
      s.cash -= upfront;
      onSpend(s, price);
      return true;
    }
    function approveSigning(s, a, q) {
      const b = board(s);
      if (!b?.budget || freedomOf(s) !== "low") return;
      if (q.fee >= APPROVAL.bigSigning * b.budget)
        requireApproval(
          s,
          "signing",
          String(a.id),
          `Signing ${a.name} for $${q.fee.toLocaleString("en-US")} is a big signing.`,
        );
    }
    function approvePlan(s, plan, a) {
      if (!board(s) || freedomOf(s) !== "low") return;
      const risky = (plan.themes || []).filter((t) => APPROVAL.riskyThemes.includes(t)),
        released = s.albums.filter((p) => p.released),
        newGenre = released.length && !released.some((p) => p.genre === plan.genre);
      for (const t of risky)
        requireApproval(s, "theme", t, `${a.name}'s album leans on a risky theme: ${t}.`);
      if (newGenre)
        requireApproval(s, "genre", plan.genre, `${plan.genre} would be a new genre for the label.`);
    }
    function eventChoice(s, e, o) {
      if (e.type !== "approval" || !o.approve) return;
      const b = board(s),
        c = b.confidence ?? confidence(s);
      const acquisition = e.approval.kind === "acquisition";
      const yes = acquisition ? acquisitionVotes(s) : 0;
      if (acquisition ? yes > b.directors.length / 2 : c >= APPROVAL.grant) {
        b.approvals = [
          ...(b.approvals || []).filter((x) => x.week === s.week),
          { ...e.approval, week: s.week },
        ];
        log(s, "The board approved the request. Go ahead this week.");
      } else
        log(
          s,
          acquisition
            ? `The board vetoed the acquisition (${yes} of ${b.directors.length} in favor).`
            : `The board said no (confidence ${c}).`,
        );
    }
    // ---- Lobbying and promises (T22) ----
    function director(s, id) {
      const d = board(s)?.directors.find((x) => x.id === Number(id));
      if (!d) throw Error("That director is not on the board.");
      return d;
    }
    function befriend(d, n) {
      d.relationship = Math.max(-LOBBY.maxRelationship, Math.min(LOBBY.maxRelationship, d.relationship + n));
    }
    /** Meets a director. It takes your week: one meeting a week. */
    function meetDirector(s, id) {
      requireAction(s);
      const d = director(s, id),
        b = board(s);
      if (b.meetingWeek === s.week) throw Error("You have already spent this week's time with the board.");
      b.meetingWeek = s.week;
      befriend(d, LOBBY.meet);
      log(s, `You met ${d.name}. Relationship ${d.relationship}.`);
      return d.relationship;
    }
    /** Targets you could promise a director, one per metric on their agenda. */
    function promiseOptions(s, id) {
      const d = director(s, id),
        values = metricValues(s),
        S = LOBBY.promise.stretch;
      return Object.keys(directorById[d.type].agenda).map((key) => {
        const m = METRICS[key];
        let value;
        if (key === "scandals") value = values.scandals;
        else if (m.kind === "money") value = values[key] + S.money * MONEY_STEP[phase(s) - 1];
        else if (m.kind === "percent") value = Math.round(values[key] * (1 + S.percent / 100));
        else value = Math.min(100, values[key] + S.plain);
        return {
          metric: key,
          value,
          text:
            key === "scandals"
              ? "No more scandals before the review"
              : `${m.name} of ${value.toLocaleString("en-US")} by the review`,
        };
      });
    }
    function makePromise(s, id, metric) {
      requireAction(s);
      const d = director(s, id);
      if (d.promise) throw Error(`You already owe ${d.name} a promise.`);
      const option = promiseOptions(s, id).find((o) => o.metric === metric);
      if (!option) throw Error("That is not on their agenda.");
      d.promise = { metric, value: option.value, week: s.week };
      d.promises = (d.promises || 0) + LOBBY.promise.now;
      log(s, `Promised ${d.name}: ${option.text}.`);
      return d.promise;
    }
    /** Settles every open promise at a review: kept +kept, broken −2 × kept. */
    function checkPromises(s) {
      const values = metricValues(s),
        out = [];
      for (const d of board(s).directors) {
        const p = d.promise;
        if (!p) continue;
        const kept = p.metric === "scandals" ? values.scandals <= p.value : values[p.metric] >= p.value;
        d.promises = (d.promises || 0) + (kept ? LOBBY.promise.kept : -2 * LOBBY.promise.kept);
        out.push({ director: d.id, metric: p.metric, value: p.value, kept });
        delete d.promise;
      }
      return out;
    }
    /** Favors this director would take. */
    function favorOptions(s, id) {
      const d = director(s, id);
      return Object.entries(LOBBY.favors)
        .filter(([, f]) => !f.types || f.types.includes(d.type))
        .map(([kind, f]) => ({ kind, name: f.name, relationship: f.relationship }));
    }
    /** Trades a favor: "candidate" (target: a department id), "shelve" (an album id) or "perk" (a perk id). */
    function tradeFavor(s, id, kind, target) {
      requireAction(s);
      const d = director(s, id),
        f = LOBBY.favors[kind],
        b = board(s);
      if (!f || (f.types && !f.types.includes(d.type))) throw Error(`${d.name} is not asking for that.`);
      if (kind === "candidate") {
        const reach = PHASES[phase(s) - 1].reach;
        core.api().appointHead(s, target, {
          name: core.uniqueName(s, roll(s, "board")),
          skill: D.EXEC_POOL.skill[reach][0],
          loyalty: 30,
          favorOf: d.id,
        });
      } else if (kind === "shelve") {
        const p = s.albums.find((x) => x.id === Number(target));
        if (!p || p.released) throw Error("Pick an album that is still in production.");
        if (!(p.themes || []).some((t) => APPROVAL.riskyThemes.includes(t)))
          throw Error(`${d.name} has no problem with that album.`);
        s.albums = s.albums.filter((x) => x !== p);
        log(s, `${p.title} is shelved.`);
      } else if (kind === "perk") {
        if (!b.perks.includes(target)) throw Error("You do not have that perk.");
        b.perks = b.perks.filter((x) => x !== target);
      }
      befriend(d, f.relationship);
      log(s, `${d.name} appreciated the favor. Relationship ${d.relationship}.`);
      return d.relationship;
    }
    /** Marks the latest review as seen, which lets the clock run again. */
    function ackReview(s) {
      const b = board(s);
      if (b) b.scene = false;
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
        d.satisfaction <= 100 &&
        (d.promises === undefined || Number.isFinite(d.promises)) &&
        (d.promise === undefined || (!!METRICS[d.promise.metric] && Number.isFinite(d.promise.value)))
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
        (c.board.eventConfidence === undefined ||
          (Number.isFinite(c.board.eventConfidence) && Math.abs(c.board.eventConfidence) <= 100)) &&
        (c.board.analystConfidence === undefined ||
          (Number.isFinite(c.board.analystConfidence) && Math.abs(c.board.analystConfidence) <= 100)) &&
        (c.board.nextReview === undefined || isCount(c.board.nextReview)) &&
        (c.board.spent === undefined || isCount(c.board.spent)) &&
        (c.board.approvals === undefined || Array.isArray(c.board.approvals)) &&
        (c.board.budget === undefined || (isCount(c.board.budget) && Number.isFinite(c.board.budgetLeft))) &&
        (c.board.freedom === undefined || REVIEW.freedom.some((f) => f.id === c.board.freedom)) &&
        (c.board.perks === undefined ||
          (Array.isArray(c.board.perks) &&
            c.board.perks.every((id) => REVIEW.perks.some((p) => p.id === id)))) &&
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
      upkeep: (s) => loanPayment(s) + perkCost(s),
      weekly: (s) => {
        loanWeek(s);
        return 0;
      },
      afterSettlement: (s) => {
        boardWeek(s);
        const b = board(s);
        if (b && !s.finished && s.week >= b.nextReview) runReview(s);
      },
      onScandal,
      onSpend,
      beforeSpend,
      approveSigning,
      approvePlan,
      eventChoice,
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
        recordPublicRound,
        startConvertedBoard,
        payAcquisition,
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
        REVIEW,
        runReview,
        holdVote,
        freedomFor,
        perksFor,
        perkCost,
        reviewBudget,
        approvesPhase,
        OVERSPEND,
        APPROVAL,
        overspendPoints,
        LOBBY,
        ackReview,
        meetDirector,
        promiseOptions,
        makePromise,
        checkPromises,
        favorOptions,
        tradeFavor,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { board: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
