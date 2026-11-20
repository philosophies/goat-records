// The campaign: a 20-year run with a goal for every operating year, a final score and star grade,
// and New Game+ legacy bonuses bought with points from that score. See design/gdd/campaign.md.
(function (root) {
  "use strict";
  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { clamp, log, roll, operatingYear } = core;
    const {
      CAMPAIGN,
      CAMPAIGN_GOALS,
      CAMPAIGN_SCORE,
      CAMPAIGN_STARS,
      CEO_SCORE,
      LEGACY,
      LEGACY_BONUSES,
      RANKS,
    } = D;
    const api = () => core.api();
    const bonusById = Object.fromEntries(LEGACY_BONUSES.map((b) => [b.id, b]));
    const STATUSES = ["met", "missed", "untracked", "none"];
    const WEEKS = CAMPAIGN.weeksPerYear;

    /* ---------------- Measuring goals ---------------- */

    function goalFor(year) {
      return CAMPAIGN_GOALS.find((g) => g.year === year) || null;
    }
    function released(s) {
      return s.albums.filter((p) => p.released);
    }
    function yearOf(p) {
      return p.releaseYear ?? operatingYear(p.releaseWeek);
    }
    /** Released albums a goal counts: the whole run so far, or only the goal's year. */
    function scoped(s, g) {
      return released(s).filter((p) => (g.scope === "year" ? yearOf(p) === g.year : yearOf(p) <= g.year));
    }
    /** Annual awards the label won in one operating year. */
    function awardsInYear(s, year) {
      return (s.awardPrograms?.[year]?.results || []).filter((r) =>
        r.entries?.some((e) => e.owned && e.id === r.winner),
      ).length;
    }
    function bestPeak(albums) {
      const peaks = albums.map((p) => p.chart?.best).filter((n) => Number.isFinite(n) && n > 0);
      return peaks.length ? Math.min(...peaks) : null;
    }
    function rewardText(g) {
      const r = g?.reward || {};
      if (r.cash) return "$" + r.cash.toLocaleString("en-US");
      if (r.fame) return `+${r.fame} fame`;
      if (r.themes) return `${r.themes} new theme${r.themes > 1 ? "s" : ""}`;
      return "none";
    }

    /** Live progress toward a goal: { have, need, met, text }. */
    function measure(s, g) {
      const albums = scoped(s, g);
      switch (g.type) {
        case "breakout": {
          const have = { fame: s.fame, awards: s.awards, releases: released(s).length },
            met = Object.entries(g.need).every(([k, n]) => have[k] >= n) && s.cash >= 0;
          return {
            have,
            need: g.need,
            met,
            text: Object.keys(g.need)
              .map((k) => `${k[0].toUpperCase() + k.slice(1)} ${have[k]}/${g.need[k]}`)
              .join(" · "),
          };
        }
        case "rank": {
          const have = api().rank(s);
          return { have, need: g.need, met: have >= g.need, text: `now ${RANKS[have - 1].name}` };
        }
        case "peak": {
          const need = g.count || 1,
            have = albums.filter((p) => p.chart?.best && p.chart.best <= g.peak).length,
            best = bestPeak(albums);
          return {
            have,
            need,
            met: have >= need,
            text: need > 1 ? `${have}/${need} albums` : best ? `best peak #${best}` : "no chart peak yet",
          };
        }
        case "awards": {
          const have = g.scope === "year" ? awardsInYear(s, g.year) : s.awards;
          return { have, need: g.need, met: have >= g.need, text: `${have}/${g.need}` };
        }
        case "releases":
        case "hits": {
          const have = g.type === "hits" ? albums.filter((p) => p.hit).length : albums.length;
          return { have, need: g.need, met: have >= g.need, text: `${have}/${g.need}` };
        }
        case "facilities": {
          const have = s.hq?.facilities.length || 0;
          return { have, need: g.need, met: have >= g.need, text: `${have}/${g.need}` };
        }
        case "fame":
          return { have: s.fame, need: g.need, met: s.fame >= g.need, text: `${s.fame}/${g.need}` };
        case "cash":
          return {
            have: s.cash,
            need: g.need,
            met: s.cash >= g.need,
            text: "$" + Math.round(s.cash).toLocaleString("en-US"),
          };
      }
      throw Error("Unknown campaign goal.");
    }

    /**
     * Result of an earlier year's goal for a save from before the campaign, read from history.
     * Returns "met", "missed" or "untracked" when the history cannot tell.
     */
    function fromHistory(s, g) {
      const boundary = g.year * WEEKS + 1,
        albums = scoped(s, g);
      const answer = (have, need) => (have >= need ? "met" : "missed");
      switch (g.type) {
        case "breakout":
          // Saves from before the campaign only recorded the year-one result.
          if (g.year !== 1) return "untracked";
          return /^You built/.test(s.outcome || "")
            ? "met"
            : /^Year one complete/.test(s.outcome || "")
              ? "missed"
              : "untracked";
        case "rank":
          if ((s.rankUps || []).some((r) => r.rank >= g.need && r.week <= boundary)) return "met";
          return api().rank(s) < g.need ? "missed" : "untracked";
        case "peak": {
          const need = g.count || 1,
            then = albums.filter((p) =>
              (p.chart?.history || []).some((h) => h.week <= boundary && h.rank <= g.peak),
            ).length,
            now = albums.filter((p) => p.chart?.best && p.chart.best <= g.peak).length;
          return then >= need ? "met" : now < need ? "missed" : "untracked";
        }
        case "awards": {
          const years = g.scope === "year" ? [g.year] : Array.from({ length: g.year }, (_, i) => i + 1);
          if (!years.every((y) => s.awardPrograms?.[y]?.results)) return "untracked";
          return answer(
            years.reduce((n, y) => n + awardsInYear(s, y), 0),
            g.need,
          );
        }
        case "releases":
          return answer(albums.length, g.need);
        case "hits":
          return answer(albums.filter((p) => p.hit).length, g.need);
        case "facilities":
          return (s.hq?.facilities || []).filter((f) => f.builtWeek <= boundary).length >= g.need
            ? "met"
            : "untracked";
        case "cash": {
          const row = (s.financeHistory || []).find((r) => r.week === boundary);
          return row ? answer(row.closingCash, g.need) : "untracked";
        }
      }
      return "untracked";
    }

    /* ---------------- Year end ---------------- */

    function snapshot(s) {
      return { week: s.week, fame: s.fame, cash: s.cash, awards: s.awards };
    }
    /** The year's numbers for the yearly review, as calculation rows. */
    function yearNumbers(s, year) {
      const c = s.campaign,
        albums = released(s).filter((p) => yearOf(p) === year),
        start = c.yearStart || snapshot(s),
        peaks = s.albums.flatMap((p) =>
          (p.chart?.history || []).filter((h) => operatingYear(h.week) === year).map((h) => h.rank),
        );
      return [
        { name: "Albums released", value: albums.length },
        { name: "Hit albums (quality 75+)", value: albums.filter((p) => p.hit).length },
        { name: "Awards won", value: awardsInYear(s, year) },
        { name: "Best chart position", value: peaks.length ? "#" + Math.min(...peaks) : "—" },
        { name: "Label fame gained", value: s.fame - start.fame },
        { name: "Cash change", value: Math.round(s.cash - start.cash) },
        { name: "Label rank", value: RANKS[api().rank(s) - 1].name },
      ];
    }
    function grantReward(s, g) {
      const r = g.reward || {};
      if (r.cash) s.cash += r.cash;
      if (r.fame) s.fame += r.fame;
      if (r.themes) {
        const found = [];
        for (let i = 0; i < r.themes; i++) {
          const t = api().discoverTheme(s, `Year ${g.year} goal`, true);
          if (t) found.push(t);
        }
        const missing = r.themes - found.length,
          cash = missing * (CAMPAIGN.themeFallbackCash || 0);
        s.cash += cash;
        if (!found.length) return `Every theme is already known · $${cash.toLocaleString("en-US")} instead`;
        return "New themes: " + found.join(", ") + (cash ? ` · $${cash.toLocaleString("en-US")}` : "");
      }
      return rewardText(g);
    }
    /** Hook: scores the year's goal, pays its reward and queues the yearly review. */
    function yearEnd(s, year) {
      const c = s.campaign;
      if (!c || c.goals.some((g) => g.year === year)) return;
      // CEO runs keep the yearly review but set goals through the company phase instead.
      const goal = s.company ? null : goalFor(year),
        rows = yearNumbers(s, year);
      let record = { year, status: "none" };
      if (goal) {
        const m = measure(s, goal);
        record = { year, status: m.met ? "met" : "missed", progress: m.text };
        if (m.met) record.reward = grantReward(s, goal);
        log(
          s,
          `Year ${year} goal ${m.met ? "achieved" : "missed"}: ${goal.name}${m.met ? ". Reward: " + record.reward : ""}.`,
        );
      }
      c.goals.push(record);
      const next = year < c.years && !s.company ? goalFor(year + 1) : null;
      c.reviews.push({
        year,
        goal: goal?.name ?? null,
        status: record.status,
        progress: record.progress ?? null,
        reward: record.reward ?? null,
        rows,
        next: next ? { name: next.name, reward: rewardText(next) } : null,
        last: year >= c.years,
        seen: false,
      });
      c.reviews = c.reviews.slice(-30);
      c.yearStart = snapshot(s);
    }
    function acknowledgeCampaignReview(s) {
      for (const r of s.campaign.reviews) r.seen = true;
    }
    /** Hook: tracks the run's peak cash and the artists it developed. */
    function weekly(s) {
      const c = s.campaign;
      c.peakCash = Math.max(c.peakCash, s.cash);
      for (const a of s.artists)
        if (api().level(a) >= CAMPAIGN.developedLevel && !c.developed.some((d) => d.id === a.id))
          c.developed.push({ id: a.id, name: a.name, week: s.week });
      return 0;
    }

    /* ---------------- Status for the interface ---------------- */

    function currentYear(s) {
      return Math.min(operatingYear(s.week), s.campaign.years);
    }
    function campaignOver(s) {
      return !!s.campaign && operatingYear(s.week) > s.campaign.years;
    }
    /** Current goal and progress, or null after the last goal year. */
    function currentGoal(s) {
      const year = currentYear(s),
        goal = s.company ? null : goalFor(year);
      if (!goal || campaignOver(s)) return null;
      return { year, goal, reward: rewardText(goal), ...measure(s, goal) };
    }
    /** All years of the run with their goals and results. */
    function campaignStatus(s) {
      const c = s.campaign,
        year = currentYear(s);
      const years = Array.from({ length: c.years }, (_, i) => {
        const y = i + 1,
          goal = goalFor(y),
          record = c.goals.find((g) => g.year === y);
        return {
          year: y,
          name: goal?.name ?? "No goal",
          reward: goal ? rewardText(goal) : "none",
          status: record?.status ?? (y === year && !campaignOver(s) ? "active" : "upcoming"),
          progress:
            record?.progress ?? (y === year && goal && !campaignOver(s) ? measure(s, goal).text : null),
          earned: record?.reward ?? null,
        };
      });
      return {
        run: c.run,
        year,
        years: c.years,
        current: currentGoal(s),
        goals: years,
        met: c.goals.filter((g) => g.status === "met").length,
        legacy: c.legacy.map((id) => bonusById[id]),
        bank: c.bank,
        history: c.history,
      };
    }
    function campaignGoalText(s) {
      const g = currentGoal(s);
      if (!g) return `Final year of run ${s.campaign.run}. The run ends after this year's awards.`;
      return `Year ${g.year}/${s.campaign.years} goal: ${g.goal.name} · ${g.text}${g.met ? " ✓" : ""} · Reward ${g.reward}.`;
    }

    /* ---------------- Final score ---------------- */

    /** Score breakdown as calculation rows, the total and the star grade (1–5). */
    function finalScore(s) {
      if (s.company) return ceoScore(s);
      const K = CAMPAIGN_SCORE,
        albums = released(s),
        rank = api().rank(s),
        ones = albums.filter((p) => p.chart?.best === 1).length,
        tens = albums.filter((p) => p.chart?.best > 1 && p.chart.best <= 10).length,
        hits = albums.filter((p) => p.hit).length,
        goals = s.campaign.goals.filter((g) => g.status === "met").length,
        cash = clamp(Math.floor(Math.max(0, s.cash) / K.cashPer), 0, K.cashCap);
      // Each row counts up to its cap, so no single source decides the grade.
      const capped = (n, cap) => (cap ? Math.min(n, cap) : n),
        capText = (cap) => (cap ? ` (max ${cap})` : "");
      const rows = [
        { name: `Label rank · ${RANKS[rank - 1].name} (${rank} × ${K.perRank})`, value: rank * K.perRank },
        {
          name: `Awards · ${s.awards} × ${K.perAward}${capText(K.awardCap)}`,
          value: capped(s.awards, K.awardCap) * K.perAward,
        },
        {
          name: `Label fame · ${s.fame} × ${K.perFame}${capText(K.fameCap)}`,
          value: Math.round(capped(Math.max(0, s.fame), K.fameCap) * K.perFame),
        },
        {
          name: `#1 albums · ${ones} × ${K.perNumberOne}${capText(K.numberOneCap)}`,
          value: capped(ones, K.numberOneCap) * K.perNumberOne,
        },
        {
          name: `Top 10 albums · ${tens} × ${K.perTopTen}${capText(K.topTenCap)}`,
          value: capped(tens, K.topTenCap) * K.perTopTen,
        },
        {
          name: `Hit albums · ${hits} × ${K.perHit}${capText(K.hitCap)}`,
          value: capped(hits, K.hitCap) * K.perHit,
        },
        { name: `Yearly goals met · ${goals} × ${K.perGoal}`, value: goals * K.perGoal },
        {
          name: `Cash on hand · 1 per $${K.cashPer.toLocaleString("en-US")} (max ${K.cashCap})`,
          value: cash,
        },
      ];
      const subtotal = rows.reduce((n, r) => n + r.value, 0);
      if (isBankrupt(s))
        rows.push({
          name: `Ran out of cash · −${Math.round(K.bankruptPenalty * 100)}%`,
          value: -Math.round(subtotal * K.bankruptPenalty),
        });
      const total = Math.max(
        0,
        rows.reduce((n, r) => n + r.value, 0),
      );
      return { rows, total, stars: starsFor(total) };
    }
    function ceoEnding(s) {
      if (!s.finished) return null;
      if (s.fired || s.ousted) return "fired";
      if (isBankrupt(s)) return "folded";
      return "complete";
    }
    function ceoScore(s) {
      const K = CEO_SCORE;
      const value = api().companyValuation(s).value;
      const share = s.company.ownership ?? 1;
      const hits = released(s).filter((p) => p.hit || p.quality >= D.HIT_QUALITY).length;
      const ending = ceoEnding(s);
      const rows = [
        { name: "Company value", value: Math.min(K.valueCap, Math.floor(value / K.valuePerPoint)) },
        {
          name: `Your stake · ${Math.round(share * 100)}%`,
          value: Math.min(K.ownedCap, Math.floor((value * share) / K.ownedPerPoint)),
        },
        { name: `Hit albums · ${hits}`, value: Math.min(K.hitCap, hits) * K.perHit },
        { name: `Awards · ${s.awards}`, value: Math.min(K.awardCap, s.awards) * K.perAward },
        {
          name: `Artists developed · ${s.campaign.developed.length}`,
          value: Math.min(K.developedCap, s.campaign.developed.length) * K.perDeveloped,
        },
        { name: "Kept the chair", value: !s.fired && !s.ousted && !isBankrupt(s) ? K.keptChair : 0 },
      ];
      const penalty = ending === "folded" ? K.foldPenalty : ending === "fired" ? K.firedPenalty : 0;
      if (penalty)
        rows.push({
          name: ending === "fired" ? "Removed as CEO" : "The label folded",
          value: -Math.round(rows.reduce((total, row) => total + row.value, 0) * penalty),
        });
      const total = rows.reduce((sum, row) => sum + row.value, 0);
      return { rows, total, stars: starsFor(total) };
    }
    function starsFor(total) {
      return Math.max(1, CAMPAIGN_STARS.filter((t) => total >= t).length);
    }
    /** Final review: score, stars, highlights and New Game+ points. Valid at any time; final once finished. */
    function finalReview(s) {
      const c = s.campaign,
        albums = released(s),
        best = albums.toSorted((a, b) => b.quality - a.quality || a.releaseWeek - b.releaseWeek)[0],
        score = finalScore(s),
        awardTitles = Object.values(s.awardPrograms || {}).flatMap((prog) =>
          (prog.results || []).flatMap((r) =>
            r.entries?.filter((e) => e.owned && e.id === r.winner).map((e) => `${e.title} (Y${prog.year})`),
          ),
        );
      return {
        run: c.run,
        finished: s.finished,
        bankrupt: isBankrupt(s),
        ending: s.company ? ceoEnding(s) : null,
        complete: campaignOver(s),
        yearsPlayed: Math.min(c.years, operatingYear(s.week) - (campaignOver(s) ? 1 : 0)),
        score,
        highlights: {
          bestAlbum: best
            ? { title: best.title, artist: best.artistName, quality: best.quality, year: yearOf(best) }
            : null,
          numberOnes: albums.filter((p) => p.chart?.best === 1).map((p) => p.title),
          awards: s.awards,
          awardTitles: awardTitles.filter(Boolean),
          topRank: RANKS[api().rank(s) - 1].name,
          peakCash: Math.max(c.peakCash, s.cash),
          developed: c.developed.map((d) => d.name),
          goalsMet: c.goals.filter((g) => g.status === "met").length,
        },
        points: legacyPoints(s),
        canNewGamePlus: canNewGamePlus(s),
      };
    }
    /** Called by the engine once events are resolved: ends the run after its last year. */
    function campaignOutcome(s) {
      if (!s.campaign || !campaignOver(s)) return null;
      const score = finalScore(s);
      log(s, `Run ${s.campaign.run} complete: ${score.total} points, ${score.stars}-star label.`);
      return `Run complete after ${s.campaign.years} years: ${score.total} points, a ${score.stars}-star label. Visit the office for the final review and New Game+.`;
    }

    /* ---------------- New Game+ ---------------- */

    function legacyPoints(s) {
      return Math.floor(finalScore(s).total / LEGACY.scorePerPoint) + s.campaign.bank;
    }
    /** True when the run ended because the label folded. Older saves have no flag: a finished run below $0 folded. */
    function isBankrupt(s) {
      if (s.company && (s.fired || s.ousted)) return false;
      return !!s.finished && (s.bankrupt ?? s.cash < 0);
    }
    /** New Game+ opens when a run ends at its last year, or by bankruptcy after year one. */
    function canNewGamePlus(s) {
      return !!s.finished && (!!s.company || (isBankrupt(s) ? s.week > WEEKS : campaignOver(s)));
    }
    /** Starts a new run from a finished one, carrying the chosen legacy bonuses. Returns the new state. */
    function newGamePlus(prev, choices = []) {
      if (!canNewGamePlus(prev))
        throw Error(
          prev.company
            ? "New Game+ opens once the CEO run ends."
            : "New Game+ opens after year 20, or after running out of cash once year one is complete.",
        );
      if (!Array.isArray(choices)) throw Error("Choose legacy bonuses from the list.");
      const ids = [...new Set(choices)];
      if (ids.some((id) => !bonusById[id])) throw Error("Unknown legacy bonus.");
      const cost = ids.reduce((n, id) => n + bonusById[id].cost, 0),
        points = legacyPoints(prev);
      if (cost > points) throw Error(`Those bonuses cost ${cost} legacy points; you have ${points}.`);
      const review = finalReview(prev),
        has = (id) => ids.includes(id);
      const legacy = {
        run: prev.campaign.run + 1,
        bank: points - cost,
        bonuses: ids,
        history: [
          ...prev.campaign.history,
          {
            run: prev.campaign.run,
            score: review.score.total,
            stars: review.score.stars,
            years: review.yearsPlayed,
            bankrupt: review.bankrupt,
            ...(review.ending ? { ending: review.ending } : {}),
          },
        ].slice(-20),
        themes: has("themes") ? [...prev.themes] : null,
        combos: has("notebook")
          ? Object.fromEntries(
              Object.entries(prev.combos || {}).map(([k, c]) => [
                k,
                { genre: c.genre, themes: [...c.themes], releases: 0, firstWeek: 1 },
              ]),
            )
          : null,
        team: has("team")
          ? prev.staff
              .filter((r) => prev.employees?.[r])
              .map((r) => JSON.parse(JSON.stringify(prev.employees[r])))
          : null,
        heads:
          has("team") && prev.company
            ? Object.fromEntries(
                Object.entries(prev.company.departments)
                  .filter(([, dept]) => dept.head)
                  .map(([id, dept]) => [id, dept.head]),
              )
            : null,
      };
      const seed = Math.floor(roll(prev, "campaign new game") * 4294967296) >>> 0;
      return api().create(seed, { legacy, ceo: !!prev.company });
    }
    /** Applies legacy bonuses to a newly created label. */
    function applyLegacy(s, L) {
      const c = s.campaign;
      c.run = Number.isInteger(L.run) && L.run > 1 ? L.run : 2;
      c.bank = Math.max(0, Number(L.bank) || 0);
      c.history = Array.isArray(L.history) ? L.history : [];
      c.legacy = (L.bonuses || []).filter((id) => bonusById[id]);
      for (const id of c.legacy) {
        const b = bonusById[id];
        if (b.cash) s.cash += b.cash;
        if (b.rank) s.rank = Math.max(s.rank || 1, b.rank);
        if (b.facility && s.company) addLegacyFloor(s, { type: b.facility, level: 1 });
        else if (b.facility && !s.hq.facilities.some((f) => f.id === b.facility))
          s.hq.facilities.push({ id: b.facility, x: 0, y: 0, level: 1, builtWeek: s.week });
        if (Number.isInteger(b.booth) && !s.booths.some((x) => x.id === b.booth)) {
          s.booths.push({ id: b.booth, hits: 0, prestige: 0 });
          if (s.company) addLegacyFloor(s, { type: "room", room: b.booth, level: 1 });
        }
        if (id === "themes" && L.themes)
          for (const t of L.themes)
            if (D.THEMES.some((x) => x.name === t) && !s.themes.includes(t)) s.themes.push(t);
        if (id === "notebook" && L.combos) Object.assign(s.combos, L.combos);
        if (id === "team" && L.team)
          for (const e of L.team) {
            if (!s.staff.includes(e.role)) s.staff.push(e.role);
            s.employees[e.role] = { ...e, id: s.nextId++ };
          }
      }
      if (s.company && L.heads) {
        for (const [id, head] of Object.entries(L.heads)) {
          const { plot, contacts, calmUntil, ...veteran } = head;
          s.company.departments[id].head = { ...veteran, id: s.company.nextExecId++, hiredWeek: s.week };
        }
      }
      // A free search is paid for and then run, so it uses the normal scouting rules.
      for (const id of c.legacy) {
        const b = bonusById[id];
        if (Number.isInteger(b.scout)) {
          const available = api().scoutLimits(s)?.budget ?? b.scout;
          const budget = Math.min(available, b.scout);
          s.cash += D.SCOUT_BUDGETS[budget].cost;
          api().paidScout(s, budget);
        }
      }
      c.peakCash = Math.max(c.peakCash, s.cash);
      c.yearStart = snapshot(s);
      log(
        s,
        `Run ${c.run} begins${c.legacy.length ? " with legacy bonuses: " + c.legacy.map((id) => bonusById[id].name).join(", ") : ""}.`,
      );
    }
    function addLegacyFloor(s, floor) {
      const buildings = s.company.buildings;
      const apartment = buildings[0];
      if (apartment.floors.length < D.BUILDINGS[0].maxFloors) apartment.floors.push(floor);
      else buildings.push({ id: "storefront", floors: [floor] });
    }

    /* ---------------- New games, loading and validation ---------------- */

    /**
     * Hook: adds campaign data to a new game or an older save. Labels that finished year one under
     * the old single-year rule continue automatically; earlier years' goals are read from history.
     */
    function init(s) {
      if (!s.campaign) {
        const year = operatingYear(s.week),
          c = (s.campaign = {
            revision: 1,
            run: 1,
            years: Math.max(CAMPAIGN.years, year),
            goals: [],
            reviews: [],
            yearStart: snapshot(s),
            peakCash: Math.max(0, s.cash),
            developed: [],
            legacy: [],
            bank: 0,
            history: [],
          });
        for (let y = 1; y < year; y++) {
          const g = goalFor(y);
          c.goals.push({ year: y, status: g ? fromHistory(s, g) : "none", migrated: true });
        }
        if (s.finished && s.cash >= 0 && s.week > WEEKS) {
          s.finished = false;
          s.outcome = null;
          log(s, "Year-one results recorded. The label continues into the 20-year campaign.");
        }
      }
      return s;
    }
    function afterInit(s) {
      if (!s.legacy) return;
      applyLegacy(s, s.legacy);
      delete s.legacy;
    }
    const isRows = (rows) =>
      Array.isArray(rows) &&
      rows.every((r) => r && typeof r.name === "string" && ["number", "string"].includes(typeof r.value));
    /** Hook: rejects malformed campaign data. Saves from before the campaign have none and pass. */
    function validSave(s) {
      const c = s.campaign;
      if (c === undefined) return true;
      if (!c || typeof c !== "object" || Array.isArray(c)) return false;
      if (!Number.isInteger(c.run) || c.run < 1) return false;
      if (!Number.isInteger(c.years) || c.years < CAMPAIGN.years || c.years > 2000) return false;
      if (
        !Array.isArray(c.goals) ||
        !c.goals.every((g) => g && Number.isInteger(g.year) && g.year >= 1 && STATUSES.includes(g.status)) ||
        new Set(c.goals.map((g) => g.year)).size !== c.goals.length
      )
        return false;
      if (
        !Array.isArray(c.reviews) ||
        !c.reviews.every(
          (r) => r && Number.isInteger(r.year) && typeof r.seen === "boolean" && isRows(r.rows),
        )
      )
        return false;
      if (!Number.isFinite(c.peakCash) || !Number.isFinite(c.bank) || c.bank < 0) return false;
      if (!Array.isArray(c.legacy) || !c.legacy.every((id) => bonusById[id])) return false;
      if (!Array.isArray(c.developed) || !Array.isArray(c.history)) return false;
      if (!c.history.every((h) => h && Number.isInteger(h.run) && Number.isFinite(h.score))) return false;
      return true;
    }

    return {
      init,
      afterInit,
      validSave,
      yearEnd,
      weekly,
      api: {
        CAMPAIGN,
        CAMPAIGN_GOALS,
        CAMPAIGN_SCORE,
        CAMPAIGN_STARS,
        LEGACY,
        LEGACY_BONUSES,
        campaignGoal: goalFor,
        goalProgress: measure,
        currentGoal,
        campaignStatus,
        campaignGoalText,
        campaignOver,
        campaignOutcome,
        acknowledgeCampaignReview,
        finalScore,
        finalReview,
        legacyPoints,
        canNewGamePlus,
        newGamePlus,
        validCampaignSave: validSave,
      },
    };
  }
  root.GoatSystems = Object.assign(root.GoatSystems || {}, { campaign: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
