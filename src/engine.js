(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  // Game systems live in src/systems/<name>.js with tables in src/data/<name>.js.
  // Each is optional: a missing file is skipped. In the browser they load as script tags first.
  const SYSTEM_NAMES = [
    "label",
    "campaign",
    "locations",
    "promotion",
    "company",
    "staff",
    "roster",
    "board",
    "events",
    "parties",
    "cast",
    "stories",
    "why",
    "onboarding",
    "rivals",
    "eras",
    "catalog",
    "legacy",
    "delegation",
    "platform",
    "fortune",
    "touring",
  ];
  function optionalRequire(path) {
    try {
      return require(path);
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND" && String(e.message).includes(path.slice(1))) return null;
      throw e;
    }
  }
  // Data files that belong to no single system (story packs).
  const EXTRA_DATA = ["story-artists", "story-staff", "story-context"];
  if (isNode)
    for (const n of ["core", ...SYSTEM_NAMES, ...EXTRA_DATA]) optionalRequire("./data/" + n + ".js");
  const D = root.GoatData,
    LD = D;
  const factories = isNode
    ? Object.fromEntries(SYSTEM_NAMES.map((n) => [n, optionalRequire("./systems/" + n + ".js")?.create]))
    : root.GoatSystems || {};
  const {
    GENRES,
    ROLES,
    BOOTHS,
    STAGES,
    RELEASE_PLANS,
    INSPIRATION_TIERS,
    SCOUT_BUDGETS,
    RECRUIT_BUDGETS,
    ALBUM_ADDONS,
    TOUR_SCALES,
    TOUR_MODES,
    CAREER_XP,
    CAREER_NAMES,
  } = D;
  function level(a) {
    const long = api.artistLevel?.(a);
    if (long) return long;
    let result = 1;
    for (let i = 1; i < CAREER_XP.length; i++) if ((a.xp || 0) >= CAREER_XP[i]) result = i + 1;
    return result;
  }
  function initializeProject(p, a) {
    p.production = {
      stage: 0,
      cooldown: 0,
      review: false,
      results: [],
      rerollsUsed: 0,
      rerollLimit: Math.min(3, level(a)),
      artistLevel: level(a),
      releaseReady: false,
    };
    p.duration = (a.age === "Youth" ? 6 : 5) + (p.addOns || []).length;
    p.remaining = p.duration;
  }
  function migrate(s) {
    for (const a of [...s.artists, ...s.candidates]) {
      if (!Number.isFinite(a.xp)) a.xp = 0;
    }
    if (!s.progressionRevision) {
      for (const a of s.artists)
        a.xp = Math.max(a.xp, s.albums.filter((p) => p.released && p.artist === a.id).length * 2);
      s.progressionRevision = 1;
    }
    for (const p of s.albums) if (!p.released && !p.production) initializeProject(p, artist(s, p.artist));
    initializeManagement(s);
    compactHistory(s);
    return s;
  }
  function project(s, id) {
    const p = s.albums.find((p) => p.id === Number(id));
    if (!p || p.released || !p.production) throw Error("Active album not found.");
    return p;
  }
  function inspirationInfo(a) {
    const value = clamp(a.inspiration ?? 60),
      tier = INSPIRATION_TIERS.findLast((t) => value >= t.min),
      next = INSPIRATION_TIERS.find((t) => t.min > value);
    return { value, ...tier, next, canRecord: value >= 25 };
  }
  function productionBlock(s) {
    return s.albums.some(
      (p) =>
        p.launchReview ||
        (!p.released && p.production && (p.production.review || p.production.cooldown === 0)),
    );
  }
  function stagePreview(s, p, index) {
    const d = p.production,
      stage = STAGES[d.stage],
      o = stage?.options[index];
    if (!o) throw Error("Stage option unavailable.");
    const a = artist(s, p.artist),
      b = s.booths.find((b) => b.id === p.booth),
      room = BOOTHS[b.id],
      genreFit = a.genre === p.genre,
      audienceFit = a.audience === p.audience;
    const factors = {
      trust: a.trust * 0.12,
      trend: p.genre === s.trend ? 13 : -3,
      label: Math.min(14, s.fame * 0.04 + s.reputation * 0.09),
      craft: a.talent * 0.13,
      audience: audienceFit ? 11 : 1,
      energy: a.energy * 0.13,
      booth: room.equipment * 0.08 + room.team * 0.06 + b.prestige * 0.04,
    };
    const parts = [
      {
        name: "Artist craft & morale",
        value: Math.round(22 + a.talent * 0.39 + ((a.morale ?? 75) - 75) / 12),
      },
      { name: "Hired expertise · " + o.role, value: staffBonus(s, o.role) },
      {
        name: "Room, team & album add-ons",
        value: Math.round(
          room.equipment / 25 +
            room.team / 35 +
            b.prestige * 0.03 +
            tier(s) +
            p.baseBudget / 4000 +
            albumAddonBonus(p, d.stage),
        ),
      },
      { name: "Genre & audience fit", value: (genreFit ? 5 : 0) + (audienceFit ? 4 : 0) },
      { name: "Direction · " + o.factor, value: Math.round(factors[o.factor]) },
    ];
    if (Number.isFinite(p.inspirationAtStart))
      parts.push({
        name: "Inspiration at recording · " + p.inspirationAtStart + "/100",
        value: inspirationInfo({ inspiration: p.inspirationAtStart }).bonus,
      });
    parts.push(...hooks.collect("stageParts", s, p, d.stage));
    return {
      name: o.name,
      role: o.role,
      hired: s.staff.includes(o.role),
      bonus: staffBonus(s, o.role),
      parts,
      expected: clamp(parts.reduce((n, c) => n + c.value, 0)),
      trend: s.trend,
    };
  }
  function decideStage(s, id, index) {
    requireAction(s);
    const p = project(s, id),
      d = p.production;
    if (d.review || d.cooldown > 0 || d.stage >= 5) throw Error("This stage is not ready for a decision.");
    const preview = stagePreview(s, p, Number(index)),
      chance = Math.floor(rng(s) * 17) - 8,
      parts = [...preview.parts, { name: "Session variation", value: chance }],
      result = {
        stage: d.stage,
        name: STAGES[d.stage].name,
        area: STAGES[d.stage].area,
        choice: preview.name,
        trend: preview.trend,
        parts,
        score: clamp(parts.reduce((n, c) => n + c.value, 0)),
      };
    d.results.push(result);
    d.stage++;
    d.review = true;
    d.lastResult = d.results.length - 1;
    p.remaining = p.duration - d.stage;
    log(s, `${p.title}: ${result.name} / ${result.choice} scored ${result.score}.`);
    return result;
  }
  function continueProduction(s, id) {
    requireAction(s);
    const p = project(s, id),
      d = p.production;
    if (!d.review) throw Error("No calculation to acknowledge.");
    d.review = false;
    d.cooldown = artist(s, p.artist).age === "Youth" && d.stage === 3 ? 2 : 1;
    // A CEO run's first album, while the starter checklist is on, skips the waits between stages.
    if (s.company && api.fastFirstAlbum?.(s, p)) d.cooldown = 0;
    if (d.stage === 5) d.cooldown += (p.addOns || []).length;
    // With no wait after the last stage, the album is ready for its final review straight away.
    if (d.stage === 5 && d.cooldown === 0) d.releaseReady = true;
  }
  function albumQuality(p) {
    return Math.round(p.production.results.reduce((n, r) => n + r.score, 0) / 5);
  }
  function reshuffle(s, id, index) {
    requireAction(s);
    const p = project(s, id),
      d = p.production;
    index = Number(index);
    if (
      !d.releaseReady ||
      d.review ||
      d.rerollsUsed >= d.rerollLimit ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 5
    )
      throw Error("No reshuffle available for this area.");
    const r = d.results[index],
      before = r.score,
      part = r.parts.at(-1);
    part.value = Math.floor(rng(s) * 25) - 12;
    part.name = "Reshuffled variation";
    r.score = clamp(r.parts.reduce((n, c) => n + c.value, 0));
    d.rerollsUsed++;
    d.review = true;
    d.reshuffleReview = true;
    d.lastResult = index;
    d.lastChange = { before, after: r.score };
    log(s, `${p.title}: ${r.area} reshuffled ${before} → ${r.score}.`);
    return r;
  }
  function acknowledgeReshuffle(s, id) {
    requireAction(s);
    const d = project(s, id).production;
    if (!d.reshuffleReview) throw Error("No reshuffle result to acknowledge.");
    d.review = false;
    d.reshuffleReview = false;
  }
  function releaseAlbum(s, id, title, strategy = "fans") {
    requireAction(s);
    const p = project(s, id);
    if (!RELEASE_PLANS.some((r) => r.id === strategy)) throw Error("Invalid release strategy.");
    if (!p.production.releaseReady || p.production.review)
      throw Error("Complete all five stages and review calculations first.");
    p.releaseStrategy = strategy;
    p.title =
      String(title ?? p.title)
        .trim()
        .slice(0, 45) || p.title;
    finishAlbum(s, p);
    artist(s, p.artist).xp = (artist(s, p.artist).xp || 0) + 3;
    artist(s, p.artist).contract.remaining--;
    artist(s, p.artist).career.releases++;
    artist(s, p.artist).momentum = clamp(artist(s, p.artist).momentum + (p.hit ? 8 : 3));
    artist(s, p.artist).inspiration = 0;
    projectedDebut(s, p);
    log(s, `${p.artistName}: ${artist(s, p.artist).contract.remaining} album(s) left on contract.`);
    return p;
  }
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  /** Separate random stream per system and key, so new systems never shift existing seeded outcomes. */
  function roll(s, key) {
    s.streams ??= {};
    if (!Number.isInteger(s.streams[key])) {
      let h = s.seed ^ 0x51ed270b;
      for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 2654435761);
      s.streams[key] = h >>> 0;
    }
    s.streams[key] = (Math.imul(s.streams[key], 1664525) + 1013904223) >>> 0;
    return s.streams[key] / 4294967296;
  }
  const core = {
    clamp,
    log,
    pay,
    requireAction,
    busy,
    artist,
    roll,
    endTour: (s, t, reason) => endTour(s, t, reason),
    operatingYear,
    uniqueName,
    peopleNames: (s) => peopleNames(s),
    reserveName: (s, name) => reserveName(s, name),
    api: () => api,
  };
  const SYS = SYSTEM_NAMES.filter((n) => factories[n]).map((n) => ({ name: n, ...factories[n](core, D) }));
  const L = SYS.find((x) => x.name === "label");
  const E = SYS.find((x) => x.name === "events");
  // Hook helpers: every system may implement any hook; missing hooks are skipped.
  const hooks = {
    each: (name, ...args) => {
      for (const x of SYS) x[name]?.(...args);
    },
    collect: (name, ...args) => SYS.flatMap((x) => x[name]?.(...args) || []),
    sum: (name, ...args) => SYS.reduce((n, x) => n + (x[name]?.(...args) || 0), 0),
    product: (name, ...args) => SYS.reduce((n, x) => n * (x[name]?.(...args) ?? 1), 1),
    every: (name, ...args) => SYS.every((x) => !x[name] || x[name](...args)),
  };
  function rng(s) {
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function log(s, message) {
    s.news.unshift(`W${s.week}: ${message}`);
    s.news = s.news.slice(0, 60);
  }
  function tier(s) {
    return L.tier(s);
  }
  function slots(s) {
    return L.slots(s);
  }
  // ---- People's names ----
  /** Names reserved this week by people generated but not yet stored (a batch of candidates). */
  const reservedNames = new WeakMap();
  /** Every name in use at the label: artists, prospects, staff, executives, team members, directors. */
  /** Holds a name for this week so nobody else is given it (authored people pick their own names). */
  function reserveName(s, name) {
    let res = reservedNames.get(s);
    if (res?.week !== s.week) reservedNames.set(s, (res = { week: s.week, names: new Set() }));
    res.names.add(name);
  }
  function peopleNames(s) {
    const names = new Set(),
      add = (list) => (list || []).forEach((x) => x?.name && names.add(x.name)),
      c = s.company;
    add(s.artists);
    add(s.candidates);
    add(Object.values(s.employees || {}));
    Object.values(s.staffCandidates || {}).forEach(add);
    for (const d of Object.values(c?.departments || {})) {
      add([d.head]);
      add(d.pool);
    }
    add(c?.team?.pool);
    Object.values(c?.team?.candidates || {}).forEach(add);
    add(c?.board?.directors);
    const r = reservedNames.get(s);
    if (r?.week === s.week) r.names.forEach((n) => names.add(n));
    return names;
  }
  /**
   * A name nobody at the label has, from one random number: the pair at that point of the
   * NAME_FIRST × NAME_LAST list, or the next free one after it.
   */
  function uniqueName(s, r) {
    const F = D.NAME_FIRST.length,
      N = F * D.NAME_LAST.length,
      taken = peopleNames(s),
      start = Math.floor(r * N);
    let name = null;
    for (let k = 0; k < N && !name; k++) {
      const i = (start + k) % N,
        n = `${D.NAME_FIRST[i % F]} ${D.NAME_LAST[Math.floor(i / F)]}`;
      if (!taken.has(n)) name = n;
    }
    name ??= `${D.NAME_FIRST[start % F]} ${D.NAME_LAST[Math.floor(start / F)]} ${s.nextId}`;
    let res = reservedNames.get(s);
    if (res?.week !== s.week) reservedNames.set(s, (res = { week: s.week, names: new Set() }));
    res.names.add(name);
    return name;
  }
  function candidate(s) {
    const age = ["Youth", "Teen", "Adult"][Math.floor(rng(s) * 3)];
    return {
      inspiration: 60,
      id: s.nextId++,
      name: uniqueName(s, rng(s)),
      age,
      audience: ["Youth", "Teen", "Adult"][Math.floor(rng(s) * 3)],
      genre: GENRES[Math.floor(rng(s) * 6)],
      talent: 40 + Math.floor(rng(s) * 36),
      fans: 8 + Math.floor(rng(s) * 15),
      trust: 65,
      energy: 100,
      attention: 0,
      fee: 2000 + Math.floor(rng(s) * 25) * 100,
      wage: age === "Youth" ? 170 : age === "Teen" ? 210 : 260,
    };
  }
  function scout(s) {
    s.candidates = Array.from({ length: 4 }, () => prospect(s, 0));
  }
  /** New label. `options.legacy` carries New Game+ bonuses, applied by the campaign system's init. */
  function create(seed = Date.now(), options = {}) {
    let s = {
      version: 1,
      seed: seed >>> 0,
      nextId: 1,
      week: 1,
      cash: 42000,
      fame: 0,
      reputation: 65,
      awards: 0,
      artists: [],
      staff: [],
      booths: [{ id: 0, hits: 0, prestige: 0 }],
      albums: [],
      candidates: [],
      effects: [],
      event: null,
      news: [],
      finished: false,
      outcome: null,
      trend: "Pop",
    };
    scout(s);
    if (options.legacy) s.legacy = options.legacy;
    // A challenge start and legacy perks (legacy system), applied once the run is set up.
    if (options.challenge || options.perks?.length)
      s.setup = { challenge: options.challenge || null, perks: options.perks || [], seed: seed >>> 0 };
    // The company system sets up new CEO runs. Classic mode is an explicit choice.
    if (options.ceo === false) s.classicMode = true;
    else s.ceoMode = true;
    if (options.labelName) api.renameLabel(s, options.labelName, true);
    initializeManagement(s);
    log(
      s,
      `Welcome to ${api.labelName(s)}. Sign an artist at the front desk, tap them to start an album, then advance weeks.`,
    );
    return s;
  }
  function requireAction(s) {
    if (s.finished) throw Error("This season has ended. Start a new label to play again.");
    if (s.event) throw Error("Resolve the industry event before managing your label.");
  }
  /** Pays from cash. `kind` names what it is for ("album" for an album's budget) for the hooks. */
  function pay(s, n, kind) {
    if (s.cash < n) throw Error("Not enough cash.");
    // CEO runs: the board may need to approve spending past the budget, and tracks what is spent.
    if (s.company) hooks.each("beforeSpend", s, n, kind);
    s.cash -= n;
    if (s.company) hooks.each("onSpend", s, n, kind);
  }
  function artist(s, id) {
    let a = s.artists.find((x) => x.id === Number(id));
    if (!a) throw Error("Artist not found.");
    return a;
  }
  function busy(s, id) {
    return s.albums.some((x) => x.artist === id && !x.released) || !!onTour(s, id);
  }
  /** What a signing costs now: the contract's advance, less any CEO-run discount (signingDiscount). */
  function signingFee(s, a, q = contractQuote(s, a, 3)) {
    return s.company ? Math.max(0, q.fee - hooks.sum("signingDiscount", s, a, q)) : q.fee;
  }
  function sign(s, id, term = 3) {
    requireAction(s);
    if (s.artists.length >= slots(s))
      throw Error(
        s.company
          ? "Roster full. The next phase opens more slots."
          : "Roster full. Raise your label rank to unlock more slots.",
      );
    const a = s.candidates.find((x) => x.id === Number(id));
    if (!a) throw Error("Candidate unavailable.");
    // A CEO label with nobody signed may take on one up-and-comer whatever its reputation.
    if (s.reputation < 30 && !(s.company && !s.artists.length))
      throw Error(
        s.company
          ? "This artist needs label reputation of at least 30. (A label with no artists can still sign one.)"
          : "This artist needs label reputation of at least 30.",
      );
    const q = contractQuote(s, a, term);
    if (s.company) hooks.each("approveSigning", s, a, q);
    pay(s, signingFee(s, a, q));
    a.inspiration ??= 60;
    a.momentum ??= 25;
    a.career ??= { releases: 0, awards: 0, albumRevenue: 0, showDays: 0 };
    s.artists.push({
      ...a,
      wage: q.wage,
      contract: { term: q.term, remaining: q.term, royalty: q.royalty, signedWeek: s.week },
    });
    s.candidates = s.candidates.filter((x) => x.id !== a.id);
    if (a.sourceRivalId) {
      s.rivalArtists = s.rivalArtists.filter((r) => r.id !== a.sourceRivalId);
      const newcomer = prospect(s, 2);
      newcomer.fame = 35 + Math.floor(rng(s) * 35);
      s.rivalArtists.push(newcomer);
    }
    log(
      s,
      `${a.name} signed for ${q.term} albums. Advance $${q.fee}, ${Math.round(q.royalty * 100)}% album royalty.`,
    );
  }
  function hire(s, role, candidateId) {
    requireAction(s);
    if (!Object.hasOwn(ROLES, role)) throw Error("Position unavailable.");
    if (s.staff.includes(role) && candidateId === undefined) throw Error("Select a replacement candidate.");
    const pool = s.staffCandidates[role],
      c = candidateId === undefined ? pool[0] : pool.find((c) => c.id === Number(candidateId));
    if (!c) throw Error("Candidate unavailable. Run a recruitment drive.");
    const severance = s.staff.includes(role) ? s.employees[role].wage * 2 : 0;
    pay(s, c.cost + severance);
    if (!s.staff.includes(role)) s.staff.push(role);
    s.employees[role] = { ...c };
    s.staffCandidates[role] = pool.filter((x) => x.id !== c.id);
    log(
      s,
      `${c.name} joined as ${role} (skill ${c.skill}). ${severance ? "Replacement severance $" + severance + "." : ""}`,
    );
  }
  function build(s, id) {
    requireAction(s);
    id = Number(id);
    if (!BOOTHS[id] || s.booths.some((x) => x.id === id)) throw Error("Booth unavailable.");
    if (tier(s) < BOOTHS[id].labelTier)
      throw Error(
        s.company
          ? "Move the company up a phase to unlock this room."
          : "Raise your label rank to unlock this room.",
      );
    pay(s, BOOTHS[id].cost);
    s.booths.push({ id, hits: 0, prestige: 0 });
    log(s, `${BOOTHS[id].name} opened.`);
  }
  function train(s, id) {
    requireAction(s);
    const a = artist(s, id),
      info = trainingInfo(s, a);
    if (!a.contract.remaining) throw Error("Renew this artist’s contract before investing in development.");
    if (busy(s, a.id)) throw Error("Finish recording or touring before development.");
    if (info.wait) throw Error(`Development available in ${info.wait} week(s).`);
    if (info.gain <= 0)
      throw Error(
        s.company
          ? "Development ceiling reached. Earn artist levels, move the company up a phase, or scout higher potential."
          : "Development ceiling reached. Earn artist levels, raise your label rank, or scout higher potential.",
      );
    if (a.energy < 30) throw Error("Artist needs rest.");
    pay(s, info.cost);
    a.talent += info.gain;
    a.energy -= 15;
    a.xp = (a.xp || 0) + 1;
    a.trainingSessions++;
    a.lastTrainingWeek = s.week;
    log(s, `${a.name}: craft +${info.gain}, career XP +1. Next development in 3 weeks.`);
    hooks.each("afterTraining", s, a);
  }
  function releaseArtist(s, id) {
    requireAction(s);
    let a = artist(s, id);
    if (busy(s, a.id)) throw Error("Finish recording or touring before ending this contract.");
    s.artists = s.artists.filter((x) => x.id !== a.id);
    const penalty = a.contract.remaining > 0 ? 3 : 0;
    s.reputation = clamp(s.reputation - penalty);
    log(s, `${a.name} left the roster. Reputation -${penalty}.`);
  }
  /**
   * Starts an album. Systems may read extra plan fields (themes, location, …) through
   * validatePlan, planCost and onRecord.
   */
  function record(s, plan) {
    let { artistId, boothId, genre, audience, budget = 4000, title, addOns = [] } = plan;
    requireAction(s);
    const a = artist(s, artistId),
      b = s.booths.find((x) => x.id === Number(boothId));
    // A CEO album is always in its artist's genre (owner decision 2026-11-26).
    if (s.company) genre = a.genre;
    budget = Number(budget);
    if (
      !b ||
      !GENRES.includes(genre) ||
      !["Youth", "Teen", "Adult"].includes(audience) ||
      ![4000, 8000, 12000].includes(budget) ||
      !Array.isArray(addOns) ||
      new Set(addOns).size !== addOns.length ||
      addOns.some((id) => !ALBUM_ADDONS.some((x) => x.id === id))
    )
      throw Error("Invalid album plan.");
    hooks.each("validatePlan", s, plan);
    if (!a.contract.remaining) throw Error("Contract complete. Renew before starting another album.");
    if (busy(s, a.id)) throw Error("This artist is already recording or touring.");
    if (s.albums.some((x) => !x.released && x.booth === b.id)) throw Error("That booth is occupied.");
    if (a.energy < 35) throw Error("Artist needs rest (35 energy required).");
    if (!inspirationInfo(a).canRecord)
      throw Error(
        "Artist needs at least 25 inspiration to start an album. Inspiration recovers between projects.",
      );
    const total =
        budget +
        addOns.reduce((n, id) => n + ALBUM_ADDONS.find((x) => x.id === id).cost, 0) +
        hooks.sum("planCost", s, plan),
      expectation = albumExpectation(s, a, total);
    if (s.company) hooks.each("approvePlan", s, plan, a);
    pay(s, total, "album");
    const p = {
      id: s.nextId++,
      title:
        String(title || "Untitled Sessions")
          .trim()
          .slice(0, 45) || "Untitled Sessions",
      artist: a.id,
      artistName: a.name,
      booth: b.id,
      genre,
      audience,
      baseBudget: budget,
      budget: total,
      addOns: [...addOns],
      recordWeek: s.week,
      expectation,
      released: false,
      age: 0,
      total: 0,
      salesWeeks: 12,
      boosts: [],
      eventsSeen: [],
      royalty: a.contract.royalty,
      gross: 0,
      royalties: 0,
      chart: { rank: null, best: null, weeks: 0, milestones: [], history: [] },
    };
    p.inspirationAtStart = inspirationInfo(a).value;
    p.economyVersion = 5;
    p.distributionFees = 0;
    initializeProject(p, a);
    s.albums.push(p);
    hooks.each("onRecord", s, p, plan);
    a.energy -= 30;
    log(
      s,
      `${a.name} began ${p.title}: $${total}, ${p.duration} weeks, expected label revenue $${expectation.target}.`,
    );
  }
  function upkeep(s) {
    const wages = s.artists.reduce(
      (n, a) => n + (a.contract?.remaining > 0 || busy(s, a.id) ? a.wage : 0),
      0,
    );
    const factor = hasRole(s, "VP") ? 1 - (0.1 + roleSkill(s, "VP") * 0.0015) : 1;
    return Math.round(
      wages * factor +
        s.staff.reduce((n, r) => n + (s.employees[r]?.wage ?? ROLES[r].wage), 0) +
        s.booths.reduce((n, b) => n + BOOTHS[b.id].upkeep, 0) +
        hooks.sum("upkeep", s),
    );
  }
  function finishAlbum(s, p) {
    let a = artist(s, p.artist),
      b = s.booths.find((x) => x.id === p.booth);
    p.quality = albumQuality(p);
    const previous = s.albums
      .filter((x) => x.released && x.artist === p.artist && x.id !== p.id)
      .toSorted((a, b) => b.releaseWeek - a.releaseWeek)[0];
    p.freshness = previous && s.week - previous.releaseWeek < 8 ? 0.9 : 1;
    p.releaseYear = operatingYear(s.week);
    p.released = true;
    p.releaseWeek = s.week;
    p.launchFans = a.fans;
    p.launchTrust = a.trust;
    p.launchAttention = a.attention;
    p.trending = p.genre === s.trend;
    p.hit = p.quality >= 75;
    if (p.addOns.includes("appearances")) {
      a.attention = clamp(a.attention + 10);
      a.energy = clamp(a.energy - 8);
    }
    const ratings = [
      {
        name: "Critics",
        parts: [
          { name: "Album quality × 70%", value: Math.round(p.quality * 0.7) },
          { name: "Songwriting × 20%", value: Math.round(p.production.results[1].score * 0.2) },
          { name: "Booth prestige × 10%", value: Math.round(b.prestige * 0.1) },
        ],
      },
      {
        name: "Fan response",
        parts: [
          { name: "Album quality × 65%", value: Math.round(p.quality * 0.65) },
          { name: "Artist trust × 20%", value: Math.round(a.trust * 0.2) },
          { name: "Audience fit", value: p.audience === a.audience ? 10 : 0 },
        ],
      },
      {
        name: "Market impact",
        parts: [
          { name: "Album quality × 60%", value: Math.round(p.quality * 0.6) },
          { name: "Marketing expertise", value: staffBonus(s, "Marketing") },
          { name: "Current trend", value: p.trending ? 12 : 0 },
          { name: "Label reputation × 10%", value: Math.round(s.reputation * 0.1) },
          { name: "Artist attention × 10%", value: Math.round(a.attention * 0.1) },
        ],
      },
    ];
    const plan = RELEASE_PLANS.find((r) => r.id === p.releaseStrategy);
    for (const [i, r] of ratings.entries()) {
      r.parts.push({
        name: "Release package",
        value:
          (p.addOns.includes("video") && i === 2 ? 8 : 0) +
          (p.addOns.includes("press") ? (i === 0 ? 5 : i === 2 ? 3 : 0) : 0) +
          (p.addOns.includes("star") && i === 0 ? 6 : 0),
      });
      r.parts.push({ name: plan.name + " · strategy", value: i === plan.target ? 6 : -3 });
      r.parts.push({
        name: "Launch expertise · " + plan.role,
        value: i === plan.target && hasRole(s, plan.role) ? Math.round(staffBonus(s, plan.role) / 2) : 0,
      });
      r.parts.push(...hooks.collect("launchParts", s, p, i));
      r.parts.push({ name: "Release-day variation", value: Math.floor(rng(s) * 13) - 6 });
      r.score = clamp(r.parts.reduce((n, c) => n + c.value, 0));
    }
    p.launchRatings = ratings;
    p.launchMultiplier =
      (0.7 + ratings.reduce((n, r) => n + r.score, 0) / 3 / 200) * (p.addOns.includes("video") ? 1.12 : 1);
    p.launchReview = true;
    a.fame = clamp(a.fame + Math.round(p.quality / 20));
    a.reputation = clamp(a.reputation + (p.hit ? 2 : 0));
    a.fans = clamp(a.fans + Math.round(p.quality / 9), 0, 1000);
    s.fame += Math.round(p.quality / 8);
    if (p.hit) {
      b.hits++;
      b.prestige = clamp(b.prestige + 12);
      s.fame += 8;
    }
    hooks.each("onRelease", s, p);
    if (s.company) autoEnterAwards(s, operatingYear(p.releaseWeek));
    log(s, `${p.title} released: ${p.quality}/100${p.hit ? " · HIT! Booth prestige +12." : ""}`);
  }
  function makeEvent(s) {
    const a = s.artists[Math.floor(rng(s) * s.artists.length)];
    if (!a) return null;
    const rival = s.week % 8 === 0;
    if (rival) return makeCEOEvent(s);
    const events = [
      {
        title: "A clip goes viral",
        body: `An unfinished clip of ${a.name} is circulating. Turn it into a moment or protect the release?`,
        options: [
          {
            label: "Amplify the hype",
            hint: "$800; attention +25, trust -7. In 3 weeks: trust -8, fans +5.",
            cost: 800,
            attention: 25,
            trust: -7,
            delay: {
              after: 3,
              trust: -8,
              fans: 5,
              text: "The hype brought fans, but the rushed rollout weakened audience trust.",
            },
          },
          {
            label: "Share the honest story",
            hint: "$600; attention +8, trust +7. In 3 weeks: fans +4.",
            cost: 600,
            attention: 8,
            trust: 7,
            delay: { after: 3, fans: 4, text: "An honest behind-the-scenes story earns repeat listeners." },
          },
          {
            label: "Give the artist space",
            hint: "Energy +15, trust +4; attention -5.",
            energy: 15,
            trust: 4,
            attention: -5,
          },
        ],
      },
      {
        title: "The sponsor wants a new image",
        body: `A sponsor offers ${a.name} a fast payday for a campaign that clashes with their artistic direction.`,
        options: [
          {
            label: "Take the endorsement",
            hint: "Cash +$3,500; trust -12, reputation -5. In 4 weeks: fans -6.",
            cash: 3500,
            trust: -12,
            reputation: -5,
            delay: { after: 4, fans: -6, text: "Listeners lose interest in the sponsor-led image." },
          },
          {
            label: "Negotiate artist approval",
            hint: "Cash +$1,200; trust +3. In 4 weeks: reputation +4.",
            cash: 1200,
            trust: 3,
            delay: {
              after: 4,
              reputation: 4,
              text: "Respecting creative approval attracts better partners.",
            },
          },
          {
            label: "Decline and protect their identity",
            hint: "Trust +8, reputation +4.",
            trust: 8,
            reputation: 4,
          },
        ],
      },
      {
        title: "One more appearance?",
        body: `${a.name} is offered a last-minute promotional appearance during a demanding week.`,
        options: [
          {
            label: "Book the appearance",
            hint: "Cash +$1,500; attention +15, energy -20. In 2 weeks: trust -5.",
            cash: 1500,
            attention: 15,
            energy: -20,
            delay: { after: 2, trust: -5, text: "The packed schedule leaves the artist feeling unheard." },
          },
          {
            label: "Arrange a shorter interview",
            hint: "$400; attention +8, energy -5, trust +3.",
            cost: 400,
            attention: 8,
            energy: -5,
            trust: 3,
          },
          {
            label: "Protect recovery time",
            hint: "Energy +20, trust +6; attention -3.",
            energy: 20,
            trust: 6,
            attention: -3,
          },
        ],
      },
    ];
    return { ...events[Math.floor(rng(s) * events.length)], artist: a.id };
  }
  function apply(s, a, e, mitigate = false) {
    // In CEO runs the artist's publicist absorbs part of a trust loss.
    if (a && e.trust < 0 && s.company) {
      hooks.each("onScandal", s, a, e);
      const share = hooks.product("trustLoss", s, a);
      if (share !== 1) e = { ...e, trust: Math.ceil(e.trust * share) };
    }
    if (a && e.artistMomentum) a.momentum = clamp((a.momentum || 0) + e.artistMomentum);
    if (a && e.morale) a.morale = clamp(a.morale + e.morale);
    if (e.labelFame) s.fame += e.labelFame;
    if (a && e.artistFame) a.fame = clamp(a.fame + e.artistFame);
    if (a && e.artistReputation) a.reputation = clamp(a.reputation + e.artistReputation);
    if (e.cash) s.cash += e.cash;
    if (e.reputation) s.reputation = clamp(s.reputation + e.reputation);
    for (const key of ["fans", "trust", "energy", "attention"])
      if (a && e[key])
        a[key] = clamp(
          a[key] +
            (key === "trust" && e[key] < 0 && mitigate && hasRole(s, "Public Relations")
              ? Math.ceil(e[key] * (1 - roleSkill(s, "Public Relations") * 0.005))
              : e[key]),
          0,
          key === "fans" ? 1000 : 100,
        );
  }
  function choose(s, index) {
    if (s.finished || !s.event) throw Error("No active event.");
    const e = s.event;
    let o = e.options[index];
    if (!o) throw Error("Invalid choice.");
    if (!eventOptionAvailable(s, o, e))
      throw Error(
        o.extension ? "Not enough cash or the 18-week extension limit was reached." : "Not enough cash.",
      );
    // CEO runs: the outcome is drawn now, and the option's effects scaled to it (src/systems/fortune.js).
    const luck = s.company ? api.drawFortune?.(s, e, index) : null;
    if (luck) {
      o = luck.option;
      e.fortune = { risk: luck.risk, tier: luck.tier, gain: luck.gain, loss: luck.loss };
    }
    const before = luck ? api.fortuneSnapshot(s, e) : null;
    if (e.type === "companyEvent") {
      try {
        E.resolve(s, e, o);
      } catch (error) {
        // An over-budget choice opens an approval request. Return to the original decision afterward.
        if (s.event?.type !== "approval") throw error;
        s.eventQueue.unshift(e);
        return;
      }
    } else {
      if (o.cost)
        try {
          pay(s, o.cost);
        } catch (error) {
          // An over-budget payment opens a board approval. Keep this decision for afterwards.
          if (s.event?.type !== "approval") throw error;
          s.eventQueue.unshift(e);
          return;
        }
      const a = s.artists.find((a) => a.id === e.artist);
      apply(s, a, o, true);
      if (s.company) hooks.each("eventChoice", s, e, o);
      if (e.type === "ceo") applyCEOChoice(s, e, o);
      if (o.rosterMorale) for (const a of s.artists) a.morale = clamp(a.morale + o.rosterMorale);
      if (e.type === "tourDay") applyDailyTourChoice(s, e, o);
      else if (e.type === "tour") applyTourChoice(s, e, o);
      if (e.album) {
        const p = s.albums.find((p) => p.id === e.album);
        if (o.extension) p.salesWeeks = Math.min(18, p.salesWeeks + o.extension);
        if (o.mult) p.boosts.push({ start: s.week + 1, until: s.week + (o.boostWeeks || 3), mult: o.mult });
      }
      if (o.delay) s.effects.push({ ...o.delay, week: s.week + o.delay.after, artist: e.artist });
      log(s, `${e.title}: ${o.label}.${luck ? ` ${luck.name}.` : ""}`);
    }
    if (luck && s.event === e) {
      s.company.lastOutcome = {
        week: s.week,
        title: e.title,
        label: o.label,
        risk: luck.risk,
        tier: luck.tier,
        name: luck.name,
        effects: api.fortuneChanges(s, e, before),
        ...(e.major ? { major: true } : {}),
        ...(e.headline ? { headline: e.headline } : {}),
        seen: false,
      };
      delete e.fortune;
    }
    s.event = s.eventQueue.shift() || null;
    if (!s.event && s.pendingTourWeek) {
      s.pendingTourWeek = false;
      advance(s, { fromDays: true });
    } else finalizeRun(s);
  }
  function advance(s, options = {}) {
    requireAction(s);
    if (s.tours.some((t) => t.status === "active") && !options.fromDays)
      throw Error("An active tour advances one day at a time.");
    if (productionBlock(s))
      throw Error("Complete the ready album decision or release review before advancing.");
    const opening = s.cash,
      companyCosts = api.companyCosts?.(s),
      weeklyOverhead = upkeep(s);
    s.week++;
    E?.expire(s);
    s.tourDayInWeek = 0;
    s.cash -= weeklyOverhead;
    for (let a of s.artists) {
      if (!s.albums.some((p) => !p.released && p.artist === a.id))
        a.inspiration = clamp((a.inspiration ?? 60) + (onTour(s, a.id) ? 5 : 10));
      if (!onTour(s, a.id)) {
        a.energy = clamp(a.energy + (busy(s, a.id) ? (a.age === "Youth" ? 6 : 3) : 12));
        if (!busy(s, a.id)) a.morale = clamp(a.morale + 2);
      }
      a.attention = clamp(a.attention - 3);
      a.momentum = clamp((a.momentum ?? 25) - 2);
    }
    for (const p of s.albums) {
      if (!p.released && p.production) {
        const d = p.production;
        // A wait is whole weeks; a save with a part-week wait (from chance-scaled delays before they
        // were kept whole) finishes it this week rather than sticking.
        if (d.cooldown > 0) d.cooldown = Math.max(0, Math.ceil(d.cooldown) - 1);
        else if (d.cooldown < 0) d.cooldown = 0;
        if (d.cooldown === 0 && d.stage === 5) d.releaseReady = true;
        p.remaining = Math.max(
          0,
          5 -
            d.stage +
            d.cooldown +
            (d.stage < 5 ? p.addOns.length : 0) +
            (artist(s, p.artist).age === "Youth" && d.stage < 3 ? 1 : 0),
        );
      }
      p.lastUnits = 0;
      if (p.released && p.age < p.salesWeeks) {
        const a = s.artists.find((x) => x.id === p.artist);
        p.boosts = p.boosts.filter((b) => b.until >= s.week);
        const gross = grossAlbumSales(s, p, a),
          royalty = Math.round(gross * p.royalty),
          feeRate =
            (p.economyVersion >= 5 ? Math.max(0.04, 0.08 - roleSkill(s, "VP") / 2500) : 0) +
            (p.extraDistribution || 0),
          distribution = Math.round(gross * feeRate),
          income = gross - royalty - distribution;
        p.gross += gross;
        p.royalties += royalty;
        p.distributionFees = (p.distributionFees || 0) + distribution;
        p.total += income;
        p.lastNetIncome = income;
        s.cash += income;
        if (a) a.career.albumRevenue += income;
        p.age++;
        p.lastSalesWeek = s.week;
        p.lastUnits = Math.round(gross / 8);
      }
    }
    assessAlbums(s);
    updateCharts(s);
    // CEO runs keep each genre's awards entry on the year's strongest album as charts move.
    if (s.company) autoEnterAwards(s, operatingYear(s.week));
    enqueueAlbumEvents(s);
    for (let e of s.effects.filter((x) => x.week <= s.week)) {
      apply(
        s,
        s.artists.find((a) => a.id === e.artist),
        e,
      );
      log(s, e.text);
    }
    s.effects = s.effects.filter((x) => x.week > s.week);
    if (s.week % 52 === 1 && s.week > 1) {
      resolveAnnualAwards(s, operatingYear(s.week - 1));
      // Promote first, so a rank earned at this settlement counts toward the year's goal.
      L?.checkRank(s);
      hooks.each("yearEnd", s, operatingYear(s.week - 1));
      compactHistory(s);
    }
    s.awardPrograms[operatingYear(s.week)] ??= { year: operatingYear(s.week), entries: {}, results: null };
    if (s.week % 52 === 49)
      log(
        s,
        s.company
          ? "The awards close at the end of this operating year. Your strongest album in each genre is entered."
          : "Annual awards entries close at the end of this operating year. Submit one eligible album per genre.",
      );
    const companyRevenue = s.company ? api.companyRevenue?.(s) : null;
    const income = Object.fromEntries(
        SYS.map((x) => [x.name, x.weekly?.(s, x.name === "company" ? companyRevenue : undefined) || 0]),
      ),
      hqIncome = income.label || 0,
      otherIncome = Object.values(income).reduce((n, v) => n + v, 0) - hqIncome;
    s.financeHistory.push({
      week: s.week,
      openingCash: opening,
      overhead: weeklyOverhead,
      closingCash: s.cash,
      cashChange: s.cash - opening,
      hqIncome,
      otherIncome,
      ...(companyRevenue ? { companyRevenue, companyCosts } : {}),
      albumIncome: s.albums
        .filter((p) => p.lastSalesWeek === s.week)
        .reduce((n, p) => n + (p.lastNetIncome || 0), 0),
    });
    s.financeHistory = s.financeHistory.slice(-52);
    if (s.company) hooks.each("afterSettlement", s);
    if (s.week % 4 === 0) {
      s.trend = GENRES[Math.floor(rng(s) * 6)];
      log(s, `Market update: ${s.trend} is trending. New rival releases have entered the chart.`);
    }
    if (s.cash >= 0) s.debtWeeks = 0;
    else s.debtWeeks = (s.debtWeeks || 0) + 1;
    const graceWeeks = D.DEBT?.graceWeeks ?? 0;
    if (!s.finished && s.cash < 0 && s.debtWeeks > graceWeeks) {
      s.finished = true;
      s.bankrupt = true;
      s.outcome = "The label ran out of cash. Try fewer salaries or smaller recording budgets.";
    } else if (!s.finished) {
      if (s.cash < 0) {
        const left = graceWeeks - s.debtWeeks + 1;
        if (s.debtWeeks === 1)
          s.notifications.push({
            id: s.nextId++,
            kind: "debt",
            title: "IN THE RED",
            body: `The label is $${(-s.cash).toLocaleString("en-US")} below zero. Get back above $0 within ${left} weeks or the run ends. Gigs, singles, cheaper budgets or letting staff go can help.`,
            week: s.week,
          });
        log(
          s,
          `Cash is below $0. ${left} week${left === 1 ? "" : "s"} left to recover before the label folds.`,
        );
      }
      if (s.company && E) {
        E.queue(s);
        // Systems that settle queued cards themselves (delegation) run once the week's cards are in.
        hooks.each("cardsQueued", s);
      } else if (s.week % 4 === 0) {
        const e = makeEvent(s);
        if (e) s.eventQueue.push(e);
      }
      s.event = s.eventQueue.shift() || null;
      finalizeRun(s);
    }
    return s;
  }
  function staffSkill(s, role) {
    return s.staff.includes(role) ? (s.employees?.[role]?.skill ?? 60) : 0;
  }
  function staffBonus(s, role) {
    return hasRole(s, role) ? Math.round(6 + roleSkill(s, role) / 10) : 0;
  }
  /**
   * Skill behind a 1.x role effect. Classic runs read the hired employee; CEO runs also read the
   * department head that carries the role (ROLE_DEPARTMENT) and use the better of the two.
   */
  function roleSkill(s, role) {
    const own = staffSkill(s, role);
    return s.company ? Math.max(own, ...hooks.collect("roleSkill", s, role)) : own;
  }
  /** Whether a role effect applies: a hired employee, or in CEO runs a department head. */
  function hasRole(s, role) {
    return s.staff.includes(role) || (!!s.company && roleSkill(s, role) > 0);
  }
  function artistValue(a) {
    return (
      Math.round(
        (a.talent * 35 +
          a.fans * 18 +
          (a.fame || 0) * 55 +
          (a.reputation ?? 65) * 10 +
          level(a) * 450 +
          (a.potential || 85) * 8 +
          (a.momentum ?? 25) * 25 +
          careerTier(a) * 1000) /
          100,
      ) * 100
    );
  }
  function contractQuote(s, a, term = 3) {
    term = Number(term);
    if (![1, 3, 5].includes(term)) throw Error("Choose a 1, 3 or 5 album contract.");
    const value = artistValue(a),
      discount = hasRole(s, "A&R") ? 1 - (0.1 + roleSkill(s, "A&R") / 400) : 1;
    return {
      term,
      fee: Math.round((value * { 1: 0.45, 3: 0.85, 5: 1.2 }[term] * discount) / 50) * 50,
      wage:
        Math.round((100 + a.talent + a.fans * 0.45 + (a.fame || 0) * 0.75 + careerTier(a) * 60) / 10) * 10,
      royalty: Math.max(
        a.royaltyFloor || 0,
        Math.min(
          0.3,
          { 1: 0.18, 3: 0.15, 5: 0.12 }[term] +
            (careerTier(a) >= 2 ? 0.02 : 0) +
            ((a.fame || 0) >= 65 ? 0.01 : 0),
        ),
      ),
    };
  }
  function prospect(s, index = 0) {
    // A CEO run only finds talent within its phase's reach (null in classic runs).
    const lim = api.scoutLimits?.(s);
    if (lim) index = Math.min(index, lim.budget);
    const b = SCOUT_BUDGETS[index],
      a = candidate(s);
    a.talent = b.min + Math.floor(rng(s) * (b.max - b.min + 1));
    a.fans = b.fans + Math.floor(rng(s) * b.fanRange);
    a.potential = Math.max(a.talent, Math.min(100, b.potential + Math.floor(rng(s) * 9)));
    if (lim) {
      a.talent = Math.min(a.talent, lim.talentMax);
      a.potential = Math.max(a.talent, Math.min(a.potential, lim.potentialMax));
      a.reach = lim.reach;
      api.castArtist?.(s, a, lim);
    }
    a.fame = Math.round(a.fans / 5);
    a.reputation = 60 + Math.floor(rng(s) * 20);
    a.xp = 0;
    a.trainingSessions = 0;
    a.lastTrainingWeek = -99;
    a.morale = 75;
    a.momentum = 25;
    a.career = { releases: 0, awards: 0, albumRevenue: 0, showDays: 0 };
    a.fee = contractQuote(s, a, 3).fee;
    a.wage = contractQuote(s, a, 3).wage;
    return a;
  }
  function staffProspect(s, role, index = 0) {
    const b = RECRUIT_BUDGETS[index],
      skill = b.min + Math.floor(rng(s) * (b.max - b.min + 1));
    return {
      id: s.nextId++,
      name: uniqueName(s, rng(s)),
      role,
      skill,
      cost: Math.round((ROLES[role].cost * (0.4 + skill / 100)) / 50) * 50,
      wage: Math.round((ROLES[role].wage * (0.55 + skill * 0.0075) * (0.92 + rng(s) * 0.16)) / 10) * 10,
    };
  }
  function initializeManagement(s) {
    initializeCompanies(s);
    s.employees ??= {};
    s.staffCandidates ??= {};
    s.notifications ??= [];
    s.eventQueue ??= [];
    for (const role of Object.keys(ROLES)) {
      if (s.staff.includes(role) && !s.employees[role])
        s.employees[role] = {
          id: s.nextId++,
          name: "Founding " + role,
          role,
          skill: 60,
          cost: ROLES[role].cost,
          wage: ROLES[role].wage,
        };
      if (!s.staffCandidates[role])
        s.staffCandidates[role] = Array.from({ length: 3 }, () => staffProspect(s, role));
    }
    for (const a of [...s.artists, ...s.candidates]) {
      a.xp ??= 0;
      a.potential ??= Math.max(a.talent, 95);
      a.fame ??= Math.round(a.fans / 5);
      a.reputation ??= 65;
      a.trainingSessions ??= 0;
      a.lastTrainingWeek ??= -99;
      if (s.artists.includes(a) && !a.contract)
        a.contract = { term: 3, remaining: 3, royalty: 0.15, signedWeek: s.week };
    }
    for (const p of s.albums) {
      p.salesWeeks ??= 12;
      p.boosts ??= [];
      p.eventsSeen ??= [];
      p.royalty ??= 0.15;
      p.gross ??= p.total;
      p.royalties ??= 0;
      p.chart ??= { rank: null, best: null, weeks: 0, milestones: [], history: [] };
    }
    if (!s.charts) {
      s.charts = {
        week: s.week,
        entries: [],
        history: [],
        rivals: Array.from({ length: 320 }, () => rivalAlbum(s, true)),
      };
      updateCharts(s, false);
    }
    if (!s.legacyPotentialRevision) {
      for (const a of s.artists)
        if (a.talent >= 85 && a.potential === a.talent && a.potential < 95) a.potential = 95;
      s.legacyPotentialRevision = 1;
    }
    s.managementRevision = 3;
    initializeRoad(s);
    initializeIndustry(s);
    hooks.each("init", s);
    hooks.each("afterInit", s);
    return s;
  }
  function paidScout(s, index) {
    requireAction(s);
    index = Number(index);
    const b = SCOUT_BUDGETS[index];
    if (!b) throw Error("Unknown scouting budget.");
    const locked = api.scoutLocked?.(s, index);
    if (locked) throw Error(locked);
    pay(s, b.cost);
    s.candidates = Array.from({ length: b.count }, () => prospect(s, index));
    s.scoutReport = { week: s.week, budget: b.cost, name: b.name };
    log(
      s,
      `${b.name}: ${b.count} new prospects scouted for $${b.cost}. Higher budgets improve craft, potential and fan reach, not guaranteed hits.`,
    );
  }
  function recruitmentDrive(s, role, index) {
    requireAction(s);
    index = Number(index);
    const b = RECRUIT_BUDGETS[index];
    if (!Object.hasOwn(ROLES, role) || !b) throw Error("Unknown recruitment drive.");
    pay(s, b.cost);
    s.staffCandidates[role] = Array.from({ length: 3 }, () => staffProspect(s, role, index));
    log(
      s,
      `${role}: ${b.name} produced three new candidates. Drive cost $${b.cost}; hiring fees are separate.`,
    );
  }
  function renew(s, id, term) {
    requireAction(s);
    const a = artist(s, id);
    if (busy(s, a.id) || a.contract.remaining > 0)
      throw Error("Renew once the current album commitment is complete.");
    hooks.each("beforeRenew", s, a);
    const q = contractQuote(s, a, term);
    pay(s, q.fee);
    a.wage = q.wage;
    a.contract = { term: q.term, remaining: q.term, royalty: q.royalty, signedWeek: s.week };
    log(
      s,
      `${a.name} renewed for ${q.term} albums. Value $${artistValue(a)}, advance $${q.fee}, ${Math.round(q.royalty * 100)}% album royalty.`,
    );
  }
  function fire(s, role) {
    requireAction(s);
    if (!s.staff.includes(role)) throw Error("Position is already vacant.");
    const fee = s.employees[role].wage * 2;
    // Severance may run the label below $0, so cutting costs is always possible.
    s.cash -= fee;
    s.staff = s.staff.filter((r) => r !== role);
    delete s.employees[role];
    log(s, `${role} employment ended. Severance $${fee}.`);
  }
  function trainingInfo(s, a) {
    const adjust = SYS.map((x) => x.trainingAdjust?.(s, a) || {}),
      hq = {
        ceilingBonus: adjust.reduce((n, x) => n + (x.ceilingBonus || 0), 0),
        potentialBonus: adjust.reduce((n, x) => n + (x.potentialBonus || 0), 0),
        discount: Math.min(
          0.6,
          adjust.reduce((n, x) => n + (x.discount || 0), 0),
        ),
      },
      cap = Math.max(
        a.talent,
        Math.min(
          Math.min(100, (a.potential ?? 85) + hq.potentialBonus),
          64 + tier(s) * 4 + level(a) * 2 + careerTier(a) * 2 + hq.ceilingBonus,
        ),
      );
    const gain = Math.min(
      cap - a.talent,
      (a.talent < 65 ? 3 : a.talent < 80 ? 2 : 1) + (roleSkill(s, "Artist Development") >= 65 ? 1 : 0),
    );
    return {
      cap,
      gain,
      cost: Math.round(
        (400 + a.talent * 6 + (a.trainingSessions || 0) * 120 + level(a) * 75) * (1 - hq.discount),
      ),
      wait: Math.max(0, (a.lastTrainingWeek ?? -99) + 3 - s.week),
    };
  }
  function rivalAlbum(s, initial = false) {
    const first = [
      "Velvet",
      "Electric",
      "Golden",
      "Midnight",
      "Open",
      "Wild",
      "Paper",
      "Sacred",
      "Neon",
      "Lost",
      "Southern",
      "Northern",
      "Silver",
      "Quiet",
      "Future",
      "Crimson",
      "Ocean",
      "After",
    ];
    const second = [
      "Horizons",
      "Letters",
      "Weather",
      "Signals",
      "Rivers",
      "Dreams",
      "Heartbeats",
      "Roads",
      "Voices",
      "Stars",
      "Seasons",
      "Echoes",
      "Stories",
      "Lights",
      "Promise",
      "Parade",
      "Hours",
      "Waves",
    ];
    const names = [
      "Maya Brooks",
      "Dante Lux",
      "June Anthem",
      "Saint Harbor",
      "Aster Lane",
      "Milo James",
      "Sierra Vale",
      "Luna Radio",
      "The Glass Hours",
      "River & Stone",
      "Delia Hart",
      "Orion Coast",
      "Blue Meridian",
      "Robin Ash",
    ];
    // The run's own rival labels release on their own schedule (rivals system).
    const others = s.rivalCompanies.filter((c) => !c.authored),
      c = others[Math.floor(rng(s) * others.length)],
      u = rng(s),
      age = initial ? Math.floor(rng(s) * 13) : 0;
    const baseUnits =
      u < 0.025
        ? 6000 + Math.floor(rng(s) * 12000)
        : u < 0.12
          ? 1500 + Math.floor(rng(s) * 4500)
          : u < 0.45
            ? 300 + Math.floor(rng(s) * 1200)
            : 35 + Math.floor(rng(s) * 315);
    const r = {
      id: "r" + s.nextId++,
      title: first[Math.floor(rng(s) * first.length)] + " " + second[Math.floor(rng(s) * second.length)],
      artistName: names[Math.floor(rng(s) * names.length)],
      label: c.name,
      companyId: c.id,
      genre: GENRES[Math.floor(rng(s) * 6)],
      age,
      baseUnits,
      units: 0,
      quality: 55 + Math.floor(rng(s) * 42),
      releaseWeek: Math.max(1, s.week - age),
    };
    r.year = operatingYear(r.releaseWeek);
    s.rivalArchive[r.id] = { ...r, best: null };
    if (!initial) publishRival(s, r);
    return r;
  }
  function updateCharts(s, advanceRivals = true) {
    const c = s.charts;
    if (advanceRivals && s.week % 4 === 0) {
      c.rivals.sort((a, b) => b.age - a.age);
      c.rivals.splice(0, 20);
      for (let i = 0; i < 20; i++) c.rivals.push(rivalAlbum(s));
    }
    for (const r of c.rivals) {
      if (advanceRivals) r.age++;
      if (advanceRivals || !r.units)
        r.units = Math.max(
          5,
          Math.round(
            r.baseUnits * Math.pow(0.93, r.age) * (0.92 + rng(s) * 0.16) * (r.genre === s.trend ? 1.15 : 1),
          ),
        );
    }
    const entries = [
      ...c.rivals.map((r) => ({ ...r, owned: false })),
      ...s.albums
        .filter((p) => p.released && p.lastSalesWeek === s.week && p.lastUnits > 0)
        .map((p) => ({
          id: p.id,
          title: p.title,
          artistName: p.artistName,
          label: api.labelName(s),
          genre: p.genre,
          units: p.lastUnits,
          owned: true,
        })),
    ];
    entries.sort((a, b) => b.units - a.units || String(a.id).localeCompare(String(b.id)));
    entries.forEach((e, i) => {
      e.rank = i + 1;
      if (!e.owned) {
        const archive = s.rivalArchive[e.id];
        if (archive && e.rank <= 300)
          archive.best = archive.best === null ? e.rank : Math.min(archive.best, e.rank);
        return;
      }
      const p = s.albums.find((p) => p.id === e.id),
        chart = p.chart;
      chart.rank = e.rank <= 300 ? e.rank : null;
      chart.projectedRank = null;
      if (!advanceRivals) return;
      if (e.rank > 300) return;
      chart.best = chart.best === null ? e.rank : Math.min(chart.best, e.rank);
      chart.weeks++;
      chart.history.push({ week: s.week, rank: e.rank, units: e.units });
      const rewards = { 300: 1, 100: 2, 40: 3, 20: 4, 10: 5, 5: 7, 1: 12 },
        crossed = [300, 100, 40, 20, 10, 5, 1].filter((n) => e.rank <= n && !chart.milestones.includes(n));
      if (crossed.length) {
        const fame = crossed.reduce((n, r) => n + rewards[r], 0);
        s.fame += fame;
        const a = s.artists.find((a) => a.id === p.artist);
        if (a) {
          a.fame = clamp(a.fame + fame);
          a.fans = clamp(a.fans + fame, 0, 1000);
          a.momentum = clamp(a.momentum + Math.min(12, fame));
        }
        chart.milestones.push(...crossed);
        const best = Math.min(...crossed),
          title = best === 1 ? "NUMBER ONE!" : `TOP ${best} BREAKTHROUGH`;
        s.notifications.push({
          id: s.nextId++,
          kind: "chart",
          title,
          body: `${p.title} reached #${e.rank} on the Top 300 with ${e.units.toLocaleString()} weekly units. Label fame +${fame}.`,
          week: s.week,
          rank: e.rank,
        });
        log(s, `${p.title}: ${title}, official chart #${e.rank}.`);
      }
    });
    for (const p of s.albums)
      if (p.chart && !entries.some((e) => e.owned && e.id === p.id)) p.chart.rank = null;
    c.week = s.week;
    c.entries = entries.slice(0, 300);
    c.previewEntries = null;
    if (advanceRivals) {
      c.history.push({
        week: s.week,
        entries: c.entries
          .filter((e) => e.rank <= 40 || e.owned)
          .map((e) => ({
            id: e.id,
            rank: e.rank,
            units: e.units,
            title: e.title,
            owned: e.owned,
          })),
      });
      c.history = c.history.slice(-13);
    }
  }

  function albumEvent(s, p, checkpoint) {
    const left = Math.max(0, p.salesWeeks - p.age),
      common = { type: "album", album: p.id, artist: p.artist };
    if (checkpoint === "calendar")
      return {
        ...common,
        title: "Quarterly industry spotlight",
        body: `${p.title} is being considered for the industry’s quarterly spotlight. ${left} earning weeks remain.`,
        options: [
          {
            label: "Invest in a deluxe spotlight",
            hint: "$1,800; +3 earning weeks (maximum 18), sales ×1.25 for 3 weeks, label reputation +3, artist fame +6.",
            cost: 1800,
            extension: 3,
            mult: 1.25,
            boostWeeks: 3,
            reputation: 3,
            artistFame: 6,
          },
          {
            label: "An artist-led retrospective",
            hint: "$500; sales ×1.15 for 3 weeks, artist reputation +5, label reputation +4.",
            cost: 500,
            mult: 1.15,
            boostWeeks: 3,
            artistReputation: 5,
            reputation: 4,
          },
          {
            label: "Let the catalog speak",
            hint: "No cost; artist trust +3, label reputation +2.",
            trust: 3,
            reputation: 2,
          },
        ],
      };
    if (checkpoint === 3)
      return {
        ...common,
        title: "Campaign quarter 1 · The playlist offer",
        body: `${p.title} has reached its first three-week checkpoint. A curator offers a prominent slot.`,
        options: [
          {
            label: "Fund a curated campaign",
            hint: "$900; sales ×1.30 for 3 weeks, artist fame +5, label reputation +2.",
            cost: 900,
            mult: 1.3,
            boostWeeks: 3,
            artistFame: 5,
            reputation: 2,
          },
          {
            label: "Take the exclusive sponsorship",
            hint: "Cash +$1,500; sales ×1.50 for 2 weeks, artist reputation -6, label reputation -4.",
            cash: 1500,
            mult: 1.5,
            boostWeeks: 2,
            artistReputation: -6,
            reputation: -4,
          },
          {
            label: "Grow through the fan community",
            hint: "No cost; sales ×1.08 for 3 weeks, fans +3, trust +5.",
            mult: 1.08,
            boostWeeks: 3,
            fans: 3,
            trust: 5,
          },
        ],
      };
    if (checkpoint === 6)
      return {
        ...common,
        title: "Campaign quarter 2 · A divided reception",
        body: `Halfway through its original run, ${p.title} is sparking a public debate.`,
        options: [
          {
            label: "Offer an honest interview",
            hint: "$500; sales ×1.20 for 3 weeks, artist reputation +5, artist fame +3, label reputation +6.",
            cost: 500,
            mult: 1.2,
            boostWeeks: 3,
            artistReputation: 5,
            artistFame: 3,
            reputation: 6,
          },
          {
            label: "Turn debate into a spectacle",
            hint: "No cost; sales ×1.50 for 2 weeks, trust -8, artist reputation -5, label reputation -5.",
            mult: 1.5,
            boostWeeks: 2,
            trust: -8,
            artistReputation: -5,
            reputation: -5,
          },
          {
            label: "Protect the artist’s boundaries",
            hint: "No cost; artist energy +15, trust +4, label reputation +2.",
            energy: 15,
            trust: 4,
            reputation: 2,
          },
        ],
      };
    if (checkpoint === 9)
      return {
        ...common,
        title: "Campaign quarter 3 · A second wind",
        body: `Listeners want more from ${p.title}. Expand the release or let the artist recover?`,
        options: [
          {
            label: "Produce a deluxe edition",
            hint: "$2,000; +3 earning weeks (maximum 18), sales ×1.35 for 3 weeks, artist energy -10, fame +5, label reputation +3.",
            cost: 2000,
            extension: 3,
            mult: 1.35,
            boostWeeks: 3,
            energy: -10,
            artistFame: 5,
            reputation: 3,
          },
          {
            label: "Host a live listening stream",
            hint: "$1,000; sales ×1.45 for 2 weeks, artist fame +8, artist reputation +4.",
            cost: 1000,
            mult: 1.45,
            boostWeeks: 2,
            artistFame: 8,
            artistReputation: 4,
          },
          {
            label: "Leave space for the next record",
            hint: "No cost; artist energy +10, trust +5.",
            energy: 10,
            trust: 5,
          },
        ],
      };
    return {
      ...common,
      title: "Campaign quarter 4 · The encore decision",
      body: `${p.title} has completed its original 12 earning weeks. ${left} additional earning weeks are already booked.`,
      options: [
        {
          label: "Book an encore campaign",
          hint: "$1,800; +3 earning weeks (maximum 18), sales ×1.25 for 3 weeks, artist fame +5.",
          cost: 1800,
          extension: 3,
          mult: 1.25,
          boostWeeks: 3,
          artistFame: 5,
        },
        {
          label: "License a commercial montage",
          hint: "Cash +$1,800; artist reputation -3, label reputation -4.",
          cash: 1800,
          artistReputation: -3,
          reputation: -4,
        },
        {
          label: "Celebrate the album’s legacy",
          hint: "No cost; fans +5, artist reputation +4, label reputation +4.",
          fans: 5,
          artistReputation: 4,
          reputation: 4,
        },
      ],
    };
  }
  function enqueueAlbumEvents(s) {
    // In CEO runs an album's cards are about its artist, so they stop when the artist leaves.
    const here = (p) => !s.company || s.artists.some((a) => a.id === p.artist);
    for (const p of s.albums.filter((p) => p.released && here(p))) {
      if (p.lastSalesWeek === s.week && [3, 6, 9, 12].includes(p.age) && !p.eventsSeen.includes(p.age)) {
        p.eventsSeen.push(p.age);
        s.eventQueue.push(albumEvent(s, p, p.age));
      }
    }
    if (s.week % 13 === 0) {
      const active = s.albums.filter(
        (p) => p.released && here(p) && (p.age < p.salesWeeks || p.lastSalesWeek === s.week),
      );
      if (active.length)
        s.eventQueue.push(albumEvent(s, active[Math.floor(rng(s) * active.length)], "calendar"));
    }
  }
  function eventOptionAvailable(s, o, e = s.event) {
    if (e?.type === "companyEvent") return E.available(s, o, e);
    const p = e?.album ? s.albums.find((p) => p.id === e.album) : null;
    return (!o.cost || s.cash >= o.cost) && (!o.extension || (p && p.salesWeeks < 18));
  }
  function acknowledgeMilestone(s, id) {
    s.notifications = s.notifications.filter((n) => n.id !== Number(id));
  }
  function validManagementSave(s) {
    return (
      s.artists.every(
        (a) =>
          Number.isFinite(a.fame) &&
          Number.isFinite(a.reputation) &&
          Number.isFinite(a.potential) &&
          a.contract &&
          [1, 3, 5].includes(a.contract.term) &&
          Number.isInteger(a.contract.remaining) &&
          a.contract.remaining >= 0 &&
          a.contract.remaining <= a.contract.term &&
          Number.isFinite(a.contract.royalty),
      ) &&
      s.staff.every(
        (r) =>
          s.employees[r] && Number.isFinite(s.employees[r].skill) && Number.isFinite(s.employees[r].wage),
      ) &&
      Object.keys(ROLES).every(
        (r) =>
          Array.isArray(s.staffCandidates[r]) &&
          s.staffCandidates[r].every(
            (c) =>
              c.role === r &&
              Number.isInteger(c.id) &&
              typeof c.name === "string" &&
              Number.isFinite(c.skill) &&
              Number.isFinite(c.cost) &&
              Number.isFinite(c.wage),
          ),
      ) &&
      Array.isArray(s.eventQueue) &&
      Array.isArray(s.notifications) &&
      s.charts &&
      Array.isArray(s.charts.entries) &&
      Array.isArray(s.charts.rivals) &&
      s.albums.every(
        (p) =>
          Number.isInteger(p.salesWeeks) &&
          p.salesWeeks >= 12 &&
          p.salesWeeks <= 18 &&
          Array.isArray(p.boosts) &&
          Array.isArray(p.eventsSeen) &&
          p.chart &&
          Array.isArray(p.chart.milestones),
      )
    );
  }

  function onTour(s, id) {
    return (s.tours || []).find((t) => t.status === "active" && t.artists.includes(Number(id)));
  }
  function albumAddonBonus(p, stage) {
    return (p.addOns || []).reduce(
      (n, id) =>
        n +
        (id === "star"
          ? stage < 4
            ? 10
            : 2
          : id === "video" && stage === 4
            ? 6
            : id === "press"
              ? stage === 0
                ? 2
                : stage === 4
                  ? 4
                  : 0
              : id === "appearances"
                ? stage === 2
                  ? 3
                  : stage === 4
                    ? 5
                    : 0
                : 0),
      0,
    );
  }
  function albumExpectation(s, a, budget) {
    const previous = s.albums
      .filter((p) => p.released && p.artist === a.id)
      .toSorted((x, y) => y.releaseWeek - x.releaseWeek)[0];
    const value = artistValue(a),
      prior = previous?.total || 0;
    return {
      target: Math.round(Math.max(4000, value * 0.75, prior * 0.95, budget * 0.65) / 100) * 100,
      artistValue: value,
      previousRevenue: prior,
      previousTitle: previous?.title || null,
      investment: budget,
      assessed: false,
      status: "pending",
    };
  }
  function initializeRoad(s) {
    s.tours ??= [];
    s.rivalArtists ??= Array.from({ length: 3 }, () => {
      const a = prospect(s, 2);
      a.name = ["Cleo Voss", "Atlas Grey", "Nina Sol"][Math.floor(rng(s) * 3)] + " " + a.id;
      a.fame = 35 + Math.floor(rng(s) * 35);
      return a;
    });
    for (const a of [...s.artists, ...s.candidates]) a.morale ??= 75;
    for (const p of s.albums) {
      p.addOns ??= [];
      p.baseBudget ??= p.budget;
      p.expectation ??= p.released
        ? { legacy: true, target: null, assessed: true, status: "legacy" }
        : albumExpectation(s, artist(s, p.artist), p.budget);
    }
    s.roadRevision = 4;
    return s;
  }
  function assessAlbums(s) {
    for (const p of s.albums) {
      const e = p.expectation;
      if (!p.released || !e || e.assessed || p.age < p.salesWeeks || p.lastSalesWeek === s.week) continue;
      e.assessed = true;
      e.actual = p.total;
      const a = s.artists.find((a) => a.id === p.artist),
        ratio = p.total / e.target;
      if (ratio >= 1) {
        e.status = "met";
        if (a) {
          a.morale = clamp(a.morale + 8);
          a.reputation = clamp(a.reputation + 2);
        }
        s.reputation = clamp(s.reputation + 2);
        log(
          s,
          `${p.title} met its $${e.target} label-revenue expectation. Artist morale +8; artist and label reputation +2.`,
        );
      } else {
        const morale = Math.ceil(8 + (1 - ratio) * 20),
          rep = Math.ceil(2 + (1 - ratio) * 6),
          fame = Math.ceil(1 + (1 - ratio) * 5);
        e.status = "underperformed";
        e.penalties = { morale, reputation: rep, fame };
        if (a) {
          a.morale = clamp(a.morale - morale);
          a.reputation = clamp(a.reputation - rep);
          a.fame = clamp(a.fame - fame);
          a.momentum = clamp((a.momentum || 0) - 10);
        }
        s.reputation = clamp(s.reputation - rep);
        s.fame = Math.max(0, s.fame - fame);
        log(
          s,
          `${p.title} underperformed: $${p.total} / $${e.target}. Morale −${morale}, artist & label reputation −${rep}, fame −${fame}.`,
        );
      }
    }
  }
  // In a CEO run the sales bars for a tour follow the music era's album sales (eras system).
  function tourBars(s) {
    const k = s.company ? (api.eraFactor?.(s, "sales") ?? 1) : 1;
    return { gross: Math.round(10000 * k), units: Math.round(250 * k) };
  }
  function popularAlbum(s, p) {
    const bar = tourBars(s);
    return (
      p.released &&
      !p.tourLaunched &&
      s.week - p.releaseWeek <= 26 &&
      ((p.chart?.best <= 10 && p.chart.best !== null) ||
        p.gross >= bar.gross ||
        (p.age >= 2 && p.lastUnits >= bar.units))
    );
  }
  function tourTicketRevenue(r, m, demand, quality, showDay, boost = 1, variation = 1) {
    return Math.round(
      (r.gate / 7) *
        (0.6 + (r.ramp * showDay) / 7) *
        demand *
        m.revenue *
        (0.5 + quality / 200) *
        boost *
        variation,
    );
  }
  function tourForecast(r, m, demand, quality, upfront, weekly) {
    let revenue = 0,
      cost = upfront,
      breakEvenDay = null;
    for (let day = 1; day <= r.weeks * 7; day++) {
      const gate = tourTicketRevenue(r, m, demand, quality, day);
      revenue += gate;
      cost += Math.ceil(weekly / 7) + Math.round(gate * 0.15);
      if (breakEvenDay === null && revenue >= cost) breakEvenDay = day;
    }
    return { forecast: revenue, cost, expectedNet: revenue - cost, breakEvenDay };
  }
  function tourRemainingForecast(t) {
    const r = TOUR_SCALES.find((r) => r.id === t.scale),
      m = TOUR_MODES.find((m) => m.id === t.mode);
    let net = t.net,
      show = t.showDays,
      rest = t.restDays,
      breakEvenDay = net >= 0 ? t.day : null;
    for (let day = t.day + 1; day <= t.plannedDays; day++) {
      net -= Math.ceil(t.weekly / 7);
      if (rest > 0) rest--;
      else {
        show++;
        const boost = Math.min(
            2.5,
            t.effects.filter((e) => (e.untilDay ?? e.until * 7) >= show).reduce((n, e) => n * e.mult, 1),
          ),
          gate = Math.round(tourTicketRevenue(r, m, t.demand, t.quality, show, boost) * (t.teamGate ?? 1));
        net += gate - Math.round(gate * 0.15);
      }
      if (breakEvenDay === null && net >= 0) breakEvenDay = day;
    }
    return { net, breakEvenDay };
  }
  function checkTourProfit(s, t) {
    if (t.net >= 0 && !t.profitMilestone) {
      t.profitMilestone = true;
      s.notifications.push({
        id: s.nextId++,
        kind: "tour",
        title: "TOUR BREAK-EVEN!",
        body: `${t.artistName}’s tour recovered setup, daily operations, venue fees and event costs. Net $${Math.round(t.net)}.`,
        week: s.week,
      });
    }
  }
  function tourQuote(s, { albumId, scale = "regional", mode = "solo", partnerId = null, rivalId = null }) {
    const p = s.albums.find((p) => p.id === Number(albumId)),
      a = s.artists.find((a) => a.id === p?.artist),
      r = TOUR_SCALES.find((r) => r.id === scale),
      m = TOUR_MODES.find((m) => m.id === mode);
    if (!p || !a || !r || !m) throw Error("Select an album, tour territory and lineup.");
    const partner =
      mode === "labelmate" ? s.artists.find((a) => a.id === Number(partnerId) && a.id !== p.artist) : null;
    const rival = mode === "rival" ? s.rivalArtists.find((a) => a.id === Number(rivalId)) : null;
    if ((mode === "labelmate" && !partner) || (mode === "rival" && !rival))
      throw Error("Select an available tour partner.");
    const demand = Math.max(
      0.8,
      Math.min(
        2.2,
        0.65 +
          a.fans / 250 +
          a.fame / 180 +
          p.quality / 200 +
          (partner ? partner.fans / 500 : rival ? rival.fans / 800 : 0),
      ),
    );
    const upfront = Math.round(r.upfront * m.upfront),
      weekly = Math.round(r.weekly * m.weekly),
      quality = clamp(55 + a.talent * 0.25 + a.morale * 0.1),
      // CEO runs: the ticket rate from fame, quality, tier and reputation (src/systems/touring.js).
      rate = s.company ? api.tourRate?.(s, { lead: a, partner, rival, mode, quality }) : null,
      projection = tourForecast(r, m, demand * (rate?.mult ?? 1), quality, upfront, weekly);
    return {
      album: p,
      artist: a,
      partner,
      rival,
      scale: r,
      mode: m,
      demand,
      upfront,
      weekly,
      quality,
      ...(rate ? { rate } : {}),
      ...projection,
    };
  }
  function startTour(s, plan) {
    requireAction(s);
    const q = tourQuote(s, plan),
      a = q.artist,
      p = q.album;
    if (!popularAlbum(s, p))
      throw Error(
        `Tour requires a recent album with a Top 10 peak, $${tourBars(s).gross.toLocaleString("en-US")} gross sales, or at least two earning weeks and ${tourBars(s).units} weekly units. One tour per album.`,
      );
    const people = [a, ...(q.partner ? [q.partner] : [])];
    if (people.some((a) => busy(s, a.id)))
      throw Error("Every participating label artist must be free of albums and other tours.");
    // In a CEO run the first tour on the road starts on the day of the week the clock has reached,
    // so the week still has seven days in all (plan.weekDay: days of this week already gone, 0–6).
    const weekDay = Number(plan.weekDay);
    if (
      s.company &&
      Number.isInteger(weekDay) &&
      weekDay > 0 &&
      weekDay < 7 &&
      !s.tours.some((t) => t.status === "active") &&
      !s.tourDayInWeek
    )
      s.tourDayInWeek = weekDay;
    if (people.some((a) => a.energy < q.mode.minEnergy))
      throw Error(`This lineup requires ${q.mode.minEnergy} energy for each label artist.`);
    if (s.cash < q.upfront + q.weekly)
      throw Error("Booking requires the upfront fee plus one week of tour operating cash.");
    if (s.company) hooks.each("approveTour", s, q);
    pay(s, q.upfront);
    const t = {
      id: s.nextId++,
      album: p.id,
      title: p.title,
      artist: a.id,
      artists: people.map((a) => a.id),
      artistName: a.name,
      partnerName: q.partner?.name || null,
      rival: q.rival ? { ...q.rival } : null,
      scale: q.scale.id,
      mode: q.mode.id,
      duration: q.scale.weeks,
      elapsed: 0,
      pause: 0,
      status: "active",
      startWeek: s.week,
      upfront: q.upfront,
      weekly: q.weekly,
      demand: q.demand,
      revenue: 0,
      costs: q.upfront,
      net: -q.upfront,
      history: [],
      effects: [],
      day: 0,
      plannedDays: q.scale.weeks * 7,
      baseDays: q.scale.weeks * 7,
      showDays: 0,
      restDays: 0,
      quality: clamp(55 + a.talent * 0.25 + a.morale * 0.1),
      dailyRevision: 5,
      timingRevision: 7,
      nextInteractionDay: 1,
      reviewAfterShow: null,
      lastInteractionAt: 0,
      bookedForecast: q.expectedNet,
      bookedBreakEven: q.breakEvenDay,
      eventBag: [],
      eventLast: null,
      recoveryQueue: [],
      eventWeeks: [],
      fatigueWarning: false,
      profitMilestone: false,
    };
    // CEO runs remember the day of the week the tour began, to give its dates on the label's calendar.
    if (s.company) t.startDay = s.tourDayInWeek || 0;
    s.tours.push(t);
    p.tourLaunched = true;
    p.boosts.push({ start: s.week + 1, until: s.week + q.scale.weeks + 1, mult: 1.12, sourceTour: t.id });
    log(
      s,
      `${a.name} booked a ${q.scale.name.toLowerCase()} ${q.mode.name.toLowerCase()} tour. Upfront loss $${q.upfront}; ${q.scale.weeks} show weeks planned.`,
    );
    return t;
  }
  function endTour(s, t, reason = "Completed the tour", completed = false) {
    if (t.status !== "active") return;
    t.status = completed ? "completed" : "ended early";
    t.endWeek = s.week;
    t.reason = reason;
    s.eventQueue = s.eventQueue.filter((e) => e.tour !== t.id);
    for (const p of s.albums) p.boosts = p.boosts.filter((b) => b.sourceTour !== t.id);
    if (completed) {
      for (const id of t.artists) {
        const a = s.artists.find((a) => a.id === id);
        if (a) {
          a.morale = clamp(a.morale + ((t.quality ?? 80) < 40 ? -4 : (t.quality ?? 80) >= 80 ? 8 : 4));
          a.reputation = clamp(
            a.reputation + ((t.quality ?? 80) < 40 ? -4 : (t.quality ?? 80) >= 80 ? 3 : 1),
          );
        }
      }
      s.reputation = clamp(s.reputation + ((t.quality ?? 80) < 40 ? -4 : (t.quality ?? 80) >= 80 ? 3 : 1));
    }
    log(s, `${t.title} tour ${t.status}: ${reason}. Tour net $${t.net}.`);
    hooks.each("afterTour", s, t, completed);
  }
  function cancelTour(s, id) {
    requireAction(s);
    const t = s.tours.find((t) => t.id === Number(id) && t.status === "active");
    if (!t) throw Error("No active tour.");
    endTour(s, t, "Label canceled the remaining dates");
  }
  function tourEvent(s, t, fatigue = false) {
    const r = TOUR_SCALES.find((r) => r.id === t.scale),
      a = artist(s, t.artist),
      common = { type: "tour", tour: t.id, artist: a.id };
    if (fatigue)
      return {
        ...common,
        title: "Tour fatigue · the next date is at risk",
        body: `${a.name} is running low on energy. Continuing without recovery can end the tour.`,
        options: [
          {
            label: "Add a recovery week",
            hint: `One extra calendar week, no ticket revenue, and $${t.weekly} operating cost. Artist energy +24, morale +5.`,
            tourPause: 1,
            energy: 24,
            morale: 5,
          },
          {
            label: "Push through the next shows",
            hint: "Next two show weeks: ticket income ×1.20, morale -8; 30% chance the tour ends immediately.",
            tourMult: 1.2,
            tourBoostWeeks: 2,
            morale: -8,
            cancelChance: 0.3,
          },
          {
            label: "End the tour responsibly",
            hint: "Stop future tour costs and ticket income. Artist morale +6, label reputation +1.",
            endTour: true,
            morale: 6,
            reputation: 1,
          },
        ],
      };
    if (t.mode === "rival" && !t.recruitmentOffered) {
      t.recruitmentOffered = true;
      const chance = Math.round(Math.max(25, Math.min(80, 35 + s.reputation * 0.4)));
      return {
        ...common,
        title: "Backstage offer · recruit the rival?",
        body: `${t.rival.name} is impressed by the tour. Their label is also paying attention to your artist.`,
        options: [
          {
            label: "Open a rival recruitment negotiation",
            hint: `$1,500; ${chance}% chance to add this rival to your scout list. Their normal signing advance still applies.`,
            cost: 1500,
            recruitRival: true,
            recruitChance: chance / 100,
          },
          {
            label: "Keep the partnership professional",
            hint: "Artist trust +4, label reputation +2. No recruitment move.",
            trust: 4,
            reputation: 2,
          },
          {
            label: "Let the labels compete for talent",
            hint: "Artist fame +8; 30% chance your headliner signs with the rival and this tour ends.",
            artistFame: 8,
            poachChance: 0.3,
          },
        ],
      };
    }
    if (t.mode === "rival") {
      return {
        ...common,
        title: "Rival label · a private offer",
        body: `The rival label wants ${a.name}. Your response could change who finishes this tour.`,
        options: [
          {
            label: "Pay a loyalty bonus",
            hint: "$1,500; morale +10, trust +6. The artist stays.",
            cost: 1500,
            morale: 10,
            trust: 6,
          },
          {
            label: "Promise more creative ownership",
            hint: "Morale +8, trust +8; minimum royalties on current and future deals rise 3 percentage points (maximum 30%).",
            morale: 8,
            trust: 8,
            royaltyIncrease: 0.03,
          },
          {
            label: "Respect their decision",
            hint: "35% chance the artist leaves for the rival and the tour ends. Otherwise morale +6.",
            morale: 6,
            poachChance: 0.35,
          },
        ],
      };
    }
    const fee = t.scale === "world" ? 4000 : t.scale === "national" ? 1800 : 600;
    return {
      ...common,
      title:
        t.mode === "labelmate"
          ? "Tour checkpoint · two voices, one stage"
          : "Tour checkpoint · a difficult booking",
      body:
        t.mode === "labelmate"
          ? `${a.name} and ${t.partnerName} need to agree on the next leg of the ${r.name.toLowerCase()} tour.`
          : `A routing problem threatens the next leg of ${a.name}’s ${r.name.toLowerCase()} tour.`,
      options: [
        {
          label: "Invest in the next leg",
          hint: `$${fee}; next 3 show weeks earn ×1.20, morale +4.`,
          cost: fee,
          tourMult: 1.2,
          tourBoostWeeks: 3,
          morale: 4,
        },
        {
          label: "Take a week to regroup",
          hint: `Add one calendar week with no ticket revenue and $${t.weekly} tour operating cost. Artist energy +24, morale +4.`,
          tourPause: 1,
          energy: 24,
          morale: 4,
        },
        {
          label: "Keep the dates without changes",
          hint: "No extra fee; morale -4, 20% chance the tour ends immediately.",
          morale: -4,
          cancelChance: 0.2,
        },
      ],
    };
  }
  function applyTourChoice(s, e, o) {
    const t = s.tours.find((t) => t.id === e.tour);
    if (!t || t.status !== "active") return;
    const a = s.artists.find((a) => a.id === t.artist);
    if (o.cost) {
      t.costs += o.cost;
      t.net = t.revenue - t.costs;
      t.history.push({
        week: s.week,
        show: t.showDays ?? t.elapsed,
        day: t.day,
        totalCosts: t.costs,
        revenue: 0,
        cost: o.cost,
        net: t.net,
        event: true,
      });
    }
    if (o.tourPause) t.pause += o.tourPause;
    if (o.tourMult) t.effects.push({ until: t.elapsed + (o.tourBoostWeeks || 2), mult: o.tourMult });
    if (o.royaltyIncrease && a) {
      a.contract.royalty = Math.min(0.3, a.contract.royalty + o.royaltyIncrease);
      a.royaltyFloor = a.contract.royalty;
    }
    if (o.recruitRival) {
      if (rng(s) < o.recruitChance) {
        if (
          !s.candidates.some((a) => a.sourceRivalId === t.rival.id) &&
          !s.artists.some((a) => a.sourceRivalId === t.rival.id)
        ) {
          const rival = { ...t.rival, id: s.nextId++, sourceRivalId: t.rival.id, morale: 75 };
          delete rival.contract;
          s.candidates.push(rival);
          log(s, `${rival.name} is available to sign from the artist scout list.`);
        }
      } else log(s, `${t.rival.name} declined recruitment and remains with their label.`);
    }
    if (o.poachChance && rng(s) < o.poachChance) {
      endTour(s, t, "Headliner joined the rival label");
      s.artists = s.artists.filter((x) => x.id !== t.artist);
      s.reputation = clamp(s.reputation - 5);
      log(s, `${t.artistName} joined a rival. Existing catalog income and royalties continue.`);
      return;
    }
    if (o.endTour) endTour(s, t, "The label protected artist wellbeing");
    else if (o.cancelChance && rng(s) < o.cancelChance) {
      if (a) a.morale = clamp(a.morale - 8);
      s.reputation = clamp(s.reputation - 3);
      endTour(s, t, "An avoidable disruption canceled the remaining shows");
    }
  }
  // Labels no longer stop after year one; loading an older save resumes it (campaign system).
  // These remain for labels still marked finished at the old year-one checkpoint.
  function canContinueCareer(s) {
    return !s.company && s.finished && s.cash >= 0 && s.week >= 53 && !api.campaignOver?.(s);
  }
  function continueCareer(s) {
    if (!canContinueCareer(s)) throw Error("Complete the first year with cash remaining to continue.");
    s.finished = false;
    s.careerMode = true;
    s.outcome = null;
    log(s, "Year-one results recorded. The label continues with existing albums, contracts and tours.");
  }
  function validRoadSave(s) {
    return (
      Array.isArray(s.tours) &&
      Array.isArray(s.rivalArtists) &&
      s.artists.every((a) => Number.isFinite(a.morale) && a.morale >= 0 && a.morale <= 100) &&
      s.albums.every(
        (p) =>
          Array.isArray(p.addOns) &&
          p.addOns.every((id) => ALBUM_ADDONS.some((a) => a.id === id)) &&
          Number.isFinite(p.baseBudget) &&
          p.expectation &&
          typeof p.expectation.assessed === "boolean",
      ) &&
      s.tours.every(
        (t) =>
          Number.isInteger(t.id) &&
          Array.isArray(t.artists) &&
          Array.isArray(t.history) &&
          Array.isArray(t.effects) &&
          TOUR_SCALES.some((r) => r.id === t.scale) &&
          TOUR_MODES.some((m) => m.id === t.mode) &&
          Number.isFinite(t.net) &&
          Number.isFinite(t.revenue) &&
          Number.isFinite(t.costs) &&
          Number.isInteger(t.elapsed) &&
          t.elapsed >= 0 &&
          t.elapsed <= t.duration &&
          ["active", "completed", "ended early"].includes(t.status),
      )
    );
  }

  function operatingYear(week) {
    return 1 + Math.floor((week - 1) / 52);
  }
  function careerTier(a) {
    const score = a.fans + (a.fame || 0) * 3 + (a.career?.releases || 0) * 15 + (a.career?.awards || 0) * 60;
    return score >= 1000 ? 4 : score >= 600 ? 3 : score >= 300 ? 2 : score >= 120 ? 1 : 0;
  }
  function initializeCompanies(s) {
    s.rivalCompanies ??= [
      {
        id: "goldline",
        name: "Goldline Records",
        ceo: "Marlowe Sterling",
        strategy: "Commercial hits and aggressive promotion",
        relationship: 0,
      },
      {
        id: "northstar",
        name: "Northstar Music",
        ceo: "Arden Cross",
        strategy: "Prestige recordings and artist development",
        relationship: 0,
      },
      {
        id: "harbor",
        name: "Blue Harbor",
        ceo: "Imani Shaw",
        strategy: "Community, trust and regional audiences",
        relationship: 0,
      },
      {
        id: "redwood",
        name: "Redwood Sound",
        ceo: "Rowan Holt",
        strategy: "Live performance and touring partnerships",
        relationship: 0,
      },
      {
        id: "meridian",
        name: "Meridian Group",
        ceo: "Dana Vale",
        strategy: "Distribution and audience crossover",
        relationship: 0,
      },
      {
        id: "halcyon",
        name: "Halcyon House",
        ceo: "Morgan Saint",
        strategy: "Catalog longevity and licensing",
        relationship: 0,
      },
    ];
    s.industryListings ??= [];
    s.rivalArchive ??= {};
    s.awardPrograms ??= {};
    s.financeHistory ??= [];
    s.tourDayInWeek ??= 0;
    s.ceoEventBag ??= [];
  }
  function publishRival(s, r) {
    s.industryListings.unshift({
      id: r.id,
      week: r.releaseWeek,
      year: r.year,
      company: r.label,
      companyId: r.companyId,
      title: r.title,
      artist: r.artistName,
      genre: r.genre,
      quality: r.quality,
      units: r.baseUnits,
    });
    s.industryListings = s.industryListings.slice(0, 120);
  }
  function initializeIndustry(s) {
    for (const a of [
      ...s.artists,
      ...s.candidates,
      ...s.rivalArtists,
      ...s.tours.map((t) => t.rival).filter(Boolean),
    ]) {
      a.inspiration ??= 60;
      a.momentum ??= 25;
      a.career ??= {
        releases: s.albums.filter((p) => p.released && p.artist === a.id).length,
        awards: 0,
        albumRevenue: s.albums.filter((p) => p.artist === a.id).reduce((n, p) => n + p.total, 0),
        showDays: 0,
      };
    }
    for (const p of s.albums) {
      p.distributionFees ??= 0;
      p.economyVersion ??= 4;
      p.releaseYear ??= p.released ? operatingYear(p.releaseWeek) : null;
    }
    for (const t of s.tours) {
      if (t.dailyRevision) continue;
      t.day = (t.elapsed || 0) * 7;
      t.plannedDays = t.duration * 7;
      t.baseDays = t.duration * 7;
      t.showDays = t.day;
      t.restDays = (t.pause || 0) * 7;
      t.quality = 80;
      t.dailyRevision = 5;
      t.effects = t.effects.map((e) => ({ ...e, untilDay: e.until * 7 }));
    }
    if (s.charts.version !== 5) {
      for (const r of s.charts.rivals) {
        r.companyId ??= s.rivalCompanies[0].id;
        r.releaseWeek ??= Math.max(1, s.week - r.age);
        r.year ??= operatingYear(r.releaseWeek);
        r.quality ??= 65 + Math.floor(rng(s) * 30);
        s.rivalArchive[r.id] ??= { ...r, best: null };
      }
      while (s.charts.rivals.length < 320) s.charts.rivals.push(rivalAlbum(s, true));
      s.charts.version = 5;
      updateCharts(s, false);
      if (!s.industryListings.length)
        for (const r of s.charts.rivals.toSorted((a, b) => b.releaseWeek - a.releaseWeek).slice(0, 24))
          publishRival(s, r);
    }
    const y = operatingYear(s.week);
    s.awardPrograms[y] ??= { year: y, entries: {}, results: null };
    s.industryRevision = 5;
    const refresh = (e) => {
      if (!e || e.type !== "tourDay" || e.timingRevision >= 7) return e;
      const t = s.tours.find((t) => t.id === e.tour && t.status === "active");
      if (!t) return e;
      if (e.options.some((o) => o.recruitRival || o.poachChance)) return { ...e, timingRevision: 7 };
      const last = t.history.filter((h) => !h.event).at(-1);
      return tourDailyEvent(s, t, !!last?.rest);
    };
    s.event = refresh(s.event);
    s.eventQueue = s.eventQueue.map(refresh);
    s.tourTimingRevision = 7;
    if (!s.tourCadence) {
      s.tourCadence = {
        revision: 8,
        week: s.week,
        count: [s.event, ...s.eventQueue].filter((e) => e?.type === "tourDay").length,
      };
    }
    for (const t of s.tours) {
      t.nextInteractionDay ??= t.day + 1;
      t.lastInteractionAt ??= 0;
    }
    const cadence = (e) => {
      if (!e || e.type !== "tourDay" || e.cadenceRevision === 8) return e;
      const t = s.tours.find((t) => t.id === e.tour);
      return t ? describeTourCadence(s, t, e) : e;
    };
    s.event = cadence(s.event);
    s.eventQueue = s.eventQueue.map(cadence);
    return s;
  }
  function grossAlbumSales(s, p, a) {
    const fans = a ? a.fans : p.launchFans,
      trust = a ? a.trust : p.launchTrust,
      attention = a ? a.attention : p.launchAttention;
    const boost = Math.min(
      1.8,
      p.boosts.filter((b) => b.start <= s.week && b.until >= s.week).reduce((n, b) => n * b.mult, 1),
    );
    const marketing = hasRole(s, "Marketing") ? 1.1 + roleSkill(s, "Marketing") / 400 : 1;
    if (p.economyVersion < 5)
      return Math.round(
        (p.quality * 20 + fans * 12) *
          (p.launchMultiplier || 1) *
          (p.trending ? 1.2 : 1) *
          marketing *
          (0.55 + trust / 180) *
          (1 + attention / 180) *
          Math.pow(0.85, p.age) *
          boost *
          hooks.product("salesMultiplier", s, p, a),
      );
    const momentum = a?.momentum ?? 25,
      rep = a?.reputation ?? 65;
    return Math.round(
      (p.quality * 19 + fans * 14) *
        (p.launchMultiplier || 1) *
        (p.trending ? 1.15 : 1) *
        marketing *
        (0.6 + trust / 200) *
        (0.9 + rep / 500) *
        (0.8 + momentum / 250) *
        (1 + attention / 200) *
        Math.pow(0.88, p.age) *
        (p.freshness || 1) *
        boost *
        hooks.product("salesMultiplier", s, p, a),
    );
  }
  function projectedDebut(s, p) {
    const units = Math.max(
        1,
        Math.round(
          grossAlbumSales(
            s,
            p,
            s.artists.find((a) => a.id === p.artist),
          ) / 8,
        ),
      ),
      owned = (s.charts.previewEntries || s.charts.entries).filter((e) => e.owned && e.id !== p.id);
    const all = [
      ...s.charts.rivals.map((r) => ({ ...r, owned: false })),
      ...owned,
      {
        id: p.id,
        title: p.title,
        artistName: p.artistName,
        label: api.labelName(s),
        genre: p.genre,
        units,
        owned: true,
        projected: true,
      },
    ];
    all.sort((a, b) => b.units - a.units || String(a.id).localeCompare(String(b.id)));
    all.forEach((e, i) => (e.rank = i + 1));
    p.chart.projectedRank = all.find((e) => e.id === p.id).rank;
    s.charts.previewEntries = all.slice(0, 300);
    log(
      s,
      `${p.title}: provisional Top 300 debut ${p.chart.projectedRank <= 300 ? "#" + p.chart.projectedRank : "outside Top 300"}. Official sales settle at week end.`,
    );
  }
  function makeCEOEvent(s) {
    const a = s.artists[Math.floor(rng(s) * s.artists.length)];
    if (!a) return null;
    const c = s.rivalCompanies[Math.floor(rng(s) * s.rivalCompanies.length)];
    if (!s.ceoEventBag.length) {
      s.ceoEventBag = [0, 1, 2, 3, 4, 5, 6, 7];
      for (let i = 7; i > 0; i--) {
        const j = Math.floor(rng(s) * (i + 1));
        [s.ceoEventBag[i], s.ceoEventBag[j]] = [s.ceoEventBag[j], s.ceoEventBag[i]];
      }
    }
    const type = s.ceoEventBag.pop(),
      common = { type: "ceo", company: c.id, artist: a.id };
    const scenarios = [
      {
        title: "CEO proposal · a joint compilation",
        body: `${c.ceo} of ${c.name} proposes a compilation featuring ${a.name}.`,
        options: [
          {
            label: "Share the spotlight",
            hint: "$2,000; active albums ×1.15 for 4 weeks, artist fame +4, label reputation +5, relationship +8.",
            cost: 2000,
            albumBoost: 1.15,
            boostWeeks: 4,
            artistFame: 4,
            reputation: 5,
            relationship: 8,
          },
          {
            label: "Negotiate a small guest feature",
            hint: "$600; fans +4, artist momentum +5, relationship +3.",
            cost: 600,
            fans: 4,
            artistMomentum: 5,
            relationship: 3,
          },
          {
            label: "Keep the release independent",
            hint: "Artist trust +4; relationship -2.",
            trust: 4,
            relationship: -2,
          },
        ],
      },
      {
        title: "CEO pressure · a more expensive next contract",
        body: `${c.name} publicly values ${a.name} more highly. The artist wants to know how you value their career.`,
        options: [
          {
            label: "Pay a loyalty bonus",
            hint: "$1,500; morale +10, trust +6, artist reputation +3.",
            cost: 1500,
            morale: 10,
            trust: 6,
            artistReputation: 3,
          },
          {
            label: "Offer more creative ownership",
            hint: "Trust +8, morale +6; minimum royalties on current and future deals rise 2 percentage points, maximum 30%.",
            trust: 8,
            morale: 6,
            royaltyIncrease: 0.02,
          },
          {
            label: "Reject the bidding war",
            hint: "Trust -6, morale -5; label reputation +2, rival relationship -5.",
            trust: -6,
            morale: -5,
            reputation: 2,
            relationship: -5,
          },
        ],
      },
      {
        title: "CEO invitation · an industry policy debate",
        body: `${c.ceo} invites your label to take a public position on exclusive release windows.`,
        options: [
          {
            label: "Argue for open access",
            hint: "$500; label reputation +7, artist trust +5; active album sales ×1.08 for 3 weeks.",
            cost: 500,
            reputation: 7,
            trust: 5,
            albumBoost: 1.08,
            boostWeeks: 3,
          },
          {
            label: "Accept an exclusive launch sponsor",
            hint: "Cash +$2,500; artist trust -5, label reputation -4, rival relationship +6.",
            cash: 2500,
            trust: -5,
            reputation: -4,
            relationship: 6,
          },
          {
            label: "Let the artists speak individually",
            hint: "Artist reputation +4, morale +4; no label cash effect.",
            artistReputation: 4,
            morale: 4,
          },
        ],
      },
      {
        title: "CEO offer · distribution muscle",
        body: `${c.name} offers a larger distribution channel for ${a.name}’s active albums, with a revenue concession.`,
        options: [
          {
            label: "Accept the distribution deal",
            hint: "Active albums ×1.35 for 4 weeks; those albums pay an extra 4% distribution fee for the remainder of their run. Relationship +7.",
            albumBoost: 1.35,
            boostWeeks: 4,
            distributionFee: 0.04,
            relationship: 7,
          },
          {
            label: "Pay for a short placement",
            hint: "$1,200; active albums ×1.20 for 3 weeks; no permanent concession.",
            cost: 1200,
            albumBoost: 1.2,
            boostWeeks: 3,
          },
          {
            label: "Build your own network",
            hint: "Label reputation +3; rival relationship -2.",
            reputation: 3,
            relationship: -2,
          },
        ],
      },
      {
        title: "CEO invitation · a shared festival",
        body: `${c.ceo} has an opening at a ${c.name} festival and introduces new live audiences.`,
        options: [
          {
            label: "Put the artist on the bill",
            hint: "$1,000; fans +10, fame +5, energy -10, relationship +5.",
            cost: 1000,
            fans: 10,
            artistFame: 5,
            energy: -10,
            relationship: 5,
          },
          {
            label: "Send a development representative",
            hint: "$500; artist momentum +4, relationship +4, and one new regional scouting prospect.",
            cost: 500,
            artistMomentum: 4,
            relationship: 4,
            recruitLead: true,
          },
          {
            label: "Protect the production schedule",
            hint: "Artist energy +10, morale +3.",
            energy: 10,
            morale: 3,
          },
        ],
      },
      {
        title: "CEO dispute · a public chart comparison",
        body: `${c.ceo} compares ${a.name} with a rival act and asks for a response.`,
        options: [
          {
            label: "Buy a chart-duel campaign",
            hint: "$1,400; active albums ×1.30 for 2 weeks, attention +18, label reputation -4.",
            cost: 1400,
            albumBoost: 1.3,
            boostWeeks: 2,
            attention: 18,
            reputation: -4,
          },
          {
            label: "Turn rivalry into collaboration",
            hint: "$900; fans +5, relationship +8. In 3 weeks: trust +5, reputation +3.",
            cost: 900,
            fans: 5,
            relationship: 8,
            delay: {
              after: 3,
              trust: 5,
              reputation: 3,
              text: "A rival collaboration builds lasting audience connections.",
            },
          },
          {
            label: "Respond with a live performance",
            hint: "Energy -12, artist momentum +7, artist reputation +5.",
            energy: -12,
            artistMomentum: 7,
            artistReputation: 5,
          },
        ],
      },
      {
        title: "CEO proposal · a catalog licensing deal",
        body: `${c.name} wants to license a short catalog sampler.`,
        options: [
          {
            label: "License the sampler",
            hint: "Cash +$2,200; label reputation -2, artist trust -3, relationship +4.",
            cash: 2200,
            reputation: -2,
            trust: -3,
            relationship: 4,
          },
          {
            label: "Require artist approval",
            hint: "Cash +$900; artist trust +5, relationship +3.",
            cash: 900,
            trust: 5,
            relationship: 3,
          },
          {
            label: "Decline and preserve the catalog",
            hint: "Artist reputation +4, label reputation +3.",
            artistReputation: 4,
            reputation: 3,
          },
        ],
      },
      {
        title: "CEO exchange · production talent",
        body: `${c.ceo} offers an introduction to an experienced producer, in exchange for an industry favor.`,
        options: [
          {
            label: "Fund the introduction",
            hint: "$1,500; one executive-level Producer candidate joins that role’s recruitment pool; relationship +6. Hiring fee is separate.",
            cost: 1500,
            staffLead: true,
            relationship: 6,
          },
          {
            label: "Exchange development workshops",
            hint: "$700; artist momentum +5, morale +5, relationship +4.",
            cost: 700,
            artistMomentum: 5,
            morale: 5,
            relationship: 4,
          },
          {
            label: "Keep building internally",
            hint: "Artist trust +3, label reputation +2.",
            trust: 3,
            reputation: 2,
          },
        ],
      },
    ];
    return { ...scenarios[type], ...common, scenario: type };
  }
  function applyCEOChoice(s, e, o) {
    const c = s.rivalCompanies.find((c) => c.id === e.company),
      a = s.artists.find((a) => a.id === e.artist);
    if (c && o.relationship) c.relationship = clamp(c.relationship + o.relationship, -100, 100);
    if (a && o.royaltyIncrease) {
      a.contract.royalty = Math.min(0.3, a.contract.royalty + o.royaltyIncrease);
      a.royaltyFloor = a.contract.royalty;
    }
    for (const p of s.albums.filter((p) => p.released && p.artist === e.artist && p.age < p.salesWeeks)) {
      if (o.albumBoost)
        p.boosts.push({ start: s.week + 1, until: s.week + (o.boostWeeks || 3), mult: o.albumBoost });
      if (o.distributionFee)
        p.extraDistribution = Math.min(0.12, (p.extraDistribution || 0) + o.distributionFee);
    }
    if (o.recruitLead) s.candidates.push(prospect(s, 1));
    if (o.staffLead) s.staffCandidates.Producer.push(staffProspect(s, "Producer", 2));
  }
  function awardEligible(s, year, genre) {
    return s.albums.filter(
      (p) => p.released && p.genre === genre && operatingYear(p.releaseWeek) === Number(year),
    );
  }
  /**
   * How strong an album's awards entry is, without the jury's variation: the same weights the judges
   * use (quality 60%, critics 20%, fan response 10%, Top 300 achievement 10%).
   */
  function awardStrength(p) {
    const critics = p.launchRatings?.find((r) => r.name === "Critics")?.score ?? p.quality,
      fans = p.launchRatings?.find((r) => r.name === "Fan response")?.score ?? p.quality,
      peak = p.chart?.best,
      chart = peak ? Math.max(0, 100 * (1 - (Math.min(300, peak) - 1) / 299)) : 0;
    return Math.round((p.quality * 0.6 + critics * 0.2 + fans * 0.1 + chart * 0.1) * 10) / 10;
  }
  /**
   * CEO runs enter the awards automatically (owner decision 2026-11-26): each genre's entry is the
   * year's eligible album with the highest strength, the earlier release on a tie.
   */
  function autoEnterAwards(s, year = operatingYear(s.week)) {
    if (!s.company) return;
    const program = (s.awardPrograms[year] ??= { year, entries: {}, results: null });
    if (program.results) return;
    for (const genre of GENRES) {
      const best = awardEligible(s, year, genre).reduce(
        (m, p) =>
          !m ||
          awardStrength(p) > awardStrength(m) ||
          (awardStrength(p) === awardStrength(m) && p.releaseWeek < m.releaseWeek)
            ? p
            : m,
        null,
      );
      if (best) program.entries[genre] = best.id;
      else delete program.entries[genre];
    }
  }
  function enterAwards(s, year, genre, albumId) {
    requireAction(s);
    if (s.company)
      throw Error("Entries are made automatically: the strongest album of the year in each genre.");
    year = Number(year);
    if (year !== operatingYear(s.week) || !GENRES.includes(genre))
      throw Error("Submissions are limited to this operating year and a valid genre.");
    const program = s.awardPrograms[year];
    if (!program || program.results) throw Error("This awards program is closed.");
    if (!albumId) {
      delete program.entries[genre];
      return;
    }
    const p = awardEligible(s, year, genre).find((p) => p.id === Number(albumId));
    if (!p)
      throw Error("Only an album completed and released in this operating year may enter its own genre.");
    program.entries[genre] = p.id;
    log(s, `${p.title} entered Year ${year} ${genre} Album of the Year.`);
  }
  function awardScore(s, p, owned) {
    const quality = p.quality,
      critics = owned
        ? (p.launchRatings?.find((r) => r.name === "Critics")?.score ?? quality)
        : clamp(quality + 2),
      fans = owned
        ? (p.launchRatings?.find((r) => r.name === "Fan response")?.score ?? quality)
        : clamp(quality - 3),
      peak = owned ? p.chart?.best : p.best;
    const chart = peak ? Math.max(0, 100 * (1 - (Math.min(300, peak) - 1) / 299)) : 0;
    const parts = [
      { name: "Album quality · 60%", value: Math.round(quality * 0.6) },
      { name: "Critics · 20%", value: Math.round(critics * 0.2) },
      { name: "Fan response · 10%", value: Math.round(fans * 0.1) },
      { name: "Top 300 achievement · 10%", value: Math.round(chart * 0.1) },
      { name: "Jury variation", value: Math.floor(rng(s) * 13) - 6 },
    ];
    return { parts, score: clamp(parts.reduce((n, p) => n + p.value, 0)) };
  }
  function resolveAnnualAwards(s, year) {
    const program = (s.awardPrograms[year] ??= { year, entries: {}, results: null });
    if (program.results) return;
    autoEnterAwards(s, year);
    program.results = [];
    for (const genre of GENRES) {
      const pool = Object.values(s.rivalArchive)
        .filter((p) => p.genre === genre && p.year === year)
        .toSorted((a, b) => b.quality - a.quality)
        .slice(0, 4);
      const entries = pool.map((p) => ({
        id: p.id,
        title: p.title,
        artist: p.artistName,
        label: p.label,
        owned: false,
        ...awardScore(s, p, false),
      }));
      const p = s.albums.find(
        (p) =>
          p.id === program.entries[genre] &&
          p.released &&
          p.genre === genre &&
          operatingYear(p.releaseWeek) === year,
      );
      if (p)
        entries.push({
          id: p.id,
          title: p.title,
          artist: p.artistName,
          label: api.labelName(s),
          owned: true,
          ...awardScore(s, p, true),
        });
      entries.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
      const winner = entries[0] || null;
      program.results.push({ genre, entries, winner: winner?.id || null });
      if (winner?.owned) {
        s.awards++;
        s.cash += 8000;
        s.fame += 20;
        const a = s.artists.find((a) => a.id === p.artist);
        if (a) {
          a.fame = clamp(a.fame + 6);
          a.morale = clamp(a.morale + 10);
          a.reputation = clamp(a.reputation + 4);
          a.career.awards++;
        }
        log(
          s,
          `Year ${year} Silver Groove Awards: ${p.title} wins ${genre} Album of the Year! $8,000 prize.`,
        );
      } else if (p) {
        s.fame += 2;
        const a = s.artists.find((a) => a.id === p.artist);
        if (a) a.morale = clamp(a.morale + 2);
        log(s, `Year ${year} ${genre}: ${p.title} nominated; ${winner?.title || "no album"} wins.`);
      }
    }
    s.eventQueue.push({
      type: "awards",
      year,
      artist: null,
      title: `Year ${year} · Silver Groove Awards ceremony`,
      body: `Genre winners have been decided from eligible operating-year releases. Visit the trophy case ${s.company ? "on the street" : "in the lobby"} to inspect nominees, scores and results. Attendance does not change the judging.`,
      options: [
        {
          label: "Attend the industry ceremony",
          hint: "$1,200; label reputation +3.",
          cost: 1200,
          reputation: 3,
        },
        {
          label: "Host a label watch party",
          hint: "$500; all signed artists gain morale +4.",
          cost: 500,
          rosterMorale: 4,
        },
        {
          label: "Accept the results remotely",
          hint: "No cost. Keep the year’s awards and prizes.",
          reputation: 0,
        },
      ],
    });
    log(s, `Year ${year} annual awards results published. Next operating year begins.`);
  }
  // The run ends once the campaign reports its last year done and every pending event is resolved.
  // Year one's Breakout Label target is now the campaign's first yearly goal.
  /**
   * Keeps long careers small enough for browser storage. Albums whose earning run ended more
   * than a year ago keep their stage scores and ratings but drop the calculation rows; rival
   * albums are archived only while they can still matter (this year, last year, or charting);
   * award results older than three years keep scores without rows.
   */
  function compactHistory(s) {
    const year = operatingYear(s.week);
    for (const p of s.albums) {
      if (!p.released || p.launchReview || p.age < p.salesWeeks) continue;
      if (operatingYear(p.releaseWeek) >= year - 1) continue;
      if (p.production) {
        p.stageScores = p.production.results.map((r) => ({ area: r.area, choice: r.choice, score: r.score }));
        delete p.production;
      }
      if (p.launchRatings?.some((r) => r.parts))
        p.launchRatings = p.launchRatings.map((r) => ({ name: r.name, score: r.score }));
      if (p.chart?.history?.length > 26) p.chart.history = p.chart.history.slice(-26);
    }
    if (s.charts?.history)
      for (const h of s.charts.history) h.entries = h.entries.filter((e) => e.rank <= 40 || e.owned);
    const charting = new Set((s.charts?.rivals || []).map((r) => r.id));
    for (const [id, r] of Object.entries(s.rivalArchive || {}))
      if (r.year < year - 1 && !charting.has(id)) delete s.rivalArchive[id];
    for (const program of Object.values(s.awardPrograms || {}))
      if (program.year < year - 3)
        for (const r of program.results || []) for (const e of r.entries) if (e.parts?.length) e.parts = [];
    return s;
  }
  function finalizeRun(s) {
    if (s.finished || s.event || s.eventQueue.length) return;
    const outcome = api.campaignOutcome?.(s);
    if (!outcome) return;
    s.finished = true;
    s.bankrupt = false;
    s.outcome = outcome;
  }

  function tourInteractionBudget(s) {
    if (!s.tourCadence || s.tourCadence.week !== s.week)
      s.tourCadence = { revision: 8, week: s.week, count: 0 };
    return s.tourCadence;
  }
  function tourChoiceGap(t, o) {
    return o.restDays
      ? o.restDays + 1
      : o.tourPause
        ? o.tourPause * 7 + 1
        : o.tourMult
          ? Math.max(2, (o.tourBoostDays || 7 * (o.tourBoostWeeks || 2)) + (t.restDays || 0))
          : o.lengthDelta > 0
            ? 4
            : o.lengthDelta < 0 || o.cancelChance
              ? 2
              : 3;
  }
  function scheduleTourReview(s, t, o) {
    const gap = tourChoiceGap(t, o);
    t.nextInteractionDay = Math.min(t.plannedDays, t.day + gap);
    t.reviewAfterShow = o.tourMult ? t.showDays + (o.tourBoostDays || 7 * (o.tourBoostWeeks || 2)) : null;
    t.lastInteractionAt = s.week * 7 + s.tourDayInWeek;
    t.lastDecisionSpan = gap;
  }
  /** A length of tour time in weeks and odd days: "4 weeks 2 days". */
  function dur(days) {
    const w = Math.floor(days / 7),
      d = days % 7;
    return (
      [w && `${w} week${w === 1 ? "" : "s"}`, d && `${d} day${d === 1 ? "" : "s"}`]
        .filter(Boolean)
        .join(" ") || "0 days"
    );
  }
  function advanceTourToNextActivity(s) {
    requireAction(s);
    const week = s.week;
    let days = 0;
    do {
      advanceTourDay(s);
      days++;
    } while (
      days < 7 &&
      s.week === week &&
      !s.event &&
      !s.finished &&
      !productionBlock(s) &&
      s.tours.some((t) => t.status === "active")
    );
    return s;
  }
  function describeTourCadence(s, t, event) {
    return {
      ...event,
      cadenceRevision: 8,
      body: event.body.replace(
        "Your choice affects what happens next; another interaction follows the next calendar day.",
        "Your choice sets the next review date; there are at most three tour decisions per label week across all tours.",
      ),
      options: event.options.map((o) => {
        const gap = tourChoiceGap(t, o),
          next = Math.min(t.plannedDays + (o.lengthDelta || 0), t.day + gap);
        return {
          ...o,
          hint:
            o.hint +
            (t.day >= t.plannedDays
              ? ""
              : ` Next review: tour day ${next}, after this plan runs (weekly cap may defer it).`),
        };
      }),
    };
  }
  function tourDailyEvent(s, t, rest = false) {
    const a = artist(s, t.artist),
      fee = Math.max(100, Math.round(t.weekly / 14)),
      common = { type: "tourDay", tour: t.id, artist: a.id, day: t.day, timingRevision: 7 };
    const O = (label, hint, effects = {}) => ({ label, hint, ...effects });
    const recovery = O(
      "Schedule two recovery days",
      "Two non-show days begin on the next advance; each touring label artist gains 9 energy on each day (+18 total). Morale +5 and quality +5 now; normal daily operations continue.",
      { lengthDelta: 2, restDays: 2, recoveryEnergy: 18, morale: 5, qualityDelta: 5 },
    );
    const show = [
      {
        id: "routing",
        title: "A storm disrupts the route",
        body: "The next venue is reachable, but the scenic route is slower.",
        options: [
          O(
            "Charter reliable transport",
            `$${fee * 2}; quality +5; ticket receipts ×1.10 for the next 2 show days.`,
            { cost: fee * 2, qualityDelta: 5, tourMult: 1.1, tourBoostDays: 2 },
          ),
          O(
            "Reroute through two extra towns",
            "Add 2 performing days; quality -4, morale +3. Daily operating costs continue.",
            { lengthDelta: 2, qualityDelta: -4, morale: 3 },
          ),
          O(
            "Use the planned buffer time",
            "Keep the same dates without a fee; quality -2 and energy -2. No cancellation risk.",
            { qualityDelta: -2, energy: -2 },
          ),
        ],
      },
      {
        id: "viral",
        title: "A performance goes viral",
        body: "A clip from the completed show is bringing new listeners to the ticket page.",
        options: [
          O(
            "Fund a live-video moment",
            `$${fee * 2}; quality +5, fame +3; next 3 show days ×1.80 ticket receipts.`,
            { cost: fee * 2, qualityDelta: 5, artistFame: 3, tourMult: 1.8, tourBoostDays: 3 },
          ),
          O(
            "Add an encore leg",
            "Add 4 performing days; quality +4, energy -5. Added days have normal operating costs.",
            { lengthDelta: 4, qualityDelta: 4, energy: -5 },
          ),
          O("Keep the set intimate", "Quality +4, fans +2, morale +3. No date change.", {
            qualityDelta: 4,
            fans: 2,
            morale: 3,
          }),
        ],
      },
      {
        id: "care",
        title: "The voice needs care",
        body: "The vocal coach recommends easing the next performances.",
        options: [
          recovery,
          O("Hire performance support", `$${fee}; energy +6 and quality +3 immediately; no date change.`, {
            cost: fee,
            energy: 6,
            qualityDelta: 3,
          }),
          O(
            "Play a lighter arrangement",
            "Energy +3, quality -3. Keep all dates without a fee or cancellation risk.",
            { energy: 3, qualityDelta: -3 },
          ),
        ],
      },
      {
        id: "interview",
        title: "A polarizing interview",
        body: "A comment made after the show is drawing attention away from the music.",
        options: [
          O(
            "Give a careful clarification",
            `$${fee}; artist reputation +4, label reputation +3; quality -1.`,
            { cost: fee, artistReputation: 4, reputation: 3, qualityDelta: -1 },
          ),
          O(
            "Amplify the argument",
            "Fame +5; next 2 show days ×2 ticket receipts, quality -10, artist and label reputation -7.",
            {
              artistFame: 5,
              tourMult: 2,
              tourBoostDays: 2,
              qualityDelta: -10,
              artistReputation: -7,
              reputation: -7,
            },
          ),
          O("Return attention to the music", "Quality +2, trust +3, morale -2. No date change.", {
            qualityDelta: 2,
            trust: 3,
            morale: -2,
          }),
        ],
      },
      {
        id: "rider",
        title: "A venue cannot meet the rider",
        body: "The next venue cannot support the full production.",
        options: [
          O("Hire replacement equipment", `$${fee * 2}; quality +6; keep the dates.`, {
            cost: fee * 2,
            qualityDelta: 6,
          }),
          O(
            "Cut two dates and regroup",
            "Remove up to 2 remaining days; energy +10, quality +5. Future costs and tickets for those days stop.",
            { lengthDelta: -2, energy: 10, qualityDelta: 5 },
          ),
          O(
            "Simplify the stage safely",
            "Keep every date without a fee; quality -4, morale -2. No cancellation risk.",
            { qualityDelta: -4, morale: -2 },
          ),
        ],
      },
      {
        id: "perfect",
        title: "The perfect night",
        body: "The audience and artist connected. Decide what carries into the next shows.",
        options: [
          O("Preserve the set", "Quality +6, morale +5, momentum +3. No schedule change.", {
            qualityDelta: 6,
            morale: 5,
            artistMomentum: 3,
          }),
          O(
            "Book a major encore",
            "Add 5 performing days; energy -6; next 3 show days ×1.50 ticket receipts.",
            { lengthDelta: 5, energy: -6, tourMult: 1.5, tourBoostDays: 3 },
          ),
          O(
            "Finish early on a high note",
            "Remove up to 3 remaining days; artist reputation +6, label reputation +4, morale +5.",
            { lengthDelta: -3, artistReputation: 6, reputation: 4, morale: 5 },
          ),
        ],
      },
      {
        id: "promoter",
        title: "A local promoter takes a gamble",
        body: "A promoter can boost the next shows, with or without extra spending.",
        options: [
          O("Buy a focused campaign", `$${fee * 2}; next 3 show days ×1.60 ticket receipts, quality +3.`, {
            cost: fee * 2,
            tourMult: 1.6,
            tourBoostDays: 3,
            qualityDelta: 3,
          }),
          O("Trade spectacle for reach", "Next 2 show days ×1.70 ticket receipts; quality -8, energy -5.", {
            tourMult: 1.7,
            tourBoostDays: 2,
            qualityDelta: -8,
            energy: -5,
          }),
          O("Protect the itinerary", "Trust +3, quality +2. No fee or schedule change.", {
            trust: 3,
            qualityDelta: 2,
          }),
        ],
      },
      {
        id: "radio",
        title: "An overnight radio invitation",
        body: "A station wants a stripped-back session before the next show.",
        options: [
          O(
            "Record a short acoustic session",
            "Energy -3, fame +2; next 2 show days ×1.15 ticket receipts.",
            { energy: -3, artistFame: 2, tourMult: 1.15, tourBoostDays: 2 },
          ),
          O("Send a recorded message", "Fans +2, trust +2. Keep the itinerary and rest time.", {
            fans: 2,
            trust: 2,
          }),
          O(
            "Turn it into a risky all-night special",
            "Energy -12; next 3 show days ×1.70 receipts; 15% chance exhaustion ends the tour now.",
            { energy: -12, tourMult: 1.7, tourBoostDays: 3, cancelChance: 0.15 },
          ),
        ],
      },
      {
        id: "crew",
        title: "The crew finds a better stage layout",
        body: "A rehearsal has revealed a simpler, more reliable production plan.",
        options: [
          O("Adopt the lean setup", "Quality +3, energy +2. No schedule or cost change.", {
            qualityDelta: 3,
            energy: 2,
          }),
          O("Rehearse the ambitious version", `$${fee}; quality +8, energy -3; no extra dates.`, {
            cost: fee,
            qualityDelta: 8,
            energy: -3,
          }),
          O("Sell the backstage story", "Fame +2; next 2 show days ×1.10 receipts; quality -1.", {
            artistFame: 2,
            tourMult: 1.1,
            tourBoostDays: 2,
            qualityDelta: -1,
          }),
        ],
      },
      {
        id: "fans",
        title: "Fans request a deep cut",
        body: "Listeners are asking for a rarely performed song at tomorrow’s show.",
        options: [
          O("Make room in the set", "Trust +4, quality +3; energy -2.", {
            trust: 4,
            qualityDelta: 3,
            energy: -2,
          }),
          O("Poll the audience", "Fans +3; next 2 show days ×1.10 receipts.", {
            fans: 3,
            tourMult: 1.1,
            tourBoostDays: 2,
          }),
          O("Keep the polished set", "Quality +2, trust -1. No schedule change.", {
            qualityDelta: 2,
            trust: -1,
          }),
        ],
      },
      {
        id: "city",
        title: "A new city requests a stop",
        body: "A nearby city can host a show, but only if the itinerary expands.",
        options: [
          O(
            "Accept two additional dates",
            "Add 2 performing days, fans +3, energy -3; normal ticket and operating rules apply.",
            { lengthDelta: 2, fans: 3, energy: -3 },
          ),
          O("Offer a future visit", "Trust +3, morale +2. No dates added.", { trust: 3, morale: 2 }),
          O(
            "Sell a remote guest appearance",
            `Receive $${fee}; quality -2, energy -2. No extra touring day.`,
            { tourCash: fee, qualityDelta: -2, energy: -2 },
          ),
        ],
      },
      {
        id: "duet",
        title:
          t.mode === "labelmate" ? "The two artists disagree on the set" : "A guest wants to join the set",
        body:
          t.mode === "labelmate"
            ? "The labelmates need a shared arrangement for tomorrow."
            : "A local performer offers a new interpretation of the headline song.",
        options: [
          O("Share the arrangement", "Quality +4, morale +3; no schedule change.", {
            qualityDelta: 4,
            morale: 3,
          }),
          O(
            "Stage an ambitious collaboration",
            `$${fee}; quality +6; next 2 show days ×1.20 ticket receipts.`,
            { cost: fee, qualityDelta: 6, tourMult: 1.2, tourBoostDays: 2 },
          ),
          O("Keep creative control", "Trust +2, morale -2; quality +1.", {
            trust: 2,
            morale: -2,
            qualityDelta: 1,
          }),
        ],
      },
    ];
    const restEvents = [
      {
        id: "rest-sleep",
        title: "A quiet recovery day",
        body: "No show was played today. The planned recovery has happened; choose how to use the remaining downtime.",
        options: [
          O("Keep the evening free", "Energy +3, morale +3 now. No more recovery days are added.", {
            energy: 3,
            morale: 3,
          }),
          O("Hold a gentle listening session", "Trust +3, quality +2. No date change.", {
            trust: 3,
            qualityDelta: 2,
          }),
          O("Share a short tour diary", "Fans +2, fame +1. No show receipts or date change.", {
            fans: 2,
            artistFame: 1,
          }),
        ],
      },
      {
        id: "rest-crew",
        title: "Crew maintenance during downtime",
        body: "The crew can prepare for the next show without booking another day.",
        options: [
          O("Run a quiet equipment check", "Quality +3; the existing itinerary stays intact.", {
            qualityDelta: 3,
          }),
          O("Pay for a specialist tune-up", `$${fee}; quality +7. No date change.`, {
            cost: fee,
            qualityDelta: 7,
          }),
          O("Give everyone the evening off", "Energy +4, morale +2. No extra dates.", {
            energy: 4,
            morale: 2,
          }),
        ],
      },
      {
        id: "rest-local",
        title: "A day away from the stage",
        body: "The artist has time to reconnect with the city while recovering.",
        options: [
          O("Take an unpublicized walk", "Morale +4, energy +2. No date change.", { morale: 4, energy: 2 }),
          O("Meet a small fan group", "Fans +3, trust +3, energy -1. No show receipts.", {
            fans: 3,
            trust: 3,
            energy: -1,
          }),
          O("Protect private recovery", "Energy +5; no schedule change or extra fee.", { energy: 5 }),
        ],
      },
    ];
    const finales = [
      {
        id: "final-thanks",
        title: "The last date is settled",
        body: "Today’s receipts and costs are final. No future ticket boosts are being sold.",
        options: [
          O("Thank the fans and close the tour", "Trust +5, morale +4; the tour completes now.", {
            trust: 5,
            morale: 4,
          }),
          O(
            "Pay a crew appreciation bonus",
            `$${fee}; quality +3, label reputation +2. The tour completes now.`,
            { cost: fee, qualityDelta: 3, reputation: 2 },
          ),
          O("Celebrate with a quiet evening", "Energy +6, morale +3; the tour completes now.", {
            energy: 6,
            morale: 3,
          }),
        ],
      },
      {
        id: "final-archive",
        title: "Choose the tour’s closing story",
        body: "The final planned day is over. Decide what the artist takes home.",
        options: [
          O(
            "Share the best performance clip",
            "Fame +3, fans +3; completes now, with no future ticket effect.",
            { artistFame: 3, fans: 3 },
          ),
          O("Publish a sincere tour diary", "Trust +5, reputation +2; completes now.", {
            trust: 5,
            reputation: 2,
          }),
          O("Keep the ending private", "Energy +6, morale +4; completes now.", { energy: 6, morale: 4 }),
        ],
      },
    ];
    let event;
    if (t.day >= t.plannedDays) event = finales[Math.floor(rng(s) * finales.length)];
    else if (rest) {
      t.restEventIndex = (t.restEventIndex ?? -1) + 1;
      event = restEvents[t.restEventIndex % restEvents.length];
    } else if (
      Math.min(...t.artists.map((id) => s.artists.find((a) => a.id === id)?.energy ?? 100)) < 30 &&
      t.day - (t.lastCareDay ?? -7) >= 7
    ) {
      t.lastCareDay = t.day;
      event = {
        id: "fatigue",
        title: "Fatigue threatens the next show",
        body: "At least one touring artist has less than 30 energy. Recovery now can prevent an early ending.",
        options: [
          recovery,
          O("Use a shorter headline set", "Energy +6, quality -5; keep the dates without a fee.", {
            energy: 6,
            qualityDelta: -5,
          }),
          O(
            "Gamble on the full performance",
            "Energy -10, quality -12; 30% chance the tour ends immediately.",
            { energy: -10, qualityDelta: -12, cancelChance: 0.3 },
          ),
        ],
      };
    } else if (t.mode === "rival" && t.day >= 7 && !t.recruitmentOffered) {
      event = { ...tourEvent(s, t), id: "rival-recruit" };
    } else {
      t.eventBag ??= [];
      t.eventBag = t.eventBag.filter((id) => show.some((e) => e.id === id));
      if (!t.eventBag.length) {
        t.eventBag = show.map((e) => e.id);
        for (let i = t.eventBag.length - 1; i > 0; i--) {
          const j = Math.floor(rng(s) * (i + 1));
          [t.eventBag[i], t.eventBag[j]] = [t.eventBag[j], t.eventBag[i]];
        }
        if (t.eventBag.at(-1) === t.eventLast)
          [t.eventBag[0], t.eventBag[t.eventBag.length - 1]] = [t.eventBag.at(-1), t.eventBag[0]];
      }
      const picked = t.eventBag.pop();
      event = show.find((e) => e.id === picked);
      t.eventLast = event.id;
    }
    const options = event.options.map((o) => {
      o = { ...o };
      if (o.lengthDelta) {
        const before = t.plannedDays,
          after = Math.max(t.day, Math.min(t.baseDays * 2, before + o.lengthDelta));
        o.lengthDelta = after - before;
        o.hint += ` Itinerary: ${dur(before)} → ${dur(after)} (${o.lengthDelta >= 0 ? "+" : ""}${o.lengthDelta} day${Math.abs(o.lengthDelta) === 1 ? "" : "s"}).`;
        if (o.restDays) {
          o.restDays = Math.max(0, o.lengthDelta);
          o.recoveryEnergy = o.restDays * 9;
          o.label = "Schedule " + o.restDays + " recovery day(s)";
          o.hint = `${o.restDays} non-show recovery day(s) start on the next advance; touring label artists recover 9 energy on each day (${o.recoveryEnergy} total). Morale +5 and quality +5 now. Daily operations continue. Itinerary: ${before} → ${after} days.`;
        }
        if (!o.lengthDelta) {
          delete o.restDays;
          delete o.recoveryEnergy;
          o.hint += " The itinerary cap prevents extra dates.";
        }
      }
      if (o.tourMult) {
        const requested = o.tourBoostDays || 7 * (o.tourBoostWeeks || 2),
          n = Math.min(
            requested,
            Math.max(0, t.plannedDays + (o.lengthDelta || 0) - t.day - t.restDays - (o.restDays || 0)),
          );
        o.tourBoostDays = n;
        o.hint = o.hint.replace(/next \d+ show days/i, "next " + n + " show day(s)");
        o.hint += ` Applies to show numbers ${t.showDays + 1}–${t.showDays + n}; recovery days do not consume the boost.`;
      }
      return o;
    });
    return describeTourCadence(s, t, {
      ...event,
      ...common,
      options,
      title: `Day ${t.day} · ${event.title}`,
      body: `${a.name}: ${event.body} Day ${t.day}/${t.plannedDays} has already settled (${rest ? "recovery, no tickets" : "show " + t.showDays}). ${t.day >= t.plannedDays ? "This closing decision completes the tour; there is no next tour interaction." : "Your choice affects what happens next; another interaction follows the next calendar day. Ticket boosts stack up to ×2.5."} Tour quality ${Math.round(t.quality)}/100.`,
    });
  }
  function advanceTourDay(s) {
    requireAction(s);
    if (productionBlock(s)) throw Error("Complete the ready album decision before moving the calendar.");
    if (s.pendingTourWeek) {
      s.pendingTourWeek = false;
      return advance(s, { fromDays: true });
    }
    const active = s.tours.filter((t) => t.status === "active");
    if (!active.length) return advance(s, { fromDays: true });
    s.tourDayInWeek++;
    for (const t of active) {
      const r = TOUR_SCALES.find((r) => r.id === t.scale),
        m = TOUR_MODES.find((m) => m.id === t.mode),
        before = t.net;
      const cost = Math.ceil(t.weekly / 7);
      s.cash -= cost;
      t.costs += cost;
      t.day++;
      let revenue = 0,
        rest = false,
        dailyCost = cost;
      if (t.restDays > 0) {
        t.restDays--;
        rest = true;
        const recovery = t.recoveryQueue?.[0];
        for (const id of t.artists) {
          const a = s.artists.find((a) => a.id === id);
          if (a) a.energy = clamp(a.energy + (recovery ? recovery.energy : 4));
        }
        if (recovery && --recovery.days <= 0) t.recoveryQueue.shift();
      } else {
        t.showDays++;
        t.effects = t.effects.filter((e) => (e.untilDay ?? e.until * 7) >= t.showDays);
        const boost = Math.min(
          2.5,
          t.effects.reduce((n, e) => n * e.mult, 1),
        );
        revenue = tourTicketRevenue(r, m, t.demand, t.quality, t.showDays, boost, 0.9 + rng(s) * 0.2);
        if (s.company) {
          // The tour manager's lift; the forecast reads it from the tour.
          t.teamGate = hooks.product("tourGate", s, t);
          revenue = Math.round(revenue * t.teamGate);
        }
        const venueFee = Math.round(revenue * 0.15);
        s.cash += revenue - venueFee;
        t.revenue += revenue;
        t.costs += venueFee;
        dailyCost += venueFee;
        for (const id of t.artists) {
          const a = s.artists.find((a) => a.id === id);
          if (!a) continue;
          a.energy = clamp(a.energy - (m.drain / 7) * (s.company ? hooks.product("tourDrain", s, t, a) : 1));
          a.fame = clamp(a.fame + (t.mode === "solo" ? 3 : 2) / 7);
          a.fans = clamp(a.fans + (t.mode === "solo" ? 4 : 2) / 7, 0, 1000);
          a.morale = clamp(a.morale + 0.12);
          a.career.showDays++;
          if (t.showDays % (t.mode === "solo" ? 7 : 14) === 0) a.xp++;
          if (t.mode === "solo" && t.showDays % 14 === 0)
            a.talent = Math.min(trainingInfo(s, a).cap, a.talent + 1);
        }
      }
      t.elapsed = Math.min(t.duration, Math.floor(t.showDays / 7));
      t.net = t.revenue - t.costs;
      t.history.push({
        week: s.week,
        day: t.day,
        calendarDay: s.tourDayInWeek,
        show: t.showDays,
        revenue,
        cost: dailyCost,
        totalCosts: t.costs,
        net: t.net,
        rest,
        quality: t.quality,
      });
      checkTourProfit(s, t);
      t.lastDayRest = rest;
      const energy = Math.min(...t.artists.map((id) => s.artists.find((a) => a.id === id)?.energy ?? 0));
      if (energy <= 2) endTour(s, t, "Exhaustion forced cancellation during the settled day");
    }
    const budget = tourInteractionBudget(s),
      due = active
        .filter(
          (t) =>
            t.status === "active" &&
            (t.day >= t.plannedDays ||
              (t.day >= (t.nextInteractionDay ?? 1) &&
                (!t.reviewAfterShow || t.showDays >= t.reviewAfterShow))),
        )
        .sort(
          (a, b) =>
            Number(b.day >= b.plannedDays) - Number(a.day >= a.plannedDays) ||
            (a.lastInteractionAt ?? 0) - (b.lastInteractionAt ?? 0),
        );
    if (budget.count < 3 && due.length) {
      const t = due[0];
      budget.count++;
      t.awaitingDayEvent = true;
      s.eventQueue.push(tourDailyEvent(s, t, t.lastDayRest));
    }
    for (const t of active)
      if (t.status === "active" && t.day >= t.plannedDays && !t.awaitingDayEvent)
        endTour(s, t, "The final planned day completed; no extra review was needed", true);
    if (s.tourDayInWeek >= 7) s.pendingTourWeek = true;
    s.event = s.eventQueue.shift() || null;
    if (!s.event && s.pendingTourWeek) {
      s.pendingTourWeek = false;
      return advance(s, { fromDays: true });
    }
    return s;
  }
  function applyDailyTourChoice(s, e, o) {
    const t = s.tours.find((t) => t.id === e.tour);
    if (!t || t.status !== "active") return;
    if (o.qualityDelta) t.quality = clamp(t.quality + o.qualityDelta);
    if (o.lengthDelta)
      t.plannedDays = Math.max(t.day, Math.min(t.baseDays * 2, t.plannedDays + o.lengthDelta));
    if (o.restDays) {
      t.restDays += o.restDays;
      if (o.recoveryEnergy) {
        t.recoveryQueue ??= [];
        t.recoveryQueue.push({ days: o.restDays, energy: o.recoveryEnergy / o.restDays });
      }
    }
    if (o.tourCash) {
      s.cash += o.tourCash;
      t.revenue += o.tourCash;
      t.otherRevenue = (t.otherRevenue || 0) + o.tourCash;
      t.net = t.revenue - t.costs;
      t.history.push({
        week: s.week,
        day: t.day,
        event: true,
        revenue: o.tourCash,
        cost: 0,
        net: t.net,
        totalCosts: t.costs,
      });
    }
    const oldEffects = t.effects.length;
    applyTourChoice(s, e, o);
    for (let i = oldEffects; i < t.effects.length; i++)
      t.effects[i].untilDay = t.showDays + (o.tourBoostDays || 7 * (o.tourBoostWeeks || 2));
    if (o.tourPause) {
      t.restDays += o.tourPause * 7;
      t.plannedDays = Math.min(t.baseDays * 2, t.plannedDays + o.tourPause * 7);
      t.pause = 0;
    }
    checkTourProfit(s, t);
    scheduleTourReview(s, t, o);
    t.awaitingDayEvent = false;
    if (t.status === "active") {
      const min = Math.min(...t.artists.map((id) => s.artists.find((a) => a.id === id)?.energy ?? 0));
      if (min <= 2) endTour(s, t, "Exhaustion forced cancellation after today’s decision");
      else if (t.day >= t.plannedDays) endTour(s, t, "The final planned tour day was completed", true);
    }
  }

  const api = {
    makeProspect: (s, index) => prospect(s, index),
    /** Settles a queued company event with one of its options, as the player choosing it would. */
    settleCompanyEvent: (s, e, o) => {
      E.resolve(s, e, o);
      log(s, `${e.title}: ${o.label}.`);
    },
    THEMES: LD.THEMES,
    FIT: LD.FIT,
    FACILITIES: LD.FACILITIES,
    SYNERGIES: LD.SYNERGIES,
    RANKS: LD.RANKS,
    HQ: LD.HQ,
    PALETTE: LD.PALETTE,
    ARTIST_SPRITE: LD.ARTIST_SPRITE,
    GENRE_COLORS: LD.GENRE_COLORS,
    rank: L.rank,
    rankInfo: L.rankInfo,
    rankStatus: L.rankStatus,
    checkRank: L.checkRank,
    acknowledgeRankUp: L.acknowledgeRankUp,
    themeSlots: L.themeSlots,
    comboFit: L.comboFit,
    comboInfo: L.comboInfo,
    fitOf: L.fitOf,
    discoverTheme: L.discoverTheme,
    ladderLabel: L.ladderLabel,
    learnTheme: L.learnTheme,
    lotSize: L.lotSize,
    facilityAt: L.facilityAt,
    facilitiesOf: L.facilitiesOf,
    builtFacility: L.builtFacility,
    activeSynergies: L.activeSynergies,
    hqBonuses: L.hqBonuses,
    hqUpkeep: L.hqUpkeep,
    hqIncome: L.hqIncome,
    upgradeCost: L.upgradeCost,
    buildFacility: L.buildFacility,
    upgradeFacility: L.upgradeFacility,
    moveFacility: L.moveFacility,
    demolishFacility: L.demolishFacility,
    validLabelSave: L.validSave,
    validSystemsSave: (s) => hooks.every("validSave", s),
    compactHistory,
    planCost: (s, plan) => hooks.sum("planCost", s, plan),
    signingFee,
    systems: SYS,
    roll,
    tourInteractionBudget,
    tourChoiceGap,
    advanceTourToNextActivity,
    tourRemainingForecast,
    tourTicketRevenue,
    tourForecast,
    INSPIRATION_TIERS,
    inspirationInfo,
    CAREER_XP,
    CAREER_NAMES,
    DEBT: D.DEBT,
    careerTier,
    operatingYear,
    advanceTourDay,
    awardEligible,
    awardStrength,
    autoEnterAwards,
    enterAwards,
    resolveAnnualAwards,
    makeCEOEvent,
    ALBUM_ADDONS,
    TOUR_SCALES,
    TOUR_MODES,
    onTour,
    albumExpectation,
    popularAlbum,
    tourQuote,
    startTour,
    cancelTour,
    continueCareer,
    canContinueCareer,
    validRoadSave,
    SCOUT_BUDGETS,
    RECRUIT_BUDGETS,
    paidScout,
    recruitmentDrive,
    fire,
    staffSkill,
    staffBonus,
    roleSkill,
    hasRole,
    artistValue,
    contractQuote,
    renew,
    trainingInfo,
    eventOptionAvailable,
    acknowledgeMilestone,
    validManagementSave,
    GENRES,
    ROLES,
    BOOTHS,
    STAGES,
    RELEASE_PLANS,
    level,
    migrate,
    productionBlock,
    stagePreview,
    decideStage,
    continueProduction,
    albumQuality,
    reshuffle,
    acknowledgeReshuffle,
    releaseAlbum,
    create,
    tier,
    slots,
    sign,
    hire,
    build,
    train,
    releaseArtist,
    record,
    upkeep,
    choose,
    advance,
    busy,
  };
  // Systems publish their own functions through an `api` object.
  for (const x of SYS) Object.assign(api, x.api || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LabelGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
