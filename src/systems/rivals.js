// Rival labels (3.0): three authored rivals per CEO run. They release into the charts, meet your
// releases in chart battles, bid for your artists, feud with you, and can be bid against or bought.
// Classic runs keep their six background companies only. See docs/architecture.md for hooks.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { PERSONALITIES, RIVAL_LABELS, RIVAL_RULES: R, RIVAL_TITLES } = D;
    const { clamp, log, roll, pay, requireAction } = core;
    const labelById = new Map(RIVAL_LABELS.map((r) => [r.id, r]));

    const list = (s) => (s.company?.rivals || []).filter((r) => !r.bought);
    const company = (s, id) => s.rivalCompanies.find((c) => c.id === id);
    const personality = (r) => PERSONALITIES[labelById.get(r.id).personality];
    /** A rival's strength now: its own drift plus what your phase adds. */
    function strengthOf(s, r) {
      return Math.round(clamp(r.strength + R.perPhase * ((s.company?.phase || 1) - 1), 0, 100));
    }
    /** Your standing with a rival, −100 to 100 (shared with the stories about them). */
    function standingOf(s, id) {
      return company(s, id)?.relationship ?? 0;
    }
    function shiftStanding(s, id, n) {
      const c = company(s, id);
      if (c) c.relationship = clamp((c.relationship || 0) + n, -100, 100);
    }
    const feuding = (s, r) => standingOf(s, r.id) <= R.feudAt;

    /** Picks three rivals when a CEO run starts and adds them to the industry. */
    function init(s) {
      if (!s.company || s.company.rivals) return s;
      const pool = [...RIVAL_LABELS],
        picks = [];
      while (picks.length < R.count && pool.length)
        picks.push(pool.splice(Math.floor(roll(s, "rivals") * pool.length), 1)[0]);
      s.company.rivals = picks.map((x) => ({
        id: x.id,
        strength: PERSONALITIES[x.personality].strength,
        nextRelease: s.week + 1 + Math.floor(roll(s, "rivals") * PERSONALITIES[x.personality].releaseEvery),
        roster: x.roster.map((name) => ({ name })),
        releases: [],
        bought: false,
      }));
      for (const x of picks)
        if (!company(s, x.id))
          s.rivalCompanies.push({
            id: x.id,
            name: x.name,
            ceo: x.ceo,
            strategy: PERSONALITIES[x.personality].text,
            relationship: 0,
            authored: true,
          });
      return s;
    }

    // ---- Releases and chart battles ----
    function releaseTitle(s) {
      const base = RIVAL_TITLES[Math.floor(roll(s, "rivals") * RIVAL_TITLES.length)],
        used = Object.values(s.rivalArchive).filter(
          (x) => x.title === base || x.title?.startsWith(base + " "),
        ).length;
      return used ? `${base} ${used + 1}` : base;
    }
    function release(s, r) {
      const lab = labelById.get(r.id),
        P = personality(r),
        str = strengthOf(s, r),
        rid = "r" + s.nextId++,
        album = {
          id: rid,
          title: releaseTitle(s),
          artistName: r.roster[r.releases.length % r.roster.length].name,
          label: lab.name,
          companyId: r.id,
          genre: lab.genre,
          age: 0,
          baseUnits: Math.round(
            ((R.release.unitsByPhase[(s.company.phase || 1) - 1] * r.strength) / 50) *
              (1 - R.release.unitSpread / 2 + roll(s, "rivals") * R.release.unitSpread) *
              (feuding(s, r) ? 1 + R.feudSales : 1),
          ),
          units: 0,
          quality: Math.round(
            clamp(
              R.release.quality +
                str * R.release.qualityPerStrength +
                P.quality +
                roll(s, "rivals") * R.release.qualitySpread,
            ),
          ),
          releaseWeek: s.week,
          year: core.operatingYear(s.week),
        };
      s.charts.rivals.push(album);
      s.rivalArchive[rid] = { ...album, best: null };
      r.releases = [...r.releases, { id: rid, week: s.week, title: album.title }].slice(-6);
      r.nextRelease = s.week + P.releaseEvery;
      log(s, `${lab.name} released ${album.title}.`);
    }
    function battles(s) {
      for (const p of s.albums) {
        if (
          !p.released ||
          p.battle ||
          (p.chart?.weeks ?? 0) < R.battleWeeks ||
          s.week - p.releaseWeek > R.battleCheck
        )
          continue;
        for (const r of list(s)) {
          const rel = r.releases.find((x) => Math.abs(x.week - p.releaseWeek) <= R.battleWindow);
          const archive = rel && s.rivalArchive[rel.id];
          if (!archive || s.week - rel.week < R.battleWeeks) continue;
          const mine = p.chart.best ?? 999,
            theirs = archive.best ?? 999,
            won = mine < theirs,
            lab = labelById.get(r.id);
          p.battle = { rival: r.id, title: rel.title, mine, theirs, won };
          r.strength = clamp(r.strength + (won ? -R.battleSwing : R.battleSwing), 0, 100);
          const rank = (n) => (n === 999 ? "outside the Top 300" : `#${n}`);
          s.notifications.push({
            id: s.nextId++,
            kind: "battle",
            title: `Chart battle: ${won ? "you win" : `${lab.name} wins`}`,
            body: `${p.title} peaked at ${rank(mine)}; ${lab.name}'s ${rel.title} at ${rank(theirs)}.`,
            week: s.week,
          });
          core.api().noteWhy?.(s, {
            kind: "battle",
            who: "company",
            title: `Chart battle with ${lab.name}: ${won ? "won" : "lost"}`,
            parts: [
              { name: `${p.title}, best chart position`, value: mine },
              { name: `${rel.title}, best chart position`, value: theirs },
            ],
          });
          break;
        }
      }
    }

    /** After each awards night, head-to-heads with a rival move your standing with them. */
    function awardStanding(s) {
      for (const [year, program] of Object.entries(s.awardPrograms || {})) {
        if (!program.results || Number(year) <= (s.company.rivalAwardsSeen ?? 0)) continue;
        s.company.rivalAwardsSeen = Number(year);
        for (const result of program.results) {
          const mine = result.entries.find((x) => x.owned),
            winner = result.entries.find((x) => x.id === result.winner);
          if (!mine || !winner) continue;
          for (const r of list(s)) {
            const theirs = result.entries.find((x) => !x.owned && s.rivalArchive[x.id]?.companyId === r.id);
            if (!theirs) continue;
            const lab = labelById.get(r.id);
            if (winner === theirs) {
              shiftStanding(s, r.id, R.awardSnub);
              log(
                s,
                `${lab.ceo} gloats after ${lab.name}'s ${theirs.title} beats ${mine.title} for ${result.genre} Album of the Year.`,
              );
            } else if (winner === mine) {
              shiftStanding(s, r.id, R.awardBeat);
              log(s, `${lab.name} takes losing ${result.genre} Album of the Year to ${mine.title} badly.`);
            }
          }
        }
      }
    }

    // ---- Bids and feuds (decision cards) ----
    const cardQueued = (s) =>
      [s.event, ...s.eventQueue].some((e) => e?.type === "rivalBid" || e?.type === "rivalFeud");
    function canLeave(s, a) {
      return (
        !core.busy(s, a.id) &&
        R.bidTiers.includes(core.api().tierOf?.(a)) &&
        !(s.week - (a.rivalBidWeek ?? -1e9) < R.artistGap) &&
        ((a.contract?.remaining ?? 0) <= 1 || (a.morale ?? 50) < 40)
      );
    }
    function bidCard(s, r, a) {
      const lab = labelById.get(r.id),
        match = Math.round((a.wage || 200) * R.match),
        counter = Math.round(match * R.counter.share),
        chance = counterChance(s, a);
      return {
        type: "rivalBid",
        rival: r.id,
        artist: a.id,
        title: `${lab.name} wants ${a.name}`,
        body: `${lab.ceo} has offered ${a.name} a deal at ${lab.name}. ${a.contract.remaining <= 1 ? "Their contract is nearly done" : "They have not been happy here"}, and they are listening.`,
        options: [
          {
            label: "Match the offer",
            hint: `Costs ${dollars(match)}. They stay. Morale +${R.matchMorale}, loyalty +${R.matchLoyalty}.`,
            cost: match,
            morale: R.matchMorale,
            rivalChoice: "match",
          },
          {
            label: "Make a counter-offer",
            hint: `Costs ${dollars(counter)}. ${Math.round(chance * 100)}% chance they stay; otherwise they leave.`,
            cost: counter,
            rivalChoice: "counter",
          },
          {
            label: "Let them go",
            hint: `${a.name} leaves for ${lab.name}. Standing with ${lab.name} ${R.letGo.standing}.`,
            rivalChoice: "let",
          },
        ],
      };
    }
    function feudCard(s, r, a) {
      const lab = labelById.get(r.id),
        B = R.superstarFeud.back,
        C = R.superstarFeud.calm;
      return {
        type: "rivalFeud",
        rival: r.id,
        artist: a.id,
        title: `${a.name} picks a fight with ${lab.name}`,
        body: `${a.name} called out ${lab.ceo} on the radio this morning. ${lab.name} is already answering.`,
        options: [
          {
            label: `Back ${a.name}`,
            hint: `Standing with ${lab.name} ${B.standing}, relationship with you +${B.relation}, fans +${B.fans}.`,
            fans: B.fans,
            rivalChoice: "back",
          },
          {
            label: "Calm it down",
            hint: `Standing with ${lab.name} +${C.standing}, relationship with you ${C.relation}.`,
            rivalChoice: "calm",
          },
        ],
      };
    }
    const dollars = (n) => "$" + Math.round(n).toLocaleString("en-US");
    function counterChance(s, a) {
      const loyalty = a.persona?.loyalty ?? 50;
      return clamp(R.counter.base + loyalty / 200 + (core.api().relationOf?.(a) ?? 0) / 200, 0, 0.95);
    }
    function leave(s, a, r) {
      const lab = labelById.get(r.id);
      s.artists = s.artists.filter((x) => x.id !== a.id);
      // Cards still waiting about them no longer apply.
      s.eventQueue = s.eventQueue.filter((e) => e.type === "approval" || e.artist !== a.id);
      r.roster = [...r.roster, { name: a.name, from: true }];
      shiftStanding(s, r.id, R.letGo.standing);
      log(s, `${a.name} signed with ${lab.name}.`);
      core.api().noteWhy?.(s, {
        kind: "poached",
        who: "company",
        title: `${a.name} left for ${lab.name}`,
        parts: [
          { name: "Albums left on their contract", value: a.contract?.remaining ?? 0 },
          { name: "Their morale", value: Math.round(a.morale ?? 0) },
        ],
      });
    }
    function eventChoice(s, e, o) {
      if (e.type !== "rivalBid" && e.type !== "rivalFeud") return;
      const r = (s.company?.rivals || []).find((x) => x.id === e.rival),
        a = s.artists.find((x) => x.id === e.artist);
      if (!r || !a) return;
      if (o.rivalChoice === "match") {
        if (a.persona) a.persona.loyalty = clamp(a.persona.loyalty + R.matchLoyalty);
      } else if (o.rivalChoice === "counter") {
        if (roll(s, "rivals") >= counterChance(s, a)) leave(s, a, r);
        else log(s, `${a.name} took the counter-offer and stays.`);
      } else if (o.rivalChoice === "let") leave(s, a, r);
      else if (o.rivalChoice === "back") {
        shiftStanding(s, r.id, R.superstarFeud.back.standing);
        core
          .api()
          .shiftRelation?.(
            s,
            a,
            R.superstarFeud.back.relation,
            `You backed ${a.name} against ${labelById.get(r.id).name}`,
          );
      } else if (o.rivalChoice === "calm") {
        shiftStanding(s, r.id, R.superstarFeud.calm.standing);
        core.api().shiftRelation?.(s, a, R.superstarFeud.calm.relation, `You calmed ${a.name}'s feud`);
      }
    }

    // ---- The week ----
    function weekly(s) {
      if (!s.company?.rivals) return 0;
      for (const r of list(s)) {
        r.strength = clamp(r.strength + Math.round((roll(s, "rivals") * 2 - 1) * R.drift), 0, 100);
        if (s.week >= r.nextRelease) release(s, r);
      }
      battles(s);
      awardStanding(s);
      // One rival card at a time.
      if (!cardQueued(s) && !s.finished && s.week - (s.company.rivalCardWeek ?? -1e9) >= R.cardGap)
        for (const r of list(s)) {
          const P = personality(r);
          const targets = s.company.phase >= R.poachFrom ? s.artists.filter((a) => canLeave(s, a)) : [];
          if (targets.length && roll(s, "rivals") < P.poach) {
            const a = targets[Math.floor(roll(s, "rivals") * targets.length)];
            a.rivalBidWeek = s.company.rivalCardWeek = s.week;
            s.eventQueue.push(bidCard(s, r, a));
            break;
          }
          const stars = s.artists.filter((a) => core.api().tierOf?.(a) === "superstar");
          if (stars.length && roll(s, "rivals") < P.feud) {
            s.company.rivalCardWeek = s.week;
            s.eventQueue.push(feudCard(s, r, stars[Math.floor(roll(s, "rivals") * stars.length)]));
            break;
          }
        }
      for (const r of list(s))
        if (feuding(s, r) && s.artists.length && roll(s, "rivals") < R.flare) {
          const a = s.artists[Math.floor(roll(s, "rivals") * s.artists.length)],
            lab = labelById.get(r.id);
          a.trust = clamp(a.trust - R.flareTrust);
          if (s.company.board) s.company.board.scandals = (s.company.board.scandals || 0) + 1;
          s.notifications.push({
            id: s.nextId++,
            kind: "deadline",
            title: `The feud with ${lab.name} spills over`,
            body: `${a.name} was dragged into a public row with ${lab.name}. Trust −${R.flareTrust}; the board counts it as a scandal.`,
            week: s.week,
          });
        }
      // Bought rivals' catalogs pay every week.
      return (s.company.rivals || [])
        .filter((r) => r.bought)
        .reduce(
          (n, r) =>
            n + Math.round(R.buy.catalog * r.boughtStrength * (core.api().eraFactor?.(s, "catalog") ?? 1)),
          0,
        );
    }
    /** Feuds lift both sides' sales a little. */
    function salesMultiplier(s) {
      return list(s).some((r) => feuding(s, r)) ? 1 + R.feudSales : 1;
    }

    // ---- Your moves ----
    function bidQuote(s, rivalId, index) {
      const r = list(s).find((x) => x.id === rivalId),
        who = r?.roster[index];
      if (!r || !who) throw Error("That artist is not at that label.");
      const talent = Math.round(clamp(R.poachTalent.base + strengthOf(s, r) * R.poachTalent.perStrength)),
        chance = clamp(R.bid.base + ((s.fame || 0) - strengthOf(s, r)) / 400, R.bid.min, R.bid.max);
      return { r, who, talent, cost: talent * R.bid.perTalent, chance, open: s.company.phase >= R.bid.phase };
    }
    /** Bids for a rival's artist. On success they join your front desk's prospects. */
    function bidForRival(s, rivalId, index) {
      requireAction(s);
      const q = bidQuote(s, rivalId, index),
        lab = labelById.get(q.r.id);
      if (!q.open) throw Error(`Bidding for rivals' artists opens at phase ${R.bid.phase}.`);
      pay(s, q.cost);
      shiftStanding(s, q.r.id, R.bid.standing);
      if (roll(s, "rivals") >= q.chance) {
        log(s, `${lab.name} kept ${q.who.name}.`);
        return null;
      }
      const a = core.api().makeProspect(s, 2);
      Object.assign(a, {
        name: q.who.name,
        genre: lab.genre,
        talent: q.talent,
        potential: Math.min(100, q.talent + R.poachTalent.potential),
        from: q.r.id,
      });
      delete a.castId;
      q.r.roster.splice(index, 1);
      s.candidates.push(a);
      log(s, `${q.who.name} will leave ${lab.name} for you: sign them at the front desk.`);
      return a;
    }
    function buyQuote(s, rivalId) {
      const r = list(s).find((x) => x.id === rivalId);
      if (!r) throw Error("That label is not for sale.");
      const str = strengthOf(s, r),
        price = Math.round(R.buy.catalog * str * R.buy.weeks);
      return { r, price, weak: str < R.buy.below, open: s.company.phase >= R.buy.phase };
    }
    /** Buys a weak rival outright: it leaves the industry and its catalog pays you weekly. */
    function buyRival(s, rivalId) {
      requireAction(s);
      const q = buyQuote(s, rivalId),
        lab = labelById.get(q.r.id);
      if (!q.open) throw Error(`Buying a rival opens at phase ${R.buy.phase}.`);
      if (!q.weak) throw Error(`${lab.name} is too strong to sell.`);
      pay(s, q.price);
      Object.assign(q.r, { bought: true, boughtWeek: s.week, boughtStrength: strengthOf(s, q.r) });
      s.rivalCompanies = s.rivalCompanies.filter((c) => c.id !== q.r.id);
      s.charts.rivals = s.charts.rivals.filter((x) => x.companyId !== q.r.id);
      log(s, `${core.api().labelName(s)} buys ${lab.name}. Its catalog now pays the label.`);
      return q.r;
    }
    /** What the rivals panel shows. */
    function rivalsInfo(s) {
      return list(s).map((r) => {
        const lab = labelById.get(r.id);
        return {
          id: r.id,
          name: lab.name,
          ceo: lab.ceo,
          personality: personality(r).name,
          text: personality(r).text,
          genre: lab.genre,
          strength: strengthOf(s, r),
          standing: standingOf(s, r.id),
          feud: feuding(s, r),
          roster: r.roster.map((x, i) => ({ ...x, quote: bidQuote(s, r.id, i) })),
          buy: buyQuote(s, r.id),
          releases: r.releases,
        };
      });
    }

    function validSave(s) {
      const rv = s.company?.rivals;
      if (rv === undefined) return true;
      return (
        Array.isArray(rv) &&
        rv.every(
          (r) =>
            r &&
            labelById.has(r.id) &&
            Number.isFinite(r.strength) &&
            Number.isInteger(r.nextRelease) &&
            Array.isArray(r.roster) &&
            Array.isArray(r.releases) &&
            typeof r.bought === "boolean",
        ) &&
        [s.event, ...(s.eventQueue || [])].every(
          (e) =>
            (e?.type !== "rivalBid" && e?.type !== "rivalFeud") ||
            (rv.some((r) => r.id === e.rival) && e.options.every((o) => !!o.rivalChoice)),
        )
      );
    }

    return {
      init,
      weekly,
      eventChoice,
      salesMultiplier,
      validSave,
      api: {
        RIVAL_LABELS,
        RIVAL_RULES: R,
        PERSONALITIES,
        rivalsInfo,
        bidQuote,
        bidForRival,
        buyQuote,
        buyRival,
        rivalStrength: strengthOf,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { rivals: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
