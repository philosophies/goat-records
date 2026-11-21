// The story engine (3.0, design 6): plays arcs of beats as decision cards in CEO runs, remembers the
// flags each choice sets, and keeps a story log for every character. A story can be about an artist,
// a department head, an artist team member, a director or the company itself (rivals, the press,
// the street). Classic runs never see it. See docs/architecture.md for the hooks a system can implement.
(function (root) {
  "use strict";

  /** @param {object} core engine helpers  @param {object} D data tables */
  function create(core, D) {
    const { STORY_RULES } = D;
    // Packs add their arcs alongside the starter arcs.
    const ARCS = [...D.ARCS, ...(D.ARTIST_ARCS || []), ...(D.STAFF_ARCS || [])];
    const { clamp, log, roll } = core;
    const arcById = new Map(ARCS.map((a) => [a.id, a]));
    const beatOf = (arc, id) => arc.beats.find((b) => b.id === id);
    // Which kind of character each `who` is about.
    const KIND = {
      artist: "artist",
      cast: "artist",
      head: "head",
      member: "member",
      director: "director",
      company: "company",
    };

    function book(s) {
      return (s.company.stories ??= { arcs: [], log: {}, lastWeek: -STORY_RULES.gap });
    }

    // ---- Characters ----
    /** Every character a story could be about, with how to find them again. */
    function subjects(s) {
      const c = s.company,
        out = s.artists.map((a) => ({ kind: "artist", ref: a.id, obj: a, key: `artist:${a.id}` }));
      for (const [dept, d] of Object.entries(c.departments || {}))
        if (d.head) out.push({ kind: "head", ref: d.head.id, obj: d.head, dept, key: `head:${d.head.id}` });
      for (const m of c.team?.pool || [])
        out.push({ kind: "member", ref: m.id, obj: m, key: `member:${m.id}` });
      for (const d of c.board?.directors || [])
        out.push({ kind: "director", ref: d.id, obj: d, key: `director:${d.id}` });
      out.push({ kind: "company", ref: 0, obj: null, key: "company" });
      return out;
    }
    function subjectOf(s, kind, ref) {
      return subjects(s).find((x) => x.kind === kind && x.ref === ref) || null;
    }
    function runSubject(s, run) {
      return run.kind && run.kind !== "artist"
        ? subjectOf(s, run.kind, run.ref)
        : subjectOf(s, "artist", run.artist);
    }

    // ---- Conditions ----
    const within = (v, r) =>
      !r || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max));
    const oneOf = (v, want) => want === undefined || [].concat(want).includes(v);
    /** Whether every condition in `when` holds for this character (and, for flags, this arc). */
    function holds(s, who, when = {}, flags = {}) {
      const sub = who?.kind ? who : { kind: "artist", obj: who },
        api = core.api(),
        c = s.company,
        x = sub.obj;
      if (when.phase && (c.phase < when.phase[0] || c.phase > (when.phase[1] ?? 6))) return false;
      if (!within(s.cash, when.cash)) return false;
      if (when.flags && Object.entries(when.flags).some(([k, v]) => flags[k] !== v)) return false;
      if (when.board !== undefined && !!c.board !== when.board) return false;
      if (when.confidence && !(c.board && within(c.board.confidence ?? 50, when.confidence))) return false;
      if (when.public !== undefined && !!c.offering !== when.public) return false;
      if (!within(c.ownership ?? 1, when.ownership)) return false;
      if (!within(s.fame, when.labelFame)) return false;
      if (sub.kind === "artist") {
        const albums = s.albums.filter((p) => p.released && p.artist === x.id),
          last = albums.reduce((n, p) => Math.max(n, p.releaseWeek ?? -Infinity), -Infinity);
        if (when.tier && !oneOf(api.tierOf?.(x) || "rising", when.tier)) return false;
        if (!within(x.fame || 0, when.fame) || !within(x.morale ?? 0, when.morale)) return false;
        if (when.relation && !within(api.relationOf?.(x) ?? 0, when.relation)) return false;
        if (!within(albums.length, when.releases)) return false;
        if (when.hit && !albums.some((p) => (p.quality || 0) >= (api.TIER_RULES?.hitQuality ?? 75)))
          return false;
        if (when.sinceRelease && !within(s.week - last, when.sinceRelease)) return false;
        if (when.touring !== undefined && !!api.onTour(s, x.id) !== when.touring) return false;
      }
      if (sub.kind === "head") {
        if (!oneOf(sub.dept, when.dept)) return false;
        for (const k of ["skill", "ambition", "loyalty", "influence"])
          if (!within(x[k] ?? 0, when[k])) return false;
        if (when.plotting !== undefined && !!x.plot !== when.plotting) return false;
        if (!within(s.week - (x.hiredWeek ?? s.week), when.weeks)) return false;
      }
      if (sub.kind === "member") {
        if (!oneOf(x.role, when.role) || !within(x.skill ?? 0, when.skill)) return false;
        if (when.assigned !== undefined && x.artists.length > 0 !== when.assigned) return false;
      }
      if (sub.kind === "director") {
        if (!oneOf(x.type, when.type)) return false;
        if (
          !within(x.satisfaction ?? 50, when.satisfaction) ||
          !within(x.relationship ?? 0, when.relationship)
        )
          return false;
      }
      return true;
    }

    // ---- Picking a beat ----
    const lastBeatFor = (b, key) => b.log[key]?.at(-1)?.week ?? -Infinity;
    const castOf = (x) => (x?.castId && core.api().castEntry?.(x.castId)) || null;
    /** Every beat that could play this week: arcs under way first, then arcs that could start. */
    function dueBeats(s) {
      const b = book(s),
        out = [];
      for (const run of b.arcs.filter((r) => !r.done)) {
        const arc = arcById.get(run.arc),
          who = runSubject(s, run);
        if (!arc || !who) {
          run.done = true;
          continue;
        }
        const beat = beatOf(arc, run.next);
        if (!beat) {
          run.done = true;
          continue;
        }
        if (s.week < run.week + (beat.after || 0)) continue;
        if (beat.when?.flags && !holds(s, who, { flags: beat.when.flags }, run.flags)) {
          run.done = true; // the story went another way
          continue;
        }
        if (who.kind !== "company" && s.week - lastBeatFor(b, who.key) < STORY_RULES.personGap) continue;
        if (holds(s, who, beat.when, run.flags))
          out.push({
            run,
            arc,
            beat,
            who,
            a: who.kind === "artist" ? who.obj : null,
            weight: STORY_RULES.continueWeight,
          });
      }
      const started = new Set(
        b.arcs.map((r) => `${r.arc}:${r.kind || "artist"}:${r.kind ? r.ref : r.artist}`),
      );
      for (const who of subjects(s)) {
        if (who.kind !== "company" && s.week - lastBeatFor(b, who.key) < STORY_RULES.personGap) continue;
        if (
          b.arcs.some(
            (r) => !r.done && (r.kind || "artist") === who.kind && (r.kind ? r.ref : r.artist) === who.ref,
          )
        )
          continue;
        const cast = castOf(who.obj);
        for (const arc of ARCS) {
          if (KIND[arc.who] !== who.kind || started.has(`${arc.id}:${who.kind}:${who.ref}`)) continue;
          if (arc.who === "cast" && cast?.arc?.id !== arc.id) continue;
          if (arc.castId && who.obj?.castId !== arc.castId) continue;
          if (!holds(s, who, { ...arc.start, ...arc.beats[0].when })) continue;
          out.push({
            run: null,
            arc,
            beat: arc.beats[0],
            who,
            a: who.kind === "artist" ? who.obj : null,
            weight: 1,
          });
        }
      }
      return out;
    }

    // ---- Text ----
    const EFFECT_NAMES = [
      ["morale", "morale"],
      ["fans", "fans"],
      ["trust", "trust"],
      ["energy", "energy"],
      ["attention", "attention"],
      ["artistFame", "artist fame"],
      ["labelFame", "label fame"],
      ["reputation", "label reputation"],
    ];
    const STORY_NAMES = [
      ["xp", (n) => `${n} career XP`],
      ["skill", (n) => `skill ${signed(n)}`],
      ["loyalty", (n) => `loyalty ${signed(n)}`],
      ["ambition", (n) => `ambition ${signed(n)}`],
      ["influence", (n) => `influence ${signed(n)}`],
      ["relation", (n) => `relationship with you ${signed(n)}`],
      ["director", (n) => `their regard for you ${signed(n)}`],
      ["confidence", (n) => `board confidence ${signed(n)}`],
      ["rival", (n) => `standing with {rival} ${signed(n)}`],
    ];
    const signed = (n) => (n > 0 ? "+" + n : String(n));
    const dollars = (n) => "$" + Math.abs(n).toLocaleString("en-US");
    /** The choice's flavour line, then every effect in numbers, so the card never misstates them. */
    function choiceText(c) {
      const st = c.story || {},
        parts = [];
      if (c.cost) parts.push(`costs ${dollars(c.cost)}`);
      if (c.cash) parts.push(c.cash > 0 ? `earns ${dollars(c.cash)}` : `loses ${dollars(c.cash)}`);
      for (const [k, name] of EFFECT_NAMES) if (c[k]) parts.push(`${name} ${signed(c[k])}`);
      for (const [k, text] of STORY_NAMES) if (st[k]) parts.push(text(st[k]));
      if (c.trust <= -STORY_RULES.scandalTrust) parts.push("a public scandal");
      const effects = parts.length
        ? parts.join(", ").replace(/^./, (x) => x.toUpperCase()) + "."
        : "No change.";
      return c.note ? `${c.note} ${effects}` : effects;
    }
    function fill(text, s, who, run) {
      const api = core.api(),
        rival = s.rivalCompanies?.find((r) => r.id === run?.rival),
        dept = who?.kind === "head" ? api.DEPARTMENTS?.find((d) => d.id === who.dept) : null,
        role = who?.kind === "member" ? api.TEAM_ROLES?.find((r) => r.id === who.obj.role) : null;
      return text
        .replaceAll("{name}", who?.obj?.name || api.labelName?.(s) || "the label")
        .replaceAll("{label}", api.labelName?.(s) || "the label")
        .replaceAll("{dept}", dept?.name || "the department")
        .replaceAll("{role}", role?.name.toLowerCase() || "team member")
        .replaceAll("{rival}", rival?.name || "a rival label")
        .replaceAll("{rivalCeo}", rival?.ceo || "their CEO");
    }

    // ---- Playing ----
    /** Queues a beat as a decision card. */
    function play(s, due) {
      const b = book(s),
        { arc, beat } = due,
        who = due.who || { kind: "artist", ref: due.a.id, obj: due.a, key: `artist:${due.a.id}` };
      let run = due.run;
      if (!run) {
        run = { arc: arc.id, next: beat.id, flags: {}, week: s.week, done: false };
        if (who.kind === "artist") run.artist = who.ref;
        else Object.assign(run, { kind: who.kind, ref: who.ref });
        if (arc.rival && s.rivalCompanies?.length)
          run.rival = s.rivalCompanies[Math.floor(roll(s, "stories") * s.rivalCompanies.length)].id;
        b.arcs.push(run);
      }
      const options = beat.choices.map((c, i) => {
        const { label, note, cost, story, ...effects } = c;
        const opt = {
          ...effects,
          label: fill(label, s, who, run),
          hint: fill(choiceText(c), s, who, run),
          cost,
          storyChoice: i,
        };
        if (effects.trust < 0 && -effects.trust < STORY_RULES.scandalTrust) opt.privateTrust = true;
        return opt;
      });
      const card = {
        type: "story",
        arc: arc.id,
        beat: beat.id,
        title: fill(beat.title, s, who, run),
        body: fill(beat.body, s, who, run),
        options,
      };
      if (who.kind === "artist") card.artist = who.ref;
      else card.subject = { kind: who.kind, ref: who.ref };
      s.eventQueue.push(card);
      b.lastWeek = s.week;
      run.pending = beat.id;
    }
    const sameRun = (r, e) =>
      r.arc === e.arc &&
      (e.subject ? r.kind === e.subject.kind && r.ref === e.subject.ref : !r.kind && r.artist === e.artist);
    function cardSubjectGone(s, e) {
      return e.subject
        ? !subjectOf(s, e.subject.kind, e.subject.ref)
        : !s.artists.some((a) => a.id === e.artist);
    }
    function weekly(s) {
      if (!s.company || s.finished) return 0;
      const b = book(s);
      // A queued beat whose character has left is dropped, and its arc ends.
      s.eventQueue = s.eventQueue.filter((e) => {
        if (e.type !== "story" || !cardSubjectGone(s, e)) return true;
        const r = b.arcs.find((x) => sameRun(x, e));
        if (r) {
          r.done = true;
          delete r.pending;
        }
        return false;
      });
      if (s.event?.type === "story" || s.eventQueue.some((e) => e.type === "story")) return 0;
      if (s.week - b.lastWeek < STORY_RULES.gap) return 0;
      const due = dueBeats(s);
      if (!due.length || roll(s, "stories") >= STORY_RULES.chance) return 0;
      const total = due.reduce((n, x) => n + x.weight, 0);
      let r = roll(s, "stories") * total;
      play(s, due.find((x) => (r -= x.weight) < 0) || due.at(-1));
      return 0;
    }

    // ---- Resolving a beat ----
    function eventChoice(s, e, o) {
      if (e.type !== "story") return;
      const b = book(s),
        run = b.arcs.find((r) => sameRun(r, e) && r.pending === e.beat),
        arc = arcById.get(e.arc),
        beat = arc && beatOf(arc, e.beat),
        choice = beat?.choices[o.storyChoice],
        who = run && runSubject(s, run);
      if (!run || !choice) return;
      const st = choice.story || {},
        x = who?.obj;
      Object.assign(run.flags, st.set || {});
      if (who?.kind === "artist") {
        if (st.xp) x.xp = (x.xp || 0) + st.xp;
        if (st.relation) core.api().shiftRelation?.(s, x, st.relation);
        if (st.loyalty && core.api().artistMood?.(s, x) && x.persona)
          x.persona.loyalty = clamp(x.persona.loyalty + st.loyalty, 0, 100);
      } else if (x) {
        for (const k of ["skill", "loyalty", "ambition", "influence"])
          if (st[k] && Number.isFinite(x[k])) x[k] = clamp(x[k] + st[k], 0, 100);
        if (who.kind === "director" && st.director)
          x.relationship = clamp((x.relationship || 0) + st.director, -25, 25);
      }
      const board = s.company.board;
      if (st.confidence && board) {
        board.eventConfidence = clamp((board.eventConfidence || 0) + st.confidence, -100, 100);
        if (Number.isFinite(board.confidence)) board.confidence = clamp(board.confidence + st.confidence);
      }
      if (st.rival && run.rival) {
        const r = s.rivalCompanies?.find((c) => c.id === run.rival);
        if (r) r.relationship = clamp((r.relationship || 0) + st.rival, -100, 100);
      }
      delete run.pending;
      run.week = s.week;
      run.next = st.next ?? null;
      if (!run.next) run.done = true;
      const key = who?.key || (e.subject ? `${e.subject.kind}:${e.subject.ref}` : `artist:${e.artist}`);
      // The card's own label, with names filled in.
      (b.log[key] ??= []).push({ week: s.week, arc: arc.id, title: e.title, choice: o.label });
      b.log[key] = b.log[key].slice(-STORY_RULES.logSize);
      log(s, `${e.title}: ${o.label}.`);
    }
    /** Whose story a card is, for its tag: a person's name, or the label's. */
    function storyCardName(s, e) {
      if (!e.subject) return s.artists.find((a) => a.id === e.artist)?.name || "An artist";
      if (e.subject.kind === "company") return "The label";
      return subjectOf(s, e.subject.kind, e.subject.ref)?.obj?.name || "Someone";
    }
    /** A character's story log, oldest first: pass an artist, or a key like "head:3" or "company". */
    function storyLog(s, who) {
      const key = typeof who === "string" ? who : `artist:${who.id}`;
      return s.company?.stories?.log[key] || [];
    }

    function validSave(s) {
      const b = s.company?.stories;
      if (b === undefined) return true;
      const okRun = (r) =>
        r &&
        arcById.has(r.arc) &&
        (r.kind === undefined ? Number.isInteger(r.artist) : !!KIND[r.kind] && r.ref !== undefined) &&
        (r.next === null || !!beatOf(arcById.get(r.arc), r.next)) &&
        !!r.flags &&
        typeof r.flags === "object" &&
        Number.isInteger(r.week) &&
        typeof r.done === "boolean";
      const okLog = (l) =>
        Array.isArray(l) && l.every((x) => x && Number.isInteger(x.week) && typeof x.title === "string");
      return (
        !!b &&
        Number.isInteger(b.lastWeek) &&
        Array.isArray(b.arcs) &&
        b.arcs.every(okRun) &&
        !!b.log &&
        typeof b.log === "object" &&
        Object.values(b.log).every(okLog) &&
        [s.event, ...(s.eventQueue || [])].every(
          (e) =>
            e?.type !== "story" ||
            (arcById.has(e.arc) &&
              !!beatOf(arcById.get(e.arc), e.beat) &&
              e.options.every((o) => !!beatOf(arcById.get(e.arc), e.beat).choices[o.storyChoice])),
        )
      );
    }

    return {
      weekly,
      eventChoice,
      validSave,
      api: {
        ARCS,
        STORY_RULES,
        storyLog,
        storyDue: dueBeats,
        playStory: play,
        storyHolds: holds,
        storyChoiceText: choiceText,
        storyCardName,
      },
    };
  }

  root.GoatSystems = Object.assign(root.GoatSystems || {}, { stories: create });
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
})(typeof globalThis !== "undefined" ? globalThis : this);
